# Trade Area Definition System

**Integration Point:** JEDI RE Core Infrastructure  
**Created:** 2026-02-07  
**Status:** Specification + Phase 1 Implementation

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Geographic Hierarchy](#geographic-hierarchy)
3. [Four Definition Methods](#four-definition-methods)
4. [Traffic-to-Radius Reconciliation](#traffic-to-radius-reconciliation)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Frontend Components](#frontend-components)
8. [Integration Points](#integration-points)
9. [Intelligence Insights](#intelligence-insights)
10. [Implementation Phases](#implementation-phases)

---

## System Overview

### Purpose
Trade Area Definition System is **foundational infrastructure** for JEDI RE. Every analytics module depends on geographic boundaries defined here.

### Core Concept
Users define competitive boundaries around properties using one of four methods:
- **Quick Radius** (1-10 miles)
- **Drive-Time Isochrone** (5-20 minutes)
- **Traffic-Informed AI** (origin-destination patterns)
- **Custom Draw** (freehand polygon)

### Key Innovation
**Traffic-adjusted boundaries** instead of simple circles. System overlays traffic flow data to create realistic competitive areas that account for highways, rivers, and natural barriers.

---

## Geographic Hierarchy

Every deal operates within a **three-tier geographic context**:

```
┌─────────────────────────────────────┐
│  Tier 1: Trade Area                 │ ← User-defined, most granular
│  (User-defined competitive radius)  │   1-10 mile radius around property
├─────────────────────────────────────┤
│  Tier 2: Submarket                  │ ← Default if no trade area
│  (Industry-standard boundaries)     │   CoStar/industry boundaries
├─────────────────────────────────────┤
│  Tier 3: MSA                         │ ← Broadest benchmark
│  (Metropolitan Statistical Area)    │   Census-defined metro area
└─────────────────────────────────────┘

Data cascades: Trade Area → Submarket → MSA
```

### Default Behavior
- User creates deal **without defining trade area** → System defaults to **Submarket**
- User can upgrade from Submarket to Trade Area at any time
- All analytics recalculate when trade area is redefined

### Active Scope Toggle
Users switch between all three levels across all analytics:

```
[Trade Area] [Submarket] [MSA]
   94% occ     91% occ   89% occ  ← Quick stats comparison
```

---

## Four Definition Methods

### 1. Quick Radius (1-10 miles)

**User Experience:**
1. Enter property address → Map centers
2. Select "Quick Radius"
3. Adjust slider (1-10 miles)
4. Map shows **two boundaries**:
   - Dotted line: Raw geometric circle
   - Solid fill: Traffic-adjusted boundary

**Traffic Adjustment:**
- Overlays traffic flow data
- Expands boundary to include areas with strong travel connections
- Excludes areas within circle that are functionally disconnected
- Accounts for highways, rivers, rail lines

**Example:**
```
Property: 123 Peachtree St, Atlanta
Radius: 3 miles

Raw circle: Perfect 3-mile radius
Adjusted:   Extends north (employment corridor)
            Excludes west (highway barrier)
```

**Implementation:** Phase 1 (MVP)

---

### 2. Drive-Time Isochrone (5-20 minutes)

**User Experience:**
1. Select "Drive-Time"
2. Choose time: 5, 10, 15, or 20 minutes
3. Select profile: Driving or Walking
4. Map shows travel-time polygon

**Technical:**
- Mapbox Isochrone API
- Accounts for actual road networks
- Can show multiple rings simultaneously

**Use Cases:**
- Employment-focused properties (commute time matters)
- Transit-oriented developments
- Walkable urban locations

**Implementation:** Phase 2 (Month 1)

---

### 3. Traffic-Informed AI (Recommended)

**User Experience:**
1. Click "🤖 Traffic-Informed (AI)"
2. System analyzes:
   - Origin-destination trip data
   - Commute corridor patterns
   - Retail trip patterns
   - Natural barrier detection
3. AI suggests polygon boundary
4. Shows **confidence score** (High/Medium/Low)
5. User can accept, adjust, or reject

**Confidence Scoring:**
- **High:** Traffic data + barriers + validated by other users
- **Medium:** Radius/drive-time only, no validation
- **Low:** User custom draw, no data backing

**Example Output:**
```
🤖 AI-Generated Trade Area
Confidence: High (0.92)

Analysis:
✓ 68% of resident trips originate within boundary
✓ 3 natural barriers detected and excluded
✓ 2 employment corridors included
✓ Similar to 14 validated trade areas in MSA
```

**Implementation:** Phase 3 (Month 2-3)

---

### 4. Custom Draw

**User Experience:**
1. Select "Custom Draw"
2. Click map to draw polygon
3. Optional: Enable "Snap to Roads"
4. Edit vertices after creation
5. Save with custom name

**Features:**
- Mapbox Draw plugin
- Freehand polygon creation
- Vertex editing
- Snap-to-road for cleaner boundaries

**Use Cases:**
- User has local market knowledge
- Irregular competitive areas
- Specific zoning boundaries

**Implementation:** Phase 1 (MVP)

---

## Traffic-to-Radius Reconciliation

### The Challenge
Users think in miles (1, 3, 5, 10), but real competitive areas are irregular due to:
- Highway barriers
- River crossings
- Rail lines
- Employment corridors
- Retail centers

### The Solution: Traffic-Weighted Boundaries

**Methodology:**
1. Start with user's radius (e.g., 3 miles)
2. Overlay traffic flow data:
   - Origin-destination patterns
   - Commute corridors
   - Retail trip patterns
3. Identify natural barriers:
   - Highways with limited crossings
   - Rivers without bridges
   - Rail lines
4. Adjust boundary:
   - **Include:** Areas slightly outside radius with strong travel connections
   - **Exclude:** Areas inside radius that are functionally disconnected
5. Display both:
   - Raw radius (dotted line)
   - Adjusted boundary (solid fill)

**Example:**

```
                    North
                      ↑
                      │
    ┌─────────────────┼─────────────────┐
    │   Employment    │    Included     │
    │   Corridor      │   (traffic)     │
West├─────────●───────┼─────────────────┤ East
    │         │       │                 │
    │    Highway      │                 │
    │   (Excluded)    │                 │
    └─────────────────┼─────────────────┘
                      │
                      ↓
                    South

● = Property location
Dotted circle = 3-mile geometric radius
Solid area = Traffic-adjusted trade area
```

### Benefits
1. **Realistic:** Matches actual tenant/visitor travel patterns
2. **Actionable:** Comp analysis uses true competitive set
3. **Educational:** Shows users why geography matters
4. **Data-driven:** Based on real traffic data, not guesses

---

## Database Schema

### Core Tables

```sql
-- Trade areas (user-defined boundaries)
CREATE TABLE trade_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    team_id INTEGER REFERENCES teams(id),
    
    -- Geographic data
    geometry GEOMETRY(POLYGON, 4326) NOT NULL, -- PostGIS
    definition_method VARCHAR(50) NOT NULL, -- 'radius', 'drive_time', 'traffic_informed', 'custom_draw'
    method_params JSONB, -- {radius_miles: 3, traffic_adjusted: true}
    
    -- Quality metrics
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Hierarchy
    parent_submarket_id INTEGER REFERENCES submarkets(id),
    parent_msa_id INTEGER REFERENCES msas(id),
    
    -- Cached stats (updated periodically)
    stats_snapshot JSONB, -- {population: 42850, existing_units: 8240, ...}
    
    -- Sharing
    is_shared BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Link trade areas to deals/properties
CREATE TABLE deal_geographic_context (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER REFERENCES deals(id),
    property_id INTEGER REFERENCES properties(id),
    
    -- Context hierarchy
    trade_area_id INTEGER REFERENCES trade_areas(id), -- NULL = use submarket default
    submarket_id INTEGER REFERENCES submarkets(id) NOT NULL,
    msa_id INTEGER REFERENCES msas(id) NOT NULL,
    
    -- Active scope for analytics
    active_scope VARCHAR(20) DEFAULT 'submarket', -- 'trade_area', 'submarket', 'msa'
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reference submarket boundaries (CoStar data)
CREATE TABLE submarkets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    msa_id INTEGER REFERENCES msas(id),
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    source VARCHAR(100), -- 'costar', 'custom'
    
    -- Cached market stats
    properties_count INTEGER,
    avg_occupancy DECIMAL(5,2),
    avg_rent DECIMAL(10,2),
    
    updated_at TIMESTAMP DEFAULT NOW()
);

-- MSA boundaries (Census data)
CREATE TABLE msas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cbsa_code VARCHAR(10) UNIQUE,
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    population INTEGER,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Spatial indexes for fast queries
CREATE INDEX idx_trade_areas_geometry ON trade_areas USING GIST(geometry);
CREATE INDEX idx_submarkets_geometry ON submarkets USING GIST(geometry);
CREATE INDEX idx_msas_geometry ON msas USING GIST(geometry);
CREATE INDEX idx_trade_areas_user ON trade_areas(user_id);
CREATE INDEX idx_deal_geographic_context_deal ON deal_geographic_context(deal_id);
```

---

## API Endpoints

### Trade Area Management

```
POST   /api/v1/trade-areas
       Create new trade area
       Body: {name, geometry, method, method_params}
       Returns: trade_area object with ID

GET    /api/v1/trade-areas/{id}
       Get trade area with cached stats
       Returns: {id, name, geometry, stats: {population, units, ...}}

PUT    /api/v1/trade-areas/{id}
       Update geometry or metadata
       Body: {geometry?, method_params?, name?}

DELETE /api/v1/trade-areas/{id}
       Delete trade area (soft delete if linked to deals)

GET    /api/v1/trade-areas/library
       List user's saved trade areas
       Query: ?shared=true (include team trade areas)
       Returns: [{id, name, thumbnail, stats}]
```

### AI Generation

```
POST   /api/v1/trade-areas/generate
       AI-generate trade area from traffic data
       Body: {lat, lng, radius_hint?}
       Returns: {geometry, confidence, analysis}

POST   /api/v1/trade-areas/preview-stats
       Get stats for a draft geometry (before saving)
       Body: {geometry}
       Returns: {population, units, pipeline, avg_rent}
```

### Geographic Context

```
POST   /api/v1/deals/{id}/geographic-context
       Set geographic context for a deal
       Body: {trade_area_id?, active_scope}

GET    /api/v1/deals/{id}/geographic-context
       Get deal's current geographic hierarchy
       Returns: {trade_area, submarket, msa, active_scope}

PUT    /api/v1/deals/{id}/geographic-context
       Update active scope (trade_area/submarket/msa)
       Body: {active_scope}
```

### Lookups

```
GET    /api/v1/submarkets/lookup?lat=X&lng=Y
       Find submarket for coordinates
       Returns: submarket object

GET    /api/v1/msas/lookup?lat=X&lng=Y
       Find MSA for coordinates
       Returns: msa object
```

---

## Frontend Components

### 1. TradeAreaDefinitionPanel

**Usage:** Create Deal flow, Step 3

```tsx
<TradeAreaDefinitionPanel
  propertyLat={33.7756}
  propertyLng={-84.3963}
  onSave={(tradeArea) => linkToDeal(tradeArea)}
  onSkip={() => useSubmarketDefault()}
>
  {/* Method selector buttons */}
  <MethodSelector>
    <Button active={method === 'radius'}>📍 Quick Radius</Button>
    <Button active={method === 'drive_time'}>🚗 Drive-Time</Button>
    <Button active={method === 'ai'}>🤖 Traffic-Informed</Button>
    <Button active={method === 'draw'}>✏️ Custom Draw</Button>
  </MethodSelector>
  
  {/* Method-specific controls */}
  {method === 'radius' && (
    <RadiusSlider
      value={radiusMiles}
      min={1}
      max={10}
      step={0.5}
      onChange={setRadiusMiles}
    />
  )}
  
  {method === 'drive_time' && (
    <DriveTimeControls
      minutes={driveTimeMinutes}
      profile={profile} // 'driving' or 'walking'
    />
  )}
  
  {/* Map preview */}
  <MapPreview>
    <MapboxGL>
      <TradeAreaBoundary geometry={draftGeometry} />
      <PropertyMarker lat={propertyLat} lng={propertyLng} />
    </MapboxGL>
  </MapPreview>
  
  {/* Preview stats */}
  <PreviewStats>
    <StatCard label="Population" value="42,850" />
    <StatCard label="Existing Units" value="8,240" />
    <StatCard label="Pipeline Units" value="1,200" />
    <StatCard label="Avg Rent" value="$2,150" />
  </PreviewStats>
  
  {/* Confidence badge */}
  {confidenceScore && (
    <ConfidenceBadge level={confidenceScore > 0.8 ? 'high' : 'medium'}>
      Confidence: {(confidenceScore * 100).toFixed(0)}%
    </ConfidenceBadge>
  )}
  
  {/* Actions */}
  <Actions>
    <Button variant="secondary" onClick={onSkip}>
      Skip - Use Submarket Default
    </Button>
    <Button variant="primary" onClick={handleSave}>
      Save Trade Area
    </Button>
  </Actions>
</TradeAreaDefinitionPanel>
```

**State Management (Zustand):**
```ts
interface TradeAreaStore {
  method: DefinitionMethod | null;
  radiusMiles: number;
  driveTimeMinutes: number;
  draftGeometry: GeoJSON.Polygon | null;
  previewStats: TradeAreaStats | null;
  
  setMethod: (method: DefinitionMethod) => void;
  setRadius: (miles: number) => void;
  updateDraftGeometry: (geometry: GeoJSON.Polygon) => void;
  saveTradeArea: (name: string) => Promise<TradeArea>;
}
```

---

### 2. GeographicScopeTabs

**Usage:** All analytics modules (reusable)

```tsx
<GeographicScopeTabs
  activeScope="trade_area"
  onChange={(scope) => setActiveScope(scope)}
>
  <Tab
    id="trade_area"
    label="Trade Area"
    stats={{occupancy: 94, avgRent: 2150}}
    enabled={hasTradeArea}
  />
  <Tab
    id="submarket"
    label="Submarket"
    stats={{occupancy: 91, avgRent: 2080}}
  />
  <Tab
    id="msa"
    label="MSA"
    stats={{occupancy: 89, avgRent: 1950}}
  />
</GeographicScopeTabs>
```

**Renders as:**
```
┌──────────────────────────────────────────────┐
│ [Trade Area▼] [Submarket ] [MSA        ]    │
│  94% occ       91% occ      89% occ          │
│  $2,150        $2,080       $1,950           │
└──────────────────────────────────────────────┘
```

---

### 3. LocationIntelPanel

**Usage:** Properties Silo → Property Detail → Location Intel tab

```tsx
<LocationIntelPanel propertyId={123}>
  {/* Map with trade area */}
  <TradeAreaMap
    tradeArea={tradeArea}
    property={property}
    competitors={competitors}
  />
  
  {/* POI Proximity Analysis */}
  <POIProximitySection>
    <SectionTitle>📍 Points of Interest</SectionTitle>
    <POIList>
      <POIItem
        type="grocery"
        name="Whole Foods Market"
        distance="0.3 mi"
        impact="+6.2% rent premium"
        confidence="high"
      />
      <POIItem
        type="transit"
        name="Midtown MARTA Station"
        distance="0.2 mi"
        impact="+$187/unit"
        confidence="high"
      />
      <POIItem
        type="school"
        name="Morningside Elementary (8/10)"
        distance="0.8 mi"
        impact="+11% rent (2BR+)"
        confidence="medium"
      />
    </POIList>
  </POIProximitySection>
  
  {/* Traffic Patterns */}
  <TrafficPatternsSection>
    <TrafficHeatmap />
    <TrafficInsights>
      <Insight>68% of traffic flows north toward employment corridor</Insight>
      <Insight>Peak hours: 7-9am outbound, 5-7pm inbound</Insight>
    </TrafficInsights>
  </TrafficPatternsSection>
  
  {/* Competitive Set */}
  <CompetitiveSetSection>
    <SectionTitle>🏢 Competitive Set (14 properties in trade area)</SectionTitle>
    <CompGrid>
      {competitors.map(comp => (
        <CompCard key={comp.id} property={comp} />
      ))}
    </CompGrid>
  </CompetitiveSetSection>
</LocationIntelPanel>
```

---

### 4. TradeAreaLibrary

**Usage:** Sidebar → Tools → Trade Areas

```tsx
<TradeAreaLibrary>
  <Header>
    <Title>📍 Saved Trade Areas</Title>
    <Button>+ New Trade Area</Button>
  </Header>
  
  <Filters>
    <FilterButton active>All Markets</FilterButton>
    <FilterButton>Atlanta</FilterButton>
    <FilterButton>Austin</FilterButton>
    <FilterButton>Shared</FilterButton>
  </Filters>
  
  <TradeAreaGrid>
    {tradeAreas.map(ta => (
      <TradeAreaCard
        key={ta.id}
        name={ta.name}
        thumbnail={ta.thumbnail}
        stats={ta.stats}
        method={ta.definition_method}
        isShared={ta.is_shared}
        onApply={() => applyToCurrentDeal(ta.id)}
        onEdit={() => editTradeArea(ta.id)}
        onDelete={() => deleteTradeArea(ta.id)}
      />
    ))}
  </TradeAreaGrid>
</TradeAreaLibrary>
```

---

## Integration Points

### 1. Create Deal Flow (Enhanced)

**New Step 3: Define Trade Area**

```
Enhanced 5-Step Create Deal Flow:

Step 1: Category Selection
├─ Add to Portfolio (owned)
└─ Add to Pipeline (prospecting)

Step 2: Development Type + Address
├─ New Development
├─ Existing Property
└─ [Address input with geocoding]

Step 3: Define Trade Area ⭐ NEW
├─ Quick Radius (1-10 miles)
├─ Drive-Time (5-20 min)
├─ Traffic-Informed (AI)
├─ Custom Draw
└─ Skip (use submarket default)

Step 4: Boundary Drawing
└─ [If New Development, draw boundary on map]

Step 5: Deal Details
└─ [Name, description, tier]
```

**Implementation:**
- Add `TradeAreaDefinitionPanel` between Step 2 and existing Step 3
- If user skips → Auto-lookup submarket from property coordinates
- Save trade area → Link to deal via `deal_geographic_context` table

---

### 2. Map Layer Controls (Enhanced)

**Horizontal Bar - Add Trade Area Scope Toggle**

```
Before:
[🔍 Search] [🗺️ War Maps] [📍 Custom 1] [📍 Custom 2]

After:
[🔍 Search] [🗺️ War Maps] [📍 Custom 1] [📍 Custom 2] | [Trade Area: ▼]
                                                         └─ [Submarket]
                                                         └─ [MSA]
```

When user clicks Trade Area dropdown:
```
┌─────────────────────────┐
│ ● Trade Area (3 mi)     │
│   Submarket (Midtown)   │
│   MSA (Atlanta Metro)   │
└─────────────────────────┘
```

All map layers re-filter to selected scope.

---

### 3. Properties Silo (New Tab)

**Add "Location Intel" tab to Property Detail**

```
Property Detail → Tabs:
├─ Overview (existing)
├─ Lease Intelligence (existing)
├─ Financial (existing)
├─ Location Intel ⭐ NEW
│   ├─ Trade Area Map
│   ├─ POI Proximity Analysis
│   ├─ Traffic Patterns
│   ├─ Rent Premium Analysis
│   └─ Competitive Set
└─ Activity (existing)
```

---

### 4. Pipeline Silo (Enhanced Deal Scoring)

**Add Trade Area Health Score**

```
Deal Scoring Cards:
├─ JEDI Score (existing)
│   └─ 82/100 - Strong Opportunity
├─ Trade Area Health ⭐ NEW
│   ├─ Supply-Demand: 🟢 Healthy
│   ├─ POI Proximity: 🟡 Medium
│   ├─ Traffic Access: 🟢 Excellent
│   ├─ Comp Rent: $2,150 (vs. $2,080 submarket)
│   └─ Confidence: High (0.92)
└─ Financial Projections (existing)
```

---

### 5. Dashboard (New Widget)

**Add "Trade Area Insights" Widget**

```
Dashboard Widgets:
├─ Portfolio KPIs
├─ Market Alerts
├─ Trade Area Insights ⭐ NEW
│   ├─ "Properties near Whole Foods average +6.2% rent"
│   ├─ "1,200 units delivering in 18mo vs. 400 absorption"
│   ├─ "Your portfolio outperforms trade area by 5pts"
│   └─ [See all insights →]
└─ Tasks
```

---

### 6. All Six Agents (Integration)

**Shared Utility Function:**

```python
def get_analytics_boundary(deal_id: str, scope: str = None) -> GeoJSON:
    """
    Returns the active geographic boundary for a deal.
    Falls back: trade_area → submarket → msa
    """
    context = db.query(deal_geographic_context)
                  .filter_by(deal_id=deal_id)
                  .first()
    
    if scope is None:
        scope = context.active_scope
    
    if scope == 'trade_area' and context.trade_area_id:
        return db.query(trade_areas.geometry)
                 .filter_by(id=context.trade_area_id)
                 .scalar()
    
    elif scope == 'submarket':
        return db.query(submarkets.geometry)
                 .filter_by(id=context.submarket_id)
                 .scalar()
    
    else:  # msa
        return db.query(msas.geometry)
                 .filter_by(id=context.msa_id)
                 .scalar()
```

**All agents call this function:**
- **Supply Agent:** Scope pipeline and inventory queries
- **Demand Agent:** Scope population, migration, job data
- **Strategy Agent:** Scope comps and strategy analysis
- **Market Intel Agent:** Scope market metrics
- **News Agent:** Filter articles by location relevance
- **Deal Tracker:** Scope competitive activity

---

## Intelligence Insights

### Proximity-to-Performance Correlations

**Retail & Amenity Proximity:**
- "Properties within 5-min of Whole Foods/Trader Joe's: **+6.2% rent**"
- "Trade areas with 3+ coffee shops per 1,000 residents: **+2.1% occupancy**"
- "Proximity to Target or Costco: **Higher renewal rates** in B-class"

**Employment Center Access:**
- "Avg commute <25 min: **+3.8% occupancy** vs. >35 min"
- "Diversified employment (3+ corridors): **40% less rent volatility**"

**Transit & Infrastructure:**
- "Within 0.25mi of rail/metro: **+$187/unit rent premium**"
- "Walk Score >70: **+9% rent** (urban), **+2%** (suburban)"

**Education Proximity:**
- "Top-25% elementary school within 1 mile: **+11% rent** (2BR+)"
- "University-adjacent (2mi, 10K+ enrollment): **+22% faster lease-up**"

### Supply-Demand Pattern Insights

**Pipeline Intelligence:**
- "1,200 units delivering vs. 400 absorption: **18-24mo concession pressure**"
- "Pipeline >15% of existing inventory: **3-7% rent compression**"

**Competitive Positioning:**
- "9 of 14 properties are 1980s vintage: **Renovation = pricing power**"
- "Only Class A option in trade area: **Monopoly premium opportunity**"

### Risk Signals

**Trade Area Health Monitoring:**
- "Retail vacancy increased 4% → 9%: **Leading indicator of softening**"
- "Anchor grocery lease expires in 14mo: **3-5% occupancy risk**"
- "Traffic volume dropped 12% YoY: **Investigate remote work impact**"

---

## Implementation Phases

### Phase 1: MVP (Week 1-2) ✅ BUILDING NOW

**Goal:** Basic trade area creation with Quick Radius

**Deliverables:**
1. ✅ Database migrations (trade_areas, deal_geographic_context, submarkets, msas)
2. ✅ Backend API endpoints (create, get, update, delete trade areas)
3. ✅ TradeAreaDefinitionPanel component
4. ✅ Quick Radius method (slider + circle drawing)
5. ✅ Custom Draw method (Mapbox Draw plugin)
6. ✅ Preview stats (population, units, rent)
7. ✅ Integration into Create Deal flow (Step 3)
8. ✅ GeographicScopeTabs component (reusable)

**Testing:**
- Create deal with 3-mile trade area
- Verify geometry saved to database
- Switch between Trade Area/Submarket/MSA tabs
- Verify analytics respect active scope

---

### Phase 2: Drive-Time + POI Analysis (Month 1)

**Goal:** Add isochrone method and POI proximity insights

**Deliverables:**
1. Drive-Time Isochrone method (Mapbox API)
2. POI proximity analysis (Google Places API)
3. LocationIntelPanel component (Properties detail tab)
4. Basic insights ("Properties in this trade area average X")
5. Trade Area Health score card (Pipeline detail)

**Intelligence:**
- POI detection (grocery, transit, schools within trade area)
- Distance calculations
- Rent premium correlations
- Competitive set identification

---

### Phase 3: Traffic AI + Full Insights (Month 2-3)

**Goal:** AI-generated trade areas and full insights engine

**Deliverables:**
1. Traffic-Informed AI method (origin-destination data)
2. Traffic normalization (adjust radius for barriers)
3. Confidence scoring
4. Full insights engine (all correlations)
5. TradeAreaLibrary component (save/reuse)
6. Team sharing controls

**Data Sources:**
- Origin-destination trip data (StreetLight, Replica)
- Traffic patterns (Waze, Google Maps)
- Natural barrier detection (rivers, highways, rail)

---

### Phase 4: Advanced Features (Month 4+)

**Goal:** Cross-property intelligence and advanced analytics

**Deliverables:**
1. Trade area comparison tool
2. Portfolio concentration risk analysis
3. Multi-property trade area overlap detection
4. Automated comp analysis (trade area first, then submarket)
5. Real-time trade area health monitoring
6. Mobile app support

**Intelligence:**
- "Your portfolio has 68% NOI concentration in 2 trade areas"
- "3 of your properties compete in overlapping trade areas"
- "Trade area health declined 12 points in past 90 days"

---

## Success Metrics

### Phase 1 (MVP)
- [ ] 100% of deals have geographic context (trade area or submarket)
- [ ] Users create avg 2.5 trade areas per deal
- [ ] 75%+ of users complete trade area step (vs. skip)
- [ ] <500ms preview stats load time

### Phase 2 (Drive-Time + POI)
- [ ] Drive-time method used 30%+ of the time (vs. radius)
- [ ] Location Intel tab viewed on 60%+ of property details
- [ ] POI proximity insights surface in 80%+ of trade areas
- [ ] Users act on insights (create tasks, adjust pricing)

### Phase 3 (Traffic AI)
- [ ] AI-generated trade areas accepted 70%+ of the time
- [ ] Confidence scores average >0.80 (high quality)
- [ ] Trade Area Library has avg 8 saved areas per user
- [ ] Team sharing adoption >40%

### Phase 4 (Advanced)
- [ ] Portfolio concentration alerts trigger proactive action
- [ ] Trade area health monitoring prevents 3+ occupancy drops
- [ ] Comp analysis accuracy improves 15%+ (trade area vs. submarket)
- [ ] User retention increases 20%+ (sticky feature)

---

## Technical Notes

### PostGIS Spatial Queries

**Find properties within trade area:**
```sql
SELECT p.*
FROM properties p
JOIN trade_areas ta ON ST_Within(p.location, ta.geometry)
WHERE ta.id = $1;
```

**Find overlapping trade areas:**
```sql
SELECT ta1.name, ta2.name, ST_Area(ST_Intersection(ta1.geometry, ta2.geometry)) AS overlap_area
FROM trade_areas ta1
JOIN trade_areas ta2 ON ST_Overlaps(ta1.geometry, ta2.geometry)
WHERE ta1.user_id = $1 AND ta2.user_id = $1;
```

**Calculate stats for trade area:**
```sql
SELECT 
    COUNT(*) AS properties_count,
    AVG(occupancy) AS avg_occupancy,
    AVG(avg_rent) AS avg_rent,
    SUM(unit_count) AS total_units
FROM properties
WHERE ST_Within(location, (SELECT geometry FROM trade_areas WHERE id = $1));
```

### Mapbox Integration

**Draw isochrone:**
```ts
const fetchIsochrone = async (lat: number, lng: number, minutes: number, profile: 'driving' | 'walking') => {
  const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${MAPBOX_TOKEN}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.features[0].geometry; // GeoJSON polygon
};
```

**Draw circle:**
```ts
import circle from '@turf/circle';

const createRadiusCircle = (lat: number, lng: number, miles: number) => {
  return circle([lng, lat], miles, {
    steps: 64,
    units: 'miles'
  });
};
```

---

**End of Trade Area Definition System Specification**
