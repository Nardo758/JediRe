

# Microsoft Outlook Integration Guide

## Overview

JediRe now integrates with Microsoft Outlook to help you manage property-related emails, schedule showings, and keep track of communications—all from within the platform.

## Features

✅ **Email Management**
- Read inbox messages
- Send and reply to emails
- Search emails
- Organize with folders
- Link emails to properties

✅ **Calendar Integration**
- View upcoming events
- Schedule property showings
- Link meetings to properties

✅ **Property Linking**
- Auto-detect property addresses in emails
- Manually link emails to deals
- View all communications for a property

## Setup Instructions

### Step 1: Register Azure AD Application

1. **Go to Azure Portal**
   - Visit: https://portal.azure.com
   - Sign in with your Microsoft account

2. **Navigate to App Registrations**
   - Search for "App registrations" in the top search bar
   - Click **"+ New registration"**

3. **Register Application**
   - **Name**: `JediRe` (or whatever you prefer)
   - **Supported account types**: 
     - Choose "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `http://localhost:4000/api/v1/microsoft/auth/callback`
     - (Update for production: `https://yourdomain.com/api/v1/microsoft/auth/callback`)
   - Click **Register**

4. **Note Your Client ID**
   - After registration, you'll see the **Application (client) ID**
   - Copy this - you'll need it as `MICROSOFT_CLIENT_ID`

