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
    name: '006_create_applications',
    sql: `
      CREATE TABLE IF NOT EXISTS applications (
        id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name             TEXT        NOT NULL UNIQUE,
        compose_yaml     TEXT        NOT NULL,
        health_check_url TEXT        DEFAULT '',
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: '007_create_deployments',
    sql: `
      CREATE TABLE IF NOT EXISTS deployments (
        id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        app_id       TEXT        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        app_name     TEXT        NOT NULL,
        server_id    TEXT        NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        server_name  TEXT        NOT NULL,
        status       TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','running','health_check','success','failed','rolling_back','rolled_back')),
        compose_yaml TEXT        NOT NULL,
        log          TEXT        DEFAULT '',
        deployed_by  TEXT,
        started_at   TIMESTAMPTZ DEFAULT NOW(),
        finished_at  TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_deployments_app_id    ON deployments(app_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_server_id ON deployments(server_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_pending
        ON deployments(server_id, status) WHERE status = 'pending';
    `,
  },
  {
    name: '004_create_containers',
    sql: `
      CREATE TABLE IF NOT EXISTS containers (
        id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        server_id  TEXT        NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name       TEXT        NOT NULL,
        image      TEXT        NOT NULL,
        status     TEXT        NOT NULL,
        ports      TEXT        DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (server_id, name)
      );
    `,
  },
  {
    name: '005_create_container_commands',
    sql: `
      CREATE TABLE IF NOT EXISTS container_commands (
        id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        server_id    TEXT        NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        container    TEXT        NOT NULL,
        action       TEXT        NOT NULL CHECK (action IN ('start','stop','restart')),
        status       TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','running','done','error')),
        result       TEXT        DEFAULT '',
        requested_by TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_cmds_server_pending
        ON container_commands(server_id, status)
        WHERE status IN ('pending','running');
    `,
  },
  {
    name: '008_create_backup_jobs',
    sql: `
      CREATE TABLE IF NOT EXISTS backup_jobs (
        id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        server_id    TEXT        NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        server_name  TEXT        NOT NULL,
        type         TEXT        NOT NULL CHECK (type IN ('postgres','files')),
        direction    TEXT        NOT NULL DEFAULT 'backup'
                                 CHECK (direction IN ('backup','restore')),
        target       TEXT        NOT NULL,
        backup_dir   TEXT        NOT NULL DEFAULT '/opt/serverpilot/backups',
        source_file  TEXT        DEFAULT '',
        status       TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','running','success','failed')),
        file_path    TEXT        DEFAULT '',
        size_bytes   BIGINT      DEFAULT 0,
        checksum     TEXT        DEFAULT '',
        log          TEXT        DEFAULT '',
        triggered_by TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        finished_at  TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_backup_jobs_server_id ON backup_jobs(server_id);
      CREATE INDEX IF NOT EXISTS idx_backup_jobs_pending
        ON backup_jobs(server_id, status) WHERE status = 'pending';
    `,
  },
  {
    name: '009_create_backup_schedules',
    sql: `
      CREATE TABLE IF NOT EXISTS backup_schedules (
        id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        server_id    TEXT        NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        server_name  TEXT        NOT NULL,
        type         TEXT        NOT NULL CHECK (type IN ('postgres','files')),
        target       TEXT        NOT NULL,
        backup_dir   TEXT        NOT NULL DEFAULT '/opt/serverpilot/backups',
        label        TEXT        DEFAULT '',
        interval_min INT         NOT NULL DEFAULT 1440,
        enabled      BOOLEAN     NOT NULL DEFAULT true,
        last_run     TIMESTAMPTZ,
        next_run     TIMESTAMPTZ DEFAULT NOW(),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_backup_schedules_due
        ON backup_schedules(next_run) WHERE enabled = true;
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
