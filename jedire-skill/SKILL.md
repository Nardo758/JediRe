# JediRe Skill

Direct integration with the JediRe real estate intelligence platform.

## Purpose

This skill provides seamless access to JediRe's deal analysis, property data, market rankings, and error monitoring capabilities directly within Clawdbot conversations.

## Commands

### `/deal <id>`
Fetch and display comprehensive deal information.

```
/deal DEAL-12345
```

Returns: Deal summary, financials, IRR projections, risk factors, and recommendations.

### `/property <address>`
Search for properties by address and display detailed information.

```
/property "123 Main St, Austin TX"
```

Returns: Property details, market data, valuation estimates, and comparable properties.

### `/analyze <dealId> <type>`
Run specific analysis on a deal.

```
/analyze DEAL-12345 cashflow
/analyze DEAL-12345 sensitivity
/analyze DEAL-12345 market
```

Analysis types:
- `cashflow` - Detailed cash flow projections
- `sensitivity` - Sensitivity analysis on key variables
- `market` - Market comparison and positioning
- `risk` - Risk assessment and mitigation strategies

### `/rankings <market>`
Display market rankings and performance metrics.

```
/rankings "Austin, TX"
/rankings national
```

Returns: Top performing markets, cap rates, appreciation trends, and investment opportunities.

## Auto-Context Loading

The skill automatically detects deal IDs mentioned in conversation (format: `DEAL-XXXXX` or `#XXXXX`) and loads relevant context without explicit commands.

**Example:**
```
User: "What do you think about DEAL-45678?"
Agent: [Automatically loads deal data and provides informed analysis]
```

This enables natural conversation about deals without repeatedly invoking commands.

## Error Monitoring

The skill receives webhook notifications when JediRe detects platform errors or data anomalies:

- API failures
- Data pipeline issues
- Analysis computation errors
- Data quality warnings

When errors occur, the agent can:
1. Notify you proactively (configurable)
2. Provide error context and impact assessment
3. Suggest remediation steps
4. Track error resolution

## Code Quality Integration

The skill can review deal analysis code and provide recommendations:

- Identify optimization opportunities
- Suggest best practices
- Flag potential issues
- Recommend additional analyses

## Configuration

Configure behavior in `config.json`:
- API credentials (loaded from environment variables)
- Webhook endpoints for error monitoring
- Auto-context detection (enable/disable)
- Monitoring schedules
- Notification preferences

## Environment Variables

Required:
- `JEDIRE_API_KEY` - Your JediRe API key
- `JEDIRE_API_URL` - JediRe API endpoint (default: https://api.jedire.com)

Optional:
- `JEDIRE_WEBHOOK_SECRET` - Secret for webhook verification
- `JEDIRE_AUTO_CONTEXT` - Enable auto-context loading (default: true)

## Usage Examples

### Deal Analysis Workflow
```
User: /deal DEAL-12345
Agent: [Shows deal summary]
User: What's the biggest risk?
Agent: [Auto-loaded context enables informed discussion]
User: /analyze DEAL-12345 sensitivity
Agent: [Shows sensitivity analysis]
```

### Property Research
```
User: /property "456 Oak Ave, Denver CO"
Agent: [Shows property data]
User: How does this compare to the market?
Agent: [Provides market context and comparables]
```

### Market Research
```
User: /rankings "Phoenix, AZ"
Agent: [Shows market rankings]
User: What about cap rates?
Agent: [Provides cap rate analysis with trends]
```

## Helper Functions

The skill provides utility functions (in `helpers.js`):

- `formatDeal(deal)` - Format deal data for readable output
- `formatProperty(property)` - Format property data
- `detectDealMention(text)` - Extract deal IDs from text
- `analyzeError(error)` - Parse and explain error objects

These are available for custom extensions and scripting.

## CLI Tool

A standalone CLI tool (`scripts/jedire-cli.js`) is included for command-line access:

```bash
# Fetch deal
node scripts/jedire-cli.js deal DEAL-12345

# Search property
node scripts/jedire-cli.js property "123 Main St"

# Run analysis
node scripts/jedire-cli.js analyze DEAL-12345 cashflow

# Check recent errors
node scripts/jedire-cli.js errors
```

## Dependencies

- `jedire-client` - Official JediRe Node.js client library

Install with: `npm install jedire-client`

## Security

- API keys are loaded from environment variables, never hardcoded
- Webhook signatures are verified using HMAC
- Sensitive data is never logged or exposed
- Rate limiting respects JediRe API quotas

## Support

For issues or questions:
- JediRe API Docs: https://docs.jedire.com
- Support: support@jedire.com
