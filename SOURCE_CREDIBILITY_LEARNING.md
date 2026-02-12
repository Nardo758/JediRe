
# Source Credibility Learning System

**JEDI RE Phase 3, Component 4**

## Overview

The Source Credibility Learning System tracks which private intelligence (emails) gets confirmed by public sources, scoring source credibility over time. This creates a reputation system for intelligence sources and enables predictive credibility for new signals.

## Architecture

### System Flow

```
1. Email arrives with private intel
   ↓
2. Extract news event (email_private source)
   ↓
3. Assign initial credibility (50% - unconfirmed)
   ↓
4. Track contact in news_contact_credibility
   ↓
5. Background job runs daily
   ↓
6. Compare private events to public news (last 90 days)
   ↓
7. Calculate similarity match score
   ↓
8. If match score > 0.75: CORROBORATION CONFIRMED
   ↓
9. Record corroboration_match
   ↓
10. Update source credibility scores
    ↓
11. Calculate intelligence value
    ↓
12. Generate prediction for future signals
```

## Core Components

### 1. Database Schema

**Migration:** `backend/src/database/migrations/032_source_credibility.sql`

**Tables:**
- `corroboration_matches` - Links private events to public confirmations
- `credibility_history` - Time-series tracking of source performance
- `specialty_scores` - Category-specific credibility (employment, development, etc.)
- `competitive_intelligence_value` - Quantifies early signal advantage
- `predictive_credibility` - Predictions for new signals

### 2. Backend Service

**File:** `backend/src/services/source-credibility.service.ts`

**Key Functions:**
- `findPotentialCorroborations()` - Automated matching algorithm
- `calculateMatchScore()` - Similarity scoring (location, entity, magnitude, temporal, type)
- `recordCorroboration()` - Record confirmed match and update all scores
- `detectCorroborations()` - Background job entry point
- `generatePrediction()` - Predictive credibility for new events
- `getNetworkIntelligenceValue()` - Intelligence value rankings

### 3. API Routes

**File:** `backend/src/api/rest/credibility.routes.ts`

**Endpoints:**
```
GET  /api/v1/credibility/sources              - List all sources
GET  /api/v1/credibility/source/:email        - Source profile
GET  /api/v1/credibility/corroborations       - Recent corroborations
POST /api/v1/credibility/match                - Manual corroboration
GET  /api/v1/credibility/network-value        - Intelligence rankings
GET  /api/v1/credibility/predictions/:eventId - Predicted accuracy
POST /api/v1/credibility/detect-corroborations - Trigger detection
GET  /api/v1/credibility/stats                - Overall statistics
```

### 4. Frontend Components

**Directory:** `frontend/src/components/credibility/`

**Components:**
- `NetworkIntelligenceDashboard.tsx` - Leaderboard of intelligence sources
- `SourceCredibilityCard.tsx` - Display in email view
- `CorroborationFeed.tsx` - Real-time confirmation feed

## Algorithms

### Similarity Matching Algorithm

The system matches private intelligence to public news using weighted scoring:

```typescript
Match Score = 
  (Location Similarity × 0.30) +
  (Entity Similarity × 0.30) +
  (Magnitude Similarity × 0.20) +
  (Temporal Proximity × 0.10) +
  (Event Type Match × 0.10)
```

**Scoring Criteria:**

**Location (30%):**
- Same geocoded point: 1.0
- Within 1 mile: 0.9
- Within 5 miles: 0.7
- Within 10 miles: 0.5
- Beyond 10 miles: 0.0

**Entity (30%):**
- Exact company name match: 1.0
- Substring match: 0.7
- Levenshtein similarity: 0.0-1.0

**Magnitude (20%):**
- Same number (jobs, sqft, $): 1.0
- Within 10% difference: 0.9
- Within 25% difference: 0.7
- Within 50% difference: 0.5

**Temporal (10%):**
- Same day: 1.0
- Within 7 days: 0.9
- Within 30 days: 0.7
- Within 90 days: 0.5
- Beyond 90 days: 0.0

