# Phase 1B — Auth + Database Schema

**Status:** DONE  
**Goal:** Add JWT authentication, database migrations, and a real users table so every future API can be protected.

---

## What Was Built

### Database Migrations
- Custom SQL migration runner embedded in `migrate.js` — runs on every startup
- Tracks applied migrations in `schema_migrations` table (skips already-applied)
- Each migration runs inside a transaction — rolled back automatically on error

### Users Table
```sql
CREATE TABLE users (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,           -- bcrypt hash, cost 12
  role       TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
```

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Email + password → JWT token |
| GET  | `/api/auth/me` | Current user profile (requires Bearer token) |

### JWT Middleware
- All protected routes require `Authorization: Bearer <token>` header
- Token payload: `{ id, email, name, role }`
- Token TTL: 24 hours
- Algorithm: HMAC-SHA256 (jsonwebtoken library)
- Secret loaded from `JWT_SECRET` env var

### Agent Middleware (separate)
- Agent routes require `Authorization: Agent <token>` header
- Token validated against `agent_token` column in `servers` table
- Injects `req.server = { id, name }` for downstream handlers

### Frontend
- Login page (email + password form, full validation)
- Token + user stored in `localStorage` (`sp_token`, `sp_user`)
- `AuthContext` + `useAuth()` hook — reads user from stored token
- Auto-redirect: unauthenticated → `/login`
- Auto-redirect: authenticated on `/login` → `/`
- `api.ts` service — automatically injects `Authorization: Bearer` on every request

---

## Backend Structure (Phase 1B additions)

```
backend/src/
├── auth/
│   ├── jwt.js              ← sign + verify tokens (jsonwebtoken)
│   ├── middleware.js       ← requireAuth — Bearer token validation
│   └── agentMiddleware.js  ← agentAuth — Agent token validation
└── routes/
    └── auth.js             ← POST /api/auth/login, GET /api/auth/me
```

---

## Security Notes

- Passwords hashed with bcrypt, cost factor 12 (bcryptjs)
- JWT signed with HMAC-SHA256
- `JWT_SECRET` must be a long random string in production
- Tokens are stateless — never stored in the database
- User and agent tokens are completely separate (different headers, different middleware)

---

## Default Seeded Admin

On first startup, a default admin user is created if it doesn't exist:

```
Email:    admin@serverpilot.local
Password: changeme
Role:     admin
```

**Change this immediately in any non-local environment.**
