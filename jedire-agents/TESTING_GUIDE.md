# JediRe Agents - Testing Guide

Quick guide to test the integration between User Agent and JediRe platform.

---

## Prerequisites

### 1. JediRe Platform Running

The JediRe backend needs to be running with the analysis agents.

**Check if running:**
```bash
curl http://localhost:3000/api/v1/agents/tasks
```

**Start if needed:**
```bash
cd /home/leon/clawd/jedire/backend
npm start
# or
npm run dev
```

### 2. API Key

You need an API key from the JediRe platform.

**Option A: Use existing key** (if you have one)

**Option B: Create new key** (if platform supports it)
- Log into JediRe admin
- Generate API key for "User Agent"

**Option C: Temporary bypass** (for testing only)
- Modify platform to accept a test key
- Or bypass auth for localhost requests

---

## Setup

### Step 1: Create .env file

```bash
cd /home/leon/clawd/jedire-agents/user-agent
cp .env.example .env
```

### Step 2: Configure .env

Edit `.env` and add:

```bash
# Required for integration
JEDIRE_API_URL=http://localhost:3000
JEDIRE_API_KEY=your-actual-api-key-here

# Optional (for full User Agent functionality)
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://localhost/jedire_agent
JWT_SECRET=your-secret-key
```

**Minimum to test integration:** Just `JEDIRE_API_URL` and `JEDIRE_API_KEY`

### Step 3: Install dependencies

```bash
pip install httpx asyncio
# or
pip install -r requirements.txt
```

---

## Testing

### Quick Test

Run the integration test script:

```bash
cd /home/leon/clawd/jedire-agents/user-agent
python test_integration.py
```

**Expected output if working:**
```
============================================================
JediRe Integration Test
============================================================

📋 Configuration:
  API URL: http://localhost:3000
  API Key: ✅ Set

🔍 Test 1: Zoning Analysis
------------------------------------------------------------
Analyzing: 1950 Piedmont Circle NE, Atlanta, GA...

✅ Zoning Analysis Result:
Zoning Analysis for 1950 Piedmont Circle NE, Atlanta, GA 30324:

**Zoning District**: MRC-2-C

**Allowed Uses**: multifamily, mixed-use, retail

**Development Potential**:
- Maximum Units: 300
- Maximum Height: 150 feet
...

============================================================
Test Summary
============================================================
  Configuration: ✅
  Zoning Agent:  ✅
  Supply Agent:  ✅
  Cashflow Agent: ⏭️  (skipped)

🎉 Integration working! User Agent can call platform agents.
```

---

## Troubleshooting

### Error: "JEDIRE_API_KEY not configured"

**Solution:** Add API key to `.env` file

```bash
echo "JEDIRE_API_KEY=your-key-here" >> .env
```

### Error: Connection refused / timeout

**Cause:** JediRe platform not running

**Solution:** Start the backend:
```bash
cd /home/leon/clawd/jedire/backend
npm run dev
```

### Error: "Unauthorized" / 401

**Cause:** Invalid API key

**Solutions:**
1. Check API key is correct
2. Verify key has permissions for `/api/v1/agents/tasks`
3. For testing: Temporarily bypass auth on localhost

### Error: "Task failed" or agent errors

**Cause:** Platform agents not working

**Solution:** Check JediRe backend logs:
```bash
cd /home/leon/clawd/jedire/backend
# Check console output for errors
```

---

## Manual Testing (Without Script)

### Test with Python REPL

```bash
cd /home/leon/clawd/jedire-agents/user-agent
python
```

```python
import asyncio
from integrations.jedire_api import JediReAPI

# Test connection
api = JediReAPI()
print(f"API URL: {api.base_url}")
print(f"API Key: {api.api_key[:10]}..." if api.api_key else "Not set")

# Test zoning analysis
async def test():
    result = await api.analyze_zoning("1950 Piedmont Circle NE, Atlanta, GA")
    print(result)

asyncio.run(test())
```

### Test with curl

```bash
# Test if platform is running
curl http://localhost:3000/api/v1/agents/tasks \
  -H "Authorization: Bearer YOUR_API_KEY"

# Submit a test task
curl -X POST http://localhost:3000/api/v1/agents/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "zoning_analysis",
    "inputData": {
      "propertyAddress": "1950 Piedmont Circle NE, Atlanta, GA"
    }
  }'
```

---

## End-to-End Test

Once basic integration works, test the full chat flow:

### 1. Start User Agent API

```bash
cd /home/leon/clawd/jedire-agents/user-agent
./run.sh
```

### 2. Test chat endpoint

```bash
# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@jedire.com"}'

# Get token, then chat
curl -X POST http://localhost:8000/v1/chat \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What can I build on 1950 Piedmont Circle in Atlanta?"
  }'
```

**Expected:** AI should call the zoning agent and return natural language analysis

---

## What Works vs What Doesn't (Current State)

### ✅ Working

- Integration code (API client, tools)
- Error handling and timeouts
- Result formatting

### ⏳ Needs Configuration

- API key from platform
- Platform running locally or remote URL
- Environment variables set

### 🚧 Not Yet Implemented

- Claude function calling (using tools)
- Full chat flow with agent calls
- Platform auth integration

---

## Next Steps After Testing

1. **If tests pass:**
   - Deploy User Agent API
   - Add chat widget to frontend
   - Test in production

2. **If tests fail:**
   - Fix authentication issues
   - Verify platform agents work standalone
   - Check network/firewall issues

3. **To enhance:**
   - Add more agent types
   - Improve error messages
   - Add caching for repeated queries

---

**Ready to test? Run:**
```bash
cd /home/leon/clawd/jedire-agents/user-agent
python test_integration.py
```
