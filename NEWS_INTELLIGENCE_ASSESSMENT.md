# News Intelligence - Current State & Build Plan

**Assessment Date:** 2026-02-08 01:26 EST  
**Status:** 🟡 Partially Built - UI Complete, Backend Complete, Integration Needed

---

## 📊 Current State

### ✅ COMPLETE

#### Frontend UI (100%)
- **NewsIntelligencePage.tsx** - Full split-view layout
  - 3-column layout (Views sidebar, Content panel, Map)
  - Resizable panels with localStorage persistence
  - Toggle buttons to show/hide panels
  - Interactive map-content sync
  - Event cards with detailed horizontal design
  - Category filters
  - Color-coded event markers on map

#### Backend API (100%)
- **news.routes.ts** - 7 REST endpoints
  - `GET /api/v1/news/events` - List events with filters
  - `GET /api/v1/news/events/:id` - Single event details
  - `GET /api/v1/news/dashboard` - Market dashboard metrics
  - `GET /api/v1/news/alerts` - User alerts
  - `PATCH /api/v1/news/alerts/:id` - Update alert status
  - `GET /api/v1/news/network` - Network intelligence (contact credibility)

#### API Service Layer (100%)
- **news.service.ts** - Complete TypeScript client
  - All 6 methods implemented
  - Proper typing with interfaces
  - Query parameter handling

#### Database Schema (100%)
- **008_news_intelligence.sql** - 7 tables
  - `news_events` - Core event storage
  - `news_event_geo_impacts` - Links events to deals/properties
  - `news_alerts` - User notifications
  - `news_contact_credibility` - Email source tracking
  - `news_sources` - Public source registry
  - `news_event_corroboration` - Event cross-validation
  - Indexes, triggers, helper functions

---

## 🚧 NEEDS WORK

### 1. 🔴 Frontend-Backend Integration (CRITICAL)
**Status:** Mock data only, no API calls

**Current Issue:**
- NewsIntelligencePage uses hardcoded `mockEvents` array
- API service exists but not wired up
- No loading states, error handling, or real data flow

**What's Needed:**
```typescript
// Add to NewsIntelligencePage.tsx:
- useEffect to fetch events on mount
- Wire up category filters to API
- Wire up dashboard metrics to API
- Wire up network intelligence to API
- Wire up alerts to API
- Add loading/error states
- Add pagination (Load More button)
```

**Estimated Work:** 2-3 hours

---

### 2. 🟡 Data Population (HIGH)
**Status:** Database tables exist but empty

**Current Issue:**
- No news events in database
- No test data seeded
- No ingestion pipeline running

**What's Needed:**
- **Option A:** Seed mock data for testing (quick)
  - Create migration with 20-30 sample events
  - Cover all categories (employment, development, transactions, etc.)
  - Link some events to existing deals/properties
  
- **Option B:** Build ingestion pipeline (long-term)
  - Email parser (extract events from Gmail/Outlook)
  - Public source scrapers (news APIs, RSS feeds)
  - AI extraction service (GPT-4 to parse articles)
  - Background job queue

**Estimated Work:**
- Option A: 1-2 hours
- Option B: 1-2 weeks

---

### 3. 🟡 Horizontal Bar Buttons (MEDIUM)
**Status:** UI exists but no functionality

**Current Issue:**
- War Maps button doesn't toggle layers properly
- Custom map buttons are hardcoded
- Create Map button has no modal/action
- Create Deal button doesn't open CreateDealModal
- Search bar doesn't search anything

**What's Needed:**

#### War Maps Button
- Already partially working (toggles LayerControlsPanel)
- Need to actually show/hide map layers based on state

#### Custom Map Buttons
- Wire to real user-created maps from database
- Add CRUD operations for custom maps
- Persist map layer configs

#### Create Map Button
- Build CreateMapModal component
- Allow users to draw custom boundaries
- Name + save custom map layers
- Add to HorizontalBar button list

#### Create Deal Button
- Wire to existing CreateDealModal
- Pass proper callbacks
- Sync with Dashboard state

#### Search Bar
- Implement search endpoint (properties, deals, emails, events)
- Debounced search
- Search results dropdown
- Navigate to result on click

**Estimated Work:** 3-4 hours

---

### 4. 🟢 Map Layer Integration (LOW)
**Status:** Map shows deals but not news events properly

**Current Issue:**
- Event markers are added but not synced with layer controls
- No layer toggle for "News Events"
- No opacity control for event markers

**What's Needed:**
- Add "News Events" to MapLayersContext
- Sync event markers with layer visibility/opacity
- Add to LayerControlsPanel sidebar

**Estimated Work:** 1 hour

---

### 5. 🟢 Alerts System (LOW)
**Status:** Backend complete, UI placeholder

