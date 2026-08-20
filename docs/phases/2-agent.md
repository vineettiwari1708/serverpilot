# Phase 2 — Agent Registration + Heartbeat

**Status:** UPCOMING  
**Goal:** Deploy a lightweight Go agent to each managed server. The agent registers itself, sends heartbeats, and reports live metrics. The control panel shows server status in real time.

---

## Agent Architecture

```
Control Server (backend)
        ↑
        │  POST /api/agent/heartbeat  (every 30s)
        │  POST /api/agent/register   (on startup)
        │  POST /api/agent/result     (command response)
        │
   [sp-agent binary]
        │
   Docker Host VM
   (Linux, Docker Engine)
```

The agent is a **single compiled Go binary** — no runtime, no dependencies to install on the remote server.

---

## Agent Heartbeat Payload

```json
{
  "server_id":       "srv_abc123",
  "hostname":        "docker-host-1",
  "ip":              "10.10.0.11",
  "cpu_percent":     31.2,
  "memory_percent":  52.4,
  "memory_total_mb": 1024,
  "memory_used_mb":  536,
  "disk_percent":    61.1,
  "disk_total_gb":   20,
  "disk_used_gb":    12.2,
  "load_avg_1m":     0.45,
  "docker_running":  true,
  "container_count": 3,
  "os":              "linux",
  "arch":            "amd64",
  "agent_version":   "0.1.0",
  "timestamp":       "2026-08-20T12:00:00Z"
}
```

---

## Server Status Rules

| Condition | Status |
|-----------|--------|
| Heartbeat received within 90 seconds | ONLINE |
| No heartbeat for 90–300 seconds | WARNING |
| No heartbeat for > 300 seconds | OFFLINE |

The backend runs a goroutine every 60 seconds that checks all registered servers and updates their status. An alert is created when a server transitions to OFFLINE.

---

## New API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agent/register` | Agent token | First-time registration |
| POST | `/api/agent/heartbeat` | Agent token | Periodic status update |
| POST | `/api/agent/result` | Agent token | Command execution result |
| GET | `/api/servers` | JWT | List all registered servers |
| GET | `/api/servers/:id` | JWT | Single server detail |
| GET | `/api/servers/:id/metrics` | JWT | Recent metric history |

---

## Database Tables Added

```sql
CREATE TABLE servers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  hostname       TEXT,
  ip_address     TEXT,
  status         TEXT DEFAULT 'offline',
  last_heartbeat TIMESTAMPTZ,
  registered_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE server_metrics (
  id         BIGSERIAL PRIMARY KEY,
  server_id  TEXT REFERENCES servers(id),
  cpu        FLOAT,
  memory     FLOAT,
  disk       FLOAT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Agent Package Structure

```
agent/
├── cmd/agent/main.go       ← reads config, starts loops
├── internal/
│   ├── config/config.go    ← CONTROL_URL, AGENT_SECRET, SERVER_ID
│   ├── metrics/collect.go  ← CPU, RAM, disk via /proc and syscall
│   ├── docker/client.go    ← Docker socket status + container count
│   └── client/api.go       ← HTTP client to call control server
```

---

## Installing the Agent on a VM

```bash
# On the target Linux VM
wget https://your-control-server/agent/download/linux-amd64/sp-agent
chmod +x sp-agent

# Create config
cat > /etc/sp-agent.env <<EOF
CONTROL_URL=http://10.10.0.10:8081
AGENT_SECRET=your-agent-secret
SERVER_NAME=docker-host-1
EOF

# Run as a systemd service
./sp-agent --config /etc/sp-agent.env
```

---

## Frontend Changes

- **Servers page**: live table of all agents — name, IP, status badge, CPU %, RAM %, containers, last heartbeat
- **Dashboard**: stat cards become real (Total, Online, Offline, Containers)
- Status badges: `ONLINE` (green), `WARNING` (amber), `OFFLINE` (red)
