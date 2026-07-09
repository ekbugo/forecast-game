/**
 * Smoke test for the scoring service (no DB needed).
 * Verifies the carried-over bucket boundaries and point mapping, the perfect
 * bonus, and the precip N/A rule. Run: npm run test:scoring
 */
const assert = require('assert');
const {
  calculateMaxTempScore,
  calculateWindGustScore,
  calculatePrecipScore,
  getPrecipRange,
  calculateTotalScore,
  processStationReading
} = require('../src/services/scoringService');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`✅ ${name}`);
}

check('temp score bands', () => {
  assert.strictEqual(calculateMaxTempScore(70, 70), 5);
  assert.strictEqual(calculateMaxTempScore(71, 70), 4);
  assert.strictEqual(calculateMaxTempScore(72, 70), 3);
  assert.strictEqual(calculateMaxTempScore(73, 70), 2);
  assert.strictEqual(calculateMaxTempScore(74, 70), 1);
  assert.strictEqual(calculateMaxTempScore(75, 70), 0);
});

check('wind gust bands', () => {
  assert.strictEqual(calculateWindGustScore(30, 30), 5);   // diff 0
  assert.strictEqual(calculateWindGustScore(31, 30), 5);   // diff 1
  assert.strictEqual(calculateWindGustScore(32, 30), 4);   // diff 2
  assert.strictEqual(calculateWindGustScore(35, 30), 3);   // diff 5
  assert.strictEqual(calculateWindGustScore(39, 30), 2);   // diff 9
  assert.strictEqual(calculateWindGustScore(43, 30), 1);   // diff 13
  assert.strictEqual(calculateWindGustScore(45, 30), 0);   // diff 15
});

check('precip range buckets (verbatim from weather-game)', () => {
  assert.strictEqual(getPrecipRange(0.00), 1);
  assert.strictEqual(getPrecipRange(0.10), 1);
  assert.strictEqual(getPrecipRange(0.11), 2);
  assert.strictEqual(getPrecipRange(0.25), 2);
  assert.strictEqual(getPrecipRange(0.50), 3);
  assert.strictEqual(getPrecipRange(1.00), 4);
  assert.strictEqual(getPrecipRange(1.50), 5);
  assert.strictEqual(getPrecipRange(2.50), 6);
  assert.strictEqual(getPrecipRange(2.51), 7);
  assert.strictEqual(getPrecipRange(10), 7);
});

check('precip score bands', () => {
  assert.strictEqual(calculatePrecipScore(3, 3), 5);
  assert.strictEqual(calculatePrecipScore(4, 3), 4);
  assert.strictEqual(calculatePrecipScore(1, 3), 3);
  assert.strictEqual(calculatePrecipScore(7, 3), 1); // diff 4 → 1
  assert.strictEqual(calculatePrecipScore(7, 2), 0); // diff 5 → 0
});

check('perfect forecast → +3 bonus, total 23', () => {
  const forecast = { maxTemp: 90, minTemp: 60, windGust: 20, precipRange: 3 };
  const reading = {
    maxTempRounded: 90, minTempRounded: 60, windGustMax: 20,
    precipReported: true, precipTotal: 0.40, precipRange: 3
  };
  const r = calculateTotalScore(forecast, reading);
  assert.strictEqual(r.perfectBonus, 3);
  assert.strictEqual(r.isPerfect, true);
  assert.strictEqual(r.totalScore, 5 + 5 + 5 + 5 + 3);
});

check('precip N/A → precip scores 0 and no perfect bonus is possible', () => {
  const forecast = { maxTemp: 90, minTemp: 60, windGust: 20, precipRange: 3 };
  const reading = {
    maxTempRounded: 90, minTempRounded: 60, windGustMax: 20,
    precipReported: false, precipTotal: null, precipRange: null
  };
  const r = calculateTotalScore(forecast, reading);
  assert.strictEqual(r.precipScore, 0);
  assert.strictEqual(r.perfectBonus, 0);
  assert.strictEqual(r.isPerfect, false);
  assert.strictEqual(r.totalScore, 15); // 5+5+5+0, no bonus
});

check('processStationReading maps camelCase puller output + precip N/A', () => {
  const reported = processStationReading({ maxTempF: 95.4, minTempF: 62.1, maxGustMph: 30.2, precipReported: true, precipTotalIn: 0.0 });
  assert.strictEqual(reported.maxTempRounded, 95);
  assert.strictEqual(reported.minTempRounded, 62);
  assert.strictEqual(reported.precipReported, true);
  assert.strictEqual(reported.precipRange, 1);

  const na = processStationReading({ maxTempF: 80, minTempF: 55, maxGustMph: 10, precipReported: false, precipTotalIn: null });
  assert.strictEqual(na.precipReported, false);
  assert.strictEqual(na.precipTotal, null);
  assert.strictEqual(na.precipRange, null);
});

console.log(`\nAll ${passed} scoring smoke tests passed.`);
