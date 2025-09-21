const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Test endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'SnapFit API Test Server is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      health: 'GET /api/health'
    }
  });
});

// Mock register endpoint
app.post('/api/auth/register', (req, res) => {
  res.json({
    success: true,
    message: 'Registration endpoint is working!',
    data: {
      user: {
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName
      },
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      }
    }
  });
});

// Mock login endpoint
app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    message: 'Login endpoint is working!',
    data: {
      user: {
        email: req.body.email,
        isActive: true
      },
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      }
    }
  });
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.listen(port, () => {
  console.log(`🚀 Test server running on http://localhost:${port}`);
  console.log(`📋 Test endpoints:`);
  console.log(`   GET  http://localhost:${port}/`);
  console.log(`   POST http://localhost:${port}/api/auth/register`);
  console.log(`   POST http://localhost:${port}/api/auth/login`);
  console.log(`   GET  http://localhost:${port}/api/health`);
});
