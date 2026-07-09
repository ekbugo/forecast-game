/**
 * Scoring Service for forecast-game
 *
 * Scoring rules and precipitation range-bucket boundaries are carried forward
 * VERBATIM from weather-game's scoring service (§6.5 of the build brief). Do not
 * invent new thresholds here.
 *
 * Differences from weather-game:
 *  - No late penalty (forecast-game rejects late submissions at the window instead
 *    of applying a grace-period penalty — see §0.3.3).
 *  - Precipitation N/A: when a reading's `precipReported` is false, the precip
 *    category scores 0 (not excluded) and a Perfect Forecast Bonus becomes
 *    unachievable that day. See PRECIPITATION_HANDLING.md.
 */

/**
 * Calculate score for max temperature prediction
 * @param {number} forecast - User's forecast (whole number °F)
 * @param {number} actual - Actual reading (rounded to whole number °F)
 * @returns {number} Score 0-5
 */
function calculateMaxTempScore(forecast, actual) {
  const diff = Math.abs(forecast - actual);
  if (diff === 0) return 5;
  if (diff === 1) return 4;
  if (diff === 2) return 3;
  if (diff === 3) return 2;
  if (diff === 4) return 1;
  return 0;
}

/**
 * Calculate score for min temperature prediction
 * Same rules as max temp
 */
function calculateMinTempScore(forecast, actual) {
  return calculateMaxTempScore(forecast, actual);
}

/**
 * Calculate score for wind gust prediction
 * @param {number} forecast - User's forecast (mph)
 * @param {number} actual - Actual max gust (mph)
 * @returns {number} Score 0-5
 */
function calculateWindGustScore(forecast, actual) {
  const diff = Math.abs(forecast - Math.round(actual));
  if (diff <= 1) return 5;
  if (diff <= 3) return 4;
  if (diff <= 5) return 3;
  if (diff <= 9) return 2;
  if (diff <= 13) return 1;
  return 0;
}

/**
 * Convert precipitation inches to range number (1-7)
 * @param {number} inches - Total precipitation in inches
 * @returns {number} Range 1-7
 */
function getPrecipRange(inches) {
  if (inches <= 0.10) return 1;
  if (inches <= 0.25) return 2;
  if (inches <= 0.50) return 3;
  if (inches <= 1.00) return 4;
  if (inches <= 1.50) return 5;
  if (inches <= 2.50) return 6;
  return 7;
}

/**
 * Get human-readable precipitation range description
 * @param {number} range - Range number 1-7
 * @returns {object} Range description with min and max inches
 */
function getPrecipRangeDescription(range) {
  const ranges = {
    1: { min: 0.00, max: 0.10, label: '0.00" - 0.10"' },
    2: { min: 0.11, max: 0.25, label: '0.11" - 0.25"' },
    3: { min: 0.26, max: 0.50, label: '0.26" - 0.50"' },
    4: { min: 0.51, max: 1.00, label: '0.51" - 1.00"' },
    5: { min: 1.01, max: 1.50, label: '1.01" - 1.50"' },
    6: { min: 1.51, max: 2.50, label: '1.51" - 2.50"' },
    7: { min: 2.51, max: Infinity, label: '2.51" or more' }
  };
  return ranges[range] || ranges[1];
}

/**
 * Calculate score for precipitation range prediction
 * @param {number} forecastRange - User's forecast range (1-7)
 * @param {number} actualRange - Actual range (1-7)
 * @returns {number} Score 0-5
 */
function calculatePrecipScore(forecastRange, actualRange) {
  const diff = Math.abs(forecastRange - actualRange);
  if (diff === 0) return 5;
  if (diff === 1) return 4;
  if (diff === 2) return 3;
  if (diff === 3) return 2;
  if (diff === 4) return 1;
  return 0;
}

/**
 * Round temperature to nearest whole number (standard rounding)
 * @param {number} temp - Temperature value
 * @returns {number} Rounded temperature
 */
