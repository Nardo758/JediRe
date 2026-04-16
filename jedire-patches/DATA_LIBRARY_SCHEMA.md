# Data Library - Structured Asset Schema

## Purpose

Enable AI agents to identify **like-kind comps** by organizing deal data around structured asset characteristics.

## Core Asset Attributes

```sql
CREATE TABLE data_library_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source Reference
  deal_id UUID REFERENCES deals(id),           -- NULL if external comp
  source_type VARCHAR(50) NOT NULL,            -- 'owned_deal', 'market_comp', 'broker_om', 'costar', 'manual'
  
  -- ═══════════════════════════════════════════════════════════════════
  -- LOCATION (Primary Comp Filter)
  -- ═══════════════════════════════════════════════════════════════════
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  county VARCHAR(100),
  
  -- Geographic hierarchy
  msa_id INTEGER REFERENCES msas(id),
  msa_name VARCHAR(255),
  submarket_id INTEGER REFERENCES submarkets(id),
  submarket_name VARCHAR(255),
  
  -- Coordinates
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- ═══════════════════════════════════════════════════════════════════
  -- PHYSICAL CHARACTERISTICS (Like-Kind Matching)
  -- ═══════════════════════════════════════════════════════════════════
  
  -- Property Type
  property_type VARCHAR(50),                   -- 'multifamily', 'btr', 'student', 'senior', 'affordable'
  property_subtype VARCHAR(50),                -- 'garden', 'wrap', 'podium', 'tower'
  
  -- Vintage
  year_built INTEGER,
  year_renovated INTEGER,
  vintage_tier VARCHAR(20),                    -- 'pre-1980', '1980-1999', '2000-2009', '2010-2019', '2020+'
  
  -- Size
  unit_count INTEGER,
  net_rentable_sqft INTEGER,
  avg_unit_sqft INTEGER,
  lot_size_acres DECIMAL(10, 2),
  
  -- Height/Density
  stories INTEGER,
  height_class VARCHAR(20),                    -- 'garden' (1-3), 'low-rise' (4-6), 'mid-rise' (7-12), 'high-rise' (13+)
  density_units_per_acre DECIMAL(10, 2),
  
  -- Construction
  construction_type VARCHAR(50),               -- 'wood-frame', 'concrete', 'steel', 'masonry'
  parking_type VARCHAR(50),                    -- 'surface', 'garage', 'podium', 'tuck-under'
  parking_ratio DECIMAL(4, 2),
  
  -- Unit Mix
  unit_mix JSONB,                              -- {studio: 10, 1br: 50, 2br: 35, 3br: 5}
  avg_bedrooms DECIMAL(3, 2),
  
  -- ═══════════════════════════════════════════════════════════════════
  -- CLASS & QUALITY
  -- ═══════════════════════════════════════════════════════════════════
  asset_class VARCHAR(5),                      -- 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'
  finish_level VARCHAR(20),                    -- 'luxury', 'upscale', 'standard', 'value'
  
  -- Amenities (affect class/rent)
  amenities JSONB,                             -- {pool: true, fitness: true, clubhouse: true, ...}
  amenity_score INTEGER,                       -- Computed 0-100
  
  -- ═══════════════════════════════════════════════════════════════════
  -- OPERATIONS
  -- ═══════════════════════════════════════════════════════════════════
  management_company VARCHAR(255),
  owner_operator VARCHAR(255),
  ownership_type VARCHAR(50),                  -- 'institutional', 'private', 'reit', 'syndicator'
  
  -- ═══════════════════════════════════════════════════════════════════
  -- FINANCIAL DATA (Comp Metrics)
  -- ═══════════════════════════════════════════════════════════════════
  
  -- Rent Data
  avg_rent DECIMAL(10, 2),
  avg_rent_psf DECIMAL(10, 4),
  rent_by_unit_type JSONB,                     -- {studio: 1200, 1br: 1450, 2br: 1800, ...}
  rent_as_of_date DATE,
  
  -- Occupancy
  occupancy_rate DECIMAL(5, 2),
  occupancy_as_of_date DATE,
  
  -- NOI
  noi DECIMAL(15, 2),
  noi_per_unit DECIMAL(10, 2),
  noi_as_of_date DATE,
  
  -- Transaction Data (if sold)
  sale_price DECIMAL(15, 2),
  sale_date DATE,
  price_per_unit DECIMAL(10, 2),
  price_per_sqft DECIMAL(10, 2),
  cap_rate DECIMAL(5, 4),
  
  -- ═══════════════════════════════════════════════════════════════════
  -- METADATA
  -- ═══════════════════════════════════════════════════════════════════
  data_quality_score INTEGER,                  -- 0-100, how complete is this record
  last_verified_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes for comp queries
CREATE INDEX idx_dla_location ON data_library_assets(msa_id, submarket_id);
CREATE INDEX idx_dla_vintage ON data_library_assets(year_built, vintage_tier);
CREATE INDEX idx_dla_size ON data_library_assets(unit_count);
CREATE INDEX idx_dla_stories ON data_library_assets(stories, height_class);
CREATE INDEX idx_dla_class ON data_library_assets(asset_class);
CREATE INDEX idx_dla_type ON data_library_assets(property_type, property_subtype);
CREATE INDEX idx_dla_coords ON data_library_assets USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
```

