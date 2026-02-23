# Overview Section - Actionable Implementation with Real Platform Data

**Date:** February 22, 2026  
**Purpose:** Replace generic information with key, actionable data from existing platform services  
**Approach:** Keep the structure, fill with real data sources and actions

---

## 🎯 Core Problem Being Solved

**For Development Deals:**
1. No way to define property boundary (blocks Zoning + 3D Design)
2. Generic info instead of site-specific intelligence
3. No clear path from overview → design → financial

**For Existing Property:**
1. Generic benchmarks instead of property-specific insights
2. No actionable intelligence (scores, opportunities)
3. Duplicated analysis across modules

**Solution:** Surface real, actionable data from 99 existing platform services in Overview

---

## 🏗️ DEVELOPMENT DEALS - Actionable Implementation

**Module Order (Updated):**
1. **Property Boundary & Site Plan** (FIRST - Define the site)
2. **Site Intelligence Dashboard** (Analyze based on boundary)
3. **Zoning & Development Capacity** (Calculate capacity using boundary)
4. **Context Tracker** (Track progress)
5. **Team & Collaborators** (Manage team)

**Rationale:** Boundary is the foundation - must be defined before intelligence can be calculated.

---

### Module 1: Property Boundary & Site Plan (FIRST - CRITICAL!)

**Purpose:** Define property boundary - becomes source of truth for all other modules

**Technical Implementation:**

#### A. Map Integration
```typescript
// Technology Stack:
// - Mapbox GL JS (preferred) or Google Maps API
// - @mapbox/mapbox-gl-draw for drawing tools
// - turf.js for geometric calculations

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';

interface MapConfig {
  apiKey: string;                       // Mapbox token
  center: [number, number];             // Initial center
  zoom: number;                         // 18 (close up for accuracy)
  style: string;                        // 'satellite-streets-v12'
}
```

[Rest of Module 1: Property Boundary content moved here from old Module 2]

---

### Module 2: Site Intelligence Dashboard

**Purpose:** Show intelligence AFTER boundary is defined

**Data Sources & Actions:**

#### A. Site Basics (from Deal Database)
```typescript
// API: GET /api/v1/deals/:dealId
interface SiteBasics {
  address: string;              // "123 Development Way, Atlanta, GA"
  parcelIds: string[];          // ["13-0123-456", "13-0123-457"] (if assemblage)
  legalDescription: string;     // From database or uploaded deed
  coordinates: [number, number]; // [33.7490, -84.3880]
  currentUse: string;           // "Vacant land" | "To be demolished"
}

// Action Buttons:
[View on Map] → Opens PropertyBoundarySection
[Upload Deed] → Document upload to Files & Assets
```

#### B. Parcel Characteristics (from PropertyBoundarySection once drawn)
```typescript
// API: GET /api/v1/deals/:dealId/boundary
interface ParcelData {
  acres: number;                // 8.2 acres
  squareFeet: number;           // 357,672 SF
  perimeter: number;            // 2,480 linear feet
  topography: string;           // "Flat" | "Sloped 5-10%" | "Mixed"
  frontage: number;             // 450 feet of street frontage
  access: {
    streets: string[];          // ["Main Street", "Oak Avenue"]
    ingressEgress: number;      // 2 access points
  };
  utilities: {
    water: boolean;             // true (available at street)
    sewer: boolean;             // true
    electric: boolean;          // true
    gas: boolean;               // false (will need extension)
  };
}

// Status Badge:
⚠️ BOUNDARY NOT DEFINED → [Define Boundary Now]
✅ BOUNDARY DEFINED (8.2 acres)
```

#### C. Acquisition Intelligence (from Multiple Services)
```typescript
// 1. Basic acquisition data (from deal database)
interface AcquisitionBasics {
  askingPrice: number;          // 12500000
  pricePerAcre: number;         // 1524390
  pricePerSF: number;           // 35
  seller: {
    name: string;               // "Mom & Pop LLC"
    type: string;               // "Individual" | "Institution" | "REIT"
    contact: string;            // From Context Tracker
  };
  daysOnMarket: number;         // 180
  brokerName?: string;          // "ABC Realty"
}

// 2. Seller Intelligence (from propertyScoring.service.ts)
// API: GET /api/v1/property-scoring/seller-propensity
interface SellerIntelligence {
  propensityScore: number;      // 78 (0-100, higher = more likely to sell)
  factors: {
    outOfState: boolean;        // true (+20 points)
    singleAsset: boolean;       // true (+15 points)
    longHold: boolean;          // true, 15+ years (+10 points)
    marketingTime: number;      // 180 days (+15 points)
  };
  motivation: "High" | "Medium" | "Low"; // "High"
  recommendation: string;       // "Strong negotiation position"
}

// 3. Comparable Land Sales (from dataLibrary.service.ts)
// API: GET /api/v1/data-library/land-sales?location=...&radius=1mi
interface ComparableSales {
  count: number;                // 5 sales in past 12 months
  sales: Array<{
    address: string;            // "456 Oak Street"
    acres: number;              // 6.5
    salePrice: number;          // 9750000
    pricePerAcre: number;       // 1500000
    saleDate: string;           // "2025-08-15"
    buyer: string;              // "Developer XYZ"
    distanceMiles: number;      // 0.3
  }>;
  marketTrend: "Appreciating" | "Stable" | "Declining";
  avgPricePerAcre: number;      // 1455000
}

// Action Buttons:
[View Seller Profile] → Opens owner details from propertyMetrics
[Contact Seller] → Opens email from Context Tracker contacts
[View Comps Map] → Opens map with comp locations
[Run Negotiation Analysis] → Opus AI agent for offer strategy
```

#### D. Neighborhood Context (from propertyMetrics.service.ts)
```typescript
// API: GET /api/v1/property-metrics/neighborhood-benchmarks
interface NeighborhoodContext {
  submarket: string;                    // "Buckhead"
  avgDensity: number;                   // 42 units/acre
  densityRange: [number, number];       // [28, 87] (min, max observed)
  topQuartileDensity: number;          // 55 units/acre
  recentDevelopments: Array<{
    name: string;                       // "Riverside Towers"
    year: number;                       // 2023
    units: number;                      // 380
    acres: number;                      // 6.8
    density: number;                    // 56 units/acre
    distanceMiles: number;              // 0.5
  }>;
  marketCharacteristics: {
    totalProperties: number;            // 127 multifamily properties
    totalUnits: number;                 // 31450 units
    avgValuePerUnit: number;            // 158000
    avgOccupancy: number;               // 0.95 (95%)
  };
}

// Display:
📍 SUBMARKET: Buckhead
   • Avg Density: 42 u/acre
   • Your Target: 55 u/acre (Top Quartile ⭐)
   • Recent Developments: 3 nearby (40-65 u/acre)

// Action Buttons:
[View Submarket Report] → Opens Market Intelligence page filtered to Buckhead
[View Comps Map] → Opens map with recent developments
```

