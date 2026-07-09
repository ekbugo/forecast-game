/**
 * Import Weather Readings
 *
 * Reads JSON files produced by the puller from data-pull/output/ and imports them
 * into the database. Files are named {STATION_ID}_{YYYY-MM-DD}.json and use the
 * camelCase schema of daily_weather_pull.py, with typed nulls preserved so N/A
 * precipitation is distinguished from a genuine 0.00".
 *
 * Usage:
 *   node scripts/importReadings.js                # import all files in DATA_DIR
 *   node scripts/importReadings.js path/to.json   # import a single file
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { processStationReading } = require('../src/services/scoringService');

const prisma = new PrismaClient();

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', 'data-pull', 'output');

function parseFilename(filename) {
  const match = filename.match(/^([A-Z0-9]+)_(\d{4}-\d{2}-\d{2})\.json$/);
  if (!match) return null;
  return { stationId: match[1], date: match[2] };
}

async function importFile(filePath) {
  const filename = path.basename(filePath);
  const parsed = parseFilename(filename);
  if (!parsed) {
    console.log(`⚠️  Skipping ${filename} - invalid filename format`);
    return { success: false, reason: 'invalid filename' };
  }

  const { stationId, date } = parsed;

  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) {
    console.log(`⚠️  Skipping ${filename} - station ${stationId} not found`);
    return { success: false, reason: 'station not found' };
  }

  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.log(`❌ Error reading ${filename}: ${err.message}`);
    return { success: false, reason: 'file read error' };
  }

  // Temp/gust must be present; precip may legitimately be null (N/A).
  if (typeof rawData.maxTempF !== 'number' ||
      typeof rawData.minTempF !== 'number' ||
      typeof rawData.maxGustMph !== 'number') {
    console.log(`❌ Invalid data in ${filename} - missing maxTempF/minTempF/maxGustMph`);
    return { success: false, reason: 'invalid data' };
  }

  const processed = processStationReading(rawData);

  try {
    // Upsert so re-running the import (e.g. a re-pull) refreshes rather than errors.
    await prisma.stationReading.upsert({
      where: { stationId_readingDate: { stationId, readingDate: new Date(date) } },
      update: processed,
      create: { stationId, readingDate: new Date(date), ...processed }
    });
    const precipStr = processed.precipReported ? `${processed.precipTotal}"` : 'N/A';
    console.log(`✅ Imported ${filename} (precip: ${precipStr})`);
    return { success: true, stationId, date };
  } catch (err) {
    console.log(`❌ Database error for ${filename}: ${err.message}`);
    return { success: false, reason: 'database error' };
  }
}

async function importAll() {
  console.log(`\n📂 Reading files from: ${DATA_DIR}\n`);
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`❌ Data directory not found: ${DATA_DIR}`);
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.log('No JSON files found in data directory.');
    return;
  }

  console.log(`Found ${files.length} JSON file(s)\n`);
  const results = { success: 0, errors: 0 };
  for (const file of files) {
    const result = await importFile(path.join(DATA_DIR, file));
    if (result.success) results.success++;
    else results.errors++;
  }

  console.log('\n📊 Import Summary:');
  console.log(`   ✅ Imported/updated: ${results.success}`);
  console.log(`   ❌ Errors:           ${results.errors}`);
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.length > 0) {
      if (!fs.existsSync(args[0])) {
        console.log(`❌ File not found: ${args[0]}`);
        process.exit(1);
      }
      await importFile(args[0]);
    } else {
      await importAll();
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
