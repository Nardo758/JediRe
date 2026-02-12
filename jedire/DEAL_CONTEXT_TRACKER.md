# Deal Context Tracker

**Location:** Every Deal (Pipeline) & Property (Assets Owned)  
**Purpose:** Single source of truth for everything related to a deal or property  
**Status:** Core Feature (Integrates Email Agent + Tasks + All Modules)

---

## Executive Summary

**The Single Source of Truth:** Instead of piecing together what happened from scattered emails, spreadsheets, and memory, everything lives in one place and is mostly assembled automatically by the agents.

**Key Insight:** Deal Context Tracker is the **living record** of:
- Everything that **happened** (Activity Timeline)
- Everything that **is happening** (Tasks, Communications)
- Everything that **needs to happen** (Key Dates, Dependencies)

**Result:** Open any deal or property → See complete context instantly.

---

## Architecture

**Deal Context Tracker has 7 Sections:**

1. **Activity Timeline** - Chronological feed of all events
2. **Document Vault** - Auto-organized attachments with version tracking
3. **Contact Map** - Everyone involved (roles, responsiveness)
4. **Financial Snapshot** - Current vs projected (NOI, returns, budget)
5. **Key Dates & Milestones** - Deal lifecycle visual timeline
6. **Decision Log** - Why decisions were made (linked to data)
7. **Risk Flags** - AI-surfaced concerns + agent alerts

**Flow:**
```
Email/Agent Alert/User Action
    ↓
Creates entry in Activity Timeline
    ↓
Updates relevant sections (Docs, Contacts, Financials, Dates, Decisions, Risks)
    ↓
Deal Context Tracker = Always Current
```

---

## 1. Activity Timeline

**Purpose:** Chronological feed of **everything** that's happened on this deal

### 1.1 Event Types

| Event Type | Icon | Example |
|------------|------|---------|
| Email Sent | 📧 | LOI submitted to broker |
| Email Received | 📧 | Counter-offer received |
| Task Created | ✅ | Submit Phase I Environmental |
| Task Completed | ✅ | Phase I submitted (Feb 15) |
| Document Uploaded | 📎 | OM_Buckhead.pdf attached |
| Agent Alert | 🤖 | Supply Agent: 200 units permitted nearby |
| Note Added | 📝 | User note: "Seller motivated due to 1031 deadline" |
| Status Change | 🔄 | Deal stage: LOI → Due Diligence |
| Financial Update | 💰 | NOI updated: $3.2M → $3.4M |
| Team Member Added | 👤 | Sarah Johnson (Lender) joined deal team |
| Milestone Hit | 🎯 | PSA executed |
| Risk Flagged | ⚠️ | Lease expiration concentration detected |

### 1.2 UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  📅 Activity Timeline                    [Filters ▼] [Export]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Feb 7, 2026  10:32 AM                                           │
│  📧 Email Received: Counter-offer from John Smith                │
│  "$12.8M with 45-day due diligence"                              │
│  [View Email] [Create Task]                                      │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Feb 6, 2026  3:15 PM                                            │
│  ✅ Task Completed: Request updated rent roll                    │
│  Completed by: Leon D                                            │
│  [View Task Details]                                             │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Feb 5, 2026  2:10 PM                                            │
│  🤖 Agent Alert: Supply Agent                                    │
│  "200 new units permitted in Buckhead (within 1 mile)"          │
│  [View Analysis] [Create Task to Review Impact]                 │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Feb 4, 2026  11:00 AM                                           │
│  📎 Document Uploaded: Phase_I_Environmental.pdf                 │
│  Uploaded by: John Smith (Broker)                                │
│  Parsed data: ✅ No environmental concerns flagged               │
│  [View Document] [Feed to Risk Analysis Module]                 │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Feb 3, 2026  9:45 AM                                            │
│  📧 Email Sent: LOI submitted                                    │
│  Offer: $12.5M | DD Period: 30 days | Closing: 45 days after DD │
│  [View Email Thread]                                             │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  [Load More...]                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Filters

