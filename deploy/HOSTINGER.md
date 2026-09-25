# Gayatri on Hostinger VPS — actual production layout

## Architecture

| Piece | Name / role |
|--------|-------------|
| App image | Root `Dockerfile` — React UI + Spring Boot in one container |
| App container | `gayatri-app` |
| Database | `gayatri-db` (Postgres 16) |
| Network | Docker network `gayatri_net` |
| Proxy | Nginx + TLS terminates HTTPS → `127.0.0.1:8080` |
| Staff login | `https://gayatriconvention.com/staff` |
| Public site | `https://gayatriconvention.com/` |

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

## Nginx (TLS)

Proxy HTTPS to the app. **No AuthType Basic / htpasswd** (staff login is `/staff`).

```nginx
location / {
  proxy_pass http://127.0.0.1:8080;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 110M;
}
```

`/staff` is handled by the SPA inside the app — no separate static upload of `dist/` is required when using this Docker image.

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
6. `/staff` login; `/` public site; existing owner email still logs in; PWA start URL `/staff`.
7. Logs show demo seed **SKIPPED**; live owner account unchanged.
