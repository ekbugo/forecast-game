# Precipitation Handling

Some official US NWS/ASOS stations **do not report precipitation** at all, while
others report a genuine `0.00"` on dry days. Treating those two cases the same
would silently corrupt scoring. This document is the authoritative description of
how forecast-game distinguishes them end to end.

## The two cases

| Case | Puller output | DB reading | Shown to user | Precip score |
|---|---|---|---|---|
| Station reports precip, dry day | `precipReported: true`, `precipTotalIn: 0.0` | `precipReported=true`, `precipTotal=0.00`, `precipRange=1` | `0.00" – 0.10"` (Range 1) | scored normally |
| Station never reports precip | `precipReported: false`, `precipTotalIn: null` | `precipReported=false`, `precipTotal=NULL`, `precipRange=NULL` | **N/A** | **0** |

## How "does this station report precip?" is decided (puller)

`data-pull/daily_weather_pull.py` does not rely on a single day. After pulling the
target day, it looks back `PRECIP_LOOKBACK_DAYS` (14) of observations and checks
whether the station reported **any** non-null `precipitationLastHour`:

- If it **never** reported in that window → `precipReported: false`, total `null`.
- If it **did** report and the target day summed to zero → `precipReported: true`,
  total `0.00` (a real dry day).

The curated `precipReported` flag in `stations.json` is a hint/default; the puller
is the runtime source of truth and may refresh it over time.

## Scoring rule (§6.5)

In `backend/src/services/scoringService.js`, `calculateTotalScore`:

- When the reading has `precipReported === false` (or a null `precipRange`), the
  **precipitation category scores 0** — it is *not* dropped from the total.
- Because the precipitation sub-score can never be 5 on a non-reporting day, the
  **Perfect Forecast Bonus (+3) is unachievable** that day. This is expected
  behavior, **not a bug** — the all-perfect bonus rule itself is unchanged.

A maximum day therefore looks like:

- Reporting station: `5 + 5 + 5 + 5 + 3 (perfect bonus) = 23`
- Non-reporting station: `5 + 5 + 5 + 0 = 15` (no bonus possible)

## UI rule (§8)

The frontend renders **N/A vs. a real number** distinctly so N/A never looks like
a broken `0.00"`:

- The forecast page disables the precipitation selector and shows an explanatory
  note when the current station doesn't report precip.
- The home page and score history show `N/A` for the actual precipitation with a
  short tooltip: *"This station doesn't report precipitation, so that category
  scores 0 for everyone today."*

## Data contract summary

- Puller JSON: `precipReported` (bool) + `precipTotalIn` (number **or** `null`).
- `StationReading`: `precip_reported` (bool), `precip_total` (nullable), and
  `precip_range` (nullable 1–7).
- Importer (`processStationReading`) preserves the typed null; it never coerces a
  missing precip into `0`.
