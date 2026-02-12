# Deal Pipeline Components

Full kanban-style deal pipeline management system for the JEDI RE Agent Dashboard.

## 📦 Components

### DealPipeline (Main Component)
Kanban board with drag-and-drop functionality for managing deals across stages.

**Features:**
- 5 stage columns: Lead → Qualified → Under Contract → Closed → Lost
- Drag-and-drop between stages (updates deal status)
- Stage totals (count + total value)
- Filtering and sorting
- Real-time updates

**Props:**
```tsx
interface DealPipelineProps {
  apiBaseUrl?: string; // Default: '/api/agent'
}
```

**Usage:**
```tsx
import { DealPipeline } from '@/components/agent/deals';

function AgentDashboard() {
  return <DealPipeline apiBaseUrl="/api/agent" />;
}
```

### DealCard
Individual deal card displayed in the kanban columns.

**Features:**
- Property address
- Deal type badge (Buyer/Seller/Both)
- Deal value & commission estimate
- Client name (clickable)
- Days in stage indicator
- Priority flag (high/medium)
- Responsive hover effects

**Props:**
```tsx
interface DealCardProps {
  deal: Deal;
  onClick: (deal: Deal) => void;
  isDragging?: boolean;
}
```

### DealDetailModal
Full details modal with all deal information and actions.

**Features:**
- Complete deal information display
- Key metrics (deal value, commission, days active)
- Client information section
- Timeline (created, expected close, actual close)
- Stage update buttons
- Activity timeline
- Add notes functionality
- Edit and archive buttons

**Props:**
```tsx
interface DealDetailModalProps {
  deal: Deal;
  onClose: () => void;
  onEdit: (deal: Deal) => void;
  onUpdateStage: (dealId: string, newStage: DealStage) => Promise<void>;
  onArchive: (dealId: string) => Promise<void>;
  onAddNote: (dealId: string, note: string) => Promise<void>;
}
```

### DealForm
Add/edit deal form with validation.

**Features:**
- Client selection (dropdown)
- Property address input
- Deal type selection (Buyer/Seller/Both)
- Deal value & commission rate inputs
- Real-time commission estimate calculation
- Expected close date picker
- Priority selection
- Notes textarea
- Form validation
- Loading states

**Props:**
```tsx
interface DealFormProps {
  deal?: Deal; // If provided, form is in edit mode
  clients: Client[];
  onSubmit: (data: DealFormData) => Promise<void>;
  onCancel: () => void;
}
```

### DealFilters
Filtering and sorting controls for the pipeline.

**Features:**
- Filter by deal type (Buyer/Seller/Both)
- Filter by priority (Low/Medium/High)
- Filter by client (dropdown)
- Filter by expected close date range
- Sort by value, date, or priority
- Sort order toggle (ascending/descending)
- Active filter count indicator
- Clear all filters button

**Props:**
```tsx
interface DealFiltersProps {
  filters: DealFiltersState;
  onChange: (filters: DealFiltersState) => void;
  clients: Array<{ id: string; name: string }>;
}
```

## 📡 API Integration

The components expect the following API endpoints:

### GET /api/agent/deals
Fetch all deals for the authenticated user.

**Response:**
```json
{
  "deals": [
    {
      "id": "deal_123",
      "clientId": "client_456",
      "clientName": "John Doe",
      "propertyAddress": "123 Main St, Austin, TX 78701",
      "dealType": "buyer",
      "stage": "qualified",
      "dealValue": 500000,
      "commissionRate": 3,
      "commissionEstimate": 15000,
      "expectedCloseDate": "2024-03-15",
      "actualCloseDate": null,
      "priority": "high",
      "notes": "Client is very motivated",
      "createdAt": "2024-02-01T10:00:00Z",
      "updatedAt": "2024-02-05T14:30:00Z",
      "daysInStage": 4,
      "activities": [...]
    }
  ]
}
```

### POST /api/agent/deals
Create a new deal.

**Request Body:**
```json
{
  "clientId": "client_456",
  "propertyAddress": "123 Main St, Austin, TX 78701",
  "dealType": "buyer",
  "dealValue": 500000,
  "commissionRate": 3,
  "expectedCloseDate": "2024-03-15",
  "priority": "high",
  "notes": "Client is very motivated"
}
```

### PATCH /api/agent/deals/:id
Update an existing deal (including stage changes).

**Request Body:**
```json
{
  "stage": "under_contract",
  // ... or any other deal fields to update
}
```

### DELETE /api/agent/deals/:id
Archive/delete a deal.

