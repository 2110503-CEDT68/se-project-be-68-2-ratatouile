const mongoose = require('mongoose');

let userCounter = 0;

const buildUserPayload = (overrides = {}) => {
  userCounter += 1;

  return {
    name: `Test User ${userCounter}`,
    email: `user${userCounter}@example.com`,
    telephone: `0800000${String(userCounter).padStart(3, '0')}`,
    password: '123456',
    role: 'user',
    _id: new mongoose.Types.ObjectId(),
    ...overrides,
  };
};

const createUser = (overrides = {}) => {
  const payload = buildUserPayload(overrides);

  return {
    ...payload,
    id: String(payload._id),
    getSignedJwtToken() {
      const jwt = require('jsonwebtoken');

      return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
      });
    },
  };
};

const authHeader = (user) => ({
  Authorization: `Bearer ${user.getSignedJwtToken()}`,
});

module.exports = {
  createUser,
  authHeader,
};
