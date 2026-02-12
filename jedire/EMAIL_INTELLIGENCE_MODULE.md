# AI-Powered Email Intelligence Module

**Module ID:** 31  
**Category:** Market Intelligence + Collaboration  
**Pricing:** $49/mo (Premium) or included in Developer/Portfolio Manager Bundles  
**Status:** Specification (Future Implementation)

---

## Executive Summary

**The Differentiator:** Bidirectional flow between emails and deal data.

- **Emails → Platform:** Auto-categorize, extract data, link to deals, parse attachments
- **Platform → Emails:** Pre-populate emails with market stats, JEDI Scores, comp data

**Key Insight:** This isn't just "Gmail integration" — it's treating email as an intelligence source that enriches your deal analysis, and using your platform intelligence to make your emails smarter.

---

## 1. AI-Powered Email Intelligence

### 1.1 Auto-Categorization

**Feature:** Automatically categorize incoming emails by deal stage

**Categories:**
- Lead (broker blast, market announcement)
- Qualified (initial outreach response)
- LOI (letter of intent stage)
- Due Diligence (inspection, document requests)
- Closing (final negotiations, closing coordination)
- Post-Close (property management, tenant issues)

**How It Works:**
1. AI scans email content for keywords and context
2. Matches email to existing deals (by property address, deal name, contact name)
3. Tags email with deal stage
4. Links email thread to deal in Deal Tracker

**UI Location:** Email page → Auto-tagged inbox view

```
┌──────────────────────────────────────────────────────┐
│  📧 Inbox                                  [Filters] │
├──────────────────────────────────────────────────────┤
│  🟡 LOI Stage                                        │
│  From: John Smith (Smith & Co Brokers)              │
│  Subject: RE: 123 Peachtree St - Counter Offer      │
│  Deal: Buckhead Tower Development                    │
│  "We can meet at $52M but need 45-day due diligence"│
│  [Open] [Attach to Deal] [Reply with Data]          │
├──────────────────────────────────────────────────────┤
│  🔵 Due Diligence                                    │
│  From: Sarah Johnson (Inspector)                     │
│  Subject: Inspection Report - 456 Main St           │
│  Deal: Midtown Plaza                                 │
│  Attachment: Inspection_Report.pdf ✓ Parsed         │
│  [Open] [View Parsed Data]                          │
└──────────────────────────────────────────────────────┘
```

---

### 1.2 Data Extraction

**Feature:** Extract key data points from emails and surface as structured cards

**Extracted Data Points:**
- Cap rates (e.g., "7.2% cap")
- Asking prices (e.g., "$8.5M", "$450/unit")
- Unit counts (e.g., "120 units")
- Closing dates (e.g., "close by end of Q2")
- Key terms (e.g., "seller financing available")
- Contact info (broker name, phone, email)
- Property specs (year built, sq ft, parking)

**How It Works:**
1. NLP parses email body for structured data
2. Creates data cards with extracted info
3. Suggests linking to existing deal or creating new deal
4. Flags missing data points (e.g., "No cap rate mentioned")

**UI Display:**

```
┌──────────────────────────────────────────────────────┐
│  📊 Extracted Data                                   │
├──────────────────────────────────────────────────────┤
│  Property: 789 Oak Street, Atlanta, GA              │
│  Asking Price: $12.5M                               │
│  Unit Count: 85 units                               │
│  Cap Rate: 6.8%                                     │
│  Year Built: 2018                                   │
│  ───────────────────────────────────────────────    │
│  [Create Deal] [Link to Buckhead Tower]             │
└──────────────────────────────────────────────────────┘
```

**Integration with Modules:**
- Strategy Arbitrage: Use extracted cap rate in analysis
- Financial Modeling: Pre-populate asking price, unit count
- Comp Analysis: Add property as comp

---

### 1.3 Smart Reply Suggestions

**Feature:** AI-generated reply suggestions tuned to RE communication

**Reply Types:**

**1. Counter-Offer Response:**
```
"Thank you for the proposal. Based on our analysis, we'd be 
comfortable at $7.8M with the following terms:
- 30-day due diligence period
- Seller to provide updated rent roll
- Closing within 45 days of DD completion

Our JEDI Score analysis shows the property at a 72, indicating 
moderate upside with proper management. Happy to discuss further."
```