---

## Like-Kind Comp Matching Algorithm

### Primary Filters (Must Match)
```sql
WHERE msa_id = :target_msa                    -- Same market
  AND property_type = :target_type            -- Same product type
```

### Secondary Filters (Similarity Scoring)
```sql
-- Vintage (±10 years preferred)
CASE 
  WHEN ABS(year_built - :target_year) <= 5 THEN 100
  WHEN ABS(year_built - :target_year) <= 10 THEN 80
  WHEN ABS(year_built - :target_year) <= 15 THEN 50
  ELSE 20
END as vintage_score,

-- Size (±30% preferred)
CASE
  WHEN unit_count BETWEEN :target_units * 0.7 AND :target_units * 1.3 THEN 100
  WHEN unit_count BETWEEN :target_units * 0.5 AND :target_units * 1.5 THEN 70
  ELSE 30
END as size_score,

-- Height class (exact match preferred)
CASE
  WHEN height_class = :target_height THEN 100
  WHEN stories BETWEEN :target_stories - 2 AND :target_stories + 2 THEN 70
  ELSE 30
END as height_score,

-- Class (same or adjacent)
CASE
  WHEN asset_class = :target_class THEN 100
  WHEN ABS(class_rank(:asset_class) - class_rank(:target_class)) = 1 THEN 70
  ELSE 30
END as class_score,

-- Distance (closer is better)
CASE
  WHEN ST_DistanceSphere(geom, :target_geom) <= 1609 THEN 100  -- 1 mile
  WHEN ST_DistanceSphere(geom, :target_geom) <= 4828 THEN 80   -- 3 miles
  WHEN ST_DistanceSphere(geom, :target_geom) <= 8046 THEN 60   -- 5 miles
  ELSE 40
END as proximity_score
```

### Composite Similarity Score
```sql
SELECT *,
  (vintage_score * 0.20 +
   size_score * 0.15 +
   height_score * 0.15 +
   class_score * 0.25 +
   proximity_score * 0.25) as similarity_score
FROM data_library_assets
WHERE msa_id = :target_msa
  AND property_type = :target_type
ORDER BY similarity_score DESC
LIMIT 20;
```

---

## Asset Characteristics Hierarchy

```
LOCATION
├── MSA (Tampa-St. Petersburg)
│   └── Submarket (Channelside, South Tampa, etc.)
│       └── Zip/Neighborhood
│
PHYSICAL
├── Property Type (Multifamily)
│   └── Subtype (Garden, Wrap, Podium, Tower)
├── Vintage
│   └── Year Built → Vintage Tier
├── Size
│   └── Units, SF, Density
├── Height
│   └── Stories → Height Class
└── Construction
    └── Type, Parking
│
QUALITY
├── Asset Class (A/B/C)
├── Finish Level
└── Amenity Score
│
OPERATIONS
├── Management Company
├── Owner Type
└── Performance Metrics
│
FINANCIALS
├── Rents (avg, by type)
├── Occupancy
├── NOI
└── Sale Price / Cap Rate
```

