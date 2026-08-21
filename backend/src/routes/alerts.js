'use strict'

const express         = require('express')
const { requireAuth } = require('../auth/middleware')

module.exports = function alertsRouter(pool) {
  const router = express.Router()

  // GET /api/alerts  ?status=open|acknowledged|resolved|all  (default: open+acknowledged)
  router.get('/api/alerts', requireAuth, async (req, res) => {
    try {
      const { status, server_id } = req.query
      const conditions = []
      const params = []

      if (status === 'all') {
        // no filter
      } else if (status === 'resolved') {
        conditions.push(`a.status = 'resolved'`)
      } else {
        conditions.push(`a.status != 'resolved'`)
      }

      if (server_id) {
        params.push(server_id)
        conditions.push(`a.server_id = $${params.length}`)
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
      const { rows } = await pool.query(
        `SELECT a.id, a.server_id, a.server_name, a.metric, a.value, a.threshold,
                a.severity, a.status, a.message,
                a.created_at, a.acknowledged_at, a.resolved_at
         FROM alerts a ${where}
         ORDER BY
           CASE a.severity WHEN 'critical' THEN 0 ELSE 1 END,
           a.created_at DESC
         LIMIT 200`,
        params
      )
      const open   = rows.filter(r => r.status === 'open').length
      const acked  = rows.filter(r => r.status === 'acknowledged').length
      res.json({ alerts: rows, counts: { open, acknowledged: acked } })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/alerts/counts — lightweight unread count for header badge
  router.get('/api/alerts/counts', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'open')         AS open,
          COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged
        FROM alerts WHERE status != 'resolved'
      `)
      res.json({
        open:         parseInt(rows[0].open, 10),
        acknowledged: parseInt(rows[0].acknowledged, 10),
      })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/alerts/:id
  router.get('/api/alerts/:id', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM alerts WHERE id = $1', [req.params.id]
      )
      if (!rows.length) return res.status(404).json({ error: 'alert not found' })
      res.json({ alert: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/alerts/:id/acknowledge
  router.post('/api/alerts/:id/acknowledge', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        UPDATE alerts SET status = 'acknowledged', acknowledged_at = NOW()
        WHERE id = $1 AND status = 'open'
        RETURNING id, status
      `, [req.params.id])
      if (!rows.length) return res.status(404).json({ error: 'alert not found or not open' })
      res.json({ alert: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/alerts/:id/resolve
  router.post('/api/alerts/:id/resolve', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        UPDATE alerts SET status = 'resolved', resolved_at = NOW()
        WHERE id = $1 AND status != 'resolved'
        RETURNING id, status
      `, [req.params.id])
      if (!rows.length) return res.status(404).json({ error: 'alert not found or already resolved' })
      res.json({ alert: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // ── Metrics history ───────────────────────────────────────────

  // GET /api/servers/:id/metrics?limit=60
  router.get('/api/servers/:id/metrics', requireAuth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '60', 10), 500)
    try {
      const { rows } = await pool.query(`
        SELECT cpu_pct, ram_pct, disk_pct, docker_count, recorded_at
        FROM heartbeats
        WHERE server_id = $1
        ORDER BY recorded_at DESC
        LIMIT $2
      `, [req.params.id, limit])
      // Return oldest-first for charts
      res.json({ metrics: rows.reverse() })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/monitoring/summary — latest metrics for all servers
  router.get('/api/monitoring/summary', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          s.id, s.name, s.last_seen,
          EXTRACT(EPOCH FROM (NOW() - s.last_seen))::float AS heartbeat_age_sec,
          h.cpu_pct, h.ram_pct, h.disk_pct, h.docker_count, h.recorded_at,
          (SELECT COUNT(*) FROM alerts a
           WHERE a.server_id = s.id AND a.status != 'resolved') AS open_alerts
        FROM servers s
        LEFT JOIN LATERAL (
          SELECT cpu_pct, ram_pct, disk_pct, docker_count, recorded_at
          FROM heartbeats WHERE server_id = s.id
          ORDER BY recorded_at DESC LIMIT 1
        ) h ON true
        ORDER BY s.name
      `)
      res.json({ servers: rows })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/server-thresholds/:server_id — get custom thresholds (falls back to defaults)
  router.get('/api/server-thresholds/:server_id', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT metric, warning, critical FROM server_thresholds WHERE server_id = $1',
        [req.params.server_id]
      )
      const defaults = {
        cpu_pct:        { warning: 80, critical: 90 },
        ram_pct:        { warning: 80, critical: 90 },
        disk_pct:       { warning: 80, critical: 90 },
        heartbeat_age:  { warning: 90, critical: 300 },
      }
      // Overlay custom values
      for (const r of rows) {
        defaults[r.metric] = { warning: r.warning, critical: r.critical }
      }
      res.json({ thresholds: defaults })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // PUT /api/server-thresholds/:server_id  { metric, warning, critical }
  router.put('/api/server-thresholds/:server_id', requireAuth, async (req, res) => {
    const { metric, warning, critical } = req.body || {}
    const allowed = ['cpu_pct', 'ram_pct', 'disk_pct', 'heartbeat_age']
    if (!allowed.includes(metric)) {
      return res.status(400).json({ error: `metric must be one of: ${allowed.join(', ')}` })
    }
    try {
      await pool.query(`
        INSERT INTO server_thresholds (server_id, metric, warning, critical)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (server_id, metric) DO UPDATE
          SET warning = EXCLUDED.warning, critical = EXCLUDED.critical
      `, [req.params.server_id, metric, warning, critical])
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
