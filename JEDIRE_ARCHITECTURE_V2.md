# JediRe Architecture V2
## The Map-Centric Real Estate Intelligence Platform

**Date:** February 1, 2026  
**Vision:** War mapping + collaborative intelligence + AI automation

**📐 Data Schema:** See `JEDI_DATA_SCHEMA.md` (v2.0) for complete data structures supporting all 8 engines + JEDI Score. This document is the **single source of truth** for all data models.

---

## Core Concept

**JediRe is NOT a property management tool.**  
**JediRe IS a map-based intelligence platform where:**
- Every deal is a map
- Every piece of intel gets pinned
- Teams collaborate on the same battlefield
- AI agents feed the war map automatically

---

## System Architecture

### 1. Multi-Map System

**User can create multiple maps:**
- "Austin Multifamily Acquisitions" (active deals)
- "Texas Land Bank" (long-term holds)
- "Market Research" (just tracking intel)
- "Client Portfolio" (properties to show investors)

**Map Structure:**
```typescript
interface Map {
  id: string;
  name: string;
  owner_user_id: string;
  shared_with: string[]; // Team member IDs
  map_type: 'acquisition' | 'portfolio' | 'research' | 'custom';
  created_at: Date;
  layers: Layer[];
  annotations: Annotation[];
}
```

**Map Switching:**
- Dropdown in header: "Current Map: Austin Multifamily"
- Quick switch between maps
- Each map = separate workspace

---

### 2. Collaborative Features

**Team Sharing:**
```typescript
interface MapCollaboration {
  map_id: string;
  permissions: {
    user_id: string;
    role: 'owner' | 'editor' | 'viewer';
    can_add_properties: boolean;
    can_edit_notes: boolean;
    can_share: boolean;
  }[];
  real_time_cursors: boolean; // See where teammates are looking
}
```

**Real-Time Collaboration:**
- WebSocket connection for live updates
- See teammate cursors on map (like Figma)
- "John is viewing 123 Main St"
- Instant pin updates
- Live annotation drawing

**Sharing Workflows:**
1. **Share Entire Map:** Invite team member to map
2. **Share Specific Property:** Send link to one deal
3. **Share Annotation:** Export drawing/note as image
4. **Share Report:** Generate PDF of map state

---

### 3. Interface Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [Map Selector ▾] [User] [Team] [Notifications 3]            │
├──────────────────────────────────────────────────────────────┤
│ [Emails] [News] [Consultants] [Financials] [Zoning] [Draw]  │ ← Modules (Toggle on/off)
├────────┬─────────────────────────────────────────────────────┤
│        │                                                      │
│ Email  │              MAP VIEW (Mapbox 3D)                   │
│ Side-  │                                                      │
│ bar    │   🟢 Property Pin                                   │
│        │   📰 News Pin                                       │
│ - New  │   👤 Consultant Pin                                 │
│   Deal │   🎨 User Drawing                                   │
│   (3)  │   📝 Note Pin                                       │
│        │   🏗️ 3D Zoning Visualization                        │
│ - Msg  │                                                      │
│   from │   [Pipeline Summary]                                │
│   Jen  │   New: 3 | Analysis: 5 | Offer: 2 | Closed: 1      │
│        │                                                      │
└────────┴──────────────────────────────────────────────────────┘
```

**Responsive Behavior:**
- Desktop: Sidebar + Map + Modules
- Mobile: Map-first, modules as bottom sheet

---

### 4. Pin Types & Data Model

```typescript
// Base pin interface
interface MapPin {
  id: string;
  map_id: string;
  type: 'property' | 'news' | 'consultant' | 'note' | 'drawing';
  lat: number;
  lng: number;
  created_at: Date;
  created_by: string;
}

