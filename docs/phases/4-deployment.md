# Phase 4 — Application Deployment

**Status:** DONE  
**Goal:** Deploy multi-container applications (Docker Compose) to any managed server from the dashboard, with full deployment history, live logs, and one-click rollback.

---

## Application Model

An application stores a Docker Compose YAML and an optional health check URL.

```json
{
  "id":               "abc123",
  "name":             "my-app",
  "compose_yaml":     "version: '3.9'\nservices:\n  app:\n    image: nginx:alpine\n    ports:\n      - '80:80'",
  "health_check_url": "http://localhost:80/health",
  "created_at":       "2026-08-21T05:00:00Z",
  "updated_at":       "2026-08-21T05:00:00Z"
}
```

---

## Deployment State Machine

```
PENDING
   │
   ▼
RUNNING          ← agent pulls images, starts containers via docker compose
   │
   ▼
HEALTH_CHECK     ← agent polls health_check_url until HTTP 2xx or 60s timeout
   │
   ├──► SUCCESS  ← health check passed (or no health check configured)
   │
   └──► FAILED   ← docker compose error, or health check timeout
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/apps` | List all apps with last deployment status |
| POST | `/api/apps` | Create app — `{ name, compose_yaml, health_check_url }` |
| GET  | `/api/apps/:id` | App detail + last 20 deployments |
| PUT  | `/api/apps/:id` | Update compose YAML or health check URL |
| POST | `/api/apps/:id/deploy` | Trigger deployment — `{ server_id }` |
| POST | `/api/apps/:id/rollback` | Re-deploy a previous successful deployment — `{ deployment_id }` |
| GET  | `/api/deployments/:id` | Full deployment record with log text |
| GET  | `/api/agent/deployments` | Agent polls for pending deployments |
| POST | `/api/agent/deployments/:id/log` | Agent appends log lines |
| POST | `/api/agent/deployments/:id/status` | Agent updates status |

---

## Deployment Process

1. User creates an application with Docker Compose YAML
2. User clicks **Deploy** and selects a target server
3. Control server creates a `deployments` row (`status: pending`)
4. Agent polls `GET /api/agent/deployments` (every 30s) — picks up pending deployments, atomically marks them `running`
5. Agent writes compose YAML to `/opt/serverpilot/apps/<name>/docker-compose.yml`
6. Agent runs: `docker compose pull`
7. Agent runs: `docker compose up -d --remove-orphans`
8. Agent streams each stdout/stderr line back via `POST /api/agent/deployments/:id/log`
9. If `health_check_url` is set: agent polls it every 5s for up to 60s, reports `health_check` status
10. Agent reports `success` or `failed` via `POST /api/agent/deployments/:id/status`
11. Dashboard shows live log (polls every 3s while active) and final status badge

---

## Rollback

Rollback creates a new `pending` deployment using the compose YAML from a previous **successful** deployment. The full deployment process runs again — the agent pulls, restarts, and health-checks the older version.

Only successful deployments can be rolled back to.

---

## Database Tables

```sql
CREATE TABLE applications (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             TEXT NOT NULL UNIQUE,
  compose_yaml     TEXT NOT NULL,
  health_check_url TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deployments (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  app_id       TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  app_name     TEXT NOT NULL,
  server_id    TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  server_name  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','running','health_check','success','failed','rolling_back','rolled_back')),
  compose_yaml TEXT NOT NULL,
  log          TEXT DEFAULT '',
  deployed_by  TEXT,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);

CREATE INDEX idx_deployments_app_id    ON deployments(app_id);
CREATE INDEX idx_deployments_server_id ON deployments(server_id);
CREATE INDEX idx_deployments_pending   ON deployments(server_id, status) WHERE status = 'pending';
```

---

## Frontend Pages

- **Applications** (`/applications`) — app list with create form (name, compose YAML, health check URL)
- **App Detail** (`/applications/:id`) — compose YAML editor, deploy panel (server selector), deployment history table with rollback buttons
- **Deployment Log** (`/deployments/:id`) — live log viewer that polls every 3s while deployment is active, metadata card (status, server, started/finished)
