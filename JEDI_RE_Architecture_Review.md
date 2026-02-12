# JEDI RE - Comprehensive Architectural Review

**Platform:** Outlook-style Integrated Real Estate Platform  
**Review Date:** 2025-06-02  
**Scope:** Production SaaS Architecture for Real Estate Teams

---

## Executive Summary

JEDI RE is a complex, multi-module platform requiring careful architectural decisions to ensure scalability, maintainability, and performance. This review provides specific technical recommendations for each layer of the stack.

**Critical Recommendations:**
- Adopt a **modular monolith** architecture initially, with clear module boundaries for future microservices extraction
- Implement **micro-frontends** for module isolation and team scalability
- Use **event-driven architecture** for inter-module communication
- Prioritize **real-time capabilities** (WebSockets) for collaborative features
- Implement **aggressive caching** strategy at multiple layers

---

## 1. Frontend Architecture

### 1.1 Component Structure

**Recommended Approach: Micro-Frontend Architecture**

Given the 5 distinct modules and Outlook-style layout, use a **shell + modules** pattern:

```
jedi-re-frontend/
├── shell/                          # Main application shell
│   ├── layout/
│   │   ├── TopBar.tsx              # Search, notifications, chat, user
│   │   ├── LeftSidebar.tsx         # Module navigation (70px/250px)
│   │   ├── RightSidebar.tsx        # Contextual sidebar controller
│   │   └── AgentStatusBar.tsx      # Bottom status bar
│   ├── routing/
│   │   ├── AppRouter.tsx           # Main router
│   │   └── ModuleLoader.tsx        # Dynamic module loading
│   └── state/
│       ├── GlobalStore.tsx         # Shared state (user, auth, navigation)
│       └── EventBus.tsx            # Inter-module communication
│
├── modules/
│   ├── map-view/                   # Module 1
│   │   ├── MapView.tsx
│   │   ├── ChatOverlay.tsx
│   │   ├── PropertyDetailsPanel.tsx
│   │   └── store/
│   │       └── mapStore.ts
│   │
│   ├── dashboard/                  # Module 2
│   │   ├── Dashboard.tsx
│   │   ├── KPIWidgets.tsx
│   │   ├── OpportunitiesWidget.tsx
│   │   └── store/
│   │       └── dashboardStore.ts
│   │
│   ├── deal-pipeline/              # Module 3
│   │   ├── KanbanBoard.tsx
│   │   ├── DealCard.tsx
│   │   ├── DealDetailsPanel.tsx
│   │   └── store/
│   │       └── pipelineStore.ts
│   │
│   ├── email-hub/                  # Module 4
│   │   ├── EmailInbox.tsx
│   │   ├── ReadingPane.tsx
│   │   ├── LinkedEntitiesPanel.tsx
│   │   └── store/
│   │       └── emailStore.ts
│   │
│   └── reports/                    # Module 5
│       ├── ReportsView.tsx
│       ├── ChartComponents.tsx
│       ├── FilterPanel.tsx
│       └── store/
│           └── reportsStore.ts
│
├── shared/
│   ├── components/                 # Shared UI components
│   │   ├── PropertyCard.tsx
│   │   ├── DealCard.tsx
│   │   ├── SearchBar.tsx
│   │   └── NotificationCenter.tsx
│   ├── hooks/                      # Shared React hooks
│   │   ├── useProperty.ts
│   │   ├── useDeal.ts
│   │   └── useRealtime.ts
│   ├── services/                   # API clients
│   │   ├── apiClient.ts
│   │   ├── websocketClient.ts
│   │   └── cacheService.ts
│   └── types/                      # TypeScript types
│       ├── Property.ts
│       ├── Deal.ts
│       └── Email.ts
│
└── right-sidebar-contexts/         # Contextual right sidebar content
    ├── PropertyContext.tsx
    ├── DealContext.tsx
    └── EmailContext.tsx
```

**Key Architectural Decisions:**

1. **Component Library:** Use **Radix UI** + **Tailwind CSS** + **shadcn/ui**
   - Headless components for maximum flexibility
   - Accessible by default
   - Highly customizable
   - Modern styling approach

2. **Module Isolation:** Each module should be:
   - Self-contained (own routes, state, components)
   - Lazy-loaded for performance
   - Independently deployable (future microservices)
   - Communicates via event bus for cross-module actions

3. **Layout Pattern:**
   ```tsx
   <Shell>
     <TopBar />
     <Layout>
       <LeftSidebar />
       <MainWorkspace>
         {/* Module content */}
       </MainWorkspace>
       <RightSidebar context={currentContext} />
     </Layout>
     <AgentStatusBar />
   </Shell>
   ```

### 1.2 State Management

**Recommended: Zustand + TanStack Query**

**Why not Redux?** Too much boilerplate for a modern app. Zustand provides simplicity with power.

**State Architecture:**

```typescript
// Global State (Zustand)
// store/globalStore.ts
interface GlobalState {
  user: User | null;
  selectedProperty: Property | null;
  selectedDeal: Deal | null;
  selectedEmail: Email | null;
  rightSidebarContext: 'property' | 'deal' | 'email' | null;
  notifications: Notification[];
  chatOpen: boolean;
}

// Module-specific stores
// modules/map-view/store/mapStore.ts
interface MapState {
  viewport: Viewport;
  markers: MapMarker[];
  selectedMarker: string | null;
  filters: MapFilters;
  chatMessages: ChatMessage[];
}

// Server State (TanStack Query)
const { data: properties } = useQuery({
  queryKey: ['properties', filters],
  queryFn: () => fetchProperties(filters),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**State Management Strategy:**

1. **Global State (Zustand):**
   - User authentication/profile
   - Current context (selected property/deal/email)
   - UI state (sidebar open/closed, notifications)
   - Navigation state

2. **Module State (Zustand):**
   - Module-specific UI state
   - Temporary selections
   - Module preferences

3. **Server State (TanStack Query):**
   - All data from API (properties, deals, emails)
   - Automatic caching, refetching, invalidation
   - Optimistic updates for mutations

4. **Real-time State (WebSocket + Zustand):**
   - Live updates (new emails, deal changes)
   - Collaborative editing
   - Agent status

**Context Switching Architecture:**

```typescript
// Centralized context manager
class ContextManager {
  // When user clicks property on map
  switchToPropertyContext(propertyId: string) {
    // 1. Update global state
    globalStore.setState({
      selectedProperty: propertyId,
      rightSidebarContext: 'property'
    });
    
    // 2. Prefetch related data
    queryClient.prefetchQuery(['property', propertyId]);
    queryClient.prefetchQuery(['property-emails', propertyId]);
    queryClient.prefetchQuery(['property-deals', propertyId]);
    
    // 3. Emit event for other modules
    eventBus.emit('property:selected', propertyId);
  }
  
