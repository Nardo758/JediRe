# Source Credibility System - Integration Examples

## Example 1: Email Arrives with Private Intelligence

### Step 1: Email Extraction (Existing System)

```typescript
// When email arrives with news content
const email = await gmailSyncService.fetchEmail(emailId);
const extraction = await emailNewsExtractionService.extractNewsFromEmail(email);

// Creates news_event with:
{
  source_type: 'email_private',
  source_name: 'Email: broker@realty.com',
  source_credibility_score: 0.50, // Initial neutral score
  corroborated_by_public: false,
  event_category: 'employment',
  event_type: 'company_expansion',
  extracted_data: {
    company_name: 'Amazon',
    magnitude: 5000,
    units: 'jobs'
  }
}
```

### Step 2: Generate Prediction (New System)

```typescript
import sourceCredibilityService from './services/source-credibility.service';

// Generate prediction for this signal
const prediction = await sourceCredibilityService.generatePrediction(
  extraction.eventId
);

console.log(prediction);
// Output:
{
  predictedAccuracy: 85,              // 85% likely to be corroborated
  predictedCorroborationDays: 18,     // Expected confirmation in 18 days
  confidenceLevel: 'high',            // High confidence (10+ historical signals)
  historicalAccuracy: 83,             // Contact's overall accuracy
  specialtyMatch: true,               // Contact specializes in employment
  specialtyAccuracy: 90,              // 90% accuracy in employment category
  sampleSize: 12,                     // Based on 12 historical signals
  appliedWeight: 0.85                 // Use 85% weight in projections
}
```

### Step 3: Apply to Demand Projections

```typescript
// Use predicted credibility to weight demand signal
import demandSignalService from './services/demand-signal.service';

await demandSignalService.processNewsEvent(
  extraction.eventId,
  prediction.appliedWeight  // 0.85 instead of default 0.50
);

// Result: Demand projection weighted by source credibility
// High credibility source → stronger demand signal
// Low credibility source → weaker demand signal
```

### Step 4: Display in Email UI

```tsx
// In EmailDetailView component
import { SourceCredibilityCard } from './components/credibility';

function EmailDetailView({ email, newsEvent }) {
  return (
    <div className="space-y-4">
      {/* Email content */}
      <EmailContent email={email} />
      
      {/* News extraction */}
      {newsEvent && (
        <NewsExtractionPanel event={newsEvent} />
      )}
      
      {/* Source credibility card */}
      {newsEvent?.source_type === 'email_private' && (
        <SourceCredibilityCard 
          contactEmail={email.from}
          eventId={newsEvent.id}
        />
      )}
    </div>
  );
}

// Displays:
// - Overall Credibility: 83%
// - Intelligence Value: 87
// - Track Record: 10/12 confirmed, 0 failed, 2 pending
// - Avg Lead Time: 21 days ahead of public news
// - Specialties: Employment (90%), Development (75%)
// - Predicted Accuracy for This Signal: 85%
// - Estimated Confirmation: 18 days
```

## Example 2: Automated Corroboration Detection

### Daily Background Job

```typescript
// Runs at 2:00 AM daily
import { startSourceCredibilityScheduler } from './services/source-credibility-scheduler';

// In server.ts
startSourceCredibilityScheduler();
```

### Job Execution Flow

