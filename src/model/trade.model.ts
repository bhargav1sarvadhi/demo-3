import { DataTypes } from 'sequelize';

export const tradeModel = (sequelize) => {
    const tradeModel = sequelize.define(
        'trade_details',
        {
            id: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            position_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            trade_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            upstock_order_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            strategy_name: {
                type: DataTypes.STRING,
            },
            trading_symbol: {
                type: DataTypes.STRING,
            },
            options_chain_id: {
                type: DataTypes.UUID,
            },
            instrument_key: {
                type: DataTypes.STRING,
            },
            instrument_type: {
                type: DataTypes.STRING,
            },
            trade_type: {
                type: DataTypes.STRING,
            },
            buy_price: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            sell_price: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            stop_loss: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            pl: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            ltp: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            qty: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            lot_size: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
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

    tradeModel.associate = (models) => {
        tradeModel.belongsTo(models.positionModel, {
            foreignKey: 'position_id',
        });
        tradeModel.belongsTo(models.OptionchainModel, {
            foreignKey: 'options_chain_id',
        });
    };

    return tradeModel;
};
