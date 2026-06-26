'use strict';

const CONFIG_TABLE = 'strategy_config';
const STRIKE_TABLE = 'strike_price_details';

const configColumns = (Sequelize) => ({
    underlying_name: {
        type: Sequelize.STRING,
        defaultValue: 'STATE BANK OF INDIA',
    },
    underlying_instrument_key: {
        type: Sequelize.STRING,
        defaultValue: 'NSE_EQ|INE062A01020',
    },
    strike_step: {
        type: Sequelize.FLOAT,
        defaultValue: 10,
    },
    atm_itm_steps: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    max_spread_pct: {
        type: Sequelize.FLOAT,
        defaultValue: 0.02,
    },
    min_open_interest: {
        type: Sequelize.FLOAT,
        defaultValue: 10000,
    },
    expiry_day_cutoff_time: {
        type: Sequelize.STRING,
        defaultValue: '14:00',
    },
    enable_dynamic_atm: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
    },
    enable_liquidity_check: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
    },
    enable_expiry_rules: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
    },
});

const strikeColumns = (Sequelize) => ({
    bid_price: {
        type: Sequelize.FLOAT,
        allowNull: true,
    },
    ask_price: {
        type: Sequelize.FLOAT,
        allowNull: true,
    },
    open_interest: {
        type: Sequelize.FLOAT,
        allowNull: true,
    },
    spread_pct: {
        type: Sequelize.FLOAT,
        allowNull: true,
    },
});

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const configTable = await queryInterface.describeTable(CONFIG_TABLE);
        for (const [name, definition] of Object.entries(
            configColumns(Sequelize),
        )) {
            if (!configTable[name]) {
                await queryInterface.addColumn(CONFIG_TABLE, name, definition);
            }
        }

        const strikeTable = await queryInterface.describeTable(STRIKE_TABLE);
        for (const [name, definition] of Object.entries(
            strikeColumns(Sequelize),
        )) {
            if (!strikeTable[name]) {
                await queryInterface.addColumn(STRIKE_TABLE, name, definition);
            }
        }
    },

    async down(queryInterface, Sequelize) {
        for (const name of Object.keys(configColumns(Sequelize))) {
            const configTable = await queryInterface.describeTable(CONFIG_TABLE);
            if (configTable[name]) {
                await queryInterface.removeColumn(CONFIG_TABLE, name);
            }
        }
        for (const name of Object.keys(strikeColumns(Sequelize))) {
            const strikeTable = await queryInterface.describeTable(STRIKE_TABLE);
            if (strikeTable[name]) {
                await queryInterface.removeColumn(STRIKE_TABLE, name);
            }
        }
    },
};
