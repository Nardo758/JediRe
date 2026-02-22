# Design Optimizer - Quick Start Guide

## 🚀 What Is This?

The **Design Optimizer** is a complete algorithmic suite for optimizing multifamily real estate developments. It answers critical questions:

- **Unit Mix:** What bedroom distribution maximizes NOI?
- **Parking:** Surface, podium, or structured? How many spaces?
- **Amenities:** Which amenities have the best ROI?
- **Massing:** What does the building look like in 3D?

## 📁 Files

```
src/services/
├── designOptimizer.service.ts      # Main service (use this!)
├── optimizationAlgorithms.ts       # Core math/logic
└── __tests__/
    └── designOptimizer.test.ts     # Comprehensive tests

AI_OPTIMIZATION_HOOKS.md            # Guide for adding Qwen AI
DESIGN_OPTIMIZER_SUMMARY.md         # Full documentation
```

## ⚡ Quick Usage

### 1. Import the Service
```typescript
import { designOptimizerService } from '@/services/designOptimizer.service';
```

### 2. Prepare Your Data
```typescript
const marketData = {
  studioAbsorption: 3.5,      // units/month
  oneBrAbsorption: 5.0,
  twoBrAbsorption: 4.2,
  threeBrAbsorption: 2.0,
  studioRentPSF: 2.50,        // $/sqft/month
  oneBrRentPSF: 2.30,
  twoBrRentPSF: 2.10,
  threeBrRentPSF: 1.90,
  vacancy: 0.05               // 5%
};

const parcel = {
  lotSizeSqft: 50000,
  zoningFAR: 2.5,
  maxHeight: 75,
  maxStories: 6,
  setbacks: { front: 20, side: 15, rear: 20 }
};

const zoning = {
  parkingRatioMin: 1.2,       // spaces per unit
  buildingEfficiency: 0.80,   // 80% net-to-gross
  commonAreaRatio: 0.12       // 12% common area
};

const costs = {
  surfaceParkingPerSpace: 4000,
  podiumParkingPerSpace: 40000,
  structuredParkingPerSpace: 60000,
  amenityCostPerSqft: 120
};
```

### 3. Optimize!
```typescript
// Complete design optimization
const result = designOptimizerService.optimizeCompleteDesign(
  marketData,
  parcel,
  zoning,
  costs
);

console.log(`
Recommended Design:
  Units: ${result.unitMix.totalUnits}
  Mix: ${result.unitMix.studio} studios, ${result.unitMix.oneBR} 1BR, 
       ${result.unitMix.twoBR} 2BR, ${result.unitMix.threeBR} 3BR
  
  Parking: ${result.parking.spaces} spaces (${result.parking.type})
  
  Amenities: ${result.amenities.amenities.map(a => a.name).join(', ')}
  
  Financials:
    Gross Rent: $${result.unitMix.projectedGrossRent.toLocaleString()}/yr
    NOI: $${result.totalNOI.toLocaleString()}/yr
    Construction Cost: $${result.totalCost.toLocaleString()}
    Yield on Cost: ${(result.yieldOnCost * 100).toFixed(2)}%
`);
```

### 4. Use Individual Optimizers (If You Prefer)
```typescript
// Just unit mix
const unitMix = designOptimizerService.optimizeUnitMix(
  marketData, 
  parcel, 
  zoning,
  { riskTolerance: 'aggressive' }
);

// Just parking
const parking = designOptimizerService.optimizeParking(
  unitMix.totalUnits,
  unitMix,
  zoning,
  costs,
  parcel
);

// Just amenities
const amenities = designOptimizerService.optimizeAmenities(
  unitMix.totalUnits,
  unitMix,
  marketData,
  costs
);

// Just 3D massing
const massing = designOptimizerService.generateMassing(
  parcel,
  zoning,
  unitMix.totalUnits,
  unitMix
);
```

## 🎨 Render 3D Geometry

The `massing` result includes geometry ready for Three.js:

