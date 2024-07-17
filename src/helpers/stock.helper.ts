import { AppError } from '../utils';
import {
    ERRORTYPES,
    INDEXES_NAMES,
    MODEL,
    STRATEGY,
    USER_DETAILS,
} from '../constant';
import { db } from '../model';
import moment from 'moment';
import { Op } from 'sequelize';
import axios from 'axios';

export const get_upcoming_expiry_date = async (indexes_name) => {
    const currentDate = moment().startOf('day').format('YYYY-MM-DD');
    const nextExpiry = await db[MODEL.OPTIONS_CHAINS].findOne({
        where: {
            name: indexes_name,
            expiry: {
                [Op.gt]: currentDate,
            },
        },
        order: [['expiry', 'ASC']],
    });
    const nextExpiryDate = nextExpiry ? nextExpiry.expiry : null;
    return nextExpiryDate;
};

export const get_current_day_name = () => {
    const currentUTCDate = moment.utc();
    const currentISTDate = currentUTCDate.add(5, 'hours').add(30, 'minutes');
    const formattedDate = currentISTDate.format('YYYY-MM-DD');
    const dayName = currentISTDate.format('dddd').toUpperCase();
    return dayName;
};
export const get_next_day_name = () => {
    const currentUTCDate = moment.utc();
    const currentISTDate = currentUTCDate.add(5, 'hours').add(30, 'minutes');
    const nextISTDate = currentISTDate.add(1, 'days');
    const formattedDate = nextISTDate.format('YYYY-MM-DD');
    const dayName = nextISTDate.format('dddd').toUpperCase();
    return dayName;
};

export const strike_around_ce_pe = (current_strike, limit) => {
    const roundedStrike = Math.round(current_strike / 100) * 100;
    const strikePrices = {
        CE: [roundedStrike],
        PE: [roundedStrike],
    };
    for (let i = 1; i <= limit; i++) {
        strikePrices.CE.push(roundedStrike + i * 100);
        strikePrices.PE.push(roundedStrike - i * 100);
    }
    return strikePrices;
};

export const strike_around_start_end = (current_strike, limit) => {
    const roundedStrike = Math.round(current_strike / 100) * 100;
    const startStrikeCE = roundedStrike;
    const endStrikeCE = roundedStrike + limit * 100;
    const startStrikePE = roundedStrike;
    const endStrikePE = roundedStrike - limit * 100;
    return {
        start_strike_ce: startStrikeCE,
        end_strike_ce: endStrikeCE,
        start_strike_pe: startStrikePE,
        end_strike_pe: endStrikePE,
    };
};

export const current_strike_price = async (instrument_key) => {
    try {
        const user = await db[MODEL.USER].findOne({
            where: { email: USER_DETAILS.EMAIL },
        });
        const accessToken = user.token;
        const config = {
            method: 'get',
            url: 'https://api.upstox.com/v2/market-quote/ltp',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            params: {
                instrument_key: instrument_key,
            },
            maxBodyLength: Infinity,
        };
        const response = await axios(config);
        let last_price = 0;
        for (const key in response.data.data) {
            if (Object.prototype.hasOwnProperty.call(response.data.data, key)) {
                last_price = response.data.data[key].last_price;
                break;
            }
        }
        return last_price;
    } catch (error) {
        throw new AppError(error.message, ERRORTYPES.UNKNOWN_ERROR);
    }
};

export const generate_premium_range = (start, end) => {
    try {
        const premiumRanges = [];
        for (let i = start; i < end; i++) {
            premiumRanges.push([i, i + 1]);
        }
        return premiumRanges;
    } catch (error) {
        throw new AppError(error.message, ERRORTYPES.UNKNOWN_ERROR);
    }
};

export async function find_CE_SELL(data) {
    const premiumRanges = generate_premium_range(
        data.hedging_conditions.premium_start,
        data.hedging_conditions.premium_end,
    );
    for (const [start, end] of premiumRanges) {
        const CE_SELL = await db[MODEL.HEDGING_OPTIONS].findOne({
            where: {
                name: INDEXES_NAMES.MIDCAP,
                expiry: data.expirey,
                instrument_type: 'CE',
                ltp: {
                    [Op.between]: [start, end],
                },
            },
            order: [
                ['strike_price', 'ASC'],
                ['ltp', 'ASC'],
            ],
        });
        if (CE_SELL) {
            return CE_SELL;
        }
    }

    return null;
}