**Current Issue:**
- Alerts view shows "coming soon"
- No UI for alert notifications
- No alert badge in navigation
- No push notification system

**What's Needed:**
- Build AlertsView component (list of alerts)
- Alert notification badge in sidebar (unread count)
- Mark as read/dismissed functionality
- Snooze alerts feature
- (Optional) Browser push notifications

**Estimated Work:** 2-3 hours

---

## 🚀 Bootup Section - Email Account Connection

### Overview
When users first connect their email accounts, we need an intelligent agent to process historical emails and extract real estate events going back X years. This creates an instant knowledge base of their network intelligence and market events.

### User Flow

1. **Email Account Connection**
   - User goes to Settings → Email Integration
   - Connects Gmail/Outlook/Exchange via OAuth
   - Selects lookback period (1-5 years recommended)
   - Confirms which mailboxes to scan (Inbox, Sent, specific folders)

2. **Bootup Agent Initialization**
   - Background agent spawns to process historical emails
   - Scans emails in reverse chronological order (newest first)
   - Extracts events using AI (GPT-4 or similar)
   - Builds contact credibility profiles

3. **Progress Tracking**
   - Real-time progress bar showing:
     - Emails scanned: 1,240 / 8,500
     - Events extracted: 47
     - Contacts identified: 23
     - Estimated time remaining: 12 minutes
   - User can pause/resume or cancel anytime

4. **Completion Summary**
   - Shows extraction results:
     - "Processed 8,500 emails from the last 3 years"
     - "Extracted 127 market events"
     - "Identified 34 credible contacts"
     - "18 events linked to your active deals"

### Technical Architecture

#### 1. Email Provider Integration
```typescript
// Services needed:
- Gmail API OAuth flow
- Microsoft Graph API (Outlook/Exchange)
- IMAP fallback for other providers

// Permissions required:
- read-only access to email content
- read-only access to sent mail
- no write/delete permissions
```

#### 2. Bootup Agent Design
```typescript
interface BootupJob {
  id: string;
  user_id: string;
  provider: 'gmail' | 'outlook' | 'exchange' | 'imap';
  lookback_years: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: {
    total_emails: number;
    processed_emails: number;
    events_extracted: number;
    contacts_identified: number;
    started_at: Date;
    estimated_completion: Date;
  };
  filters: {
    folders: string[];
    exclude_spam: boolean;
    exclude_promotions: boolean;
  };
}
```

#### 3. Processing Pipeline

**Step 1: Email Batch Fetching**
- Fetch emails in batches of 100-500
- Filter by date range (lookback period)
- Prioritize emails with real estate keywords
- Skip obvious spam/promotions

**Step 2: AI Extraction**
- Send email content to LLM (GPT-4)
- Prompt: "Extract real estate market events from this email thread"
- Parse structured response (JSON)
- Categories: employment, development, transactions, government, amenities

**Step 3: Event Validation**
- Check if event already exists (deduplication)
- Geocode location if not already done
- Calculate confidence score
- Link to existing deals/properties if relevant

**Step 4: Contact Credibility**
- Extract sender name, email, company
- Track which events each contact provided
- Calculate initial credibility score
- Store in `news_contact_credibility` table

**Step 5: Alert Generation**
- Create high-priority alerts for critical events
- Link events to user's active deals
- Generate "suggested actions" for each alert

### Database Tables

#### New Table: `email_bootup_jobs`
```sql
CREATE TABLE email_bootup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Configuration
  provider VARCHAR(20) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  lookback_years INTEGER NOT NULL,
  
  -- Filters
  folders JSONB,
  exclude_spam BOOLEAN DEFAULT TRUE,
  exclude_promotions BOOLEAN DEFAULT TRUE,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  
  -- Progress tracking
  total_emails INTEGER,
  processed_emails INTEGER DEFAULT 0,
  events_extracted INTEGER DEFAULT 0,
  contacts_identified INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  estimated_completion TIMESTAMP,
  
  -- Error handling
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bootup_jobs_user ON email_bootup_jobs(user_id);
CREATE INDEX idx_bootup_jobs_status ON email_bootup_jobs(status);
```

### UI Components

#### 1. Email Connection Page
**Location:** `/settings/email-integration`

**Features:**
- Provider selection (Gmail, Outlook, Exchange, IMAP)
- OAuth connection flow
- Lookback period slider (1-5 years)
- Folder selection (checkboxes)
- Privacy settings toggle
- "Start Bootup" button

#### 2. Bootup Progress Modal
**Overlay during processing:**
```
┌──────────────────────────────────────────┐
│  🚀 Loading Your Email Intelligence      │
├──────────────────────────────────────────┤
│  Processing emails from the last 3 years │
│                                          │
│  ████████████░░░░░░░░ 62%               │
│                                          │
│  📧 Emails scanned: 5,270 / 8,500       │
│  📰 Events extracted: 89                 │
│  👥 Contacts identified: 31              │
│                                          │
│  ⏱️ Est. time remaining: 8 minutes       │
│                                          │
│  [Pause]  [Cancel]                       │
└──────────────────────────────────────────┘
```

