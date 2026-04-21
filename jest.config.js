module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/restaurants.js',
    'controllers/reservations.js',
    'models/Restaurant.js',
    'models/Reservation.js',
  ],
};
