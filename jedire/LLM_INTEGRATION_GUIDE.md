# LLM Integration Guide

## Overview

JediRe now has secure, production-ready integration with Large Language Models (LLMs) for AI-powered property and market analysis. The backend safely handles all API calls, keeping your API keys private.

## 🔐 Security Features

### ✅ What We Did Right

1. **API Keys Never Touch Frontend**
   - Keys stored only in backend environment variables
   - Frontend calls backend endpoints, not external APIs
   - Zero risk of key exposure in browser

2. **Rate Limiting**
   - 20 requests per hour per user (configurable)
   - Prevents API cost overruns
   - In-memory tracking (upgrade to Redis for production)

3. **Authentication Required**
   - All LLM endpoints require valid JWT
   - User attribution for all requests
   - Audit trail via `llm_usage` table

4. **Input Validation**
   - Prompt length limits (10,000 chars)
   - Type checking on all inputs
   - SQL injection protection via parameterized queries

5. **Error Handling**
   - API errors caught and logged
   - User-friendly error messages
   - No sensitive data leaked in errors

## 🎯 Supported Providers

Choose **ONE** of these providers:

### Option 1: Anthropic Claude (Recommended)
**Best for:** Property analysis, market insights, professional writing

```bash
CLAUDE_API_KEY=sk-ant-api03-...
CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

- Get key: https://console.anthropic.com
- $4/million input tokens, $20/million output
- Fast, high-quality analysis
- Free tier: $5 credit (good for testing)

### Option 2: OpenAI GPT-4
**Best for:** General-purpose, well-known API

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

- Get key: https://platform.openai.com
- Pricing varies by model
- Mature API, lots of documentation

### Option 3: OpenRouter
**Best for:** Access to 100+ models, price shopping

```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
APP_URL=https://yourdomain.com
```

- Get key: https://openrouter.ai
- Gateway to multiple providers
- Pay only for what you use
- Can switch models without code changes

## 🚀 Setup Instructions

### 1. Choose Your Provider

Pick one of the providers above and get an API key.

### 2. Set Environment Variables

**For Replit:**
1. Go to "Secrets" (lock icon in sidebar)
2. Add your chosen variables:
   - `CLAUDE_API_KEY` + `CLAUDE_MODEL`, OR
   - `OPENAI_API_KEY` + `OPENAI_MODEL`, OR
   - `OPENROUTER_API_KEY` + `OPENROUTER_MODEL`

**For Local Development:**
1. Copy `.env.example` to `.env`
2. Uncomment your chosen provider section
3. Add your API key

```bash
# Example for Claude
CLAUDE_API_KEY=sk-ant-api03-your-key-here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

### 3. Run Migration

Apply the database schema for LLM features:

```bash
psql $DATABASE_URL -f migrations/011_llm_integration.sql
```

Or run all migrations:
```bash
./migrations/run_all_migrations.sh
```

### 4. Restart Backend

**Replit:** Click "Stop" then "Run"

**Local:**
```bash
cd backend
npm run dev
```

### 5. Verify Setup

Check LLM status:
```bash
curl -H "Authorization: Bearer YOUR_JWT" \
  http://localhost:4000/api/v1/llm/status
```

Should return:
```json
{
  "available": true,
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "message": "LLM service is available"
}
```

## 📡 API Endpoints

All endpoints require authentication via JWT token.

### Check LLM Status

```http
GET /api/v1/llm/status
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "available": true,
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "message": "LLM service is available"
}
```

### General Completion

Send any prompt to the LLM:

```http
POST /api/v1/llm/complete
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "prompt": "What are the key factors in multifamily investment?",
  "maxTokens": 1000,
  "temperature": 0.7
}
```

**Response:**
```json
{
  "text": "When evaluating multifamily investments, consider...",
  "usage": {
    "promptTokens": 45,
    "completionTokens": 234,
    "totalTokens": 279
  }
}
```

### Analyze Property

Get AI-powered insights for a specific property:

```http
POST /api/v1/llm/analyze-property
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "propertyId": "uuid-here"
}
```

**Response:**
```json
{
  "propertyId": "uuid-here",
  "analysis": "This property shows strong development potential...",
  "timestamp": "2024-01-31T20:00:00Z"
}
```

**Features:**
- Fetches property data from database
- Includes zoning info automatically
- Stores analysis for future reference
- No duplicate analyses (cached by property + type)

### Analyze Market

Get market-level insights for a city:

```http
POST /api/v1/llm/analyze-market
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "city": "Austin",
  "state": "TX"
}
```

