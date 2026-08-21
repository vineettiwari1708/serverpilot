'use strict'

const express         = require('express')
const { requireAuth } = require('../auth/middleware')
const { logAudit }    = require('../audit')

module.exports = function appsRouter(pool) {
  const router = express.Router()

  // GET /api/apps
  router.get('/api/apps', requireAuth, async (req, res) => {
    try {
      const { rows: apps } = await pool.query(`
        SELECT
          a.id, a.name, a.health_check_url, a.created_at, a.updated_at,
          d.status AS last_status, d.started_at AS last_deployed_at, d.server_name AS last_server
        FROM applications a
        LEFT JOIN LATERAL (
          SELECT status, started_at, server_name
          FROM   deployments WHERE app_id = a.id
          ORDER  BY started_at DESC LIMIT 1
        ) d ON true
        ORDER BY a.name
      `)
      res.json({ apps })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/apps
  router.post('/api/apps', requireAuth, async (req, res) => {
    const { name, compose_yaml, health_check_url } = req.body || {}
    if (!name || !compose_yaml) {
      return res.status(400).json({ error: 'name and compose_yaml are required' })
    }
    try {
      const { rows } = await pool.query(`
        INSERT INTO applications (name, compose_yaml, health_check_url)
        VALUES ($1, $2, $3) RETURNING *
      `, [name.trim(), compose_yaml, health_check_url || ''])
      logAudit(pool, req, 'app.create', 'application', rows[0].id, { name: rows[0].name })
      res.status(201).json({ app: rows[0] })
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'app name already exists' })
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/apps/:id
  router.get('/api/apps/:id', requireAuth, async (req, res) => {
    try {
      const { rows: app } = await pool.query(
        'SELECT * FROM applications WHERE id = $1', [req.params.id]
      )
      if (!app.length) return res.status(404).json({ error: 'app not found' })

      const { rows: deployments } = await pool.query(`
        SELECT id, server_id, server_name, status, deployed_by, started_at, finished_at
        FROM deployments WHERE app_id = $1
        ORDER BY started_at DESC LIMIT 20
      `, [req.params.id])

      res.json({ app: app[0], deployments })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // PUT /api/apps/:id  (update compose YAML / health check)
  router.put('/api/apps/:id', requireAuth, async (req, res) => {
    const { compose_yaml, health_check_url } = req.body || {}
    try {
      const { rows } = await pool.query(`
        UPDATE applications
        SET compose_yaml     = COALESCE($1, compose_yaml),
            health_check_url = COALESCE($2, health_check_url),
            updated_at       = NOW()
        WHERE id = $3
        RETURNING *
      `, [compose_yaml || null, health_check_url ?? null, req.params.id])
      if (!rows.length) return res.status(404).json({ error: 'app not found' })
      res.json({ app: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/apps/:id/deploy  { server_id }
  router.post('/api/apps/:id/deploy', requireAuth, async (req, res) => {
    const { server_id } = req.body || {}
    if (!server_id) return res.status(400).json({ error: 'server_id is required' })

    try {
      const { rows: app } = await pool.query(
        'SELECT * FROM applications WHERE id = $1', [req.params.id]
      )
      if (!app.length) return res.status(404).json({ error: 'app not found' })

      const { rows: srv } = await pool.query(
        'SELECT id, name FROM servers WHERE id = $1', [server_id]
      )
      if (!srv.length) return res.status(404).json({ error: 'server not found' })

      const { rows: dep } = await pool.query(`
        INSERT INTO deployments (app_id, app_name, server_id, server_name, compose_yaml, deployed_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, status, started_at
      `, [app[0].id, app[0].name, srv[0].id, srv[0].name, app[0].compose_yaml, req.user.email])

      logAudit(pool, req, 'app.deploy', 'deployment', dep[0].id, { app: app[0].name, server: srv[0].name })
      res.status(201).json({ deployment: dep[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/apps/:id/rollback  { deployment_id }  (re-deploys the given successful deployment's config)
  router.post('/api/apps/:id/rollback', requireAuth, async (req, res) => {
    const { deployment_id } = req.body || {}
    if (!deployment_id) return res.status(400).json({ error: 'deployment_id is required' })

    try {
      const { rows: src } = await pool.query(
        'SELECT * FROM deployments WHERE id = $1 AND app_id = $2', [deployment_id, req.params.id]
      )
      if (!src.length) return res.status(404).json({ error: 'deployment not found' })
      if (src[0].status !== 'success') {
        return res.status(400).json({ error: 'can only roll back to a successful deployment' })
      }

      const { rows: app } = await pool.query(
        'SELECT name FROM applications WHERE id = $1', [req.params.id]
      )

      const { rows: dep } = await pool.query(`
        INSERT INTO deployments (app_id, app_name, server_id, server_name, compose_yaml, deployed_by, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING id, status, started_at
      `, [req.params.id, app[0].name, src[0].server_id, src[0].server_name,
          src[0].compose_yaml, req.user.email])

      logAudit(pool, req, 'app.rollback', 'deployment', dep[0].id, { app: app[0].name, from: deployment_id })
      res.status(201).json({ deployment: dep[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/deployments?limit=50&offset=0&status=&app_id=
  router.get('/api/deployments', requireAuth, async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200)
    const offset = parseInt(req.query.offset || '0', 10)
    const status = req.query.status || ''
    const appId  = req.query.app_id || ''

    const conditions = []
    const params     = []

    if (status) { params.push(status); conditions.push(`status = $${params.length}`) }
    if (appId)  { params.push(appId);  conditions.push(`app_id = $${params.length}`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit, offset)

    try {
      const { rows } = await pool.query(`
        SELECT id, app_id, app_name, server_id, server_name, status, deployed_by, started_at, finished_at
        FROM deployments
        ${where}
        ORDER BY started_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params)

      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM deployments ${where}`,
        params.slice(0, -2)
      )

      res.json({ deployments: rows, total: cnt[0].total, limit, offset })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/deployments/:id  (full detail with log)
  router.get('/api/deployments/:id', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM deployments WHERE id = $1', [req.params.id]
      )
      if (!rows.length) return res.status(404).json({ error: 'deployment not found' })
      res.json({ deployment: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
