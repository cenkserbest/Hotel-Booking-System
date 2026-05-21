const axios = require('axios');
const { GATEWAY } = require('./config');

const SEARCH_PARAMS = {
  city: 'Istanbul',
  startDate: '2026-06-01',
  endDate: '2026-06-05',
  adults: 2
};

describe('Hotel Service — Search', () => {
  test('GET /api/v1/hotels/search → 200, paginated response', async () => {
    const res = await axios.get(`${GATEWAY}/api/v1/hotels/search`, { params: SEARCH_PARAMS });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('data');
    expect(res.data).toHaveProperty('pagination');
    expect(Array.isArray(res.data.data)).toBe(true);
    expect(res.data.pagination).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  test('GET /api/v1/hotels/search — pagination params work', async () => {
    const res = await axios.get(`${GATEWAY}/api/v1/hotels/search`, {
      params: { ...SEARCH_PARAMS, page: 1, limit: 5 }
    });
    expect(res.status).toBe(200);
    expect(res.data.pagination.limit).toBe(5);
    expect(res.data.data.length).toBeLessThanOrEqual(5);
  });

  test('GET /api/v1/hotels/search — missing params → 400', async () => {
    try {
      await axios.get(`${GATEWAY}/api/v1/hotels/search`, { params: { city: 'Istanbul' } });
    } catch (err) {
      expect(err.response.status).toBe(400);
      expect(err.response.data).toHaveProperty('error');
    }
  });

  test('GET /api/v1/hotels/search — guest gets no discount flag', async () => {
    const res = await axios.get(`${GATEWAY}/api/v1/hotels/search`, { params: SEARCH_PARAMS });
    if (res.data.data.length > 0) {
      const room = res.data.data[0].rooms[0];
      expect(room.isDiscounted).toBe(false);
    }
  });
});

describe('Hotel Service — Details', () => {
  test('GET /api/v1/hotels/1 → 200 or 404', async () => {
    try {
      const res = await axios.get(`${GATEWAY}/api/v1/hotels/1`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('id');
      expect(res.data).toHaveProperty('name');
      expect(res.data).toHaveProperty('rooms');
    } catch (err) {
      expect(err.response.status).toBe(404);
    }
  });

  test('GET /api/v1/hotels/99999 → 404', async () => {
    try {
      await axios.get(`${GATEWAY}/api/v1/hotels/99999`);
    } catch (err) {
      expect(err.response.status).toBe(404);
    }
  });
});

describe('Hotel Service — Booking (Auth Required)', () => {
  test('POST /api/v1/hotels/book without token → 401', async () => {
    try {
      await axios.post(`${GATEWAY}/api/v1/hotels/book`, {
        hotelId: 1, roomId: 1, startDate: '2026-06-01', endDate: '2026-06-05', totalPrice: 400
      });
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });
});

describe('Hotel Service — Admin (Auth Required)', () => {
  test('GET /api/v1/admin/hotels without token → 401', async () => {
    try {
      await axios.get(`${GATEWAY}/api/v1/admin/hotels`);
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });

  test('POST /api/v1/admin/hotels without token → 401', async () => {
    try {
      await axios.post(`${GATEWAY}/api/v1/admin/hotels`, {});
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });

  test('POST /api/v1/admin/rooms/1/availability without token → 401', async () => {
    try {
      await axios.post(`${GATEWAY}/api/v1/admin/rooms/1/availability`, {});
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });
});
