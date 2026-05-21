const express = require('express');
const amqp = require('amqplib');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3004;

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hotel_user:hotel_password@localhost:5432/hotel_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// RabbitMQ Connection & Consumer
async function startRabbitMQ() {
  let retries = 5;
  while (retries > 0) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
      const channel = await conn.createChannel();
      const queue = 'new_reservations_queue';
      
      await channel.assertQueue(queue, { durable: true });
      console.log('Notification Service connected to RabbitMQ');

      channel.consume(queue, (msg) => {
        if (msg !== null) {
          const data = JSON.parse(msg.content.toString());
          console.log(`[x] Received New Reservation:`, data);
          
          // In a real application, we would send an Email or SMS here.
          console.log(`--> Sending confirmation to User ${data.userId} for Hotel ${data.hotelId}, Booking ${data.bookingId}`);
          
          channel.ack(msg);
        }
      });
      break;
    } catch (err) {
      console.error(`RabbitMQ Connection Error in Notification Service, retries left: ${retries - 1}`, err.message);
      retries -= 1;
      if (retries === 0) {
        console.error('Could not connect to RabbitMQ in Notification Service.');
      } else {
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }
}

// Cloud Scheduler Endpoint (Triggered by Logic Apps / Google Scheduler)
app.post('/api/internal/check-capacity', async (req, res) => {
  console.log('Running scheduled task via API to check hotel capacities for the NEXT month...');
  try {
    // Determine the start and end of the next month
    const today = new Date();
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    const query = `
      SELECT r."hotelId", h."name", r.id as "roomId", ra.date, ra."totalRooms", ra."bookedRooms"
      FROM "RoomAvailability" ra
      JOIN "Room" r ON ra."roomId" = r.id
      JOIN "Hotel" h ON r."hotelId" = h.id
      WHERE ra.date >= $1 AND ra.date <= $2
        AND ra."totalRooms" > 0
        AND ((ra."totalRooms" - ra."bookedRooms")::float / ra."totalRooms") < 0.20
    `;
    
    const dbRes = await pool.query(query, [nextMonthStart, nextMonthEnd]);
    
    if (dbRes.rows.length > 0) {
      console.log(`Found ${dbRes.rows.length} dates where capacity drops below 20% next month.`);
      // Group by hotel to notify administrators
      const alerts = {};
      dbRes.rows.forEach(row => {
        if (!alerts[row.hotelId]) alerts[row.hotelId] = [];
        alerts[row.hotelId].push(`Room ${row.roomId} on ${row.date.toISOString().split('T')[0]} has only ${row.totalRooms - row.bookedRooms} available out of ${row.totalRooms}`);
      });

      // Send Mock Notifications
      for (const [hotelId, warnings] of Object.entries(alerts)) {
        console.log(`[ALERT] Notifying Admin of Hotel ${hotelId}:`);
        warnings.forEach(w => console.log(`   - ${w}`));
      }
    } else {
      console.log('All hotel capacities look healthy for the next month.');
    }
    res.json({ message: "Capacity check completed successfully." });
  } catch (err) {
    console.error('Error running capacity task:', err);
    res.status(500).json({ error: "Failed to run capacity check" });
  }
});

startRabbitMQ();

app.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
});
