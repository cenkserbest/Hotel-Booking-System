const jwt = require('jsonwebtoken');

// Sabitler
const BASE_URL = 'http://localhost:3000/api';
const SECRET_KEY = 'super-secret-key';
const TOKEN = jwt.sign({ id: 'automated-test-user', role: 'admin' }, SECRET_KEY, { expiresIn: '1h' });
const HEADERS_AUTH = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` };
const HEADERS_NO_AUTH = { 'Content-Type': 'application/json' };

// Yardımcı test fonksiyonu
async function runTest(testName, testFn) {
  try {
    process.stdout.write(`⏳ Testing: ${testName}... `);
    await testFn();
    console.log('✅ PASS');
  } catch (error) {
    console.log(`❌ FAIL`);
    console.error(`   Hata Detayı: ${error.message}`);
    process.exit(1);
  }
}

async function startAutomatedTests() {
  console.log('\n🚀 --- OTOMATİK E2E TEST SÜRECİ BAŞLIYOR --- 🚀\n');
  let hotelId, roomId;

  // 1. Otel ve Oda Yaratma
  await runTest('Otel ve Oda Yaratma (Admin)', async () => {
    const res = await fetch(`${BASE_URL}/admin/hotels`, {
      method: 'POST',
      headers: HEADERS_AUTH,
      body: JSON.stringify({
        name: "Automated Test Hotel",
        city: "TestCity",
        address: "123 Test Ave",
        latitude: 10.0,
        longitude: 20.0,
        stars: 5,
        amenities: ["Wi-Fi"],
        rooms: [{ roomType: "Suite", basePrice: 200, capacity: 4 }]
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Otel yaratılamadı: ${errText}`);
    }
    const data = await res.json();
    hotelId = data.id;
    roomId = data.rooms[0].id;
  });

  // 2. Kapasite (Availability) Ekleme
  await runTest('Gelecek Ay İçin Kapasite Ekleme', async () => {
    const res = await fetch(`${BASE_URL}/admin/rooms/${roomId}/availability`, {
      method: 'POST',
      headers: HEADERS_AUTH,
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        totalRooms: 5
      })
    });
    if (!res.ok) throw new Error('Kapasite eklenemedi');
  });

  // 3. Yetkisiz Arama (Normal Fiyat)
  await runTest('Yetkisiz Arama (İndirimsiz Fiyat Doğrulama)', async () => {
    const res = await fetch(`${BASE_URL}/hotels/search?city=TestCity&startDate=2026-06-01&endDate=2026-06-05&adults=2`, {
      headers: HEADERS_NO_AUTH
    });
    const data = await res.json();
    const room = data[0].rooms[0];
    if (room.isDiscounted !== false) throw new Error('İndirim hatalı şekilde uygulandı');
    if (room.basePrice !== 200) throw new Error(`Beklenen fiyat 200, alınan ${room.basePrice}`);
  });

  // 4. Yetkili Arama (%15 İndirim)
  await runTest('Yetkili Arama (%15 İndirim Doğrulama)', async () => {
    const res = await fetch(`${BASE_URL}/hotels/search?city=TestCity&startDate=2026-06-01&endDate=2026-06-05&adults=2`, {
      headers: HEADERS_AUTH
    });
    const data = await res.json();
    const room = data[0].rooms[0];
    if (room.isDiscounted !== true) throw new Error('İndirim bayrağı true gelmedi');
    if (room.basePrice !== 170) throw new Error(`Beklenen indirimli fiyat 170 (200 * 0.85), alınan ${room.basePrice}`);
  });

  // 5. Rezervasyon İşlemi
  await runTest('Oda Rezervasyonu Yapma', async () => {
    const res = await fetch(`${BASE_URL}/hotels/book`, {
      method: 'POST',
      headers: HEADERS_AUTH,
      body: JSON.stringify({
        hotelId: hotelId,
        roomId: roomId,
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        totalPrice: 680
      })
    });
    if (res.status !== 201) throw new Error('Rezervasyon oluşturulamadı');
  });

  // 6. Yorum Ekleme
  await runTest('NoSQL Yorum Ekleme ve Ortalama Hesaplaması', async () => {
    const res = await fetch(`${BASE_URL}/comments/add`, {
      method: 'POST',
      headers: HEADERS_AUTH,
      body: JSON.stringify({
        hotelId: hotelId,
        userName: "Automated User",
        commentText: "Test yorumudur.",
        ratings: {
          temizlik: 10, personelVeServis: 8, imkanVeOzellikler: 8, konaklamaYerininDurumu: 10, cevreDostlugu: 8
        }
      })
    });
    const data = await res.json();
    if (data.overallRating !== 8.8) throw new Error(`Ortalama 8.8 olmalıydı, alınan ${data.overallRating}`);
  });

  // 7. Graph Data Çekme
  await runTest('MongoDB Aggregation Graph Data Kontrolü', async () => {
    const res = await fetch(`${BASE_URL}/comments/hotel/${hotelId}`);
    const data = await res.json();
    if (data.graphData.totalCount !== 1) throw new Error('Toplam yorum sayısı hatalı');
    if (data.graphData.overall !== 8.8) throw new Error('Grafik overall rating hatalı hesaplanmış');
  });

  console.log('\n🎉 TÜM İŞ KURALLARI BAŞARIYLA DOĞRULANDI! SİSTEM %100 ÇALIŞIYOR 🎉\n');
}

startAutomatedTests();
