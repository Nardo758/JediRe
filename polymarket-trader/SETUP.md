# Setup Guide - Polymarket Trading Bot

Quick setup instructions to get the bot running.

## 🚀 Installation

### 1. Navigate to directory
```bash
cd /home/leon/clawd/polymarket-trader
```

### 2. Install dependencies
```bash
npm install
```

### 3. Build TypeScript
```bash
npm run build
```

### 4. Configure API Keys

The bot needs access to Claude API. Two options:

**Option A: Use Clawdbot's credentials (automatic)**
- If running through Clawdbot, Claude credentials are auto-detected
- No additional setup needed

**Option B: Set environment variable**
```bash
export ANTHROPIC_API_KEY="your_key_here"
```

Or create `.env` file:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Test the installation
```bash
npm test
```

You should see:
- ✅ Polymarket API accessible
- ✅ Grok API accessible
- ✅ Claude API accessible
- ✅ Alert formatting works
- ✅ Arbitrage detection works (if opportunities exist)

## 🎯 First Run

### Start monitoring
```bash
npm start
```

Or through RocketMan:
```
Start the Polymarket trading bot
```

### What happens:
1. Bot loads configuration
2. Runs health checks
3. Performs initial market scan
4. Schedules recurring scans (every 5 minutes)
5. Sends alerts to Telegram when opportunities found

### Monitor the output:
```
🚀 Polymarket Trading Bot Starting...

🏥 Running health checks...
  ✅ Polymarket API: OK
  ✅ Grok (xAI): OK
  ✅ Claude: OK

🔍 Running initial market scan...
📊 Fetching markets from Polymarket...
   Found 3 potential opportunities!

🔍 Analyzing: Will Bitcoin hit $100k by end of 2024?
   Spread: 4.2%
   🤖 Running Grok analysis...
      Sentiment: BULLISH (78% confidence)
   🧠 Running Claude analysis...
      Recommendation: BUY
      Risk Score: 4/10
   📱 Sending Telegram alert...
   ✅ Alert sent! Waiting for approval...

⏰ Scheduling scans every 5 minutes

✅ Bot is now running!
📊 Monitoring Polymarket for arbitrage opportunities...
💬 Alerts will be sent via Telegram when opportunities are found.

Press Ctrl+C to stop.
```

## ⚙️ Configuration

### Edit config.json

**Scan frequency:**
```json
"pollIntervalMinutes": 5  // Change to 1, 10, 15, etc.
```

**Spread threshold:**
```json
"minSpreadPercent": 3  // Lower = more opportunities
```

**Market filters:**
```json
"categories": ["politics", "crypto"]  // Focus on specific categories
```

**Position sizing:**
```json
"defaultPositionSize": 50,  // Default $50
"maxPositionSize": 100      // Max $100
```

**Risk tolerance:**
```json
"riskTolerance": "medium"  // low | medium | high
```

### Restart after config changes
```bash
# Stop: Ctrl+C
# Restart:
npm start
```

## 🔐 Phase 2: Enable Trading (Optional)

**WARNING:** Only do this after monitoring for 24-48 hours!

### 1. Create a new Polygon wallet
- Use MetaMask or similar
- **Don't use your main wallet!**
- Start with small amount ($100-200)

### 2. Fund wallet with USDC
- Bridge USDC to Polygon
- Keep some MATIC for gas fees

### 3. Export private key
- In MetaMask: Account Details → Export Private Key
- **Keep this secret!**

### 4. Add to config.json
```json
"apis": {
  "polymarket": {
    "apiKey": null,
    "privateKey": "0x1234...your_private_key...",
    "baseUrl": "https://clob.polymarket.com"
  }
}
```

### 5. Restart bot
```bash
npm start
```

Now when you approve trades, they'll execute!

## 🐛 Troubleshooting

### "Grok API error: 404 model not found"
**Fix:** Update config.json:
```json
"model": "grok-3"  // Not "grok-beta"
```

### "Claude API: authentication failed"
**Fix:** Set ANTHROPIC_API_KEY environment variable:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### "No opportunities found"
**Normal!** Try:
- Lower `minSpreadPercent` (try 2%)
- Increase `maxMarkets` (try 100)
- Wait - opportunities come and go

### Bot crashes on start
**Check:**
```bash
# Verify dependencies installed
npm install

# Rebuild TypeScript
npm run build

# Check config is valid JSON
cat config.json | jq .
```

## 📊 Monitoring

### Check bot status
```bash
# Via logs
tail -f bot-state.json

# Via RocketMan
"What's the Polymarket bot status?"
```

### View alerts
- Check Telegram for messages
- Review `bot-state.json` for alert history

### Stop bot
```bash
# Press Ctrl+C
# Or via RocketMan:
"Stop the Polymarket trading bot"
```

## 🎓 Best Practices

### During first 24 hours:
- ✅ Monitor output closely
- ✅ Review all alerts
- ✅ Don't approve trades yet
- ✅ Verify analysis quality
- ✅ Tune configuration

### During first week:
- ✅ Track "would-be" trades manually
- ✅ Calculate hypothetical P&L
- ✅ Adjust thresholds
- ✅ Build confidence

### Before enabling trading:
- ✅ Comfortable with analysis quality
- ✅ Understand the markets
- ✅ Tested with paper trading
- ✅ Ready to monitor actively
- ✅ Using dedicated wallet with limited funds

## 📚 Next Steps

1. **Read SKILL.md** - Detailed instructions for RocketMan
2. **Read README.md** - Complete project documentation
3. **Run `npm test`** - Verify everything works
4. **Start monitoring** - Let it run for 24-48 hours
5. **Review results** - Assess alert quality
6. **Consider trading** - Only after extensive monitoring

## 🚨 Security Checklist

- [ ] Using dedicated wallet (not main wallet)
- [ ] Limited funds in wallet ($100-500)
- [ ] Private key never committed to git
- [ ] .gitignore includes config.json
- [ ] Comfortable with risk level
- [ ] Understand all markets before approving
- [ ] Manual approval required (autoApprove = false)

---

**Questions?** Check SKILL.md or ask RocketMan!
