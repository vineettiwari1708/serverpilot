# ServerPilot

A self-hosted server monitoring and deployment management panel. Monitor CPU, RAM, disk and Docker containers across multiple servers, manage deployments via webhooks, run database backups, and receive instant Telegram notifications.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js 20, Express |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Reverse Proxy | Traefik v3 |
| Agent | Node.js (Docker socket access) |
| Containerisation | Docker Compose |

---

## Services & Ports

| Container | Role | URL |
|---|---|---|
| `sp-frontend` | React dashboard (Nginx) | http://localhost:8082 |
| `sp-backend` | REST API | http://localhost:8081 |
| `sp-postgres` | PostgreSQL | localhost:5433 |
| `sp-redis` | Redis | internal |
| `sp-traefik` | Reverse proxy | :80 (dashboard: :8080) |
| `sp-agent-local` | Local machine agent | internal |

---

## Getting Started

### Prerequisites
- Docker Desktop
- Docker Compose v2

### Run

```bash
cd d:\Project\serverpilot
docker compose up -d
```

Dashboard: **http://localhost:8082**

### Default Login

| Field | Value |
|---|---|
| Email | admin@serverpilot.local |
| Password | changeme |

### Stop

```bash
docker compose down
```

---

## Environment Variables

`d:\Project\serverpilot\.env`:

```env
DB_NAME=serverpilot
DB_USER=serverpilot
DB_PASSWORD=secret123
JWT_SECRET=change-this-to-a-long-random-string-in-production
AGENT_SECRET=change-this-agent-secret-too
APP_ENV=development
BACKEND_PORT=8081
SEED_ADMIN_EMAIL=admin@serverpilot.local
SEED_ADMIN_PASSWORD=changeme
SEED_ADMIN_NAME=Admin

# Telegram notifications
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
TELEGRAM_CHAT_ID=your-chat-id

# App-level metrics — pick ONE of these two options:
# Option A: docker exec (no network changes needed — agent uses Docker socket)
APP_METRICS_CONTAINER=erpnew-erpnew-backend-1
# Option B: direct HTTP (agent must be on the same Docker network as the app)
# APP_METRICS_URL=http://erpnew-erpnew-backend-1:5001/metrics
```

---

## Features

### Servers
- Register servers via agent heartbeat (every 30s)
- Live CPU, RAM, disk, Docker container count
- **OTP-secured delete** — clicking Delete sends a 6-digit OTP to Telegram; server is only deleted after OTP is verified
- Tag servers (prod, staging, dev) and filter by tag
- Responsive sidebar — collapses to icon-only on desktop, hamburger menu on mobile

### Telegram Notifications
Every server deletion sends a Telegram message with server name, who deleted it, and the time (IST).

Setup:
1. Create a bot via @BotFather on Telegram → get token
2. Start the bot, fetch `https://api.telegram.org/bot<TOKEN>/getUpdates` → get chat ID
3. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to `.env`
4. Restart backend: `docker compose up -d backend`

### Monitoring

#### Infrastructure Metrics (always available)
- Live CPU, RAM, disk, Docker container count per server
- Line charts — last 60 heartbeat samples (refreshes every 30s)
- Alert badges on offline servers

#### Application Metrics (when `/metrics` endpoint is configured)

ServerPilot collects 4 app-level metrics from the monitored application on every heartbeat:

| Metric | What it means |
|---|---|
| **Req/s** | HTTP requests per second (60-second sliding window) |
| **Errors %** | Percentage of requests returning 4xx or 5xx status codes |
| **Avg latency** | Mean response time in milliseconds |
| **P95 latency** | 95th percentile response time — 95% of requests finished within this time |

These appear in the server header and in two extra charts in the Metrics tab (Req/s & Error Rate, and Latency).

**Reading the numbers together:**

| CPU | Req/s | Errors | Latency | Diagnosis |
|---|---|---|---|---|
| 90% | 500 | 0% | 50ms | 📈 **System Load** — healthy, scale out replicas |
| 90% | 10 | 80% | 5000ms | 💥 **Overload + Errors** — app failing under load |
| 10% | 5 | 100% | 7ms | 🔥 **App Fault** — fast but rejecting everything (auth error, bug, bad config) |
| 10% | 5 | 0% | 8000ms | ⏱️ **Slow Response** — DB query bottleneck, external API timeout |
| Any | Any | <5% | <500ms | ✅ **Healthy** — normal operation |

> **Key insight:** CPU alone cannot tell you whether the problem is load or fault. A server at 90% CPU with 0 errors is just busy — scale it. The same server at 90% CPU with 80% errors has a bug — scaling will only make it worse.

**How it works:**

1. The monitored app exposes a `GET /metrics` endpoint (no auth needed)
2. The agent calls `docker exec <container> node -e "fetch localhost:5001/metrics"` every 30s — no network changes required, uses the Docker socket
3. Metrics are stored alongside CPU/RAM/disk in the `heartbeats` table
4. Dashboard shows the fault vs load diagnosis badge in real time

**Setting up `/metrics` on your app:**

Add this middleware to your Express backend:

