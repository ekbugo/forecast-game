# forecast-game

A weather forecasting competition game built on **official NOAA/NWS data**
([`api.weather.gov`](https://www.weather.gov/documentation/services-web-api)),
open to **any US NWS/ASOS station**. Players forecast a shared **station of the
day** — max/min temperature, max wind gust, and a precipitation **range bucket** —
and are scored the next day against the station's actual observations.

Same core concept as [`ekbugo/weather-game`](https://github.com/ekbugo/weather-game)
(the Huracán Info Student Weather Challenge for Puerto Rico), rebuilt on NOAA data
instead of Wunderground PWS stations. This is a separate, standalone repo — it
reuses the architecture, not the data layer.

## Monorepo layout

Three independent sub-projects, each with its own install/build:

```
forecast-game/
├── data-pull/     # Python NOAA puller + curated stations + admin rotation schedule
├── backend/       # Node + Express + Prisma + PostgreSQL API
├── frontend/      # React (Vite, plain JS), bilingual ES/EN
└── .github/workflows/   # daily NOAA pull/rotate/score, path-scoped Pages deploy
```

- **`data-pull/`** — pulls a station's daily actuals to
  `data-pull/output/{STATION}_{DATE}.json` (the on-disk source of truth), with the
  precipitation N/A fix. See [`data-pull/README.md`](data-pull/README.md).
- **`backend/`** — auth (JWT), station-of-the-day, forecast submission with a
  station-local close time, scoring, and leaderboards. Import + score run from CI
  against the production DB.
- **`frontend/`** — register/login, submit today's forecast, forecast/score
  history, leaderboard, current-station display. Deploys to GitHub Pages.

## Key rules

- **Rotation:** daily, driven by the admin-edited `data-pull/schedule.json`
  (dates in `America/New_York` → station ID). No admin API — edit the file and
  commit. See §6.4 in the build brief.
- **Submission window:** each active day's forecast for the current station closes
  at **23:59 in that station's local timezone**; late submissions are rejected.
- **Scoring:** temperature/gust by absolute difference; precipitation by how many
  range-buckets off. +3 Perfect Forecast Bonus when all four are exact. Bucket
  boundaries are carried over verbatim from `weather-game`.
- **Precipitation N/A:** non-reporting stations show **N/A** and score **0** for
  precipitation (not excluded). See [`PRECIPITATION_HANDLING.md`](PRECIPITATION_HANDLING.md).

## Quick start (local dev)

Requires Node 20 (`.nvmrc`), Python 3.11+, and PostgreSQL 15/16.

### 1. data-pull

```bash
cd data-pull
pip install -r requirements.txt
python daily_weather_pull.py KDEN            # writes output/KDEN_<yesterday>.json
python test_daily_weather_pull.py            # offline smoke test
```

### 2. backend

```bash
cd backend
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, FRONTEND_ORIGIN
npm install
npx prisma migrate deploy     # or: npx prisma db push
npm run db:seed               # seeds stations from ../data-pull/stations.json + sets today's current
npm run test:scoring          # scoring smoke test (no DB)
npm run dev                   # http://localhost:3001
```

Useful scripts: `npm run rotate-station`, `npm run import-readings`,
`npm run calculate-scores`.

### 3. frontend

```bash
cd frontend
cp .env.example .env          # VITE_API_URL (leave as /api for the dev proxy)
npm install
npm run dev                   # http://localhost:3000
```

## Daily lifecycle (production)

The single GitHub Action `daily-noaa-pull.yml` runs shortly after `00:00
America/New_York` (plus a lag margin) against the production `DATABASE_URL`:

1. `rotate-station` — set today's scheduled station as current (forecasting target).
2. Pull **yesterday's** actuals for **yesterday's** scheduled station → JSON.
3. `import-readings` + `calculate-scores` — score yesterday's forecasts.
4. Commit the JSON to `data-pull/output/` for audit.

Deployment details are in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Data source

[`api.weather.gov`](https://www.weather.gov/documentation/services-web-api) — free,
no API key, no billing. NWS asks that requests carry a descriptive `User-Agent`
with contact info (set in `data-pull/daily_weather_pull.py`).
