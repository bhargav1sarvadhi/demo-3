import { DataTypes } from 'sequelize';

export const UpstocksOrderModel = (sequelize) => {
    const UpstocksOrderModel = sequelize.define(
        'upstock_order_details',
        {
            id: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            postion_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            upstock_order_id: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            status: {
                type: DataTypes.TEXT,
                defaultValue: 'Pending',
                commet: 'Pending , Success , Failed',
            },
        },
        {
            paranoid: true,
        },
    );
    return UpstocksOrderModel;
};
