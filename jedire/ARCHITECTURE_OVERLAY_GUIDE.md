# 🏗️ Architecture Overlay Guide

## Overview

The Architecture Overlay feature provides a **visual architecture inspector** that shows developers and users exactly what's happening under the hood on each page:

- **Frontend Layer**: React component, state management, API calls
- **Backend Layer**: Services, database tables, key features

## ✅ What's Included

### 1. Core Components
- `ArchitectureOverlay.tsx` - Modal overlay component
- `ArchitectureContext.tsx` - Global state management
- `architectureMetadata.ts` - Architecture definitions for all pages

### 2. Updated Components
- `PageHeader.tsx` - Now includes "🏗️ Show Architecture" button
- `App.tsx` - Wrapped with ArchitectureProvider
- `Dashboard.tsx` - Example usage
- `PropertiesPage.tsx` - Example usage

### 3. Defined Pages
8 pages with complete architecture metadata:
- Dashboard
- Properties Search
- Create Deal
- Deal View
- Pipeline
- AI Agents
- Analysis Results
- System Architecture

## 🎯 How to Use

### For Page Developers

**Option 1: Use PageHeader (Recommended)**

```tsx
import { PageHeader } from '../components/layout/PageHeader';
import { architectureMetadata } from '../data/architectureMetadata';

export function MyPage() {
  return (
    <div>
      <PageHeader
        title="My Page"
        description="Page description"
        icon="📊"
        architectureInfo={architectureMetadata.myPage}
      />
      {/* Rest of your page */}
    </div>
  );
}
```

**Option 2: Custom Button**

```tsx
import { useArchitecture } from '../contexts/ArchitectureContext';
import { architectureMetadata } from '../data/architectureMetadata';

export function MyPage() {
  const { openArchitecture } = useArchitecture();

  return (
    <div>
      <button onClick={() => openArchitecture(architectureMetadata.myPage)}>
        🏗️ Show Architecture
      </button>
      {/* Rest of your page */}
    </div>
  );
}
```

### Adding New Page Metadata

Edit `architectureMetadata.ts`:

```ts
export const architectureMetadata: Record<string, ArchitectureInfo> = {
  // ... existing pages

  myNewPage: {
    page: 'My New Page',
    frontend: {
      component: 'MyNewPage.tsx',
      state: 'Zustand (myStore)',
      apis: [
        'GET /api/v1/my-resource',
        'POST /api/v1/my-resource'
      ],
    },
    backend: {
      service: 'MyResourceService',
      database: ['my_resource table', 'related_table'],
      features: [
        'Feature 1 description',
        'Feature 2 description',
        'PostGIS spatial queries',
      ],
    },
  },
};
```

## 🎨 Visual Design

### Overlay Appearance

```
┌─────────────────────────────────────────────────┐
│ 🏗️ Architecture View                    [X]    │
├─────────────────────────────────────────────────┤
│ Page: Dashboard                                 │
│                                                 │
│ ┌─────────────────────────────────────┐        │
│ │ 🔵 FRONTEND LAYER                   │        │
│ │ • React Component: Dashboard.tsx    │        │
│ │ • State: Zustand (dealStore)        │        │
│ │ • API: GET /api/v1/deals            │        │
│ │ • API: GET /api/v1/properties       │        │
│ └─────────────────────────────────────┘        │
│                                                 │
│ ┌─────────────────────────────────────┐        │
│ │ 🟢 BACKEND MODULE                   │        │
│ │ • Service: DealsService             │        │
│ │ • Database: deals table             │        │
│ │ • Database: properties table        │        │
│ │ • Map rendering with Mapbox         │        │
│ │ • Real-time deal updates            │        │
│ └─────────────────────────────────────┘        │
│                                                 │
│ This overlay shows the technical architecture  │
│ powering this page.                            │
└─────────────────────────────────────────────────┘
```

### Color Coding
- **Blue** (🔵) = Frontend layer
- **Green** (🟢) = Backend layer

## 📊 Benefits

### For Developers
1. **Instant onboarding** - New developers see exactly what connects where
2. **Architecture documentation** - Live, always up-to-date
3. **API discovery** - Know which endpoints to call
4. **Database awareness** - Understand data model at a glance

### For Product Owners
1. **System transparency** - See what's built and what's working
2. **Technical debt tracking** - Identify complex areas
3. **Feature completeness** - Verify all modules are connected

### For Users (Power Users)
1. **Platform understanding** - Know what the system is doing
2. **Trust building** - Transparency about technical capabilities
3. **Feature discovery** - Learn about hidden features

## 🔧 Technical Details

### State Management

```tsx
interface ArchitectureContextType {
  isOpen: boolean;                          // Is overlay visible?
  currentInfo: ArchitectureInfo | null;     // Current page metadata
  openArchitecture: (info) => void;         // Show overlay
  closeArchitecture: () => void;            // Hide overlay
  toggleArchitecture: () => void;           // Toggle visibility
}
```

### Data Structure

```tsx
interface ArchitectureInfo {
  page: string;                    // Page name
  frontend: {
    component: string;             // Main React component
    state?: string;                // State management (optional)
    apis: string[];                // API endpoints called
  };
  backend: {
    service: string;               // Backend service
    database: string[];            // Database tables used
    features: string[];            // Key features/capabilities
  };
}
```

## 🚀 Future Enhancements

