export type SectionType = 'heading' | 'subheading' | 'para' | 'code' | 'list' | 'table' | 'note' | 'warning' | 'divider'

export interface Section {
  type:    SectionType
  content?: string
  lang?:   string         // for code blocks
  items?:  string[]       // for list
  headers?: string[]      // for table
  rows?:   string[][]     // for table
}

export type PhaseStatus = 'done' | 'next' | 'upcoming'

export interface Phase {
  id:      string
  title:   string
  status:  PhaseStatus
  summary: string
  sections: Section[]
}

export const phases: Phase[] = [
  {
    id: '1a',
    title: 'Skeleton + Infrastructure',
    status: 'done',
    summary: 'Go backend, React frontend, Docker Compose with Traefik, Postgres, and Redis. Full connectivity verified via TCP health checks.',
    sections: [
      { type: 'heading', content: 'What Was Built' },
      { type: 'subheading', content: 'Backend (Go — zero external dependencies)' },
      { type: 'list', items: [
        'GET /health — liveness check',
        'GET /api/health — used by Vite dev proxy',
        'GET /api/status — dials Postgres + Redis in parallel, returns latency',
        'Graceful shutdown on SIGINT/SIGTERM',
        'Structured JSON logging with log/slog',
        'Internal packages: config, handler/health, handler/status',
      ]},
      { type: 'subheading', content: 'Frontend (React + TypeScript + Vite + Tailwind)' },
      { type: 'list', items: [
        'Dark DevOps-themed UI with custom Tailwind design tokens',
        'Sidebar with 10 navigation items and inline SVG icons',
        'Dashboard polls /api/status every 30s — real green/red dots',
        'Shows Postgres and Redis latency live',
        'Build progress tracker for all 8 phases',
        'Placeholder pages for every future route',
      ]},
      { type: 'subheading', content: 'Docker Compose' },
      { type: 'list', items: [
        'Traefik v3 — routes /api/* to backend, / to frontend',
        'sp-backend — Go binary on port 8081',
        'sp-postgres — PostgreSQL 16 Alpine, health-checked',
        'sp-redis — Redis 7 Alpine, health-checked',
        'Isolated sp-net bridge network',
        'Named volumes for data persistence',
      ]},
      { type: 'divider' },
      { type: 'heading', content: 'API Endpoints' },
      { type: 'table',
        headers: ['Method', 'Path', 'Description'],
        rows: [
          ['GET', '/health',      'Liveness check'],
          ['GET', '/api/health',  'Same — used by Vite proxy'],
          ['GET', '/api/status',  'Full infra status with service latencies'],
        ]
      },
      { type: 'divider' },
      { type: 'heading', content: 'Example /api/status Response' },
      { type: 'code', lang: 'json', content: `{
  "status": "ok",
  "version": "0.1.0",
  "env": "development",
  "uptime_seconds": 42,
  "goroutines": 5,
  "services": {
    "postgres": { "status": "ok", "latency_ms": 11 },
    "redis":    { "status": "ok", "latency_ms": 11 }
  }
}` },
      { type: 'divider' },
      { type: 'heading', content: 'How to Run' },
      { type: 'code', lang: 'bash', content: `# Terminal 1 — backend + databases
cd d:/Project/serverpilot
docker compose up backend postgres redis --build

# Terminal 2 — frontend hot reload
cd d:/Project/serverpilot/frontend
npm run dev

# Open browser
http://localhost:5173` },
    ],
  },

  {
    id: '1b',
    title: 'Auth + Database Schema',
    status: 'next',
    summary: 'JWT authentication, database migrations with golang-migrate, users table, login/logout endpoints, and protected routes on both frontend and backend.',
    sections: [
      { type: 'heading', content: 'What Will Be Built' },
      { type: 'list', items: [
        'golang-migrate for schema versioning (runs on startup)',
        'users table with bcrypt-hashed passwords',
        'POST /api/auth/login → returns signed JWT',
        'GET /api/auth/me → returns current user from token',
        'JWT middleware — protects all future routes',
        'Frontend login page with form validation',
        'useAuth hook and auto-redirect for unauthenticated users',
        'Default seeded admin: admin@serverpilot.local / changeme',
      ]},
      { type: 'divider' },
      { type: 'heading', content: 'New Package Structure' },
      { type: 'code', lang: 'bash', content: `backend/
├── internal/
│   ├── auth/
│   │   ├── jwt.go          ← sign + verify tokens
│   │   └── middleware.go   ← injects user into context
│   ├── db/
│   │   └── postgres.go     ← pgx connection pool
│   └── handler/
│       └── auth.go         ← login / logout / me
├── migrations/
│   ├── 001_create_users.up.sql
│   └── 001_create_users.down.sql` },
      { type: 'divider' },
      { type: 'note', content: 'JWT tokens are stateless — they are never stored in the database. Token TTL is 24 hours. Secret must be at least 32 characters in production.' },
      { type: 'warning', content: 'Change the default admin password immediately after first login in any non-local environment.' },
    ],
  },

  {
    id: '2',
    title: 'Agent Registration + Heartbeat',
    status: 'upcoming',
    summary: 'Lightweight Go agent binary deployed to each managed server. Registers itself, sends heartbeats with CPU/RAM/disk/Docker metrics every 30 seconds. Server status shown live in the dashboard.',
    sections: [
      { type: 'heading', content: 'Agent Architecture' },
      { type: 'code', lang: 'text', content: `Control Server
        ↑
        │  POST /api/agent/heartbeat  (every 30s)
        │  POST /api/agent/register   (on startup)
        │
   [sp-agent binary]
        │
   Docker Host VM (Linux)` },
      { type: 'divider' },
      { type: 'heading', content: 'Heartbeat Payload' },
      { type: 'code', lang: 'json', content: `{
  "server_id":       "srv_abc123",
  "hostname":        "docker-host-1",
  "cpu_percent":     31.2,
  "memory_percent":  52.4,
  "disk_percent":    61.1,
  "docker_running":  true,
  "container_count": 3,
  "timestamp":       "2026-08-20T12:00:00Z"
}` },
      { type: 'divider' },
      { type: 'heading', content: 'Server Status Rules' },
      { type: 'table',
        headers: ['Condition', 'Status'],
        rows: [
          ['Heartbeat within 90 seconds', 'ONLINE'],
          ['No heartbeat 90–300 seconds', 'WARNING'],
          ['No heartbeat > 300 seconds',  'OFFLINE'],
        ]
      },
      { type: 'note', content: 'The sp-agent is a single compiled binary. No runtime needed on the target server — just copy, configure, and run.' },
    ],
  },

  {
    id: '3',
    title: 'Docker Container Management',
    status: 'upcoming',
    summary: 'View and control Docker containers on each managed server from the dashboard. Agent communicates with local Docker socket. All actions are explicit, audited, and never expose raw shell access.',
    sections: [
      { type: 'heading', content: 'Allowed Actions' },
      { type: 'table',
        headers: ['Action', 'Description'],
        rows: [
          ['list_containers',   'List containers with status and resource usage'],
          ['start_container',   'Start a stopped container'],
          ['stop_container',    'Gracefully stop a running container'],
          ['restart_container', 'Restart a container'],
          ['get_logs',          'Fetch last N lines of container logs'],
          ['inspect_container', 'Get container metadata'],
        ]
      },
      { type: 'warning', content: 'No arbitrary shell access in Phase 3. exec into container is explicitly blocked. Every action is logged to the audit trail with user, timestamp, and result.' },
      { type: 'divider' },
      { type: 'heading', content: 'Command Flow' },
      { type: 'list', items: [
        'User clicks action in dashboard',
        'Control server writes command record to DB',
        'Control server sends command to agent over HTTPS',
        'Agent validates action is in allowed list',
        'Agent calls Docker API locally (never exposes socket externally)',
        'Agent returns result to control server',
        'Audit log records: who, what, when, result',
        'Dashboard updates',
      ]},
    ],
  },

  {
    id: '4',
    title: 'Application Deployment',
    status: 'upcoming',
    summary: 'Deploy multi-container applications using Docker Compose to any managed server. Full deployment state machine with health checks, history, and one-click rollback.',
    sections: [
      { type: 'heading', content: 'Deployment States' },
      { type: 'code', lang: 'text', content: `PENDING → RUNNING → HEALTH_CHECK → SUCCESS
                                   ↓
                                 FAILED → ROLLING_BACK` },
      { type: 'divider' },
      { type: 'heading', content: 'Deployment Process' },
      { type: 'list', items: [
        'User clicks Deploy in dashboard',
        'Control server creates deployment record (PENDING)',
        'Agent pulls Docker images on target server',
        'Agent stops old containers',
        'Agent starts new containers via compose YAML',
        'Agent polls health check endpoint',
        'Agent reports SUCCESS or FAILED',
        'Dashboard shows live deployment log',
      ]},
      { type: 'note', content: 'Each successful deployment saves the previous compose YAML and image tags, making one-click rollback always available.' },
    ],
  },

  {
    id: '5',
    title: 'Backup + Restore',
    status: 'upcoming',
    summary: 'Schedule and run backups of databases, configs, and Docker volumes to the dedicated Backup Server. Safe restore workflow with checksum verification and explicit confirmation before overwriting data.',
    sections: [
      { type: 'heading', content: 'What Gets Backed Up' },
      { type: 'table',
        headers: ['Type', 'Method', 'Location on Backup Server'],
        rows: [
          ['PostgreSQL database', 'pg_dump (proper dump)', '/var/backups/serverpilot/db/'],
          ['Compose files',       'File copy',            '/var/backups/serverpilot/compose/'],
          ['Env configs',         'File copy',            '/var/backups/serverpilot/env/'],
          ['Docker volumes',      'tar + gzip',           '/var/backups/serverpilot/volumes/'],
        ]
      },
      { type: 'warning', content: 'Restore requires the user to type CONFIRM before any data is overwritten. This is intentional — there is no undo after a restore.' },
      { type: 'divider' },
      { type: 'heading', content: 'Retention Policy' },
      { type: 'list', items: [
        'Daily backups: keep 7 days',
        'Weekly backups: keep 4 weeks',
        'Monthly backups: keep 3 months',
        'Old backups deleted automatically by backup agent',
      ]},
    ],
  },

  {
    id: '6',
    title: 'Alerts + Monitoring',
    status: 'upcoming',
    summary: 'Configurable thresholds for CPU, RAM, disk, and service health. Alerts fire when thresholds are crossed, are acknowledged by users, and auto-resolve when metrics recover.',
    sections: [
      { type: 'heading', content: 'Default Thresholds' },
      { type: 'table',
        headers: ['Metric', 'WARNING', 'CRITICAL'],
        rows: [
          ['CPU usage',      '> 80%',  '> 90%'],
          ['Memory usage',   '> 80%',  '> 90%'],
          ['Disk usage',     '> 80%',  '> 90%'],
          ['Load avg (1m)',  '> 2.0',  '> 4.0'],
          ['Heartbeat age',  '> 90s',  '> 300s'],
        ]
      },
      { type: 'note', content: 'Thresholds are configurable per-server from the Settings page. Alerts do not re-fire for the same metric until the previous one is resolved.' },
    ],
  },

  {
    id: '7',
    title: 'Polish + Charts',
    status: 'upcoming',
    summary: 'Real-time Recharts charts on the dashboard, responsive layout, server detail tabs, WebSocket log streaming, and production-ready UI across all pages.',
    sections: [
      { type: 'heading', content: 'Dashboard Charts' },
      { type: 'table',
        headers: ['Chart', 'Type', 'Data'],
        rows: [
          ['CPU per server',          'Multi-line',   'Heartbeat metrics'],
          ['Memory trend',            'Area',         'Server metrics history'],
          ['Deployment frequency',    'Bar',          'Deployments per day'],
          ['Alert severity breakdown','Donut',        'Alerts by severity'],
          ['Backup success rate',     'Bar',          'Backup records'],
        ]
      },
      { type: 'divider' },
      { type: 'heading', content: 'Cloud + Physical Server Ready' },
      { type: 'para', content: 'The architecture is designed so local VMs can be replaced with real servers without changing the control plane. Install sp-agent, set CONTROL_URL and AGENT_SECRET, and the server appears in the dashboard within 30 seconds.' },
      { type: 'list', items: [
        'AWS EC2 (any size)',
        'DigitalOcean Droplet',
        'Hetzner VPS',
        'Physical Dell R350',
        'Raspberry Pi 4 (ARM64)',
      ]},
    ],
  },
]
