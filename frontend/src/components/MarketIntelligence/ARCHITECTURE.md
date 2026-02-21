# MarketDataTable Architecture

## 📐 Component Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    MarketDataTable Component                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Header Section                                          │    │
│  │ ┌──────────────────────────────────────────────────┐  │    │
│  │ │ • Building2 Icon + Title                          │  │    │
│  │ │ • Property Count (1,028 of 1,028)                 │  │    │
│  │ │ • MOCK DATA Badge                                 │  │    │
│  │ │ • Filters Button (with badge count)              │  │    │
│  │ └──────────────────────────────────────────────────┘  │    │
│  │ ┌──────────────────────────────────────────────────┐  │    │
│  │ │ Search Input (with Search icon)                   │  │    │
│  │ └──────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Filters Panel (collapsible, bg-gray-50)               │    │
│  │ ┌─────────────┬─────────────┬─────────────┐          │    │
│  │ │ Vintage     │ Owner Type  │ Units Range │          │    │
│  │ │ Class       │             │             │          │    │
│  │ │ ─────────   │ ─────────   │ ─────────   │          │    │
│  │ │ □ Pre-1980  │ □ LLC       │ Min: [  ]   │          │    │
│  │ │ □ 1980-1999 │ □ Inc       │ Max: [  ]   │          │    │
│  │ │ □ 2000-2009 │ □ LP        │             │          │    │
│  │ │ □ 2010+     │ □ Corp      │             │          │    │
│  │ │             │ □ Partners  │             │          │    │
│  │ └─────────────┴─────────────┴─────────────┘          │    │
│  │ [Reset all filters]                                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Data Table                                             │    │
│  │ ┏━━━━━━━━━┳━━━━━┳━━━━━━━━━┳━━━━━━━━━━┳━━━━━━┳━━━━━┓  │    │
│  │ ┃ Address ┃Units┃YearBuilt┃ Vintage  ┃Owner ┃ ... ┃  │    │
│  │ ┃    ⇅    ┃  ⇅  ┃    ⇅    ┃    ⇅     ┃  ⇅   ┃  ⇅  ┃  │    │
│  │ ┣━━━━━━━━━╋━━━━━╋━━━━━━━━━╋━━━━━━━━━━╋━━━━━━╋━━━━━┫  │    │
│  │ ┃ 245 ... ┃ 156 ┃  1985   ┃ 1980-99  ┃ Pied.┃ 800 ┃  │    │
│  │ ┃ 1050... ┃ 248 ┃  2018   ┃ 2010+    ┃ Midt.┃ 900 ┃  │    │
│  │ ┃ 788 ... ┃  92 ┃  2015   ┃ 2010+    ┃ West.┃ 900 ┃  │    │
│  │ ┃   ...   ┃ ... ┃   ...   ┃   ...    ┃ ...  ┃ ... ┃  │    │
│  │ ┃ (50 rows visible)                                  ┃  │    │
│  │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │    │
│  │                                                        │    │
│  │ [Click any row → onPropertyClick(propertyId)]         │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Pagination Controls                                     │    │
│  │  Showing 1 to 50 of 1,028 results                      │    │
│  │  [Previous] [1] [2] [3] [4] [5] ... [Next]            │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

```
┌─────────────────┐
│  Mock Data      │
│  Generator      │
│ (1,028 props)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ allProperties   │ ◄── useMemo (runs once)
│ (full dataset)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Apply Filters   │ ◄── filters state (search, vintage, owner, units)
│   • Search      │
│   • Vintage     │
│   • Owner Type  │
│   • Units Range │
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│filteredProperties│ ◄── useMemo (re-runs on filter change)
│   (subset)       │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Apply Sort     │ ◄── sortField, sortDirection state
│   • Field       │
│   • Direction   │
│   • Nulls last  │
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│ sortedProperties │ ◄── useMemo (re-runs on sort change)
│   (ordered)      │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│ Apply Pagination│ ◄── currentPage state
│   • Slice array │
│   • 50 per page │
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│currentProperties │ ◄── Final 50 items to render
│   (50 items)     │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Render Table   │
│    Rows (50)    │
└─────────────────┘
```

## 🧩 State Management

```typescript
// Data state
const allProperties = useMemo(() => generateMockPropertyData(1028), []);

// Pagination state
const [currentPage, setCurrentPage] = useState(1);

// Sorting state
const [sortField, setSortField] = useState<SortField | null>(null);
const [sortDirection, setSortDirection] = useState<SortDirection>(null);

// UI state
const [showFilters, setShowFilters] = useState(false);

// Filter state
const [filters, setFilters] = useState<Filters>({
  searchQuery: '',
  vintageClass: [],
  ownerType: [],
  unitsMin: null,
  unitsMax: null
});
```

## 🎯 Event Handlers

```
User Action          →  Handler Function           →  State Update
────────────────────────────────────────────────────────────────────
Type in search       →  onChange (input)           →  filters.searchQuery
Click vintage button →  handleVintageToggle()      →  filters.vintageClass[]
Click owner button   →  handleOwnerTypeToggle()    →  filters.ownerType[]
Enter units min/max  →  onChange (input)           →  filters.unitsMin/Max
Click column header  →  handleSort()               →  sortField, sortDirection
Click row            →  onClick (tr)               →  onPropertyClick(id)
Click page number    →  onClick (button)           →  setCurrentPage(n)
Click Next/Previous  →  onClick (button)           →  setCurrentPage(±1)
Click Filters button →  onClick (button)           →  setShowFilters(!show)
Click Reset filters  →  resetFilters()             →  filters = initial
```

## 📦 Component Dependencies