```javascript
// src/middleware/metrics.js
const WINDOW = 60 * 1000
const _times = [], _errors = [], _durations = []

function cleanup() {
  const cutoff = Date.now() - WINDOW
  let i
  for (i = 0; i < _times.length    && _times[i] < cutoff;       i++); if (i) _times.splice(0, i)
  for (i = 0; i < _errors.length   && _errors[i] < cutoff;      i++); if (i) _errors.splice(0, i)
  for (i = 0; i < _durations.length && _durations[i].t < cutoff; i++); if (i) _durations.splice(0, i)
}

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics' || req.path === '/health') return next()
  const start = Date.now()
  _times.push(start)
  res.on('finish', () => {
    _durations.push({ t: Date.now(), ms: Date.now() - start })
    if (res.statusCode >= 400) _errors.push(Date.now())
  })
  next()
}

function metricsEndpoint(_req, res) {
  cleanup()
  const total = _times.length, errors = _errors.length
  const avgMs = _durations.length ? Math.round(_durations.reduce((s, d) => s + d.ms, 0) / _durations.length) : 0
  const p95Ms = _durations.length ? [..._durations].sort((a,b)=>a.ms-b.ms)[Math.floor(_durations.length*0.95)].ms : 0
  res.json({ window_sec: 60, requests: total, req_per_sec: parseFloat((total/60).toFixed(2)),
             errors, error_rate_pct: total ? parseFloat(((errors/total)*100).toFixed(1)) : 0,
             avg_latency_ms: avgMs, p95_latency_ms: p95Ms })
}

module.exports = { metricsMiddleware, metricsEndpoint }
```

```javascript
// In server.js
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics')
app.use(metricsMiddleware)
app.get('/metrics', metricsEndpoint)
```

Then set in `.env`:
```env
APP_METRICS_CONTAINER=your-backend-container-name
```

### Applications
- Deploy Docker Compose apps to registered servers
- Webhook trigger: `POST /api/webhooks/deploy/{token}`
- Deployment history and logs

### Backups
- **PostgreSQL via Docker** — `pg_dump` inside container, no network needed
- **PostgreSQL direct** — via `postgres://` URL
- **Files** — `tar.gz` archive of a directory
- Scheduled recurring backups

Backup files stored in Docker volume `sp-backups`, accessible via:

```powershell
docker exec sp-agent-local ls /opt/serverpilot/backups
docker cp sp-agent-local:/opt/serverpilot/backups/<file> .
```

### Alerts
- Threshold alerts for CPU / RAM / disk (configurable per server)

### Audit Log
- All user actions logged with timestamp, IP, and resource

### Users
- Admin account management with role-based access

---

## Monitoring an External Project (e.g. ERP)

To make an external Docker project appear in ServerPilot as a monitored server:

```powershell
# 1. Register the server
$result = Invoke-RestMethod -Method POST -Uri "http://localhost:8081/api/agent/register" `
  -ContentType "application/json" `
  -Body '{"name":"ERP New Docker","hostname":"erpnew-docker.local","ip":"127.0.0.1","agent_secret":"change-this-agent-secret-too"}'

# 2. Run an agent container with the returned token
docker run -d --name sp-agent-erpnew `
  -e CONTROL_URL=http://host.docker.internal:8081 `
  -e AGENT_TOKEN=$($result.token) `
  -e HEARTBEAT_INTERVAL=30000 `
  -v /var/run/docker.sock:/var/run/docker.sock `
  --restart unless-stopped `
  serverpilot-agent:latest
```

The ERP server now appears online in the dashboard with live metrics.

---

## Rebuild After Code Changes

```bash
docker compose build backend && docker compose up -d backend
docker compose build frontend && docker compose up -d frontend
```

---

## CI/CD — GitHub Actions (Self-Hosted Runner)

Defined in `.github/workflows/deploy.yml`. On push to `main`:
1. Builds frontend and backend Docker images
2. Calls the ServerPilot webhook to redeploy

Runner runs locally — polls GitHub, no inbound ports needed.

---

## Project Structure

```
serverpilot/
├── backend/
│   └── src/
│       ├── server.js          # Entry point
│       ├── migrate.js         # Auto-runs DB migrations on startup
│       ├── scheduler.js       # Backup schedule runner
│       ├── notify.js          # Telegram + sendTelegram()
│       ├── alerts.js          # Alert threshold checks + metrics history endpoint
│       └── routes/
│           ├── servers.js     # Server CRUD + OTP-secured delete
│           ├── agent.js       # Heartbeat (stores CPU/RAM/app metrics) + job endpoints
│           ├── containers.js  # Server detail + container actions
│           ├── backups.js
│           ├── webhooks.js
│           └── ...
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Servers.tsx
│       │   ├── ServerDetail.tsx   # OTP delete modal, app metrics header + charts
│       │   ├── Monitoring.tsx
│       │   ├── Alerts.tsx
│       │   ├── Backups.tsx
│       │   └── ...
│       ├── components/
│       │   ├── Layout.tsx         # Mobile hamburger header
│       │   └── Sidebar.tsx        # Collapsible sidebar (icon mode)
│       └── services/api.ts
├── agent/
│   └── agent.js               # Heartbeat, app metrics polling, deployments, backups
└── docker-compose.yml
```

---

## Database

```bash
docker exec sp-postgres psql -U serverpilot -d serverpilot
```

Schema auto-migrates on backend startup via `migrate.js`.

---

## Author

**Vineet Tiwari**
- GitHub: [@vineettiwari1708](https://github.com/vineettiwari1708)
- Email: vineettiwari1708@gmail.com

Built from scratch as a full-stack DevOps monitoring project — backend in Node.js/Express, frontend in React/TypeScript, deployed via Docker Compose.
