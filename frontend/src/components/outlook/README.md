# Outlook Integration Components

React components for Microsoft Outlook integration in JediRe.

## Components

### OutlookConnect

Connection status and OAuth flow management for Settings page.

```tsx
import { OutlookConnect } from '@/components/outlook';

<OutlookConnect 
  apiUrl="/api/v1"
  onStatusChange={(connected) => console.log('Connected:', connected)}
/>
```

**Props:**
- `apiUrl` (optional): API base URL, default `/api/v1`
- `onStatusChange` (optional): Callback when connection status changes

**Features:**
- Shows connection status (configured, connected, account details)
- "Connect Outlook" button that redirects to Microsoft OAuth
- "Disconnect" button with confirmation
- Handles OAuth callback (checks URL params)
- Error display
- Loading states

---

### EmailInbox

Display and manage Outlook inbox within JediRe.

```tsx
import { EmailInbox } from '@/components/outlook';

<EmailInbox
  apiUrl="/api/v1"
  onEmailSelect={(email) => console.log('Selected:', email)}
  onLinkToProperty={(emailId) => console.log('Link:', emailId)}
/>
```

**Props:**
- `apiUrl` (optional): API base URL
- `onEmailSelect` (optional): Callback when email is clicked
- `onLinkToProperty` (optional): Callback for "Link to property" button

**Features:**
- Inbox with unread count
- Search emails
- Refresh button
- Mark as read/unread automatically
- Delete emails with confirmation
- Responsive list with avatars
- Attachment indicators
- Date formatting
- Empty states

---

### ComposeEmail

Modal for composing and sending new emails.

```tsx
import { ComposeEmail } from '@/components/outlook';

const [open, setOpen] = useState(false);

<ComposeEmail
  isOpen={open}
  onClose={() => setOpen(false)}
  apiUrl="/api/v1"
  defaultTo="buyer@example.com"
  defaultSubject="Property Inquiry"
  onSent={() => console.log('Email sent!')}
/>
```

**Props:**
- `isOpen`: Boolean to show/hide modal
- `onClose`: Callback to close modal
- `apiUrl` (optional): API base URL
- `defaultTo` (optional): Pre-fill recipient
- `defaultSubject` (optional): Pre-fill subject
- `defaultBody` (optional): Pre-fill message body
- `onSent` (optional): Callback after successful send

**Features:**
- To/CC/Subject/Body fields
- Multiple recipients (comma-separated)
- Toggle CC field
- Send validation
- Loading state while sending
- Error display
- HTML email support
- Escape key to close

---

### EmailViewer

Modal for viewing full email and replying.

```tsx
import { EmailViewer } from '@/components/outlook';

const [open, setOpen] = useState(false);
const [emailId, setEmailId] = useState<string | null>(null);

<EmailViewer
  isOpen={open}
  emailId={emailId}
  onClose={() => setOpen(false)}
  apiUrl="/api/v1"
  onLinkToProperty={(id) => console.log('Link:', id)}
  onDelete={(id) => console.log('Deleted:', id)}
/>
```

**Props:**
- `isOpen`: Boolean to show/hide modal
- `emailId`: Email ID to display
- `onClose`: Callback to close modal
- `apiUrl` (optional): API base URL
- `onLinkToProperty` (optional): Callback for link button
- `onDelete` (optional): Callback after delete

**Features:**
- Full email display (HTML or text)
- Sender details with avatar
- Reply and Reply All buttons
- Inline reply compose
- Delete with confirmation
- Link to property action
- HTML email rendering
- Loading states

---

## Complete Example

See `frontend/src/pages/EmailPage.tsx` for a complete example showing:
- Connection status check
- Inbox display
- Compose button (when connected)
- Email viewing
- Reply functionality
- Property linking

## Routing Integration

Add to your router:

```tsx
import EmailPage from './pages/EmailPage';

<Route path="/email" element={<EmailPage />} />
```

Or add to Settings page:

```tsx
import { OutlookConnect } from './components/outlook';

// In Settings page:
<section>
  <h2>Integrations</h2>
  <OutlookConnect />
</section>
```

## Authentication

Components expect JWT token in `localStorage`:

```typescript
localStorage.setItem('jwt_token', 'your-jwt-token-here');
```

Adjust `getAuthToken()` function in each component if using a different auth system.

## Styling

Components use Tailwind CSS. Make sure you have:
- `lucide-react` for icons
- `axios` for API calls

Install:
```bash
npm install lucide-react axios
```

## API Requirements

These components require the backend endpoints from the Microsoft integration:
- `GET /api/v1/microsoft/status`
- `GET /api/v1/microsoft/auth/connect`
- `POST /api/v1/microsoft/auth/disconnect`
- `GET /api/v1/microsoft/emails/inbox`
- `GET /api/v1/microsoft/emails/:id`
- `GET /api/v1/microsoft/emails/search`
- `POST /api/v1/microsoft/emails/send`
- `POST /api/v1/microsoft/emails/:id/reply`
- `DELETE /api/v1/microsoft/emails/:id`

See backend documentation for setup.

## Next Steps

1. Add to Settings page for OAuth connection
2. Add Email page to main navigation
3. Integrate property linking modal
4. Add email notifications
5. Implement attachment support
6. Add email templates

## License

Part of JediRe project.
