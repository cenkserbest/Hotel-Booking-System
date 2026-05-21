# LuminaHotels — SE4458 Final Project

Hotel booking system built with a microservices architecture, similar to Hotels.com.

---

## Live Demo & Video

| | Link |
|---|---|
| Frontend | https://hotel-booking-system-umber-seven.vercel.app/ |
| Demo Video | https://drive.google.com/drive/folders/1yFUOB4WoGQUjg7oeOOpvb302TpcWKHQp?usp=sharing |

## Deployed Services (Azure)

| Service | URL |
|---|---|
| API Gateway | https://api-gateway-fthzgsdmc2dhfzd2.austriaeast-01.azurewebsites.net/api-docs |
| Hotel Service | https://hotel-service-ewa3a5f8asd8d0fs.austriaeast-01.azurewebsites.net |
| Comments Service | https://comments-service-ejgyh2gtd7hme5es.austriaeast-01.azurewebsites.net |
| AI Agent Service | https://ai-agent-service-fmfgczbbhhdsh5du.austriaeast-01.azurewebsites.net |
| Notification Service | https://notification-service-gwbyexhag9h4gvdf.austriaeast-01.azurewebsites.net |

## Scheduling — Azure Logic Apps

The nightly capacity check task is implemented using **Azure Logic Apps** (`HotelCapacityScheduler`).

- **Trigger:** Daily recurrence (every 24 hours)
- **Action:** `POST` to Notification Service `/api/internal/check-capacity`
- **Logic:** Queries all rooms with less than 20% availability for the next month and logs admin alerts
- **Definition file:** [`infrastructure/hotel-capacity-scheduler.json`](infrastructure/hotel-capacity-scheduler.json)

```
Azure Logic Apps (Daily)
        │
        ▼ POST /api/internal/check-capacity
Notification Service
        │
        ▼ SQL Query: bookedRooms/totalRooms > 0.80 for next month
PostgreSQL
        │
        ▼ [ALERT] logs per hotel
```

New reservation notifications are handled separately via **RabbitMQ** (event-driven, not scheduled):

```
User books hotel
        │
        ▼ publish → new_reservations_queue
Hotel Service (RabbitMQ)
        │
        ▼ consume (real-time)
Notification Service → logs reservation confirmation
```
| AI Agent Service | https://ai-agent-service-fmfgczbbhhdsh5du.austriaeast-01.azurewebsites.net |
| Notification Service | https://notification-service-gwbyexhag9h4gvdf.austriaeast-01.azurewebsites.net |

---

## Architecture Overview

```
                        ┌─────────────────┐
                        │    Frontend     │
                        │  React / Vite   │
                        │   (port 5173)   │
                        └────────┬────────┘
                                 │ HTTP
                        ┌────────▼────────┐
                        │   API Gateway   │  JWT auth (Supabase)
                        │  Express/Node   │  /api/v1/* routes
                        │   (port 3000)   │
                        └──┬──┬──┬──┬────┘
                           │  │  │  │
           ┌───────────────┘  │  │  └─────────────────┐
           │           ┌──────┘  └──────┐              │
           ▼           ▼                ▼              ▼
    ┌──────────┐ ┌──────────┐  ┌──────────────┐ ┌──────────────┐
    │  Hotel   │ │Comments  │  │  AI Agent    │ │Notification  │
    │ Service  │ │ Service  │  │   Service    │ │   Service    │
    │  :3001   │ │  :3002   │  │    :3003     │ │  (internal)  │
    └────┬─────┘ └────┬─────┘  └──────┬───────┘ └──────┬───────┘
         │            │               │                 │
    ┌────▼───┐   ┌────▼───┐      ┌────▼────┐       ┌───▼────────┐
    │Postgres│   │MongoDB │      │  Groq   │       │  RabbitMQ  │
    │ Redis  │   │        │      │   LLM   │       │  Consumer  │
    │RabbitMQ│   │        │      └─────────┘       └────────────┘
    └────────┘   └────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Supabase JS |
| API Gateway | Node.js, Express, http-proxy-middleware |
| Hotel Service | Node.js, Express, Prisma ORM |
| Comments Service | Node.js, Express, Mongoose |
| AI Agent Service | Python, FastAPI, Groq (llama-3.1-8b-instant) |
| Notification Service | Node.js, Express, amqplib |
| Auth (IAM) | Supabase Auth (JWT) |
| Primary DB | PostgreSQL 15 |
| NoSQL DB | MongoDB 6 |
| Cache | Redis 7 (Cache-Aside pattern) |
| Message Queue | RabbitMQ 3 |
| Containerization | Docker, Docker Compose |

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- A Supabase project (for auth)
- A Groq API key (for AI agent)

### 1. Clone & Configure

```bash
git clone <repo-url>
cd SE4458_Final
```

Create `api-gateway/.env`:
```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
```

Create `services/ai-agent-service/.env`:
```env
GROQ_API_KEY=<your-groq-api-key>
```

Create `frontend/.env`:
```env
VITE_API_GATEWAY_URL=http://localhost:3000
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 2. Start all services

