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
            const istOffset = 5.5 * 60 * 60 * 1000;
            const currentUTCDate = moment.utc();
            const currentISTDate = currentUTCDate
                .add(5, 'hours')
                .add(30, 'minutes');
            const formattedDate = currentISTDate.format('YYYY-MM-DD');
            const currentTime = currentISTDate.format('HH:mm');
            const startTime = moment('09:15', 'HH:mm');
            const endTime = moment('15:25', 'HH:mm');
            // if (currentISTDate.isBetween(startTime, endTime)) {
            const find_strategy = await db[MODEL.POSITION].findOne({
                where: {
                    strategy_name: STRATEGY.PERCENTAGE,
                    is_active: true,
                },
            });
            if (find_strategy) {
                console.time('postion check');

                const find_trade = await db[MODEL.TRADE].findAll({
                    where: {
                        strategy_name: STRATEGY.PERCENTAGE,
                        is_active: true,
                    },
                });

                let CE_SELL_PL = 0;
                let PE_SELL_PL = 0;
                let CE_PL = 0;
                let PE_PL = 0;
                let MARGIN = 0;
                await Promise.all(
                    find_trade.map(async (trade) => {
                        if (trade.trade_type === 'SELL') {
                            if (trade.instrument_type === 'CE') {
                                const diff = trade.buy_price - trade.ltp;
                                const lot = trade.lot_size * trade.qty;
                                CE_SELL_PL = diff * lot;
                                await db[MODEL.TRADE].update(
                                    { pl: CE_SELL_PL },
                                    { where: { id: trade.id } },
                                );
                            } else {
                                const diff = trade.buy_price - trade.ltp;
                                const lot = trade.lot_size * trade.qty;
                                PE_SELL_PL = diff * lot;
                                await db[MODEL.TRADE].update(
                                    { pl: PE_SELL_PL },
                                    { where: { id: trade.id } },
                                );
                            }
                        } else {
                            if (trade.instrument_type === 'CE') {
                                const diff = trade.ltp - trade.buy_price;
                                const lot = trade.lot_size * trade.qty;
                                CE_PL = diff * lot;
                                await db[MODEL.TRADE].update(
                                    { pl: CE_PL },
                                    { where: { id: trade.id } },
                                );
                            } else {
                                const diff = trade.ltp - trade.buy_price;
                                const lot = trade.lot_size * trade.qty;
                                PE_PL = diff * lot;
                                await db[MODEL.TRADE].update(
                                    { pl: PE_PL },
                                    { where: { id: trade.id } },
                                );
                            }
                        }
                    }),
                );
                const tradesToClose = find_trade.filter(
                    (trade) =>
                        trade.trade_type === 'SELL' &&
                        trade.ltp >= trade.stop_loss,
                );
                if (tradesToClose.lenght > 0) {
                    console.log('Close trades triggered.');
                    find_trade.map(async (trade) => {
                        await db[MODEL.TRADE].update(
                            {
                                is_active: false,
                                sell_price: trade.ltp,
                            },
                            {
                                where: { id: trade.id },
                            },
                        );
                    });

                    await db[MODEL.POSITION].update(
                        { is_active: false },
                        { where: { id: find_strategy.id } },
                    );
                }
                const PL = CE_SELL_PL + PE_SELL_PL + CE_PL + PE_PL;
                const target = (find_strategy.required_margin * 1) / 100;
                if (PL > target) {
                    console.log(
                        'Congratulations! target has been successfully achieved. A profit of 1% has been booked on this trade.',
                    );
                    find_trade.map(async (trade) => {
                        await db[MODEL.TRADE].update(
                            {
                                is_active: false,
                                sell_price: trade.ltp,
                            },
                            {
                                where: { id: trade.id },
                            },
                        );
                    });
                    await db[MODEL.POSITION].update(
                        { is_active: false },
                        { where: { id: find_strategy.id } },
                    );
                }
                await db[MODEL.POSITION].update(
                    { pl: PL },
                    { where: { id: find_strategy.id } },
                );
                console.timeEnd('postion check');
            } else {
                console.time('trade_create');
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
                if (!exclude_days.includes(currnet_day)) {
                    const hedging_conditions = await db[
                        MODEL.HEDGING_TIME
                    ].findOne({
                        where: {
                            index_name: INDEXES_NAMES.MIDCAP,
                            day: currnet_day,
                        },
                    });
                    if (totalStrikePrice > hedging_conditions?.market_premium) {
                        const { CE_SELL, PE_SELL, PE, CE } =
                            await findHedgingOptions({
                                hedging_conditions,
                                expirey,
                            });

                        if (CE_SELL && PE_SELL && CE && PE) {
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
                                required_margin:
                                    hedging_conditions?.required_margin * 2,
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
                            console.timeEnd('trade_create');
                        } else {
                            logger.info(
                                'ce pe ce_sell pe_sell not found anyone',
                            );
                        }
                    } else {
                        logger.info('priminum price is not matching');
                    }
                } else {
                    logger.info('Today is holiday');
                }
            }
            // } else {
            //     logger.error('Market Time is closed');
            // }
        } catch (error) {
            throw new AppError(error.message, ERRORTYPES.UNKNOWN_ERROR);
        }
    }
}

export const strategyController = new StrategyController();
