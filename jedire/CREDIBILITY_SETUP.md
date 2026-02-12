# Source Credibility Learning System - Setup Guide

## Quick Start

### 1. Run Database Migration

```bash
cd backend
npx knex migrate:latest --env development
```

This will create the new tables:
- `corroboration_matches`
- `credibility_history`
- `specialty_scores`
- `competitive_intelligence_value`
- `predictive_credibility`

### 2. Start Backend Scheduler

Add to your `backend/src/server.ts` or main entry point:

```typescript
import { startSourceCredibilityScheduler } from './services/source-credibility-scheduler';

// After database connection is established
startSourceCredibilityScheduler();
```

### 3. Add Frontend Routes

Add routes to your React Router configuration:

```typescript
import { 
  NetworkIntelligenceDashboard,
  SourceCredibilityCard,
  CorroborationFeed 
} from './components/credibility';

// In your routes
<Route path="/intelligence" element={<NetworkIntelligenceDashboard />} />
```

### 4. Integrate with Email View

In your email detail view component:

```tsx
import { SourceCredibilityCard } from './components/credibility';

function EmailDetailView({ email, newsEvent }) {
  return (
    <div>
      {/* Existing email content */}
      
      {newsEvent && newsEvent.source_type === 'email_private' && (
        <SourceCredibilityCard 
          contactEmail={email.from}
          eventId={newsEvent.id}
        />
      )}
    </div>
  );
}
```

### 5. Add Dashboard Widget

In your main dashboard:

```tsx
import { CorroborationFeed } from './components/credibility';

function Dashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Other widgets */}
      
      <CorroborationFeed limit={5} />
    </div>
  );
}
```

## Manual Testing

### Test Corroboration Detection

```bash
curl -X POST http://localhost:3000/api/v1/credibility/detect-corroborations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Intelligence Rankings

```bash
curl -X GET http://localhost:3000/api/v1/credibility/network-value \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Source Profile

```bash
curl -X GET "http://localhost:3000/api/v1/credibility/source/example@email.com" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Background Job

The system automatically runs corroboration detection daily at 2:00 AM.

To manually trigger:

```typescript
import { runDetectionNow } from './services/source-credibility-scheduler';

// In your admin panel or console
await runDetectionNow();
```

## Verification Checklist

- [ ] Database migration successful
- [ ] API endpoints accessible
- [ ] Frontend components render without errors
- [ ] Scheduler logs show daily job execution
- [ ] Source credibility cards appear in email view
- [ ] Network intelligence dashboard loads
- [ ] Corroboration feed displays recent matches

## Next Steps

1. **Seed test data:** Create sample private and public events to test matching
2. **Configure notifications:** Set up alerts when corroborations are detected
3. **Customize thresholds:** Adjust match score threshold (default 0.75) if needed
4. **Add analytics:** Track system performance and prediction accuracy

## Troubleshooting

**No corroborations detected?**
- Check that you have both private (`email_private`) and public events in the database
- Verify events have proper geocoding (`location_geocoded` field)
- Try lowering the match threshold temporarily to debug

**Predictions not showing?**
- Ensure source has at least 3 historical signals
- Check that `predictive_credibility` table is being populated
- Verify event has a valid contact email source

**Scheduler not running?**
- Check server logs for scheduler initialization
- Verify node-schedule package is installed
- Ensure server stays running (not serverless)

## Documentation

Full documentation: `SOURCE_CREDIBILITY_LEARNING.md`

API Reference: See inline JSDoc comments in `credibility.routes.ts`

Database Schema: See comments in `032_source_credibility.sql`
