'use strict'

const { checkHeartbeatAlerts } = require('./alerts')

module.exports = function startScheduler(pool, logger) {
  setInterval(async () => {
    try {
      // Check for servers with stale heartbeats
      await checkHeartbeatAlerts(pool)

      // Fire due backup schedules
      const { rows } = await pool.query(`
        SELECT * FROM backup_schedules
        WHERE enabled = true AND next_run <= NOW()
      `)
      for (const s of rows) {
        await pool.query(`
          INSERT INTO backup_jobs
            (server_id, server_name, type, target, backup_dir, triggered_by)
          VALUES ($1, $2, $3, $4, $5, 'scheduler')
        `, [s.server_id, s.server_name, s.type, s.target, s.backup_dir])

        await pool.query(`
          UPDATE backup_schedules
          SET last_run = NOW(),
              next_run = NOW() + ($1 * interval '1 minute')
          WHERE id = $2
        `, [s.interval_min, s.id])

        logger.info('scheduler: created backup job', {
          server: s.server_name, type: s.type, target: s.target,
        })
      }
    } catch (err) {
      logger.error('scheduler error', { error: err.message })
    }
  }, 60_000)
}
