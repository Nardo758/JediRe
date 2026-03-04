# Map-Agnostic Zoning - Implementation Details

## 🔧 IMPLEMENTATION CODE SAMPLES

### Lot Size Data Acquisition (Multiple Fallback Options)

```javascript
class PropertyDataService {
  async getLotSize(address) {
    // Option 1: Property data APIs (Zillow, Redfin)
    try {
      const propertyData = await this.getPropertyData(address);
      if (propertyData && propertyData.lot_size_sqft) {
        return {
          lot_size: propertyData.lot_size_sqft,
          source: 'api',
          confidence: 'high'
        };
      }
    } catch (e) {
      console.log('Property API failed, trying tax assessor...');
    }

    // Option 2: Tax assessor API
    try {
      const assessorData = await this.getAssessorData(address);
      if (assessorData && assessorData.lot_size_sqft) {
        return {
          lot_size: assessorData.lot_size_sqft,
          source: 'assessor',
          confidence: 'high'
        };
      }
    } catch (e) {
      console.log('Tax assessor failed, falling back to manual input...');
    }

    // Option 3: User measures manually on map
    return {
      lot_size: null, // User must provide
      current_use: null,
      message: 'Please measure lot size using the map tool'
    };
  }

  async getPropertyData(address) {
    // Zillow/Redfin/etc API integration
    const response = await fetch(`/api/property-data?address=${encodeURIComponent(address)}`);
    return response.json();
  }

  async getAssessorData(address) {
    // Tax assessor API (varies by county)
    const geocoded = await this.geocode(address);
    const county = await this.getCounty(geocoded.lat, geocoded.lng);
    const response = await fetch(`/api/assessor/${county}/parcel?lat=${geocoded.lat}&lng=${geocoded.lng}`);
    return response.json();
  }
}
```

---

## 🎨 USER INTERFACE - React Component

### Property Analyzer with Embedded Map

