# Deployment

forecast-game deploys as three pieces:

- **Backend** → [Railway](https://railway.app) (Node + PostgreSQL).
- **Frontend** → GitHub Pages (Vite SPA, auto-deployed by `deploy-frontend.yml`).
- **Daily job** → GitHub Actions (`daily-noaa-pull.yml`) pulling NOAA data and
  running import + scoring against the production DB.

Unlike weather-game, there is **no API key** to manage — `api.weather.gov` is free.

---

## 1. Backend on Railway

1. Create a new Railway project and add a **PostgreSQL** plugin. Railway sets
   `DATABASE_URL` automatically for the service.
2. Create a service from this repo with **root directory `backend/`**.
3. Set environment variables (Railway → Variables):

   | Variable | Example | Notes |
   |---|---|---|
   | `DATABASE_URL` | *(from the Postgres plugin)* | Postgres connection string |
   | `JWT_SECRET` | *(long random string)* | Signs auth tokens |
   | `JWT_EXPIRES_IN` | `7d` | Optional |
   | `PORT` | `3001` | Railway also injects `PORT`; the app respects it |
   | `FRONTEND_ORIGIN` | `https://ekbugo.github.io` | Comma-separated list allowed; add your custom domain here |
   | `NODE_ENV` | `production` | |

4. `railway.json` runs `npm install && prisma generate && prisma migrate deploy`
   on build and `npm start` on deploy. The committed migration under
   `backend/prisma/migrations/` creates the schema on first deploy.
5. Seed the stations once (Railway shell or locally against the prod `DATABASE_URL`):

   ```bash
   cd backend && npm run db:seed
   ```

### CORS

The API allows only the origins in `FRONTEND_ORIGIN`. For GitHub Pages under the
default domain that is `https://<user>.github.io` (the path is not part of the
origin). Add every origin you serve from, comma-separated.

---

## 2. Frontend on GitHub Pages

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Add repo secret **`VITE_API_URL`** = your Railway API base **including `/api`**,
   e.g. `https://forecast-game-production.up.railway.app/api`.
3. Push any change under `frontend/**` (or run the workflow manually). The build
   sets `GITHUB_PAGES=true`, so Vite's `base` is `/forecast-game/`.
   - **Custom domain:** set `VITE_CUSTOM_DOMAIN=true` in the build step and change
     `pathSegmentsToKeep` to `0` in `frontend/public/404.html`.

`404.html` + the redirect snippet in `index.html` handle SPA deep links on Pages.

---

## 3. Daily job (GitHub Actions)

`daily-noaa-pull.yml` runs on a cron (`0 11 * * *` UTC ≈ early-morning ET, with a
lag margin so the prior day's observations are published) and on manual dispatch.

Add repo secret:

| Secret | Value |
|---|---|
| `DATABASE_URL` | the **production** Postgres URL (same as Railway) |

Each run: `rotate-station` → pull yesterday's actuals for yesterday's scheduled
station → `import-readings` + `calculate-scores` → commit the JSON to
`data-pull/output/`. Because a file committed in Actions is **not** visible to the
running Railway service, all DB writes happen here against `DATABASE_URL` directly
— there is no ingest endpoint (§7.2).

> The commit uses `[skip ci]` and the Pages deploy is path-scoped to `frontend/**`,
> so daily data commits never trigger a frontend redeploy (§7.3).

### Keeping the schedule populated

Edit `data-pull/schedule.json` (dates in `America/New_York` → station ID) and keep
it **at least a week ahead**. Every station must exist in `data-pull/stations.json`.
`rotate-station` warns loudly in the workflow log when today's entry is missing
(it keeps the previous station) or when fewer than 7 future entries remain.

---

## Environment variable reference

**backend/.env**

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
PORT=3001
FRONTEND_ORIGIN=https://ekbugo.github.io
NODE_ENV=production
```

**frontend/.env**

```
VITE_API_URL=https://your-railway-app.up.railway.app/api
```

Never commit real secrets — only `.env.example` files are tracked.
