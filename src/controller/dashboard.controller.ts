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
import { Op } from 'sequelize';
import moment from 'moment';

class DashboardController {
    async dashboard_api(req, res, next) {
        try {
            const {
                body: {
                    data: { start_date, end_date, strategy_name },
                },
            } = req;
            let apply_filter: { [key: string]: any } = {};
            const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
            const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');
            if (req.body.data) {
                if (start_date && end_date) {
                    apply_filter.date = {
                        [Op.between]: [
                            moment(start_date).format('YYYY-MM-DD'),
                            moment(end_date).format('YYYY-MM-DD'),
                        ],
                    };
                } else {
                    apply_filter.date = {
                        [Op.between]: [startOfMonth, endOfMonth],
                    };
                }
                if (strategy_name) {
                    apply_filter.strategy_name = strategy_name;
                }
            }
            const postions = await db[MODEL.POSITION].findAll({
                include: [
                    {
                        model: db[MODEL.TRADE],
                    },
                ],
                where: {
                    ...apply_filter,
                },
                order: [['date', 'DESC']],
            });

            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: postions,
                message: res.__('dashboard').insert,
            });
        } catch (error) {
            return next(error);
        }
    }

    async strategy_list(req, res, next) {
        try {
            const strategies = await db[MODEL.STRATEGY].findAll({
                attributes: ['id', 'strategy_name'],
            });
            return sendResponse(res, {
                responseType: RES_STATUS.GET,
                data: strategies,
                message: res.__('dashboard').insert,
            });
        } catch (error) {
            return next(error);
        }
    }
}

export const dashboardController = new DashboardController();
