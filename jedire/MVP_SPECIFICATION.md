# JEDI RE - MVP Specification
**Version:** 1.0  
**Date:** February 5, 2026  
**Status:** Ready for Development  
**Timeline:** 4 weeks to launch

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [MVP Scope](#mvp-scope)
3. [User Stories](#user-stories)
4. [Feature Specifications](#feature-specifications)
5. [Technical Architecture](#technical-architecture)
6. [Component Hierarchy](#component-hierarchy)
7. [API Contracts](#api-contracts)
8. [Data Model](#data-model)
9. [Development Plan](#development-plan)
10. [Testing Strategy](#testing-strategy)
11. [Launch Checklist](#launch-checklist)

---

## Executive Summary

### Product Vision
JEDI RE is an **AI-powered real estate intelligence platform** that allows investors to discover, analyze, and track investment opportunities through conversational AI and interactive mapping.

### MVP Goal
**Validate core value proposition:** Users can search for properties through natural conversation, see results visualized on a map, and get instant AI-powered strategy analysis.

### Success Metrics
- 50+ active users in first month
- Average 10+ property searches per user per week
- 80%+ user satisfaction with AI analysis quality
- 30%+ of users create at least one alert

### What We're Building (4 Weeks)
1. **Map View + AI Chat** - Core intelligence interface
2. **Property Detail Pages** - Deep analysis view
3. **Basic Dashboard** - User home base
4. **Module Management** - Subscription controls

### What We're NOT Building (Phase 2)
- Deal Pipeline (Kanban)
- Email Integration
- Reports Builder
- Map Drawing Tools
- Team Collaboration
- Mobile Apps

---

## MVP Scope

### In Scope (Must Have)

#### 1. Conversational Property Search
- Natural language queries ("Find 2br in Midtown under $500k")
- Chief Orchestrator routes to Property Search Agent
- Results displayed on map with property cards
- Real-time agent status updates

#### 2. Strategy Arbitrage Analysis
- Analyze properties for all 4 strategies (rental, Airbnb, flip, build-to-sell)
- Display ROI, cash flow, and confidence scores
- AI-generated insights and recommendations
- Side-by-side strategy comparison

#### 3. Interactive Map
- Full-screen Mapbox with property markers
- Click marker → property card slides up
- Color-coded by best strategy
- Zoom/pan/cluster controls

#### 4. Property Details
- Photo carousel
- Full property information
- Strategy analysis table
- AI insights panel
- Save to watchlist

#### 5. Basic Dashboard
- Portfolio value KPI
- Active alerts count
- Top 3 opportunities
- Today's tasks (simple list)
- Recent activity feed

#### 6. Alerts System
- Create property alerts via chat
- Criteria: location, price, strategy, ROI threshold
- Email + in-app notifications
- View/pause/delete alerts

#### 7. User Authentication
- Email/password signup
- Google OAuth
- JWT-based sessions
- Subscription tier management

#### 8. Module Management
- View active modules (Basic/Pro/Enterprise)
- Toggle modules on/off
- Usage tracking
- Upgrade prompts

### Out of Scope (Phase 2+)

#### Deal Pipeline
- Kanban board
- Deal stages
- Task management
- Document uploads
→ **Users can save properties to watchlist instead**

#### Email Integration
- Send/receive in platform
- Email templates
- Thread management
→ **Use mailto: links for now**

#### Reports & Analytics
- Custom report builder
- Charts and visualizations
- Scheduled reports
→ **Export data to CSV instead**

#### Map Builder
- Draw custom boundaries
- Save map views
- Annotation tools
→ **Agent highlights areas programmatically**

#### Team Features
- Invite team members
- Role-based permissions
- Shared deals
→ **Single-user MVP**

#### Mobile Apps
- Native iOS/Android
- Gesture controls
- Offline mode
→ **Desktop web only, mobile-responsive**

---

## User Stories

### Epic 1: Property Discovery

**US-1.1: Natural Language Search**
```
As a real estate investor
I want to search for properties using natural language
So that I don't have to fill out complex filter forms

Acceptance Criteria:
- User can type "Find flip opportunities in Buckhead under $500k"
- Chief Orchestrator parses intent and routes to Property Search Agent
- Results appear on map within 5 seconds
- User sees agent status: "Property Search Agent: Found 23 properties"
```

**US-1.2: View Property on Map**
```
As a user
I want to see search results visualized on a map
So that I can understand geographic context

Acceptance Criteria:
- Properties appear as markers on map
- Markers are color-coded by best strategy
- Clicking marker shows property card
- Map auto-zooms to show all results
```

**US-1.3: Property Quick View**
```
As a user
I want to see key property details in a card
So that I can quickly evaluate opportunities

Acceptance Criteria:
- Card shows: photo, address, price, beds/baths/sqft
- Best strategy badge displayed with ROI
- "View Details" button opens full page
- "Save" button adds to watchlist
```

### Epic 2: Strategy Analysis

**US-2.1: Request Analysis**
```
As a user
I want to analyze investment strategies for a property
So that I can make informed decisions

Acceptance Criteria:
- User clicks "View Details" on property card
- Strategy Arbitrage Agent analyzes all 4 strategies
- Analysis completes within 10 seconds
- Results shown in comparison table
```

**US-2.2: Compare Strategies**
```
As a user
I want to see all 4 strategies side-by-side
So that I can identify the best approach

Acceptance Criteria:
- Table shows: Strategy, ROI, Monthly Income, Rating (⭐)
- Best strategy highlighted with badge
- Each strategy shows key metrics
- AI insights explain recommendations
```

**US-2.3: AI Insights**
```
As a user
I want AI-generated insights about a property
So that I understand risks and opportunities

Acceptance Criteria:
- Insights panel shows pros/cons
- ✓ Green for positive factors
- ⚠ Yellow for risks
- Plain language explanations
```

### Epic 3: Monitoring & Alerts

**US-3.1: Create Alert via Chat**
```
As a user
I want to create alerts through conversation
So that I'm notified of new opportunities

Acceptance Criteria:
- User says "Alert me when properties like this come up"
- Deal Tracker Agent creates alert from context
- Confirmation message shows: alert name, criteria, active properties
- Alert appears in dashboard
```

**US-3.2: Receive Notifications**
```
As a user
I want to be notified when properties match my alerts
So that I don't miss opportunities

Acceptance Criteria:
- Email sent when match found
- In-app notification badge
- Notification includes: property preview, match score
- Click notification → property detail page
```

**US-3.3: Manage Alerts**
```
As a user
I want to view and manage my alerts
So that I can control what I'm tracking

Acceptance Criteria:
- Dashboard shows list of active alerts
- Each alert shows: name, criteria, active properties count
- Pause/resume toggle
- Delete button with confirmation
```

### Epic 4: User Onboarding

**US-4.1: Quick Signup**
```
As a new user
I want to sign up quickly
So that I can start searching immediately

Acceptance Criteria:
- Email/password or Google OAuth
- Basic profile info (name, phone)
- Choose subscription tier (14-day trial)
- Redirect to onboarding tour
```

**US-4.2: Guided Tour**
```
As a new user
I want a guided tour of the platform
So that I understand how to use it

Acceptance Criteria:
- 4-step interactive tour
- Step 1: "This is your map"
- Step 2: "Ask me anything in chat"
- Step 3: "I'll highlight and analyze properties"
- Step 4: First interaction prompt
- Skip option available
```

**US-4.3: First Search**
```
As a new user
I want to complete my first search
So that I see the platform's value immediately

Acceptance Criteria:
- Onboarding prompts: "What properties are you looking for?"
- User types query (e.g., "2-unit in Atlanta under $300k")
- Agent executes search and shows results
- Success message: "Great! Want to create an alert for these?"
```

---

## Feature Specifications

### Feature 1: Map View + Floating Chat

#### Visual Design
```
┌─────────────────────────────────────────────────────────┐
│ JEDI RE    🔍 Search...       [Notifications] [User]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│                    INTERACTIVE MAP                       │
│                  (Mapbox GL JS)                          │
│                                                          │
│               [Property markers]                         │
│               [Color-coded by strategy]                  │
│                                                          │
│                                                          │
│   ┌─────────────────────────────────────┐               │
│   │ 💬 Chief Orchestrator         [─][×]│               │
│   │                                     │               │
│   │ 🤖: Found 23 properties...          │               │
│   │                                     │               │
│   │ You: Show flip opportunities        │               │
│   │                                     │               │
│   │ [Property Card] [Property Card]     │               │
│   │                                     │               │
│   │ [Type message...]           [🎤][→] │               │
│   └─────────────────────────────────────┘               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🏗️ PropertySearch: ✓  StrategyArbitrage: 78%    │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

#### Component Structure
```typescript
<MapView>
  <MapboxMap>
    <PropertyMarkers />
    <PropertyCluster />
    <MapControls />
  </MapboxMap>
  
  <ChatOverlay expanded={chatExpanded}>
    <ChatHeader />
    <MessageList>
      {messages.map(msg => <ChatMessage />)}
    </MessageList>
    <PropertyCardsRow />
    <ChatInput />
  </ChatOverlay>
  
  <AgentStatusBar tasks={activeTasks} />
</MapView>
```

#### Interactions

**1. Initial Load**
- Map loads centered on user's location (or default: Atlanta)
- Chat overlay minimized (show floating button)
- No properties displayed yet
- Onboarding tooltip: "Ask me to find properties"

**2. User Types Query**
- User clicks chat button → overlay expands
- User types: "Find 2br in Midtown under $500k"
- Message sends on Enter or click arrow
- User message appears in chat
- Agent typing indicator shows

**3. Agent Processing**
- Agent status bar appears: "PropertySearch: Processing..."
- Chief Orchestrator parses query
- Routes to Property Search Agent
- Status updates: "PropertySearch: Found 23 properties"

**4. Results Display**
- Map markers fade in (animated)
- Markers color-coded by best strategy
- Property cards slide up in chat
- Agent message: "Found 23 properties matching your criteria. Top 3 shown below."

**5. Marker Interaction**
- Hover marker → show address tooltip
- Click marker → property card slides up from bottom
- Card shows: photo, price, beds/baths, strategy badge
- Click "View Details" → navigate to property page

**6. Chat Minimization**
- User clicks minimize → chat collapses to floating button
- Property cards disappear
- Map remains with markers
- Agent status bar remains visible

#### State Management

```typescript
// Zustand store
interface MapState {
  properties: Property[];
  selectedProperty: Property | null;
  mapCenter: [number, number];
  mapZoom: number;
  chatExpanded: boolean;
  activeTasks: AgentTask[];
}

// Actions
const useMapStore = create<MapState>((set) => ({
  properties: [],
  selectedProperty: null,
  mapCenter: [-84.3880, 33.7490], // Atlanta
  mapZoom: 11,
  chatExpanded: false,
  activeTasks: [],
  
  setProperties: (properties) => set({ properties }),
  selectProperty: (property) => set({ selectedProperty: property }),
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),
  toggleChat: () => set((state) => ({ chatExpanded: !state.chatExpanded })),
  setActiveTasks: (tasks) => set({ activeTasks: tasks }),
}));
```

#### Performance Requirements
- Initial map load: <2 seconds
- Marker rendering: <500ms for 1000 properties
- Chat message latency: <200ms
- Agent response time: <5 seconds (with loading state)
- Smooth zoom/pan: 60 FPS

---

### Feature 2: Property Detail Page

#### Visual Design
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back    847 Peachtree St NE             [Save] [Share]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │  [Photo 1 of 12] │  │ 💰 $450,000                  │   │
│  │                  │  │                              │   │
│  │  ← Carousel →    │  │ 2 bed | 2 bath | 1,200 sqft  │   │
│  │                  │  │ 📍 Midtown, Atlanta          │   │
│  │                  │  │ 🏢 Condo | Built 2018        │   │
│  └──────────────────┘  │                              │   │
│                        │ [🏨 Airbnb: 15.2% ROI]       │   │
│  ┌──────────────────┐  │                              │   │
│  │ 📍 Location Map  │  │ [Contact] [Schedule Showing] │   │
│  │  [Mini map]      │  └──────────────────────────────┘   │
│  └──────────────────┘                                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 📊 Strategy Arbitrage Analysis                        │ │
│  │                                                       │ │
│  │ ┌─────────┬─────────┬──────────┬─────────┐          │ │
│  │ │Strategy │ ROI     │ Income   │ Rating  │          │ │
│  │ ├─────────┼─────────┼──────────┼─────────┤          │ │
│  │ │🏠 Rental│ 12.5%   │ $1,150/mo│ ⭐⭐⭐⭐ │          │ │
│  │ │🏨 Airbnb│ 15.2%   │ $2,146/mo│ ⭐⭐⭐⭐⭐│          │ │
│  │ │🔨 Flip  │  8.3%   │ $27k     │ ⭐⭐⭐  │          │ │
│  │ │🏗️ Build │  N/A    │  N/A     │ -       │          │ │
│  │ └─────────┴─────────┴──────────┴─────────┘          │ │
│  │                                                       │ │
│  │ [View Detailed Analysis]                             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🎯 AI Insights                                        │ │
│  │                                                       │ │
│  │ ✓ Below market rent ($1,850 vs $2,100 median)        │ │
│  │ ✓ High Airbnb demand area (near GA Tech)             │ │
│  │ ✓ Parking included (rare for Midtown)                │ │
│  │ ⚠ Oversupply in luxury segment                       │ │
│  │ ⚠ New construction pipeline nearby                   │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Component Structure
```typescript
<PropertyDetailPage>
  <PropertyHeader>
    <BackButton />
    <Address />
    <Actions>
      <SaveButton />
      <ShareButton />
    </Actions>
  </PropertyHeader>
  
  <PropertyContent>
    <LeftColumn>
      <PhotoCarousel images={property.photos} />
      <LocationMap lat={property.lat} lng={property.lng} />
      <PropertyDetails details={property} />
    </LeftColumn>
    
    <RightColumn>
      <PropertySummaryCard>
        <Price />
        <BasicInfo />
        <BestStrategyBadge />
        <ActionButtons />
      </PropertySummaryCard>
      
      <StrategyAnalysisTable analyses={strategyAnalyses} />
      <AIInsightsPanel insights={aiInsights} />
    </RightColumn>
  </PropertyContent>
</PropertyDetailPage>
```

#### Data Loading Flow

```typescript
// Property detail page component
function PropertyDetailPage() {
  const { id } = useParams();
  
  // Fetch property
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => fetchProperty(id),
  });
  
  // Fetch strategy analyses (parallel)
  const { data: analyses, isLoading: analysesLoading } = useQuery({
    queryKey: ['analyses', id],
    queryFn: () => fetchStrategyAnalyses(id),
    enabled: !!property, // Only fetch after property loads
  });
  
  // Generate AI insights (after analyses complete)
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['insights', id],
    queryFn: () => generateInsights(id, analyses),
    enabled: !!analyses,
  });
  
  if (propertyLoading) return <PropertyDetailSkeleton />;
  if (!property) return <PropertyNotFound />;
  
  return (
    <ErrorBoundary fallback={<PropertyDetailError />}>
      <PropertyDetailPage 
        property={property}
        analyses={analyses}
        insights={insights}
        loading={{
          analyses: analysesLoading,
          insights: insightsLoading,
        }}
      />
    </ErrorBoundary>
  );
}
```

#### Strategy Analysis Table Logic

```typescript
interface StrategyAnalysis {
  strategy: 'rental' | 'airbnb' | 'flip' | 'build_to_sell';
  roi: number;
  monthly_income: number;
  confidence: number;
  viable: boolean;
  key_insights: string[];
  risks: string[];
}

function StrategyAnalysisTable({ analyses }: { analyses: StrategyAnalysis[] }) {
  // Find best strategy
  const bestStrategy = analyses
    .filter(a => a.viable)
    .sort((a, b) => b.roi - a.roi)[0];
  
  // Calculate rating (⭐) based on ROI
  const getRating = (roi: number): string => {
    if (roi >= 20) return '⭐⭐⭐⭐⭐';
    if (roi >= 15) return '⭐⭐⭐⭐';
    if (roi >= 10) return '⭐⭐⭐';
    if (roi >= 5) return '⭐⭐';
    return '⭐';
  };
  
  return (
    <table>
      <thead>
        <tr>
          <th>Strategy</th>
          <th>ROI</th>
          <th>Income</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>
        {analyses.map(analysis => (
          <tr 
            key={analysis.strategy}
            className={analysis === bestStrategy ? 'highlight' : ''}
          >
            <td>
              {getStrategyIcon(analysis.strategy)} {analysis.strategy}
              {analysis === bestStrategy && <Badge>Best</Badge>}
            </td>
            <td>{analysis.roi}%</td>
            <td>
              {analysis.strategy === 'flip' 
                ? `$${analysis.monthly_income.toLocaleString()}`
                : `$${analysis.monthly_income.toLocaleString()}/mo`
              }
            </td>
            <td>{getRating(analysis.roi)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

### Feature 3: Basic Dashboard

#### Visual Design
```
┌─────────────────────────────────────────────────────────┐
│ JEDI RE        Dashboard                   [User Menu]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐          │
│  │ 💰 Value  │  │ 📊 Deals  │  │ 🔔 Alerts │          │
│  │           │  │           │  │           │          │
│  │ $847,000  │  │    12     │  │     3     │          │
│  │ ▲ +8.5%   │  │  active   │  │  active   │          │
│  └───────────┘  └───────────┘  └───────────┘          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎯 Top Opportunities                            │   │
│  │                                                 │   │
│  │ 1. 847 Peachtree St - $450k | 28% Flip ROI     │   │
│  │    [View Property]                              │   │
│  │                                                 │   │
│  │ 2. 234 Monroe Dr - $380k | 24% Flip ROI        │   │
│  │    [View Property]                              │   │
│  │                                                 │   │
│  │ 3. 912 Highland Ave - $420k | 18% Airbnb ROI   │   │
│  │    [View Property]                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────┐  ┌─────────────────────────┐     │
│  │ 📅 Today's Tasks │  │ 📬 Recent Activity      │     │
│  │                  │  │                         │     │
│  │ ☐ Review 847...  │  │ • 847 Peachtree         │     │
│  │ ☐ Call seller   │  │   analyzed (10 min ago) │     │
│  │ ☑ Check comps   │  │ • New alert match       │     │
│  │                  │  │   (1 hour ago)          │     │
│  │ [+ Add Task]     │  │ • Price drop: Oak Park  │     │
│  └──────────────────┘  │   (2 hours ago)         │     │
│                        └─────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

#### Component Structure
```typescript
<DashboardView>
  <DashboardHeader>
    <Title>Dashboard</Title>
    <DateRange />
  </DashboardHeader>
  
  <KPIRow>
    <KPICard 
      title="Portfolio Value"
      value="$847,000"
      change="+8.5%"
      icon="💰"
    />
    <KPICard 
      title="Active Deals"
      value={12}
      subtitle="in pipeline"
      icon="📊"
    />
    <KPICard 
      title="Active Alerts"
      value={3}
      subtitle="monitoring"
      icon="🔔"
    />
  </KPIRow>
  
  <TopOpportunitiesPanel>
    {opportunities.map(opp => (
      <OpportunityCard key={opp.id} opportunity={opp} />
    ))}
  </TopOpportunitiesPanel>
  
  <BottomRow>
    <TodaysTasksPanel tasks={tasks} />
    <RecentActivityPanel activities={activities} />
  </BottomRow>
</DashboardView>
```

#### Data Sources

**Portfolio Value KPI:**
```typescript
// Calculate from user's saved properties
const portfolioValue = savedProperties.reduce((sum, prop) => {
  return sum + (prop.current_value || prop.purchase_price || 0);
}, 0);

// Calculate change from last month
const lastMonthValue = savedProperties.reduce((sum, prop) => {
  return sum + (prop.value_last_month || prop.purchase_price || 0);
}, 0);

const changePercent = ((portfolioValue - lastMonthValue) / lastMonthValue) * 100;
```

**Top Opportunities:**
```typescript
// Query properties user has viewed/saved
// Sort by opportunity score (composite of ROI, confidence, market timing)
const opportunities = await db.query(`
  SELECT 
    p.*,
    sa.roi,
    sa.strategy,
    (sa.roi * sa.confidence * market_timing_score) as opportunity_score
  FROM properties p
  JOIN strategy_analyses sa ON p.id = sa.property_id
  JOIN user_properties up ON p.id = up.property_id
  WHERE up.user_id = $1
    AND up.relationship_type IN ('viewed', 'saved')
  ORDER BY opportunity_score DESC
  LIMIT 3
`);
```

**Today's Tasks:**
```typescript
// Simple task list stored in user preferences
interface Task {
  id: string;
  text: string;
  completed: boolean;
  property_id?: string;
  created_at: Date;
}

// User can add tasks manually or they're auto-generated:
// - "Review [property]" when new match found
// - "Follow up on [property]" 3 days after viewing
```

**Recent Activity:**
```typescript
// Activity feed from multiple sources
type Activity = 
  | { type: 'property_analyzed', property_id: string, timestamp: Date }
  | { type: 'alert_match', alert_id: string, property_id: string, timestamp: Date }
  | { type: 'price_change', property_id: string, old_price: number, new_price: number, timestamp: Date }
  | { type: 'property_saved', property_id: string, timestamp: Date };

// Fetch last 10 activities
const activities = await db.query(`
  SELECT * FROM activities
  WHERE user_id = $1
  ORDER BY timestamp DESC
  LIMIT 10
`);
```

---

### Feature 4: Module Management (Settings)

#### Visual Design
```
┌─────────────────────────────────────────────────────────┐
│ JEDI RE        Settings                    [User Menu]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🤖 AI Module Management                                │
│                                                         │
│  Your Plan: PRO ($149/month)                            │
│  [Upgrade to Enterprise] [View Plans]                   │
│                                                         │
│  Active Modules:                                        │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │ 🔍 Property Search Agent                      │     │
│  │ Find properties matching your criteria        │     │
│  │ [🟢 Active] [Settings]                        │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │ 📊 Strategy Arbitrage Agent                   │     │
│  │ Analyze all investment strategies             │     │
│  │ [🟢 Active] [Settings]                        │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │ 🔔 Deal Tracker Agent                         │     │
│  │ Monitor properties and send alerts            │     │
│  │ [🟢 Active] [Settings]                        │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  Available with Enterprise:                             │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │ 💼 Portfolio Manager Agent            [🔒]   │     │
│  │ Optimize your property portfolio              │     │
│  │ [Upgrade to Unlock]                           │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  Module Usage (this month):                             │
│  • Strategy analyses: 47/200 (23%)                      │
│  • Property searches: 89/500 (18%)                      │
│  • Active alerts: 12/20 (60%)                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Module Configuration

```typescript
interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'basic' | 'pro' | 'enterprise';
  enabled: boolean;
  usage_limits: {
    metric: string;
    used: number;
    limit: number;
  }[];
}

const AVAILABLE_MODULES: Module[] = [
  {
    id: 'property_search',
    name: 'Property Search Agent',
    description: 'Find properties matching your criteria',
    icon: '🔍',
    tier: 'basic',
    enabled: true,
    usage_limits: [
      { metric: 'searches_per_month', used: 89, limit: 500 },
    ],
  },
  {
    id: 'strategy_arbitrage',
    name: 'Strategy Arbitrage Agent',
    description: 'Analyze all investment strategies',
    icon: '📊',
    tier: 'pro',
    enabled: true,
    usage_limits: [
      { metric: 'analyses_per_month', used: 47, limit: 200 },
    ],
  },
  {
    id: 'deal_tracker',
    name: 'Deal Tracker Agent',
    description: 'Monitor properties and send alerts',
    icon: '🔔',
    tier: 'basic',
    enabled: true,
    usage_limits: [
      { metric: 'active_alerts', used: 12, limit: 20 },
    ],
  },
  {
    id: 'portfolio_manager',
    name: 'Portfolio Manager Agent',
    description: 'Optimize your property portfolio',
    icon: '💼',
    tier: 'enterprise',
    enabled: false,
    usage_limits: [],
  },
];
```

#### Toggle Module Logic

```typescript
function ModuleCard({ module, userTier }: { module: Module; userTier: string }) {
  const canUse = TIER_LEVELS[userTier] >= TIER_LEVELS[module.tier];
  const { toggleModule } = useModuleStore();
  
  const handleToggle = async () => {
    if (!canUse) {
      // Show upgrade modal
      showUpgradeModal(module.tier);
      return;
    }
    
    // Toggle module
    await toggleModule(module.id, !module.enabled);
    
    // Show confirmation
    toast.success(
      module.enabled 
        ? `${module.name} deactivated` 
        : `${module.name} activated`
    );
  };
  
  return (
    <div className={`module-card ${!canUse ? 'locked' : ''}`}>
      <div className="module-header">
        <span className="module-icon">{module.icon}</span>
        <h3>{module.name}</h3>
        {!canUse && <LockIcon />}
      </div>
      
      <p className="module-description">{module.description}</p>
      
      {canUse ? (
        <Switch
          checked={module.enabled}
          onChange={handleToggle}
          label={module.enabled ? 'Active' : 'Inactive'}
        />
      ) : (
        <Button onClick={handleToggle}>
          Upgrade to {module.tier}
        </Button>
      )}
      
      {/* Usage limits */}
      {module.enabled && module.usage_limits.map(limit => (
        <UsageBar
          key={limit.metric}
          label={limit.metric}
          used={limit.used}
          limit={limit.limit}
        />
      ))}
    </div>
  );
}
```

---

## Technical Architecture

### Tech Stack

**Frontend:**
- React 18 (UI framework)
- TypeScript (type safety)
- Vite (build tool, fast HMR)
- TailwindCSS (styling)
- Zustand (state management)
- React Query (API caching/fetching)
- React Router v6 (routing)
- Socket.io Client (real-time)
- Mapbox GL JS (maps)

**Backend:**
- FastAPI (Python API framework)
- PostgreSQL 15 (database)
- PostGIS (geospatial extension)
- Redis (caching, task queue)
- Celery (background tasks)
- Socket.io Server (real-time)
- Anthropic Claude API (AI agent intelligence)

**Infrastructure:**
- Docker + Docker Compose (local dev)
- Replit (MVP hosting)
- Vercel/Netlify (frontend, Phase 2)
- AWS/GCP (backend, Phase 2)

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   USER BROWSER                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  React App (Vite)                                │  │
│  │  • Components                                    │  │
│  │  • Zustand Store (state)                         │  │
│  │  • React Query (API cache)                       │  │
│  │  • Socket.io Client (WebSocket)                  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS (REST)
                     │ WSS (WebSocket)
                     │
┌────────────────────┼────────────────────────────────────┐
│              API GATEWAY LAYER                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  FastAPI Server                                  │  │
│  │  • Authentication (JWT)                          │  │
│  │  • Rate Limiting                                 │  │
│  │  • Request Validation                            │  │
│  │  • WebSocket Handler                             │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────────┐ ┌────────────┐ ┌────────────────┐
│ ORCHESTRATOR │ │ SPECIALIST │ │ DATA LAYER     │
│              │ │ AGENTS     │ │                │
│ • Intent     │ │            │ │ • PostgreSQL   │
│   classify   │ │ • Property │ │   + PostGIS    │
│ • Route      │ │   Search   │ │                │
│ • Quality    │ │ • Strategy │ │ • Redis        │
│   control    │ │   Arbitrage│ │   (cache)      │
│              │ │ • Deal     │ │                │
│              │ │   Tracker  │ │ • Celery       │
│              │ │            │ │   (tasks)      │
└──────────────┘ └────────────┘ └────────────────┘
        │            │                    │
        └────────────┼────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ INTELLIGENCE ENGINES   │
        │                        │
        │ • Zoning Rules Engine  │
        │ • ROI Calculator       │
        │ • Market Analyzer      │
        │ • Opportunity Scorer   │
        └────────────────────────┘
```

### Request Flow Example

**User Action:** "Find 2br in Midtown under $500k"

```
1. User types in ChatInput
   └─> ChatOverlay component

2. Message sent via Socket.io
   └─> WebSocket connection to backend

3. Backend receives message
   └─> FastAPI WebSocket handler

4. Route to Chief Orchestrator
   └─> Parses intent: "property_search"
   └─> Extracts params: {location: "Midtown", bedrooms: 2, max_price: 500000}

5. Orchestrator routes to Property Search Agent
   └─> Agent queries database (PostgreSQL + PostGIS)
   └─> Applies filters, spatial search
   └─> Ranks by opportunity score

6. Results returned (23 properties)
   └─> WebSocket sends update to frontend
   └─> Frontend updates Zustand store
   └─> Map re-renders with markers
   └─> Property cards appear in chat

Total time: <5 seconds
```

---

## Component Hierarchy

### Complete Component Tree

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
│       │   ├── NavItem (×9)
│       │   └── CollapseButton
│       │
│       ├── TopBar
│       │   ├── GlobalSearch
│       │   ├── NotificationBell
│       │   └── UserMenu
│       │
│       └── ContentArea
│           │
│           ├── MapView (Route: /map) ✅ MVP
│           │   ├── MapboxMap
│           │   │   ├── PropertyMarkers
│           │   │   ├── PropertyCluster
│           │   │   └── MapControls
│           │   │       ├── ZoomControl
│           │   │       ├── LayerControl
│           │   │       └── GeolocationControl
│           │   │
│           │   ├── ChatOverlay
│           │   │   ├── ChatHeader
│           │   │   │   ├── AgentAvatar
│           │   │   │   ├── AgentStatus
│           │   │   │   └── MinimizeButton
│           │   │   │
│           │   │   ├── MessageList
│           │   │   │   ├── ChatMessage (×N)
│           │   │   │   │   ├── Avatar
│           │   │   │   │   ├── MessageBubble
│           │   │   │   │   └── Timestamp
│           │   │   │   │
│           │   │   │   └── TypingIndicator
│           │   │   │
│           │   │   ├── PropertyCardsRow
│           │   │   │   └── PropertyCard (×3)
│           │   │   │       ├── PropertyImage
│           │   │   │       ├── PropertyInfo
│           │   │   │       ├── StrategyBadge
│           │   │   │       └── ActionButtons
│           │   │   │
│           │   │   └── ChatInput
│           │   │       ├── TextInput
│           │   │       ├── VoiceButton
│           │   │       └── SendButton
│           │   │
│           │   └── AgentStatusBar
│           │       └── AgentTask (×N)
│           │           ├── AgentName
│           │           ├── ProgressBar
│           │           └── StatusIcon
│           │
│           ├── PropertyDetailPage (Route: /property/:id) ✅ MVP
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
│           │   │   │   │   └── NavigationArrows
│           │   │   │   │
│           │   │   │   ├── LocationMap
│           │   │   │   │   └── MiniMap
│           │   │   │   │
│           │   │   │   └── PropertyDetails
│           │   │   │       ├── DetailRow (×N)
│           │   │   │       └── ExpandButton
│           │   │   │
│           │   │   └── RightColumn
│           │   │       ├── PropertySummaryCard
│           │   │       │   ├── Price
│           │   │       │   ├── BasicInfo
│           │   │       │   ├── BestStrategyBadge
│           │   │       │   └── ActionButtons
│           │   │       │       ├── ContactButton
│           │   │       │       └── ShowingButton
│           │   │       │
│           │   │       ├── StrategyAnalysisTable
│           │   │       │   ├── TableHeader
│           │   │       │   ├── StrategyRow (×4)
│           │   │       │   │   ├── StrategyIcon
│           │   │       │   │   ├── StrategyName
│           │   │       │   │   ├── ROI
│           │   │       │   │   ├── Income
│           │   │       │   │   └── Rating
│           │   │       │   │
│           │   │       │   └── DetailButton
│           │   │       │
│           │   │       └── AIInsightsPanel
│           │   │           ├── InsightItem (×N)
│           │   │           │   ├── Icon (✓ or ⚠)
│           │   │           │   └── Text
│           │   │           │
│           │   │           └── ExpandButton
│           │   │
│           │   └── LoadingState
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
│           ├── DashboardView (Route: /dashboard) ✅ MVP
│           │   ├── DashboardHeader
│           │   │   ├── Title
│           │   │   └── DateRange
│           │   │
│           │   ├── KPIRow
│           │   │   ├── KPICard (Portfolio Value)
│           │   │   │   ├── Icon
│           │   │   │   ├── Value
│           │   │   │   ├── ChangeIndicator
│           │   │   │   └── Sparkline
│           │   │   │
│           │   │   ├── KPICard (Active Deals)
│           │   │   └── KPICard (Active Alerts)
│           │   │
│           │   ├── TopOpportunitiesPanel
│           │   │   ├── PanelHeader
│           │   │   └── OpportunityCard (×3)
│           │   │       ├── PropertyImage
│           │   │       ├── Address
│           │   │       ├── Metrics
│           │   │       └── ViewButton
│           │   │
│           │   └── BottomRow
│           │       ├── TodaysTasksPanel
│           │       │   ├── PanelHeader
│           │       │   ├── TaskItem (×N)
│           │       │   │   ├── Checkbox
│           │       │   │   ├── TaskText
│           │       │   │   └── DeleteButton
│           │       │   │
│           │       │   └── AddTaskButton
│           │       │
│           │       └── RecentActivityPanel
│           │           ├── PanelHeader
│           │           └── ActivityItem (×N)
│           │               ├── ActivityIcon
│           │               ├── ActivityText
│           │               └── Timestamp
│           │
│           └── SettingsView (Route: /settings) ✅ MVP
│               ├── SettingsTabs
│               │   ├── TabButton (Modules) [active]
│               │   └── TabButton (Profile) [Phase 2]
│               │
│               └── ModulesPanel
│                   ├── PlanSummary
│                   │   ├── CurrentTier
│                   │   ├── Price
│                   │   └── UpgradeButton
│                   │
│                   ├── ActiveModulesSection
│                   │   └── ModuleCard (×3)
│                   │       ├── ModuleHeader
│                   │       │   ├── Icon
│                   │       │   ├── Name
│                   │       │   └── Tier Badge
│                   │       │
│                   │       ├── Description
│                   │       ├── ToggleSwitch
│                   │       └── UsageBar
│                   │
│                   └── LockedModulesSection
│                       └── ModuleCard (Portfolio Manager)
│                           ├── LockIcon
│                           └── UpgradeButton
│
├── Shared Components
│   ├── Button
│   │   ├── PrimaryButton
│   │   ├── SecondaryButton
│   │   ├── GhostButton
│   │   └── DangerButton
│   │
│   ├── Input
│   │   ├── TextInput
│   │   ├── NumberInput
│   │   ├── SelectInput
│   │   └── SearchInput
│   │
│   ├── Card
│   │   ├── CardHeader
│   │   ├── CardBody
│   │   └── CardFooter
│   │
│   ├── Modal
│   │   ├── ModalHeader
│   │   ├── ModalBody
│   │   └── ModalFooter
│   │
│   ├── Badge
│   ├── Spinner
│   ├── ProgressBar
│   ├── Toast
│   ├── Tooltip
│   ├── Switch
│   └── ErrorBoundary
│
└── Providers
    ├── AuthProvider
    ├── WebSocketProvider
    ├── QueryClientProvider (React Query)
    └── ThemeProvider
```

### Component Priority for Development

**Week 1: Map + Chat (Core)**
1. MapboxMap ⭐⭐⭐
2. PropertyMarkers ⭐⭐⭐
3. ChatOverlay ⭐⭐⭐
4. MessageList ⭐⭐⭐
5. ChatInput ⭐⭐⭐
6. PropertyCard ⭐⭐⭐
7. AgentStatusBar ⭐⭐
8. Shared: Button, Input, Spinner ⭐⭐⭐

**Week 2: Property Detail**
9. PropertyDetailPage ⭐⭐⭐
10. PhotoCarousel ⭐⭐
11. StrategyAnalysisTable ⭐⭐⭐
12. AIInsightsPanel ⭐⭐⭐
13. PropertySummaryCard ⭐⭐
14. Shared: Card, Badge, Modal ⭐⭐

**Week 3: Dashboard**
15. DashboardView ⭐⭐
16. KPICard ⭐⭐
17. TopOpportunitiesPanel ⭐⭐
18. TodaysTasksPanel ⭐
19. RecentActivityPanel ⭐
20. Shared: ProgressBar, Switch ⭐⭐

**Week 4: Settings + Polish**
21. SettingsView ⭐⭐
22. ModuleCard ⭐⭐
23. ErrorBoundary ⭐⭐⭐
24. Loading Skeletons ⭐⭐
25. Toast notifications ⭐⭐
26. Final polish & bug fixes ⭐⭐⭐

---

## API Contracts

### Base Configuration

```typescript
// API client configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

// Axios instance with interceptors
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (add auth token)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor (handle errors)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Authentication Endpoints

```typescript
// POST /api/v1/auth/signup
interface SignupRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

interface SignupResponse {
  token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    subscription_tier: 'basic' | 'pro' | 'enterprise';
    active_modules: string[];
  };
}

// POST /api/v1/auth/login
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  refresh_token: string;
  user: User;
}

// GET /api/v1/auth/me
interface MeResponse {
  user: User;
}

// Example usage
async function login(email: string, password: string): Promise<User> {
  const response = await apiClient.post<LoginResponse>('/auth/login', {
    email,
    password,
  });
  
  localStorage.setItem('auth_token', response.data.token);
  localStorage.setItem('refresh_token', response.data.refresh_token);
  
  return response.data.user;
}
```

### Property Endpoints

```typescript
// GET /api/v1/properties
interface PropertySearchRequest {
  city?: string;
  state?: string;
  neighborhood?: string;
  max_price?: number;
  min_price?: number;
  bedrooms_min?: number;
  bedrooms_max?: number;
  bathrooms_min?: number;
  sqft_min?: number;
  sqft_max?: number;
  property_type?: string[];
  strategy?: 'rental' | 'airbnb' | 'flip' | 'build_to_sell';
  min_roi?: number;
  limit?: number;
  offset?: number;
}

interface PropertySearchResponse {
  properties: Property[];
  total: number;
  page: number;
  limit: number;
}

// GET /api/v1/properties/:id
interface PropertyDetailResponse {
  property: Property;
  strategy_analyses: StrategyAnalysis[];
  ai_insights: AIInsight[];
}

// POST /api/v1/properties/:id/save
interface SavePropertyRequest {
  notes?: string;
  tags?: string[];
}

interface SavePropertyResponse {
  success: boolean;
  message: string;
}

// Example usage with React Query
function usePropertySearch(filters: PropertySearchRequest) {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: async () => {
      const response = await apiClient.get<PropertySearchResponse>(
        '/properties',
        { params: filters }
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Strategy Analysis Endpoints

```typescript
// POST /api/v1/analysis/strategy
interface StrategyAnalysisRequest {
  property_id: string;
  strategies?: ('rental' | 'airbnb' | 'flip' | 'build_to_sell')[];
  force_refresh?: boolean;
}

interface StrategyAnalysisResponse {
  analyses: StrategyAnalysis[];
  analyzed_at: string;
  cache_hit: boolean;
}

// GET /api/v1/analysis/:id
interface AnalysisDetailResponse {
  analysis: StrategyAnalysis;
  detailed_breakdown: {
    income_sources: { source: string; amount: number }[];
    expense_breakdown: { category: string; amount: number }[];
    assumptions: { key: string; value: any }[];
  };
}

// Example usage
function useStrategyAnalysis(propertyId: string) {
  return useQuery({
    queryKey: ['strategy_analysis', propertyId],
    queryFn: async () => {
      const response = await apiClient.post<StrategyAnalysisResponse>(
        '/analysis/strategy',
        { property_id: propertyId, strategies: ['all'] }
      );
      return response.data.analyses;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours (analyses don't change often)
  });
}
```

### Chat/Agent Endpoints

```typescript
// POST /api/v1/chat/message
interface ChatMessageRequest {
  message: string;
  conversation_id?: string;
  context?: {
    current_page?: string;
    selected_property_id?: string;
    filters?: any;
  };
}

interface ChatMessageResponse {
  message_id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  agent_name?: string;
  metadata?: {
    properties?: Property[];
    suggested_actions?: string[];
    visualizations?: any;
  };
  conversation_id: string;
}

// GET /api/v1/chat/conversations/:id
interface ConversationResponse {
  conversation: {
    id: string;
    started_at: string;
    last_message_at: string;
  };
  messages: ChatMessageResponse[];
}

// Example usage with mutation
function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: ChatMessageRequest) => {
      const response = await apiClient.post<ChatMessageResponse>(
        '/chat/message',
        request
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate conversations query to refetch
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
```

### Alert Endpoints

```typescript
// GET /api/v1/alerts
interface AlertListResponse {
  alerts: Alert[];
  total: number;
}

// POST /api/v1/alerts
interface CreateAlertRequest {
  alert_name: string;
  criteria: {
    location?: string;
    max_price?: number;
    bedrooms?: number;
    strategy?: string;
    min_roi?: number;
  };
  triggers: {
    new_listings?: boolean;
    price_drops?: boolean;
    opportunity_score_min?: number;
  };
  notification_channels: ('email' | 'sms' | 'push')[];
}

interface CreateAlertResponse {
  alert: Alert;
  matching_properties_count: number;
}

// PATCH /api/v1/alerts/:id
interface UpdateAlertRequest {
  active?: boolean;
  criteria?: any;
  triggers?: any;
}

// DELETE /api/v1/alerts/:id
interface DeleteAlertResponse {
  success: boolean;
  message: string;
}

// GET /api/v1/alerts/:id/matches
interface AlertMatchesResponse {
  matches: {
    property: Property;
    matched_at: string;
    match_score: number;
  }[];
  total: number;
}
```

### WebSocket Events

```typescript
// Client → Server events
type ClientEvents = {
  'chat:message': (data: { message: string; conversation_id?: string }) => void;
  'property:subscribe': (property_id: string) => void;
  'property:unsubscribe': (property_id: string) => void;
};

// Server → Client events
type ServerEvents = {
  'agent:task_update': (data: {
    task_id: string;
    agent_name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    message?: string;
  }) => void;
  
  'agent:message': (data: ChatMessageResponse) => void;
  
  'map:update': (data: {
    action: 'highlight_properties' | 'update_marker' | 'add_layer';
    property_ids?: string[];
    color?: string;
    metadata?: any;
  }) => void;
  
  'alert:match': (data: {
    alert_id: string;
    property: Property;
    match_score: number;
  }) => void;
  
  'property:update': (data: {
    property_id: string;
    field: string;
    old_value: any;
    new_value: any;
  }) => void;
};

// Usage example
function useChatAgent() {
  const { socket } = useWebSocket();
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('agent:message', (data) => {
      setMessages(prev => [...prev, data]);
    });
    
    socket.on('agent:task_update', (data) => {
      // Update agent status bar
      console.log(`${data.agent_name}: ${data.progress}%`);
    });
    
    return () => {
      socket.off('agent:message');
      socket.off('agent:task_update');
    };
  }, [socket]);
  
  const sendMessage = (message: string) => {
    socket?.emit('chat:message', { message });
  };
  
  return { messages, sendMessage };
}
```

---

## Data Model

### Database Schema (PostgreSQL + PostGIS)

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    subscription_tier VARCHAR(50) DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
    active_modules JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Properties table
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    price DECIMAL(12, 2),
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    sqft INTEGER,
    lot_size INTEGER,
    year_built INTEGER,
    property_type VARCHAR(50) CHECK (property_type IN ('single_family', 'condo', 'townhouse', 'multi_family', 'land')),
    listing_status VARCHAR(50) DEFAULT 'active' CHECK (listing_status IN ('active', 'pending', 'sold', 'off_market')),
    listing_date DATE,
    mls_number VARCHAR(100),
    geom GEOMETRY(POINT, 4326),  -- PostGIS for spatial queries
    photos TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_bedrooms ON properties(bedrooms);
CREATE INDEX idx_properties_geom ON properties USING GIST(geom);
CREATE INDEX idx_properties_listing_status ON properties(listing_status);

-- Strategy analyses table
CREATE TABLE strategy_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    strategy VARCHAR(50) NOT NULL CHECK (strategy IN ('rental', 'airbnb', 'flip', 'build_to_sell')),
    roi DECIMAL(5, 2),
    monthly_income DECIMAL(12, 2),
    estimated_expenses DECIMAL(12, 2),
    net_cash_flow DECIMAL(12, 2),
    confidence DECIMAL(3, 2),
    viable BOOLEAN DEFAULT true,
    analysis_details JSONB DEFAULT '{}'::jsonb,
    key_insights TEXT[],
    risks TEXT[],
    analyzed_at TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX idx_strategy_analyses_property ON strategy_analyses(property_id);
CREATE INDEX idx_strategy_analyses_strategy ON strategy_analyses(strategy);
CREATE INDEX idx_strategy_analyses_roi ON strategy_analyses(roi DESC);
CREATE INDEX idx_strategy_analyses_valid ON strategy_analyses(valid_until) WHERE valid_until > NOW();

-- User-property relationships (watchlist, viewed, saved)
CREATE TABLE user_properties (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('viewed', 'saved', 'watchlist')),
    notes TEXT,
    tags TEXT[],
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, property_id, relationship_type)
);

CREATE INDEX idx_user_properties_user ON user_properties(user_id);
CREATE INDEX idx_user_properties_property ON user_properties(property_id);
CREATE INDEX idx_user_properties_type ON user_properties(relationship_type);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_name VARCHAR(255) NOT NULL,
    criteria JSONB NOT NULL,
    triggers JSONB NOT NULL,
    notification_channels TEXT[] DEFAULT ARRAY['email'],
    active BOOLEAN DEFAULT true,
    last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_active ON alerts(active) WHERE active = true;

-- Alert matches table
CREATE TABLE alert_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    match_score DECIMAL(3, 2),
    matched_at TIMESTAMP DEFAULT NOW(),
    notified BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP
);

CREATE INDEX idx_alert_matches_alert ON alert_matches(alert_id);
CREATE INDEX idx_alert_matches_property ON alert_matches(property_id);
CREATE INDEX idx_alert_matches_notified ON alert_matches(notified) WHERE notified = false;

-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW(),
    context JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_conversations_user ON conversations(user_id);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'agent', 'system')),
    content TEXT NOT NULL,
    agent_name VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Activities table (for dashboard feed)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);

-- Tasks table (for dashboard)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    due_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_completed ON tasks(completed) WHERE completed = false;
```

### TypeScript Type Definitions

```typescript
// User types
interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  subscription_tier: 'basic' | 'pro' | 'enterprise';
  active_modules: string[];
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Property types
interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  lot_size?: number;
  year_built?: number;
  property_type: 'single_family' | 'condo' | 'townhouse' | 'multi_family' | 'land';
  listing_status: 'active' | 'pending' | 'sold' | 'off_market';
  listing_date?: string;
  mls_number?: string;
  lat: number;
  lng: number;
  photos: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Strategy analysis types
interface StrategyAnalysis {
  id: string;
  property_id: string;
  strategy: 'rental' | 'airbnb' | 'flip' | 'build_to_sell';
  roi: number;
  monthly_income: number;
  estimated_expenses: number;
  net_cash_flow: number;
  confidence: number;
  viable: boolean;
  analysis_details: {
    assumptions?: Record<string, any>;
    income_sources?: { source: string; amount: number }[];
    expense_breakdown?: { category: string; amount: number }[];
  };
  key_insights: string[];
  risks: string[];
  analyzed_at: string;
  valid_until: string;
}

// Alert types
interface Alert {
  id: string;
  user_id: string;
  alert_name: string;
  criteria: {
    location?: string;
    max_price?: number;
    bedrooms?: number;
    strategy?: string;
    min_roi?: number;
  };
  triggers: {
    new_listings?: boolean;
    price_drops?: boolean;
    opportunity_score_min?: number;
  };
  notification_channels: ('email' | 'sms' | 'push')[];
  active: boolean;
  last_checked?: string;
  created_at: string;
  updated_at: string;
}

// Message types
interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  agent_name?: string;
  metadata?: {
    properties?: Property[];
    suggested_actions?: string[];
  };
  created_at: string;
}

// Agent task types
interface AgentTask {
  id: string;
  agent_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress_current: number;
  progress_total: number;
  message?: string;
  started_at: string;
  completed_at?: string;
}
```

---

## Development Plan

### 4-Week Sprint Breakdown

#### **Week 1: Core Infrastructure + Map View**

**Days 1-2: Project Setup**
- Initialize Vite + React + TypeScript project
- Install dependencies (Zustand, React Query, Mapbox, Socket.io)
- Configure TailwindCSS
- Set up folder structure
- Create design system (colors, typography)
- Set up ESLint + Prettier
- Configure environment variables

**Days 3-4: Map View**
- Implement Mapbox integration
- Create PropertyMarker component
- Add marker clustering
- Implement map controls (zoom, layers)
- Add property card slide-up on marker click
- Test with mock data

**Day 5: Chat Overlay (Basic)**
- Create ChatOverlay component
- Implement floating/expanded states
- Add MessageList component
- Create ChatInput component
- Add mock message flow (no backend yet)

**Weekend: Buffer**

**Deliverable:** Map view with markers, chat UI (frontend only)

---

#### **Week 2: Backend Integration + Property Search**

**Days 1-2: Backend API Setup**
- Set up FastAPI project
- Configure PostgreSQL + PostGIS
- Create database schema
- Implement authentication (JWT)
- Create property search endpoint
- Test with Postman

**Days 3-4: Agent Integration**
- Implement Chief Orchestrator (basic intent classification)
- Create Property Search Agent
- Connect frontend to backend API
- Implement WebSocket connection
- Add agent status bar
- Test end-to-end property search

**Day 5: Property Cards**
- Display search results as property cards in chat
- Implement property card click → navigate to detail page
- Add save/watchlist functionality
- Loading states + error handling

**Deliverable:** Working property search from chat to map

---

#### **Week 3: Property Detail + Strategy Analysis**

**Days 1-2: Property Detail Page**
- Create property detail layout
- Implement photo carousel
- Add property information display
- Create location mini-map
- Add save/share buttons

**Days 3-4: Strategy Analysis**
- Implement Strategy Arbitrage Agent (backend)
- Create ROI calculator logic
- Build strategy analysis table component
- Add AI insights panel
- Display all 4 strategies side-by-side

**Day 5: Analysis Polish**
- Add loading skeletons
- Implement error states
- Add detailed analysis modals
- Test with various property types

**Deliverable:** Complete property detail page with analysis

---

#### **Week 4: Dashboard + Settings + Launch Prep**

**Days 1-2: Dashboard**
- Create dashboard layout
- Implement KPI cards (portfolio value, active deals, alerts)
- Build top opportunities panel
- Add today's tasks section
- Create recent activity feed

**Days 3: Settings (Module Management)**
- Create settings page
- Build module management UI
- Implement module toggle logic
- Add usage tracking display
- Create upgrade prompts

**Day 4: Alerts System**
- Implement Deal Tracker Agent (backend)
- Create alert via chat
- Add alert management UI in settings
- Test email notifications

**Day 5: Final Polish + Testing**
- Fix bugs
- Add loading states everywhere
- Implement error boundaries
- Accessibility audit (ARIA labels)
- Performance optimization
- User acceptance testing

**Weekend: Deploy to Replit**

**Deliverable:** MVP ready for launch 🚀

---

### Daily Standups

**Format:**
- What did I accomplish yesterday?
- What will I work on today?
- Are there any blockers?

**Tool:** Update PROJECT_TRACKER.md daily

---

### Code Review Checkpoints

**End of Week 1:**
- Review map component architecture
- Check Mapbox performance
- Validate design system consistency

**End of Week 2:**
- Review API integration patterns
- Check WebSocket reliability
- Validate error handling

**End of Week 3:**
- Review property detail UX
- Check strategy analysis accuracy
- Validate data loading performance

**End of Week 4:**
- Final code review
- Security audit
- Performance profiling

---

## Testing Strategy

### Unit Testing

**Tools:** Vitest + React Testing Library

**Coverage Targets:**
- Utility functions: 100%
- API clients: 90%
- React components: 80%

**Priority Components to Test:**
1. PropertyCard
2. StrategyAnalysisTable
3. ChatInput
4. ModuleCard

**Example Test:**
```typescript
// PropertyCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyCard } from './PropertyCard';

describe('PropertyCard', () => {
  const mockProperty = {
    id: '123',
    address: '847 Peachtree St',
    price: 450000,
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1200,
    photos: ['photo1.jpg'],
  };

  it('renders property information correctly', () => {
    render(<PropertyCard property={mockProperty} />);
    
    expect(screen.getByText('847 Peachtree St')).toBeInTheDocument();
    expect(screen.getByText('$450,000')).toBeInTheDocument();
    expect(screen.getByText('2 bed')).toBeInTheDocument();
  });

  it('calls onSelect when View Details is clicked', () => {
    const onSelect = vi.fn();
    render(<PropertyCard property={mockProperty} onSelect={onSelect} />);
    
    fireEvent.click(screen.getByText('View Details'));
    expect(onSelect).toHaveBeenCalledWith(mockProperty.id);
  });

  it('shows skeleton when loading', () => {
    render(<PropertyCard property={mockProperty} loading />);
    
    expect(screen.getByTestId('property-card-skeleton')).toBeInTheDocument();
  });
});
```

---

### Integration Testing

**Tools:** Playwright

**Critical Flows to Test:**
1. **User signup → First search → View property**
2. **Create alert → Receive notification**
3. **Search properties → View on map → Click marker → View details**
4. **Save property → View in dashboard**

**Example Test:**
```typescript
// property-search.spec.ts
import { test, expect } from '@playwright/test';

test('user can search for properties and view details', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait for map to load
  await expect(page.locator('.mapboxgl-map')).toBeVisible();

  // Open chat
  await page.click('button[aria-label="Open chat"]');

  // Type search query
  await page.fill('input[placeholder="Ask me anything..."]', 'Find 2br in Midtown under $500k');
  await page.press('input[placeholder="Ask me anything..."]', 'Enter');

  // Wait for agent response
  await expect(page.locator('text=Found')).toBeVisible({ timeout: 10000 });

  // Click first property card
  await page.click('.property-card:first-child');

  // Verify property detail page loaded
  await expect(page).toHaveURL(/\/property\//);
  await expect(page.locator('h1')).toContainText('Peachtree');
});
```

---

### Manual Testing Checklist

**Before Each Deploy:**

**Functionality:**
- [ ] User can sign up with email/password
- [ ] User can login with Google OAuth
- [ ] Map loads without errors
- [ ] User can search for properties via chat
- [ ] Property markers appear on map
- [ ] Clicking marker shows property card
- [ ] Property detail page loads
- [ ] Strategy analysis displays correctly
- [ ] User can save properties
- [ ] Dashboard shows correct KPIs
- [ ] Alerts can be created
- [ ] Module toggles work
- [ ] WebSocket reconnects after disconnect

**UI/UX:**
- [ ] All loading states display
- [ ] Error states show helpful messages
- [ ] Buttons have hover states
- [ ] Forms validate input
- [ ] Chat scrolls to bottom on new message
- [ ] Map markers cluster at low zoom
- [ ] Property cards are readable on mobile
- [ ] Dashboard is responsive

**Performance:**
- [ ] Map loads in <2 seconds
- [ ] Property search completes in <5 seconds
- [ ] No console errors
- [ ] No memory leaks (check DevTools)
- [ ] Smooth zoom/pan on map
- [ ] Images load progressively

**Accessibility:**
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes
- [ ] Contrast ratios meet WCAG AA
- [ ] Focus indicators visible
- [ ] ARIA labels present

---

## Launch Checklist

### Pre-Launch (Week 4)

**Code:**
- [ ] All tests passing
- [ ] No console errors/warnings
- [ ] Code reviewed
- [ ] Security audit completed
- [ ] Performance profiling done

**Infrastructure:**
- [ ] Environment variables configured
- [ ] Database backups enabled
- [ ] Monitoring set up (Sentry for errors)
- [ ] SSL certificate installed
- [ ] Domain DNS configured

**Content:**
- [ ] Landing page copy written
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Help documentation created
- [ ] Email templates designed

**Legal:**
- [ ] Privacy policy reviewed
- [ ] Terms of service reviewed
- [ ] GDPR compliance checked (if EU users)
- [ ] Data retention policy defined

### Launch Day

**Morning:**
- [ ] Final smoke test on production
- [ ] Database migrations run
- [ ] Monitoring dashboards open
- [ ] Support email configured
- [ ] Launch announcement drafted

**Launch:**
- [ ] Deploy to production
- [ ] Verify health checks pass
- [ ] Test signup flow
- [ ] Test property search
- [ ] Test WebSocket connection
- [ ] Monitor error rates

**Post-Launch:**
- [ ] Send launch announcement
- [ ] Monitor user signups
- [ ] Watch error logs
- [ ] Track performance metrics
- [ ] Respond to user feedback

### Week 1 Post-Launch

**Daily:**
- [ ] Review error logs
- [ ] Check user activity metrics
- [ ] Respond to support tickets
- [ ] Fix critical bugs
- [ ] Deploy hotfixes if needed

**Metrics to Track:**
- Signups per day
- Active users per day
- Average searches per user
- Property views per user
- Alert creation rate
- Error rate
- API response times
- WebSocket connection stability

---

## Appendix

### Folder Structure

```
jedire/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── shared/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   └── ErrorBoundary.tsx
│   │   │   │
│   │   │   ├── map/
│   │   │   │   ├── MapView.tsx
│   │   │   │   ├── MapboxMap.tsx
│   │   │   │   ├── PropertyMarker.tsx
│   │   │   │   ├── PropertyCluster.tsx
│   │   │   │   └── MapControls.tsx
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   ├── ChatOverlay.tsx
│   │   │   │   ├── ChatHeader.tsx
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── ChatMessage.tsx
│   │   │   │   └── ChatInput.tsx
│   │   │   │
│   │   │   ├── property/
│   │   │   │   ├── PropertyCard.tsx
│   │   │   │   ├── PropertyDetailPage.tsx
│   │   │   │   ├── PhotoCarousel.tsx
│   │   │   │   ├── StrategyAnalysisTable.tsx
│   │   │   │   └── AIInsightsPanel.tsx
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardView.tsx
│   │   │   │   ├── KPICard.tsx
│   │   │   │   ├── TopOpportunitiesPanel.tsx
│   │   │   │   ├── TodaysTasksPanel.tsx
│   │   │   │   └── RecentActivityPanel.tsx
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── SettingsView.tsx
│   │   │       └── ModuleCard.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useAgents.ts
│   │   │   ├── useProperties.ts
│   │   │   └── useAlerts.ts
│   │   │
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   ├── mapStore.ts
│   │   │   ├── chatStore.ts
│   │   │   └── moduleStore.ts
│   │   │
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── properties.ts
│   │   │   ├── analysis.ts
│   │   │   ├── chat.ts
│   │   │   └── alerts.ts
│   │   │
│   │   ├── types/
│   │   │   ├── user.ts
│   │   │   ├── property.ts
│   │   │   ├── analysis.ts
│   │   │   ├── message.ts
│   │   │   └── alert.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── formatters.ts
│   │   │   ├── validators.ts
│   │   │   └── helpers.ts
│   │   │
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   │
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
│
└── backend/
    ├── app/
    │   ├── main.py
    │   ├── config.py
    │   ├── database.py
    │   │
    │   ├── models/
    │   │   ├── user.py
    │   │   ├── property.py
    │   │   ├── analysis.py
    │   │   └── alert.py
    │   │
    │   ├── agents/
    │   │   ├── orchestrator.py
    │   │   ├── property_search.py
    │   │   ├── strategy_arbitrage.py
    │   │   └── deal_tracker.py
    │   │
    │   ├── engines/
    │   │   ├── roi_calculator.py
    │   │   ├── zoning_rules.py
    │   │   └── market_analyzer.py
    │   │
    │   ├── api/
    │   │   ├── auth.py
    │   │   ├── properties.py
    │   │   ├── analysis.py
    │   │   ├── chat.py
    │   │   └── alerts.py
    │   │
    │   └── utils/
    │       ├── security.py
    │       └── helpers.py
    │
    ├── tests/
    ├── requirements.txt
    └── alembic/
        └── versions/
```

### Environment Variables

```bash
# Frontend (.env)
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Backend (.env)
DATABASE_URL=postgresql://user:password@localhost:5432/jedire
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key
ANTHROPIC_API_KEY=your_anthropic_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_email_password
```

---

## Success Definition

**MVP is successful if:**
1. 50+ active users in first month
2. Average 10+ searches per user per week
3. 30%+ of users create at least one alert
4. <5% error rate
5. Positive user feedback (qualitative)

**Ready for Phase 2 when:**
- Above metrics achieved
- Major bugs fixed
- User feedback collected
- Next features prioritized

---

**Document Version:** 1.0  
**Last Updated:** February 5, 2026  
**Status:** ✅ Ready for Development

---

*This is the single source of truth for JEDI RE MVP development. Update this document as decisions are made and scope changes.*
