# MAP-AGNOSTIC ZONING AI ARCHITECTURE

## EXECUTIVE SUMMARY

**Brilliant Pivot: Don't Build Maps, Build Intelligence**

Instead of recreating the entire GIS stack, we **overlay AI-powered zoning intelligence on existing map platforms** (Google Maps, Mapbox, Zillow, etc.). This reduces complexity by 80% and time-to-market from 12 months to 3 months.

---

## THE PARADIGM SHIFT

### Old Approach (Complex)
```
Build & Host:
├── Zoning district polygons
├── Parcel boundaries
├── Vector tile server
├── Custom map renderer
└── GIS database

Investment: $500k, 12 months, 8 engineers
```

### New Approach (Smart)
```
User Provides:
├── Address (or drops pin on map)
├── Lot size (from measuring tool or property records)
└── Current use (optional)

We Provide:
├── Zoning district lookup (via geocoding)
├── AI interpretation of zoning rules
├── Calculations of buildable area
├── Development opportunity scoring
└── Visual overlays (on their map)

Investment: $100k, 3 months, 3 engineers
```

---

## TECHNICAL ARCHITECTURE

### High-Level System Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER WORKFLOW                                   │
│                                                                         │
│  Step 1: User opens Google Maps/Mapbox/Zillow                          │
│          ↓                                                              │
│  Step 2: User finds property of interest                               │
│          ↓                                                              │
│  Step 3: User copies address OR uses browser extension                 │
│          ↓                                                              │
│  Step 4: User pastes into Jedi RE interface                            │
│          ↓                                                              │
│  Step 5: Jedi RE:                                                       │
│          ├── Geocodes address → lat/lng                                │
│          ├── Looks up municipality                                     │
│          ├── Queries zoning district (reverse geocoding)               │
│          ├── Gets lot size (API or user input)                         │
│          └── Retrieves zoning rules from database                      │
│          ↓                                                              │
│  Step 6: AI interprets and calculates                                  │
│          ├── What can be built                                         │
│          ├── Maximum units/GFA                                         │
│          ├── Parking requirements                                      │
│          └── Development score                                         │
│          ↓                                                              │
│  Step 7: Display results with visual overlay                           │
│          └── Show buildable envelope on user's map                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LIGHTWEIGHT ARCHITECTURE                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    USER INTERFACE LAYER                             │ │
│  │                                                                     │ │
│  │  Option A: Web App                                                  │ │
│  │  ├── User inputs address                                            │ │
│  │  ├── Embedded map (Mapbox/Google Maps iframe)                       │ │
│  │  ├── Measuring tool overlay                                         │ │
│  │  └── Results panel                                                  │ │
│  │                                                                     │ │
│  │  Option B: Browser Extension                                        │ │
│  │  ├── Inject into Google Maps, Zillow, Redfin                        │ │
│  │  ├── "Analyze this property" button appears                         │ │
│  │  ├── Scrapes property details automatically                         │ │
│  │  └── Overlay results directly on their map                          │ │
│  │                                                                     │ │
│  │  Option C: Mobile App                                               │ │
│  │  ├── Built-in map view                                              │ │
│  │  ├── GPS location integration                                       │ │
│  │  └── Photo upload for property identification                       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    ↓                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    GEOCODING & LOOKUP LAYER                         │ │
│  │                                                                     │ │
│  │  Address → Coordinates:                                             │ │
│  │  ├── Google Geocoding API                                           │ │
│  │  ├── Mapbox Geocoding API                                           │ │
│  │  └── Fallback: Census Bureau                                        │ │
│  │                                                                     │ │
│  │  Coordinates → Zoning District:                                     │ │
│  │  ├── Reverse geocode to municipality                                │ │
│  │  ├── Query our zoning district database                             │ │
│  │  │   (lightweight: just district boundaries + codes)                │ │
│  │  └── Return: {district_code: "R-3", municipality: "Austin"}         │ │
│  │                                                                     │ │
│  │  Property Details:                                                  │ │
│  │  ├── Primary: User-measured via map tool                            │ │
│  │  ├── Backup: Regrid API (parcel data)                               │ │
│  │  └── Backup: Tax assessor APIs                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    ↓                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    ZONING RULES DATABASE                            │ │
│  │                                                                     │ │
│  │  LIGHTWEIGHT: Just the rules, not the maps                          │ │
│  │                                                                     │ │
│  │  zoning_districts table:                                            │ │
│  │  ├── municipality, district_code                                    │ │
│  │  ├── permitted_uses, conditional_uses                               │ │
│  │  ├── dimensional_standards                                          │ │
│  │  └── full_code_sections (text + embeddings)                         │ │
│  │                                                                     │ │
│  │  district_boundaries table (MINIMAL):                               │ │
│  │  ├── Just for reverse geocoding                                     │ │
│  │  ├── Simplified polygons (not detailed parcels)                     │ │
│  │  └── Can be GeoJSON, not full PostGIS                               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    ↓                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    AI INTERPRETATION ENGINE                         │ │
│  │                                                                     │ │
│  │  Input:                                                             │ │
│  │  ├── Address: "123 Main St, Austin, TX"                             │ │
│  │  ├── Lot size: 8,000 sq ft (user measured or API)                   │ │
│  │  ├── Zoning: "R-3" (from lookup)                                    │ │
│  │  └── Question: "Can I build 4 units?" (optional)                    │ │
│  │                                                                     │ │
│  │  Processing:                                                        │ │
│  │  ├── Retrieve R-3 rules for Austin from database                    │ │
│  │  ├── Calculate max units (density rules)                            │ │
│  │  ├── Calculate buildable envelope (setbacks)                        │ │
│  │  ├── Calculate parking requirements                                 │ │
│  │  └── RAG-based Q&A if user asks questions                           │ │
│  │                                                                     │ │
│  │  Output:                                                            │ │
│  │  ├── "Yes, you can build 4 units"                                   │ │
│  │  ├── Max buildable area: 3,200 sq ft                                │ │
│  │  ├── Max height: 35 ft                                              │ │
│  │  ├── Parking needed: 8 spaces                                       │ │
│  │  └── Development score: 85/100                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    ↓                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    VISUALIZATION LAYER                              │ │
│  │                                                                     │ │
│  │  Return to user:                                                    │ │
│  │  ├── GeoJSON overlay (buildable envelope)                           │ │
│  │  ├── They apply to THEIR map (Google/Mapbox)                        │ │
│  │  ├── Or: We show on embedded map in our interface                   │ │
│  │  └── 3D view: Simple isometric diagram (not full 3D map)            │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION DETAILS

