# AI Financial Hooks - Future Qwen Integration

This document outlines the AI integration points for enhanced financial modeling using Qwen (or other AI models).

## Overview

The financial auto-sync system currently uses **formula-based calculations**. Two key functions are marked for future AI enhancement to improve accuracy and market intelligence:

1. **AI Market Rent Predictions** (`predictRents`)
2. **AI Cost Estimation** (`estimateCostsWithAI`)

---

## 1. AI Market Rent Predictions

### Purpose
Replace static rent assumptions with AI-powered market rent forecasts based on real-time data and comparables.

### Function Signature
```typescript
async predictRents(
  unitMix: UnitMix,
  location: { lat: number; lng: number; address: string },
  model: 'qwen'
): Promise<RentForecast[]>
```

### Input Data
- **Unit Mix**: Number of studios, 1BR, 2BR, 3BR units
- **Location**: GPS coordinates and address
- **Model**: AI model to use (currently 'qwen')

### Expected Output
```typescript
interface RentForecast {
  unitType: 'studio' | 'oneBed' | 'twoBed' | 'threeBed';
  predictedRent: number;
  confidence: number; // 0-1
  marketComps: {
    address: string;
    rent: number;
    distance: number; // miles
  }[];
  reasoning: string;
}
```

### AI Model Requirements

**Data Sources:**
- Recent lease transactions (CoStar, Zillow, Apartments.com)
- Census demographic data
- Employment statistics
- Transit accessibility scores
- School ratings
- Crime statistics
- Supply pipeline (new construction)

**Model Training:**
- Historical rent data by submarket
- Seasonality adjustments
- Unit type mix impact
- Amenity premium factors
- Building age depreciation curves

**Inference Logic:**
```
1. Pull comparable properties within 0.5-mile radius
2. Adjust for building age, amenities, unit size
3. Apply demographic-driven demand multipliers
4. Factor in supply pipeline (competitive projects)
5. Generate confidence score based on data quality
6. Provide reasoning for prediction
```

### Example API Call
```typescript
const forecasts = await financialAutoSync.predictRents(
  { studio: 43, oneBed: 130, twoBed: 86, threeBed: 28 },
  { lat: 42.3601, lng: -71.0589, address: '123 Main St, Boston, MA' },
  'qwen'
);

// Result:
// [
//   {
//     unitType: 'oneBed',
//     predictedRent: 2850,
//     confidence: 0.89,
//     marketComps: [
//       { address: '456 State St', rent: 2900, distance: 0.2 },
//       { address: '789 Park Ave', rent: 2750, distance: 0.4 }
//     ],
//     reasoning: 'Based on 12 comparable properties within 0.5 miles. Recent leases show 3% YoY growth. Transit proximity adds $150 premium.'
//   }
// ]
```

### Integration Point
Located in: `frontend/src/services/financialAutoSync.service.ts:L300`

Current implementation returns `null`. Replace with Qwen API call.

---

## 2. AI Cost Estimation from 3D Model

### Purpose
Use AI to estimate construction costs based on 3D design complexity, rather than simple $/SF multipliers.

### Function Signature
```typescript
async estimateCostsWithAI(
  design3D: Design3D,
  model: 'qwen'
): Promise<CostBreakdown>
```

### Input Data
- **Design3D Object**: All 3D design parameters
  - Unit count and mix
  - Gross/rentable SF
  - Parking type and count
  - Amenity SF
  - Stories
  - FAR utilization

### Expected Output
```typescript
interface CostBreakdown {
  hardCosts: HardCosts;
  confidence: number; // 0-1
  comparableProjects: {
    name: string;
    costPerSF: number;
    similarity: number; // 0-1
  }[];
  reasoning: string;
}
```

### AI Model Requirements

**Data Sources:**
- Historical construction cost data by market
- RSMeans cost database
- Material cost indices (steel, concrete, lumber)
- Labor rate trends by geography
- Complexity factors (parking type, foundation conditions)
- Building code requirements by location

**Model Training:**
- Cost history from completed projects
- Design complexity scoring (irregularity, facade materials, MEP systems)
- Site condition factors (soil type, topography)
- Timeline compression penalties
- Market heating coefficients

**Inference Logic:**
```
1. Find 5-10 comparable projects by:
   - Unit count similarity
   - Building type match
   - Geographic proximity
   - Construction year (inflation adjust)
   
2. Calculate complexity score:
   - Parking type: underground > structured > surface
   - Stories: >8 stories = premium structural
   - Efficiency: <80% = complex layouts
   - Amenity SF: >10% of total = high-end finishes
   
3. Adjust base costs:
   - Apply complexity multipliers
   - Adjust for current material costs
   - Factor in regional labor rates
   - Add soft cost estimates
   
4. Generate confidence score:
   - High: >5 comps within 2 years, same market
   - Medium: 3-5 comps or adjacent markets
   - Low: <3 comps or different building types
```