  // Email → Property → Deal flow
  navigateEmailToPropertyToDeal(emailId: string) {
    // Parse email for property info
    // Open property in right sidebar
    // Show related deals
  }
}
```

### 1.3 Routing Strategy

**Recommended: TanStack Router** (type-safe, modern) or **React Router v6**

**URL Structure:**
```
/dashboard
/map
/map?property=ABC123                 # Deep link to property
/deals
/deals/stage/negotiation             # Filter by stage
/deals/ABC123                        # Deal details
/email
/email/inbox
/email/thread/XYZ789
/reports
/reports/team-performance
```

**Route Configuration:**

```typescript
const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'map', element: <MapView /> },
      { 
        path: 'deals',
        element: <DealPipeline />,
        children: [
          { path: 'stage/:stageId', element: <DealPipeline /> },
          { path: ':dealId', element: <DealDetails /> }
        ]
      },
      {
        path: 'email',
        element: <EmailHub />,
        children: [
          { path: 'inbox', element: <Inbox /> },
          { path: 'thread/:threadId', element: <ThreadView /> }
        ]
      },
      { path: 'reports', element: <Reports /> }
    ]
  }
]);
```

**Deep Linking Strategy:**
- All important entities (properties, deals, emails) have shareable URLs
- URL state syncs with UI state
- Browser back/forward works correctly
- Right sidebar state can be preserved in URL params

### 1.4 Performance Optimizations

**Critical for Production:**

1. **Code Splitting:**
   ```typescript
   // Lazy load modules
   const MapView = lazy(() => import('./modules/map-view/MapView'));
   const Dashboard = lazy(() => import('./modules/dashboard/Dashboard'));
   ```

2. **Virtual Scrolling:**
   - Use `@tanstack/react-virtual` for email lists, deal lists
   - Render only visible items (critical for 1000+ emails)

3. **Memoization:**
   ```typescript
   // Expensive computations
   const filteredDeals = useMemo(
     () => deals.filter(matchesFilters),
     [deals, filters]
   );
   
   // Prevent re-renders
   const PropertyCard = memo(({ property }) => { ... });
   ```

4. **Image Optimization:**
   - Use `next/image` approach with lazy loading
   - Serve WebP with fallback
   - CDN for property images

5. **Bundle Optimization:**
   - Tree-shaking unused code
   - Dynamic imports for heavy libraries (charts, maps)
   - Analyze bundle with `webpack-bundle-analyzer`

---

## 2. Backend Architecture

### 2.1 Architecture Pattern: Modular Monolith → Microservices

**Recommended Initial Approach: Modular Monolith**

Start with a well-structured monolith, design for future microservices extraction.

**Why Modular Monolith First?**
- Faster initial development
- Easier debugging and deployment
- Lower infrastructure costs
- Clear module boundaries enable future extraction
- Real estate teams typically &lt;1000 users initially

**When to Extract Microservices:**
- When a module has distinct scaling needs (e.g., email processing)
- When team size justifies independent deployments
- When specific modules need different tech stacks

**Backend Structure:**

```
jedi-re-backend/
├── src/
│   ├── modules/
│   │   ├── properties/
│   │   │   ├── properties.controller.ts
│   │   │   ├── properties.service.ts
│   │   │   ├── properties.repository.ts
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   │
│   │   ├── deals/
│   │   │   ├── deals.controller.ts
│   │   │   ├── deals.service.ts
│   │   │   ├── pipeline.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── emails/
│   │   │   ├── emails.controller.ts
│   │   │   ├── emails.service.ts
│   │   │   ├── parser.service.ts          # Email parsing
│   │   │   ├── linking.service.ts          # Auto-link to properties/deals
│   │   │   └── sync.service.ts             # Email sync worker
│   │   │
│   │   ├── analytics/
│   │   │   ├── analytics.controller.ts
│   │   │   ├── analytics.service.ts
│   │   │   └── aggregation.service.ts
│   │   │
│   │   ├── map/
│   │   │   ├── map.controller.ts
│   │   │   ├── geocoding.service.ts
│   │   │   └── search.service.ts
│   │   │
│   │   ├── ai-agent/
│   │   │   ├── agent.controller.ts
│   │   │   ├── agent.service.ts
│   │   │   ├── chat.service.ts
│   │   │   └── tasks.service.ts
│   │   │
│   │   └── notifications/
│   │       ├── notifications.service.ts
│   │       └── websocket.gateway.ts
│   │
│   ├── shared/
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   └── migrations/
│   │   ├── auth/
│   │   │   ├── auth.guard.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── rbac.guard.ts
│   │   ├── events/
│   │   │   ├── event-bus.service.ts
│   │   │   └── events.ts
│   │   └── utils/
│   │
│   └── main.ts
│
└── workers/                         # Background jobs
    ├── email-sync-worker.ts
    ├── analytics-aggregation-worker.ts
    └── ml-enrichment-worker.ts
```

### 2.2 API Design

**Recommended: RESTful + GraphQL Hybrid + WebSocket**

**REST APIs** for standard CRUD:
```
GET    /api/v1/properties
GET    /api/v1/properties/:id
POST   /api/v1/properties
PATCH  /api/v1/properties/:id
DELETE /api/v1/properties/:id

GET    /api/v1/deals
POST   /api/v1/deals
PATCH  /api/v1/deals/:id/stage          # Move deal stage
GET    /api/v1/deals/:id/timeline        # Deal activity

GET    /api/v1/emails
GET    /api/v1/emails/:id
GET    /api/v1/emails/:id/linked-entities  # Get linked properties/deals

GET    /api/v1/analytics/kpis
GET    /api/v1/analytics/team-performance
POST   /api/v1/analytics/custom-report
```

**GraphQL** for complex, nested queries (Dashboard, Reports):
```graphql
query Dashboard {
  currentUser {
    kpis {
      totalDeals
      closedThisMonth
      pipelineValue
    }
    recentDeals(limit: 5) {
      id
      property {
        address
        images
      }
      stage
      value
    }
    upcomingTasks(limit: 10) {
      id
      title
      dueDate
    }
  }
}

query PropertyDetails($id: ID!) {
  property(id: $id) {
    address
    details
    relatedEmails {
      subject
      from
      date
    }
    relatedDeals {
      stage
      value
      agent
    }
  }
}
```

**WebSocket** for real-time updates:
```typescript
// Socket.IO events
socket.on('deal:updated', (deal) => { ... });
socket.on('email:new', (email) => { ... });
socket.on('agent:status', (status) => { ... });
socket.on('notification:new', (notification) => { ... });
```

**API Versioning:**
- URL versioning: `/api/v1/`, `/api/v2/`
- Header versioning for minor changes
- Deprecation warnings in headers

**Pagination:**
```typescript
GET /api/v1/properties?page=1&limit=50
Response:
{
  data: [...],
  meta: {
    currentPage: 1,
    totalPages: 10,
    totalCount: 500,
    hasNext: true
  }
}
```

**Filtering & Sorting:**
```typescript
GET /api/v1/properties?status=active&minPrice=500000&sort=-createdAt
GET /api/v1/deals?stage=negotiation&agent=john@company.com
```

### 2.3 Database Schema

**Recommended: PostgreSQL (primary) + Redis (cache) + Elasticsearch (search)**

**Core Schema:**

```sql
-- Users & Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50), -- admin, agent, manager
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  property_type VARCHAR(50), -- residential, commercial, land
  status VARCHAR(50), -- active, sold, pending
  price DECIMAL(15, 2),
  details JSONB, -- flexible property details
  images TEXT[], -- array of image URLs
  team_id UUID REFERENCES teams(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_properties_location ON properties USING GIST (
  ll_to_earth(lat, lng)
); -- Geospatial index

CREATE INDEX idx_properties_team ON properties(team_id);
CREATE INDEX idx_properties_status ON properties(status);

-- Deals
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  title VARCHAR(255),
  stage VARCHAR(50), -- lead, qualified, negotiation, contract, closed-won, closed-lost
  value DECIMAL(15, 2),
  probability INTEGER, -- 0-100
  expected_close_date DATE,
  assigned_to UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_assigned ON deals(assigned_to);
CREATE INDEX idx_deals_property ON deals(property_id);

-- Deal stage history (for pipeline analytics)
CREATE TABLE deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50),
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emails
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) UNIQUE, -- Gmail/Outlook message ID
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id), -- email owner
  subject TEXT,
  from_address VARCHAR(255),
  to_addresses TEXT[],
  cc_addresses TEXT[],
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ,
  thread_id VARCHAR(255),
  has_attachments BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emails_user ON emails(user_id);
