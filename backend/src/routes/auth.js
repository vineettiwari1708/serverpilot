'use strict'

const express        = require('express')
const bcrypt         = require('bcryptjs')
const { createToken } = require('../auth/jwt')
const { requireAuth } = require('../auth/middleware')
const config          = require('../config')

module.exports = function authRouter(pool) {
  const router = express.Router()

  // POST /api/auth/login — validate credentials, return signed JWT
  router.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    try {
      const { rows } = await pool.query(
        'SELECT id, name, email, password, role FROM users WHERE email = $1',
        [email.trim().toLowerCase()]
      )

      if (rows.length === 0) {
        return res.status(401).json({ error: 'invalid credentials' })
      }

      const user = rows[0]
      const match = await bcrypt.compare(password, user.password)
      if (!match) {
        return res.status(401).json({ error: 'invalid credentials' })
      }

      const token = createToken(user, config.jwtSecret)

      res.json({
        token,
        user: {
          id:    user.id,
          name:  user.name,
          email: user.email,
          role:  user.role,
        },
      })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // GET /api/auth/me — return current user from verified token
  router.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({
      id:    req.user.user_id,
      name:  req.user.name,
      email: req.user.email,
      role:  req.user.role,
    })
  })

  return router
}
