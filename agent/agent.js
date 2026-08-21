'use strict'

/**
 * ServerPilot Agent — Phase 4
 * Sends heartbeats with CPU/RAM/container data, executes queued commands,
 * and runs application deployments via docker compose.
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
const fs    = require('fs')
const path  = require('path')
const http  = require('http')
const https = require('https')
const { exec, execSync } = require('child_process')

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

function getDiskPct() {
  return new Promise((resolve) => {
    exec("df / --output=pcent 2>/dev/null | tail -1", (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null)
      const pct = parseInt(stdout.trim().replace('%', ''), 10)
      resolve(isNaN(pct) ? null : pct)
    })
  })
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
    const [cpu_pct, disk_pct, containers] = await Promise.all([getCpuPct(), getDiskPct(), getContainers()])
    const ram_pct       = getRamPct()
    const docker_count  = containers.filter(c => /^Up/i.test(c.status)).length

    const { status } = await request('POST', '/api/agent/heartbeat', {
      cpu_pct, ram_pct, disk_pct, docker_count, containers,
    }, AGENT_TOKEN)

    if (status === 204) {
      console.log(`[${new Date().toISOString()}] heartbeat OK  cpu=${cpu_pct}% ram=${ram_pct}% disk=${disk_pct}% containers=${containers.length}`)
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

// ── Deployment execution ──────────────────────────────────────────────────────

const DEPLOY_DIR  = process.env.DEPLOY_DIR  || '/opt/serverpilot/apps'
const BACKUP_DIR  = process.env.BACKUP_DIR  || '/opt/serverpilot/backups'

async function pollDeployments() {
  try {
    const { status, body } = await request('GET', '/api/agent/deployments', null, AGENT_TOKEN)
    if (status !== 200) return
    const { deployments } = JSON.parse(body)
    for (const dep of deployments) {
      executeDeployment(dep)  // fire-and-forget
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] deployment poll error: ${err.message}`)
  }
}

async function appendLog(depId, lines) {
  try {
    await request('POST', `/api/agent/deployments/${depId}/log`, { lines }, AGENT_TOKEN)
  } catch (_) {}
}

async function setDeployStatus(depId, status) {
  try {
    await request('POST', `/api/agent/deployments/${depId}/status`, { status }, AGENT_TOKEN)
  } catch (_) {}
}

async function executeDeployment(dep) {
  const tag  = `[deploy:${dep.id.slice(0, 8)}]`
  const log  = (msg) => { console.log(`[${new Date().toISOString()}] ${tag} ${msg}`) }
  const alog = (msg) => { log(msg); return appendLog(dep.id, msg) }

  const appDir = path.join(DEPLOY_DIR, dep.app_name.replace(/[^a-z0-9_-]/gi, '_'))

  try {
    fs.mkdirSync(appDir, { recursive: true })
    const composePath = path.join(appDir, 'docker-compose.yml')
    fs.writeFileSync(composePath, dep.compose_yaml, 'utf8')

    // Write .env file if env_vars provided
    const envVars = dep.env_vars && typeof dep.env_vars === 'object' ? dep.env_vars : {}
    const envPath = path.join(appDir, '.env')
    const envContent = Object.entries(envVars)
      .map(([k, v]) => `${k}=${String(v).replace(/\n/g, '\\n')}`)
      .join('\n')
    fs.writeFileSync(envPath, envContent, 'utf8')
    const envFlag = `--env-file ${envPath}`

    await alog(`Wrote compose file to ${composePath}`)
    if (Object.keys(envVars).length) await alog(`Loaded ${Object.keys(envVars).length} env var(s)`)
    await setDeployStatus(dep.id, 'running')

    // Pull images
    await alog('Pulling images…')
    await runCmd(`docker compose ${envFlag} -f ${composePath} pull`, dep.id, alog)

    // Start / update containers
    await alog('Starting containers…')
    await runCmd(`docker compose ${envFlag} -f ${composePath} up -d --remove-orphans`, dep.id, alog)

    // Health check
    if (dep.health_check_url) {
      await setDeployStatus(dep.id, 'health_check')
      await alog(`Health checking ${dep.health_check_url} …`)
      const ok = await waitHealthy(dep.health_check_url, 60_000)
      if (!ok) {
        await alog('Health check timed out — marking failed')
        await setDeployStatus(dep.id, 'failed')
        return
      }
      await alog('Health check passed')
    }

    await alog('Deployment succeeded')
    await setDeployStatus(dep.id, 'success')
  } catch (err) {
    await alog(`Error: ${err.message}`)
    await setDeployStatus(dep.id, 'failed')
  }
}

function runCmd(cmd, depId, alog) {
  return new Promise((resolve, reject) => {
    const child = exec(cmd)
    const collect = (data) => { alog(data.toString().trim()) }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`command exited with code ${code}`))
    })
  })
}

function waitHealthy(url, timeoutMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs
    function attempt() {
      if (Date.now() > deadline) return resolve(false)
      const lib = url.startsWith('https') ? https : http
      lib.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) resolve(true)
        else setTimeout(attempt, 5000)
        res.resume()
      }).on('error', () => setTimeout(attempt, 5000))
    }
    attempt()
  })
}

// ── Backup execution ──────────────────────────────────────────────────────────

async function pollBackups() {
  try {
    const { status, body } = await request('GET', '/api/agent/backups', null, AGENT_TOKEN)
    if (status !== 200) return
    const { jobs } = JSON.parse(body)
    for (const job of jobs) {
      executeBackupJob(job)  // fire-and-forget
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] backup poll error: ${err.message}`)
  }
}

async function backupLog(jobId, msg) {
  console.log(`[backup:${jobId.slice(0, 8)}] ${msg}`)
  try { await request('POST', `/api/agent/backups/${jobId}/log`, { lines: msg }, AGENT_TOKEN) }
  catch (_) {}
}

async function backupStatus(jobId, status, extra = {}) {
  try { await request('POST', `/api/agent/backups/${jobId}/status`, { status, ...extra }, AGENT_TOKEN) }
  catch (_) {}
}

async function executeBackupJob(job) {
  if (job.direction === 'restore') {
    await executeRestore(job)
  } else {
    await executeBackup(job)
  }
}

async function executeBackup(job) {
  const dir = job.backup_dir || BACKUP_DIR
  fs.mkdirSync(dir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safeName = job.target.replace(/[^a-z0-9]/gi, '_').slice(0, 40)
  const ext = job.type === 'postgres' ? '.dump' : '.tar.gz'
  const filename = `${job.type}-${safeName}-${stamp}${ext}`
  const filePath = path.join(dir, filename)

  let cmd
  if (job.type === 'postgres') {
    cmd = `pg_dump -Fc "${job.target}" -f "${filePath}"`
  } else {
    cmd = `tar -czf "${filePath}" "${job.target}"`
  }

  await backupLog(job.id, `Starting ${job.type} backup of ${job.target}`)
  await backupLog(job.id, `Output: ${filePath}`)

  try {
    await new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message))
        else resolve()
      })
    })

    // Size
    const size = fs.statSync(filePath).size
    await backupLog(job.id, `Backup complete — ${(size / 1024).toFixed(1)} KB`)

    // SHA256 checksum
    const checksum = await new Promise((resolve, reject) => {
      exec(`sha256sum "${filePath}"`, (err, stdout) => {
        if (err) resolve('')
        else resolve(stdout.trim().split(/\s+/)[0])
      })
    })
    if (checksum) await backupLog(job.id, `SHA256: ${checksum}`)

    await backupStatus(job.id, 'success', { file_path: filePath, size_bytes: size, checksum })
  } catch (err) {
    await backupLog(job.id, `Error: ${err.message}`)
    await backupStatus(job.id, 'failed')
  }
}

async function executeRestore(job) {
  const src = job.source_file
  if (!src) {
    await backupLog(job.id, 'Error: source_file is empty')
    return backupStatus(job.id, 'failed')
  }
  if (!fs.existsSync(src)) {
    await backupLog(job.id, `Error: source file not found: ${src}`)
    return backupStatus(job.id, 'failed')
  }

  let cmd
  if (job.type === 'postgres') {
    cmd = `pg_restore -d "${job.target}" "${src}"`
  } else {
    cmd = `tar -xzf "${src}" -C "${job.target}"`
  }

  await backupLog(job.id, `Starting ${job.type} restore to ${job.target}`)
  await backupLog(job.id, `Source: ${src}`)

  try {
    await new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message))
        else resolve()
      })
    })
    await backupLog(job.id, 'Restore complete')
    await backupStatus(job.id, 'success')
  } catch (err) {
    await backupLog(job.id, `Error: ${err.message}`)
    await backupStatus(job.id, 'failed')
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

console.log(`[agent] starting — reporting to ${CONTROL_URL} every ${INTERVAL_MS / 1000}s`)

async function tick() {
  await sendHeartbeat()
  await pollCommands()
  await pollDeployments()
  await pollBackups()
}

tick()
setInterval(tick, INTERVAL_MS)
