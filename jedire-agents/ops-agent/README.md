# JediRe DevOps Agent Setup

## What Is This?

A dedicated Clawdbot agent that monitors the JediRe platform and alerts you when things need attention.

## Files

```
ops-agent/
├── AGENT.md          # Agent identity & responsibilities
├── HEARTBEAT.md      # Heartbeat instructions
├── monitor.sh        # Monitoring orchestrator (runs checks)
├── alert.py          # Alert formatter
└── README.md         # This file
```

## How It Works

1. **Heartbeat trigger** → Agent reads HEARTBEAT.md
2. **Runs monitor.sh** → Executes at appropriate times:
   - Morning (8-12): Quick health check every 6 hours
   - Evening (18-22): Deep analysis every 24 hours
3. **monitor.sh calls**:
   - `/home/leon/clawd/monitoring/jedire-checks.sh` (fast checks)
   - `/home/leon/clawd/monitoring/analyze-code.js` (deep analysis)
4. **Results analyzed** → Issues categorized
5. **Alerts sent** → Via Telegram if needed

## Setup

### 1. Spawn the Agent

```bash
# Using Clawdbot CLI (if available)
clawdbot sessions spawn \
  --label jedire-devops \
  --task "Monitor JediRe platform. Read /home/leon/clawd/jedire-agents/ops-agent/AGENT.md for identity."
```

Or manually via the message tool from your main session:

```
Hey, spawn a sub-agent:
- Label: jedire-devops
- Task: Monitor JediRe platform
- On startup: Read /home/leon/clawd/jedire-agents/ops-agent/AGENT.md
- Heartbeat: Follow /home/leon/clawd/jedire-agents/ops-agent/HEARTBEAT.md
```

### 2. Configure Heartbeat

The agent will check the monitoring scripts on a schedule:
- **Morning checks**: 8:00-12:00, every 6 hours
- **Evening checks**: 18:00-22:00, every 24 hours

No configuration needed - it's time-gated automatically.

### 3. Test It

Force a check manually:

```bash
cd /home/leon/clawd/jedire-agents/ops-agent
./monitor.sh
```

Expected output:
- `HEARTBEAT_OK` if outside check windows
- Check results if in check window

## Monitoring Scripts Required

Make sure these exist and are executable:
- `/home/leon/clawd/monitoring/jedire-checks.sh`
- `/home/leon/clawd/monitoring/analyze-code.js`

If not, the agent will report missing scripts.

## Alert Types

### Critical (🚨)
- TypeScript compilation failures
- High/critical security vulnerabilities
- Build failures

**Action**: Immediate attention needed

### Warning (⚠️)
- Bundle size >10MB
- Slow queries (>100ms)
- Moderate security issues

**Action**: Review when convenient

### Info (ℹ️)
- Check completed successfully
- Maintenance completed
- Configuration changes

**Action**: FYI only

## Logs & State

- `/tmp/jedire-last-check` - Last quick check timestamp
- `/tmp/jedire-last-deep-check` - Last deep analysis timestamp
- `/tmp/jedire-check-report.txt` - Latest check results
- `/home/leon/clawd/memory/jedire-monitoring.json` - Historical trends

## Customization

### Change Check Frequency

Edit `monitor.sh`:
```bash
# Current: 6 hours (21600 seconds)
SIX_HOURS=21600

# Change to 4 hours:
FOUR_HOURS=14400
```

### Add New Checks

1. Add script to `/home/leon/clawd/monitoring/`
2. Call it from `monitor.sh`
3. Parse results and set alert flags

### Change Alert Thresholds

Edit the monitoring scripts:
- `jedire-checks.sh` - Fast checks
- `analyze-code.js` - Deep analysis

## Troubleshooting

**Agent not running checks:**
- Check if within time windows (8-12 for morning, 18-22 for evening)
- Verify time threshold passed (6h for quick, 24h for deep)
- Check timestamps: `cat /tmp/jedire-last-check`

**Scripts not found:**
```bash
ls -la /home/leon/clawd/monitoring/
```

**Permission denied:**
```bash
chmod +x /home/leon/clawd/monitoring/*.sh
chmod +x /home/leon/clawd/jedire-agents/ops-agent/*.sh
```

**Agent not alerting:**
- Check agent session is active: `clawdbot sessions list`
- Verify Telegram channel is configured in main Clawdbot
- Test message tool manually

## Next Steps

After the agent is running:

1. **Monitor for a week** - Let it run and observe patterns
2. **Tune thresholds** - Adjust based on false positives
3. **Add more checks** - Database backups, API health, etc.
4. **Build dashboard** - Visualize trends from monitoring.json

---

*Created: 2026-03-07*
