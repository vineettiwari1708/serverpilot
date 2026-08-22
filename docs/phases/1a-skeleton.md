# Phase 1A — Skeleton + Infrastructure

**Status:** DONE  
**Goal:** Get the full development environment running with all infrastructure services connected.

---

## What Was Built

### Backend (Node.js + Express)
- Express server with structured JSON logging
- `GET /health` — simple liveness check
- `GET /api/health` — same, used by frontend Vite proxy
- `GET /api/status` — dials Postgres and Redis over TCP in parallel, returns latency and connectivity for each service
- `dotenv` for environment configuration
- Graceful startup error handling (EADDRINUSE detection)

### Backend Module Structure
```
backend/src/
├── server.js       ← entry point, registers all routes
├── config.js       ← all env vars in one object
├── logger.js       ← structured JSON logger
├── db.js           ← pg pool (node-postgres)
├── migrate.js      ← embedded SQL migration runner
├── seed.js         ← seeds default admin user
└── routes/
    ├── health.js   ← GET /health, GET /api/health
    └── status.js   ← GET /api/status (dials Postgres + Redis)
```

### Frontend (React + TypeScript + Vite + Tailwind)
- Dark DevOps-themed UI with custom design tokens
- Full sidebar navigation with inline SVG icons
- Dashboard with live `/api/status` polling every 30 seconds
- Real green/red status dots with latency for Postgres and Redis
- Build progress tracker showing all phases
- Placeholder pages for all future routes

### Docker Compose
- **Traefik v3** — reverse proxy, routes `/api/*` to backend, `/` to frontend
- **sp-backend** — Node.js on port 8081 (exposed to host)
- **sp-postgres** — PostgreSQL 16 Alpine, health-checked, port 5433 on host
- **sp-redis** — Redis 7 Alpine, health-checked
- All services on isolated `sp-net` bridge network
- Named volumes for data persistence

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness — returns `{status: "ok"}` |
| GET | `/api/health` | Same (for Vite proxy) |
| GET | `/api/status` | Full infra status: backend + postgres + redis |

### Example `/api/status` Response
```json
{
  "status": "ok",
  "version": "0.2.0",
  "env": "development",
  "uptime_seconds": 42,
  "services": {
    "postgres": { "status": "ok", "latency_ms": 2 },
    "redis":    { "status": "ok", "latency_ms": 2 }
  },
  "timestamp": "2026-08-21T05:43:36Z"
}
```

---

## How to Run

```bash
cd d:/Project/serverpilot
docker compose up -d --build
```

Open: `http://localhost:8082`

The full stack (backend, frontend, postgres, redis, traefik, agent) runs via Docker Compose.  
Frontend is served by nginx on port 8082; backend API is on port 8081.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8081` | Backend listen port |
| `APP_ENV` | `development` | Environment label |
| `DATABASE_URL` | — | Postgres connection string |
| `REDIS_URL` | `redis:6379` | Redis address |
| `JWT_SECRET` | `dev-secret` | Signing key |
| `AGENT_SECRET` | `dev-agent-secret` | Agent auth key |
| `SEED_ADMIN_EMAIL` | `admin@serverpilot.local` | Seeded admin email |
| `SEED_ADMIN_PASSWORD` | `changeme` | Seeded admin password |