**Filter by Event Type:**
- 📧 Emails Only
- ✅ Tasks Only
- 📎 Documents Only
- 🤖 Agent Alerts Only
- 📝 Notes Only
- 💰 Financial Updates Only

**Filter by Date Range:**
- Last 7 days
- Last 30 days
- This Quarter
- Custom range

**Filter by Person:**
- By user
- By contact
- By team member

---

## 2. Document Vault

**Purpose:** All attachments auto-organized with version tracking

### 2.1 Document Categories

**Auto-Categorization:**

| Category | Documents | Source |
|----------|-----------|--------|
| **Offering Materials** | OM, marketing brochure, property photos | Email attachments |
| **Financial** | Rent roll, T-12, P&L, balance sheet, budget | Email attachments + parsed |
| **Due Diligence** | Phase I, inspection report, survey, title search | Email attachments |
| **Legal** | PSA, LOI, addendums, entity docs | Email attachments |
| **Financing** | Loan application, appraisal, lender term sheet | Email attachments |
| **Property Management** | Lease forms, tenant notices, maintenance logs | Email attachments (Assets Owned) |

### 2.2 UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  📁 Document Vault                       [Search] [Upload] [v2]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Offering Materials (3 documents)                                │
│  📄 OM_BuckheadTower_v2.pdf          Jan 22, 2026  ✅ Parsed    │
│     Version 2 (Previous: v1 - Jan 15)                            │
│     Source: Email from John Smith                                │
│     [View] [Download] [View Changes from v1]                     │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Financial (5 documents)                                         │
│  📊 Rent_Roll_2026-01.xlsx           Jan 28, 2026  ✅ Parsed    │
│     120 units | Avg rent: $2,100 | Occupancy: 94%               │
│     Source: Email from Property Manager                          │
│     [View] [Feed to Financial Modeling Module]                   │
│                                                                   │
│  📊 T12_Financials.pdf                Feb 1, 2026   ✅ Parsed    │
│     NOI: $3.4M | Expenses: $1.8M                                │
│     Source: Email from Broker                                    │
│     [View] [Feed to Strategy Arbitrage Module]                   │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Due Diligence (2 documents)                                     │
│  📋 Phase_I_Environmental.pdf         Feb 4, 2026   ✅ Parsed    │
│     Status: No environmental concerns                            │
│     Source: Email from Environmental Firm                        │
│     [View] [Feed to Risk Analysis Module]                        │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  [+ Upload Document]                                             │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Version Tracking

**When New Version Arrives:**

```
┌──────────────────────────────────────────────────────────────────┐
│  🔔 Updated Document Detected                                    │
├──────────────────────────────────────────────────────────────────┤
│  OM_BuckheadTower_v2.pdf received (Jan 22, 2026)                │
│  Previous version: v1 (Jan 15, 2026)                             │
│  ───────────────────────────────────────────────────────────────│
│  Changes Detected:                                               │
│  • NOI increased: $3.2M → $3.4M (+6%)                           │
│  • Cap rate adjusted: 6.8% → 7.0%                               │
│  • 3 units added to rent roll (117 → 120)                       │
│  • Updated financials (Q4 2025 actual vs projected)             │
│  ───────────────────────────────────────────────────────────────│
│  [View Side-by-Side Comparison] [Update Deal Data] [Ignore]     │
└──────────────────────────────────────────────────────────────────┘
```

### 2.4 Completion Checklist

**Shows Which Documents You Have vs Need:**

