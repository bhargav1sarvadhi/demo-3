'use strict';

const TABLE = 'strategy_daily_stats';

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
    },
    trade_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
    },
    trades_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    wins_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    losses_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    consecutive_losses: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    daily_pl: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
    },
    daily_pl_after_charges: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
    },
    is_trading_halted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
    },
    cooldown_until: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    last_trade_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
            await queryInterface.addIndex(TABLE, {
                fields: ['strategy_name', 'trade_date'],
                unique: true,
                name: 'strategy_daily_stats_strategy_date_unique',
            });
        } else {
            const table = await queryInterface.describeTable(TABLE);
            const defs = columns(Sequelize);
            for (const [name, definition] of Object.entries(defs)) {
                if (!table[name]) {
                    await queryInterface.addColumn(TABLE, name, definition);
                }
            }
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable(TABLE);
    },
};
