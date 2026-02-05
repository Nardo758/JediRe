# 🚀 JediRe - Replit Deployment Guide

Complete guide to deploying JediRe backend API on Replit.

---

## 📋 Prerequisites

- Replit account (free tier works!)
- GitHub repository access
- 10 minutes of your time

**Note:** Database is OPTIONAL. The API works perfectly without PostgreSQL for capacity analysis.

---

## 🎯 Quick Start (5 Minutes)

### 1. Create New Repl

1. Go to [replit.com](https://replit.com)
2. Click "Create Repl"
3. Choose "Import from GitHub"
4. Enter: `https://github.com/Nardo758/JediRe`
5. Select "Node.js" as the language
6. Click "Import from GitHub"

### 2. Navigate to Backend

```bash
cd backend
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Environment Variables

Click the "Secrets" tab (🔒 icon) and add:

```env
NODE_ENV=development
PORT=3000
PYTHON_PATH=python3

# Database (optional - leave blank to skip)
DATABASE_URL=

# JWT Secrets (generate random strings)
JWT_SECRET=your-secret-key-here-make-it-long-and-random
JWT_REFRESH_SECRET=another-different-secret-key-here

# CORS (Replit domain)
CORS_ORIGIN=https://your-repl-name.yourusername.repl.co
WS_CORS_ORIGIN=https://your-repl-name.yourusername.repl.co
```

### 5. Install Python Dependencies

```bash
cd backend/python-services
pip install geopandas shapely pandas numpy tqdm
cd ../..
```

### 6. Start the Server

```bash
cd backend
npm run dev
```

---

## ✅ Verify Installation

### Test Health Endpoint

Open a new Shell tab and run:

```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T...",
  "uptime": 10.5,
  "environment": "development"
}
```

### Test Capacity Analysis

```bash
curl -X POST http://localhost:3000/api/v1/pipeline/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_id": "TEST-001",
    "current_zoning": "MRC-2",
    "lot_size_sqft": 87120,
    "current_units": 0
  }'
```

**Expected:** Detailed capacity analysis JSON

---

## 🔧 Configuration Files

### `.replit` File

Create `.replit` in the root directory:

```toml
run = "cd backend && npm run dev"
language = "nodejs"
entrypoint = "backend/src/index.ts"

[env]
PORT = "3000"
NODE_ENV = "development"

[nix]
channel = "stable-23_05"

[packager]
language = "nodejs"

[packager.features]
packageSearch = true
guessImports = true

[languages.typescript]
pattern = "**/*.ts"
syntax = "typescript"

[languages.typescript.languageServer]
start = "typescript-language-server --stdio"
```

### `replit.nix` File

Create `replit.nix` in the root:

```nix
{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.python311Full
    pkgs.python311Packages.pip
    pkgs.python311Packages.virtualenv
    pkgs.gdal
    pkgs.proj
    pkgs.geos
  ];
}
```

---

## 🌐 Public Deployment

### Make API Publicly Accessible

1. Click "Run" to start your server
2. Replit will provide a public URL: `https://your-repl.yourusername.repl.co`
3. Update CORS_ORIGIN secret with this URL
4. Restart the server

### Test Public Endpoint

```bash
curl https://your-repl.yourusername.repl.co/health
```

---

## 🗄️ Optional: Add PostgreSQL Database

If you want full features (user auth, saved analyses):

### 1. Create Supabase Project (Free)

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy connection string

### 2. Update Environment

Add to Secrets:
```env
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
```

### 3. Run Migrations

```bash
cd backend
npm run migrate
```

---

## 🐛 Troubleshooting

### Server Won't Start

**Problem:** `npm run dev` fails

**Solutions:**
1. Check `package.json` exists in `backend/`
2. Run `npm install` again
3. Check console for specific errors
4. Verify Node.js version: `node --version` (should be 18+)

### Python Import Errors

**Problem:** `ModuleNotFoundError: No module named 'geopandas'`

**Solution:**
```bash
pip install geopandas shapely pandas numpy tqdm
```

### API Returns 500 Errors

**Problem:** Capacity analysis fails

**Check:**
1. Python packages installed?
2. `python-services/analyze_standalone.py` exists?
3. Check logs in Shell for Python errors

### CORS Errors

**Problem:** Frontend can't access API

**Solution:**
1. Update `CORS_ORIGIN` in Secrets
2. Use your Replit public URL
3. Restart server

---

## 📊 Performance Tips

### Keep Repl Awake

Free Repls sleep after inactivity. Solutions:

1. **UptimeRobot** (free)
   - Sign up at uptimerobot.com
   - Add monitor for your Replit URL
   - Pings every 5 minutes

2. **Always On** (paid)
   - Upgrade to Replit Hacker plan
   - Enable "Always On" for your Repl

### Optimize Cold Starts

Add to `backend/src/index.ts` (already done):
```typescript
// Database connection is optional in development
if (NODE_ENV === 'production') {
  await connectDatabase(); // Required
} else {
  try {
    await connectDatabase(); // Optional
  } catch (error) {
    logger.warn('Running without database');
  }
}
```

---

## 🚀 Production Deployment

### Environment Variables

Update Secrets for production:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<your-supabase-url>
JWT_SECRET=<generate-strong-secret>
JWT_REFRESH_SECRET=<generate-different-secret>
CORS_ORIGIN=https://your-frontend-domain.com
API_VERSION=v1
```

### Build for Production

```bash
cd backend
npm run build
npm start
```

---

## 📚 Next Steps

1. ✅ API running on Replit
2. 📱 Build frontend (see `FRONTEND_DEMO.md`)
3. 🗄️ Add database (optional)
4. 🔐 Enable authentication
5. 📈 Add more zoning rules

---

## 🆘 Support

- **GitHub Issues:** https://github.com/Nardo758/JediRe/issues
- **Documentation:** See `backend/README.md`
- **API Tests:** See `backend/API_TEST_RESULTS.md`

---

**Deployment Time:** ~10 minutes  
**Difficulty:** Easy  
**Cost:** Free (without database)
