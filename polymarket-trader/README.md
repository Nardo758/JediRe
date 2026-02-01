# Polymarket Trading Bot

**Production-ready arbitrage trading bot for Polymarket prediction markets**

Monitors Polymarket 24/7 for arbitrage opportunities, analyzes them using Grok (real-time Twitter/news sentiment) and Claude (risk assessment), then alerts you via Telegram with inline approve/reject buttons.

## 🎯 What Is Arbitrage?

**Arbitrage Opportunity = When YES + NO prices sum to less than 100%**

Example:
- YES price: 48% ($0.48 per share)
- NO price: 48% ($0.48 per share)
- Total: 96% (**4% spread**)

**The Trade:**
- Buy $50 of YES shares = 104.17 shares @ $0.48
- Buy $50 of NO shares = 104.17 shares @ $0.48
- **Total invested: $96**

**At Resolution:**
- One outcome wins and pays $1.00 per share
- You get: 104.17 × $1.00 = **$104.17**
- **Profit: $4.17 (4.3% return)**

This is a **guaranteed profit** regardless of which side wins!

## 🏗️ Architecture

```
Information → Analysis → Decision → Execution

1. Polymarket API     → Market data & prices
2. Grok (xAI)         → Real-time X/Twitter sentiment
3. Claude             → Risk analysis & recommendations
4. Telegram           → Alert with approve/reject buttons
5. Trade Executor     → Execute approved trades
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /home/leon/clawd/polymarket-trader
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Configure (Optional)

Edit `config.json` to adjust:
- Scan interval (default: 5 minutes)
- Minimum spread threshold (default: 3%)
- Position sizes (default: $50)
- Risk tolerance

**API keys already configured:**
- ✅ Grok (xAI) - Built-in
- ✅ Claude - Uses Clawdbot's credentials

### 4. Start Monitoring

```bash
npm start
```

Or ask RocketMan:
```
Start the Polymarket trading bot
```

## 📊 What Happens Next

1. **Bot scans Polymarket** every 5 minutes
2. **Finds arbitrage opportunities** (spread >3%)
3. **Analyzes with Grok** - Twitter/news sentiment
4. **Analyzes with Claude** - Risk assessment
5. **Sends Telegram alert** with all data + buttons
6. **Waits for approval** - You click ✅ or ❌
7. **Executes trade** (when wallet configured)

## 🔐 Phase 1: Monitor Only Mode

**You're currently in Monitor-Only Mode** (safest option)

✅ **What works now:**
- Scans markets for opportunities
- Grok sentiment analysis
- Claude risk assessment
- Telegram alerts with recommendations
- NO TRADES EXECUTED (wallet not configured)

✅ **Safe to run 24/7**

This lets you:
- See what opportunities exist
- Test analysis quality
- Refine thresholds
- Learn the markets
- Build confidence

## 🔓 Phase 2: Enable Trading (Later)

When ready to trade, you'll need:

1. **Polymarket Wallet Setup:**
   - Create new Polygon wallet (MetaMask)
   - Add USDC to wallet ($100-500 for testing)
   - Export private key

2. **Add to config.json:**
   ```json
   "apis": {
     "polymarket": {
       "apiKey": "your_api_key_here",
       "privateKey": "0x...your_private_key...",
       "baseUrl": "https://clob.polymarket.com"
     }
   }
   ```

3. **Test with small amounts first!**

⚠️ **NEVER share config.json after adding private key!**

## 📱 Telegram Alerts

When an opportunity is found, you'll receive:

```
🎯 ARBITRAGE OPPORTUNITY DETECTED

Market: Will Bitcoin hit $100k by end of 2024?
Category: Crypto
Spread: 4.2%

📊 Current Prices:
• YES: 47.8%
• NO: 48.0%
• Spread: 4.2%

💰 Market Metrics:
• Volume: $1,234,567
• Liquidity: $87,654
• End Date: Dec 31, 2024

