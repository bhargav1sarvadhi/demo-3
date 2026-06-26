import moment from 'moment';
import { Op } from 'sequelize';
import { MODEL, STRATEGY } from '../constant';
import { db } from '../model';
import { getAuditSkipBreakdown } from './scalping.audit.helper';
import {
    computePerformanceMetrics,
    PerformanceMetrics,
} from './scalping.metrics.helper';

export interface ScalpingPerformanceReport extends PerformanceMetrics {
    periodDays: number;
    strategyName: string;
    startDate: string;
    endDate: string;
    skipReasonBreakdown: Array<{ reason: string; count: number }>;
    dailyStats: Array<{
        tradeDate: string;
        tradesCount: number;
        winsCount: number;
        lossesCount: number;
        dailyPl: number;
        dailyPlAfterCharges: number;
    }>;
}

export const getScalpingPerformance = async ({
    strategyName = STRATEGY.SCALLPING,
    days = 30,
}: {
    strategyName?: string;
    days?: number;
}): Promise<ScalpingPerformanceReport> => {
    const since = moment().subtract(days, 'days').startOf('day').toDate();
    const startDate = moment(since).format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');

    const trades = await db[MODEL.TRADE].findAll({
        where: {
            strategy_name: strategyName,
            is_active: false,
            updatedAt: { [Op.gte]: since },
        },
        order: [['updatedAt', 'ASC']],
    });

    const tradeRows = trades.map((t) => ({
        netPl: Number(t.net_pl ?? t.pl ?? 0),
        grossPl: Number(t.pl ?? 0),
        exitReason: t.exit_reason,
        closedAt: t.updatedAt,
    }));

    const dailyStatsRows = await db[MODEL.STRATEGY_DAILY_STATS].findAll({
        where: {
            strategy_name: strategyName,
            trade_date: { [Op.gte]: startDate },
        },
        order: [['trade_date', 'ASC']],
    });

    const dailyPl = dailyStatsRows.map((s) => ({
        date: s.trade_date,
        pl: Number(s.daily_pl_after_charges ?? s.daily_pl ?? 0),
    }));

    const metrics = computePerformanceMetrics(tradeRows, dailyPl);
    const skipBreakdown = await getAuditSkipBreakdown(strategyName, days);

    const skipReasonBreakdown = skipBreakdown.map((row: any) => ({
        reason: row.reason ?? 'UNKNOWN',
        count: Number(row.count ?? 0),
    }));

    return {
        ...metrics,
        periodDays: days,
        strategyName,
        startDate,
        endDate,
        skipReasonBreakdown,
        dailyStats: dailyStatsRows.map((s) => ({
            tradeDate: s.trade_date,
            tradesCount: s.trades_count,
            winsCount: s.wins_count,
            lossesCount: s.losses_count,
            dailyPl: Number(s.daily_pl ?? 0),
            dailyPlAfterCharges: Number(s.daily_pl_after_charges ?? 0),
        })),
    };
};