CREATE INDEX idx_emails_thread ON emails(thread_id);
CREATE INDEX idx_emails_received ON emails(received_at DESC);

-- Email linkage (many-to-many)
CREATE TABLE email_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  entity_type VARCHAR(50), -- 'property' or 'deal'
  entity_id UUID NOT NULL,
  link_type VARCHAR(50), -- 'auto' (AI detected) or 'manual' (user linked)
  confidence DECIMAL(3, 2), -- 0.0-1.0 for auto-linked
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_links_email ON email_entity_links(email_id);
CREATE INDEX idx_email_links_entity ON email_entity_links(entity_type, entity_id);

-- Activities (unified activity stream)
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  activity_type VARCHAR(50), -- 'deal_created', 'email_sent', 'property_viewed'
  entity_type VARCHAR(50), -- 'property', 'deal', 'email'
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_team ON activities(team_id, created_at DESC);
CREATE INDEX idx_activities_user ON activities(user_id, created_at DESC);
CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  due_date TIMESTAMPTZ,
  status VARCHAR(50), -- pending, completed
  priority VARCHAR(20), -- low, medium, high
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_due ON tasks(due_date);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50), -- 'deal_won', 'task_due', 'email_received'
  title VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- AI Agent
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  session_id UUID,
  messages JSONB[], -- array of messages
  context JSONB, -- current context (selected property/deal)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Database Optimization:**

1. **Partitioning:**
   - Partition `activities` by date (monthly)
   - Partition `emails` by date
   - Improves query performance for time-based queries

2. **Materialized Views for Analytics:**
   ```sql
   CREATE MATERIALIZED VIEW team_performance_daily AS
   SELECT 
     team_id,
     DATE(created_at) as date,
     COUNT(*) FILTER (WHERE activity_type = 'deal_created') as deals_created,
     COUNT(*) FILTER (WHERE activity_type = 'deal_closed_won') as deals_won,
     SUM(CAST(metadata->>'value' AS DECIMAL)) FILTER (WHERE activity_type = 'deal_closed_won') as revenue
   FROM activities
   GROUP BY team_id, DATE(created_at);
   
   -- Refresh daily via cron
   REFRESH MATERIALIZED VIEW CONCURRENTLY team_performance_daily;
   ```

3. **Full-Text Search:**
   ```sql
   -- Add tsvector column for property search
   ALTER TABLE properties ADD COLUMN search_vector tsvector;
   
   CREATE INDEX idx_properties_search ON properties USING GIN(search_vector);
   
   -- Update trigger
   CREATE TRIGGER properties_search_update
   BEFORE INSERT OR UPDATE ON properties
   FOR EACH ROW EXECUTE FUNCTION
   tsvector_update_trigger(search_vector, 'pg_catalog.english', address, city, details);
   ```

4. **Use Elasticsearch for:**
   - Property search (full-text, faceted, geo-search)
   - Email search (body content, attachments)
   - Autocomplete suggestions

---

## 3. Data Flow Architecture

### 3.1 Inter-Module Communication

**Event-Driven Architecture:**

```typescript
// Event Bus (Backend)
class EventBus {
  async publish(event: DomainEvent) {
    // 1. Store event in database (event sourcing)
    await this.eventStore.save(event);
    
    // 2. Publish to Redis pub/sub
    await this.redis.publish(event.topic, event);
    
    // 3. Trigger WebSocket broadcast
    await this.websocket.broadcast(event);
  }
}

// Example events
interface PropertyCreatedEvent {
  type: 'property.created';
  payload: { propertyId: string; address: string; };
  timestamp: string;
  userId: string;
}

interface DealStageChangedEvent {
  type: 'deal.stage_changed';
  payload: { dealId: string; fromStage: string; toStage: string; };
}

interface EmailLinkedEvent {
  type: 'email.linked';
  payload: { emailId: string; entityType: string; entityId: string; };
}
```

**Flow Examples:**

**Email → Property → Deal Flow:**
```typescript
// 1. Email arrives
EmailService.receiveEmail(email) {
  // Save to database
  const savedEmail = await emailRepo.save(email);
  
  // Parse for property info (AI)
  const linkedProperties = await emailParser.extractProperties(email);
  
  // Auto-link to properties
  for (const property of linkedProperties) {
    await emailLinkingService.link(savedEmail.id, property.id, 'auto');
    
    // Emit event
    eventBus.publish({
      type: 'email.linked',
      payload: { emailId: savedEmail.id, entityType: 'property', entityId: property.id }
    });
  }
  
  // Find related deals
  const deals = await dealService.findByProperty(property.id);
  if (deals.length > 0) {
    // Update right sidebar context
    eventBus.publish({
      type: 'context.suggest',
      payload: { suggestedContext: 'deal', dealId: deals[0].id }
    });
  }
}
```

**Map → Property → Email Flow:**
```typescript
// 1. User clicks property on map
Frontend: mapStore.selectProperty(propertyId) {
  // Update global state
  globalStore.setState({ selectedProperty: propertyId });
  
  // Update right sidebar
  globalStore.setState({ rightSidebarContext: 'property' });
  
  // Prefetch related data
  queryClient.prefetchQuery(['property-emails', propertyId]);
  queryClient.prefetchQuery(['property-deals', propertyId]);
}

// 2. Right sidebar renders property details + emails
PropertyContextSidebar: {
  const { data: property } = useQuery(['property', propertyId]);
  const { data: emails } = useQuery(['property-emails', propertyId]);
  const { data: deals } = useQuery(['property-deals', propertyId]);
  
  // User clicks email
  onEmailClick(emailId) {
    // Navigate to email module
    router.push(`/email/thread/${emails.find(e => e.id === emailId).threadId}`);
    
    // Keep property context in right sidebar
    globalStore.setState({ rightSidebarContext: 'property' });
  }
}
```

### 3.2 Caching Strategy

**Multi-Layer Caching:**

**Layer 1: Browser Cache (Service Worker)**
```typescript
// Cache static assets, API responses
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/v1/properties')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
```

**Layer 2: TanStack Query (Client-side)**
```typescript
// Aggressive caching with smart invalidation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Invalidate on mutations
const updatePropertyMutation = useMutation({
  mutationFn: updateProperty,
  onSuccess: () => {
    queryClient.invalidateQueries(['properties']);
    queryClient.invalidateQueries(['property', propertyId]);
  }
});
```