```
┌──────────────────────────────────────────────────────────────────┐
│  📋 DD Document Checklist (Current Stage: Due Diligence)        │
├──────────────────────────────────────────────────────────────────┤
│  ✅ Offering Memorandum          (Received Jan 15)               │
│  ✅ Rent Roll                    (Received Jan 28)               │
│  ✅ T-12 Financials              (Received Feb 1)                │
│  ✅ Phase I Environmental        (Received Feb 4)                │
│  ⚪ Property Inspection Report   (Outstanding - Due Feb 12)      │
│  ⚪ Title Search                 (Outstanding - Due Feb 15)      │
│  ⚪ Survey                        (Outstanding - Due Feb 15)      │
│  ⚪ Appraisal                    (Outstanding - Due Feb 20)      │
│  ⚪ Insurance Quote              (Outstanding)                   │
│  ───────────────────────────────────────────────────────────────│
│  Progress: 4/9 documents received (44%)                          │
│  [Create Task: Request Missing Documents]                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Contact Map

**Purpose:** Everyone involved in the deal with responsiveness tracking

### 3.1 Contact Roles

**Auto-Tagged from Emails:**

| Role | Typical Contact | Auto-Detection |
|------|----------------|----------------|
| **Broker** | Listing broker, buyer broker | Email signature, domain |
| **Lender** | Bank, mortgage broker | Email content ("loan", "financing") |
| **Attorney** | Real estate attorney | Email signature, domain (.law) |
| **Inspector** | Property inspector, engineer | Email content ("inspection", "report") |
| **Property Manager** | Current PM, new PM | Email content ("tenants", "leases") |
| **Equity Partner** | Investor, JV partner | Email content ("equity", "investment") |
| **Appraiser** | Licensed appraiser | Email content ("appraisal", "valuation") |
| **Environmental** | Phase I/II firm | Email content ("environmental", "Phase I") |
| **Contractor** | GC, rehab contractor | Email content ("construction", "bid") |

### 3.2 UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  👥 Contact Map                          [+ Add Contact] [Export]│
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Broker                                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ John Smith                                                  │ │
│  │ Smith & Co Real Estate Advisors                            │ │
│  │ 📧 john@smithbrokers.com | 📞 (404) 555-1234              │ │
│  │ ───────────────────────────────────────────────────────── │ │
│  │ Source: Email thread (Jan 15, 2026)                       │ │
│  │ Last Communication: Feb 7, 2026 (2 days ago)              │ │
│  │ Responsiveness: ⭐⭐⭐⭐⭐ (Avg response: 4 hours)         │ │
│  │ Email Threads: 8 threads | Tasks: 2 open                  │ │
│  │ [View Email History] [View Tasks] [Send Email]            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Lender                                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Sarah Johnson                                               │ │
│  │ Bank of America Commercial Real Estate                     │ │
│  │ 📧 sarah.j@bofa.com | 📞 (404) 555-5678                   │ │
│  │ ───────────────────────────────────────────────────────── │ │
│  │ Source: Email thread (Jan 22, 2026)                       │ │
│  │ Last Communication: Feb 5, 2026 (4 days ago)              │ │
│  │ Responsiveness: ⭐⭐⭐⭐ (Avg response: 12 hours)          │ │
│  │ Email Threads: 3 threads | Tasks: 1 open                  │ │
│  │ [View Email History] [View Tasks] [Send Email]            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  [+ Add Another Contact]                                         │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Responsiveness Scoring

**Algorithm:**
```typescript
function calculateResponsiveness(contact: Contact): Score {
  const emailThreads = getEmailThreads(contact);
  const responseTimes = emailThreads
    .filter(thread => thread.replies.length > 0)
    .map(thread => {
      const sent = thread.messages[0].sentAt;
      const reply = thread.replies[0].sentAt;
      return (reply - sent) / (1000 * 60 * 60); // Hours
    });
  
  const avgResponseTime = average(responseTimes);
  
  if (avgResponseTime < 4) return 5; // ⭐⭐⭐⭐⭐
  if (avgResponseTime < 12) return 4; // ⭐⭐⭐⭐
  if (avgResponseTime < 24) return 3; // ⭐⭐⭐
  if (avgResponseTime < 48) return 2; // ⭐⭐
  return 1; // ⭐
}
```

### 3.4 Contact Insights

**Click Contact → See:**
- All email threads
- All tasks involving this contact
- All deals they're involved in
- Suggest connections ("This broker also worked on 3 other Buckhead deals")

---

## 4. Financial Snapshot

**Purpose:** Current vs projected financials at a glance

### 4.1 Pipeline Deals (Pre-Acquisition)

```
┌──────────────────────────────────────────────────────────────────┐
│  💰 Financial Snapshot                   [Updated: Feb 7, 2026]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Pricing                                                         │
│  Asking Price:         $13.0M                                    │
│  Your Offer:           $12.5M  (96% of ask)                     │
│  Counter:              $12.8M  (98% of ask)                     │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Strategy Arbitrage Results (Last Run: Feb 5, 2026)             │
│  JEDI Score:           78  (STRONG OPPORTUNITY)                 │
│  Best Strategy:        Value-Add                                 │
│  Projected IRR:        18.2%                                     │
│  Equity Multiple:      2.1x                                      │
│  Hold Period:          3 years                                   │
│  [View Full Analysis →]                                          │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Financing (Lender Quotes)                                       │
│  Bank of America:      $9.6M @ 6.5% (75% LTV)                   │
│  Wells Fargo:          $9.0M @ 6.25% (70% LTV)                  │
│  Preferred:            Bank of America (lower rate)              │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Operating Assumptions (from T-12)                               │
│  Current NOI:          $3.4M                                     │
│  Projected NOI (Y3):   $4.1M  (+20.6%)                          │
│  Current Cap Rate:     7.0%                                      │
│  Exit Cap Rate:        6.5%  (assumed)                          │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Assets Owned (Post-Acquisition)

