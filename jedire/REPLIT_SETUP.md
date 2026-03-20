# 🚀 JediRe - Replit Deployment Guide

**Deploy a full-stack real estate intelligence platform in under 10 minutes!**

This is a simplified, Replit-optimized version of JediRe that works on the **free tier** without any complex setup.

---

## ⚡ Quick Start (3 Steps)

### 1. Fork This Repl

Click the "Fork" button to create your own copy.

### 2. Add PostgreSQL Database

1. Click **Tools** → **Database** in the left sidebar
2. Select **PostgreSQL**
3. Click **Create Database**
4. ✓ Done! The `DATABASE_URL` secret is automatically created

### 3. Run It!

Click the **Run** button at the top. That's it!

The startup script will:
- ✓ Initialize the database with tables
- ✓ Install all dependencies
- ✓ Build backend and frontend
- ✓ Start all services

**Access your app:**
- Frontend: Opens automatically in the webview
- Backend API: `https://<your-repl>.replit.dev`
- Health Check: `https://<your-repl>.replit.dev/health`

---

## 🎯 What's Included

### Backend (Node.js/TypeScript)
- ✅ RESTful API with Express
- ✅ GraphQL support (Apollo Server)
- ✅ Real-time WebSocket (Socket.io)
- ✅ PostgreSQL database
- ✅ JWT authentication
- ✅ Health monitoring

**No Redis, No Kafka** - Everything writes directly to PostgreSQL

### Frontend (React/TypeScript)
- ✅ Modern React 18 + TypeScript
- ✅ Vite for fast builds
- ✅ Tailwind CSS for styling
- ✅ Mapbox for map visualization
- ✅ Real-time collaboration features
- ✅ Responsive design

### Supply Agent (Python)
- ✅ Automated market analysis
- ✅ Mock data generation (works without APIs)
- ✅ Optional AI insights (Claude API)
- ✅ Runs in background
- ✅ Direct database writes

---

## 📊 Database

### What's Different from Full Version?

**Removed:**
- ❌ TimescaleDB (time-series extension)
- ❌ PostGIS (geospatial extension)
- ❌ pgvector (vector embeddings)

**Kept:**
- ✅ Standard PostgreSQL
- ✅ All core functionality
- ✅ Full data model
- ✅ Geographic data (lat/lng as decimals)

### Tables Created

```
users                - User accounts & preferences
properties           - Real estate listings
supply_metrics       - Market supply analysis data
property_tracking    - User favorites/watchlists
alerts               - User notifications
sessions             - WebSocket session tracking
agent_runs           - Background job tracking
```

### Demo User

**Email:** `demo@jedire.com`  
**Password:** `demo123`

---

## 🔧 Configuration

### Environment Variables (Secrets)

Automatically set by Replit:
- `DATABASE_URL` - PostgreSQL connection string

**Optional - Add these for enhanced features:**

1. Click **Tools** → **Secrets** (padlock icon)
2. Add secrets:

| Secret Name | Description | Required? |
|------------|-------------|-----------|
| `CLAUDE_API_KEY` | Anthropic Claude API for AI insights | No |
| `MAPBOX_TOKEN` | Mapbox for maps (get free at mapbox.com) | No |
| `JWT_SECRET` | Custom JWT secret (auto-generated if not set) | No |

### Agent Configuration

Edit `agents/supply/.env` to customize:

```bash
# Markets to analyze (semicolon-separated)
MARKETS=Austin, TX;Denver, CO;Phoenix, AZ;Miami, FL

# How often to run (minutes)
AGENT_RUN_INTERVAL_MINUTES=60

# Use mock data (no external APIs needed)
USE_MOCK_DATA=true

# Enable AI insights (requires CLAUDE_API_KEY)
ENABLE_AI_INSIGHTS=false
```

---

## 🎮 Using the App

### Login

Use the demo credentials or create a new account.

### Dashboard Features

**Left Panel:**
- 🔍 Search markets
- 📊 Filter by metrics
- 🏘️ Toggle agent modules

**Map View:**
- 🗺️ Interactive property map
- 📍 Click properties for details
- 👥 See collaborators in real-time

**Right Panel:**
- 📈 Supply/demand metrics
- 💰 Cash flow analysis
- 🎯 Investment scoring
- 📝 Notes & annotations

### Real-Time Collaboration

Multiple users can:
- See each other's cursors
- View selected properties
- Chat and annotate together

---

## 🤖 Supply Agent

The agent runs in the background analyzing markets.

### What It Does

1. **Collects Data** - Gathers market metrics (mock or real)
2. **Analyzes Trends** - Calculates supply/demand indicators
3. **Scores Markets** - 0-100 opportunity scoring
4. **Generates Insights** - AI-powered analysis (optional)
5. **Updates Database** - Real-time data for frontend

### Check Agent Status

Visit: `https://<your-repl>.replit.dev/api/v1/markets`

You'll see:
```json
{
  "success": true,
  "data": [
    {
      "market": "Austin, TX",
      "total_inventory": 2341,
      "months_of_supply": 2.8,
      "score": 78.5,
      "interpretation": "low_supply"
    }
  ]
}
```

### View Logs

Check the console output or `agents/supply/logs/supply_agent.log`

---

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

Returns system status and database connectivity.

### Supply Metrics
```bash
GET /api/v1/supply/:market
GET /api/v1/markets
```

Get supply analysis for specific market or all markets.

### Properties
```bash
GET /api/v1/properties?city=Austin&limit=50
```

Search properties by city.

### Alerts
```bash
GET /api/v1/alerts/:userId
```

Get user notifications.

### Authentication
```bash
POST /api/v1/auth/login
Body: { "email": "demo@jedire.com", "password": "demo123" }
```

---

