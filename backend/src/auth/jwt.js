'use strict'

const jwt = require('jsonwebtoken')

const TOKEN_TTL = '24h'

function createToken(user, secret) {
  return jwt.sign(
    {
      user_id: user.id,
      email:   user.email,
      name:    user.name,
      role:    user.role,
    },
    secret,
    { expiresIn: TOKEN_TTL, issuer: 'serverpilot' }
  )
}

function verifyToken(token, secret) {
  return jwt.verify(token, secret, { issuer: 'serverpilot' })
}

module.exports = { createToken, verifyToken }
