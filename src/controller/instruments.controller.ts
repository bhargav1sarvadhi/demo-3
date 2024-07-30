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
} from '../constant';
import { sendResponse } from '../utils';
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
    strike_around_ce_pe,
    strike_around_start_end,
} from '../helpers';
import { options } from 'joi';
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

                        if (
                            exchange === 'NSE_EQ' ||
                            exchange === 'NSE_FO' ||
                            exchange === 'NSE_INDEX'
                        ) {
                            await db[MODEL.INSTRUMENT].create(raw);
                        }
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
    async instrument_add_kotak(req, res, next) {
        try {
            const csvFilePath = path.join(
                __dirname,
                '../',
                './uploads/nse_fo.csv',
            );
            const data = [];
            function convertTimestampToDate(timestamp) {
                return new Date(parseInt(timestamp, 10) * 1000).toISOString();
            }
            await new Promise<void>((resolve, reject) => {
                fs.createReadStream(csvFilePath)
                    .pipe(csv())
                    .on('data', async (raw) => {
                        const {
                            pSymbol,
                            pGroup,
                            lExpiryDate,
                            pExchSeg,
                            pInstType,
                            pSymbolName,
                            pTrdSymbol,
                            pOptionType,
                            pScripRefKey,
                            pISIN,
                            pAssetCode,
                            pSubGroup,
                            pCombinedSymbol,
                            pDesc,
                            pAmcCode,
                            pContractId,
                            dTickSize,
                            lLotSize,
                            // lExpiryDate,
                            lMultiplier,
                            lPrecision,
                            dStrikePrice,
                            pExchange,
                            pInstName,
                            pExpiryDate,
                            pIssueDate,
                            pMaturityDate,
                            pListingDate,
                            pNoDelStartDate,
                            pNoDelEndDate,
                            pBookClsStartDate,
                            pBookClsEndDate,
                            pRecordDate,
                            pCreditRating,
                            pReAdminDate,
                            pExpulsionDate,
                            pLocalUpdateTime,
                            pDeliveryUnits,
                            pPriceUnits,
                            pLastTradingDate,
                            pTenderPeridEndDate,
                            pTenderPeridStartDate,
                            pSellVarMargin,
                            pBuyVarMargin,
                            pInstrumentInfo,
                            pRemarksText,
                            pSegment,
                            pNav,
                            pNavDate,
                            pMfAmt,
                            pSipSecurity,
                            pFaceValue,
                            pTrdUnits,
                            pExerciseStartDate,
                            pExerciseEndDate,
                            pElmMargin,
                            pVarMargin,
                            pTotProposedLimitValue,
                            pScripBasePrice,
                            pSettlementType,
                            pCurrectionTime,
                            iPermittedToTrade,
                            iBoardLotQty,
                            iMaxOrderSize,
                            iLotSize,
                            dOpenInterest,
                            dHighPriceRange,
                            dLowPriceRange,
                            dPriceNum,
                            dGenDen,
                            dGenNum,
                            dPriceQuatation,
                            dIssuerate,
                            dPriceDen,
                            dWarning,
                        } = raw;
                        if (
                            pInstType === 'OPTIDX' &&
                            pSymbolName === 'MIDCPNIFTY'
                        ) {
                            // const datas = convertTimestampToDate(lExpiryDate);
                            // console.log(
                            //     pInstType,
                            //     pSymbolName,
                            //     raw['lExpiryDate '],
                            // );
                            console.log(raw);

                            raw['lExpiryDate '] = convertTimestampToDate(
                                raw['lExpiryDate '],
                            );
                            raw['dStrikePrice;'] =
                                parseFloat(raw['dStrikePrice;']) / 100;
                            data.push(raw);
                        }

                        // if (
                        //     pExchSeg === 'NSE_EQ' ||
                        //     pExchSeg === 'NSE_FO' ||
                        //     pExchSeg === 'NSE_INDEX'
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

    async get_by_options(req, res, next) {
        try {
            const indexes = {
                MONDAY: [
                    INDEXES_NAMES.BANKNIFTY,
                    // INDEXES_NAMES.FINNITY,
                    // INDEXES_NAMES.NIFTY_50,
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
            const currnet_day = get_current_day_name();
            console.log(currnet_day);

            const next_day = get_next_day_name();
            console.log(next_day);

            let options = [];
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
                    console.log(
                        find_hedging_module?.premium_start / 10,
                        find_hedging_module?.premium_end + 5,
                    );

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
            // console.log(options);
            const start = strike_around_start_end(12432, 10);
            const expirey_date = await get_upcoming_expiry_date(
                INDEXES_NAMES.MIDCAP,
            );
            const find_options = await db[MODEL.OPTIONS_CHAINS].findAll({
                where: {
                    [Op.or]: [
                        {
                            strike_price: {
                                [Op.between]: [
                                    start.start_strike_ce,
                                    start.end_strike_ce,
                                ],
                            },

                            instrument_type: 'CE',
                        },
                        {
                            strike_price: {
                                [Op.between]: [
                                    start.start_strike_pe,
                                    start.end_strike_pe,
                                ],
                            },
                            instrument_type: 'PE',
                        },
                    ],
                    name: INDEXES_NAMES.MIDCAP,
                    expiry: expirey_date,
                },
                order: [['strike_price', 'ASC']],
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

            console.log(uniqueOptions.length, 'unique options');

            // await Promise.all(
            //     uniqueOptions.map(async (data) => {
            //         await db[MODEL.HEDGING_OPTIONS].create({
            //             options_chain_id: data['id'],
            //             name: data['name'],
            //             segment: data['segment'],
            //             exchange: data['exchange'],
            //             expiry: data['expiry'],
            //             weekly: data['weekly'],
            //             instrument_key: data['instrument_key'],
            //             exchange_token: data['exchange_token'],
            //             trading_symbol: data['trading_symbol'],
            //             tick_size: data['tick_size'],
            //             lot_size: data['lot_size'],
            //             instrument_type: data['instrument_type'],
            //             freeze_quantity: data['freeze_quantity'],
            //             underlying_type: data['underlying_type'],
            //             underlying_key: data['underlying_key'],
            //             underlying_symbol: data['underlying_symbol'],
            //             strike_price: data['strike_price'],
            //             ltp: data['ltp'],
            //             minimum_lot: data['minimum_lot'],
            //         });
            //     }),
            // );

            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                data: uniqueOptions,
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
                'NSE_INDEX|NIFTY MID SELECT',
                'NSE_INDEX|Nifty 50',
                'NSE_INDEX|Nifty Bank',
                'NSE_INDEX|Nifty Fin Service',
            ];
            await Promise.all(
                INDEXES.map(async (indexes) => {
                    const accessToken = process.env.OAUTH2_ACCESS_TOKEN;
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

    async strike_to_genrate_options(req, res, next) {
        try {
            const accessToken = process.env.OAUTH2_ACCESS_TOKEN;
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
            // const currnet_day = get_current_day_name();
            const currnet_day = 'TUESDAY';
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
            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                data: options,
                message: res.__('instruments').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

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
            return sendResponse(res, {
                responseType: RES_STATUS.CREATE,
                // data: strategy,
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
}

export const instrumentsController = new InstrumentsController();
