'use strict'

const https = require('https')
const http  = require('http')

async function sendTelegram(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch { /* silent — don't break main flow */ }
}

function post(url, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body)
    const parsed  = new URL(url)
    const lib     = parsed.protocol === 'https:' ? https : http
    const req = lib.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      res.resume()
      resolve(res.statusCode)
    })
    req.on('error', () => resolve(0))
    req.setTimeout(5000, () => { req.destroy(); resolve(0) })
    req.write(payload)
    req.end()
  })
}

async function sendNotification(pool, { severity, title, body }) {
  let flag
  if (severity === 'critical') flag = 'on_critical'
  else if (severity === 'warning') flag = 'on_warning'
  else flag = 'on_offline'

  const { rows } = await pool.query(
    `SELECT * FROM notification_channels WHERE enabled = true AND ${flag} = true`
  )

  for (const ch of rows) {
    const payload = ch.type === 'slack'
      ? { text: `*[${severity.toUpperCase()}] ${title}*\n${body}` }
      : { severity, title, body, timestamp: new Date().toISOString() }

    post(ch.url, payload).catch(() => {})
  }
}

module.exports = { sendNotification, sendTelegram }
