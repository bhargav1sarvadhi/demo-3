import { MODEL, STRATEGY } from '../constant';
import { db } from '../model';
import { logger } from '../logger/logger';
import {
    ScalpingConfig,
    calculatePositionSize,
} from './scalping.risk.helper';
import { placeEntryOrderIfLive } from './scalping.trade.helper';
import { logScalpingDecision } from './scalping.audit.helper';
import {
    resolveScalpingStrike,
    validateMarketQuality,
} from './scalping.market.quality.helper';
import {
    aggregateTo5m,
    calculateEmaCrossover,
    calculateLatestATR,
    calculateLatestRSI,
    normalizeCandles,
    CandleRow,
} from './scalping.indicators';

const { EMA } = require('technicalindicators');

export type SignalType = 'CE' | 'PE';

export interface EntryValidationResult {
    ok: boolean;
    reason?: string;
    buyPrice?: number;
    stopLoss?: number;
    targetPrice?: number;
    lastCandle?: CandleRow;
    indicators?: Record<string, number>;
}

let entryInProgress = false;

export const validateEntrySignal = (
    signalType: SignalType,
    rawCandles: any[],
    config: ScalpingConfig,
): EntryValidationResult => {
    const min1m = config.min_candles_1m ?? 22;
    if (rawCandles.length < min1m) {
        return { ok: false, reason: 'INSUFFICIENT_CANDLES' };
    }

    const candles = normalizeCandles(rawCandles);
    const closes = candles.map((c) => c.close);
    const lastCandle = candles[candles.length - 1];

    const { bullishCross, bearishCross, lastFast, lastSlow } =
        calculateEmaCrossover(closes, config.ema_fast, config.ema_slow);

    if (signalType === 'CE' && !bullishCross) {
        return { ok: false, reason: 'NO_CE_EMA_CROSS' };
    }
    if (signalType === 'PE' && !bearishCross) {
        return { ok: false, reason: 'NO_PE_EMA_CROSS' };
    }

    const lookback = config.volume_lookback ?? 10;
    if (candles.length > lookback) {
        const recent = candles.slice(-(lookback + 1), -1);
        const avgVol =
            recent.reduce((s, c) => s + c.volume, 0) / recent.length;
        if (lastCandle.volume <= avgVol) {
            return {
                ok: false,
                reason: 'LOW_VOLUME',
                indicators: { volume: lastCandle.volume, avgVolume: avgVol },
            };
        }
    }

    const rsi = calculateLatestRSI(closes, config.rsi_period ?? 14);
    if (rsi === null) {
        return { ok: false, reason: 'RSI_UNAVAILABLE' };
    }
    if (signalType === 'CE' && rsi >= (config.rsi_ce_max ?? 70)) {
        return {
            ok: false,
            reason: 'RSI_OVERBOUGHT',
            indicators: { rsi },
        };
    }
    if (signalType === 'PE' && rsi <= (config.rsi_pe_min ?? 30)) {
        return {
            ok: false,
            reason: 'RSI_OVERSOLD',
            indicators: { rsi },
        };
    }

    const trendPeriod = config.trend_ema_period ?? 21;
    const min1mFor5m = trendPeriod * 5;
    if (candles.length < min1mFor5m) {
        return { ok: false, reason: 'INSUFFICIENT_5M_CANDLES' };
    }

    const candles5m = aggregateTo5m(candles.slice(-min1mFor5m));
    const closes5m = candles5m.map((c) => c.close);
    const ema5m = EMA.calculate({
        period: trendPeriod,
        values: closes5m,
    });
    const lastEma5m = ema5m[ema5m.length - 1];
    const lastClose5m = closes5m[closes5m.length - 1];

    if (signalType === 'CE' && lastClose5m <= lastEma5m) {
        return {
            ok: false,
            reason: 'CE_COUNTER_TREND_5M',
            indicators: { ema5m: lastEma5m, close5m: lastClose5m },
        };
    }
    if (signalType === 'PE' && lastClose5m >= lastEma5m) {
        return {
            ok: false,
            reason: 'PE_COUNTER_TREND_5M',
            indicators: { ema5m: lastEma5m, close5m: lastClose5m },
        };
    }

    const atr = calculateLatestATR(candles);
    if (!atr || atr <= 0) {
        return { ok: false, reason: 'ATR_UNAVAILABLE' };
    }

    const buyPrice = lastCandle.close;
    const stopLoss = buyPrice - atr * config.atr_stop_multiplier;
    const targetPrice = buyPrice + atr * config.atr_target_multiplier;

    const risk = buyPrice - stopLoss;
    const reward = targetPrice - buyPrice;
    const rr = risk > 0 ? reward / risk : 0;

    if (rr < config.min_rr_ratio) {
        return {
            ok: false,
            reason: 'BAD_RR_RATIO',
            indicators: { rr, atr, rsi },
        };
    }

    if (stopLoss >= buyPrice || targetPrice <= buyPrice) {
        return { ok: false, reason: 'INVALID_STOP_TARGET' };
    }

    return {
        ok: true,
        buyPrice,
        stopLoss,
        targetPrice,
        lastCandle,
        indicators: {
            rsi,
            atr,
            rr,
            ema9: lastFast,
            ema21: lastSlow,
            ema5m: lastEma5m,
        },
    };
};

