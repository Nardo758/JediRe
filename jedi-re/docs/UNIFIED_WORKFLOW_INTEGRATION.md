# JEDI RE - Unified Workflow Integration
**Connecting Strategic Analysis → 3D Design → Market Forecasting**

Created: 2026-02-03
Status: Architecture Design

---

## The Complete Development Workflow

```
PHASE 1: LAND SEARCH
   ↓
PHASE 2: PRE-PURCHASE ANALYSIS
   ↓
PHASE 3: DESIGN OPTIMIZATION
   ↓
PHASE 4: MARKET IMPACT ASSESSMENT
```

---

## PHASE 1: Land Search & Acquisition Strategy

**User Action:** "I want to build 500 units in Buckhead"

**System Response:**

### 1A. Parcel Recommender Identifies Opportunities
```
Input:
- Target: 500 units
- Budget: $50M
- Market: Buckhead

Output:
┌─────────────────────────────────────────────────────┐
│ RECOMMENDED PARCELS                                  │
├─────────────────────────────────────────────────────┤
│ 1. 3350 Lenox Rd (1.03 ac, MR-6)                   │
│    Current: Vacant commercial                        │
│    Max units: 288                                    │
│    Cost: $18M                                        │
│                                                      │
│ 2. Adjacent parking lot (0.5 ac)                   │
│    🎯 PARKING ARBITRAGE OPPORTUNITY                 │
│    Cost: $2M vs $10M structure                      │
│    Savings: $8M                                     │
│                                                      │
│ 3. Combined assemblage                              │
│    Total units: 320 (bonus: +32)                   │
│    Total cost: $20M                                 │
│                                                      │
│ [View in 3D] [Analyze Further] [Add to Portfolio]  │
└─────────────────────────────────────────────────────┘
```

**Integration Point 1: Pre-fill 3D Design Tool**
- When user clicks "View in 3D", system passes:
  - Lot dimensions
  - Zoning constraints (height, setbacks, FAR)
  - Recommended unit count
  - Parking strategy (surface vs structure)

---

## PHASE 2: Pre-Purchase Analysis

**User Action:** "Should I buy this parcel?"

**System Response:**

### 2A. Development Capacity Model Runs Full Analysis
```
Input:
- Parcel details
- Current zoning
- Market conditions

Output:
┌─────────────────────────────────────────────────────┐
│ DEVELOPMENT CAPACITY ANALYSIS                        │
├─────────────────────────────────────────────────────┤
│ Parcel: 3350 Lenox Rd (1.03 acres)                 │
│ Current Zoning: MR-6                                │
│                                                      │
│ BUILDABLE CAPACITY:                                 │
│ • Max units: 288 units                              │
│ • Max height: No limit                              │
│ • Max FAR: 6.40                                     │
│                                                      │
│ OPTIMAL DESIGN:                                     │
│ • Recommended: 12 floors, 288 units                 │
│ • Building footprint: 45,000 sqft                   │
│ • Corridor type: Double-loaded                      │
│ • Efficiency: 87%                                   │
│                                                      │
│ PARKING STRATEGY:                                   │
│ • Required spaces: 288                              │
│ • Structured cost: $14.4M                           │
│ • 🎯 Adjacent lot available: $2M                    │
│ • Net savings: $12.4M ⚠️ CRITICAL OPPORTUNITY       │
│                                                      │
│ COST ESTIMATE:                                      │
│ • Land: $18M                                        │
│ • Adjacent parking: $2M                             │
│ • Construction: $72M                                │
│ • Total: $92M                                       │
│                                                      │
│ PRO FORMA:                                          │
│ • Annual rent: $8.6M                                │
│ • Cap rate: 9.4%                                    │
│ • ROI: 18.2%                                        │
│                                                      │
│ [Generate 3D Model] [Detailed Pro Forma] [Buy]     │
└─────────────────────────────────────────────────────┘
```

**Integration Point 2: Generate Initial 3D Model**
- System creates baseline 3D model based on optimal design
- User can then customize in 3D tool
- Constraints from zoning analysis enforced in 3D editor

---

## PHASE 3: Design Optimization (3D Building Drawing)

**User Action:** "Design my building"

### 3A. 3D Building Editor with Live Optimization

**Integration Architecture:**