#### 3. Completion Dashboard
**Shows after bootup finishes:**
- Total events extracted (by category)
- Contact credibility rankings
- Events linked to active deals
- Network intelligence summary
- "View Events" and "View Network" CTAs

### Performance Considerations

#### Rate Limiting
- Gmail API: 250 quota units per user per second
- Microsoft Graph: 10,000 requests per 10 minutes
- Batch processing to stay under limits

#### Processing Speed
- **Target:** 100-150 emails per minute
- **Factors:**
  - LLM API latency (1-3 seconds per email)
  - Geocoding API calls (0.5 seconds per event)
  - Database writes (negligible with batch inserts)

#### Cost Estimates
- **GPT-4 Turbo:** $0.01 per 1,000 tokens
- **Average email:** ~500 tokens input, ~200 tokens output = ~$0.007 per email
- **10,000 emails:** ~$70 in LLM costs
- **Geocoding:** Free with Google Maps (25,000 requests/month)

### Error Handling

#### Retryable Errors
- LLM timeout → Retry with exponential backoff
- Rate limit hit → Pause and resume after cooldown
- Network error → Retry up to 3 times

#### Non-Retryable Errors
- Invalid OAuth token → Notify user to reconnect
- Account suspended → Stop job, alert user
- Insufficient permissions → Request re-authorization

### Privacy & Security

#### Data Handling
- Emails never stored permanently (only extracted events)
- Email content processed in-memory only
- Option to anonymize contact names (GDPR compliance)
- User can delete all extracted data anytime

#### Permission Scopes
- **Gmail:** `https://www.googleapis.com/auth/gmail.readonly`
- **Outlook:** `Mail.Read` (delegated)
- **Exchange:** Same as Outlook

### Integration Points

#### With Existing Features
1. **Deal Analysis** - Link historical events to deal boundaries
2. **Contact Credibility** - Seed network intelligence scores
3. **Alerts System** - Generate retroactive alerts for critical events
4. **Market Dashboard** - Populate metrics with historical data

### Time Estimates

#### Development Work
- **Email OAuth integration:** 8-12 hours
  - Gmail API setup (3h)
  - Outlook API setup (3h)
  - IMAP fallback (2h)
  - OAuth flow UI (4h)

- **Bootup agent backend:** 16-20 hours
  - Job queue system (4h)
  - Email fetching service (4h)
  - AI extraction pipeline (6h)
  - Progress tracking (2h)
  - Error handling (4h)

- **UI components:** 8-10 hours
  - Email connection page (4h)
  - Progress modal (2h)
  - Completion dashboard (4h)

**Total estimate:** 32-42 hours (4-5 days)

### Future Enhancements

1. **Smart Filtering**
   - Auto-detect real estate contacts
   - Skip obvious spam/marketing emails
   - Prioritize emails from known brokers

2. **Incremental Updates**
   - After bootup, poll for new emails daily
   - Process new emails in real-time
   - Keep network intelligence current

3. **Multi-Account Support**
   - Connect multiple email accounts
   - Merge events from all accounts
   - Unified contact credibility across accounts

4. **Export/Import**
   - Export extracted events as CSV/JSON
   - Import events from other tools (Salesforce, etc.)

---

## 🔌 Data Source Configuration

### Overview
News Intelligence aggregates market events from multiple data sources. Each source has different connection methods, update frequencies, and data formats. This section covers how to configure and manage all data sources.

### Data Source Types

#### 1. **Email Accounts** (Private Intelligence)
**Connection Method:** OAuth 2.0
- **Providers:** Gmail, Outlook, Exchange, IMAP
- **Setup:** User connects via Settings → Email Integration
- **Update Frequency:** Real-time (webhooks) or polling (every 5 minutes)
- **Data Format:** Raw email → AI extraction → Structured events
- **Bootup:** Historical email processing (1-5 years lookback)
- **Cost:** LLM API costs (~$0.007 per email)

**Configuration UI:**
```
┌─────────────────────────────────────────┐
│ Email Accounts                          │
├─────────────────────────────────────────┤
│ ✓ Gmail (leon@example.com)             │
│   Connected • Last sync: 2 mins ago     │
│   [Disconnect] [Settings]               │
│                                         │
│ + Add Another Account                   │
└─────────────────────────────────────────┘
```

---

#### 2. **CoStar** (Commercial Real Estate Data)
**Connection Method:** API Key
- **Endpoint:** CoStar API v3
- **Authentication:** API key + OAuth
- **Update Frequency:** Daily batch updates
- **Data Format:** JSON API responses
- **Coverage:** Property sales, leases, development projects, market trends
- **Cost:** Requires CoStar subscription ($500-2000/month)

