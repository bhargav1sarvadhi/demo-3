import axios from 'axios';
import moment from 'moment';
import { Op } from 'sequelize';
import {
    INSTRUMENT_KEYS,
    MODEL,
    STRATEGY,
    USER_DETAILS,
} from '../constant';
import { db } from '../model';
import { logger } from '../logger/logger';
import {
    ScalpingConfig,
    buildMarketTime,
    getStrategyConfig,
    canOpenNewTrade,
} from './scalping.risk.helper';
import { isLiveTradingEnabled } from './scalping.trade.helper';
import {
    current_strike_price,
    get_upcoming_expiry_date,
    getCurrentISTDate,
} from './stock.helper';

export type MarketQualityResult = {
    ok: boolean;
    reason?: string;
    indicators?: Record<string, number>;
};

export type ResolvedStrike = {
    id: string;
    options_chain_id?: string;
    instrument_key: string;
    instrument_type: string;
    trading_symbol: string;
    lot_size: number;
    ltp: number;
    strike_price: number;
    expiry: string;
    bid_price?: number;
    ask_price?: number;
    open_interest?: number;
    spread_pct?: number;
};

export const roundToStrikeStep = (
    underlyingLtp: number,
    strikeStep: number,
): number => {
    if (strikeStep <= 0) return Math.round(underlyingLtp);
    return Math.round(underlyingLtp / strikeStep) * strikeStep;
};

export const applyItmOffset = (
    atmStrike: number,
    instrumentType: 'CE' | 'PE',
    itmSteps: number,
    strikeStep: number,
): number => {
    const steps = itmSteps ?? 0;
    if (steps <= 0) return atmStrike;
    if (instrumentType === 'CE') {
        return atmStrike - steps * strikeStep;
    }
    return atmStrike + steps * strikeStep;
};

export const getUnderlyingLtp = async (
    config: ScalpingConfig,
): Promise<number> => {
    const key =
        config.underlying_instrument_key ?? INSTRUMENT_KEYS.SBIN_INSTRUMENT;

    const instrument = await db[MODEL.INSTRUMENT].findOne({
        where: { instrument_key: key },
    });
    const dbLtp = Number(instrument?.last_price);
    if (dbLtp > 0) return dbLtp;

    try {
        return await current_strike_price(key);
    } catch {
        return 0;
    }
};

const findNearestOptionStrike = async ({
    underlyingName,
    instrumentType,
    expiry,
    targetStrike,
}: {
    underlyingName: string;
    instrumentType: 'CE' | 'PE';
    expiry: string;
    targetStrike: number;
}) => {
    const exact = await db[MODEL.OPTIONS_CHAINS].findOne({
        where: {
            name: underlyingName,
            instrument_type: instrumentType,
            expiry,
            strike_price: targetStrike,
        },
    });
    if (exact) return exact;

    const options = await db[MODEL.OPTIONS_CHAINS].findAll({
        where: {
            name: underlyingName,
            instrument_type: instrumentType,
            expiry,
        },
        order: [['strike_price', 'ASC']],
    });
    if (!options.length) return null;

    return options.reduce((best, row) => {
        const bestDiff = Math.abs(Number(best.strike_price) - targetStrike);
        const rowDiff = Math.abs(Number(row.strike_price) - targetStrike);
        return rowDiff < bestDiff ? row : best;
    });
};

const mapOptionToStrike = (option: any, feedRow?: any): ResolvedStrike => ({
    id: feedRow?.id ?? option.id,
    options_chain_id: option.id,
    instrument_key: option.instrument_key,
    instrument_type: option.instrument_type,
    trading_symbol: option.trading_symbol,
    lot_size: Number(option.lot_size),
    ltp: Number(feedRow?.ltp ?? option.ltp ?? 0),
    strike_price: Number(option.strike_price),
    expiry: option.expiry,
    bid_price: feedRow?.bid_price,
    ask_price: feedRow?.ask_price,
    open_interest: feedRow?.open_interest,
    spread_pct: feedRow?.spread_pct,
});

