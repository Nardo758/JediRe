# JEDI RE - Component Architecture Diagrams
**Version:** 1.0  
**Date:** February 5, 2026  
**Purpose:** Visual guide to component relationships and data flow

---

## 1. Component Hierarchy Diagram

```
App
├── Router
│   ├── AuthGuard
│   │   ├── LoginPage
│   │   └── SignupPage
│   │
│   └── MainLayout
│       ├── Sidebar
│       │   ├── Logo
│       │   ├── NavItem (×4) [Map, Dashboard, Properties, Settings]
│       │   └── CollapseToggle
│       │
│       ├── TopBar
│       │   ├── GlobalSearch
│       │   ├── NotificationBell
│       │   └── UserMenu
│       │
│       └── ContentArea
│           │
│           ├── MapView ⭐ MVP Priority 1
│           │   ├── MapboxMap
│           │   │   ├── PropertyMarkers
│           │   │   │   └── PropertyMarker (×N)
│           │   │   │       ├── MarkerIcon (color by strategy)
│           │   │   │       └── MarkerTooltip
│           │   │   │
│           │   │   ├── PropertyCluster
│           │   │   │   └── ClusterMarker (shows count)
│           │   │   │
│           │   │   └── MapControls
│           │   │       ├── ZoomControl
│           │   │       ├── LayerToggle
│           │   │       └── GeolocationButton
│           │   │
│           │   ├── ChatOverlay
│           │   │   ├── ChatHeader
│           │   │   │   ├── AgentAvatar
│           │   │   │   ├── AgentName
│           │   │   │   ├── AgentStatus
│           │   │   │   └── MinimizeButton
│           │   │   │
│           │   │   ├── MessageList
│           │   │   │   ├── ChatMessage (×N)
│           │   │   │   │   ├── Avatar (user or agent)
│           │   │   │   │   ├── MessageBubble
│           │   │   │   │   │   ├── MessageText
│           │   │   │   │   │   └── MessageTimestamp
│           │   │   │   │   │
│           │   │   │   │   └── PropertyCardsRow (if agent included)
│           │   │   │   │       └── PropertyCard (×3)
│           │   │   │   │           ├── PropertyImage
│           │   │   │   │           ├── PropertyInfo
│           │   │   │   │           ├── StrategyBadge
│           │   │   │   │           └── ViewButton
│           │   │   │   │
│           │   │   │   └── TypingIndicator
│           │   │   │
│           │   │   └── ChatInput
│           │   │       ├── TextInput
│           │   │       ├── VoiceButton (Phase 2)
│           │   │       └── SendButton
│           │   │
│           │   └── AgentStatusBar
│           │       └── AgentTask (×N)
│           │           ├── AgentName
│           │           ├── ProgressBar
│           │           └── StatusMessage
│           │
│           ├── PropertyDetailPage ⭐ MVP Priority 2
│           │   ├── PropertyHeader
│           │   │   ├── BackButton
│           │   │   ├── AddressTitle
│           │   │   └── ActionButtons
│           │   │       ├── SaveButton
│           │   │       └── ShareButton
│           │   │
│           │   ├── PropertyContent
│           │   │   ├── LeftColumn
│           │   │   │   ├── PhotoCarousel
│           │   │   │   │   ├── MainImage
│           │   │   │   │   ├── ThumbnailStrip
│           │   │   │   │   │   └── Thumbnail (×N)
│           │   │   │   │   │
│           │   │   │   │   └── NavigationArrows
│           │   │   │   │       ├── PrevButton
│           │   │   │   │       └── NextButton
│           │   │   │   │
│           │   │   │   ├── LocationMap
│           │   │   │   │   └── MiniMapbox
│           │   │   │   │       └── PropertyPin
│           │   │   │   │
│           │   │   │   └── PropertyDetails
│           │   │   │       ├── DetailRow (×N)
│           │   │   │       │   ├── Icon
│           │   │   │       │   ├── Label
│           │   │   │       │   └── Value
│           │   │   │       │
│           │   │   │       └── ExpandButton
│           │   │   │
│           │   │   └── RightColumn
│           │   │       ├── PropertySummaryCard
│           │   │       │   ├── Price
│           │   │       │   ├── BasicInfo (beds/baths/sqft)
│           │   │       │   ├── BestStrategyBadge
│           │   │       │   └── CTAButtons
│           │   │       │       ├── ContactButton
│           │   │       │       └── ShowingButton
│           │   │       │
│           │   │       ├── StrategyAnalysisTable
│           │   │       │   ├── TableHeader
│           │   │       │   │   ├── Column: Strategy
│           │   │       │   │   ├── Column: ROI
│           │   │       │   │   ├── Column: Income
│           │   │       │   │   └── Column: Rating
│           │   │       │   │
│           │   │       │   ├── StrategyRow (×4)
│           │   │       │   │   ├── StrategyIcon
│           │   │       │   │   ├── StrategyName
│           │   │       │   │   ├── ROIValue
│           │   │       │   │   ├── IncomeValue
│           │   │       │   │   ├── RatingStars
│           │   │       │   │   └── BestBadge (conditional)
│           │   │       │   │
│           │   │       │   └── DetailButton
│           │   │       │
│           │   │       └── AIInsightsPanel
│           │   │           ├── PanelHeader
│           │   │           ├── InsightItem (×N)
│           │   │           │   ├── Icon (✓ green or ⚠ yellow)
│           │   │           │   └── InsightText
│           │   │           │
│           │   │           └── ExpandButton
│           │   │
│           │   └── LoadingStates
│           │       ├── PropertyDetailSkeleton
│           │       │   ├── ImageSkeleton
│           │       │   ├── TextSkeleton (×N)
│           │       │   └── TableSkeleton
│           │       │
│           │       └── ErrorState
│           │           ├── ErrorIcon
│           │           ├── ErrorMessage
│           │           └── RetryButton
│           │
│           ├── DashboardView ⭐ MVP Priority 3
│           │   ├── DashboardHeader
│           │   │   ├── WelcomeText
│           │   │   └── DateRange (Phase 2)
│           │   │
│           │   ├── KPIRow
│           │   │   ├── KPICard (Portfolio Value)
│           │   │   │   ├── Icon
│           │   │   │   ├── Label
│           │   │   │   ├── Value
│           │   │   │   ├── ChangeIndicator (% up/down)
│           │   │   │   └── Sparkline (Phase 2)
│           │   │   │
│           │   │   ├── KPICard (Active Deals)
│           │   │   └── KPICard (Active Alerts)
│           │   │
│           │   ├── TopOpportunitiesPanel
│           │   │   ├── PanelHeader
│           │   │   │   └── Title
│           │   │   │
│           │   │   └── OpportunityCard (×3)
│           │   │       ├── Rank (1, 2, 3)
│           │   │       ├── PropertyImage
│           │   │       ├── Address
│           │   │       ├── Price
│           │   │       ├── BasicInfo
│           │   │       ├── StrategyBadge
│           │   │       ├── ROI
│           │   │       ├── Summary
│           │   │       └── ViewButton
│           │   │
│           │   └── BottomRow
│           │       ├── TodaysTasksPanel
│           │       │   ├── PanelHeader
│           │       │   │   └── Title
│           │       │   │
│           │       │   ├── TaskItem (×N)
│           │       │   │   ├── Checkbox
│           │       │   │   ├── TaskText
│           │       │   │   ├── PropertyLink (optional)
│           │       │   │   └── DeleteButton
│           │       │   │
│           │       │   ├── AddTaskButton
│           │       │   └── ProgressIndicator
│           │       │
│           │       └── RecentActivityPanel
│           │           ├── PanelHeader
│           │           │   └── Title
│           │           │
│           │           ├── ActivityItem (×N)
│           │           │   ├── ActivityIcon
│           │           │   ├── ActivityText
│           │           │   ├── PropertyLink (optional)
│           │           │   └── Timestamp
│           │           │
│           │           └── ViewAllButton
│           │
│           └── SettingsView ⭐ MVP Priority 4
│               ├── SettingsHeader
│               │   └── Title
│               │
│               ├── SettingsTabs (Phase 2: add Profile, Billing)
│               │   └── TabButton (Modules) [active in MVP]
│               │
│               └── ModulesPanel
│                   ├── PlanSummary
│                   │   ├── CurrentTier
│                   │   ├── MonthlyPrice
│                   │   ├── NextBillingDate
│                   │   └── ActionButtons
│                   │       ├── ViewUsageButton
│                   │       └── UpgradeButton
│                   │
│                   ├── ActiveModulesSection
│                   │   ├── SectionHeader
│                   │   │
│                   │   └── ModuleCard (×3 in Pro tier)
│                   │       ├── ModuleHeader
│                   │       │   ├── Icon
│                   │       │   ├── Name
│                   │       │   └── TierBadge
│                   │       │
│                   │       ├── Description
│                   │       ├── ToggleSwitch
│                   │       ├── SettingsButton
│                   │       └── UsageBar
│                   │           ├── ProgressFill
│                   │           └── UsageText
│                   │
│                   ├── LockedModulesSection
│                   │   ├── SectionHeader
│                   │   │
│                   │   └── ModuleCard (Portfolio Manager)
│                   │       ├── LockIcon
│                   │       ├── ModuleName
│                   │       ├── Description
│                   │       ├── FeatureList
│                   │       └── UpgradeButton
│                   │
│                   └── UsageSummary
│                       ├── SummaryHeader
│                       ├── UsageRow (×3)
│                       │   ├── Metric
│                       │   ├── Current
│                       │   ├── Limit
│                       │   └── Percentage
│                       │
│                       └── StatusMessage
│
└── Shared Components (used across multiple views)
    ├── Button
    │   ├── PrimaryButton
    │   ├── SecondaryButton
    │   ├── GhostButton
    │   └── DangerButton
    │
    ├── Input
    │   ├── TextInput
    │   ├── NumberInput
    │   ├── SelectInput
    │   └── SearchInput
    │
    ├── Card
    │   ├── CardHeader
    │   ├── CardBody
    │   └── CardFooter
    │
    ├── Modal
    │   ├── ModalOverlay
    │   ├── ModalContainer
    │   │   ├── ModalHeader
    │   │   ├── ModalBody
    │   │   └── ModalFooter
    │   │
    │   └── CloseButton
    │
    ├── Badge
    ├── Spinner
    ├── ProgressBar
    ├── Toast
    ├── Tooltip
    ├── Switch
    └── ErrorBoundary
        ├── ErrorIcon
        ├── ErrorMessage
        └── RetryButton
```

