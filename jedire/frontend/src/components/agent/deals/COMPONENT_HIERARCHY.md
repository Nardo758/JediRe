# Deal Pipeline - Component Hierarchy

Visual reference for component relationships and data flow.

## 📊 Component Tree

```
DealPipeline (Main Container)
├── DealFilters
│   └── Filter Controls
│       ├── Deal Type Buttons
│       ├── Priority Buttons
│       ├── Client Dropdown
│       ├── Date Range Inputs
│       └── Sort Controls
│
├── Kanban Board (DndContext)
│   ├── Stage Column: Lead
│   │   └── DealCard (sortable)
│   │       └── onClick → opens DealDetailModal
│   │
│   ├── Stage Column: Qualified
│   │   └── DealCard (sortable)
│   │
│   ├── Stage Column: Under Contract
│   │   └── DealCard (sortable)
│   │
│   ├── Stage Column: Closed
│   │   └── DealCard (sortable)
│   │
│   └── Stage Column: Lost
│       └── DealCard (sortable)
│
├── DealDetailModal (conditional)
│   ├── Deal Information Display
│   ├── Client Information
│   ├── Timeline Display
│   ├── Stage Update Buttons
│   ├── Activity Timeline
│   ├── Add Note Form
│   ├── Edit Button → opens DealForm
│   └── Archive Button
│
└── DealForm (conditional)
    ├── Client Selection
    ├── Property Address
    ├── Deal Type Selection
    ├── Value & Commission Inputs
    ├── Commission Calculator (display)
    ├── Expected Close Date
    ├── Priority Selection
    ├── Notes Textarea
    └── Submit/Cancel Buttons
```

## 🔄 Data Flow

```
API Endpoints
     ↓
DealPipeline (state management)
     ↓
     ├──→ filteredDeals ──→ DealCard (display)
     ├──→ clients ──→ DealFilters & DealForm
     ├──→ selectedDeal ──→ DealDetailModal
     └──→ editingDeal ──→ DealForm

User Actions
     ├─ Drag Deal ──→ handleDragEnd ──→ PATCH /api/agent/deals/:id
     ├─ Click Card ──→ setSelectedDeal ──→ show DealDetailModal
     ├─ Click Edit ──→ setEditingDeal ──→ show DealForm
     ├─ Submit Form ──→ POST/PATCH /api/agent/deals
     ├─ Update Stage ──→ handleUpdateStage ──→ PATCH /api/agent/deals/:id
     ├─ Add Note ──→ handleAddNote ──→ POST /api/agent/deals/:id/notes
     └─ Archive ──→ handleArchive ──→ DELETE /api/agent/deals/:id
```

## 🎯 State Management

### DealPipeline State
```tsx
{
  deals: Deal[]                    // All deals from API
  clients: Client[]                // All clients for dropdown
  isLoading: boolean               // Initial load state
  error: string | null             // Error message
  selectedDeal: Deal | null        // Currently viewed deal
  editingDeal: Deal | null         // Currently editing deal
  showAddForm: boolean             // Show add form
  activeDragId: string | null      // Currently dragging deal
  filters: DealFiltersState        // Active filters
}
```

### DealFilters State
```tsx
{
  stages: DealStage[]              // Filter by stages (not currently used)
  dealTypes: DealType[]            // Filter by deal types
  priorities: DealPriority[]       // Filter by priorities
  clientId?: string                // Filter by client
  dateFrom?: string                // Filter by date range start
  dateTo?: string                  // Filter by date range end
  sortBy: 'value'|'date'|'priority'
  sortOrder: 'asc'|'desc'
}
```

### DealForm State
```tsx
{
  formData: DealFormData           // Form field values
  isSubmitting: boolean            // Submit in progress
  errors: Record<string, string>   // Validation errors
}
```

## 🔀 Component Interactions

### Opening a Deal Detail
```
User clicks DealCard
  ↓
DealCard calls onClick(deal)
  ↓
DealPipeline sets selectedDeal
  ↓
DealDetailModal renders with deal data
```

### Editing a Deal
```
User clicks Edit in DealDetailModal
  ↓
DealDetailModal calls onEdit(deal)
  ↓
DealPipeline sets editingDeal and clears selectedDeal
  ↓
DealForm renders in edit mode
```

### Dragging a Deal
```
User starts dragging DealCard
  ↓
DndContext fires onDragStart
  ↓
DealPipeline sets activeDragId
  ↓
DragOverlay shows ghost card
  ↓
User drops in new column
  ↓
DndContext fires onDragEnd with new stage
  ↓
DealPipeline updates state optimistically
  ↓
PATCH request to backend
  ↓
Backend response updates state with real data
```

