// src/server/index.js - Ultra-lightweight server with AI features
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const crypto = require('crypto');

// Ultra-light in-memory storage (no external DB needed!)
class MemoryStore {
  constructor() {
    this.servers = new Map();
    this.errors = [];
    this.insights = [];
    this.maxErrors = 1000;
    this.patterns = new Map(); // For AI pattern recognition
  }

  addError(error) {
    // AI-powered error categorization
    error.category = this.categorizeError(error.errorMessage);
    error.severity = this.calculateSeverity(error.errorMessage);
    error.id = this.generateId();
    error.timestamp = error.timestamp || new Date().toISOString();
    
    // Check for duplicates and update count
    const existing = this.findSimilarError(error);
    if (existing) {
      existing.count++;
      existing.lastSeen = error.timestamp;
      existing.trend = this.calculateTrend(existing);
      return existing;
    } else {
      error.count = 1;
      error.firstSeen = error.timestamp;
      error.lastSeen = error.timestamp;
      error.trend = 'new';
      this.errors.unshift(error);
      
      // Trim to max size
      if (this.errors.length > this.maxErrors) {
        this.errors = this.errors.slice(0, this.maxErrors);
      }
      
      // Update patterns for AI insights
      this.updatePatterns(error);
      
      return error;
    }
  }

  // AI-powered error categorization
  categorizeError(message) {
    const msg = message.toLowerCase();
    
    const categories = {
      'Database Connectivity': ['connection', 'timeout', 'database', 'db', 'mysql', 'postgres', 'mongo'],
      'Authentication': ['auth', 'login', 'password', 'token', 'permission', 'unauthorized', '401', '403'],
      'Network Issues': ['network', 'dns', 'host', 'unreachable', 'connection refused', 'timeout'],
      'File System': ['file', 'directory', 'permission denied', 'disk', 'space', 'io error'],
      'Memory Issues': ['memory', 'oom', 'heap', 'stack overflow', 'out of memory'],
      'Data Processing': ['json', 'parse', 'format', 'invalid', 'malformed', 'corrupt'],
      'Resource Management': ['queue', 'pool', 'limit', 'capacity', 'overflow', 'resource'],
      'Configuration': ['config', 'setting', 'parameter', 'missing', 'invalid config'],
      'API Issues': ['api', 'endpoint', 'route', '404', '500', 'service unavailable'],
      'Security': ['security', 'attack', 'breach', 'suspicious', 'blocked', 'firewall']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => msg.includes(keyword))) {
        return category;
      }
    }
    
    return 'General';
  }

  // Smart severity calculation
  calculateSeverity(message) {
    const msg = message.toLowerCase();
    
    if (['fatal', 'critical', 'emergency', 'panic', 'severe'].some(w => msg.includes(w))) {
      return 'critical';
    }
    if (['error', 'fail', 'exception', 'timeout', 'refused', 'denied'].some(w => msg.includes(w))) {
      return 'high';
    }
    if (['warn', 'warning', 'deprecated', 'retry'].some(w => msg.includes(w))) {
      return 'medium';
    }
    
    return 'low';
  }

  // Find similar errors for deduplication
  findSimilarError(newError) {
    return this.errors.find(error => 
      error.serverId === newError.serverId &&
      error.logFile === newError.logFile &&
      this.normalizeMessage(error.errorMessage) === this.normalizeMessage(newError.errorMessage)
    );
  }

  normalizeMessage(message) {
    return message
      .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d{3})?[Z]?/g, 'TIMESTAMP')
      .replace(/\b\d+\b/g, 'NUMBER')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
      .toLowerCase()
      .trim();
  }

  calculateTrend(error) {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Count occurrences in last hour
    const recentCount = this.errors.filter(e => 
      e.id !== error.id &&
      this.normalizeMessage(e.errorMessage) === this.normalizeMessage(error.errorMessage) &&
      new Date(e.lastSeen).getTime() > oneHourAgo
    ).length;

    if (recentCount === 0) return 'new';
    if (recentCount > 5) return 'increasing';
    if (recentCount < 2) return 'decreasing';
    return 'stable';
  }

  updatePatterns(error) {
    const pattern = this.normalizeMessage(error.errorMessage);
    const current = this.patterns.get(pattern) || { count: 0, servers: new Set(), lastSeen: null };
    
    current.count++;
    current.servers.add(error.serverId);
    current.lastSeen = error.timestamp;
    
    this.patterns.set(pattern, current);
    
    // Generate AI insights based on patterns
    this.generateInsights();
  }

  generateInsights() {
    const insights = [];
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Pattern detection
    for (const [pattern, data] of this.patterns.entries()) {
      if (data.count > 5 && data.servers.size > 1) {
        insights.push({
          type: 'pattern',
          title: 'Cross-server error pattern detected',
          description: `Similar errors occurring across ${data.servers.size} servers`,
          confidence: Math.min(95, 60 + (data.count * 2)),
          pattern: pattern
        });
      }
    }

    // Anomaly detection - spike in errors
    const recentErrors = this.errors.filter(e => 
      new Date(e.lastSeen).getTime() > oneHourAgo
    );
    
    if (recentErrors.length > 10) {
      const categories = {};
      recentErrors.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + 1;
      });
      
      const topCategory = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (topCategory && topCategory[1] > 3) {
        insights.push({
          type: 'anomaly',
          title: `Spike in ${topCategory[0]} errors`,
          description: `${topCategory[1]} errors in the last hour - ${Math.round((topCategory[1] / recentErrors.length) * 100)}% of all recent errors`,
          confidence: 85
        });
      }
    }

    // Recommendations based on common issues
    const dbErrors = this.errors.filter(e => e.category === 'Database Connectivity').length;
    if (dbErrors > 3) {
      insights.push({
        type: 'recommendation',
        title: 'Database connection optimization needed',
        description: 'Consider implementing connection pooling and retry mechanisms',
        confidence: 78
      });
    }

    this.insights = insights.slice(0, 5); // Keep top 5 insights
  }

  search(query) {
    if (!query) return this.errors.slice(0, 50);
    
    const q = query.toLowerCase();
    
    // Natural language processing
    let filters = [];
    
    if (q.includes('critical') || q.includes('urgent')) {
      filters.push(e => e.severity === 'critical');
    }
    if (q.includes('database') || q.includes('db')) {
      filters.push(e => e.category === 'Database Connectivity');
    }
    if (q.includes('timeout')) {
      filters.push(e => e.errorMessage.toLowerCase().includes('timeout'));
    }
    if (q.includes('new') || q.includes('recent')) {
      filters.push(e => e.trend === 'new' || e.trend === 'increasing');
    }
    if (q.includes('server')) {
      const serverMatch = q.match(/server[- ]?(\w+)/);
      if (serverMatch) {
        filters.push(e => e.serverId.includes(serverMatch[1]) || e.server.toLowerCase().includes(serverMatch[1]));
      }
    }
    
    // Apply filters
    let results = this.errors;
    for (const filter of filters) {
      results = results.filter(filter);
    }
    
    // Fallback to text search
    if (results.length === this.errors.length && filters.length === 0) {
      results = this.errors.filter(e => 
        e.errorMessage.toLowerCase().includes(q) ||
        e.server.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    
    return results.slice(0, 100);
  }

  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }
}

