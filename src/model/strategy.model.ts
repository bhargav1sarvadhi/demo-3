import { DataTypes } from 'sequelize';

export const strategyModel = (sequelize) => {
    const strategyModel = sequelize.define(
        'strategy_details',
        {
            id: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            strategy_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            strategy_balance: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
        },
        {
            paranoid: true,
        },
    );

    return strategyModel;
};
