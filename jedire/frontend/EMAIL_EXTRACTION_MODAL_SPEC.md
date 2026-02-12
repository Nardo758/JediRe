# Email Extraction Review Modal Specification

## Concept
When properties are extracted from emails and require user review, show them in a **modal popup** rather than a separate page. Quick, efficient, non-disruptive.

---

## Trigger Points

### 1. **Notification Badge**
User sees notification: "🟡 3 properties need review"

Click → Opens modal

### 2. **Dashboard Widget**
Small widget on dashboard:
```
┌─────────────────────────────────┐
│  📧 Pending Property Reviews    │
│                                  │
│  5 properties extracted          │
│  from recent emails              │
│                                  │
│     [Review Now →]               │
└─────────────────────────────────┘
```

### 3. **Automatic Popup**
- When user logs in and there are pending reviews
- Once per day maximum (not annoying)
- Can be dismissed

---

## Modal Layout

### Full Modal View

```
┌───────────────────────────────────────────────────────────────┐
│  Property Review (1 of 5)                              [X]    │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  📧 From: broker@realestate.com                               │
│  📅 Received: Feb 2, 2026 at 9:30 AM                         │
│  📄 Subject: "Great multifamily deal in Atlanta"              │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  🏢 Property Details                                          │
│                                                                │
│  Address:     1234 Peachtree St NE, Atlanta, GA 30309        │
│  Type:        Multifamily                                     │
│  Units:       250 units                                       │
│  Year Built:  2005                                            │
│  Price:       $12,000,000                                     │
│  Cap Rate:    6.5%                                            │
│  Occupancy:   95%                                             │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  ✅ Match Score: 85%                                          │
│                                                                │
│  Why it matches:                                              │
│  ✓ Property type: Multifamily (target type)                  │
│  ✓ Location: GA (target market)                              │
│  ✓ Units: 250 within target (200+)                           │
│  ✓ Year: 2005 within range (1990+)                           │
│  ✓ Price: $12M within budget ($5M-$50M)                      │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  📍 Map Preview                                               │
│  [Mini map showing property location]                         │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  📨 View Full Email                                           │
│  [Expandable section showing full email content]              │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  [Skip]          [❌ Reject]            [✅ Add to Map]       │
│                                                                │
│                  ← Previous    1/5    Next →                  │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

---

## Modal Features

### 1. **Property Card**
- Clean, scannable layout
- Key details at a glance
- Visual match score indicator (progress bar or percentage)

### 2. **Match Explanation**
- Show WHY it matched (or didn't)
- Green checkmarks for matched criteria
- Red X for missed criteria
- Example:
  ```
  ✓ Property type: Multifamily (target type)
  ✓ Location: GA (target market)
  ✓ Units: 250 within target (200+)
  ✗ Cap rate: 5.5% below minimum (6%)
  ```

### 3. **Map Preview**
- Small interactive map
- Shows property location
- User can verify it's in the right area
- Click to expand to full map

### 4. **Email Context**
- Show who sent it
- When received
- Subject line
- Expandable full email body (collapsed by default)

### 5. **Navigation**
- Previous/Next buttons
- Counter: "1 of 5"
- Keyboard shortcuts:
  - ← → arrow keys to navigate
  - Enter to approve
  - Delete to reject
  - Esc to close

### 6. **Actions**
Three options:

**Skip** → Don't decide now, keep in queue

**Reject** → Remove from queue, don't add to map
- Optional: "Why?" dropdown (not my market, too expensive, etc.)
- Helps improve matching over time

**Add to Map** → Creates pin automatically
- Select which map (if user has multiple)
- Select pipeline stage (default: first stage)
- Optional: Add note

---

## Compact View (Alternative)

For quick bulk review:

```
┌───────────────────────────────────────────────────────────────┐
│  Property Reviews (5 pending)                          [X]    │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. 1234 Peachtree St, Atlanta, GA                      │  │
│  │    Multifamily • 250 units • $12M • Match: 85%         │  │
│  │    [Details] [❌ Reject] [✅ Add]                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 2. 5678 Main St, Charlotte, NC                         │  │
│  │    Land • 10 acres • $2M • Match: 72%                  │  │
│  │    [Details] [❌ Reject] [✅ Add]                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 3. 910 Oak Ave, Miami, FL                              │  │
│  │    ALF • 120 beds • $18M • Match: 68%                  │  │
│  │    [Details] [❌ Reject] [✅ Add]                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  [More items below...]                                        │
│                                                                │
│  [Reject All]                       [Add All]                 │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

**User can:**
- See all pending reviews at once
- Click "Details" to expand individual property (full view)
- Quick approve/reject without expanding
- Bulk actions: "Reject All" or "Add All"

---

## Review Modes

### Mode 1: One-by-One (Default)
- Show full details for each property
- Navigate with Next/Previous
- Best for careful review

### Mode 2: List View
- See all at once
- Quick bulk actions
- Best when you have many pending

**User can toggle between modes:**
- Top-right toggle: [📋 List] [📄 Details]

---

## Empty State