```bash
docker-compose up --build
```

This starts: PostgreSQL, MongoDB, Redis, RabbitMQ, API Gateway, Hotel Service, Comments Service, AI Agent Service, Notification Service.

### 3. Run DB migrations

```bash
docker exec hotel_core_service npx prisma migrate deploy
```

### 4. Start frontend (dev)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### Setting a user as Admin

In Supabase Dashboard → Authentication → Users → select user → edit `app_metadata`:
```json
{ "role": "admin" }
```

---

## API Reference (v1)

All endpoints are prefixed with `/api/v1/`. The gateway strips `/v1` before forwarding to internal services.

### Hotel Service

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/hotels/search` | Optional | Search hotels by city, dates, adults. Supports `?page=1&limit=10`. Logged-in users get 15% discount. |
| GET | `/api/v1/hotels/:id` | Public | Hotel detail (Redis cached, TTL 1h) |
| POST | `/api/v1/hotels/book` | Required | Create booking (Prisma transaction + RabbitMQ event) |
| GET | `/api/v1/admin/hotels` | Admin | List all hotels with rooms |
| POST | `/api/v1/admin/hotels` | Admin | Create new hotel with rooms |
| POST | `/api/v1/admin/rooms/:roomId/availability` | Admin | Set room availability for a date range |

### Comments Service

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/comments/add` | Required | Add comment with 5-category ratings (1–10) |
| GET | `/api/v1/comments/hotel/:hotelId` | Public | Get paginated comments + aggregated graph data. Supports `?page=1&limit=10`. |

### AI Agent Service

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/agent/chat` | Optional | Chat with AI. Supports `search_hotels` and `book_hotel` tool calls. |

### Notification Service (Internal)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/notifications/api/internal/check-capacity` | Triggered by scheduler — alerts hotels with <20% room availability next month |

---

## Pagination

Endpoints that support pagination return:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

## ER Diagram (PostgreSQL)

```
Hotel
├── id (PK)
├── name, city, address
├── latitude, longitude
├── stars, amenities (JSON)
├── isActive
└── rooms[] ──────────────────────────────┐
                                          │
Room                                      │
├── id (PK)                               │
├── hotelId (FK → Hotel) ◄────────────────┘
├── roomType, basePrice, capacity
├── availabilities[] ─────────────────────┐
└── bookings[] ────────────────────────────────────┐
                                          │        │
RoomAvailability                          │        │
├── id (PK)                               │        │
├── roomId (FK → Room) ◄──────────────────┘        │
├── date                                            │
├── totalRooms, bookedRooms                         │
└── UNIQUE(roomId, date)                            │
                                                    │
Booking                                             │
├── id (PK)                                         │
├── hotelId (FK → Hotel)                            │
├── roomId (FK → Room) ◄─────────────────────────── ┘
├── userId (from Supabase)
├── startDate, endDate
└── totalPrice
```

**MongoDB — Comments collection:**
```
Comment
├── _id
├── hotelId (Number, references Hotel.id in Postgres)
├── userId, userName
├── commentText
├── ratings { temizlik, personelVeServis, imkanVeOzellikler,
│             konaklamaYerininDurumu, cevreDostlugu }  (1–10)
├── overallRating (auto-calculated avg)
└── createdAt
```

---

## Design Decisions & Assumptions