**Response:**
```json
{
  "market": { "city": "Austin", "state": "TX" },
  "data": {
    "propertyCount": 1234,
    "avgLotSize": 8500,
    "propertyTypes": {
      "multifamily": 450,
      "commercial": 234,
      "residential": 550
    }
  },
  "analysis": "Austin's market shows strong growth...",
  "timestamp": "2024-01-31T20:00:00Z"
}
```

### Get Analysis History

Retrieve your past analyses:

```http
GET /api/v1/llm/analysis-history?limit=10&offset=0
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "analyses": [
    {
      "id": "uuid",
      "property_id": "uuid",
      "address_line1": "123 Main St",
      "city": "Austin",
      "state_code": "TX",
      "analysis_type": "ai_insights",
      "content": "Analysis text...",
      "analyzed_at": "2024-01-31T20:00:00Z"
    }
  ],
  "count": 1,
  "limit": 10,
  "offset": 0
}
```

## 🎨 Frontend Integration

### JavaScript/React Example

```javascript
// Check if LLM is available
async function checkLLMStatus() {
  const response = await fetch('/api/v1/llm/status', {
    headers: {
      'Authorization': `Bearer ${getJWTToken()}`
    }
  });
  const data = await response.json();
  
  if (data.available) {
    console.log(`✅ LLM ready: ${data.provider} ${data.model}`);
  } else {
    console.log('❌ LLM not configured');
  }
}

// Analyze a property
async function analyzeProperty(propertyId) {
  const response = await fetch('/api/v1/llm/analyze-property', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getJWTToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ propertyId })
  });
  
  const data = await response.json();
  console.log('Analysis:', data.analysis);
}

// General completion
async function askQuestion(prompt) {
  const response = await fetch('/api/v1/llm/complete', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getJWTToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      maxTokens: 1000,
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return data.text;
}
```

### TypeScript Example

```typescript
import axios from 'axios';

interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class LLMClient {
  private baseURL = '/api/v1/llm';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async complete(prompt: string, options?: {
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse> {
    const { data } = await axios.post(
      `${this.baseURL}/complete`,
      {
        prompt,
        ...options
      },
      { headers: this.headers }
    );
    return data;
  }

  async analyzeProperty(propertyId: string): Promise<{
    propertyId: string;
    analysis: string;
    timestamp: string;
  }> {
    const { data } = await axios.post(
      `${this.baseURL}/analyze-property`,
      { propertyId },
      { headers: this.headers }
    );
    return data;
  }

  async analyzeMarket(city: string, state: string): Promise<any> {
    const { data } = await axios.post(
      `${this.baseURL}/analyze-market`,
      { city, state },
      { headers: this.headers }
    );
    return data;
  }
}

// Usage
const llm = new LLMClient(jwtToken);
const response = await llm.complete('Analyze this market...');
console.log(response.text);
```

## 💰 Cost Management

### Rate Limits

Default: **20 requests/hour/user**

Adjust in `backend/src/api/rest/llm.routes.ts`:
```typescript
const RATE_LIMIT_REQUESTS = 20; // Change this
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
```

### Token Limits

Default max tokens per request:
- Property analysis: **500 tokens** (~$0.01 per analysis)
- Market analysis: **500 tokens** (~$0.01 per analysis)
- General completion: **1000 tokens** (user-configurable)

Adjust in the service or route handlers.

### Usage Tracking

All LLM requests are logged to `llm_usage` table:

```sql
SELECT 
  user_id,
  provider,
  model,
  SUM(total_tokens) as total_tokens,
  COUNT(*) as request_count,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '1 day'
GROUP BY user_id, provider, model;
```

### Cost Estimation

**Claude 3.5 Sonnet:**
- Input: $4/million tokens = $0.004/1K tokens
- Output: $20/million tokens = $0.02/1K tokens

**Example costs:**
- Property analysis (~500 tokens total): $0.01
- 100 analyses/day: $1.00/day = $30/month
- 1000 analyses/day: $10/day = $300/month

## 🛠️ Customization

### Add New Analysis Types

1. Create function in `backend/src/services/llm.service.ts`:

```typescript
export async function analyzeZoningCompliance(property: any): Promise<string> {
  const prompt = `Analyze zoning compliance for this property...`;
  const response = await generateCompletion({ prompt });
  return response.text;
}
```

2. Add route in `backend/src/api/rest/llm.routes.ts`:

```typescript
router.post('/analyze-zoning', requireAuth, async (req, res, next) => {
  // Implementation
});
```

### Change Models

Just update environment variable:

