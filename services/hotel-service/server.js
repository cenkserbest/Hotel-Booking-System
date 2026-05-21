const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('redis');
const amqp = require('amqplib');

const app = express();
app.use(express.json());
app.use(cors());

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Redis Client setup
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', (err) => console.error('Redis Client Error', err));

// RabbitMQ Connection
let rabbitChannel;
async function connectRabbitMQ() {
  let retries = 5;
  while (retries > 0) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
      rabbitChannel = await conn.createChannel();
      await rabbitChannel.assertQueue('new_reservations_queue', { durable: true });
      console.log('Connected to RabbitMQ');
      break;
    } catch (err) {
      console.error(`RabbitMQ Connection Error, retries left: ${retries - 1}`, err.message);
      retries -= 1;
      if (retries === 0) {
        console.error('Could not connect to RabbitMQ.');
      } else {
        await new Promise(res => setTimeout(res, 5000)); // wait 5 seconds before retrying
      }
    }
  }
}

// Ensure connections
async function startServer() {
  await redisClient.connect();
  await connectRabbitMQ();
  
  app.listen(PORT, () => {
    console.log(`Hotel Service running on port ${PORT}`);
  });
}

// ----------------------------------------------------
// MIDDLEWARES
// ----------------------------------------------------
const extractUserId = (req, res, next) => {
  req.userId = req.headers['x-user-id'];
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin role required' });
  }
  next();
};

// ----------------------------------------------------
// 1. HOTEL SEARCH SERVICE
// ----------------------------------------------------
app.get('/api/hotels/search', extractUserId, async (req, res) => {
  try {
    const { city, startDate, endDate, adults, page = '1', limit = '10' } = req.query;

    if (!city || !startDate || !endDate || !adults) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const numAdults = parseInt(adults);
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    // Get hotels in city
    const hotels = await prisma.hotel.findMany({
      where: { city: city, isActive: true },
      include: {
        rooms: {
          where: { capacity: { gte: numAdults } },
          include: {
            availabilities: {
              where: {
                date: { gte: start, lt: end }
              }
            }
          }
        }
      }
    });

    // Filter rooms that have availability for ALL requested dates
    // Calculate required days
    const diffTime = Math.abs(end - start);
    const requiredDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const availableHotels = hotels.map(hotel => {
      const validRooms = hotel.rooms.filter(room => {
        const availableDays = room.availabilities.filter(a => (a.totalRooms - a.bookedRooms) > 0);
        return availableDays.length === requiredDays;
      });

      if (validRooms.length > 0) {
        const discountedRooms = validRooms.map(room => {
          let price = room.basePrice;
          if (req.userId) {
            price = price * 0.85;
          }
          return {
            ...room,
            basePrice: price,
            originalPrice: req.userId ? room.basePrice : undefined,
            isDiscounted: !!req.userId
          };
        });

        return { ...hotel, rooms: discountedRooms };
      }
      return null;
    }).filter(h => h !== null);

    const total = availableHotels.length;
    const totalPages = Math.ceil(total / limitNum);
    const paginatedHotels = availableHotels.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      data: paginatedHotels,
      pagination: { page: pageNum, limit: limitNum, total, totalPages }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// Cache Aside Pattern for Hotel Details
app.get('/api/hotels/:id', async (req, res) => {
  const hotelId = parseInt(req.params.id);
  const cacheKey = `hotel:${hotelId}:details`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      include: { rooms: true }
    });

    if (!hotel) return res.status(404).json({ error: "Hotel not found" });

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(hotel)); // Cache for 1 hour
    res.json(hotel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

// ----------------------------------------------------
// 2. BOOK HOTEL SERVICE
// ----------------------------------------------------
app.post('/api/hotels/book', extractUserId, async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const { hotelId, roomId, startDate, endDate, totalPrice } = req.body;
  const start = new Date(startDate);
  const end = new Date(endDate);

  try {
    // Transaction: Create booking and decrease capacity
    const result = await prisma.$transaction(async (tx) => {
      // Create booking
      const booking = await tx.booking.create({
        data: {
          hotelId: parseInt(hotelId),
          roomId: parseInt(roomId),
          userId: req.userId,
          startDate: start,
          endDate: end,
          totalPrice: parseFloat(totalPrice)
        }
      });

      // Update room availabilities for the date range
      const diffTime = Math.abs(end - start);
      const requiredDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      for (let i = 0; i < requiredDays; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(currentDate.getDate() + i);

        // This would throw if no record exists or if bookedRooms exceeds totalRooms
        await tx.roomAvailability.update({
          where: {
            roomId_date: {
              roomId: parseInt(roomId),
              date: currentDate
            }
          },
          data: {
            bookedRooms: { increment: 1 }
          }
        });
      }

      return booking;
    });

    // Publish to RabbitMQ
    if (rabbitChannel) {
      const msg = JSON.stringify({
        bookingId: result.id,
        userId: req.userId,
        hotelId: result.hotelId,
        message: "New booking created successfully."
      });
      rabbitChannel.sendToQueue('new_reservations_queue', Buffer.from(msg), { persistent: true });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Booking failed. Capacity might be full." });
  }
});

// ----------------------------------------------------
// 3. HOTEL ADMIN SERVICE
// ----------------------------------------------------

// List hotels with rooms (for admin dropdown)
app.get('/api/admin/hotels', extractUserId, requireAdmin, async (req, res) => {
  try {
    const hotels = await prisma.hotel.findMany({
      include: { rooms: true },
      orderBy: { name: 'asc' }
    });
    res.json(hotels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch hotels" });
  }
});

app.post('/api/admin/hotels', extractUserId, requireAdmin, async (req, res) => {
  try {
    const { name, city, address, latitude, longitude, stars, amenities, rooms } = req.body;
    const hotel = await prisma.hotel.create({
      data: { 
        name, city, address, latitude, longitude, stars, amenities,
        rooms: {
          create: rooms || []
        }
      },
      include: { rooms: true }
    });
    res.status(201).json(hotel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add hotel" });
  }
});

app.post('/api/admin/rooms/:roomId/availability', extractUserId, requireAdmin, async (req, res) => {
  const roomId = parseInt(req.params.roomId);
  const { startDate, endDate, totalRooms } = req.body;
  const start = new Date(startDate);
  const end = new Date(endDate);

  try {
    const diffTime = Math.abs(end - start);
    const requiredDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < requiredDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + i);

      await prisma.roomAvailability.upsert({
        where: { roomId_date: { roomId, date: currentDate } },
        update: { totalRooms },
        create: { roomId, date: currentDate, totalRooms }
      });
    }
    res.json({ message: "Availability updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update availability" });
  }
});

startServer();