**Type (10%):**
- Exact event_type match: 1.0
- Same event_category: 0.5
- Different category: 0.0

**Threshold:** Match score > 0.75 = Corroboration confirmed

### Source Reputation Scoring

```typescript
Credibility Score (0-100) = 
  (Corroborated / Total) × 100 × Recency Weight

Recency Weight:
- Signals <90 days old: 1.0x
- Signals 90-180 days old: 0.8x
- Signals >180 days old: 0.5x
```

### Specialty Scoring

Sources get bonus points for specialization:

```typescript
Base Accuracy = (Corroborated in Category / Total in Category) × 100

Specialty Bonus = 10 points if:
  - Total signals >= 5 AND
  - (Category signals / Total signals) > 70%

Specialty Score = Base Accuracy + Specialty Bonus
```

**Example:**
- Broker specializes in employment events (10/12 signals)
- Base accuracy in employment: 80%
- Specialty bonus: +10
- Final employment specialty score: 90

### Intelligence Value Score

Composite score ranking sources by overall intelligence value:

```typescript
Intelligence Value (0-100) = 
  (Avg Lead Time × 0.30) +      // Days early
  (Accuracy × 0.30) +            // Corroboration rate
  (Avg Impact × 0.25) +          // Event magnitude
  (Consistency × 0.15)           // Signal frequency

Tiers:
- Top Tier: >80 (highly valuable)
- Mid Tier: 60-80 (valuable)
- Low Tier: <60 (marginal)
```

**Scoring Components:**
- **Lead Time:** Normalized to 0-100 (30 days early = 100 points)
- **Accuracy:** Corroboration rate as percentage
- **Impact:** Normalized magnitude (1000 units = 100 points)
- **Consistency:** Signal frequency (5 points per signal, max 100)

### Predictive Credibility

When a new email signal arrives:

```typescript
1. Lookup source credibility record
2. Check for specialty match (category/type)
3. If specialty match:
     predicted_accuracy = specialty_score
   Else:
     predicted_accuracy = overall_credibility_score
4. Confidence level based on sample size:
     - <3 signals: Low
     - 3-5 signals, score >60%: Medium
     - 5-10 signals, score >75%: High
     - 10+ signals, score >85%: Very High
5. Apply prediction weight to demand/supply projections
6. Estimate corroboration time = avg_corroboration_time_days
```

## Usage Examples

### Example 1: New Private Intelligence

```typescript
// Email arrives: "Amazon considering 5,000-job expansion in Midtown Atlanta"
const event = await emailNewsExtractionService.extractNewsFromEmail(email);
// → Creates news_event with source_type='email_private'
// → credibility_score = 0.50 (neutral, unconfirmed)

// Generate prediction
const prediction = await sourceCredibilityService.generatePrediction(event.id);
// → predicted_accuracy = 85% (if source has good track record in employment)
// → predicted_corroboration_days = 18 days
// → confidence_level = "high"

// Use prediction in demand projections
demandSignalService.applyEvent(event, prediction.appliedWeight);
// → Weight demand projection by 0.85 instead of default 0.50
```

### Example 2: Corroboration Detection

```typescript
// Daily background job
const matches = await sourceCredibilityService.detectCorroborations();
// → Compares all email_private events (last 90 days)
// → To all public events (last 90 days)
// → Finds match: 0.87 similarity score

// Match found!
{
  private_event: "Amazon 5,000 jobs, email, April 1",
  public_event: "Amazon 4,800 jobs, Atlanta Business Chronicle, April 15",
  match_score: 0.87,
  lead_time_days: 14,
  match_confidence: "high"
}

// Updates:
// 1. Private event: corroborated_by_public = TRUE
// 2. Contact: corroborated_signals += 1
// 3. Specialty score: employment category += 1 corroborated
// 4. Intelligence value: record 14-day lead time
// 5. Credibility history: snapshot current scores
```

### Example 3: Network Intelligence Ranking