```
MarketDataTable.tsx
├── React
│   ├── useState (5 instances)
│   └── useMemo (3 instances)
├── lucide-react
│   ├── Search
│   ├── Filter
│   ├── ChevronUp
│   ├── ChevronDown
│   ├── ChevronsUpDown
│   ├── Building2
│   └── MapPin
├── @/mock/mockPropertyIntelligence
│   ├── generateMockPropertyData()
│   └── PropertyIntelligenceRecord (type)
└── TailwindCSS
    └── Utility classes (inline)
```

## 🎨 Styling System

```
Color Palette:
├── Primary:    blue-600 (#2563eb)
├── Secondary:  gray-50 to gray-900
├── Success:    green-600, green-100
├── Warning:    amber-600, amber-100
└── Vintage:
    ├── 2010+:      green-100/green-800
    ├── 2000-2009:  blue-100/blue-800
    ├── 1980-1999:  yellow-100/yellow-800
    └── Pre-1980:   gray-100/gray-800

Spacing:
├── Container padding: p-6
├── Section gaps:      gap-4, gap-6
├── Button padding:    px-3 py-2, px-4 py-2
└── Input padding:     px-3 py-2

Typography:
├── Title:    text-xl font-bold
├── Header:   text-sm font-medium uppercase
├── Body:     text-sm
├── Caption:  text-xs text-gray-600
└── Badge:    text-xs font-medium

Borders:
├── Radius:   rounded-lg, rounded-full
├── Width:    border, border-2
└── Color:    border-gray-200, border-gray-300

Shadows:
└── Card:     shadow-sm
```

## 🔀 Conditional Rendering

```
showFilters === true
└── <div className="p-6 bg-gray-50">
    └── Filter Panel (Vintage, Owner, Units)

currentProperties.length === 0
└── <div className="py-12 text-center">
    └── Empty State ("No properties found")

totalPages > 1
└── <div className="px-6 py-4">
    └── Pagination Controls

hasActiveFilters === true
└── <button onClick={resetFilters}>
    └── "Reset all filters"

sortField === field
└── Show ChevronUp or ChevronDown
    (based on sortDirection)

sortField !== field
└── Show ChevronsUpDown
    (both arrows, indicating sortable)
```

## 🚀 Performance Optimizations

```
1. useMemo for Data Transformations
   ├── allProperties     (runs once, never changes)
   ├── filteredProperties (re-runs on filters change)
   └── sortedProperties   (re-runs on sort change)

2. Slice Instead of Filter for Pagination
   └── .slice(startIndex, endIndex) is O(1)

3. Early Returns in Filter Logic
   └── if (!matchesSearch) return false;
       (stops checking other conditions)

4. Stable References
   └── useMemo prevents re-creating arrays on every render

5. Event Handler Memoization
   └── Could add useCallback for handlers
       (not critical for this component size)

6. Virtual Scrolling (Future)
   └── For 10k+ properties, use react-window
```

## 🧪 Testing Strategy

```
Unit Tests (MarketDataTable.test.tsx)
├── Rendering
│   ├── Component mounts
│   ├── Shows correct property count
│   ├── Displays MOCK DATA badge
│   └── Renders table headers
├── Search
│   ├── Filters by address
│   ├── Filters by owner
│   └── Filters by parcel ID
├── Sorting
│   ├── Sorts ascending
│   ├── Sorts descending
│   └── Resets sort
├── Filtering
│   ├── Vintage class filter
│   ├── Owner type filter
│   ├── Units range filter
│   └── Combined filters
├── Pagination
│   ├── Shows correct page
│   ├── Next/Previous buttons
│   └── Page number clicks
└── Interaction
    └── Row click triggers callback

Manual Tests (INTEGRATION_CHECKLIST.md)
├── Visual QA (desktop, tablet, mobile)
├── Browser compatibility
├── Accessibility
└── Performance benchmarks
```

## 🔌 Integration Points

```
Parent Component (MarketDataTab.tsx)
│
├── Props passed down:
│   ├── marketId: string
│   └── onPropertyClick: (propertyId: string) => void
│
└── State managed by parent:
    └── selectedPropertyId (for modal)

Future API Integration
│
├── Backend endpoint:
│   └── GET /api/market-intelligence/properties
│       └── ?marketId={marketId}
│
└── Database query:
    └── property_records table (migration 040)
        └── JOIN property_sales (for hold period)
```

## 📁 File Organization

```
frontend/src/
├── components/
│   └── MarketIntelligence/
│       ├── MarketDataTable.tsx          (main component, 535 LOC)
│       ├── MarketDataTable.example.tsx  (integration guide)
│       ├── MarketDataTable.test.tsx     (test suite)
│       ├── index.ts                     (exports)
│       ├── README.md                    (documentation)
│       ├── ARCHITECTURE.md              (this file)
│       ├── COMPLETION_SUMMARY.md        (deliverable summary)
│       └── INTEGRATION_CHECKLIST.md     (QA checklist)
└── mock/
    └── mockPropertyIntelligence.ts      (mock data, 1,028 properties)
```

## 🔄 Future Enhancements

```
Phase 2: Backend Integration
└── Replace mock data with API calls
    └── Add loading states
    └── Add error handling
    └── Implement data caching

Phase 3: Advanced Features
├── Export to CSV/Excel
├── Save filtered views
├── Map view toggle
├── Bulk actions
└── Real-time updates via WebSocket

Phase 4: Performance
├── Server-side pagination
├── Virtual scrolling (react-window)
├── Debounced search
└── Lazy loading of images

Phase 5: Analytics
├── Track filter usage
├── Log search queries
├── Performance metrics
└── User behavior insights
```

---

**Architecture Version**: 1.0  
**Last Updated**: 2024-02-21  
**Component Status**: ✅ Production Ready (with mock data)
