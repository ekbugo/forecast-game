# data-pull

The NOAA/NWS data layer for forecast-game. Pulls a station's daily actuals from
[`api.weather.gov`](https://www.weather.gov/documentation/services-web-api)
(free, no API key) and writes one JSON file per station per day that the backend
imports and scores against.

## Files

| File | Purpose |
|---|---|
| `daily_weather_pull.py` | The puller. Computes max/min temp (°F), max gust (mph), total precip (in) for a target day, with the **precip N/A fix**. |
| `test_daily_weather_pull.py` | Offline smoke test for the computation + precip-N/A logic (no network needed). |
| `stations.json` | Curated eligible stations (major-airport ASOS, spread across US regions) with metadata. |
| `schedule.json` | **Admin-edited** date → station rotation (dates in `America/New_York`). Keep ≥1 week ahead. |
| `output/` | `{STATION_ID}_{YYYY-MM-DD}.json`, one file per station per day. Source of truth on disk. |

## Setup

```bash
cd data-pull
python3 -m venv .venv && source .venv/bin/activate   # optional
pip install -r requirements.txt
```

## Usage

```bash
# Yesterday's summary for KDEN (station-local calendar day), written to output/
python daily_weather_pull.py KDEN

# A specific date
python daily_weather_pull.py KDEN 2026-07-07

# Print JSON to stdout without writing a file
python daily_weather_pull.py KDEN --stdout
```

Output shape (typed nulls preserved so the importer can tell 0.00" from N/A):

```json
{
  "stationId": "KDEN",
  "date": "2026-07-07",
  "timezone": "America/Denver",
  "maxTempF": 95.4,
  "minTempF": 62.1,
  "maxGustMph": 30.2,
  "precipReported": true,
  "precipTotalIn": 0.0,
  "numObservations": 48,
  "pulledAt": "2026-07-08T11:00:00+00:00"
}
```

## The precip N/A fix (§5.6 of the brief)

Some official ASOS/NWS stations never report `precipitationLastHour`. A naive sum
would emit `0.00"` for those, which is wrong — it's actually *unknown*. Before
emitting a total, the puller looks back `PRECIP_LOOKBACK_DAYS` (14) and checks
whether the station reported **any** non-null hourly precip:

- **Never reports** → `precipReported: false`, `precipTotalIn: null` (shown as
  **N/A** in the UI, and the precipitation category scores **0** — see
  `../PRECIPITATION_HANDLING.md`).
- **Does report** and the target day summed to zero → `precipReported: true`,
  `precipTotalIn: 0.0` (a genuine dry day).

## Rotation schedule (`schedule.json`)

Admin-maintained mapping of date (in `America/New_York`) → station ID:

```json
{
  "schedule": {
    "2026-07-08": "KDEN",
    "2026-07-09": "KAUS"
  }
}
```

Rules:
- Every `stationId` must exist in `stations.json`.
- Keep at least a week of future dates populated. The daily CI job warns when
  fewer than 7 future entries remain, and warns loudly (without changing the
  current station) if today's date is missing.
- To run one station for several days, list it on consecutive dates. There is no
  cadence toggle — rotation is daily and file-driven only.

## How it fits the daily job

The GitHub Actions workflow `.github/workflows/daily-noaa-pull.yml` runs shortly
after `00:00 America/New_York` plus a lag margin and:

1. `rotate-station` — sets today's station (from `schedule.json`) as current.
2. Pulls **yesterday's** actuals for **yesterday's** scheduled station.
3. Imports the JSON + calculates scores against the production DB.
4. Commits the JSON in `output/` for audit.

> **Observation lag note:** NWS observations publish with a delay, and a
> station's local calendar day ends later than midnight ET for stations west of
> the Eastern zone. The workflow runs with a several-hour margin. If you add
> far-west stations (Hawaii/Alaska), shift the cron later so the prior day is
> fully populated before the pull.
