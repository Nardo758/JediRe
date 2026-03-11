# JediRe Frontend Architecture

## 🏗️ Architecture Overview

This frontend follows a **modular, component-based architecture** with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────┐
│                     React App                           │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐     │
│  │  UI Layer  │  │  State     │  │  Services    │     │
│  │            │←→│  Management│←→│  (API/WS)    │     │
│  │ Components │  │  (Zustand) │  │              │     │
│  └────────────┘  └────────────┘  └──────────────┘     │
│                                          ↓              │
│                                   ┌──────────────┐     │
│                                   │   Backend    │     │
│                                   │   API/WS     │     │
│                                   └──────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## 📦 Layers

### 1. **Presentation Layer** (`components/`)

React components organized by feature:

- **auth/** - Authentication UI
- **dashboard/** - Sidebar, search, filters
- **map/** - Mapbox integration, property bubbles
- **property/** - Property details, module panels
- **ui/** - Reusable UI components

**Principles:**
- Components are **presentational** (dumb) or **container** (smart)
- Presentational components receive props, don't access global state
- Container components connect to store and services
- Components are **single-responsibility** and **composable**

### 2. **State Management** (`store/`)

Zustand store with slices:

```typescript
useAppStore = {
  // Data
  user, properties, selectedProperty,
  
  // UI State
  mapCenter, mapZoom, sidebarOpen,
  
  // Filters & Modules
  filters, activeModules,
  
  // Collaboration
  collaborators,
  
  // Actions
  setUser, setProperties, toggleModule, ...
}
```

**Why Zustand?**
- Lightweight (3KB)
- No boilerplate
- Easy to test
- TypeScript support
- No context providers needed

### 3. **Services Layer** (`services/`)

**API Service** (`api.ts`):
- Axios-based HTTP client
- RESTful endpoints
- Authentication token management
- Request/response interceptors

**WebSocket Service** (`websocket.ts`):
- Socket.io client
- Real-time event handling
- Connection management
- Event emitters and listeners

### 4. **Types** (`types/`)

Central TypeScript definitions:
- **Domain models**: Property, User, ZoningInsight, etc.
- **API contracts**: Request/response types
- **WebSocket messages**: Event payload types

**Benefits:**
- Type safety across the app
- Auto-completion in IDE
- Refactoring confidence
- Documentation via types

### 5. **Hooks** (`hooks/`)

Custom React hooks for reusable logic:

- `useAuth` - Authentication state and actions
- `useWebSocket` - WebSocket connection and events
- `useProperty` - Property operations (future)
- `useDebounce` - Debounced values (future)

**Pattern:**
```typescript
function useFeature() {
  const [state, setState] = useState();
  
  useEffect(() => {
    // Setup/cleanup
  }, []);
  
  return { state, actions };
}
```

### 6. **Utils** (`utils/`)

Helper functions:
- `formatCurrency`, `formatNumber`, `formatPercent`
- `getScoreColor`, `getScoreBgColor`
- `debounce`, `throttle`
- `calculateDistance`

**Guidelines:**
- Pure functions (no side effects)
- Well-tested
- Single responsibility
- Reusable across components

## 🗺️ Data Flow

### Property Search Flow

```
User types in SearchBar
      ↓
Debounced query triggers API call
      ↓
propertyAPI.search(query)
      ↓
Results update Zustand store
      ↓
MapView re-renders with new bubbles
```

### Real-time Collaboration Flow

```
User moves cursor on map
      ↓
MapView throttles and emits cursor_move
      ↓
WebSocket server broadcasts to others
      ↓
Other users receive cursor_move event
      ↓
useWebSocket hook updates collaborators state
      ↓
CollaboratorCursor components render
```

### Property Selection Flow

```
User clicks PropertyBubble
      ↓
setSelectedProperty(property)
      ↓
PropertyDetail panel slides in
      ↓
Loads module insights (if not cached)
      ↓
Displays ZoningPanel, SupplyPanel, etc.
```

## 🎨 Design Patterns

### 1. **Container/Presentational Pattern**

**Container (Smart):**
```typescript
function PropertyDetailContainer() {
  const { selectedProperty } = useAppStore();
  const { data, loading } = usePropertyData(selectedProperty?.id);
  
  return <PropertyDetailView property={selectedProperty} data={data} />;
}
```

**Presentational (Dumb):**
```typescript
function PropertyDetailView({ property, data }) {
  return <div>{/* Render UI */}</div>;
}
```

### 2. **Compound Components Pattern**

```typescript
<FilterPanel>
  <FilterPanel.Header>Filters</FilterPanel.Header>
  <FilterPanel.Body>
    <ScoreFilter />
    <PriceFilter />
  </FilterPanel.Body>
  <FilterPanel.Actions>
    <ApplyButton />
  </FilterPanel.Actions>