---

## 2. Data Flow Diagram

### Complete Data Flow: Property Search

```
┌─────────────┐
│    USER     │
│ Types query │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│   ChatInput Component   │
│  - Captures user text   │
│  - Validates input      │
└──────┬──────────────────┘
       │
       │ sendMessage()
       ▼
┌─────────────────────────┐
│   ChatStore (Zustand)   │
│  - messages array       │
│  - Add user message     │
└──────┬──────────────────┘
       │
       │ emit('chat:message')
       ▼
┌─────────────────────────┐
│  WebSocket Connection   │
│  - Socket.io client     │
│  - Real-time comm       │
└──────┬──────────────────┘
       │
       │ HTTPS/WSS
       ▼
┌─────────────────────────┐
│   BACKEND API SERVER    │
│   (FastAPI)             │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Chief Orchestrator      │
│  - Intent classifier    │
│  - Parse: "Find 2br..."  │
│  - Route to agent       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Property Search Agent   │
│  - Extract filters      │
│  - Build DB query       │
└──────┬──────────────────┘
       │
       │ SQL Query
       ▼
┌─────────────────────────┐
│  PostgreSQL + PostGIS   │
│  - Spatial search       │
│  - Filter by criteria   │
│  - Return 23 properties │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Property Search Agent   │
│  - Rank by score        │
│  - Format response      │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Chief Orchestrator      │
│  - Quality check        │
│  - Generate summary     │
└──────┬──────────────────┘
       │
       │ emit('agent:message')
       ▼
┌─────────────────────────┐
│  WebSocket Connection   │
│  - Push to client       │
└──────┬──────────────────┘
       │
       │ Event received
       ▼
┌─────────────────────────┐
│   useWebSocket Hook     │
│  - Listen for events    │
└──────┬──────────────────┘
       │
       │ Updates state
       ▼
┌─────────────────────────┐
│   ChatStore (Zustand)   │
│  - Add agent message    │
│  - Add property cards   │
└──────┬──────────────────┘
       │
┌──────┼──────────────────┐
│      │                  │
▼      ▼                  ▼
┌──────────┐  ┌────────────┐  ┌──────────┐
│MessageList│  │PropertyCards│  │MapStore  │
│ updates  │  │  updates    │  │ updates  │
└──────────┘  └────────────┘  └──────────┘
                                    │
                                    ▼
                             ┌──────────┐
                             │ MapView  │
                             │ Markers  │
                             │ appear   │
                             └──────────┘
                                    │
                                    ▼
                             ┌──────────┐
                             │   USER   │
                             │ Sees     │
                             │ results  │
                             └──────────┘
```

