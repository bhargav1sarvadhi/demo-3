import moment from 'moment';
import { MODEL, STRATEGY, USER_DETAILS } from '../constant';
import { db } from '../model';
import { logger } from '../logger/logger';
import {
    ScalpingConfig,
    updateTrailingStop,
} from './scalping.risk.helper';
import {
    calculateTradePl,
    closeScalpingTrade,
    isLiveTradingEnabled,
} from './scalping.trade.helper';
import { place_order_on_upstocks } from './upstocks.apis';
import {
    calculateEmaCrossover,
    normalizeCandles,
} from './scalping.indicators';
import { logScalpingDecision } from './scalping.audit.helper';

export type ExitReason =
    | 'EOD'
    | 'TARGET_FULL'
    | 'TARGET_PARTIAL'
    | 'STOP_LOSS'
    | 'MAX_LOSS'
    | 'EMA_REVERSAL'
    | 'TIME_EXIT'
    | 'RECONCILE_BROKER_FLAT'
    | null;

export type ExitAction = 'NONE' | 'PARTIAL_CLOSE' | 'FULL_CLOSE';

export interface ExitDecision {
    action: ExitAction;
    reason: ExitReason;
}

const getTradeAgeMinutes = (trade: any, currentISTDate: Date): number => {
    const openedAt = trade.createdAt ? new Date(trade.createdAt) : currentISTDate;
    return moment(currentISTDate).diff(moment(openedAt), 'minutes');
};

const getPartialTargetPrice = (trade: any, config: ScalpingConfig): number => {
    const buy = Number(trade.buy_price);
    const target = Number(trade.target_price);
    const pct = config.partial_target_pct ?? 0.5;
    return buy + (target - buy) * pct;
};

export const checkEmaReversal = async (
    trade: any,
    config: ScalpingConfig,
): Promise<boolean> => {
    if (!config.enable_ema_reversal_exit) return false;

    const candles = await db[MODEL.CANDELS].findAll({
        where: { instrument_key: trade.instrument_key },
        order: [['ts', 'DESC']],
        limit: Math.max(50, (config.min_candles_1m ?? 22) + 5),
    });

    if (candles.length < config.min_candles_1m) return false;

    const normalized = normalizeCandles(candles);
    const closes = normalized.map((c) => c.close);
    const { bullishCross, bearishCross } = calculateEmaCrossover(
        closes,
        config.ema_fast,
        config.ema_slow,
    );

    if (trade.instrument_type === 'CE' && bearishCross) return true;
    if (trade.instrument_type === 'PE' && bullishCross) return true;
    return false;
};

export const getExitDecision = async ({
    trade,
    tradePl,
    currentISTDate,
    tradeEndTime,
    config,
}: {
    trade: any;
    tradePl: number;
    currentISTDate: Date;
    tradeEndTime: Date;
    config: ScalpingConfig;
}): Promise<ExitDecision> => {
    if (!trade?.is_active) return { action: 'NONE', reason: null };

    if (tradeEndTime <= currentISTDate) {
        return { action: 'FULL_CLOSE', reason: 'EOD' };
    }

    if (trade.stop_loss >= trade.ltp) {
        return { action: 'FULL_CLOSE', reason: 'STOP_LOSS' };
    }

    const maxLoss =
        config.max_loss_per_trade > 0
            ? -config.max_loss_per_trade
            : config.max_loss_per_trade;
    if (tradePl <= maxLoss) {
        return { action: 'FULL_CLOSE', reason: 'MAX_LOSS' };
    }

    if (trade.target_price <= trade.ltp) {
        return { action: 'FULL_CLOSE', reason: 'TARGET_FULL' };
    }

    if (
        config.enable_partial_exit &&
        !trade.partial_exit_done &&
        Number(trade.qty) > 1
    ) {
        const partialPrice = getPartialTargetPrice(trade, config);
        if (trade.ltp >= partialPrice) {
            return { action: 'PARTIAL_CLOSE', reason: 'TARGET_PARTIAL' };
        }
    }

    if (config.enable_ema_reversal_exit) {
        const emaReversal = await checkEmaReversal(trade, config);
        if (emaReversal) {
            return { action: 'FULL_CLOSE', reason: 'EMA_REVERSAL' };
        }
    }

    if (config.enable_time_exit) {
        const ageMin = getTradeAgeMinutes(trade, currentISTDate);
        const minPl = config.time_exit_min_pl ?? -500;
        const maxPl = config.time_exit_max_pl ?? 500;
        const maxAge = config.time_exit_minutes ?? 30;
        if (ageMin >= maxAge && tradePl > minPl && tradePl < maxPl) {
            return { action: 'FULL_CLOSE', reason: 'TIME_EXIT' };
        }
    }

    return { action: 'NONE', reason: null };
};

