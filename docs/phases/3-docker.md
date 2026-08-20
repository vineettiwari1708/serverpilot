# Phase 3 — Docker Container Management

**Status:** UPCOMING  
**Goal:** View and control Docker containers running on each managed server, directly from the dashboard.

---

## What Will Be Built

The agent on each server communicates with the **local Docker socket** (`/var/run/docker.sock`) and exposes a safe, audited set of container operations. The control server never touches Docker directly — all operations go through the agent.

---

## Allowed Container Actions

| Action | Description |
|--------|-------------|
| `list_containers` | List all containers with status and resource usage |
| `start_container` | Start a stopped container |
| `stop_container` | Gracefully stop a running container |
| `restart_container` | Restart a container |
| `get_logs` | Fetch last N lines of container logs |
| `inspect_container` | Get container metadata (image, ports, env, mounts) |

> **NOT allowed in Phase 3:** exec into container, run arbitrary commands, delete containers, pull images directly.

---

## Command Flow

```
Dashboard (user clicks "Stop")
        │
        ▼
Control Server
  → Writes command to DB: { action: "stop_container", target: "nginx-app", server: "docker-host-1" }
  → Sends command to agent over HTTPS
        │
        ▼
Agent on Docker Host 1
  → Validates action is in allowed list
  → Calls Docker API locally
  → Returns result
        │
        ▼
Control Server
  → Updates command status (SUCCESS / FAILED)
  → Writes audit log: who, what, when, result
        │
        ▼
Dashboard updates
```

---

## New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/servers/:id/containers` | List containers on a server |
| POST | `/api/servers/:id/containers/:name/start` | Start container |
| POST | `/api/servers/:id/containers/:name/stop` | Stop container |
| POST | `/api/servers/:id/containers/:name/restart` | Restart container |
| GET | `/api/servers/:id/containers/:name/logs` | Tail logs |

---

## Container List Response

```json
[
  {
    "id":      "a1b2c3d4",
    "name":    "nginx-app",
    "image":   "nginx:alpine",
    "status":  "running",
    "state":   "Up 2 hours",
    "cpu":     0.4,
    "memory":  "24 MiB / 1 GiB",
    "ports":   ["0.0.0.0:80->80/tcp"],
    "created": "2026-08-20T10:00:00Z"
  }
]
```

---

## Database Tables Added

```sql
CREATE TABLE containers (
  id           TEXT PRIMARY KEY,
  server_id    TEXT REFERENCES servers(id),
  name         TEXT NOT NULL,
  image        TEXT,
  status       TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE server_commands (
  id          BIGSERIAL PRIMARY KEY,
  server_id   TEXT REFERENCES servers(id),
  user_id     TEXT REFERENCES users(id),
  action      TEXT NOT NULL,
  target      TEXT,
  payload     JSONB,
  status      TEXT DEFAULT 'pending',
  result      JSONB,
  executed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Frontend Changes

- **Server detail page** → Containers tab: table with name, image, status, CPU, memory
- Per-row action buttons: Start / Stop / Restart / Logs
- Log viewer: modal with scrollable terminal-style output (dark, monospace)
- All actions go through confirmation dialog before executing
