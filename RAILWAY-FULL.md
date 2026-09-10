# Deploy FULL app on Railway (UI + API + PostgreSQL)

One public URL serves:
- Website + staff desk (React)
- API (`/api/...`)
- Database (Railway Postgres)

No Vercel needed.

## Step-by-step

### 1) Push code to GitHub
Include root `Dockerfile` and latest `backend/` + `src/`.

Repo: `gayatri-billing-software`

### 2) Create Railway project
1. Open [https://railway.app](https://railway.app)
2. Login with **GitHub**
3. **New Project** → **Deploy from GitHub repo**
4. Select **gayatri-billing-software**

### 3) Add PostgreSQL
1. In the project: **+ New** → **Database** → **PostgreSQL**
2. Wait until it is **Online**

### 4) Configure the web/API service
Open the service that builds from GitHub (or **+ New** → **GitHub Repo** if needed).

**Settings:**
| Setting | Value |
|--|--|
| Root Directory | `/` (repo root — leave empty) |
| Builder | **Dockerfile** |
| Dockerfile path | `Dockerfile` |

### 5) Variables (API + DB)
On the **same** service → **Variables**:

| Variable | Value |
|--|--|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `SPRING_DATASOURCE_USERNAME` | `${{Postgres.PGUSER}}` |
| `SPRING_DATASOURCE_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `APP_JWT_SECRET` | long random password (32+ characters) |
| `APP_CORS_ORIGINS` | your Railway public URL after step 6 (can set after first deploy) |
| `PORT` | Railway sets this automatically |

If `${{Postgres.*}}` names differ in your dashboard, open Postgres → **Variables** and copy `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.

**Do not set `VITE_API_BASE`** for this setup — UI and API share the same domain (`/api`).

### 6) Public domain
1. Service → **Settings** → **Networking** → **Generate Domain**
2. You get: `https://something.up.railway.app`
3. Open that URL → public site should load
4. Test API: `https://something.up.railway.app/api/health` → should show UP
5. Set `APP_CORS_ORIGINS` = `https://something.up.railway.app` and redeploy if login has CORS issues

### 7) Staff login
1. Open the Railway URL
2. Enter staff desk
3. Use:
   - Owner: `owner@gayatrifunctionhall.com` / `Owner@123`
   - Manager: `desk@gayatrifunctionhall.com` / `Manager@123`
   - HK: `hk@gayatrifunctionhall.com` / `Hk@123`

### 8) Custom domains (public + staff)

| Role | Domain |
|--|--|
| Public website | `gayatriconvention.com` (+ `www`) |
| Staff app | `app.gayatriconvention.com` |

1. Buy **gayatriconvention.com** at GoDaddy / Namecheap / Google Domains / Cloudflare.
2. Railway → your web service → **Settings** → **Networking** → **Custom Domain**
3. Add all three:
   - `gayatriconvention.com`
   - `www.gayatriconvention.com`
   - `app.gayatriconvention.com`
4. Railway shows a **CNAME** (or A/ALIAS) target — copy those into your domain DNS exactly.
5. Wait until Railway shows domains as **Active** (SSL auto).
6. Set Railway variable:
   - `APP_CORS_ORIGINS` = `https://gayatriconvention.com,https://www.gayatriconvention.com,https://app.gayatriconvention.com,https://gayatri-billing-software-production.up.railway.app`
7. Redeploy once after CORS update.

App behaviour (built-in):
- `gayatriconvention.com` → **public** mode
- `app.gayatriconvention.com` → **staff** mode
- Old Railway URL still works with `?mode=public` / `?mode=staff`

---

## Cost (approx.)
₹1,500 – 2,500 / month for UI + API + Postgres on Hobby usage.

## Important
- Bookings / expenses are still mostly in **browser storage** until we migrate desk data to Postgres.
- Login users are in **PostgreSQL**.
- Keep your PC tunnel only for local testing; Railway URL is the real online app.

## If build fails
- Check Railway **Build Logs** (Docker build of Node + Maven can take 5–10 min first time)
- Confirm Root Directory is repo root (not `backend/`)
- Confirm Postgres variables are linked to the web service