```bash
# Switch from Sonnet to Haiku (faster, cheaper)
CLAUDE_MODEL=claude-3-haiku-20240307

# Or switch provider entirely
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

No code changes needed!

### Adjust Prompt Templates

Edit prompts in `backend/src/services/llm.service.ts`:

```typescript
export async function analyzeProperty(property: any): Promise<string> {
  const prompt = `
    You are a real estate investment analyst.
    
    Property Details:
    - Address: ${property.address_line1}
    - Type: ${property.property_type}
    - Zoning: ${property.zoning_code}
    
    Provide concise investment analysis focusing on:
    1. Development potential
    2. Market fit
    3. Key risks
    4. ROI estimate
    
    Keep under 250 words.
  `;
  
  // ...
}
```

## 🐛 Troubleshooting

### "LLM service not configured"

**Solution:** Add API key to environment variables and restart backend.

```bash
# Check if key is set
echo $CLAUDE_API_KEY

# Set temporarily (for testing)
export CLAUDE_API_KEY=sk-ant-api03-...

# Permanent: add to .env or Replit Secrets
```

### "Rate limit exceeded"

**Solution:** Wait for rate limit window to reset (1 hour) or increase limit.

```typescript
// In llm.routes.ts
const RATE_LIMIT_REQUESTS = 50; // Increase this
```

### "API error: 401 Unauthorized"

**Solution:** Check API key is correct and valid.

```bash
# Test API key directly
curl -H "x-api-key: $CLAUDE_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  https://api.anthropic.com/v1/messages \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### "Timeout errors"

**Solution:** Increase timeout or reduce token limits.

```typescript
// In llm.service.ts
timeout: 120000, // Increase to 2 minutes
```

### Rate limiting not working correctly

**Solution:** Upgrade to Redis-based rate limiting:

```typescript
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(userId: string): Promise<void> {
  const key = `llm:rate:${userId}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour
  }
  
  if (count > RATE_LIMIT_REQUESTS) {
    throw new AppError(429, 'Rate limit exceeded');
  }
}
```

## 📊 Database Schema

### Tables Created

**`property_analyses`**
- Stores AI-generated property insights
- One analysis per property per type
- Includes metadata (model, tokens, etc.)

**`market_analyses`**
- Stores market-level insights
- Grouped by city/state
- Includes market metrics used

**`llm_usage`**
- Tracks all LLM API calls
- Cost monitoring and analytics
- Success/failure tracking

### Views Created

**`properties_with_analyses`**
- Properties joined with their latest analyses

**`llm_usage_by_user`**
- Aggregated usage statistics per user per day

## 🔒 Privacy & Compliance

### Data Handling

1. **Property Data:**
   - Only sent to LLM when user requests analysis
   - Not cached by LLM provider (per their policies)
   - Stored analysis in our database for reuse

2. **User Data:**
   - No PII sent to LLM providers
   - User ID tracked for rate limiting only
   - Analysis attributed to users for access control

3. **API Keys:**
   - Never logged or exposed
   - Stored only in environment variables
   - Not accessible to frontend

### GDPR / Privacy

- Users can delete their analyses (CASCADE delete)
- LLM usage logs can be purged periodically
- No data shared with third parties (beyond LLM providers)

## 📝 Best Practices

1. **Always check availability before calling:**
   ```javascript
   const status = await fetch('/api/v1/llm/status');
   if (status.available) {
     // Proceed
   }
   ```

2. **Cache analyses:**
   - Check if analysis exists before requesting new one
   - Reuse existing analyses when possible

3. **Show loading states:**
   - LLM calls take 2-10 seconds
   - Always show spinner/progress indicator

4. **Handle errors gracefully:**
   - Rate limits, timeouts, API errors
   - Fallback to basic data if LLM fails

5. **Monitor costs:**
   - Query `llm_usage` table regularly
   - Set alerts for unusual usage patterns

## 🚀 Next Steps

1. **Add streaming support:**
   - Real-time token-by-token responses
   - Better UX for long analyses

2. **Implement caching:**
   - Redis cache for identical prompts
   - Reduce duplicate API calls

3. **Add more analysis types:**
   - Zoning compliance analysis
   - ROI calculations
   - Risk assessments
   - Comparable property analysis

4. **Build UI components:**
   - Property analysis card
   - Market insights dashboard
   - Analysis history viewer

5. **Advanced features:**
   - Multi-property batch analysis
   - Custom prompt templates
   - Analysis scheduling (daily/weekly reports)

## 📚 Further Reading

- [Anthropic Claude API Docs](https://docs.anthropic.com/claude/reference/getting-started)
- [OpenAI API Docs](https://platform.openai.com/docs/api-reference)
- [OpenRouter Docs](https://openrouter.ai/docs)
- [LLM Best Practices](https://www.anthropic.com/index/building-effective-agents)

## 🤝 Support

Questions? Issues?

1. Check this guide first
2. Review error logs: `backend/logs/jedire.log`
3. Test API keys independently
4. Check database migration ran successfully

---

**Built with security and privacy in mind. Your API keys are safe. 🔐**