🤖 Grok Analysis (Real-time X/Twitter):
• Sentiment: 🟢 Bullish
• Confidence: 78%
• Strong Twitter momentum around BTC, recent news positive...
• Trends: #Bitcoin, #BTC100k
• ⚠️ Risks: High volatility expected

🧠 Claude Analysis:
• Recommendation: 🟢 BUY
• Risk Score: 4/10
• Position Size: $50
• Valid Arbitrage: ✅ Yes
• Solid spread with low resolution risk. Market has clear end date.

📈 Exit Strategy:
Hold until market resolution on Dec 31, 2024

⚠️ Concerns:
• Market could resolve early if $100k hit sooner
• Liquidity might drop as resolution approaches

---
Alert ID: alert_1703275839_x7k3n
Generated: 2:43:59 PM

[✅ Approve Trade] [❌ Reject] [ℹ️ More Info]
```

**Click ✅ to approve** → Trade executes (when wallet configured)
**Click ❌ to reject** → Opportunity dismissed

## 🎓 Example Scenarios

### Scenario 1: Clear Arbitrage ✅

```
Market: "Will the sun rise tomorrow?"
YES: 45%, NO: 45%, Spread: 10%

Grok: BULLISH (99% confidence) - Obvious true outcome
Claude: STRONG_BUY (Risk: 1/10) - Clear arbitrage

Action: APPROVE - Essentially free money
```

### Scenario 2: Sentiment Play ⚖️

```
Market: "Will Trump win 2024 election?"
YES: 51%, NO: 46%, Spread: 3%

Grok: MIXED (65% confidence) - Polls show tight race
Claude: HOLD (Risk: 6/10) - Spread too narrow, high uncertainty

Action: REJECT - Too risky, spread too small
```

### Scenario 3: Mispricing ✅

```
Market: "Will ETH hit $10,000 by end of month?"
YES: 35%, NO: 60%, Spread: 5%

Grok: BEARISH (85% confidence) - Unrealistic target
Claude: BUY (Risk: 4/10) - Strong arbitrage + sentiment aligned