const placePartialSellIfLive = async (
    trade: any,
    positionId: string,
    sellQty: number,
    config: ScalpingConfig,
) => {
    const user = await db[MODEL.USER].findOne({
        where: { email: USER_DETAILS.EMAIL },
    });
    if (!isLiveTradingEnabled(user, config) || !user?.token) return;

    const quantity = Number(trade.lot_size) * sellQty;
    const sellOrder = await place_order_on_upstocks({
        instrument_key: trade.instrument_key,
        accessToken: user.token,
        quantity,
        transaction_type: 'SELL',
    });

    if (
        sellOrder?.status === 'success' &&
        sellOrder?.data?.order_ids?.length > 0
    ) {
        await Promise.all(
            sellOrder.data.order_ids.map((order_id: string) =>
                db[MODEL.UPSTOCK_ORDERS].create({
                    upstock_order_id: order_id,
                    postion_id: positionId,
                    order_type: 'SELL_PARTIAL',
                }),
            ),
        );
        logger.info(`Partial SELL placed: ${sellQty} lot(s)`);
    }
};

export const executePartialProfitBooking = async ({
    trade,
    position,
    config,
}: {
    trade: any;
    position: any;
    config: ScalpingConfig;
}) => {
    const currentQty = Number(trade.qty);
    const sellQty = Math.floor(currentQty / 2);
    if (sellQty < 1 || sellQty >= currentQty) return false;

    const remainingQty = currentQty - sellQty;
    const buyPrice = Number(trade.buy_price);
    const extension = config.partial_target_extension ?? 1.2;
    const targetDistance = Number(trade.target_price) - buyPrice;
    const extendedTarget = buyPrice + targetDistance * extension;

    await placePartialSellIfLive(trade, position.id, sellQty, config);

    await db[MODEL.TRADE].update(
        {
            qty: remainingQty,
            partial_exit_done: true,
            stop_loss: buyPrice,
            target_price: extendedTarget,
        },
        { where: { id: trade.id } },
    );

    await db[MODEL.POSITION].update(
        { qty: remainingQty },
        { where: { id: position.id } },
    );

    logger.info(
        `Partial profit booked: sold ${sellQty} lot(s), remaining ${remainingQty}, stop at breakeven, target extended to ${extendedTarget.toFixed(2)}`,
    );

    await logScalpingDecision({
        strategyName: STRATEGY.SCALLPING,
        action: 'PARTIAL',
        reason: 'TARGET_PARTIAL',
        signal: trade.instrument_type === 'CE' ? 'CE_BUY' : 'PE_BUY',
        instrumentKey: trade.instrument_key,
        tradeId: trade.id,
        engineState: 'IN_TRADE',
        config,
        metadata: { sellQty, remainingQty },
    });

    return true;
};

export const monitorScalpingPosition = async ({
    position,
    trade,
    config,
    currentISTDate,
    tradeEndTime,
}: {
    position: any;
    trade: any;
    config: ScalpingConfig;
    currentISTDate: Date;
    tradeEndTime: Date;
}) => {
    const updatedTrade = await updateTrailingStop(trade, config);
    trade.stop_loss = updatedTrade.stop_loss;
    trade.highest_ltp = updatedTrade.highest_ltp;
    trade.ltp = updatedTrade.ltp ?? trade.ltp;

    const tradePl = calculateTradePl(trade);

    await db[MODEL.POSITION].update(
        { pl: tradePl },
        { where: { id: position.id } },
    );
    await db[MODEL.TRADE].update(
        { pl: tradePl },
        { where: { id: trade.id } },
    );

    const decision = await getExitDecision({
        trade,
        tradePl,
        currentISTDate,
        tradeEndTime,
        config,
    });

    if (decision.action === 'PARTIAL_CLOSE') {
        await executePartialProfitBooking({ trade, position, config });
        return;
    }

    if (decision.action === 'FULL_CLOSE' && decision.reason) {
        await closeScalpingTrade({
            trade,
            position,
            tradePl,
            exitReason: decision.reason,
            config,
        });
        await logScalpingDecision({
            strategyName: STRATEGY.SCALLPING,
            action: 'EXIT',
            reason: decision.reason,
            signal: trade.instrument_type === 'CE' ? 'CE_BUY' : 'PE_BUY',
            instrumentKey: trade.instrument_key,
            tradeId: trade.id,
            engineState: 'IN_TRADE',
            config,
            metadata: { tradePl, ltp: trade.ltp },
        });
    }
};
