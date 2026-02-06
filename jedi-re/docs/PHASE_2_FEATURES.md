# JEDI RE - Phase 2 Feature Backlog

## Development Capacity Analyzer
**Priority:** HIGH - Major differentiator

### Concept
Move beyond "announced pipeline" to **total development capacity** - what COULD be built over the next 10 years based on zoning + available land.

### What It Does
Analyzes each parcel in a submarket to calculate:
- **Maximum allowed units** (based on zoning rules)
- **Current development** (what's built now)
- **Development capacity** (what could still be added)
- **Categorization:**
  - Vacant developable (greenfield)
  - Underbuilt redevelopment potential
  - Built out (no capacity)

### Output
Enhanced supply forecast:
```
SHORT-TERM SUPPLY (0-2 years):
- Existing: 11,240 units
- Pipeline: 2,260 units
- Total: 13,500 units

LONG-TERM CAPACITY (2-10 years):
- Vacant developable: 2,400 units
- Redevelopment potential: 1,200 units
- Total capacity: 3,600 units

10-YEAR FORECAST: 17,100 units possible
Buildout timeline: 8.5 years at current absorption
```

### Data Requirements

**Core Data:**
1. **Parcel boundaries** (GIS polygons)
2. **Zoning codes** per parcel (R-5, MF-2, C-3, etc.)
3. **Zoning rules** (density limits, FAR, height, setbacks)
4. **Current development** (what's on each parcel today)

**Data Sources:**

**Option 1: Municipal Open Data (FREE)**
- Atlanta: https://gis.atlantaga.gov
- Austin: https://data.austintexas.gov
- Miami: https://gis-mdc.opendata.arcgis.com
- Most major cities publish parcel + zoning data

**Option 2: Commercial Providers**
- Regrid (parcel + zoning) - $$
- CoreLogic (property + parcel) - $$$
- Lightbox (zoning intelligence) - $$$

**Option 3: Scraped/Parsed Zoning Ordinances**
- Parse city PDFs for density rules
- Build "zoning dictionary" per city
- More manual but cheaper

### Implementation Approach

**Method Engine:**
```python
class DevelopmentCapacityEngine:
    def calculate_max_units(self, parcel, zoning_code):
        """Calculate maximum allowed units based on zoning"""
        rules = self.zoning_rules[zoning_code]
        
        if rules.type == 'density_based':
            # Units per acre (e.g., R-5 = 5 units/acre)
            return parcel.acres * rules.density_per_acre
        
        elif rules.type == 'far_based':
            # Floor Area Ratio (e.g., FAR 3.0)
            buildable_sqft = parcel.lot_size_sqft * rules.FAR
            return buildable_sqft / rules.avg_unit_size
        
        elif rules.type == 'lot_size':
            # Minimum lot size per unit
            return parcel.lot_size_sqft / rules.min_lot_per_unit
    
    def analyze_submarket(self, submarket_id):
        """Aggregate capacity across all parcels"""
        parcels = get_parcels(submarket_id)
        
        total_capacity = 0
        vacant_capacity = 0
        redevelopment_capacity = 0
        
        for parcel in parcels:
            capacity = self.analyze_parcel(parcel)
            total_capacity += capacity.units
            
            if parcel.vacant:
                vacant_capacity += capacity.units
            elif capacity.units > 0:
                redevelopment_capacity += capacity.units
        
        return {
            'total_capacity': total_capacity,
            'vacant_developable': vacant_capacity,
            'redevelopment_potential': redevelopment_capacity,
            'buildout_years': self.estimate_buildout(total_capacity)
        }
```

**Database Schema:**
```sql
-- Parcels table
CREATE TABLE parcels (
    id SERIAL PRIMARY KEY,
    submarket_id INTEGER REFERENCES submarkets(id),
    parcel_id VARCHAR(50),  -- City parcel ID
    
    -- Geographic
    boundary GEOGRAPHY(POLYGON),
    lot_size_sqft DECIMAL(12, 2),
    acres DECIMAL(10, 4),
    
    -- Zoning
    zoning_code VARCHAR(20),
    zoning_description TEXT,
    
    -- Current development
    existing_units INTEGER DEFAULT 0,
    existing_use VARCHAR(100),
    year_built INTEGER,
    
    -- Calculated capacity
    max_units_allowed INTEGER,
    development_capacity INTEGER,
    capacity_category VARCHAR(50),  -- 'vacant', 'underbuilt', 'built_out'
    
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Zoning rules table (one row per zoning code per city)
CREATE TABLE zoning_rules (
    id SERIAL PRIMARY KEY,
    city VARCHAR(100),
    state VARCHAR(2),
    zoning_code VARCHAR(20),
    
    -- Rule type
    rule_type VARCHAR(50),  -- 'density_based', 'far_based', 'lot_size'
    
    -- Density rules
    density_per_acre DECIMAL(8, 2),
    
    -- FAR rules
    max_far DECIMAL(4, 2),
    avg_unit_size_sqft INTEGER,
    
    -- Lot size rules
    min_lot_per_unit INTEGER,
    
    -- Additional constraints
    max_height_feet INTEGER,
    min_setback_feet INTEGER,
    
    -- Metadata
    source TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(city, state, zoning_code)
);
```

**UI Enhancement:**
- New tab: "Development Capacity"
- Map showing color-coded parcels:
  - 🟢 Green = vacant, developable
  - 🟡 Yellow = underbuilt, redevelopment potential
  - 🔴 Red = built out
- Table showing top redevelopment opportunities
- 10-year supply forecast chart

### Phased Rollout

**Phase 2A: Single City Proof of Concept (1-2 months)**
1. Choose Atlanta as test market
2. Download Atlanta parcel GIS data (free)
3. Manually code Atlanta zoning rules for common codes
4. Build Development Capacity Engine
5. Run analysis on Buckhead
6. Validate with local brokers/developers

**Phase 2B: Multi-City Expansion (2-4 months)**
7. Add Austin, Miami, Charlotte
8. Build zoning rule scraper/parser
9. Automate parcel data ingestion
10. Create zoning rule database

**Phase 2C: Full Platform Integration (1-2 months)**
11. Integrate with Supply Signal (short-term + long-term)
12. Add to UI (maps, charts, tables)
13. Build "Development Opportunity Alerts" feature

### Why This Matters

**Market Gap:**
- CoStar shows "pipeline" (announced projects only)
- Reonomy shows ownership but not capacity
- Nobody aggregates total development capacity at scale

**Use Cases:**
1. **Investors:** "Should I buy here? Will it get oversupplied in 5 years?"
2. **Developers:** "Where are the best redevelopment opportunities?"
3. **Lenders:** "What's the long-term supply risk for this market?"

**Competitive Advantage:**
This is a **10-year forecast** vs competitors' **2-year pipeline**. Massive edge for long-term investors.

---

## Other Phase 2 Features

### Game Theory Engine
- Concession equilibrium modeling
- Pricing strategy optimizer
- Competitive response simulator

### Network Science
- Ownership graph analysis
- Super-connector identification (who gets deals first)
- Quiet accumulation detection

### Enhanced UI
- Interactive charts (Chart.js or Recharts)
- Raw data tables (expandable sections)
- Export to CSV/Excel
- PDF report generation

### Data Integrations
- CoStar API (when Leon gets access)
- PM software APIs (AppFolio, Yardi, RealPage)
- Google Trends automation
- Census API automation

---

**Created:** 2026-02-02  
**Priority:** Development Capacity = HIGH, Others = MEDIUM  
**Target Start:** After MVP complete + CoStar integration
