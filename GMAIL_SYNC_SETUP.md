# Gmail Sync System - Setup Guide

## Overview
The Gmail Sync System allows users to connect their Gmail accounts and automatically sync emails into the JEDI RE platform. Emails are stored in the database and can be analyzed for property-related information.

## Architecture

### Backend Components

1. **Gmail Sync Service** (`backend/src/services/gmail-sync.service.ts`)
   - Handles OAuth2 authentication with Google
   - Fetches emails using Gmail API
   - Parses email headers and body
   - Stores emails in PostgreSQL database
   - Manages token refresh automatically

2. **API Routes** (`backend/src/api/rest/gmail.routes.ts`)
   - OAuth flow endpoints
   - Account management
   - Manual sync triggers
   - Email retrieval

3. **Sync Scheduler** (`backend/src/services/email-sync-scheduler.ts`)
   - Automatic background syncing every 15 minutes
   - Respects per-account frequency settings
   - Handles errors gracefully

### Frontend Components

1. **Email Settings Page** (`frontend/src/pages/settings/EmailSettings.tsx`)
   - Connect Gmail accounts via OAuth
   - View connected accounts
   - Manual sync trigger
   - Sync history viewer
   - Enable/disable auto-sync

### Database Schema

Uses existing migration `020_email_accounts.sql` with 4 tables:
- `user_email_accounts` - Connected Gmail accounts
- `emails` - Synced email messages
- `email_property_extractions` - AI-extracted property data (ready for future use)
- `email_sync_logs` - Sync history and error tracking

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Gmail API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs:
     - `http://localhost:3000/api/v1/gmail/callback` (development)
     - `https://your-replit-app.replit.app/api/v1/gmail/callback` (production)
   - Save Client ID and Client Secret

5. Configure OAuth Consent Screen:
   - Go to "OAuth consent screen"
   - User Type: External (or Internal if using Workspace)
   - Add required scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`

### 2. Environment Variables

Add to `.env`:

```bash
# Google OAuth (Gmail Sync)
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_GMAIL_CALLBACK_URL=http://localhost:4000/api/v1/gmail/callback
# Legacy fallback variable (supported for compatibility):
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/gmail/callback

# Frontend URL (for OAuth redirects)
CORS_ORIGIN=http://localhost:5000
```

For Replit deployment:
```bash
GOOGLE_GMAIL_CALLBACK_URL=https://your-app.replit.app/api/v1/gmail/callback
CORS_ORIGIN=https://your-app.replit.app
```

### 3. Install Dependencies

Already installed via npm:
- `googleapis` - Google APIs client library

### 4. Database Migration

The schema is already in place via `backend/migrations/020_email_accounts.sql`.

If not yet applied, run:
```bash
psql $DATABASE_URL -f backend/migrations/020_email_accounts.sql
```

### 5. Start the Application

```bash
# Backend
cd backend
npm run dev

