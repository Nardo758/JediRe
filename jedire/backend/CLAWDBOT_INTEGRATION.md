# Clawdbot Webhook Integration

Complete webhook system for bidirectional communication between JediRe and Clawdbot.

## Overview

JediRe now sends real-time notifications to Clawdbot and receives commands back via webhooks.

### What Gets Sent to Clawdbot

1. **Error Notifications** - Server errors (5xx), unhandled exceptions
2. **Deal Creation** - New deals created by users
3. **Analysis Completion** - Market analysis results
4. **Custom Events** - Any custom event you want to track

### What Clawdbot Can Send to JediRe

1. **Commands** - Execute actions (get deals, run analysis, etc.)
2. **Queries** - Request information (status, counts, etc.)

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Clawdbot Integration
CLAWDBOT_WEBHOOK_URL=http://localhost:8080/webhook/jedire
CLAWDBOT_WEBHOOK_SECRET=your-webhook-secret-change-this
CLAWDBOT_AUTH_TOKEN=your-auth-token-change-this
```

**Important:**
- `CLAWDBOT_WEBHOOK_URL` - Where JediRe sends notifications (Clawdbot Gateway endpoint)
- `CLAWDBOT_WEBHOOK_SECRET` - Shared secret for HMAC signature verification
- `CLAWDBOT_AUTH_TOKEN` - Alternative auth method (bearer token)

### Security

#### Outgoing Webhooks (JediRe → Clawdbot)
- **Signature**: HMAC-SHA256 signature in `X-Webhook-Signature` header
- **Rate Limiting**: Max 10 notifications per event type per minute
- **Production Only**: Webhooks disabled in development unless explicitly configured

#### Incoming Webhooks (Clawdbot → JediRe)
- **Signature Validation**: Verifies HMAC-SHA256 signature
- **Token Auth**: Alternative bearer token authentication
- **Request Validation**: Validates payload structure

## Architecture

### Files Created

```
backend/
├── src/
│   ├── webhooks/
│   │   └── clawdbot.ts              # Webhook sender service
│   ├── api/rest/
│   │   └── clawdbot-webhooks.routes.ts  # Webhook receiver routes
│   ├── middleware/
│   │   └── errorWebhook.ts          # Global error interceptor
│   └── ...
└── CLAWDBOT_INTEGRATION.md           # This file
```

### Integration Points

1. **Error Handler** (`middleware/errorHandler.ts`)
   - Catches all errors
   - Sends 5xx errors to Clawdbot
   
2. **Error Webhook Middleware** (`middleware/errorWebhook.ts`)
   - Global error interceptor
   - Handles unhandled rejections
   - Handles uncaught exceptions

3. **Deal Service** (`deals/deals.service.ts`)
   - Sends notification on deal creation

4. **Analysis Service** (`services/dealAnalysis.ts`)
   - Sends notification on analysis completion

## Usage

### Sending Notifications from JediRe

```typescript
import { clawdbotWebhook } from '../webhooks/clawdbot';

// Error notification
await clawdbotWebhook.sendErrorNotification(error, {
  url: '/api/v1/deals',
  method: 'POST',
  userId: 'user123',
});

// Deal created
await clawdbotWebhook.sendDealCreated({
  id: 'deal-123',
  name: 'Downtown Multifamily',
  address: '123 Main St',
  propertyType: 'multifamily',
  status: 'active',
  createdBy: 'user-123',
});

// Analysis complete
await clawdbotWebhook.sendAnalysisComplete('deal-123', {
  jediScore: 85,
  verdict: 'STRONG_OPPORTUNITY',
  // ... analysis results
});

// Custom event
await clawdbotWebhook.sendEventNotification('custom.event', {
  foo: 'bar',
}, {
  userId: 'user-123',
});
```

### Receiving Commands from Clawdbot

Clawdbot can send commands to:

**POST /api/v1/clawdbot/command**

Available commands:
- `health` - Health check
- `get_deals` - Get deals list
- `get_deal` - Get specific deal (requires `dealId` param)
- `run_analysis` - Trigger analysis (requires `dealId` param)

Example request:
```json
{
  "command": "get_deal",
  "params": {
    "dealId": "deal-123"
  },
  "timestamp": "2024-03-03T10:00:00Z",
  "requestId": "req-abc-123"
}
```

**POST /api/v1/clawdbot/query**

Available queries:
- `status` - System status
- `deals_count` - Count of deals
- `recent_errors` - Recent error log

### Testing

#### Test Outgoing Webhook

```bash
# Set webhook URL to a test endpoint
export CLAWDBOT_WEBHOOK_URL=https://webhook.site/your-unique-url