// Property pin
interface PropertyPin extends MapPin {
  type: 'property';
  property_id: string;
  address: string;
  source: 'email' | 'manual' | 'ai_detected';
  pipeline_stage: 'new' | 'analysis' | 'offer' | 'due_diligence' | 'closed' | 'passed';
  deal_silo: {
    emails: Email[];
    news: NewsArticle[];
    consultants: ConsultantNote[];
    financials: FinancialModel[];
    zoning: ZoningData;
    tasks: Task[];
    notes: Note[];
  };
  color: string; // Based on stage
  status: 'active' | 'owned' | 'archived';
}

// News pin
interface NewsPin extends MapPin {
  type: 'news';
  article_url: string;
  title: string;
  summary: string;
  published_at: Date;
  source: string;
  category: 'zoning' | 'market' | 'development' | 'policy';
  linked_properties: string[]; // Auto-link to nearby properties
  ai_relevance_score: number;
}

// Consultant pin
interface ConsultantPin extends MapPin {
  type: 'consultant';
  consultant_id: string;
  name: string;
  specialty: string;
  coverage_area: GeoJSON; // Service area boundary
  linked_properties: string[];
}

// User annotation
interface AnnotationPin extends MapPin {
  type: 'note' | 'drawing';
  content: string | GeoJSON; // Text note or drawn shapes
  color: string;
  shared_with: string[];
}
```

---

### 5. Email → Property Flow (Automated)

```
┌─────────────────────────────────────────────────────┐
│ 1. Email arrives: "123 Main St, Austin TX - $2M"   │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. AI Extracts:                                     │
│    - Address: "123 Main St, Austin TX 78701"       │
│    - Price: $2,000,000                              │
│    - Type: Multifamily (detected from email)       │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. Check User Preferences:                          │
│    User wants: "Acquisitions > Multifamily"        │
│    Location: Austin ✓                               │
│    Match: YES → Auto-process                        │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 4. Geocode Address (Mapbox Geocoding API)          │
│    Lat/Lng: 30.2672, -97.7431                      │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 5. Create Property Pin on Active Map               │
│    - Green pin (new lead)                           │
│    - Pipeline stage: "New"                          │
│    - Initialize deal silo                           │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 6. Notification to User:                            │
│    "1 new property added to Austin Multifamily map" │
│    Click to view details                            │
└─────────────────────────────────────────────────────┘
```

**If AI is uncertain:**
```
Email content ambiguous
↓
Create pending approval queue
↓
User reviews: "Yes, add to map" or "Ignore"
```

---

### 6. Deal Silo (Per Property)

When user clicks property pin, open deal silo sidebar:

```
┌─────────────────────────────┐
│ 123 Main St, Austin TX      │
│ Stage: Analysis             │
├─────────────────────────────┤
│ [Emails] [News] [Financials]│ ← Tabs
├─────────────────────────────┤
│                             │
│ Emails (5):                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ • Initial inquiry (Broker)  │
│ • Follow-up questions       │
│ • Tour scheduled            │
│ • Offer submitted           │
│ • Counter-offer received    │
│                             │
│ [Compose Reply]             │
│                             │
│ News (2):                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📰 Austin approves upzoning │
│ 📰 New transit line planned │
│                             │
│ Consultants (1):            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 👤 Jane (Architect)         │
│    "Buildable: 24 units"    │
│                             │
│ Financial Model:            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ROI: 23%                    │
│ IRR: 18%                    │
│ [Open Full Model]           │
│                             │
│ Tasks (3):                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ☐ Schedule inspection       │
│ ☐ Request zoning letter     │
│ ☐ Draft LOI                 │
│                             │
│ Notes:                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ "Owner motivated, asking    │
│  below comps"               │
│                             │
│ [Move to Next Stage]        │
└─────────────────────────────┘
```

**All info about ONE property in ONE place.**

---

### 7. 3D Zoning Visualization

**User Workflow:**

1. **Click property pin**
2. **Activate "Zoning" module**
3. **Draw lot boundary on map** (polygon tool)
4. **AI Process:**
   ```
   User draws lot → Get lat/lng boundaries
   ↓
   Query Municode scraper API
   ↓
   Get zoning code (e.g., "MF-4")
   ↓
   AI (Claude) parses:
   - Max height: 45 feet
   - Setbacks: 10' front, 5' sides, 15' rear
   - Max coverage: 70%
   - Max units: Based on lot size
   ↓
   Calculate buildable envelope
   ↓
   Render 3D extrusion on Mapbox
   ```

5. **3D Building appears on map:**
   - Transparent box showing buildable volume
   - Color-coded by compliance
   - Rotate/tilt map to view from all angles

**Tech Stack:**
- **Mapbox GL JS** with 3D extrusions
- **Turf.js** for geometry calculations
- **Custom 3D layer** for buildable envelope
- **Municode scraper API** for zoning data
- **Claude AI** for code interpretation

---

### 8. Pipeline Management

**Pipeline Stages:**
```
New Lead → Analysis → Offer → Due Diligence → Closed → Owned
                                              ↓
                                           Passed (archived)
