# Phase 6 — Alerts + Monitoring

**Status:** NEXT  
**Goal:** Define thresholds for CPU, RAM, disk, and service health. Fire alerts when thresholds are crossed. Show alert history and mark alerts as resolved.

---

## Alert Thresholds

| Metric | WARNING | CRITICAL |
|--------|---------|----------|
| CPU usage | > 80% | > 90% |
| Memory usage | > 80% | > 90% |
| Disk usage | > 80% | > 90% |
| Load average (1m) | > 2.0 | > 4.0 |
| Heartbeat age | > 90s | > 300s |
| Container stopped | — | any container stops unexpectedly |

Thresholds are configurable per-server from the Settings page.

---

## Alert Lifecycle

```
Metric crosses threshold
        │
        ▼
Alert created  (status: OPEN)
        │
        ▼
Notification sent (dashboard bell + optional webhook)
        │
        ▼
User acknowledges  (status: ACKNOWLEDGED)
        │
        ▼
Metric recovers
        │
        ▼
Alert auto-resolved  (status: RESOLVED)
```

Alerts do NOT re-fire for the same metric until the previous one is resolved.

---

## Alert Record

```json
{
  "id":         "alr_001",
  "server_id":  "srv_abc",
  "server_name":"docker-host-1",
  "metric":     "cpu_percent",
  "value":      92.4,
  "threshold":  90,
  "severity":   "CRITICAL",
  "status":     "open",
  "message":    "CPU usage 92.4% exceeds critical threshold (90%)",
  "created_at": "2026-08-20T14:30:00Z",
  "resolved_at": null
}
```

---

## Monitoring Data

Every heartbeat stores a metric snapshot. The monitoring page shows:

- CPU usage over time (sparkline per server)
- Memory usage over time
- Disk usage trend
- Container count over time
- Load average

Data retention: last 7 days at 30s resolution, then aggregated to 5min averages for 30 days.

---

## New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/alerts` | List alerts (filter: open/resolved/all) |
| GET | `/api/alerts/:id` | Alert detail |
| POST | `/api/alerts/:id/acknowledge` | Acknowledge alert |
| POST | `/api/alerts/:id/resolve` | Manually resolve |
| GET | `/api/servers/:id/metrics` | Historical metrics |
| GET | `/api/monitoring/summary` | Cross-server summary |

---

## Database Tables Added

```sql
CREATE TABLE alerts (
  id           TEXT PRIMARY KEY,
  server_id    TEXT REFERENCES servers(id),
  metric       TEXT NOT NULL,
  value        FLOAT,
  threshold    FLOAT,
  severity     TEXT,
  status       TEXT DEFAULT 'open',
  message      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

-- Metric history (from every heartbeat)
CREATE TABLE server_metrics (
  id          BIGSERIAL PRIMARY KEY,
  server_id   TEXT REFERENCES servers(id),
  cpu         FLOAT,
  memory      FLOAT,
  disk        FLOAT,
  load_avg    FLOAT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Frontend Changes

- **Alerts page**: table of open alerts with severity badges, acknowledge button
- **Monitoring page**: per-server metric sparklines, refresh every 30s
- **Header bell**: unread alert count badge
- **Server detail**: alert history tab, metric graph tab