### Minimal Map Data Required

```sql
-- YOU DON'T NEED: Full parcel data, detailed boundaries, tile server

-- YOU ONLY NEED: Simple district lookup table

CREATE TABLE zoning_district_boundaries (
    id UUID PRIMARY KEY,
    municipality VARCHAR(255),
    district_code VARCHAR(50),
    
    -- Simplified boundary (just for point-in-polygon check)
    -- Can be stored as GeoJSON TEXT, no PostGIS required!
    boundary_geojson TEXT,
    
    -- Or if you use PostGIS (recommended for performance):
    boundary GEOMETRY(Polygon, 4326),
    
    -- Index for spatial queries
    CONSTRAINT unique_district UNIQUE(municipality, district_code)
);

CREATE INDEX idx_boundary_gist ON zoning_district_boundaries 
    USING GIST(boundary);

-- Example data:
INSERT INTO zoning_district_boundaries VALUES (
    gen_random_uuid(),
    'Austin',
    'R-3',
    '{
        "type": "Polygon",
        "coordinates": [[
            [-97.7431, 30.2672],
            [-97.7400, 30.2672],
            [-97.7400, 30.2650],
            [-97.7431, 30.2650],
            [-97.7431, 30.2672]
        ]]
    }'::text,
    ST_GeomFromGeoJSON('{...}')
);

-- Lookup query (find which district a point is in):
SELECT district_code
FROM zoning_district_boundaries
WHERE municipality = 'Austin'
  AND ST_Contains(boundary, ST_SetSRID(ST_Point(-97.7420, 30.2660), 4326));
```

