import { AppError } from '../utils';
import { ERRORTYPES, INDEXES_NAMES, MODEL, USER_DETAILS } from '../constant';
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

export function getCurrentISTDate() {
    const now = new Date();
    const options: any = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    };
    const formatter = new Intl.DateTimeFormat('en-GB', options);
    const [
        { value: day },
        ,
        { value: month },
        ,
        { value: year },
        ,
        { value: hour },
        ,
        { value: minute },
        ,
        { value: second },
    ] = formatter.formatToParts(now);

    return new Date(
        `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`,
    );
}

// Helper function to get the time part of a date in IST
export function getISTTime(date) {
    const options: any = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    };
    const formatter = new Intl.DateTimeFormat('en-GB', options);
    const [{ value: hour }, , { value: minute }] =
        formatter.formatToParts(date);
    return `${hour}:${minute}`;
}

export const marging_calculate = async (data) => {
    try {
        const user = await db[MODEL.USER].findOne({
            where: { email: USER_DETAILS.EMAIL },
        });
        const accessToken = user.token;
        console.log(data?.CE?.instrument_key);

        const body = {
            instruments: [
                {
                    instrument_key: data.CE?.instrument_key,
                    quantity: data.qty,
                    transaction_type: 'BUY',
                    product: 'D',
                    price: data.CE?.ltp,
                },
                // {
                //     instrument_key: data.PE?.instrument_key,
                //     quantity: data.qty,
                //     transaction_type: 'BUY',
                //     product: 'D',
                //     price: data.PE?.ltp,
                // },
                // {
                //     instrument_key: data.CE_SELL?.instrument_key,
                //     quantity: data.qty,
                //     transaction_type: 'SELL',
                //     product: 'D',
                //     price: data.CE_SELL?.ltp,
                // },
                // {
                //     instrument_key: data.PE_SELL?.instrument_key,
                //     quantity: data.qty,
                //     transaction_type: 'SELL',
                //     product: 'D',
                //     price: data.PE_SELL?.ltp,
                // },
            ],
        };
        console.log(body);

        const config = {
            method: 'post',
            url: 'https://api.upstox.com/v2/charges/margin',
            maxBodyLength: Infinity,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            data: {
                instruments: [
                    {
                        instrument_key: data.CE?.instrument_key,
                        quantity: data.qty,
                        transaction_type: 'BUY',
                        product: 'D',
                        price: data.CE?.ltp,
                    },
                    // {
                    //     instrument_key: data.PE?.instrument_key,
                    //     quantity: data.qty,
                    //     transaction_type: 'BUY',
                    //     product: 'D',
                    //     price: data.PE?.ltp,
                    // },
                    // {
                    //     instrument_key: data.CE_SELL?.instrument_key,
                    //     quantity: data.qty,
                    //     transaction_type: 'SELL',
                    //     product: 'D',
                    //     price: data.CE_SELL?.ltp,
                    // },
                    // {
                    //     instrument_key: data.PE_SELL?.instrument_key,
                    //     quantity: data.qty,
                    //     transaction_type: 'SELL',
                    //     product: 'D',
                    //     price: data.PE_SELL?.ltp,
                    // },
                ],
            },
        };
        console.log(config);

        const response = await axios(config);
        console.log(response);
        return response;

        // let last_price = 0;
        // for (const key in response.data.data) {
        //     if (Object.prototype.hasOwnProperty.call(response.data.data, key)) {
        //         last_price = response.data.data[key].last_price;
        //         break;
        //     }
        // }
        // return response;
    } catch (error) {
        console.log(error.message);

        throw new AppError(error.message, ERRORTYPES.UNKNOWN_ERROR);
    }
};
export const Place_order_api = async (data) => {
    try {
        const user = await db[MODEL.USER].findOne({
            where: { email: USER_DETAILS.EMAIL },
        });
        const accessToken = user.token;
        const config = {
            method: 'post',
            url: 'https://api-v2.upstox.com/order/place',
            maxBodyLength: Infinity,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            data: {
                quantity: data.qty,
                product: 'D',
                validity: 'DAY',
                price: 0,
                tag: 'string',
                instrument_token: data?.instrument_key,
                order_type: 'MARKET',
                transaction_type: data?.transaction_type,
                disclosed_quantity: 0,
                trigger_price: 0,
                is_amo: false,
            },
        };
        const response = await axios(config);
        return response?.data;

        // let last_price = 0;
        // for (const key in response.data.data) {
        //     if (Object.prototype.hasOwnProperty.call(response.data.data, key)) {
        //         last_price = response.data.data[key].last_price;
        //         break;
        //     }
        // }
        // return response;
    } catch (error) {
        throw new AppError(error.message, ERRORTYPES.UNKNOWN_ERROR);
    }
};
