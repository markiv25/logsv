// LogScope Server Configuration
// Copy to server.config.js and customize

module.exports = {
  // Server ports
  port: process.env.PORT || 3001,
  wsPort: process.env.WS_PORT || 8080,
  
  // Storage limits
  maxErrors: 10000,
  maxServers: 1000,
  retentionHours: 24,
  
  // AI features
  aiInsights: true,
  autoCategories: true,
  patternDetection: true,
  
  // Security (for production)
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  
  // Alerting (future feature)
  alerts: {
    email: process.env.ALERT_EMAIL,
    slack: process.env.SLACK_WEBHOOK,
    threshold: 10  // Alert after 10 errors in 5 minutes
  }
};
