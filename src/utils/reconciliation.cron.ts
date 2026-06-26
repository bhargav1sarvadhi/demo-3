import cron from 'node-cron';
import { MODEL, STRATEGY, USER_DETAILS } from '../constant';
import { db } from '../model';
import { logger } from '../logger/logger';
import {
    buildMarketTime,
    getStrategyConfig,
} from '../helpers/scalping.risk.helper';
import { getCurrentISTDate } from '../helpers/stock.helper';
import { getUpstoxPositions } from '../helpers/scalping.reconciliation.helper';
import { logScalpingDecision } from '../helpers/scalping.audit.helper';
import {
    closeScalpingTrade,
    calculateTradePl,
} from '../helpers/scalping.trade.helper';

export const reconcileScalpingOrders = async (): Promise<void> => {
    const config = await getStrategyConfig(STRATEGY.SCALLPING);
    if (config.mode !== 'live') return;

    const user = await db[MODEL.USER].findOne({
        where: { email: USER_DETAILS.EMAIL },
    });
    if (!user?.token || !user?.is_live) return;

    const currentISTDate = getCurrentISTDate();
    const formattedDate = currentISTDate.toISOString().slice(0, 10);
    const startTime = buildMarketTime(
        formattedDate,
        config.market_start_time,
    );
    const endTime = buildMarketTime(formattedDate, config.market_end_time);
    if (currentISTDate < startTime || currentISTDate > endTime) return;

    const brokerPositions = await getUpstoxPositions(user.token);
    const brokerByKey = new Map(
        brokerPositions
            .filter((p) => p.quantity !== 0)
            .map((p) => [p.instrument_key, p.quantity]),
    );

    const activeTrades = await db[MODEL.TRADE].findAll({
        where: {
            strategy_name: STRATEGY.SCALLPING,
            is_active: true,
        },
    });

    for (const trade of activeTrades) {
        const brokerQty = brokerByKey.get(trade.instrument_key) ?? 0;
        const expectedQty = Number(trade.lot_size) * Number(trade.qty);

        if (brokerQty === 0 && expectedQty > 0) {
            logger.warn(
                `Reconciliation: DB open but broker flat for ${trade.trading_symbol}`,
            );
            const position = await db[MODEL.POSITION].findOne({
                where: { id: trade.position_id },
            });
            if (position) {
                const tradePl = calculateTradePl(trade);
                await closeScalpingTrade({
                    trade,
                    position,
                    tradePl,
                    exitReason: 'RECONCILE_BROKER_FLAT',
                    config,
                    skipBrokerOrder: true,
                });
            }
            await logScalpingDecision({
                strategyName: STRATEGY.SCALLPING,
                action: 'RECONCILE',
                reason: 'BROKER_FLAT_DB_OPEN',
                instrumentKey: trade.instrument_key,
                tradeId: trade.id,
                config,
                metadata: { expectedQty, brokerQty },
            });
        }
    }

    for (const [instrumentKey, qty] of brokerByKey.entries()) {
        const dbTrade = activeTrades.find(
            (t) => t.instrument_key === instrumentKey,
        );
        if (!dbTrade) {
            logger.error(
                `Reconciliation CRITICAL: broker open ${instrumentKey} qty=${qty} but no DB trade`,
            );
            await logScalpingDecision({
                strategyName: STRATEGY.SCALLPING,
                action: 'RECONCILE',
                reason: 'BROKER_OPEN_DB_CLOSED',
                instrumentKey,
                config,
                metadata: { brokerQty: qty },
            });
        }
    }
};

cron.schedule(
    '*/5 9-15 * * 1-5',
    async () => {
        try {
            await reconcileScalpingOrders();
        } catch (error: any) {
            logger.error('Reconciliation cron error', error?.message);
        }
    },
    { timezone: 'Asia/Kolkata' },
);

logger.info(
    'Scalping reconciliation cron scheduled (every 5 min, market hours).',
);
