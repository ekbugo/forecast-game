/**
 * Time utilities for forecast-game.
 *
 * Two timezones matter:
 *  - ROTATION_ZONE (America/New_York): the fixed reference zone the daily rotation
 *    and schedule.json keys are expressed in. "Today's station" is schedule[todayNY].
 *  - Each station's own IANA timezone: the forecast submission window for a
 *    station's active day closes at 23:59:59 in that station's local time (§0.3.3).
 */

const { DateTime } = require('luxon');

const ROTATION_ZONE = 'America/New_York';

/** Today's date (YYYY-MM-DD) in the rotation zone. */
function currentScheduleDate() {
  return DateTime.now().setZone(ROTATION_ZONE).toISODate();
}

/** Yesterday's date (YYYY-MM-DD) in the rotation zone. */
function yesterdayScheduleDate() {
  return DateTime.now().setZone(ROTATION_ZONE).minus({ days: 1 }).toISODate();
}

/**
 * Compute the submission window for a station's active day.
 * The window closes at 23:59:59.999 in the station's local timezone on `date`.
 * @param {string} date - the active (rotation-zone) date 'YYYY-MM-DD'
 * @param {string} stationTz - the station's IANA timezone
 * @returns {{ closesAt: string, isOpen: boolean, remainingMinutes: number }}
 */
function getSubmissionWindow(date, stationTz) {
  const now = DateTime.now();
  const closes = DateTime.fromISO(date, { zone: stationTz }).endOf('day');
  const isOpen = now <= closes;
  return {
    forecastDate: date,
    closesAt: closes.toISO(),
    stationTimezone: stationTz,
    isOpen,
    remainingMinutes: isOpen ? Math.max(0, Math.floor(closes.diff(now, 'minutes').minutes)) : 0
  };
}

/**
 * Whether a forecast for `date` at `stationTz` can still be submitted now.
 * @returns {boolean}
 */
function canSubmit(date, stationTz) {
  return getSubmissionWindow(date, stationTz).isOpen;
}

/** Monday (start of ISO week) for a date, in the rotation zone. Used for weekly leaderboard. */
function getWeekStart(jsDate) {
  const dt = DateTime.fromJSDate(jsDate).setZone(ROTATION_ZONE);
  return dt.minus({ days: dt.weekday - 1 }).startOf('day');
}

module.exports = {
  ROTATION_ZONE,
  currentScheduleDate,
  yesterdayScheduleDate,
  getSubmissionWindow,
  canSubmit,
  getWeekStart
};
