# ⚡ Quickstart - Polymarket Trading Bot

**Get up and running in 5 minutes!**

## 1️⃣ Install (30 seconds)

```bash
cd /home/leon/clawd/polymarket-trader
npm install
npm run build
```

## 2️⃣ Set Claude API Key (30 seconds)

**Option A: Through Clawdbot (Automatic)**
- If running via RocketMan, credentials auto-detected ✅
- No setup needed!

**Option B: Manual Setup**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or create `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## 3️⃣ Test (1 minute)

```bash
npm test
```

Should show:
- ✅ Polymarket API: OK
- ✅ Grok (xAI): OK  
- ✅ Claude: OK
- ✅ Alert formatting: OK

## 4️⃣ Start (10 seconds)

```bash
npm start
```

Or through RocketMan:
```
Start the Polymarket trading bot
```

## 5️⃣ Monitor (Ongoing)

Bot will:
- Scan Polymarket every 5 minutes
- Find arbitrage opportunities (spread >3%)
- Analyze with Grok (sentiment) + Claude (risk)
- Send Telegram alerts with approve/reject buttons

**You're in MONITOR-ONLY mode** ✅
- No trades executed (safe!)
- Just alerts and analysis
- Perfect for learning

---

## 🎯 What to Expect

### First Hour
- 12 scans (every 5 min)
- 0-3 alerts (depends on market conditions)
- Learn how analysis works

### First Day
- ~288 scans
- ~5-20 alerts (typical)
- Refine your thresholds
- Build intuition

### First Week
- Track "would-be" trades
- Calculate hypothetical P&L
- Decide if you want to enable trading

---

## 🎓 When You Get an Alert

You'll receive a Telegram message with:

```
🎯 ARBITRAGE OPPORTUNITY

Market: Will Bitcoin hit $100k?
Spread: 4.2%

🤖 Grok: BULLISH (78%)
🧠 Claude: BUY (Risk 4/10)

[✅ Approve] [❌ Reject] [ℹ️ More Info]
```

**In Monitor-Only Mode:**
- Clicking ✅ Approve just logs your decision
- No actual trade happens
- Safe to practice!

**When Trading Enabled (later):**
- Clicking ✅ Approve executes real trade
- Uses your wallet funds
- Only enable after testing!

---

## ⚙️ Common Adjustments

### Get more alerts
```json
// config.json
"minSpreadPercent": 2  // Was 3
```

### Scan more frequently
```json
"pollIntervalMinutes": 2  // Was 5
```

### Focus on specific markets
```json
"categories": ["politics", "crypto"]  // Was "all"
```

### Increase position size
```json
"defaultPositionSize": 100  // Was 50
```

Restart after changes:
```bash
npm start
```

---

## 🚨 Important Notes

✅ **Safe right now:**
- No wallet configured
- No trades execute
- Just monitoring + learning

⚠️ **Before enabling trading:**
- Monitor for 48+ hours
- Understand the markets
- Create dedicated wallet
- Start with <$200
- Read SETUP.md fully

---

## 🐛 Issues?

### "Claude API failed"
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
npm start
```

### "Grok API 404"
Already fixed! Uses `grok-3` model.

### "No opportunities found"
Normal! Try lowering `minSpreadPercent` to 2%.

### Other issues
Check `SETUP.md` or ask RocketMan.

---

## 📚 Full Documentation

- **SKILL.md** - RocketMan commands + usage
- **README.md** - Complete project docs
- **SETUP.md** - Detailed setup guide
- **CHANGELOG.md** - Version history

---

## 🎯 Success Criteria

**After 24 hours:**
- [ ] Bot runs without crashing
- [ ] Received at least 1-2 alerts
- [ ] Analysis seems reasonable
- [ ] Understand how it works

**After 1 week:**
- [ ] Comfortable with analysis quality
- [ ] Know which markets to trade
- [ ] Ready to paper trade
- [ ] Confident in thresholds

**After 2 weeks:**
- [ ] Paper trades look profitable
- [ ] Understand the risks
- [ ] Ready to trade real money (optional)
- [ ] Have dedicated wallet setup

---

## 🚀 Next Steps

1. ✅ Bot is running in monitor-only mode
2. 📊 Check Telegram for alerts over next 24h
3. 🎓 Review each alert - do they make sense?
4. ⚙️ Adjust config.json if needed
5. 📖 Read SKILL.md for advanced usage
6. 🔐 Consider enabling trading (after extensive testing)

---

**Questions?** Ask RocketMan or check the docs!

**Ready to go?** 
```bash
npm start
```

🎉 **You're all set! The bot is now monitoring Polymarket for opportunities.**
