const axios = require('axios');
const { GATEWAY } = require('./config');

describe('API Gateway', () => {
  test('GET /health → 200 OK', async () => {
    const res = await axios.get(`${GATEWAY}/health`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('OK');
    expect(res.data.service).toBe('API Gateway');
  });

  test('Unknown route → 404', async () => {
    try {
      await axios.get(`${GATEWAY}/api/v1/nonexistent`);
    } catch (err) {
      expect(err.response.status).toBe(404);
    }
  });

  test('Protected route without token → 401', async () => {
    try {
      await axios.post(`${GATEWAY}/api/v1/hotels/book`, {});
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });

  test('Admin route without token → 401', async () => {
    try {
      await axios.get(`${GATEWAY}/api/v1/admin/hotels`);
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });
});
