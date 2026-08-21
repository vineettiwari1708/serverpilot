'use strict'

const express         = require('express')
const { requireAuth } = require('../auth/middleware')

module.exports = function auditRouter(pool) {
  const router = express.Router()

  // GET /api/audit-logs?limit=50&offset=0&resource=&action=
  router.get('/api/audit-logs', requireAuth, async (req, res) => {
    const limit    = Math.min(parseInt(req.query.limit  || '50', 10), 200)
    const offset   = parseInt(req.query.offset || '0', 10)
    const resource = req.query.resource || ''
    const action   = req.query.action   || ''

    const conditions = []
    const params     = []

    if (resource) { params.push(resource); conditions.push(`resource = $${params.length}`) }
    if (action)   { params.push(`${action}%`); conditions.push(`action LIKE $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    params.push(limit)
    params.push(offset)

    try {
      const { rows } = await pool.query(`
        SELECT id, user_id, user_name, action, resource, resource_id, detail, ip, created_at
        FROM   audit_events
        ${where}
        ORDER  BY created_at DESC
        LIMIT  $${params.length - 1}
        OFFSET $${params.length}
      `, params)

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM audit_events ${where}`,
        params.slice(0, -2)
      )

      res.json({ events: rows, total: countRows[0].total, limit, offset })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
