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
    summary: 'Node.js/Express backend, React frontend, Docker Compose with Traefik, Postgres, and Redis. Full connectivity verified via TCP health checks.',
    sections: [
      { type: 'heading', content: 'What Was Built' },
      { type: 'subheading', content: 'Backend (Node.js + Express)' },
      { type: 'list', items: [
        'GET /health — liveness check',
        'GET /api/health — used by Vite dev proxy',
        'GET /api/status — dials Postgres + Redis in parallel, returns latency',
        'Structured JSON logging via custom logger',
        'Modules: config, logger, db, routes/health, routes/status',
        'dotenv for environment configuration',
      ]},
      { type: 'subheading', content: 'Frontend (React + TypeScript + Vite + Tailwind)' },
      { type: 'list', items: [
        'Dark DevOps-themed UI with custom Tailwind design tokens',
        'Sidebar with navigation items and inline SVG icons',
        'Dashboard polls /api/status every 30s — real green/red dots',
        'Shows Postgres and Redis latency live',
        'Build progress tracker for all phases',
        'Placeholder pages for every future route',
      ]},
      { type: 'subheading', content: 'Docker Compose' },
      { type: 'list', items: [
        'Traefik v3 — routes /api/* to backend, / to frontend',
        'sp-backend — Node.js on port 8081',
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
  "version": "0.2.0",
  "env": "development",
  "uptime_seconds": 42,
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
    status: 'done',
    summary: 'JWT authentication, embedded SQL migrations, users table with bcrypt passwords, login endpoint, and protected routes on both frontend and backend.',
    sections: [
      { type: 'heading', content: 'What Was Built' },
      { type: 'list', items: [
        'Custom SQL migration runner (runs on startup, tracks applied migrations)',
        'users table with bcrypt-hashed passwords (cost 12)',
        'POST /api/auth/login → returns signed JWT',
        'GET /api/auth/me → returns current user from token',
        'JWT middleware (jsonwebtoken, HS256, 24h TTL) — protects all future routes',
        'Frontend login page with form validation',
        'AuthContext + useAuth hook, auto-redirect for unauthenticated users',
        'Default seeded admin: admin@serverpilot.local / changeme',
      ]},
      { type: 'divider' },
      { type: 'heading', content: 'Backend Structure' },
      { type: 'code', lang: 'bash', content: `backend/src/
├── auth/
│   ├── jwt.js           ← sign + verify tokens
│   ├── middleware.js    ← Bearer token auth for users
│   └── agentMiddleware.js ← Agent token auth
├── routes/
│   ├── auth.js          ← login / me
│   ├── agent.js         ← agent registration + heartbeat
│   ├── servers.js       ← server list + detail
│   ├── containers.js    ← container commands
│   └── apps.js          ← application deployment
├── db.js                ← pg pool
├── migrate.js           ← embedded SQL migrations
└── server.js            ← entry point` },
      { type: 'divider' },
      { type: 'note', content: 'JWT tokens are stateless — never stored in the database. Token TTL is 24 hours. Change JWT_SECRET to a long random string in production.' },
      { type: 'warning', content: 'Change the default admin password immediately after first login in any non-local environment.' },
    ],
  },

  {
    id: '2',
    title: 'Agent Registration + Heartbeat',
    status: 'done',
    summary: 'Lightweight Node.js agent deployed to each managed server. Registers itself, sends heartbeats with CPU/RAM/Docker metrics every 30 seconds. Server status shown live in the dashboard.',
    sections: [
      { type: 'heading', content: 'Agent Architecture' },
      { type: 'code', lang: 'text', content: `Control Server
        ↑
        │  POST /api/agent/heartbeat  (every 30s)
        │  POST /api/agent/register   (on startup)
        │
   [agent.js — Node.js built-ins only]
        │
   Docker Host VM (Linux)` },
      { type: 'divider' },
      { type: 'heading', content: 'Heartbeat Payload' },
      { type: 'code', lang: 'json', content: `{
  "cpu_pct":      31,
  "ram_pct":      52,
  "docker_count": 3,
  "containers": [
    { "name": "nginx", "image": "nginx:alpine", "status": "Up 2 days", "ports": "80/tcp" }
  ]
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
      { type: 'note', content: 'The agent uses only Node.js built-in modules (os, http, https, child_process) — no npm install needed on target servers. Just copy agent.js and run it.' },
    ],
  },

  {
    id: '3',
    title: 'Docker Container Management',
    status: 'done',
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
    status: 'done',
    summary: 'Deploy multi-container applications using Docker Compose to any managed server. Full deployment state machine with health checks, history, and one-click rollback.',
    sections: [
      { type: 'heading', content: 'Deployment States' },
      { type: 'code', lang: 'text', content: `PENDING → RUNNING → HEALTH_CHECK → SUCCESS
                                   ↓
                                 FAILED` },
      { type: 'divider' },
      { type: 'heading', content: 'API Endpoints' },
      { type: 'table',
        headers: ['Method', 'Path', 'Description'],
        rows: [
          ['GET',  '/api/apps',                   'List all apps with last deploy status'],
          ['POST', '/api/apps',                   'Create app (name, compose_yaml, health_check_url)'],
          ['GET',  '/api/apps/:id',               'App detail + last 20 deployments'],
          ['PUT',  '/api/apps/:id',               'Update compose YAML or health check URL'],
          ['POST', '/api/apps/:id/deploy',        'Deploy to a server { server_id }'],
          ['POST', '/api/apps/:id/rollback',      'Re-deploy a previous successful deployment'],
          ['GET',  '/api/deployments/:id',        'Full deployment detail with log text'],
        ]
      },
      { type: 'divider' },
      { type: 'heading', content: 'Deployment Process' },
      { type: 'list', items: [
        'User creates app with Docker Compose YAML',
        'User clicks Deploy and picks a target server',
        'Control plane creates deployment record (PENDING)',
        'Agent polls every 30s, picks up pending deployment',
        'Agent writes compose.yml to /opt/serverpilot/apps/<name>/',
        'Agent runs: docker compose pull, then docker compose up -d',
        'Agent logs each step back to the control plane',
        'Agent polls health_check_url (if set) until HTTP 2xx or timeout',
        'Agent reports SUCCESS or FAILED',
        'Dashboard shows live log and final status',
      ]},
      { type: 'note', content: 'Each deployment stores the exact compose YAML used, making rollback a one-click re-deploy of the previous successful config.' },
    ],
  },

  {
    id: '5',
    title: 'Backup + Restore',
    status: 'next',
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