export const resolveDynamicStrike = async (
    instrumentType: 'CE' | 'PE',
    config: ScalpingConfig,
): Promise<{ ok: boolean; reason?: string; strike?: ResolvedStrike }> => {
    const underlyingName =
        config.underlying_name ?? 'STATE BANK OF INDIA';
    const strikeStep = config.strike_step ?? 10;

    const underlyingLtp = await getUnderlyingLtp(config);
    if (underlyingLtp <= 0) {
        return { ok: false, reason: 'UNDERLYING_LTP_UNAVAILABLE' };
    }

    const expiry = await get_upcoming_expiry_date(underlyingName);
    if (!expiry) {
        return { ok: false, reason: 'NO_EXPIRY_FOUND' };
    }

    const atmStrike = roundToStrikeStep(underlyingLtp, strikeStep);
    const targetStrike = applyItmOffset(
        atmStrike,
        instrumentType,
        config.atm_itm_steps ?? 0,
        strikeStep,
    );

    const option = await findNearestOptionStrike({
        underlyingName,
        instrumentType,
        expiry,
        targetStrike,
    });
    if (!option) {
        return { ok: false, reason: 'ATM_STRIKE_NOT_FOUND' };
    }

    const feedRow = await db[MODEL.STRIKE_MODEL].findOne({
        where: { instrument_key: option.instrument_key },
    });

    return {
        ok: true,
        strike: mapOptionToStrike(option, feedRow ?? undefined),
    };
};

export const resolveScalpingStrike = async (
    instrumentType: 'CE' | 'PE',
    config: ScalpingConfig,
): Promise<{ ok: boolean; reason?: string; strike?: ResolvedStrike }> => {
    if (config.enable_dynamic_atm !== false) {
        return resolveDynamicStrike(instrumentType, config);
    }

    const row = await db[MODEL.STRIKE_MODEL].findOne({
        where: { instrument_type: instrumentType, is_active: true },
    });
    if (!row?.instrument_key) {
        return { ok: false, reason: 'NO_ACTIVE_STRIKE' };
    }

    return {
        ok: true,
        strike: mapOptionToStrike(row, row),
    };
};

export const checkExpiryEntryAllowed = (
    expiry: string | Date,
    currentISTDate: Date,
    config: ScalpingConfig,
): MarketQualityResult => {
    if (config.enable_expiry_rules === false) {
        return { ok: true };
    }

    const expiryDate = moment(expiry).format('YYYY-MM-DD');
    const today = moment(currentISTDate).format('YYYY-MM-DD');
    if (expiryDate !== today) {
        return { ok: true };
    }

    const cutoff = buildMarketTime(
        today,
        config.expiry_day_cutoff_time ?? '14:00',
    );
    if (currentISTDate >= cutoff) {
        return { ok: false, reason: 'EXPIRY_DAY_LATE' };
    }

    return { ok: true };
};

export const checkStrikeLiquidity = (
    strike: ResolvedStrike,
    config: ScalpingConfig,
): MarketQualityResult => {
    if (config.enable_liquidity_check === false) {
        return { ok: true };
    }

    const ltp = Number(strike.ltp);
    const bid = Number(strike.bid_price);
    const ask = Number(strike.ask_price);

    if (ltp > 0 && bid > 0 && ask > 0 && ask >= bid) {
        const spreadPct = (ask - bid) / ltp;
        if (spreadPct > (config.max_spread_pct ?? 0.02)) {
            return {
                ok: false,
                reason: 'WIDE_SPREAD',
                indicators: { spreadPct, bid, ask, ltp },
            };
        }
    }

    const oi = Number(strike.open_interest ?? 0);
    const minOi = config.min_open_interest ?? 10000;
    if (oi > 0 && oi < minOi) {
        return {
            ok: false,
            reason: 'LOW_OI',
            indicators: { oi, minOi },
        };
    }

    if (ltp <= 0) {
        return { ok: false, reason: 'NO_LTP' };
    }

    return { ok: true };
};

export const fetchOptionQuote = async (
    instrumentKey: string,
): Promise<Partial<ResolvedStrike> | null> => {
    try {
        const user = await db[MODEL.USER].findOne({
            where: { email: USER_DETAILS.EMAIL },
        });
        if (!user?.token) return null;

        const response = await axios.get(
            'https://api.upstox.com/v2/market-quote/quotes',
            {
                headers: {
                    Authorization: `Bearer ${user.token}`,
                    Accept: 'application/json',
                },
                params: { instrument_key: instrumentKey },
            },
        );

        const quote = response.data?.data?.[instrumentKey];
        if (!quote) return null;

        const bid = Number(quote.bid_price ?? quote.depth?.buy?.[0]?.price ?? 0);
        const ask = Number(quote.ask_price ?? quote.depth?.sell?.[0]?.price ?? 0);
        const ltp = Number(quote.last_price ?? 0);
        const oi = Number(quote.oi ?? quote.open_interest ?? 0);
        const spreadPct =
            ltp > 0 && bid > 0 && ask > 0 ? (ask - bid) / ltp : undefined;

        return {
            ltp,
            bid_price: bid,
            ask_price: ask,
            open_interest: oi,
            spread_pct: spreadPct,
        };
    } catch {
        return null;
    }
};

