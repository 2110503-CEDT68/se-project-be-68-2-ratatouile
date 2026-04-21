module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/menuItems.js',
    'controllers/restaurants.js',
    'controllers/reservations.js',
    'models/MenuItem.js',
    'models/Restaurant.js',
    'models/Reservation.js',
  ],
};
