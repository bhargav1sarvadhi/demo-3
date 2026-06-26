'use strict';

const TRADE_TABLE = 'trade_details';
const CONFIG_TABLE = 'strategy_config';

const tradeColumns = (Sequelize) => ({
    partial_exit_done: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
    },
    original_qty: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
    },
});

const configColumns = (Sequelize) => ({
    partial_target_pct: {
        type: Sequelize.FLOAT,
        defaultValue: 0.5,
    },
    partial_target_extension: {
        type: Sequelize.FLOAT,
        defaultValue: 1.2,
    },
    time_exit_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 30,
    },
    time_exit_min_pl: {
        type: Sequelize.FLOAT,
        defaultValue: -500,
    },
    time_exit_max_pl: {
        type: Sequelize.FLOAT,
        defaultValue: 500,
    },
    enable_partial_exit: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
    },
    enable_ema_reversal_exit: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
    },
    enable_time_exit: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
    },
});

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tradeTable = await queryInterface.describeTable(TRADE_TABLE);
        for (const [name, definition] of Object.entries(
            tradeColumns(Sequelize),
        )) {
            if (!tradeTable[name]) {
                await queryInterface.addColumn(TRADE_TABLE, name, definition);
            }
        }

        const configTable = await queryInterface.describeTable(CONFIG_TABLE);
        for (const [name, definition] of Object.entries(
            configColumns(Sequelize),
        )) {
            if (!configTable[name]) {
                await queryInterface.addColumn(CONFIG_TABLE, name, definition);
            }
        }
    },

    async down(queryInterface, Sequelize) {
        for (const name of Object.keys(tradeColumns(Sequelize))) {
            const tradeTable = await queryInterface.describeTable(TRADE_TABLE);
            if (tradeTable[name]) {
                await queryInterface.removeColumn(TRADE_TABLE, name);
            }
        }

        for (const name of Object.keys(configColumns(Sequelize))) {
            const configTable = await queryInterface.describeTable(CONFIG_TABLE);
            if (configTable[name]) {
                await queryInterface.removeColumn(CONFIG_TABLE, name);
            }
        }
    },
};