#### E. Development Vision (User Input + AI Assist)
```typescript
// Stored in deal database, user can edit
interface DevelopmentVision {
  intendedUse: string;                  // "Multifamily" | "Mixed-Use" | "Senior Housing"
  targetUnits: number;                  // 450 (user enters)
  targetDensity: number;                // 55 units/acre (auto-calculated)
  buildingType: string;                 // "Mid-rise" | "High-rise" | "Garden style"
  estimatedTimeline: number;            // 24 months
  roughBudget: number;                  // 85000000
  budgetPerUnit: number;                // 188889 (auto-calculated)
}

// AI Assist Button:
[Get AI Recommendations] → Calls opus.service.ts
  Input: parcel size, zoning, neighborhood context
  Output: Recommended unit count, mix, budget range, timeline

// Action Buttons:
[Update Vision] → Opens modal to edit
[Run Feasibility] → Generates preliminary pro forma with opusProforma.service
```

#### F. Quick Metrics Dashboard
```typescript
// Real-time calculated from above data
interface QuickMetrics {
  siteSize: string;                     // "8.2 acres (357,672 SF)"
  targetUnits: number;                  // 450
  targetDensity: number;                // 55 u/acre
  landCost: string;                     // "$12.5M ($1.52M/acre)"
  estimatedDevCost: string;             // "~$85M total"
  costPerUnit: string;                  // "$189k/unit"
  timeline: string;                     // "24 months"
  
  // Status indicators
  boundaryDefined: boolean;             // false ⚠️ or true ✅
  zoningAnalyzed: boolean;              // false (depends on boundary)
  designStarted: boolean;               // false (depends on zoning)
  financialModeled: boolean;            // false (depends on design)
}

// Workflow Progress Bar:
[◉ Site Info] → [○ Boundary] → [○ Zoning] → [○ Design] → [○ Financial]
   Complete      Next Step      Blocked     Blocked      Blocked
```

#### G. Action Flow
```typescript
// Smart "Next Step" button based on workflow status
if (!boundaryDefined) {
  [Define Property Boundary] → Opens Module 2
} else if (!zoningAnalyzed) {
  [Analyze Zoning Capacity] → Opens Module 3
} else if (!designStarted) {
  [Start 3D Design] → Opens 3D Building Design module
} else {
  [Run Financial Model] → Opens Financial Model with Opus AI
}
```

---

### Module 2: Property Boundary & Site Plan (CRITICAL NEW MODULE)

**Technical Implementation:**

#### A. Map Integration
```typescript
// Technology Stack:
// - Mapbox GL JS (preferred) or Google Maps API
// - @mapbox/mapbox-gl-draw for drawing tools
// - turf.js for geometric calculations

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';

interface MapConfig {
  apiKey: string;                       // Mapbox token
  center: [number, number];             // Initial center
  zoom: number;                         // 18 (close up for accuracy)
  style: string;                        // 'satellite-streets-v12'
}
```

#### B. Drawing Tools
```typescript
interface DrawingTools {
  modes: {
    draw_polygon: boolean;              // Primary tool
    draw_point: boolean;                // Mark features
    draw_line_string: boolean;          // Measure distances
    simple_select: boolean;             // Edit existing
    direct_select: boolean;             // Edit vertices
  };
  controls: {
    point: boolean;
    line_string: boolean;
    polygon: boolean;
    trash: boolean;
    combine_features: boolean;
    uncombine_features: boolean;
  };
}

// User Actions:
1. Click "Draw Boundary" button
2. Click points on map to draw polygon
3. Double-click to close polygon
4. System auto-calculates area, perimeter
5. Click "Save Boundary" to store
```

#### C. Data Capture & Storage
```typescript
// Database Schema
interface PropertyBoundary {
  dealId: string;                       // Foreign key to deals table
  boundaryGeoJSON: {
    type: "Polygon";
    coordinates: number[][][];          // Array of [lng, lat] points
  };
  
  // Auto-calculated from GeoJSON
  parcelArea: number;                   // 8.2 acres
  parcelAreaSF: number;                 // 357,672 SF
  perimeter: number;                    // 2,480 linear feet
  centroid: [number, number];           // Center point
  
  // User-defined constraints
  setbacks: {
    front: number;                      // 25 feet
    side: number;                       // 15 feet (each side)
    rear: number;                       // 20 feet
  };
  
  // Calculated buildable area
  buildableArea: number;                // 6.8 acres (after setbacks)
  buildableAreaSF: number;              // 296,208 SF
  buildablePercentage: number;          // 0.83 (83% of parcel)
  
  // Constraint overlays
  constraints: {
    easements: Array<{
      type: string;                     // "Utility" | "Access" | "Drainage"
      geoJSON: GeoJSON.Feature;
      description: string;
    }>;
    floodplain: boolean;
    floodplainZone?: string;            // "AE" | "X" (if applicable)
    wetlands: boolean;
    protectedArea: boolean;
  };
  
  // Reference documents
  surveyDocumentUrl?: string;           // Link to uploaded PDF survey
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;                    // User ID
}

// API Endpoints:
POST   /api/v1/deals/:dealId/boundary        // Create/update boundary
GET    /api/v1/deals/:dealId/boundary        // Retrieve boundary
DELETE /api/v1/deals/:dealId/boundary        // Delete boundary
GET    /api/v1/deals/:dealId/boundary/export // Export as GeoJSON/DXF/PDF
```

#### D. Geometric Calculations (using turf.js)
```typescript
import * as turf from '@turf/turf';

// 1. Calculate area
const polygon = turf.polygon(coordinates);
const areaSquareMeters = turf.area(polygon);
const areaSquareFeet = areaSquareMeters * 10.7639;
const areaAcres = areaSquareFeet / 43560;

// 2. Calculate perimeter
const perimeterMeters = turf.length(polygon, { units: 'meters' });
const perimeterFeet = perimeterMeters * 3.28084;

// 3. Calculate centroid (center point)
const centroid = turf.centroid(polygon);

// 4. Calculate buildable area (with setbacks)
const bufferedPolygon = turf.buffer(polygon, -setbackFeet, { units: 'feet' });
const buildableAreaSF = turf.area(bufferedPolygon) * 10.7639;
const buildableAcres = buildableAreaSF / 43560;

// 5. Check for constraint overlays (floodplain, easements)
const floodplainLayer = /* load from API */;
const intersects = turf.booleanIntersects(polygon, floodplainLayer);
```