**Configuration UI:**
```
┌─────────────────────────────────────────┐
│ CoStar Integration                      │
├─────────────────────────────────────────┤
│ Status: ⚠️ Not Connected                │
│                                         │
│ API Key: [_____________________]       │
│ Client ID: [_____________________]     │
│                                         │
│ Data to Sync:                           │
│ ☑ Property Sales & Transactions        │
│ ☑ Development Projects & Permits        │
│ ☑ Lease Comparables                     │
│ ☐ Market Analytics                      │
│                                         │
│ Sync Frequency: [Daily ▼]              │
│                                         │
│ [Test Connection] [Save]                │
└─────────────────────────────────────────┘
```

**Data Mapping:**
- CoStar transactions → `news_events` (category: transactions)
- CoStar development projects → `news_events` (category: development)
- CoStar properties → Link to `properties` table

---

#### 3. **Existing Deals** (Internal Data)
**Connection Method:** Data Dump or Internal API
- **Source:** User's existing deal pipeline (CSV, Excel, Salesforce, etc.)
- **Initial Setup:** One-time import via CSV/Excel upload
- **Ongoing:** Sync via internal API or manual updates
- **Data Format:** Structured JSON or CSV
- **Coverage:** User's own deals, properties, contacts

**Configuration UI:**
```
┌─────────────────────────────────────────┐
│ Import Existing Deals                   │
├─────────────────────────────────────────┤
│ Method:                                 │
│ ○ Upload CSV/Excel File                │
│ ● Connect to Salesforce                │
│ ○ Connect to HubSpot                    │
│ ○ Manual Entry                          │
│                                         │
│ Salesforce Configuration:               │
│ Instance URL: [_____________________]  │
│ Username: [_____________________]       │
│ Security Token: [_________________]     │
│                                         │
│ Data to Import:                         │
│ ☑ Deals/Opportunities                   │
│ ☑ Properties                            │
│ ☑ Contacts                              │
│ ☑ Tasks & Activities                    │
│                                         │
│ [Test Connection] [Start Import]        │
└─────────────────────────────────────────┘
```

**Import Process:**
1. User uploads CSV or connects CRM
2. System maps columns to internal schema
3. User reviews mapping (deal name → name, address → location, etc.)
4. System imports data and creates records
5. Links imported deals to geographic boundaries
6. Generates initial analysis for each deal

---

#### 4. **Public News Sources** (Market Intelligence)
**Connection Method:** RSS/API/Scraper
- **Providers:** 
  - News APIs (NewsAPI, Google News)
  - RSS feeds (local business journals)
  - Web scrapers (Atlanta Business Chronicle, Bisnow, etc.)
- **Update Frequency:** Hourly or real-time
- **Data Format:** RSS XML or JSON → AI extraction → Structured events
- **Coverage:** Major real estate announcements, company relocations, economic development

**Configuration UI:**
```
┌─────────────────────────────────────────┐
│ Public News Sources                     │
├─────────────────────────────────────────┤
│ ✓ NewsAPI                               │
│   Active • 47 articles today            │
│   API Key: sk-***************          │
│   [Edit] [Disable]                      │
│                                         │
│ ✓ Atlanta Business Chronicle (RSS)     │
│   Active • 12 articles today            │
│   [Edit] [Disable]                      │
│                                         │
│ ✓ Bisnow Atlanta (Scraper)             │
│   Active • 8 articles today             │
│   [Edit] [Disable]                      │
│                                         │
│ + Add New Source                        │
└─────────────────────────────────────────┘
```

---

#### 5. **Government & Public Records** (Permits & Zoning)
**Connection Method:** API or Scraper
- **Sources:**
  - City/county building permit databases
  - SEC filings (for public companies)
  - Zoning board meeting minutes
- **Update Frequency:** Daily or weekly
- **Data Format:** JSON, XML, or scraped HTML
- **Coverage:** Building permits, zoning changes, public hearings

**Configuration UI:**
```
┌─────────────────────────────────────────┐
│ Government Data Sources                 │
├─────────────────────────────────────────┤
│ ✓ Fulton County Building Permits       │
│   Active • Last sync: 1 day ago         │
│   [Configure] [Disable]                 │
│                                         │
│ ○ DeKalb County Building Permits       │
│   Not configured                        │
│   [Setup]                               │
│                                         │
│ ✓ SEC EDGAR (Company Filings)          │
│   Active • Monitoring 23 companies      │
│   [Edit] [Disable]                      │
│                                         │
│ + Add County/City                       │
└─────────────────────────────────────────┘
```

---

#### 6. **Third-Party Integrations** (Optional)
**Connection Method:** OAuth or API Key

