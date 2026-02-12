# Email System Deployment Guide

**Created:** February 8, 2026  
**Status:** Ready to deploy

---

## What Was Built

### Backend
- ✅ Email database schema (4 tables)
- ✅ Inbox API (11 endpoints)
- ✅ Sample data seeds (7 emails)
- ✅ TypeScript compiles successfully

### Frontend
- ✅ Inbox service API client
- ✅ Email page with real-time updates
- ✅ Navigation updated (Dashboard → Email)

---

## Deployment Steps

### Step 1: Pull Latest Code

```bash
cd /path/to/jedire
git pull origin master
```

**Latest commits:**
- `61b1b8d` - Wireframe documentation
- `19f479c` - Email system backend + frontend
- `cd3c3af` - Email page layout
- `fbd68ec` - Settings to user menu
- `0c177e1` - Remove architecture link

---

### Step 2: Run Database Migrations

**Option A: Using psql directly**
```bash
cd backend/src/database/migrations

# Run email schema migration
psql $DATABASE_URL -f 006_emails.sql

# Run sample data seed
psql $DATABASE_URL -f 007_seed_emails.sql
```

**Option B: Using Node/TypeScript**
```javascript
// In your migration runner or console
import { query } from './database/connection';
import fs from 'fs';

// Run migration
const emailSchema = fs.readFileSync('./backend/src/database/migrations/006_emails.sql', 'utf8');
await query(emailSchema);

// Seed data
const emailSeeds = fs.readFileSync('./backend/src/database/migrations/007_seed_emails.sql', 'utf8');
await query(emailSeeds);
```

**Verify migrations:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('emails', 'email_accounts', 'email_attachments', 'email_labels');

-- Check sample emails
SELECT COUNT(*) FROM emails;
-- Should return: 7

-- Check email stats
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = FALSE) as unread,
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL) as deal_related
FROM emails;
```

---

### Step 3: Install Dependencies (if needed)

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

### Step 4: Build & Start

**Backend:**
```bash
cd backend
npm run build
npm run start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run dev
```

---

## Testing

### Backend API Tests

**1. Get inbox stats:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/inbox/stats
```

Expected response:
```json
{
  "success": true,
  "data": {
    "total": 7,
    "unread": 4,
    "flagged": 3,
    "deal_related": 4,
    "with_attachments": 3
  }
}
```

**2. List emails:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/inbox?limit=5
```

**3. Mark email as read:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_read": true}' \
  http://localhost:3000/api/v1/inbox/1
```

---

### Frontend Tests

1. **Navigate to Dashboard → Email**
   - Should see 7 emails in sidebar
   - Should see stats card (total, unread, flagged, deal-related)
   - Should see map with deal markers

2. **Click an unread email**
   - Should highlight the email card
   - Should mark as read (blue dot disappears)
   - Stats should update (unread count decreases)

3. **Toggle email flag**
   - Click star button
   - Should toggle between ⭐ (flagged) and ☆ (unflagged)

4. **Check deal badges**
   - Emails linked to deals should show "📁 Deal name" badge
   - Example: First email shows "📁 Buckhead Mixed-Use Development"

---

## API Endpoints Reference

### Inbox Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/inbox` | List emails with filters |
| GET | `/api/v1/inbox/stats` | Get inbox statistics |
| GET | `/api/v1/inbox/:id` | Get email details |
| PATCH | `/api/v1/inbox/:id` | Update email (read, flag, link to deal) |
| DELETE | `/api/v1/inbox/:id` | Delete/archive email |
| POST | `/api/v1/inbox/sync` | Trigger email sync |
| POST | `/api/v1/inbox/compose` | Send email |
| POST | `/api/v1/inbox/bulk-action` | Bulk operations |

### Query Parameters (GET /inbox)

- `limit` - Number of emails (default: 50)
- `offset` - Pagination offset (default: 0)
- `unread_only` - Show only unread (true/false)
- `deal_id` - Filter by deal
- `search` - Search in subject/body/from