```typescript
import { Canvas } from '@react-three/fiber';

function BuildingViewer({ massing }) {
  const geometry = new THREE.BufferGeometry();
  
  // Convert vertices
  const positions = new Float32Array(
    massing.geometry3D.vertices.flatMap(v => [v.x, v.y, v.z])
  );
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  // Convert faces
  const indices = new Uint16Array(massing.geometry3D.faces.flat());
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  
  return (
    <Canvas>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#3B82F6" />
      </mesh>
    </Canvas>
  );
}
```

## 🧪 Run Tests

```bash
# Run all design optimizer tests
npm run test designOptimizer.test.ts

# Watch mode
npm run test -- --watch designOptimizer.test.ts
```

**Expected output:** 44 tests, all passing ✅

## 🎯 Interpretation Guide

### Unit Mix Results
```typescript
result.unitMix = {
  studio: 15,
  oneBR: 45,
  twoBR: 30,
  threeBR: 10,
  totalUnits: 100,
  avgUnitSqft: 825,
  projectedNOI: 1850000,          // Annual NOI
  absorptionMonths: 18.5,         // Time to lease up
  confidenceScore: 0.82,          // 0.5-1.0 (higher = better)
  reasoning: [                    // Why this mix?
    "NOI scores: Studio=3.50, 1BR=3.45, 2BR=2.80, 3BR=2.40",
    "Minimum diversification: 15% each for top 3 unit types",
    "Total units: 100, Average size: 825 sqft",
    "Projected NOI: $1,850k/year",
    "Estimated absorption: 18.5 months"
  ]
}
```

**What it means:**
- Focus on 1BR (highest demand + good NOI)
- Include studios (high NOI per sqft)
- Include 2BR/3BR for diversification
- Confidence: Higher = more balanced mix

### Parking Results
```typescript
result.parking = {
  spaces: 120,
  ratio: 1.2,                    // Meets minimum
  type: 'podium',                // Under first floor
  surfaceSpaces: 40,
  structuredSpaces: 80,
  constructionCost: 3360000,     // $3.36M
  costPerSpace: 28000,           // $28k average
  annualOperatingCost: 52000,    // $52k/yr
  reasoning: [
    "Required parking: 120 spaces (ratio 1.2)",
    "Maximum surface parking: 40 spaces",
    "Mixed parking: 40 surface + 80 podium",
    "Total cost: $3,360k ($28k/space)",
    "Annual operating: $52k"
  ]
}
```

**What it means:**
- Mixed approach saves cost vs. all-structured
- Operating cost impacts NOI (deducted automatically)
- Type matters: Surface = cheap, Podium = mid, Structured = expensive

### Amenity Results
```typescript
result.amenities = {
  amenities: [
    {
      name: 'Fitness Center',
      type: 'fitness',
      sqft: 2000,
      cost: 300000,
      rentPremium: 25,           // $25/unit/month
      roi: 0.10,                 // 10% annual return
      priority: 'must-have'
    },
    // ... more amenities
  ],
  totalCost: 1200000,
  rentPremiumTotal: 180000,      // $180k/yr extra rent
  paybackYears: 6.7,             // ROI payback period
  reasoning: [
    "Must-have amenities: Fitness Center, Clubhouse / Lounge, Package Lockers",
    "Added Pool: 18% ROI",
    "Added Rooftop Terrace: 38% ROI",
    "Total amenity investment: $1,200k",
    "Annual rent premium: $180k (6.7 year payback)"
  ]
}
```

**What it means:**
- Amenities add to rent (captured in NOI)
- ROI > 15% = good investment
- Payback < 10 years = reasonable for multifamily

### Massing Results
```typescript
result.massing = {
  buildingFootprint: {
    type: 'Polygon',
    coordinates: [...],          // GeoJSON
    sqft: 20000                  // 20k sqft footprint
  },
  floors: 5,
  totalGrossSqft: 100000,
  floorPlateGrossSqft: 20000,
  farUtilization: 2.0,           // Using 2.0 of 2.5 FAR
  heightFt: 50,
  geometry3D: {
    vertices: [...],             // For Three.js
    faces: [...]
  },
  warnings: []                   // Empty if compliant
}
```

