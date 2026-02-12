# 🎨 Polymarket Trading Bot Dashboard

## 🚀 Quick Start

### Start the Dashboard:
```bash
cd ~/clawd/polymarket-trader
npm run dashboard
```

### Access Dashboard:
Open your browser to:
```
http://localhost:3333
```

---

## 📊 Dashboard Features

### **Real-Time Monitoring:**
- ✅ Bot status (Running/Stopped)
- ✅ Last check time
- ✅ Total alerts generated
- ✅ Total trades executed
- ✅ Bot uptime

### **Performance Metrics:**
- 💰 Active positions count
- 📈 Win rate
- 💵 Total P&L
- 📊 Today's P&L

### **Configuration Display:**
- Scan interval
- Minimum spread threshold
- Position size
- Auto-approve status

### **Live Data:**
- 🔔 Pending alerts (opportunities waiting for approval)
- 📈 Active positions (current trades)
- 📝 Live logs (real-time bot activity)

---

## 🎯 How It Works

### **WebSocket Updates:**
Dashboard updates automatically via WebSocket when:
- Bot status changes
- New opportunities found
- Trades executed
- Logs updated

### **Auto-Refresh:**
Stats refresh every 30 seconds

---

## 🖥️ Using the Dashboard

### **1. Start Bot (in separate terminal):**
```bash
cd ~/clawd/polymarket-trader
npm start
```

### **2. Start Dashboard:**
```bash
cd ~/clawd/polymarket-trader
npm run dashboard
```

### **3. Monitor:**
- Open http://localhost:3333
- Watch real-time updates
- See opportunities as they're found
- Track trade performance

---

## 📱 Dashboard Sections

### **Header:**
- Shows bot name
- Status badge (Running/Stopped with pulsing dot)

### **Bot Status Card:**
- When bot last checked markets
- Total opportunities found
- Total trades made
- How long bot has been running

### **Performance Card:**
- Number of open positions
- Win rate (after trades complete)
- Total profit/loss
- Today's profit/loss

### **Configuration Card:**
- How often bot scans (5 minutes)
- Minimum profit threshold (3%)
- Trade size ($50)
- Auto-approval status (Manual/Auto)

### **Pending Alerts:**
- Opportunities found
- Waiting for your approval
- Shows market, spread, confidence

### **Active Positions:**
- Currently open trades
- Market name
- Position size
- Current P&L (green = profit, red = loss)

### **Live Logs:**
- Real-time bot activity
- Market scans
- Opportunity analysis
- Trade execution
- Errors/warnings

---

## 🎨 Dashboard Design

### **Color Coding:**
- 🟢 **Green:** Running, Profitable, Positive
- 🔴 **Red:** Stopped, Loss, Negative
- 🟡 **Yellow:** Pending, Warning
- 🔵 **Blue:** Info, Neutral

### **Status Indicators:**
- **Pulsing dot:** Bot is actively running
- **Static badge:** Bot stopped

---

## 🔧 Troubleshooting

### **Dashboard won't start:**
```bash
# Rebuild TypeScript
npm run build

# Try again
npm run dashboard
```

### **Port 3333 already in use:**
Edit `dashboard-server.ts`:
```typescript
const PORT = 3334; // Change to different port
```

Then rebuild:
```bash
npm run build
npm run dashboard
```

### **Dashboard shows "Stopped" but bot is running:**
- Check bot-state.json exists
- Restart dashboard
- Make sure bot is actually running

### **Logs not updating:**
- Check bot.log file exists
- Dashboard watches for file changes
- May take up to 2 seconds to update

---

## 📊 Example Workflow

### **Morning Routine:**
```bash
# Terminal 1: Start bot
cd ~/clawd/polymarket-trader
npm start

# Terminal 2: Start dashboard
cd ~/clawd/polymarket-trader
npm run dashboard

# Browser: Open dashboard
# http://localhost:3333
```

### **Monitor Throughout Day:**
- Dashboard shows opportunities in real-time
- Get Telegram notifications on phone
- Review opportunities in dashboard
- Approve trades via Telegram
- Track P&L in dashboard

### **Evening Review:**
- Check total P&L
- Review win rate
- Analyze which markets performed best
- Adjust configuration if needed

---

## 🚀 Pro Tips

### **Keep Dashboard Open:**
- Run on second monitor
- Or in separate browser window
- Great for passive monitoring

### **Mobile Access:**
- If on same network, access via:
  ```
  http://YOUR_COMPUTER_IP:3333
  ```
- Check IP with: `ip addr` or `ifconfig`

### **Screenshot Opportunities:**
- Dashboard shows full details
- Great for reviewing later
- Share with trading partners

---

## ⚙️ Advanced: Customization

### **Change Refresh Rate:**
Edit `public/index.html`:
```javascript
// Line ~580
setInterval(() => {
    fetch('/api/status')
        .then(res => res.json())
        .then(updateDashboard);
}, 30000); // Change 30000 to different milliseconds
```

### **Add Custom Metrics:**
1. Update `dashboard-server.ts` API routes
2. Add HTML elements in `public/index.html`
3. Update JavaScript to fetch/display

---

## 📁 Files

```
polymarket-trader/
├── dashboard-server.ts       # Dashboard backend server
├── public/
│   └── index.html            # Dashboard frontend
├── bot-state.json            # Bot state (read by dashboard)
├── bot.log                   # Bot logs (read by dashboard)
└── config.json               # Bot config (read by dashboard)
```

---

## 🎯 Next Steps

1. **Start dashboard** (npm run dashboard)
2. **Open in browser** (http://localhost:3333)
3. **Start bot** (npm start in separate terminal)
4. **Watch opportunities appear!**

---

**Dashboard running at:** http://localhost:3333
**Questions?** Check README.md or ask RocketMan!
