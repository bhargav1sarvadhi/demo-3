import { db } from '../model';
import { ERRORTYPES, INDEXES_NAMES, MODEL } from '../constant';
import { AppError } from '../utils';
import { get_current_day_name, get_upcoming_expiry_date } from '../helpers';
import { logger } from '../logger/logger';
import { Op } from 'sequelize';

class StrategyController {
    async percentage_strategy() {
        try {
            console.log('Percentage strategy calling');
            const currnet_day = get_current_day_name();
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
                const hedging_conditions = await db[MODEL.HEDGING_TIME].findOne(
                    {
                        where: {
                            index_name: INDEXES_NAMES.MIDCAP,
                            day: currnet_day,
                        },
                    },
                );
                if (totalStrikePrice > hedging_conditions?.market_premium) {
                    let PE_SELL: { [key: string]: any } = {};
                    let PE: { [key: string]: any } = {};
                    const CE_SELL = await db[MODEL.HEDGING_OPTIONS].findOne({
                        where: {
                            name: INDEXES_NAMES.MIDCAP,
                            expiry: '2024-07-08',
                            instrument_type: 'CE',
                            ltp: {
                                [Op.between]: [
                                    hedging_conditions?.premium_start,
                                    hedging_conditions?.premium_end,
                                ],
                            },
                        },
                        order: [
                            ['ltp', 'ASC'],
                            ['strike_price', 'ASC'],
                        ],
                    });
                    if (CE_SELL && PE) {
                        PE_SELL = await db[MODEL.HEDGING_OPTIONS].findOne({
                            where: {
                                name: INDEXES_NAMES.MIDCAP,
                                expiry: '2024-07-08',
                                instrument_type: 'PE',
                                ltp: {
                                    [Op.between]: [
                                        CE_SELL?.ltp,
                                        hedging_conditions?.premium_end,
                                    ],
                                },
                            },
                            order: [
                                ['ltp', 'ASC'],
                                ['strike_price', 'DESC'],
                            ],
                        });
                        PE = await db[MODEL.HEDGING_OPTIONS].findOne({
                            where: {
                                name: INDEXES_NAMES.MIDCAP,
                                expiry: '2024-07-08',
                                instrument_type: 'PE',
                                ltp: {
                                    [Op.between]: [
                                        PE_SELL?.ltp / 10,
                                        hedging_conditions?.premium_end,
                                    ],
                                },
                            },
                            order: [
                                ['ltp', 'ASC'],
                                ['strike_price', 'DESC'],
                            ],
                        });
                    }
                    const CE = await db[MODEL.HEDGING_OPTIONS].findOne({
                        where: {
                            name: INDEXES_NAMES.MIDCAP,
                            expiry: '2024-07-08',
                            instrument_type: 'CE',
                            ltp: {
                                [Op.between]: [
                                    CE_SELL?.ltp / 10,
                                    hedging_conditions?.premium_end / 10,
                                ],
                            },
                        },
                        order: [
                            ['ltp', 'ASC'],
                            ['strike_price', 'ASC'],
                        ],
                    });

                    console.log(CE_SELL?.id);
                    console.log(PE_SELL?.id);
                    console.log(CE?.id);
                    console.log(PE?.id);

                    if (CE_SELL && PE_SELL && CE && PE) {
                        console.log('arrived all');
                    }
                }
            } else {
                logger.error('Today is holiday');
            }
            // const hedging_condtions = await db[MODEL.HEDGING_TIME].findAll({});
        } catch (error) {
            throw new AppError(error.message, ERRORTYPES.UNKNOWN_ERROR);
        }
    }
}

export const strategyController = new StrategyController();
