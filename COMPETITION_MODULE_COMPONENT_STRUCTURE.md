# Competition Analysis Module - Component Structure Reference

Visual guide to understanding the component architecture and data flow.

---

## Component Hierarchy

```
CompetitionPage (Main Container)
│
├── Header Section
│   ├── Title & Description
│   ├── Filter Toggle Button
│   └── Export Button
│
├── Filter Panel (Collapsible)
│   ├── Same Vintage Checkbox
│   ├── Similar Size Checkbox
│   ├── Same Class Checkbox
│   └── Distance Radius Slider
│
├── Tab Navigation
│   ├── Map Tab
│   ├── Comparison Tab
│   ├── Advantage Tab
│   ├── Aging Tab
│   └── Waitlist Tab
│
├── Summary Stats (4 Cards)
│   ├── Direct Competitors Count
│   ├── Advantage Score
│   ├── Waitlist Properties Count
│   └── Aging Competitors Count
│
├── Tab Content (Conditional Render)
│   │
│   ├── CompetitiveSetMap
│   │   ├── Map Visualization
│   │   └── Competitor List (Sidebar)
│   │
│   ├── UnitComparison
│   │   ├── Market Average Card
│   │   ├── Sort Controls
│   │   └── Comparison Table
│   │
│   ├── AdvantageMatrixView
│   │   ├── Score Header
│   │   ├── Feature Comparison Table
│   │   └── Differentiation Summary
│   │
│   ├── AgingCompetitorTracker
│   │   └── Competitor Cards (List)
│   │       ├── Property Details
│   │       ├── Financial Metrics
│   │       ├── Condition Tags
│   │       └── Opportunity Note
│   │
│   └── WaitlistIntelligence
│       ├── Market Insight Panel
│       └── Property Cards (List)
│           ├── Waitlist Stats
│           ├── Occupancy Data
│           └── Demand Note
│
└── AI Insights Panel (Fixed Bottom)
    ├── Insights Text
    └── Action Buttons
        ├── Apply to 3D Model
        └── View Detailed Analysis
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CompetitionPage                        │
│                                                              │
│  State:                                                      │
│    - competitors: CompetitorProperty[]                       │
│    - advantageMatrix: AdvantageMatrix                       │
│    - waitlistProperties: WaitlistProperty[]                 │
│    - agingCompetitors: CompetitorProperty[]                 │
│    - aiInsights: string                                      │
│    - filters: CompetitionFilters                            │
│    - activeTab: string                                       │
│                                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ useEffect (on mount + filter change)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              competitionService (API Layer)                  │
│                                                              │
│  Methods:                                                    │
│    - getCompetitors(dealId, filters)                        │
│    - getAdvantageMatrix(dealId)                             │
│    - getWaitlistProperties(dealId, radius)                  │
│    - getAgingCompetitors(dealId, radius)                    │
│    - getAIInsights(dealId)                                  │
│                                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ HTTP Requests (Axios)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Routes                        │
│                                                              │
│  Endpoints:                                                  │
│    GET /api/v1/deals/:dealId/competitors                    │
│    GET /api/v1/deals/:dealId/advantage-matrix               │
│    GET /api/v1/deals/:dealId/waitlist-properties            │
│    GET /api/v1/deals/:dealId/aging-competitors              │
│    GET /api/v1/deals/:dealId/competition-insights           │
│                                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Database Queries
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL + PostGIS                        │
│                                                              │
│  Tables:                                                     │
│    - property_records (1,028 Atlanta properties)            │
│    - deals (development projects)                           │
│                                                              │
│  Queries:                                                    │
│    - Spatial distance calculations (ST_Distance)            │
│    - Filter-based WHERE clauses                             │
│    - Age-based filtering                                    │
│    - Rent/occupancy estimation                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## State Management

### Component State (React useState)

```typescript
// Main data arrays
const [competitors, setCompetitors] = useState<CompetitorProperty[]>([]);
const [advantageMatrix, setAdvantageMatrix] = useState<AdvantageMatrix | null>(null);
const [waitlistProperties, setWaitlistProperties] = useState<WaitlistProperty[]>([]);
const [agingCompetitors, setAgingCompetitors] = useState<CompetitorProperty[]>([]);

// UI state
const [loading, setLoading] = useState(true);
const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
const [aiInsights, setAiInsights] = useState<string>('');
const [activeTab, setActiveTab] = useState<'map' | 'comparison' | ...>('map');
const [showFilters, setShowFilters] = useState(false);

