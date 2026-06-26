'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const [tables] = await queryInterface.sequelize.query(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename = 'strategy_configs'
        `);
        if (tables.length === 0) return;

        await queryInterface.sequelize.query('DROP TABLE IF EXISTS strategy_configs CASCADE');
    },

    async down() {
        // Duplicate table created by Sequelize sync; not recreated on rollback.
    },
};
