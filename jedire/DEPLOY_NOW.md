# 🚀 JEDI RE - Deploy to Replit NOW

**Status:** Code pushed to GitHub, ready to deploy  
**Time Required:** 10 minutes  
**Latest Commit:** `dd05017` (ApartmentIQ integration added)

---

## ✅ What's Ready

1. **Backend Complete** - 99.5% ready
   - TypeScript API (4000 port)
   - Python engines (Signal Processing, Carrying Capacity, Imbalance)
   - CoStar data integration (26 years of history)
   - **NEW:** ApartmentIQ integration layer (ready for API)

2. **Code in GitHub** - All latest changes pushed
   - Repository: `https://github.com/Nardo758/JediRe`
   - Branch: `master`
   - Latest commit: ApartmentIQ integration

3. **Replit Config Ready** - Automated deployment
   - `.replit` - Run configuration
   - `replit.nix` - Dependencies
   - `replit-deploy.sh` - Setup script

---

## 🎯 Deployment Steps

### Option 1: Import from GitHub (Easiest) ⭐

1. **Open Replit**
   - Go to https://replit.com
   - Sign in with your account

2. **Create New Repl**
   - Click "Create Repl"
   - Select "Import from GitHub"
   - Paste: `https://github.com/Nardo758/JediRe`
   - Language: "Node.js"
   - Click "Import from GitHub"

3. **Wait for Import** (30 seconds)
   - Replit automatically clones the repo
   - Sets up environment

4. **Run Setup Script**
   ```bash
   bash replit-deploy.sh
   ```
   
   This installs:
   - Node.js dependencies (npm packages)
   - Python dependencies (geopandas, pandas, numpy)
   - Verifies TypeScript compilation
   - Tests Python analyzer

5. **Set Environment Variables**
   - Click 🔒 "Secrets" tab (left sidebar)
   - Add these secrets:
     ```
     NODE_ENV=development
     PORT=3000
     JWT_SECRET=jedi-re-secret-key-2026-make-this-long-and-random
     JWT_REFRESH_SECRET=jedi-re-refresh-secret-different-from-above
     CORS_ORIGIN=https://your-repl-name.your-username.repl.co
     ```
   
   **Optional (for database features):**
   ```
   DATABASE_URL=postgresql://your-supabase-url
   ```
   
   **For ApartmentIQ integration (when ready):**
   ```
   APARTMENTIQ_API_URL=https://apartment-locator-ai.replit.app
   APARTMENTIQ_API_KEY=your-api-key-here
   ```

6. **Start Server**
   - Click the big green "Run" button
   - OR manually: `cd backend && npm run dev`
   - Wait 10-20 seconds for startup

7. **Verify It's Working**
   - Open a new Shell tab
   - Test health endpoint:
     ```bash
     curl http://localhost:3000/health
     ```
   - Expected: `{"status":"healthy",...}`

---

### Option 2: Manual Setup (If Import Fails)

1. **Create Blank Repl**
   - Create New Repl → Node.js
   - Name it "JediRe"

2. **Clone in Shell**
   ```bash
   git clone https://github.com/Nardo758/JediRe.git
   cd JediRe
   ```

3. **Continue from Step 4 above**

---

## 🧪 Test Your Deployment

### 1. Health Check
```bash
curl http://localhost:3000/health
```

**Expected:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T...",
  "uptime": 12.5,
  "environment": "development"
}
```

### 2. Capacity Analysis Test
```bash
curl -X POST http://localhost:3000/api/v1/pipeline/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_id": "BUCKHEAD-TOWER",
    "current_zoning": "MRC-2",
    "lot_size_sqft": 87120,
    "current_units": 0
  }'
```

**Expected:** JSON with capacity analysis (120 units, $52M cost, etc.)

### 3. CoStar Market Signal Test
```bash
curl http://localhost:3000/api/v1/analysis/market-signal
```

**Expected:** 26-year rent growth analysis

### 4. ApartmentIQ Integration Test (when API is ready)
```bash
curl http://localhost:3000/api/v1/apartmentiq/market-data?city=Atlanta&submarket=Midtown
```

---

## 🌐 Make It Public

Once running locally:

1. **Get Your Public URL**
   - Replit automatically provides: `https://jedire.your-username.repl.co`
   - Find it in the "Webview" tab

2. **Update CORS**
   - Go to Secrets (🔒)
   - Update `CORS_ORIGIN` with your public URL
   - Restart server