5. **Create Client Secret**
   - In your app, go to **Certificates & secrets** (left sidebar)
   - Click **"+ New client secret"**
   - Description: `JediRe Backend`
   - Expires: Choose duration (24 months recommended)
   - Click **Add**
   - **IMPORTANT**: Copy the secret **Value** immediately (you won't see it again!)
   - This is your `MICROSOFT_CLIENT_SECRET`

6. **Configure API Permissions**
   - Go to **API permissions** (left sidebar)
   - Click **"+ Add a permission"**
   - Select **Microsoft Graph**
   - Choose **Delegated permissions**
   - Add these permissions:
     - ✅ `User.Read` (Read user profile)
     - ✅ `Mail.ReadWrite` (Read and write mail)
     - ✅ `Mail.Send` (Send mail as user)
     - ✅ `Calendars.ReadWrite` (Read and write calendar)
     - ✅ `Contacts.Read` (Read contacts)
     - ✅ `offline_access` (Maintain access to data)
   - Click **Add permissions**
   - Click **Grant admin consent for [Your Organization]** (optional but recommended)

### Step 2: Configure Backend

1. **Set Environment Variables**

   Add to your `.env` file (or Replit Secrets):

   ```bash
   # Microsoft Graph API
   MICROSOFT_CLIENT_ID=your-application-client-id-here
   MICROSOFT_CLIENT_SECRET=your-client-secret-value-here
   MICROSOFT_TENANT_ID=common
   MICROSOFT_REDIRECT_URI=http://localhost:4000/api/v1/microsoft/auth/callback
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

2. **Run Database Migration**

   ```bash
   psql $DATABASE_URL -f migrations/012_microsoft_integration.sql
   ```

3. **Restart Backend**

   ```bash
   cd backend
   npm run dev
   ```

### Step 3: Connect Your Outlook Account

1. **Open JediRe** in your browser
2. **Go to Settings** (or wherever you add the connect button)
3. **Click "Connect Outlook"**
4. **Sign in with Microsoft** - you'll be redirected to Microsoft login
5. **Grant Permissions** - approve the requested permissions
6. **Done!** - You'll be redirected back to JediRe

## API Endpoints

All endpoints require authentication via JWT token.

### Check Connection Status

```http
GET /api/v1/microsoft/status
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "configured": true,
  "connected": true,
  "account": {
    "email": "you@example.com",
    "displayName": "Your Name",
    "lastSync": "2024-02-01T12:00:00Z"
  }
}
```

### Get Inbox Messages

```http
GET /api/v1/microsoft/emails/inbox?top=20&skip=0
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "emails": [
    {
      "id": "AAMkAGE...",
      "subject": "Property at 123 Main St",
      "from": {
        "name": "John Doe",
        "address": "john@example.com"
      },
      "receivedDateTime": "2024-02-01T10:30:00Z",
      "bodyPreview": "I'm interested in the property...",
      "hasAttachments": false,
      "isRead": false
    }
  ],
  "hasMore": true
}
```

### Send Email

```http
POST /api/v1/microsoft/emails/send
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "to": ["buyer@example.com"],
  "subject": "Property Details - 123 Main St",
  "body": "<p>Here are the details...</p>",
  "bodyType": "html"
}
```

### Reply to Email

```http
POST /api/v1/microsoft/emails/{emailId}/reply
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "body": "Thanks for your interest. I'll send details shortly.",
  "replyAll": false
}
```

### Search Emails

```http
GET /api/v1/microsoft/emails/search?q=123+Main+St&top=20
Authorization: Bearer <jwt_token>
```

### Link Email to Property

```http
POST /api/v1/microsoft/emails/{emailId}/link-property
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "propertyId": "property-uuid-here",
  "notes": "Initial inquiry from potential buyer"
}
```

### Get Calendar Events

```http
GET /api/v1/microsoft/calendar/events?start=2024-02-01T00:00:00Z&end=2024-02-07T23:59:59Z
Authorization: Bearer <jwt_token>
```

### Create Calendar Event

```http
POST /api/v1/microsoft/calendar/events
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "subject": "Property Showing - 123 Main St",
  "start": {
    "dateTime": "2024-02-05T14:00:00",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2024-02-05T15:00:00",
    "timeZone": "America/New_York"
  },
  "location": {
    "displayName": "123 Main St, Austin, TX"
  }
}
```

## Frontend Integration

### React Example

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

function OutlookIntegration() {
  const [status, setStatus] = useState(null);
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    const { data } = await axios.get('/api/v1/microsoft/status', {
      headers: { 'Authorization': `Bearer ${getJWT()}` }
    });
    setStatus(data);
  }

  async function connectOutlook() {
    const { data } = await axios.get('/api/v1/microsoft/auth/connect', {
      headers: { 'Authorization': `Bearer ${getJWT()}` }
    });
    // Redirect user to Microsoft login
    window.location.href = data.authUrl;
  }

  async function loadInbox() {
    const { data } = await axios.get('/api/v1/microsoft/emails/inbox?top=20', {
      headers: { 'Authorization': `Bearer ${getJWT()}` }
    });
    setEmails(data.emails);
  }

  if (!status?.configured) {
    return <div>Microsoft integration not configured.</div>;
  }

  if (!status?.connected) {
    return (
      <button onClick={connectOutlook}>
        Connect Outlook
      </button>
    );
  }

  return (
    <div>
      <h2>Outlook Inbox</h2>
      <p>Connected as: {status.account.email}</p>
      <button onClick={loadInbox}>Refresh</button>
      
      <ul>
        {emails.map(email => (
          <li key={email.id}>
            <strong>{email.subject}</strong>
            <p>From: {email.from.name}</p>
            <p>{email.bodyPreview}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Database Schema

### Tables Created

**`microsoft_accounts`**
- Stores OAuth tokens and user profile
- One account per user
- Auto-refreshes expired tokens

**`emails`**
- Email metadata with full-text search
- Links to properties
- Tracks read/unread status

**`email_attachments`**
- Attachment metadata

**`calendar_events`**
- Calendar events with property linking

**`property_email_links`**
- Many-to-many links between properties and emails
- Supports manual and auto-detected links
- AI confidence scores for suggestions

### Auto-Linking Emails to Properties

The system can automatically detect property addresses in emails:

```sql
-- Run auto-linking
SELECT auto_link_emails_to_properties();
```

This finds emails mentioning property addresses and creates links automatically.

## Security & Privacy

### OAuth Security
- ✅ Uses Microsoft's official OAuth 2.0 flow
- ✅ Tokens encrypted in database
- ✅ Refresh tokens for long-term access
- ✅ Automatic token refresh before expiry

### Data Storage
- Only email **metadata** stored locally (subject, from, date)
- Full email bodies fetched on-demand from Microsoft
- User can disconnect anytime (soft delete)

### Permissions
- Read/write emails: Required for viewing and sending
- Calendar access: Optional, for scheduling features
- Contacts: Read-only, for autocomplete
- Offline access: Allows background sync

### Row-Level Security
- Users can only access their own emails
- Database policies enforce isolation
- No cross-user data leakage

## Troubleshooting

### "Microsoft integration not configured"

**Solution:** Set environment variables and restart backend.

```bash
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

