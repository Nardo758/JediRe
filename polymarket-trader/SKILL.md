# Polymarket Trading Bot Skill

**Production-ready arbitrage trading bot for Polymarket prediction markets**

## 🎯 What This Does

Monitors Polymarket 24/7 for arbitrage opportunities, analyzes them using Grok (real-time Twitter/news) and Claude (risk assessment), then alerts Leon via Telegram with approve/reject buttons.

**Arbitrage Opportunity = When YES + NO prices sum to less than 100%**

Example: YES = 48%, NO = 48%, Total = 96% → 4% guaranteed profit at resolution!

## 🤖 Commands You Can Use

### Start Monitoring
```
Start the Polymarket trading bot
```
or
```
Begin monitoring Polymarket for arbitrage opportunities
```

**What happens:**
- Bot scans top 50 markets every 5 minutes
- Identifies spreads >3%
- Analyzes with Grok (sentiment) + Claude (risk)
- Sends Telegram alerts with inline buttons
- Waits for your approval before trading

### Check Status
```
What's the status of the Polymarket bot?
```
or
```
Show me current Polymarket opportunities
```

**Returns:**
- Bot running status
- Last scan time
- Total alerts generated
- Total trades executed
- Active positions
- Pending alerts

### Stop Monitoring
```
Stop the Polymarket trading bot
```

**What happens:**
- Monitoring stops
- Active positions remain (if any)
- State is saved

### View Positions
```
Show my active Polymarket positions
```
or
```
What are my current trades on Polymarket?
```

**Returns:**
- All open positions
- Entry price vs current price
- P&L (profit/loss)
- Position size

### Manual Analysis Request
```
Analyze this Polymarket market: [market question or URL]
```

**What happens:**
- Fetches market data
- Runs Grok sentiment analysis
- Runs Claude risk assessment
- Returns detailed report (no auto-trade)

### Adjust Settings
```
Change Polymarket bot settings:
- Min spread threshold: 5%
- Max position size: $200
- Risk tolerance: high
```

**Edits config.json with new values**

## 📊 How Alerts Work

When an opportunity is found, you'll receive a Telegram message with:

```
🎯 ARBITRAGE OPPORTUNITY DETECTED

Market: Will Bitcoin hit $100k by end of 2024?
Spread: 4.2%
Volume: $1,234,567
Liquidity: $87,654

🤖 Grok Analysis:
Sentiment: BULLISH (78% confidence)
Summary: Strong Twitter momentum, recent news positive...

🧠 Claude Analysis:
Recommendation: BUY
Risk Score: 4/10
Position Size: $50
Reasoning: Valid arbitrage with low resolution risk...

[✅ Approve] [❌ Reject] [ℹ️ More Info]
```

**Click Approve** → Trade executes immediately
**Click Reject** → Opportunity dismissed
**Click More Info** → Get detailed analysis

## ⚙️ Configuration

Edit `/home/leon/clawd/polymarket-trader/config.json`:

### Monitoring Settings
```json
"monitoring": {
  "pollIntervalMinutes": 5,      // How often to scan
  "maxMarkets": 50,              // Number of markets to check
  "minSpreadPercent": 3,         // Minimum spread to alert
  "minLiquidity": 10000,         // Minimum market liquidity
  "categories": ["politics", "crypto", "sports", "all"]
}
```

### Trading Settings
```json
"trading": {
  "maxPositionSize": 100,        // Maximum $ per trade
  "defaultPositionSize": 50,     // Default $ per trade
  "autoApprove": false,          // NEVER set to true without testing!
  "riskTolerance": "medium"      // low | medium | high
}
```

### Alert Settings
```json
"alerts": {
  "telegram": true,
  "telegramChatId": null,        // Auto-detected
  "minRiskScore": 3              // Only alert if risk ≤ 7/10
}
```

## 🔐 API Keys Required

**Already Configured:**
- ✅ xAI (Grok) API Key - Built into config.json
- ✅ Claude API - Uses Clawdbot's credentials

**Need to Add:**
- ⚠️ Polymarket API Key (optional - only for read access)
- ⚠️ Wallet Private Key (required for trade execution)

**To add wallet for trading:**
```json
"apis": {
  "polymarket": {
    "apiKey": "your_api_key_here",
    "privateKey": "your_wallet_private_key_here",
    "baseUrl": "https://clob.polymarket.com"
  }
}
```

⚠️ **SECURITY WARNING:**
- Private key grants access to your funds!
- Start with a NEW wallet with limited funds ($100-500)
- NEVER share config.json publicly after adding keys
- Consider using environment variables for production

## 📈 Trading Phases

### Phase 1: Monitor Only (START HERE)
**Current Mode** - No wallet configured yet

✅ Safe to run 24/7
- Scans markets
- Generates alerts
- NO trades executed
- Test Grok + Claude analysis
- Refine thresholds