**Supported Platforms:**
- **Salesforce** - CRM data (deals, contacts, activities)
- **HubSpot** - CRM data
- **Yardi** - Property management data
- **RealPage** - Property management data
- **LoopNet** - Property listings & sales
- **Zillow** - Residential market data
- **Redfin** - Residential market data

**Configuration UI:**
```
┌─────────────────────────────────────────┐
│ Third-Party Integrations                │
├─────────────────────────────────────────┤
│ Available Integrations:                 │
│                                         │
│ [Salesforce]  [HubSpot]  [Yardi]       │
│ [RealPage]  [LoopNet]  [Zillow]        │
│                                         │
│ Connected:                              │
│ ✓ Salesforce (leon@example.com)        │
│   Last sync: 3 hours ago                │
│   [Disconnect] [Settings]               │
└─────────────────────────────────────────┘
```

---

### Data Source Registry

#### Database Table: `data_sources`
```sql
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Source identification
  source_type VARCHAR(50) NOT NULL, -- email, costar, public_news, government, crm, etc.
  source_name VARCHAR(255) NOT NULL,
  provider VARCHAR(100), -- gmail, outlook, newsapi, salesforce, etc.
  
  -- Connection details
  connection_method VARCHAR(50) NOT NULL, -- oauth, api_key, scraper, import
  credentials JSONB, -- encrypted API keys, tokens, etc.
  connection_status VARCHAR(20) DEFAULT 'disconnected', -- connected, disconnected, error
  
  -- Configuration
  config JSONB, -- provider-specific settings
  sync_frequency VARCHAR(20), -- realtime, hourly, daily, weekly, manual
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Filters & preferences
  filters JSONB, -- what data to sync, date ranges, etc.
  
  -- Performance tracking
  last_sync_at TIMESTAMP,
  last_success_at TIMESTAMP,
  last_error TEXT,
  total_records_synced INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_data_sources_user ON data_sources(user_id);
CREATE INDEX idx_data_sources_type ON data_sources(source_type);
CREATE INDEX idx_data_sources_status ON data_sources(connection_status);
```

---

### Sync Jobs & Queue

#### Database Table: `data_sync_jobs`
```sql
CREATE TABLE data_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  
  -- Job details
  job_type VARCHAR(50) NOT NULL, -- full_sync, incremental, bootup
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
  
  -- Progress tracking
  total_records INTEGER,
  processed_records INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Error handling
  error_log JSONB,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_source ON data_sync_jobs(data_source_id);
CREATE INDEX idx_sync_jobs_status ON data_sync_jobs(status);
CREATE INDEX idx_sync_jobs_created ON data_sync_jobs(created_at DESC);
```

---

### Data Source Configuration Page

**Location:** `/settings/data-sources`

**Layout:**
```
┌────────────────────────────────────────────────┐
│ Data Sources                                   │
├────────────────────────────────────────────────┤
│                                                │
│ Connected Sources (4):                         │
│                                                │
│ 📧 Email Accounts (2)                         │
│    ✓ Gmail (leon@example.com)                │
│    ✓ Outlook (leon@work.com)                 │
│                                                │
│ 📊 CoStar                                      │
│    ⚠️ Not Connected [Setup]                   │
│                                                │
│ 📰 Public News (3 active)                     │
│    ✓ NewsAPI                                  │
│    ✓ Atlanta Business Chronicle               │
│    ✓ Bisnow Atlanta                           │
│                                                │
│ 🏛️ Government Sources (1 active)              │
│    ✓ Fulton County Permits                    │
│                                                │
│ 🔗 Integrations (1 connected)                 │
│    ✓ Salesforce                               │
│                                                │
│ [+ Add Data Source]                            │
└────────────────────────────────────────────────┘
```

---

### Data Flow Architecture

```
┌─────────────────┐
│  Email Accounts │───┐
│  (Gmail/Outlook)│   │
└─────────────────┘   │
                      │
┌─────────────────┐   │    ┌──────────────┐    ┌─────────────┐
│  CoStar API     │───┼───→│  Sync Queue  │───→│ AI Extractor│
└─────────────────┘   │    │  (Background)│    │  (GPT-4)    │
                      │    └──────────────┘    └─────────────┘
┌─────────────────┐   │           │                    │
│  Public News    │───┤           │                    │
│  (RSS/Scrapers) │   │           ↓                    ↓
└─────────────────┘   │    ┌──────────────┐    ┌─────────────┐
                      │    │ Data Mapper  │    │ news_events │
┌─────────────────┐   │    │ & Validator  │───→│   (DB)      │
│  Government     │───┤    └──────────────┘    └─────────────┘
│  (Permits/SEC)  │   │
└─────────────────┘   │
                      │
┌─────────────────┐   │
│  Salesforce/CRM │───┘
└─────────────────┘
```

---

### Configuration Priorities