```
┌──────────────────────────────────────────────────────────────────┐
│  💰 Financial Snapshot                   [Updated: Feb 7, 2026]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Performance vs Budget (YTD)                                     │
│  NOI Actual:           $950K                                     │
│  NOI Budget:           $900K                                     │
│  Variance:             +$50K  (+5.6%)  ✅                        │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Occupancy Trend                                                 │
│  Current:              94%                                       │
│  Last Month:           92%                                       │
│  Last Year:            89%                                       │
│  Market Avg:           91%                                       │
│  Trend:                📈 Improving                              │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Rent Roll Summary                                               │
│  Total Units:          120                                       │
│  Occupied:             113  (94%)                                │
│  Vacant:               7    (6%)                                 │
│  Avg Rent:             $2,100/unit                              │
│  Market Rent:          $2,150/unit                              │
│  Rent Gap:             -$50/unit  (2.3% below market)           │
│  [View Full Rent Roll →]                                         │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  CapEx Tracker                                                   │
│  Budget (Annual):      $350/unit  ($42K total)                  │
│  Spent YTD:            $18K                                      │
│  Remaining:            $24K                                      │
│  Major Items Pending:  HVAC replacement Unit 3B ($8K)           │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Auto-Update Triggers

**Financial Snapshot updates when:**
- New T-12 received → NOI updates
- Rent roll updated → Occupancy updates
- Strategy Arbitrage re-run → Projected returns update
- Lender quote received → Financing section updates
- Budget vs Actual report uploaded → Variance updates

---

## 5. Key Dates & Milestones

**Purpose:** Visual timeline of where you are in the deal lifecycle

### 5.1 Pipeline Deal Timeline

```
┌──────────────────────────────────────────────────────────────────┐
│  📅 Key Dates & Milestones                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ●━━━━●━━━━●━━━━●━━━━○━━━━○━━━━○                               │
│  │     │     │     │     │     │     │                           │
│  Lead  LOI   DD   PSA  Fin  Close Review                        │
│  ✅    ✅    🔵   ⚪   ⚪   ⚪                                     │
│                                                                   │
│  ✅ Lead Qualified        Jan 15, 2026                           │
│  ✅ LOI Submitted         Jan 22, 2026                           │
│  ✅ Counter Accepted      Jan 25, 2026                           │
│  🔵 Due Diligence Started Feb 1, 2026  (In Progress)            │
│     Ends: March 2, 2026 (23 days remaining)                     │
│  ⚪ PSA Execution         Target: Feb 25, 2026                   │
│  ⚪ Financing Commitment  Target: Feb 28, 2026                   │
│  ⚪ Closing               Target: March 15, 2026                 │
│  ⚪ Post-Close Review     Target: March 20, 2026                 │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Critical Dates (Auto-Extracted from Emails)                    │
│  Feb 12  Property Inspection                                     │
│  Feb 15  Phase I Environmental due                               │
│  Feb 20  Appraisal due                                           │
│  Feb 25  PSA execution deadline                                  │
│  March 2 Due diligence period ends                               │
│  March 15 Closing date                                           │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  [+ Add Milestone] [Edit Dates] [Export Timeline]               │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Assets Owned Timeline