```
3D Editor (Frontend)
    ↕ Real-time API calls
Design Optimizer Engine (Backend)
    ↕ Validation
Zoning Rules Database
    ↕ Cost calculation
Cost Model Engine
```

**Real-Time Optimization During 3D Design:**

```javascript
// User drags building height slider in 3D tool
onHeightChange(newHeight) {
    // Real-time API call
    response = await POST /api/v1/optimize-design {
        parcel_id: 123,
        height: newHeight,
        units: currentUnits,
        parking_strategy: 'surface'
    }
    
    // System responds with:
    {
        "is_valid": true,
        "zoning_compliant": true,
        "max_units_at_height": 288,
        "cost_per_unit": 320000,
        "efficiency_score": 0.85,
        "warnings": ["Approaching max height limit"],
        "suggestions": [
            "Add 2 more floors for 24 extra units",
            "Use adjacent lot for parking to save $12M"
        ]
    }
}
```

**3D Editor Features:**

```
┌────────────────────────────────────────────────────┐
│ 3D BUILDING DESIGNER                               │
├────────────────────────────────────────────────────┤
│                                                    │
│  [3D Rendering of Building]                       │
│                                                    │
│  Floors: [▓▓▓▓▓▓▓▓▓▓▓▓░] 12 of 25 max            │
│  Units: [▓▓▓▓▓▓▓▓▓░░░░] 288 of 350 max           │
│                                                    │
│  💰 LIVE COST FEEDBACK:                           │
│  Cost/unit: $320,000 ✅ (optimal range)           │
│  Efficiency: 87% ✅ (excellent)                   │
│                                                    │
│  🎯 OPTIMIZATION SUGGESTIONS:                     │
│  ⚠️ Add parking garage = +$14M                    │
│     → Consider adjacent lot for $2M instead       │
│                                                    │
│  ✅ Double-loaded corridors = +$2M savings        │
│  ✅ Rectangular footprint = optimal efficiency    │
│                                                    │
│  Parking Strategy:                                │
│  ( ) Structured - $14.4M                          │
│  (•) Adjacent land - $2M ⭐ RECOMMENDED           │
│  ( ) Surface on-site - Limited capacity           │
│                                                    │
│  [Update Design] [View Cost Breakdown] [Export]   │
└────────────────────────────────────────────────────┘
```

**3D Design Rules Enforcement:**

```python
class Design3DValidator:
    """Validates 3D designs against zoning + optimization rules"""
    
    def validate_design(self, building_3d, parcel):
        checks = []
        
        # 1. Zoning compliance
        checks.append(self.check_height_limit(building_3d, parcel))
        checks.append(self.check_setbacks(building_3d, parcel))
        checks.append(self.check_far(building_3d, parcel))
        
        # 2. Cost optimization
        checks.append(self.check_vertical_cost_efficiency(building_3d))
        checks.append(self.check_parking_strategy(building_3d, parcel))
        
        # 3. Geometric efficiency
        checks.append(self.check_corridor_efficiency(building_3d))
        checks.append(self.check_building_depth(building_3d))
        
        # 4. Parking arbitrage
        if self.structured_parking_detected(building_3d):
            adjacent_opportunities = self.find_parking_arbitrage(parcel)
            if adjacent_opportunities:
                checks.append({
                    'type': 'WARNING',
                    'message': f'Consider acquiring adjacent land for ${adjacent_opportunities[0].cost/1e6:.1f}M instead of ${building_3d.parking_cost/1e6:.1f}M structure',
                    'savings': adjacent_opportunities[0].savings
                })
        
        return checks
```

---

## PHASE 4: Market Impact Assessment (Future Development)

**User Action:** "What will the market look like in 3 years?"

### 4A. Development Capacity Model Scans Entire Submarket

**System analyzes ALL parcels in Buckhead:**

```
FOR each parcel in submarket:
    IF vacant OR underbuilt:
        Calculate max buildable units
        Estimate development timeline
        Project likelihood of development
    
    Sum up total pipeline
```

**Output:**

