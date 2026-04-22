module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/menus.js',
    'controllers/restaurants.js',
    'controllers/reservations.js',
    'models/Menu.js',
    'models/Restaurant.js',
    'models/Reservation.js',
  ],
};
