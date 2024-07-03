import { DataTypes } from 'sequelize';

export const hedgingTimeModel = (sequelize) => {
    const hedgingTimeModel = sequelize.define(
        'hedgingtime_details',
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
            index_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            day: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            premium_start: {
                type: DataTypes.FLOAT,
                allowNull: true,
            },
            premium_end: {
                type: DataTypes.FLOAT,
                allowNull: true,
            },
            required_margin: {
                type: DataTypes.FLOAT,
                allowNull: true,
            },
            market_premium: {
                type: DataTypes.FLOAT,
                allowNull: true,
            },
        },
        {
            paranoid: true,
            indexes: [
                {
                    fields: ['index_name'],
                },
            ],
        },
    );

    return hedgingTimeModel;
};
