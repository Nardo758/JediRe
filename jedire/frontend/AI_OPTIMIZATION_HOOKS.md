# AI Optimization Hooks - Integration Guide

## Overview

This document outlines integration points for AI-powered optimization using Qwen (or other vision/language models) to enhance the design optimizer algorithms.

## Current State

All optimization algorithms currently use **rule-based** logic:
- Unit Mix: Greedy algorithm weighted by NOI per sqft × demand factor
- Parking: Cost-benefit analysis with type selection logic
- Amenities: ROI-based selection with priority tiers
- Massing: Geometric calculation based on FAR and setbacks

These provide **proven, deterministic results** and serve as the foundation layer.

## AI Enhancement Strategy

### Phase 1: Validation & Insights (Recommended First Step)

**Location:** `designOptimizer.service.ts` → `analyzeDesignCompliance()`

**Current:** Rule-based validation only
```typescript
async analyzeDesignCompliance(design: Design3D, ...): Promise<ComplianceReport> {
  return this.validateRuleBased(design, parcel, zoning);
}
```

**AI Enhancement:**
```typescript
async analyzeDesignCompliance(
  design: Design3D, 
  parcel: ParcelData,
  zoning: ZoningRequirements,
  useAI: boolean = false
): Promise<ComplianceReport> {
  // Rule-based validation (always run)
  const ruleBasedReport = this.validateRuleBased(design, parcel, zoning);
  
  if (!useAI) return ruleBasedReport;
  
  // AI enhancement: Visual analysis with Qwen
  const aiInsights = await this.analyzeWithQwen(design, parcel, zoning);
  
  return {
    ...ruleBasedReport,
    aiInsights: aiInsights.observations,
    aiRecommendations: aiInsights.recommendations,
    visualCompliance: aiInsights.visualChecks
  };
}

private async analyzeWithQwen(design: Design3D, ...): Promise<AIInsights> {
  // TODO: Implement Qwen API call
  // 1. Render 3D design to image (multiple views)
  // 2. Send to Qwen with prompt:
  //    "Analyze this building design for zoning compliance. Check:
  //     - Setback violations
  //     - Height restrictions
  //     - Massing proportions
  //     - Architectural concerns"
  // 3. Parse Qwen response for insights
  
  throw new Error('Not implemented - integrate Qwen API here');
}
```

**Why Start Here:**
- Non-destructive: Doesn't change optimization logic
- Provides AI value without risk
- Great for catching edge cases rule-based logic misses
- Can generate visual compliance reports for stakeholders

---

### Phase 2: Optimization Enhancement (Advanced)

**Location:** `designOptimizer.service.ts` → `optimizeWithAI()`

**Current:** Placeholder that falls back to rule-based
```typescript
async optimizeWithAI(params, model = 'qwen'): Promise<...> {
  console.warn('AI optimization not yet implemented');
  // Falls back to rule-based
}
```

**AI Enhancement:**
```typescript
async optimizeWithAI(
  params: {
    marketData: MarketDemandData;
    parcel: ParcelData;
    zoning: ZoningRequirements;
    costs: ConstructionCosts;
    options?: OptimizationOptions;
  },
  model: 'qwen' | 'gpt4' = 'qwen'
): Promise<OptimizationResult> {
  
  // Step 1: Get rule-based baseline
  const baseline = this.optimizeCompleteDesign(
    params.marketData,
    params.parcel,
    params.zoning,
    params.costs,
    params.options
  );
  
  // Step 2: Ask AI for alternative strategies
  const aiPrompt = `
    Given this development opportunity:
    - Parcel: ${params.parcel.lotSizeSqft} sqft, FAR ${params.parcel.zoningFAR}
    - Market: Studio $${params.marketData.studioRentPSF}/sqft, 1BR $${params.marketData.oneBrRentPSF}/sqft...
    
    Our algorithm suggests:
    - Unit mix: ${baseline.unitMix.studio} studios, ${baseline.unitMix.oneBR} 1BR...
    - NOI: $${baseline.totalNOI}
    - Yield: ${(baseline.yieldOnCost * 100).toFixed(1)}%
    
    Suggest 3 alternative strategies that might:
    1. Maximize long-term value (not just NOI)
    2. Differentiate from competition
    3. Capitalize on emerging trends
  `;
  
  const aiResponse = await this.callQwenAPI(aiPrompt);
  
  // Step 3: Parse AI suggestions and validate
  const alternatives = this.parseAIStrategies(aiResponse);
  const validatedAlternatives = alternatives.map(alt => {
    const compliance = this.validateRuleBased(alt.design, params.parcel, params.zoning);
    return { ...alt, compliance };
  }).filter(alt => alt.compliance.compliant);
  
  return {
    baseline,
    aiAlternatives: validatedAlternatives,
    recommendation: this.selectBestStrategy(baseline, validatedAlternatives, params.options)
  };
}
```

