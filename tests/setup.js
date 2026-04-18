process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jest-test-secret';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';
process.env.JWT_COOKIE_EXPIRE = process.env.JWT_COOKIE_EXPIRE || '30';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
