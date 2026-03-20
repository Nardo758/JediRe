# JediRe Agents - Quick Start

## What Just Got Built

Two-agent system for JediRe platform:

### 1. ✅ DevOps Agent (LIVE NOW)
- **Status**: Running
- **Session**: `jedire-devops`
- **Purpose**: Monitor platform health, alert on issues

### 2. ⏳ User Agent (Coming Next)
- **Status**: Not started
- **Purpose**: Help JediRe users with deals & analysis

---

## DevOps Agent (Active)

### What It Does
- Monitors code quality, security, performance
- Runs checks twice daily (morning + evening)
- Alerts you via Telegram when issues found
- Stays silent when everything's fine

### Check Schedule
- **Morning** (8-12): Quick health check every 6 hours
- **Evening** (18-22): Deep analysis every 24 hours

### How to Interact

**Send it a message:**
```bash
# Via Clawdbot
clawdbot sessions send --label jedire-devops "Run a manual check"
```

Or from this chat:
"Send to jedire-devops: Run a health check now"

**View its status:**
```bash
clawdbot sessions list --label jedire-devops
```

**Check logs:**
```bash
cat /tmp/jedire-check-report.txt
cat /home/leon/clawd/memory/jedire-monitoring.json
```

### What It Monitors

✅ TypeScript compilation  
🔒 Security vulnerabilities  
📦 Bundle size (<10MB)  
🐌 Database query speed  
⚡ API performance  
📈 Historical trends  

### Files Created

```
jedire-agents/
├── ops-agent/
│   ├── AGENT.md         # Agent identity
│   ├── HEARTBEAT.md     # What to do on heartbeat
│   ├── monitor.sh       # Monitoring orchestrator
│   ├── alert.py         # Alert formatter
│   └── README.md        # Full docs
├── QUICK_START.md       # This file
└── (user-agent/)        # Coming soon
```

---

## Next: Build User Agent

When ready to build the customer-facing agent:

### Phase 1: Core API
1. Create FastAPI wrapper
2. Integrate Claude API  
3. Connect to JediRe API
4. Basic chat endpoint

### Phase 2: Platform Integration
1. Embed chat widget in JediRe
2. WebSocket for real-time
3. User authentication

### Phase 3: External Channels
1. Telegram bot
2. WhatsApp integration
3. Cross-platform linking

---

## Commands Cheat Sheet

```bash
# List all agents
clawdbot sessions list

# Send message to DevOps agent
clawdbot sessions send --label jedire-devops "Your message"

# View agent history
clawdbot sessions history --label jedire-devops

# Test monitoring manually
/home/leon/clawd/jedire-agents/ops-agent/monitor.sh

# Check timestamps
cat /tmp/jedire-last-check
cat /tmp/jedire-last-deep-check

# View latest results
cat /tmp/jedire-check-report.txt

# Historical data
cat /home/leon/clawd/memory/jedire-monitoring.json
```

---

## What to Expect

### First 24 Hours
- Agent wakes up during first heartbeat
- Reads its identity files
- Waits for check window
- Runs first check (morning 8-12 or evening 18-22)
- Reports results

### Ongoing
- Silent operation (HEARTBEAT_OK most of the time)
- Alerts only when issues detected
- Weekly/monthly summary reports

### If Something Breaks
You'll get a Telegram message like:

```
🚨 JediRe CRITICAL

TypeScript compilation failed

12 errors found in src/api/deals.ts
Bundle size exceeded 10MB (current: 12.4MB)

Time: 2026-03-07 14:30:00
```

---

Ready to test? Let it run through one heartbeat cycle and we'll see what happens!
