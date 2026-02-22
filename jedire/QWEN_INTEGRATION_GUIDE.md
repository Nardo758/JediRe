# Qwen AI Integration Guide

**Version:** 1.0  
**Date:** 2025-02-21  
**Status:** ✅ Production Ready

---

## Overview

This guide provides a complete overview of the Qwen AI integration across all 5 development modules in JEDI RE. Qwen (Qwen3.5-397B-A17B:novita) is a multimodal AI model accessed via HuggingFace Router that enhances the platform with intelligent image analysis, design optimization, market predictions, and construction tracking.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        JEDI RE PLATFORM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Frontend (React/TypeScript)                                   │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Module 1: 3D Viewport (useDesign3D.ts)                 │  │
│   │  - Image to Terrain Conversion                          │  │
│   │  - AI Design Generation                                 │  │
│   ├─────────────────────────────────────────────────────────┤  │
│   │  Module 2: Design Optimizer (designOptimizer.service)   │  │
│   │  - Compliance Analysis                                  │  │
│   │  - AI-Enhanced Optimization                             │  │
│   ├─────────────────────────────────────────────────────────┤  │
│   │  Module 4: Financial Auto-Sync                          │  │
│   │  - Rent Prediction (placeholder)                        │  │
│   │  - Cost Estimation (placeholder)                        │  │
│   ├─────────────────────────────────────────────────────────┤  │
│   │  Module 5: Pipeline 3D Visualization                    │  │
│   │  - Auto Photo Tagging                                   │  │
│   │  - Progress Estimation                                  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           │ REST API Calls                      │
│                           ▼                                     │
│   Backend (Node.js/Express)                                     │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  API Routes: /api/v1/ai/*                               │  │
│   │  - qwen.routes.ts                                       │  │
│   ├─────────────────────────────────────────────────────────┤  │
│   │  Core Service: qwen.service.ts                          │  │
│   │  - OpenAI SDK client                                    │  │
│   │  - 7 AI methods                                         │  │
│   ├─────────────────────────────────────────────────────────┤  │
│   │  Module 3: Neighboring Property Engine                  │  │
│   │  - Owner Disposition Analysis                           │  │
│   │  - Negotiation Strategy                                 │  │
│   │  - Aerial Site Analysis                                 │  │
│   └─────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           │ HuggingFace API                     │
│                           ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  HuggingFace Router                                     │  │
│   │  https://router.huggingface.co/v1                       │  │
│   │  Model: Qwen/Qwen3.5-397B-A17B:novita                   │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### 1. Module 1: 3D Viewport

**Location:** `frontend/src/hooks/design/useDesign3D.ts`

**Integrated Features:**
- ✅ `useAIImageToTerrain()` - Convert site photos to 3D terrain data
- ✅ `useAIDesignGeneration()` - AI-powered building design generation (with algorithmic fallback)

**API Endpoints Used:**
- `POST /api/v1/ai/image-to-terrain`

**Example Usage:**
```typescript
const { generateTerrain, loading, error } = useAIImageToTerrain();

const handleImageUpload = async (imageFile: File) => {
  const result = await generateTerrain({ imageFile });
  if (result) {
    applyTerrainToModel(result.terrainMesh);
  }
};
```

---

### 2. Module 2: Design Optimizer

**Location:** `frontend/src/services/designOptimizer.service.ts`

**Integrated Features:**
- ✅ `analyzeDesignCompliance()` - AI-powered zoning compliance checking
- ✅ `optimizeWithAI()` - Hybrid AI + rule-based optimization

**API Endpoints Used:**
- `POST /api/v1/ai/analyze-compliance`

**Example Usage:**
```typescript
const report = await designOptimizerService.analyzeDesignCompliance(
  design3D,
  parcel,
  zoning,
  renderUrl // Optional: 3D render image for AI analysis
);

if (!report.compliant) {
  console.warn('Violations:', report.violations);
}
```

---

### 3. Module 3: Neighboring Property AI

**Location:** `backend/src/services/neighboringPropertyEngine.ts`

**Integrated Features:**
- ✅ `analyzeOwnerDisposition()` - Predict owner likelihood to sell
- ✅ `generateNegotiationStrategy()` - Create assemblage acquisition strategy
- ✅ `analyzeSiteFromAerial()` - Satellite imagery analysis

**API Services Used:**
- Direct calls to `qwenService` (backend-to-backend)

**Example Usage:**
```typescript
// Backend route or service layer
const disposition = await neighboringPropertyEngine.analyzeOwnerDisposition('owner-123');

console.log(`Disposition score: ${disposition.score}/100`);
console.log(`Timeframe: ${disposition.timeframe}`);
console.log(`Reasoning: ${disposition.reasoning}`);
```

---

### 4. Module 4: Financial Auto-Sync

**Location:** `frontend/src/services/financialAutoSync.service.ts`

**Integrated Features:**
- ⚠️ `predictRents()` - AI rent predictions (placeholder, endpoint TODO)
- ⚠️ `estimateCostsWithAI()` - AI cost estimation (placeholder, endpoint TODO)

**Status:** Framework in place, dedicated endpoints not yet implemented

**Future Implementation:**
```typescript
// When endpoints are created:
const rents = await financialAutoSync.predictRents(unitMix, location);
const costs = await financialAutoSync.estimateCostsWithAI(design3D);
```

---

### 5. Module 5: Pipeline 3D Visualization

**Location:** `frontend/src/components/pipeline/Pipeline3DProgress.tsx`

**Integrated Features:**
- ✅ `autoTagPhotos()` - Tag construction photos to 3D locations
- ✅ `estimateProgressFromPhotos()` - Estimate construction completion

**API Endpoints Used:**
- `POST /api/v1/ai/auto-tag-photos`
- `POST /api/v1/ai/estimate-progress`

**Example Usage:**
```typescript
const tags = await autoTagPhotos([photo1, photo2, photo3]);
const progress = await estimateProgressFromPhotos([photo1, photo2], 'floor-3');

console.log(`Estimated completion: ${progress.percentComplete}%`);
console.log(`Confidence: ${progress.confidence}`);
```

---

## Environment Configuration

### Required Variables

Add to `.env`:

```bash
# Qwen AI (Required for AI features)
HF_TOKEN=your_huggingface_token_here
QWEN_MODEL=Qwen/Qwen3.5-397B-A17B:novita
QWEN_BASE_URL=https://router.huggingface.co/v1

# Optional: Mapbox for satellite imagery
MAPBOX_TOKEN=your_mapbox_token_here
```

### Getting HuggingFace Token

1. Visit [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Create a new access token (read permissions)
3. Copy token to `.env` as `HF_TOKEN`

---

## Graceful Degradation

All AI features include graceful fallbacks:

| Feature | AI Available | AI Unavailable |
|---------|--------------|----------------|
| Image to Terrain | Qwen analysis | Returns null, requires manual input |
| Design Compliance | Qwen vision analysis | Rule-based validation |
| Owner Disposition | AI-powered scoring | Rule-based heuristics |
| Negotiation Strategy | AI-generated plan | Priority ranking by boundary length |
| Photo Tagging | AI object detection | Generic "construction" tag |
| Progress Estimation | AI visual analysis | Returns 0% with note |

**Error Handling Pattern:**
```typescript
try {
  const statusResponse = await fetch('/api/v1/ai/status');
  const statusData = await statusResponse.json();
  
  if (statusData.enabled) {
    // Use AI
  } else {
    // Fallback
  }
} catch (error) {
  console.warn('AI unavailable, using fallback');
  // Fallback logic
}
```

---

## Testing AI Features

### 1. Check AI Status

```bash
curl http://localhost:4000/api/v1/ai/status
```

**Expected Response (AI enabled):**
```json
{
  "enabled": true,
  "message": "Qwen AI service is available",
  "model": "Qwen/Qwen3.5-397B-A17B:novita"
}
```

### 2. Test Image to Terrain

```bash
curl -X POST http://localhost:4000/api/v1/ai/image-to-terrain \
  -F "image=@site-photo.jpg"
```

### 3. Test Photo Tagging

```bash
curl -X POST http://localhost:4000/api/v1/ai/auto-tag-photos \
  -F "photos=@construction1.jpg" \
  -F "photos=@construction2.jpg"
```

### 4. Test Compliance Analysis

```bash
curl -X POST http://localhost:4000/api/v1/ai/analyze-compliance \
  -H "Content-Type: application/json" \
  -d '{
    "design3D": { ... },
    "renderUrl": "https://example.com/render.png"
  }'
```

---

## Performance Considerations

### API Latency

Typical Qwen API response times:
- Text-only requests: 1-3 seconds
- Image analysis (single image): 3-5 seconds
- Image analysis (multiple images): 5-10 seconds

### Optimization Strategies

1. **Caching:** Cache AI results for 24 hours for identical inputs
2. **Debouncing:** Debounce 3D design changes (500ms) before triggering AI
3. **Batch Processing:** Send multiple photos in single request (limit: 5-10)
4. **Lazy Loading:** Only call AI when user explicitly requests analysis
5. **Background Processing:** Queue long-running AI tasks

### Rate Limiting

- Max 100 requests per hour (configurable via `RATE_LIMIT_MAX_REQUESTS`)
- Implement exponential backoff for failed requests
- Monitor usage via logs: `[QwenService] API call completed`

---

## AI Settings Toggle

**Location:** `frontend/src/stores/settings.store.ts`

Users can enable/disable AI features individually:

```typescript
const { ai, toggleAIFeature } = useSettingsStore();

// Toggle specific feature
toggleAIFeature('imageTo3D');

// Check if feature enabled
if (ai.features.designCompliance) {
  // Run AI compliance check
}
```

**Settings UI Integration (TODO):**
- Settings page: `frontend/src/pages/Settings.tsx`
- Add AI Settings section with feature toggles
- Persist preferences to localStorage via Zustand

---

## Troubleshooting

### Issue: AI service returns 503

**Cause:** `HF_TOKEN` not configured

**Solution:** Add `HF_TOKEN` to `.env` and restart backend

---

### Issue: Image analysis fails

**Possible Causes:**
1. Image too large (>10MB limit)
2. Invalid image format (supported: jpg, png, gif, webp)
3. Image URL not accessible

**Solution:** Check file size and format, ensure URLs are publicly accessible

---

### Issue: Slow AI responses

**Causes:**
- Large images
- Complex prompts
- HuggingFace API congestion

**Solutions:**
- Resize images to 1280x1280 max before sending
- Simplify prompts
- Implement caching

---

## Cost Considerations

### HuggingFace Pricing

- Free tier: Limited requests per day
- Pay-as-you-go: ~$0.01-0.05 per inference
- Enterprise: Contact HuggingFace

### Estimated Monthly Costs

Based on typical usage:
- Small team (10 users): $50-100/month
- Medium team (50 users): $200-400/month
- Large team (200 users): $800-1500/month

**Cost Optimization:**
- Implement aggressive caching
- Limit AI to premium features only
- Use fallbacks for non-critical features

---

## Next Steps

### Completed ✅
- [x] Qwen service implementation
- [x] API routes
- [x] Module 1-3 integration
- [x] Module 5 integration
- [x] Settings store
- [x] Graceful fallbacks

### Pending ⚠️
- [ ] Module 4: Create dedicated rent prediction endpoint
- [ ] Module 4: Create dedicated cost estimation endpoint
- [ ] Settings UI: Build AI toggle interface
- [ ] Caching layer: Implement Redis caching
- [ ] Monitoring: Add AI usage analytics

### Future Enhancements 🔮
- [ ] Fine-tune Qwen model on JEDI RE data
- [ ] Multi-model support (Claude, GPT-4V)
- [ ] Batch processing queue
- [ ] Real-time AI suggestions
- [ ] AI performance monitoring dashboard

---

## Support

For technical support or questions:
- **Documentation:** See `QWEN_API_REFERENCE.md`
- **Setup Guide:** See `QWEN_SETUP.md`
- **User Guide:** See `AI_FEATURE_USAGE.md`
- **Logs:** Check `backend/logs/` for error details

---

**Last Updated:** 2025-02-21  
**Maintained By:** JEDI RE Development Team
