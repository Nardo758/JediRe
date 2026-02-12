/**
 * Polymarket Trading Bot Dashboard
 * Web-based interface for monitoring and controlling the bot
 */

import express from 'express';
import { readFileSync, watchFile, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

const PORT = 3333;
const STATE_FILE = join(__dirname, '..', 'bot-state.json');
const LOG_FILE = join(__dirname, '..', 'bot.log');
const CONFIG_FILE = join(__dirname, '..', 'config.json');

// Serve static files (from root, not dist)
app.use(express.static(join(__dirname, '..', 'public')));
app.use(express.json());

/**
 * Read bot state
 */
function getBotState() {
  try {
    if (existsSync(STATE_FILE)) {
      const data = readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading bot state:', error);
  }
  return {
    running: false,
    lastCheckTime: null,
    totalAlertsGenerated: 0,
    totalTradesExecuted: 0,
    activePositions: [],
    pendingAlerts: []
  };
}

/**
 * Read config
 */
function getConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading config:', error);
  }
  return {};
}

/**
 * Read logs (last N lines)
 */
function getLogs(lines = 50) {
  try {
    if (existsSync(LOG_FILE)) {
      const data = readFileSync(LOG_FILE, 'utf-8');
      const allLines = data.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    }
  } catch (error) {
    console.error('Error reading logs:', error);
  }
  return [];
}

/**
 * API Routes
 */

// Get current bot status
app.get('/api/status', (req, res) => {
  const state = getBotState();
  const config = getConfig();
  
  res.json({
    ...state,
    config: {
      pollIntervalMinutes: config.monitoring?.pollIntervalMinutes,
      minSpreadPercent: config.monitoring?.minSpreadPercent,
      autoApprove: config.trading?.autoApprove,
      defaultPositionSize: config.trading?.defaultPositionSize
    },
    uptime: state.running && state.lastCheckTime 
      ? Date.now() - state.lastCheckTime 
      : 0
  });
});

// Get recent logs
app.get('/api/logs', (req, res) => {
  const lines = parseInt(req.query.lines as string) || 50;
  res.json({ logs: getLogs(lines) });
});

// Get configuration
app.get('/api/config', (req, res) => {
  res.json(getConfig());
});

/**
 * WebSocket for real-time updates
 */
io.on('connection', (socket) => {
  console.log('Dashboard client connected');
  
  // Send initial state
  socket.emit('status', getBotState());
  
  socket.on('disconnect', () => {
    console.log('Dashboard client disconnected');
  });
});

/**
 * Watch files for changes and emit updates
 */
watchFile(STATE_FILE, { interval: 2000 }, () => {
  const state = getBotState();
  io.emit('status', state);
});

watchFile(LOG_FILE, { interval: 2000 }, () => {
  const logs = getLogs(20);
  io.emit('logs', logs);
});

/**
 * Start server
 */
server.listen(PORT, () => {
  console.log(`🎨 Polymarket Bot Dashboard running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}`);
  console.log();
  console.log('📊 Dashboard features:');
  console.log('   - Real-time bot status');
  console.log('   - Live opportunity alerts');
  console.log('   - Trade history & P&L');
  console.log('   - Performance metrics');
  console.log('   - Live logs');
  console.log();
});
