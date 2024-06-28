import { MODEL } from '../constant';
import { db } from '../model';
import moment from 'moment';
import { Op } from 'sequelize';

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