```
┌────────────────────────────────────────────────────┐
│ BUCKHEAD DEVELOPMENT PIPELINE FORECAST             │
├────────────────────────────────────────────────────┤
│                                                    │
│ CURRENT MARKET:                                   │
│ • Existing units: 10,000                          │
│ • Vacancy: 4.2%                                   │
│ • Avg rent: $2,400/mo                            │
│                                                    │
│ IDENTIFIED DEVELOPMENT PIPELINE:                  │
│                                                    │
│ 📍 3350 Lenox Rd (Your project)                  │
│    288 units, 18 months out                       │
│                                                    │
│ 📍 3500 Piedmont Rd                               │
│    420 units, 12 months out                       │
│    Impact: MAJOR COMPETITOR ⚠️                    │
│    [View their design] [Compare]                  │
│                                                    │
│ 📍 2900 Peachtree Rd                              │
│    180 units, 24 months out                       │
│    Impact: Moderate                               │
│                                                    │
│ TOTAL PIPELINE: 888 units (+8.9% supply)         │
│                                                    │
│ MARKET FORECAST:                                  │
│ • 2026 vacancy: 5.8% (↑ slight increase)         │
│ • 2027 vacancy: 4.1% (↓ absorption complete)     │
│ • Rent growth: +3.2% annually                    │
│                                                    │
│ YOUR PROJECT OUTLOOK: ✅ FAVORABLE                │
│ • Pipeline manageable (<10% increase)             │
│ • Strong absorption expected                      │
│ • Timing: Launch before Piedmont competitor       │
│                                                    │
│ [Detailed Forecast] [Competitor Analysis]         │
└────────────────────────────────────────────────────┘
```

**Integration Point 3: Loop Back to Design**
- If pipeline shows oversupply risk, suggest:
  - Delay project
  - Differentiate design (luxury vs affordable)
  - Adjust unit mix
  - Consider alternative markets

---

## Complete Integration Flow

### Scenario: Developer Using Full System

**Step 1: Land Search**
```
User: "Find me land for 500 units in Buckhead, $50M budget"
System: Parcel Recommender identifies 3-parcel assemblage
Result: 520 units, $32M land, $8M parking savings
User clicks: "Analyze this combination"
```

**Step 2: Pre-Purchase Analysis**
```
System: Runs development capacity on all 3 parcels
Output: 
- Max buildable: 520 units
- Optimal design: 12-floor tower + parking on adjacent lot
- Pro forma: 18.2% ROI
- Parking arbitrage: $8M savings identified
User clicks: "Design this building"
```

**Step 3: 3D Design**
```
System: Opens 3D editor pre-filled with:
- Lot boundaries (3 parcels combined)
- Zoning envelope (setbacks, height)
- Suggested building footprint
- Parking location (adjacent lot)

User: Adjusts design in 3D
System: Real-time feedback:
  - "Adding 2 floors = +24 units, +$7M cost"
  - "Parking structure detected: Consider adjacent lot for $10M savings"
  - "Corridor efficiency: 87% ✅"

User finalizes design → Exports 3D model
```

**Step 4: Market Validation**
```
System: Runs development capacity on entire Buckhead
Output:
- Total pipeline: 888 units identified
- Your project: 520 units
- Market impact: Manageable (+8.9% supply)
- Competitors: 420-unit tower breaking ground in 12 months

System suggests:
- "Break ground ASAP to beat Piedmont competitor"
- "Consider luxury finishes to differentiate"
- "Adjust from 1BR heavy to 2BR mix"

User: Proceeds with confidence based on data
```

---

## API Integration Points

### 1. Parcel Search → 3D Editor
```javascript
// User clicks "Design in 3D" from parcel recommendation
POST /api/v1/projects/create-from-parcels
{
    "parcel_ids": [123, 124, 125],
    "strategy": "assemblage_with_parking_arbitrage",
    "redirect_to": "3d_editor"
}

Response:
{
    "project_id": 456,
    "3d_editor_url": "/design/456",
    "initial_design": {
        "lot_boundaries": [[x,y], ...],
        "zoning_envelope": {...},
        "recommended_building": {
            "floors": 12,
            "footprint": [[x,y], ...],
            "parking_location": "parcel_125"
        }
    }
}
```

### 2. 3D Editor → Cost Optimization
```javascript
// Real-time during 3D design
WebSocket connection to /api/v1/design/optimize

User changes building height:
→ Client sends: { floors: 14, units: 336 }
→ Server responds: {
    cost_per_unit: 325000,
    efficiency: 0.84,
    warnings: ["Approaching cost inflection point"],
    suggestions: ["Stop at 12 floors for optimal cost/unit"]
}
```

