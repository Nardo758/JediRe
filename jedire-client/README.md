# JediRe API Client

TypeScript client library for the JediRe Real Estate Intelligence API.

## Installation

```bash
npm install @clawdbot/jedire-client
```

Or install locally:

```bash
cd /home/leon/clawd/jedire-client
npm install
npm run build
npm link
```

Then in your project:

```bash
npm link @clawdbot/jedire-client
```

## Configuration

Create a `.env` file in your project:

```env
JEDIRE_API_URL=http://localhost:5000
JEDIRE_API_TOKEN=your-jwt-token-here

# Or use email/password authentication
JEDIRE_API_EMAIL=your-email@example.com
JEDIRE_API_PASSWORD=your-password
```

## Usage

### Basic Setup

```typescript
import { JediReClient } from '@clawdbot/jedire-client';

// Initialize with environment variables
const client = new JediReClient();

// Or configure manually
const client = new JediReClient({
  baseUrl: 'http://localhost:5000',
  token: 'your-jwt-token',
  logRequests: true
});
```

### Authentication

```typescript
// Authenticate with email/password
const authResponse = await client.authenticate('user@example.com', 'password');
console.log('Token:', authResponse.access_token);

// Or set token manually
client.setToken('your-jwt-token');
```

### Deals

```typescript
// Get a specific deal
const deal = await client.getDeal('deal-123');
console.log('Deal:', deal);

// List deals with filters
const deals = await client.getDeals({
  limit: 10,
  offset: 0,
  status: 'active'
});
console.log('Deals:', deals.data);

// Create a new deal
const newDeal = await client.createDeal({
  name: 'Main Street Property',
  address: '123 Main St',
  city: 'Denver',
  state: 'CO',
  purchase_price: 500000
});

// Update a deal
const updatedDeal = await client.updateDeal('deal-123', {
  status: 'under_contract'
});

// Delete a deal
await client.deleteDeal('deal-123');
```

### Properties

```typescript
// Get a specific property
const property = await client.getProperty('prop-456');

// List properties
const properties = await client.getProperties({
  limit: 20,
  city: 'Denver',
  state: 'CO'
});

// Create a property
const newProperty = await client.createProperty({
  address: '456 Oak Ave',
  city: 'Denver',
  state: 'CO',
  zip: '80202',
  property_type: 'single_family',
  bedrooms: 3,
  bathrooms: 2
});
```

### Market Intelligence

```typescript
// Get market intelligence data
const intel = await client.getMarketIntelligence('market-789');
console.log('Market Intelligence:', intel);

// Get market details
const market = await client.getMarket('market-789');

// List markets
const markets = await client.getMarkets({ limit: 50 });
```

### Rankings

```typescript
// Get PCS rankings for a market
const rankings = await client.getRankings('market-789', {
  limit: 10,
  category: 'investment_potential'
});

// Get top rankings across all markets
const topRankings = await client.getTopRankings({ limit: 100 });
```

### Analysis

```typescript
// Run analysis on a deal
const analysis = await client.runAnalysis('deal-123', 'cash_flow', {
  holdingPeriod: 5,
  appreciationRate: 3
});

// Get analysis results
const result = await client.getAnalysis('analysis-abc');

// List analyses for a deal
const analyses = await client.getDealAnalyses('deal-123');
```

### Error Tracking

```typescript
// Get recent errors
const errors = await client.getErrors(50);
console.log('Recent Errors:', errors);

// Get specific error
const error = await client.getError('error-xyz');
```

### Health Check

```typescript
// Check API health
const health = await client.healthCheck();
console.log('Health:', health);

// Get API status
const status = await client.getStatus();
console.log('Status:', status);
```

## Features

- ✅ **TypeScript Support** - Full type definitions for all API responses
- ✅ **JWT Authentication** - Automatic token management and refresh
- ✅ **Retry Logic** - Automatic retry on network errors and 5xx responses
- ✅ **Rate Limiting** - Built-in support for API rate limits
- ✅ **Request Logging** - Optional request/response logging
- ✅ **Error Handling** - Normalized error responses
- ✅ **Environment Variables** - Easy configuration via `.env`

## Configuration Options

```typescript
interface JediReConfig {
  baseUrl?: string;           // API base URL (default: http://localhost:5000)
  token?: string;             // JWT token
  email?: string;             // Email for authentication
  password?: string;          // Password for authentication
  requestTimeout?: number;    // Request timeout in ms (default: 30000)
  maxRetries?: number;        // Max retry attempts (default: 3)
  retryDelay?: number;        // Delay between retries in ms (default: 1000)
  logRequests?: boolean;      // Enable request logging (default: false)
}
```

## Error Handling

All methods throw normalized errors:

```typescript
try {
  const deal = await client.getDeal('invalid-id');
} catch (error) {
  console.error('Error:', error.message);
  // Example: "API Error (404): Deal not found"
}
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch for changes
npm run watch
```

## License

MIT
