'use strict'

const express      = require('express')
const { logAudit } = require('../audit')

module.exports = function webhooksRouter(pool) {
  const router = express.Router()

  // POST /api/webhooks/deploy/:token  — no auth, triggered by CI/CD
  router.post('/api/webhooks/deploy/:token', async (req, res) => {
    const { token } = req.params
    if (!token) return res.status(400).json({ error: 'missing token' })

    try {
      const { rows: apps } = await pool.query(
        'SELECT * FROM applications WHERE webhook_token = $1', [token]
      )
      if (!apps.length) return res.status(404).json({ error: 'invalid token' })
      const app = apps[0]

      // Resolve server: body.server_id → last successful deployment's server
      let serverId = (req.body || {}).server_id
      if (!serverId) {
        const { rows: last } = await pool.query(`
          SELECT server_id FROM deployments
          WHERE app_id = $1 AND status = 'success'
          ORDER BY started_at DESC LIMIT 1
        `, [app.id])
        if (last.length) serverId = last[0].server_id
      }
      if (!serverId) {
        return res.status(400).json({ error: 'server_id required — no prior successful deployment to infer from' })
      }

      const { rows: srvs } = await pool.query(
        'SELECT id, name FROM servers WHERE id = $1', [serverId]
      )
      if (!srvs.length) return res.status(404).json({ error: 'server not found' })
      const srv = srvs[0]

      const { rows: dep } = await pool.query(`
        INSERT INTO deployments (app_id, app_name, server_id, server_name, compose_yaml, env_vars, deployed_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, status, started_at
      `, [app.id, app.name, srv.id, srv.name,
          app.compose_yaml, JSON.stringify(app.env_vars || {}), 'webhook'])

      logAudit(pool,
        { user: { id: null, name: 'webhook' }, ip: req.ip },
        'app.deploy', 'deployment', dep[0].id,
        { app: app.name, server: srv.name, via: 'webhook' }
      )

      res.status(201).json({ deployment: dep[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