**Use Cases:**
- Explore non-obvious unit mix strategies (e.g., all micro-units, co-living)
- Identify creative amenity combinations
- Suggest adaptive reuse opportunities
- Optimize for sustainability/LEED beyond basic ROI

---

### Phase 3: Iterative Optimization (Experimental)

**Concept:** Use AI in a feedback loop to refine designs

```typescript
async iterativeOptimization(
  params: OptimizationParams,
  maxIterations: number = 3
): Promise<OptimizationResult> {
  
  let currentBest = this.optimizeCompleteDesign(params);
  
  for (let i = 0; i < maxIterations; i++) {
    // Render current design
    const visualization = await this.renderDesign(currentBest);
    
    // Ask AI: "How can we improve this design?"
    const aiSuggestions = await this.callQwenAPI({
      image: visualization,
      context: params,
      prompt: "Critique this design and suggest specific improvements"
    });
    
    // Apply AI suggestions and re-optimize
    const refinedParams = this.applyAISuggestions(params, aiSuggestions);
    const refinedDesign = this.optimizeCompleteDesign(refinedParams);
    
    // Keep if better
    if (refinedDesign.yieldOnCost > currentBest.yieldOnCost) {
      currentBest = refinedDesign;
    } else {
      break; // Converged
    }
  }
  
  return currentBest;
}
```

---

## Integration Checklist

### Prerequisites
- [ ] Qwen API credentials / endpoint
- [ ] 3D rendering library (Three.js already available)
- [ ] Image generation from 3D models
- [ ] AI response parsing utilities

### Implementation Steps

**Phase 1: Visual Compliance**
1. [ ] Implement `renderDesignToImage()` function
2. [ ] Create Qwen API client wrapper
3. [ ] Write compliance-focused prompts
4. [ ] Parse AI responses to structured format
5. [ ] Add UI toggle for "AI-enhanced validation"
6. [ ] Test with 10+ real parcels

**Phase 2: Alternative Strategies**
1. [ ] Design prompt templates for optimization
2. [ ] Implement strategy parsing logic
3. [ ] Add validation layer for AI suggestions
4. [ ] Create comparison UI (baseline vs. AI alternatives)
5. [ ] A/B test: Do developers prefer AI suggestions?

**Phase 3: Iterative Refinement**
1. [ ] Build feedback loop infrastructure
2. [ ] Define convergence criteria
3. [ ] Measure: Does iteration improve results?
4. [ ] Performance optimization (caching, batching)

---

## API Integration Example

### Qwen Vision API Call

```typescript
interface QwenRequest {
  model: 'qwen-vl-max' | 'qwen-vl-plus';
  messages: Array<{
    role: 'user' | 'assistant';
    content: Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: { url: string };
    }>;
  }>;
}

async function callQwenAPI(
  imageDataUrl: string,
  prompt: string
): Promise<string> {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-vl-max',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageDataUrl } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });
  
  const data = await response.json();
  return data.output.choices[0].message.content;
}
```

---

## Testing Strategy

### Rule-Based Testing (Current)
```typescript
describe('Unit Mix Optimizer', () => {
  it('should maximize NOI within FAR constraints', () => {
    const result = optimizeUnitMix(mockParams);
    expect(result.farUtilization).toBeLessThanOrEqual(mockParams.parcel.zoningFAR);
    expect(result.projectedNOI).toBeGreaterThan(0);
  });
});
```

