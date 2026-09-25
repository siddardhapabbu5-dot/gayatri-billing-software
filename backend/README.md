# Gayatri VHMS Backend

Spring Boot 3 + PostgreSQL API for Gayatri Convention staff desk.

## Stack

- Java 17, Spring Boot 3.3, Spring Security (JWT)
- PostgreSQL 16 (Docker Compose)
- Flyway migrations
- Role-based access: `ADMIN`, `MANAGER`, `FRONTDESK`, `HOUSEKEEPING`, `ACCOUNTS`

## Quick start

```bash
# 1) Database (Postgres on host port 5433)
cd backend
docker compose up -d

# 2) API (port 8080)
mvn spring-boot:run
```

Health check: [http://localhost:8080/api/health](http://localhost:8080/api/health)

## Demo staff accounts (development only)

Demo seeding is **off by default**. Nothing is created and no existing password is ever
changed unless you explicitly opt in with `APP_SEED_DEMO_USERS=true`, which should only
ever point at a throwaway database. When the flag is off, startup logs
`Demo user seeding SKIPPED`.

| Email | Password | Role |
|---|---|---|
| `owner@gayatrifunctionhall.com` | `Owner@123` | ADMIN |
| `desk@gayatrifunctionhall.com` | `Manager@123` | MANAGER |
| `front@gayatrifunctionhall.com` | `Front@123` | FRONTDESK |
| `hk@gayatrifunctionhall.com` | `Hk@123` | HOUSEKEEPING |
| `accounts@gayatrifunctionhall.com` | `Accounts@123` | ACCOUNTS |

For production, create the first owner account directly in the database (bcrypt hash) and
then use `POST /api/admin/users`. Set `app.jwt.secret` via env / profile.

## Auth

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "owner@gayatrifunctionhall.com", "password": "Owner@123" }
```

Response includes `token` (Bearer JWT) and `user` with `role` + `permissions`.

```http
GET /api/auth/me
Authorization: Bearer <token>
```

Admin / manager user management:

```http
GET  /api/admin/users
POST /api/admin/users
```

Body for create: `{ "email", "password", "fullName", "role" }` where role is
`ADMIN` | `MANAGER` | `FRONTDESK` (staff) | `HOUSEKEEPING` | `ACCOUNTS`.
Only `ADMIN` may create another `ADMIN`.

## Public APIs (no token)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/public/enquiries` | Website booking / contact form |

Body: `{ name, phone, email, date, hall, guests, message, agreeHall, agreeRoom }`.
`hall` accepts a code (`IMP`), an exact name, or a unique partial name. Creates the guest if
new, an `Enquiry` booking numbered `ENQ-<year>-<n>`, and — when the hall resolves and the
date is free — a tentative hall reservation. **A clashing date returns `409` instead of a
fake success**, so the site never promises a date that is already taken.

## Main APIs (JWT required)

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/api/guests` | guests |
| GET | `/api/halls` | venues / reservations / calendar |
| GET | `/api/rooms` | rooms |
| PUT | `/api/rooms/{id}/status` | rooms |
| GET/POST | `/api/bookings` | reservations (+ billing/calendar for GET) |
| POST | `/api/bookings/{id}/cancel` | reservations |
| GET/POST | `/api/bookings/{id}/payments` | billing |
| GET/POST | `/api/bookings/{id}/refunds` | billing |
| POST | `/api/refunds/{id}/approve?status=&note=` | role `ADMIN` or `MANAGER` |
| GET | `/api/refunds` | billing |
| GET | `/api/enquiries` | reservations / guests |
| PUT | `/api/enquiries/{id}/status` | reservations / guests |
| GET/POST | `/api/expenses` | expenses |
| PUT | `/api/expenses/{id}/verify?verified=` | role `ADMIN` or `MANAGER` |
| GET/POST | `/api/documents` | documents |
| GET | `/api/documents/{id}/file` | documents |
| GET | `/api/desk/snapshot` | any signed-in staff |

`POST /api/bookings` accepts `hallIds`, `roomIds`, `slotType` (`full-day` default, or
`half-day`), and optional `roomCheckIn` / `roomCheckOut` (default `eventDate` →
`eventDate + 1`). Halls and rooms are locked and conflict-checked inside one transaction:
a clash returns `409` and nothing is written. `BookingResponse` carries `hallCodes`,
`roomNumbers`, `paymentsTotal` and `folioId`.

`GET /api/desk/snapshot` returns one aggregate (guests, halls, rooms, bookings, payments,
enquiries, expenses, refunds, document metadata, invoices) so phone, tablet and desktop
converge on the same server state. Writes stay permission-checked per endpoint.

`POST /api/documents` is `multipart/form-data` with `file` plus optional `bookingId`,
`guestId`, `typeCode`. Images and PDFs are capped at 8 MB, video at 100 MB, and the MIME
type is validated server-side.

The two sign-off actions take no request body — like `/bookings/{id}/cancel` — so they work
from any HTTP client: `POST /api/refunds/{id}/approve?status=Rejected&note=...`
(`status` defaults to `Approved`, and may be `Paid` or `Rejected`) and
`PUT /api/expenses/{id}/verify?verified=false` (defaults to `true`). A refund can only be
decided once; a second attempt returns `409`.

## Config

See `src/main/resources/application.yml`:

- DB: `jdbc:postgresql://localhost:5433/gayatri_vhms` / `gayatri` / `gayatri123`
- CORS: `app.cors.allowed-origins` (`*` on Railway, same-origin UI + API)

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | local Postgres on `5433` | Database |
| `APP_JWT_SECRET` | dev placeholder | JWT signing key — **must** be set in production |
| `APP_JWT_EXPIRATION_MS` | `86400000` | Token lifetime |
| `APP_CORS_ORIGINS` | `*` | Allowed origins |
| `APP_UPLOAD_DIR` | `/data/uploads` | Volume for uploaded documents / media. Must be a mounted persistent disk, otherwise files vanish on redeploy. |
| `APP_SEED_DEMO_USERS` | `false` | Create demo staff logins. Leave `false` in production. |
| `APP_MAX_UPLOAD_SIZE` | `100MB` | Servlet multipart ceiling (per-type limits are stricter) |

## Migrations

Flyway, additive only:

- `V1__schema.sql` — core schema
- `V2__seed_master.sql` — halls, room types, rooms
- `V3__ops_persistence.sql` — `enquiries`, `expenses`, `refunds`, `documents`, `invoices`
  plus conflict-lookup indexes on `hall_reservations` / `room_reservations`
