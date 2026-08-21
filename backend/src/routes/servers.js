'use strict'

const express           = require('express')
const { requireAuth }   = require('../auth/middleware')
const { logAudit }      = require('../audit')

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  next()
}

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
          s.tags,
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

  // PUT /api/servers/:id  { tags?, name? }
  router.put('/api/servers/:id', requireAuth, requireAdmin, async (req, res) => {
    const { name, tags } = req.body || {}
    if (tags !== undefined && !Array.isArray(tags)) {
      return res.status(400).json({ error: 'tags must be an array of strings' })
    }
    const cleanTags = tags ? tags.map(String).map(t => t.trim().toLowerCase()).filter(Boolean) : undefined
    try {
      const { rows } = await pool.query(`
        UPDATE servers
        SET name = COALESCE($1, name),
            tags = COALESCE($2, tags)
        WHERE id = $3
        RETURNING id, name, hostname, ip, tags
      `, [name || null, cleanTags ?? null, req.params.id])
      if (!rows.length) return res.status(404).json({ error: 'server not found' })
      logAudit(pool, req, 'server.update', 'server', req.params.id, { name, tags: cleanTags })
      res.json({ server: rows[0] })
    } catch {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/servers/:id/token  (admin only — returns the agent_token for reconnecting an agent)
  router.get('/api/servers/:id/token', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT agent_token FROM servers WHERE id = $1', [req.params.id]
      )
      if (!rows.length) return res.status(404).json({ error: 'server not found' })
      res.json({ agent_token: rows[0].agent_token })
    } catch {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // DELETE /api/servers/:id  (admin only — cascades to all related data)
  router.delete('/api/servers/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'DELETE FROM servers WHERE id = $1 RETURNING name', [req.params.id]
      )
      if (!rows.length) return res.status(404).json({ error: 'server not found' })
      logAudit(pool, req, 'server.delete', 'server', req.params.id, { name: rows[0].name })
      res.status(204).end()
    } catch {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
