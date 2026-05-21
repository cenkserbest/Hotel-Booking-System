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
| API Gateway | https://api-gateway-fthzgsdmc2dhfzd2.austriaeast-01.azurewebsites.net |
| Hotel Service | https://hotel-service-ewa3a5f8asd8d0fs.austriaeast-01.azurewebsites.net |
| Comments Service | https://comments-service-ejgyh2gtd7hme5es.austriaeast-01.azurewebsites.net |
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

1. **Dual-database strategy** — PostgreSQL for transactional hotel/booking data (ACID guarantees), MongoDB for comments (flexible schema, aggregation pipeline for analytics).

2. **Cache-Aside with Redis** — Hotel detail pages are cached for 1 hour. Booking creation does not invalidate the cache (acceptable staleness for static hotel info).

3. **RabbitMQ for async notifications** — Booking creation publishes to `new_reservations_queue`. The notification service consumes this queue independently, decoupling the booking flow from email/SMS delivery.

4. **API Gateway as single entry point** — All external traffic goes through the gateway. Internal services are not exposed. The gateway handles JWT verification and forwards `x-user-id` / `x-user-role` headers.

5. **Admin role via Supabase `app_metadata`** — Role is stored in `app_metadata.role` (not `user_metadata`) so users cannot modify it themselves. The gateway extracts this and forwards it as `x-user-role`.

6. **15% discount for authenticated users** — Applied in the hotel search response. The original price is also returned so the frontend can show a strikethrough price.

7. **Capacity scheduler** — `node-cron` is delegated to an external cloud scheduler (Logic Apps / Google Cloud Scheduler) calling `POST /api/v1/notifications/api/internal/check-capacity`. This avoids coupling the schedule to the service process lifecycle.

8. **AI Agent tool-calling** — The agent uses Groq's `llama-3.1-8b-instant` with two tools: `search_hotels` (fetches from hotel service via gateway) and `book_hotel` (requires login; POSTs to booking endpoint on user confirmation).

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