```jsx
import { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker } from 'react-leaflet';

function PropertyAnalyzer() {
  const [address, setAddress] = useState('');
  const [lotSize, setLotSize] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [buildableEnvelope, setBuildableEnvelope] = useState(null);
  const [mapCenter, setMapCenter] = useState([30.2672, -97.7431]); // Austin, TX default
  const [mapZoom, setMapZoom] = useState(13);

  const analyzeProperty = async () => {
    try {
      // Step 1: Get zoning info from backend
      const zoningInfo = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          lot_size_sqft: lotSize
        })
      }).then(r => r.json());

      setAnalysis(zoningInfo);

      // Step 2: Update map center to property location
      setMapCenter([zoningInfo.coordinates.lat, zoningInfo.coordinates.lng]);
      setMapZoom(18); // Zoom in close

      // Step 3: Calculate buildable envelope for visualization
      const envelope = calculateBuildableEnvelope(
        zoningInfo.coordinates,
        lotSize,
        zoningInfo.setbacks
      );
      setBuildableEnvelope(envelope);

    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Failed to analyze property. Please check the address and try again.');
    }
  };

  const calculateBuildableEnvelope = (center, lotSizesqft, setbacks) => {
    // Calculate buildable area polygon coordinates
    // This is a simplified example - real implementation would be more complex
    
    const lotSideLengthFt = Math.sqrt(lotSizeqft); // Assume square lot for simplicity
    const buildableWidth = lotSideLengthFt - (setbacks.side_ft * 2);
    const buildableDepth = lotSideLengthFt - setbacks.front_ft - setbacks.rear_ft;

    // Convert feet to lat/lng offsets (very approximate)
    const latOffset = (buildableDepth / 2) / 364000; // ~364,000 ft per degree latitude
    const lngOffset = (buildableWidth / 2) / 288200; // ~288,200 ft per degree longitude at 30° latitude

    // Create polygon coordinates for buildable envelope
    return [
      [center.lat + latOffset, center.lng - lngOffset], // Top-left
      [center.lat + latOffset, center.lng + lngOffset], // Top-right
      [center.lat - latOffset, center.lng + lngOffset], // Bottom-right
      [center.lat - latOffset, center.lng - lngOffset], // Bottom-left
    ];
  };

  return (
    <div className="flex h-screen">
      {/* Left panel: Input & Results */}
      <div className="w-1/3 p-6 bg-white border-r overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">🏗️ Property Analyzer</h2>

        <div className="space-y-4">
          {/* Address input */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Property Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Austin, TX"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Lot size input */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Lot Size (sq ft)
            </label>
            <input
              type="number"
              value={lotSize || ''}
              onChange={(e) => setLotSize(Number(e.target.value))}
              placeholder="8000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Use measuring tool on map →
            </p>
          </div>

          {/* Analyze button */}
          <button
            onClick={analyzeProperty}
            disabled={!address || !lotSize}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            🔍 Analyze Property
          </button>
        </div>

        {/* Results */}
        {analysis && (
          <div className="mt-6 space-y-4">
            {/* Zoning Info */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold mb-2 text-lg">📍 Zoning Info</h3>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-600">District:</span> <strong className="text-blue-600">{analysis.district_code}</strong></p>
                <p><span className="text-gray-600">Name:</span> {analysis.district_name}</p>
                <p><span className="text-gray-600">Municipality:</span> {analysis.municipality}</p>
              </div>
            </div>

            {/* Development Potential */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-semibold mb-2 text-lg">🏢 Development Potential</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Max Units:</span>
                  <span className="text-xl font-bold text-green-600">{analysis.max_units}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Max GFA:</span>
                  <span className="text-lg font-semibold">{analysis.max_gfa_sqft.toLocaleString()} sq ft</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Max Height:</span>
                  <span className="text-lg font-semibold">{analysis.max_height_ft} ft ({analysis.max_stories} stories)</span>
                </div>
              </div>
            </div>

            {/* Parking Requirements */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold mb-2">🚗 Parking</h3>
              <p className="text-sm">
                <strong>{analysis.parking_required}</strong> spaces required
              </p>
            </div>

            {/* Setbacks */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="font-semibold mb-2">📏 Setbacks</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Front: <strong>{analysis.setbacks.front_ft} ft</strong></div>
                <div>Rear: <strong>{analysis.setbacks.rear_ft} ft</strong></div>
                <div>Side: <strong>{analysis.setbacks.side_ft} ft</strong></div>
                <div>Total: <strong>{analysis.setbacks.side_ft * 2 + analysis.setbacks.front_ft + analysis.setbacks.rear_ft} ft</strong></div>
              </div>
            </div>

            {/* Opportunity Score */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h3 className="font-semibold mb-2">🎯 Opportunity Score</h3>
              <div className="flex items-center gap-3">
                <div className="text-4xl font-bold text-purple-600">{analysis.opportunity_score}/100</div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-purple-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${analysis.opportunity_score}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{analysis.reasoning}</p>
            </div>

            {/* Copy Overlay Button */}
            <button
              onClick={() => {
                const geojson = JSON.stringify({
                  type: 'Feature',
                  properties: { name: 'Buildable Envelope' },
                  geometry: {
                    type: 'Polygon',
                    coordinates: [buildableEnvelope]
                  }
                }, null, 2);
                navigator.clipboard.writeText(geojson);
                alert('GeoJSON copied! Paste into Google My Maps or your map platform.');
              }}
              className="w-full bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-800"
            >
              📋 Copy Overlay for Your Map
            </button>
          </div>
        )}
      </div>

      {/* Right panel: Map */}
      <div className="w-2/3 relative">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Property marker */}
          {analysis && (
            <>
              <Marker position={[analysis.coordinates.lat, analysis.coordinates.lng]} />

              {/* Buildable envelope overlay (green) */}
              {buildableEnvelope && (
                <Polygon
                  positions={buildableEnvelope}
                  pathOptions={{
                    color: '#10b981',
                    fillColor: '#10b981',
                    fillOpacity: 0.3,
                    weight: 2
                  }}
                />
              )}

              {/* Setback areas (red) - would need more detailed calculation */}
            </>
          )}
        </MapContainer>

        {/* Map overlay instructions */}
        {!analysis && (
          <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg max-w-sm">
            <h3 className="font-semibold mb-2">📍 How to use</h3>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Enter property address</li>
              <li>Measure lot size on map (or enter manually)</li>
              <li>Click "Analyze Property"</li>
              <li>See buildable envelope overlay</li>
              <li>Copy GeoJSON to use in your map</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export default PropertyAnalyzer;
```