**2. Due Diligence Request:**
```
"Thanks for the offering materials. To proceed with LOI, we'll 
need the following:
- Last 12 months rent roll
- T-12 financials (P&L + balance sheet)
- CapEx schedule for past 3 years
- Current lease forms
- Most recent property inspection (if available)

Timeline: Can you provide by end of week?"
```

**3. LOI Submittal:**
```
"Please find attached our LOI for [Property Name]. Key terms:
- Purchase Price: $[X]
- Earnest Money: $[Y]
- Due Diligence: [N] days
- Closing: [N] days after DD approval

We've completed preliminary analysis (JEDI Score: [Z]) and are 
prepared to move quickly. Available for call to discuss terms."
```

**Customization:**
- User can edit templates
- AI learns from past emails (if user approves)
- Tone selector: Professional / Friendly / Aggressive

---

## 2. Deal Room Integration

### 2.1 One-Click "Attach to Deal"

**Feature:** Link any email thread to a property or deal in pipeline

**Workflow:**
1. Open email about property
2. Click "Attach to Deal" button
3. Search bar appears → Type deal name or address
4. Select deal → Email thread linked
5. Email appears in deal's Communication Log module

**UI:**

```
┌──────────────────────────────────────────────────────┐
│  📧 RE: 123 Peachtree St - Counter Offer            │
│  From: John Smith <john@smithbrokers.com>           │
│  ───────────────────────────────────────────────    │
│  [Reply] [Forward] [🔗 Attach to Deal]              │
└──────────────────────────────────────────────────────┘

[Attach to Deal clicked]

┌──────────────────────────────────────────────────────┐
│  Attach Email to Deal                                │
├──────────────────────────────────────────────────────┤
│  Search: [Buckhead____________________]              │
│                                                      │
│  Results:                                            │
│  ☐ Buckhead Tower Development (Pipeline)            │
│  ☐ Buckhead Plaza (Assets Owned)                    │
│  ☐ Buckhead Mixed-Use Deal (Pipeline)               │
│                                                      │
│  Or: [+ Create New Deal from This Email]            │
│                                                      │
│  [Cancel] [Attach]                                   │
└──────────────────────────────────────────────────────┘
```

**After Attachment:**
- Email appears in deal's Communication Log module
- Deal page shows "3 email threads" badge
- Timeline auto-updates with email timestamp

---

### 2.2 Auto-Generated Deal Timeline

**Feature:** Build deal timeline from email threads

**Timeline Items Extracted:**
- LOI submitted (date from sent email)
- Counter-offer received (date from reply)
- Due diligence start (date from "DD begins" email)
- Inspection scheduled (date from calendar invite)
- Closing date (date from closing confirmation)

**UI:**

```
┌──────────────────────────────────────────────────────┐
│  📅 Deal Timeline (Auto-Generated from Emails)       │
├──────────────────────────────────────────────────────┤
│  Jan 15  📧 Initial inquiry sent                     │
│  Jan 18  📧 Broker response with OM                  │
│  Jan 22  📧 LOI submitted ($12.5M)                   │
│  Jan 25  📧 Counter-offer received ($12.8M)          │
│  Jan 26  📧 Counter accepted, DD starts              │
│  Feb 1   📧 Inspection scheduled (Feb 5)             │
│  Feb 5   📧 Inspection report received               │
│  Feb 7   📧 Final terms negotiated                   │
│  Feb 10  🎯 Closing scheduled                        │
└──────────────────────────────────────────────────────┘
```

**Manual Adjustments:**
- User can edit timeline entries
- Add non-email events (phone calls, site visits)
- Export timeline to PDF for investor reports

---

### 2.3 Contact Tagging

**Feature:** Tag emails with contacts from professional network

**Auto-Tagging:**
- Broker detected → Tagged as "Broker" in deal team
- Lender mentioned → Tagged as "Lender" in deal team
- Property manager CC'd → Tagged as "PM" in deal team
- Attorney on thread → Tagged as "Legal" in deal team

**Deal Team Directory Auto-Population:**
```
┌──────────────────────────────────────────────────────┐
│  👥 Deal Team (Auto-Populated from Emails)           │
├──────────────────────────────────────────────────────┤
│  Broker: John Smith (Smith & Co)                     │
│  📧 john@smithbrokers.com | 📞 (404) 555-1234       │
│  Source: Email thread (Jan 15, 2026)                │
│  ───────────────────────────────────────────────    │
│  Lender: Sarah Johnson (Bank of America)            │
│  📧 sarah.j@bofa.com | 📞 (404) 555-5678            │
│  Source: Email thread (Jan 22, 2026)                │
└──────────────────────────────────────────────────────┘
```