// Filter state
const [filters, setFilters] = useState<CompetitionFilters>({
  sameVintage: false,
  similarSize: true,
  sameClass: true,
  distanceRadius: 1.0,
});
```

### Data Update Flow

```
User Action (Filter Change)
        ↓
handleFilterChange()
        ↓
setFilters() [React State Update]
        ↓
useEffect detects filter change
        ↓
fetchCompetitionData()
        ↓
competitionService.getCompetitors()
        ↓
API Request
        ↓
Backend Query
        ↓
Response
        ↓
setCompetitors() [State Update]
        ↓
Component Re-render
        ↓
UI Updates
```

---

## Sub-Component Details

### 1. CompetitiveSetMap

**Props:**
```typescript
{
  competitors: CompetitorProperty[];
  filters: CompetitionFilters;
  onSelectCompetitor: (id: string) => void;
}
```

**Structure:**
```
┌────────────────────────────────────────────────┐
│  Map Area (2/3 width)  │  Competitor List      │
│                        │  (1/3 width)          │
│  [Gray placeholder     │                       │
│   with MapPin icon]    │  ┌─────────────────┐ │
│                        │  │ Competitor Card │ │
│  Legend (bottom left): │  │ - Name          │ │
│  • Your Site (blue)    │  │ - Units         │ │
│  • Direct (red)        │  │ - Distance      │ │
│  • Construction (yel)  │  │ - Rent          │ │
│  • Planned (green)     │  └─────────────────┘ │
│                        │  ┌─────────────────┐ │
└────────────────────────┴──│ Competitor Card │ │
                             └─────────────────┘
```

### 2. UnitComparison

**Props:**
```typescript
{
  competitors: CompetitorProperty[];
}
```

**Structure:**
```
┌──────────────────────────────────────────────────┐
│  Title: "Unit Layout Comparison"                 │
│  Sort Controls: [Dropdown] [Asc/Desc Button]    │
├──────────────────────────────────────────────────┤
│  Market Average Card (Blue background):         │
│    1BR Avg: 680 SF | 2BR Avg: 1050 SF          │
│    Efficiency: 78%                               │
├──────────────────────────────────────────────────┤
│  Comparison Table:                               │
│  ┌──────┬────────┬────────┬────────┬──────────┐│
│  │ Prop │ Studio │  1BR   │  2BR   │ Effic.  ││
│  ├──────┼────────┼────────┼────────┼──────────┤│
│  │ A    │ 550 SF │ 750 SF │1100 SF │  82% ✓  ││
│  │ B    │ 525 SF │ 680 SF │1050 SF │  78%    ││
│  └──────┴────────┴────────┴────────┴──────────┘│
└──────────────────────────────────────────────────┘
```

### 3. AdvantageMatrixView

**Props:**
```typescript
{
  matrix: AdvantageMatrix;
}
```

**Structure:**
```
┌──────────────────────────────────────────────────┐
│  Title: "Competitive Advantage Matrix"          │
│  Overall Score: 9 (Green, Large)                │
├──────────────────────────────────────────────────┤
│  Feature Comparison Table:                      │
│  ┌─────────────┬────┬───────┬────────┬────────┐│
│  │ Feature     │You │ Comp1 │ Comp2  │ Points ││
│  ├─────────────┼────┼───────┼────────┼────────┤│
│  │ Coworking   │ ✓  │   ✗   │   ✗    │  +2    ││
│  │ EV Charging │ ✓  │   ✗   │   ✗    │  +3    ││
│  │ Pet Spa     │ ✓  │   ✓   │   ✗    │   0    ││
│  └─────────────┴────┴───────┴────────┴────────┘│
├──────────────────────────────────────────────────┤
│  Differentiation Summary (Green background):    │
│  ✓ Strong Differentiation                       │
│  Key: Coworking, EV Charging, Smart Home        │
└──────────────────────────────────────────────────┘
```

### 4. AgingCompetitorTracker

**Props:**
```typescript
{
  agingCompetitors: CompetitorProperty[];
}
```

**Structure:**
```
┌──────────────────────────────────────────────────┐
│  Title: "Aging Competition Tracker"             │
│  Subtitle: "Older properties creating opps"     │
├──────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────┐ │
│  │ Sunset Apartments        [26 years old]    │ │
│  │ Built 1998 • 186 units • 0.7 mi            │ │
│  │                                            │ │
│  │ Current: $1,250   Premium: +$400   82%    │ │
│  │ [Needs Renovation] [Dated Amenities]      │ │
│  │                                            │ │
│  │ ⚠️ Opportunity: Capture displaced residents│ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │ Park Place               [19 years old]    │ │
│  │ ...                                        │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 5. WaitlistIntelligence