**Layer 3: Redis (Server-side)**
```typescript
// Cache frequently accessed data
class PropertyService {
  async findById(id: string) {
    const cacheKey = `property:${id}`;
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    // Query database
    const property = await propertyRepo.findById(id);
    
    // Store in cache (15 minutes)
    await redis.setex(cacheKey, 900, JSON.stringify(property));
    
    return property;
  }
  
  async update(id: string, data: UpdatePropertyDto) {
    const property = await propertyRepo.update(id, data);
    
    // Invalidate cache
    await redis.del(`property:${id}`);
    await redis.del('properties:*'); // Invalidate list caches
    
    // Publish invalidation event
    await redis.publish('cache:invalidate', { type: 'property', id });
    
    return property;
  }
}
```

**Layer 4: Database Query Cache**
- Use PostgreSQL query result caching
- Materialized views for expensive aggregations

**Cache Invalidation Strategy:**
```typescript
// When data changes, invalidate smartly
eventBus.on('property.updated', async ({ propertyId }) => {
  // Invalidate Redis cache
  await redis.del(`property:${propertyId}`);
  
  // Invalidate related caches
  const deals = await dealService.findByProperty(propertyId);
  for (const deal of deals) {
    await redis.del(`deal:${deal.id}`);
  }
  
  // Broadcast to all connected clients
  websocket.broadcast({
    type: 'cache:invalidate',
    resource: 'property',
    id: propertyId
  });
});
```

### 3.3 Real-Time Data Synchronization

**WebSocket Architecture:**

```typescript
// Server: WebSocket Gateway
@WebSocketGateway()
class NotificationGateway {
  @WebSocketServer() server: Server;
  
  // User subscribes to channels
  handleConnection(client: Socket) {
    const userId = this.authService.getUserFromSocket(client);
    const teamId = this.authService.getTeamFromSocket(client);
    
    // Subscribe to personal channel
    client.join(`user:${userId}`);
    
    // Subscribe to team channel
    client.join(`team:${teamId}`);
  }
  
  // Broadcast deal update to team
  async broadcastDealUpdate(dealId: string, teamId: string) {
    const deal = await this.dealService.findById(dealId);
    this.server.to(`team:${teamId}`).emit('deal:updated', deal);
  }
  
  // Notify user of new email
  async notifyNewEmail(userId: string, email: Email) {
    this.server.to(`user:${userId}`).emit('email:new', email);
  }
}

// Client: WebSocket Consumer
class RealtimeService {
  socket: Socket;
  
  connect() {
    this.socket = io('wss://api.jedire.com', {
      auth: { token: getAuthToken() }
    });
    
    // Listen for events
    this.socket.on('deal:updated', (deal) => {
      queryClient.setQueryData(['deal', deal.id], deal);
      toast.info(`Deal ${deal.title} updated`);
    });
    
    this.socket.on('email:new', (email) => {
      queryClient.invalidateQueries(['emails']);
      showNotification(`New email: ${email.subject}`);
    });
    
    this.socket.on('agent:status', (status) => {
      globalStore.setState({ agentStatus: status });
    });
  }
}
```

**Optimistic Updates:**
```typescript
// Update UI immediately, rollback on failure
const moveDealstageMutation = useMutation({
  mutationFn: (variables) => api.moveDealStage(variables),
  
  onMutate: async ({ dealId, newStage }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['deals']);
    
    // Snapshot current data
    const previousDeals = queryClient.getQueryData(['deals']);
    
    // Optimistically update
    queryClient.setQueryData(['deals'], (old) =>
      old.map(deal =>
        deal.id === dealId ? { ...deal, stage: newStage } : deal
      )
    );
    
    return { previousDeals };
  },
  
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['deals'], context.previousDeals);
    toast.error('Failed to move deal');
  },
  
  onSuccess: () => {
    queryClient.invalidateQueries(['deals']);
  }
});
```

---

## 4. Integration Points

### 4.1 Email Integration

**Recommended: OAuth + IMAP/SMTP + Webhooks**

**Gmail Integration:**
```typescript
class GmailService {
  // OAuth 2.0 authentication
  async authenticate(userId: string) {
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
    
    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Store refresh token
    await this.userService.saveGmailTokens(userId, tokens);
  }
  
  // Sync emails (background worker)
  async syncEmails(userId: string) {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Get messages since last sync
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${lastSyncTimestamp}`
    });
    
    for (const message of response.data.messages) {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      
      // Save to database
      await this.emailService.save(this.parseGmailMessage(fullMessage));
      
      // Parse for properties/deals
      await this.emailParser.extractAndLink(fullMessage);
    }
  }
  
  // Webhook for real-time updates (Gmail Push Notifications)
  async handleWebhook(notification: GmailPushNotification) {
    const historyId = notification.historyId;
    
    // Fetch new messages
    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistoryId
    });
    
    // Process new messages
    for (const record of history.data.history) {
      if (record.messagesAdded) {
        await this.processNewMessage(record.messagesAdded);
      }
    }
  }
}
```

**Microsoft Outlook Integration:**
```typescript
class OutlookService {
  // Microsoft Graph API
  async syncEmails(userId: string) {
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
    
    // Get messages
    const messages = await client
      .api('/me/messages')
      .filter(`receivedDateTime ge ${lastSyncDate}`)
      .select('subject,from,toRecipients,bodyPreview,receivedDateTime')
      .top(50)
      .get();
    
    // Process messages
    for (const message of messages.value) {
      await this.emailService.save(this.parseOutlookMessage(message));
    }
  }
  
  // Webhook subscriptions
  async createSubscription(userId: string) {
    await client.api('/subscriptions').post({
      changeType: 'created,updated',
      notificationUrl: 'https://api.jedire.com/webhooks/outlook',
      resource: '/me/messages',
      expirationDateTime: new Date(Date.now() + 3600000).toISOString()
    });
  }
}
```

**Email Parsing & Auto-Linking:**

```typescript
class EmailParserService {
  async extractAndLink(email: Email) {
    // 1. Extract addresses from email
    const addresses = this.extractAddresses(email.body_text);
    
    // 2. Geocode addresses
    const geocodedAddresses = await Promise.all(
      addresses.map(addr => this.geocodingService.geocode(addr))
    );
    
    // 3. Match to existing properties
    for (const address of geocodedAddresses) {
      const properties = await this.propertyService.findNearby(
        address.lat,
        address.lng,
        100 // 100 meter radius
      );
      
      if (properties.length > 0) {
        // Auto-link with confidence score
        await this.emailLinkingService.link(
          email.id,
          properties[0].id,
          'auto',
          0.85 // confidence
        );
      }
    }
    
    // 4. Extract deal-related keywords
    const dealKeywords = ['offer', 'contract', 'closing', 'inspection'];
    const hasDealKeywords = dealKeywords.some(kw =>
      email.body_text.toLowerCase().includes(kw)
    );
    
    if (hasDealKeywords) {
      // Try to link to existing deals
      const linkedProperties = await this.emailLinkingService.getLinkedProperties(email.id);
      for (const property of linkedProperties) {
        const deals = await this.dealService.findByProperty(property.id);
        if (deals.length > 0) {
          await this.emailLinkingService.link(email.id, deals[0].id, 'auto', 0.7);
        }
      }
    }
  }
  
