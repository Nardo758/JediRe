# API Integration Guide

To make the dashboard fully functional with live data, you'll need to connect it to Clawdbot's APIs.

## Backend Service (Optional)

Create a simple Express server that bridges the dashboard with Clawdbot:

```javascript
// server.js
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('.')); // Serve dashboard files

// Get memory files
app.get('/api/memory/list', async (req, res) => {
  const memoryDir = '/home/leon/clawd/memory';
  const files = await fs.readdir(memoryDir);
  res.json(files);
});

// Read memory file
app.get('/api/memory/:filename', async (req, res) => {
  const filepath = path.join('/home/leon/clawd', req.params.filename);
  const content = await fs.readFile(filepath, 'utf-8');
  res.json({ content });
});

// Get sessions (via clawdbot CLI)
app.get('/api/sessions', (req, res) => {
  exec('clawdbot sessions list --json', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(JSON.parse(stdout));
  });
});

// Spawn task (via clawdbot API or direct call)
app.post('/api/spawn', async (req, res) => {
  const { task, label } = req.body;
  // Call sessions_spawn via your gateway API
  res.json({ status: 'spawned', label });
});

// Get logs
app.get('/api/logs', async (req, res) => {
  // Tail recent logs from Clawdbot
  exec('tail -n 100 ~/.clawdbot/logs/gateway.log', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ logs: stdout.split('\n') });
  });
});

app.listen(8081, () => {
  console.log('Dashboard API running on http://localhost:8081');
});
```

## WebSocket for Live Updates

For real-time log streaming:

```javascript
const WebSocket = require('ws');
const { spawn } = require('child_process');

const wss = new WebSocket.Server({ port: 8082 });

wss.on('connection', (ws) => {
  // Tail logs in real-time
  const tail = spawn('tail', ['-f', '/home/leon/.clawdbot/logs/gateway.log']);
  
  tail.stdout.on('data', (data) => {
    ws.send(data.toString());
  });
  
  ws.on('close', () => {
    tail.kill();
  });
});
```

## Update Dashboard to Use APIs

Replace placeholder functions with real API calls:

```javascript
// In index.html <script> section

async function loadMemoryFile(filename) {
  const response = await fetch(`/api/memory/${filename}`);
  const data = await response.json();
  
  document.getElementById('memory-content').innerHTML = `
    <h3>${filename}</h3>
    <pre style="white-space: pre-wrap; font-family: monospace;">${data.content}</pre>
  `;
}

async function spawnTask(event) {
  event.preventDefault();
  
  const response = await fetch('/api/spawn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: document.getElementById('task-description').value,
      label: document.getElementById('task-label').value,
    })
  });
  
  const result = await response.json();
  alert(`Task spawned: ${result.label}`);
}

async function refreshLogs() {
  const response = await fetch('/api/logs');
  const data = await response.json();
  
  document.getElementById('log-viewer').innerHTML = data.logs
    .map(line => `<div class="log-line">${line}</div>`)
    .join('');
}

// WebSocket for live logs
const ws = new WebSocket('ws://localhost:8082');
ws.onmessage = (event) => {
  const viewer = document.getElementById('log-viewer');
  const newLog = `<div class="log-line">${event.data}</div>`;
  viewer.innerHTML = newLog + viewer.innerHTML;
};
```

## Running With API Backend

```bash
# Install dependencies
npm install express ws

# Run API server
node server.js

# Dashboard now available at http://localhost:8081
```

## Direct Gateway API Integration

If your Clawdbot gateway exposes an API endpoint, you can call it directly:

```javascript
const GATEWAY_URL = 'http://localhost:YOUR_GATEWAY_PORT';

async function spawnTask(task) {
  const response = await fetch(`${GATEWAY_URL}/api/sessions/spawn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN'
    },
    body: JSON.stringify({ task })
  });
  
  return response.json();
}
```

---

For now, the dashboard works as a beautiful UI mock. Add the backend integration when you're ready for full functionality!
