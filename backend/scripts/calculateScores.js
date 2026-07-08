/**
 * Calculate Scores
 *
 * Compares forecasts against actual station readings and writes score records,
 * updating each user's denormalized totalPoints. Run daily after importReadings.
 *
 * Usage:
 *   node scripts/calculateScores.js               # all dates with pending scores
 *   node scripts/calculateScores.js YYYY-MM-DD     # a specific date
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { calculateTotalScore } = require('../src/services/scoringService');

const prisma = new PrismaClient();

async function calculateScoresForDate(dateStr) {
  const date = new Date(dateStr);
  console.log(`\n📅 Calculating scores for: ${dateStr}\n`);

  const readings = await prisma.stationReading.findMany({ where: { readingDate: date } });
  if (readings.length === 0) {
    console.log(`⚠️  No station readings found for ${dateStr}`);
    return { calculated: 0, skipped: 0, errors: 0 };
  }

  const results = { calculated: 0, skipped: 0, errors: 0 };

  for (const reading of readings) {
    // Forecasts target the same (rotation-zone) date as the reading date.
    const forecasts = await prisma.forecast.findMany({
      where: { stationId: reading.stationId, forecastDate: date },
      include: { user: { select: { id: true, username: true } }, score: true }
    });

    console.log(`🌤️  Station ${reading.stationId}: ${forecasts.length} forecast(s)` +
      (reading.precipReported ? '' : '  [precip N/A → precip scores 0]'));

    for (const forecast of forecasts) {
      if (forecast.score) {
        results.skipped++;
        continue;
      }
      try {
        const scoreResult = calculateTotalScore(forecast, reading);

        // Create the score and bump the user's total atomically.
        await prisma.$transaction([
          prisma.score.create({
            data: {
              userId: forecast.userId,
              forecastId: forecast.id,
              readingId: reading.id,
              scoreDate: date,
              maxTempScore: scoreResult.maxTempScore,
              minTempScore: scoreResult.minTempScore,
              windGustScore: scoreResult.windGustScore,
              precipScore: scoreResult.precipScore,
              perfectBonus: scoreResult.perfectBonus,
              totalScore: scoreResult.totalScore
            }
          }),
          prisma.user.update({
            where: { id: forecast.userId },
            data: { totalPoints: { increment: scoreResult.totalScore } }
          })
        ]);

        const bonusStr = scoreResult.isPerfect ? ' 🌟 PERFECT!' : '';
        console.log(`   ✅ ${forecast.user.username} - ${scoreResult.totalScore} points${bonusStr}`);
        results.calculated++;
      } catch (err) {
        console.log(`   ❌ ${forecast.user.username} - Error: ${err.message}`);
        results.errors++;
      }
    }
  }

  return results;
}

async function calculateAllPending() {
  console.log('\n🔍 Finding dates with pending score calculations...\n');
  const readings = await prisma.stationReading.findMany({
    select: { readingDate: true, stationId: true },
    orderBy: { readingDate: 'asc' }
  });

  const pendingDates = new Set();
  for (const { readingDate, stationId } of readings) {
    const unscored = await prisma.forecast.count({
      where: { stationId, forecastDate: readingDate, score: null }
    });
    if (unscored > 0) pendingDates.add(readingDate.toISOString().split('T')[0]);
  }

  if (pendingDates.size === 0) {
    console.log('✅ All forecasts have been scored!');
    return;
  }

  const totals = { calculated: 0, skipped: 0, errors: 0 };
  for (const dateStr of Array.from(pendingDates).sort()) {
    const r = await calculateScoresForDate(dateStr);
    totals.calculated += r.calculated;
    totals.skipped += r.skipped;
    totals.errors += r.errors;
  }

  console.log('\n📊 Total Summary:');
  console.log(`   ✅ Calculated: ${totals.calculated}`);
  console.log(`   ⏭️  Skipped:    ${totals.skipped}`);
  console.log(`   ❌ Errors:     ${totals.errors}`);
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.length > 0) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
        console.log('❌ Invalid date format. Use YYYY-MM-DD');
        process.exit(1);
      }
      await calculateScoresForDate(args[0]);
    } else {
      await calculateAllPending();
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
