'use strict'

// Validates Authorization: Agent <token> header against the servers table.
// Injects req.server = { id, name } on success.
function agentAuth(pool) {
  return async function requireAgent(req, res, next) {
    const header = req.headers.authorization || ''
    if (!header.startsWith('Agent ')) {
      return res.status(401).json({ error: 'missing agent token' })
    }

    const token = header.slice(6).trim()
    try {
      const { rows } = await pool.query(
        'SELECT id, name FROM servers WHERE agent_token = $1', [token]
      )
      if (rows.length === 0) {
        return res.status(401).json({ error: 'invalid agent token' })
      }
      req.server = rows[0]
      next()
    } catch (err) {
      res.status(500).json({ error: 'internal server error' })
    }
  }
}

module.exports = { agentAuth }