  // Use AI for advanced parsing
  async aiExtractEntities(email: Email) {
    const prompt = `Extract real estate entities from this email:
    Subject: ${email.subject}
    Body: ${email.body_text}
    
    Extract:
    - Property addresses
    - Contact names and roles (buyer, seller, agent)
    - Dates (showings, closings)
    - Financial figures`;
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      functions: [{
        name: 'extract_entities',
        parameters: {
          type: 'object',
          properties: {
            addresses: { type: 'array', items: { type: 'string' } },
            contacts: { type: 'array', items: { type: 'object' } },
            dates: { type: 'array', items: { type: 'object' } },
            financial: { type: 'array', items: { type: 'object' } }
          }
        }
      }]
    });
    
    return response.choices[0].message.function_call.arguments;
  }
}
```

### 4.2 Map Services Integration

**Recommended: Mapbox GL JS + Google Maps Geocoding API**

```typescript
class MapService {
  // Mapbox for rendering
  initMap(container: HTMLElement) {
    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.5, 40], // Default center
      zoom: 9
    });
    
    // Add property markers
    this.addPropertyMarkers(map);
    
    // Add clustering for performance
    map.addSource('properties', {
      type: 'geojson',
      data: propertiesGeojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });
    
    return map;
  }
  
  // Google Geocoding for address → lat/lng
  async geocode(address: string) {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`
    );
    
    const data = await response.json();
    if (data.results.length > 0) {
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng,
        formatted_address: data.results[0].formatted_address
      };
    }
  }
  
  // Reverse geocoding (lat/lng → address)
  async reverseGeocode(lat: number, lng: number) {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`
    );
    
    const data = await response.json();
    return data.results[0]?.formatted_address;
  }
  
  // Property search within bounds
  async searchPropertiesInBounds(bounds: Bounds) {
    // Use PostGIS for efficient geospatial query
    const properties = await this.db.query(`
      SELECT * FROM properties
      WHERE lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4
        AND status = 'active'
    `, [bounds.south, bounds.north, bounds.west, bounds.east]);
    
    return properties;
  }
}
```

### 4.3 AI Agent Integration

**Recommended: OpenAI GPT-4 + LangChain**

```typescript
class AIAgentService {
  // Chat interface
  async chat(userId: string, message: string, context: AgentContext) {
    // Build context from current selections
    const contextPrompt = this.buildContextPrompt(context);
    
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a real estate assistant. ${contextPrompt}
          
          You have access to:
          - Property database
          - Deal pipeline
          - Email inbox
          - Analytics
          
          Help the user with tasks like:
          - Finding properties
          - Updating deals
          - Drafting emails
          - Analyzing performance`
        },
        ...conversationHistory,
        { role: 'user', content: message }
      ],
      functions: this.getAvailableFunctions()
    });
    
    // Execute function if requested
    if (completion.choices[0].message.function_call) {
      const result = await this.executeFunction(
        completion.choices[0].message.function_call
      );
      
      // Return result to user
      return this.formatResponse(result);
    }
    
    return completion.choices[0].message.content;
  }
  
  // Available agent functions
  getAvailableFunctions() {
    return [
      {
        name: 'search_properties',
        description: 'Search for properties matching criteria',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            minPrice: { type: 'number' },
            maxPrice: { type: 'number' },
            propertyType: { type: 'string' }
          }
        }
      },
      {
        name: 'update_deal_stage',
        description: 'Move a deal to a different stage',
        parameters: {
          type: 'object',
          properties: {
            dealId: { type: 'string' },
            newStage: { type: 'string' }
          }
        }
      },
      {
        name: 'draft_email',
        description: 'Draft an email to a contact',
        parameters: {
          type: 'object',
          properties: {
            recipient: { type: 'string' },
            subject: { type: 'string' },
            context: { type: 'string' }
          }
        }
      },
      {
        name: 'get_analytics',
        description: 'Get performance analytics',
        parameters: {
          type: 'object',
          properties: {
            metric: { type: 'string' },
            timeRange: { type: 'string' }
          }
        }
      }
    ];
  }
  
  // Task automation
  async executeTask(task: AgentTask) {
    switch (task.type) {
      case 'follow_up_email':
        return await this.draftFollowUpEmail(task.dealId);
      
      case 'update_property_status':
        return await this.propertyService.updateStatus(
          task.propertyId,
          task.newStatus
        );
      
      case 'schedule_showing':
        return await this.calendarService.createEvent(task.eventDetails);
    }
  }
}
```

**Agent Status Bar:**
```typescript
// Real-time agent status
interface AgentStatus {
  state: 'idle' | 'thinking' | 'acting';
  currentTask?: string;
  lastAction?: string;
  lastActionTime?: string;
}

// Update via WebSocket
websocket.on('agent:status', (status: AgentStatus) => {
  // Update bottom status bar
  agentStore.setState({ status });
});
```

---

## 5. Scalability Concerns

### 5.1 Performance Bottlenecks

**Identified Bottlenecks:**

1. **Map View with 10,000+ Properties**
   - **Problem:** Rendering all markers causes browser freeze
   - **Solution:**
     - Server-side clustering (return clustered data)
     - Client-side virtualization (only render visible markers)
     - Progressive loading (load high-zoom data on demand)
     ```typescript
     // Server: cluster properties by zoom level
     async getPropertiesForMap(bounds: Bounds, zoom: number) {
       if (zoom < 12) {
         // Return clusters
         return this.clusterService.cluster(bounds, zoom);
       } else {
         // Return individual properties
         return this.propertyService.findInBounds(bounds);
       }
     }
     ```

2. **Email Sync for Large Inboxes**
   - **Problem:** Initial sync of 50,000 emails takes hours
   - **Solution:**
     - Incremental sync (sync last 30 days first, backfill later)
     - Parallel processing (use Bull queue with multiple workers)
     - Batch processing (process 100 emails at a time)
     ```typescript
     // Queue-based email sync
     emailSyncQueue.add('sync-inbox', {
       userId,
       startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
       batchSize: 100
     }, {
       attempts: 3,
       backoff: { type: 'exponential', delay: 5000 }
     });
     ```

3. **Dashboard Loading Time**
   - **Problem:** Dashboard queries 5+ tables, takes 3+ seconds
   - **Solution:**
     - Materialized views for pre-computed KPIs
     - Redis cache for dashboard data (refresh every 5 minutes)
     - GraphQL DataLoader for N+1 query prevention
     ```typescript
     // Cached dashboard data
     async getDashboardData(userId: string) {
       const cacheKey = `dashboard:${userId}`;
       const cached = await redis.get(cacheKey);
       
       if (cached) return JSON.parse(cached);
       
       // Compute from materialized view
       const data = await this.db.query(`
         SELECT * FROM user_dashboard_mv WHERE user_id = $1
       `, [userId]);
       
       await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min cache
       return data;
     }
     ```

4. **Deal Pipeline with Real-Time Updates**
   - **Problem:** 100 users updating deals simultaneously causes conflicts
   - **Solution:**
     - Optimistic locking (version field)
     - Operational Transform (CRDTs for collaborative editing)
     - Debounced updates (batch updates every 500ms)
     ```typescript
     // Optimistic locking
     async updateDeal(id: string, data: UpdateDealDto, version: number) {
       const result = await this.db.query(`
         UPDATE deals
         SET data = $1, version = version + 1
         WHERE id = $2 AND version = $3
         RETURNING *
       `, [data, id, version]);
       
       if (result.rowCount === 0) {
         throw new ConflictException('Deal was updated by another user');
       }
       
       return result.rows[0];
     }
     ```

### 5.2 Optimization Opportunities

**Frontend Optimizations:**

1. **Code Splitting by Module:**
   ```typescript
   // Only load module code when needed
   const routes = [
     { path: '/map', component: lazy(() => import('./modules/map-view')) },
     { path: '/deals', component: lazy(() => import('./modules/deal-pipeline')) }
   ];
   ```

2. **Image Optimization:**
   - Use CDN with automatic image optimization (Cloudflare, Cloudinary)
   - Lazy load images below fold
   - Use `<picture>` with WebP + fallback
   ```tsx
   <picture>
     <source srcSet={`${property.image}?format=webp&width=400`} type="image/webp" />
     <img src={`${property.image}?width=400`} loading="lazy" alt={property.address} />
   </picture>
   ```

3. **Virtual Scrolling:**
   ```typescript
   import { useVirtualizer } from '@tanstack/react-virtual';
   
   function EmailList({ emails }) {
     const virtualizer = useVirtualizer({
       count: emails.length,
       getScrollElement: () => parentRef.current,
       estimateSize: () => 60, // email row height
     });
     
     return virtualizer.getVirtualItems().map(virtualRow => (
       <EmailRow key={virtualRow.key} email={emails[virtualRow.index]} />
     ));
   }
   ```

**Backend Optimizations:**

1. **Database Connection Pooling:**
   ```typescript
   const pool = new Pool({
     max: 20, // max connections
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

2. **Query Optimization:**
   - Add indexes on frequently filtered columns
   - Use EXPLAIN ANALYZE to identify slow queries
   - Denormalize for read-heavy operations
   ```sql
   -- Add composite index for common query
   CREATE INDEX idx_deals_team_stage ON deals(team_id, stage) 
   WHERE status = 'active';
   ```

3. **API Response Compression:**
   ```typescript
   app.use(compression({
     threshold: 1024, // only compress responses > 1KB
     level: 6 // balance between speed and compression ratio
   }));
   ```

4. **Background Job Processing:**
   ```typescript
   // Use Bull for heavy operations
   const emailSyncQueue = new Queue('email-sync', {
     redis: redisConfig,
     limiter: {
       max: 10, // max 10 jobs per second
       duration: 1000
     }
   });
   
   // Process in background workers
   emailSyncQueue.process(5, async (job) => {
     await emailSyncService.syncInbox(job.data.userId);
   });
   ```

### 5.3 Scaling Strategy

**Horizontal Scaling Plan:**

**Phase 1: 0-1,000 Users (Single Server)**
- Single EC2/Droplet instance
- PostgreSQL on same server
- Redis on same server
- Sufficient for initial launch

**Phase 2: 1,000-10,000 Users (Separated Services)**
```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ App 1 │ │ App 2 │ (Auto-scaling group)
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
    ┌────▼────────┐
    │ PostgreSQL  │ (RDS with read replicas)
    └─────────────┘
         │
    ┌────▼────────┐
    │   Redis     │ (ElastiCache)
    └─────────────┘
```

**Phase 3: 10,000-100,000 Users (Microservices)**
```
┌──────────────────────────────────────────┐
│            CDN (CloudFront)              │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│          API Gateway (Kong/AWS)          │
└──┬───────┬────────┬───────────┬──────────┘
   │       │        │           │
┌──▼──┐ ┌─▼──┐  ┌──▼───┐   ┌───▼────┐
│Props│ │Deal│  │Email │   │Analytics│
│Svc  │ │Svc │  │Svc   │   │Svc      │
└──┬──┘ └─┬──┘  └──┬───┘   └───┬────┘
   │      │        │           │
   └──────┴────────┴───────────┘
                   │
         ┌─────────▼──────────┐
         │  Event Bus (Kafka) │
         └────────────────────┘
                   │
         ┌─────────▼──────────┐
         │   PostgreSQL       │
         │   (Partitioned)    │
         └────────────────────┘
```

**Database Scaling:**
1. **Read Replicas** for read-heavy operations
2. **Partitioning** by team_id (shard by customer)
3. **Citus** for horizontal PostgreSQL scaling
4. **TimescaleDB** for time-series analytics data

**Caching Strategy:**
- **L1:** Browser cache (static assets)
- **L2:** CDN (images, property photos)
- **L3:** Redis (API responses, session data)
- **L4:** Application memory (hot data)

---

## 6. Security Architecture

### 6.1 Authentication & Authorization

**Authentication: JWT + Refresh Tokens**

```typescript
class AuthService {
  // Login
  async login(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    // Store refresh token (hashed)
    await this.storeRefreshToken(user.id, refreshToken);
    
    return { accessToken, refreshToken };
  }
  
  generateAccessToken(user: User) {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role, teamId: user.team_id },
      JWT_SECRET,
      { expiresIn: '15m' } // short-lived
    );
  }
  
