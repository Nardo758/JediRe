# 🚀 Start Here - JediRe Agents

**Quick start guide for testing and deploying the JediRe agent integration.**

---

## What You Have

✅ **DevOps Agent** - Running (monitors platform health)  
✅ **User Agent** - Built (AI chat for users)  
✅ **Integration Layer** - Complete (connects agents to platform)  
✅ **Test Suite** - Ready (verify everything works)

---

## Test in 3 Steps

### Step 1: Start JediRe Platform

```bash
cd /home/leon/clawd/jedire/backend
npm run dev
```

Wait for: `Server listening on port 3000`

### Step 2: Configure User Agent

```bash
cd /home/leon/clawd/jedire-agents/user-agent
cp .env.example .env
nano .env
```

**Add these:**
```bash
JEDIRE_API_URL=http://localhost:3000
JEDIRE_API_KEY=test-key-123  # Or actual key from platform
```

### Step 3: Run Test

```bash
./quick_test.sh
```

**Expected output:**
```
🎉 Integration working! User Agent can call platform agents.
```

---

## If Tests Pass ✅

### Deploy User Agent API

```bash
cd /home/leon/clawd/jedire-agents/user-agent
./run.sh
```

API will be at: `http://localhost:8000`

### Test Chat

```bash
# 1. Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@jedire.com"}'

# 2. Use token to chat
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What can I build at 1950 Piedmont Circle?"}'
```

---

## If Tests Fail ❌

### Common Issues

**1. Platform not running**
```bash
cd /home/leon/clawd/jedire/backend
npm run dev
```

**2. No API key**
- Get key from JediRe admin
- Or use test key for local testing
- Update `.env` file

**3. Missing dependencies**
```bash
pip install httpx asyncio
```

**4. Agent errors**
- Check JediRe backend logs
- Verify agents are configured
- See TESTING_GUIDE.md

---

## Architecture at a Glance

```
User (Telegram/Chat)
        ↓
User Agent API (FastAPI)
        ↓
JediRe Platform (/api/v1/agents/tasks)
        ↓
   ┌────┴────┬──────────┬────────┐
Zoning    Supply    CashFlow    etc.
Agent     Agent      Agent
```

**User asks**: "What can I build at 1950 Piedmont?"  
**User Agent**: Calls Zoning Agent via platform API  
**Response**: Natural language summary of development potential

---

## File Structure

```
jedire-agents/
├── ops-agent/              # DevOps monitoring (running)
├── user-agent/             # AI chat assistant
│   ├── api/                # FastAPI application
│   ├── integrations/       # Platform integration ⭐
│   │   ├── jedire_api.py   # API client
│   │   └── jedire_tools.py # AI-callable tools
│   ├── test_integration.py # Automated tests ⭐
│   ├── quick_test.sh       # One-command test ⭐
│   └── run.sh              # Start API server
├── INTEGRATION_GUIDE.md    # Detailed integration docs
├── TESTING_GUIDE.md        # Troubleshooting guide
└── START_HERE.md           # This file
```

---

## Documentation

- **Start here**: This file
- **Integration**: INTEGRATION_GUIDE.md
- **Testing**: TESTING_GUIDE.md
- **DevOps Agent**: ops-agent/README.md
- **User Agent**: user-agent/README.md

---

## Current Status

**✅ Complete:**
- Agent code (DevOps + User)
- Integration layer (API client + tools)
- Test suite
- Documentation

**⏳ Needs Setup:**
- API key from platform
- Environment variables
- Run tests

**🚧 Next Phase:**
- Add Claude function calling
- Deploy to production
- Add chat widget to frontend
- Telegram/WhatsApp integration

---

## Quick Commands

```bash
# Test integration
cd /home/leon/clawd/jedire-agents/user-agent
./quick_test.sh

# Run User Agent API
./run.sh

# Check DevOps agent
clawdbot sessions list --label jedire-devops

# View logs
tail -f /tmp/jedire-check-report.txt
```

---

## Get Help

- **Test failures**: See TESTING_GUIDE.md
- **Integration questions**: See INTEGRATION_GUIDE.md
- **API docs**: http://localhost:8000/docs (when running)
- **Platform issues**: Check JediRe backend logs

---

**Ready to test?**

```bash
cd /home/leon/clawd/jedire-agents/user-agent
./quick_test.sh
```

🎯 **Goal**: See "🎉 Integration working!" message
