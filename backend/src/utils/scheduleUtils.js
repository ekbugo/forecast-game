/**
 * Schedule utilities — read the admin-edited, committed rotation file.
 *
 * schedule.json maps a date (in America/New_York) to a station ID:
 *   { "schedule": { "2026-07-08": "KDEN", "2026-07-09": "KAUS" } }
 *
 * The file is the single source of truth for rotation (§6.4). There is no admin
 * API — the admin edits the file and commits it.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_SCHEDULE_PATH = path.join(__dirname, '../../../data-pull/schedule.json');

function getSchedulePath() {
  return process.env.SCHEDULE_PATH
    ? path.resolve(process.env.SCHEDULE_PATH)
    : DEFAULT_SCHEDULE_PATH;
}

/**
 * Load the schedule as a plain object { 'YYYY-MM-DD': 'STATIONID' }.
 * Ignores any keys that start with '_' (comments).
 * @returns {Object<string,string>}
 */
function loadSchedule() {
  const schedulePath = getSchedulePath();
  try {
    if (!fs.existsSync(schedulePath)) {
      console.warn(`[schedule] file not found at ${schedulePath}`);
      return {};
    }
    const data = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));
    const map = data.schedule || {};
    // Strip comment keys.
    const clean = {};
    for (const [k, v] of Object.entries(map)) {
      if (!k.startsWith('_')) clean[k] = v;
    }
    return clean;
  } catch (err) {
    console.error('[schedule] error reading schedule.json:', err.message);
    return {};
  }
}

/**
 * The station ID scheduled for a given date, or null.
 * @param {string} date - 'YYYY-MM-DD'
 * @returns {string|null}
 */
function getStationForDate(date) {
  return loadSchedule()[date] || null;
}

/**
 * Sorted list of scheduled dates (ascending).
 * @returns {string[]}
 */
function scheduledDates() {
  return Object.keys(loadSchedule()).sort();
}

/**
 * How many scheduled dates are strictly after the given date.
 * @param {string} date - 'YYYY-MM-DD'
 * @returns {number}
 */
function futureEntryCount(date) {
  return scheduledDates().filter(d => d > date).length;
}

module.exports = {
  getSchedulePath,
  loadSchedule,
  getStationForDate,
  scheduledDates,
  futureEntryCount
};
