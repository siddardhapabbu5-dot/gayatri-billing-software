# Gayatri on Hostinger VPS — actual production layout

## Architecture

| Piece | Name / role |
|--------|-------------|
| App image | Root `Dockerfile` — React UI + Spring Boot in one container |
| App container | `gayatri-app` |
| Database | `gayatri-db` (Postgres 16) |
| Network | Docker network `gayatri_net` |
| Proxy | Nginx site `gayatri` → TLS → `127.0.0.1:18080` (app publish port) |
| Staff login | `https://gayatriconvention.com/staff` |
| Public site | `https://gayatriconvention.com/` |
| Nginx config in repo | `deploy/nginx-gayatri.conf` → VPS `/etc/nginx/sites-available/gayatri` |

Postgres is the **source of truth** for guests, bookings, payments, enquiries, expenses, refunds and document metadata. Uploaded files live under `APP_UPLOAD_DIR` (must be a **persistent Docker volume**).

---

## Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `SPRING_DATASOURCE_URL` | Yes | e.g. `jdbc:postgresql://gayatri-db:5432/gayatri_vhms` |
| `SPRING_DATASOURCE_USERNAME` | Yes | |
| `SPRING_DATASOURCE_PASSWORD` | Yes | |
| `APP_JWT_SECRET` | Yes | Long random string |
| `APP_SEED_DEMO_USERS` | **Must be `false` in prod** | Default false — never create Owner@123-style demos |
| `APP_UPLOAD_DIR` | Yes | `/data/uploads` inside container |
| `PORT` | Optional | Default `8080` |
| `VITE_API_BASE` | **Leave empty** for same-origin `/api` | Set only if UI is hosted separately |

---

## Volumes (do not omit)

```bash
# Postgres data
docker volume create gayatri_pgdata

# Document / receipt files — survives app container replace
docker volume create gayatri_uploads
```

Compose file: `deploy/docker-compose.prod.yml`.

---

## Build & run (typical)

```bash
cd /opt/gayatri/repo   # or your clone path
git pull origin main

docker build -t gayatri-app:latest .

# Ensure .env has DB password + APP_JWT_SECRET + APP_SEED_DEMO_USERS=false
docker compose -f deploy/docker-compose.prod.yml up -d

docker logs -f gayatri-app
# Expect Flyway V3 applied; "Demo user seeding SKIPPED" when APP_SEED_DEMO_USERS=false
```

Replace app only (keep DB + uploads):

```bash
docker build -t gayatri-app:latest .
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps gayatri-app
```

---

## Nginx (TLS) — production site file

**Canonical config:** [`deploy/nginx-gayatri.conf`](nginx-gayatri.conf)  
**VPS path:** `/etc/nginx/sites-available/gayatri` (symlink from `sites-enabled` as today)

Upstream is **`http://127.0.0.1:18080`** (host publish port for the Spring container). Proxy `location /` with **no** URI rewrite so `/staff/calendar` reaches the app as `/staff/calendar`.

**Do not** keep rules like:

```nginx
# BROKEN — rewrites upstream to /index.html and HTTPS /staff/* returns 404
location = /staff { proxy_pass http://127.0.0.1:18080/index.html; }
location /staff/  { proxy_pass http://127.0.0.1:18080/index.html; }
```

The app (`SpaForwardController` at commit `467b38d`+) already returns HTTP 200 for `GET /staff/calendar` on the upstream. Nginx must pass the path through unchanged. **No Basic Auth / htpasswd.**

Preserved in `deploy/nginx-gayatri.conf`:

- HTTP → HTTPS redirect; ACME at `/var/www/letsencrypt`
- TLS under `/etc/letsencrypt/live/gayatriconvention.com/`
- `gayatriconvention.com` + `www` → site + staff + `/api`
- `app.gayatriconvention.com` → `https://gayatriconvention.com/staff`

### Deploy Nginx on the VPS (exact)

```bash
# On the VPS, from a clone that has the new file (or scp it up)
sudo cp /etc/nginx/sites-available/gayatri /etc/nginx/sites-available/gayatri.bak.$(date +%Y%m%d%H%M%S)

# From the repo root on the VPS:
sudo cp deploy/nginx-gayatri.conf /etc/nginx/sites-available/gayatri

# Or from your PC (adjust user/host):
# scp deploy/nginx-gayatri.conf root@YOUR_VPS:/etc/nginx/sites-available/gayatri

sudo nginx -t
sudo systemctl reload nginx
```

### Verify (exact)

```bash
# Upstream (bypass Nginx) — expect 200
curl -sI http://127.0.0.1:18080/staff/calendar | head -n 1

# HTTPS via Nginx — expect 200 (was 404 with the broken /staff rules)
curl -sI https://gayatriconvention.com/staff/calendar | head -n 1
curl -sI https://gayatriconvention.com/staff | head -n 1
curl -sI https://gayatriconvention.com/ | head -n 1
curl -sI https://gayatriconvention.com/api/health | head -n 1

# Legacy app host — expect 301 to /staff
curl -sI https://app.gayatriconvention.com/ | head -n 5

# Confirm no staff→index.html rewrite remains
sudo grep -n 'staff\|index.html\|18080' /etc/nginx/sites-available/gayatri
```

Staff URLs are path-based (no `#`): `/staff`, `/staff/calendar`, `/staff/rooms`, `/staff/reservations`, etc.

(`deploy/hostinger-nginx.conf` is only a static/`try_files` example — **not** the live VPS site file.)

---

## Local browser data (optional import)

Older desk data may still sit in each browser as `localStorage` key `gayatri-vhms-v3` and IndexedDB `gayatri-files-v1`.

**Safe procedure (does not auto-wipe):**

1. On each staff browser that has important local-only records, open DevTools → Application → Local Storage → copy `gayatri-vhms-v3`, or use the in-app backup helper `exportLocalDeskBackup()` from the console after login.
2. Keep that JSON offline.
3. Re-create critical bookings/payments via the desk (now saved to Postgres), or ask a developer to run a one-off import script against the API.
4. Do **not** delete Postgres data to “match” an old browser.

---

## Acceptance checks after deploy

1. Customer enquiry on phone A → Owner sees it under desk enquiries / bookings on PC B.
2. Owner creates booking + payment → Manager sees same after refresh on another device.
3. Upload document → open on second device; still present after `docker compose up -d --no-deps gayatri-app`.
4. Double-book same hall/date → 409 / clear error (no fake booking number).
5. Roles: Staff cannot hit `/api/admin/users`; Owner can create staff; only Owner creates another Owner.
6. `/staff` login (signed out) / dashboard (signed in); nested paths `/staff/calendar`, `/staff/rooms`, `/staff/reservations`, etc.; never `#staff/login` or `#staff/desk` after navigation; `/` public site; existing owner email still logs in; PWA start URL `/staff`.
7. Direct open / refresh of `/staff/calendar` returns the SPA (200), not nginx/Spring 404.
8. Logs show demo seed **SKIPPED**; live owner account unchanged.
