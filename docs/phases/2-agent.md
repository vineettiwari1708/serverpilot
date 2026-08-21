# Phase 2 — Agent Registration + Heartbeat

**Status:** DONE  
**Goal:** Deploy a lightweight Node.js agent to each managed server. The agent registers itself, sends heartbeats with live metrics, and syncs container state. The control panel shows server status in real time.

---

## Agent Architecture

```
Control Server (backend)
        ↑
        │  POST /api/agent/register   (on startup)
        │  POST /api/agent/heartbeat  (every 30s)
        │
   [agent.js — Node.js built-ins only]
        │
   Docker Host VM
   (Linux, Docker Engine)
```

The agent uses **only Node.js built-in modules** (`os`, `http`, `https`, `child_process`, `fs`, `path`) — no `npm install` needed on the remote server. Just copy `agent.js` and run it.

---

## Registration

On startup the agent calls `POST /api/agent/register` with the shared `AGENT_SECRET`. The server upserts a row in the `servers` table and returns an `agent_token` — all subsequent calls use `Authorization: Agent <token>`.

```json
POST /api/agent/register
{
  "name":         "docker-host-1",
  "hostname":     "docker-host-1",
  "ip":           "10.10.0.11",
  "agent_secret": "change-this-agent-secret-too"
}

Response:
{ "server_id": "abc123", "token": "<agent_token>" }
```

---

## Heartbeat Payload

```json
POST /api/agent/heartbeat
Authorization: Agent <token>

{
  "cpu_pct":      31,
  "ram_pct":      52,
  "docker_count": 3,
  "containers": [
    {
      "name":   "nginx-app",
      "image":  "nginx:alpine",
      "status": "Up 2 hours",
      "ports":  "0.0.0.0:80->80/tcp"
    }
  ]
}
```

The control server:
1. Updates `servers.last_seen = NOW()`
2. Inserts a row into `heartbeats` with CPU/RAM/disk/docker_count
3. Upserts container rows (adds new, updates changed, deletes removed)

---

## Server Status Rules

Server status is derived at query time from `last_seen`:

| Condition | Status |
|-----------|--------|
| `last_seen` within 90 seconds | ONLINE |
| `last_seen` 90–300 seconds ago | WARNING |
| `last_seen` > 300 seconds ago | OFFLINE |
| Never registered | OFFLINE |

---

## Database Tables

```sql
CREATE TABLE servers (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  hostname      TEXT UNIQUE NOT NULL,
  ip            TEXT,
  agent_token   TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen     TIMESTAMPTZ
);

CREATE TABLE heartbeats (
  id           BIGSERIAL PRIMARY KEY,
  server_id    TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  cpu_pct      FLOAT,
  ram_pct      FLOAT,
  disk_pct     FLOAT,
  docker_count INT DEFAULT 0,
  recorded_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## New API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agent/register` | Agent secret | First-time registration |
| POST | `/api/agent/heartbeat` | Agent token | Periodic status update + container sync |
| GET | `/api/servers` | JWT | List all registered servers with status |
| GET | `/api/servers/:id` | JWT | Server detail + latest heartbeat + containers |

---

## Running the Agent

```bash
# On the target server (Node.js must be installed)
AGENT_TOKEN=<token_from_register> \
CONTROL_URL=http://10.10.0.10:8081 \
node agent.js

# Or register first if no token yet:
curl -X POST http://10.10.0.10:8081/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"name":"host-1","hostname":"host-1","agent_secret":"your-secret"}'
```

Optional env vars:
- `HEARTBEAT_INTERVAL` — milliseconds between heartbeats (default: `30000`)
- `DEPLOY_DIR` — base directory for compose files (default: `/opt/serverpilot/apps`)

---

## Frontend Changes

- **Servers page** — live table of all agents: name, IP, status badge, CPU %, RAM %, container count, last heartbeat
- **Dashboard** — stat cards become real (Total, Online, Offline, Running Containers)
- Status badges: `ONLINE` (green pulsing dot), `WARNING` (amber), `OFFLINE` (red)
