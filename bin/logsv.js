#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'server':
    spawn('node', [path.join(__dirname, '../src/server/index.js'), ...args], { stdio: 'inherit' });
    break;
  case 'agent':
    spawn('node', [path.join(__dirname, '../src/agent/index.js'), ...args], { stdio: 'inherit' });
    break;
  default:
    console.log(`
🔍 LogSV - Ultra-Lightweight Log Monitoring

Usage:
  logsv server [options]     Start dashboard server
  logsv agent [options]      Start log monitoring agent

Options:
  --port PORT                   Server port (default: 3001)
  --ws-port PORT               WebSocket port (default: 8080)
  --server URL                 Central server URL for agent
  --name NAME                  Server name for agent
  --logs PATH1,PATH2           Log files to monitor
  --config FILE                Configuration file

Examples:
  logsv server --port 3001
  logsv agent --server ws://logsv.company.com:8080
  logsv agent --logs "/var/log/nginx/error.log,/var/log/app/*.log"

More info: https://github.com/yourusername/logsv
`);
    process.exit(0);
}