Action: APPROVE - Good spread, low risk
```

## 🔧 Configuration Options

### Monitoring Settings

```json
"monitoring": {
  "pollIntervalMinutes": 5,      // How often to scan (1-60)
  "maxMarkets": 50,              // Markets to check (10-100)
  "minSpreadPercent": 3,         // Min spread to alert (1-10)
  "minLiquidity": 10000,         // Min liquidity ($)
  "categories": ["all"]          // Filter categories
}
```

**Categories:** `politics`, `crypto`, `sports`, `all`

### Trading Settings

```json
"trading": {
  "maxPositionSize": 100,        // Max $ per trade
  "defaultPositionSize": 50,     // Default $ per trade
  "autoApprove": false,          // NEVER enable without testing!
  "riskTolerance": "medium"      // low | medium | high
}
```

**Risk Tolerance:**
- `low` - Only alerts for risk ≤3/10, spreads ≥5%
- `medium` - Alerts for risk ≤6/10, spreads ≥3%
- `high` - Alerts for risk ≤8/10, spreads ≥2%

### Alert Settings

```json
"alerts": {
  "telegram": true,              // Enable Telegram alerts
  "telegramChatId": null,        // Auto-detected
  "minRiskScore": 3              // Only alert if risk ≤ 7/10
}
```

## 📈 Cost Analysis

### API Costs (per scan)

**Scanning 50 markets, analyzing top 3:**
- Polymarket API: **Free**
- Grok (xAI): ~$0.05-0.10 (3 analyses @ $0.02-0.03 each)
- Claude: ~$0.10-0.20 (3 analyses @ $0.03-0.07 each)

**Total per scan: ~$0.15-0.30**

### Daily Costs

| Scan Interval | Scans/Day | Daily Cost |
|---------------|-----------|------------|
| 1 minute      | 1,440     | $216-432   |
| 5 minutes     | 288       | $43-86     |
| 10 minutes    | 144       | $22-43     |
| 15 minutes    | 96        | $14-29     |
| 30 minutes    | 48        | $7-14      |

**Recommended: 5-10 minute intervals** for active monitoring

### ROI Breakeven

Need **~1 successful trade per day** with 3% spread to break even on API costs:
- API cost: ~$50/day (5 min intervals)
- One $50 trade @ 3% spread = $1.50 profit
- Need ~34 trades/day to break even

**Strategy:**
- Higher spreads (5-10%) → Fewer trades needed
- Larger positions ($100-200) → Higher absolute returns
- Selective analysis (top 1-2 opportunities) → Lower costs

## 🐛 Troubleshooting

### "No opportunities found"

**Normal!** Means no spreads exceed your threshold.

**Solutions:**
- Lower `minSpreadPercent` (try 2%)
- Increase `maxMarkets` (try 100)
- Check different `categories`
- Wait - opportunities come and go

### "Grok API error"

**Check:**
- API key is valid
- Not rate limited
- Internet connection works

**Fix:**
- Restart bot: `npm start`
- Check xAI dashboard for limits

### "Claude API error"

**Check:**
- Clawdbot credentials configured
- Not rate limited

**Fix:**
- Restart Clawdbot gateway
- Check Anthropic dashboard

### "Trade execution failed"

**Expected in Monitor-Only Mode!**

**To enable trading:**
1. Add wallet private key to config.json
2. Fund wallet with USDC
3. Restart bot

## 📚 Project Structure

```
polymarket-trader/
├── README.md             ← Setup instructions (you are here)
├── SKILL.md              ← RocketMan instructions
├── package.json          ← Dependencies
├── tsconfig.json         ← TypeScript config
├── config.json           ← Bot configuration
├── bot-state.json        ← Runtime state (auto-generated)
│
├── types.ts              ← TypeScript type definitions
├── monitor.ts            ← Main bot orchestrator
├── polymarket-api.ts     ← Polymarket API client
├── grok-analyzer.ts      ← xAI/Grok sentiment analysis
├── claude-analyzer.ts    ← Claude risk assessment
├── telegram-alerts.ts    ← Alert formatting
└── trade-executor.ts     ← Trade execution engine
```

## 🎯 Next Steps

1. **Run in Monitor-Only Mode** (current phase)
   - Let it scan for 24-48 hours
   - Review the alerts you receive
   - Assess analysis quality

2. **Tune Configuration**
   - Adjust thresholds based on opportunities found
   - Change scan interval if needed
   - Refine risk tolerance

3. **Paper Trading**
   - Track "would-be" trades manually
   - Calculate hypothetical P&L
   - Validate strategy works

4. **Enable Live Trading** (when confident)
   - Set up wallet with small amount ($100-200)
   - Add private key to config
   - Start with $10-25 positions
   - Scale up gradually

## 🚨 Safety Reminders

1. ⚠️ **Start in monitor-only mode** - Don't enable trading immediately
2. 🔐 **Secure your private keys** - Never commit to git, never share
3. 💰 **Start small** - Test with $10-50 positions first
4. 📊 **Track everything** - Review bot-state.json daily
5. 🎓 **Understand markets** - Only trade markets you comprehend
6. ⏰ **Monitor closely** - Check bot several times a day initially
7. 🛡️ **Set limits** - Use maxPositionSize to cap risk
8. ❌ **Never auto-approve** - Always require manual approval

## 📖 Resources

- **Polymarket:** https://polymarket.com/
- **Polymarket Docs:** https://docs.polymarket.com/
- **xAI (Grok):** https://x.ai/
- **Anthropic (Claude):** https://anthropic.com/

## 🎓 Learn More

Ask RocketMan:
- "Explain Polymarket arbitrage"
- "How does the trading bot work?"
- "What's the current bot status?"
- "Show me Polymarket opportunities"

---

**Built with:**
- TypeScript + Node.js
- Polymarket CLOB API
- xAI Grok (real-time sentiment)
- Anthropic Claude (risk analysis)
- Telegram (alerts + approvals)

**License:** MIT
**Author:** Clawdbot
**Version:** 1.0.0

---

🚀 **Ready to start?** Run `npm start` or ask RocketMan to "Start the Polymarket trading bot"