**Contact Management:**
- Click contact → See all deals they're involved in
- Export contact list for CRM
- Suggest connections (e.g., "This broker also represented 3 other deals in Buckhead")

---

## 3. Document Handling

### 3.1 Auto-Parse Attachments

**Feature:** Detect and parse common RE documents

**Supported Document Types:**
1. **Offering Memorandums (OMs)**
   - Extract: Property address, unit count, rent roll, financials
   - Feed to: Strategy Arbitrage module
   
2. **Rent Rolls**
   - Extract: Unit details, rent amounts, lease expirations
   - Feed to: Financial Modeling, Strategy Arbitrage

3. **T-12 Financials**
   - Extract: Income, expenses, NOI, variance
   - Feed to: Financial Modeling, Budget vs Actual

4. **Inspection Reports**
   - Extract: Issues found, estimated costs
   - Feed to: Risk Analysis, Development Budget

**Parsing Flow:**
```
Email arrives with attachment
    ↓
AI detects document type (OM, rent roll, T-12, etc.)
    ↓
Parse document (OCR + structured data extraction)
    ↓
Create structured data card
    ↓
Suggest feed to relevant module
    ↓
User approves → Data flows to Strategy Arbitrage/Financial Modeling
```

**UI:**

```
┌──────────────────────────────────────────────────────┐
│  📎 Attachment Detected: OM_BuckheadTower.pdf        │
├──────────────────────────────────────────────────────┤
│  Document Type: Offering Memorandum ✓                │
│  Parsed Data:                                        │
│  • Property: Buckhead Tower, 123 Peachtree St       │
│  • Units: 120                                        │
│  • Avg Rent: $2,100/unit                            │
│  • NOI: $3.2M                                        │
│  • Cap Rate: 6.8%                                   │
│  ───────────────────────────────────────────────    │
│  [Feed to Strategy Arbitrage] [Create Deal]         │
└──────────────────────────────────────────────────────┘
```

---

### 3.2 Version Tracking

**Feature:** Flag when newer versions of documents arrive

**Scenario:**
- OM v1 received Jan 15
- OM v2 received Jan 22 (updated financials)
- System detects difference, flags update

**UI:**

```
┌──────────────────────────────────────────────────────┐
│  ⚠️ Updated Document Detected                       │
├──────────────────────────────────────────────────────┤
│  OM_BuckheadTower_v2.pdf                             │
│  Previous Version: Jan 15, 2026                      │
│  New Version: Jan 22, 2026                           │
│                                                      │
│  Changes Detected:                                   │
│  • NOI increased: $3.2M → $3.4M (+6%)               │
│  • Cap rate adjusted: 6.8% → 7.0%                  │
│  • 3 units added to rent roll                       │
│  ───────────────────────────────────────────────    │
│  [View Diff] [Update Deal Data] [Ignore]            │
└──────────────────────────────────────────────────────┘
```

**Version History:**
- All document versions stored
- Compare side-by-side
- Timeline shows when each version arrived

---

## 4. Alerts & Follow-ups

### 4.1 AI-Suggested Follow-ups

**Feature:** Remind when emails go unanswered

**Configuration:**
- Set threshold per deal stage (e.g., LOI = 3 days, DD = 5 days)
- Configure notification method (email, in-app, SMS)

**Alert Example:**

```
┌──────────────────────────────────────────────────────┐
│  🔔 Follow-up Suggested                              │
├──────────────────────────────────────────────────────┤
│  No response from John Smith (Smith & Co Brokers)    │
│  on Buckhead Tower Development                       │
│                                                      │
│  Original Email: "LOI submitted" (Jan 22)            │
│  Days Since: 5 days                                  │
│  ───────────────────────────────────────────────    │
│  Suggested Action:                                   │
│  "Hi John, following up on our LOI submitted last   │
│  week. Any feedback from the seller? Happy to jump  │
│  on a call to discuss terms."                        │
│  ───────────────────────────────────────────────    │
│  [Send Follow-up] [Snooze 2 Days] [Dismiss]         │
└──────────────────────────────────────────────────────┘
```

---

### 4.2 Deadline Extraction

**Feature:** Auto-create calendar events and tasks from email deadlines

