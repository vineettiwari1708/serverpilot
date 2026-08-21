'use strict'

const MIGRATIONS = [
  {
    name: '001_create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name       TEXT        NOT NULL,
        email      TEXT        UNIQUE NOT NULL,
        password   TEXT        NOT NULL,
        role       TEXT        NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `,
  },
  {
    name: '002_create_servers',
    sql: `
      CREATE TABLE IF NOT EXISTS servers (
        id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name          TEXT        NOT NULL,
        hostname      TEXT        UNIQUE NOT NULL,
        ip            TEXT,
        agent_token   TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
        registered_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen     TIMESTAMPTZ
      );
    `,
  },
  {
    name: '003_create_heartbeats',
    sql: `
      CREATE TABLE IF NOT EXISTS heartbeats (
        id            BIGSERIAL   PRIMARY KEY,
        server_id     TEXT        NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        cpu_pct       FLOAT,
        ram_pct       FLOAT,
        disk_pct      FLOAT,
        docker_count  INT         DEFAULT 0,
        recorded_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_heartbeats_server_id ON heartbeats(server_id);
      CREATE INDEX IF NOT EXISTS idx_heartbeats_recorded_at ON heartbeats(recorded_at DESC);
    `,
  },
]

module.exports = async function migrate(pool, logger) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  let applied = 0

  for (const m of MIGRATIONS) {
    const { rows } = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1', [m.name]
    )
    if (rows.length > 0) continue

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(m.sql)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [m.name])
      await client.query('COMMIT')
      logger.info('migration applied', { name: m.name })
      applied++
    } catch (err) {
      await client.query('ROLLBACK')
      throw new Error(`migration ${m.name} failed: ${err.message}`)
    } finally {
      client.release()
    }
  }

  if (applied === 0) {
    logger.info('migrations: nothing to apply')
  } else {
    logger.info('migrations complete', { applied })
  }
}