export async function find_PE_SELL(data) {
    const premiumRanges = generate_premium_range(
        data.ce_ltp,
        data.hedging_conditions.premium_end,
    );
    for (const [start, end] of premiumRanges) {
        const PE_SELL = await db[MODEL.HEDGING_OPTIONS].findOne({
            where: {
                name: INDEXES_NAMES.MIDCAP,
                expiry: data.expirey,
                instrument_type: 'PE',
                ltp: {
                    [Op.between]: [start, end],
                },
            },
            order: [
                ['strike_price', 'DESC'],
                ['ltp', 'ASC'],
            ],
        });

        if (PE_SELL) {
            return PE_SELL;
        }
    }
    return null;
}

export async function find_PE(data) {
    const premiumRanges = generate_premium_range(
        data.pe_sell_ltp / 10,
        data.hedging_conditions.premium_end / 10,
    );
    for (const [start, end] of premiumRanges) {
        const PE = await db[MODEL.HEDGING_OPTIONS].findOne({
            where: {
                name: INDEXES_NAMES.MIDCAP,
                expiry: data.expirey,
                instrument_type: 'PE',
                ltp: {
                    [Op.between]: [start, end],
                },
            },
            order: [
                ['strike_price', 'DESC'],
                ['ltp', 'ASC'],
            ],
        });

        if (PE) {
            return PE;
        }
    }
    return null;
}
export async function find_CE(data) {
    const premiumRanges = generate_premium_range(
        data.ce_sell_ltp / 10,
        data.hedging_conditions.premium_end / 10,
    );
    for (const [start, end] of premiumRanges) {
        const CE = await db[MODEL.HEDGING_OPTIONS].findOne({
            where: {
                name: INDEXES_NAMES.MIDCAP,
                expiry: data.expirey,
                instrument_type: 'CE',
                ltp: {
                    [Op.between]: [start, end],
                },
            },
            order: [
                ['strike_price', 'ASC'],
                ['ltp', 'ASC'],
            ],
        });
        if (CE) {
            return CE;
        }
    }

    return null;
}

export const findHedgingOptions = async ({ hedging_conditions, expirey }) => {
    let CE_SELL: { [key: string]: any } = {};
    let PE_SELL: { [key: string]: any } = {};
    let PE: { [key: string]: any } = {};
    let CE: { [key: string]: any } = {};

    CE_SELL = await find_CE_SELL({
        hedging_conditions,
        expirey,
    });
    if (CE_SELL) {
        const PE_SELL = await find_PE_SELL({
            hedging_conditions,
            expirey,
            ce_ltp: CE_SELL.ltp,
        });
        if (PE_SELL) {
            const PE = await find_PE({
                hedging_conditions,
                expirey,
                pe_sell_ltp: PE_SELL.ltp,
            });
            const CE = await find_CE({
                hedging_conditions,
                expirey,
                ce_sell_ltp: CE_SELL.ltp,
            });
            return { CE_SELL, PE_SELL, PE, CE };
        }
    }
    return { CE_SELL, PE_SELL, PE, CE };
};

export async function closeTrades(trades, strategy) {
    await Promise.all(
        trades.map(async (trade) => {
            await db[MODEL.TRADE].update(
                {
                    is_active: false,
                    sell_price: trade.ltp,
                },
                {
                    where: { id: trade.id },
                },
            );
        }),
    );

    await db[MODEL.POSITION].update(
        { is_active: false, end_time: moment() },
        { where: { id: strategy.id } },
    );
}

export async function achieveTarget(
    trades,
    strategy,
    totalPL,
    hedgingConditions,
) {
    console.log(
        'Congratulations! target has been successfully achieved. A profit of 1% has been booked on this trade.',
    );

    await Promise.all(
        trades.map(async (trade) => {
            await db[MODEL.TRADE].update(
                {
                    is_active: false,
                    sell_price: trade.ltp,
                },
                {
                    where: { id: trade.id },
                },
            );
        }),
    );

    await db[MODEL.POSITION].update(
        { is_active: false, end_time: moment() },
        { where: { id: strategy.id } },
    );

    const currentBalance = await db[MODEL.STRATEGY].findOne({
        where: {
            strategy_name: STRATEGY.PERCENTAGE,
        },
    });

    await db[MODEL.STRATEGY].update(
        {
            strategy_balance:
                currentBalance.strategy_balance +
                totalPL +
                hedgingConditions.required_margin * 2,
        },
        {
            where: {
                strategy_name: STRATEGY.PERCENTAGE,
            },
        },
    );
}