### Example API Call
```typescript
const costs = await financialAutoSync.estimateCostsWithAI(
  {
    id: 'design-123',
    dealId: 'deal-456',
    totalUnits: 287,
    unitMix: { studio: 43, oneBed: 130, twoBed: 86, threeBed: 28 },
    rentableSF: 175000,
    grossSF: 213415,
    efficiency: 0.82,
    parkingSpaces: 315,
    parkingType: 'structured',
    amenitySF: 15000,
    stories: 8,
    farUtilized: 4.2,
    farMax: 5.0,
    lastModified: '2025-01-10T12:00:00Z'
  },
  'qwen'
);

// Result:
// {
//   hardCosts: {
//     residential: 52500000,
//     parking: 4725000,
//     amenities: 2250000,
//     siteWork: 2300000,
//     contingency: 3088750,
//     total: 64863750
//   },
//   confidence: 0.84,
//   comparableProjects: [
//     { name: 'North End Tower (2023)', costPerSF: 305, similarity: 0.92 },
//     { name: 'Back Bay Residences (2022)', costPerSF: 298, similarity: 0.87 }
//   ],
//   reasoning: 'Based on 6 comparable projects in Boston metro. Structured parking adds $15k/space. 8 stories requires steel frame (~$310/SF). Inflation-adjusted to 2025 Q1 rates.'
// }
```

### Integration Point
Located in: `frontend/src/services/financialAutoSync.service.ts:L315`

Current implementation returns `null`. Replace with Qwen API call.

---

## Implementation Roadmap

### Phase 1: Data Pipeline (Week 1-2)
- [ ] Connect to CoStar API for rent comps
- [ ] Integrate RSMeans cost database
- [ ] Build project similarity matching algorithm
- [ ] Create training dataset (historical projects)

### Phase 2: Model Training (Week 3-4)
- [ ] Train rent prediction model on historical data
- [ ] Train cost estimation model on completed projects
- [ ] Validate predictions against actual outcomes
- [ ] Tune confidence scoring thresholds

### Phase 3: API Integration (Week 5)
- [ ] Build Qwen API wrapper
- [ ] Implement `predictRents` function
- [ ] Implement `estimateCostsWithAI` function
- [ ] Add fallback to formula-based calculations if API fails

### Phase 4: UI Enhancements (Week 6)
- [ ] Show AI predictions vs. manual inputs
- [ ] Display confidence scores visually
- [ ] Allow users to override AI predictions
- [ ] Track prediction accuracy over time

---

## Usage Example

Once implemented, the financial sync service will automatically use AI predictions:

```typescript
// In your component:
const [useAI, setUseAI] = useState(true);

useEffect(() => {
  const assumptions = {
    ...baseAssumptions,
    // If AI available, override manual rents
    marketRents: useAI && aiRents 
      ? {
          studio: aiRents.find(r => r.unitType === 'studio')?.predictedRent || baseRents.studio,
          oneBed: aiRents.find(r => r.unitType === 'oneBed')?.predictedRent || baseRents.oneBed,
          twoBed: aiRents.find(r => r.unitType === 'twoBed')?.predictedRent || baseRents.twoBed,
          threeBed: aiRents.find(r => r.unitType === 'threeBed')?.predictedRent || baseRents.threeBed,
        }
      : baseRents,
  };

  financialAutoSync.updateAssumptions(design3D.id, assumptions);
}, [useAI, aiRents, baseRents]);
```

---

## Testing Strategy

### Rent Prediction Tests
1. **Accuracy Test**: Compare AI predictions to actual signed leases
2. **Confidence Calibration**: Verify confidence scores match actual accuracy
3. **Comp Quality**: Ensure comps are truly comparable
4. **Market Timing**: Test across different market cycles

### Cost Estimation Tests
1. **Comparable Matching**: Validate similarity scoring algorithm
2. **Cost Accuracy**: Compare AI estimates to final project costs
3. **Complexity Adjustment**: Test on simple vs. complex projects
4. **Regional Variation**: Verify geography-based adjustments

### Integration Tests
1. **Fallback Logic**: Ensure formula-based calc when AI unavailable
2. **Performance**: Measure API latency impact
3. **Error Handling**: Test API failures gracefully
4. **Cache Strategy**: Avoid redundant AI calls for same inputs

---

## Future Enhancements

1. **Lease-Up Speed Prediction**: AI estimates time to stabilization
2. **Exit Timing Optimizer**: Best time to sell based on market cycles
3. **Unit Mix Optimizer**: AI suggests ideal unit mix for location
4. **Design-for-Value**: AI recommends design changes to maximize returns
5. **Risk Scoring**: AI calculates development risk score

---

## API Cost Considerations

- **Qwen API Cost**: ~$0.01-0.05 per inference
- **Caching Strategy**: Cache predictions for 24 hours
- **Rate Limiting**: Max 100 API calls/hour
- **Fallback**: Always maintain formula-based calculations

---

**Status**: 🔴 Not Yet Implemented  
**Priority**: 🟡 Medium (Phase 2 feature)  
**Estimated Effort**: 6 weeks (1 developer)  
**Dependencies**: Qwen API access, CoStar API, RSMeans database
