# JediRe Skill for Clawdbot

Complete integration with the JediRe real estate intelligence platform, enabling natural conversation about deals, properties, markets, and automated error monitoring.

## Features

- 🏢 **Deal Management** - Fetch, analyze, and discuss real estate deals
- 🏠 **Property Search** - Search properties by address with detailed data
- 📊 **Analysis Tools** - Cash flow, sensitivity, market, and risk analysis
- 🌆 **Market Rankings** - Performance metrics and investment opportunities
- 🤖 **Auto-Context** - Automatically loads deal data when mentioned in conversation
- ⚠️ **Error Monitoring** - Webhook-based error alerting and analysis
- 💻 **CLI Tool** - Command-line access to all features

## Installation

### 1. Move to Clawdbot Skills Directory

```bash
sudo cp -r jedire-skill /usr/lib/node_modules/clawdbot/skills/jedire
```

### 2. Install Dependencies

```bash
cd /usr/lib/node_modules/clawdbot/skills/jedire
npm install jedire-client
```

### 3. Set Environment Variables

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export JEDIRE_API_KEY="your_api_key_here"
export JEDIRE_API_URL="https://api.jedire.com"  # Optional, uses default if not set
export JEDIRE_WEBHOOK_SECRET="your_webhook_secret"  # Optional, for webhook verification
export JEDIRE_AUTO_CONTEXT="true"  # Optional, enable auto-context loading
```

Reload your shell:
```bash
source ~/.bashrc  # or ~/.zshrc
```

### 4. Verify Installation

Test the CLI tool:
```bash
node /usr/lib/node_modules/clawdbot/skills/jedire/scripts/jedire-cli.js
```

You should see the help menu with available commands.

### 5. Configure Clawdbot

Ensure Clawdbot recognizes the skill. The skill should be auto-detected, but you can verify with:

```bash
clawdbot skills list
```

## Usage

### In Conversation

#### Direct Commands

```
/deal DEAL-12345
/property "123 Main St, Austin TX"
/analyze DEAL-12345 cashflow
/rankings "Austin, TX"
```

#### Natural Conversation with Auto-Context

Simply mention a deal ID in your message:

```
User: "What do you think about DEAL-45678?"
Agent: [Automatically loads and displays deal data]

User: "The cap rate seems low, doesn't it?"
Agent: [Continues discussion with full deal context]

User: "Run a sensitivity analysis"
Agent: [Runs analysis using the previously loaded deal]
```

Auto-context works with these formats:
- `DEAL-12345`
- `#12345` (4-6 digits)

### Command Line

The CLI tool provides direct access outside of Clawdbot:

```bash
# Fetch a deal
node scripts/jedire-cli.js deal DEAL-12345

# Search for a property
node scripts/jedire-cli.js property "456 Oak Ave, Denver CO"

# Run analysis
node scripts/jedire-cli.js analyze DEAL-12345 sensitivity

# Check recent errors
node scripts/jedire-cli.js errors
```

### Analysis Types

Available analysis types for `/analyze` and CLI:

1. **cashflow** - 10-year cash flow projections with NOI and returns
2. **sensitivity** - Sensitivity analysis on key variables (rent, occupancy, cap rate)
3. **market** - Market comparison with trends and comparable deals
4. **risk** - Comprehensive risk assessment with mitigation strategies

## Configuration

Edit `config.json` to customize:

- **API settings** - Timeout, retries, base URL
- **Auto-context** - Enable/disable, cache duration, patterns
- **Monitoring** - Error checking schedule, notification preferences
- **Formatting** - Currency, date formats, number display

## Webhooks

If you want JediRe to send error notifications directly to Clawdbot:

1. Configure webhook endpoints in JediRe dashboard
2. Set endpoint to: `https://your-clawdbot-instance/webhooks/jedire/errors`
3. Set `JEDIRE_WEBHOOK_SECRET` environment variable
4. Errors will be automatically received and analyzed

## Error Monitoring

The skill monitors JediRe platform errors and can:

- Receive webhook notifications in real-time
- Fetch recent errors on demand with `/jedire errors` or CLI
- Analyze error impact and provide recommendations
- Track error trends over time

## Helper Functions

The `helpers.js` module provides utilities you can use in custom scripts:

```javascript
const { formatDeal, formatProperty, detectDealMention, analyzeError } = require('./helpers');

// Format deal data for display
const formatted = formatDeal(dealObject);

// Detect deal IDs in text
const dealIds = detectDealMention("Let's discuss DEAL-12345 and #67890");
// Returns: ["DEAL-12345", "DEAL-67890"]

// Analyze errors
const analysis = analyzeError(errorObject);
console.log(analysis.severity);       // critical, high, medium, low
console.log(analysis.recommendations); // Array of suggested actions
```

## Troubleshooting

### "JEDIRE_API_KEY environment variable not set"

Make sure you've exported the variable and restarted your terminal/Clawdbot:
```bash
export JEDIRE_API_KEY="your_key"
```

### "API timeout" errors

Increase the timeout in `config.json`:
```json
{
  "api": {
    "timeout": 60000
  }
}
```

### Auto-context not working

1. Check that `JEDIRE_AUTO_CONTEXT` is set to `true`
2. Verify the deal ID format matches patterns in `config.json`
3. Check Clawdbot logs for errors

### Webhook verification failing

Ensure `JEDIRE_WEBHOOK_SECRET` matches the secret configured in JediRe dashboard.

## Development

### Testing the CLI

```bash
# Set test API key
export JEDIRE_API_KEY="test_key"

# Run commands
node scripts/jedire-cli.js deal TEST-123
```

### Adding Custom Commands

1. Add command definition to `config.json`
2. Create handler function in skill module
3. Update `SKILL.md` documentation

### Debug Mode

Enable detailed error output:
```bash
export DEBUG=true
node scripts/jedire-cli.js <command>
```

## API Reference

The skill uses the `jedire-client` package. For full API documentation:
- https://docs.jedire.com
- https://github.com/jedire/jedire-client-node

## Security

- API keys are loaded from environment variables only
- Webhook signatures are verified using HMAC-SHA256
- Sensitive data is never logged or cached
- Rate limiting respects JediRe API quotas

## Support

For issues or questions:
- JediRe API: https://docs.jedire.com
- Email: support@jedire.com
- GitHub Issues: [your-repo]/clawdbot-skills/issues

## License

This skill is part of Clawdbot and follows the same license terms.
