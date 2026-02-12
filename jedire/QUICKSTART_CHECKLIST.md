# ✅ JediRe Replit Deployment Checklist

Use this checklist to ensure everything is set up correctly!

---

## 🎯 Pre-Deployment

- [ ] Forked this Repl to your account
- [ ] Opened the Repl in Replit

---

## 📊 Database Setup

- [ ] Clicked **Tools** → **Database**
- [ ] Selected **PostgreSQL**
- [ ] Created database (button says "Created" or "Open")
- [ ] Verified `DATABASE_URL` secret exists (Tools → Secrets)

---

## ▶️ First Run

- [ ] Clicked **Run** button
- [ ] Saw "JediRe - Real Estate Intelligence Platform" banner
- [ ] Database initialization completed (green checkmarks)
- [ ] Backend built successfully
- [ ] Frontend built successfully
- [ ] All services started

**Expected output:**
```
✅ JediRe is running!
📡 Backend API:  http://localhost:4000
🌐 Frontend UI:  http://localhost:3000
```

---

## 🌐 Frontend Check

- [ ] Frontend opens in webview automatically
- [ ] Login page appears
- [ ] Can enter demo credentials:
  - Email: `demo@jedire.com`
  - Password: `demo123`
- [ ] Successfully logged in
- [ ] Dashboard loads with sidebar and map

---

## 📡 Backend Check

Open these URLs in a new tab:

- [ ] **Health Check**: `https://<your-repl>.replit.dev/health`
  - Should return JSON with `status: "healthy"`
  
- [ ] **Markets API**: `https://<your-repl>.replit.dev/api/v1/markets`
  - Should return JSON with market data
  
- [ ] **Supply Metrics**: `https://<your-repl>.replit.dev/api/v1/supply/Austin,%20TX`
  - Should return supply data for Austin

---

## 🤖 Agent Check

- [ ] Supply agent started (check console logs)
- [ ] See "🤖 SUPPLY AGENT (Replit Edition)" banner
- [ ] Agent analyzed markets
- [ ] Data appears in `/api/v1/markets` endpoint

**Agent logs should show:**
```
📊 STARTING ANALYSIS CYCLE
🏙️  Analyzing: Austin, TX
✓ Austin, TX: Score 78.5/100 (low_supply)
✓ Cycle complete!
```

---

## 🔧 Optional Enhancements

### Mapbox Integration
- [ ] Got free Mapbox token from https://mapbox.com
- [ ] Added `MAPBOX_TOKEN` to Secrets
- [ ] Restarted Repl
- [ ] Maps now showing in frontend

### Claude AI Integration
- [ ] Got free Claude API key from https://console.anthropic.com
- [ ] Added `CLAUDE_API_KEY` to Secrets
- [ ] Set `ENABLE_AI_INSIGHTS=true` in agent config
- [ ] Restarted agent
- [ ] AI insights appearing in supply metrics

---

## 🐛 Troubleshooting

### Database Not Found

**Symptom:** "DATABASE_URL not set" error

**Fix:**
1. Go to **Tools** → **Database**
2. Make sure PostgreSQL is created
3. Restart the Repl

---

### Frontend Shows Blank Page

**Symptom:** White screen in webview

**Fix:**
1. Open browser console (F12)
2. Check for errors
3. Verify backend is running: `/health` endpoint
4. Check CORS settings in backend `.env`

---

### Backend Won't Start

**Symptom:** "Port 4000 already in use" or build errors

**Fix:**
1. Stop the Repl
2. Delete `backend/node_modules`
3. Delete `backend/dist`
4. Run again

---

### Agent Not Running

**Symptom:** No supply data in `/api/v1/markets`

**Fix:**
1. Check console for Python errors
2. Verify `agents/supply/venv` exists
3. Check `agents/supply/logs/supply_agent.log`
4. Restart the agent manually:
   ```bash
   cd agents/supply
   bash run_agent.sh
   ```

---

## ✨ Success Criteria

Your deployment is successful when:

✅ All services start without errors  
✅ Frontend loads and shows login page  
✅ Backend `/health` returns healthy status  
✅ Agent analyzes markets every hour  
✅ Supply data appears in API  
✅ Can login with demo credentials  
✅ Dashboard shows market metrics  

---

## 🎉 You're Done!

If all checkboxes are checked, congratulations! 🎊

**Next Steps:**
1. Customize markets in agent config
2. Add your own API keys
3. Explore the codebase
4. Build new features!

---

## 📚 Resources

- **[Full Setup Guide](./REPLIT_SETUP.md)** - Complete documentation
- **[README](./README_REPLIT.md)** - Quick overview
- **[.env.example](./.env.example)** - All configuration options

---

**Need help?** Check the troubleshooting sections in the setup guide!
