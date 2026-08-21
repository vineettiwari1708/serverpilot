'use strict'

const express           = require('express')
const config            = require('../config')
const { agentAuth }     = require('../auth/agentMiddleware')

module.exports = function agentRouter(pool) {
  const router = express.Router()

  // POST /api/agent/register
  router.post('/api/agent/register', async (req, res) => {
    const { name, hostname, ip, agent_secret } = req.body || {}

    if (agent_secret !== config.agentSecret) {
      return res.status(403).json({ error: 'invalid agent secret' })
    }
    if (!name || !hostname) {
      return res.status(400).json({ error: 'name and hostname are required' })
    }

    try {
      const { rows } = await pool.query(`
        INSERT INTO servers (name, hostname, ip)
        VALUES ($1, $2, $3)
        ON CONFLICT (hostname) DO UPDATE
          SET name = EXCLUDED.name,
              ip   = EXCLUDED.ip
        RETURNING id, name, hostname, agent_token
      `, [name, hostname, ip || null])

      const s = rows[0]
      res.json({ server_id: s.id, token: s.agent_token })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/agent/heartbeat
  // Accepts metrics + optional container list.
  router.post('/api/agent/heartbeat', agentAuth(pool), async (req, res) => {
    const { cpu_pct, ram_pct, disk_pct, docker_count, containers } = req.body || {}
    const serverId = req.server.id

    try {
      // Update last_seen
      await pool.query(
        'UPDATE servers SET last_seen = NOW() WHERE id = $1', [serverId]
      )

      // Record heartbeat metrics
      await pool.query(
        `INSERT INTO heartbeats (server_id, cpu_pct, ram_pct, disk_pct, docker_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [serverId, cpu_pct ?? null, ram_pct ?? null, disk_pct ?? null, docker_count ?? 0]
      )

      // Sync container state
      if (Array.isArray(containers) && containers.length > 0) {
        for (const c of containers) {
          await pool.query(`
            INSERT INTO containers (server_id, name, image, status, ports)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (server_id, name) DO UPDATE
              SET image      = EXCLUDED.image,
                  status     = EXCLUDED.status,
                  ports      = EXCLUDED.ports,
                  updated_at = NOW()
          `, [serverId, c.name, c.image || '', c.status || '', c.ports || ''])
        }
        // Remove containers that no longer exist on this server
        const names = containers.map(c => c.name)
        await pool.query(
          'DELETE FROM containers WHERE server_id = $1 AND name <> ALL($2)',
          [serverId, names]
        )
      } else if (Array.isArray(containers)) {
        // Empty array means no containers — clear them all
        await pool.query('DELETE FROM containers WHERE server_id = $1', [serverId])
      }

      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/agent/commands
  // Agent polls this to get pending actions, marks them as 'running'.
  router.get('/api/agent/commands', agentAuth(pool), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, container, action FROM container_commands
         WHERE server_id = $1 AND status = 'pending'
         ORDER BY created_at`,
        [req.server.id]
      )

      if (rows.length > 0) {
        const ids = rows.map(r => r.id)
        await pool.query(
          `UPDATE container_commands SET status = 'running', updated_at = NOW()
           WHERE id = ANY($1)`,
          [ids]
        )
      }

      res.json({ commands: rows })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/agent/commands/:id/result
  router.post('/api/agent/commands/:id/result', agentAuth(pool), async (req, res) => {
    const { status, result } = req.body || {}
    if (!['done', 'error'].includes(status)) {
      return res.status(400).json({ error: 'status must be done or error' })
    }
    try {
      await pool.query(
        `UPDATE container_commands
         SET status = $1, result = $2, updated_at = NOW()
         WHERE id = $3 AND server_id = $4`,
        [status, result || '', req.params.id, req.server.id]
      )
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // ── Deployments ─────────────────────────────────────────────

  // GET /api/agent/deployments — agent polls for pending deployments on its server
  router.get('/api/agent/deployments', agentAuth(pool), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT d.id, d.app_id, d.app_name, d.compose_yaml,
                a.health_check_url
         FROM   deployments d
         JOIN   applications a ON a.id = d.app_id
         WHERE  d.server_id = $1 AND d.status = 'pending'
         ORDER  BY d.started_at`,
        [req.server.id]
      )
      // Mark as running so they're not picked up again
      if (rows.length > 0) {
        const ids = rows.map(r => r.id)
        await pool.query(
          `UPDATE deployments SET status = 'running' WHERE id = ANY($1)`, [ids]
        )
      }
      res.json({ deployments: rows })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/agent/deployments/:id/log — agent streams log lines
  router.post('/api/agent/deployments/:id/log', agentAuth(pool), async (req, res) => {
    const { lines } = req.body || {}
    if (!lines) return res.status(400).json({ error: 'lines required' })
    try {
      await pool.query(
        `UPDATE deployments SET log = log || $1 WHERE id = $2 AND server_id = $3`,
        [lines + '\n', req.params.id, req.server.id]
      )
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/agent/deployments/:id/status — agent updates final status
  router.post('/api/agent/deployments/:id/status', agentAuth(pool), async (req, res) => {
    const { status } = req.body || {}
    const allowed = ['running', 'health_check', 'success', 'failed', 'rolled_back']
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` })
    }
    try {
      const finished = ['success', 'failed', 'rolled_back'].includes(status)
      await pool.query(
        `UPDATE deployments
         SET status = $1, finished_at = $2
         WHERE id = $3 AND server_id = $4`,
        [status, finished ? new Date() : null, req.params.id, req.server.id]
      )
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // ── Backup Jobs ───────────────────────────────────────────────

  // GET /api/agent/backups — agent polls for pending backup/restore jobs
  router.get('/api/agent/backups', agentAuth(pool), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, type, direction, target, backup_dir, source_file
         FROM backup_jobs
         WHERE server_id = $1 AND status = 'pending'
         ORDER BY created_at`,
        [req.server.id]
      )
      if (rows.length > 0) {
        const ids = rows.map(r => r.id)
        await pool.query(
          `UPDATE backup_jobs SET status = 'running' WHERE id = ANY($1)`, [ids]
        )
      }
      res.json({ jobs: rows })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/agent/backups/:id/log — agent appends log lines
  router.post('/api/agent/backups/:id/log', agentAuth(pool), async (req, res) => {
    const { lines } = req.body || {}
    if (!lines) return res.status(400).json({ error: 'lines required' })
    try {
      await pool.query(
        `UPDATE backup_jobs SET log = log || $1 WHERE id = $2 AND server_id = $3`,
        [lines + '\n', req.params.id, req.server.id]
      )
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/agent/backups/:id/status — agent reports final result
  router.post('/api/agent/backups/:id/status', agentAuth(pool), async (req, res) => {
    const { status, file_path, size_bytes, checksum } = req.body || {}
    if (!['success', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'status must be success or failed' })
    }
    try {
      await pool.query(
        `UPDATE backup_jobs
         SET status = $1, file_path = COALESCE($2, file_path),
             size_bytes = COALESCE($3, size_bytes),
             checksum = COALESCE($4, checksum),
             finished_at = NOW()
         WHERE id = $5 AND server_id = $6`,
        [status, file_path || null, size_bytes || null, checksum || null,
         req.params.id, req.server.id]
      )
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