```
┌──────────────────────────────────────────────────────────────────┐
│  📅 Key Dates & Milestones                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Acquisition: March 15, 2024  (11 months ago)                   │
│  Hold Period: 3 years (Target exit: March 2027)                 │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Upcoming Critical Dates                                         │
│  March 1   Lease renewal notices due (12 units)                 │
│  April 1   Q1 Investor Report due                               │
│  May 15    Annual property inspection                            │
│  June 1    Insurance renewal                                     │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Lease Expiration Schedule                                       │
│  Q1 2026:  8 units  (7%)                                        │
│  Q2 2026:  15 units (13%)                                       │
│  Q3 2026:  22 units (18%)  ⚠️ High concentration                │
│  Q4 2026:  10 units (8%)                                        │
│  2027:     65 units (54%)                                       │
│  [View Lease Intelligence →]                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Decision Log

**Purpose:** Track key decisions and why they were made

### 6.1 UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  📖 Decision Log                         [+ Add Decision] [Export]│
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Feb 7, 2026  Leon D                                             │
│  Decision: Accept counter-offer at $12.8M                        │
│  ───────────────────────────────────────────────────────────────│
│  Rationale:                                                      │
│  • Strategy Arbitrage shows 18% IRR at $12.8M (vs 19% at $12.5M)│
│  • Only 1% difference in returns                                 │
│  • Seller motivated (1031 deadline in 45 days)                  │
│  • Risk of losing deal to competing buyer                        │
│  ───────────────────────────────────────────────────────────────│
│  Supporting Data:                                                │
│  📊 Strategy Arbitrage Analysis (Feb 5) [View →]                │
│  📧 Broker email re: competing offer (Feb 6) [View →]           │
│  💰 Financial Modeling scenarios [View →]                        │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  Feb 4, 2026  Leon D                                             │
│  Decision: Reduced offer by $200K based on Phase I findings     │
│  ───────────────────────────────────────────────────────────────│
│  Rationale:                                                      │
│  • Phase I flagged minor soil contamination ($150K remediation) │
│  • Added $50K buffer for unforeseen environmental costs          │
│  • Maintains target IRR of 18%                                   │
│  ───────────────────────────────────────────────────────────────│
│  Supporting Data:                                                │
│  📄 Phase I Environmental Report (Feb 4) [View →]               │
│  📊 Updated financial model with remediation cost [View →]      │
│  📧 Environmental consultant email thread [View →]              │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  [Load More...]                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Decision Properties

```typescript
interface Decision {
  id: string;
  date: Date;
  madeBy: User;
  decision: string; // Short summary
  rationale: string; // Detailed reasoning
  supportingData: {
    type: 'document' | 'email' | 'analysis' | 'note';
    referenceId: string;
    title: string;
    url: string;
  }[];
  outcome?: string; // What happened as a result (filled in later)
  tags: string[]; // pricing, strategy, risk, financing, etc.
}
```

---

## 7. Risk Flags

**Purpose:** AI-surfaced concerns and agent alerts

### 7.1 Risk Categories

| Category | Source | Examples |
|----------|--------|----------|
| **Financial** | AI analysis of T-12, rent roll | Cash flow concentration, NOI decline |
| **Market** | Market Intelligence Agent | Supply increase, demand softening |
| **Legal** | Document parsing, agent alerts | Title issues, zoning violations |
| **Operational** | Property Manager emails, AI | Maintenance backlog, tenant complaints |
| **Timeline** | Task system, calendar | Stale tasks, missed deadlines |
| **Competition** | Supply Agent, market data | New competing properties |

### 7.2 UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️ Risk Flags                          [Filter by Severity ▼]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🔴 HIGH RISK (2 flags)                                          │
│  ───────────────────────────────────────────────────────────────│
│  ⚠️ Lease Expiration Concentration                               │
│  40% of units expire within 90 days of projected closing         │
│  Source: AI Analysis of Rent Roll (Feb 1, 2026)                 │
│  Impact: High tenant turnover risk, potential vacancy spike      │
│  Recommended Actions:                                            │
│  • Negotiate lease assignment with seller                        │
│  • Budget additional leasing costs                               │
│  • Consider extended due diligence for tenant retention analysis │
│  [View Rent Roll] [Create Task] [Dismiss]                       │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  ⚠️ Stale Financing Task                                         │
│  No activity on "Submit Loan Application" in 12 days            │
│  Source: Task System                                             │
│  Impact: May miss financing commitment deadline (Feb 28)         │
│  Recommended Actions:                                            │
│  • Follow up with lender immediately                             │
│  • Consider backup lender                                        │
│  [View Task] [Send Follow-Up Email] [Dismiss]                   │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  🟡 MEDIUM RISK (3 flags)                                        │
│  ───────────────────────────────────────────────────────────────│
│  ⚠️ Supply Increase in Trade Area                                │
│  200 new units permitted within 1 mile (Supply Agent alert)      │
│  Source: Supply Agent (Feb 5, 2026)                             │
│  Impact: Potential rent growth pressure, increased competition   │
│  Recommended Actions:                                            │
│  • Review rent projections in Strategy Arbitrage                 │
│  • Factor in increased competition to financial model            │
│  [View Agent Alert] [Re-Run Analysis] [Dismiss]                 │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  [Show Dismissed Flags]                                          │
└──────────────────────────────────────────────────────────────────┘
```