```typescript
const rankings = await sourceCredibilityService.getNetworkIntelligenceValue(userId);

// Results:
[
  {
    contactEmail: "broker@realty.com",
    intelligenceValueScore: 87,  // Top tier
    tier: "top",
    avgLeadTimeDays: 21,
    accuracy: 83,
    avgImpact: 3200,
    consistency: 75,
    totalSignals: 15
  },
  {
    contactEmail: "developer@build.com",
    intelligenceValueScore: 72,  // Mid tier
    tier: "mid",
    avgLeadTimeDays: 12,
    accuracy: 70,
    avgImpact: 8500,
    consistency: 50,
    totalSignals: 10
  }
]

// Action: Prioritize relationship with broker@realty.com
// → Highest intelligence value
// → 21 days early on average
// → 83% accuracy rate
```

## UI Integration

### Email View Integration

When viewing an email with news extraction:

```tsx
<EmailView email={email}>
  <NewsExtraction event={event} />
  
  {/* Add credibility card */}
  <SourceCredibilityCard 
    contactEmail={email.from}
    eventId={event.id}
  />
  {/* Shows:
    - Sender's credibility score
    - Historical track record
    - Predicted accuracy for this signal
    - Specialty matches
  */}
</EmailView>
```

### Dashboard Integration

Intelligence Dashboard page:

```tsx
<DashboardPage>
  <Tabs>
    <Tab label="Network Intelligence">
      <NetworkIntelligenceDashboard />
      {/* Shows:
        - Leaderboard of sources
        - Intelligence value tiers
        - Metrics: lead time, accuracy, impact
      */}
    </Tab>
    
    <Tab label="Recent Confirmations">
      <CorroborationFeed limit={20} />
      {/* Shows:
        - Real-time corroboration feed
        - "Your contact was right!"
        - Lead time highlighting
        - Competitive advantage metrics
      */}
    </Tab>
  </Tabs>
</DashboardPage>
```

## Background Jobs

### Automated Corroboration Detection

**Frequency:** Daily (configurable)

**Process:**
1. Query unconfirmed private events (last 90 days)
2. Query public events (last 90 days)
3. For each private event:
   - Calculate match score vs all public events
   - If match score > 0.75: Record corroboration
   - Update all related scores and metrics
4. Send notifications for new corroborations

**Cron Setup:**
```typescript
// In backend scheduler
schedule.scheduleJob('0 2 * * *', async () => {
  // Run at 2 AM daily
  console.log('Running corroboration detection...');
  const matches = await sourceCredibilityService.detectCorroborations();
  console.log(`Found ${matches.length} new corroborations`);
});
```

## Performance Optimization

### Indexing Strategy

```sql
-- Key indexes for performance
CREATE INDEX idx_news_events_source_type ON news_events(source_type);
CREATE INDEX idx_news_events_published ON news_events(published_at DESC);
CREATE INDEX idx_corroboration_score ON corroboration_matches(match_score DESC);
CREATE INDEX idx_credibility_history_contact ON credibility_history(contact_credibility_id);
```

### Caching Strategy

Cache frequently accessed data:
- Source credibility scores (TTL: 1 hour)
- Intelligence value rankings (TTL: 6 hours)
- Recent corroborations (TTL: 15 minutes)

```typescript
// Redis cache keys
cache.set(`credibility:source:${email}`, sourceData, { ttl: 3600 });
cache.set(`credibility:rankings:${userId}`, rankings, { ttl: 21600 });
cache.set(`credibility:corroborations:${userId}`, feed, { ttl: 900 });
```

## Testing

### Unit Tests

```typescript
describe('SourceCredibilityService', () => {
  it('should calculate match score correctly', async () => {
    const score = await service.calculateMatchScore(event1, event2);
    expect(score.matchScore).toBeGreaterThan(0.75);
  });

  it('should generate accurate predictions', async () => {
    const prediction = await service.generatePrediction(eventId);
    expect(prediction.confidenceLevel).toBe('high');
  });

  it('should rank sources by intelligence value', async () => {
    const rankings = await service.getNetworkIntelligenceValue(userId);
    expect(rankings[0].tier).toBe('top');
  });
});
```

### Integration Tests