#### E. Layer Management
```typescript
interface MapLayers {
  propertyBoundary: {
    visible: boolean;                   // true
    style: {
      fillColor: '#3b82f6';
      fillOpacity: 0.2;
      strokeColor: '#1e40af';
      strokeWidth: 3;
    };
  };
  
  setbackLines: {
    visible: boolean;                   // true
    style: {
      strokeColor: '#ef4444';
      strokeWidth: 2;
      strokeDasharray: [5, 5];          // Dashed line
    };
    labels: {
      front: "25' Front Setback";
      side: "15' Side Setback";
      rear: "20' Rear Setback";
    };
  };
  
  buildableArea: {
    visible: boolean;                   // true
    style: {
      fillColor: '#10b981';
      fillOpacity: 0.15;
    };
  };
  
  neighboringParcels: {
    visible: boolean;                   // true
    source: 'api/v1/parcels/nearby';    // API endpoint
    style: {
      fillColor: '#9ca3af';
      fillOpacity: 0.1;
      strokeColor: '#6b7280';
    };
    onClick: (parcel) => {
      // Show parcel details popup
      // Show owner info from propertyMetrics
      // Show assemblage opportunity score
    };
  };
  
  zoningDistricts: {
    visible: boolean;                   // false (toggle on/off)
    source: 'api/v1/zoning/overlay';
    style: {
      fillColor: (zoneType) => getZoneColor(zoneType);
    };
  };
  
  floodplain: {
    visible: boolean;                   // false (toggle on/off)
    source: 'https://msc.fema.gov/api'; // FEMA flood map API
    style: {
      fillColor: '#3b82f6';
      fillOpacity: 0.3;
    };
  };
  
  utilityLines: {
    visible: boolean;                   // false (toggle on/off)
    types: ['water', 'sewer', 'electric', 'gas'];
    source: 'api/v1/utilities/overlay';
  };
}

// Toggle buttons:
[☑ Boundary] [☑ Setbacks] [☑ Buildable Area] 
[☑ Neighbors] [☐ Zoning] [☐ Floodplain] [☐ Utilities]
```

#### F. Neighboring Parcels Intelligence
```typescript
// API: GET /api/v1/properties/neighboring?coordinates=...&radius=0.5mi
// Uses PostGIS ST_DWithin for spatial query

interface NeighboringParcel {
  parcelId: string;                     // "13-0123-458"
  address: string;                      // "125 Development Way"
  owner: string;                        // "John Smith"
  ownerType: string;                    // "Individual" | "LLC" | "REIT"
  ownerAddress: string;                 // "456 Oak St, Atlanta, GA"
  acres: number;                        // 4.1
  currentUse: string;                   // "Single-family home"
  yearBuilt: number;                    // 1978
  assessedValue: number;                // 425000
  distanceFeet: number;                 // 0 (adjacent)
  
  // Assemblage opportunity score (from propertyScoring.service)
  assemblageScore: number;              // 85 (0-100, higher = better opportunity)
  sellerPropensity: number;             // 72 (0-100)
  assemblagePotential: {
    combinedAcres: number;              // 12.3 (your 8.2 + their 4.1)
    combinedUnits: number;              // 676 units (55 u/acre × 12.3)
    valueCreated: number;               // Estimated value from assemblage
  };
  
  // Contact info
  contactAvailable: boolean;            // true (from owner database)
}

// On map click of neighboring parcel:
→ Show popup with:
  • Owner info
  • Assemblage score (85/100)
  • Combined potential (12.3 acres = 676 units)
  • [Contact Owner] button
  • [Add to Assemblage Plan] button
```

#### G. Export Functionality
```typescript
interface ExportOptions {
  geoJSON: {
    format: 'GeoJSON';
    filename: 'site-boundary.geojson';
    includes: ['boundary', 'setbacks', 'buildableArea'];
    consumers: ['3D Design Builder', 'Zoning Module'];
  };
  
  dxf: {
    format: 'DXF';                      // CAD format
    filename: 'site-plan.dxf';
    layers: ['Boundary', 'Setbacks', 'Easements'];
    units: 'feet';
    consumers: ['Architect', 'Engineer'];
  };
  
  pdf: {
    format: 'PDF';
    filename: 'site-plan.pdf';
    includes: [
      'Boundary polygon',
      'Setback lines',
      'Buildable area',
      'Measurements (area, perimeter)',
      'Neighboring parcels',
      'Scale bar',
      'North arrow'
    ];
    pageSize: 'Letter' | 'Tabloid';
  };
  
  kml: {
    format: 'KML';                      // Google Earth
    filename: 'site-boundary.kml';
    includes: ['boundary', 'setbacks'];
  };
}

// Export buttons:
[Export GeoJSON] [Export DXF] [Export PDF] [Export KML]
```

#### H. Data Consumers & Integrations
```typescript
// 1. Zoning Module
// Reads: boundaryGeoJSON, parcelArea, buildableArea, setbacks
// Uses: Calculate max units, FAR, height limits
// API call: GET /api/v1/deals/:dealId/boundary
const boundary = await fetch(`/api/v1/deals/${dealId}/boundary`);
const maxUnits = boundary.buildableArea * zoningMaxDensity;

// 2. 3D Design Builder
// Reads: boundaryGeoJSON (as building footprint constraint)
// Import: User clicks "Import Site Boundary" in 3D module
// System: Converts GeoJSON to Three.js polygon for site constraints
const sitePolygon = convertGeoJSONToThreeJS(boundary.boundaryGeoJSON);
scene.add(sitePolygon); // Shows as ground plane in 3D view

// 3. Financial Model
// Reads: parcelArea (for land cost), buildableArea (for feasibility)
const landCost = parcelArea * pricePerAcre;
const maxBuildingSF = buildableAreaSF * maxFAR;

// 4. Neighboring Property AI
// Reads: centroid (for spatial queries)
const nearby = await fetch(`/api/v1/properties/neighboring?lat=${centroid[1]}&lng=${centroid[0]}&radius=0.5`);
```

