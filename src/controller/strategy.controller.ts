import { db } from '../model';
import { ERRORTYPES, INDEXES_NAMES, MODEL, STRATEGY } from '../constant';
import { AppError } from '../utils';
import {
    findHedgingOptions,
    find_CE,
    find_CE_SELL,
    find_PE,
    find_PE_SELL,
    get_current_day_name,
    get_upcoming_expiry_date,
} from '../helpers';
import { logger } from '../logger/logger';
import { Op } from 'sequelize';
import moment from 'moment';

class StrategyController {
    async percentage_strategy() {
        try {
            console.log('Percentage strategy calling');
            const find_strategy = await db[MODEL.POSITION].findOne({
                where: {
                    strategy_name: STRATEGY.PERCENTAGE,
                    is_active: true,
                },
            });
            if (find_strategy) {
                const find_trade = await db[MODEL.TRADE].findAll({
                    where: {
                        strategy_name: STRATEGY.PERCENTAGE,
                        is_active: true,
                    },
                });
            } else {
                const currnet_day = get_current_day_name();
                const expirey = await get_upcoming_expiry_date(
                    INDEXES_NAMES.MIDCAP,
                );
                const exclude_days = ['SUNDAY', 'SATURDAY'];
                const strike = await db[MODEL.STRIKE_MODEL].findAll({});
                const totalStrikePrice = strike.reduce(
                    (sum, strike) => sum + strike.ltp,
                    0,
                );
                console.log('primuem_price  ' + totalStrikePrice);
                if (!exclude_days.includes('TUESDAY')) {
                    const hedging_conditions = await db[
                        MODEL.HEDGING_TIME
                    ].findOne({
                        where: {
                            index_name: INDEXES_NAMES.MIDCAP,
                            day: 'TUESDAY',
                        },
                    });
                    if (totalStrikePrice > hedging_conditions?.market_premium) {
                        const { CE_SELL, PE_SELL, PE, CE } =
                            await findHedgingOptions({
                                hedging_conditions,
                                expirey,
                            });

                        if (CE_SELL && PE_SELL && CE && PE) {
                            const istOffset = 5.5 * 60 * 60 * 1000;
                            const currentUTCDate = moment.utc();
                            const currentISTDate = currentUTCDate
                                .add(5, 'hours')
                                .add(30, 'minutes');
                            const formattedDate =
                                currentISTDate.format('YYYY-MM-DD');
                            const create_postions = await db[
                                MODEL.POSITION
                            ].create({
                                strategy_id:
                                    '701c47fd-ec15-4cbb-bd7d-85db6790f401',
                                strategy_name: STRATEGY.PERCENTAGE,
                                is_active: true,
                                qty: 2,
                                trade_id: Math.floor(
                                    100000 + Math.random() * 900000,
                                ),
                                date: formattedDate,
                                start_time: currentISTDate,
                            });
                            const ce_sell = await db[MODEL.TRADE].create({
                                position_id: create_postions.id,
                                options_chain_id: CE_SELL.options_chain_id,
                                trade_id: create_postions.trade_id,
                                strategy_name: STRATEGY.PERCENTAGE,
                                trading_symbol: CE_SELL.trading_symbol,
                                instrument_key: CE_SELL.instrument_key,
                                instrument_type: CE_SELL.instrument_type,
                                trade_type: 'SELL',
                                buy_price: CE_SELL.ltp,
                                stop_loss: CE_SELL.ltp * 2,
                                is_active: true,
                                ltp: CE_SELL.ltp,
                                qty: 2,
                                lot_size: CE_SELL.lot_size,
                            });
                            const pe_sell = await db[MODEL.TRADE].create({
                                position_id: create_postions.id,
                                options_chain_id: PE_SELL.options_chain_id,
                                trade_id: create_postions.trade_id,
                                strategy_name: STRATEGY.PERCENTAGE,
                                trading_symbol: PE_SELL.trading_symbol,
                                instrument_key: PE_SELL.instrument_key,
                                instrument_type: PE_SELL.instrument_type,
                                trade_type: 'SELL',
                                buy_price: PE_SELL.ltp,
                                stop_loss: PE_SELL.ltp * 2,
                                is_active: true,
                                ltp: PE_SELL.ltp,
                                qty: 2,
                                lot_size: PE_SELL.lot_size,
                            });
                            const ce = await db[MODEL.TRADE].create({
                                position_id: create_postions.id,
                                options_chain_id: CE.options_chain_id,
                                trade_id: create_postions.trade_id,
                                strategy_name: STRATEGY.PERCENTAGE,
                                trading_symbol: CE.trading_symbol,
                                instrument_key: CE.instrument_key,
                                instrument_type: CE.instrument_type,
                                trade_type: 'BUY',
                                buy_price: CE.ltp,
                                stop_loss: 0,
                                is_active: true,
                                ltp: CE.ltp,
                                qty: 2,
                                lot_size: CE.lot_size,
                            });
                            const pe = await db[MODEL.TRADE].create({
                                position_id: create_postions.id,
                                options_chain_id: PE.options_chain_id,
                                trade_id: create_postions.trade_id,
                                strategy_name: STRATEGY.PERCENTAGE,
                                trading_symbol: PE.trading_symbol,
                                instrument_key: PE.instrument_key,
                                instrument_type: PE.instrument_type,
                                trade_type: 'BUY',
                                buy_price: PE.ltp,
                                stop_loss: 0,
                                is_active: true,
                                ltp: PE.ltp,
                                qty: 2,
                                lot_size: PE.lot_size,
                            });

                            if (ce_sell && pe_sell && ce && pe) {
                                logger.info('Trade Placed successfully');
                            } else {
                                await db[MODEL.TRADE].update(
                                    { is_active: false },
                                    { where: { id: ce?.id } },
                                );
                                await db[MODEL.TRADE].update(
                                    { is_active: false },
                                    { where: { id: pe?.id } },
                                );
                                await db[MODEL.TRADE].update(
                                    { is_active: false },
                                    { where: { id: ce_sell?.id } },
                                );
                                await db[MODEL.TRADE].update(
                                    { is_active: false },
                                    { where: { id: pe_sell?.id } },
                                );
                                await db[MODEL.POSITION].update(
                                    { is_active: false },
                                    { where: { id: create_postions?.id } },
                                );
                                logger.error('Trade Placement failed');
                            }
                        } else {
                            logger.info(
                                'ce pe ce_sell pe_sell not fount=d anyone',
                            );
                        }
                    } else {
                        logger.info('priminum price is not matching');
                    }
                } else {
                    logger.error('Today is holiday');
                }
            }
        } catch (error) {
            throw new AppError(error.message, ERRORTYPES.UNKNOWN_ERROR);
        }
    }
}

export const strategyController = new StrategyController();