```typescript
// 1. Get unconfirmed private events (last 90 days)
const privateEvents = [
  {
    id: 'event-1',
    company: 'Amazon',
    magnitude: 5000,
    location: 'Midtown Atlanta',
    date: '2024-04-01',
    source: 'broker@realty.com'
  }
];

// 2. Get public events (last 90 days)
const publicEvents = [
  {
    id: 'event-2',
    company: 'Amazon',
    magnitude: 4800,
    location: 'Midtown Atlanta',
    date: '2024-04-15',
    source: 'Atlanta Business Chronicle'
  }
];

// 3. Calculate match scores
const matchScore = {
  location: 0.95,    // Same neighborhood
  entity: 1.00,      // Same company
  magnitude: 0.96,   // 5000 vs 4800 = 96% similar
  temporal: 0.84,    // 14 days apart within 90-day window
  type: 1.00,        // Both company_expansion
  
  overall: 0.87      // Weighted average > 0.75 threshold
};

// 4. Record corroboration
{
  privateEventId: 'event-1',
  publicEventId: 'event-2',
  matchScore: 0.87,
  matchConfidence: 'high',
  leadTimeDays: 14,  // Private signal was 14 days early
}

// 5. Update source credibility
{
  contactEmail: 'broker@realty.com',
  totalSignals: 12 → 12,
  corroboratedSignals: 10 → 11,
  failedSignals: 0,
  pendingSignals: 2 → 1,
  credibilityScore: 0.83 → 0.92,  // Improved!
  avgLeadTimeDays: 21 → 20,
  intelligenceValueScore: 87 → 89
}

// 6. Record intelligence value
{
  leadTimeDays: 14,
  impactMagnitude: 5000,
  impactCategory: 'employment',
  timeValueScore: 47,     // 14 days = 47/100 (normalized)
  impactValueScore: 50,   // 5000 jobs = 50/100
  combinedValueScore: 84  // High value signal
}
```

### Notification Sent

```typescript
// User receives notification
{
  type: 'corroboration_confirmed',
  title: 'Your contact was right!',
  message: 'broker@realty.com predicted Amazon expansion 14 days early',
  data: {
    contactEmail: 'broker@realty.com',
    leadTimeDays: 14,
    newCredibilityScore: 0.92,
    tier: 'top'
  }
}
```

## Example 3: Network Intelligence Dashboard

### Fetching Rankings

```typescript
// Get intelligence value rankings
const rankings = await sourceCredibilityService.getNetworkIntelligenceValue(userId);

console.log(rankings);
// Output:
[
  {
    contactEmail: 'broker@realty.com',
    contactName: 'Sarah Johnson',
    intelligenceValueScore: 89,
    tier: 'top',
    avgLeadTimeDays: 20,
    accuracy: 92,
    avgImpact: 4200,
    consistency: 80,
    totalSignals: 12
  },
  {
    contactEmail: 'developer@construct.com',
    contactName: 'Mike Chen',
    intelligenceValueScore: 76,
    tier: 'mid',
    avgLeadTimeDays: 15,
    accuracy: 78,
    avgImpact: 12000,
    consistency: 60,
    totalSignals: 9
  },
  {
    contactEmail: 'agent@listings.com',
    contactName: null,
    intelligenceValueScore: 45,
    tier: 'low',
    avgLeadTimeDays: 5,
    accuracy: 60,
    avgImpact: 800,
    consistency: 25,
    totalSignals: 4
  }
]
```

### Dashboard Display

```tsx
<NetworkIntelligenceDashboard />

// Renders:
// Summary Stats:
// - Total Sources: 23
// - Top Tier: 7 (30%)
// - Mid Tier: 10 (43%)
// - Low Tier: 6 (26%)
// - Avg Intelligence Value: 68

// Leaderboard:
// #1 Sarah Johnson (broker@realty.com)
//    Value Score: 89 | Lead Time: 20d | Accuracy: 92% | Signals: 12
//
// #2 Mike Chen (developer@construct.com)
//    Value Score: 76 | Lead Time: 15d | Accuracy: 78% | Signals: 9
//
// [View Full Rankings →]
```

### Action: Prioritize Relationships

```typescript
// Business decision based on intelligence value
const topSources = rankings.filter(r => r.tier === 'top');

// Focus on maintaining relationships with top-tier sources
topSources.forEach(source => {
  console.log(`Priority Contact: ${source.contactName || source.contactEmail}`);
  console.log(`  - Provides ${source.avgLeadTimeDays} days lead time`);
  console.log(`  - ${source.accuracy}% accuracy rate`);
  console.log(`  - ${source.totalSignals} signals tracked`);
});

// Output:
// Priority Contact: Sarah Johnson
//   - Provides 20 days lead time
//   - 92% accuracy rate
//   - 12 signals tracked
// Action: Schedule quarterly lunch meeting
```

## Example 4: Specialty Tracking

### Category-Specific Credibility