---

## 3. State Management Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   ZUSTAND STORES                        │
│  (Client-side state management)                         │
└─────────────────────────────────────────────────────────┘
          │            │            │            │
          ▼            ▼            ▼            ▼
     ┌────────┐  ┌─────────┐  ┌────────┐  ┌──────────┐
     │ Auth   │  │  Map    │  │  Chat  │  │  Module  │
     │ Store  │  │  Store  │  │  Store │  │  Store   │
     └────────┘  └─────────┘  └────────┘  └──────────┘

┌─────────────────────────────────────────────────────────┐
│                  AuthStore (Zustand)                    │
├─────────────────────────────────────────────────────────┤
│ State:                                                  │
│   - user: User | null                                   │
│   - token: string | null                                │
│   - isAuthenticated: boolean                            │
│   - loading: boolean                                    │
│                                                         │
│ Actions:                                                │
│   - login(email, password)                              │
│   - logout()                                            │
│   - refreshToken()                                      │
│   - setUser(user)                                       │
│                                                         │
│ Persisted: localStorage                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   MapStore (Zustand)                    │
├─────────────────────────────────────────────────────────┤
│ State:                                                  │
│   - properties: Property[]                              │
│   - selectedProperty: Property | null                   │
│   - mapCenter: [number, number]                         │
│   - mapZoom: number                                     │
│   - filters: PropertyFilters                            │
│                                                         │
│ Actions:                                                │
│   - setProperties(properties)                           │
│   - selectProperty(property)                            │
│   - setMapView(center, zoom)                            │
│   - setFilters(filters)                                 │
│   - clearProperties()                                   │
│                                                         │
│ Synced with: WebSocket 'map:update' events              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   ChatStore (Zustand)                   │
├─────────────────────────────────────────────────────────┤
│ State:                                                  │
│   - messages: Message[]                                 │
│   - conversationId: string | null                       │
│   - isTyping: boolean                                   │
│   - chatExpanded: boolean                               │
│                                                         │
│ Actions:                                                │
│   - addMessage(message)                                 │
│   - sendMessage(text)                                   │
│   - setTyping(isTyping)                                 │
│   - toggleChat()                                        │
│   - clearMessages()                                     │
│                                                         │
│ Synced with: WebSocket 'agent:message' events           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 ModuleStore (Zustand)                   │
├─────────────────────────────────────────────────────────┤
│ State:                                                  │
│   - activeModules: string[]                             │
│   - moduleUsage: Record<string, UsageData>              │
│   - subscriptionTier: Tier                              │
│                                                         │
│ Actions:                                                │
│   - toggleModule(moduleId)                              │
│   - updateUsage(moduleId, usage)                        │
│   - canUseModule(moduleId): boolean                     │
│                                                         │
│ Persisted: API sync on changes                          │
└─────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────┐
│                   REACT QUERY CACHE                     │
│  (Server state management - API data)                   │
└─────────────────────────────────────────────────────────┘
          │            │            │            │
          ▼            ▼            ▼            ▼
   ┌──────────┐ ┌───────────┐ ┌────────┐ ┌────────┐
   │Properties│ │ Property  │ │Analysis│ │ Alerts │
   │   List   │ │  Detail   │ │ Results│ │  List  │
   └──────────┘ └───────────┘ └────────┘ └────────┘

