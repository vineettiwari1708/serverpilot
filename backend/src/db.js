'use strict'

const { Pool } = require('pg')
const config   = require('./config')

if (!config.databaseUrl) {
  console.error(JSON.stringify({ level: 'ERROR', msg: 'DATABASE_URL is required' }))
  process.exit(1)
}

const pool = new Pool({ connectionString: config.databaseUrl })

// Fail fast: verify connection on first use by calling connect() during startup
async function connect() {
  const client = await pool.connect()
  client.release()
}

module.exports = { pool, connect }
