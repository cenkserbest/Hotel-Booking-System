const express = require('express');
const amqp = require('amqplib');
const { Pool } = require('pg');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3004;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hotel_user:hotel_password@localhost:5432/hotel_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = 'onboarding@resend.dev';

async function getAdminEmails() {
  const result = await pool.query(
    `SELECT email FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin'`
  );
  return result.rows.map(r => r.email).filter(Boolean);
}

async function getUserEmail(userId) {
  const result = await pool.query(
    `SELECT email FROM auth.users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.email || null;
}

async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.log(`[EMAIL SKIPPED — no RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
    return;
  }
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) return;
  await resend.emails.send({ from: FROM_EMAIL, to: recipients, subject, html });
  console.log(`[EMAIL SENT] To: ${recipients.join(', ')} | Subject: ${subject}`);
}

// RabbitMQ Consumer
async function startRabbitMQ() {
  let retries = 5;
  while (retries > 0) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
      const channel = await conn.createChannel();
      const queue = 'new_reservations_queue';

      await channel.assertQueue(queue, { durable: true });
      console.log('Notification Service connected to RabbitMQ');

      channel.consume(queue, async (msg) => {
        if (msg === null) return;
        const data = JSON.parse(msg.content.toString());
        console.log(`[x] Received New Reservation:`, data);

        try {
          const userEmail = await getUserEmail(data.userId);
          if (userEmail) {
            await sendEmail({
              to: userEmail,
              subject: 'Booking Confirmed!',
              html: `
                <h2>Your booking is confirmed!</h2>
                <p><b>Booking ID:</b> ${data.bookingId}</p>
                <p><b>Hotel ID:</b> ${data.hotelId}</p>
                <p>Thank you for choosing LuminaHotels!</p>
              `
            });
          }
        } catch (err) {
          console.error('Failed to send confirmation email:', err.message);
        }

        channel.ack(msg);
      });
      break;
    } catch (err) {
      console.error(`RabbitMQ Connection Error, retries left: ${retries - 1}`, err.message);
      retries -= 1;
      if (retries === 0) {
        console.error('Could not connect to RabbitMQ in Notification Service.');
      } else {
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }
}

// Cloud Scheduler Endpoint
app.post('/api/internal/check-capacity', async (req, res) => {
  console.log('Running capacity check for next month...');
  try {
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
      console.log(`Found ${dbRes.rows.length} low-capacity dates.`);

      const alerts = {};
      dbRes.rows.forEach(row => {
        const key = `${row.hotelId}|${row.name}`;
        if (!alerts[key]) alerts[key] = [];
        alerts[key].push(
          `Room ${row.roomId} on ${row.date.toISOString().split('T')[0]}: ` +
          `${row.totalRooms - row.bookedRooms} / ${row.totalRooms} available`
        );
      });

      const adminEmails = await getAdminEmails();
      console.log(`Notifying ${adminEmails.length} admin(s):`, adminEmails);

      if (adminEmails.length > 0) {
        const alertRows = Object.entries(alerts)
          .map(([key, warnings]) => {
            const hotelName = key.split('|')[1];
            return `<h3>${hotelName}</h3><ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul>`;
          })
          .join('');

        await sendEmail({
          to: adminEmails,
          subject: `[ALERT] Low Capacity Warning — ${Object.keys(alerts).length} hotel(s)`,
          html: `
            <h2>Capacity Alert</h2>
            <p>The following hotels have rooms below <b>20% capacity</b> for next month:</p>
            ${alertRows}
          `
        });
      }
    } else {
      console.log('All hotel capacities look healthy for next month.');
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
