'use strict'

const express         = require('express')
const https           = require('https')
const http            = require('http')
const { requireAuth } = require('../auth/middleware')

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  next()
}

module.exports = function notificationsRouter(pool) {
  const router = express.Router()

  // GET /api/notification-channels
  router.get('/api/notification-channels', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, type, url, enabled, on_warning, on_critical, on_offline, created_at
         FROM notification_channels ORDER BY created_at`
      )
      res.json({ channels: rows })
    } catch {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/notification-channels  { name, type, url, on_warning, on_critical, on_offline }
  router.post('/api/notification-channels', requireAuth, requireAdmin, async (req, res) => {
    const { name, type, url, on_warning = false, on_critical = true, on_offline = true } = req.body || {}
    if (!name || !type || !url) {
      return res.status(400).json({ error: 'name, type, and url are required' })
    }
    if (!['webhook', 'slack'].includes(type)) {
      return res.status(400).json({ error: 'type must be webhook or slack' })
    }
    try {
      const { rows } = await pool.query(`
        INSERT INTO notification_channels (name, type, url, on_warning, on_critical, on_offline)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, type, url, enabled, on_warning, on_critical, on_offline, created_at
      `, [name.trim(), type, url.trim(), on_warning, on_critical, on_offline])
      res.status(201).json({ channel: rows[0] })
    } catch {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // PUT /api/notification-channels/:id
  router.put('/api/notification-channels/:id', requireAuth, requireAdmin, async (req, res) => {
    const { name, url, enabled, on_warning, on_critical, on_offline } = req.body || {}
    try {
      const { rows } = await pool.query(`
        UPDATE notification_channels
        SET name        = COALESCE($1, name),
            url         = COALESCE($2, url),
            enabled     = COALESCE($3, enabled),
            on_warning  = COALESCE($4, on_warning),
            on_critical = COALESCE($5, on_critical),
            on_offline  = COALESCE($6, on_offline)
        WHERE id = $7
        RETURNING id, name, type, url, enabled, on_warning, on_critical, on_offline, created_at
      `, [name || null, url || null,
          enabled  != null ? enabled  : null,
          on_warning  != null ? on_warning  : null,
          on_critical != null ? on_critical : null,
          on_offline  != null ? on_offline  : null,
          req.params.id])
      if (!rows.length) return res.status(404).json({ error: 'channel not found' })
      res.json({ channel: rows[0] })
    } catch {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // DELETE /api/notification-channels/:id
  router.delete('/api/notification-channels/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM notification_channels WHERE id = $1', [req.params.id]
      )
      if (!rowCount) return res.status(404).json({ error: 'channel not found' })
      res.status(204).end()
    } catch {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/notification-channels/:id/test
  router.post('/api/notification-channels/:id/test', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM notification_channels WHERE id = $1', [req.params.id]
      )
      if (!rows.length) return res.status(404).json({ error: 'channel not found' })

      const ch = rows[0]
      const payload = ch.type === 'slack'
        ? { text: '*[TEST] ServerPilot notification test*\nThis is a test message from ServerPilot.' }
        : { severity: 'test', title: 'ServerPilot Test', body: 'This is a test notification.', timestamp: new Date().toISOString() }

      const status = await sendRaw(ch.url, payload)
      if (status >= 200 && status < 300) {
        res.json({ ok: true, status })
      } else {
        res.status(502).json({ ok: false, status, error: `upstream returned ${status}` })
      }
    } catch (err) {
      res.status(502).json({ ok: false, error: err.message })
    }
  })

  return router
}

function sendRaw(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const parsed  = new URL(url)
    const lib     = parsed.protocol === 'https:' ? https : http
    const req = lib.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => { res.resume(); resolve(res.statusCode) })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
    req.write(payload)
    req.end()
  })
}
