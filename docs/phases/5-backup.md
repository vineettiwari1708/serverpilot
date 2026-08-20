# Phase 5 — Backup + Restore

**Status:** UPCOMING  
**Goal:** Schedule and run backups of databases, application configs, and Docker volumes. Store them on the dedicated Backup Server. Restore with a safe confirmation workflow.

---

## Backup Server (VM 4)

The Backup Server is an isolated Linux VM that only receives backup files. It does not run Docker workloads and is not exposed to the internet.

```
IP: 10.10.0.13
Role: Backup storage only
Agent: sp-agent (backup mode)
Storage: /var/backups/serverpilot/
```

---

## What Gets Backed Up

| Type | Method | Location |
|------|--------|----------|
| PostgreSQL database | `pg_dump` — proper dump, not file copy | `/var/backups/serverpilot/db/` |
| Application compose files | File copy | `/var/backups/serverpilot/compose/` |
| Environment configs | File copy | `/var/backups/serverpilot/env/` |
| Docker named volumes | `docker run --volumes-from` + tar | `/var/backups/serverpilot/volumes/` |
| Application metadata | JSON export from DB | `/var/backups/serverpilot/meta/` |

---

## Backup Flow

```
Control Server schedules backup job
        │
        ▼
Backup Agent (on source server)
  → pg_dump for database backups
  → tar + gzip for volumes/files
  → SHA256 checksum of archive
        │
        ▼
Transfer to Backup Server (scp / rsync over SSH)
        │
        ▼
Backup Server Agent
  → Verifies checksum
  → Stores in dated directory
  → Updates backup record
        │
        ▼
Control Server
  → Marks backup SUCCESS or FAILED
  → Creates notification
```

---

## Backup Schedule

Backups can be:
- **Manual**: triggered from dashboard
- **Scheduled**: cron-style (e.g., `0 2 * * *` = daily at 2am)
- **Pre-deployment**: automatically before every deploy

---

## Retention Policy

```
Daily backups:   keep 7 days
Weekly backups:  keep 4 weeks
Monthly backups: keep 3 months
```

Old backups are deleted automatically by the backup agent.

---

## Backup Record

```json
{
  "id":           "bak_xyz",
  "type":         "postgres",
  "source_server": "docker-host-1",
  "target":       "backup-server",
  "size_bytes":   1048576,
  "checksum":     "sha256:abc123...",
  "status":       "success",
  "path":         "/var/backups/serverpilot/db/2026-08-20_0200_app-db.sql.gz",
  "created_at":   "2026-08-20T02:00:00Z"
}
```

---

## Restore Workflow

Restore requires **explicit user confirmation** before any data is overwritten.

```
1. User selects backup from list
2. User selects target server and restore type
3. Dashboard shows WARNING: "This will overwrite existing data"
4. User types "CONFIRM" to proceed
5. Control server validates backup checksum
6. Agent transfers backup from Backup Server
7. Agent stops application containers
8. Agent restores (pg_restore for DB, tar extract for volumes)
9. Agent starts containers
10. Health check runs
11. Result recorded in audit log
```

---

## New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/backups` | List all backups |
| POST | `/api/backups` | Create manual backup |
| GET | `/api/backups/:id` | Backup detail + checksum |
| POST | `/api/backups/:id/restore` | Initiate restore |
| GET | `/api/backup-schedules` | List schedules |
| POST | `/api/backup-schedules` | Create schedule |
| DELETE | `/api/backup-schedules/:id` | Delete schedule |