---

## 🗺️ MAP INTEGRATION OPTIONS

### Option 1: Leaflet (Open Source)
```jsx
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
```
**Pros:**
- Free & open source
- Lightweight
- Easy to use
- Good documentation

**Cons:**
- Basic features only
- No 3D/satellite imagery by default

---

### Option 2: Mapbox GL JS
```jsx
import Map from 'react-map-gl';
import { Layer, Source } from 'react-map-gl';

<Map
  mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
  initialViewState={{
    longitude: -97.7431,
    latitude: 30.2672,
    zoom: 13
  }}
  mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
>
  <Source type="geojson" data={buildableEnvelopeGeoJSON}>
    <Layer
      type="fill"
      paint={{
        'fill-color': '#10b981',
        'fill-opacity': 0.3
      }}
    />
  </Source>
</Map>
```
**Pros:**
- Beautiful rendering
- Satellite imagery
- 3D buildings
- Great performance

**Cons:**
- Paid (free tier available)
- More complex

---

### Option 3: Google Maps
```jsx
import { GoogleMap, Polygon } from '@react-google-maps/api';

<GoogleMap
  center={{ lat: 30.2672, lng: -97.7431 }}
  zoom={15}
>
  <Polygon
    paths={buildableEnvelope}
    options={{
      fillColor: '#10b981',
      fillOpacity: 0.3,
      strokeColor: '#10b981',
      strokeWeight: 2
    }}
  />
</GoogleMap>
```
**Pros:**
- Familiar to users
- Excellent satellite imagery
- Street view integration
- Robust APIs

**Cons:**
- Paid (after free tier)
- Requires API key

---

## 🎯 RECOMMENDED APPROACH FOR MVP

**Use Leaflet + OpenStreetMap for MVP:**
- ✅ Free
- ✅ Fast to implement
- ✅ Good enough for proof of concept
- ✅ Can switch to Mapbox later

**Upgrade to Mapbox for production:**
- After validating MVP
- Better UX
- Satellite imagery
- 3D visualization

---

## 📊 BACKEND API ENDPOINTS

### `/api/analyze` - Main Analysis Endpoint

```python
@app.post("/api/analyze")
async def analyze_property(request: PropertyRequest):
    """
    Main endpoint for property analysis
    """
    # 1. Geocode address
    coordinates = await geocode_address(request.address)
    
    # 2. Get municipality
    municipality = await get_municipality(coordinates['lat'], coordinates['lng'])
    
    # 3. Get zoning district
    zoning = await get_zoning_district(
        coordinates['lat'],
        coordinates['lng'],
        municipality['municipality_id']
    )
    
    # 4. Get zoning rules
    rules = await get_zoning_rules(
        municipality['municipality_id'],
        zoning['district_code']
    )
    
    # 5. Calculate buildable potential
    calculations = calculate_buildable_area(
        request.lot_size_sqft,
        rules
    )
    
    # 6. AI interpretation & scoring
    ai_analysis = await ai_interpret_zoning(
        request.address,
        request.lot_size_sqft,
        rules,
        calculations
    )
    
    return {
        'coordinates': coordinates,
        'municipality': municipality['city'],
        'district_code': zoning['district_code'],
        'district_name': zoning['district_name'],
        'max_units': calculations['max_units'],
        'max_gfa_sqft': calculations['max_gfa_sqft'],
        'max_height_ft': rules['height']['max_feet'],
        'max_stories': rules['height']['max_stories'],
        'parking_required': calculations['parking_required'],
        'setbacks': rules['setbacks'],
        'opportunity_score': ai_analysis['score'],
        'reasoning': ai_analysis['reasoning']
    }
```

---

**This is the implementation blueprint for the map-agnostic approach!** 🚀

---

**Last Updated:** 2026-01-31  
**Status:** Implementation Ready