</FilterPanel>
```

### 3. **Custom Hooks Pattern**

Encapsulate complex logic:
```typescript
function useCollaboration(sessionId) {
  useWebSocket(sessionId);
  const collaborators = useAppStore(s => s.collaborators);
  
  return { collaborators, updateCursor, ... };
}
```

### 4. **Render Props Pattern** (where needed)

```typescript
<DataProvider>
  {({ data, loading }) => (
    loading ? <Spinner /> : <DataView data={data} />
  )}
</DataProvider>
```

## 🔄 State Update Patterns

### Optimistic Updates

```typescript
const handleTogglePin = async (propertyId) => {
  // Optimistic update
  updateProperty(propertyId, { isPinned: true });
  
  try {
    await propertyAPI.togglePin(propertyId);
  } catch (error) {
    // Rollback on error
    updateProperty(propertyId, { isPinned: false });
  }
};
```

### Batch Updates

```typescript
useAppStore.setState({
  properties: newProperties,
  selectedProperty: null,
  isLoading: false,
});
```

## 📱 Responsive Design Strategy

### Breakpoints

- **Mobile**: `< 768px` - Single column, collapsed sidebar
- **Tablet**: `768px - 1024px` - Adjusted spacing
- **Desktop**: `> 1024px` - Full layout

### Mobile-First Approach

```css
/* Mobile default */
.sidebar {
  width: 100%;
}

/* Tablet and up */
@media (min-width: 768px) {
  .sidebar {
    width: 384px;
  }
}
```

### Touch Optimization

- Larger tap targets (44x44px minimum)
- Swipe gestures for panels
- Bottom navigation on mobile

## 🚀 Performance Optimizations

### 1. **Code Splitting**

```typescript
const PropertyDetail = lazy(() => import('./PropertyDetail'));
```

### 2. **Memoization**

```typescript
const expensiveValue = useMemo(() => 
  computeExpensiveValue(data), 
  [data]
);

const MemoizedComponent = React.memo(Component);
```

### 3. **Virtual Scrolling** (for large lists)

```typescript
<VirtualList
  items={properties}
  height={600}
  itemHeight={80}
  renderItem={(property) => <PropertyCard property={property} />}
/>
```

### 4. **Debouncing/Throttling**

```typescript
const debouncedSearch = debounce(performSearch, 300);
const throttledCursor = throttle(updateCursor, 100);
```

### 5. **Image Optimization**

- Lazy loading with Intersection Observer
- Responsive images with srcset
- WebP format with fallbacks

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe('formatCurrency', () => {
  it('formats numbers as USD', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
  });
});
```

### Component Tests

```typescript
test('PropertyBubble shows correct score', () => {
  render(<PropertyBubble property={mockProperty} />);
  expect(screen.getByText('85')).toBeInTheDocument();
});
```

### Integration Tests

```typescript
test('property selection flow', async () => {
  render(<App />);
  
  const bubble = await screen.findByTestId('property-123');
  fireEvent.click(bubble);
  
  expect(screen.getByText('Property Details')).toBeInTheDocument();
});
```

## 🔒 Security Considerations

1. **XSS Prevention**
   - React escapes content by default
   - Sanitize HTML if using `dangerouslySetInnerHTML`

2. **CSRF Protection**
   - Token-based authentication
   - SameSite cookies

3. **Secure Storage**
   - JWT in httpOnly cookies (server-side)
   - Sensitive data never in localStorage

4. **Input Validation**
   - Validate on client AND server
   - Sanitize user inputs

## 📚 Best Practices

1. **Component Organization**
   - One component per file
   - Named exports for utilities
   - Default export for main component

2. **TypeScript**
   - Strict mode enabled
   - Explicit return types for functions
   - Avoid `any` type

3. **CSS**
   - Tailwind utility classes
   - Component-scoped styles when needed
   - Consistent naming (BEM if not Tailwind)

4. **Git Workflow**
   - Feature branches
   - Conventional commits
   - PR reviews

5. **Documentation**
   - JSDoc for complex functions
   - README for each major component
   - Architecture docs (this file!)

## 🔄 Future Enhancements

- [ ] Add E2E tests (Playwright/Cypress)
- [ ] Implement service worker for offline support
- [ ] Add internationalization (i18n)
- [ ] Implement analytics tracking
- [ ] Add error boundary components
- [ ] Create Storybook for component library
- [ ] Add performance monitoring (Lighthouse)

---

**Last Updated:** 2026-01-31  
**Version:** 1.0.0
