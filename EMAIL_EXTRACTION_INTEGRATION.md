# Email Extraction Integration - JEDI RE Track 1 Quick Win

## Overview

Automatically extract property listings and market intelligence from incoming emails during Gmail sync. Properties and news events are intelligently classified, extracted using AI, and either auto-created (if matching preferences) or queued for user review.

## Features

### 1. **Email Classification**
- Analyzes subject + body to determine type:
  - **Property**: Broker emails, listings, pricing, cap rate, units
  - **News**: Market intelligence, development announcements, employment news
  - **Mixed**: Contains both property + news
  - **General**: Regular correspondence (ignored)
- Uses keyword matching (fast) + optional LLM classification (accurate)
- Confidence scoring (0.0 to 1.0)

### 2. **Property Extraction**
- Extracts from emails:
  - Address (street, city, state, zip)
  - Price
  - Property type (multifamily, retail, office, etc.)
  - Units, sqft, year built
  - Cap rate, occupancy
  - Condition (excellent, good, value-add, distressed)
- Geocodes addresses using Mapbox
- Matches against user acquisition preferences
- Auto-creates map pins for high-confidence matches (≥80% confidence)
- Queues low-confidence or non-matching properties for review

### 3. **News Extraction**
- Extracts market intelligence:
  - Event type (employment, development, transaction, infrastructure, regulation)
  - Location (address or city/state)
  - Magnitude (employee count, investment amount, units, sqft)
  - Sentiment (-1.0 to 1.0)
  - Impact score (0 to 100)
- Stores to `news_items` table with `source_type='email_private'`
- Geocodes and assigns to geographic hierarchy
- Marked as private intelligence (not public)

### 4. **Dual Extraction**
- Some emails contain BOTH property + news
  - Example: "New Amazon campus announced + adjacent land for sale"
- Both extractions run independently
- Linked in database for traceability

### 5. **Gmail Sync Integration**
- After storing each email, runs extraction pipeline:
  1. Classify email
  2. If property detected → extract and store
  3. If news detected → extract and store
  4. Update email with classification metadata
- Non-blocking: Extraction errors don't fail sync

## Architecture

### Backend Services

#### `email-classification.service.ts`
- Classifies emails by type
- Keyword-based (fast) with LLM fallback (accurate)
- Returns: `{classification, confidence, reasons, containsProperty, containsNews}`

#### `email-property-automation.service.ts` (existing, enhanced)
- Extracts property data using AI
- Matches against user preferences
- Auto-creates pins or queues for review
- Geocodes addresses
- Stores to `property_extraction_queue` table

#### `email-news-extraction.service.ts` (new)
- Extracts news events using AI
- Assesses source credibility
- Geocodes locations
- Stores to `news_items` table

#### `gmail-sync.service.ts` (updated)
- Added `processEmailExtractions()` method
- Calls after storing each email
- Runs classification + extraction pipeline

### API Routes

#### `email-extractions.routes.ts`
- `GET /api/v1/email-extractions/:emailId` - Get extractions for an email
- `GET /api/v1/email-extractions/list/properties` - List property extractions
- `GET /api/v1/email-extractions/list/news` - List news extractions
- `POST /api/v1/email-extractions/properties/:id/approve` - Approve and create pin
- `POST /api/v1/email-extractions/properties/:id/reject` - Reject extraction
- `DELETE /api/v1/email-extractions/properties/:id` - Delete false positive
- `DELETE /api/v1/email-extractions/news/:id` - Delete news false positive
- `GET /api/v1/email-extractions/stats/summary` - Get extraction statistics

### Frontend

#### `ExtractionBadges.tsx` (new)
- Visual indicators for extracted emails:
  - 🏢 Property extracted
  - 📰 News extracted
  - ✅ Auto-created
  - ⚠️ Needs review

#### `EmailInbox.tsx` (updated)
- Shows extraction badges on emails
- Quick actions:
  - Approve/Reject extraction
  - View on Map
  - View Details
- Loads extraction data on inbox load

## Database Schema

### Tables Used

#### `property_extraction_queue`
```sql
- id: UUID
- user_id: UUID
- email_id: TEXT (external email ID)
- email_subject: TEXT
- email_from: TEXT
- extracted_data: JSONB (AI-extracted property info)
- extraction_confidence: NUMERIC(3,2)
- preference_match_score: NUMERIC(3,2)
- status: TEXT (pending, auto-created, requires-review, rejected, ignored)
- created_pin_id: UUID (if auto-created)
```

#### `news_items`
```sql
- id: UUID
- market_id: UUID
- title: TEXT
- summary: TEXT
- source: VARCHAR (set to 'email_private')
- category: VARCHAR (employment, development, etc.)
- sentiment_score: DECIMAL
- impact_score: INTEGER
- raw_data: JSONB (contains emailId, magnitude, etc.)
```

#### `emails`
```sql
- raw_data: JSONB (contains classification + linkedNewsItemId)
```

## Configuration

### User Preferences
Set via `user_acquisition_preferences` table:
- Property types
- Geographic markets (states, cities)
- Price range
- Unit count
- Year built range
- Cap rate range
- Conditions accepted
- `auto_create_on_match`: Auto-create pins for high matches (default: true)
- `confidence_threshold`: Minimum confidence to auto-create (default: 0.80)

### Environment Variables
```bash
MAPBOX_TOKEN=pk.eyJ1... # For geocoding
```

## Usage

### For Users

1. **Connect Gmail Account**
   - Settings → Email Accounts → Connect Gmail
   - Authorize access

2. **Set Acquisition Preferences**
   - Settings → Preferences → Set criteria
   - Enable/disable auto-creation

3. **Sync Emails**
   - Inbox → Refresh
   - Extractions run automatically

