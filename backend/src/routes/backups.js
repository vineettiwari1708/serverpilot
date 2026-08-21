'use strict'

const express         = require('express')
const { requireAuth } = require('../auth/middleware')

module.exports = function backupsRouter(pool) {
  const router = express.Router()

  // ── Backup Jobs ───────────────────────────────────────────────

  // GET /api/backups  (optional ?server_id=&direction=)
  router.get('/api/backups', requireAuth, async (req, res) => {
    try {
      const conditions = []
      const params = []
      if (req.query.server_id) { params.push(req.query.server_id); conditions.push(`server_id = $${params.length}`) }
      if (req.query.direction)  { params.push(req.query.direction);  conditions.push(`direction = $${params.length}`) }
      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
      const { rows } = await pool.query(
        `SELECT id, server_id, server_name, type, direction, target, status,
                file_path, size_bytes, checksum, triggered_by, created_at, finished_at
         FROM backup_jobs ${where}
         ORDER BY created_at DESC LIMIT 100`,
        params
      )
      res.json({ jobs: rows })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/backups  — create manual backup job
  router.post('/api/backups', requireAuth, async (req, res) => {
    const { server_id, type, target, backup_dir } = req.body || {}
    if (!server_id || !type || !target) {
      return res.status(400).json({ error: 'server_id, type, and target are required' })
    }
    if (!['postgres', 'files'].includes(type)) {
      return res.status(400).json({ error: 'type must be postgres or files' })
    }
    try {
      const { rows: srv } = await pool.query(
        'SELECT id, name FROM servers WHERE id = $1', [server_id]
      )
      if (!srv.length) return res.status(404).json({ error: 'server not found' })

      const { rows } = await pool.query(`
        INSERT INTO backup_jobs (server_id, server_name, type, target, backup_dir, triggered_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, status, created_at
      `, [srv[0].id, srv[0].name, type, target,
          backup_dir || '/opt/serverpilot/backups', req.user.email])

      res.status(201).json({ job: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/backups/:id
  router.get('/api/backups/:id', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM backup_jobs WHERE id = $1', [req.params.id]
      )
      if (!rows.length) return res.status(404).json({ error: 'job not found' })
      res.json({ job: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/backups/:id/restore  { confirm: "CONFIRM" }
  router.post('/api/backups/:id/restore', requireAuth, async (req, res) => {
    if (req.body?.confirm !== 'CONFIRM') {
      return res.status(400).json({ error: 'send { confirm: "CONFIRM" } to proceed' })
    }
    try {
      const { rows: src } = await pool.query(
        'SELECT * FROM backup_jobs WHERE id = $1', [req.params.id]
      )
      if (!src.length) return res.status(404).json({ error: 'backup job not found' })
      if (src[0].status !== 'success') {
        return res.status(400).json({ error: 'can only restore from a successful backup' })
      }
      if (src[0].direction !== 'backup') {
        return res.status(400).json({ error: 'cannot restore from a restore job' })
      }

      const { rows } = await pool.query(`
        INSERT INTO backup_jobs
          (server_id, server_name, type, direction, target, backup_dir, source_file, triggered_by)
        VALUES ($1, $2, $3, 'restore', $4, $5, $6, $7)
        RETURNING id, status, created_at
      `, [src[0].server_id, src[0].server_name, src[0].type,
          src[0].target, src[0].backup_dir, src[0].file_path, req.user.email])

      res.status(201).json({ job: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // ── Backup Schedules ──────────────────────────────────────────

  // GET /api/backup-schedules
  router.get('/api/backup-schedules', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM backup_schedules ORDER BY created_at DESC`
      )
      res.json({ schedules: rows })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/backup-schedules  { server_id, type, target, interval_min, label, backup_dir }
  router.post('/api/backup-schedules', requireAuth, async (req, res) => {
    const { server_id, type, target, interval_min, label, backup_dir } = req.body || {}
    if (!server_id || !type || !target) {
      return res.status(400).json({ error: 'server_id, type, and target are required' })
    }
    const mins = parseInt(interval_min, 10) || 1440
    if (mins < 1) return res.status(400).json({ error: 'interval_min must be >= 1' })
    try {
      const { rows: srv } = await pool.query(
        'SELECT id, name FROM servers WHERE id = $1', [server_id]
      )
      if (!srv.length) return res.status(404).json({ error: 'server not found' })

      const { rows } = await pool.query(`
        INSERT INTO backup_schedules
          (server_id, server_name, type, target, backup_dir, label, interval_min)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [srv[0].id, srv[0].name, type, target,
          backup_dir || '/opt/serverpilot/backups', label || '', mins])

      res.status(201).json({ schedule: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // PATCH /api/backup-schedules/:id  { enabled }
  router.patch('/api/backup-schedules/:id', requireAuth, async (req, res) => {
    const { enabled } = req.body || {}
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) is required' })
    }
    try {
      const { rows } = await pool.query(
        `UPDATE backup_schedules SET enabled = $1 WHERE id = $2 RETURNING *`,
        [enabled, req.params.id]
      )
      if (!rows.length) return res.status(404).json({ error: 'schedule not found' })
      res.json({ schedule: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // DELETE /api/backup-schedules/:id
  router.delete('/api/backup-schedules/:id', requireAuth, async (req, res) => {
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM backup_schedules WHERE id = $1', [req.params.id]
      )
      if (!rowCount) return res.status(404).json({ error: 'schedule not found' })
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