# Frontend (in separate terminal)
cd frontend
npm run dev
```

The email sync scheduler will start automatically when the backend starts.

## Usage

### User Flow

1. **Connect Gmail Account**:
   - Navigate to `/settings/email`
   - Click "Connect Gmail"
   - Authorize via Google OAuth
   - Redirected back to settings page

2. **View Connected Accounts**:
   - See all connected Gmail accounts
   - Check last sync time
   - View sync status

3. **Manual Sync**:
   - Click "Sync Now" on any account
   - View progress and results
   - Check sync history in "Sync History" tab

4. **Auto-Sync Settings**:
   - Enable/disable auto-sync per account
   - Default frequency: 15 minutes
   - Configurable per account (future enhancement)

5. **Disconnect**:
   - Click "Disconnect" to remove account
   - Emails remain in database (soft delete)

## API Endpoints

### Authentication

**GET /api/v1/gmail/auth-url**
- Get OAuth authorization URL
- Returns: `{ authUrl: string }`

**GET /api/v1/gmail/callback**
- OAuth callback handler (redirects to frontend)

**GET /api/v1/gmail/oauth-diagnostics**
- Protected diagnostics endpoint for OAuth troubleshooting
- Query params:
  - `detail` (optional): raw OAuth error detail string
  - `statusCode` (optional): numeric status code
- Returns effective callback URLs, env configuration status, and parsed troubleshooting guidance

### Account Management

**GET /api/v1/gmail/accounts**
- List connected accounts
- Returns: Array of account objects

**PATCH /api/v1/gmail/accounts/:accountId**
- Update account settings
- Body: `{ syncEnabled: boolean, syncFrequencyMinutes: number }`

**DELETE /api/v1/gmail/disconnect/:accountId**
- Disconnect Gmail account
- Cascades to emails

### Email Sync

**POST /api/v1/gmail/sync/:accountId**
- Manually trigger sync for account
- Returns: `{ fetched, stored, skipped }`

**GET /api/v1/gmail/sync**
- Sync all accounts for user
- Returns: Array of sync results

**GET /api/v1/gmail/sync-logs**
- Get sync history
- Query params: `accountId` (optional), `limit` (default: 20)

### Email Retrieval

**GET /api/v1/gmail/emails**
- Get synced emails
- Query params:
  - `accountId` (optional)
  - `limit` (default: 50)
  - `offset` (default: 0)
  - `unreadOnly` (boolean)

## Security Considerations

1. **Token Storage**:
   - Access tokens stored encrypted in database
   - Refresh tokens used for automatic renewal
   - Tokens expire and refresh automatically

2. **OAuth Scopes**:
   - Minimal scopes requested
   - `gmail.readonly` for reading emails
   - `gmail.send` for future send functionality

3. **Rate Limiting**:
   - Gmail API has quota limits
   - Sync scheduler respects frequency settings
   - Manual syncs limited to 50 messages per request

4. **User Isolation**:
   - RLS (Row Level Security) enforced
   - Users can only access their own emails
   - Auth middleware validates JWT tokens

## Troubleshooting

### "Invalid grant" error
- OAuth refresh token expired
- User needs to reconnect account
- Go to Settings > Email > Disconnect > Reconnect

### Sync fails with 401
- Access token expired and refresh failed
- Check Google Cloud Console credentials
- Verify redirect URI matches exactly

### "Google auth failed: Unauthorized" after consent
- Verify your OAuth client type is **Web application** (not Desktop)
- Confirm `GOOGLE_GMAIL_CALLBACK_URL` exactly matches Google authorized redirect URI
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are from the same OAuth client
- Re-run connect flow (authorization codes are single-use and short-lived)

### Emails not syncing
- Check sync scheduler is running (logs on startup)
- Verify account has `sync_enabled = true`
- Check `email_sync_logs` table for errors

### Frontend shows connection error
- Verify CORS_ORIGIN environment variable
- Check redirect URI in Google Cloud Console
- Ensure backend is running and accessible

## Future Enhancements

1. **Property Extraction**:
   - Use LLM to extract property details from emails
   - Populate `email_property_extractions` table
   - Auto-link emails to deals

2. **Email Send**:
   - Reply to emails from platform
   - Send new emails via Gmail
   - Template system

3. **Advanced Filters**:
   - Filter by property type
   - Search email content
   - Label management

4. **Webhooks**:
   - Real-time push notifications from Gmail
   - Instant sync instead of polling
   - Reduced API quota usage

5. **Multiple Providers**:
   - Microsoft Outlook (already partially implemented)
   - Yahoo Mail
   - IMAP/POP3 support

## Testing

### Manual Testing

1. **Connect Flow**:
   ```bash
   # 1. Navigate to http://localhost:5000/settings/email
   # 2. Click "Connect Gmail"
   # 3. Authorize on Google
   # 4. Verify redirect back with success message
   # 5. Check account appears in list
   ```

2. **Sync Flow**:
   ```bash
   # 1. Click "Sync Now" on account
   # 2. Wait for completion
   # 3. Verify emails in database:
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM emails;"
   ```

3. **Scheduler**:
   ```bash
   # Check logs for scheduled sync messages
   # Should see sync every 15 minutes
   ```

### API Testing (curl)

```bash
# Get auth URL
curl http://localhost:3000/api/v1/gmail/auth-url \
  -H "Authorization: Bearer YOUR_JWT"

# Inspect OAuth diagnostics
curl "http://localhost:3000/api/v1/gmail/oauth-diagnostics?detail=Google%20auth%20failed%20(401)%3A%20Unauthorized" \
  -H "Authorization: Bearer YOUR_JWT"

# List accounts
curl http://localhost:3000/api/v1/gmail/accounts \
  -H "Authorization: Bearer YOUR_JWT"

# Manual sync
curl -X POST http://localhost:3000/api/v1/gmail/sync/ACCOUNT_ID \
  -H "Authorization: Bearer YOUR_JWT"

# Get emails
curl "http://localhost:3000/api/v1/gmail/emails?limit=10" \
  -H "Authorization: Bearer YOUR_JWT"
```

## Maintenance

### Database Cleanup

Old emails can be archived or deleted:
```sql
-- Delete emails older than 6 months
DELETE FROM emails 
WHERE received_at < NOW() - INTERVAL '6 months';

-- Archive to separate table (future)
INSERT INTO emails_archive SELECT * FROM emails 
WHERE received_at < NOW() - INTERVAL '6 months';
```

### Monitor Sync Health

```sql
-- Check recent sync status
SELECT 
  a.email_address,
  l.sync_status,
  l.sync_started_at,
  l.messages_fetched,
  l.error_message
FROM email_sync_logs l
JOIN user_email_accounts a ON a.id = l.account_id
WHERE l.sync_started_at > NOW() - INTERVAL '24 hours'
ORDER BY l.sync_started_at DESC;

-- Check accounts not syncing
SELECT 
  email_address,
  last_sync_at,
  sync_enabled
FROM user_email_accounts
WHERE provider = 'google'
  AND (last_sync_at < NOW() - INTERVAL '1 hour' OR last_sync_at IS NULL)
  AND sync_enabled = true;
```

## Support

For issues or questions:
1. Check logs: `backend/logs/jedire-all.log`
2. Review sync logs in database
3. Check Google Cloud Console quota usage
4. Verify environment variables are set correctly