4. **Review Extractions**
   - Emails show badges: 🏢 Property, 📰 News
   - Click "Approve" to create pin
   - Click "Reject" to dismiss
   - Click "Details" to review extraction

5. **View Extracted Properties**
   - Map → Filter by "Email Source"
   - Pipeline → Filter by "Auto-Created"

### For Developers

#### Test Property Extraction
```bash
# Create test email with property listing
curl -X POST http://localhost:5000/api/v1/test/property-email \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "subject": "Off-Market Deal: 200-Unit Multifamily - Austin, TX",
    "body": "200-unit apartment complex in Austin. Built 2018. $25M asking. 6.5% cap rate. 95% occupancy.",
    "from": "broker@cbre.com"
  }'
```

#### Test News Extraction
```bash
# Create test email with market news
curl -X POST http://localhost:5000/api/v1/test/news-email \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "subject": "Amazon Announces 5,000-Job Expansion in Atlanta",
    "body": "Amazon will invest $500M in new fulfillment center, creating 5,000 jobs by 2025.",
    "from": "newsletter@bisnow.com"
  }'
```

## Accuracy & Confidence

### Property Extraction Confidence
- **High (≥0.8)**: Complete address, price, cap rate, units → Auto-create if matches preferences
- **Medium (0.5-0.8)**: Partial data or ambiguous → Queue for review
- **Low (<0.5)**: Vague or no clear property → Ignore

### News Extraction Confidence
- **High (≥0.7)**: Clear event, location, magnitude → Auto-create news item
- **Medium (0.4-0.7)**: Partial info → Create but lower impact score
- **Low (<0.4)**: No clear news → Skip

### Preference Matching
- Scores 0.0 to 1.0 based on:
  - Property type match
  - Geographic match
  - Price range
  - Unit count
  - Year built
  - Condition
- **Auto-create threshold**: ≥0.80 (configurable per user)

## Anti-False-Positive Measures

1. **Classification First**: Skip general emails before extraction
2. **Confidence Scoring**: Only extract high-confidence content
3. **Preference Matching**: Filter out non-matching properties
4. **User Review Queue**: Medium-confidence items need approval
5. **Easy Rejection**: One-click reject in inbox
6. **Audit Trail**: Log all extraction decisions

## Performance

### Extraction Speed
- Classification: ~100ms (keywords) or ~500ms (LLM)
- Property extraction: ~1-2 seconds (LLM + geocoding)
- News extraction: ~1-2 seconds (LLM + geocoding)
- Total per email: ~2-4 seconds (parallel property + news)

### Gmail Sync Impact
- Sync runs normally, extraction is non-blocking
- If extraction fails, sync continues
- Batch extraction for multiple emails

## Monitoring & Logs

### Key Metrics
- `property_extraction_queue.status` distribution
- Average `extraction_confidence`
- Average `preference_match_score`
- Auto-created vs. requires-review ratio
- User approval/rejection rates

### Logs
```typescript
logger.info('Email classified', { classification, confidence })
logger.info('Property extracted', { emailId, decision, pinId })
logger.info('News extracted', { emailId, newsItemId })
logger.warn('Email extraction failed', { emailId, error })
```

## Troubleshooting

### No Extractions Appearing
1. Check Gmail sync is working: `GET /api/v1/gmail/accounts`
2. Check LLM service is running: `GET /api/v1/llm/health`
3. Check extraction logs in backend console
4. Verify user has `user_acquisition_preferences` set

### False Positives
1. Review keyword patterns in `email-classification.service.ts`
2. Adjust `confidence_threshold` in user preferences
3. Improve LLM prompts for extraction
4. Add sender to blocklist (future feature)

### Geocoding Failures
1. Check `MAPBOX_TOKEN` is set
2. Verify address format in extraction
3. Fallback: User can manually geocode in review queue

### Low Match Scores
1. Review user acquisition preferences
2. Check property type mapping
3. Verify geographic markets are correct
4. Adjust preference weights (future feature)

## Future Enhancements

- [ ] Sender whitelist/blocklist
- [ ] Custom extraction templates per sender
- [ ] Bulk approve/reject
- [ ] Email threading (group related emails)
- [ ] Attachment parsing (OM PDFs, images)
- [ ] Deal stage progression from email sentiment
- [ ] Email reply templates (auto-respond to brokers)
- [ ] Integration with CRM (link contacts)
- [ ] Machine learning: Learn from user approvals/rejections
- [ ] Multi-language support
- [ ] Outlook/Microsoft 365 support (in progress)

## Testing

### Unit Tests
```bash
cd backend
npm test services/email-classification.service.test.ts
npm test services/email-news-extraction.service.test.ts
```

### Integration Tests
```bash
npm test integration/email-extraction.test.ts
```

### Manual Testing Checklist
- [ ] Gmail sync with property email → Auto-created pin
- [ ] Gmail sync with news email → News item created
- [ ] Gmail sync with mixed email → Both extracted
- [ ] Low-confidence property → Queued for review
- [ ] Non-matching property → Rejected
- [ ] General email → Ignored (no extraction)
- [ ] Approve extraction → Pin created
- [ ] Reject extraction → Status updated
- [ ] View on map → Opens correct pin
- [ ] Extraction details page → Shows full data

## Documentation

- **User Guide**: See `/docs/user-guide/email-extraction.md`
- **API Documentation**: See `/docs/api/email-extractions.md`
- **Architecture**: This file

## Contributors

- AI Agent (subagent:email-extraction-track1) - Initial implementation
- Leon - Product requirements & testing

## License

Proprietary - JEDI RE Platform

---

**Status**: ✅ Ready for Testing
**Version**: 1.0.0
**Last Updated**: 2025-02-02