  generateRefreshToken(user: User) {
    return jwt.sign(
      { sub: user.id, type: 'refresh' },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );
  }
  
  // Refresh access token
  async refresh(refreshToken: string) {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    
    // Check if refresh token is revoked
    const isValid = await this.isRefreshTokenValid(payload.sub, refreshToken);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    
    const user = await this.userService.findById(payload.sub);
    return this.generateAccessToken(user);
  }
}
```

**Authorization: RBAC (Role-Based Access Control)**

```typescript
// Roles
enum Role {
  ADMIN = 'admin',       // Full access
  MANAGER = 'manager',   // Team-level access
  AGENT = 'agent',       // Own data + assigned deals
  VIEWER = 'viewer'      // Read-only
}

// Guards
@Injectable()
class RoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());
    
    return requiredRoles.includes(user.role);
  }
}

// Usage
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Delete('properties/:id')
async deleteProperty(@Param('id') id: string) {
  return this.propertyService.delete(id);
}

// Row-level security
class PropertyService {
  async findAll(userId: string, userRole: Role, teamId: string) {
    // Admins see all properties
    if (userRole === Role.ADMIN) {
      return this.propertyRepo.findAll();
    }
    
    // Managers see team properties
    if (userRole === Role.MANAGER) {
      return this.propertyRepo.findByTeam(teamId);
    }
    
    // Agents see own + assigned properties
    return this.propertyRepo.findByCreatorOrAssigned(userId);
  }
}
```

### 6.2 Data Protection

**Encryption:**

1. **At Rest:**
   - Database encryption (AWS RDS encryption, PostgreSQL pgcrypto)
   - Encrypt sensitive fields (SSN, credit cards) with AES-256
   ```sql
   -- Encrypt sensitive data
   CREATE EXTENSION pgcrypto;
   
   INSERT INTO user_sensitive_data (user_id, ssn_encrypted)
   VALUES ($1, pgp_sym_encrypt($2, 'encryption-key'));
   
   -- Decrypt
   SELECT pgp_sym_decrypt(ssn_encrypted, 'encryption-key') FROM user_sensitive_data;
   ```

2. **In Transit:**
   - TLS 1.3 for all API requests (enforce HTTPS)
   - Certificate pinning for mobile apps
   - WebSocket over WSS (secure WebSocket)

3. **Secrets Management:**
   - Use AWS Secrets Manager / HashiCorp Vault
   - Never commit secrets to Git
   - Rotate secrets regularly
   ```typescript
   // Load secrets from AWS Secrets Manager
   const secrets = await secretsManager.getSecretValue({
     SecretId: 'jedi-re/production'
   }).promise();
   
   const config = JSON.parse(secrets.SecretString);
   ```

**Data Privacy (GDPR Compliance):**

```typescript
class DataPrivacyService {
  // Right to access
  async exportUserData(userId: string) {
    const userData = {
      profile: await this.userService.findById(userId),
      properties: await this.propertyService.findByUser(userId),
      deals: await this.dealService.findByUser(userId),
      emails: await this.emailService.findByUser(userId),
      activities: await this.activityService.findByUser(userId)
    };
    
    return JSON.stringify(userData, null, 2);
  }
  
