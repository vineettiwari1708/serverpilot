'use strict'

const bcrypt = require('bcryptjs')

module.exports = async function seedAdmin(pool, logger, email, password, name) {
  const { rows } = await pool.query(
    'SELECT 1 FROM users WHERE email = $1', [email]
  )
  if (rows.length > 0) {
    logger.info('seed: admin already exists', { email })
    return
  }

  const hash = await bcrypt.hash(password, 12)
  await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
    [name, email, hash, 'admin']
  )

  logger.info('seed: admin user created', { email })
}
