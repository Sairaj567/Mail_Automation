function createMockReq(overrides = {}) {
  return {
    body: {},
    headers: {},
    params: {},
    query: {},
    files: undefined,
    session: { user: {} },
    protocol: 'http',
    get: (header) => {
      if (header && header.toLowerCase() === 'host') {
        return 'localhost:3345';
      }
      return '';
    },
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    payload: undefined,
    viewName: undefined,
    viewData: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
    render(view, data) {
      this.viewName = view;
      this.viewData = data;
      return this;
    },
  };

  return res;
}

module.exports = {
  createMockReq,
  createMockRes,
};