export const enrichStrikeWithQuote = async (
    strike: ResolvedStrike,
): Promise<ResolvedStrike> => {
    if (
        strike.bid_price != null &&
        strike.ask_price != null &&
        strike.open_interest != null &&
        strike.ltp > 0
    ) {
        return strike;
    }

    const quote = await fetchOptionQuote(strike.instrument_key);
    if (!quote) return strike;

    return {
        ...strike,
        ltp: quote.ltp ?? strike.ltp,
        bid_price: quote.bid_price ?? strike.bid_price,
        ask_price: quote.ask_price ?? strike.ask_price,
        open_interest: quote.open_interest ?? strike.open_interest,
        spread_pct: quote.spread_pct ?? strike.spread_pct,
    };
};

export const syncActiveScalpingStrikes = async (
    config: ScalpingConfig,
): Promise<void> => {
    if (config.enable_dynamic_atm === false) return;

    for (const instrumentType of ['CE', 'PE'] as const) {
        const resolved = await resolveDynamicStrike(instrumentType, config);
        if (!resolved.ok || !resolved.strike) continue;

        await db[MODEL.STRIKE_MODEL].update(
            { is_active: false },
            { where: { instrument_type: instrumentType } },
        );

        const existing = await db[MODEL.STRIKE_MODEL].findOne({
            where: { instrument_key: resolved.strike.instrument_key },
        });

        if (existing) {
            await db[MODEL.STRIKE_MODEL].update(
                { is_active: true, ltp: resolved.strike.ltp || existing.ltp },
                { where: { id: existing.id } },
            );
        } else {
            const option = await db[MODEL.OPTIONS_CHAINS].findOne({
                where: { instrument_key: resolved.strike.instrument_key },
            });
            if (option) {
                await db[MODEL.STRIKE_MODEL].create({
                    name: option.name,
                    segment: option.segment,
                    exchange: option.exchange,
                    expiry: option.expiry,
                    weekly: option.weekly,
                    instrument_key: option.instrument_key,
                    exchange_token: option.exchange_token,
                    trading_symbol: option.trading_symbol,
                    tick_size: option.tick_size,
                    lot_size: option.lot_size,
                    instrument_type: option.instrument_type,
                    freeze_quantity: option.freeze_quantity,
                    underlying_type: option.underlying_type,
                    underlying_key: option.underlying_key,
                    underlying_symbol: option.underlying_symbol,
                    strike_price: option.strike_price,
                    ltp: resolved.strike.ltp,
                    minimum_lot: option.minimum_lot,
                    is_active: true,
                });
            }
        }
    }

    logger.info('Dynamic ATM strikes synced to strike_price_details');
};

export const validateMarketQuality = async ({
    strike,
    config,
    currentISTDate,
}: {
    strike: ResolvedStrike;
    config: ScalpingConfig;
    currentISTDate: Date;
}): Promise<MarketQualityResult> => {
    const expiryCheck = checkExpiryEntryAllowed(
        strike.expiry,
        currentISTDate,
        config,
    );
    if (!expiryCheck.ok) return expiryCheck;

    const enriched = await enrichStrikeWithQuote(strike);
    return checkStrikeLiquidity(enriched, config);
};

export interface ScalpingSystemStatus {
    mode: string;
    isActive: boolean;
    isLive: boolean;
    liveTradingEnabled: boolean;
    marketOpen: boolean;
    engineState: string;
    underlyingLtp: number;
    openPosition: boolean;
    readyForTrading: boolean;
    activeStrikes: {
        CE?: ResolvedStrike | null;
        PE?: ResolvedStrike | null;
    };
    strikeResolution: {
        CE?: { ok: boolean; reason?: string };
        PE?: { ok: boolean; reason?: string };
    };
    candleCounts: {
        CE?: number;
        PE?: number;
    };
    todayStats: {
        tradesCount: number;
        dailyPl: number;
        isHalted: boolean;
    } | null;
    issues: string[];
}