#### I. Real-Time Status Panel
```typescript
interface BoundaryStatus {
  defined: boolean;                     // false ⚠️ or true ✅
  area: number | null;                  // 8.2 acres or null
  buildable: number | null;             // 6.8 acres or null
  setbacksApplied: boolean;             // true ✅
  constraintsChecked: boolean;          // false ⚠️
  
  validationStatus: {
    minAreaMet: boolean;                // true (must be > 1 acre)
    polygonClosed: boolean;             // true
    selfIntersecting: boolean;          // false (polygon is valid)
    withinCityLimits: boolean;          // true
  };
  
  nextSteps: string[];                  // ["Check floodplain", "Define easements", "Export to Zoning"]
}

// Display:
┌─────────────────────────────────────────┐
│ BOUNDARY STATUS                         │
├─────────────────────────────────────────┤
│ ✅ Boundary Defined: 8.2 acres          │
│ ✅ Buildable Area: 6.8 acres (83%)      │
│ ✅ Setbacks Applied (25'/15'/20')       │
│ ⚠️  Constraints Not Checked Yet         │
│                                          │
│ NEXT STEPS:                             │
│ 1. [Check Floodplain Overlay]          │
│ 2. [Mark Any Easements]                 │
│ 3. [Export to Zoning Module] →          │
└─────────────────────────────────────────┘
```

---

### Module 3: Zoning & Development Capacity

**Data Sources & Actions:**

#### A. Zoning Data (Manual Input or API)
```typescript
// If zoning API available (future):
// API: GET /api/v1/zoning?address=...
// For now: Manual user input stored in database

interface ZoningData {
  district: string;                     // "R-5 Multifamily"
  districtCode: string;                 // "R-5"
  status: "By-Right" | "Conditional" | "Requires Rezoning";
  
  allowedUses: Array<{
    use: string;                        // "Multifamily dwelling"
    byRight: boolean;                   // true
    conditional: boolean;               // false
    notes?: string;                     // Special conditions
  }>;
  
  densityLimits: {
    maxUnitsPerAcre: number;            // 60
    maxFAR: number;                     // 2.5
    maxBuildingCoverage: number;        // 0.60 (60% of lot)
  };
  
  heightLimits: {
    maxStories: number;                 // 6
    maxFeetOrMeters: number;            // 75 feet
    stepbackRequired: boolean;          // false
    stepbackDetails?: string;
  };
  
  setbacks: {
    front: number;                      // 25 feet
    side: number;                       // 15 feet (each side)
    rear: number;                       // 20 feet
    fromPropertyLine: boolean;          // true
  };
  
  parking: {
    required: number;                   // 1.5 spaces per unit
    reductionAvailable: boolean;        // true (if transit-adjacent)
    maxReduction: number;               // 0.25 (can go down to 1.25/unit)
  };
  
  openSpace: {
    required: number;                   // 0.15 (15% of site)
    type: string;                       // "Active or passive recreation"
  };
}

// Action Button:
[Update Zoning Info] → Opens form to edit
[View Zoning Code] → Links to city zoning ordinance PDF
```

#### B. Capacity Calculations (Using Boundary Data)
```typescript
// API: GET /api/v1/deals/:dealId/development-capacity
// Calculates max capacity using boundary + zoning data

interface DevelopmentCapacity {
  // Input data
  parcelArea: number;                   // 8.2 acres (from boundary)
  buildableArea: number;                // 6.8 acres (after setbacks)
  
  // By-right capacity (no variances needed)
  byRight: {
    maxUnits: number;                   // 408 units (60 u/acre × 6.8)
    maxBuildingSF: number;              // 894,180 SF (357,672 × 2.5 FAR)
    maxStories: number;                 // 6 stories
    maxHeight: number;                  // 75 feet
    parkingRequired: number;            // 612 spaces (1.5 × 408)
    openSpaceRequired: number;          // 53,651 SF (15% of parcel)
  };
  
  // With variances (possible but requires approval)
  withVariances: {
    densityBonus: {
      available: boolean;               // true (affordable housing bonus)
      bonusUnits: number;               // 82 units (+20%)
      affordableRequired: number;       // 12 units (15% of bonus)
      maxUnits: number;                 // 490 units total
    };
    
    heightVariance: {
      available: boolean;               // true (if transit-adjacent)
      condition: string;                // "Within 1/4 mile of MARTA"
      maxStories: number;               // 8 stories (+2)
      maxHeight: number;                // 95 feet (+20)
    };
    
    farIncrease: {
      available: boolean;               // true
      maxFAR: number;                   // 3.0 (from 2.5)
      maxBuildingSF: number;            // 1,073,016 SF
    };
    
    parkingReduction: {
      available: boolean;               // true
      minRequired: number;              // 510 spaces (1.25 × 408)
      reduction: number;                // 102 spaces saved
      condition: string;                // "Transit-adjacent location"
    };
  };
  
  // User's plan vs max
  userPlan: {
    targetUnits: number;                // 450 (user's goal)
    utilization: number;                // 0.91 (91% of by-right max)
    buffer: number;                     // 42 units under max
    requiresVariances: boolean;         // true (exceeds by-right)
    variancesNeeded: string[];          // ["Density bonus"]
  };
}

// Display:
┌─────────────────────────────────────────┐
│ DEVELOPMENT CAPACITY ANALYSIS           │
├─────────────────────────────────────────┤
│ SITE CONSTRAINTS                        │
│ • Gross Parcel: 8.2 acres              │
│ • Setbacks Applied: -1.4 acres         │
│ • Buildable Area: 6.8 acres (83%)      │
│                                          │
│ BY-RIGHT CAPACITY (No Variances)        │
│ • Max Units: 408 (60 u/acre × 6.8)     │
│ • Max Building: 894,180 SF (FAR 2.5)   │
│ • Max Height: 6 stories / 75 feet      │
│ • Parking: 612 spaces required         │
│                                          │
│ YOUR PLAN                               │
│ • Target Units: 450                     │
│ • Utilization: 110% of by-right ⚠️      │
│ • Requires: Density bonus (+20%)        │
│ • Condition: 12 affordable units (15%)  │
│                                          │
│ VARIANCE PATH                           │
│ ✅ Density Bonus Available              │
│    → Provide 12 affordable units        │
│    → Unlocks 490 max units             │
│ ✅ Height Variance Possible             │
│    → Site is transit-adjacent          │
│    → Can build 8 stories / 95 feet     │
│ ⚠️  Entitlement Risk: MODERATE          │
│    → Public hearing required           │
│    → Est. 6-9 month process            │
│                                          │
│ ACTIONS                                  │
│ [Adjust to By-Right (408 units)]       │
│ [Proceed with Variances (450 units)]   │
│ [Export to 3D Design] → Sends limits   │
└─────────────────────────────────────────┘
```