---

## Database Schema

### emails
```sql
- id (serial, pk)
- email_account_id (int, fk)
- user_id (int, fk)
- external_id (varchar, unique)
- subject (text)
- from_name, from_address (varchar)
- body_preview, body_html, body_text (text)
- is_read, is_flagged, is_archived, has_attachments (boolean)
- deal_id (int, fk to deals, nullable)
- extracted_properties (jsonb) - AI extraction
- action_items (jsonb) - Detected tasks
- received_at, sent_at (timestamp)
```

### email_accounts
```sql
- id (serial, pk)
- user_id (int, fk)
- email_address (varchar)
- provider (varchar) - gmail, outlook, exchange
- access_token, refresh_token (text)
- last_sync_at (timestamp)
```

### email_attachments
```sql
- id (serial, pk)
- email_id (int, fk)
- filename (varchar)
- content_type (varchar)
- size_bytes (int)
- download_url (text)
```

### email_labels
```sql
- id (serial, pk)
- user_id (int, fk)
- name (varchar)
- color (varchar)
- is_system (boolean) - inbox, sent, trash, etc
```

---

## Features Implemented

### ✅ Core Email Management
- List emails with pagination
- Read/unread tracking (auto-mark on open)
- Flag important emails
- Archive/delete emails
- Attachment indicators

### ✅ Deal Integration
- Link emails to deals
- Display deal badges on emails
- Filter emails by deal
- Deal names shown in email list

### ✅ UI Features
- Real-time stats dashboard
- Email cards with badges and indicators
- Click to mark as read
- Star button to toggle flag
- Timestamp formatting (2h ago, 1d ago)
- Selected email highlighting
- Unread count in nav badge

### ✅ Backend Ready For
- Gmail/Outlook OAuth integration
- Email sync from providers
- AI property extraction from emails
- Action item detection
- Email-to-task creation
- Bulk operations (mark all read, etc.)
- Advanced search and filters

---

## Next Steps (Future Features)

### Phase 2: Email Detail View
- Full email content display
- Reply/forward functionality
- Attachment download
- Thread view

### Phase 3: Email Sending
- Compose modal
- Rich text editor
- Email templates
- Attachments upload

### Phase 4: AI Integration
- Auto-extract properties from emails
- Detect action items
- Auto-link to relevant deals
- Smart replies

### Phase 5: Provider Integration
- Gmail OAuth sync
- Outlook OAuth sync
- Real-time sync (webhooks)
- Send emails via provider

---

## Troubleshooting

### Issue: Migrations fail with "table already exists"

**Solution:** Tables may already exist from previous runs. Check:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'email%';
```

If tables exist, either:
- Drop and recreate: `DROP TABLE emails CASCADE;` (will delete data!)
- Skip migration if schema matches

---

### Issue: Frontend shows "Loading..." forever

**Possible causes:**
1. Backend not running
2. API endpoints not responding
3. CORS issues
4. Auth token missing/invalid

**Debug:**
```bash
# Check backend is running
curl http://localhost:3000/api/v1/health

# Check inbox API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/inbox/stats

# Check browser console for errors
```

---

### Issue: TypeScript build errors

**Common errors:**
- Missing dependencies: Run `npm install` in frontend/
- Type errors in existing code: These are pre-existing, not from email system

**Email-specific files are clean:**
- `frontend/src/services/inbox.service.ts` ✅
- `frontend/src/pages/EmailPage.tsx` ✅
- `backend/src/api/rest/inbox.routes.ts` ✅

---

## Support

If issues persist after deployment:
1. Check backend logs for API errors
2. Check browser console for frontend errors
3. Verify database migrations ran successfully
4. Confirm sample data exists in `emails` table

---

**Deployment Status:** Ready ✅  
**Last Updated:** February 8, 2026 00:28 EST
