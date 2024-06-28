import { DataTypes } from 'sequelize';

export const instrumentsModel = (sequelize) => {
    const instrumentsModel = sequelize.define(
        'instruments',
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
            exchange_token: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            tradingsymbol: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            last_price: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            expiry: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            strike: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            tick_size: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            lot_size: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            instrument_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            option_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            exchange: {
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
                {
                    fields: ['instrument_type'],
                },
                {
                    fields: ['option_type'],
                },
            ],
        },
    );

    return instrumentsModel;
};