**What it means:**
- Building fits on parcel (footprint < lot size)
- Uses available FAR efficiently
- Geometry can be rendered in 3D viewer
- Warnings = potential zoning issues

## 🔧 Customization

### Risk Tolerance
```typescript
// Conservative: Minimize risk
const conservative = designOptimizerService.optimizeCompleteDesign(
  marketData, parcel, zoning, costs,
  { riskTolerance: 'conservative' }
);

// Aggressive: Maximize returns
const aggressive = designOptimizerService.optimizeCompleteDesign(
  marketData, parcel, zoning, costs,
  { riskTolerance: 'aggressive' }
);
```

**Impact:**
- Aggressive: More premium amenities, higher parking ratio
- Conservative: Fewer amenities, minimum parking

### Prioritize IRR vs. NOI
```typescript
const irrFocused = designOptimizerService.optimizeCompleteDesign(
  marketData, parcel, zoning, costs,
  { prioritizeNOI: false }  // Future: Will optimize for IRR
);
```

## 🤖 AI Enhancement (Future)

Want AI-powered optimization? See **`AI_OPTIMIZATION_HOOKS.md`** for:
- Phase 1: Visual compliance analysis with Qwen
- Phase 2: Alternative strategy generation
- Phase 3: Iterative refinement

**Current status:** Rule-based algorithms only (fast, proven, deterministic)

## 📊 Algorithm Details

### Unit Mix Algorithm
1. **Score** each unit type: `NOI per sqft × demand factor`
2. **Diversify:** Allocate minimum 15% to top 3 types
3. **Maximize:** Fill remaining space with highest-scoring types
4. **Result:** Balanced mix optimized for NOI

### Parking Algorithm
1. **Calculate** minimum required (zoning ratio)
2. **Check** surface parking capacity
3. **Decide:** Surface → Podium (100+ units) → Structured
4. **Result:** Cost-optimal parking solution

### Amenity Algorithm
1. **Must-haves:** Fitness, clubhouse, package lockers
2. **Recommended:** ROI > 15%
3. **Premium:** ROI > 20% (if aggressive)
4. **Result:** Amenities that pay for themselves

### Massing Algorithm
1. **Calculate** required gross sqft
2. **Determine** optimal floor count
3. **Generate** building footprint with setbacks
4. **Create** 3D geometry for visualization
5. **Result:** Compliant building envelope

## 🐛 Troubleshooting

### "FAR utilization exceeds zoning"
**Problem:** Building is too big for parcel  
**Fix:** Reduce unit count or increase parcel size

### "Parking spaces below required"
**Problem:** Not enough parking  
**Fix:** Increase parking ratio or add structured parking

### "Confidence score is low"
**Problem:** Unit mix is heavily weighted to one type  
**Fix:** Check if market data is realistic (balance absorption rates)

### Tests failing?
```bash
# Make sure dependencies are installed
npm install

# Run tests with verbose output
npm run test -- --reporter=verbose designOptimizer.test.ts
```

## 📚 Additional Resources

- **Full Documentation:** `DESIGN_OPTIMIZER_SUMMARY.md`
- **AI Integration:** `AI_OPTIMIZATION_HOOKS.md`
- **Code:** `src/services/designOptimizer.service.ts`
- **Tests:** `src/services/__tests__/designOptimizer.test.ts`

## 💡 Pro Tips

1. **Start with complete design:** Use `optimizeCompleteDesign()` for best results
2. **Check reasoning:** Every result includes `reasoning` array explaining decisions
3. **Validate compliance:** Always run `analyzeDesignCompliance()` before submitting to municipality
4. **Iterate:** Try different `OptimizationOptions` to compare scenarios
5. **Trust the math:** Algorithms are tested with 44 comprehensive tests

## ✅ Next Steps

1. ✅ **Run tests** to verify everything works
2. ✅ **Try examples** above with your own data
3. ✅ **Integrate** into your UI components
4. ✅ **Visualize** results with Three.js
5. ⏳ **Add AI** when ready (see AI_OPTIMIZATION_HOOKS.md)

---

**Questions?** Check the code comments or run the tests for more examples!
