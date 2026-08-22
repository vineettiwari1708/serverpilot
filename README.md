# ServerPilot Local v0.2

A self-hosted server management control panel for monitoring servers, managing Docker application deployments, running database backups, and tracking audit logs.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| Reverse Proxy | Traefik v3 |
| Agent | Node.js (runs inside Docker, has Docker socket access) |
| Containerisation | Docker Compose |

---

## Services & Ports

| Container | Role | URL |
|---|---|---|
| `sp-frontend` | React SPA served by nginx | http://localhost:8082 |
| `sp-backend` | REST API | http://localhost:8081 |
| `sp-postgres` | PostgreSQL | localhost:5433 |
| `sp-redis` | Redis | internal only |
| `sp-traefik` | Reverse proxy | http://localhost:80 (dashboard: 8080) |
| `sp-agent-local` | Local server agent | internal only |

---

## Getting Started

### Prerequisites
- Docker Desktop (Windows / Mac / Linux)
- Docker Compose v2

### Run

```bash
cd d:\Project\serverpilot
docker compose up -d
```

The UI is available at **http://localhost:8082**

### Default Login

| Field | Value |
|---|---|
| Email | admin@serverpilot.local |
| Password | changeme |

Change these via the `.env` file (see below).

### Stop

```bash
docker compose down
```

---

## Environment Variables

Create a `.env` file in the project root (copy from `.env.example` if present):

```env
DB_NAME=serverpilot
DB_USER=serverpilot
DB_PASSWORD=secret123
JWT_SECRET=dev-jwt-secret-change-in-prod
AGENT_SECRET=dev-agent-secret-change-in-prod
AGENT_TOKEN=your-agent-token-here
SEED_ADMIN_EMAIL=admin@serverpilot.local
SEED_ADMIN_PASSWORD=changeme
SEED_ADMIN_NAME=Admin
```

---

## Rebuild After Code Changes

```bash
# Rebuild a specific service
docker compose build frontend
docker compose build backend
docker compose build agent

# Restart after rebuild
docker compose up -d frontend
docker compose up -d backend
docker compose up -d agent

# Rebuild and restart all
docker compose up -d --build
```

---

## Features

### Servers
- Register and monitor servers via the agent heartbeat
- View CPU, RAM, disk usage and Docker container count in real time

### Applications
- Deploy Docker Compose applications to registered servers
- Trigger deployments via webhook: `POST /api/webhooks/deploy/{token}`
- View deployment history and logs

### Backups
- **PostgreSQL via Docker** (recommended) — runs `pg_dump` inside the DB container via `docker exec`, no network access needed
- **PostgreSQL direct** — connects via a full `postgres://` URL
- **Files** — archives a directory with `tar.gz`
- Schedule recurring backups with a configurable interval

#### Creating a backup of the erpnew database

1. Go to **Backups → + Manual Backup**
2. Server: `localhost`
3. Type: `PostgreSQL via Docker (recommended)`
4. Target: `docker+postgres://<db_user>:<db_password>@<container_name>/<db_name>`
5. Click **Run Backup**

#### Where backup files are saved

- **Inside agent container:** `/opt/serverpilot/backups/`
- **Docker volume:** `serverpilot_sp-backups`

To copy a backup to your Windows machine:

```powershell
# List backups
docker exec sp-agent-local ls /opt/serverpilot/backups

# Copy a specific file
docker cp sp-agent-local:/opt/serverpilot/backups/<filename> .

# Copy all backups
docker cp sp-agent-local:/opt/serverpilot/backups/. "D:\Project\serverpilot\backups\"
```

### Monitoring
- Live CPU, RAM, disk charts per server
- Container list with status

### Alerts
- Configurable threshold alerts for CPU / RAM / disk

### Audit Log
- Tracks all user actions with timestamps, IP, and affected resource

### Users
- Manage admin accounts with role-based access

---

## Project Structure

```
serverpilot/
├── backend/
│   ├── src/
│   │   ├── server.js          # Entry point
│   │   ├── migrate.js         # DB schema migrations
│   │   ├── scheduler.js       # Backup schedule runner
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── apps.js
│   │       ├── backups.js
│   │       ├── servers.js
│   │       ├── agent.js       # Agent heartbeat & job endpoints
│   │       └── ...
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Applications.tsx
│   │   │   ├── Backups.tsx
│   │   │   ├── Servers.tsx
│   │   │   └── ...
│   │   └── services/api.ts
│   ├── nginx.conf
│   └── Dockerfile
├── agent/
│   ├── agent.js               # Heartbeat, deployments, backups
│   └── Dockerfile
└── docker-compose.yml
```

---

## Database

ServerPilot uses its own PostgreSQL instance (`sp-postgres` on port 5433).  
Connect directly:

```bash
docker exec sp-postgres psql -U serverpilot -d serverpilot
```

Schema is auto-migrated on backend startup via `migrate.js`.