export async function handleExistingStrategy(strategy, hedgingConditions) {
    const trades = await db[MODEL.TRADE].findAll({
        where: {
            strategy_name: STRATEGY.PERCENTAGE,
            is_active: true,
        },
    });

    let CE_SELL_PL = 0;
    let PE_SELL_PL = 0;
    let CE_PL = 0;
    let PE_PL = 0;

    await Promise.all(
        trades.map(async (trade) => {
            const diff =
                trade.trade_type === 'SELL'
                    ? trade.buy_price - trade.ltp
                    : trade.ltp - trade.buy_price;
            const lot = trade.lot_size * trade.qty;
            const pl = diff * lot;

            if (trade.trade_type === 'SELL') {
                if (trade.instrument_type === 'CE') {
                    CE_SELL_PL = pl;
                } else {
                    PE_SELL_PL = pl;
                }
            } else {
                if (trade.instrument_type === 'CE') {
                    CE_PL = pl;
                } else {
                    PE_PL = pl;
                }
            }

            await db[MODEL.TRADE].update({ pl }, { where: { id: trade.id } });
        }),
    );

    const tradesToClose = trades.filter(
        (trade) => trade.trade_type === 'SELL' && trade.ltp >= trade.stop_loss,
    );

    if (tradesToClose.length > 0) {
        await closeTrades(trades, strategy);
    }

    const totalPL = CE_SELL_PL + PE_SELL_PL + CE_PL + PE_PL;
    const target = strategy.required_margin * 0.01;

    if (totalPL > target) {
        await achieveTarget(trades, strategy, totalPL, hedgingConditions);
    }

    await db[MODEL.POSITION].update(
        { pl: totalPL },
        { where: { id: strategy.id } },
    );
    console.log('CHECKED');
}

export async function createNewStrategy(
    formattedDate,
    currentISTDate,
    currentDay,
    hedgingConditions,
) {
    const excludeDays = ['SUNDAY', 'SATURDAY'];

    if (excludeDays.includes(currentDay)) {
        console.log('Today is holiday');
        return;
    }

    const expiry = await get_upcoming_expiry_date(INDEXES_NAMES.MIDCAP);
    const strike = await db[MODEL.STRIKE_MODEL].findAll({});
    const totalStrikePrice = strike.reduce(
        (sum, strike) => sum + strike.ltp,
        0,
    );
    console.log('premium_price  ' + totalStrikePrice);

    if (totalStrikePrice <= hedgingConditions.market_premium) {
        console.log('premium price is not matching');
        return;
    }

    const { CE_SELL, PE_SELL, PE, CE } = await findHedgingOptions({
        hedging_conditions: hedgingConditions,
        expirey: expiry,
    });

    if (!CE_SELL || !PE_SELL || !CE || !PE) {
        console.log('CE, PE, CE_SELL, PE_SELL not found');
        return;
    }

    const position = await db[MODEL.POSITION].create({
        strategy_id: 'f3254597-f223-45ff-a60f-37322425895d',
        strategy_name: STRATEGY.PERCENTAGE,
        is_active: true,
        qty: 2,
        trade_id: Math.floor(100000 + Math.random() * 900000),
        date: formattedDate,
        start_time: currentISTDate,
        required_margin: hedgingConditions.required_margin * 2,
    });

    const trades = await Promise.all([
        createTrade(position.id, CE_SELL, 'SELL'),
        createTrade(position.id, PE_SELL, 'SELL'),
        createTrade(position.id, CE, 'BUY'),
        createTrade(position.id, PE, 'BUY'),
    ]);

    if (trades.every((trade) => trade)) {
        const currentBalance = await db[MODEL.STRATEGY].findOne({
            where: {
                strategy_name: STRATEGY.PERCENTAGE,
            },
        });

        await db[MODEL.STRATEGY].update(
            {
                strategy_balance:
                    currentBalance.strategy_balance -
                    hedgingConditions.required_margin * 2,
            },
            {
                where: {
                    strategy_name: STRATEGY.PERCENTAGE,
                },
            },
        );

        console.log('Trade Placed successfully');
    } else {
        await rollbackTrades(position, trades);
        console.error('Trade Placement failed');
    }
}

export async function createTrade(positionId, option, tradeType) {
    return db[MODEL.TRADE].create({
        position_id: positionId,
        options_chain_id: option.options_chain_id,
        trade_id: positionId.trade_id,
        strategy_name: STRATEGY.PERCENTAGE,
        trading_symbol: option.trading_symbol,
        instrument_key: option.instrument_key,
        instrument_type: option.instrument_type,
        trade_type: tradeType,
        buy_price: option.ltp,
        stop_loss: tradeType === 'SELL' ? option.ltp * 2 : 0,
        is_active: true,
        ltp: option.ltp,
        qty: 2,
        lot_size: option.lot_size,
    });
}

export async function rollbackTrades(position, trades) {
    await Promise.all(
        trades.map(async (trade) => {
            await db[MODEL.TRADE].update(
                { is_active: false },
                { where: { id: trade?.id } },
            );
        }),
    );

    await db[MODEL.POSITION].update(
        { is_active: false },
        { where: { id: position?.id } },
    );
}
