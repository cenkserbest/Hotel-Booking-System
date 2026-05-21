const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { verifyTokenOptional, verifyTokenRequired } = require('./middlewares/authMiddleware');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

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