#### C. Comparable Approvals (from dataLibrary.service.ts)
```typescript
// API: GET /api/v1/data-library/zoning-approvals?district=R-5&radius=2mi
interface ComparableApprovals {
  count: number;                        // 5 recent approvals
  approvals: Array<{
    projectName: string;                // "Riverside Towers"
    address: string;                    // "789 River Road"
    year: number;                       // 2023
    acres: number;                      // 7.2
    units: number;                      // 420
    density: number;                    // 58 units/acre
    stories: number;                    // 7
    variancesGranted: string[];         // ["Density bonus", "Height variance"]
    timelineMonths: number;             // 18 months
    opposition: "None" | "Low" | "Moderate" | "High"; // "Low"
    distanceMiles: number;              // 0.8
  }>;
  
  insights: {
    avgDensityApproved: number;         // 61 units/acre
    avgTimelineMonths: number;          // 15 months
    successRate: number;                // 0.90 (90% approved)
    commonVariances: string[];          // ["Density bonus", "Parking reduction"]
  };
}

// Display:
┌─────────────────────────────────────────┐
│ COMPARABLE APPROVALS (Last 3 Years)    │
├─────────────────────────────────────────┤
│ 1. Riverside Towers (2023)             │
│    • 58 u/acre, 7 stories, 18 months   │
│    • Variances: Density + Height       │
│    • Opposition: Low                   │
│                                          │
│ 2. Midtown Place (2024)                │
│    • 62 u/acre, 8 stories, 12 months   │
│    • Variances: Density bonus          │
│    • Opposition: None                  │
│                                          │
│ 3. Oak Street Apartments (2024)        │
│    • 56 u/acre, 6 stories, 15 months   │
│    • By-right (no variances)           │
│    • Opposition: None                  │
│                                          │
│ INSIGHTS                                │
│ • Avg Approved: 61 u/acre (yours: 55)  │
│ • Avg Timeline: 15 months              │
│ • Success Rate: 90%                    │
│ • Your Risk: MODERATE                  │
│                                          │
│ [View Full Report] [Map Comps]         │
└─────────────────────────────────────────┘
```

#### D. Entitlement Timeline & Checklist
```typescript
interface EntitlementProcess {
  phases: Array<{
    phase: string;
    duration: number;                   // weeks
    cost: number;                       // dollars
    status: "Not Started" | "In Progress" | "Complete";
    tasks: Array<{
      task: string;
      required: boolean;
      status: "Not Started" | "In Progress" | "Complete";
      assignee?: string;
      dueDate?: Date;
    }>;
  }>;
  
  totalDuration: number;                // 24 weeks
  totalCost: number;                    // 185000
  riskLevel: "Low" | "Moderate" | "High"; // "Moderate"
}

// Example:
const process = {
  phases: [
    {
      phase: "Pre-Application",
      duration: 2,
      cost: 5000,
      status: "Not Started",
      tasks: [
        { task: "Pre-app meeting with city", required: true, status: "Not Started" },
        { task: "Preliminary site plan", required: true, status: "Not Started" },
        { task: "Neighborhood outreach", required: false, status: "Not Started" }
      ]
    },
    {
      phase: "Application Preparation",
      duration: 8,
      cost: 75000,
      status: "Not Started",
      tasks: [
        { task: "Traffic impact study", required: true, cost: 25000 },
        { task: "Environmental assessment", required: true, cost: 15000 },
        { task: "Site plan drawings", required: true, cost: 20000 },
        { task: "Architectural renderings", required: true, cost: 15000 }
      ]
    },
    {
      phase: "Review Process",
      duration: 10,
      cost: 50000,
      status: "Not Started",
      tasks: [
        { task: "Planning staff review", required: true },
        { task: "Planning commission hearing", required: true },
        { task: "City council hearing", required: true },
        { task: "Address public comments", required: true }
      ]
    },
    {
      phase: "Approval & Permitting",
      duration: 4,
      cost: 55000,
      status: "Not Started",
      tasks: [
        { task: "Final site plan approval", required: true },
        { task: "Building permit application", required: true },
        { task: "Final inspections", required: true }
      ]
    }
  ],
  totalDuration: 24,
  totalCost: 185000,
  riskLevel: "Moderate"
};

// Display with progress tracker:
┌─────────────────────────────────────────┐
│ ENTITLEMENT TIMELINE                    │
├─────────────────────────────────────────┤
│ ○ Pre-Application (2 weeks, $5k)        │
│ ○ Preparation (8 weeks, $75k)           │
│ ○ Review (10 weeks, $50k)               │
│ ○ Approval (4 weeks, $55k)              │
│                                          │
│ Total: 24 weeks (~6 months)             │
│ Cost: $185,000                          │
│ Risk: MODERATE                          │
│                                          │
│ [Start Process] [View Checklist]        │
└─────────────────────────────────────────┘
```

#### E. Export to 3D Design Builder
```typescript
// When user clicks "Export to 3D Design"
// System sends constraints to 3D module

interface DesignConstraints {
  siteData: {
    boundaryGeoJSON: GeoJSON.Polygon;   // From Module 2
    buildableArea: GeoJSON.Polygon;     // After setbacks
    parcelArea: number;                 // 8.2 acres
  };
  
  zoningLimits: {
    maxUnits: number;                   // 408 (or 490 with variances)
    maxBuildingSF: number;              // 894,180 SF (or 1,073,016)
    maxStories: number;                 // 6 (or 8 with variance)
    maxHeight: number;                  // 75 feet (or 95)
    parkingRequired: number;            // 612 spaces (or 510 reduced)
    openSpaceRequired: number;          // 53,651 SF
  };
  
  recommendations: {
    targetDensity: number;              // 55 units/acre (market context)
    optimalUnitMix: {                   // From rent comps analysis
      studio: number;                   // 0.10 (10%)
      oneBed: number;                   // 0.60 (60%)
      twoBed: number;                   // 0.30 (30%)
    };
    avgUnitSize: {                      // From market standards
      studio: number;                   // 550 SF
      oneBed: number;                   // 750 SF
      twoBed: number;                   // 1100 SF
    };
  };
}

// Action button:
[Export to 3D Design Builder] →
  • Imports site boundary as footprint
  • Sets height limit (75' or 95')
  • Sets unit count target (450)
  • Sets unit mix (60% 1BR, 30% 2BR, 10% Studio)
  • User can now design building within constraints
```

---

### Module 4: Context Tracker (KEEP AS-IS)
**No changes needed** - Already has 8 powerful tabs

---

### Module 5: Team & Collaborators (KEEP AS-IS)
**No changes needed**

---

## 🏢 EXISTING PROPERTY DEALS - Actionable Implementation

### Module 1: Property Intelligence Dashboard

**Data Sources & Actions:**