```typescript
describe('Corroboration Detection', () => {
  it('should detect corroboration between email and public news', async () => {
    // Create private event
    const privateEvent = await createTestEvent('email_private');
    
    // Create matching public event 14 days later
    const publicEvent = await createTestEvent('public', { 
      daysAfter: 14 
    });
    
    // Run detection
    const matches = await service.detectCorroborations();
    
    expect(matches.length).toBe(1);
    expect(matches[0].leadTimeDays).toBe(14);
    expect(matches[0].matchScore).toBeGreaterThan(0.75);
  });
});
```

## Monitoring & Analytics

### Key Metrics

Track these metrics in analytics dashboard:

1. **Corroboration Rate:** % of private events confirmed
2. **Avg Lead Time:** Days early for corroborated events
3. **Network Value:** Avg intelligence value across all sources
4. **Prediction Accuracy:** How accurate are predictions vs actual outcomes
5. **Top Sources:** Leaderboard of highest-value contacts

### Alerts

Configure alerts for:
- New corroboration detected (user notification)
- Source credibility drops significantly (monitoring)
- Prediction accuracy deviation >20% (system health)
- Background job failures (ops alert)

## Future Enhancements

### Phase 4 Improvements

1. **Machine Learning Enhancement:**
   - Train ML model on historical matches
   - Improve match scoring with learned patterns
   - Predict which new sources will be valuable

2. **Network Effect Analysis:**
   - Identify corroboration clusters (multiple sources reporting same thing)
   - Network graphs showing source relationships
   - "Consensus signals" when 3+ sources align

3. **Category-Specific Models:**
   - Different matching algorithms per category
   - Employment events: focus on company + location
   - Development events: focus on location + magnitude
   - Transaction events: focus on entity + dollar amount

4. **Temporal Patterns:**
   - Learn typical lead times per source
   - Identify sources that report at specific lifecycle stages
   - "Early signal specialists" vs "confirmation sources"

5. **Business Impact Quantification:**
   - Calculate $ value of early knowledge
   - Track deals influenced by early signals
   - ROI on intelligence network relationships

## Troubleshooting

### Common Issues

**Issue:** No corroborations detected
- Check that both private and public events exist in DB
- Verify geocoding is working (location_geocoded not null)
- Lower match threshold temporarily to see near-misses
- Check extracted_data structure matches expected format

**Issue:** False positive matches
- Review match scoring weights - adjust if needed
- Add additional filtering criteria (e.g., date range)
- Implement manual confirmation workflow
- Increase match threshold from 0.75 to 0.80

**Issue:** Predictions are inaccurate
- Ensure sufficient sample size (min 5 signals)
- Check if specialty matching is working correctly
- Review credibility_history for score volatility
- Consider adding confidence bands around predictions

## API Usage Examples

### Get Source Profile

```bash
curl -X GET \
  'https://api.jedire.com/api/v1/credibility/source/broker@realty.com' \
  -H 'Authorization: Bearer TOKEN'
```

### Get Intelligence Rankings

```bash
curl -X GET \
  'https://api.jedire.com/api/v1/credibility/network-value' \
  -H 'Authorization: Bearer TOKEN'
```

### Trigger Corroboration Detection

```bash
curl -X POST \
  'https://api.jedire.com/api/v1/credibility/detect-corroborations' \
  -H 'Authorization: Bearer TOKEN'
```

### Get Prediction for Event

```bash
curl -X GET \
  'https://api.jedire.com/api/v1/credibility/predictions/EVENT_ID' \
  -H 'Authorization: Bearer TOKEN'
```

## Conclusion

The Source Credibility Learning System transforms email intelligence from unverified tips into a quantified, tracked, and predictable asset. By automatically corroborating private signals against public news and building source reputation over time, the system enables:

1. **Data-driven relationship prioritization** - Know which contacts provide the best intelligence
2. **Predictive credibility** - Assign accurate weights to new signals immediately
3. **Competitive advantage quantification** - Measure the value of early information
4. **Network intelligence optimization** - Build and maintain a high-value intelligence network

**Status:** ✅ Ready for Production

**Phase:** JEDI RE Phase 3, Component 4 - Complete
