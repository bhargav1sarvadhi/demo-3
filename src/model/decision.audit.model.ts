import { DataTypes } from 'sequelize';

export const decisionAuditModel = (sequelize) => {
    const decisionAuditModel = sequelize.define(
        'decision_audit_log',
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
            timestamp: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            instrument_key: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ema9: { type: DataTypes.FLOAT, allowNull: true },
            ema21: { type: DataTypes.FLOAT, allowNull: true },
            rsi: { type: DataTypes.FLOAT, allowNull: true },
            atr: { type: DataTypes.FLOAT, allowNull: true },
            volume: { type: DataTypes.FLOAT, allowNull: true },
            avg_volume: { type: DataTypes.FLOAT, allowNull: true },
            signal: { type: DataTypes.STRING, allowNull: true },
            action: { type: DataTypes.STRING, allowNull: false },
            reason: { type: DataTypes.STRING, allowNull: true },
            engine_state: { type: DataTypes.STRING, allowNull: true },
            mode: { type: DataTypes.STRING, allowNull: true },
            backtest_run_id: { type: DataTypes.UUID, allowNull: true },
            trade_id: { type: DataTypes.UUID, allowNull: true },
            config_snapshot: { type: DataTypes.JSONB, allowNull: true },
            metadata: { type: DataTypes.JSONB, allowNull: true },
        },
        {
            paranoid: true,
            freezeTableName: true,
            indexes: [
                { fields: ['strategy_name', 'timestamp'] },
                { fields: ['backtest_run_id'] },
                { fields: ['action', 'reason'] },
            ],
        },
    );

    return decisionAuditModel;
};
