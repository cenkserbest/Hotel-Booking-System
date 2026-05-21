const axios = require('axios');
const { GATEWAY } = require('./config');

describe('Comments Service — Get Comments', () => {
  test('GET /api/v1/comments/hotel/1 → 200, correct structure', async () => {
    const res = await axios.get(`${GATEWAY}/api/v1/comments/hotel/1`);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('comments');
    expect(res.data).toHaveProperty('pagination');
    expect(Array.isArray(res.data.comments)).toBe(true);
    expect(res.data.pagination).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  test('GET /api/v1/comments/hotel/1 — graphData null veya obje', async () => {
    const res = await axios.get(`${GATEWAY}/api/v1/comments/hotel/1`);
    const { graphData } = res.data;
    if (graphData !== null) {
      expect(graphData).toHaveProperty('overall');
      expect(graphData).toHaveProperty('temizlik');
      expect(graphData).toHaveProperty('personelVeServis');
      expect(graphData).toHaveProperty('imkanVeOzellikler');
      expect(graphData).toHaveProperty('konaklamaYerininDurumu');
      expect(graphData).toHaveProperty('cevreDostlugu');
      expect(graphData).toHaveProperty('totalCount');
    }
  });

  test('GET /api/v1/comments/hotel/1 — pagination limit çalışıyor', async () => {
    const res = await axios.get(`${GATEWAY}/api/v1/comments/hotel/1`, {
      params: { page: 1, limit: 3 }
    });
    expect(res.status).toBe(200);
    expect(res.data.pagination.limit).toBe(3);
    expect(res.data.comments.length).toBeLessThanOrEqual(3);
  });

  test('GET /api/v1/comments/hotel/99999 → boş liste', async () => {
    const res = await axios.get(`${GATEWAY}/api/v1/comments/hotel/99999`);
    expect(res.status).toBe(200);
    expect(res.data.comments).toHaveLength(0);
    expect(res.data.graphData).toBeNull();
  });
});

describe('Comments Service — Add Comment (Auth Required)', () => {
  test('POST /api/v1/comments/add without token → 401', async () => {
    try {
      await axios.post(`${GATEWAY}/api/v1/comments/add`, {
        hotelId: 1,
        userName: 'Test',
        commentText: 'Great hotel!',
        ratings: { temizlik: 9, personelVeServis: 8, imkanVeOzellikler: 7, konaklamaYerininDurumu: 8, cevreDostlugu: 6 }
      });
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });
});
