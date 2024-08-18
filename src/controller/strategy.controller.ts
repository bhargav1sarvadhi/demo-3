import { db } from '../model';
import { ERRORTYPES, INDEXES_NAMES, MODEL, STRATEGY } from '../constant';
import { AppError } from '../utils';
import {
    Place_order_api,
    findHedgingOptions,
    find_CE,
    find_CE_SELL,
    find_PE,
    find_PE_SELL,
    getCurrentISTDate,
    getISTTime,
    get_current_day_name,
    get_upcoming_expiry_date,
} from '../helpers';
import { logger } from '../logger/logger';
import { Op } from 'sequelize';
import moment from 'moment';

class StrategyController {
    async percentage_strategy() {
        try {
            // console.log('Percentage strategy calling');
            const currentISTDate = getCurrentISTDate();
            const formattedDate = currentISTDate.toISOString().slice(0, 10);
            const currentTime = getISTTime(currentISTDate);
            const startTime = new Date(`${formattedDate}T09:30:00+05:30`);
            const endTime = new Date(`${formattedDate}T15:19:00+05:30`);
            const currnet_day = get_current_day_name();
            const hedging_conditions = await db[MODEL.HEDGING_TIME].findOne({
                where: {
                    index_name: INDEXES_NAMES.MIDCAP,
                    day: currnet_day,
                },
            });
            if (currentISTDate >= startTime && currentISTDate <= endTime) {
                const find_strategy = await db[MODEL.POSITION].findOne({
                    where: {
                        strategy_name: STRATEGY.PERCENTAGE,
                        is_active: true,
                    },
                });
                if (find_strategy) {
                    // console.time('postion check');
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
                    const PL = CE_SELL_PL + PE_SELL_PL + CE_PL + PE_PL;
                    if (tradesToClose.length > 0) {
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
                            { is_active: false, end_time: moment() },
                            { where: { id: find_strategy.id } },
                        );

                        const current_bal = await db[MODEL.STRATEGY].findOne({
                            where: {
                                strategy_name: STRATEGY.PERCENTAGE,
                            },
                        });
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
                            { is_active: false, end_time: moment() },
                            { where: { id: find_strategy.id } },
                        );
                        const current_bal = await db[MODEL.STRATEGY].findOne({
                            where: {
                                strategy_name: STRATEGY.PERCENTAGE,
                            },
                        });
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
                    await db[MODEL.POSITION].update(
                        { pl: PL },
                        { where: { id: find_strategy.id } },
                    );
                    // console.timeEnd('postion check');
                } else {
                    // console.time('trade_created');
                    const currnet_day = get_current_day_name();
                    // console.log(currnet_day);

                    const expirey = await get_upcoming_expiry_date(
                        INDEXES_NAMES.MIDCAP,
                    );
                    const exclude_days = ['SUNDAY', 'SATURDAY'];
                    const strike = await db[MODEL.STRIKE_MODEL].findAll({});
                    const totalStrikePrice = strike.reduce(
                        (sum, strike) => sum + strike.ltp,
                        0,
                    );
                    // console.log('primuem_price  ' + totalStrikePrice);
                    if (!exclude_days.includes(currnet_day)) {
                        const hedging_conditions = await db[
                            MODEL.HEDGING_TIME
                        ].findOne({
                            where: {
                                index_name: INDEXES_NAMES.MIDCAP,
                                day: currnet_day,
                            },
                        });
                        if (
                            totalStrikePrice >
                            hedging_conditions?.market_premium
                        ) {
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
                                        'f3254597-f223-45ff-a60f-37322425895d',
                                    strategy_name: STRATEGY.PERCENTAGE,
                                    is_active: true,
                                    qty: 4,
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
                                    qty: 4,
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
                                    qty: 4,
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
                                    qty: 4,
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
                                    qty: 4,
                                    lot_size: PE.lot_size,
                                });

                                if (ce_sell && pe_sell && ce && pe) {
                                    const current_bal = await db[
                                        MODEL.STRATEGY
                                    ].findOne({
                                        where: {
                                            strategy_name: STRATEGY.PERCENTAGE,
                                        },
                                    });
                                    await db[MODEL.STRATEGY].update(
                                        {
                                            strategy_balance:
                                                current_bal?.strategy_balance -
                                                hedging_conditions?.required_margin *
                                                    2,
                                        },
                                        {
                                            where: {
                                                strategy_name:
                                                    STRATEGY.PERCENTAGE,
                                            },
                                        },
                                    );
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
                                // console.timeEnd('trade_created');
                            } else {
                                logger.info(
                                    'ce pe ce_sell pe_sell not found anyone',
                                );
                            }
                        } else {
                            // logger.info('priminum price is not matching');
                        }
                    } else {
                        logger.info('Today is holiday');
                    }
                }
            } else {
                // logger.error('Market Time is closed');
            }
        } catch (error) {
            logger.error(error.message);
        }
    }
    async percentage_without_contions_strategy() {
        try {
            // console.log('Percentage without condtoins strategy calling');
            const currentISTDate = getCurrentISTDate();
            const formattedDate = currentISTDate.toISOString().slice(0, 10);
            const currentTime = getISTTime(currentISTDate);
            const startTime = new Date(`${formattedDate}T09:30:00+05:30`);
            const endTime = new Date(`${formattedDate}T15:19:00+05:30`);
            const currnet_day = get_current_day_name();
            const hedging_conditions = await db[MODEL.HEDGING_TIME].findOne({
                where: {
                    index_name: INDEXES_NAMES.MIDCAP,
                    day: currnet_day,
                },
            });
            if (currentISTDate >= startTime && currentISTDate <= endTime) {
                const find_strategy = await db[MODEL.POSITION].findOne({
                    where: {
                        strategy_name: STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        is_active: true,
                    },
                });
                if (find_strategy) {
                    // console.time('postion check');
                    const find_trade = await db[MODEL.TRADE].findAll({
                        where: {
                            strategy_name:
                                STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
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
                    const PL = CE_SELL_PL + PE_SELL_PL + CE_PL + PE_PL;
                    if (tradesToClose.length) {
                        console.log(
                            'Close trades triggered. without contionds',
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
                            { is_active: false, end_time: moment() },
                            { where: { id: find_strategy.id } },
                        );

                        const current_bal = await db[MODEL.STRATEGY].findOne({
                            where: {
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                            },
                        });
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
                            { is_active: false, end_time: moment() },
                            { where: { id: find_strategy.id } },
                        );
                        const current_bal = await db[MODEL.STRATEGY].findOne({
                            where: {
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                            },
                        });
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
                    await db[MODEL.POSITION].update(
                        { pl: PL },
                        { where: { id: find_strategy.id } },
                    );
                    // console.timeEnd('postion check');
                } else {
                    // console.time('trade_created');
                    const currnet_day = get_current_day_name();
                    // console.log(currnet_day);

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
                                    '550de29a-44a8-4a2a-a356-e2132bbfdb8f',
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                                is_active: true,
                                qty: 4,
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
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                                trading_symbol: CE_SELL.trading_symbol,
                                instrument_key: CE_SELL.instrument_key,
                                instrument_type: CE_SELL.instrument_type,
                                trade_type: 'SELL',
                                buy_price: CE_SELL.ltp,
                                stop_loss: CE_SELL.ltp * 2,
                                is_active: true,
                                ltp: CE_SELL.ltp,
                                qty: 4,
                                lot_size: CE_SELL.lot_size,
                            });
                            const pe_sell = await db[MODEL.TRADE].create({
                                position_id: create_postions.id,
                                options_chain_id: PE_SELL.options_chain_id,
                                trade_id: create_postions.trade_id,
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                                trading_symbol: PE_SELL.trading_symbol,
                                instrument_key: PE_SELL.instrument_key,
                                instrument_type: PE_SELL.instrument_type,
                                trade_type: 'SELL',
                                buy_price: PE_SELL.ltp,
                                stop_loss: PE_SELL.ltp * 2,
                                is_active: true,
                                ltp: PE_SELL.ltp,
                                qty: 4,
                                lot_size: PE_SELL.lot_size,
                            });
                            const ce = await db[MODEL.TRADE].create({
                                position_id: create_postions.id,
                                options_chain_id: CE.options_chain_id,
                                trade_id: create_postions.trade_id,
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                                trading_symbol: CE.trading_symbol,
                                instrument_key: CE.instrument_key,
                                instrument_type: CE.instrument_type,
                                trade_type: 'BUY',
                                buy_price: CE.ltp,
                                stop_loss: 0,
                                is_active: true,
                                ltp: CE.ltp,
                                qty: 4,
                                lot_size: CE.lot_size,
                            });
                            const pe = await db[MODEL.TRADE].create({
                                position_id: create_postions.id,
                                options_chain_id: PE.options_chain_id,
                                trade_id: create_postions.trade_id,
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                                trading_symbol: PE.trading_symbol,
                                instrument_key: PE.instrument_key,
                                instrument_type: PE.instrument_type,
                                trade_type: 'BUY',
                                buy_price: PE.ltp,
                                stop_loss: 0,
                                is_active: true,
                                ltp: PE.ltp,
                                qty: 4,
                                lot_size: PE.lot_size,
                            });

                            if (ce_sell && pe_sell && ce && pe) {
                                const current_bal = await db[
                                    MODEL.STRATEGY
                                ].findOne({
                                    where: {
                                        strategy_name:
                                            STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                                    },
                                });
                                await db[MODEL.STRATEGY].update(
                                    {
                                        strategy_balance:
                                            current_bal?.strategy_balance -
                                            hedging_conditions?.required_margin *
                                                2,
                                    },
                                    {
                                        where: {
                                            strategy_name:
                                                STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                                        },
                                    },
                                );
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
                            // console.timeEnd('trade_created');
                        } else {
                            logger.info(
                                'ce pe ce_sell pe_sell not found anyone',
                            );
                        }
                    } else {
                        logger.info('Today is holiday');
                    }
                }
            } else {
                // logger.error('Market Time is closed');
            }
        } catch (error) {
            logger.error(error.message);
        }
    }
    async percentage_without_contions_strategy_with_live() {
        try {
            // console.log('Percentage without condtoins strategy calling');
            const currentISTDate = getCurrentISTDate();
            const formattedDate = currentISTDate.toISOString().slice(0, 10);
            const currentTime = getISTTime(currentISTDate);
            const startTime = new Date(`${formattedDate}T09:30:00+05:30`);
            const endTime = new Date(`${formattedDate}T15:19:00+05:30`);
            // const currnet_day = get_current_day_name();
            const currnet_day = 'FRIDAY';
            const hedging_conditions = await db[MODEL.HEDGING_TIME].findOne({
                where: {
                    index_name: INDEXES_NAMES.MIDCAP,
                    day: currnet_day,
                },
            });
            // if (currentISTDate >= startTime && currentISTDate <= endTime) {
            const find_strategy = await db[MODEL.POSITION].findOne({
                where: {
                    strategy_name: STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                    is_active: true,
                },
            });
            if (find_strategy) {
                // console.time('postion check');
                const find_trade = await db[MODEL.TRADE].findAll({
                    where: {
                        strategy_name: STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
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
                const PL = CE_SELL_PL + PE_SELL_PL + CE_PL + PE_PL;
                if (tradesToClose.length) {
                    console.log('Close trades triggered. without contionds');
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
                        { is_active: false, end_time: moment() },
                        { where: { id: find_strategy.id } },
                    );

                    const current_bal = await db[MODEL.STRATEGY].findOne({
                        where: {
                            strategy_name:
                                STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        },
                    });
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
                        { is_active: false, end_time: moment() },
                        { where: { id: find_strategy.id } },
                    );
                    const current_bal = await db[MODEL.STRATEGY].findOne({
                        where: {
                            strategy_name:
                                STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        },
                    });
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
                await db[MODEL.POSITION].update(
                    { pl: PL },
                    { where: { id: find_strategy.id } },
                );
                // console.timeEnd('postion check');
            } else {
                // console.time('trade_created');
                // const currnet_day = get_current_day_name();
                const currnet_day = 'FRIDAY';
                // console.log(currnet_day);

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
                    const { CE_SELL, PE_SELL, PE, CE } =
                        await findHedgingOptions({
                            hedging_conditions,
                            expirey,
                        });

                    if (CE_SELL && PE_SELL && CE && PE) {
                        const create_postions = await db[MODEL.POSITION].create(
                            {
                                strategy_id:
                                    '550de29a-44a8-4a2a-a356-e2132bbfdb8f',
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                                is_active: true,
                                qty: 4,
                                trade_id: Math.floor(
                                    100000 + Math.random() * 900000,
                                ),
                                date: formattedDate,
                                start_time: currentISTDate,
                                required_margin:
                                    hedging_conditions?.required_margin * 2,
                            },
                        );
                        const ce = await Place_order_api({
                            qty: 100,
                            instrument_key: CE?.instrument_key,
                            transaction_type: 'BUY',
                        });
                        console.log(ce?.data?.order_id);

                        if (ce) {
                            const ce_lt = await db[MODEL.TRADE].create({
                                position_id: create_postions.id,
                                options_chain_id: CE.options_chain_id,
                                trade_id: ce?.trade_id,
                                upstock_order_id: ce?.data?.order_id,
                                strategy_name:
                                    STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                                trading_symbol: CE.trading_symbol,
                                instrument_key: CE.instrument_key,
                                instrument_type: CE.instrument_type,
                                trade_type: 'BUY',
                                buy_price: CE.ltp,
                                stop_loss: 0,
                                is_active: true,
                                ltp: CE.ltp,
                                qty: 4,
                                lot_size: CE.lot_size,
                            });
                        }
                        const pe = await Place_order_api({
                            qty: 100,
                            instrument_key: PE?.instrument_key,
                            transaction_type: 'BUY',
                        });
                        const ce_sell = await Place_order_api({
                            qty: 100,
                            instrument_key: CE_SELL?.instrument_key,
                            transaction_type: 'SELL',
                        });
                        const pe_sell = await Place_order_api({
                            qty: 100,
                            instrument_key: PE_SELL.instrument_key,
                            transaction_type: 'SELL',
                        });
                        console.log(ce_sell);
                        // const create_postions = await db[
                        //     MODEL.POSITION
                        // ].create({
                        //     strategy_id:
                        //         '550de29a-44a8-4a2a-a356-e2132bbfdb8f',
                        //     strategy_name:
                        //         STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        //     is_active: true,
                        //     qty: 4,
                        //     trade_id: Math.floor(
                        //         100000 + Math.random() * 900000,
                        //     ),
                        //     date: formattedDate,
                        //     start_time: currentISTDate,
                        //     required_margin:
                        //         hedging_conditions?.required_margin * 2,
                        // });
                        // const ce_sell = await db[MODEL.TRADE].create({
                        //     position_id: create_postions.id,
                        //     options_chain_id: CE_SELL.options_chain_id,
                        //     trade_id: create_postions.trade_id,
                        //     strategy_name:
                        //         STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        //     trading_symbol: CE_SELL.trading_symbol,
                        //     instrument_key: CE_SELL.instrument_key,
                        //     instrument_type: CE_SELL.instrument_type,
                        //     trade_type: 'SELL',
                        //     buy_price: CE_SELL.ltp,
                        //     stop_loss: CE_SELL.ltp * 2,
                        //     is_active: true,
                        //     ltp: CE_SELL.ltp,
                        //     qty: 4,
                        //     lot_size: CE_SELL.lot_size,
                        // });
                        // const pe_sell = await db[MODEL.TRADE].create({
                        //     position_id: create_postions.id,
                        //     options_chain_id: PE_SELL.options_chain_id,
                        //     trade_id: create_postions.trade_id,
                        //     strategy_name:
                        //         STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        //     trading_symbol: PE_SELL.trading_symbol,
                        //     instrument_key: PE_SELL.instrument_key,
                        //     instrument_type: PE_SELL.instrument_type,
                        //     trade_type: 'SELL',
                        //     buy_price: PE_SELL.ltp,
                        //     stop_loss: PE_SELL.ltp * 2,
                        //     is_active: true,
                        //     ltp: PE_SELL.ltp,
                        //     qty: 4,
                        //     lot_size: PE_SELL.lot_size,
                        // });
                        // const ce = await db[MODEL.TRADE].create({
                        //     position_id: create_postions.id,
                        //     options_chain_id: CE.options_chain_id,
                        //     trade_id: create_postions.trade_id,
                        //     strategy_name:
                        //         STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        //     trading_symbol: CE.trading_symbol,
                        //     instrument_key: CE.instrument_key,
                        //     instrument_type: CE.instrument_type,
                        //     trade_type: 'BUY',
                        //     buy_price: CE.ltp,
                        //     stop_loss: 0,
                        //     is_active: true,
                        //     ltp: CE.ltp,
                        //     qty: 4,
                        //     lot_size: CE.lot_size,
                        // });
                        // const pe = await db[MODEL.TRADE].create({
                        //     position_id: create_postions.id,
                        //     options_chain_id: PE.options_chain_id,
                        //     trade_id: create_postions.trade_id,
                        //     strategy_name:
                        //         STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        //     trading_symbol: PE.trading_symbol,
                        //     instrument_key: PE.instrument_key,
                        //     instrument_type: PE.instrument_type,
                        //     trade_type: 'BUY',
                        //     buy_price: PE.ltp,
                        //     stop_loss: 0,
                        //     is_active: true,
                        //     ltp: PE.ltp,
                        //     qty: 4,
                        //     lot_size: PE.lot_size,
                        // });
                        // if (ce_sell && pe_sell && ce && pe) {
                        //     const current_bal = await db[
                        //         MODEL.STRATEGY
                        //     ].findOne({
                        //         where: {
                        //             strategy_name:
                        //                 STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        //         },
                        //     });
                        //     await db[MODEL.STRATEGY].update(
                        //         {
                        //             strategy_balance:
                        //                 current_bal?.strategy_balance -
                        //                 hedging_conditions?.required_margin *
                        //                     2,
                        //         },
                        //         {
                        //             where: {
                        //                 strategy_name:
                        //                     STRATEGY.PERCENTAGE_WITHOUT_CONDITIONS,
                        //             },
                        //         },
                        //     );
                        //     logger.info('Trade Placed successfully');
                        // } else {
                        //     await db[MODEL.TRADE].update(
                        //         { is_active: false },
                        //         { where: { id: ce?.id } },
                        //     );
                        //     await db[MODEL.TRADE].update(
                        //         { is_active: false },
                        //         { where: { id: pe?.id } },
                        //     );
                        //     await db[MODEL.TRADE].update(
                        //         { is_active: false },
                        //         { where: { id: ce_sell?.id } },
                        //     );
                        //     await db[MODEL.TRADE].update(
                        //         { is_active: false },
                        //         { where: { id: pe_sell?.id } },
                        //     );
                        //     await db[MODEL.POSITION].update(
                        //         { is_active: false },
                        //         { where: { id: create_postions?.id } },
                        //     );
                        //     logger.error('Trade Placement failed');
                        // }
                        // console.timeEnd('trade_created');
                    } else {
                        logger.info('ce pe ce_sell pe_sell not found anyone');
                    }
                } else {
                    logger.info('Today is holiday');
                }
            }
            // } else {
            //     // logger.error('Market Time is closed');
            // }
        } catch (error) {
            logger.error(error.message);
        }
    }
}

export const strategyController = new StrategyController();
