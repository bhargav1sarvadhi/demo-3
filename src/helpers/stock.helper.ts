import { AppError } from '../utils';
import { ERRORTYPES, MODEL, USER_DETAILS } from '../constant';
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