1. **Booking requires authentication** — The requirement specifies that logged-in users see a 15% discount but does not explicitly restrict booking to authenticated users. We chose to require authentication for booking because: (a) a booking must be linked to a user identity to send confirmation emails via the notification service, (b) anonymous bookings cannot be tracked or managed, and (c) real-world hotel booking systems (Booking.com, Hotels.com) universally require login before completing a reservation. The 15% discount therefore applies to all bookings by design, since only authenticated users can reach the booking endpoint.

2. **Total price is calculated server-side** — The booking endpoint does not accept a `totalPrice` from the client. Instead, it fetches the room's `basePrice` from the database, multiplies by the number of nights, and applies the 15% discount if the user is authenticated. This prevents price manipulation via direct API calls.

3. **Guest count (adults) is not stored in the booking record** — The `adults` parameter is used only at search time to filter rooms by capacity (`capacity >= adults`). It is not persisted in the `Booking` table because the room's own `capacity` field already captures the constraint. Any room returned by search is already guaranteed to accommodate the requested number of guests.

4. **"Haritada göster" is implemented per hotel in the detail modal** — The requirement asks for hotels found in search to be shown on a map. We implemented this as an embedded Google Maps iframe inside each hotel's detail modal (using the hotel's `latitude`/`longitude` coordinates), rather than a unified map overlay of all search results. This avoids the need for a paid Maps API key while still fulfilling the location display requirement.

5. **First matching room is auto-selected for booking** — When a user opens a hotel detail and clicks "Book", the system automatically selects the first room (`rooms[0]`) from the search results. All returned rooms already satisfy the capacity and availability filters, so any selection is valid. A room-type chooser UI was considered out of scope for this implementation.

6. **Comments are not tied to verified stays** — Any authenticated user can leave a comment on any hotel. Verification of an actual completed booking before allowing a review is not implemented. This simplification was chosen because the requirement only specifies "ratings" and "distribution of comments per service", with no mention of stay verification.

7. **Email notifications use Resend free tier** — Confirmation emails (on booking) and capacity alert emails (nightly scheduler) are sent via Resend's `onboarding@resend.dev` sender address. On the free tier, emails can only be delivered to verified addresses. In a production environment, a custom verified domain would be configured.

8. **Dual-database strategy** — PostgreSQL for transactional hotel/booking data (ACID guarantees), MongoDB for comments (flexible schema, aggregation pipeline for analytics).

9. **Cache-Aside with Redis** — Hotel detail pages are cached for 1 hour; search results for 5 minutes keyed by city/dates/adults/user. Booking creation invalidates the relevant hotel detail cache but not search caches (acceptable staleness given the short TTL).

10. **RabbitMQ for async notifications** — Booking creation publishes to `new_reservations_queue`. The notification service consumes this queue independently, decoupling the booking flow from email delivery latency.

11. **API Gateway as single entry point** — All external traffic goes through the gateway. Internal services are not exposed. The gateway handles JWT verification and forwards `x-user-id` / `x-user-role` headers to downstream services.

12. **Admin role via Supabase `app_metadata`** — Role is stored in `app_metadata.role` (not `user_metadata`) so users cannot modify it themselves. The gateway extracts this from the verified JWT and forwards it as `x-user-role`.

13. **Capacity scheduler runs externally** — The nightly capacity check is triggered by Azure Logic Apps calling `POST /api/internal/check-capacity` on the notification service. This avoids coupling the schedule to the service process lifecycle and allows independent scaling.

14. **AI Agent tool-calling** — The agent uses Groq's `llama-3.1-8b-instant` with two tools: `search_hotels` (fetches from hotel service via gateway) and `book_hotel` (requires login; POSTs to booking endpoint on user confirmation). Real-time streaming is not used, as the requirement explicitly states it is not required.

---

## Infrastructure Ports

| Service | Port |
|---|---|
| Frontend | 5173 |
| API Gateway | 3000 |
| Hotel Service | 3001 |
| Comments Service | 3002 |
| AI Agent Service | 3003 |
| PostgreSQL | 5432 |
| MongoDB | 27017 |
| Redis | 6379 |
| RabbitMQ AMQP | 5672 |
| RabbitMQ Management UI | 15672 |
