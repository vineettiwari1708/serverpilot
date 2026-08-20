'use strict'

function env(key, fallback) {
  return process.env[key] || fallback
}

module.exports = {
  port:        env('PORT', '8081'),
  appEnv:      env('APP_ENV', 'development'),
  databaseUrl: env('DATABASE_URL', ''),
  redisUrl:    env('REDIS_URL', 'redis:6379'),
  jwtSecret:   env('JWT_SECRET', 'dev-secret'),
  agentSecret: env('AGENT_SECRET', 'dev-agent-secret'),

  seedAdminEmail:    env('SEED_ADMIN_EMAIL',    'admin@serverpilot.local'),
  seedAdminPassword: env('SEED_ADMIN_PASSWORD', 'changeme'),
  seedAdminName:     env('SEED_ADMIN_NAME',     'Admin'),
}
