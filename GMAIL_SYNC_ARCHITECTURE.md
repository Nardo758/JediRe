# Gmail Sync System - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           JEDI RE Gmail Sync System                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND                                    │
└────────────────────────────────────────────────────────────────────────────┘

  User Browser (http://localhost:5000/settings/email)
       │
       │ 1. Click "Connect Gmail"
       ▼
  ┌─────────────────────────────────────┐
  │  EmailSettings.tsx                  │
  │  ─────────────────                  │
  │  - Connect Button                   │
  │  - Account List                     │
  │  - Sync Status                      │
  │  - Sync History                     │
  │  - Manual Sync Trigger              │
  │  - Disconnect Option                │
  └─────────────────────────────────────┘
       │
       │ 2. GET /api/v1/gmail/auth-url
       ▼

┌────────────────────────────────────────────────────────────────────────────┐
│                                 BACKEND                                     │
└────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │  gmail.routes.ts                    │
  │  ────────────────                   │
  │  GET  /auth-url                     │
  │  GET  /callback                     │
  │  POST /connect                      │
  │  GET  /accounts                     │
  │  POST /sync/:accountId              │
  │  GET  /sync                         │
  │  DEL  /disconnect/:accountId        │
  │  PATCH /accounts/:accountId         │
  │  GET  /emails                       │
  │  GET  /sync-logs                    │
  └─────────────────────────────────────┘
       │
       │ 3. Returns authUrl
       ▼
       
  User redirected to Google OAuth
       │
       │ 4. User authorizes
       ▼
       
  Google redirects back with code
       │
       │ 5. GET /api/v1/gmail/callback?code=...
       ▼
       
  ┌─────────────────────────────────────┐
  │  gmail-sync.service.ts              │
  │  ──────────────────────              │
  │  - exchangeCodeForTokens()          │
  │  - refreshAccessToken()             │
  │  - getValidAccessToken()            │
  │  - syncEmails()                     │
  │  - sendEmail()                      │
  │  - parseHeaders()                   │
  │  - extractBody()                    │
  └─────────────────────────────────────┘
       │
       │ 6. Exchange code for tokens
       ▼

┌────────────────────────────────────────────────────────────────────────────┐
│                             GOOGLE GMAIL API                                │
└────────────────────────────────────────────────────────────────────────────┘

  https://www.googleapis.com/gmail/v1
       │
       │ 7. Returns access_token + refresh_token
       ▼
       
  ┌─────────────────────────────────────┐
  │  Store tokens in database           │
  │  - user_email_accounts              │
  │    - access_token                   │
  │    - refresh_token                  │
  │    - token_expires_at               │
  └─────────────────────────────────────┘
       │
       │ 8. Trigger initial sync
       ▼

┌────────────────────────────────────────────────────────────────────────────┐
│                            EMAIL SYNC FLOW                                  │
└────────────────────────────────────────────────────────────────────────────┘

  Manual Sync Trigger                Background Scheduler
       │                                     │
       │ POST /sync/:accountId               │ Every 15 minutes
       ▼                                     ▼
  ┌──────────────────────────────────────────────────────────┐
  │  gmail-sync.service.syncEmails()                         │
  │  ────────────────────────────────                        │
  │  1. Check/refresh access token                           │
  │  2. Fetch messages from Gmail API                        │
  │  3. Parse headers (from, to, subject, date)              │
  │  4. Extract body (text + HTML)                           │
  │  5. Check if email already exists                        │
  │  6. Store in database                                    │
  │  7. Log sync status                                      │
  └──────────────────────────────────────────────────────────┘
       │
       │ Store emails
       ▼

┌────────────────────────────────────────────────────────────────────────────┐
│                               DATABASE                                      │
└────────────────────────────────────────────────────────────────────────────┘

  PostgreSQL (migration 020_email_accounts.sql)
  
  ┌─────────────────────────────────────┐
  │  user_email_accounts                │
  │  ────────────────────                │
  │  - id (PK)                          │
  │  - user_id (FK → users)             │
  │  - provider (google)                │
  │  - email_address                    │
  │  - access_token                     │
  │  - refresh_token                    │
  │  - token_expires_at                 │
  │  - is_primary                       │
  │  - last_sync_at                     │
  │  - sync_enabled                     │
  │  - sync_frequency_minutes           │
  └─────────────────────────────────────┘
                │
                │ 1:N
                ▼
  ┌─────────────────────────────────────┐
  │  emails                             │
  │  ───────                            │
  │  - id (PK)                          │
  │  - account_id (FK)                  │
  │  - user_id (FK → users)             │
  │  - provider_message_id              │
  │  - thread_id                        │
  │  - subject                          │
  │  - from_email / from_name           │
  │  - to_emails[] / cc_emails[]        │
  │  - body_text / body_html            │
  │  - snippet                          │
  │  - received_at                      │
  │  - is_read / is_important           │
  │  - has_attachments                  │
  │  - labels[]                         │
  │  - linked_deal_id (FK → deals)      │
  │  - raw_data (JSONB)                 │
  └─────────────────────────────────────┘
                │
                │ 1:N
                ▼
  ┌─────────────────────────────────────┐
  │  email_property_extractions         │
  │  ───────────────────────────         │
  │  - id (PK)                          │
  │  - email_id (FK)                    │
  │  - user_id (FK)                     │
  │  - address_full                     │
  │  - price / property_type            │
  │  - beds / baths / sqft              │
  │  - broker_name / broker_email       │
  │  - confidence_score                 │
  │  (Ready for AI extraction)          │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │  email_sync_logs                    │
  │  ────────────────                   │
  │  - id (PK)                          │
  │  - account_id (FK)                  │
  │  - sync_started_at                  │
  │  - sync_completed_at                │
  │  - sync_status                      │
  │  - messages_fetched                 │
  │  - messages_stored                  │
  │  - messages_skipped                 │
  │  - error_message                    │
  └─────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                        BACKGROUND SCHEDULER                                 │
└────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │  email-sync-scheduler.ts            │
  │  ────────────────────────            │
  │  - Starts on server startup         │
  │  - Runs every 15 minutes            │
  │  - Queries all enabled accounts     │
  │  - Checks last_sync_at times        │
  │  - Syncs accounts due for sync      │
  │  - Handles errors per account       │
  │  - Logs all operations              │
  │  - Graceful shutdown handling       │
  └─────────────────────────────────────┘
       │
       │ Every 15 min
       ▼
  Get enabled accounts → Check if due → Sync → Update last_sync_at

┌────────────────────────────────────────────────────────────────────────────┐
│                            DATA FLOW SUMMARY                                │
└────────────────────────────────────────────────────────────────────────────┘

1. User clicks "Connect Gmail" in UI
2. Frontend requests auth URL from backend
3. User redirected to Google OAuth consent page
4. User grants permissions
5. Google redirects back with authorization code
6. Backend exchanges code for tokens
7. Tokens stored in database (encrypted)
8. Initial sync triggered in background
9. Gmail API fetched for recent messages
10. Emails parsed and stored in database
11. Background scheduler syncs every 15 minutes
12. Frontend displays synced emails and status

┌────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY LAYERS                                   │
└────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │  1. JWT Authentication              │
  │     - All API endpoints protected   │
  │     - User context in req.user      │
  └─────────────────────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  2. OAuth2 with Google              │
  │     - No password storage           │
  │     - Refresh tokens for longevity  │
  └─────────────────────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  3. Token Management                │
  │     - Auto-refresh before expiry    │
  │     - 5-minute buffer               │
  └─────────────────────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  4. Database Security               │
  │     - RLS enforced                  │
  │     - User data isolation           │
  │     - Cascade deletes               │
  └─────────────────────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  5. CORS Protection                 │
  │     - Whitelist origins only        │
  │     - Credentials required          │
  └─────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING FLOW                                 │
└────────────────────────────────────────────────────────────────────────────┘

  Token Expired                Token Invalid               API Error
       │                            │                           │
       ▼                            ▼                           ▼
  Try Refresh                 Return 401                  Log Error
       │                    "Reconnect required"               │
       ▼                                                        ▼
  Success? ────No──→ Return 401                         Store in sync_logs
       │                                                        │
      Yes                                                       ▼
       │                                                Continue next account
       ▼
  Update token
       │
       ▼
  Retry operation

┌────────────────────────────────────────────────────────────────────────────┐
│                         PERFORMANCE NOTES                                   │
└────────────────────────────────────────────────────────────────────────────┘

- Batch processing: 50 emails per sync
- Duplicate detection: Check before insert
- Indexes: Optimized queries on user_id, received_at, account_id
- Pagination: Limit results to prevent overload
- Background: Non-blocking scheduler
- Graceful: Continue on per-account errors

┌────────────────────────────────────────────────────────────────────────────┐
│                         EXTENSIBILITY POINTS                                │
└────────────────────────────────────────────────────────────────────────────┘

1. Property Extraction
   └─> Add LLM call in syncEmails()
   └─> Populate email_property_extractions table
   └─> Link to deals automatically

2. Email Sending
   └─> Already implemented in service
   └─> Add UI components
   └─> Add compose modal

3. Webhooks
   └─> Replace polling with Gmail push notifications
   └─> Real-time updates
   └─> Reduced API quota usage

4. Multiple Providers
   └─> Microsoft Outlook (similar pattern)
   └─> IMAP/POP3 generic support
   └─> Unified interface

```

## File Structure

```
jedire/
├── backend/
│   ├── src/
│   │   ├── api/rest/
│   │   │   ├── gmail.routes.ts          ← API endpoints
│   │   │   └── index.ts                 ← Route registration
│   │   ├── services/
│   │   │   ├── gmail-sync.service.ts    ← Gmail integration
│   │   │   └── email-sync-scheduler.ts  ← Background scheduler
│   │   └── index.replit.ts              ← Server initialization
│   ├── migrations/
│   │   └── 020_email_accounts.sql       ← Database schema
│   └── package.json                     ← Dependencies
├── frontend/
│   ├── src/
│   │   ├── pages/settings/
│   │   │   └── EmailSettings.tsx        ← Settings UI
│   │   └── App.tsx                      ← Route registration
│   └── package.json
├── GMAIL_SYNC_SETUP.md                  ← Setup guide
├── GMAIL_SYNC_COMPLETE.md               ← Summary report
├── GMAIL_SYNC_ARCHITECTURE.md           ← This file
└── test-gmail-sync.sh                   ← Test script
```

## Component Interaction Map

```
EmailSettings.tsx
    │
    ├─→ apiClient.get('/gmail/auth-url')
    │       │
    │       └─→ gmail.routes.ts → gmailSyncService.getAuthUrl()
    │
    ├─→ apiClient.get('/gmail/accounts')
    │       │
    │       └─→ gmail.routes.ts → query(user_email_accounts)
    │
    ├─→ apiClient.post('/gmail/sync/:id')
    │       │
    │       └─→ gmail.routes.ts → gmailSyncService.syncEmails()
    │               │
    │               └─→ Gmail API → Database
    │
    └─→ apiClient.delete('/gmail/disconnect/:id')
            │
            └─→ gmail.routes.ts → query(DELETE FROM user_email_accounts)

Background Scheduler
    │
    ├─→ setInterval(15 min)
    │       │
    │       └─→ query(SELECT enabled accounts)
    │               │
    │               └─→ gmailSyncService.syncEmails() for each
    │
    └─→ Graceful shutdown on SIGTERM
```

---

**Architecture Status:** Production-ready
**Last Updated:** 2026-02-10
**Version:** 1.0.0
