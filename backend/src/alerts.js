'use strict'

const { sendNotification } = require('./notify')

const THRESHOLDS = {
  cpu_pct:  { warning: 80, critical: 90 },
  ram_pct:  { warning: 80, critical: 90 },
  disk_pct: { warning: 80, critical: 90 },
}

async function checkMetricAlerts(pool, serverId, serverName, metrics) {
  for (const [metric, raw] of Object.entries(metrics)) {
    const thresh = THRESHOLDS[metric]
    if (!thresh || raw == null) continue
    const value = parseFloat(raw)

    let severity = null
    if (value >= thresh.critical) severity = 'critical'
    else if (value >= thresh.warning) severity = 'warning'

    if (severity) {
      const { rows } = await pool.query(
        `SELECT id FROM alerts WHERE server_id = $1 AND metric = $2 AND status != 'resolved'`,
        [serverId, metric]
      )
      if (!rows.length) {
        const limit = severity === 'critical' ? thresh.critical : thresh.warning
        const label = metric.replace(/_/g, ' ')
        const message = `${label} is ${value.toFixed(1)}% — exceeds ${severity} threshold (${limit}%)`
        await pool.query(`
          INSERT INTO alerts (server_id, server_name, metric, value, threshold, severity, message)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [serverId, serverName, metric, value, limit, severity, message])
        sendNotification(pool, {
          severity,
          title: `${serverName}: ${label} alert`,
          body:  message,
        }).catch(() => {})
      }
    } else {
      // Metric recovered — auto-resolve
      await pool.query(`
        UPDATE alerts SET status = 'resolved', resolved_at = NOW()
        WHERE server_id = $1 AND metric = $2 AND status != 'resolved'
      `, [serverId, metric])
    }
  }
}

async function checkHeartbeatAlerts(pool) {
  const { rows } = await pool.query(`
    SELECT id, name,
           EXTRACT(EPOCH FROM (NOW() - last_seen))::float AS age_sec
    FROM servers WHERE last_seen IS NOT NULL
  `)
  for (const s of rows) {
    const age = s.age_sec
    let severity = null
    if (age > 300) severity = 'critical'
    else if (age > 90) severity = 'warning'

    if (severity) {
      const { rows: ex } = await pool.query(
        `SELECT id FROM alerts WHERE server_id = $1 AND metric = 'heartbeat_age' AND status != 'resolved'`,
        [s.id]
      )
      if (!ex.length) {
        const limit   = severity === 'critical' ? 300 : 90
        const message = `No heartbeat for ${Math.round(age)}s — server may be offline`
        await pool.query(`
          INSERT INTO alerts (server_id, server_name, metric, value, threshold, severity, message)
          VALUES ($1, $2, 'heartbeat_age', $3, $4, $5, $6)
        `, [s.id, s.name, Math.round(age), limit, severity, message])
        sendNotification(pool, {
          severity: 'offline',
          title:    `${s.name}: server offline`,
          body:     message,
        }).catch(() => {})
      }
    } else {
      await pool.query(`
        UPDATE alerts SET status = 'resolved', resolved_at = NOW()
        WHERE server_id = $1 AND metric = 'heartbeat_age' AND status != 'resolved'
      `, [s.id])
    }
  }
}

module.exports = { checkMetricAlerts, checkHeartbeatAlerts }
