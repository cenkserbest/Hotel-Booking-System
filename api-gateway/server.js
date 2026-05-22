const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { verifyTokenOptional, verifyTokenRequired } = require('./middlewares/authMiddleware');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Swagger spec
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hotel Booking API',
      version: '1.0.0',
      description: 'SE4458 Final Project — API Gateway documentation',
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    paths: {
      '/hotels/search': {
        get: {
          tags: ['Hotels'],
          summary: 'Search available hotels',
          parameters: [
            { name: 'city', in: 'query', required: true, schema: { type: 'string' }, example: 'Istanbul' },
            { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' }, example: '2026-06-01' },
            { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' }, example: '2026-06-05' },
            { name: 'adults', in: 'query', required: true, schema: { type: 'integer' }, example: 2 },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          ],
          responses: {
            200: { description: 'Paginated list of hotels with available rooms' },
            400: { description: 'Missing required parameters' }
          }
        }
      },
      '/hotels/{id}': {
        get: {
          tags: ['Hotels'],
          summary: 'Get hotel details',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Hotel details with rooms' },
            404: { description: 'Hotel not found' }
          }
        }
      },
      '/hotels/book': {
        post: {
          tags: ['Hotels'],
          summary: 'Book a hotel room (auth required)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['hotelId', 'roomId', 'startDate', 'endDate', 'totalPrice'],
                  properties: {
                    hotelId: { type: 'integer' },
                    roomId: { type: 'integer' },
                    startDate: { type: 'string', format: 'date' },
                    endDate: { type: 'string', format: 'date' },
                    totalPrice: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: 'Booking created successfully' },
            401: { description: 'Unauthorized' },
            409: { description: 'Room not available for selected dates' },
            500: { description: 'Internal server error' }
          }
        }
      },
      '/admin/hotels': {
        get: {
          tags: ['Admin'],
          summary: 'List all hotels (admin only)',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'All hotels' }, 401: { description: 'Unauthorized' }, 403: { description: 'Forbidden' } }
        },
        post: {
          tags: ['Admin'],
          summary: 'Create a new hotel (admin only)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'city', 'address', 'stars'],
                  properties: {
                    name: { type: 'string' },
                    city: { type: 'string' },
                    address: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    stars: { type: 'number' },
                    amenities: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Hotel created' }, 401: { description: 'Unauthorized' }, 403: { description: 'Forbidden' } }
        }
      },
      '/admin/rooms/{roomId}/availability': {
        post: {
          tags: ['Admin'],
          summary: 'Set room availability for a date range (admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'roomId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['startDate', 'endDate', 'totalRooms'],
                  properties: {
                    startDate: { type: 'string', format: 'date' },
                    endDate: { type: 'string', format: 'date' },
                    totalRooms: { type: 'integer' }
                  }
                }
              }
            }
          },
          responses: { 200: { description: 'Availability updated' }, 401: { description: 'Unauthorized' }, 403: { description: 'Forbidden' } }
        }
      },
      '/comments/hotel/{hotelId}': {
        get: {
          tags: ['Comments'],
          summary: 'Get comments for a hotel',
          parameters: [
            { name: 'hotelId', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          ],
          responses: { 200: { description: 'Comments with pagination and rating graph data' } }
        }
      },
      '/comments/add': {
        post: {
          tags: ['Comments'],
          summary: 'Add a comment to a hotel (auth required)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['hotelId', 'commentText', 'ratings'],
                  properties: {
                    hotelId: { type: 'integer' },
                    userName: { type: 'string' },
                    commentText: { type: 'string' },
                    ratings: {
                      type: 'object',
                      properties: {
                        temizlik: { type: 'integer', minimum: 1, maximum: 10 },
                        personelVeServis: { type: 'integer', minimum: 1, maximum: 10 },
                        imkanVeOzellikler: { type: 'integer', minimum: 1, maximum: 10 },
                        konaklamaYerininDurumu: { type: 'integer', minimum: 1, maximum: 10 },
                        cevreDostlugu: { type: 'integer', minimum: 1, maximum: 10 }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Comment added' }, 401: { description: 'Unauthorized' } }
        }
      },
      '/agent/chat': {
        post: {
          tags: ['AI Agent'],
          summary: 'Chat with AI hotel assistant',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: {
                    message: { type: 'string', example: 'Find hotels in Istanbul for 2 adults from June 1 to June 5' },
                    history: { type: 'array', items: { type: 'object' } }
                  }
                }
              }
            }
          },
          responses: { 200: { description: 'AI reply, optionally with hotel results or booking confirmation' } }
        }
      }
    }
  },
  apis: []
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Service URLs (internal docker network or localhost)
const HOTEL_SERVICE_URL = process.env.HOTEL_SERVICE_URL || 'http://hotel-service:3001';
const COMMENTS_SERVICE_URL = process.env.COMMENTS_SERVICE_URL || 'http://comments-service:3002';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004';
const AI_AGENT_SERVICE_URL = process.env.AI_AGENT_SERVICE_URL || 'http://ai-agent-service:3003';

// ---------------------------------------------------------
// PROXY CONFIGURATION
// ---------------------------------------------------------

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'API Gateway' });
});

// HOTEL SERVICE PROXIES
// 1. Search Hotels (Public, but we need optional auth for 15% discount)
app.get('/api/v1/hotels/search', verifyTokenOptional, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' },
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
      }
    }
  }
}));

// 1.5 Get Hotel Details (Public)
app.get('/api/v1/hotels/:id', createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' }
}));

// 2. Book Hotel (Requires Authentication)
app.post('/api/v1/hotels/book', verifyTokenRequired, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' },
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
      }
    }
  }
}));

// 3. Admin Hotel Operations (Requires Authentication & Admin Role check)
app.get('/api/v1/admin/hotels', verifyTokenRequired, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' },
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
        proxyReq.setHeader('x-user-role', req.user.role || 'user');
      }
    }
  }
}));

app.post('/api/v1/admin/hotels', verifyTokenRequired, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' },
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
        proxyReq.setHeader('x-user-role', req.user.role || 'user');
      }
    }
  }
}));

app.patch('/api/v1/admin/hotels/:id', verifyTokenRequired, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' },
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
        proxyReq.setHeader('x-user-role', req.user.role || 'user');
      }
    }
  }
}));

app.post('/api/v1/admin/rooms/:roomId/availability', verifyTokenRequired, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' },
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
        proxyReq.setHeader('x-user-role', req.user.role || 'user');
      }
    }
  }
}));

// COMMENTS SERVICE PROXIES
// Add Comment (Requires Auth)
app.post('/api/v1/comments/add', verifyTokenRequired, createProxyMiddleware({
  target: COMMENTS_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' },
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
      }
    }
  }
}));

// Get Comments (Public)
app.get('/api/v1/comments/hotel/:hotelId', createProxyMiddleware({
  target: COMMENTS_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' }
}));

// NOTIFICATION SERVICE PROXIES (Optional direct access for AI Agent or internal triggering)
app.all('/api/v1/notifications/*', createProxyMiddleware({
  target: NOTIFICATION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' }
}));

// AI AGENT SERVICE PROXIES
app.post('/api/v1/agent/chat', verifyTokenOptional, createProxyMiddleware({
  target: AI_AGENT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/v1': '/api' },
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
      }
    }
  }
}));

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway is running on port ${PORT}`);
});