## 🔨 Development

### File Structure

```
jedire/
├── run.sh                    # Main startup script
├── .replit                   # Replit configuration
├── replit.nix               # Nix dependencies
│
├── backend/                  # Node.js API server
│   ├── src/index.replit.ts  # Simplified entry point
│   ├── package.replit.json  # Minimal dependencies
│   └── .env.replit          # Config template
│
├── frontend/                 # React UI
│   ├── src/                 # React components
│   ├── vite.config.replit.ts
│   └── .env.replit
│
├── agents/                   # Background agents
│   └── supply/
│       ├── src/main.replit.py
│       ├── config/settings.replit.py
│       └── requirements.replit.txt
│
└── migrations/replit/        # Database setup
    ├── 001_core_simple.sql  # Simplified schema
    └── init_db.sh           # Migration runner
```

### Local Development

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

**Supply Agent:**
```bash
cd agents/supply
source venv/bin/activate
python src/main.py
```

### Customization

**Add New Markets:**

Edit `agents/supply/.env`:
```bash
MARKETS=Your City, ST;Another City, ST
```

**Change Update Frequency:**
```bash
AGENT_RUN_INTERVAL_MINUTES=30  # Run every 30 minutes
```

**Enable Real Data:**

Set `USE_MOCK_DATA=false` and add API keys for Zillow/Redfin (requires implementation).

---

## 🐛 Troubleshooting

### Database Connection Error

**Problem:** `DATABASE_URL not set`

**Solution:**
1. Go to **Tools** → **Database**
2. Create a PostgreSQL database
3. Restart the Repl

### Frontend Not Loading

**Problem:** Blank screen or errors

**Solution:**
1. Check browser console for errors
2. Verify backend is running: Visit `/health`
3. Check that port 3000 is exposed

### Agent Not Running

**Problem:** No supply metrics appearing

**Solution:**
1. Check console for agent logs
2. Verify database connection
3. Check `agents/supply/logs/supply_agent.log`

### Build Errors

**Problem:** `npm install` fails

**Solution:**
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Check Node version: `node --version` (should be >= 18)

---

## 🚀 Going to Production

### Get Real API Keys

**Mapbox (Free Tier):**
1. Sign up at https://mapbox.com
2. Get your access token
3. Add to Secrets: `MAPBOX_TOKEN`

**Claude AI (Free Credits):**
1. Sign up at https://console.anthropic.com
2. Get your API key
3. Add to Secrets: `CLAUDE_API_KEY`

### Security Improvements

**Change JWT Secret:**
```bash
# In Secrets, add:
JWT_SECRET=your-super-secret-random-string-here
```

**Enable Production Mode:**
```bash
NODE_ENV=production
```

### Performance Optimization

**Reduce Agent Frequency:**
```bash
# Only run every 4 hours in production
AGENT_RUN_INTERVAL_MINUTES=240
```

**Add Caching:**
- Consider adding Redis for session storage
- Enable frontend caching headers

---

## 📚 What's Different from Full Version?

This Replit edition is **optimized for simplicity and speed**:

### Removed
- ❌ Kafka message broker (direct DB writes)
- ❌ Redis caching (in-memory only)
- ❌ Bull queue system (inline processing)
- ❌ TimescaleDB (standard PostgreSQL)
- ❌ PostGIS (lat/lng decimals)
- ❌ Docker Compose (native Replit)
- ❌ Complex CI/CD (one-click deploy)

### Simplified
- ✅ Single command startup (`run.sh`)
- ✅ Auto database setup
- ✅ Mock data by default
- ✅ Minimal dependencies
- ✅ No external services required

### Still Includes
- ✅ Full backend API
- ✅ Complete frontend UI
- ✅ Real-time WebSocket
- ✅ Supply analysis agent
- ✅ Authentication
- ✅ User management
- ✅ Property tracking
- ✅ Collaboration features

---

## 🎓 Learning Resources

### Understanding the Code

**Backend (TypeScript):**
- `backend/src/index.replit.ts` - Main server setup
- Simple Express + Socket.io + PostgreSQL

**Frontend (React):**
- `frontend/src/App.tsx` - Root component
- `frontend/src/pages/` - Main pages
- `frontend/src/components/` - Reusable components

**Agent (Python):**
- `agents/supply/src/main.replit.py` - Agent logic
- Async PostgreSQL + simple scoring algorithm

### Next Steps

1. **Customize the UI** - Edit React components
2. **Add More Agents** - Create demand, price, or zoning agents
3. **Implement Real Data** - Add API integrations
4. **Add Features** - Property search, advanced filters
5. **Deploy** - Use Replit's deployment features

---

## 💡 Tips & Tricks

### Speed Up Startup

After first run, services start faster. Database is already initialized.

### View Database Data

Use the Replit Database viewer:
1. Click **Tools** → **Database**
2. Click **Open** on your PostgreSQL database
3. Run SQL queries directly

### Debug API

Use the built-in health check:
```bash
curl https://<your-repl>.replit.dev/health
```

### Export Your Data

```bash
# From the Shell
pg_dump $DATABASE_URL > backup.sql
```

---

## 🤝 Support & Contributing

### Need Help?

1. Check the troubleshooting section
2. Review the code comments
3. Open an issue on GitHub

### Want to Contribute?

1. Fork this Repl
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

## 📄 License

MIT License - Free to use, modify, and distribute!

---

## 🎉 You're All Set!

Congratulations! You now have a full-stack real estate intelligence platform running on Replit.

**Next Steps:**
1. ✅ Log in with demo credentials
2. ✅ Explore the dashboard
3. ✅ Check the supply metrics
4. ✅ Customize for your needs

**Happy Building! 🏗️**

---

*Made with ❤️ for the Replit community*
