# JEDI RE Wireframe Updates - February 8, 2026

## Navigation Structure - AS IMPLEMENTED

### Left Sidebar Navigation (Vertical)

```
┌──────────────────────────────────────────┐
│ JEDI RE                          🔔  👤▼ │  ← Header with user menu
├──────────────────────────────────────────┤
│                                           │
│ 📊 Dashboard ▼                           │  ← Expandable
│   └─ Portfolio Overview                  │
│   └─ Email (5)                           │
│                                           │
│ INTELLIGENCE LAYERS                       │
│ 📊 Market Data                           │
│ 🏢 Assets Owned (23)         👁️         │  ← Eye = layer toggle
│                                           │
│ DEAL MANAGEMENT                           │
│ 📁 Pipeline (8)               👁️         │
│                                           │
│ TOOLS                                     │
│ 📊 Reports                               │
│ 👥 Team                                  │
│                                           │
└──────────────────────────────────────────┘
```

### User Menu (Top Right Dropdown)
Click **👤 Leon D ▼** opens:
```
┌────────────────────────┐
│ Leon D                 │
│ leon@example.com       │
├────────────────────────┤
│ ⚙️  Settings           │
│ 👤 Profile             │
│ 💳 Billing             │
├────────────────────────┤
│ 🚪 Sign Out            │
└────────────────────────┘
```

### Key Changes from Wireframe
1. **Dashboard is now expandable** with Portfolio Overview + Email subitems
2. **Settings moved to user dropdown** (top right, not in sidebar)
3. **Architecture link removed** (internal dev tool only)
4. **Email moved under Dashboard** (was in TOOLS section)

---

## Dashboard Sub-Views - Consistent Layout Pattern

### Pattern: Sidebar + Map

Both Dashboard sub-views follow the same layout:
- **Left:** Sidebar panel (w-80) with list/content
- **Right:** Full Mapbox map with deal markers

---

### Portfolio Overview Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Portfolio Overview                                    [+ Create Deal]   │
│  1 deal active                                                               │
├─────────────┬───────────────────────────────────────────────────────────────┤
│             │                                                                 │
│ MY DEALS    │                                                                 │
│             │                                                                 │
│ ┌─────────┐ │                                                                 │
│ │🟡       │ │                    MAPBOX MAP                                  │
│ │ Buckhead│ │                                                                 │
│ │ Mixed-  │ │              - Deal boundaries (colored)                       │
│ │ Use Dev │ │              - Property markers                                │
│ │         │ │              - Click deal → Navigate to detail                 │
│ │ 228.3   │ │                                                                 │
│ │ acres   │ │                                                                 │
│ │ 0 props │ │                                                                 │
│ └─────────┘ │                                                                 │
│             │                                                                 │
└─────────────┴───────────────────────────────────────────────────────────────┘
```

**Sidebar Content:**
- Header: "MY DEALS"
- Deal cards with:
  - Color indicator (tier)
  - Name
  - Type (multifamily, etc.)
  - Acreage
  - Property count
  - Click to navigate to deal detail

---

### Email Page (Dashboard → Email)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📧 Email                                                   [✉️ Compose]     │
│  4 unread messages                                                           │
├─────────────┬───────────────────────────────────────────────────────────────┤
│ ┌─────────┐ │                                                                 │
│ │ Stats   │ │                                                                 │
│ │ Total:7 │ │                    MAPBOX MAP                                  │
│ │ Unread:4│ │                                                                 │
│ │ Flagged:│ │              - Same map as Portfolio Overview                  │
│ │     3   │ │              - Deal markers visible                            │
│ │ Deal: 4 │ │              - Provides spatial context for emails             │
│ └─────────┘ │                                                                 │
│             │                                                                 │
│ INBOX       │                                                                 │
│             │                                                                 │
│ ┌─────────┐ │                                                                 │
│ │📧 Sarah │ │                                                                 │
│ │New MF   │ │                                                                 │
│ │📁Deal ⭐│ │                                                                 │
│ │🔵 2h ago│ │                                                                 │
│ └─────────┘ │                                                                 │
│             │                                                                 │
│ ┌─────────┐ │                                                                 │
│ │ John S  │ │                                                                 │
│ │Phase I  │ │                                                                 │
│ │📁Deal  │ │                                                                 │
│ │🔵 4h ago│ │                                                                 │
│ └─────────┘ │                                                                 │
│             │                                                                 │
└─────────────┴───────────────────────────────────────────────────────────────┘
```

**Sidebar Content:**
- Stats card (total, unread, flagged, deal-related)
- "INBOX" section header
- Email cards with:
  - From name
  - Subject
  - Deal badge (📁 Deal name) if linked
  - Star button (toggle flag)
  - Blue dot if unread
  - Timestamp (2h ago, 1d ago)
  - Attachment indicator (📎 2)

**Interactions:**
- Click email → Marks as read, highlights card
- Click star → Toggles flag
- Email cards color-coded:
  - Unread: Blue background
  - Read: White background
  - Selected: Highlighted blue border

---

## Email Backend (Fully Wired)

### Database Schema
- `emails` - Full email storage
- `email_accounts` - OAuth connections
- `email_attachments` - File tracking
- `email_labels` - Folders/tags

### API Endpoints
- `GET /inbox` - List with filters
- `GET /inbox/stats` - Dashboard stats
- `GET /inbox/:id` - Email detail
- `PATCH /inbox/:id` - Update (read, flag, link to deal)
- `DELETE /inbox/:id` - Delete/archive
- `POST /inbox/sync` - Sync from provider
- `POST /inbox/compose` - Send email
- `POST /inbox/bulk-action` - Bulk operations

### Features Implemented
✅ Link emails to deals  
✅ Read/unread tracking  
✅ Flag important emails  
✅ Attachment tracking  
✅ Real-time UI updates  
✅ Deal badges  
✅ Stats dashboard  
✅ Bulk operations  
✅ Search & filters  

---

## Design Pattern Established

**Sidebar + Map Layout** for all Dashboard sub-views:
- Portfolio Overview: Deal list + Map
- Email: Inbox + Map

**Benefits:**
- Consistent UX across views
- Map always visible (spatial context)
- Easy to see location of deals/properties while managing emails or reviewing portfolio
- Clean, focused layouts

---

## Implementation Status

### ✅ Completed (Feb 8, 2026)
- Navigation reorganization
- Settings moved to user menu
- Email page layout matching Portfolio Overview
- Full email backend API
- Email frontend with real data
- Database schema and migrations
- Sample data seeded

### 🔄 In Progress
- Portfolio Overview stats and filters (planned next)

### 📋 Planned
- Email detail view (click email to expand full content)
- Compose email modal
- Email search and advanced filters
- Email-to-deal linking UI
- Bulk email operations UI

---

## Files Modified (Feb 8, 2026)

**Backend:**
- `backend/src/api/rest/inbox.routes.ts` (new)
- `backend/src/database/migrations/006_emails.sql` (new)
- `backend/src/database/migrations/007_seed_emails.sql` (new)
- `backend/src/api/rest/index.ts` (updated)

**Frontend:**
- `frontend/src/components/layout/MainLayout.tsx` (navigation)
- `frontend/src/App.tsx` (routes)
- `frontend/src/pages/EmailPage.tsx` (rewritten)
- `frontend/src/services/inbox.service.ts` (new)

**Commits:**
- `0c177e1` - Remove Architecture link
- `fbd68ec` - Move Settings to user dropdown
- `cd3c3af` - Update Email page layout
- `19f479c` - Wire up Email inbox with full backend API

---

**Last Updated:** February 8, 2026 00:26 EST  
**Status:** Email system fully functional ✅
