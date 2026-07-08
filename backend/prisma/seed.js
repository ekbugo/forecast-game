/**
 * Seed stations from data-pull/stations.json into the database, and set the
 * current station from data-pull/schedule.json for today's rotation date.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { DateTime } = require('luxon');

const prisma = new PrismaClient();

const STATIONS_PATH = process.env.STATIONS_PATH
  ? path.resolve(process.env.STATIONS_PATH)
  : path.join(__dirname, '../../data-pull/stations.json');

const SCHEDULE_PATH = process.env.SCHEDULE_PATH
  ? path.resolve(process.env.SCHEDULE_PATH)
  : path.join(__dirname, '../../data-pull/schedule.json');

async function main() {
  const stations = JSON.parse(fs.readFileSync(STATIONS_PATH, 'utf-8'));

  for (const s of stations) {
    const data = {
      id: s.stationId,
      icaoId: s.icaoId || s.stationId,
      name: s.name,
      city: s.city ?? null,
      state: s.state ?? null,
      timezone: s.timezone,
      latitude: s.lat ?? null,
      longitude: s.lon ?? null,
      precipReported: s.precipReported !== false
    };
    await prisma.station.upsert({
      where: { id: data.id },
      update: data,
      create: data
    });
  }
  console.log(`✅ Seeded ${stations.length} stations`);

  // Set current station from today's schedule entry, if present.
  try {
    const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf-8')).schedule || {};
    const today = DateTime.now().setZone('America/New_York').toISODate();
    const stationId = schedule[today];
    if (stationId) {
      await prisma.station.updateMany({ data: { isCurrent: false }, where: { isCurrent: true } });
      await prisma.station.update({ where: { id: stationId }, data: { isCurrent: true } });
      console.log(`✅ Set current station for ${today}: ${stationId}`);
    } else {
      console.log(`ℹ️  No schedule entry for ${today}; leaving current station unset.`);
    }
  } catch (err) {
    console.warn('⚠️  Could not set current station from schedule:', err.message);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
