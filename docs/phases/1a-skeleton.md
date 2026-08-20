# Phase 1A — Skeleton + Infrastructure

**Status:** DONE  
**Goal:** Get the full development environment running with all infrastructure services connected.

---

## What Was Built

### Backend (Go)
- Pure standard-library Go server — zero external dependencies
- `GET /health` — simple liveness check
- `GET /api/health` — same, used by frontend widget
- `GET /api/status` — dials Postgres and Redis over TCP in parallel, returns latency and connectivity for each service
- Graceful shutdown on SIGINT/SIGTERM
- Structured JSON logging with `log/slog`
- 15s read/write timeouts

### Internal Package Structure
```
backend/
├── cmd/server/main.go              ← entry point, router, shutdown
├── internal/
│   ├── config/config.go            ← all env vars in one struct
│   └── handler/
│       ├── common.go               ← shared writeJSON helper
│       ├── health.go               ← health handler
│       └── status.go               ← TCP connectivity checker
```

### Frontend (React + TypeScript + Vite + Tailwind)
- Dark DevOps-themed UI with custom design tokens
- Full sidebar navigation (10 nav items + bottom section)
- Inline SVG icons — no external icon library
- Dashboard with live `/api/status` polling every 30 seconds
- Real green/red status dots with latency for Postgres and Redis
- Build progress tracker showing all 8 phases
- Placeholder pages for all future routes

### Docker Compose
- **Traefik v3** — reverse proxy, routes `/api/*` to backend, `/` to frontend
- **sp-backend** — Go binary, port 8081 exposed to host
- **sp-postgres** — PostgreSQL 16 Alpine, health-checked, port 5433 on host
- **sp-redis** — Redis 7 Alpine, health-checked
- All services on isolated `sp-net` bridge network
- Named volumes for data persistence

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness — returns `{status: "ok"}` |
| GET | `/api/health` | Same as above (for frontend proxy) |
| GET | `/api/status` | Full infra status: backend + postgres + redis |

### Example `/api/status` Response
```json
{
  "status": "ok",
  "version": "0.1.0",
  "env": "development",
  "uptime_seconds": 42,
  "goroutines": 5,
  "services": {
    "postgres": { "status": "ok", "latency_ms": 11 },
    "redis":    { "status": "ok", "latency_ms": 11 }
  },
  "timestamp": "2026-08-20T12:42:23Z"
}
```

---

## How to Run

```bash
# Terminal 1 — backend + databases
cd d:/Project/serverpilot
docker compose up backend postgres redis --build

# Terminal 2 — frontend (hot reload)
cd d:/Project/serverpilot/frontend
npm install
npm run dev
```

Open: `http://localhost:5173`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8081` | Backend listen port |
| `APP_ENV` | `development` | Environment label |
| `DATABASE_URL` | — | Postgres connection string |
| `REDIS_URL` | `redis:6379` | Redis address |
| `JWT_SECRET` | `dev-secret` | Signing key (Phase 1B) |
| `AGENT_SECRET` | `dev-agent-secret` | Agent auth key (Phase 2) |
