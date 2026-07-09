const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for auth routes (register / login / password reset).
 * Basic protection against brute-force and abuse (§6.7).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                  // 30 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

/**
 * Looser limiter for forecast submissions.
 */
const forecastLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

module.exports = { authLimiter, forecastLimiter };