3. **Test Public Access**
   ```bash
   curl https://jedire.your-username.repl.co/health
   ```

4. **Share the URL**
   - Frontend can now connect
   - ApartmentIQ can call your API
   - Anyone can test endpoints

---

## 📊 What You'll Have Running

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /health` | Health check | ✅ Working |
| `POST /api/v1/pipeline/analyze` | Capacity analysis | ✅ Working |
| `GET /api/v1/analysis/market-signal` | CoStar signal processing | ✅ Working |
| `POST /api/v1/analysis/imbalance` | Imbalance detector | ✅ Working |
| `GET /api/v1/apartmentiq/*` | ApartmentIQ integration | ⏳ Ready (waiting for API) |

---

## 🔌 Connect ApartmentIQ

Once your JEDI RE is deployed AND ApartmentIQ API is ready:

1. **Update Environment**
   - Add `APARTMENTIQ_API_URL` to Secrets
   - Add `APARTMENTIQ_API_KEY` (if needed)
   - Restart server

2. **Test Integration**
   ```bash
   # Test API client
   curl http://localhost:3000/api/v1/apartmentiq/test-connection
   
   # Fetch market data
   curl http://localhost:3000/api/v1/apartmentiq/market-data?city=Atlanta
   ```

3. **Run Full Analysis**
   ```bash
   # Combined analysis (ApartmentIQ + CoStar)
   curl http://localhost:3000/api/v1/analysis/full?submarket=Midtown
   ```

---

## 🐛 Troubleshooting

### "npm install fails"
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### "Python imports not found"
```bash
pip install geopandas shapely pandas numpy tqdm psycopg2-binary
```

### "Server crashes on startup"
Check Secrets are set:
- JWT_SECRET
- CORS_ORIGIN
- PORT (should be 3000)

### "Capacity analysis returns 500"
Check Python path:
```bash
which python3
# Should return: /nix/store/.../bin/python3
```

---

## 📈 Performance

### Free Tier
- ✅ Plenty for testing
- ⚠️ Sleeps after 1 hour idle
- ⚠️ 1 GB RAM (enough for JEDI RE)

### Keep It Awake (Free)
- Use UptimeRobot.com
- Ping every 5 minutes
- Free forever

### Always On (Paid)
- Replit Hacker plan ($7/month)
- Never sleeps
- Better performance

---

## ✅ Success Checklist

- [ ] Replit account ready
- [ ] GitHub repo imported
- [ ] Dependencies installed (npm + pip)
- [ ] Environment variables set
- [ ] Server started successfully
- [ ] Health check passes
- [ ] Capacity analysis works
- [ ] CoStar signal processing works
- [ ] Public URL accessible
- [ ] CORS configured
- [ ] ApartmentIQ integration ready (when API is live)

---

## 🎯 Next Steps After Deployment

1. **Test All Endpoints** - Make sure everything works
2. **Share Public URL** - Give it to ApartmentIQ team
3. **Monitor Logs** - Watch for errors
4. **Test ApartmentIQ Integration** - When their API goes live
5. **Load 171K Parcels** - Run full data import
6. **Deploy Frontend** - Connect UI to API
7. **Beta Testing** - Get users testing

---

## 📞 Quick Reference

| What | Where |
|------|-------|
| GitHub Repo | https://github.com/Nardo758/JediRe |
| Replit Docs | REPLIT_SETUP.md |
| Integration Docs | backend/APARTMENTIQ_INTEGRATION.md |
| API Tests | backend/API_TEST_RESULTS.md |
| Architecture | COMPREHENSIVE_ARCHITECTURAL_REVIEW.md |

---

## 🚀 Deploy Commands (Quick Copy-Paste)

```bash
# In Replit Shell:

# 1. Run setup script
bash replit-deploy.sh

# 2. Start server
cd backend && npm run dev

# 3. Test in new Shell tab
curl http://localhost:3000/health

# 4. Test capacity analysis
curl -X POST http://localhost:3000/api/v1/pipeline/analyze \
  -H "Content-Type: application/json" \
  -d '{"parcel_id":"TEST","current_zoning":"MRC-2","lot_size_sqft":87120,"current_units":0}'
```

---

**Time to Deploy:** 10 minutes  
**Difficulty:** Easy  
**Status:** ✅ Ready NOW

**Let's go! 🚀**
