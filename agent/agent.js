'use strict'

/**
 * ServerPilot Agent
 * Drop this file on any server you want to monitor.
 * Requirements: Node.js 18+ (uses built-in http/https/os)
 *
 * Usage:
 *   AGENT_TOKEN=<token> CONTROL_URL=http://your-server:8081 node agent.js
 *
 * Register first:
 *   curl -X POST http://your-server:8081/api/agent/register \
 *     -H "Content-Type: application/json" \
 *     -d '{"name":"my-server","hostname":"server1","agent_secret":"changeme"}'
 *   # Copy the returned token → set as AGENT_TOKEN
 */

const os    = require('os')
const http  = require('http')
const https = require('https')

const CONTROL_URL   = (process.env.CONTROL_URL || 'http://localhost:8081').replace(/\/$/, '')
const AGENT_TOKEN   = process.env.AGENT_TOKEN
const INTERVAL_MS   = parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10)

if (!AGENT_TOKEN) {
  console.error('[agent] AGENT_TOKEN is required. Register this server first.')
  process.exit(1)
}

// Sample CPU utilisation over 1 second (before/after comparison)
function getCpuPct() {
  return new Promise((resolve) => {
    const snap1 = os.cpus().map(c => ({ ...c.times }))
    setTimeout(() => {
      const snap2 = os.cpus()
      let idle = 0, total = 0
      snap2.forEach((cpu, i) => {
        const b = snap1[i]
        const a = cpu.times
        const idleDelta  = a.idle  - b.idle
        const totalDelta = Object.values(a).reduce((s, v) => s + v, 0)
                         - Object.values(b).reduce((s, v) => s + v, 0)
        idle  += idleDelta
        total += totalDelta
      })
      resolve(total > 0 ? Math.round((1 - idle / total) * 100) : 0)
    }, 1000)
  })
}

function getRamPct() {
  return Math.round((1 - os.freemem() / os.totalmem()) * 100)
}

// Count running Docker containers via `docker ps -q`
function getDockerCount() {
  return new Promise((resolve) => {
    const { exec } = require('child_process')
    exec('docker ps -q 2>/dev/null', (err, stdout) => {
      if (err) return resolve(0)
      const lines = stdout.trim().split('\n').filter(Boolean)
      resolve(lines.length)
    })
  })
}

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const url  = new URL(path, CONTROL_URL)
    const data = JSON.stringify(body)
    const lib  = url.protocol === 'https:' ? https : http

    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { Authorization: `Agent ${token}` } : {}),
      },
    }, (res) => {
      let body = ''
      res.on('data', d => { body += d })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function sendHeartbeat() {
  try {
    const [cpu_pct, docker_count] = await Promise.all([getCpuPct(), getDockerCount()])
    const ram_pct = getRamPct()

    const { status } = await post('/api/agent/heartbeat', { cpu_pct, ram_pct, docker_count }, AGENT_TOKEN)

    if (status === 204) {
      console.log(`[${new Date().toISOString()}] heartbeat OK  cpu=${cpu_pct}% ram=${ram_pct}% docker=${docker_count}`)
    } else {
      console.error(`[${new Date().toISOString()}] heartbeat failed status=${status}`)
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] heartbeat error: ${err.message}`)
  }
}

console.log(`[agent] starting — reporting to ${CONTROL_URL} every ${INTERVAL_MS / 1000}s`)
sendHeartbeat()
setInterval(sendHeartbeat, INTERVAL_MS)
