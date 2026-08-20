# Phase 7 — Polish + Charts

**Status:** UPCOMING  
**Goal:** Upgrade the dashboard with real-time charts, improve responsiveness, and make the UI production-ready.

---

## Dashboard Charts

Replace placeholder stat cards with live charts:

| Chart | Type | Data source |
|-------|------|-------------|
| CPU usage per server | Multi-line | `/api/monitoring/summary` |
| Memory usage trend | Area chart | Server metrics history |
| Deployment frequency | Bar chart | Deployments per day |
| Alert severity breakdown | Donut chart | Alerts by severity |
| Backup success rate | Bar chart | Backup records |
| Container count over time | Stacked area | Heartbeat data |

Charts use **Recharts** (lightweight, React-native, no D3 required).

---

## UI Improvements

### Dark Mode Refinements
- Consistent color tokens across all pages
- Better contrast ratios (WCAG AA)
- Smooth transitions on state changes

### Responsive Layout
- Sidebar collapses to icon-only on smaller screens
- Cards reflow to single column on mobile
- Tables scroll horizontally on small viewports

### Server Detail Page
Full implementation with tabs:
- **Overview** — health, uptime, quick stats
- **Metrics** — 24h CPU/RAM/disk charts
- **Containers** — live container list with controls
- **Logs** — container log viewer
- **Actions** — run approved commands
- **Backups** — backup history for this server
- **Events** — audit log filtered to this server

### Application Detail Page
- Deployment timeline
- Current container status
- Environment variable viewer (values hidden by default)
- One-click deploy / rollback

---

## Performance

- Pagination on all long lists
- API response caching (Redis) for metrics summaries
- WebSocket upgrade for real-time container logs (replaces polling)
- Virtual list rendering for large container/log lists

---

## Future: Cloud + Physical Server Ready

The architecture is designed so that **local VMs can be replaced with real servers** without changing the control plane:

1. Provision a real Linux server (cloud VM or physical)
2. Install the `sp-agent` binary
3. Set `CONTROL_URL` and `AGENT_SECRET` env vars
4. Agent registers automatically
5. Server appears in dashboard within 30 seconds

Tested targets:
- AWS EC2 (any size)
- DigitalOcean Droplet
- Hetzner VPS
- Physical Dell R350 server
- Raspberry Pi 4 (ARM64)

---

## What Phase 7 Does NOT Add

- Kubernetes support (separate product track)
- Elasticsearch or Kibana (too heavy)
- Multi-region awareness (future phase)
- SSO / SAML / OAuth (future phase)
- Custom plugin system (future phase)
