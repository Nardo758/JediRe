# cron-replit-monitor.ps1
# Run this via Task Scheduler every 5 minutes on your Windows machine.
# Checks if the Replit app is back up and notifies via Telegram.

$RepoRoot = "C:\Users\Leon\.openclaw\workspace\JediRe\backend"
$StateFile = "$RepoRoot\docs\operations\REPLIT_HEALTH_STATE.json"

# Run the health check
$result = node -e "
const https = require('https');
const opts = {
  hostname: '381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev',
  path: '/api/v1/archive/stats',
  headers: { 'x-ingest-secret': 'jedire-archive-2026' },
  timeout: 10000,
  method: 'GET'
};
const req = https.request(opts, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const up = res.statusCode >= 200 && res.statusCode < 500 && !data.includes('Run this app');
    process.stdout.write(up ? 'UP' : 'DOWN');
  });
});
req.on('error', () => process.stdout.write('DOWN'));
req.on('timeout', () => { req.destroy(); process.stdout.write('DOWN'); });
req.end();
"

# Load previous state
$lastState = "DOWN"
if (Test-Path $StateFile) {
  try { $lastState = (Get-Content $StateFile -Raw | ConvertFrom-Json).status } catch {}
}

# Save current state
@{
  status = $result
  lastChecked = (Get-Date -Format o)
  lastWasDown = ($result -eq "DOWN")
} | ConvertTo-Json | Set-Content $StateFile

# Alert on transition: was DOWN → now UP
if ($lastState -eq "down" -and $result -eq "UP") {
  Write-Host "REPLIT JUST CAME BACK UP!"
  # Trigger the enrichment re-run via Telegram
  # (just a notification for now — you'll need to fire the actual commands)
}