---

## Data Entry Sources

### 1. From Owned Deals (Auto-Populated)
```
When deal closes:
  → Extract from deal_data JSONB
  → Extract from pro forma
  → Extract from rent roll
  → Insert into data_library_assets
```

### 2. From Document Parsing (AI-Extracted)
```
Upload OM/Rent Roll:
  → AI extracts: units, rents, year built, etc.
  → User confirms/corrects
  → Insert into data_library_assets
```

### 3. From CoStar/Market Sources (API)
```
Scheduled sync:
  → Fetch comps in target markets
  → Insert with source_type = 'costar'
```

### 4. Manual Entry
```
User adds comp manually:
  → Form with required fields
  → Insert with source_type = 'manual'
```

---

## UI: Data Library Asset View

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DATA LIBRARY                                          [+ Add Asset]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FILTERS                                                                │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┬───────────┐ │
│  │ Market ▼    │ Type ▼      │ Vintage ▼   │ Class ▼     │ Stories ▼ │ │
│  │ Tampa MSA   │ Multifamily │ 2015-2020   │ B+, B       │ 3-5       │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┴───────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ RESULTS: 47 assets                              [Grid] [Map] [List] ││
│  ├─────────────────────────────────────────────────────────────────────┤│
│  │ NAME              SUBMARKET    UNITS  YR   CLASS  AVG RENT  CAP    ││
│  │ ─────────────────────────────────────────────────────────────────  ││
│  │ The Vue @ Harbor  Channelside   284  2018   B+    $1,892   4.8%   ││
│  │ Parkside Flats    Westshore     196  2017   B     $1,654   5.1%   ││
│  │ Marina Pointe     Davis Island  152  2019   B+    $2,105   4.6%   ││
│  │ ...                                                                ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Query Examples

### Find Rent Comps
```
Agent: ResearchAgent
Query: "Find rent comps for 200-unit, 2018 garden-style B+ in Tampa"

SQL:
SELECT * FROM data_library_assets
WHERE msa_name = 'Tampa-St. Petersburg'
  AND property_type = 'multifamily'
  AND property_subtype = 'garden'
  AND unit_count BETWEEN 150 AND 250
  AND year_built BETWEEN 2015 AND 2021
  AND asset_class IN ('B+', 'B', 'A-')
  AND avg_rent IS NOT NULL
ORDER BY similarity_score DESC
LIMIT 10;
```

### Find Sale Comps
```
Agent: StrategyAgent
Query: "Recent sales of mid-rise multifamily in Atlanta"

SQL:
SELECT * FROM data_library_assets
WHERE msa_name ILIKE '%Atlanta%'
  AND property_type = 'multifamily'
  AND height_class = 'mid-rise'
  AND sale_date >= NOW() - INTERVAL '24 months'
ORDER BY sale_date DESC
LIMIT 15;
```

### Suggest Pro Forma Assumptions
```
Agent: UnderwritingAgent
Query: "What rent should I assume for 2BR in Channelside?"

SQL:
SELECT 
  AVG(rent_by_unit_type->>'2br')::DECIMAL as avg_2br_rent,
  MIN(rent_by_unit_type->>'2br')::DECIMAL as min_2br_rent,
  MAX(rent_by_unit_type->>'2br')::DECIMAL as max_2br_rent,
  COUNT(*) as sample_size
FROM data_library_assets
WHERE submarket_name = 'Channelside'
  AND rent_as_of_date >= NOW() - INTERVAL '6 months'
  AND rent_by_unit_type->>'2br' IS NOT NULL;
```

---

## Implementation Plan

### Phase 1: Schema & Migration
1. Create `data_library_assets` table
2. Create indexes for comp queries
3. Add PostGIS extension for geo queries

### Phase 2: Auto-Population
4. Trigger on deal close → insert asset
5. Extract from pro forma/rent roll
6. Backfill from existing deals

### Phase 3: UI
7. Filters panel in DataLibraryPage
8. Grid/Map/List views
9. Asset detail modal

### Phase 4: Agent Integration
10. Comp query functions for agents
11. "Find comps" action in Deal Capsule
12. Pro forma suggestions based on comps
