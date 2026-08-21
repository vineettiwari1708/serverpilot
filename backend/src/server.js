'use strict'

require('dotenv').config()

const express  = require('express')
const cors     = require('cors')
const config   = require('./config')
const logger   = require('./logger')
const { pool, connect } = require('./db')
const migrate  = require('./migrate')
const seedAdmin = require('./seed')
const health       = require('./routes/health')
const statusRouter  = require('./routes/status')
const authRouter    = require('./routes/auth')
const agentRouter      = require('./routes/agent')
const serversRouter    = require('./routes/servers')
const containersRouter = require('./routes/containers')
const appsRouter       = require('./routes/apps')
const backupsRouter    = require('./routes/backups')
const alertsRouter     = require('./routes/alerts')
const startScheduler   = require('./scheduler')

const startTime = Date.now()

async function main() {
  logger.info('ServerPilot backend starting', {
    version: '0.2.0',
    port: config.port,
    env: config.appEnv,
  })

  // ── Database ────────────────────────────────────────────────
  await connect()
  logger.info('database connected')

  await migrate(pool, logger)
  await seedAdmin(pool, logger,
    config.seedAdminEmail,
    config.seedAdminPassword,
    config.seedAdminName,
  )

  // ── Express app ─────────────────────────────────────────────
  const app = express()

  app.use(cors())
  app.use(express.json())

  // Structured access log
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      logger.info('request', {
        method: req.method,
        path:   req.path,
        status: res.statusCode,
        ms:     Date.now() - start,
      })
    })
    next()
  })

  // Routes
  app.use(health)
  app.use(statusRouter(startTime))
  app.use(authRouter(pool))
  app.use(agentRouter(pool))
  app.use(serversRouter(pool))
  app.use(containersRouter(pool))
  app.use(appsRouter(pool))
  app.use(backupsRouter(pool))
  app.use(alertsRouter(pool))

  startScheduler(pool, logger)

  // 404 fallback
  app.use((req, res) => {
    res.status(404).json({ error: 'not found', path: req.path })
  })

  app.listen(config.port, '0.0.0.0', () => {
    logger.info('listening', { addr: `http://0.0.0.0:${config.port}` })
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`port ${config.port} already in use — stop the Docker backend first, or set PORT=8082`)
    } else {
      logger.error('server error', { error: err.message })
    }
    process.exit(1)
  })
}

main().catch(err => {
  logger.error('startup failed', { error: err.message })
  process.exit(1)
})