### Phase 2: Paper Trading
Track hypothetical trades in `bot-state.json`:
- Record "would-be" trades
- Measure performance
- Validate strategy
- Build confidence

### Phase 3: Live Trading (Small Size)
Once you add a wallet:
- Start with $10-50 positions
- Manual approval REQUIRED
- Gradually increase
- Monitor closely for first week

## 🎓 How to Respond

### When an Alert Comes In

**Review:**
1. Market question - Do you understand it?
2. Spread % - Is it significant?
3. Grok sentiment - Does Twitter/news support it?
4. Claude risk score - Comfortable with the risk?
5. Position size - Willing to commit that amount?

**Good signs:**
- Spread >5%
- High volume + liquidity
- Grok confidence >70%
- Claude risk score <5
- Clear market resolution criteria

**Red flags:**
- Spread <2% (might close before execution)
- Low liquidity (<$10k)
- Ambiguous market question
- Claude risk score >7
- Contradicting Grok sentiment

### Approval Guidelines

**Approve if:**
- All analysis looks good
- You understand the market
- Position size is comfortable
- Risk score is acceptable

**Reject if:**
- Something feels off
- Don't understand the market
- Risk too high
- Spread too narrow

**When in doubt → Reject**

## 🔧 Technical Details

### File Structure
```
polymarket-trader/
├── SKILL.md              ← You are here
├── README.md             ← Setup instructions
├── package.json          ← Dependencies
├── config.json           ← Configuration
├── types.ts              ← TypeScript types
├── monitor.ts            ← Main bot logic
├── polymarket-api.ts     ← API client
├── grok-analyzer.ts      ← Grok/xAI integration
├── claude-analyzer.ts    ← Claude integration
├── telegram-alerts.ts    ← Alert formatting
├── trade-executor.ts     ← Trade execution
└── bot-state.json        ← Bot state (auto-generated)
```

### How It Works

1. **Monitor** polls Polymarket API every 5 min
2. **Filter** for markets with spread >3% and liquidity >$10k
3. **Grok** analyzes sentiment using real-time Twitter/news
4. **Claude** assesses risk and recommends action
5. **Alert** sent to Telegram if passes thresholds
6. **Wait** for Leon's approval/rejection
7. **Execute** trade if approved (when wallet configured)
8. **Track** position and monitor for exit

### API Usage

**Cost Estimates (per scan of 50 markets):**
- Polymarket API: Free
- Grok (xAI): ~$0.05-0.10 (3 analyses)
- Claude: ~$0.10-0.20 (3 analyses)

**Total: ~$0.15-0.30 per scan**
**Daily (scanning every 5 min): ~$40-90**

💡 **Optimization:** Only analyze top 3 opportunities per scan to control costs

## 🐛 Troubleshooting

### Bot Won't Start
```
Check: npm install ran successfully?
Check: config.json is valid JSON?
Check: API keys are configured?
```

### No Opportunities Found
```
Normal! Means no spreads >3% currently.
Try: Lower minSpreadPercent in config
Try: Increase maxMarkets to check more
```

### Grok/Claude Errors
```
Check: API keys are valid?
Check: Internet connection?
Check: Rate limits not exceeded?
```

### Trade Won't Execute
```
Expected! Need to configure wallet first.
See: API Keys Required section above
```

## 📚 Resources

- **Polymarket Docs:** https://docs.polymarket.com/
- **Polymarket CLOB API:** https://docs.polymarket.com/
- **xAI (Grok) Docs:** https://docs.x.ai/
- **Anthropic (Claude) Docs:** https://docs.anthropic.com/

## 🚨 Important Reminders

1. **Never set autoApprove = true** without extensive testing
2. **Start small** - Test with $10-50 positions first
3. **Monitor closely** - Check bot daily for first week
4. **Understand markets** - Only trade markets you understand
5. **Manage risk** - Don't bet more than you can afford to lose
6. **Track performance** - Review bot-state.json regularly
7. **Stay liquid** - Keep some USDC for gas fees and opportunities
8. **Research resolution** - Make sure you understand how markets resolve

## 🎯 Success Metrics

After 1 week of monitoring:
- ✅ Generated alerts for real opportunities
- ✅ Grok analysis was relevant and accurate
- ✅ Claude recommendations were reasonable
- ✅ No false positives (bad opportunities flagged as good)
- ✅ Telegram alerts formatted correctly

After 1 week of trading (once enabled):
- ✅ Trades executed successfully
- ✅ Positions tracked accurately
- ✅ P&L calculated correctly
- ✅ No unexpected errors or losses
- ✅ Positive ROI (even if small)

---

**Questions?** Ask RocketMan: "Explain Polymarket arbitrage" or "How does the trading bot work?"