**Extracted Deadlines:**
- "LOI due by Friday" → Calendar event Friday + task with reminder
- "Inspection scheduled for Feb 5 at 10am" → Calendar event + notification
- "Closing on March 1" → Calendar event + task checklist (closing prep)

**UI:**

```
┌──────────────────────────────────────────────────────┐
│  📅 Deadline Detected                                │
├──────────────────────────────────────────────────────┤
│  "LOI due by Friday, Jan 26"                         │
│  Deal: Buckhead Tower Development                    │
│  ───────────────────────────────────────────────    │
│  Suggested Actions:                                  │
│  ☑️ Create calendar event (Jan 26, 5pm)             │
│  ☑️ Create task: "Submit LOI"                       │
│  ☑️ Set reminder: 1 day before                      │
│  ───────────────────────────────────────────────    │
│  [Confirm] [Edit] [Skip]                            │
└──────────────────────────────────────────────────────┘
```

---

## 5. Collaboration

### 5.1 Forward-to-JEDI

**Feature:** Dedicated email address that ingests broker blasts and market reports

**Email Address:** `your-deal@jedire.com` (custom per user)

**How It Works:**
1. User forwards broker blast to `your-deal@jedire.com`
2. System parses email for properties/deals
3. Auto-creates cards in News & Research module
4. If property address found, suggests linking to existing deal or creating new

**Use Cases:**
- Broker sends weekly market update → Auto-ingested as market report
- Broker blast with 10 properties → Creates 10 cards, suggests matches to your pipeline
- News article about market → Extracted and tagged to relevant submarkets

**UI (News & Research Module):**

```
┌──────────────────────────────────────────────────────┐
│  📰 News & Research (Auto-Ingested)                  │
├──────────────────────────────────────────────────────┤
│  🆕 Broker Blast - Smith & Co (Feb 7)               │
│  Source: john@smithbrokers.com → your-deal@jedire.com│
│  ───────────────────────────────────────────────    │
│  5 New Listings in Buckhead:                         │
│  • 789 Oak St - 45 units, $6.5M (7.2% cap)         │
│  • 101 Maple Ave - 32 units, $4.2M (6.9% cap)      │
│  • 555 Pine Rd - 60 units, $9.8M (7.5% cap)        │
│  ───────────────────────────────────────────────    │
│  [Create Deals] [Add to Custom Map] [Archive]       │
└──────────────────────────────────────────────────────┘
```

---

### 5.2 Shared Inbox View

**Feature:** Team members see communication history without CC chains

**How It Works:**
- Email threads linked to deals are visible to all team members on that deal
- No need to CC everyone on every email
- Team members can add notes/comments on email threads

**UI:**

```
┌──────────────────────────────────────────────────────┐
│  💬 Communication Log - Buckhead Tower Development   │
├──────────────────────────────────────────────────────┤
│  📧 Email Thread: LOI Negotiation (5 messages)       │
│  Participants: You, John Smith (Broker)              │
│  Last Update: Feb 7, 10:32am                         │
│  ───────────────────────────────────────────────    │
│  💬 Team Note (Leon D, Feb 7 11:00am):              │
│  "Counter at $12.8M is acceptable. Let's proceed."   │
│  ───────────────────────────────────────────────    │
│  📧 Email Thread: Due Diligence Docs (3 messages)    │
│  Participants: You, Sarah Johnson (PM)               │
│  Last Update: Feb 6, 3:15pm                          │
│  ───────────────────────────────────────────────    │
│  [+ Add Note] [View All Threads]                     │
└──────────────────────────────────────────────────────┘
```

**Benefits:**
- No more "Can you forward me that email chain?"
- Full transparency on deal communications
- Team can collaborate asynchronously

---

## 6. Quick Actions from Map Context

### 6.1 Context-Aware Email Compose

**Feature:** When viewing market on map, pull up related email threads

**Scenario:**
1. User zooms to Buckhead on map
2. Clicks "Email" quick action
3. System shows all email threads for properties in Buckhead
4. User can compose new email pre-populated with Buckhead market data

**UI:**