function roundTemperature(temp) {
  return Math.round(temp);
}

/**
 * Calculate complete score for a forecast vs actual reading
 * @param {object} forecast - User's forecast
 * @param {object} reading - Station reading (may have precipReported=false)
 * @returns {object} Detailed score breakdown
 */
function calculateTotalScore(forecast, reading) {
  const maxTempScore = calculateMaxTempScore(
    forecast.maxTemp,
    reading.maxTempRounded
  );

  const minTempScore = calculateMinTempScore(
    forecast.minTemp,
    reading.minTempRounded
  );

  const windGustScore = calculateWindGustScore(
    forecast.windGust,
    Number(reading.windGustMax)
  );

  // Precip N/A rule: if the station does not report precip, the category scores 0
  // and can never be "perfect" (so no Perfect Forecast Bonus on non-reporting days).
  const precipReported = reading.precipReported !== false && reading.precipRange != null;
  const precipScore = precipReported
    ? calculatePrecipScore(forecast.precipRange, reading.precipRange)
    : 0;

  // Perfect forecast bonus: +3 if all four parameters are perfect.
  const isPerfect = maxTempScore === 5 &&
                    minTempScore === 5 &&
                    windGustScore === 5 &&
                    precipReported &&
                    precipScore === 5;

  const perfectBonus = isPerfect ? 3 : 0;

  const totalScore = maxTempScore + minTempScore + windGustScore + precipScore + perfectBonus;

  return {
    maxTempScore,
    minTempScore,
    windGustScore,
    precipScore,
    perfectBonus,
    totalScore,
    isPerfect,
    precipReported,
    breakdown: {
      maxTemp: {
        forecast: forecast.maxTemp,
        actual: reading.maxTempRounded,
        diff: Math.abs(forecast.maxTemp - reading.maxTempRounded),
        score: maxTempScore
      },
      minTemp: {
        forecast: forecast.minTemp,
        actual: reading.minTempRounded,
        diff: Math.abs(forecast.minTemp - reading.minTempRounded),
        score: minTempScore
      },
      windGust: {
        forecast: forecast.windGust,
        actual: Math.round(Number(reading.windGustMax)),
        diff: Math.abs(forecast.windGust - Math.round(Number(reading.windGustMax))),
        score: windGustScore
      },
      precip: {
        forecastRange: forecast.precipRange,
        actualRange: precipReported ? reading.precipRange : null,
        actualInches: precipReported ? Number(reading.precipTotal) : null,
        reported: precipReported,
        rangeDiff: precipReported ? Math.abs(forecast.precipRange - reading.precipRange) : null,
        score: precipScore
      }
    }
  };
}

/**
 * Process a raw JSON summary from the puller into a DB-ready reading.
 * Accepts the camelCase output of data-pull/daily_weather_pull.py.
 * @param {object} rawData - Parsed JSON from data-pull/output
 * @returns {object} Processed reading fields (without stationId / readingDate)
 */
function processStationReading(rawData) {
  const maxTempRounded = roundTemperature(rawData.maxTempF);
  const minTempRounded = roundTemperature(rawData.minTempF);

  const precipReported = rawData.precipReported !== false && rawData.precipTotalIn != null;
  const precipTotal = precipReported ? rawData.precipTotalIn : null;
  const precipRange = precipReported ? getPrecipRange(rawData.precipTotalIn) : null;

  return {
    maxTempRaw: rawData.maxTempF,
    maxTempRounded,
    minTempRaw: rawData.minTempF,
    minTempRounded,
    windGustMax: rawData.maxGustMph,
    precipReported,
    precipTotal,
    precipRange
  };
}

module.exports = {
  calculateMaxTempScore,
  calculateMinTempScore,
  calculateWindGustScore,
  calculatePrecipScore,
  getPrecipRange,
  getPrecipRangeDescription,
  roundTemperature,
  calculateTotalScore,
  processStationReading
};
