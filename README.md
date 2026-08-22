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
- Live CPU/RAM/disk/container metrics per server
- Sparkline charts — last 60 heartbeat samples
- Alert badges on offline servers

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
│       ├── notify.js          # Telegram notifications
│       ├── alerts.js          # Alert threshold checks
│       └── routes/
│           ├── servers.js     # Server CRUD + OTP delete
│           ├── agent.js       # Heartbeat + job endpoints
│           ├── backups.js
│           ├── webhooks.js
│           └── ...
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Servers.tsx
│       │   ├── ServerDetail.tsx   # OTP delete modal
│       │   ├── Monitoring.tsx
│       │   ├── Alerts.tsx
│       │   ├── Backups.tsx
│       │   └── ...
│       ├── components/
│       │   ├── Layout.tsx         # Mobile hamburger header
│       │   └── Sidebar.tsx        # Collapsible sidebar (icon mode)
│       └── services/api.ts
├── agent/
│   └── agent.js               # Heartbeat, deployments, backups
└── docker-compose.yml
```

---

## Database

```bash
docker exec sp-postgres psql -U serverpilot -d serverpilot
```

Schema auto-migrates on backend startup via `migrate.js`.
