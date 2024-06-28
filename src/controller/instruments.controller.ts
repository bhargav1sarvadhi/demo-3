import { db } from '../model';
import dotenv from 'dotenv';
dotenv.config();
import { ERRORTYPES, MODEL, RES_STATUS, RES_TYPES } from '../constant';
import { sendResponse } from '../utils';
import path from 'path';
import fs from 'fs';
const csv = require('csv-parser');

class InstrumentsController {
    async instrument_add(req, res, next) {
        try {
            const csvFilePath = path.join(
                __dirname,
                '../',
                './uploads/complete.csv',
            );
            const data = [];
            await new Promise<void>((resolve, reject) => {
                fs.createReadStream(csvFilePath)
                    .pipe(csv())
                    .on('data', async (raw) => {
                        const {
                            instrument_key,
                            exchange_token,
                            tradingsymbol,
                            name,
                            last_price,
                            expiry,
                            tick_size,
                            lot_size,
                            instrument_type,
                            option_type,
                            exchange,
                        } = raw;

                        await db[MODEL.INSTRUMENT].create(raw);
                    })
                    .on('end', () => {
                        resolve();
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });
            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                data: data,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async get_by_options(req, res, next) {
        try {
            // const options = await db[MODEL.INSTRUMENT].findAll({
            //     where: { instrument_type: 'OPTIDX', expiry: '2024-04-24' },
            // });
            const datafetch = await db[MODEL.CANDELS].findAll({
                where: { instrument_key: 'NSE_FO|67509', interval: 'I1' },
                order: [['createdAt', 'DESC']],
            });
            const dataWithIST = datafetch.map((item) => ({
                ...item.toJSON(), // Convert Sequelize model instance to JSON
                ts: instrumentsController.convertToIndianTime(item.ts),
            }));

            const data = {
                feeds: {
                    'NSE_FO|67509': {
                        ff: {
                            marketFF: {
                                ltpc: {},
                                marketLevel: {},
                                optionGreeks: {
                                    up: 262.9,
                                    delta: 1,
                                    rho: 0.46412932025621506,
                                },
                                marketOHLC: {},
                                eFeedDetails: { lc: 28.15, uc: 55.55 },
                            },
                        },
                    },
                    'NSE_INDEX|Nifty 50': {
                        ff: {
                            indexFF: {
                                ltpc: {
                                    ltp: 21957.5,
                                    ltt: '1715250600000',
                                    cp: 22302.5,
                                },
                                marketOHLC: {
                                    ohlc: [
                                        {
                                            interval: '1d',
                                            open: 22224.8,
                                            high: 22307.75,
                                            low: 21932.4,
                                            close: 21957.5,
                                            ts: '1715193000000',
                                        },
                                        {
                                            interval: 'I1',
                                            open: 21963.8,
                                            high: 21968.15,
                                            low: 21957.7,
                                            close: 21968.15,
                                            ts: '1715248740000',
                                        },
                                        {
                                            interval: 'I1',
                                            open: 21967.1,
                                            high: 21967.1,
                                            low: 21967.1,
                                            close: 21967.1,
                                            ts: '1715248800000',
                                        },
                                        {
                                            interval: 'I30',
                                            open: 21972.75,
                                            high: 22022.85,
                                            low: 21942.5,
                                            close: 21943,
                                            ts: '1715246100000',
                                        },
                                        {
                                            interval: 'I30',
                                            open: 21943.2,
                                            high: 21968.15,
                                            low: 21932.4,
                                            close: 21967.1,
                                            ts: '1715247900000',
                                        },
                                    ],
                                },
                                yh: 22794.7,
                                yl: 18060.4,
                            },
                        },
                    },
                },
            };

            console.log(
                instrumentsController.convertToIndianTime('1715248740000'),
            );
            console.log(
                instrumentsController.convertToIndianTime('1715248800000'),
            );

            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                data: dataWithIST,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    convertToIndianTime = (timestamp) => {
        const utcTimestamp = new Date(parseInt(timestamp));
        const istTimestamp = new Date(
            utcTimestamp.toLocaleString('en-US', {
                timeZone: 'Asia/Kolkata',
            }),
        );
        return istTimestamp.toLocaleString();
    };
}

export const instrumentsController = new InstrumentsController();
