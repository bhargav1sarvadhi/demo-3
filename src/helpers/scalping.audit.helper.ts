import { Op } from 'sequelize';
import { MODEL } from '../constant';
import { db } from '../model';
import { ScalpingConfig } from './scalping.risk.helper';

export type AuditAction = 'SKIP' | 'ENTER' | 'EXIT' | 'HOLD' | 'PARTIAL' | 'RECONCILE';
export type AuditSignal = 'CE_BUY' | 'PE_BUY' | 'NONE' | null;

export interface AuditLogInput {
    strategyName: string;
    action: AuditAction;
    reason?: string | null;
    signal?: AuditSignal;
    instrumentKey?: string | null;
    tradeId?: string | null;
    engineState?: string | null;
    mode?: string | null;
    backtestRunId?: string | null;
    config?: ScalpingConfig | null;
    indicators?: {
        ema9?: number;
        ema21?: number;
        rsi?: number;
        atr?: number;
        volume?: number;
        avgVolume?: number;
        [key: string]: number | undefined;
    };
    metadata?: Record<string, unknown>;
    timestamp?: Date;
    skipThrottle?: boolean;
}

const lastNoCrossLog = new Map<string, number>();
const NO_CROSS_THROTTLE_MS = 60_000;

const shouldSkipLog = (input: AuditLogInput): boolean => {
    if (input.skipThrottle) return false;
    if (input.action !== 'SKIP') return false;
    if (
        input.reason !== 'NO_CE_EMA_CROSS' &&
        input.reason !== 'NO_PE_EMA_CROSS'
    ) {
        return false;
    }
    const key = `${input.signal ?? 'NONE'}:${input.instrumentKey ?? ''}`;
    const now = Date.now();
    const last = lastNoCrossLog.get(key) ?? 0;
    if (now - last < NO_CROSS_THROTTLE_MS) return true;
    lastNoCrossLog.set(key, now);
    return false;
};

const pickConfigSnapshot = (config?: ScalpingConfig | null) => {
    if (!config) return null;
    return {
        mode: config.mode,
        ema_fast: config.ema_fast,
        ema_slow: config.ema_slow,
        rsi_ce_max: config.rsi_ce_max,
        rsi_pe_min: config.rsi_pe_min,
        min_rr_ratio: config.min_rr_ratio,
        max_trades_per_day: config.max_trades_per_day,
        entry_cutoff_time: config.entry_cutoff_time,
    };
};

export const logScalpingDecision = async (
    input: AuditLogInput,
): Promise<void> => {
    if (shouldSkipLog(input)) return;

    try {
        await db[MODEL.DECISION_AUDIT].create({
            strategy_name: input.strategyName,
            timestamp: input.timestamp ?? new Date(),
            instrument_key: input.instrumentKey ?? null,
            ema9: input.indicators?.ema9 ?? null,
            ema21: input.indicators?.ema21 ?? null,
            rsi: input.indicators?.rsi ?? null,
            atr: input.indicators?.atr ?? null,
            volume: input.indicators?.volume ?? null,
            avg_volume: input.indicators?.avgVolume ?? null,
            signal: input.signal ?? null,
            action: input.action,
            reason: input.reason ?? null,
            engine_state: input.engineState ?? null,
            mode: input.mode ?? configMode(input.config),
            backtest_run_id: input.backtestRunId ?? null,
            trade_id: input.tradeId ?? null,
            config_snapshot: pickConfigSnapshot(input.config),
            metadata: input.metadata ?? null,
        });
    } catch {
        // Audit must not break trading loop
    }
};

const configMode = (config?: ScalpingConfig | null) => config?.mode ?? null;

export const getAuditSkipBreakdown = async (
    strategyName: string,
    days = 7,
) => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await db[MODEL.DECISION_AUDIT].findAll({
        where: {
            strategy_name: strategyName,
            action: 'SKIP',
            timestamp: { [Op.gte]: since },
        },
        attributes: [
            'reason',
            [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
        ],
        group: ['reason'],
        raw: true,
    });

    return rows;
};
