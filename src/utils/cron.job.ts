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
    strike_around_ce_pe,
    strike_around_start_end,
} from '../helpers';
import { Op } from 'sequelize';
import { INDEXES, STRATEGY, USER_DETAILS } from '../constant/response.types';

cron.schedule(
    '30 23 * * *',
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
            const indexes = {
                MONDAY: [
                    // INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    // INDEXES_NAMES.NIFTY_50,
                    INDEXES_NAMES.MIDCAP,
                ],
                TUESDAY: [
                    // INDEXES_NAMES.BANKNIFTY,
                    INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                ],
                WEDNESDAY: [
                    // INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                ],
                THURSDAY: [
                    // INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                ],
                FRIDAY: [
                    // INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                ],
                SATURDAY: [
                    // INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                ],
                SUNDAY: [
                    // INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                ],
            };

            const rateLimiter = (function () {
                let lastSecondRequests = 0;
                let lastMinuteRequests = 0;
                let last30MinutesRequests = 0;
                let queue = [];
                let timer;

                const processQueue = async () => {
                    if (queue.length === 0) {
                        clearInterval(timer);
                        timer = null;
                        return;
                    }

                    const currentTime = Date.now();
                    if (
                        lastSecondRequests < 25 &&
                        lastMinuteRequests < 250 &&
                        last30MinutesRequests < 1000
                    ) {
                        const { fn, resolve } = queue.shift();
                        lastSecondRequests++;
                        lastMinuteRequests++;
                        last30MinutesRequests++;
                        fn().then(resolve);
                    }

                    setTimeout(() => {
                        lastSecondRequests = Math.max(
                            0,
                            lastSecondRequests - 1,
                        );
                    }, 1000);
                    setTimeout(() => {
                        lastMinuteRequests = Math.max(
                            0,
                            lastMinuteRequests - 1,
                        );
                    }, 60000);
                    setTimeout(() => {
                        last30MinutesRequests = Math.max(
                            0,
                            last30MinutesRequests - 1,
                        );
                    }, 1800000);
                };

                const scheduleRequest = (fn) => {
                    return new Promise((resolve) => {
                        queue.push({ fn, resolve });
                        if (!timer) {
                            timer = setInterval(processQueue, 1000 / 25); // process queue with 25 requests per second rate
                        }
                    });
                };

                return {
                    scheduleRequest,
                };
            })();
            const processOptions = async (options, accessToken) => {
                const batchSize = 20; // Number of requests per minute
                const delayBetweenBatches = 60000; // 1 minute delay in milliseconds

                for (let i = 0; i < options.length; i += batchSize) {
                    const batch = options.slice(i, i + batchSize);

                    const promises = batch.map(async (options_data) => {
                        console.log(options_data.instrument_key);
                        const config = {
                            method: 'get',
                            url: 'https://api.upstox.com/v2/market-quote/ltp',
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                Accept: 'application/json',
                            },
                            params: {
                                instrument_key: options_data.instrument_key,
                            },
                            maxBodyLength: Infinity,
                        };
                        await rateLimiter
                            .scheduleRequest(() => axios(config))
                            .then(async (response) => {
                                for (const key in response['data'].data) {
                                    if (
                                        Object.prototype.hasOwnProperty.call(
                                            response['data'].data,
                                            key,
                                        )
                                    ) {
                                        const lastPrice =
                                            response['data'].data[key]
                                                .last_price;

                                        const update = await db[
                                            MODEL.OPTIONS_CHAINS
                                        ].update(
                                            {
                                                ltp: lastPrice,
                                            },
                                            {
                                                where: {
                                                    instrument_key:
                                                        options_data.instrument_key,
                                                },
                                            },
                                        );
                                        // console.log(lastPrice, update);
                                        break;
                                    }
                                }
                            });
                    });

                    await Promise.all(promises);

                    if (i + batchSize < options.length) {
                        // console.log(
                        //     `Waiting for ${
                        //         delayBetweenBatches / 1000
                        //     } seconds before next batch...`,
                        // );
                        await new Promise((resolve) =>
                            setTimeout(resolve, delayBetweenBatches),
                        );
                    }
                }
            };
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
            // logger.info('Optoins Chains updated successfully.');

            for (let indexes_name of INDEXES_NAME) {
                const expirey_date = await get_upcoming_expiry_date(
                    indexes_name,
                );
                const options = await db[MODEL.OPTIONS_CHAINS].findAll({
                    where: { name: indexes_name, expiry: expirey_date },
                });
                // console.log(options.length, indexes_name);
                await processOptions(options, accessToken);
            }
            logger.info('Optoins Chains Price updated successfully.');

            // step 3 : start options get
            const currnet_day = get_current_day_name();
            const next_day = get_next_day_name();
            let options = [];
            console.log(indexes[currnet_day]);
            await Promise.all(
                indexes[next_day].map(async (indexes_names) => {
                    const expirey_date = await get_upcoming_expiry_date(
                        indexes_names,
                    );
                    const find_hedging_module = await db[
                        MODEL.HEDGING_TIME
                    ].findOne({
                        where: { day: next_day, index_name: indexes_names },
                    });
                    const options_datas = await db[
                        MODEL.OPTIONS_CHAINS
                    ].findAll({
                        where: {
                            expiry: expirey_date,
                            name: indexes_names,
                            ltp: {
                                [Op.between]: [1, 50],
                            },
                        },
                        order: [['strike_price', 'ASC']],
                    });
                    options = [...options, ...options_datas];
                }),
            );
            const current_strike = await current_strike_price(INDEXES.MIDCAP);
            // const strikePrices = strike_around_ce_pe(current_strike, 10);
            const strikePrices = strike_around_start_end(current_strike, 10);
            const expirey_date = await get_upcoming_expiry_date(
                INDEXES_NAMES.MIDCAP,
            );
            const find_options = await db[MODEL.OPTIONS_CHAINS].findAll({
                where: {
                    [Op.or]: [
                        {
                            strike_price: {
                                [Op.between]: [
                                    strikePrices.start_strike_ce,
                                    strikePrices.end_strike_ce,
                                ],
                            },

                            instrument_type: 'CE',
                        },
                        {
                            strike_price: {
                                [Op.between]: [
                                    strikePrices.start_strike_pe,
                                    strikePrices.end_strike_pe,
                                ],
                            },
                            instrument_type: 'PE',
                        },
                    ],
                    name: INDEXES_NAMES.MIDCAP,
                    expiry: expirey_date,
                },
            });
            options = [...options, ...find_options];
            const uniqueOptions = Array.from(
                options
                    .reduce(
                        (map, item) => map.set(item.trading_symbol, item),
                        new Map(),
                    )
                    .values(),
            );
            uniqueOptions.sort((a, b) => a['strike_price'] - b['strike_price']);
            await Promise.all(
                uniqueOptions.map(async (data) => {
                    await db[MODEL.HEDGING_OPTIONS].create({
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
                        instrument_type: data['instrument_type'],
                        freeze_quantity: data['freeze_quantity'],
                        underlying_type: data['underlying_type'],
                        underlying_key: data['underlying_key'],
                        underlying_symbol: data['underlying_symbol'],
                        strike_price: data['strike_price'],
                        ltp: data['ltp'],
                        minimum_lot: data['minimum_lot'],
                    });
                }),
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
            const hedging_options = await db[MODEL.HEDGING_OPTIONS].destroy({
                where: {},
                force: true,
            });
            logger.info('All hedging options deleted successfully.');
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
                                hedging_conditions?.required_margin * 2,
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
            const current_bal = await db[MODEL.STRATEGY].findOne({
                where: {
                    strategy_name: STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
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
                                hedging_conditions?.required_margin * 2,
                        },
                        {
                            where: {
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
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

logger.info('Cron job started.');
