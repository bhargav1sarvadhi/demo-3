import cron from 'node-cron';
import * as path from 'path';
import { logger } from '../logger/logger';
import { INDEXES_NAMES, MODEL, ROLES } from '../constant';
import { db } from '../model';
import axios from 'axios';
import moment from 'moment';
import {
    current_strike_price,
    get_current_day_name,
    get_next_day_name,
    get_upcoming_expiry_date,
    Place_order_api,
    strike_around_ce_pe,
    strike_around_start_end,
} from '../helpers';
import { Op } from 'sequelize';
import { INDEXES, STRATEGY, USER_DETAILS } from '../constant/response.types';

cron.schedule(
    '05 16 * * *',
    async () => {
        try {
            const user = await db[MODEL.USER].findOne({
                where: { email: USER_DETAILS.EMAIL },
            });
            const accessToken = user.token;
            const INDEXES_NAME = [
                'FINNIFTY',
                'BANKNIFTY',
                'NIFTY',
                'MIDCPNIFTY',
            ];
            logger.info('cron started');
            const INDEXESES = [
                'NSE_INDEX|NIFTY MID SELECT',
                'NSE_INDEX|Nifty 50',
                'NSE_INDEX|Nifty Bank',
                'NSE_INDEX|Nifty Fin Service',
            ];
            await Promise.all(
                INDEXESES.map(async (indexes) => {
                    const config = {
                        method: 'get',
                        url: 'https://api.upstox.com/v2/option/contract',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: 'application/json',
                        },
                        params: {
                            instrument_key: indexes,
                        },
                        maxBodyLength: Infinity,
                    };
                    const response = await axios(config);
                    for (let data of response.data?.data) {
                        const find_options = await db[
                            MODEL.OPTIONS_CHAINS
                        ].findOne({
                            where: { instrument_key: data.instrument_key },
                        });
                        // console.log(find_options);
                        if (!find_options) {
                            await db[MODEL.OPTIONS_CHAINS].create(data);
                        }
                    }
                }),
            );
            logger.info('Optoins Chains updated successfully.');
        } catch (error) {
            logger.error('Error in cron send request', error);
        }
    },
    {
        timezone: 'Asia/Kolkata',
    },
);
cron.schedule(
    '*/30 * * * *',
    async () => {
        try {
            const current_strike = await current_strike_price(INDEXES.MIDCAP);
            const expirey_date = await get_upcoming_expiry_date(
                INDEXES_NAMES.MIDCAP,
            );
            const roundedStrike = Math.round(current_strike / 100) * 100;
            const find_options = await db[MODEL.OPTIONS_CHAINS].findAll({
                where: {
                    expiry: expirey_date,
                    name: INDEXES_NAMES.MIDCAP,
                    strike_price: roundedStrike,
                },
            });
            const find_strike_options = await db[MODEL.STRIKE_MODEL].findOne({
                where: {
                    strike_price: roundedStrike,
                },
            });
            if (find_strike_options) {
                const find_data = await db[MODEL.STRIKE_MODEL].findAll({});
                for (let data of find_data) {
                    const current_strike = await current_strike_price(
                        data.instrument_key,
                    );
                    await db[MODEL.STRIKE_MODEL].update(
                        { ltp: current_strike },
                        { where: { id: data.id } },
                    );
                }
            }
            if (!find_strike_options) {
                await db[MODEL.STRIKE_MODEL].destroy({
                    where: {},
                    force: true,
                });
                for (let data of find_options) {
                    const current_strike = await current_strike_price(
                        data.instrument_key,
                    );
                    await db[MODEL.STRIKE_MODEL].create({
                        name: data.name,
                        segment: data.segment,
                        exchange: data.exchange,
                        expiry: data.expiry,
                        weekly: data.weekly,
                        instrument_key: data.instrument_key,
                        exchange_token: data.exchange_token,
                        trading_symbol: data.trading_symbol,
                        tick_size: data.tick_size,
                        lot_size: data.lot_size,
                        instrument_type: data.instrument_type,
                        freeze_quantity: data.freeze_quantity,
                        underlying_type: data.underlying_type,
                        underlying_key: data.underlying_key,
                        underlying_symbol: data.underlying_symbol,
                        strike_price: data.strike_price,
                        ltp: current_strike,
                        minimum_lot: data.minimum_lot,
                    });
                }
            }
            logger.info('Strike Price Updated job started.');
        } catch (error) {
            logger.error('Error in cron send request', error);
        }
    },
    {
        timezone: 'Asia/Kolkata',
    },
);
cron.schedule(
    '55 15 * * *',
    async () => {
        try {
            const INDEXES_NAME = [
                'FINNIFTY',
                'BANKNIFTY',
                'NIFTY',
                'MIDCPNIFTY',
            ];
            await Promise.all(
                INDEXES_NAME.map(async (indexes) => {
                    const expirey_date = await get_upcoming_expiry_date(
                        indexes,
                    );
                    const options_datas = await db[
                        MODEL.OPTIONS_CHAINS
                    ].findAll({
                        where: {
                            expiry: expirey_date,
                            name: indexes,
                        },
                        order: [['strike_price', 'ASC']],
                    });
                    console.log(options_datas.length, indexes);
                    if (options_datas.length > 0) {
                        await Promise.all(
                            options_datas.map(async (data) => {
                                const [finded, created] = await db[
                                    MODEL.HEDGING_OPTIONS
                                ].findOrCreate({
                                    where: { options_chain_id: data.id },
                                    defaults: {
                                        options_chain_id: data['id'],
                                        name: data['name'],
                                        segment: data['segment'],
                                        exchange: data['exchange'],
                                        expiry: data['expiry'],
                                        weekly: data['weekly'],
                                        instrument_key: data['instrument_key'],
                                        exchange_token: data['exchange_token'],
                                        trading_symbol: data['trading_symbol'],
                                        tick_size: data['tick_size'],
                                        lot_size: data['lot_size'],
                                        instrument_type:
                                            data['instrument_type'],
                                        freeze_quantity:
                                            data['freeze_quantity'],
                                        underlying_type:
                                            data['underlying_type'],
                                        underlying_key: data['underlying_key'],
                                        underlying_symbol:
                                            data['underlying_symbol'],
                                        strike_price: data['strike_price'],
                                        ltp: data['ltp'],
                                        minimum_lot: data['minimum_lot'],
                                    },
                                });
                                // console.log(finded?.id, 'finded');
                                // console.log(created?.id, 'created');
                            }),
                        );
                        const delete_hedgs = await db[
                            MODEL.HEDGING_OPTIONS
                        ].destroy({
                            where: {
                                name: indexes,
                                expiry: {
                                    [Op.notIn]: [expirey_date],
                                },
                            },
                            force: true,
                        });
                        // console.log('deleted hedgs', delete_hedgs);
                    }
                }),
            );
            logger.info(
                'All hedging options added and old deleted successfully.',
            );
        } catch (error) {
            logger.error('Error in cron send request', error);
        }
    },
    {
        timezone: 'Asia/Kolkata',
    },
);
cron.schedule(
    '20 15 * * *',
    async () => {
        try {
            const currnet_day = get_current_day_name();
            const hedging_conditions = await db[MODEL.HEDGING_TIME].findOne({
                where: {
                    index_name: INDEXES_NAMES.MIDCAP,
                    day: currnet_day,
                },
            });
            const current_bal = await db[MODEL.STRATEGY].findOne({
                where: {
                    strategy_name: STRATEGY.PERCENTAGE,
                },
            });
            const find_strategy = await db[MODEL.POSITION].findOne({
                where: {
                    strategy_name: STRATEGY.PERCENTAGE,
                    is_active: true,
                },
            });
            if (find_strategy && find_strategy.is_active) {
                const find_trade = await db[MODEL.TRADE].findAll({
                    where: {
                        strategy_name: STRATEGY.PERCENTAGE,
                        is_active: true,
                    },
                });
                if (find_trade.length > 0) {
                    let CE_SELL_PL = 0;
                    let PE_SELL_PL = 0;
                    let CE_PL = 0;
                    let PE_PL = 0;
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
                    const PL = CE_SELL_PL + PE_SELL_PL + CE_PL + PE_PL;
                    await db[MODEL.POSITION].update(
                        { is_active: false, end_time: moment() },
                        { where: { id: find_strategy.id } },
                    );
                    await db[MODEL.STRATEGY].update(
                        {
                            strategy_balance:
                                current_bal?.strategy_balance +
                                PL +
                                hedging_conditions?.required_margin * 4,
                        },
                        {
                            where: {
                                strategy_name: STRATEGY.PERCENTAGE,
                            },
                        },
                    );
                }
            } else {
                logger.info(
                    'Not any available Postions becuase market time is reach 3:20 PM',
                );
            }
            logger.info(
                'Postions closed all trade sell successfully becuase market time is reach 3:20 PM',
            );
        } catch (error) {
            logger.error('Error in cron send request', error);
        }
    },
    {
        timezone: 'Asia/Kolkata',
    },
);
cron.schedule(
    '20 15 * * *',
    async () => {
        try {
            const currnet_day = get_current_day_name();
            const hedging_conditions = await db[MODEL.HEDGING_TIME].findOne({
                where: {
                    index_name: INDEXES_NAMES.MIDCAP,
                    day: currnet_day,
                },
            });
            const find_strategy = await db[MODEL.POSITION].findOne({
                where: {
                    strategy_name: STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                    is_active: true,
                },
            });
            if (find_strategy && find_strategy.is_active) {
                const find_trade = await db[MODEL.TRADE].findAll({
                    where: {
                        strategy_name: STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        is_active: true,
                    },
                });
                if (find_trade.length > 0) {
                    let CE_SELL_PL = 0;
                    let PE_SELL_PL = 0;
                    let CE_PL = 0;
                    let PE_PL = 0;
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

                    find_trade.map(async (trade) => {
                        const ce = await Place_order_api({
                            qty: trade.qty,
                            instrument_key: trade?.instrument_key,
                            transaction_type:
                                trade.trade_type === 'BUY' ? 'SELL' : 'BUY',
                        });
                        if (ce) {
                            await db[MODEL.TRADE].update(
                                {
                                    is_active: false,
                                    sell_price: trade.ltp,
                                    sell_status: true,
                                    upstock_order_id: ce?.data?.order_id,
                                },
                                {
                                    where: { id: trade.id },
                                },
                            );
                        } else {
                            const ce = await Place_order_api({
                                qty: trade.qty,
                                instrument_key: trade?.instrument_key,
                                transaction_type:
                                    trade.trade_type === 'BUY' ? 'SELL' : 'BUY',
                            });
                            await db[MODEL.TRADE].update(
                                {
                                    is_active: false,
                                    sell_price: trade.ltp,
                                    sell_status: true,
                                    upstock_order_id: ce?.data?.order_id,
                                },
                                {
                                    where: { id: trade.id },
                                },
                            );
                        }
                    });
                    const PL = CE_SELL_PL + PE_SELL_PL + CE_PL + PE_PL;
                    await db[MODEL.POSITION].update(
                        { is_active: false, end_time: moment() },
                        { where: { id: find_strategy.id } },
                    );
                }
            } else {
                logger.info(
                    'Not any available Postions becuase market time is reach 3:20 PM',
                );
            }
            logger.info(
                'Postions closed all trade sell successfully becuase market time is reach 3:20 PM',
            );
        } catch (error) {
            logger.error('Error in cron send request', error);
        }
    },
    {
        timezone: 'Asia/Kolkata',
    },
);
//     '20 15 * * *',
//     async () => {
//         try {
//             const currnet_day = get_current_day_name();
//             const hedging_conditions = await db[MODEL.HEDGING_TIME].findOne({
//                 where: {
//                     index_name: INDEXES_NAMES.MIDCAP,
//                     day: currnet_day,
//                 },
//             });
//             const current_bal = await db[MODEL.STRATEGY].findOne({
//                 where: {
//                     strategy_name: STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
//                 },
//             });
//             const find_strategy = await db[MODEL.POSITION].findOne({
//                 where: {
//                     strategy_name: STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
//                     is_active: true,
//                 },
//             });
//             if (find_strategy && find_strategy.is_active) {
//                 const find_trade = await db[MODEL.TRADE].findAll({
//                     where: {
//                         strategy_name: STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
//                         is_active: true,
//                     },
//                 });
//                 if (find_trade.length > 0) {
//                     let CE_SELL_PL = 0;
//                     let PE_SELL_PL = 0;
//                     let CE_PL = 0;
//                     let PE_PL = 0;
//                     await Promise.all(
//                         find_trade.map(async (trade) => {
//                             if (trade.trade_type === 'SELL') {
//                                 if (trade.instrument_type === 'CE') {
//                                     const diff = trade.buy_price - trade.ltp;
//                                     const lot = trade.lot_size * trade.qty;
//                                     CE_SELL_PL = diff * lot;
//                                     await db[MODEL.TRADE].update(
//                                         { pl: CE_SELL_PL },
//                                         { where: { id: trade.id } },
//                                     );
//                                 } else {
//                                     const diff = trade.buy_price - trade.ltp;
//                                     const lot = trade.lot_size * trade.qty;
//                                     PE_SELL_PL = diff * lot;
//                                     await db[MODEL.TRADE].update(
//                                         { pl: PE_SELL_PL },
//                                         { where: { id: trade.id } },
//                                     );
//                                 }
//                             } else {
//                                 if (trade.instrument_type === 'CE') {
//                                     const diff = trade.ltp - trade.buy_price;
//                                     const lot = trade.lot_size * trade.qty;
//                                     CE_PL = diff * lot;
//                                     await db[MODEL.TRADE].update(
//                                         { pl: CE_PL },
//                                         { where: { id: trade.id } },
//                                     );
//                                 } else {
//                                     const diff = trade.ltp - trade.buy_price;
//                                     const lot = trade.lot_size * trade.qty;
//                                     PE_PL = diff * lot;
//                                     await db[MODEL.TRADE].update(
//                                         { pl: PE_PL },
//                                         { where: { id: trade.id } },
//                                     );
//                                 }
//                             }
//                         }),
//                     );

