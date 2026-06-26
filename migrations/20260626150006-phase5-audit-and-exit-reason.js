'use strict';

const AUDIT_TABLE = 'decision_audit_log';
const TRADE_TABLE = 'trade_details';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        const hasAudit = tables.includes(AUDIT_TABLE);

        if (!hasAudit) {
            await queryInterface.createTable(AUDIT_TABLE, {
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
            timestamp: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            instrument_key: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            ema9: { type: Sequelize.FLOAT, allowNull: true },
            ema21: { type: Sequelize.FLOAT, allowNull: true },
            rsi: { type: Sequelize.FLOAT, allowNull: true },
            atr: { type: Sequelize.FLOAT, allowNull: true },
            volume: { type: Sequelize.FLOAT, allowNull: true },
            avg_volume: { type: Sequelize.FLOAT, allowNull: true },
            signal: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            action: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            reason: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            engine_state: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            mode: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            backtest_run_id: {
                type: Sequelize.UUID,
                allowNull: true,
            },
            trade_id: {
                type: Sequelize.UUID,
                allowNull: true,
            },
            config_snapshot: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
            metadata: {
                type: Sequelize.JSONB,
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
        }

        const indexes = await queryInterface.showIndex(AUDIT_TABLE).catch(() => []);
        const indexNames = indexes.map((i) => i.name);
        if (!indexNames.some((n) => n.includes('strategy_name'))) {
            await queryInterface.addIndex(AUDIT_TABLE, [
                'strategy_name',
                'timestamp',
            ]);
        }
        if (!indexNames.some((n) => n.includes('backtest_run'))) {
            await queryInterface.addIndex(AUDIT_TABLE, ['backtest_run_id']);
        }
        if (!indexNames.some((n) => n.includes('action'))) {
            await queryInterface.addIndex(AUDIT_TABLE, ['action', 'reason']);
        }

        const tradeCols = await queryInterface.describeTable(TRADE_TABLE);
        if (!tradeCols.exit_reason) {
            await queryInterface.addColumn(TRADE_TABLE, 'exit_reason', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable(AUDIT_TABLE);
        const tradeCols = await queryInterface.describeTable(TRADE_TABLE);
        if (tradeCols.exit_reason) {
            await queryInterface.removeColumn(TRADE_TABLE, 'exit_reason');
        }
    },
};