#### Phase 1: MVP (Week 1-2)
1. ✅ Email accounts (Gmail/Outlook) - **Critical**
2. ✅ Manual deal imports (CSV upload) - **Critical**
3. ⏳ Public news (NewsAPI, RSS feeds) - **High**

#### Phase 2: Professional (Week 3-4)
4. CoStar API integration - **High**
5. Salesforce/CRM sync - **Medium**
6. Government permit databases - **Medium**

#### Phase 3: Enterprise (Month 2+)
7. Additional CRM platforms (HubSpot, etc.) - **Low**
8. Property management systems (Yardi, RealPage) - **Low**
9. Advanced scrapers (Bisnow, local journals) - **Low**

---

### Time Estimates

#### Per Data Source Type:
- **Email OAuth (Gmail/Outlook):** 8-12 hours (covered in Bootup Section)
- **CoStar API:** 12-16 hours
  - API client (4h)
  - Data mapping (4h)
  - Sync job queue (4h)
  - Testing (4h)
- **CSV Import:** 4-6 hours
  - Upload UI (2h)
  - Parser & validator (2h)
  - Data mapping wizard (2h)
- **Public News (RSS/API):** 8-10 hours per source
- **Salesforce OAuth:** 8-12 hours
- **Government Scrapers:** 12-16 hours per source

**Total for Phase 1:** 20-28 hours  
**Total for Phase 2:** 32-44 hours  
**Total for Phase 3:** 60-80 hours

---

## 🎯 Recommended Next Steps - Updated Build Order

### Phase 0: Foundation Setup (20-30 hours, Week 1)
**Goal:** Set up data sources and bootup infrastructure

1. **Data Source Configuration System** (8-10 hours)
   - Build `/settings/data-sources` page
   - Create `data_sources` and `data_sync_jobs` tables
   - Build data source registry backend
   - Add UI for connecting/disconnecting sources

2. **Email Bootup Agent** (12-16 hours) ⭐ **CRITICAL**
   - Gmail/Outlook OAuth integration (8-12h)
   - Email bootup job queue system (4-6h)
   - Progress tracking UI (2-3h)
   - AI extraction pipeline (covered in Phase 1)
   - See **Bootup Section** above for full details

3. **Manual Deal Import** (4-6 hours)
   - CSV/Excel upload UI
   - Data mapper & validator
   - Import wizard with column mapping
   - Link imported deals to geographic boundaries

**Deliverable:** Users can connect email accounts, import existing deals, and configure data sources

---

### Phase 1: Data Ingestion Pipeline (16-24 hours, Week 2)
**Goal:** Get real data flowing into the system

4. **AI Extraction Service** (8-12 hours)
   - GPT-4 integration for email/article parsing
   - Prompt engineering for real estate events
   - Structured JSON response handling
   - Confidence scoring
   - Error handling & retries

5. **Public News Sources** (6-8 hours)
   - NewsAPI integration
   - RSS feed parser (Atlanta Business Chronicle, etc.)
   - Background job scheduler (hourly polling)
   - Event deduplication logic

6. **CoStar API Integration** (Optional, 12-16 hours)
   - API client setup
   - OAuth flow
   - Data sync jobs (property sales, development projects)
   - Map CoStar data to `news_events` table

**Deliverable:** System actively ingesting events from email + public sources (+ optionally CoStar)

---

### Phase 2: Frontend Integration (6-8 hours, Week 3)
**Goal:** Wire frontend to real data

7. **Replace Mock Data with API Calls** (3-4 hours)
   - Event Feed: Wire to `GET /api/v1/news/events`
   - Market Dashboard: Wire to `GET /api/v1/news/dashboard`
   - Network Intelligence: Wire to `GET /api/v1/news/network`
   - Add loading states, error handling, retry logic
   - Add pagination (Load More button)

8. **Build Alerts View** (2-3 hours)
   - Alert list UI with severity badges
   - Mark as read/dismissed functionality
   - Snooze alerts feature
   - Wire to `GET /api/v1/news/alerts` and `PATCH /api/v1/news/alerts/:id`

9. **Horizontal Bar Enhancements** (1 hour)
   - ✅ Create Deal button already wired
   - ✅ War Maps layer toggling working
   - Add search functionality (backend + frontend dropdown)

**Deliverable:** Fully functional News Intelligence feature with real data

---

### Phase 3: Polish & Advanced Features (8-12 hours, Week 4)
**Goal:** Enhance UX and add power features

10. **Search Functionality** (3-4 hours)
    - Backend search endpoint (properties, deals, emails, events)
    - Debounced search input
    - Search results dropdown
    - Navigate to result on click

11. **Contact Credibility Enhancements** (2-3 hours)
    - Show contact email sources in Network view
    - Track corroboration success rate
    - Display specialty categories (employment expert, development expert, etc.)
    - Historical accuracy charts