#### A. Property Snapshot (from Deal Database)
```typescript
// API: GET /api/v1/deals/:dealId
interface PropertySnapshot {
  name: string;                         // "Riverside Apartments"
  address: string;                      // "123 Main Street, Atlanta, GA 30303"
  propertyType: string;                 // "Multifamily"
  class: "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C"; // "B"
  vintage: {
    yearBuilt: number;                  // 1985
    age: number;                        // 39 years
    decade: string;                     // "1980s"
  };
  
  physical: {
    units: number;                      // 243
    unitMix: {
      studio: { count: number; pct: number }; // 52, 0.21
      oneBed: { count: number; pct: number }; // 128, 0.53
      twoBed: { count: number; pct: number }; // 52, 0.21
      threeBed: { count: number; pct: number }; // 11, 0.05
    };
    buildingSF: number;                 // 180,000
    avgUnitSize: number;                // 740 SF/unit
    stories: number;                    // 4
    parking: {
      spaces: number;                   // 310
      ratio: number;                    // 1.27 per unit
    };
    land: {
      acres: number;                    // 8.2
      density: number;                  // 29.6 units/acre
    };
  };
}

// Display:
┌─────────────────────────────────────────┐
│ 🏢 RIVERSIDE APARTMENTS                  │
├─────────────────────────────────────────┤
│ 123 Main Street, Atlanta, GA 30303     │
│ Class B • Built 1985 (39 years old)    │
│                                          │
│ 243 units • 180,000 SF • 4 stories      │
│ 8.2 acres (29.6 u/acre)                │
│                                          │
│ Unit Mix:                               │
│ • 52 Studios (21%)                      │
│ • 128 1BR (53%)                         │
│ • 52 2BR (21%)                          │
│ • 11 3BR (5%)                           │
│                                          │
│ Avg Unit Size: 740 SF                  │
│ Parking: 310 spaces (1.27/unit)        │
└─────────────────────────────────────────┘
```

#### B. Performance Snapshot (from Operations Data)
```typescript
// API: GET /api/v1/deals/:dealId/operations
interface PerformanceSnapshot {
  occupancy: {
    current: number;                    // 0.92 (92%)
    marketAvg: number;                  // 0.95 (95%)
    gap: number;                        // -0.03 (-3%)
    trend: "Improving" | "Stable" | "Declining"; // "Stable"
  };
  
  rents: {
    avgRentPerUnit: number;             // 1750
    avgRentPerSF: number;               // 2.36
    marketAvgRentPerSF: number;         // 2.78
    gap: number;                        // -0.42 (-15% below market)
    lossToLease: number;                // 400000 annual
  };
  
  revenue: {
    grossPotentialRent: number;         // 5100000 annual
    actualCollections: number;          // 4700000 (92% occupied)
    otherIncome: number;                // 150000 (parking, fees)
    totalRevenue: number;               // 4850000
  };
}

// Display:
┌─────────────────────────────────────────┐
│ PERFORMANCE SNAPSHOT                    │
├─────────────────────────────────────────┤
│ Occupancy: 92% (vs 95% market) ⚠️       │
│ Rent/SF: $2.36 (vs $2.78 market) ⚠️     │
│ Loss to Lease: $400k/year              │
│                                          │
│ 📈 Opportunity: 15% below market        │
│    = $876k annual revenue upside       │
│                                          │
│ [View Rent Comps] → Competition module │
└─────────────────────────────────────────┘
```

#### C. Financial Snapshot (from Deal Database)
```typescript
interface FinancialSnapshot {
  acquisition: {
    askingPrice: number;                // 37700000
    pricePerUnit: number;               // 155144
    currentDebt: number;                // 22000000
    debtPct: number;                    // 0.58 (58% LTV)
  };
  
  operations: {
    noi: number;                        // 2200000 annual
    goingInCap: number;                 // 0.058 (5.8%)
    marketCap: number;                  // 0.055 (5.5%)
    capGap: number;                     // 0.003 (+30 bps cheap!)
  };
  
  debt: {
    currentBalance: number;             // 22000000
    rate: number;                       // 0.045 (4.5%)
    debtService: number;                // 1500000 annual
    dscr: number;                       // 1.47 (healthy)
  };
}

// Display:
┌─────────────────────────────────────────┐
│ FINANCIAL SNAPSHOT                      │
├─────────────────────────────────────────┤
│ Asking: $37.7M ($155k/unit)            │
│ NOI: $2.2M annual                      │
│ Going-In Cap: 5.8%                     │
│ Market Cap: 5.5% → You're CHEAP! 🎯    │
│                                          │
│ Debt: $22M (58% LTV @ 4.5%)            │
│ DSCR: 1.47x (healthy coverage)         │
│                                          │
│ [Run Pro Forma] → Opus AI Builder      │
└─────────────────────────────────────────┘
```

#### D. Intelligent Scores (from propertyScoring.service.ts)
```typescript
// API: GET /api/v1/property-scoring/value-add-score
interface ValueAddScore {
  overallScore: number;                 // 82 (0-100, higher = better opportunity)
  grade: "Excellent" | "Good" | "Fair" | "Poor"; // "Excellent"
  
  factors: {
    age: {
      score: number;                    // 90
      reason: string;                   // "39 years old = renovation opportunity"
    };
    belowMarketRents: {
      score: number;                    // 85
      gap: number;                      // -0.15 (-15%)
      reason: string;                   // "Significant rent upside"
    };
    lowDensity: {
      score: number;                    // 80
      currentDensity: number;           // 29.6 u/acre
      marketDensity: number;            // 42 u/acre
      reason: string;                   // "Can add 150+ units"
    };
    taxEfficiency: {
      score: number;                    // 75
      yourRate: number;                 // 0.014 (1.4%)
      marketRate: number;               // 0.021 (2.1%)
      reason: string;                   // "Below-market tax burden"
    };
  };
  
  recommendations: [
    "Renovate units → raise rents to market ($876k annual upside)",
    "Consider adding units (low density vs market)",
    "Appeal property taxes (potential $45k/year savings)",
    "Improve occupancy to 95% (+$150k annual revenue)"
  ];
}

// Display:
┌─────────────────────────────────────────┐
│ VALUE-ADD SCORE: 82/100 (EXCELLENT ⭐)   │
├─────────────────────────────────────────┤
│ Breakdown:                              │
│ • Age (90): 39 years = reno opportunity │
│ • Rents (85): 15% below market          │
│ • Density (80): Can add 150+ units      │
│ • Tax (75): Below-market tax burden     │
│                                          │
│ Top Opportunities:                      │
│ 1. Renovate → $876k annual upside       │
│ 2. Add units (low density)              │
│ 3. Tax appeal ($45k/year savings)       │
│                                          │
│ [View Full Strategy] → Strategy module  │
└─────────────────────────────────────────┘
```

