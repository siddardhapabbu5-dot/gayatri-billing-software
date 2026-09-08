# Deploy Gayatri API on Railway

> **Prefer full UI + API on one URL?** See **[RAILWAY-FULL.md](../RAILWAY-FULL.md)** (root Dockerfile).

Your stack on Railway (API-only mode): **PostgreSQL** + **Spring Boot API** (`backend/`).  
Website (React) can stay separate — or use the full Dockerfile instead.

## 1) Create Railway project

1. Open [https://railway.app](https://railway.app) → Sign up with **GitHub**
2. **New Project** → **Deploy from GitHub repo**  
   Select: `siddardhapabbu5-dot/gayatri-billing-software`
3. After import, open the service → **Settings** → **Root Directory** = `backend`
4. **Settings** → Builder = **Dockerfile** (uses `backend/Dockerfile`)

## 2) Add PostgreSQL

1. In the same project: **+ New** → **Database** → **PostgreSQL**
2. Open the **API service** → **Variables** → **Add variable reference** (or connect Postgres)
3. Set these variables on the **API** service:

| Variable | Value |
|--|--|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `SPRING_DATASOURCE_USERNAME` | `${{Postgres.PGUSER}}` |
| `SPRING_DATASOURCE_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `APP_JWT_SECRET` | long random string (32+ chars) |
| `APP_CORS_ORIGINS` | your Vercel URL, e.g. `https://gayatri.vercel.app` (comma-separate if several) |
| `PORT` | `8080` (Railway often sets this automatically) |

Railway variable names for Postgres can differ slightly — if references fail, copy **Public** / **Database URL** from Postgres and build:

`jdbc:postgresql://HOST:PORT/DATABASE`  
(username / password from the Postgres service)

## 3) Public URL for API

1. API service → **Settings** → **Networking** → **Generate Domain**  
2. You get something like: `https://gayatri-api-production.up.railway.app`  
3. Health check: `https://YOUR-API.up.railway.app/api/health`

## 4) Frontend (Vercel) — connect to Railway

1. Deploy frontend to [Vercel](https://vercel.com) from the same GitHub repo (root = project root, build `npm run build`, output `dist`)
2. Vercel → **Environment Variables**:
   - `VITE_API_BASE` = `https://YOUR-API.up.railway.app`  
     (no trailing slash)
3. Redeploy frontend
4. Update Railway `APP_CORS_ORIGINS` to the Vercel URL, then redeploy API

## 5) Custom domain later

- Buy domain (BigRock / GoDaddy)
- Point `api.yourdomain.com` → Railway  
- Point `www.yourdomain.com` → Vercel  
- Update `VITE_API_BASE` and `APP_CORS_ORIGINS`

## Login (same as local)

| Email | Password |
|--|--|
| `owner@gayatrifunctionhall.com` | `Owner@123` |

Change passwords after go-live.

## Important

- Staff **login** uses Railway API + Postgres.
- Most **booking / billing / expense** data is still in the **browser localStorage** on each device until you migrate that to the API. For multi-PC sync later, we need API storage for bookings.
- Never commit real JWT secrets; set them only in Railway Variables.
