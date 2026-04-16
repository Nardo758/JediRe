# Admin Tools Migration Guide

## Overview

This guide covers migrating the Context Tracker from Deal Capsule to the new Admin Tools section.

## Current State

```
Deal Capsule
└── Context Tracker (embedded)
    ├── Notes
    ├── Activity Timeline
    ├── Contacts
    ├── Documents
    ├── Financial Snapshot
    ├── Key Dates
    ├── Decisions
    ├── Risks
    ├── DD Checklist
    └── Entitlements
```

## Target State

```
Navigation:
├── Dashboard
├── Pipeline / Deal Capsules    ← Shareable (external safe)
├── Admin Tools                 ← 🔒 Internal only
│   ├── Deal Intelligence
│   │   ├── Notes (by deal)
│   │   ├── Decisions
│   │   ├── Risks
│   │   ├── Contacts
│   │   ├── Activity Timeline
│   │   └── DD Checklist
│   ├── Team & Access
│   ├── AI Configuration
│   ├── Integrations
│   ├── Templates
│   ├── Data Room
│   ├── Verification
│   ├── Data Management
│   ├── Billing & Usage
│   └── Notifications
└── Settings
```

## Benefits

1. **Security**: Sensitive deal notes/decisions aren't exposed when sharing Deal Capsules
2. **Clean separation**: Deal Capsule = presentation layer, Admin Tools = internal operations
3. **Scalability**: Admin Tools can grow independently of deal view
4. **Access control**: Role-based access (Analyst sees Intel only, Viewer sees nothing)

---

## Migration Steps

### Step 1: Add Admin Tools Route

In `frontend/src/App.tsx`:

```tsx
import AdminToolsPage from './pages/admin/AdminToolsPage';

// In your routes:
<Route path="/admin/*" element={<AdminToolsPage />} />
```

### Step 2: Copy Admin Tools Files

Copy the entire `admin-tools/` folder to your project:

```bash
cp -r jedire-patches/admin-tools/* frontend/src/pages/admin/
```

File structure:
```
frontend/src/pages/admin/
├── AdminToolsPage.tsx
└── sections/
    ├── DealIntelligenceSection.tsx
    ├── TeamSection.tsx
    ├── AIConfigSection.tsx
    ├── IntegrationsSection.tsx
    ├── TemplatesSection.tsx
    ├── DataRoomSection.tsx
    ├── VerificationSection.tsx
    ├── DataManagementSection.tsx
    ├── BillingSection.tsx
    ├── NotificationsSection.tsx
    └── intel/
        ├── NotesTab.tsx
        ├── DecisionsTab.tsx
        ├── RisksTab.tsx
        ├── ContactsTab.tsx
        ├── ActivityTab.tsx
        └── ChecklistTab.tsx
```

### Step 3: Update Navigation

Add Admin Tools to your sidebar navigation:

```tsx
// In your sidebar/navigation component
const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/deals', label: 'Deal Capsules', icon: '🏢' },
  { path: '/admin', label: 'Admin Tools', icon: '🔒' },  // Add this
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];
```

### Step 4: Remove Context Tracker from Deal Capsule

In your Deal Capsule page (e.g., `DealDetailPage.tsx` or `CapsuleDetailPage.tsx`):

1. Find the tab that renders Context Tracker
2. Remove it from the tabs array
3. Optionally add a link: "View in Admin Tools →"

```tsx
// Before
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'financials', label: 'Financials' },
  { key: 'context', label: 'Context Tracker' },  // Remove this
  { key: 'documents', label: 'Documents' },
];

// After
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'financials', label: 'Financials' },
  { key: 'documents', label: 'Documents' },
];

// Optional: Add link to Admin Tools
<Link to={`/admin/intel?deal=${dealId}`}>
  View notes & decisions in Admin Tools →
</Link>
```

### Step 5: Wire Up Data

The Admin Tools components use mock data by default. Connect them to your existing API:

#### NotesTab.tsx

Replace mock data with API calls:

```tsx
// Replace MOCK_NOTES with API fetch
useEffect(() => {
  const fetchNotes = async () => {
    const response = await fetch(`/api/v1/deals/${dealId}/notes`);
    const data = await response.json();
    setNotes(data.notes);
  };
  fetchNotes();
}, [dealId]);
```

#### Existing API Endpoints to Use

These should already exist from Context Tracker:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/deals/:id/notes` | Fetch deal notes |
| `POST /api/v1/deals/:id/notes` | Create note |
| `PUT /api/v1/deals/:id/notes/:noteId` | Update note |
| `DELETE /api/v1/deals/:id/notes/:noteId` | Delete note |
| `GET /api/v1/deals/:id/activity` | Activity timeline |
| `GET /api/v1/deals/:id/contacts` | Deal contacts |
| `GET /api/v1/deals/:id/decisions` | Decision log |
| `GET /api/v1/deals/:id/risks` | Risk register |
| `GET /api/v1/deals/:id/checklist` | DD checklist |

### Step 6: Add Deal Selector Context

The AdminToolsPage includes a deal selector dropdown. Wire it to filter data:

```tsx
// In AdminToolsPage.tsx, pass selectedDeal to child components
<DealIntelligenceSection dealId={selectedDeal} />

// Or use React Context
const AdminContext = createContext({ selectedDeal: 'all' });

// In child components
const { selectedDeal } = useContext(AdminContext);
```

---

## Database

**No schema changes required!**

The existing `deal_context_*` tables work as-is:
- `deal_notes`
- `deal_decisions`
- `deal_risks`
- `deal_contacts`
- `deal_activity`
- `deal_checklist_items`

Just access them from the new Admin Tools UI instead of Context Tracker.

---

## Access Control

### Role Matrix

| Role | Deal Capsules | Admin Tools | Team Mgmt | Billing |
|------|---------------|-------------|-----------|---------|
| **Admin** | Full | Full | Full | Full |
| **Analyst** | Full | Intel Only | ❌ | ❌ |
| **Viewer** | Read-only | ❌ | ❌ | ❌ |
| **External** | Shared items | ❌ | ❌ | ❌ |

### Implementation

```tsx
// In AdminToolsPage.tsx or a guard component
const { user } = useAuth();

if (user.role === 'viewer' || user.role === 'external') {
  return <Navigate to="/deals" />;
}

// For analysts, only show Intel section
const visibleSections = user.role === 'analyst' 
  ? ['intel'] 
  : ['intel', 'team', 'ai', 'integrations', ...];
```

---

## Sharing Deal Capsules

When a user shares a Deal Capsule (e.g., with an investor):

1. ✅ They see: Overview, Financials, Documents, Market Intel
2. ❌ They DON'T see: Notes, Decisions, Risks, Internal Contacts

This happens automatically since Admin Tools is a separate route that external users can't access.

---

## Testing Checklist

- [ ] Admin Tools route accessible at `/admin`
- [ ] Deal selector filters data correctly
- [ ] Notes CRUD works (create, read, update, delete)
- [ ] Decisions tab loads (stub for now)
- [ ] Risks tab loads (stub for now)
- [ ] Team section shows members
- [ ] Integrations page shows all services
- [ ] Access control prevents Viewer/External access
- [ ] Deal Capsule no longer shows Context Tracker
- [ ] Shared Deal Capsule doesn't expose internal data

---

## Rollback

If you need to revert:

1. Remove `/admin` route from App.tsx
2. Delete `frontend/src/pages/admin/` folder
3. Re-add Context Tracker tab to Deal Capsule
4. Remove "Admin Tools" from navigation

No database changes to revert.
