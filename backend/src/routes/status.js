'use strict'

const net     = require('net')
const express = require('express')
const config  = require('../config')

// TCP reachability check — no DB driver needed
function checkTCP(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const start  = Date.now()
    const socket = new net.Socket()
    socket.setTimeout(timeoutMs)
    socket.on('connect', () => {
      socket.destroy()
      resolve({ status: 'ok', latency_ms: Date.now() - start })
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve({ status: 'error', error: 'timeout' })
    })
    socket.on('error', (err) => {
      resolve({ status: 'error', error: err.message })
    })
    socket.connect(port, host)
  })
}

function parsePostgresAddr(url) {
  try {
    const u = new URL(url)
    return { host: u.hostname || 'postgres', port: parseInt(u.port) || 5432 }
  } catch {
    return { host: 'postgres', port: 5432 }
  }
}

function parseRedisAddr(url) {
  const [host, portStr] = url.replace(/^redis:\/\//, '').split(':')
  return { host: host || 'redis', port: parseInt(portStr) || 6379 }
}

module.exports = function statusRouter(startTime) {
  const router = express.Router()

  router.get('/api/status', async (req, res) => {
    const pg    = parsePostgresAddr(config.databaseUrl)
    const redis = parseRedisAddr(config.redisUrl)

    const [postgresResult, redisResult] = await Promise.all([
      checkTCP(pg.host,    pg.port),
      checkTCP(redis.host, redis.port),
    ])

    const allOk = postgresResult.status === 'ok' && redisResult.status === 'ok'

    res.json({
      status:         allOk ? 'ok' : 'degraded',
      version:        '0.2.0',
      env:            config.appEnv,
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      services: {
        postgres: postgresResult,
        redis:    redisResult,
      },
      timestamp: new Date().toISOString(),
    })
  })

  return router
}
