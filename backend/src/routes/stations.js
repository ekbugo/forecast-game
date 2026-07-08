const express = require('express');
const { currentScheduleDate, getSubmissionWindow } = require('../utils/timeUtils');
const { getStationForDate } = require('../utils/scheduleUtils');

const router = express.Router();

/**
 * Resolve the current "station of the day".
 * Primary source: the Station row with isCurrent=true (set by rotate-station in CI).
 * Fallback: schedule.json[todayNY] resolved against the DB — so the endpoint still
 * works in local dev before rotate-station has run.
 * @returns {Promise<{station: object|null, forecastDate: string}>}
 */
async function resolveCurrentStation(prisma) {
  const forecastDate = currentScheduleDate();

  let station = await prisma.station.findFirst({ where: { isCurrent: true } });

  if (!station) {
    const stationId = getStationForDate(forecastDate);
    if (stationId) {
      station = await prisma.station.findUnique({ where: { id: stationId } });
    }
  }

  return { station, forecastDate };
}

/**
 * GET /api/stations
 * List all stations.
 */
router.get('/', async (req, res) => {
  try {
    const stations = await req.prisma.station.findMany({ orderBy: { name: 'asc' } });
    res.json({ stations });
  } catch (error) {
    console.error('Get stations error:', error);
    res.status(500).json({ error: 'Failed to get stations' });
  }
});

/**
 * GET /api/stations/current
 * The current station all players forecast for, plus its submission window.
 */
router.get('/current', async (req, res) => {
  try {
    const { station, forecastDate } = await resolveCurrentStation(req.prisma);

    if (!station) {
      return res.json({
        station: null,
        forecastDate,
        isOpen: false,
        reason: 'no_station_scheduled',
        message: `No station scheduled for ${forecastDate}. Check data-pull/schedule.json.`
      });
    }

    const window = getSubmissionWindow(forecastDate, station.timezone);

    res.json({ station, forecastDate, ...window });
  } catch (error) {
    console.error('Get current station error:', error);
    res.status(500).json({ error: 'Failed to get current station' });
  }
});

/**
 * GET /api/stations/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const station = await req.prisma.station.findUnique({ where: { id: req.params.id } });
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    res.json({ station });
  } catch (error) {
    console.error('Get station error:', error);
    res.status(500).json({ error: 'Failed to get station' });
  }
});

module.exports = { router, resolveCurrentStation };