┌─────────────────────────────────────────────────────────┐
│              React Query Configuration                  │
├─────────────────────────────────────────────────────────┤
│ Query Keys:                                             │
│   - ['properties', filters]                             │
│   - ['property', propertyId]                            │
│   - ['analyses', propertyId]                            │
│   - ['alerts']                                          │
│                                                         │
│ Stale Times:                                            │
│   - properties: 5 minutes                               │
│   - property detail: 1 hour                             │
│   - analyses: 24 hours                                  │
│   - alerts: 1 minute                                    │
│                                                         │
│ Cache Times:                                            │
│   - All: 30 minutes (garbage collect after)            │
│                                                         │
│ Refetch on:                                             │
│   - Window focus: true                                  │
│   - Reconnect: true                                     │
│   - Mount: false (use cache first)                      │
└─────────────────────────────────────────────────────────┘
```

---

## 4. API Integration Patterns

### Pattern 1: Simple Query (No State Updates)

```typescript
// Component
function PropertyDetailPage() {
  const { id } = useParams();
  
  // Fetch property
  const { data, isLoading, error } = useQuery({
    queryKey: ['property', id],
    queryFn: () => apiClient.get(`/properties/${id}`),
  });
  
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState />;
  
  return <PropertyDetail property={data} />;
}

