import cron from 'node-cron';
import * as path from 'path';
import { logger } from '../logger/logger';
import { MODEL, ROLES } from '../constant';
import { db } from '../model';
import axios from 'axios';

cron.schedule(
    '*/5 * * * *',
    async () => {
        try {
            logger.info('cron started');
            const INDEXES = [
                'NSE_INDEX|NIFTY MID SELECT',
                'NSE_INDEX|Nifty 50',
                'NSE_INDEX|Nifty Bank',
                'NSE_INDEX|Nifty Fin Service',
            ];
            const accessToken = process.env.OAUTH2_ACCESS_TOKEN;
            // await Promise.all(
            //     INDEXES.map(async (indexes) => {
            //         const config = {
            //             method: 'get',
            //             url: 'https://api.upstox.com/v2/option/contract',
            //             headers: {
            //                 Authorization: `Bearer ${accessToken}`,
            //                 Accept: 'application/json',
            //             },
            //             params: {
            //                 instrument_key: indexes,
            //             },
            //             maxBodyLength: Infinity,
            //         };
            //         const response = await axios(config);
            //         for (let data of response.data?.data) {
            //             const find_options = await db[
            //                 MODEL.OPTIONS_CHAINS
            //             ].findOne({
            //                 where: { instrument_key: data.instrument_key },
            //             });
            //             console.log(find_options);
            //             if (!find_options) {
            //                 await db[MODEL.OPTIONS_CHAINS].create(data);
            //             }
            //         }
            //     }),
            // );
            logger.info('Optoins Chains updated successfully.');
            const options = await db[MODEL.OPTIONS_CHAINS].findAll({});
            for (let options_data of options) {
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
                        const lastPrice = response.data.data[key].last_price;
                        console.log(lastPrice);
                        await db[MODEL.OPTIONS_CHAINS].update(
                            {
                                ltp: lastPrice,
                            },
                            {
                                where: {
                                    instrument_key: options_data.instrument_key,
                                },
                            },
                        );
                        break;
                    }
                }
            }
            logger.info('Optoins Chains Price updated successfully.');
        } catch (error) {
            logger.error('Error in cron send request', error.message);
        }
    },
    {
        timezone: 'Asia/Kolkata',
    },
);

logger.info('Cron job started.');