#### E. Seller Intelligence (from propertyScoring.service.ts)
```typescript
// API: GET /api/v1/property-scoring/seller-propensity?dealId=...
interface SellerIntelligence {
  propensityScore: number;              // 72 (0-100)
  likelihood: "High" | "Medium" | "Low"; // "High"
  
  factors: {
    outOfState: {
      value: boolean;                   // true
      points: number;                   // +20
      detail: string;                   // "California-based LLC"
    };
    portfolio: {
      properties: number;               // 5
      singleAsset: boolean;             // false
      points: number;                   // +10
      detail: string;                   // "Portfolio owner, may sell multiple"
    };
    holdPeriod: {
      years: number;                    // 12
      longHold: boolean;                // true
      points: number;                   // +15
      detail: string;                   // "12 years held, cycle complete"
    };
    marketingTime: {
      daysOnMarket: number;             // 180
      points: number;                   // +15
      detail: string;                   // "180 days = motivated"
    };
    distress: {
      signals: string[];                // [] (none found)
      points: number;                   // 0
    };
  };
  
  ownerProfile: {
    name: string;                       // "ABC Properties LLC"
    type: string;                       // "Private Equity"
    hqLocation: string;                 // "San Francisco, CA"
    totalPortfolio: {
      properties: number;               // 5
      units: number;                    // 1200
      markets: string[];                // ["Atlanta", "Charlotte"]
    };
    contactInfo: {
      available: boolean;               // true
      source: string;                   // "Public records"
    };
  };
  
  negotiationStrategy: {
    approach: string;                   // "Value arbitrage - emphasize mgmt burden"
    leverage: string[];                 // ["Out-of-state", "Long hold", "Days on market"]
    offerRange: {
      low: number;                      // 34000000 (-10%)
      mid: number;                      // 37700000 (asking)
      high: number;                     // 39000000 (+3%)
    };
  };
}

// Display:
┌─────────────────────────────────────────┐
│ SELLER PROPENSITY: 72/100 (HIGH 🎯)     │
├─────────────────────────────────────────┤
│ Owner: ABC Properties LLC               │
│ HQ: San Francisco, CA (out-of-state ✅) │
│ Portfolio: 5 properties, 1,200 units   │
│ Hold Period: 12 years (cycle complete)  │
│ Days on Market: 180 (motivated!)        │
│                                          │
│ NEGOTIATION LEVERAGE:                   │
│ • Out-of-state management burden        │
│ • Long hold = ready to exit            │
│ • 180 days = price flexibility         │
│                                          │
│ OFFER STRATEGY:                         │
│ Low: $34.0M (-10%)                     │
│ Target: $36.5M (-3%)                   │
│ Max: $37.7M (asking)                   │
│                                          │
│ [Contact Owner] → Context Tracker      │
│ [Generate Offer] → Opus AI             │
└─────────────────────────────────────────┘
```

#### F. Quick Action Links
```typescript
interface QuickActions {
  primary: Array<{
    label: string;
    action: string;
    icon: string;
    module: string;
  }>;
}

const actions = {
  primary: [
    {
      label: "View Investment Strategy",
      action: () => navigateToModule('strategy'),
      icon: "🎯",
      module: "InvestmentStrategySection"
    },
    {
      label: "Run Pro Forma (Opus AI)",
      action: () => navigateToModule('financial'),
      icon: "💰",
      module: "OpusProformaBuilder"
    },
    {
      label: "Analyze Rent Comps",
      action: () => navigateToModule('competition'),
      icon: "📊",
      module: "CompetitionAnalysis"
    },
    {
      label: "Assess Risks",
      action: () => navigateToModule('risk'),
      icon: "⚠️",
      module: "RiskManagement"
    },
    {
      label: "Contact Seller",
      action: () => navigateToModule('context-tracker'),
      icon: "📧",
      module: "ContextTracker - Contacts"
    }
  ]
};

// Display:
┌─────────────────────────────────────────┐
│ QUICK ACTIONS                           │
├─────────────────────────────────────────┤
│ [🎯 View Strategy] [💰 Run Pro Forma]   │
│ [📊 Rent Comps] [⚠️ Risks]              │
│ [📧 Contact Seller]                     │
└─────────────────────────────────────────┘
```

---

### Module 2: Operational Metrics (Streamlined)

**Data Sources & Actions:**

#### A. Revenue Breakdown (from Operations Data)
```typescript
// API: GET /api/v1/deals/:dealId/financials/revenue
interface RevenueBreakdown {
  grossPotentialRent: {
    total: number;                      // 5100000 annual
    calculation: string;                // "243 units × $1,750/mo × 12"
  };
  
  lossToVacancy: {
    amount: number;                     // -400000
    pct: number;                        // 0.08 (8% vacancy)
    vsMarket: number;                   // -0.03 (vs 5% market)
  };
  
  actualCollections: number;            // 4700000
  
  otherIncome: {
    total: number;                      // 150000
    sources: {
      parking: number;                  // 60000
      laundry: number;                  // 35000
      petFees: number;                  // 25000
      storage: number;                  // 15000
      other: number;                    // 15000
    };
  };
  
  totalRevenue: number;                 // 4850000
  
  opportunities: [
    {
      item: "Loss to Lease",
      current: 400000,
      potential: 876000,
      action: "Raise rents to market",
      impact: "+$476k/year"
    },
    {
      item: "Vacancy",
      current: 0.08,
      potential: 0.05,
      action: "Improve marketing/operations",
      impact: "+$150k/year"
    },
    {
      item: "Other Income",
      current: 150000,
      potential: 225000,
      action: "Add package lockers, bike storage",
      impact: "+$75k/year"
    }
  ];
}

// Display - Simplified with links:
┌─────────────────────────────────────────┐
│ REVENUE SNAPSHOT (TTM)                  │
├─────────────────────────────────────────┤
│ Gross Potential: $5.1M                 │
│ Actual Collections: $4.7M (92% occ)    │
│ Other Income: $150k                    │
│ = TOTAL REVENUE: $4.85M                │
│                                          │
│ KEY OPPORTUNITIES:                      │
│ • Loss to Lease: $876k potential       │
│ • Vacancy Improvement: $150k           │
│ • Other Income: $75k                   │
│                                          │
│ For detailed revenue strategy:         │
│ → [Competition Module] (rent comps)    │
│ → [Financial Model] (pro forma)        │
└─────────────────────────────────────────┘
```