### Filtering Deals
```
User changes filter in DealFilters
  ↓
DealFilters calls onChange(newFilters)
  ↓
DealPipeline updates filters state
  ↓
useMemo recalculates filteredDeals
  ↓
Components re-render with filtered data
```

## 🎨 Style Classes Reference

### Common Classes
```css
/* Cards */
.card-base: bg-white rounded-lg border border-gray-200 p-4

/* Buttons */
.btn-primary: bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700
.btn-secondary: border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50

/* Badges */
.badge: px-2 py-0.5 rounded text-xs font-medium

/* Stage Colors */
.stage-lead: bg-gray-100 border-gray-300
.stage-qualified: bg-blue-100 border-blue-300
.stage-under-contract: bg-yellow-100 border-yellow-300
.stage-closed: bg-green-100 border-green-300
.stage-lost: bg-red-100 border-red-300

/* Priority Colors */
.priority-high: text-red-700 bg-red-100
.priority-medium: text-yellow-700 bg-yellow-100
.priority-low: text-gray-600 bg-gray-100
```

## 🔌 API Integration Points

### Component → API Mapping
```
DealPipeline.fetchDeals()
  → GET /api/agent/deals

DealPipeline.fetchClients()
  → GET /api/agent/clients

DealPipeline.handleCreateDeal()
  → POST /api/agent/deals

DealPipeline.handleUpdateDeal()
  → PATCH /api/agent/deals/:id

DealPipeline.handleUpdateStage()
  → PATCH /api/agent/deals/:id

DealPipeline.handleArchive()
  → DELETE /api/agent/deals/:id

DealPipeline.handleAddNote()
  → POST /api/agent/deals/:id/notes
```

## 📦 Props Interfaces

### DealCard
```tsx
interface DealCardProps {
  deal: Deal;                     // Deal data to display
  onClick: (deal: Deal) => void;  // Click handler
  isDragging?: boolean;           // Drag state (from dnd-kit)
}
```

### DealFilters
```tsx
interface DealFiltersProps {
  filters: DealFiltersState;                      // Current filter state
  onChange: (filters: DealFiltersState) => void;  // Filter change handler
  clients: Array<{id: string; name: string}>;     // Client options
}
```

### DealForm
```tsx
interface DealFormProps {
  deal?: Deal;                                  // If editing (optional)
  clients: Client[];                            // Client options
  onSubmit: (data: DealFormData) => Promise<void>;  // Submit handler
  onCancel: () => void;                         // Cancel handler
}
```

### DealDetailModal
```tsx
interface DealDetailModalProps {
  deal: Deal;                                          // Deal to display
  onClose: () => void;                                 // Close handler
  onEdit: (deal: Deal) => void;                        // Edit handler
  onUpdateStage: (id: string, stage: DealStage) => Promise<void>;
  onArchive: (dealId: string) => Promise<void>;        // Archive handler
  onAddNote: (dealId: string, note: string) => Promise<void>;
}
```

## 🎯 Key Features by Component

### DealPipeline
- State management
- API integration
- Drag-and-drop coordination
- Filter/sort logic
- Modal management

### DealCard
- Visual presentation
- Drag handle
- Click to detail
- Responsive sizing

### DealFilters
- Multi-criteria filtering
- Sort controls
- Active filter display
- Clear all functionality

### DealForm
- Input validation
- Real-time calculation
- Edit/create modes
- Error display

### DealDetailModal
- Information display
- Quick actions
- Activity timeline
- Note addition

## 🔄 Lifecycle Flow

### Initial Load
```
1. DealPipeline mounts
2. useEffect triggers
3. fetchDeals() → API call
4. fetchClients() → API call
5. State updates
6. Components render with data
```

### User Interaction
```
1. User interacts with component
2. Event handler called
3. State updated (optimistic)
4. API call made
5. Response received
6. State updated (actual)
7. UI reflects changes
```

## 🎨 Design Patterns Used

- **Container/Presenter**: DealPipeline (container) + presentational children
- **Controlled Components**: Forms controlled by parent state
- **Optimistic Updates**: UI updates before API confirms
- **Error Boundaries**: Try-catch with error state
- **Composition**: Small, focused components combined
- **Single Responsibility**: Each component has one job
- **Props Down, Events Up**: Data flows down, events bubble up

---

This hierarchy provides a mental model for understanding how the components work together!
