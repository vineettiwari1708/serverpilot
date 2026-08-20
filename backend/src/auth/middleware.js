'use strict'

const { verifyToken } = require('./jwt')
const config          = require('../config')

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing or invalid authorization header' })
  }

  try {
    req.user = verifyToken(header.slice(7), config.jwtSecret)
    next()
  } catch {
    res.status(401).json({ error: 'invalid or expired token' })
  }
}

module.exports = { requireAuth }