//                     find_trade.map(async (trade) => {
//                         await db[MODEL.TRADE].update(
//                             {
//                                 is_active: false,
//                                 sell_price: trade.ltp,
//                             },
//                             {
//                                 where: { id: trade.id },
//                             },
//                         );
//                     });
//                     const PL = CE_SELL_PL + PE_SELL_PL + CE_PL + PE_PL;
//                     await db[MODEL.POSITION].update(
//                         { is_active: false, end_time: moment() },
//                         { where: { id: find_strategy.id } },
//                     );
//                     await db[MODEL.STRATEGY].update(
//                         {
//                             strategy_balance:
//                                 current_bal?.strategy_balance +
//                                 PL +
//                                 hedging_conditions?.required_margin * 2,
//                         },
//                         {
//                             where: {
//                                 strategy_name:
//                                     STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
//                             },
//                         },
//                     );
//                 }
//             } else {
//                 logger.info(
//                     'Not any available Postions becuase market time is reach 3:20 PM',
//                 );
//             }
//             logger.info(
//                 'Postions closed all trade sell successfully becuase market time is reach 3:20 PM',
//             );
//         } catch (error) {
//             logger.error('Error in cron send request', error);
//         }
//     },
//     {
//         timezone: 'Asia/Kolkata',
//     },
// );

logger.info('Cron job started.');
