'use strict'

const express         = require('express')
const bcrypt          = require('bcryptjs')
const { requireAuth } = require('../auth/middleware')
const { logAudit }    = require('../audit')

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  next()
}

module.exports = function usersRouter(pool) {
  const router = express.Router()

  // GET /api/users
  router.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, email, role, created_at FROM users ORDER BY created_at`
      )
      res.json({ users: rows })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // POST /api/users  { name, email, password, role }
  router.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const { name, email, password, role } = req.body || {}
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' })
    }
    const validRoles = ['admin', 'viewer']
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` })
    }
    try {
      const hash = await bcrypt.hash(password, 12)
      const { rows } = await pool.query(`
        INSERT INTO users (name, email, password, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, role, created_at
      `, [name.trim(), email.trim().toLowerCase(), hash, role || 'viewer'])
      logAudit(pool, req, 'user.create', 'user', rows[0].id, { email: rows[0].email, role: rows[0].role })
      res.status(201).json({ user: rows[0] })
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'email already exists' })
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // PUT /api/users/:id  { name, role }  (cannot change own role)
  router.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const { name, role } = req.body || {}
    if (role && req.params.id === req.user.id) {
      return res.status(400).json({ error: 'cannot change your own role' })
    }
    try {
      const { rows } = await pool.query(`
        UPDATE users
        SET name       = COALESCE($1, name),
            role       = COALESCE($2, role),
            updated_at = NOW()
        WHERE id = $3
        RETURNING id, name, email, role, created_at
      `, [name || null, role || null, req.params.id])
      if (!rows.length) return res.status(404).json({ error: 'user not found' })
      logAudit(pool, req, 'user.update', 'user', req.params.id, { name, role })
      res.json({ user: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // PUT /api/users/me  { name }
  router.put('/api/users/me', requireAuth, async (req, res) => {
    const { name } = req.body || {}
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' })
    }
    try {
      const { rows } = await pool.query(`
        UPDATE users SET name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, email, role
      `, [name.trim(), req.user.id])
      if (!rows.length) return res.status(404).json({ error: 'user not found' })
      logAudit(pool, req, 'user.self_update', 'user', req.user.id, { name: name.trim() })
      res.json({ user: rows[0] })
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // PUT /api/users/me/password  { current_password, new_password }
  router.put('/api/users/me/password', requireAuth, async (req, res) => {
    const { current_password, new_password } = req.body || {}
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' })
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'new password must be at least 8 characters' })
    }
    try {
      const { rows } = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id])
      if (!rows.length) return res.status(404).json({ error: 'user not found' })
      const valid = await bcrypt.compare(current_password, rows[0].password)
      if (!valid) return res.status(401).json({ error: 'current password is incorrect' })
      const hash = await bcrypt.hash(new_password, 12)
      await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id])
      logAudit(pool, req, 'user.password_change', 'user', req.user.id, {})
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // DELETE /api/users/:id  (cannot delete self)
  router.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'cannot delete yourself' })
    }
    try {
      const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
      if (!rowCount) return res.status(404).json({ error: 'user not found' })
      logAudit(pool, req, 'user.delete', 'user', req.params.id, {})
      res.status(204).end()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  })

  return router
}
