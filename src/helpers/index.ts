// import {
//     deleteImageAWS,
//     updateImageToS3,
//     uploadFileToS3,
//     uploadImage,
//     uploadVideo,
// } from './aws.fileupload';
import {
    current_strike_price,
    findHedgingOptions,
    find_CE,
    find_CE_SELL,
    find_PE,
    find_PE_SELL,
    find_sbin_stocks,
    generate_premium_range,
    getCurrentISTDate,
    getISTTime,
    get_current_day_name,
    get_next_day_name,
    get_upcoming_expiry_date,
    strike_around_ce_pe,
    strike_around_start_end,
} from './stock.helper';
import { place_order_on_upstocks } from './upstocks.apis';
import {
    STRATEGY_THROTTLE_MS,
    MAX_LOSS_PER_TRADE,
    calculateTradePl,
    closeScalpingTrade,
    isLiveTradingEnabled,
    placeEntryOrderIfLive,
    processMarketFeed,
} from './scalping.trade.helper';
import {
    monitorScalpingPosition,
    getExitDecision,
    ExitReason,
} from './scalping.exit.helper';
import {
    buildMarketTime,
    calculatePositionSize,
    canOpenNewTrade,
    getStrategyConfig,
    resolveAccountBalance,
    updateTrailingStop,
    calculateTradeCharges,
    calculateNetPl,
} from './scalping.risk.helper';
import {
    trySignalEntry,
    validateEntrySignal,
} from './scalping.entry.filters';
import { validateReq } from './validation.helper';
import { getAuditSkipBreakdown, logScalpingDecision } from './scalping.audit.helper';
import { runScalpingBacktest } from './scalping.backtest.helper';
import { getScalpingPerformance } from './scalping.performance.helper';
import { runScalpingOptimization } from './scalping.optimize.helper';
import { computePerformanceMetrics } from './scalping.metrics.helper';
import { getUpstoxPositions } from './scalping.reconciliation.helper';
import {
    resolveScalpingStrike,
    validateMarketQuality,
    syncActiveScalpingStrikes,
    roundToStrikeStep,
} from './scalping.market.quality.helper';

export {
    // uploadImage,
    // uploadFileToS3,
    // deleteImageAWS,
    // updateImageToS3,
    validateReq,
    // uploadVideo,
    get_upcoming_expiry_date,
    get_current_day_name,
    current_strike_price,
    strike_around_ce_pe,
    generate_premium_range,
    find_CE_SELL,
    find_PE_SELL,
    find_CE,
    find_PE,
    findHedgingOptions,
    get_next_day_name,
    strike_around_start_end,
    getISTTime,
    getCurrentISTDate,
    find_sbin_stocks,
    place_order_on_upstocks,
    processMarketFeed,
    closeScalpingTrade,
    placeEntryOrderIfLive,
    isLiveTradingEnabled,
    calculateTradePl,
    STRATEGY_THROTTLE_MS,
    MAX_LOSS_PER_TRADE,
    monitorScalpingPosition,
    getExitDecision,
    buildMarketTime,
    getStrategyConfig,
    canOpenNewTrade,
    calculatePositionSize,
    resolveAccountBalance,
    updateTrailingStop,
    calculateTradeCharges,
    calculateNetPl,
    trySignalEntry,
    validateEntrySignal,
    logScalpingDecision,
    getAuditSkipBreakdown,
    runScalpingBacktest,
    getScalpingPerformance,
    runScalpingOptimization,
    computePerformanceMetrics,
    getUpstoxPositions,
    resolveScalpingStrike,
    validateMarketQuality,
    syncActiveScalpingStrikes,
    roundToStrikeStep,
};
