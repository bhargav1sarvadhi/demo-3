import { DataTypes } from 'sequelize';

export const strategyDailyStatsModel = (sequelize) => {
    const strategyDailyStatsModel = sequelize.define(
        'strategy_daily_stats',
        {
            id: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            strategy_name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            trade_date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            trades_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            wins_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            losses_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            consecutive_losses: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            daily_pl: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            daily_pl_after_charges: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            is_trading_halted: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            cooldown_until: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            last_trade_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            paranoid: true,
            freezeTableName: true,
            indexes: [
                {
                    unique: true,
                    fields: ['strategy_name', 'trade_date'],
                },
            ],
        },
    );

    return strategyDailyStatsModel;
};