### AI-Enhanced Testing (Future)
```typescript
describe('AI Compliance Analysis', () => {
  it('should identify setback violations missed by rules', async () => {
    const design = createDesignWithSubtleViolation();
    const report = await analyzeDesignCompliance(design, { useAI: true });
    expect(report.aiInsights).toContain('setback');
  });
  
  it('should provide actionable recommendations', async () => {
    const report = await analyzeDesignCompliance(mockDesign, { useAI: true });
    expect(report.aiRecommendations.length).toBeGreaterThan(0);
    report.aiRecommendations.forEach(rec => {
      expect(rec).toMatch(/^(Reduce|Increase|Consider|Add)/);
    });
  });
});
```

---

## Performance Considerations

**AI Calls Are Slow:**
- Rule-based: ~10-50ms
- AI-enhanced: ~2-5 seconds per call

**Optimization:**
1. **Async with fallback:** Show rule-based results immediately, AI insights on load
2. **Caching:** Cache AI responses for identical inputs (hash parcel + params)
3. **Batching:** Combine multiple questions in one API call
4. **Progressive enhancement:** Start with rules, upgrade to AI as user explores

**Example:**
```typescript
async optimizeWithProgressiveAI(params) {
  // Immediate: Rule-based
  const baseline = this.optimizeCompleteDesign(params);
  this.emitResult({ phase: 'baseline', result: baseline });
  
  // Background: AI enhancement
  const aiEnhanced = await this.optimizeWithAI(params);
  this.emitResult({ phase: 'ai-enhanced', result: aiEnhanced });
}
```

---

## Security & Privacy

**Considerations:**
- [ ] Don't send sensitive property addresses to external APIs
- [ ] Anonymize coordinates (use relative geometry only)
- [ ] Cache AI responses locally to reduce API calls
- [ ] Add user consent toggle: "Share anonymized designs with AI"

---

## Success Metrics

**How to measure if AI adds value:**

1. **Accuracy:** Does AI catch violations rules miss?
2. **Creativity:** Do developers adopt AI-suggested alternatives?
3. **Speed:** Does AI reduce time to optimal design?
4. **ROI:** Do AI-optimized projects outperform rule-based?

**Tracking:**
```typescript
analytics.track('ai_optimization_used', {
  baseline_noi: baseline.totalNOI,
  ai_noi: aiResult.totalNOI,
  improvement_pct: ((aiResult.totalNOI - baseline.totalNOI) / baseline.totalNOI) * 100,
  user_selected: 'baseline' | 'ai_alternative_1' | 'ai_alternative_2'
});
```

---

## Questions for Product Team

Before implementing AI:
1. What's the primary goal? (Accuracy, creativity, speed, differentiation?)
2. Who's the target user? (Novice developers need more AI guidance vs. pros want speed)
3. What's the acceptable latency? (2s? 5s? 30s?)
4. Budget for AI API calls? (Qwen: ~$0.01-0.05 per call)
5. Legal: Can we send property data to external APIs?

---

## Next Steps

**Immediate (Phase 1):**
1. Set up Qwen API access
2. Build image rendering pipeline
3. Implement `analyzeDesignCompliance()` with AI toggle
4. User test with 5-10 developers

**Short-term (Phase 2):**
1. Collect feedback on Phase 1
2. If positive, build `optimizeWithAI()` for alternative strategies
3. A/B test: AI vs. rule-based adoption

**Long-term (Phase 3):**
1. Explore iterative optimization
2. Build custom fine-tuned model on historical projects
3. Real-time collaborative AI ("AI co-pilot" mode)

---

## File Locations

**Service Files:**
- `/src/services/designOptimizer.service.ts` - Main service (add AI methods here)
- `/src/services/optimizationAlgorithms.ts` - Core algorithms (keep rule-based)

**New Files Needed:**
- `/src/services/qwen.client.ts` - Qwen API wrapper
- `/src/services/design3DRenderer.ts` - Convert Design3D to images
- `/src/utils/aiResponseParser.ts` - Parse structured data from AI text

**Tests:**
- `/src/services/__tests__/designOptimizer.test.ts`
- `/src/services/__tests__/aiOptimization.test.ts` (new)

---

**Questions? Contact:** Development team lead or AI integration specialist
