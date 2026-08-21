'use strict'

const express         = require('express')
const { requireAuth } = require('../auth/middleware')

module.exports = function containersRouter(pool) {
  const router = express.Router()

  // GET /api/servers/:id
  // Returns server detail with latest metrics + container list + recent commands.
  router.get('/api/servers/:id', requireAuth, async (req, res) => {
    try {
      const { rows: sv } = await pool.query(`
        SELECT
          id, name, hostname, ip, registered_at, last_seen,
          CASE
            WHEN last_seen > NOW() - INTERVAL '90 seconds' THEN 'online'
            WHEN last_seen IS NULL                          THEN 'pending'
            ELSE 'offline'
          END AS status
        FROM servers WHERE id = $1
      `, [req.params.id])

      if (sv.length === 0) return res.status(404).json({ error: 'server not found' })

      const { rows: hb } = await pool.query(`
        SELECT cpu_pct, ram_pct, disk_pct, docker_count
        FROM heartbeats WHERE server_id = $1
        ORDER BY recorded_at DESC LIMIT 1
      `, [req.params.id])

      const { rows: containers } = await pool.query(`
        SELECT id, name, image, status, ports, updated_at
        FROM containers WHERE server_id = $1
        ORDER BY name
      `, [req.params.id])

      const { rows: commands } = await pool.query(`
        SELECT id, container, action, status, result, requested_by, created_at, updated_at
        FROM container_commands WHERE server_id = $1
        ORDER BY created_at DESC LIMIT 30
      `, [req.params.id])

      res.json({
        server:     { ...sv[0], ...(hb[0] || {}) },
        containers,
        commands,
      })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/servers/:id/containers/:name/action
  // Queues a container action for the agent to pick up.
  router.post('/api/servers/:id/containers/:name/action', requireAuth, async (req, res) => {
    const { action } = req.body || {}
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ error: 'action must be start, stop, or restart' })
    }

    try {
      const { rows: sv } = await pool.query(
        'SELECT id FROM servers WHERE id = $1', [req.params.id]
      )
      if (sv.length === 0) return res.status(404).json({ error: 'server not found' })

      const { rows } = await pool.query(`
        INSERT INTO container_commands (server_id, container, action, requested_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [req.params.id, req.params.name, action, req.user.email])

      res.json({ command: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