export const executeScalpingEntry = async ({
    stcoks,
    validation,
    config,
    accountBalance,
    entryUser,
    formattedDate,
    currentISTDate,
}: {
    stcoks: any;
    validation: EntryValidationResult;
    config: ScalpingConfig;
    accountBalance: number;
    entryUser: any;
    formattedDate: string;
    currentISTDate: Date;
}): Promise<boolean> => {
    if (!validation.ok || !validation.buyPrice) return false;

    const activePosition = await db[MODEL.POSITION].findOne({
        where: { strategy_name: STRATEGY.SCALLPING, is_active: true },
    });
    if (activePosition || entryInProgress) return false;

    entryInProgress = true;
    try {
        const entryQty = calculatePositionSize({
            accountBalance,
            buyPrice: validation.buyPrice,
            stopLoss: validation.stopLoss!,
            lotSize: Number(stcoks.lot_size),
            config,
        });

        const create_postions = await db[MODEL.POSITION].create({
            strategy_id: '50e7fd1e-54e6-4686-93d0-c0adbaff65bf',
            strategy_name: STRATEGY.SCALLPING,
            is_active: true,
            qty: entryQty,
            trade_id: Math.floor(100000 + Math.random() * 900000),
            date: formattedDate,
            start_time: currentISTDate,
            required_margin:
                Number(stcoks.ltp) * Number(stcoks.lot_size) * entryQty,
        });

        if (!create_postions) return false;

        const trade_placed = await db[MODEL.TRADE].create({
            position_id: create_postions.id,
            options_chain_id: stcoks.options_chain_id ?? stcoks.id,
            trade_id: create_postions.trade_id,
            strategy_name: STRATEGY.SCALLPING,
            trading_symbol: stcoks.trading_symbol,
            instrument_key: stcoks.instrument_key,
            instrument_type: stcoks.instrument_type,
            trade_type: 'BUY',
            buy_price: validation.buyPrice,
            target_price: validation.targetPrice,
            stop_loss: validation.stopLoss,
            is_active: true,
            ltp: stcoks.ltp,
            qty: entryQty,
            lot_size: stcoks.lot_size,
            highest_ltp: stcoks.ltp,
            original_qty: entryQty,
            partial_exit_done: false,
        });

        if (!trade_placed) return false;

        logger.info(
            `Trade placed: ${stcoks.instrument_type} qty=${entryQty} R:R=${validation.indicators?.rr?.toFixed(2)} RSI=${validation.indicators?.rsi?.toFixed(1)}`,
        );

        await placeEntryOrderIfLive(
            entryUser,
            stcoks.instrument_key,
            stcoks.lot_size,
            entryQty,
            create_postions.id,
            config,
        );

        await logScalpingDecision({
            strategyName: STRATEGY.SCALLPING,
            action: 'ENTER',
            reason: 'SIGNAL_PASSED',
            signal:
                stcoks.instrument_type === 'CE' ? 'CE_BUY' : 'PE_BUY',
            instrumentKey: stcoks.instrument_key,
            tradeId: trade_placed.id,
            engineState: 'SCANNING',
            config,
            indicators: validation.indicators,
            metadata: {
                qty: entryQty,
                buy_price: validation.buyPrice,
                stop_loss: validation.stopLoss,
                target_price: validation.targetPrice,
            },
        });

        return true;
    } finally {
        entryInProgress = false;
    }
};