### POST /api/agent/deals/:id/notes
Add a note to a deal's activity timeline.

**Request Body:**
```json
{
  "note": "Had a great showing today!"
}
```

### GET /api/agent/clients
Fetch all clients for client selection dropdown.

**Response:**
```json
{
  "clients": [
    {
      "id": "client_456",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "type": "buyer"
    }
  ]
}
```

## 🎨 Design Features

### Drag and Drop
- Powered by `@dnd-kit` library
- Smooth animations
- Visual feedback during drag
- Optimistic updates
- Server-side persistence

### Color Coding
- **Lead**: Gray
- **Qualified**: Blue
- **Under Contract**: Yellow
- **Closed**: Green
- **Lost**: Red

### Priority Indicators
- **High**: Red flag icon
- **Medium**: Yellow flag icon
- **Low**: No indicator

### Responsive Design
- Desktop: Full kanban board with 5 columns
- Mobile: Could be adapted to list view (future enhancement)

## 📝 Type Definitions

All types are defined in `/src/types/index.ts`:

```typescript
export type DealStage = 'lead' | 'qualified' | 'under_contract' | 'closed' | 'lost';
export type DealType = 'buyer' | 'seller' | 'both';
export type DealPriority = 'low' | 'medium' | 'high';

export interface Deal {
  id: string;
  clientId: string;
  clientName: string;
  propertyAddress: string;
  dealType: DealType;
  stage: DealStage;
  dealValue: number;
  commissionRate: number;
  commissionEstimate: number;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  priority: DealPriority;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  daysInStage: number;
  activities?: DealActivity[];
}
```

## 🚀 Getting Started

1. **Install dependencies** (already done):
   ```bash
   npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

2. **Import and use the pipeline**:
   ```tsx
   import { DealPipeline } from '@/components/agent/deals';

   function AgentDashboard() {
     return (
       <div className="h-screen">
         <DealPipeline />
       </div>
     );
   }
   ```

3. **Ensure authentication**:
   The components use `localStorage.getItem('token')` for authentication.
   Make sure your auth system stores the JWT token there.

4. **Backend implementation**:
   Implement the required API endpoints on your backend.

## 🎯 Features Checklist

- ✅ Kanban board with 5 stages
- ✅ Drag-and-drop between stages
- ✅ Deal cards with all key information
- ✅ Stage totals (count + value)
- ✅ Filter by client, deal type, priority, date range
- ✅ Sort by value, date, priority
- ✅ Click to open detail modal
- ✅ Full deal detail modal with timeline
- ✅ Edit deal form
- ✅ Add new deal form
- ✅ Update stage buttons
- ✅ Add notes to deals
- ✅ Archive deals
- ✅ Visual priority indicators
- ✅ Days in stage counter
- ✅ Commission calculation
- ✅ Optimistic UI updates
- ✅ Error handling
- ✅ Loading states
- ✅ Responsive animations

## 🔧 Customization

### Change API Base URL
```tsx
<DealPipeline apiBaseUrl="/api/v2/agent" />
```

### Styling
All components use Tailwind CSS classes. Customize colors, spacing, etc. by editing the component files.

### Add Custom Stages
Edit `stageConfig` and `stageOrder` in `DealPipeline.tsx`:
```tsx
const stageOrder: DealStage[] = ['lead', 'qualified', 'negotiating', 'under_contract', 'closed', 'lost'];
```

## 📚 Dependencies

- **React**: ^18.2.0
- **@dnd-kit/core**: ^6.x
- **@dnd-kit/sortable**: ^8.x
- **@dnd-kit/utilities**: ^3.x
- **lucide-react**: ^0.309.0 (icons)
- **date-fns**: ^3.0.6 (date formatting)
- **Tailwind CSS**: ^3.4.1

## 🐛 Troubleshooting

### Drag and drop not working
- Ensure `@dnd-kit` packages are installed
- Check that deal IDs are unique
- Verify the `id` prop is correctly passed to sortable items

### API calls failing
- Check authentication token in localStorage
- Verify API endpoints match backend implementation
- Check CORS settings on backend
- Look for errors in browser console

### Types not found
- Ensure types are imported from `@/types`
- Verify `tsconfig.json` has the correct path alias for `@`

## 📖 Example Integration

See the example below for integrating the pipeline into a React Router app:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DealPipeline } from '@/components/agent/deals';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/agent/deals" element={<DealPipeline />} />
        {/* Other routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

## 📄 License

Part of the JEDI RE Agent Dashboard project.