```
[User viewing Buckhead area on map, clicks "Email" button]

┌──────────────────────────────────────────────────────┐
│  📧 Emails Related to Buckhead                       │
├──────────────────────────────────────────────────────┤
│  3 Active Email Threads:                             │
│  • Buckhead Tower Development (LOI stage)            │
│  • Buckhead Plaza (Due Diligence)                    │
│  • 789 Oak St (Lead)                                 │
│  ───────────────────────────────────────────────    │
│  [View Threads] [Compose New]                        │
└──────────────────────────────────────────────────────┘

[User clicks "Compose New"]

┌──────────────────────────────────────────────────────┐
│  ✉️ New Email - Buckhead Context                    │
├──────────────────────────────────────────────────────┤
│  To: [_____________________]                         │
│  Subject: [_________________]                        │
│  ───────────────────────────────────────────────    │
│  [Pre-populated market data available]:              │
│  • Buckhead Market Stats                            │
│  • JEDI Scores for active deals                     │
│  • Recent comps                                      │
│  ───────────────────────────────────────────────    │
│  [Insert Market Stats] [Insert JEDI Score] [Send]   │
└──────────────────────────────────────────────────────┘
```

---

### 6.2 Pre-Populated Data

**Feature:** Compose emails with platform data auto-inserted

**Available Data:**
- Market stats (Buckhead: Avg rent $2,100, Supply 68%, Demand STRONG)
- JEDI Score results ("Our analysis shows a JEDI Score of 78, indicating strong opportunity")
- Comp data ("Recent comps: 3 properties sold in Q4 at avg $450/unit")
- Strategy Arbitrage results ("Value-add strategy projects 18% IRR over 3 years")

**Example Email (Auto-Generated):**

```
Subject: Investment Opportunity - Buckhead Tower

Hi [Broker Name],

We've completed our analysis on Buckhead Tower and are interested 
in moving forward. Key findings from our JEDI Score analysis:

• JEDI Score: 78 (Strong Opportunity)
• Market Context: Buckhead showing strong demand (+4.2% rent growth YoY)
• Supply: 68% of capacity (undersupplied)
• Strategy: Value-add approach projects 18% IRR

Our Strategy Arbitrage module analyzed 4 investment strategies, 
with value-add showing the highest return potential. We're prepared 
to submit an LOI in the $12-12.5M range.

Available for a call this week to discuss terms.

Best,
[Your Name]

---
Powered by JEDI RE Intelligence
```

---

## 7. Integration with Existing Modules

### How Email Intelligence Feeds Other Modules

**Strategy Arbitrage:**
- Parsed OM data → Pre-populates financial assumptions
- Extracted cap rate → Used in comp analysis
- Timeline data → Informs hold period assumptions

**Financial Modeling:**
- Rent roll from email → Populates unit mix
- T-12 financials → Pre-fills expense assumptions
- Debt terms from lender email → Financing assumptions

**Comp Analysis:**
- Broker blast properties → Added as comps
- Market reports → Updates market data layer

**Deal Tracker:**
- Email threads → Communication log
- Deadlines → Task creation
- Timeline → Auto-generated from emails

**Market Intelligence:**
- Broker blasts → News feed
- Market reports → Market Data Layer updates
- Submarket trends → Intelligence Layer enrichment

**Risk Analysis:**
- Inspection reports → Risk flags
- Attorney emails → Legal risk tracking
- Lender concerns → Financing risk

---

## 8. Technical Architecture

### Backend Services

**EmailService:**
- Parse incoming emails (IMAP/SMTP)
- Extract structured data (NLP/ML)
- Match emails to deals (fuzzy matching)
- Version tracking for attachments

**DocumentParserService:**
- OCR for PDFs
- Structured data extraction (rent rolls, financials)
- Version diffing
- Feed to relevant modules

**AIReplyService:**
- Generate smart reply suggestions
- Learn from user edits (if approved)
- Tone customization

**ContactService:**
- Extract contacts from emails
- Auto-populate deal team
- Relationship mapping

### Database Schema

**New Tables:**
```sql
CREATE TABLE email_threads (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id),
  subject TEXT,
  participants TEXT[],
  first_message_at TIMESTAMP,
  last_message_at TIMESTAMP,
  message_count INTEGER,
  stage VARCHAR(50) -- LOI, DD, Closing, etc.
);

CREATE TABLE email_messages (
  id UUID PRIMARY KEY,
  thread_id UUID REFERENCES email_threads(id),
  from_email TEXT,
  from_name TEXT,
  sent_at TIMESTAMP,
  body TEXT,
  extracted_data JSONB -- Cap rates, prices, etc.
);

CREATE TABLE email_attachments (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES email_messages(id),
  filename TEXT,
  document_type VARCHAR(50), -- OM, rent_roll, T12, inspection
  parsed_data JSONB,
  version INTEGER,
  previous_version_id UUID REFERENCES email_attachments(id)
);

CREATE TABLE email_contacts (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id),
  name TEXT,
  email TEXT,
  role VARCHAR(50), -- broker, lender, PM, legal
  source_email_id UUID REFERENCES email_messages(id)
);
```

