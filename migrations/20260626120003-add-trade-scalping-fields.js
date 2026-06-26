'use strict';

const TABLE = 'trade_details';

const newColumns = (Sequelize) => ({
    highest_ltp: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
    },
    charges: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
    },
    net_pl: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
    },
});

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable(TABLE);

        for (const [name, definition] of Object.entries(
            newColumns(Sequelize),
        )) {
            if (!table[name]) {
                await queryInterface.addColumn(TABLE, name, definition);
            }
        }
    },

    async down(queryInterface, Sequelize) {
        for (const name of Object.keys(newColumns(Sequelize))) {
            const table = await queryInterface.describeTable(TABLE);
            if (table[name]) {
                await queryInterface.removeColumn(TABLE, name);
            }
        }
    },
};
