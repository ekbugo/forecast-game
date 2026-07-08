/**
 * rotate-station — schedule-file driven daily rotation (§6.4).
 *
 * Reads today's date in America/New_York, looks up today's station in
 * data-pull/schedule.json, and sets its isCurrent flag in the DB (clearing the
 * previous one). Exactly one station is current at a time.
 *
 * - Missing entry for today: does NOT auto-pick a station. Keeps the previous
 *   current station and emits a loud warning so the admin notices.
 * - Warns when fewer than 7 future dated entries remain.
 *
 * Run daily in CI against the production DATABASE_URL. Also runnable locally.
 *
 * Usage: node scripts/rotateStation.js [YYYY-MM-DD]   (date override for testing)
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { currentScheduleDate } = require('../src/utils/timeUtils');
const { getStationForDate, futureEntryCount, getSchedulePath } = require('../src/utils/scheduleUtils');

const prisma = new PrismaClient();

async function main() {
  const today = process.argv[2] || currentScheduleDate();
  console.log(`\n🔄 rotate-station for ${today} (schedule: ${getSchedulePath()})`);

  const stationId = getStationForDate(today);

  if (!stationId) {
    console.warn('\n⚠️ ============================================================');
    console.warn(`⚠️  NO SCHEDULE ENTRY FOR ${today}!`);
    console.warn('⚠️  The schedule has run dry. Keeping the previously-current');
    console.warn('⚠️  station in place. Edit data-pull/schedule.json and commit.');
    console.warn('⚠️ ============================================================\n');
    const current = await prisma.station.findFirst({ where: { isCurrent: true } });
    if (current) {
      console.log(`ℹ️  Current station unchanged: ${current.id} (${current.name})`);
    } else {
      console.warn('⚠️  There is no current station set at all.');
    }
    warnIfScheduleLow(today);
    return;
  }

  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) {
    console.error(`\n❌ Scheduled station ${stationId} is not in the database.`);
    console.error('   Ensure it exists in stations.json and run the seed. Aborting rotation.\n');
    process.exitCode = 1;
    return;
  }

  // Clear previous current, set today's. Done in a transaction for consistency.
  await prisma.$transaction([
    prisma.station.updateMany({ where: { isCurrent: true, NOT: { id: stationId } }, data: { isCurrent: false } }),
    prisma.station.update({ where: { id: stationId }, data: { isCurrent: true } })
  ]);

  console.log(`✅ Current station set: ${station.id} — ${station.name} (${station.city || ''}, ${station.state || ''})`);
  warnIfScheduleLow(today);
}

function warnIfScheduleLow(today) {
  const remaining = futureEntryCount(today);
  if (remaining < 7) {
    console.warn(`\n⚠️  Only ${remaining} future schedule entr${remaining === 1 ? 'y' : 'ies'} remain after ${today}.`);
    console.warn('⚠️  Keep data-pull/schedule.json populated at least a week ahead.\n');
  } else {
    console.log(`ℹ️  ${remaining} future schedule entries remain.`);
  }
}

main()
  .catch((e) => { console.error('Fatal error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