12. **Event Detail Modal** (2-3 hours)
    - Click event card → Open detailed modal
    - Show full extracted data, source link, corroboration history
    - Link to affected deals/properties
    - "Create Alert" and "Link to Deal" actions

13. **Create Map Modal** (3-4 hours)
    - Let users draw custom map boundaries
    - Name and save custom maps
    - Add to horizontal bar as toggle buttons
    - Persist in database

**Deliverable:** Polished, production-ready News Intelligence system

---

### Phase 4: Scale & Automation (Ongoing)
**Goal:** Make the system self-sustaining

14. **Real-time Email Processing** (4-6 hours)
    - After bootup, poll for new emails every 5 minutes
    - Process incrementally (only new emails since last check)
    - Push notifications for high-priority events

15. **Advanced Scrapers** (12-16 hours per source)
    - Bisnow scraper
    - LoopNet scraper
    - Government permit databases (county-specific)
    - SEC EDGAR filings parser

16. **Auto-Linking Intelligence** (6-8 hours)
    - Automatically link new events to existing deals based on proximity
    - Auto-generate alerts for events near user's deals
    - Smart deal recommendations based on event patterns

17. **Multi-User Collaboration** (8-12 hours)
    - Share events with team members
    - Collaborative event annotations
    - Team-wide contact credibility scores

**Deliverable:** Fully automated intelligence system that learns and improves over time

---

## 📅 Realistic Timeline

### Week 1: Foundation (20-30 hours)
- Data source configuration system
- Email bootup agent
- Manual deal import
- **Milestone:** Users can connect accounts and import data

### Week 2: Data Pipeline (16-24 hours)
- AI extraction service
- Public news sources
- CoStar integration (optional)
- **Milestone:** Events flowing into database from multiple sources

### Week 3: Frontend Integration (6-8 hours)
- Wire UI to backend APIs
- Build Alerts view
- Add search
- **Milestone:** Fully functional News Intelligence feature

### Week 4: Polish (8-12 hours)
- Contact credibility enhancements
- Event detail modals
- Create Map modal
- **Milestone:** Production-ready, polished UX

**Total MVP Estimate:** 50-74 hours (6-9 full working days)

---

## 🚀 Quick Start Path (If Time-Limited)

If you need a faster path to see results:

### Option A: Email-Only MVP (12-16 hours, 2 days)
1. Email OAuth (Gmail only) - 6-8h
2. Email bootup agent (basic version) - 4-6h
3. AI extraction (GPT-4) - 2-4h
4. Wire Event Feed to API - 2h
**Result:** Users can connect Gmail, process historical emails, and see events in UI

### Option B: Demo Data MVP (4-6 hours, 1 day)
1. Seed 50 realistic mock events - 2h
2. Wire all 4 views to API - 2-3h
3. Build Alerts view - 2h
**Result:** Fully functional UI with realistic demo data, ready to show stakeholders

---

## ✅ Critical Path Dependencies

```
Data Source Config ──→ Email Bootup ──→ AI Extraction ──→ Frontend Integration
       ↓                     ↓                ↓                    ↓
   (Week 1)             (Week 1-2)       (Week 2)            (Week 3)
```

**Blocker Analysis:**
- Can't do email bootup without OAuth setup
- Can't extract events without AI service
- Can't show real data in UI without events in database
- **Recommendation:** Start with Data Source Config + Email OAuth in parallel

---

## 📋 Detailed Task Breakdown

### Task 1: Seed Mock Data (1-2 hours)

**File:** `backend/src/database/migrations/009_seed_news_events.sql`

```sql
-- Create 30 sample events covering:
- 8 employment events (Microsoft, Google, Amazon relocations)
- 8 development events (permit approvals, groundbreakings)
- 8 transaction events (property sales, acquisitions)
- 4 government events (zoning changes, tax incentives)
- 2 amenities events (new restaurants, retail)

-- Link some events to existing deals/properties
-- Set realistic impact metrics
-- Vary severities and source types
```

---

### Task 2: Wire Frontend to Backend (2-3 hours)

**File:** `frontend/src/pages/NewsIntelligencePage.tsx`

**Changes:**
```typescript
// Add state for API data
const [events, setEvents] = useState<NewsEvent[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [dashboardData, setDashboardData] = useState<MarketDashboard | null>(null);
const [networkData, setNetworkData] = useState<NetworkIntelligence | null>(null);
const [alerts, setAlerts] = useState<NewsAlert[]>([]);

// Fetch events on mount + category change
useEffect(() => {
  fetchEvents();
}, [selectedCategory]);

const fetchEvents = async () => {
  try {
    setIsLoading(true);
    const response = await newsService.getEvents({
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      limit: 50,
    });
    setEvents(response.data);
  } catch (err) {
    setError('Failed to load events');
  } finally {
    setIsLoading(false);
  }
};

// Fetch dashboard metrics
useEffect(() => {
  if (activeView === 'dashboard') {
    fetchDashboard();
  }
}, [activeView]);

// Fetch network intelligence
useEffect(() => {
  if (activeView === 'network') {
    fetchNetwork();
  }
}, [activeView]);

// Fetch alerts
useEffect(() => {
  if (activeView === 'alerts') {
    fetchAlerts();
  }
}, [activeView]);

// Replace mockEvents with events state everywhere
```

