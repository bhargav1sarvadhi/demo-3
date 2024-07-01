import { DataTypes } from 'sequelize';

export const strikePriceModel = (sequelize) => {
    const strikePriceModel = sequelize.define(
        'strike_price_details',
        {
            id: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            segment: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            exchange: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            expiry: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },
            weekly: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
            },
            instrument_key: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            exchange_token: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            trading_symbol: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            tick_size: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            lot_size: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            instrument_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            freeze_quantity: {
                type: DataTypes.FLOAT,
                allowNull: true,
            },
            underlying_key: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            underlying_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            underlying_symbol: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            strike_price: {
                type: DataTypes.FLOAT,
                allowNull: true,
            },
            ltp: {
                type: DataTypes.FLOAT,
                allowNull: true,
                defaultValue: 0,
            },
            minimum_lot: {
                type: DataTypes.INTEGER,
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
                    fields: ['expiry'],
                },
            ],
        },
    );

    return strikePriceModel;
};
