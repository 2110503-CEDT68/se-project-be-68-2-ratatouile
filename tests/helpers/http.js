const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
  };

  res.status = jest.fn().mockImplementation((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn().mockImplementation((payload) => {
    res.body = payload;
    return res;
  });

  return res;
};

module.exports = {
  createMockResponse,
};
