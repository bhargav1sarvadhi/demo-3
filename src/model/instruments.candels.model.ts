import { DataTypes } from 'sequelize';

export const candelsModel = (sequelize) => {
    const candelsModel = sequelize.define(
        'candels',
        {
            id: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            instrument_key: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            interval: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            open: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            high: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            low: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            close: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            volume: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ts: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            paranoid: true,
            indexes: [
                {
                    fields: ['instrument_key'],
                },
            ],
        },
    );

    return candelsModel;
};
