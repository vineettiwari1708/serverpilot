# Phase 1B — Auth + Database Schema

**Status:** UPCOMING  
**Goal:** Add JWT authentication, database migrations, and a real users table so every future API can be protected.

---

## What Will Be Built

### Database Migrations
- Tool: `golang-migrate` (single binary, runs on startup)
- Migration files: `migrations/001_create_users.up.sql`, `001_create_users.down.sql`
- Schema applied automatically when backend starts

### Users Table
```sql
CREATE TABLE users (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,           -- bcrypt hash
  role       TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Email + password → JWT token |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Current user profile |

### JWT Middleware
- All protected routes require `Authorization: Bearer <token>` header
- Token contains: `user_id`, `email`, `role`, `exp`
- Token TTL: 24 hours
- Secret loaded from `JWT_SECRET` env var

### Frontend
- Login page (email + password form)
- Token stored in `localStorage`
- `useAuth` hook — reads user from token
- Auto-redirect: unauthenticated → `/login`
- Auto-redirect: authenticated on `/login` → `/`

---

## New Package Structure

```
backend/
├── internal/
│   ├── auth/
│   │   ├── jwt.go          ← sign + verify tokens
│   │   └── middleware.go   ← HTTP middleware, injects user into context
│   ├── db/
│   │   └── postgres.go     ← real pgx connection pool
│   └── handler/
│       ├── auth.go         ← login / logout / me
│       └── user.go         ← user CRUD (admin only)
├── migrations/
│   ├── 001_create_users.up.sql
│   └── 001_create_users.down.sql
```

---

## Security Notes

- Passwords hashed with bcrypt cost factor 12
- JWT signed with HMAC-SHA256
- `JWT_SECRET` must be at least 32 characters in production
- Login endpoint rate-limited to 10 requests/minute per IP
- Tokens never stored in the database (stateless JWT)

---

## Default Seeded User

On first startup, a default admin user is created:

```
Email:    admin@serverpilot.local
Password: changeme
Role:     admin
```

**Change this immediately in production.**
