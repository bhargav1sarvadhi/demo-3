import { db } from '../model';
import dotenv from 'dotenv';
dotenv.config();
import {
    ERRORTYPES,
    INDEXES,
    INDEXES_NAMES,
    MODEL,
    RES_STATUS,
    RES_TYPES,
    USER_DETAILS,
} from '../constant';
import { AppError, sendResponse } from '../utils';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import moment from 'moment';
import { Op } from 'sequelize';
import {
    current_strike_price,
    get_current_day_name,
    get_next_day_name,
    get_upcoming_expiry_date,
    place_order_on_upstocks,
    strike_around_ce_pe,
    strike_around_start_end,
} from '../helpers';
import { options } from 'joi';
import { strategyController } from './strategy.controller';
import sequelize from 'sequelize';
const csv = require('csv-parser');

class InstrumentsController {
    async instrument_add(req, res, next) {
        try {
            const csvFilePath = path.join(
                __dirname,
                '../',
                './uploads/NSE.csv',
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
                            underlying_symbol,
                            underlying_key,
                            underlying_type,
                            freeze_quantity,
                            minimum_lot,
                            segment,
                        } = raw;

                        if (name === 'STATE BANK OF INDIA') {
                            await db[MODEL.INSTRUMENT].create(raw);
                        }

                        // if (
                        //     exchange === 'NSE_EQ' ||
                        //     exchange === 'NSE_FO' ||
                        //     exchange === 'NSE_INDEX'
                        // ) {
                        //     await db[MODEL.INSTRUMENT].create(raw);
                        // }
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
    async instrument_add_JSON(req, res, next) {
        try {
            const files = ['../../src/uploads/complete.json'];

            for (const file of files) {
                const jsonData: any = fs.readFileSync(
                    path.join(__dirname, file),
                );
                const data: any = JSON.parse(jsonData);
                const insertdata = [];
                data.map(async (raw) => {
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
                        underlying_symbol,
                        underlying_key,
                        underlying_type,
                        freeze_quantity,
                        minimum_lot,
                        segment,
                    } = raw;

                    if (instrument_key == 'NSE_INDEX|Nifty Bank') {
                        console.log(name);
                        const rawinsert = await db[MODEL.INSTRUMENT].create(
                            raw,
                        );
                        console.log(rawinsert);
                    }
                });
            }

            return Promise.resolve();
        } catch (error) {
            console.error('Error seeding data:', error);
            throw error;
        }
    }

    async get_by_options(req, res, next) {
        try {
            const find_options = await db[MODEL.OPTIONS_CHAINS].findAll({
                where: {
                    is_active: true,
                },
                order: [
                    ['expiry', 'DESC'],
                    ['strike_price', 'ASC'],
                ],
                ...req.paginations,
            });
            const total_count = await db[MODEL.OPTIONS_CHAINS].count({
                where: {
                    is_active: true,
                },
            });
            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: find_options,
                total: total_count,
                paginations: {
                    offset: req.paginations?.offset,
                    limit: req.paginations?.limit,
                },
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async stocks_active_deactive(req, res, next) {
        try {
            const {
                params: { id },
            } = req;
            const find_stcoks = await db[MODEL.OPTIONS_CHAINS].findOne({
                where: { id },
            });
            const active = find_stcoks?.is_active ? false : true;
            await db[MODEL.OPTIONS_CHAINS].update(
                { is_active: active },
                {
                    where: {
                        id: id,
                    },
                },
            );
            return sendResponse(res, {
                responseType: RES_STATUS.UPDATE,
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

    async get_index_strike(req, res, next) {
        try {
            const INDEXES = [
                // 'NSE_INDEX|NIFTY MID SELECT',
                // 'NSE_INDEX|Nifty 50',
                'NSE_INDEX|Nifty Bank',
                // 'NSE_INDEX|Nifty Fin Service',
            ];
            const user = await db[MODEL.USER].findOne({
                where: { email: USER_DETAILS.EMAIL },
            });
            const accessToken = user.token;
            await Promise.all(
                INDEXES.map(async (indexes) => {
                    const config = {
                        method: 'get',
                        url: `https://api.upstox.com/v2/option/contract?instrument_key=${indexes}`,
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: 'application/json',
                        },
                        // params: {
                        //     instrument_key: indexes,
                        // },
                        // maxBodyLength: Infinity,
                    };
                    const response = await axios(config);
                    for (let data of response.data?.data) {
                        const find_options = await db[
                            MODEL.OPTIONS_CHAINS
                        ].findOne({
                            where: { instrument_key: data.instrument_key },
                        });
                        console.log(find_options);
                        if (!find_options) {
                            await db[MODEL.OPTIONS_CHAINS].create(data);
                        }
                    }
                }),
            );

            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                // data: response.data,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    /*************  ✨ Windsurf Command 🌟  *************/
    async strike_to_genrate_options(req, res, next) {
        try {
            const user = await db[MODEL.USER].findOne({
                where: { email: USER_DETAILS.EMAIL },
            });
            const accessToken = user.token;
            const indexes = {
                MONDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    // INDEXES_NAMES.NIFTY_50,
                    // INDEXES_NAMES.MIDCAP,
                ],
                TUESDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                ],
                WEDNESDAY: [
                    // INDEXES_NAMES.FINNITY,
                    // INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                    INDEXES_NAMES.BANKNIFTY,
                ],
                THURSDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    // INDEXES_NAMES.MIDCAP,
                ],
                FRIDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    // INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                ],
                SATURDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    // INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                ],
                SUNDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    // INDEXES_NAMES.MIDCAP,
                    // INDEXES_NAMES.NIFTY_50,
                ],
            };
            // const currnet_day = get_current_day_name();
            const currnet_day = 'MONDAY';
            let options = [];
            console.log('Current day is', currnet_day);
            console.log('Indexes for current day are', indexes[currnet_day]);
            console.log(indexes[currnet_day]);
            await Promise.all(
                indexes[currnet_day].map(async (indexes_names) => {
                    console.log('Getting expiry date for', indexes_names);
                    const expirey_date = await get_upcoming_expiry_date(
                        indexes_names,
                    );
                    console.log(
                        'Expiry date for',
                        indexes_names,
                        'is',
                        expirey_date,
                    );
                    const find_hedging_module = await db[
                        MODEL.HEDGING_TIME
                    ].findOne({
                        where: { day: currnet_day, index_name: indexes_names },
                    });
                    console.log(
                        'Hedging module for',
                        indexes_names,
                        'is',
                        find_hedging_module,
                    );
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
                    console.log(
                        'Options data for',
                        indexes_names,
                        'are',
                        options_datas,
                    );
                    options = [...options, ...options_datas];
                }),
            );
            await Promise.all(
                options.map(async (data) => {
                    console.log('Creating hedging options for', data.name);
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
            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                data: options,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            console.log('Error in strike_to_genrate_options', error);
            return next(error);
        }
    }
    /*******  9faca84e-aad7-4082-a50c-878cb797dd23  *******/

    async insert_hedging_strategy(req, res, next) {
        try {
            // const hedging = await db[MODEL.HEDGING_TIME].bulkCreate(
            //     req.body.data,
            // );
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

            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                data: { find_options },
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async strategy_create(req, res, next) {
        try {
            const {
                body: {
                    data: { strategy_name, strategy_balance },
                },
            } = req;
            const strategy = await db[MODEL.STRATEGY].create(req.body.data);
            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                data: strategy,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async hedging_options_removes(req, res, next) {
        try {
            const hedging_options = await db[MODEL.HEDGING_OPTIONS].destroy({
                where: {},
                force: true,
            });
            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                // data: strategy,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }
    async strike_genrate(req, res, next) {
        try {
            const {
                body: {
                    data: { add_pluse_count },
                },
            } = req;
            const current_strike = await current_strike_price(
                INDEXES.BANKNIFTY,
            );
            const expirey_date = await get_upcoming_expiry_date(
                INDEXES_NAMES.BANKNIFTY,
            );
            console.log(expirey_date);

            const roundedStrike = Math.round(current_strike / 100) * 100;
            let find_options = [];
            const find_options_ce = await db[MODEL.OPTIONS_CHAINS].findAll({
                where: {
                    expiry: expirey_date,
                    name: INDEXES_NAMES.BANKNIFTY,
                    strike_price: roundedStrike + add_pluse_count,
                    instrument_type: 'CE',
                },
            });
            const find_options_pe = await db[MODEL.OPTIONS_CHAINS].findAll({
                where: {
                    expiry: expirey_date,
                    name: INDEXES_NAMES.BANKNIFTY,
                    strike_price: roundedStrike - add_pluse_count,
                    instrument_type: 'PE',
                },
            });
            find_options = [...find_options_ce, ...find_options_pe];
            // await db[MODEL.STRIKE_MODEL].destroy({
            //     where: {},
            //     force: true,
            // });
            for (let data of find_options) {
                const current_strike = await current_strike_price(
                    data.instrument_key,
                );

                const find_stock = await db[MODEL.STRIKE_MODEL].findOne({
                    where: {
                        instrument_key: data.instrument_key,
                    },
                });

                if (!find_stock) {
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
            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                // data: strategy,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async is_active_deactive_strike_stock(req, res, next) {
        try {
            const {
                params: { id },
            } = req;

            const find_stocks = await db[MODEL.STRIKE_MODEL].findOne({
                where: { id },
            });
            if (!find_stocks) {
                throw new AppError('Stock not found', ERRORTYPES.NOT_FOUND);
            }
            await db[MODEL.STRIKE_MODEL].update(
                { is_active: false },
                {
                    where: {
                        instrument_type: find_stocks.instrument_type,
                    },
                },
            );

            await db[MODEL.STRIKE_MODEL].update(
                { is_active: true },
                {
                    where: {
                        id: id,
                    },
                },
            );

            return sendResponse(res, {
                responseType: RES_STATUS.UPDATE,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async get_add_hedging_options_list(req, res, next) {
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

            const data = await db[MODEL.HEDGING_OPTIONS].findAll({});
            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: data,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async instuments_to_optionschain(req, res, next) {
        try {
            const data = [];
            const startDate = moment().startOf('month').format('YYYY-MM-DD');
            const endDate = moment().endOf('month').format('YYYY-MM-DD');
            const instruments = await db[MODEL.INSTRUMENT].findAll({
                where: {
                    instrument_type: 'OPTSTK',
                    expiry: {
                        [Op.between]: [startDate, endDate],
                    },
                },
            });

            if (instruments.length > 0) {
                await Promise.all(
                    instruments.map(async (data) => {
                        const [finded, created] = await db[
                            MODEL.OPTIONS_CHAINS
                        ].findOrCreate({
                            where: {
                                trading_symbol: data['tradingsymbol'],
                                expiry: data['expiry'],
                            },
                            defaults: {
                                name: data['name'],
                                exchange: data['exchange'],
                                expiry: data['expiry'],
                                instrument_key: data['instrument_key'],
                                exchange_token: data['exchange_token'],
                                trading_symbol: data['tradingsymbol'],
                                tick_size: Number(data['tick_size']),
                                lot_size: Number(data['lot_size']),
                                instrument_type: data['option_type'],
                                strike_price: data['strike'],
                                ltp: data['ltp'],
                            },
                        });
                    }),
                );
            }
            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: data,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            console.log(error);

            return next(error);
        }
    }

    async check_scalping(req, res, next) {
        try {
            const data = await strategyController.scallping_strategy();
            // for (let i of data) {
            //     // const timestamp = i.ts.toNumber();
            //     const candleDate = new Date(Number(i.ts));
            //     const candleDateIST = candleDate.toLocaleString('en-IN', {
            //         timeZone: 'Asia/Kolkata',
            //     });
            //     console.log(candleDateIST);
            // }
            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: data,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async check_order_place(req, res, next) {
        try {
            const {
                body: {
                    data: { instrument_key, token, lot_size, transaction_type },
                },
            } = req;
            console.log(instrument_key, token, lot_size, transaction_type);

            const order_placed = await place_order_on_upstocks({
                instrument_key: instrument_key,
                accessToken: token,
                quantity: lot_size,
                transaction_type: transaction_type,
            });

            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: order_placed,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async stock_list(req, res, next) {
        try {
            const data = await db[MODEL.STRIKE_MODEL].findAll({
                ...req.paginations,
                order: [
                    [sequelize.literal('"is_active" DESC')],

                    // 2. instrument_type → CE first, PE second
                    [
                        sequelize.literal(`CASE 
                                WHEN instrument_type = 'CE' THEN 1 
                                WHEN instrument_type = 'PE' THEN 2 
                                ELSE 3 
                            END ASC`),
                    ],

                    // 3. strike_number → ascending
                    ['strike_number', 'ASC'],
                ],
            });
            const count = await db[MODEL.STRIKE_MODEL].count({});
            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: data,
                total: count,
                paginations: {
                    offset: req.paginations?.offset,
                    limit: req.paginations?.limit,
                },
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }
    async trade_historylist(req, res, next) {
        try {
            const {
                query: { toDate, fromDate },
            } = req;
            let formated_data = [];
            const data = await db[MODEL.TRADE].findAll({
                where: {
                    createdAt: {
                        [Op.between]: [fromDate, toDate],
                    },
                },
                ...req.paginations,
                order: [['createdAt', 'DESC']],
            });
            const count = await db[MODEL.TRADE].count({
                where: {
                    createdAt: {
                        [Op.between]: [fromDate, toDate],
                    },
                },
            });

            if (data.length > 0) {
                await Promise.all(
                    data.map(async (datas) => {
                        formated_data.push({
                            id: datas.trade_id,
                            date: datas.createdAt,
                            symbol: datas.trading_symbol,
                            buyPrice: datas.buy_price,
                            sellPrice: datas.sell_price,
                            quantity:
                                Number(datas.lot_size) * Number(datas.qty),
                            profitLoss: datas.pl,
                            duration: datas.duration,
                            stopplose: datas.stop_loss,
                            target: datas.target_price,
                            status: datas.is_active ? 'Active' : 'Deactive',
                        });
                    }),
                );
            }
            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: formated_data,
                total: count,
                paginations: {
                    offset: req.paginations?.offset,
                    limit: req.paginations?.limit,
                },
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async current_postions(req, res, next) {
        try {
            let formated_data = [];
            const trades = await db[MODEL.TRADE].findAll({
                where: {
                    createdAt: {
                        [Op.between]: [
                            moment().startOf('day'),
                            moment().endOf('day'),
                        ],
                    },
                },
                order: [['createdAt', 'DESC']],
            });
            if (trades.length > 0) {
                await Promise.all(
                    trades.map(async (datas) => {
                        formated_data.push({
                            id: datas.trade_id,
                            entryDate: datas.createdAt,
                            symbol: datas.trading_symbol,
                            buyPrice: datas.buy_price,
                            sellPrice: datas.sell_price,
                            currentLTP: datas.ltp,
                            target: datas.target_price,
                            stopploss: datas.stop_loss,
                            profitLoss: datas.pl,
                            quantity:
                                Number(datas.lot_size) * Number(datas.qty),
                            status: datas.is_active ? 'in_trade' : 'closed',
                        });
                    }),
                );
            }
            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: formated_data,
                paginations: {
                    offset: req.paginations?.offset,
                    limit: req.paginations?.limit,
                },
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async dashboard(req, res, next) {
        try {
            const startOfMonth = moment().startOf('month').toDate();
            const endOfMonth = moment().endOf('month').toDate();
            let pl = 0;
            const currentMonthTradeCount = await db[MODEL.TRADE].findAll({
                where: {
                    createdAt: {
                        [Op.between]: [startOfMonth, endOfMonth],
                    },
                },
            });

            if (currentMonthTradeCount.length > 0) {
                await Promise.all(
                    currentMonthTradeCount.map(async (datas) => {
                        pl += Number(datas.pl);
                    }),
                );
            }

            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: {
                    monthlyProfitLoss: pl,
                    accountBalance: 0,
                    totalTrades: currentMonthTradeCount.length,
                },
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async webhooks_notification_token(req, res, next) {
        try {
            const {
                body: { access_token },
            } = req;

            console.log('calling webhooks');

            console.log(req.body);

            if (access_token) {
                const user = await db[MODEL.USER].findOne({
                    where: { email: USER_DETAILS.EMAIL },
                });

                const update = await db[MODEL.USER].update(
                    { token: access_token },
                    { where: { email: USER_DETAILS.EMAIL } },
                );

                console.log(update);
            }
        } catch (error) {
            return next(error);
        }
    }
}

export const instrumentsController = new InstrumentsController();
