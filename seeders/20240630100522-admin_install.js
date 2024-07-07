'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        return queryInterface.bulkInsert(
            'user_details',
            [
                {
                    id: '5104c9d9-abe1-4a2c-9d4b-a37e5262eb1c',
                    name: 'Bhargav Makwana',
                    email: 'bhargav9183@gmail.com',
                    password: 'BHARGAV@@@##1234',
                    phone: '9978863413',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null,
                },
            ],
            {},
        );
    },

    async down(queryInterface, Sequelize) {
        /**
         * Add commands to revert seed here.
         *
         * Example:
         * await queryInterface.bulkDelete('People', null, {});
         */
    },
};