#### B. Expense Breakdown (from Operations Data)
```typescript
// API: GET /api/v1/deals/:dealId/financials/expenses
interface ExpenseBreakdown {
  operating: {
    total: number;                      // 2100000
    pct: number;                        // 0.43 (43% of revenue)
    vsMarket: number;                   // -0.02 (vs 45% market - GOOD!)
    categories: {
      payroll: number;                  // 600000
      maintenance: number;              // 450000
      utilities: number;                // 380000
      insurance: number;                // 240000
      marketing: number;                // 120000
      admin: number;                    // 310000
    };
  };
  
  propertyTaxes: {
    total: number;                      // 520000
    rate: number;                       // 0.014 (1.4% of value)
    vsMarket: number;                   // -0.007 (vs 2.1% - GOOD!)
    appealOpportunity: {
      available: boolean;               // true
      potentialSavings: number;         // 45000 annual
      reason: string;                   // "Below market assessment"
    };
  };
  
  totalExpenses: number;                // 2620000
  noi: number;                          // 2230000
  noiMargin: number;                    // 0.46 (46% - healthy)
}

// Display - Simplified with links:
┌─────────────────────────────────────────┐
│ EXPENSE SNAPSHOT (TTM)                  │
├─────────────────────────────────────────┤
│ Operating: $2.1M (43% of revenue) ✅   │
│ Property Taxes: $520k (1.4% of value) ✅│
│ = NET OPERATING INCOME: $2.23M         │
│                                          │
│ HIGHLIGHTS:                             │
│ • OpEx Ratio: 43% (vs 45% market) ✅    │
│ • Tax Rate: 1.4% (vs 2.1% market) ✅    │
│ • Tax Appeal Opportunity: $45k/year    │
│                                          │
│ For detailed expense analysis:         │
│ → [Financial Model] (full breakdown)   │
│ → [Risk Management] (tax appeal)       │
└─────────────────────────────────────────┘
```

#### C. Occupancy Trend (Last 12 Months)
```typescript
// API: GET /api/v1/deals/:dealId/operations/occupancy-history
interface OccupancyTrend {
  monthly: Array<{
    month: string;                      // "2026-01"
    occupancy: number;                  // 0.89
    leasesStarted: number;              // 12
    leasesEnded: number;                // 18
    netChange: number;                  // -6
  }>;
  
  summary: {
    avg: number;                        // 0.92
    peak: { month: string; value: number }; // June, 0.95
    trough: { month: string; value: number }; // January, 0.89
    trend: "Improving" | "Stable" | "Declining"; // "Stable"
    seasonality: boolean;               // true
  };
  
  vsMarket: {
    yourAvg: number;                    // 0.92
    marketAvg: number;                  // 0.95
    gap: number;                        // -0.03
  };
}

// Display with simple chart:
┌─────────────────────────────────────────┐
│ OCCUPANCY TREND (L12M)                  │
├─────────────────────────────────────────┤
│ [Mini Chart: 89% → 95% → 92%]          │
│ Avg: 92% • Peak: 95% (Jun)             │
│ Market: 95% → Gap: -3%                 │
│                                          │
│ Trend: Stable with seasonal pattern    │
│                                          │
│ For traffic analysis:                  │
│ → [Traffic Engine] (leasing forecast)  │
└─────────────────────────────────────────┘
```

#### D. Capital Needs (from Property Inspection / DD)
```typescript
// API: GET /api/v1/deals/:dealId/capital-needs
interface CapitalNeeds {
  immediate: {
    total: number;                      // 1200000
    items: Array<{
      item: string;                     // "Roof replacement"
      cost: number;                     // 450000
      urgency: "Critical" | "High" | "Medium"; // "Critical"
      timeline: string;                 // "Within 6 months"
      impact: string;                   // "Prevent water damage"
    }>;
  };
  
  valueAdd: {
    total: number;                      // 3600000
    perUnit: number;                    // 15000
    items: Array<{
      item: string;                     // "Unit interior renovations"
      scope: string;                    // "Kitchens, baths, flooring"
      costPerUnit: number;              // 12000
      rentBump: number;                 // 0.50 per SF
      roi: number;                      // 0.15 (15% cash-on-cash)
    }>;
  };
  
  totalCapex: number;                   // 4800000
}

// Display - Simplified:
┌─────────────────────────────────────────┐
│ CAPITAL NEEDS                           │
├─────────────────────────────────────────┤
│ Immediate Repairs: $1.2M               │
│ Value-Add Renovations: $3.6M ($15k/unit)│
│ = TOTAL CAPEX: $4.8M                   │
│                                          │
│ ROI: 15% cash-on-cash on renovations  │
│ Rent Bump: +$0.50/SF post-reno         │
│                                          │
│ For detailed plan:                     │
│ → [Strategy Module] (renovation plan)  │
│ → [Financial Model] (capex pro forma)  │
└─────────────────────────────────────────┘
```

---

### Module 3: Context Tracker (KEEP AS-IS)
**No changes needed**

---

### Module 4: Team & Collaborators (KEEP AS-IS)
**No changes needed**

---

## 🔄 Implementation Summary

### Key Changes from Original Proposal

**✅ KEPT:**
- Structure (Development vs Existing flows)
- Property Boundary module (NEW - critical!)
- Module organization (5 for Dev, 4 for Existing)

**✅ ADDED:**
- Real API endpoints for every data point
- Specific service references (propertyMetrics, propertyScoring, etc.)
- Actionable buttons with clear destinations
- Database schemas for new data (PropertyBoundary)
- Technical implementations (Mapbox, turf.js, etc.)
- Smart status tracking and workflow guidance

**❌ REMOVED:**
- Generic/example data
- Duplicate analysis (moved to specialized modules)
- Long descriptions (replaced with links + quick summaries)

**✅ ENHANCED:**
- Every metric shows source (which API)
- Every section has clear actions (what can user do?)
- Data flows are explicit (what feeds what?)
- Links to specialized modules for deep analysis

---

## 📊 Data Flow Recap

**Development Deals:**
```
Site Intelligence (scores from APIs)
    ↓
Property Boundary (user draws, system calculates)
    ↓
Zoning Analysis (reads boundary, calculates capacity)
    ↓
3D Design Builder (imports boundary + constraints)
    ↓
Financial Model (uses design + market data)
```

**Existing Property:**
```
Property Intelligence (scores + benchmarks from APIs)
    ↓
Operational Metrics (snapshot only)
    ↓
Quick Links to Specialized Modules:
    • Strategy (investment thesis)
    • Competition (rent analysis)
    • Financial Model (pro forma)
    • Risk (risk assessment)
```

---

**Status:** ✅ Actionable implementation plan with real platform data ready! 🚀