export const trySignalEntry = async ({
    signalType,
    instrumentType,
    config,
    accountBalance,
    entryUser,
    formattedDate,
    currentISTDate,
    engineState = 'SCANNING',
}: {
    signalType: SignalType;
    instrumentType: 'CE' | 'PE';
    config: ScalpingConfig;
    accountBalance: number;
    entryUser: any;
    formattedDate: string;
    currentISTDate: Date;
    engineState?: string;
}): Promise<boolean> => {
    const resolved = await resolveScalpingStrike(instrumentType, config);
    if (!resolved.ok || !resolved.strike) {
        logger.info(
            `${instrumentType} strike resolve failed: ${resolved.reason}`,
        );
        if (
            resolved.reason &&
            resolved.reason !== 'NO_CE_EMA_CROSS' &&
            resolved.reason !== 'NO_PE_EMA_CROSS'
        ) {
            await logScalpingDecision({
                strategyName: STRATEGY.SCALLPING,
                action: 'SKIP',
                reason: resolved.reason,
                signal: signalType === 'CE' ? 'CE_BUY' : 'PE_BUY',
                engineState,
                config,
                timestamp: currentISTDate,
            });
        }
        return false;
    }

    const stcoks = resolved.strike;

    const quality = await validateMarketQuality({
        strike: stcoks,
        config,
        currentISTDate,
    });
    if (!quality.ok) {
        logger.info(
            `${instrumentType} market quality failed: ${quality.reason}`,
            quality.indicators ?? '',
        );
        await logScalpingDecision({
            strategyName: STRATEGY.SCALLPING,
            action: 'SKIP',
            reason: quality.reason,
            signal: signalType === 'CE' ? 'CE_BUY' : 'PE_BUY',
            instrumentKey: stcoks.instrument_key,
            engineState,
            config,
            timestamp: currentISTDate,
            indicators: quality.indicators,
            metadata: {
                strike_price: stcoks.strike_price,
                expiry: stcoks.expiry,
            },
        });
        return false;
    }

    const candleLimit = Math.max(120, (config.trend_ema_period ?? 21) * 5 + 22);
    const candles = await db[MODEL.CANDELS].findAll({
        where: { instrument_key: stcoks.instrument_key },
        order: [['ts', 'DESC']],
        limit: candleLimit,
    });

    const validation = validateEntrySignal(signalType, candles, config);
    if (!validation.ok) {
        if (
            validation.reason !== 'NO_CE_EMA_CROSS' &&
            validation.reason !== 'NO_PE_EMA_CROSS'
        ) {
            logger.info(
                `${signalType} entry skipped: ${validation.reason}`,
                validation.indicators ?? '',
            );
            await logScalpingDecision({
                strategyName: STRATEGY.SCALLPING,
                action: 'SKIP',
                reason: validation.reason,
                signal: signalType === 'CE' ? 'CE_BUY' : 'PE_BUY',
                instrumentKey: stcoks.instrument_key,
                engineState,
                config,
                timestamp: currentISTDate,
                indicators: validation.indicators,
            });
        }
        return false;
    }

    logger.info(
        `${signalType} signal passed all filters`,
        validation.indicators ?? '',
    );

    return executeScalpingEntry({
        stcoks,
        validation,
        config,
        accountBalance,
        entryUser,
        formattedDate,
        currentISTDate,
    });
};