// Ultra-lightweight HTTP server
class LogScopeServer {
  constructor(port = 3001, wsPort = 8080) {
    this.port = port;
    this.wsPort = wsPort;
    this.store = new MemoryStore();
    this.clients = new Set();
    this.agents = new Map();
    
    this.setupHTTPServer();
    this.setupWebSocketServer();
  }

  setupHTTPServer() {
    this.httpServer = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${this.port}`);
      
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // API Routes
      if (url.pathname.startsWith('/api/')) {
        this.handleAPI(req, res, url);
        return;
      }

      // Serve dashboard
      this.serveDashboard(req, res, url.pathname);
    });
  }

  handleAPI(req, res, url) {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      if (url.pathname === '/api/servers') {
        const servers = Array.from(this.agents.values());
        res.writeHead(200);
        res.end(JSON.stringify(servers));
      }
      else if (url.pathname === '/api/errors') {
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const query = url.searchParams.get('q') || '';
        const errors = this.store.search(query).slice(0, limit);
        res.writeHead(200);
        res.end(JSON.stringify(errors));
      }
      else if (url.pathname === '/api/stats') {
        const servers = Array.from(this.agents.values());
        const stats = {
          totalErrors: servers.reduce((sum, s) => sum + (s.errorCount || 0), 0),
          totalSuccess: servers.reduce((sum, s) => sum + (s.successCount || 0), 0),
          totalWarnings: servers.reduce((sum, s) => sum + (s.warningCount || 0), 0),
          totalServers: servers.length,
          onlineServers: servers.filter(s => s.status === 'online').length
        };
        res.writeHead(200);
        res.end(JSON.stringify(stats));
      }
      else if (url.pathname === '/api/insights') {
        res.writeHead(200);
        res.end(JSON.stringify(this.store.insights));
      }
      else if (url.pathname === '/api/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ 
          status: 'ok', 
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          servers: this.agents.size,
          errors: this.store.errors.length
        }));
      }
      else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  serveDashboard(req, res, pathname) {
    // Serve the embedded React dashboard
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LogSV - AI-Powered Log Monitoring</title>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/socket.io-client@4/dist/socket.io.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
    </style>
</head>
<body>
    <div id="root">
        <div class="flex items-center justify-center min-h-screen">
            <div class="text-center">
                <div class="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
                <h2 class="text-xl font-semibold mt-4">Loading LogSV...</h2>
            </div>
        </div>
    </div>
    
    <script type="text/babel">
        const { useState, useEffect } = React;
        
        const LogScope = () => {
            const [data, setData] = useState({ servers: [], errors: [], insights: [] });
            const [searchQuery, setSearchQuery] = useState('');
            
            useEffect(() => {
                // Initial data fetch
                Promise.all([
                    fetch('/api/servers').then(r => r.json()),
                    fetch('/api/errors').then(r => r.json()),
                    fetch('/api/insights').then(r => r.json())
                ]).then(([servers, errors, insights]) => {
                    setData({ servers, errors, insights });
                });
                
                // Polling for updates (simplified)
                const interval = setInterval(() => {
                    fetch('/api/errors').then(r => r.json()).then(errors => 
                        setData(prev => ({ ...prev, errors }))
                    );
                }, 5000);
                
                return () => clearInterval(interval);
            }, []);
            
            const handleSearch = async () => {
                const response = await fetch(\`/api/errors?q=\${encodeURIComponent(searchQuery)}\`);
                const errors = await response.json();
                setData(prev => ({ ...prev, errors }));
            };
            
            const getSeverityColor = (severity) => {
                switch (severity) {
                    case 'critical': return 'bg-red-100 text-red-800';
                    case 'high': return 'bg-orange-100 text-orange-800';
                    case 'medium': return 'bg-yellow-100 text-yellow-800';
                    default: return 'bg-gray-100 text-gray-800';
                }
            };
            
            return (
                <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">
                                LogSV ⚡
                            </h1>
                            <p className="text-gray-600">Ultra-lightweight AI-powered log monitoring</p>
                        </div>

                        {/* Search */}
                        <div className="mb-8">
                            <div className="flex">
                                <input
                                    type="text"
                                    placeholder="Natural language search: 'show me database timeouts' or 'critical errors'"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button
                                    onClick={handleSearch}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"
                                >
                                    Search
                                </button>
                            </div>
                        </div>

                        {/* AI Insights */}
                        {data.insights.length > 0 && (
                            <div className="mb-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
                                <h2 className="text-xl font-semibold mb-4">🧠 AI Insights</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {data.insights.map(insight => (
                                        <div key={insight.title} className="bg-white rounded-lg p-4 border">
                                            <div className="flex justify-between mb-2">
                                                <span className={\`px-2 py-1 rounded text-xs font-medium \${
                                                    insight.type === 'pattern' ? 'bg-blue-100 text-blue-800' :
                                                    insight.type === 'anomaly' ? 'bg-red-100 text-red-800' :
                                                    'bg-green-100 text-green-800'
                                                }\`}>
                                                    {insight.type}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {insight.confidence}% confident
                                                </span>
                                            </div>
                                            <h3 className="font-medium mb-1">{insight.title}</h3>
                                            <p className="text-sm text-gray-600">{insight.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
                                <div className="flex items-center">
                                    <div className="p-2 bg-red-100 rounded-lg">
                                        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Total Errors</p>
                                        <p className="text-2xl font-bold text-gray-900">{data.errors.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                                <div className="flex items-center">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Active Servers</p>
                                        <p className="text-2xl font-bold text-gray-900">{data.servers.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                                <div className="flex items-center">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                        </svg>
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">AI Insights</p>
                                        <p className="text-2xl font-bold text-gray-900">{data.insights.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
                                <div className="flex items-center">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                                        <p className="text-2xl font-bold text-gray-900">{Math.round(performance.memory?.usedJSHeapSize / 1024 / 1024 || 25)}MB</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Servers */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {data.servers.map(server => (
                                <div key={server.id} className="bg-white rounded-lg shadow-sm p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-semibold">{server.name}</h3>
                                        <span className={\`px-2 py-1 rounded text-xs \${
                                            server.status === 'online' ? 'bg-green-100 text-green-800' :
                                            'bg-red-100 text-red-800'
                                        }\`}>
                                            {server.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-red-600">{server.errorCount || 0}</p>
                                            <p className="text-xs text-gray-500">Errors</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-green-600">{server.successCount || 0}</p>
                                            <p className="text-xs text-gray-500">Success</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-yellow-600">{server.warningCount || 0}</p>
                                            <p className="text-xs text-gray-500">Warnings</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Errors */}
                        <div className="bg-white rounded-lg shadow-sm">
                            <div className="p-6 border-b">
                                <h2 className="text-xl font-semibold">Smart Error Analysis ({data.errors.length} errors)</h2>
                            </div>
                            <div className="divide-y">
                                {data.errors.slice(0, 20).map(error => (
                                    <div key={error.id} className="p-6 hover:bg-gray-50">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center mb-2">
                                                    <span className="font-medium">{error.server}</span>
                                                    <span className="mx-2 text-gray-400">•</span>
                                                    <span className="text-sm text-gray-600">{error.logFile}</span>
                                                    <span className={\`ml-2 px-2 py-1 rounded text-xs font-medium \${getSeverityColor(error.severity)}\`}>
                                                        {error.severity}
                                                    </span>
                                                </div>
                                                <p className="text-gray-800 mb-2 font-mono text-sm bg-red-50 p-2 rounded">
                                                    {error.errorMessage}
                                                </p>
                                                <div className="flex items-center text-sm text-gray-500 space-x-4">
                                                    <span>{error.timestamp}</span>
                                                    <span>Line {error.lineNumber}</span>
                                                    <span className="bg-gray-100 px-2 py-1 rounded">Count: {error.count}</span>
                                                    <span className="text-blue-600">{error.category}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            );
        };
        
        ReactDOM.render(React.createElement(LogScope), document.getElementById('root'));
    </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  setupWebSocketServer() {
    // WebSocket for dashboard clients
    this.wss = new WebSocket.Server({ port: this.port + 1 });
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      
      // Send initial data
      ws.send(JSON.stringify({ type: 'servers', data: Array.from(this.agents.values()) }));
      ws.send(JSON.stringify({ type: 'errors', data: this.store.errors.slice(0, 50) }));
      ws.send(JSON.stringify({ type: 'insights', data: this.store.insights }));
      
      ws.on('close', () => this.clients.delete(ws));
    });

    // WebSocket for agents
    this.agentWss = new WebSocket.Server({ port: this.wsPort });
    this.agentWss.on('connection', (ws) => {
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleAgentMessage(data, ws);
        } catch (error) {
          console.error('Error parsing agent message:', error);
        }
      });

      ws.on('close', () => {
        // Mark server as offline
        for (const [id, server] of this.agents.entries()) {
          if (server.ws === ws) {
            server.status = 'offline';
            server.lastSeen = new Date().toISOString();
            this.broadcast('servers', Array.from(this.agents.values()));
            break;
          }
        }
      });
    });
  }

  handleAgentMessage(data, ws) {
    switch (data.type) {
      case 'register':
        this.registerAgent(data.data, ws);
        break;
      case 'error':
        this.handleError(data.data);
        break;
      case 'stats':
        this.updateStats(data.data);
        break;
    }
  }

  registerAgent(agentData, ws) {
    const agent = {
      ...agentData,
      status: 'online',
      errorCount: 0,
      successCount: 0,
      warningCount: 0,
      registeredAt: new Date().toISOString(),
      ws: ws
    };

    this.agents.set(agentData.serverId, agent);
    this.broadcast('servers', Array.from(this.agents.values()));
    
    console.log(`✅ Agent registered: ${agentData.serverName}`);
  }

  handleError(errorData) {
    const error = this.store.addError(errorData);
    
    // Update agent stats
    const agent = this.agents.get(errorData.serverId);
    if (agent) {
      agent.errorCount = (agent.errorCount || 0) + 1;
      agent.lastSeen = new Date().toISOString();
    }

    // Broadcast to dashboard clients
    this.broadcast('newError', error);
    this.broadcast('errors', this.store.errors.slice(0, 50));
    this.broadcast('insights', this.store.insights);
  }

  updateStats(statsData) {
    const agent = this.agents.get(statsData.serverId);
    if (agent) {
      Object.assign(agent, statsData.stats);
      agent.lastSeen = new Date().toISOString();
      this.broadcast('servers', Array.from(this.agents.values()));
    }
  }

  broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  start() {
    this.httpServer.listen(this.port, () => {
      console.log(`🔍 LogSV Server Started!`);
      console.log(`📊 Dashboard: http://localhost:${this.port}`);
      console.log(`🔌 Agent WebSocket: ws://localhost:${this.wsPort}`);
      console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      console.log(`⚡ Ultra-lightweight mode: Only 1 dependency (ws)!`);
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const port = process.env.PORT || 3001;
  const wsPort = process.env.WS_PORT || 8080;
  
  const server = new LogScopeServer(port, wsPort);
  server.start();
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    process.exit(0);
  });
}

module.exports = LogScopeServer;
