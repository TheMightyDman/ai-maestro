/**
 * PM2 configuration for running AI Maestro on an alternate port.
 *
 * Usage:
 *   pm2 start pm2-maestro1.config.js
 *   pm2 save      # optional, persist across restarts
 */

const fs = require('fs')
const path = require('path')

const logsDir = path.join(__dirname, 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

module.exports = {
  apps: [
    {
      name: 'maestro-1',
      script: 'server.mjs',
      cwd: __dirname,
      interpreter: 'node',
      node_args: ['--enable-source-maps'],
      env: {
        NODE_ENV: 'development',
        PORT: '23000'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '23000'
      },
      out_file: path.join(logsDir, 'pm2-maestro1.log'),
      error_file: path.join(logsDir, 'pm2-maestro1-error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 5,
      min_uptime: '10s',
      autorestart: true
    },
    {
      name: 'maestro-1-gateway',
      script: 'services/terminal-gateway/dist/index.js',
      cwd: __dirname,
      interpreter: 'node',
      node_args: ['--enable-source-maps'],
      env: {
        NODE_ENV: 'development',
        TERMINAL_WS_PORT: '23001',
        TERMINAL_RING_BYTES: String(32 * 1024 * 1024),
        TERMINAL_HIGH_WATER: String(2 * 1024 * 1024),
        TERMINAL_LOW_WATER: String(512 * 1024)
      },
      env_production: {
        NODE_ENV: 'production',
        TERMINAL_WS_PORT: '23001',
        TERMINAL_RING_BYTES: String(32 * 1024 * 1024),
        TERMINAL_HIGH_WATER: String(2 * 1024 * 1024),
        TERMINAL_LOW_WATER: String(512 * 1024)
      },
      out_file: path.join(logsDir, 'pm2-gateway.log'),
      error_file: path.join(logsDir, 'pm2-gateway-error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 5,
      min_uptime: '10s',
      autorestart: true
    }
  ]
}