const getCandleCount = async (instrumentKey: string): Promise<number> =>
    db[MODEL.CANDELS].count({
        where: { instrument_key: instrumentKey },
    });

export const getScalpingSystemStatus =
    async (): Promise<ScalpingSystemStatus> => {
        const config = await getStrategyConfig(STRATEGY.SCALLPING);
        const issues: string[] = [];
        const currentISTDate = getCurrentISTDate();
        const formattedDate = currentISTDate.toISOString().slice(0, 10);
        const startTime = buildMarketTime(
            formattedDate,
            config.market_start_time,
        );
        const endTime = buildMarketTime(
            formattedDate,
            config.market_end_time,
        );
        const marketOpen =
            currentISTDate >= startTime && currentISTDate <= endTime;

        const user = await db[MODEL.USER].findOne({
            where: { email: USER_DETAILS.EMAIL },
        });
        const isLive = Boolean(user?.is_live);
        const liveTradingEnabled = isLiveTradingEnabled(user, config);

        const ceResolved = await resolveScalpingStrike('CE', config);
        const peResolved = await resolveScalpingStrike('PE', config);

        const candleCounts: ScalpingSystemStatus['candleCounts'] = {};
        const minCandles = config.min_candles_1m ?? 22;

        for (const type of ['CE', 'PE'] as const) {
            const resolved = type === 'CE' ? ceResolved : peResolved;
            if (resolved.strike?.instrument_key) {
                candleCounts[type] = await getCandleCount(
                    resolved.strike.instrument_key,
                );
                if ((candleCounts[type] ?? 0) < minCandles) {
                    issues.push(
                        `${type} candle history insufficient (${candleCounts[type]}/${minCandles})`,
                    );
                }
            }
        }

        const underlyingLtp = await getUnderlyingLtp(config);
        if (underlyingLtp <= 0) {
            issues.push('Underlying LTP unavailable');
        }
        if (!ceResolved.ok) {
            issues.push(`CE: ${ceResolved.reason}`);
        }
        if (!peResolved.ok) {
            issues.push(`PE: ${peResolved.reason}`);
        }
        if (!config.is_active) {
            issues.push('Strategy is inactive in config');
        }
        if (config.mode === 'backtest') {
            issues.push('Mode is backtest — live engine disabled');
        }

        const openPosition = Boolean(
            await db[MODEL.POSITION].findOne({
                where: {
                    strategy_name: STRATEGY.SCALLPING,
                    is_active: true,
                },
            }),
        );

        const todayStatsRow = await db[MODEL.STRATEGY_DAILY_STATS].findOne({
            where: {
                strategy_name: STRATEGY.SCALLPING,
                trade_date: formattedDate,
            },
        });

        let engineState = 'MARKET_CLOSED';
        if (marketOpen && config.is_active && config.mode !== 'backtest') {
            if (openPosition) {
                engineState = 'IN_TRADE_OR_WAITING';
            } else {
                engineState = 'SCANNING';
            }
        }

        const canTrade = await canOpenNewTrade(
            STRATEGY.SCALLPING,
            config,
            currentISTDate,
        );
        if (!canTrade.ok && canTrade.reason) {
            issues.push(canTrade.reason);
        }

        return {
            mode: config.mode,
            isActive: config.is_active,
            isLive,
            liveTradingEnabled,
            marketOpen,
            engineState,
            underlyingLtp,
            openPosition,
            readyForTrading:
                issues.length === 0 && marketOpen && config.is_active,
            activeStrikes: {
                CE: ceResolved.strike ?? null,
                PE: peResolved.strike ?? null,
            },
            strikeResolution: {
                CE: { ok: ceResolved.ok, reason: ceResolved.reason },
                PE: { ok: peResolved.ok, reason: peResolved.reason },
            },
            candleCounts,
            todayStats: todayStatsRow
                ? {
                      tradesCount: todayStatsRow.trades_count,
                      dailyPl: Number(todayStatsRow.daily_pl_after_charges ?? todayStatsRow.daily_pl ?? 0),
                      isHalted: Boolean(todayStatsRow.is_trading_halted),
                  }
                : null,
            issues,
        };
    };
