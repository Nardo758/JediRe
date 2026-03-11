# JediRe Client Integration Guide

## Quick Start for Clawdbot

### 1. Install the Package

From your Clawdbot workspace:

```bash
cd /home/leon/clawd/jedire-client
npm install
npm run build
npm link
```

Then in your main Clawdbot project:

```bash
npm link @clawdbot/jedire-client
```

### 2. Basic Usage in Clawdbot

```typescript
import { JediReClient } from '@clawdbot/jedire-client';

// Initialize client
const jedire = new JediReClient({
  baseUrl: process.env.JEDIRE_API_URL || 'http://localhost:5000',
  token: process.env.JEDIRE_API_TOKEN,
  logRequests: true
});

// Or use email/password
const jedire = new JediReClient({
  baseUrl: 'http://localhost:5000',
  email: 'your-email@example.com',
  password: 'your-password'
});
```

### 3. Common Operations

#### Get Deal Information
```typescript
async function getDealInfo(dealId: string) {
  try {
    const deal = await jedire.getDeal(dealId);
    return `Deal: ${deal.name}\nAddress: ${deal.address}, ${deal.city}, ${deal.state}\nPrice: $${deal.purchase_price}`;
  } catch (error) {
    return `Error fetching deal: ${error.message}`;
  }
}
```

#### Search Properties
```typescript
async function searchProperties(city: string, state: string) {
  const results = await jedire.getProperties({
    city,
    state,
    limit: 20
  });
  
  return results.data.map(prop => 
    `${prop.address}, ${prop.city}, ${prop.state} - ${prop.bedrooms}bd/${prop.bathrooms}ba`
  ).join('\n');
}
```

#### Get Market Intelligence
```typescript
async function getMarketReport(marketId: string) {
  const intel = await jedire.getMarketIntelligence(marketId);
  const rankings = await jedire.getRankings(marketId, { limit: 10 });
  
  return {
    median_price: intel.median_price,
    trend: intel.price_trend,
    top_deals: rankings.data.slice(0, 5)
  };
}
```

#### Run Deal Analysis
```typescript
async function analyzeInvestment(dealId: string) {
  const analysis = await jedire.runAnalysis(dealId, 'cash_flow', {
    holdingPeriod: 5,
    appreciationRate: 3,
    expenseRatio: 0.35
  });
  
  // Poll for completion
  while (analysis.status === 'pending') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const updated = await jedire.getAnalysis(analysis.id);
    if (updated.status === 'completed') {
      return updated.results;
    }
  }
  
  return analysis.results;
}
```

### 4. Error Handling

```typescript
async function safeOperation(operation: () => Promise<any>) {
  try {
    return await operation();
  } catch (error: any) {
    if (error.message.includes('401')) {
      // Re-authenticate
      await jedire.authenticate(email, password);
      return await operation(); // Retry
    }
    throw error;
  }
}
```

### 5. Clawdbot Skill Integration

Create a new skill file: `skills/jedire/SKILL.md`

```markdown
# JediRe Integration

## Commands

- "get deal [id]" - Fetch deal details
- "search properties in [city], [state]" - Find properties
- "market report [marketId]" - Get market intelligence
- "analyze deal [id]" - Run investment analysis
- "top rankings [marketId]" - Get PCS rankings

## Usage

The JediRe client is available globally as `jedire`.
```

### 6. Environment Variables

Add to your `.env` file:

```env
JEDIRE_API_URL=http://localhost:5000
JEDIRE_API_TOKEN=your-jwt-token

# Or use email/password
JEDIRE_API_EMAIL=your-email@example.com
JEDIRE_API_PASSWORD=your-password
```

### 7. TypeScript Support

The client includes full TypeScript definitions:

```typescript
import { 
  JediReClient, 
  Deal, 
  Property, 
  MarketIntelligence,
  Ranking 
} from '@clawdbot/jedire-client';

async function processDeals(deals: Deal[]): Promise<string> {
  return deals
    .filter(deal => deal.status === 'active')
    .map(deal => `${deal.name}: $${deal.purchase_price}`)
    .join('\n');
}
```

### 8. Advanced Features

#### Retry Logic
The client automatically retries failed requests (5xx errors, network issues) up to 3 times with exponential backoff.

#### Token Management
JWT tokens are automatically managed and refreshed when needed.

#### Rate Limiting
The client respects API rate limits and handles 429 responses appropriately.

#### Request Logging
Enable detailed logging for debugging:

```typescript
const jedire = new JediReClient({
  logRequests: true
});
```

### 9. Testing

Test the connection:

```bash
cd /home/leon/clawd/jedire-client
npx ts-node example.ts
```

### 10. Production Considerations

- Store credentials securely (use environment variables)
- Implement proper error handling
- Monitor API usage and rate limits
- Cache frequently accessed data
- Use retry logic for transient failures

## API Coverage

✅ Deals (CRUD + List)
✅ Properties (CRUD + List)
✅ Markets (Get + List)
✅ Market Intelligence
✅ Rankings (PCS)
✅ Analysis (Run + Get + List)
✅ Error Tracking
✅ Health Check

## Support

For issues or questions:
- Check the README.md for examples
- Review the TypeScript types in src/types.ts
- Examine the client implementation in src/client.ts
