# JediRe Client - Quick Start

## 🚀 Instant Setup (3 steps)

### 1. Install Dependencies & Build
```bash
cd /home/leon/clawd/jedire-client
npm install && npm run build
```

### 2. Configure (choose one)

**Option A: Use Token**
```bash
echo "JEDIRE_API_URL=http://localhost:5000" > .env
echo "JEDIRE_API_TOKEN=your-jwt-token" >> .env
```

**Option B: Use Email/Password**
```bash
echo "JEDIRE_API_URL=http://localhost:5000" > .env
echo "JEDIRE_API_EMAIL=your-email@example.com" >> .env
echo "JEDIRE_API_PASSWORD=your-password" >> .env
```

### 3. Use in Clawdbot

**JavaScript/TypeScript:**
```typescript
import { JediReClient } from '@clawdbot/jedire-client';

const jedire = new JediReClient();

// Get a deal
const deal = await jedire.getDeal('deal-123');

// Search properties
const properties = await jedire.getProperties({ 
  city: 'Denver', 
  state: 'CO' 
});

// Market intelligence
const intel = await jedire.getMarketIntelligence('market-456');

// Run analysis
const analysis = await jedire.runAnalysis('deal-123', 'cash_flow');
```

## 📦 Link Package (for local development)

```bash
# In jedire-client directory
npm link

# In your main Clawdbot directory
npm link @clawdbot/jedire-client
```

## ✅ Test Connection

```bash
npx ts-node example.ts
```

## 📚 Full Documentation

- **README.md** - Complete API reference
- **INTEGRATION.md** - Clawdbot integration guide
- **COMPLETED.md** - Build status and features

## 🔑 Key Features

✅ All JediRe API endpoints covered
✅ Automatic token management & refresh
✅ Retry logic (network errors, 5xx, rate limits)
✅ Full TypeScript support
✅ Request logging
✅ Configurable timeouts & retries

## 🆘 Quick Troubleshooting

**Import Error:**
```bash
npm run build  # Rebuild TypeScript
```

**Auth Error:**
```bash
# Check .env file exists and has credentials
cat .env
```

**Connection Error:**
```bash
# Verify API is running
curl http://localhost:5000/health
```

---

**Status:** ✅ Ready for use  
**Build Date:** 2025-03-02  
**Version:** 1.0.0
