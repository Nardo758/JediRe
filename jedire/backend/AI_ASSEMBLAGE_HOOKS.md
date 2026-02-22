# AI Assemblage Analysis Integration Hooks

**Status:** 🚧 Framework Ready - AI Integration Pending  
**Target AI Model:** Qwen (Alibaba's Qwen2.5 or Qwen-VL for vision)  
**Purpose:** Enhance neighboring property recommendations with AI-powered insights

---

## Overview

The Neighboring Property Recommendation Engine is built with **AI enhancement hooks** - specific integration points where AI models (like Qwen) can be plugged in to supercharge the analysis. The core spatial and financial analysis works immediately with rule-based logic, but adding AI unlocks powerful capabilities.

---

## Integration Points

### 1. Owner Disposition Analysis

**Hook Location:** `neighboringPropertyEngine.analyzeOwnerDisposition()`  
**Current Status:** Placeholder (rule-based heuristics)  
**AI Enhancement:** Qwen text analysis

#### What It Does (Future)
Analyzes owner background, property holding patterns, and market signals to predict willingness to sell.

#### Input to AI
```typescript
{
  ownerId: "owner-uuid",
  ownerName: "ABC Trust LLC",
  ownerType: "trust",
  properties: [
    {
      parcelId: "13-0123-0001-001",
      address: "123 Main St, Atlanta, GA",
      purchaseDate: "2015-03-15",
      holdingPeriod: 9.5, // years
      currentValue: 4200000,
      purchasePrice: 2800000,
      appreciation: 0.50,
      assessedValue: 3900000,
      taxStatus: "current", // or "delinquent"
      recentActivity: []
    }
  ],
  marketConditions: {
    medianHoldingPeriod: 7.2,
    appreciationRate: 0.38,
    recentSalesInArea: 12
  }
}
```

#### Expected AI Output
```typescript
{
  dispositionScore: 72, // 0-100, higher = more likely to sell
  reasoning: "Owner is a trust entity with above-market appreciation (50% vs 38% market avg). Holding period of 9.5 years exceeds median (7.2y), suggesting potential exit timing. Tax status current indicates no distress, but appreciation suggests profit-taking opportunity.",
  signals: [
    { type: "positive", factor: "Long holding period", weight: 0.3 },
    { type: "positive", factor: "Strong appreciation", weight: 0.25 },
    { type: "negative", factor: "No tax delinquency", weight: -0.1 }
  ],
  recommendedApproach: "off-market",
  confidenceLevel: 0.78
}
```

#### Qwen Prompt Template
```
You are a real estate investment analyst specializing in land assemblage.

Analyze the following property owner data and predict their likelihood of selling:

Owner Profile:
- Name: {ownerName}
- Type: {ownerType}
- Properties Owned: {propertyCount}

Property Performance:
- Holding Period: {holdingPeriod} years (market median: {marketMedian} years)
- Purchase Price: ${purchasePrice}
- Current Value: ${currentValue}
- Appreciation: {appreciation}% (market: {marketAppreciation}%)
- Tax Status: {taxStatus}

Recent Market Activity:
{recentSalesData}

Provide a JSON response with:
1. dispositionScore (0-100)
2. reasoning (detailed explanation)
3. signals (positive/negative factors with weights)
4. recommendedApproach (off-market, direct, broker, auction)
5. confidenceLevel (0-1)
```

---

### 2. Negotiation Strategy Generation

**Hook Location:** `neighboringPropertyEngine.generateNegotiationStrategy()`  
**Current Status:** Placeholder  
**AI Enhancement:** Qwen multi-turn reasoning

#### What It Does (Future)
Creates a custom acquisition strategy considering owner profiles, market timing, and assemblage value.

#### Input to AI
```typescript
{
  primaryParcel: {
    parcelId: "13-0123-0001-000",
    currentUnits: 287,
    currentValue: 82900000,
    developmentPlan: "Class A multifamily"
  },
  neighbors: [
    {
      parcelId: "13-0123-0001-001",
      ownerDisposition: 72,
      estimatedValue: 4200000,
      additionalUnits: 52,
      benefitScore: 85
    },
    {
      parcelId: "13-0123-0001-002",
      ownerDisposition: 45,
      estimatedValue: 3800000,
      additionalUnits: 38,
      benefitScore: 62
    }
  ],
  marketConditions: {
    inventoryLevel: "low",
    demandTrend: "increasing",
    constructionCosts: "rising"
  },
  budget: {
    maxAcquisition: 12000000,
    preferredStructure: "all-cash"
  }
}
```

#### Expected AI Output
```typescript
{
  strategy: {
    acquisitionSequence: [
      {
        parcelId: "13-0123-0001-001",
        priority: 1,
        reasoning: "Highest benefit score (85) and strong owner disposition (72). Acquire first to secure best unit addition (52 units).",
        approach: "off-market direct contact",
        offerStructure: {
          initialOffer: 3950000,
          maxPrice: 4350000,
          structure: "all-cash, 30-day close",
          contingencies: ["title", "environmental"]
        }
      },
      {
        parcelId: "13-0123-0001-002",
        priority: 2,
        reasoning: "Lower disposition (45) - wait until first parcel secured to demonstrate assemblage value.",
        approach: "broker-assisted",
        offerStructure: {
          initialOffer: 3600000,
          maxPrice: 4100000,
          structure: "70% cash, 30% seller note",
          contingencies: ["title", "environmental", "first parcel closing"]
        }
      }
    ],
    timing: {
      phase1: "Weeks 1-4: Approach Parcel 001 owner",
      phase2: "Weeks 5-8: Close Parcel 001, begin Parcel 002 discussions",
      phase3: "Weeks 9-12: Close Parcel 002"
    },
    talkingPoints: {
      parcel001: [
        "Highlight 9.5 year holding period - time to realize gains",
        "Emphasize all-cash, quick close (no financing contingency)",
        "Position as confidential off-market transaction"
      ],
      parcel002: [
        "Demonstrate assemblage value with Parcel 001 secured",
        "Offer seller financing to bridge valuation gap",
        "Frame as part of larger development creating neighborhood value"
      ]
    },
    riskMitigation: [
      "Pre-qualify alternative parcels if negotiations fail",
      "Set walk-away price at $4.35M for Parcel 001",
      "Maintain confidentiality to avoid competitive bidding"
    ]
  },
  estimatedSuccessRate: 0.68,
  totalTimeline: "12-16 weeks"
}
```

---

### 3. Aerial Image Context Analysis

**Hook Location:** `neighboringPropertyEngine.analyzeSiteFromAerial()`  
**Current Status:** Placeholder  
**AI Enhancement:** Qwen-VL (vision-language model)

#### What It Does (Future)
Analyzes satellite/aerial imagery to identify site constraints, opportunities, and context.

#### Input to AI
```typescript
{
  coordinates: {
    lat: 33.7490,
    lng: -84.3880
  },
  imageUrl: "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/-84.3880,33.7490,17/1280x1280?access_token=...",
  parcelBoundary: {
    type: "Polygon",
    coordinates: [...]
  },
  context: {
    zoning: "RM-4",
    existingUse: "surface parking lot",
    assemblageParcels: ["adjacent north", "adjacent east"]
  }
}
```

#### Expected AI Output
```typescript
{
  siteAnalysis: {
    accessQuality: {
      score: 85,
      description: "Excellent street frontage on Main St (arterial). Secondary access from Oak Ave (local street). Potential for two-way traffic flow."
    },
    constraints: [
      {
        type: "topography",
        severity: "low",
        description: "Gentle slope (3-5%) from NE to SW corner. Manageable with standard grading.",
        impact: "Minor additional site prep cost (~$50k)"
      },
      {
        type: "utilities",
        severity: "medium",
        description: "Overhead power lines cross northeast corner. May require relocation.",
        impact: "Potential $150-200k utility relocation"
      }
    ],
    opportunities: [
      {
        type: "views",
        description: "Western exposure provides views toward downtown skyline (1.2mi away)",
        value: "Premium unit pricing potential for west-facing units (+$50-75/month)"
      },
      {
        type: "adjacency",
        description: "North parcel has mature tree buffer (~40ft). Retain for privacy/aesthetics.",
        value: "Enhanced amenity value, potential LEED points"
      }
    ],
    neighboringUses: {
      north: "Single-family residential (older homes, potential future redevelopment)",
      south: "Retail strip center (stable, provides walkability)",
      east: "Office building (4 stories, compatible use)",
      west: "Main St arterial (high visibility, some traffic noise)"
    },
    environmentalFlags: [
      "Possible wetland in SE corner (dark vegetation visible). Requires delineation study.",
      "No obvious contamination visible (clean pavement, no staining)"
    ]
  },
  developmentRecommendations: [
    "Orient building to maximize western views",
    "Buffer north edge with landscaping to respect residential adjacency",
    "Investigate wetland status early in due diligence",
    "Plan utility relocation budget and timeline",
    "Consider retail/commercial space on ground floor facing Main St"
  ],
  confidenceLevel: 0.82
}
```

#### Qwen-VL Prompt Template
```
You are analyzing an aerial/satellite image of a development site for a multifamily real estate project.

Site Location: {lat}, {lng}
Zoning: {zoning}
Current Use: {existingUse}
Assemblage Context: {assemblageParcels}

Analyze the image and identify:
1. Access/Circulation: Quality of street access, potential ingress/egress
2. Site Constraints: Topography, utilities, environmental concerns
3. Opportunities: Views, adjacencies, unique features
4. Neighboring Uses: What surrounds the site?
5. Environmental Flags: Possible wetlands, contamination, protected features

Provide detailed JSON output with confidence scores for each observation.
```

---

## Implementation Roadmap

### Phase 1: AI Model Setup (Week 1)
- [ ] Set up Qwen API access (Alibaba Cloud or local deployment)
- [ ] Configure environment variables for API keys
- [ ] Create AI service wrapper (`src/services/aiService.ts`)
- [ ] Test basic Qwen API calls

### Phase 2: Owner Disposition (Week 2)
- [ ] Implement `analyzeOwnerDisposition()` with Qwen
- [ ] Pull owner historical data from database
- [ ] Format prompt and parse JSON response
- [ ] Add caching to reduce API calls
- [ ] Create admin dashboard for disposition scores

### Phase 3: Negotiation Strategy (Week 3)
- [ ] Implement `generateNegotiationStrategy()` with Qwen
- [ ] Build multi-step reasoning chain for complex scenarios
- [ ] Add strategy export to PDF/document format
- [ ] Integrate with deal tracking system

### Phase 4: Aerial Analysis (Week 4)
- [ ] Set up Mapbox/Google satellite imagery API
- [ ] Implement Qwen-VL image analysis
- [ ] Parse vision model output to structured data
- [ ] Create visual overlay for constraints/opportunities on map

### Phase 5: Learning & Refinement (Week 5)
- [ ] Implement feedback loop (track AI predictions vs actual outcomes)
- [ ] Fine-tune prompts based on results
- [ ] Add confidence thresholds (only show high-confidence insights)
- [ ] Create AI performance dashboard

---

## Cost Estimates

### Qwen API Pricing (Estimated)
- **Text Analysis (Owner Disposition):** ~$0.05 per analysis
- **Multi-turn Strategy:** ~$0.15 per strategy generation
- **Vision Analysis:** ~$0.10 per image

### Monthly Volume Estimates (100 active users)
- Owner analyses: ~500/month = $25
- Strategies: ~200/month = $30
- Aerial analyses: ~300/month = $30
- **Total:** ~$85/month

### Self-Hosted Alternative
- Deploy Qwen locally on GPU server
- One-time setup cost, no per-call fees
- Requires 24GB+ VRAM for Qwen-VL model

---

## Testing AI Integration

Create test cases for each hook:

```typescript
// tests/ai-assemblage.test.ts

describe('AI Assemblage Hooks', () => {
  
  it('should analyze owner disposition with AI', async () => {
    const result = await neighboringPropertyEngine.analyzeOwnerDisposition(
      'test-owner-id',
      'qwen'
    );
    
    expect(result.dispositionScore).toBeGreaterThanOrEqual(0);
    expect(result.dispositionScore).toBeLessThanOrEqual(100);
    expect(result.reasoning).toBeTruthy();
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('should generate negotiation strategy', async () => {
    const mockNeighbors = [/* test data */];
    const result = await neighboringPropertyEngine.generateNegotiationStrategy(
      mockNeighbors,
      'qwen'
    );
    
    expect(result.strategy.acquisitionSequence).toBeTruthy();
    expect(result.estimatedSuccessRate).toBeGreaterThan(0);
  });

  it('should analyze aerial imagery', async () => {
    const coords = { lat: 33.7490, lng: -84.3880 };
    const result = await neighboringPropertyEngine.analyzeSiteFromAerial(coords);
    
    expect(result.siteAnalysis.accessQuality).toBeTruthy();
    expect(result.developmentRecommendations.length).toBeGreaterThan(0);
  });
});
```

---

## Example Usage (Future)

```typescript
// In deal analysis workflow

const parcelId = '13-0123-0001-000';

// 1. Find neighbors (works now with rule-based logic)
const recommendations = await neighboringPropertyEngine.findNeighbors(parcelId);

// 2. Get AI-enhanced insights for top candidates
for (const rec of recommendations.slice(0, 3)) {
  
  // AI owner analysis
  const disposition = await neighboringPropertyEngine.analyzeOwnerDisposition(
    rec.neighbor.parcelId,
    'qwen'
  );
  
  rec.aiInsights.ownerDispositionAnalysis = disposition;
}

// 3. Generate comprehensive strategy
const strategy = await neighboringPropertyEngine.generateNegotiationStrategy(
  recommendations.slice(0, 3).map(r => r.neighbor),
  'qwen'
);

// 4. Analyze site context
const siteContext = await neighboringPropertyEngine.analyzeSiteFromAerial({
  lat: 33.7490,
  lng: -84.3880
});

// 5. Present to user with AI insights highlighted
```

---

## Notes

- **All AI calls are optional** - the system works without AI, just with lower-quality insights
- **Graceful degradation** - if AI API is down, fall back to rule-based analysis
- **Human-in-the-loop** - AI suggestions are recommendations, not automation
- **Privacy** - Do not send PII to external AI services without consent
- **Caching** - Store AI results in database to avoid redundant API calls

**Built by:** Subagent neighboring-property-ai  
**Date:** 2025-02-21  
**Integration Target:** Qwen (Alibaba Cloud / Self-hosted)
