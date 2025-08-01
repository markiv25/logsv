// src/agent/index.js - Ultra-lightweight agent with zero external dependencies!
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const { spawn } = require('child_process');

// Ultra-light log parser with AI-powered categorization
class SmartLogParser {
  constructor() {
    this.parsers = {
      nginx: this.parseNginx.bind(this),
      apache: this.parseApache.bind(this),
      json: this.parseJSON.bind(this),
      syslog: this.parseSyslog.bind(this),
      auto: this.parseAuto.bind(this)
    };
  }

  parse(line, logFile) {
    const parser = this.parsers[logFile.type] || this.parsers.auto;
    const result = parser(line, logFile);
    
    // AI enhancement - add semantic information
    result.semantics = this.extractSemantics(result.message);
    result.urgency = this.calculateUrgency(result);
    
    return result;
  }

  parseAuto(line, logFile) {
    // Smart auto-detection based on content patterns
    if (line.trim().startsWith('{')) return this.parseJSON(line, logFile);
    if (line.includes('nginx')) return this.parseNginx(line, logFile);
    if (line.includes('apache')) return this.parseApache(line, logFile);
    if (this.isSyslogFormat(line)) return this.parseSyslog(line, logFile);
    
    return this.parseGeneric(line, logFile);
  }

  parseGeneric(line, logFile) {
    const patterns = [
      // [2025-08-01 10:30:15] ERROR: message
      /^\[([^\]]+)\]\s*(ERROR|WARN|INFO|DEBUG|FATAL|CRITICAL)[:\s]+(.+)/i,
      // 2025-08-01T10:30:15Z ERROR message
      /^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?[Z]?)\s+(ERROR|WARN|INFO|DEBUG|FATAL|CRITICAL)[:\s]*(.+)/i,
      // ERROR: message
      /^(ERROR|WARN|INFO|DEBUG|FATAL|CRITICAL)[:\s]+(.+)/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          timestamp: match.length > 3 ? this.parseTimestamp(match[1]) : new Date().toISOString(),
          level: this.normalizeLevel(match[match.length - 2]),
          message: match[match.length - 1].trim(),
          originalLine: line,
          parser: 'generic'
        };
      }
    }

    // Fallback - detect level from keywords
    return {
      timestamp: new Date().toISOString(),
      level: this.detectLevelFromContent(line),
      message: line.trim(),
      originalLine: line,
      parser: 'fallback'
    };
  }

  parseJSON(line, logFile) {
    try {
      const json = JSON.parse(line);
      return {
        timestamp: this.parseTimestamp(json.timestamp || json.time || json['@timestamp']),
        level: this.normalizeLevel(json.level || json.severity || 'INFO'),
        message: json.message || json.msg || json.text || line,
        originalLine: line,
        parser: 'json',
        metadata: {
          service: json.service,
          version: json.version,
          trace_id: json.trace_id,
          user_id: json.user_id
        }
      };
    } catch (error) {
      return this.parseGeneric(line, logFile);
    }
  }

  parseNginx(line, logFile) {
    // 2025/08/01 10:30:15 [error] 12345#0: *67890 connect() failed (111: Connection refused)
    const nginxPattern = /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] \d+#\d+: (?:\*\d+ )?(.+)/;
    const match = line.match(nginxPattern);
    
    if (match) {
      return {
        timestamp: this.parseTimestamp(match[1].replace(/\//g, '-')),
        level: this.normalizeLevel(match[2]),
        message: match[3],
        originalLine: line,
        parser: 'nginx'
      };
    }
    
    return this.parseGeneric(line, logFile);
  }

  parseApache(line, logFile) {
    // [Wed Aug 01 10:30:15.123456 2025] [error] [pid 12345] [client 192.168.1.1:12345] message
    const apachePattern = /^\[([^\]]+)\] \[(\w+)\] (?:\[pid \d+\] )?(?:\[client [^\]]+\] )?(.+)/;
    const match = line.match(apachePattern);
    
    if (match) {
      return {
        timestamp: this.parseTimestamp(match[1]),
        level: this.normalizeLevel(match[2]),
        message: match[3],
        originalLine: line,
        parser: 'apache'
      };
    }
    
    return this.parseGeneric(line, logFile);
  }

  parseSyslog(line, logFile) {
    // Aug  1 10:30:15 hostname service[12345]: message
    const syslogPattern = /^(\w{3}\s+\d{1,2} \d{2}:\d{2}:\d{2}) (\S+) ([^:\[]+)(?:\[\d+\])?: (.+)/;
    const match = line.match(syslogPattern);
    
    if (match) {
      return {
        timestamp: this.parseTimestamp(match[1]),
        level: this.detectLevelFromContent(match[4]),
        message: match[4],
        originalLine: line,
        parser: 'syslog',
        metadata: {
          hostname: match[2],
          service: match[3]
        }
      };
    }
    
    return this.parseGeneric(line, logFile);
  }

  isSyslogFormat(line) {
    return /^\w{3}\s+\d{1,2} \d{2}:\d{2}:\d{2} \S+ \S+/.test(line);
  }

  normalizeLevel(level) {
    if (!level) return 'INFO';
    
    const normalized = level.toUpperCase();
    const mappings = {
      'E': 'ERROR', 'ERR': 'ERROR', 'FATAL': 'ERROR', 'CRITICAL': 'ERROR', 'CRIT': 'ERROR',
      'W': 'WARN', 'WARNING': 'WARN', 'WARN': 'WARN',
      'I': 'INFO', 'NOTICE': 'INFO', 'LOG': 'INFO',
      'D': 'DEBUG', 'TRACE': 'DEBUG', 'VERBOSE': 'DEBUG'
    };
    
    return mappings[normalized] || normalized;
  }

  detectLevelFromContent(content) {
    const lower = content.toLowerCase();
    
    const errorKeywords = ['error', 'exception', 'failed', 'failure', 'timeout', 'refused', 'denied', 'fatal', 'critical', 'panic', 'abort'];
    const warnKeywords = ['warning', 'warn', 'deprecated', 'retry', 'fallback', 'slow'];
    
    if (errorKeywords.some(k => lower.includes(k))) return 'ERROR';
    if (warnKeywords.some(k => lower.includes(k))) return 'WARN';
    
    return 'INFO';
  }

  extractSemantics(message) {
    const lower = message.toLowerCase();
    const semantics = {
      hasIpAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(message),
      hasUrl: /https?:\/\/[^\s]+/.test(message),
      hasStatusCode: /\b[4-5]\d{2}\b/.test(message),
      hasTimestamp: /\d{4}-\d{2}-\d{2}/.test(message),
      hasDatabase: ['database', 'db', 'sql', 'query', 'table', 'connection'].some(k => lower.includes(k)),
      hasNetwork: ['network', 'socket', 'connection', 'host', 'port'].some(k => lower.includes(k)),
      hasAuth: ['auth', 'login', 'password', 'token', 'permission'].some(k => lower.includes(k)),
      hasMemory: ['memory', 'heap', 'oom', 'malloc'].some(k => lower.includes(k)),
      hasSecurity: ['security', 'attack', 'breach', 'suspicious'].some(k => lower.includes(k))
    };
    
    return semantics;
  }

  calculateUrgency(parsed) {
    let score = 0;
    
    // Base score from level
    const levelScores = { ERROR: 8, WARN: 4, INFO: 1, DEBUG: 0 };
    score += levelScores[parsed.level] || 0;
    
    // Semantic boosters
    if (parsed.semantics) {
      if (parsed.semantics.hasDatabase) score += 2;
      if (parsed.semantics.hasNetwork) score += 1;
      if (parsed.semantics.hasAuth) score += 3;
      if (parsed.semantics.hasSecurity) score += 5;
      if (parsed.semantics.hasMemory) score += 2;
      if (parsed.semantics.hasStatusCode) score += 1;
    }
    
    // Keyword analysis
    const message = parsed.message.toLowerCase();
    if (message.includes('critical') || message.includes('fatal')) score += 3;
    if (message.includes('timeout')) score += 2;
    if (message.includes('failed') || message.includes('failure')) score += 2;
    
    return Math.min(10, score); // Cap at 10
  }

  parseTimestamp(timestampStr) {
    if (!timestampStr) return new Date().toISOString();
    
    try {
      // Handle various timestamp formats
      let dateStr = timestampStr;
      
      // Convert syslog format (Aug  1 10:30:15) to full date
      if (/^\w{3}\s+\d{1,2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
        const currentYear = new Date().getFullYear();
        dateStr = `${currentYear} ${dateStr}`;
      }
      
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }
}

// Ultra-lightweight file tailer (no external dependencies!)
class FileTailer {
  constructor(filePath, callback) {
    this.filePath = filePath;
    this.callback = callback;
    this.position = 0;
    this.running = false;
    this.watchTimeout = null;
  }

  start() {
    this.running = true;
    
    // Get initial file size
    try {
      const stats = fs.statSync(this.filePath);
      this.position = stats.size; // Start from end (like tail -f)
    } catch (error) {
      console.warn(`Cannot access ${this.filePath}:`, error.message);
      return this.scheduleRetry();
    }
    
    this.watch();
  }

  watch() {
    if (!this.running) return;
    
    try {
      fs.watchFile(this.filePath, { interval: 500 }, (curr, prev) => {
        if (curr.size > prev.size) {
          this.readNewLines();
        }
      });
    } catch (error) {
      console.warn(`Error watching ${this.filePath}:`, error.message);
      this.scheduleRetry();
    }
  }

  readNewLines() {
    try {
      const fd = fs.openSync(this.filePath, 'r');
      const stats = fs.statSync(this.filePath);
      
      if (stats.size <= this.position) return;
      
      const bufferSize = stats.size - this.position;
      const buffer = Buffer.alloc(bufferSize);
      
      fs.readSync(fd, buffer, 0, bufferSize, this.position);
      fs.closeSync(fd);
      
      const content = buffer.toString('utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      lines.forEach(line => this.callback(line));
      
      this.position = stats.size;
    } catch (error) {
      console.warn(`Error reading ${this.filePath}:`, error.message);
      this.scheduleRetry();
    }
  }

  scheduleRetry() {
    if (this.watchTimeout) clearTimeout(this.watchTimeout);
    
    this.watchTimeout = setTimeout(() => {
      if (this.running) {
        console.log(`Retrying ${this.filePath}...`);
        this.start();
      }
    }, 5000);
  }

  stop() {
    this.running = false;
    if (this.watchTimeout) clearTimeout(this.watchTimeout);
    fs.unwatchFile(this.filePath);
  }
}

// Ultra-lightweight LogScope agent
class LogScopeAgent {
  constructor(config = {}) {
    this.config = this.mergeDefaults(config);
    this.parser = new SmartLogParser();
    this.tailers = [];
    this.ws = null;
    this.stats = { errors: 0, warnings: 0, success: 0, totalLines: 0 };
    this.running = false;
    this.reconnectAttempts = 0;
  }

  mergeDefaults(config) {
    return {
      serverId: config.serverId || os.hostname(),
      serverName: config.serverName || os.hostname(),
      centralServerUrl: config.centralServerUrl || process.env.LOGSCOPE_SERVER || 'ws://localhost:8080',
      logFiles: config.logFiles || this.discoverLogFiles(),
      statsInterval: config.statsInterval || 10,
      reconnectDelay: config.reconnectDelay || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || -1,
      ...config
    };
  }

  // Smart log file discovery
  discoverLogFiles() {
    const commonPaths = [
      '/var/log/syslog',
      '/var/log/messages',
      '/var/log/nginx/error.log',
      '/var/log/apache2/error.log',
      '/var/log/auth.log'
    ];

    return commonPaths
      .filter(path => fs.existsSync(path))
      .map(path => ({
        path,
        type: this.detectLogType(path)
      }));
  }

  detectLogType(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('nginx')) return 'nginx';
    if (fileName.includes('apache')) return 'apache';
    if (fileName.includes('syslog') || fileName.includes('messages')) return 'syslog';
    if (fileName.includes('.json')) return 'json';
    
    return 'auto';
  }

  async start() {
    console.log(`🚀 Starting LogSV Agent...`);
    console.log(`📡 Server: ${this.config.centralServerUrl}`);
    console.log(`🏷️  Name: ${this.config.serverName}`);
    
    this.running = true;
    
    // Connect to server
    await this.connect();
    
    // Start monitoring log files
    this.startMonitoring();
    
    console.log(`✅ LogSV Agent running! Monitoring ${this.config.logFiles.length} log files`);
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.centralServerUrl);
        
        this.ws.on('open', () => {
          console.log(`🔌 Connected to LogSV server`);
          this.reconnectAttempts = 0;
          this.register();
          resolve();
        });

        this.ws.on('close', () => {
          console.log(`🔌 Connection lost`);
          if (this.running) this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
          console.error(`❌ WebSocket error:`, error.message);
          if (this.reconnectAttempts === 0) reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  scheduleReconnect() {
    if (this.config.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts reached`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000);
    
    console.log(`⏰ Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.running) {
        this.connect().catch(() => {
          // Will retry again
        });
      }
    }, delay);
  }

  register() {
    this.send({
      type: 'register',
      data: {
        serverId: this.config.serverId,
        serverName: this.config.serverName,
        logFiles: this.config.logFiles.map(f => f.path),
        timestamp: new Date().toISOString(),
        version: '2.0.0-ultra',
        platform: {
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
        }
      }
    });
  }

  startMonitoring() {
    this.config.logFiles.forEach(logFile => {
      if (!fs.existsSync(logFile.path)) {
        console.warn(`⚠️  Log file not found: ${logFile.path}`);
        return;
      }

      const tailer = new FileTailer(logFile.path, (line) => {
        this.processLogLine(line, logFile);
      });

      tailer.start();
      this.tailers.push(tailer);
      
      console.log(`👁️  Monitoring: ${logFile.path} (${logFile.type})`);
    });
  }

  processLogLine(line, logFile) {
    try {
      this.stats.totalLines++;
      
      // Parse the log line
      const parsed = this.parser.parse(line, logFile);
      
      // Update stats
      if (parsed.level === 'ERROR') {
        this.stats.errors++;
        this.sendError(parsed, logFile);
      } else if (parsed.level === 'WARN') {
        this.stats.warnings++;
      } else {
        this.stats.success++;
      }
      
      // Send periodic stats
      if (this.stats.totalLines % this.config.statsInterval === 0) {
        this.sendStats();
      }
      
    } catch (error) {
      console.error(`❌ Error processing log line:`, error.message);
    }
  }

  sendError(parsed, logFile) {
    // Only send high-urgency errors to reduce noise
    if (parsed.urgency < 5) return;
    
    const errorData = {
      type: 'error',
      data: {
        serverId: this.config.serverId,
        serverName: this.config.serverName,
        logFile: logFile.path,
        lineNumber: this.getApproxLineNumber(logFile.path),
        timestamp: parsed.timestamp,
        errorMessage: parsed.message,
        parser: parsed.parser,
        urgency: parsed.urgency,
        semantics: parsed.semantics
      }
    };

    this.send(errorData);
  }

  getApproxLineNumber(filePath) {
    try {
      const stats = fs.statSync(filePath);
      // Rough estimate: 1 line = ~100 bytes average
      return Math.floor(stats.size / 100);
    } catch (error) {
      return 0;
    }
  }

  sendStats() {
    this.send({
      type: 'stats',
      data: {
        serverId: this.config.serverId,
        stats: { ...this.stats },
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (error) {
        console.error(`❌ Error sending data:`, error.message);
      }
    }
  }

  stop() {
    console.log(`🛑 Stopping LogSV Agent...`);
    this.running = false;
    
    // Stop file tailers
    this.tailers.forEach(tailer => tailer.stop());
    
    // Close WebSocket
    if (this.ws) this.ws.close();
    
    console.log(`✅ LogSV Agent stopped`);
  }
}

// CLI interface
function createAgent() {
  const args = process.argv.slice(2);
  let config = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    
    switch (key) {
      case 'server':
        config.centralServerUrl = value;
        break;
      case 'name':
        config.serverName = value;
        break;
      case 'logs':
        config.logFiles = value.split(',').map(path => ({
          path: path.trim(),
          type: 'auto'
        }));
        break;
      case 'config':
        try {
          const configFile = require(path.resolve(value));
          config = { ...configFile, ...config };
        } catch (error) {
          console.warn(`⚠️  Config file not found: ${value}`);
        }
        break;
    }
  }

  return new LogScopeAgent(config);
}

// Auto-start if run directly
if (require.main === module) {
  const agent = createAgent();
  
  agent.start().catch(error => {
    console.error(`❌ Failed to start agent:`, error.message);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => agent.stop());
  process.on('SIGINT', () => agent.stop());
}

module.exports = { LogScopeAgent, SmartLogParser, FileTailer };
