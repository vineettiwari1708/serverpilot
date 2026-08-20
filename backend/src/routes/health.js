'use strict'

const express = require('express')
const config  = require('../config')

const router = express.Router()

function healthHandler(req, res) {
  res.json({
    status:    'ok',
    service:   'serverpilot-backend',
    version:   '0.2.0',
    env:       config.appEnv,
    timestamp: new Date().toISOString(),
  })
}

router.get('/health',     healthHandler)
router.get('/api/health', healthHandler)

module.exports = router