### 7.3 AI Risk Detection

**Triggers:**

1. **Financial Ratios:**
   - DSCR < 1.2 → Flag low debt coverage
   - Occupancy < 85% → Flag vacancy risk
   - NOI declining 3 consecutive months → Flag performance issue

2. **Lease Intelligence:**
   - >30% expirations in single quarter → Flag concentration
   - Renewal rate < 60% → Flag retention issue
   - Avg rent < market - 10% → Flag rent gap

3. **Timeline:**
   - Tasks >5 days overdue → Flag schedule risk
   - No activity on critical path tasks >7 days → Flag stale task
   - Milestone missed → Flag timeline slip

4. **Market:**
   - Supply increase >10% in submarket → Flag competition risk
   - Cap rate expansion >50 bps → Flag valuation risk
   - Demand signal weakening → Flag market risk

5. **Document Completeness:**
   - Key DD docs missing <10 days to deadline → Flag documentation gap

---

## 8. Integration Flow

**How It All Works Together:**

```
Email arrives from broker with OM attached
    ↓
Email Agent processes:
  - Classifies as "Offering Material"
  - Extracts property address: "123 Peachtree St"
  - Parses OM: NOI $3.4M, 120 units, $12.8M ask
  - Matches to existing deal: "Buckhead Tower Development"
    ↓
Deal Context Tracker updates:
  - Activity Timeline: "OM received from John Smith (Feb 7)"
  - Document Vault: OM_Buckhead_v2.pdf added (version tracked)
  - Contact Map: John Smith's last communication updated
  - Financial Snapshot: Asking price updated to $12.8M
  - Decision Log: (awaiting user decision on counter-offer)
    ↓
Tasks created automatically:
  - "Review updated OM and decide on counter-offer" (High priority, due Feb 10)
  - "Re-run Strategy Arbitrage with new financials" (Medium priority)
    ↓
Risk Flag triggered:
  - "Asking price increased 2.4% from $12.5M → $12.8M"
    ↓
User opens deal → Sees complete context instantly:
  - Timeline: OM received today
  - Document: New version available, parsed
  - Contact: Broker responsive (replied 4 hours ago)
  - Financials: Updated asking price, projected IRR
  - Tasks: 2 new tasks pending review
  - Risk: Price increase flagged
```

---

## 9. Database Schema