### "Redirect URI mismatch"

**Solution:** Make sure the redirect URI in Azure matches exactly:
- Azure: `http://localhost:4000/api/v1/microsoft/auth/callback`
- .env: `MICROSOFT_REDIRECT_URI=http://localhost:4000/api/v1/microsoft/auth/callback`

### "Invalid client secret"

**Solution:** 
1. Generate new secret in Azure Portal
2. Update `MICROSOFT_CLIENT_SECRET`
3. Restart backend

### "Token expired"

**Solution:** Backend auto-refreshes tokens. If it fails:
1. Check refresh token is valid
2. Ask user to reconnect account

### "Permission denied"

**Solution:** Ensure all required permissions are granted in Azure:
- Go to API permissions
- Click "Grant admin consent"

## Production Deployment

### Update URLs

1. **Azure App Registration**
   - Update Redirect URI to production URL
   - Example: `https://jedire.com/api/v1/microsoft/auth/callback`

2. **Environment Variables**
   ```bash
   MICROSOFT_REDIRECT_URI=https://jedire.com/api/v1/microsoft/auth/callback
   FRONTEND_URL=https://jedire.com
   ```

### SSL/HTTPS Required

Microsoft requires HTTPS for production OAuth. Use:
- Let's Encrypt for free SSL
- Cloudflare for SSL proxy
- Your hosting provider's SSL

### Multi-Tenant Support

Current setup uses `tenant=common` which supports:
- ✅ Personal Microsoft accounts (@outlook.com, @hotmail.com)
- ✅ Work/school accounts (any Azure AD org)

To restrict to your organization only:
```bash
MICROSOFT_TENANT_ID=your-tenant-id-here
```

## Advanced Features

### Background Email Sync

Create a cron job to sync emails periodically:

```typescript
// Pseudo-code
async function syncEmailsForAllUsers() {
  const accounts = await query('SELECT * FROM microsoft_accounts WHERE is_active = true');
  
  for (const account of accounts.rows) {
    const graphService = new MicrosoftGraphService(account.access_token);
    const emails = await graphService.getInbox({ top: 50 });
    
    // Store in database
    for (const email of emails.value) {
      await storeEmail(email, account.user_id);
    }
    
    // Auto-link to properties
    await query('SELECT auto_link_emails_to_properties()');
  }
}

// Run every 15 minutes
setInterval(syncEmailsForAllUsers, 15 * 60 * 1000);
```

### AI-Powered Email Insights

Combine with LLM integration:

```typescript
import { generateCompletion } from './llm.service';

async function analyzeEmail(emailBody: string): Promise<string> {
  const prompt = `Analyze this real estate email and extract key information:
  
${emailBody}

Extract:
- Property address (if mentioned)
- Buyer/seller intent
- Price range discussed
- Next steps or action items`;

  const response = await generateCompletion({ prompt });
  return response.text;
}
```

### Smart Notifications

Notify users of important emails:

```typescript
// When email arrives with property address
if (emailMentionsProperty(email)) {
  // Send push notification
  await sendNotification(userId, {
    title: 'New email about 123 Main St',
    body: email.subject,
    link: `/properties/${propertyId}/emails`
  });
}
```

## Roadmap

**Coming Soon:**
- [ ] Email templates for common scenarios
- [ ] Bulk actions (mark multiple as read, move, etc.)
- [ ] Email drafts
- [ ] Attachment preview
- [ ] AI email composition
- [ ] Smart email categorization
- [ ] Contact management
- [ ] Email analytics dashboard

## Support

Questions? Issues?

1. Check Azure app configuration
2. Verify environment variables
3. Check backend logs for OAuth errors
4. Test with Microsoft Graph Explorer: https://developer.microsoft.com/en-us/graph/graph-explorer

---

**Built with security in mind. Your emails stay private. 🔒**