// Flow:
// 1. Component mounts
// 2. React Query checks cache
// 3. If miss, calls apiClient.get()
// 4. Response cached for 1 hour
// 5. Component receives data
```

### Pattern 2: Mutation (State + API Update)

```typescript
// Component
function PropertyCard({ property }) {
  const { mutate, isLoading } = useSaveProperty();
  
  const handleSave = () => {
    mutate(property.id, {
      onSuccess: () => {
        toast.success('Property saved!');
      },
    });
  };
  
  return <button onClick={handleSave}>Save</button>;
}

// Hook
function useSaveProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (propertyId) => 
      apiClient.post(`/properties/${propertyId}/save`),
    
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
    },
  });
}

// Flow:
// 1. User clicks Save
// 2. Mutation fires POST /properties/:id/save
// 3. On success, invalidate cache
// 4. Queries refetch automatically
// 5. UI updates with new data
```

### Pattern 3: WebSocket + State (Real-time)

```typescript
// Hook
function useChatAgent() {
  const { socket } = useWebSocket();
  const { addMessage, setTyping } = useChatStore();
  
  useEffect(() => {
    if (!socket) return;
    
    // Listen for agent messages
    socket.on('agent:message', (data) => {
      addMessage(data);
      setTyping(false);
    });
    
    // Listen for task updates
    socket.on('agent:task_update', (data) => {
      // Update agent status bar
      useAgentStore.getState().updateTask(data);
    });
    
    return () => {
      socket.off('agent:message');
      socket.off('agent:task_update');
    };
  }, [socket]);
  
  const sendMessage = (text: string) => {
    setTyping(true);
    socket?.emit('chat:message', { message: text });
  };
  
  return { sendMessage };
}

// Flow:
// 1. Component uses hook
// 2. WebSocket connects on mount
// 3. Listens for server events
// 4. Updates Zustand stores
// 5. Components react to store changes
// 6. UI updates in real-time
```

---

## 5. Error Handling Architecture

```
┌────────────────────────────────────────────┐
│         Error Boundary (Top Level)        │
│  Catches: Component render errors          │
│  Action: Show full-page error screen       │
└────────────────────────────────────────────┘
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ MapView  │ │Property  │ │Dashboard │
│ Boundary │ │ Boundary │ │ Boundary │
└──────────┘ └──────────┘ └──────────┘
      │            │            │
      ▼            ▼            ▼
  [Fallback]   [Fallback]   [Fallback]
  Map Error    Property     Dashboard
               Error        Error


API Error Handling:
┌────────────────────────────────────────────┐
│         API Client Interceptor             │
├────────────────────────────────────────────┤
│ 200-299: Success → Return data             │
│ 400: Bad Request → Show inline error       │
│ 401: Unauthorized → Redirect to login      │
│ 403: Forbidden → Show permission error     │
│ 404: Not Found → Show not found state      │
│ 429: Rate Limited → Show rate limit error  │
│ 500-599: Server Error → Show retry screen  │
│ Network Error: → Show offline state        │
└────────────────────────────────────────────┘


