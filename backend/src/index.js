require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

// Import routes
const authRoutes = require('./routes/auth');
const { router: stationRoutes } = require('./routes/stations');
const forecastRoutes = require('./routes/forecasts');
const leaderboardRoutes = require('./routes/leaderboard');
const scoreRoutes = require('./routes/scores');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// --- CORS: allow the configured frontend origin(s) (GitHub Pages / custom domain) ---
// FRONTEND_ORIGIN may be a comma-separated list. Requests with no Origin (curl,
// server-to-server) are allowed.
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  }
}));

app.use(express.json());

// Trust the proxy (Railway) so express-rate-limit reads the real client IP.
app.set('trust proxy', 1);

// Make prisma available to routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/forecasts', forecastRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/scores', scoreRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Only listen when run directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`⛅ forecast-game API running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
