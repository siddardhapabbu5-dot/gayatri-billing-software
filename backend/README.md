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

## Seed staff accounts

| Email | Password | Role |
|---|---|---|
| `owner@gayatrifunctionhall.com` | `Owner@123` | ADMIN |
| `desk@gayatrifunctionhall.com` | `Manager@123` | MANAGER |
| `front@gayatrifunctionhall.com` | `Front@123` | FRONTDESK |
| `hk@gayatrifunctionhall.com` | `Hk@123` | HOUSEKEEPING |
| `accounts@gayatrifunctionhall.com` | `Accounts@123` | ACCOUNTS |

Change passwords in production. Set `app.jwt.secret` via env / profile.

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

Admin-only user management:

```http
GET  /api/admin/users
POST /api/admin/users
```

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

## Config

See `src/main/resources/application.yml`:

- DB: `jdbc:postgresql://localhost:5433/gayatri_vhms` / `gayatri` / `gayatri123`
- CORS: Vite on `http://localhost:5177`