```typescript
// Source has different credibility in different categories
const sourceProfile = await sourceCredibilityService.getSourceCredibility(
  userId,
  'broker@realty.com'
);

console.log(sourceProfile.specialties);
// Output:
[
  {
    category: 'employment',
    score: 95,           // 95% credibility in employment
    signalCount: 10,
    accuracy: 90,
    bonus: 10           // +10 bonus for specialization (10/12 = 83% of signals)
  },
  {
    category: 'development',
    score: 75,          // 75% credibility in development
    signalCount: 2,
    accuracy: 75,
    bonus: 0            // No bonus (only 2/12 = 17% of signals)
  }
]
```

### Using Specialty Scores

```typescript
// New email arrives about employment event
const event = {
  category: 'employment',
  source: 'broker@realty.com'
};

const prediction = await sourceCredibilityService.generatePrediction(event.id);

// System uses specialty score (95%) instead of overall (92%)
console.log(prediction);
// Output:
{
  predictedAccuracy: 95,        // Higher than overall 92%
  specialtyMatch: true,         // Matched to employment specialty
  specialtyAccuracy: 95,
  confidenceLevel: 'very_high'  // Very high confidence for specialty
}

// Result: Even higher weight applied to demand projection
// This source is a specialist in employment → trust them more
```

## Example 5: Failed Predictions

### When Source is Wrong

```typescript
// Private event never gets corroborated
// After 90 days, mark as failed

const unconfirmedEvents = await pool.query(`
  SELECT id, source_name, published_at
  FROM news_events
  WHERE source_type = 'email_private'
    AND corroborated_by_public = FALSE
    AND published_at < NOW() - INTERVAL '90 days'
`);

// For each unconfirmed event
for (const event of unconfirmedEvents.rows) {
  const contactEmail = event.source_name.replace('Email: ', '');
  
  // Update as failed
  await pool.query(`
    UPDATE news_contact_credibility
    SET 
      failed_signals = failed_signals + 1,
      pending_signals = GREATEST(0, pending_signals - 1),
      updated_at = NOW()
    WHERE contact_email = $1
  `, [contactEmail]);
  
  // Recalculate credibility (will go down)
  await sourceCredibilityService.updateCredibilityScores(contactEmail);
}

// Result:
{
  contactEmail: 'agent@listings.com',
  totalSignals: 4 → 4,
  corroboratedSignals: 2,
  failedSignals: 1 → 2,        // Increased
  pendingSignals: 1 → 0,
  credibilityScore: 0.67 → 0.50,  // Decreased
  intelligenceValueScore: 55 → 45  // Dropped to low tier
}

// Impact: Future signals from this source weighted lower
```

## Integration Checklist

### Backend Integration

- [x] Database migration applied
- [x] Source credibility service imported
- [x] Scheduler started in server initialization
- [x] API routes registered
- [ ] Background job logs monitored
- [ ] Failed signal cleanup job configured

### Frontend Integration

- [x] Components imported
- [ ] Routes configured
- [ ] Email view displays credibility card
- [ ] Dashboard includes corroboration feed
- [ ] Navigation includes intelligence dashboard link
- [ ] Notifications for new corroborations

### Testing

- [ ] Test corroboration detection manually
- [ ] Verify match scoring accuracy
- [ ] Test prediction generation
- [ ] Verify UI components render correctly
- [ ] Test with real email data
- [ ] Validate specialty scoring

### Production Readiness

- [ ] Configure alerting for job failures
- [ ] Set up monitoring dashboard
- [ ] Document admin procedures
- [ ] Train users on new features
- [ ] Configure notification preferences
- [ ] Optimize query performance
- [ ] Set up data backup procedures

## Next Steps

1. **Run migration:** `npx knex migrate:latest`
2. **Start scheduler:** Add to server initialization
3. **Test API:** Run `./test-credibility-system.sh`
4. **Add UI:** Integrate components into existing pages
5. **Monitor:** Watch scheduler logs for first execution
6. **Iterate:** Adjust match threshold based on results

## Support

For questions or issues:
- Documentation: `SOURCE_CREDIBILITY_LEARNING.md`
- Setup Guide: `CREDIBILITY_SETUP.md`
- Test Script: `./test-credibility-system.sh`
