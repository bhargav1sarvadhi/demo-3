import { DataTypes } from 'sequelize';

export const positionModel = (sequelize) => {
    const positionModel = sequelize.define(
        'position_details',
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
            strategy_id: {
                type: DataTypes.UUID,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
            },
            trade_id: {
                type: DataTypes.INTEGER,
            },
            qty: {
                type: DataTypes.INTEGER,
            },
            pl: {
                type: DataTypes.FLOAT,
            },
            charges: {
                type: DataTypes.FLOAT,
            },
            date: {
                type: DataTypes.DATEONLY,
            },
            start_time: {
                type: DataTypes.DATE,
            },
            end_time: {
                type: DataTypes.DATE,
            },
        },
        {
            paranoid: true,
        },
    );

    return positionModel;
};