  // Right to be forgotten
  async deleteUserData(userId: string) {
    // Anonymize instead of hard delete (preserve referential integrity)
    await this.userService.anonymize(userId);
    await this.emailService.deleteByUser(userId);
    await this.activityService.deleteByUser(userId);
    
    // Keep deals/properties but remove ownership
    await this.dealService.removeOwner(userId);
    await this.propertyService.removeCreator(userId);
  }
  
  // Data retention policy
  async enforceRetentionPolicy() {
    // Delete emails older than 2 years (unless linked to active deals)
    await this.emailService.deleteOlderThan(730); // 730 days
    
    // Archive closed deals older than 5 years
    await this.dealService.archiveOlderThan(1825);
  }
}
```

### 6.3 API Security

**Rate Limiting:**

```typescript
import rateLimit from 'express-rate-limit';

// Global rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true
});

app.use('/api/auth/login', authLimiter);
```

**Input Validation:**

```typescript
import { z } from 'zod';

// Schema validation
const CreatePropertySchema = z.object({
  address: z.string().min(5).max(255),
  city: z.string().min(2).max(100),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  price: z.number().positive().max(1000000000),
  propertyType: z.enum(['residential', 'commercial', 'land'])
});

// Controller
async createProperty(@Body() dto: CreatePropertyDto) {
  // Validate
  const validated = CreatePropertySchema.parse(dto);
  
  // Sanitize
  const sanitized = this.sanitizeInput(validated);
  
  return this.propertyService.create(sanitized);
}
```

**SQL Injection Prevention:**

```typescript
// ALWAYS use parameterized queries
const properties = await this.db.query(
  'SELECT * FROM properties WHERE city = $1 AND price < $2',
  [city, maxPrice] // parameters prevent injection
);

// NEVER do this:
// const properties = await this.db.query(
//   `SELECT * FROM properties WHERE city = '${city}'` // VULNERABLE!
// );
```

**CORS Configuration:**

```typescript
app.use(cors({
  origin: [
    'https://app.jedire.com',
    'https://staging.jedire.com',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
  ].filter(Boolean),
  credentials: true,
  maxAge: 86400 // 24 hours
}));
```

**Content Security Policy:**

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https://cdn.jedire.com'],
      connectSrc: ["'self'", 'wss://api.jedire.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com'],
      frameSrc: ["'none'"]
    }
  }
}));
```

---

## 7. Technology Stack Recommendations

### 7.1 Frontend Stack

**Core Framework:**
- **React 18** with TypeScript
- **Vite** for build tool (faster than CRA)
- **pnpm** for package management (faster, disk-efficient)

**UI & Styling:**
- **Radix UI** (headless components)
- **Tailwind CSS** (utility-first styling)
- **shadcn/ui** (pre-built components on top of Radix)
- **Framer Motion** (animations)

**State Management:**
- **Zustand** (global state)
- **TanStack Query** (server state)
- **TanStack Router** (routing)

**Data Visualization:**
- **Recharts** (simple charts)
- **D3.js** (custom visualizations)
- **AG Grid** (advanced data tables)

**Maps:**
- **Mapbox GL JS** (primary map library)
- **React-Mapbox-GL** (React wrapper)

**Real-Time:**
- **Socket.IO Client** (WebSocket)

**Forms:**
- **React Hook Form** (form management)
- **Zod** (validation)

**Testing:**
- **Vitest** (unit tests)
- **Playwright** (E2E tests)
- **React Testing Library** (component tests)

### 7.2 Backend Stack

**Framework:**
- **NestJS** (Node.js framework with TypeScript)
  - Structured, scalable architecture
  - Built-in dependency injection
  - Easy to test

**Alternative:** **Fastify** (if you need raw performance)

**Database:**
- **PostgreSQL 15+** (primary database)
  - JSONB for flexible schema
  - PostGIS for geospatial queries
  - Full-text search
- **Redis** (caching, pub/sub, sessions)
- **Elasticsearch** (search, optional)

**ORM:**
- **Prisma** or **TypeORM**
  - Type-safe queries
  - Migrations
  - Prisma recommended for better DX

**API:**
- **REST** (standard endpoints)
- **GraphQL** with Apollo Server (complex queries)
- **Socket.IO** (WebSocket)

**Background Jobs:**
- **Bull** (Redis-based queue)
- **BullMQ** (newer, better API)

**Email Integration:**
- **googleapis** (Gmail API)
- **@microsoft/microsoft-graph-client** (Outlook API)

**Authentication:**
- **Passport.js** (strategies)
- **jsonwebtoken** (JWT)

**Validation:**
- **class-validator** (DTO validation)
- **Zod** (schema validation)

**Testing:**
- **Jest** (unit/integration tests)
- **Supertest** (API tests)

### 7.3 Infrastructure Stack

**Cloud Provider:**
- **AWS** (recommended for enterprise)
  - EC2 / ECS / EKS (compute)
  - RDS (PostgreSQL)
  - ElastiCache (Redis)
  - S3 (file storage)
  - CloudFront (CDN)
  - Route 53 (DNS)
  - SES (transactional emails)

**Alternative:** **Google Cloud Platform** or **Azure**

**Container Orchestration:**
- **Docker** (containerization)
- **Kubernetes** (when scaling to microservices)
- **AWS ECS** (simpler alternative to K8s)

**CI/CD:**
- **GitHub Actions** (preferred)
- **GitLab CI** (alternative)

**Monitoring:**
- **Sentry** (error tracking)
- **Datadog** or **New Relic** (APM)
- **Grafana + Prometheus** (metrics)
- **CloudWatch** (AWS logs)

**Logging:**
- **Winston** (Node.js logging)
- **ELK Stack** (Elasticsearch, Logstash, Kibana)

**CDN:**
- **CloudFront** (AWS)
- **Cloudflare** (alternative with DDoS protection)

### 7.4 Development Tools

**Version Control:**
- **Git** + **GitHub**
- **Conventional Commits** (commit message format)
- **Husky** (Git hooks for linting)

**Code Quality:**
- **ESLint** (linting)
- **Prettier** (formatting)
- **TypeScript** strict mode

**Documentation:**
- **Swagger / OpenAPI** (API docs)
- **Storybook** (component docs)
- **Notion** or **Confluence** (general docs)

**Design:**
- **Figma** (UI/UX design)

**Project Management:**
- **Linear** (issue tracking)
- **Notion** (documentation)

---

## 8. Deployment Strategy

### 8.1 Infrastructure Setup

**Production Architecture:**

```yaml
# docker-compose.yml (development)
version: '3.8'
services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: jedire
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/jedire
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  postgres_data:
```

**AWS Production Setup:**

