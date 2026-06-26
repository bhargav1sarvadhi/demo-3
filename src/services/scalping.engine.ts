import { MODEL, STRATEGY, USER_DETAILS } from '../constant';
import { db } from '../model';
import { logger } from '../logger/logger';
import {
    buildMarketTime,
    canOpenNewTrade,
    getStrategyConfig,
    resolveAccountBalance,
    ScalpingConfig,
} from '../helpers/scalping.risk.helper';
import { monitorScalpingPosition } from '../helpers/scalping.exit.helper';
import { trySignalEntry } from '../helpers/scalping.entry.filters';
import { getCurrentISTDate, get_current_day_name } from '../helpers/stock.helper';
import { logScalpingDecision } from '../helpers/scalping.audit.helper';
import { syncActiveScalpingStrikes } from '../helpers/scalping.market.quality.helper';

const STRIKE_SYNC_MS = 5 * 60 * 1000;
let lastStrikeSyncAt = 0;

export type ScalpingEngineState =
    | 'MARKET_CLOSED'
    | 'WAITING_EXECUTION'
    | 'IN_TRADE'
    | 'SCANNING';

export class ScalpingEngine {
    async run(): Promise<ScalpingEngineState> {
        const config = await getStrategyConfig(STRATEGY.SCALLPING);

        if (!config.is_active) {
            return 'MARKET_CLOSED';
        }

        if (config.mode === 'backtest') {
            return 'MARKET_CLOSED';
        }

        const currentISTDate = getCurrentISTDate();
        const formattedDate = currentISTDate.toISOString().slice(0, 10);
        const startTime = buildMarketTime(
            formattedDate,
            config.market_start_time,
        );
        const tradeStartTime = buildMarketTime(
            formattedDate,
            config.entry_start_time,
        );
        const endTime = buildMarketTime(
            formattedDate,
            config.market_end_time,
        );
        const tradeEndTime = buildMarketTime(
            formattedDate,
            config.force_exit_time,
        );

        if (currentISTDate < startTime || currentISTDate > endTime) {
            logger.error('Market Time is closed');
            return 'MARKET_CLOSED';
        }

        const position = await this.getActivePosition();

        if (position && !position.is_exectued) {
            await this.confirmExecution(position, config, currentISTDate);
            return 'WAITING_EXECUTION';
        }

        if (position && position.is_exectued) {
            const trade = await db[MODEL.TRADE].findOne({
                where: {
                    strategy_name: STRATEGY.SCALLPING,
                    is_active: true,
                    position_id: position.id,
                },
            });
            if (!trade) return 'IN_TRADE';

            await monitorScalpingPosition({
                position,
                trade,
                config,
                currentISTDate,
                tradeEndTime,
            });
            return 'IN_TRADE';
        }

        await this.scanForEntry(
            config,
            currentISTDate,
            formattedDate,
            tradeStartTime,
            tradeEndTime,
        );
        return 'SCANNING';
    }

    private async getActivePosition() {
        return db[MODEL.POSITION].findOne({
            where: {
                strategy_name: STRATEGY.SCALLPING,
                is_active: true,
            },
        });
    }

    private async confirmExecution(
        position: any,
        config: ScalpingConfig,
        currentISTDate: Date,
    ) {
        const trade = await db[MODEL.TRADE].findOne({
            where: {
                strategy_name: STRATEGY.SCALLPING,
                is_active: true,
                position_id: position.id,
            },
        });

        if (!trade) return;

        if (trade.ltp >= trade.buy_price) {
            await db[MODEL.POSITION].update(
                { is_exectued: true },
                { where: { id: position.id } },
            );
            await logScalpingDecision({
                strategyName: STRATEGY.SCALLPING,
                action: 'ENTER',
                reason: 'EXECUTION_CONFIRMED',
                signal:
                    trade.instrument_type === 'CE' ? 'CE_BUY' : 'PE_BUY',
                instrumentKey: trade.instrument_key,
                tradeId: trade.id,
                engineState: 'WAITING_EXECUTION',
                config,
                timestamp: currentISTDate,
                metadata: {
                    buy_price: trade.buy_price,
                    ltp: trade.ltp,
                },
            });
            logger.info('Position execution confirmed');
        }
    }

    private async scanForEntry(
        config: ScalpingConfig,
        currentISTDate: Date,
        formattedDate: string,
        tradeStartTime: Date,
        tradeEndTime: Date,
    ) {
        const currentDay = get_current_day_name();
        const excludeDays = ['SUNDAY', 'SATURDAY'];

        if (excludeDays.includes(currentDay)) {
            await logScalpingDecision({
                strategyName: STRATEGY.SCALLPING,
                action: 'SKIP',
                reason: 'WEEKEND',
                engineState: 'SCANNING',
                config,
                timestamp: currentISTDate,
            });
            logger.info('Today is holiday');
            return;
        }

        if (
            currentISTDate < tradeStartTime ||
            currentISTDate > tradeEndTime
        ) {
            return;
        }

        if (
            config.enable_dynamic_atm !== false &&
            Date.now() - lastStrikeSyncAt >= STRIKE_SYNC_MS
        ) {
            await syncActiveScalpingStrikes(config);
            lastStrikeSyncAt = Date.now();
        }

        const tradeCheck = await canOpenNewTrade(
            STRATEGY.SCALLPING,
            config,
            currentISTDate,
        );
        if (!tradeCheck.ok) {
            await logScalpingDecision({
                strategyName: STRATEGY.SCALLPING,
                action: 'SKIP',
                reason: tradeCheck.reason ?? 'RISK_BLOCKED',
                engineState: 'SCANNING',
                config,
                timestamp: currentISTDate,
            });
            logger.info(`Entry skipped: ${tradeCheck.reason}`);
            return;
        }

        const entryUser = await db[MODEL.USER].findOne({
            where: { email: USER_DETAILS.EMAIL },
        });
        const accountBalance = resolveAccountBalance(entryUser, config);

        const ceEntered = await trySignalEntry({
            signalType: 'CE',
            instrumentType: 'CE',
            config,
            accountBalance,
            entryUser,
            formattedDate,
            currentISTDate,
            engineState: 'SCANNING',
        });

        if (!ceEntered) {
            await trySignalEntry({
                signalType: 'PE',
                instrumentType: 'PE',
                config,
                accountBalance,
                entryUser,
                formattedDate,
                currentISTDate,
                engineState: 'SCANNING',
            });
        }
    }
}

export const scalpingEngine = new ScalpingEngine();
