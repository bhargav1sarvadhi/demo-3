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
    get_upcoming_expiry_date,
    strike_around_ce_pe,
} from '../helpers';
import { Op } from 'sequelize';
import { INDEXES, USER_DETAILS } from '../constant/response.types';

cron.schedule(
    '51 13 * * *',
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
                    INDEXES_NAMES.BANKNIFTY,
                    INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.NIFTY_50,
                ],
                TUESDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    INDEXES_NAMES.MIDCAP,
                    INDEXES_NAMES.NIFTY_50,
                ],
                WEDNESDAY: [
                    INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                    INDEXES_NAMES.NIFTY_50,
                ],
                THURSDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                ],
                FRIDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                    INDEXES_NAMES.NIFTY_50,
                ],
                SATURDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                    INDEXES_NAMES.NIFTY_50,
                ],
                SUNDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    INDEXES_NAMES.FINNITY,
                    INDEXES_NAMES.MIDCAP,
                    INDEXES_NAMES.NIFTY_50,
                ],
            };
            const processOptions = async (options, accessToken) => {
                const batchSize = 24; // Number of requests per minute
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
                        const response = await axios(config);
                        for (const key in response.data.data) {
                            if (
                                Object.prototype.hasOwnProperty.call(
                                    response.data.data,
                                    key,
                                )
                            ) {
                                const lastPrice =
                                    response.data.data[key].last_price;
                                console.log(lastPrice);
                                await db[MODEL.OPTIONS_CHAINS].update(
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
                                break;
                            }
                        }
                    });

                    await Promise.all(promises);

                    if (i + batchSize < options.length) {
                        console.log(
                            `Waiting for ${
                                delayBetweenBatches / 1000
                            } seconds before next batch...`,
                        );
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
            logger.info('Optoins Chains updated successfully.');

            for (let indexes_name of INDEXES_NAME) {
                const expirey_date = await get_upcoming_expiry_date(
                    indexes_name,
                );
                const options = await db[MODEL.OPTIONS_CHAINS].findAll({
                    where: { name: indexes_name, expiry: expirey_date },
                });
                console.log(options.length, indexes_name);
                await processOptions(options, accessToken);
            }
            logger.info('Optoins Chains Price updated successfully.');

            // step 3 : start options get
            const currnet_day = get_current_day_name();
            let options = [];
            console.log(indexes[currnet_day]);
            await Promise.all(
                indexes[currnet_day].map(async (indexes_names) => {
                    const expirey_date = await get_upcoming_expiry_date(
                        indexes_names,
                    );
                    const find_hedging_module = await db[
                        MODEL.HEDGING_TIME
                    ].findOne({
                        where: { day: currnet_day, index_name: indexes_names },
                    });
                    const options_datas = await db[
                        MODEL.OPTIONS_CHAINS
                    ].findAll({
                        where: {
                            expiry: expirey_date,
                            name: indexes_names,
                            ltp: {
                                [Op.or]: [
                                    {
                                        [Op.between]: [
                                            find_hedging_module?.premium_start,
                                            find_hedging_module?.premium_end,
                                        ],
                                    },
                                    {
                                        [Op.between]: [
                                            find_hedging_module?.premium_start /
                                                10,
                                            find_hedging_module?.premium_end /
                                                10,
                                        ],
                                    },
                                ],
                            },
                        },
                        order: [['strike_price', 'ASC']],
                    });
                    options = [...options, ...options_datas];
                }),
            );
            const current_strike = await current_strike_price(INDEXES.MIDCAP);
            const strikePrices = strike_around_ce_pe(current_strike, 10);
            const expirey_date = await get_upcoming_expiry_date(
                INDEXES_NAMES.MIDCAP,
            );
            const find_options = await db[MODEL.OPTIONS_CHAINS].findAll({
                where: {
                    [Op.or]: [
                        {
                            strike_price: {
                                [Op.in]: strikePrices.CE,
                            },

                            instrument_type: 'CE',
                        },
                        {
                            strike_price: {
                                [Op.in]: strikePrices.PE,
                            },
                            instrument_type: 'PE',
                        },
                    ],
                    name: INDEXES_NAMES.MIDCAP,
                    expiry: expirey_date,
                },
            });
            options = [...options, ...find_options];
            await Promise.all(
                options.map(async (data) => {
                    await db[MODEL.HEDGING_OPTIONS].create({
                        options_chain_id: data.id,
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
                        ltp: data.ltp,
                        minimum_lot: data.minimum_lot,
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

logger.info('Cron job started.');
