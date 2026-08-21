'use strict'

const express           = require('express')
const { requireAuth }   = require('../auth/middleware')

module.exports = function serversRouter(pool) {
  const router = express.Router()

  // GET /api/servers
  // Returns all registered servers with their latest heartbeat metrics.
  // A server is "online" if last_seen within the last 90 seconds.
  router.get('/api/servers', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          s.id,
          s.name,
          s.hostname,
          s.ip,
          s.registered_at,
          s.last_seen,
          CASE
            WHEN s.last_seen > NOW() - INTERVAL '90 seconds' THEN 'online'
            WHEN s.last_seen IS NULL                          THEN 'pending'
            ELSE 'offline'
          END AS status,
          h.cpu_pct,
          h.ram_pct,
          h.disk_pct,
          h.docker_count
        FROM servers s
        LEFT JOIN LATERAL (
          SELECT cpu_pct, ram_pct, disk_pct, docker_count
          FROM   heartbeats
          WHERE  server_id = s.id
          ORDER  BY recorded_at DESC
          LIMIT  1
        ) h ON true
        ORDER BY s.name
      `)

      const total   = rows.length
      const online  = rows.filter(r => r.status === 'online').length
      const offline = total - online
      const containers = rows.reduce((s, r) => s + (r.docker_count || 0), 0)

      res.json({
        servers: rows,
        summary: { total, online, offline, containers },
      })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