**Props:**
```typescript
{
  waitlistProperties: WaitlistProperty[];
}
```

**Structure:**
```
┌──────────────────────────────────────────────────┐
│  Title: "Waitlist Intelligence"                 │
│  Subtitle: "High-demand properties"             │
├──────────────────────────────────────────────────┤
│  Market Insight Panel (Blue background):        │
│  📈 Properties with waitlists avg $1,788/mo     │
│     Design for this price point.                │
├──────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────┐ │
│  │ Metro Towers                  [45 waitlist]│ │
│  │ 287 units • 0.4 mi                        │ │
│  │                                            │ │
│  │ Occupancy: 98%  Rent: $1,850  Wait: 3-4mo │ │
│  │                                            │ │
│  │ Target: Young professionals, 1BR demand    │ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │ The Modern                    [32 waitlist]│ │
│  │ ...                                        │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## Styling System

### Tailwind Classes Used

**Layout:**
- `max-w-7xl mx-auto` - Centered container
- `grid grid-cols-{n}` - Grid layouts
- `flex items-center justify-between` - Flexbox
- `space-y-{n}` - Vertical spacing

**Colors:**
- `bg-blue-600 text-white` - Primary actions
- `bg-green-50 border-green-200` - Success states
- `bg-orange-100 text-orange-700` - Warnings
- `bg-gray-50` - Subtle backgrounds

**Interactive:**
- `hover:bg-gray-50` - Hover states
- `cursor-pointer` - Clickable elements
- `transition-colors` - Smooth transitions

**Responsive:**
- `hidden md:block` - Mobile/desktop variants
- `overflow-x-auto` - Horizontal scroll tables

---

## Icon Usage

Using **lucide-react** icons:

| Icon | Usage | Location |
|------|-------|----------|
| `Building2` | Main page icon | Header |
| `MapPin` | Map/location | Map view, competitor cards |
| `Filter` | Filter toggle | Header |
| `Download` | Export | Header |
| `Home` | Units | Competitor cards |
| `DollarSign` | Rent/price | Financial data |
| `Calendar` | Year built | Aging section |
| `TrendingUp` | Growth/demand | Waitlist section |
| `CheckCircle2` | Has feature | Advantage matrix |
| `XCircle` | Missing feature | Advantage matrix |
| `AlertCircle` | Opportunity | Aging competitors |
| `Sparkles` | AI insights | Insights panel |
| `Eye` | View details | Action buttons |
| `Maximize2` | Expand | Map controls |

---

## Responsive Behavior

### Desktop (1280px+)
- Full 3-column layouts
- Side-by-side map + list
- Expanded tables

### Tablet (768-1279px)
- 2-column layouts
- Stacked map/list
- Scrollable tables

### Mobile (<768px)
- Single column
- Tabbed navigation
- Compact cards
- Horizontal scroll tables

---

## Performance Optimizations

1. **Lazy Loading**
   - Components only render when tab is active
   - `activeTab === 'map' && <CompetitiveSetMap />`

2. **Memoization Opportunities**
   - Market average calculations
   - Sorted competitor lists
   - Feature matrices

3. **API Efficiency**
   - Parallel Promise.all() for data fetching
   - Single API call per filter change
   - Debounced filter updates (can add)

4. **Render Optimization**
   - Key props on mapped elements
   - Conditional rendering of large lists
   - Virtual scrolling (can add for 100+ items)

---

## Accessibility Considerations

### Current Implementation
- ✅ Semantic HTML (`<table>`, `<button>`, etc.)
- ✅ Clear labels on interactive elements
- ✅ Logical tab order
- ✅ Color coding + text labels (not color alone)

### Future Enhancements
- ⚠️ ARIA labels for complex interactions
- ⚠️ Keyboard navigation for tabs
- ⚠️ Screen reader announcements
- ⚠️ Focus management

---

## Browser Compatibility

**Tested/Supported:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**CSS Features Used:**
- Flexbox (99%+ support)
- CSS Grid (96%+ support)
- CSS Variables (via Tailwind)

---

This component structure provides a clean, maintainable architecture that's easy to extend and integrate with other modules.
