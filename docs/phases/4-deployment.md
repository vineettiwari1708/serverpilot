# Phase 4 — Application Deployment

**Status:** UPCOMING  
**Goal:** Deploy multi-container applications (Docker Compose style) to any managed server from the dashboard, with full deployment history and health checks.

---

## Application Model

An application is a named unit that groups containers together.

```json
{
  "id":          "app_demo",
  "name":        "Demo App",
  "description": "Full-stack demo: React + Go + Postgres",
  "version":     "1.2.0",
  "target_server": "docker-host-1",
  "compose_yaml":  "...",
  "env_vars": {
    "DATABASE_URL": "postgres://...",
    "APP_ENV": "production"
  },
  "health_check": {
    "path":             "/health",
    "port":             8080,
    "interval_seconds": 10,
    "timeout_seconds":  5,
    "retries":          3
  },
  "desired_state": "running"
}
```

---

## Deployment State Machine

```
PENDING
   │
   ▼
RUNNING          ← agent pulls image, starts containers
   │
   ▼
HEALTH_CHECK     ← polls health endpoint N times
   │
   ├──► SUCCESS  ← health check passed
   │
   └──► FAILED   ← health check failed or timeout
              │
              ▼
           ROLLING_BACK  ← restart previous version
```

---

## New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/applications` | List all applications |
| POST | `/api/applications` | Create application |
| GET | `/api/applications/:id` | Application detail |
| PUT | `/api/applications/:id` | Update application |
| POST | `/api/applications/:id/deploy` | Trigger deployment |
| POST | `/api/applications/:id/rollback` | Rollback to previous |
| GET | `/api/deployments` | All deployment history |
| GET | `/api/deployments/:id` | Deployment detail + logs |

---

## Deployment Process

1. User clicks **Deploy** in dashboard
2. Control server creates a `deployment` record (status: PENDING)
3. Control server sends `deploy` command to the target agent
4. Agent pulls Docker images
5. Agent stops old containers
6. Agent starts new containers using the compose YAML
7. Agent polls the health check endpoint
8. Agent reports SUCCESS or FAILED back to control server
9. Control server updates deployment record and creates audit log
10. Dashboard shows live deployment status with log stream

---

## Database Tables Added

```sql
CREATE TABLE applications (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  version       TEXT,
  server_id     TEXT REFERENCES servers(id),
  compose_yaml  TEXT,
  env_vars      JSONB,
  health_check  JSONB,
  desired_state TEXT DEFAULT 'stopped',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deployments (
  id          TEXT PRIMARY KEY,
  app_id      TEXT REFERENCES applications(id),
  server_id   TEXT REFERENCES servers(id),
  user_id     TEXT REFERENCES users(id),
  version     TEXT,
  status      TEXT DEFAULT 'pending',
  logs        TEXT,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Demo Application

A small demo app ships with Phase 4 for testing:

- **Frontend**: React (nginx image)
- **Backend**: Go (custom image)
- **Database**: PostgreSQL

Deployable to Docker Host 1 or Docker Host 2 from the dashboard.

---

## Rollback Strategy

Each successful deployment saves the previous compose YAML and image tags. On rollback:
1. New deployment record created with `ROLLING_BACK` status
2. Previous compose YAML sent to agent
3. Agent replaces running containers with previous version
4. Health check runs on restored version
5. Status: SUCCESS or FAILED
