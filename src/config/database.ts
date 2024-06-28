import { Sequelize, Dialect } from 'sequelize';
import dotenv from 'dotenv';
import { logger } from '../logger/logger';
dotenv.config({ path: './.env' });

interface DBConfig {
    DB_NAME: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_HOST: string;
    DB_DIALECT: string;
}

const dbConfig: DBConfig = {
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_HOST: process.env.DB_HOST,
    DB_DIALECT: process.env.DB_DIALECT,
};

export const sequelize = new Sequelize(
    dbConfig.DB_NAME,
    dbConfig.DB_USER,
    dbConfig.DB_PASSWORD,
    {
        host: dbConfig.DB_HOST,
        dialect: dbConfig.DB_DIALECT as Dialect,
        port: Number(process.env.DB_PORT),
        logging: false,
    },
);

(async () => {
    try {
        await sequelize.authenticate();
        logger.info('👍 Connection has been established successfully.');
    } catch (error) {
        logger.error(`👎🏼 Unable to connect to the database: ${error}`);
    }
})();
