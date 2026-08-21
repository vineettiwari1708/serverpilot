# Phase 3 — Docker Container Management

**Status:** DONE  
**Goal:** View and control Docker containers running on each managed server, directly from the dashboard.

---

## What Was Built

The agent on each server runs `docker ps -a` on every heartbeat and syncs the full container list to the control plane. Container actions (start / stop / restart) are queued in the database and picked up by the agent on its next poll.

The control server **never touches Docker directly** — all operations go through the agent.

---

## Allowed Container Actions

| Action | Description |
|--------|-------------|
| `start` | Start a stopped container |
| `stop` | Gracefully stop a running container |
| `restart` | Restart a container |

> **Not allowed:** exec into container, run arbitrary shell commands, delete containers, pull images.  
> Every action is recorded in `container_commands` with user, timestamp, and result.

---

## Command Flow

```
Dashboard (user clicks "Stop")
        │
        ▼
POST /api/servers/:id/containers/:name/action
  { "action": "stop" }
        │
        ▼
Control Server
  → Writes row to container_commands: { status: "pending", action: "stop", container: "nginx-app" }
        │
        ▼ (next agent poll, ≤30s)
Agent on Docker Host
  → GET /api/agent/commands  (atomically marked "running")
  → exec: docker stop nginx-app
  → POST /api/agent/commands/:id/result  { status: "done" }
        │
        ▼
Dashboard refreshes — container shows new status
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/servers/:id` | Server detail + latest heartbeat + containers + last 30 commands |
| POST | `/api/servers/:id/containers/:name/action` | Queue a start/stop/restart command |
| GET | `/api/agent/commands` | Agent polls for pending commands (marks them running) |
| POST | `/api/agent/commands/:id/result` | Agent reports done/error |

---

## Database Tables

```sql
CREATE TABLE containers (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  server_id  TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  image      TEXT NOT NULL,
  status     TEXT NOT NULL,
  ports      TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (server_id, name)
);

CREATE TABLE container_commands (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  server_id    TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  container    TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('start','stop','restart')),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','running','done','error')),
  result       TEXT DEFAULT '',
  requested_by TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Container Sync

The agent sends the full container list with every heartbeat. The control server:
1. **Upserts** any new or changed containers
2. **Deletes** rows for containers that no longer exist on the server

This keeps the DB accurate even if containers are started/stopped outside the agent.

---

## Frontend — Server Detail Page

- **Containers table**: name, image, status badge, ports
- **Per-row buttons**: Start / Stop / Restart (disabled while a command is pending or running)
- **Recent command log**: last 30 commands with status badges (pending / running / done / error), container name, action, result text
- Page polls `/api/servers/:id` every 15 seconds
