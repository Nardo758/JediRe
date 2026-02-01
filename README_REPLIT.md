# 🎯 JediRe - Replit Edition

**The fastest way to deploy a real estate intelligence platform!**

This is a simplified, Replit-optimized version that works on the **free tier** and can be deployed in **under 10 minutes**.

---

## 🚀 Quick Deploy

### 1. Prerequisites
- A Replit account (free)
- That's it! No credit card, no external services required.

### 2. Three Steps to Deploy

```bash
1. Fork this Repl
2. Add PostgreSQL database (Tools → Database)
3. Click Run!
```

### 3. Access Your App

- **Frontend:** Opens automatically in webview
- **Backend API:** `https://<your-repl>.replit.dev`
- **Health Check:** `https://<your-repl>.replit.dev/health`

**Demo Login:**
- Email: `demo@jedire.com`
- Password: `demo123`

---

## 📖 Full Documentation

👉 **[Read the Complete Setup Guide](./REPLIT_SETUP.md)**

The guide includes:
- ✅ Step-by-step setup instructions
- ✅ Configuration options
- ✅ API documentation
- ✅ Troubleshooting guide
- ✅ Customization examples
- ✅ Production deployment tips

---

## 🎯 What's Included

### Backend
- ✅ RESTful API (Express + TypeScript)
- ✅ Real-time WebSocket (Socket.io)
- ✅ PostgreSQL database
- ✅ JWT authentication
- ✅ Health monitoring

### Frontend
- ✅ Modern React 18 + TypeScript
- ✅ Vite for blazing fast builds
- ✅ Tailwind CSS styling
- ✅ Mapbox map integration
- ✅ Real-time collaboration

### Supply Agent
- ✅ Automated market analysis
- ✅ Mock data generation
- ✅ Optional AI insights (Claude)
- ✅ Background processing

---

## 💡 Key Features

### Simplified for Replit
- ❌ No Docker
- ❌ No Redis
- ❌ No Kafka
- ❌ No complex setup
- ✅ One command to run everything
- ✅ Works on free tier
- ✅ Auto-scales on Replit

### Still Powerful
- ✅ Full-stack application
- ✅ Real-time updates
- ✅ Multi-user collaboration
- ✅ Market analytics
- ✅ Property tracking
- ✅ AI-powered insights (optional)

---

## 🔧 Quick Configuration

### Optional: Add API Keys

For enhanced features, add these secrets in Replit:

| Secret | Purpose | Get It At |
|--------|---------|-----------|
| `MAPBOX_TOKEN` | Map visualization | https://mapbox.com (free) |
| `CLAUDE_API_KEY` | AI insights | https://console.anthropic.com (free credits) |

### Customize Markets

Edit `agents/supply/.env`:
```bash
MARKETS=Your City, ST;Another City, ST
```

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│         (React + Vite + Mapbox)                 │
│              Port 3000                           │
└────────────────┬────────────────────────────────┘
                 │ HTTP/WebSocket
┌────────────────▼────────────────────────────────┐
│                  Backend                         │
│      (Node.js + Express + Socket.io)            │
│              Port 4000                           │
└────────────────┬────────────────────────────────┘
                 │ SQL
┌────────────────▼────────────────────────────────┐
│              PostgreSQL                          │
│         (Replit Database)                        │
└──────────────────────────────────────────────────┘
                 ▲
                 │ Write
┌────────────────┴────────────────────────────────┐
│           Supply Agent                           │
│      (Python - Background Task)                 │
└──────────────────────────────────────────────────┘
```

---

## 🎮 Quick Start Guide

### After Deployment

1. **Open the frontend** - Click the webview
2. **Login** with demo credentials
3. **Explore the dashboard**
   - View market metrics
   - Search properties
   - Enable agent modules
4. **Check the map** - Interactive property visualization
5. **View supply data** - See agent-generated analytics

### API Exploration

```bash
# Health check
curl https://<your-repl>.replit.dev/health

# Get markets
curl https://<your-repl>.replit.dev/api/v1/markets

# Get supply metrics for Austin
curl https://<your-repl>.replit.dev/api/v1/supply/Austin,%20TX
```

---

## 🛠️ Development

### File Structure
```
jedire/
├── run.sh                    # Main startup script
├── .replit                   # Replit configuration
├── backend/                  # API server
├── frontend/                 # React UI
├── agents/supply/            # Background agent
└── migrations/replit/        # Database setup
```

### Run Locally

```bash
# All services
bash run.sh

# Or individually:
cd backend && npm run dev
cd frontend && npm run dev
cd agents/supply && python src/main.py
```

---

## 📚 Learn More

- **[Complete Setup Guide](./REPLIT_SETUP.md)** - Full documentation
- **[API Reference](#)** - Endpoint documentation
- **[Architecture Overview](./LIGHTWEIGHT_ARCHITECTURE.md)** - System design

---

## 🤝 Support

### Issues?

1. Check [REPLIT_SETUP.md](./REPLIT_SETUP.md) - Troubleshooting section
2. Review console logs
3. Check database connection
4. Open an issue on GitHub

### Want to Contribute?

Pull requests welcome! This is a simplified educational version.

---

## 📄 License

MIT License - Free to use and modify!

---

## 🎉 You're Ready!

Click **Run** and watch your real estate platform come to life!

```
🚀 Deploying...
📊 Database: ✓
⚙️  Backend: ✓
🎨 Frontend: ✓
🤖 Agent: ✓
✅ Ready!
```

**Happy Building! 🏗️**

---

*P.S. This is a learning project. For production use, consider the full version with Redis, Kafka, and TimescaleDB.*
