'use strict'

/**
 * ServerPilot Agent — Phase 3
 * Sends heartbeats with CPU/RAM/container data and executes queued commands.
 *
 * Usage:
 *   AGENT_TOKEN=<token> CONTROL_URL=http://your-server:8081 node agent.js
 *
 * Register first:
 *   curl -X POST http://your-server:8081/api/agent/register \
 *     -H "Content-Type: application/json" \
 *     -d '{"name":"my-server","hostname":"server1","agent_secret":"changeme"}'
 */

const os    = require('os')
const http  = require('http')
const https = require('https')
const { exec } = require('child_process')

const CONTROL_URL  = (process.env.CONTROL_URL || 'http://localhost:8081').replace(/\/$/, '')
const AGENT_TOKEN  = process.env.AGENT_TOKEN
const INTERVAL_MS  = parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10)

if (!AGENT_TOKEN) {
  console.error('[agent] AGENT_TOKEN is required. Register this server first.')
  process.exit(1)
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function getCpuPct() {
  return new Promise((resolve) => {
    const snap1 = os.cpus().map(c => ({ ...c.times }))
    setTimeout(() => {
      const snap2 = os.cpus()
      let idle = 0, total = 0
      snap2.forEach((cpu, i) => {
        const b = snap1[i], a = cpu.times
        idle  += a.idle - b.idle
        total += Object.values(a).reduce((s, v) => s + v, 0)
                - Object.values(b).reduce((s, v) => s + v, 0)
      })
      resolve(total > 0 ? Math.round((1 - idle / total) * 100) : 0)
    }, 1000)
  })
}

function getRamPct() {
  return Math.round((1 - os.freemem() / os.totalmem()) * 100)
}

// Returns array of { name, image, status, ports }
function getContainers() {
  return new Promise((resolve) => {
    exec(
      'docker ps -a --format "{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}" 2>/dev/null',
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve([])
        const containers = stdout.trim().split('\n').filter(Boolean).map(line => {
          const [name, image, status, ports] = line.split('|')
          return { name: name || '', image: image || '', status: status || '', ports: ports || '' }
        })
        resolve(containers)
      }
    )
  })
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url  = new URL(path, CONTROL_URL)
    const data = body ? JSON.stringify(body) : null
    const lib  = url.protocol === 'https:' ? https : http

    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method,
      headers: {
        'Content-Type':   'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Agent ${token}` } : {}),
      },
    }, (res) => {
      let raw = ''
      res.on('data', d => { raw += d })
      res.on('end', () => resolve({ status: res.statusCode, body: raw }))
    })

    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

async function sendHeartbeat() {
  try {
    const [cpu_pct, containers] = await Promise.all([getCpuPct(), getContainers()])
    const ram_pct       = getRamPct()
    const docker_count  = containers.filter(c => /^Up/i.test(c.status)).length

    const { status } = await request('POST', '/api/agent/heartbeat', {
      cpu_pct, ram_pct, docker_count, containers,
    }, AGENT_TOKEN)

    if (status === 204) {
      console.log(`[${new Date().toISOString()}] heartbeat OK  cpu=${cpu_pct}% ram=${ram_pct}% containers=${containers.length}`)
    } else {
      console.error(`[${new Date().toISOString()}] heartbeat failed status=${status}`)
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] heartbeat error: ${err.message}`)
  }
}

// ── Command polling ───────────────────────────────────────────────────────────

async function pollCommands() {
  try {
    const { status, body } = await request('GET', '/api/agent/commands', null, AGENT_TOKEN)
    if (status !== 200) return

    const { commands } = JSON.parse(body)
    for (const cmd of commands) {
      executeCommand(cmd)  // fire-and-forget per command
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] command poll error: ${err.message}`)
  }
}

function executeCommand(cmd) {
  const dockerCmds = {
    start:   `docker start ${cmd.container}`,
    stop:    `docker stop ${cmd.container}`,
    restart: `docker restart ${cmd.container}`,
  }
  const dockerCmd = dockerCmds[cmd.action]
  if (!dockerCmd) {
    return reportResult(cmd.id, 'error', 'unknown action')
  }

  console.log(`[${new Date().toISOString()}] exec: ${dockerCmd}`)
  exec(dockerCmd, async (err, stdout, stderr) => {
    if (err) {
      await reportResult(cmd.id, 'error', (stderr || err.message).trim())
    } else {
      await reportResult(cmd.id, 'done', stdout.trim() || cmd.container)
    }
  })
}

async function reportResult(cmdId, status, result) {
  try {
    await request('POST', `/api/agent/commands/${cmdId}/result`, { status, result }, AGENT_TOKEN)
  } catch (err) {
    console.error(`[${new Date().toISOString()}] report result error: ${err.message}`)
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

console.log(`[agent] starting — reporting to ${CONTROL_URL} every ${INTERVAL_MS / 1000}s`)

async function tick() {
  await sendHeartbeat()
  await pollCommands()
}

tick()
setInterval(tick, INTERVAL_MS)