### 3. 3D Design → Market Forecast
```javascript
// User clicks "Market Impact" in 3D editor
POST /api/v1/projects/456/market-impact
{
    "finalized_design": {
        "units": 320,
        "completion_date": "2027-Q3"
    }
}

Response:
{
    "submarket_pipeline": [...],
    "your_project_impact": 3.2,  // % of market
    "competitive_risk": "LOW",
    "recommendations": [...]
}
```

---

## Database Schema: Tying It All Together

```sql
-- Projects table: Central hub
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    submarket_id INTEGER,
    status VARCHAR(50),  -- 'searching', 'analyzing', 'designing', 'approved'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link projects to parcels
CREATE TABLE project_parcels (
    project_id INTEGER REFERENCES projects(id),
    parcel_id INTEGER REFERENCES properties(id),
    role VARCHAR(50),  -- 'primary', 'assemblage', 'parking_arbitrage'
    acquisition_cost DECIMAL(12,2),
    PRIMARY KEY (project_id, parcel_id)
);

-- Store 3D designs
CREATE TABLE project_designs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    version INTEGER,
    design_json JSONB,  -- 3D model data
    units INTEGER,
    floors INTEGER,
    parking_strategy VARCHAR(50),
    estimated_cost DECIMAL(12,2),
    efficiency_score DECIMAL(4,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link designs to analyses
CREATE TABLE design_analyses (
    id SERIAL PRIMARY KEY,
    design_id INTEGER REFERENCES project_designs(id),
    analysis_type VARCHAR(50),  -- 'capacity', 'cost', 'market_impact'
    result_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track workflow progression
CREATE TABLE project_workflow (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    step VARCHAR(50),  -- 'land_search', 'analysis', 'design', 'forecast'
    completed_at TIMESTAMP,
    data_snapshot JSONB
);
```

---

## UI/UX Integration

### Dashboard View:
```
┌────────────────────────────────────────────────────┐
│ MY PROJECTS                                        │
├────────────────────────────────────────────────────┤
│                                                    │
│ 🚧 Buckhead Tower - In Design Phase               │
│    520 units | 3 parcels | $92M total            │
│    [●●●●○] Land → Analysis → Design → Forecast    │
│    Next: Finalize 3D design                       │
│    [Continue Design]                              │
│                                                    │
│ 🔍 Midtown Search - Finding Land                  │
│    Target: 300 units | Budget: $40M              │
│    [●○○○○] Land → Analysis → Design → Forecast    │
│    Next: Review parcel recommendations            │
│    [View Options]                                 │
│                                                    │
│ [+ New Project]                                   │
└────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Week 3 (Current):
1. ✅ Build strategic features engines
2. ✅ Create API endpoints
3. ⏳ Basic UI for parcel recommendations

### Week 4:
1. ⏳ 3D editor integration (WebSocket for real-time)
2. ⏳ Project workflow database
3. ⏳ Dashboard UI

### Week 5:
1. ⏳ Market forecast integration
2. ⏳ Full end-to-end workflow testing
3. ⏳ Polish UX

---

## Technical Stack for 3D Editor

**Recommendation:**

**Frontend:**
- Three.js or Babylon.js for 3D rendering
- React Three Fiber (if using React)
- Real-time WebSocket connection to backend

**Backend:**
- FastAPI WebSocket endpoints for live optimization
- Celery for background analysis tasks
- Redis for caching repeated calculations

**Data Flow:**
```
User drags building in 3D
  → WebSocket sends coordinates
  → Backend validates against zoning
  → Backend calculates cost impact
  → Response <100ms
  → UI updates live feedback
```

---

## Next Steps

1. **Complete strategic features** (in progress, 2-3 hours)
2. **Design 3D editor API contract** (define WebSocket protocol)
3. **Build prototype 3D editor** (basic Three.js demo, 1-2 days)
4. **Integrate workflow database** (connect all phases, 4-6 hours)
5. **End-to-end testing** (full user journey, 1 day)

---

**Created:** 2026-02-03
**Status:** Architecture defined, ready to implement
**Priority:** HIGH - Core platform integration