React Query Error Handling:
┌────────────────────────────────────────────┐
│        useQuery Error States               │
├────────────────────────────────────────────┤
│ isError: true                              │
│ error: Error object                        │
│                                            │
│ Component checks:                          │
│   if (error) return <ErrorState />         │
│                                            │
│ Retry logic:                               │
│   retry: 3                                 │
│   retryDelay: attemptIndex => 1000 * 2^i  │
└────────────────────────────────────────────┘
```

---

## 6. Performance Optimization Patterns

### Code Splitting

```typescript
// Lazy load routes
const MapView = lazy(() => import('./views/MapView'));
const PropertyDetailPage = lazy(() => import('./views/PropertyDetailPage'));
const DashboardView = lazy(() => import('./views/DashboardView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

// Wrap in Suspense
<Suspense fallback={<PageSpinner />}>
  <Routes>
    <Route path="/map" element={<MapView />} />
    <Route path="/property/:id" element={<PropertyDetailPage />} />
    <Route path="/dashboard" element={<DashboardView />} />
    <Route path="/settings" element={<SettingsView />} />
  </Routes>
</Suspense>
```

### Memoization

```typescript
// Expensive component
const PropertyCard = memo(function PropertyCard({ property, onSelect }) {
  return (
    <div onClick={() => onSelect(property.id)}>
      {/* render property */}
    </div>
  );
});

// Expensive calculation
const opportunityScore = useMemo(() => {
  return calculateOpportunityScore(property, market);
}, [property.id, market.timestamp]);

// Stable callback
const handleSelect = useCallback((id: string) => {
  navigate(`/property/${id}`);
}, [navigate]);
```

### Virtualization

```typescript
// Large list of properties
import { FixedSizeList } from 'react-window';

function PropertyList({ properties }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={properties.length}
      itemSize={120}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <PropertyCard property={properties[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

---

## 7. Testing Architecture

```
┌────────────────────────────────────────────┐
│            Testing Pyramid                 │
├────────────────────────────────────────────┤
│                                            │
│           E2E Tests (Playwright)           │
│                 ▲                          │
│                / \                         │
│               /   \                        │
│              /     \                       │
│             / Integ \                      │
│            /_________\                     │
│           /           \                    │
│          /    Unit     \                   │
│         /_____________\__\                 │
│                                            │
└────────────────────────────────────────────┘

Unit Tests (Vitest):
├── utils/*.test.ts (100% coverage)
├── hooks/*.test.ts (90% coverage)
├── components/**/*.test.tsx (80% coverage)
└── api/*.test.ts (90% coverage)

Integration Tests (Playwright):
├── auth.spec.ts (login, signup, logout)
├── property-search.spec.ts (search flow)
├── property-detail.spec.ts (view property)
└── alerts.spec.ts (create alert)

E2E Tests (Playwright):
├── user-journey.spec.ts (signup → search → save → alert)
└── agent-interaction.spec.ts (chat → results → analyze)
```

---

## 8. Deployment Architecture

```
┌────────────────────────────────────────────────────┐
│                     USER                           │
└────────────────────────┬───────────────────────────┘
                         │
                         │ HTTPS
                         ▼
┌────────────────────────────────────────────────────┐
│              Cloudflare / CDN                      │
│  - SSL termination                                 │
│  - DDoS protection                                 │
│  - Static asset caching                            │
└────────────────────────┬───────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Frontend   │  │  API Server │  │  WebSocket  │
│  (Replit)   │  │  (Replit)   │  │  (Replit)   │
│             │  │             │  │             │
│  React App  │  │  FastAPI    │  │  Socket.io  │
│  Vite build │  │  Uvicorn    │  │  Server     │
└─────────────┘  └──────┬──────┘  └──────┬──────┘
                        │                 │
                        ▼                 │
               ┌─────────────┐            │
               │ PostgreSQL  │            │
               │ + PostGIS   │            │
               └─────────────┘            │
                        │                 │
                        ▼                 │
               ┌─────────────┐            │
               │    Redis    │◄───────────┘
               │  (Cache +   │
               │   Queue)    │
               └─────────────┘
```

---

**Component diagrams complete!** These visual guides show exactly how everything fits together.

Next: Wiring checklist