### Reverse Geocoding Service

```javascript
// LIGHTWEIGHT ZONING LOOKUP SERVICE

class ZoningLookup {
    async getZoningForAddress(address) {
        // Step 1: Geocode address to coordinates
        const coords = await this.geocode(address);
        
        // Step 2: Determine municipality
        const municipality = await this.getMunicipality(coords);
        
        // Step 3: Find zoning district
        const district = await this.getZoningDistrict(coords, municipality);
        
        // Step 4: Get property details
        const propertyDetails = await this.getPropertyDetails(address, coords);
        
        return {
            address,
            coordinates: coords,
            municipality,
            zoning_district: district,
            lot_size_sqft: propertyDetails.lot_size,
            current_use: propertyDetails.current_use
        };
    }
    
    async geocode(address) {
        // Use Google Geocoding API
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
        );
        const data = await response.json();
        
        if (data.status === 'OK') {
            const location = data.results[0].geometry.location;
            return {
                lat: location.lat,
                lng: location.lng
            };
        }
        
        throw new Error('Geocoding failed');
    }
    
    async getMunicipality(coords) {
        // Reverse geocode to get municipality
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${API_KEY}`
        );
        const data = await response.json();
        
        // Extract city from address components
        const cityComponent = data.results[0].address_components.find(
            component => component.types.includes('locality')
        );
        
        return cityComponent?.long_name;
    }
    
    async getZoningDistrict(coords, municipality) {
        // Query your database (point-in-polygon)
        const response = await fetch('/api/zoning-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lat: coords.lat,
                lng: coords.lng,
                municipality
            })
        });
        
        return await response.json();
    }
    
    async getPropertyDetails(address, coords) {
        // Try multiple sources in priority order
        
        // Option 1: Regrid API (best)
        try {
            const parcelData = await this.getRegridData(coords);
            if (parcelData) return parcelData;
        } catch (e) {}
        
        // Option 2: Tax assessor API
        try {
            const assessorData = await this.getAssessorData(address);
            if (assessorData) return assessorData;
        } catch (e) {}
        
        // Option 3: User will measure manually
        return {
            lot_size: null, // User must provide
            current_use: null
        };
    }
}
```

### User Interface with Map Overlay

```jsx
// REACT COMPONENT WITH EMBEDDED MAP

import { useState } from 'react';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';