No pending reviews:

```
┌───────────────────────────────────────────────────────────────┐
│  Property Reviews                                      [X]    │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│                     ✅ All Caught Up!                         │
│                                                                │
│            No properties need your review right now.          │
│                                                                │
│     We'll notify you when new properties are extracted.       │
│                                                                │
│                                                                │
│                       [Close]                                  │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

---

## Notification Integration

### Notification Example:
```
🔔 5 new properties extracted from emails
   • 3 high matches (ready to add)
   • 2 need your review
   
   [Review Now]  [Dismiss]
```

### Email Digest (Optional):
Daily or weekly email summary:
```
Subject: Your JediRe Property Digest - Feb 2, 2026

Hi Leon,

This week we found 12 properties from your emails:

✅ Auto-added to map: 7 properties
🟡 Need your review: 5 properties

High-confidence matches:
• 1234 Peachtree St, Atlanta - $12M Multifamily
• 5678 Main St, Charlotte - $2M Land
• ...

[Review Pending Properties →]
```

---

## Batch Actions

User can process multiple at once:

**Approve All High Matches**
- "All 3 properties with 80%+ match score"
- One click to add all

**Reject All Low Matches**
- "All 2 properties below 60% match"
- One click to clear

**Smart Suggestions:**
- "These 2 look similar to properties you've added before. Add them?"
- Machine learning over time

---

## Success State

After approving a property:

```
┌───────────────────────────────────────────────────────────────┐
│                                                                │
│                   ✅ Property Added to Map!                   │
│                                                                │
│         1234 Peachtree St has been added to                   │
│                  "Atlanta Deals" map                          │
│                                                                │
│                                                                │
│          [View on Map]         [Review Next →]                │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

Auto-closes after 2 seconds OR shows next property

---

## Mobile Experience

**On mobile:**
- Full-screen modal
- Swipe left/right to navigate
- Large touch targets for buttons
- Collapsed details by default (expandable)
- Quick actions at bottom:
  ```
  ┌─────────────────────────────────┐
  │  ❌ Reject   |   ✅ Add to Map  │
  └─────────────────────────────────┘
  ```

---

## Advanced Features (Future)

### 1. **Comparison Mode**
- Show 2-3 properties side-by-side
- Compare details
- "Which one is better?"

### 2. **Quick Edit**
- Edit extracted details before adding
- Fix incorrect unit count, price, etc.
- Improves AI over time

### 3. **Add Notes**
- "Spoke with broker, needs work"
- "Good deal but wrong market"
- Stored with property

### 4. **Schedule Review**
- "Remind me about this tomorrow"
- Snooze feature

### 5. **Filter Pending**
- Show only high matches
- Show only specific property types
- Show only specific markets

---

## API Endpoints Needed

**GET /api/extractions/pending**
- Returns list of pending property reviews
- Includes match scores, reasons, email context

**POST /api/extractions/:id/approve**
- Approves extraction
- Creates property pin on map
- Body: `{ mapId, pipelineStageId, notes? }`

**POST /api/extractions/:id/reject**
- Rejects extraction
- Removes from queue
- Body: `{ reason? }`

**POST /api/extractions/:id/skip**
- Keeps in queue for later
- No action taken

**POST /api/extractions/bulk-approve**
- Approve multiple at once
- Body: `{ extractionIds: [...] }`

**POST /api/extractions/bulk-reject**
- Reject multiple at once
- Body: `{ extractionIds: [...] }`

---

## Database Updates

Track user decisions to improve matching:

```sql
-- When user approves/rejects, log their decision
UPDATE property_extraction_queue
SET 
  reviewed_by = $user_id,
  reviewed_at = now(),
  status = 'accepted' | 'rejected'
WHERE id = $extraction_id;

-- Track rejection reasons
ALTER TABLE property_extraction_queue
ADD COLUMN rejection_reason text;
```

**Use this data to:**
- Improve AI extraction accuracy
- Refine preference matching
- Learn user patterns over time

---

## Component Structure (React)

```typescript
<PropertyReviewModal
  isOpen={showReviewModal}
  onClose={handleClose}
>
  <PropertyReviewList
    mode="detail" // or "list"
    extractions={pendingExtractions}
    onApprove={handleApprove}
    onReject={handleReject}
    onSkip={handleSkip}
  />
</PropertyReviewModal>
```

**Child components:**
- `PropertyCard` - Individual property display
- `MatchScoreIndicator` - Visual match percentage
- `MapPreview` - Mini map with location
- `EmailPreview` - Email context display
- `ActionButtons` - Approve/Reject/Skip buttons
- `NavigationControls` - Previous/Next/Counter

---

## UX Principles

1. **Fast** - Keyboard shortcuts, quick actions
2. **Clear** - Why it matched, what it is
3. **Contextual** - Show email source, map location
4. **Efficient** - Bulk actions, smart defaults
5. **Forgiving** - Can undo, can edit
6. **Progressive** - Start simple, add features over time

---

*This modal-based review system makes email extraction interactive and user-controlled, while keeping the workflow fast and efficient.*