### API Endpoints

```typescript
// Email Intelligence
POST   /api/v1/email/parse           // Parse incoming email
GET    /api/v1/email/threads         // List email threads
POST   /api/v1/email/attach-to-deal  // Link email to deal
GET    /api/v1/email/extracted-data  // Get structured data from email
POST   /api/v1/email/smart-reply     // Generate smart reply

// Document Handling
POST   /api/v1/documents/parse       // Parse attachment
GET    /api/v1/documents/versions    // Version history
POST   /api/v1/documents/feed-to-module // Feed parsed data to module

// Alerts & Follow-ups
GET    /api/v1/email/follow-ups      // Get suggested follow-ups
POST   /api/v1/email/deadlines       // Create tasks from deadlines

// Collaboration
POST   /api/v1/email/forward-to-jedi // Ingest forwarded email
GET    /api/v1/email/shared-inbox    // Team inbox view

// Quick Actions
GET    /api/v1/email/by-location     // Emails for map area
POST   /api/v1/email/compose-with-data // Pre-populate email
```

---

## 9. Pricing & Packaging

### Standalone Module
**Price:** $49/mo  
**Includes:**
- Auto-categorization (1,000 emails/month)
- Data extraction (unlimited)
- Smart replies (50 generations/month)
- Document parsing (100 docs/month)
- Follow-up alerts (unlimited)

### Bundle Inclusion
**Developer Bundle ($149/mo):** Included  
**Portfolio Manager Bundle ($199/mo):** Included + higher limits

### Add-Ons
- **High-Volume Email:** +$29/mo (5,000 emails/month)
- **Advanced Document Parsing:** +$19/mo (500 docs/month)
- **Unlimited Smart Replies:** +$9/mo

---

## 10. Success Metrics

**Adoption Metrics:**
- % of deals with linked email threads
- % of emails auto-categorized correctly
- % of parsed documents feeding into modules

**Efficiency Metrics:**
- Time saved vs manual data entry (target: 5 hours/week)
- Follow-up response rate improvement (target: +30%)
- Deal timeline completeness (target: >80% auto-generated)

**Revenue Metrics:**
- Module attach rate (target: 40% of paid users)
- Upgrade rate to high-volume plan (target: 15%)

---

## 11. Implementation Roadmap

### Phase 1: Core Email Intelligence (4 weeks)
- Week 1-2: Email parsing, auto-categorization
- Week 3: Data extraction, structured cards
- Week 4: Attach to deal, timeline generation

### Phase 2: Document Handling (3 weeks)
- Week 5-6: OM/rent roll/T-12 parsing
- Week 7: Version tracking, feed to modules

### Phase 3: Smart Features (3 weeks)
- Week 8: Smart reply generation
- Week 9: Follow-up alerts, deadline extraction
- Week 10: Contact auto-tagging

### Phase 4: Collaboration (2 weeks)
- Week 11: Forward-to-JEDI, shared inbox
- Week 12: Quick actions from map

**Total:** 12 weeks to complete Email Intelligence module

---

## 12. Competitive Advantage

**Why This Beats "Just Gmail":**

1. **Bidirectional Intelligence:**
   - Gmail: One-way (email in, no enrichment out)
   - JEDI RE: Emails enrich platform data, platform enriches emails

2. **RE-Specific:**
   - Gmail: Generic email
   - JEDI RE: Tuned for LOI language, OM parsing, broker comms

3. **Integrated Workflow:**
   - Gmail: Separate from deal analysis
   - JEDI RE: Email → Deal → Strategy Arbitrage → Reply (all in one flow)

4. **Team Collaboration:**
   - Gmail: CC chains
   - JEDI RE: Shared inbox per deal, no CC needed

5. **Intelligence Extraction:**
   - Gmail: Manual reading
   - JEDI RE: Auto-extract cap rates, prices, deadlines → feed to AI agents

**Result:** Email becomes an intelligence source, not just a communication tool.

---

**Status:** Specification Complete  
**Next:** Review with Leon, prioritize for Phase 2-3 implementation  
**Module ID:** 31 (AI-Powered Email Intelligence)