### Phase 2 (Optional)
- [ ] **Real-time metrics** - Show API response times
- [ ] **Live data flow** - Animate data flowing through layers
- [ ] **Performance insights** - Flag slow endpoints
- [ ] **Security indicators** - Show auth requirements
- [ ] **Database query viewer** - See actual SQL queries
- [ ] **API playground** - Test endpoints directly from overlay

### Phase 3 (Advanced)
- [ ] **Interactive mode** - Click to jump to code in IDE
- [ ] **Dependency graph** - Visual component tree
- [ ] **Network waterfall** - See all API calls in sequence
- [ ] **State inspector** - View current Redux/Zustand state
- [ ] **Error tracking** - Show recent errors on this page

## 🎓 Best Practices

### 1. Keep Metadata Updated
When you change a page's architecture:
- Update `architectureMetadata.ts` immediately
- Document new API endpoints
- Add new database tables
- Describe new features

### 2. Be Descriptive
Good feature descriptions:
- ✅ "PostGIS boundary queries with spatial indexing"
- ✅ "Real-time WebSocket updates (Socket.io)"
- ✅ "JEDI Score calculation (0-100 scale)"

Bad feature descriptions:
- ❌ "Database stuff"
- ❌ "API calls"
- ❌ "Does things"

### 3. Include All APIs
List every API endpoint the page calls:
```ts
apis: [
  'GET /api/v1/deals',
  'POST /api/v1/deals',
  'PATCH /api/v1/deals/:id',
  'DELETE /api/v1/deals/:id',
]
```

### 4. Document State Management
Be specific about state:
- `Zustand (dealStore)` ✅
- `Redux (dealsSlice)` ✅
- `React Context (AuthContext)` ✅
- `Local state (useState)` ✅
- `Just state` ❌ (too vague)

## 🧪 Testing

### Manual Test Checklist
- [ ] Click "🏗️ Show Architecture" button on Dashboard
- [ ] Verify overlay opens with correct data
- [ ] Check blue frontend box shows component/state/APIs
- [ ] Check green backend box shows service/database/features
- [ ] Click X to close overlay
- [ ] Test on different pages
- [ ] Verify all 8 predefined pages work

### Example Test Script

```bash
# Start dev server
cd frontend
npm run dev

# Navigate to:
# http://localhost:5173/dashboard
# http://localhost:5173/properties
# http://localhost:5173/deals

# On each page:
# 1. Look for "🏗️ Show Architecture" button in header
# 2. Click it
# 3. Verify overlay appears
# 4. Check all information is correct
# 5. Close overlay
```

## 📝 Example: Adding Email Page

1. **Define metadata** in `architectureMetadata.ts`:

```ts
email: {
  page: 'Email Hub',
  frontend: {
    component: 'EmailPage.tsx',
    state: 'Zustand (emailStore)',
    apis: [
      'GET /api/v1/emails',
      'POST /api/v1/emails/send',
      'GET /api/v1/emails/templates',
    ],
  },
  backend: {
    service: 'EmailService',
    database: ['deal_emails', 'email_templates', 'contacts'],
    features: [
      'Gmail API integration',
      'Template system',
      'Contact management',
      'Automatic email threading',
    ],
  },
},
```

2. **Update EmailPage.tsx**:

```tsx
import { PageHeader } from '../components/layout/PageHeader';
import { architectureMetadata } from '../data/architectureMetadata';

export function EmailPage() {
  return (
    <div>
      <PageHeader
        title="Email Hub"
        description="Manage property communications"
        icon="📧"
        architectureInfo={architectureMetadata.email}
      />
      {/* Rest of email page */}
    </div>
  );
}
```

3. **Done!** ✅ Email page now has architecture overlay

## 🎉 Success Metrics

### Short-term (Week 1)
- All 8 core pages have architecture overlay
- Overlay loads in <100ms
- Zero console errors
- Button is visible on all pages

### Medium-term (Month 1)
- New developers use overlay during onboarding
- 50% reduction in "where is this API?" questions
- Architecture metadata always up-to-date
- All new pages include architecture info

### Long-term (Quarter 1)
- Architecture overlay becomes standard practice
- Documentation stays synchronized with code
- New features automatically documented
- Power users discover advanced features

## 🆘 Troubleshooting

### Overlay doesn't appear
1. Check browser console for errors
2. Verify `ArchitectureProvider` wraps app in `App.tsx`
3. Confirm page has `architectureInfo` prop in PageHeader
4. Check that metadata key exists in `architectureMetadata.ts`

### Button not showing
1. Verify PageHeader imported correctly
2. Check `architectureInfo` prop is passed
3. Inspect with React DevTools to see props

### Wrong data showing
1. Check metadata key matches page name
2. Verify `architectureMetadata.ts` exported correctly
3. Clear cache and rebuild

## 📚 References

- **Component**: `/frontend/src/components/ArchitectureOverlay.tsx`
- **Context**: `/frontend/src/contexts/ArchitectureContext.tsx`
- **Metadata**: `/frontend/src/data/architectureMetadata.ts`
- **Header**: `/frontend/src/components/layout/PageHeader.tsx`
- **Examples**: Dashboard, PropertiesPage

---

**Created**: Feb 6, 2026  
**Status**: ✅ Implemented & Ready  
**Next**: Add to remaining pages (Email, Reports, Team, Settings)
