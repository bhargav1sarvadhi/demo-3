'use strict';

const { randomUUID } = require('crypto');

const TABLE = 'strategy_config';

const columns = (Sequelize) => ({
    id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
    },
    strategy_name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
    },
    market_start_time: {
        type: Sequelize.STRING,
        defaultValue: '09:15',
    },
    entry_start_time: {
        type: Sequelize.STRING,
        defaultValue: '09:45',
    },
    entry_cutoff_time: {
        type: Sequelize.STRING,
        defaultValue: '15:00',
    },
    force_exit_time: {
        type: Sequelize.STRING,
        defaultValue: '15:15',
    },
    market_end_time: {
        type: Sequelize.STRING,
        defaultValue: '15:19',
    },
    risk_per_trade_pct: {
        type: Sequelize.FLOAT,
        defaultValue: 0.01,
    },
    max_lots_per_trade: {
        type: Sequelize.INTEGER,
        defaultValue: 2,
    },
    max_trades_per_day: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
    },
    max_daily_loss: {
        type: Sequelize.FLOAT,
        defaultValue: 5000,
    },
    max_loss_per_trade: {
        type: Sequelize.FLOAT,
        defaultValue: 3000,
    },
    max_consecutive_losses: {
        type: Sequelize.INTEGER,
        defaultValue: 2,
    },
    cooldown_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 30,
    },
    trailing_breakeven_at: {
        type: Sequelize.FLOAT,
        defaultValue: 2,
    },
    trailing_atr_multiplier: {
        type: Sequelize.FLOAT,
        defaultValue: 1.5,
    },
    brokerage_per_lot: {
        type: Sequelize.FLOAT,
        defaultValue: 40,
    },
    slippage_pct: {
        type: Sequelize.FLOAT,
        defaultValue: 0.002,
    },
    paper_balance: {
        type: Sequelize.FLOAT,
        defaultValue: 100000,
    },
    mode: {
        type: Sequelize.STRING,
        defaultValue: 'paper',
    },
    is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
    },
    ema_fast: {
        type: Sequelize.INTEGER,
        defaultValue: 9,
    },
    ema_slow: {
        type: Sequelize.INTEGER,
        defaultValue: 21,
    },
    rsi_period: {
        type: Sequelize.INTEGER,
        defaultValue: 14,
    },
    rsi_ce_max: {
        type: Sequelize.FLOAT,
        defaultValue: 70,
    },
    rsi_pe_min: {
        type: Sequelize.FLOAT,
        defaultValue: 30,
    },
    atr_stop_multiplier: {
        type: Sequelize.FLOAT,
        defaultValue: 1.5,
    },
    atr_target_multiplier: {
        type: Sequelize.FLOAT,
        defaultValue: 2.5,
    },
    min_rr_ratio: {
        type: Sequelize.FLOAT,
        defaultValue: 1.5,
    },
    volume_lookback: {
        type: Sequelize.INTEGER,
        defaultValue: 10,
    },
    trend_ema_period: {
        type: Sequelize.INTEGER,
        defaultValue: 21,
    },
    min_candles_1m: {
        type: Sequelize.INTEGER,
        defaultValue: 22,
    },
    createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
});

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        const tableNames = tables.map((t) =>
            typeof t === 'string' ? t : t.tableName || t,
        );

        if (!tableNames.includes(TABLE)) {
            await queryInterface.createTable(TABLE, columns(Sequelize));
        } else {
            const table = await queryInterface.describeTable(TABLE);
            const defs = columns(Sequelize);
            for (const [name, definition] of Object.entries(defs)) {
                if (!table[name]) {
                    await queryInterface.addColumn(TABLE, name, definition);
                }
            }
        }

        const [rows] = await queryInterface.sequelize.query(
            `SELECT id FROM "${TABLE}" WHERE strategy_name = 'SCALLPING' LIMIT 1`,
        );
        if (!rows.length) {
            const now = new Date();
            await queryInterface.bulkInsert(TABLE, [
                {
                    id: randomUUID(),
                    strategy_name: 'SCALLPING',
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null,
                },
            ]);
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable(TABLE);
    },
};
