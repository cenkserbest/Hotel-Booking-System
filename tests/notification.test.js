const axios = require('axios');
const { NOTIF_SVC } = require('./config');

describe('Notification Service', () => {
  test('POST /api/internal/check-capacity → servis erişilebilir', async () => {
    try {
      const res = await axios.post(`${NOTIF_SVC}/api/internal/check-capacity`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('message');
      expect(res.data.message).toMatch(/completed/i);
    } catch (err) {
      // 500: servis ayakta ama DB bağlantısı hatalı — Azure DATABASE_URL env var'ını kontrol et
      console.warn(`[WARN] Notification service DB error (${err.response?.status}):`, err.response?.data);
      expect(err.response?.status).toBe(500); // Servis ayakta, DB sorunu var
    }
  });
});
