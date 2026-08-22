# Phase 5 — Backup + Restore

**Status:** DONE  
**Goal:** Schedule and run backups of databases and files. The agent executes the backup job and stores the file on a persistent volume. Restore with a safe confirmation workflow.

---

## How It Works

There is no separate Backup Server. The local agent (`sp-agent-local`) executes backup jobs directly and stores files in the `sp-backups` Docker named volume mounted at `/opt/serverpilot/backups/`.

```
Dashboard (user creates backup job)
        │
        ▼
POST /api/backups  { server_id, type, target }
        │
        ▼
Control Server
  → Inserts row: backup_jobs { status: "pending" }
        │
        ▼ (agent polls every 30s)
Agent (sp-agent-local)
  → GET /api/agent/backups
  → Executes backup based on type
  → Saves file to /opt/serverpilot/backups/<filename>
  → Reports status: success / failed
        │
        ▼
Control Server
  → Updates backup_jobs: status, file_path, size_bytes
```

---

## Backup Types

| Type | Method | Target format |
|------|--------|---------------|
| `postgres-docker` | `docker exec` inside DB container | `docker+postgres://user:pass@containerName/dbName` |
| `postgres` | Direct TCP connection | `postgres://user:pass@host:5432/dbName` |
| `files` | `tar -czf` | Absolute path on agent host |

### postgres-docker (recommended for Docker-hosted DBs)

The agent runs `pg_dump` inside the target container via `docker exec` — no network routing needed, works even when the DB container is on a different Docker network:

```bash
docker exec -e PGPASSWORD='<pass>' <container> pg_dump -U <user> -d <db> -F p > /opt/serverpilot/backups/<file>.sql
```

Agent requires the Docker socket: `/var/run/docker.sock` must be mounted (it is, via docker-compose.yml).

---

## Backup File Location

- **Inside agent container:** `/opt/serverpilot/backups/`
- **Docker volume:** `serverpilot_sp-backups`

Retrieve a file:

```bash
# List backup files
docker exec sp-agent-local ls /opt/serverpilot/backups

# Copy to host
docker cp sp-agent-local:/opt/serverpilot/backups/<filename> .
```

Files persist across agent container restarts (named volume).

---

## Backup Record (database)

```json
{
  "id":          "bak_xyz",
  "server_id":   "srv_abc",
  "server_name": "localhost",
  "type":        "postgres-docker",
  "direction":   "backup",
  "target":      "docker+postgres://erpnew:***@erpnew-erpnew-db-1/erpnew",
  "status":      "success",
  "file_path":   "/opt/serverpilot/backups/2026-08-21_erpnew.sql",
  "size_bytes":  1048576,
  "created_at":  "2026-08-21T10:00:00Z",
  "finished_at": "2026-08-21T10:00:03Z"
}
```

---

## Restore Workflow

Restore requires **explicit user confirmation** before any data is overwritten.

```
1. User selects a successful backup from the list
2. Clicks "Restore"
3. Dashboard shows WARNING: "This will overwrite existing data"
4. User sends { confirm: "CONFIRM" } to proceed
5. Control server creates a new backup_jobs row (direction: "restore")
6. Agent picks it up and runs pg_restore / tar extract
7. Result recorded in backup_jobs log
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/backups` | List all backup jobs |
| POST | `/api/backups` | Create manual backup job |
| GET | `/api/backups/:id` | Backup detail + log |
| POST | `/api/backups/:id/restore` | Initiate restore (requires `{ confirm: "CONFIRM" }`) |
| GET | `/api/backup-schedules` | List schedules |
| POST | `/api/backup-schedules` | Create schedule `{ server_id, type, target, interval_min }` |
| PATCH | `/api/backup-schedules/:id` | Enable / disable schedule |
| DELETE | `/api/backup-schedules/:id` | Delete schedule |

---

## Database Tables

```sql
CREATE TABLE backup_jobs (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  server_id    TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  server_name  TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('postgres','postgres-docker','files')),
  direction    TEXT NOT NULL DEFAULT 'backup' CHECK (direction IN ('backup','restore')),
  target       TEXT NOT NULL,
  backup_dir   TEXT NOT NULL DEFAULT '/opt/serverpilot/backups',
  source_file  TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','running','success','failed')),
  file_path    TEXT DEFAULT '',
  size_bytes   BIGINT DEFAULT 0,
  checksum     TEXT DEFAULT '',
  log          TEXT DEFAULT '',
  triggered_by TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);

CREATE TABLE backup_schedules (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  server_id    TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  server_name  TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('postgres','postgres-docker','files')),
  target       TEXT NOT NULL,
  backup_dir   TEXT NOT NULL DEFAULT '/opt/serverpilot/backups',
  label        TEXT DEFAULT '',
  interval_min INT NOT NULL DEFAULT 1440,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  last_run     TIMESTAMPTZ,
  next_run     TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```
