/**
 * check-replit-health.ts
 *
 * Checks if the Replit app is running by hitting the archive health endpoint.
 * If it's back up (not returning "Run this app"), logs to REPLIT_HEALTH_STATE.json
 * so the Telegram cron can detect the transition.
 *
 * Called by cron every 5 minutes.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const STATE_PATH = path.resolve(__dirname, '..', 'docs', 'operations', 'REPLIT_HEALTH_STATE.json');
const REPLIT_URL = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev';
const INGEST_SECRET = 'jedire-archive-2026';

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { lastWasDown: true, lastChecked: null, status: 'unknown' };
}

function saveState(state) {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

function healthCheck() {
  return new Promise((resolve) => {
    const req = https.get(`${REPLIT_URL}/api/v1/archive/stats`, {
      headers: { 'x-ingest-secret': INGEST_SECRET },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Replit idle page returns "Run this app" in HTML
        if (res.statusCode === 404 || res.statusCode === 502 || res.statusCode === 503) {
          resolve({ up: false, statusCode: res.statusCode, data: data.substring(0, 200) });
        } else if (res.statusCode >= 200 && res.statusCode < 500) {
          // If we get JSON back, app is running
          if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
            resolve({ up: true, statusCode: res.statusCode });
          } else if (data.includes('Run this app') || data.includes('Welcome to Replit')) {
            resolve({ up: false, statusCode: res.statusCode, data: 'replit_idle_page' });
          } else {
            resolve({ up: true, statusCode: res.statusCode });
          }
        } else {
          resolve({ up: false, statusCode: res.statusCode });
        }
      });
    });
    req.on('error', (err) => {
      resolve({ up: false, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ up: false, error: 'timeout' });
    });
  });
}

async function main() {
  const state = loadState();
  const result = await healthCheck();
  const now = new Date().toISOString();

  const wasDown = state.lastWasDown !== false;
  const isUp = result.up;

  state.lastChecked = now;
  state.lastWasDown = !isUp;
  state.status = isUp ? 'up' : 'down';
  state.lastResult = { statusCode: result.statusCode, error: result.error };
  state.healthHistory = state.healthHistory || [];
  state.healthHistory.push({ time: now, up: isUp });
  if (state.healthHistory.length > 100) state.healthHistory = state.healthHistory.slice(-100);

  saveState(state);

  if (wasDown && isUp) {
    console.log('REPLIT_TRANSITION:UP');
    process.exit(0); // exit 0 means "just came up"
  } else if (isUp) {
    console.log('REPLIT_STATUS:UP');
    process.exit(1); // exit 1 means "was already up"
  } else {
    console.log('REPLIT_STATUS:DOWN');
    process.exit(2); // exit 2 means "still down"
  }
}

main().catch(err => {
  console.error('REPLIT_ERROR', err.message);
  process.exit(3);
});
