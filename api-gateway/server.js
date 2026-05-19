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
app.get('/api/hotels/search', verifyTokenOptional, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
      }
    }
  }
}));

// 1.5 Get Hotel Details (Public)
app.get('/api/hotels/:id', createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true
}));

// 2. Book Hotel (Requires Authentication)
app.post('/api/hotels/book', verifyTokenRequired, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
      }
    }
  }
}));

// 3. Admin Hotel Operations (Requires Authentication & Admin Role check)
app.post('/api/admin/hotels', verifyTokenRequired, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
      }
    }
  }
}));

app.post('/api/admin/rooms/:roomId/availability', verifyTokenRequired, createProxyMiddleware({
  target: HOTEL_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
      }
    }
  }
}));

// COMMENTS SERVICE PROXIES
// Add Comment (Requires Auth)
app.post('/api/comments/add', verifyTokenRequired, createProxyMiddleware({
  target: COMMENTS_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user && req.user.id) {
        proxyReq.setHeader('x-user-id', req.user.id);
      }
    }
  }
}));

// Get Comments (Public)
app.get('/api/comments/hotel/:hotelId', createProxyMiddleware({
  target: COMMENTS_SERVICE_URL,
  changeOrigin: true
}));

// NOTIFICATION SERVICE PROXIES (Optional direct access for AI Agent or internal triggering)
app.all('/api/notifications/*', createProxyMiddleware({
  target: NOTIFICATION_SERVICE_URL,
  changeOrigin: true
}));

// AI AGENT SERVICE PROXIES
app.post('/api/agent/chat', verifyTokenOptional, createProxyMiddleware({
  target: AI_AGENT_SERVICE_URL,
  changeOrigin: true,
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
