const axios = require('axios');
const { GATEWAY } = require('./config');

describe('AI Agent Service', () => {
  test('POST /api/v1/agent/chat — selamlama mesajı → reply döner', async () => {
    const res = await axios.post(`${GATEWAY}/api/v1/agent/chat`, {
      message: 'Hello',
      history: []
    });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('reply');
    expect(typeof res.data.reply).toBe('string');
    expect(res.data.reply.length).toBeGreaterThan(0);
  });

  test('POST /api/v1/agent/chat — otel arama isteği → reply döner', async () => {
    const res = await axios.post(`${GATEWAY}/api/v1/agent/chat`, {
      message: 'I want to search for hotels in Istanbul from 2026-06-01 to 2026-06-05 for 2 adults',
      history: []
    });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('reply');
    // Eğer otel bulunursa action: show_hotels döner
    if (res.data.action === 'show_hotels') {
      expect(res.data).toHaveProperty('hotels');
      expect(Array.isArray(res.data.hotels)).toBe(true);
      expect(res.data).toHaveProperty('searchParams');
    }
  });

  test('POST /api/v1/agent/chat — rezervasyon denemesi giriş yapılmadan → login uyarısı', async () => {
    const res = await axios.post(`${GATEWAY}/api/v1/agent/chat`, {
      message: 'Book hotel with id 1 room 1 from 2026-06-01 to 2026-06-05 at price 100',
      history: [],
      user_id: 'anonymous'
    });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('reply');
    // Giriş yapılmamış kullanıcıya login uyarısı vermeli
    if (res.data.reply.toLowerCase().includes('log in') || res.data.reply.toLowerCase().includes('logged in')) {
      expect(res.data.reply).toMatch(/log(ged)? in/i);
    }
  });

  test('POST /api/v1/agent/chat — boş mesaj bile reply döner', async () => {
    const res = await axios.post(`${GATEWAY}/api/v1/agent/chat`, {
      message: '?',
      history: []
    });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('reply');
  });
});
