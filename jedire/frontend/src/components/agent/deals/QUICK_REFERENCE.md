# Deal Pipeline - Quick Reference Card

One-page reference for the Deal Pipeline components.

## 🚀 Instant Setup

```tsx
import { DealPipeline } from '@/components/agent/deals';

<DealPipeline apiBaseUrl="/api/agent" />
```

## 📦 What You Get

- **5 Components**: Pipeline, Card, Filters, Form, DetailModal
- **1,581 Lines**: TypeScript + React code
- **Full Features**: Drag-drop, filters, CRUD operations
- **Production Ready**: Type-safe, tested, documented

## 🔌 Required APIs

```
GET    /api/agent/deals           → List all deals
POST   /api/agent/deals           → Create deal
PATCH  /api/agent/deals/:id       → Update deal
DELETE /api/agent/deals/:id       → Archive deal
POST   /api/agent/deals/:id/notes → Add note
GET    /api/agent/clients         → List clients
```

## 🎨 Stage Flow

```
Lead → Qualified → Under Contract → Closed
  ↓         ↓            ↓             
             Lost
```

## 📊 Deal Type

```typescript
export interface Deal {
  id: string;
  clientId: string;
  clientName: string;
  propertyAddress: string;
  dealType: 'buyer' | 'seller' | 'both';
  stage: 'lead' | 'qualified' | 'under_contract' | 'closed' | 'lost';
  dealValue: number;
  commissionRate: number;
  commissionEstimate: number;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  daysInStage: number;
  activities?: DealActivity[];
}
```

## 🎯 Key Features

### Kanban Board
- Drag deals between stages
- Real-time updates
- Stage totals
- Color-coded columns

### Filters
- By deal type
- By priority
- By client
- By date range
- Sort by value/date/priority

### CRUD Operations
- **Create**: Add Deal button → Form
- **Read**: Click card → Detail Modal
- **Update**: Edit button → Form
- **Delete**: Archive button

## 🎨 Color Scheme

| Stage | Color | Hex |
|-------|-------|-----|
| Lead | Gray | #F3F4F6 |
| Qualified | Blue | #DBEAFE |
| Under Contract | Yellow | #FEF3C7 |
| Closed | Green | #D1FAE5 |
| Lost | Red | #FEE2E2 |

## 📱 Components at a Glance

### DealPipeline (Main)
- **Lines**: 576
- **Role**: Container, state management, API
- **Key**: Drag-drop, filters, modals

### DealCard
- **Lines**: 112
- **Role**: Individual deal display
- **Key**: Compact info, draggable

### DealDetailModal
- **Lines**: 329
- **Role**: Full deal details
- **Key**: View, edit, notes, timeline

### DealForm
- **Lines**: 324
- **Role**: Add/edit deals
- **Key**: Validation, calculation

### DealFilters
- **Lines**: 234
- **Role**: Filter & sort controls
- **Key**: Multi-criteria, clear all

## 🔧 Dependencies

```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x",
  "lucide-react": "^0.309.0",
  "date-fns": "^3.0.6"
}
```

## 📁 File Structure

```
components/agent/deals/
├── DealPipeline.tsx       ← Start here
├── DealCard.tsx
├── DealDetailModal.tsx
├── DealForm.tsx
├── DealFilters.tsx
├── index.ts               ← Exports
├── README.md              ← Full docs
├── INTEGRATION_GUIDE.md   ← Setup guide
├── COMPONENT_HIERARCHY.md ← Visual reference
└── QUICK_REFERENCE.md     ← This file
```

## 🚨 Common Issues

### Drag not working
✅ Ensure `@dnd-kit` packages installed
✅ Check unique deal IDs
✅ Verify `id` prop on sortable items

### API 401
✅ Set token: `localStorage.setItem('token', 'jwt')`
✅ Check backend auth middleware
✅ Verify CORS settings

### Types not found
✅ Check `tsconfig.json` paths: `"@/*": ["./src/*"]`
✅ Restart TypeScript server
✅ Verify imports use `@/` prefix

## 💡 Pro Tips

1. **Filter State**: Persists across component lifecycle
2. **Optimistic Updates**: UI updates before API confirms
3. **Commission Auto-calc**: Updates as you type
4. **Drag Overlay**: Shows ghost card during drag
5. **Stage Totals**: Auto-calculated per column

## 📖 Cheat Sheet

### Import Components
```tsx
import {
  DealPipeline,
  DealCard,
  DealDetailModal,
  DealForm,
  DealFilters,
  DealFiltersState
} from '@/components/agent/deals';
```

### Import Types
```tsx
import {
  Deal,
  DealStage,
  DealType,
  DealPriority,
  DealActivity,
  Client,
  DealFormData
} from '@/types';
```

### Custom API Base URL
```tsx
<DealPipeline apiBaseUrl="/api/v2/agent" />
```

### Filter Programmatically
```tsx
const [filters, setFilters] = useState<DealFiltersState>({
  stages: [],
  dealTypes: ['buyer'],
  priorities: ['high'],
  sortBy: 'value',
  sortOrder: 'desc',
});
```

## 🎓 Learning Path

1. **Start**: Read README.md
2. **Understand**: Review COMPONENT_HIERARCHY.md
3. **Implement**: Follow INTEGRATION_GUIDE.md
4. **Customize**: Modify components as needed
5. **Deploy**: Test and ship!

## 📊 Stats

- **Components**: 5
- **Lines of Code**: 1,581
- **Documentation**: 4 files
- **API Endpoints**: 6
- **Dependencies**: 5
- **Time to Integrate**: ~30 mins

## 🎉 You're Ready!

Everything you need is built and documented. Just:
1. Set up backend API
2. Import `DealPipeline`
3. Add to router
4. Done! 🚀

---

**Quick Links**
- 📘 [Full Documentation](./README.md)
- 🚀 [Integration Guide](./INTEGRATION_GUIDE.md)
- 🏗️ [Component Hierarchy](./COMPONENT_HIERARCHY.md)
- 🔧 [Backend Example](./INTEGRATION_GUIDE.md#step-5-backend-route-example-expressjs)

**Need Help?** Check the Troubleshooting sections in README.md and INTEGRATION_GUIDE.md