```

**Stage Actions:**

**Moving to "Analysis":**
- ✅ Create task: "Schedule property tour"
- ✅ Create task: "Request zoning information"
- ✅ Notify team: "123 Main St moved to Analysis"
- ✅ Auto-generate financial model template

**Moving to "Offer":**
- ✅ Create task: "Draft LOI"
- ✅ Create task: "Request seller disclosures"
- ✅ Email template: "Offer submission"

**Moving to "Closed":**
- ✅ Move to "Owned" section
- ✅ Pin color changes to blue
- ✅ Archive active tasks
- ✅ Generate deal summary report

**Custom Stages:**
- User can add/remove stages
- Create custom folders
- Set custom actions per stage

---

### 9. Module System (Top Bar)

**Modules = Map Layers + Sidebars**

| Module | Map Layer | Sidebar | Description |
|--------|-----------|---------|-------------|
| **Emails** | Property pins colored by email activity | Email threads list | All property-related emails |
| **News** | News article pins | News feed | Market intelligence from news |
| **Consultants** | Consultant location pins | Consultant directory | Network of local experts |
| **Financials** | Heatmap of ROI/IRR | Deal comparison table | Financial metrics overlay |
| **Zoning** | Zoning district boundaries + 3D | Zoning code viewer | Code compliance and buildable envelope |
| **Pipeline** | Pins colored by stage | Kanban board | Deal flow visualization |
| **Draw** | Drawing tools active | Annotation palette | Draw boundaries, notes, highlights |
| **AI Agents** | Agent activity indicators | Agent status feed | See what bots are doing |
| **Analytics** | Market data heatmaps | Charts and graphs | Supply, demand, pricing trends |

**Toggle Behavior:**
- Click module → Toggle on/off
- Multiple modules can be active
- Sidebar shows active module content
- Map layers stack

---

### 10. Drawing & Annotations

**Drawing Tools:**
- ✏️ **Freehand:** Draw any shape
- 📏 **Line:** Straight lines (measure distance)
- 📐 **Polygon:** Define areas (lot boundaries, zones)
- 📍 **Pin:** Drop custom marker with note
- 🎨 **Color picker:** Choose annotation color
- ✂️ **Eraser:** Remove drawings

**Use Cases:**
- Outline target acquisition area
- Mark problem areas (flood zone, easements)
- Highlight positive features (near transit, parks)
- Draw comp radius (0.5 mile circle)
- Note: "Avoid this block - HOA issues"

**Sharing:**
- Export drawing as PNG
- Share annotation link to team
- Attach drawing to property deal silo
- Real-time collaborative drawing

---

### 11. AI Agents (Background Workers)

**Email Agent:**
- Monitor inbox 24/7
- Extract property opportunities
- Auto-create pins on map
- Link emails to existing deals

**News Agent:**
- RSS feeds + News APIs
- Monitor: Zoning changes, new developments, market reports
- Extract locations from articles
- Pin news on map
- Link to relevant properties
- AI summarization of articles

**Zoning Agent:**
- Scrape Municode for zoning updates
- Alert when zoning changes affect user properties
- Pre-fetch zoning codes for new pins
- Update 3D visualizations

**Market Agent:**
- Track comps (recent sales)
- Monitor supply/demand metrics
- Update heat maps
- Price trend analysis

**Supply Agent:**
- Track new construction permits
- Monitor development pipeline
- 5-year supply forecasting
- Alert on oversupply risks

---

### 12. Tech Stack

**Frontend:**
- **React** + TypeScript
- **Mapbox GL JS** for map rendering
- **Turf.js** for geospatial calculations
- **Mapbox Draw** for annotation tools
- **Socket.io** for real-time collaboration
- **Zustand** or Redux for state management

**Backend:**
- **Node.js + Express** (existing)
- **PostgreSQL + PostGIS** for geospatial data
- **WebSocket** for real-time features
- **Bull** queue for background jobs

**APIs & Services:**
- **Mapbox Geocoding API** (address → lat/lng)
- **Mapbox Directions API** (routing)
- **Microsoft Graph API** (emails - already integrated)
- **Municode Scraper** (zoning codes - you have this)
- **Claude AI** (LLM - already integrated)
- **News APIs** (RSS, NewsAPI, Perplexity)

**AI Integration:**
- **Claude with web access** for property research
- **Embeddings** for semantic search
- **Vision API** for image analysis (site photos)

---

### 13. Database Schema Updates

**New Tables:**

```sql
-- Maps
CREATE TABLE maps (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  owner_id UUID REFERENCES users(id),
  map_type VARCHAR(50),
  is_collaborative BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Map sharing
CREATE TABLE map_collaborators (
  map_id UUID REFERENCES maps(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20), -- 'owner', 'editor', 'viewer'
  permissions JSONB,
  PRIMARY KEY (map_id, user_id)
);

-- Map pins (all types)
CREATE TABLE map_pins (
  id UUID PRIMARY KEY,
  map_id UUID REFERENCES maps(id),
  type VARCHAR(50), -- 'property', 'news', 'consultant', 'note'
  location GEOGRAPHY(POINT, 4326),
  data JSONB, -- Flexible storage for pin-specific data
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Annotations (drawings)
CREATE TABLE map_annotations (
  id UUID PRIMARY KEY,
  map_id UUID REFERENCES maps(id),
  type VARCHAR(50), -- 'line', 'polygon', 'marker'
  geometry GEOGRAPHY,
  style JSONB, -- Color, width, etc.
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline stages (customizable)
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY,
  map_id UUID REFERENCES maps(id),
  stage_name VARCHAR(100),
  stage_order INTEGER,
  color VARCHAR(7), -- Hex color
  actions JSONB -- Tasks, notifications to trigger
);

-- Property deal silos
CREATE TABLE deal_silos (
  id UUID PRIMARY KEY,
  property_pin_id UUID REFERENCES map_pins(id),
  current_stage UUID REFERENCES pipeline_stages(id),
  emails UUID[], -- Array of email IDs
  news UUID[], -- Array of news pin IDs
  consultant_notes TEXT[],
  financial_model_id UUID,
  zoning_data JSONB,
  tasks JSONB[],
  notes TEXT[]
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  deal_silo_id UUID REFERENCES deal_silos(id),
  title VARCHAR(255),
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- News articles
CREATE TABLE news_articles (
  id UUID PRIMARY KEY,
  url VARCHAR(500) UNIQUE,
  title TEXT,
  summary TEXT,
  published_at TIMESTAMPTZ,
  source VARCHAR(100),
  location GEOGRAPHY(POINT, 4326), -- Extracted location
  category VARCHAR(50),
  ai_relevance_score FLOAT,
  linked_properties UUID[]
);
```

---

### 14. User Preferences System

**Setup Flow:**

```
┌─────────────────────────────────────┐
│ Welcome to JediRe!                  │
│ Let's set up your war map.          │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ What are you looking for?           │
│                                     │
│ ☑ Land Development                  │
│   ☑ Single Family                   │
│   ☑ Multifamily                     │
│                                     │
│ ☑ Acquisitions                      │
│   ☑ Multifamily                     │
│   ☐ Commercial                      │
│   ☑ Land                            │
│                                     │
│ ☐ Portfolio Management              │
│ ☐ Brokerage Services                │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Where are you investing?            │
│                                     │
│ Primary: Austin, TX                 │
│ Secondary: Denver, CO               │
│          Phoenix, AZ                │
│                                     │
│ [Add Location]                      │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Deal criteria:                      │
│                                     │
│ Min Price: $500,000                 │
│ Max Price: $5,000,000               │
│ Min ROI: 15%                        │
│ Property size: 0.5 - 10 acres       │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ ✅ Setup Complete!                  │
│                                     │
│ AI agents are now monitoring:       │
│ • Emails for matching opportunities │
│ • News in your target markets       │
│ • Zoning changes                    │
│                                     │
│ [Go to Your War Map]                │
└─────────────────────────────────────┘
```

**Stored Preferences:**
```typescript
interface UserPreferences {
  user_id: string;
  deal_types: {
    land_development: {
      single_family: boolean;
      multifamily: boolean;
    };
    acquisitions: {
      multifamily: boolean;
      commercial: boolean;
      land: boolean;
    };
  };
  target_locations: {
    city: string;
    state: string;
    priority: 'primary' | 'secondary';
  }[];
  criteria: {
    min_price: number;
    max_price: number;
    min_roi: number;
    property_size_acres: { min: number; max: number };
  };
  ai_agents_enabled: boolean;
}
```

---

### 15. Notifications & Updates

**Real-Time Updates:**
```
┌─────────────────────────────────────┐
│ 🔔 Pipeline Updates:                │
│                                     │
│ • 1 new property added              │
│   "456 Oak Ave, Austin TX"          │
│   [View on Map]                     │
│                                     │
│ • Deal moved: "123 Main St"         │
│   Analysis → Offer                  │
│   [View Details]                    │
│                                     │
│ • New task assigned:                │
│   "Schedule inspection"             │
│   Due: Tomorrow                     │
│   [Mark Complete]                   │
│                                     │
│ • News update:                      │
│   "Austin approves zoning change"   │
│   Affects 2 of your properties      │
│   [Read Article]                    │
└─────────────────────────────────────┘
```

**Notification Types:**
- New property detected
- Email received (linked to deal)
- News article published (relevant market)
- Pipeline stage changed
- Task due/overdue
- Team member activity
- Zoning update
- Market alert

---

### 16. Implementation Priority

**Phase 1: Core Map + Email Integration (NOW)**
1. Multi-map system (create/switch maps)
2. Email → property pin automation
3. Basic deal silo (emails per property)
4. Pipeline stages (manual movement)
5. User preferences setup

**Phase 2: Collaboration (Week 2)**
1. Map sharing
2. Real-time cursors
3. Annotations/drawing tools
4. Task assignment
5. Notifications

**Phase 3: Intelligence Layers (Week 3-4)**
1. News agent + news pins
2. Consultant network
3. Financial overlay
4. AI deal matching

**Phase 4: 3D Zoning (Month 2)**
1. Municode scraper integration
2. Zoning code AI parser
3. Buildable envelope calculator
4. 3D rendering on map

**Phase 5: Advanced Analytics (Month 3)**
1. Market data layers
2. Supply/demand forecasting
3. Comp analysis
4. ROI heat maps

---

## Questions for You

**Before I start building:**

1. **Current map status?**
   - Is MapView.tsx functional?
   - Properties already in database?
   - Can I see current implementation?

2. **Email backend status?**
   - Outlook integration working?
   - Can test OAuth flow yet?

3. **Priority order?**
   - Start with map + email automation?
   - Or user preferences first?
   - Or something else?

4. **Team size?**
   - How many users will use this initially?
   - How many properties per map typically?
   - Performance requirements?

5. **Municode scraper?**
   - Do you have API endpoint?
   - Or need to build integration?

---

**Ready to build! What should I start with?** 🚀
