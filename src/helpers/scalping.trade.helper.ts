import moment from 'moment';
import { MODEL, STRATEGY, USER_DETAILS, INSTRUMENT_KEYS } from '../constant';
import { db } from '../model';
import { logger } from '../logger/logger';
import { place_order_on_upstocks } from './upstocks.apis';
import {
    calculateNetPl,
    calculateTradeCharges,
    ScalpingConfig,
    updateDailyStatsOnClose,
} from './scalping.risk.helper';
import { ExitReason } from './scalping.exit.helper';

export { ExitReason };

export const STRATEGY_THROTTLE_MS = 1000;
export const MAX_LOSS_PER_TRADE = -3000;

export const isLiveTradingEnabled = (
    user: { is_live?: boolean } | null,
    config?: { mode?: string } | null,
): boolean => {
    if (config?.mode !== 'live') return false;
    return Boolean(user?.is_live);
};

export const calculateTradePl = (trade: {
    ltp: number;
    buy_price: number;
    lot_size: number;
    qty: number;
}): number => {
    const diff = Number(trade.ltp) - Number(trade.buy_price);
    const lot = Number(trade.lot_size) * Number(trade.qty);
    return diff * lot;
};

export const processMarketFeed = async (stocks_data: any) => {
    if (!stocks_data?.feeds) return;

    for (const key of Object.keys(stocks_data.feeds)) {
        const feedData = stocks_data.feeds[key]?.fullFeed?.marketFF;
        if (!feedData) continue;

        if (feedData.ltpc?.ltp) {
            const ltp = feedData.ltpc.ltp;
            const bidQuote = feedData.marketLevel?.bidAskQuote?.[0];
            const bid = bidQuote?.bidP;
            const ask = bidQuote?.askP;
            const oi = feedData.oi;
            const spreadPct =
                ltp > 0 && bid > 0 && ask > 0 ? (ask - bid) / ltp : null;

            const strikeUpdate: Record<string, number | null> = { ltp };
            if (bid > 0) strikeUpdate.bid_price = bid;
            if (ask > 0) strikeUpdate.ask_price = ask;
            if (oi > 0) strikeUpdate.open_interest = oi;
            if (spreadPct !== null) strikeUpdate.spread_pct = spreadPct;

            await db[MODEL.STRIKE_MODEL].update(strikeUpdate, {
                where: { instrument_key: key },
            });

            await db[MODEL.TRADE].update(
                { ltp },
                { where: { instrument_key: key, is_active: true } },
            );

            if (key === INSTRUMENT_KEYS.SBIN_INSTRUMENT) {
                await db[MODEL.INSTRUMENT].update(
                    { last_price: String(ltp) },
                    { where: { instrument_key: key } },
                );
            }
        }

        const i1Candle = feedData.marketOHLC?.ohlc?.find(
            (c: { interval: string }) => c.interval === 'I1',
        );

        if (!i1Candle) continue;

        const timestamp = i1Candle.ts.toNumber();
        const volume = i1Candle.vol.toNumber();

        const [candle] = await db[MODEL.CANDELS].findOrCreate({
            where: {
                ts: timestamp.toString(),
                instrument_key: key,
            },
            defaults: {
                ts: timestamp.toString(),
                open: i1Candle.open,
                high: i1Candle.high,
                low: i1Candle.low,
                close: i1Candle.close,
                volume: volume,
                instrument_key: key,
                interval: i1Candle.interval,
            },
        });

        if (candle) {
            await db[MODEL.CANDELS].update(
                {
                    open: i1Candle.open,
                    high: i1Candle.high,
                    low: i1Candle.low,
                    close: i1Candle.close,
                    volume: volume,
                },
                { where: { id: candle.id } },
            );
        }
    }
};

export const placeEntryOrderIfLive = async (
    user: { is_live?: boolean; token?: string } | null,
    instrumentKey: string,
    lotSize: number,
    qty: number,
    positionId: string,
    config?: { mode?: string } | null,
) => {
    if (!isLiveTradingEnabled(user, config) || !user?.token) return;

    const quantity = Number(lotSize) * Number(qty);
    const orderPlaced = await place_order_on_upstocks({
        instrument_key: instrumentKey,
        accessToken: user.token,
        quantity,
        transaction_type: 'BUY',
    });

    if (
        orderPlaced?.status === 'success' &&
        orderPlaced?.data?.order_ids?.length > 0
    ) {
        await Promise.all(
            orderPlaced.data.order_ids.map((order_id: string) =>
                db[MODEL.UPSTOCK_ORDERS].create({
                    upstock_order_id: order_id,
                    postion_id: positionId,
                    order_type: 'BUY',
                }),
            ),
        );
        logger.info('Upstock BUY order placed successfully');
        return;
    }

    logger.error('Upstock BUY order not placed');
};

export const closeScalpingTrade = async ({
    trade,
    position,
    tradePl,
    exitReason,
    config,
    skipBrokerOrder = false,
}: {
    trade: any;
    position: any;
    tradePl: number;
    exitReason: ExitReason;
    config?: ScalpingConfig;
    skipBrokerOrder?: boolean;
}) => {
    if (!trade?.is_active || !exitReason) return false;

    const charges = config
        ? calculateTradeCharges(trade, config)
        : 0;
    const netPl = config ? calculateNetPl(tradePl, trade, config) : tradePl;

    const user = await db[MODEL.USER].findOne({
        where: { email: USER_DETAILS.EMAIL },
    });

    if (
        !skipBrokerOrder &&
        isLiveTradingEnabled(user, config) &&
        user?.token
    ) {
        const quantity = Number(trade.lot_size) * Number(trade.qty);
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
                        postion_id: position.id,
                        order_type: 'SELL',
                    }),
                ),
            );
            logger.info(`Upstock SELL order placed: ${exitReason}`);
        } else {
            logger.error(
                `SELL order failed for trade ${trade.id}, reason: ${exitReason}`,
            );
        }
    }

    await db[MODEL.TRADE].update(
        {
            is_active: false,
            sell_price: trade.ltp,
            pl: tradePl,
            charges,
            net_pl: netPl,
            exit_reason: exitReason,
        },
        { where: { id: trade.id } },
    );

    await db[MODEL.POSITION].update(
        {
            is_active: false,
            pl: netPl,
            end_time: moment(),
        },
        { where: { id: position.id } },
    );

    const currentBal = await db[MODEL.STRATEGY].findOne({
        where: { strategy_name: STRATEGY.SCALLPING },
    });

    await db[MODEL.STRATEGY].update(
        {
            strategy_balance: (currentBal?.strategy_balance || 0) + netPl,
        },
        { where: { strategy_name: STRATEGY.SCALLPING } },
    );

    if (config) {
        await updateDailyStatsOnClose(
            STRATEGY.SCALLPING,
            netPl,
            config,
            netPl < 0,
        );
    }

    logger.info(
        `Trade closed: ${exitReason}, gross P&L: ${tradePl}, net P&L: ${netPl}, charges: ${charges}`,
    );
    return true;
};
