const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { forecastLimiter } = require('../middleware/rateLimit');
const { getSubmissionWindow } = require('../utils/timeUtils');
const { getPrecipRangeDescription } = require('../services/scoringService');
const { resolveCurrentStation } = require('./stations');

const router = express.Router();

// Validation for forecast submission
const forecastValidation = [
  body('maxTemp').isInt({ min: -60, max: 140 }).withMessage('Max temperature must be between -60°F and 140°F'),
  body('minTemp').isInt({ min: -80, max: 120 }).withMessage('Min temperature must be between -80°F and 120°F'),
  body('windGust').isInt({ min: 0, max: 250 }).withMessage('Wind gust must be between 0 and 250 mph'),
  body('precipRange').isInt({ min: 1, max: 7 }).withMessage('Precipitation range must be between 1 and 7')
];

/**
 * GET /api/forecasts/status
 * Current submission window status + precip range options for the form.
 */
router.get('/status', async (req, res) => {
  try {
    const { station, forecastDate } = await resolveCurrentStation(req.prisma);

    const precipRanges = [1, 2, 3, 4, 5, 6, 7].map(range => ({
      value: range,
      ...getPrecipRangeDescription(range)
    }));

    if (!station) {
      return res.json({
        isOpen: false,
        reason: 'no_station_scheduled',
        message: `No station scheduled for ${forecastDate}.`,
        forecastDate,
        precipRanges
      });
    }

    const window = getSubmissionWindow(forecastDate, station.timezone);

    res.json({
      ...window,
      station: { id: station.id, name: station.name, city: station.city, state: station.state },
      precipRanges
    });
  } catch (error) {
    console.error('Get forecast status error:', error);
    res.status(500).json({ error: 'Failed to get forecast status' });
  }
});

/**
 * POST /api/forecasts
 * Submit a forecast for the current station's active day.
 */
router.post('/', authenticateToken, forecastLimiter, forecastValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { maxTemp, minTemp, windGust, precipRange } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (minTemp >= maxTemp) {
      return res.status(400).json({ error: 'Minimum temperature must be less than maximum temperature' });
    }

    const { station, forecastDate } = await resolveCurrentStation(prisma);
    if (!station) {
      return res.status(400).json({ error: 'No station scheduled for today', forecastDate });
    }

    // Enforce the submission window (closes 23:59 station-local, §0.3.3).
    const window = getSubmissionWindow(forecastDate, station.timezone);
    if (!window.isOpen) {
      return res.status(400).json({
        error: 'Submission window is closed for today',
        window
      });
    }

    // One forecast per user per day.
    const existing = await prisma.forecast.findUnique({
      where: { userId_forecastDate: { userId, forecastDate: new Date(forecastDate) } }
    });
    if (existing) {
      return res.status(400).json({
        error: 'You have already submitted a forecast for this date. Only one forecast per day is allowed.',
        existingForecast: { id: existing.id, submittedAt: existing.submittedAt }
      });
    }

    const forecast = await prisma.forecast.create({
      data: {
        userId,
        stationId: station.id,
        forecastDate: new Date(forecastDate),
        maxTemp, minTemp, windGust, precipRange
      },
      include: { station: true }
    });

    res.status(201).json({
      message: 'Forecast submitted successfully',
      forecast: {
        id: forecast.id,
        forecastDate: forecast.forecastDate,
        station: forecast.station.name,
        stationId: forecast.station.id,
        maxTemp: forecast.maxTemp,
        minTemp: forecast.minTemp,
        windGust: forecast.windGust,
        precipRange: forecast.precipRange,
        precipRangeDesc: getPrecipRangeDescription(forecast.precipRange).label,
        submittedAt: forecast.submittedAt
      }
    });
  } catch (error) {
    console.error('Submit forecast error:', error);
    res.status(500).json({ error: 'Failed to submit forecast' });
  }
});

/**
 * GET /api/forecasts/today
 * The user's forecast for the current active day (if any).
 */
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;
    const { station, forecastDate } = await resolveCurrentStation(prisma);

    const window = station ? getSubmissionWindow(forecastDate, station.timezone) : { isOpen: false, forecastDate };

    const forecast = await prisma.forecast.findUnique({
      where: { userId_forecastDate: { userId, forecastDate: new Date(forecastDate) } },
      include: { station: true }
    });

    res.json({
      forecast: forecast ? {
        id: forecast.id,
        forecastDate: forecast.forecastDate,
        station: forecast.station.name,
        stationId: forecast.station.id,
        maxTemp: forecast.maxTemp,
        minTemp: forecast.minTemp,
        windGust: forecast.windGust,
        precipRange: forecast.precipRange,
        precipRangeDesc: getPrecipRangeDescription(forecast.precipRange).label,
        submittedAt: forecast.submittedAt
      } : null,
      window
    });
  } catch (error) {
    console.error('Get today forecast error:', error);
    res.status(500).json({ error: 'Failed to get today forecast' });
  }
});

/**
 * GET /api/forecasts/my-history
 */
router.get('/my-history', authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;
    const { limit = 30, offset = 0 } = req.query;

    const forecasts = await prisma.forecast.findMany({
      where: { userId },
      include: { station: true, score: true },
      orderBy: { forecastDate: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.forecast.count({ where: { userId } });

    const formatted = forecasts.map(f => ({
      id: f.id,
      forecastDate: f.forecastDate,
      station: { id: f.station.id, name: f.station.name },
      prediction: {
        maxTemp: f.maxTemp,
        minTemp: f.minTemp,
        windGust: f.windGust,
        precipRange: f.precipRange,
        precipRangeDesc: getPrecipRangeDescription(f.precipRange).label
      },
      score: f.score ? {
        maxTempScore: f.score.maxTempScore,
        minTempScore: f.score.minTempScore,
        windGustScore: f.score.windGustScore,
        precipScore: f.score.precipScore,
        perfectBonus: f.score.perfectBonus,
        totalScore: f.score.totalScore
      } : null,
      submittedAt: f.submittedAt
    }));

    res.json({
      forecasts: formatted,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + forecasts.length < total
      }
    });
  } catch (error) {
    console.error('Get forecast history error:', error);
    res.status(500).json({ error: 'Failed to get forecast history' });
  }
});

module.exports = router;
