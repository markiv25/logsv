// LogScope Agent Configuration
// Copy to agent.config.js and customize

module.exports = {
  // Connection settings
  centralServerUrl: process.env.LOGSCOPE_SERVER || 'ws://localhost:8080',
  
  // Server identification
  serverId: process.env.SERVER_ID || require('os').hostname(),
  serverName: process.env.SERVER_NAME || 'My Server',
  
  // Log files to monitor
  logFiles: [
    {
      path: '/var/log/nginx/error.log',
      type: 'nginx'  // nginx, apache, json, syslog, auto
    },
    {
      path: '/var/log/apache2/error.log', 
      type: 'apache'
    },
    {
      path: '/var/log/app/*.log',
      type: 'auto'  // Smart auto-detection
    },
    {
      path: '/var/log/syslog',
      type: 'syslog'
    }
  ],
  
  // Performance settings
  statsInterval: 10,  // Send stats every N log entries
  
  // Reconnection settings
  reconnectDelay: 5000,
  maxReconnectAttempts: -1  // -1 for infinite
};
