'use strict'

const express           = require('express')
const config            = require('../config')
const { agentAuth }     = require('../auth/agentMiddleware')

module.exports = function agentRouter(pool) {
  const router = express.Router()

  // POST /api/agent/register
  // Called by the agent on startup. Returns an agent_token for future heartbeats.
  router.post('/api/agent/register', async (req, res) => {
    const { name, hostname, ip, agent_secret } = req.body || {}

    if (agent_secret !== config.agentSecret) {
      return res.status(403).json({ error: 'invalid agent secret' })
    }
    if (!name || !hostname) {
      return res.status(400).json({ error: 'name and hostname are required' })
    }

    try {
      // Upsert: same hostname re-registers cleanly, gets its existing token back
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
  // Called by the agent every 30s with current metrics.
  router.post('/api/agent/heartbeat', agentAuth(pool), async (req, res) => {
    const { cpu_pct, ram_pct, disk_pct, docker_count } = req.body || {}
    const serverId = req.server.id

    try {
      await pool.query(
        'UPDATE servers SET last_seen = NOW() WHERE id = $1',
        [serverId]
      )
      await pool.query(
        `INSERT INTO heartbeats (server_id, cpu_pct, ram_pct, disk_pct, docker_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [serverId, cpu_pct ?? null, ram_pct ?? null, disk_pct ?? null, docker_count ?? 0]
      )
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