# Trigger an error or create a deal
# Watch the webhook.site dashboard for incoming notifications
```

#### Test Incoming Webhook

```bash
# Health check (no auth required)
curl http://localhost:4000/api/v1/clawdbot/health

# Send command with signature
curl -X POST http://localhost:4000/api/v1/clawdbot/command \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: <calculated-signature>" \
  -d '{
    "command": "health",
    "timestamp": "2024-03-03T10:00:00Z",
    "requestId": "test-123"
  }'

# Or with auth token
curl -X POST http://localhost:4000/api/v1/clawdbot/command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "command": "health",
    "timestamp": "2024-03-03T10:00:00Z",
    "requestId": "test-123"
  }'
```

## Webhook Payload Format

### Outgoing (JediRe → Clawdbot)

```typescript
{
  event: string;           // Event type (error, deal.created, etc.)
  timestamp: string;       // ISO 8601 timestamp
  data: any;              // Event-specific data
  context?: {             // Optional context
    environment: string;  // production, development, etc.
    userId?: string;
    dealId?: string;
    [key: string]: any;
  }
}
```

### Incoming (Clawdbot → JediRe)

**Command:**
```typescript
{
  command: string;        // Command name
  params?: any;          // Command parameters
  timestamp: string;     // ISO 8601 timestamp
  requestId?: string;    // Optional request ID for tracking
}
```

**Query:**
```typescript
{
  query: string;         // Query name
  params?: any;          // Query parameters
  timestamp: string;     // ISO 8601 timestamp
  requestId?: string;    // Optional request ID for tracking
}
```

## Rate Limiting

- **10 notifications per event type per minute**
- Prevents webhook spam
- Rate limit state is in-memory (resets on restart)

## Error Handling

- Webhooks fail silently (logged but don't throw)
- 5-second timeout for outgoing webhooks
- Errors are logged but don't affect main application flow
- Unhandled rejections/exceptions still trigger webhooks before exit

## Extending

### Add New Outgoing Event

1. Add method to `clawdbotWebhook` class:
```typescript
async sendMyCustomEvent(data: any): Promise<void> {
  const payload: WebhookPayload = {
    event: 'custom.my_event',
    timestamp: new Date().toISOString(),
    data,
    context: { environment: process.env.NODE_ENV },
  };
  await this.send(payload);
}
```

2. Call it where needed:
```typescript
await clawdbotWebhook.sendMyCustomEvent({ foo: 'bar' });
```

### Add New Incoming Command

Edit `clawdbot-webhooks.routes.ts`:

```typescript
case 'my_command':
  // Implement your command logic
  result = {
    message: 'Command executed',
    data: { ... }
  };
  break;
```

## Production Checklist

- [ ] Set `CLAWDBOT_WEBHOOK_URL` to actual Clawdbot Gateway endpoint
- [ ] Generate secure `CLAWDBOT_WEBHOOK_SECRET` (32+ random characters)
- [ ] Generate secure `CLAWDBOT_AUTH_TOKEN` (32+ random characters)
- [ ] Test error notifications
- [ ] Test deal creation notifications
- [ ] Test analysis completion notifications
- [ ] Test incoming command authentication
- [ ] Monitor webhook delivery success rate
- [ ] Set up alerting for webhook failures

## Troubleshooting

### Webhooks Not Sending

1. Check `CLAWDBOT_WEBHOOK_URL` is set
2. Check logs for webhook errors
3. Verify Clawdbot Gateway is running and accessible
4. Test with webhook.site to isolate issues

### Invalid Signature Errors

1. Verify `CLAWDBOT_WEBHOOK_SECRET` matches on both sides
2. Check payload is not being modified in transit
3. Verify timestamp is recent (prevent replay attacks)

### Commands Failing

1. Check incoming webhook authentication
2. Verify command/query names are correct
3. Check required parameters are provided
4. Review server logs for detailed error messages

## Future Enhancements

- [ ] Webhook delivery retry logic with exponential backoff
- [ ] Webhook delivery queue (Redis-based)
- [ ] Webhook delivery history/audit log
- [ ] Webhook replay mechanism
- [ ] More granular event subscriptions
- [ ] Batch notification support
- [ ] Webhook delivery metrics/monitoring

---

**Questions?** Check the implementation files or contact the development team.
