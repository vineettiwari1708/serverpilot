'use strict'

async function logAudit(pool, req, action, resource, resourceId, detail = {}) {
  pool.query(
    `INSERT INTO audit_events (user_id, user_name, action, resource, resource_id, detail, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.user?.id   || null,
      req.user?.name || req.server?.name || 'agent',
      action,
      resource,
      resourceId || '',
      JSON.stringify(detail),
      req.ip || '',
    ]
  ).catch(() => {})
}

module.exports = { logAudit }
