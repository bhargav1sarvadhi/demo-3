import { DataTypes } from 'sequelize';

export const userModel = (sequelize) => {
    const userModel = sequelize.define(
        'user_details',
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
            password: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            token: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            email: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            phone: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            balance: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            is_live: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
        },
        {
            paranoid: true,
        },
    );

    return userModel;
};
