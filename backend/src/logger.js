'use strict'

function log(level, msg, meta = {}) {
  const entry = { time: new Date().toISOString(), level, msg, ...meta }
  if (level === 'ERROR') {
    console.error(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

module.exports = {
  info:  (msg, meta) => log('INFO',  msg, meta),
  warn:  (msg, meta) => log('WARN',  msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta),
}