---

### Task 3: Fix Horizontal Bar Buttons (1 hour)

**File:** `frontend/src/components/map/HorizontalBar.tsx`

**Changes:**
```typescript
// Wire Create Deal button
import { CreateDealModal } from '../deal/CreateDealModal';

const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);

<button 
  onClick={() => setIsCreateDealOpen(true)}
  className="..."
>
  <span className="text-lg">➕</span>
  <span>Create Deal</span>
</button>

<CreateDealModal
  isOpen={isCreateDealOpen}
  onClose={() => setIsCreateDealOpen(false)}
  onDealCreated={() => {
    setIsCreateDealOpen(false);
    // Refresh deals list
  }}
/>

// Fix War Maps layer syncing
const toggleWarMaps = () => {
  const newState = !warMapsActive;
  setWarMapsActive(newState);
  
  // Properly sync with MapLayersContext
  layers.forEach(layer => {
    if (newState && !layer.active) {
      toggleLayer(layer.id);
    } else if (!newState && layer.active) {
      toggleLayer(layer.id);
    }
  });
};
```

---

### Task 4: Build Alerts View (2 hours)

**File:** `frontend/src/pages/NewsIntelligencePage.tsx`

**Add AlertsView component:**
```typescript
const renderAlertsView = () => (
  <div className="space-y-3">
    {isLoading ? (
      <div className="text-center py-8 text-gray-500">Loading alerts...</div>
    ) : alerts.length === 0 ? (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-2">🔔</div>
        <p>No alerts yet</p>
      </div>
    ) : (
      alerts.map(alert => (
        <div key={alert.id} className="bg-white rounded-lg border p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-gray-900">{alert.headline}</h3>
            <span className={`px-2 py-1 text-xs rounded ${
              alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
              alert.severity === 'high' ? 'bg-orange-100 text-orange-700' :
              alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {alert.severity}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-3">{alert.summary}</p>
          {alert.suggested_action && (
            <div className="bg-blue-50 p-2 rounded text-sm text-blue-700 mb-2">
              <strong>Suggested Action:</strong> {alert.suggested_action}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => markAlertRead(alert.id)}
              className="text-sm text-blue-600 hover:underline"
            >
              Mark Read
            </button>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="text-sm text-gray-600 hover:underline"
            >
              Dismiss
            </button>
            <button
              onClick={() => snoozeAlert(alert.id, 24)}
              className="text-sm text-gray-600 hover:underline"
            >
              Snooze 24h
            </button>
          </div>
        </div>
      ))
    )}
  </div>
);

const markAlertRead = async (id: string) => {
  await newsService.updateAlert(id, { is_read: true });
  fetchAlerts();
};

const dismissAlert = async (id: string) => {
  await newsService.updateAlert(id, { is_dismissed: true });
  fetchAlerts();
};

const snoozeAlert = async (id: string, hours: number) => {
  await newsService.updateAlert(id, { snooze_hours: hours });
  fetchAlerts();
};
```

---

## 🔧 Technical Debt

### Database Migrations
- Migration 008 not yet run on Replit database
- Need to run: `npm run db:push` or execute SQL manually

### Missing Dependencies
- News ingestion pipeline (future work)
- Email parsing service (future work)
- Public source scrapers (future work)
- AI extraction service (future work)

### Performance Considerations
- Event list pagination (implement offset/limit)
- Map marker clustering for 100+ events
- Real-time updates via WebSocket (future)

---

## 📦 Summary

### What's Built ✅
- Complete UI with split-view layout
- Complete backend API (7 endpoints)
- Complete database schema (7 tables)
- API service layer

### What's Needed 🚧
- Wire frontend to backend (mock → real data)
- Seed test data
- Fix horizontal bar buttons
- Build Alerts view
- Add search functionality

### Time Estimate
- **Phase 1 (Make It Work):** 4-6 hours
- **Phase 2 (Polish It):** 3-4 hours
- **Phase 3 (Scale It):** 1-2 weeks (optional)

### Recommended Next Steps
1. Seed mock data (30 events) - **Start here**
2. Wire frontend Event Feed to API
3. Wire Dashboard metrics to API
4. Fix Create Deal button
5. Build Alerts view

---

**Last Updated:** 2026-02-08 01:26 EST
