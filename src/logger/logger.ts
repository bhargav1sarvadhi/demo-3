import { createLogger, format, transports } from 'winston';
import { DATE_FORMATE } from '../constant/index';

export const logger = createLogger({
    transports: [
        new transports.Console({
            level: 'info',
            format: format.combine(
                format.colorize(),
                format.timestamp({
                    format: DATE_FORMATE.TWELVE_HOURS,
                }),
                format.printf(
                    (info: {
                        timestamp: string;
                        level: string;
                        message: string;
                    }) => `${info.timestamp} ${info.level} => ${info.message}`,
                ),
            ),
        }),
    ],
});
