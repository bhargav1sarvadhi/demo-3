import { DataTypes } from 'sequelize';

export const tradeUpdateModel = (sequelize) => {
    const tradeUpdateModel = sequelize.define(
        'trade_update_details',
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
                type: DataTypes.UUID,
                allowNull: true,
            },
            trade_old_sl: {
                type: DataTypes.FLOAT,
            },
            trade_new_sl: {
                type: DataTypes.FLOAT,
            },
            trade_old_tg: {
                type: DataTypes.FLOAT,
            },
            trade_new_tg: {
                type: DataTypes.FLOAT,
            },
            old_json: {
                type: DataTypes.JSON,
            },
            new_json: {
                type: DataTypes.JSON,
            },
        },
        {
            paranoid: true,
        },
    );

    return tradeUpdateModel;
};
