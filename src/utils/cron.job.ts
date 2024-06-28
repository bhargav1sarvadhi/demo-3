import cron from 'node-cron';
import * as path from 'path';
import { logger } from '../logger/logger';
import { MODEL, ROLES } from '../constant';
import { db } from '../model';
import { Op } from 'sequelize';

cron.schedule(
    '0 0 * * *',
    async () => {
        try {
        } catch (error) {
            logger.error('Error in cron send request', error.message);
        }
    },
    {
        timezone: 'America/New_York',
    },
);

logger.info('Cron job started.');
