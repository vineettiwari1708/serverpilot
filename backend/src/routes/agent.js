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
  // Agent reports the outcome of an executed command.
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

  return router
}