```sql
CREATE TABLE deal_activities (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- email, task, document, alert, note, etc.
  timestamp TIMESTAMP NOT NULL,
  user_id UUID REFERENCES users(id),
  reference_id UUID, -- Links to email_threads, tasks, documents, etc.
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB -- Flexible storage for activity-specific data
);

CREATE TABLE deal_decisions (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  date TIMESTAMP NOT NULL,
  made_by_user_id UUID REFERENCES users(id),
  decision TEXT NOT NULL,
  rationale TEXT,
  outcome TEXT,
  supporting_data JSONB, -- Array of {type, referenceId, title, url}
  tags TEXT[]
);

CREATE TABLE deal_risk_flags (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- high, medium, low
  title TEXT NOT NULL,
  description TEXT,
  source VARCHAR(100), -- AI analysis, agent, manual
  detected_at TIMESTAMP NOT NULL,
  dismissed_at TIMESTAMP,
  dismissed_by_user_id UUID REFERENCES users(id),
  recommended_actions TEXT[]
);

CREATE TABLE deal_milestones (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  target_date DATE,
  completed_date DATE,
  status VARCHAR(50) NOT NULL, -- pending, in-progress, complete
  order_index INTEGER
);

CREATE INDEX idx_deal_activities_deal ON deal_activities(deal_id, timestamp DESC);
CREATE INDEX idx_deal_decisions_deal ON deal_decisions(deal_id, date DESC);
CREATE INDEX idx_deal_risk_flags_deal ON deal_risk_flags(deal_id, severity);
```

---

## 10. API Endpoints

```typescript
// Activity Timeline
GET    /api/v1/deals/:id/activities        // List activities
POST   /api/v1/deals/:id/activities        // Add activity (note, etc.)
GET    /api/v1/deals/:id/activities/export // Export timeline

// Document Vault
GET    /api/v1/deals/:id/documents         // List documents
GET    /api/v1/deals/:id/documents/checklist // DD checklist
GET    /api/v1/deals/:id/documents/:docId/versions // Version history

// Contact Map
GET    /api/v1/deals/:id/contacts          // List contacts
POST   /api/v1/deals/:id/contacts          // Add contact
GET    /api/v1/deals/:id/contacts/:contactId/responsiveness // Score

// Financial Snapshot
GET    /api/v1/deals/:id/financial-snapshot // Get current snapshot
POST   /api/v1/deals/:id/financial-snapshot/update // Trigger update

// Key Dates & Milestones
GET    /api/v1/deals/:id/milestones        // List milestones
POST   /api/v1/deals/:id/milestones        // Add milestone
PATCH  /api/v1/deals/:id/milestones/:milestoneId // Update

// Decision Log
GET    /api/v1/deals/:id/decisions         // List decisions
POST   /api/v1/deals/:id/decisions         // Add decision

// Risk Flags
GET    /api/v1/deals/:id/risk-flags        // List risk flags
POST   /api/v1/deals/:id/risk-flags/:flagId/dismiss // Dismiss flag
```

---

## 11. Success Metrics

**Adoption:**
- % of deals with Context Tracker actively used
- Average # of activities logged per deal per week
- % of documents auto-categorized correctly

**Efficiency:**
- Time saved vs manual record-keeping (target: 8 hours/week per deal)
- Decision log completeness (target: >70% of major decisions logged)
- Risk flag accuracy (target: >80% flagged risks are valid)

**Quality:**
- Contact responsiveness tracking accuracy
- Version tracking success rate
- Timeline auto-generation completeness

---

## 12. Implementation Roadmap

### Phase 1: Activity Timeline + Documents (3 weeks)
- Build activity feed infrastructure
- Document Vault with version tracking
- Activity filtering and export

### Phase 2: Contacts + Financials (2 weeks)
- Contact Map with responsiveness scoring
- Financial Snapshot (Pipeline + Assets Owned)

### Phase 3: Milestones + Decisions (2 weeks)
- Key Dates timeline visualization
- Decision Log with linked supporting data

### Phase 4: Risk Flags + AI (3 weeks)
- Risk detection algorithms
- AI analysis triggers
- Agent-to-Context integration

---

**Total Implementation:** 10 weeks

**Status:** Specification Complete  
**Next:** Integrate with Email Agent + Global Tasks  
**Location:** Every Deal (Pipeline) & Property (Assets Owned)