function PropertyAnalyzer() {
    const [address, setAddress] = useState('');
    const [lotSize, setLotSize] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [buildableEnvelope, setBuildableEnvelope] = useState(null);
    
    const analyzeProperty = async () => {
        // Step 1: Get zoning info
        const zoningInfo = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address,
                lot_size_sqft: lotSize
            })
        }).then(r => r.json());
        
        setAnalysis(zoningInfo);
        
        // Step 2: Calculate buildable envelope for visualization
        const envelope = calculateBuildableEnvelope(
            zoningInfo.coordinates,
            lotSize,
            zoningInfo.setbacks
        );
        
        setBuildableEnvelope(envelope);
    };
    
    return (
        <div className="flex h-screen">
            {/* Left panel: Input */}
            <div className="w-1/3 p-6 bg-white border-r">
                <h2 className="text-2xl font-bold mb-4">Property Analyzer</h2>
                
                <div className="space-y-4">
                    {/* Address input */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Property Address
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="123 Main St, Austin, TX"
                            className="w-full border rounded px-3 py-2"
                        />
                    </div>
                    
                    {/* Lot size input */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Lot Size (sq ft)
                        </label>
                        <input
                            type="number"
                            value={lotSize || ''}
                            onChange={(e) => setLotSize(Number(e.target.value))}
                            placeholder="8000"
                            className="w-full border rounded px-3 py-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Use measuring tool on map →
                        </p>
                    </div>
                    
                    {/* Analyze button */}
                    <button
                        onClick={analyzeProperty}
                        disabled={!address || !lotSize}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
                    >
                        Analyze Property
                    </button>
                </div>
                
                {/* Results */}
                {analysis && (
                    <div className="mt-6 space-y-4">
                        <div className="p-4 bg-gray-50 rounded">
                            <h3 className="font-semibold mb-2">Zoning Info</h3>
                            <p>District: <strong>{analysis.district_code}</strong></p>
                            <p>Municipality: {analysis.municipality}</p>
                        </div>
                        
                        <div className="p-4 bg-green-50 rounded">
                            <h3 className="font-semibold mb-2">Development Potential</h3>
                            <p>Max Units: <strong>{analysis.max_units}</strong></p>
                            <p>Max Height: {analysis.max_height_ft} ft</p>
                            <p>Max Footprint: {analysis.max_footprint_sqft.toLocaleString()} sq ft</p>
                        </div>
                        
                        <div className="p-4 bg-blue-50 rounded">
                            <h3 className="font-semibold mb-2">Requirements</h3>
                            <p>Parking: {analysis.parking_required} spaces</p>
                            <p>Setbacks: F:{analysis.setbacks.front}' S:{analysis.setbacks.side}' R:{analysis.setbacks.rear}'</p>
                        </div>
                        
                        <div className="p-4 bg-purple-50 rounded">
                            <h3 className="font-semibold mb-2">Development Score</h3>
                            <div className="text-3xl font-bold">{analysis.opportunity_score}/100</div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Right panel: Map */}
            <div className="w-2/3 relative">
                <MapContainer
                    center={[30.2672, -97.7431]}
                    zoom={15}
                    className="h-full"
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />
                    
                    {/* Buildable envelope overlay */}
                    {buildableEnvelope && (
                        <Polygon
                            positions={buildableEnvelope}
                            pathOptions={{
                                color: 'blue',
                                fillColor: 'lightblue',
                                fillOpacity: 0.3
                            }}
                        />
                    )}
                </MapContainer>
                
                {/* Measuring tool overlay */}
                <div className="absolute bottom-4 left-4 bg-white p-3 rounded shadow">
                    <p className="text-sm font-medium mb-2">Measuring Tool</p>
                    <button className="text-sm text-blue-600">
                        Enable Measure Mode
                    </button>
                </div>
            </div>
        </div>
    );
}

function calculateBuildableEnvelope(centerCoords, lotSizeSqft, setbacks) {
    // Assume square lot for simplicity
    const lotSideLength = Math.sqrt(lotSizeSqft);
    
    // Convert feet to degrees (very rough approximation)
    const ftToDeg = 0.00000274;
    
    const halfSide = (lotSideLength / 2) * ftToDeg;
    
    // Calculate corners with setbacks
    const setbackDeg = {
        front: setbacks.front * ftToDeg,
        rear: setbacks.rear * ftToDeg,
        side: setbacks.side * ftToDeg
    };
    
    return [
        [
            centerCoords.lat + halfSide - setbackDeg.front,
            centerCoords.lng - halfSide + setbackDeg.side
        ],
        [
            centerCoords.lat + halfSide - setbackDeg.front,
            centerCoords.lng + halfSide - setbackDeg.side
        ],
        [
            centerCoords.lat - halfSide + setbackDeg.rear,
            centerCoords.lng + halfSide - setbackDeg.side
        ],
        [
            centerCoords.lat - halfSide + setbackDeg.rear,
            centerCoords.lng - halfSide + setbackDeg.side
        ]
    ];
}
```

---

## BROWSER EXTENSION APPROACH (ADVANCED)

```javascript
// CHROME EXTENSION: Inject into Google Maps, Zillow, etc.

// manifest.json
{
    "manifest_version": 3,
    "name": "Jedi RE Zoning Analyzer",
    "version": "1.0",
    "permissions": ["activeTab", "storage"],
    "content_scripts": [
        {
            "matches": [
                "*://*.google.com/maps/*",
                "*://*.zillow.com/*",
                "*://*.redfin.com/*"
            ],
            "js": ["content.js"],
            "css": ["overlay.css"]
        }
    ]
}

// content.js
class JediREInjector {
    constructor() {
        this.injectButton();
    }
    
    injectButton() {
        // Detect which site we're on
        if (window.location.hostname.includes('google.com')) {
            this.injectIntoGoogleMaps();
        } else if (window.location.hostname.includes('zillow.com')) {
            this.injectIntoZillow();
        }
    }
    
    injectIntoGoogleMaps() {
        // Wait for map to load
        const observer = new MutationObserver(() => {
            const searchBox = document.querySelector('[role="searchbox"]');
            if (searchBox && !document.getElementById('jedi-re-button')) {
                const button = this.createAnalyzeButton();
                searchBox.parentElement.appendChild(button);
                observer.disconnect();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    createAnalyzeButton() {
        const button = document.createElement('button');
        button.id = 'jedi-re-button';
        button.textContent = '🏗️ Analyze Zoning';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        button.onclick = () => this.analyzeCurrentLocation();
        
        return button;
    }
    
    async analyzeCurrentLocation() {
        // Extract address from Google Maps
        const address = this.extractAddressFromGoogleMaps();
        
        if (!address) {
            alert('Please search for a specific address first');
            return;
        }
        
        // Show loading overlay
        this.showLoadingOverlay();
        
        // Call Jedi RE API
        const analysis = await this.callJediREAPI(address);
        
        // Show results overlay
        this.showResultsOverlay(analysis);
    }
    
    extractAddressFromGoogleMaps() {
        // Multiple selectors to try
        const selectors = [
            '.searchboxinput',
            '[aria-label*="Search"]',
            '.tactile-searchbox-input'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.value) {
                return element.value;
            }
        }
        
        return null;
    }
    
    async callJediREAPI(address) {
        const response = await fetch('https://api.jedire.com/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await this.getAuthToken()}`
            },
            body: JSON.stringify({ address })
        });
        
        return await response.json();
    }
    
    showResultsOverlay(analysis) {
        // Create overlay panel
        const overlay = document.createElement('div');
        overlay.id = 'jedi-re-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 10000;
            padding: 24px;
        `;
        
        overlay.innerHTML = `
            <div class="jedi-re-header">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">
                    Zoning Analysis
                </h2>
                <button id="jedi-close" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 24px; cursor: pointer;">
                    ×
                </button>
            </div>
            
            <div style="margin-bottom: 16px; padding: 12px; background: #f3f4f6; border-radius: 8px;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">District</div>
                <div style="font-size: 18px; font-weight: 600;">${analysis.district_code}</div>
                <div style="font-size: 14px; color: #6b7280;">${analysis.district_name}</div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">Development Potential</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div style="padding: 12px; background: #ecfdf5; border-radius: 8px;">
                        <div style="font-size: 12px; color: #047857;">Max Units</div>
                        <div style="font-size: 20px; font-weight: 700; color: #047857;">${analysis.max_units}</div>
                    </div>
                    <div style="padding: 12px; background: #eff6ff; border-radius: 8px;">
                        <div style="font-size: 12px; color: #1e40af;">Max Height</div>
                        <div style="font-size: 20px; font-weight: 700; color: #1e40af;">${analysis.max_height_ft} ft</div>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 16px; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Development Score</div>
                <div style="font-size: 32px; font-weight: 700;">${analysis.opportunity_score}/100</div>
            </div>
            
            <button style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                View Full Report
            </button>
        `;
        
        document.body.appendChild(overlay);
        
        // Close button handler
        document.getElementById('jedi-close').onclick = () => {
            overlay.remove();
        };
    }
}

// Initialize
new JediREInjector();
```

---

## MINIMAL DATA STORAGE REQUIREMENTS

### What You Actually Need to Store

```
SIZE ESTIMATES (50 cities):

1. Zoning District Boundaries (simplified):
   - 50 cities × 30 districts avg × 1KB per polygon = 1.5 MB
   - No parcel-level data needed!
   
2. Zoning Rules Text:
   - 50 cities × 500KB text per city = 25 MB
   
3. Embeddings (for AI):
   - 50 cities × 5,000 chunks × 6KB per embedding = 1.5 GB
   
4. Structured Data (dimensional standards):
   - 50 cities × 30 districts × 2KB per district = 3 MB

TOTAL: ~1.5 GB (vs. 500GB+ for full parcel/GIS data)

DATABASE:
- PostgreSQL with PostGIS extension (for point-in-polygon)
- Or: PostgreSQL + pgvector (if you skip PostGIS)
- Pinecone for embeddings (or pg_vector)

HOSTING:
- Can run on single $50/month server (small dataset)
- Scales to $200/month for 50 cities
```

---

## USER EXPERIENCE FLOWS

### Flow 1: Web App (Simplest)

```
1. User visits jedire.com
2. Sees embedded map (Mapbox or Google Maps)
3. Searches for address or clicks on map
4. Optional: Uses measuring tool to trace lot
5. Clicks "Analyze"
6. AI shows:
   - Zoning district
   - What can be built
   - Development score
   - Buildable envelope overlay on map
7. User can ask follow-up questions
8. Export report as PDF
```

### Flow 2: Browser Extension (Power Users)

```
1. User installs Jedi RE Chrome extension
2. User browses Zillow/Redfin/Google Maps normally
3. Extension adds "Analyze Zoning" button to page
4. User clicks button
5. Extension:
   - Auto-detects address
   - Calls Jedi RE API
   - Shows overlay with results directly on Zillow/etc.
6. User sees zoning info without leaving Zillow
```

### Flow 3: Mobile App

```
1. User opens Jedi RE mobile app
2. GPS shows their current location
3. User can:
   - Search address
   - Drop pin on map
   - Take photo of property (address extraction)
4. Tap property to analyze
5. Swipe up for full report
6. Shake phone for 3D view of buildable envelope
```

---

## COST BREAKDOWN (REVISED)

### One-Time Development

```
Phase 1 - MVP (3 months):
├── Address lookup & geocoding: $15k
├── Minimal zoning district database: $20k
├── AI interpretation engine: $30k
├── Web interface with embedded map: $25k
└── Testing & polish: $10k

Total: $100k (vs. $500k for full GIS build)
```

### Monthly Operating Costs

```
Infrastructure:
├── Server hosting: $50-200/month (tiny dataset)
├── Google Maps API: $200-1,000/month (based on lookups)
├── OpenAI API: $500-2,000/month
├── Pinecone: $70-500/month
└── Domain, SSL, etc.: $50/month

Total: $870-3,750/month (vs. $6k-18k for full GIS)
```

### Data Acquisition (One-Time per City)

```
For 50 cities:
├── Zoning boundaries (simplified): $5k-15k
│   └── Many available free from city open data
├── Zoning code text: Free (Municode scraping)
└── Manual structuring: $10k-20k

Total: $15k-35k (vs. $100k-200k for full parcel data)
```

---

## COMPETITIVE ADVANTAGES

### Why This Approach Wins

```
1. FASTER TIME TO MARKET
   - 3 months vs. 12 months
   - Can launch with 5 cities, not 50
   
2. LOWER CAPITAL REQUIREMENTS
   - $100k vs. $500k to build
   - $1k-4k/month vs. $6k-18k/month to run
   
3. BETTER USER EXPERIENCE
   - Works with tools users already know (Google Maps)
   - No learning curve for map interface
   - Browser extension = instant value add
   
4. PLATFORM AGNOSTIC
   - Users can use Google Maps, Mapbox, Zillow, etc.
   - We provide intelligence layer
   - Not locked into our map implementation
   
5. EASIER TO MAINTAIN
   - Don't need to update parcel data
   - Only update zoning rules (changes less frequently)
   - Less geo data = fewer breaking changes
```

---

## PROOF OF CONCEPT (1 Week Build)

```javascript
// MINIMAL VIABLE DEMO

// 1. Single HTML file with embedded map
<html>
<head>
    <script src='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'></script>
    <link href='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css' rel='stylesheet' />
</head>
<body>
    <input id="address" placeholder="Enter address" />
    <input id="lotSize" type="number" placeholder="Lot size (sq ft)" />
    <button onclick="analyze()">Analyze</button>
    <div id="map" style="width: 100%; height: 500px;"></div>
    <div id="results"></div>
    
    <script>
        mapboxgl.accessToken = 'YOUR_TOKEN';
        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-97.7431, 30.2672],
            zoom: 13
        });
        
        async function analyze() {
            const address = document.getElementById('address').value;
            const lotSize = document.getElementById('lotSize').value;
            
            // Call your API
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, lot_size_sqft: lotSize })
            });
            
            const result = await response.json();
            
            // Show results
            document.getElementById('results').innerHTML = `
                <h2>Zoning: ${result.district_code}</h2>
                <p>Max Units: ${result.max_units}</p>
                <p>Score: ${result.opportunity_score}/100</p>
            `;
            
            // Add overlay to map
            map.addLayer({
                'id': 'buildable-envelope',
                'type': 'fill',
                'source': {
                    'type': 'geojson',
                    'data': result.buildable_envelope_geojson
                },
                'paint': {
                    'fill-color': '#0080ff',
                    'fill-opacity': 0.3
                }
            });
        }
    </script>
</body>
</html>

// 2. Simple backend (Express.js)
app.post('/api/analyze', async (req, res) => {
    const { address, lot_size_sqft } = req.body;
    
    // Geocode
    const coords = await geocode(address);
    
    // Lookup zoning (point-in-polygon check)
    const district = await db.query(`
        SELECT district_code, municipality
        FROM zoning_district_boundaries
        WHERE ST_Contains(boundary, ST_SetSRID(ST_Point($1, $2), 4326))
    `, [coords.lng, coords.lat]);
    
    // Get zoning rules
    const rules = await db.query(`
        SELECT * FROM zoning_districts
        WHERE municipality = $1 AND district_code = $2
    `, [district.municipality, district.district_code]);
    
    // Calculate
    const analysis = calculateDevelopmentPotential(lot_size_sqft, rules);
    
    res.json(analysis);
});
```

---

## RECOMMENDATION

**This is the way to go for your MVP.**

### Why:
1. ✅ **80% less complexity** than full GIS build
2. ✅ **3 months to launch** vs. 12 months
3. ✅ **$100k to build** vs. $500k
4. ✅ **Works with maps users already know**
5. ✅ **Can start with 5 cities** and scale
6. ✅ **Focus on AI value**, not map infrastructure

### MVP Checklist:
```
Week 1-2: Build address lookup + zoning district lookup
Week 3-4: Structure zoning rules for 3 pilot cities
Week 5-6: Build AI interpretation engine
Week 7-8: Build web interface with embedded map
Week 9-10: Polish UX, add measuring tool
Week 11-12: Beta testing, bug fixes

Launch Month 3: 3-5 cities, web app only
Month 4-6: Add browser extension, expand to 20 cities
```

You've just simplified the MVP from a $500k, 12-month, 8-person project into a **$100k, 3-month, 3-person project**.

That's the difference between launching and not launching.