```terraform
# main.tf (Terraform)
provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "jedi-re-vpc"
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier           = "jedi-re-db"
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = "db.t3.large"
  allocated_storage    = 100
  storage_encrypted    = true
  
  db_name              = "jedire"
  username             = "postgres"
  password             = var.db_password
  
  multi_az             = true
  backup_retention_period = 7
  
  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "jedi-re-cache"
  engine               = "redis"
  node_type            = "cache.t3.medium"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.cache.id]
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "jedi-re-cluster"
}

# Load Balancer
resource "aws_lb" "main" {
  name               = "jedi-re-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

# S3 for static assets
resource "aws_s3_bucket" "assets" {
  bucket = "jedi-re-assets"
  
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://app.jedire.com"]
    max_age_seconds = 3600
  }
}

# CloudFront CDN
resource "aws_cloudfront_distribution" "main" {
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-jedi-re-assets"
  }
  
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  aliases = ["app.jedire.com"]
  
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-jedi-re-assets"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }
  
  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.main.arn
    ssl_support_method  = "sni-only"
  }
}
```

### 8.2 CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Lint
        run: pnpm lint
      
      - name: Type check
        run: pnpm type-check
      
      - name: Test
        run: pnpm test
      
      - name: Build
        run: pnpm build

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: jedi-re-backend
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster jedi-re-cluster \
            --service backend \
            --force-new-deployment

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: cd frontend && pnpm install
      
      - name: Build
        run: cd frontend && pnpm build
        env:
          VITE_API_URL: https://api.jedire.com
      
      - name: Deploy to S3
        run: |
          aws s3 sync frontend/dist s3://jedi-re-frontend --delete
      
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

### 8.3 Monitoring & Observability

**Logging Setup:**

```typescript
// logger.service.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'jedi-re-backend' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Usage
logger.info('Property created', { propertyId, userId });
logger.error('Database connection failed', { error });
```

**Error Tracking (Sentry):**

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});

// Express error handler
app.use(Sentry.Handlers.errorHandler());
```

**Metrics (Prometheus):**

```typescript
import { Counter, Histogram, register } from 'prom-client';

// Request counter
const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Request duration
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route']
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Health Checks:**

```typescript
@Controller('health')
class HealthController {
  @Get()
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
    };
  }
  
  private async checkDatabase() {
    try {
      await this.db.query('SELECT 1');
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}
```

### 8.4 Backup & Disaster Recovery

**Automated Backups:**

```yaml
# RDS automated backups (daily)
backup_retention_period = 7
backup_window = "03:00-04:00"  # 3-4 AM UTC

# Point-in-time recovery enabled
enabled_cloudwatch_logs_exports = ["postgresql"]
```

**Database Backup Script:**

```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql.gz"

# Dump database
pg_dump $DATABASE_URL | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://jedi-re-backups/

# Keep only last 30 days
aws s3 ls s3://jedi-re-backups/ | while read -r line; do
  createDate=$(echo $line | awk {'print $1" "$2'})
  createDate=$(date -d "$createDate" +%s)
  olderThan=$(date -d "30 days ago" +%s)
  if [[ $createDate -lt $olderThan ]]; then
    fileName=$(echo $line | awk {'print $4'})
    aws s3 rm s3://jedi-re-backups/$fileName
  fi
done
```

**Disaster Recovery Plan:**

1. **RTO (Recovery Time Objective):** 4 hours
2. **RPO (Recovery Point Objective):** 1 hour (max data loss)

**Recovery Steps:**
```bash
# 1. Restore database from latest backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier jedi-re-db-restored \
  --db-snapshot-identifier latest-snapshot

# 2. Update DNS to point to backup region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://failover.json

# 3. Scale up backup infrastructure
aws ecs update-service \
  --cluster jedi-re-backup-cluster \
  --service backend \
  --desired-count 3
```

---

## 9. Recommendations Summary

### 9.1 Critical Success Factors

**Must-Have for Launch:**

1. ✅ **Solid Authentication** - JWT + refresh tokens, RBAC
2. ✅ **Email Integration** - Gmail/Outlook sync with auto-linking
3. ✅ **Real-time Updates** - WebSocket for collaborative features
4. ✅ **Performant Map** - Clustering, lazy loading for 10K+ properties
5. ✅ **Mobile Responsive** - Works on tablets/phones
6. ✅ **Data Security** - Encryption, GDPR compliance
7. ✅ **Error Tracking** - Sentry integration from day 1

### 9.2 Phase Rollout Plan

**Phase 1: MVP (3-4 months)**
- Core modules (Map, Dashboard, Deals, Email)
- Basic AI agent (chat + simple tasks)
- Email sync (Gmail only)
- Single-tenant deployment

**Phase 2: Scale (2-3 months)**
- Outlook integration
- Advanced analytics
- Multi-tenant architecture
- Mobile app (React Native)

**Phase 3: Enterprise (3-4 months)**
- Microservices extraction
- Advanced AI features (predictive analytics)
- White-label capabilities
- Enterprise SSO (SAML, LDAP)

### 9.3 Potential Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Email sync performance | Background workers, incremental sync, rate limiting |
| Real-time scaling | Redis pub/sub, horizontal scaling, WebSocket sticky sessions |
| Data consistency | Event sourcing, optimistic locking, conflict resolution |
| Security breach | Regular audits, penetration testing, bug bounty program |
| Vendor lock-in (AWS) | Abstract infrastructure layer, use Terraform, multi-cloud ready |

### 9.4 Key Metrics to Track

**Technical Metrics:**
- API response time (p50, p95, p99)
- Database query performance
- WebSocket connection stability
- Error rate (5xx errors)
- Cache hit rate

**Business Metrics:**
- User activation rate
- Daily active users (DAU)
- Email sync success rate
- Deal conversion rate
- Feature adoption rate

---

## 10. Next Steps

1. **Set up development environment**
   - Initialize monorepo (Turborepo/Nx)
   - Configure Docker Compose for local dev
   - Set up linting, formatting, pre-commit hooks

2. **Database design**
   - Create schema in PostgreSQL
   - Set up migrations (Prisma/TypeORM)
   - Seed with test data

3. **Build shell application**
   - Implement layout (top bar, sidebars)
   - Set up routing
   - Implement authentication

4. **Develop first module (Dashboard)**
   - Prove out state management
   - Test real-time updates
   - Validate GraphQL integration

5. **Email integration POC**
   - Gmail OAuth flow
   - Email parsing & linking
   - Background sync worker

6. **Deploy to staging**
   - Set up AWS infrastructure
   - Configure CI/CD
   - Implement monitoring

---

## Conclusion

JEDI RE is an ambitious platform that requires careful architectural planning. The recommendations in this review provide a solid foundation for building a scalable, secure, and performant SaaS application.

**Key Takeaways:**
- Start with a modular monolith, design for future microservices
- Invest heavily in real-time infrastructure (WebSocket, caching)
- Email integration is complex - dedicate resources accordingly
- Security and performance must be priorities from day 1
- Use modern, battle-tested technologies (React, NestJS, PostgreSQL)
- Plan for scale, but don't over-engineer initially

The architecture outlined here supports both rapid initial development and long-term scalability. With disciplined execution, JEDI RE can become a leading platform in the real estate tech space.

---

**Review Completed By:** AI Architecture Consultant  
**Date:** 2025-06-02  
**Version:** 1.0
