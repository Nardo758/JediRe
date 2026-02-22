# AI Integration Guide for JEDI RE 3D Building Editor

**Version:** 1.0  
**Date:** February 2025  
**Status:** Phase 1 Complete (Foundation) | Phase 2 Pending (AI Integration)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Current Implementation (Phase 1)](#current-implementation-phase-1)
3. [AI Integration Points (Phase 2)](#ai-integration-points-phase-2)
4. [Integration Roadmap](#integration-roadmap)
5. [API Specifications](#api-specifications)
6. [Code Modifications](#code-modifications)
7. [Testing & Validation](#testing--validation)

---

## Overview

The JEDI RE 3D Building Editor has been built with **clear AI integration hooks** for future enhancement with Qwen (or similar) AI models. This document serves as a comprehensive guide for Phase 2 implementation.

### Phase 1 (Complete ✅)
- ✅ 3D viewport with Three.js/React Three Fiber
- ✅ Interactive building editor
- ✅ Metrics calculation
- ✅ State management (Zustand)
- ✅ **AI placeholder hooks**
- ✅ Algorithmic fallbacks

### Phase 2 (Pending 🔄)
- 🔄 Qwen API integration
- 🔄 Image-to-3D terrain generation
- 🔄 AI-powered design generation
- 🔄 Intelligent optimization
- 🔄 Natural language design prompts

---

## Current Implementation (Phase 1)

### File Structure

```
frontend/src/
├── components/design/
│   └── Building3DEditor.tsx          # Main 3D component with AI hooks
├── hooks/design/
│   └── useDesign3D.ts                # Custom hooks (includes AI placeholders)
├── stores/design/
│   └── design3d.store.ts             # Zustand state management
├── types/design/
│   └── design3d.types.ts             # TypeScript interfaces (includes AI types)
└── AI_INTEGRATION_GUIDE.md           # This file
```

### AI Placeholder Hooks

The system currently has **TWO main AI integration points**:

#### 1. **Image-to-3D Terrain Generation**
**Location:** `src/hooks/design/useDesign3D.ts` → `useAIImageToTerrain()`

**Current Behavior:**
- Accepts image file uploads
- Displays alert with Phase 2 instructions
- Returns mock response

**Future Integration:**
- Send image to Qwen API
- Extract terrain/topography data
- Generate 3D mesh
- Identify existing structures

#### 2. **AI Design Generation**
**Location:** `src/hooks/design/useDesign3D.ts` → `useAIDesignGeneration()`

**Current Behavior:**
- Accepts natural language prompts
- Uses algorithmic fallback (rectangular building)
- Returns basic BuildingSection

**Future Integration:**
- Send prompt to Qwen API
- Analyze site constraints
- Generate optimized building design
- Provide multiple alternatives

---

## AI Integration Points (Phase 2)

### 🎯 Integration Point #1: Image-to-3D Terrain

**File:** `src/hooks/design/useDesign3D.ts`  
**Function:** `useAIImageToTerrain()`

#### Current Code (Lines ~200-230):

```typescript
export const useAIImageToTerrain = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const generateTerrain = useCallback(
    async (request: AIImageToTerrainRequest): Promise<AIImageToTerrainResponse | null> => {
      setLoading(true);
      setError(null);
      
      try {
        // TODO: Phase 2 - Send to Qwen API
        // const response = await fetch('/api/ai/image-to-terrain', {
        //   method: 'POST',
        //   body: formData,
        // });
        // const data = await response.json();
        // return data;
        
        // Placeholder: Return mock response
        console.warn('AI Image-to-Terrain: Not yet implemented. Using mock data.');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        return {
          terrainMesh: null,
          contours: [],
          elevationData: [],
          confidence: 0.85,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );
  
  return { generateTerrain, loading, error };
};
```

#### 🔧 Phase 2 Modifications:

Replace the placeholder section with:

```typescript
try {
  // Create FormData for image upload
  const formData = new FormData();
  formData.append('image', request.image);
  formData.append('parcelId', request.parcelId);
  if (request.options) {
    formData.append('options', JSON.stringify(request.options));
  }
  
  // Send to Qwen API endpoint
  const response = await fetch('/api/ai/image-to-terrain', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  const data: AIImageToTerrainResponse = await response.json();
  
  // Process terrain mesh data
  // Convert Qwen's response to Three.js-compatible format
  const terrainGeometry = processQwenTerrainData(data);
  
  return {
    terrainMesh: terrainGeometry,
    contours: data.contours,
    elevationData: data.elevationData,
    confidence: data.confidence,
  };
} catch (err) {
  // ... error handling
}
```

---

### 🎯 Integration Point #2: AI Design Generation

**File:** `src/hooks/design/useDesign3D.ts`  
**Function:** `useAIDesignGeneration()`

#### Current Code (Lines ~240-320):

```typescript
export const useAIDesignGeneration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { actions } = useDesign3D();
  
  const generateDesign = useCallback(
    async (request: AIDesignGenerationRequest): Promise<AIDesignGenerationResponse | null> => {
      setLoading(true);
      setError(null);
      
      try {
        // TODO: Phase 2 - Send to Qwen API
        // const response = await fetch('/api/ai/generate-design', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(request),
        // });
        // const data = await response.json();
        // return data;
        
        // Placeholder: Use algorithmic generation
        console.warn('AI Design Generation: Not yet implemented...');
        
        // ... fallback logic ...
      } catch (err) {
        // ... error handling
      } finally {
        setLoading(false);
      }
    },
    [actions]
  );
  
  return { generateDesign, loading, error };
};
```

#### 🔧 Phase 2 Modifications:

Replace the placeholder section with:

```typescript
try {
  // Send design request to Qwen API
  const response = await fetch('/api/ai/generate-design', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: request.prompt,
      constraints: request.constraints,
      parcelBoundary: request.parcelBoundary,
      zoningEnvelope: request.zoningEnvelope,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  const data: AIDesignGenerationResponse = await response.json();
  
  // Add AI-generated sections to the store
  data.buildingSections.forEach((section) => {
    actions.addBuildingSection(section);
  });
  
  // Log AI reasoning for transparency
  console.log('🤖 AI Design Reasoning:', data.reasoning);
  
  return data;
} catch (err) {
  // ... error handling
  // Fallback to algorithmic generation if API fails
  console.warn('Falling back to algorithmic generation...');
  return generateAlgorithmicDesign(request);
}
```

---

## Integration Roadmap

### Step 1: Backend API Setup

Create backend endpoints for AI integration:

```
POST /api/ai/image-to-terrain
POST /api/ai/generate-design
POST /api/ai/optimize-layout
```

### Step 2: Qwen Integration

**Option A: Direct Qwen API**
- Set up Qwen API credentials
- Implement prompt engineering
- Handle streaming responses

**Option B: Proxy Layer**
- Create backend service
- Queue/batch processing
- Rate limiting & caching

### Step 3: Response Processing

Create utility functions:

```typescript
// src/utils/ai/qwenProcessors.ts

export const processQwenTerrainData = (rawData: any) => {
  // Convert Qwen terrain response to Three.js geometry
};

export const processQwenDesignResponse = (rawData: any) => {
  // Convert Qwen design response to BuildingSection[]
};

export const validateQwenResponse = (data: any, type: 'terrain' | 'design') => {
  // Validate AI response structure
};
```

### Step 4: UI Enhancements

**Add AI feedback UI:**
- Loading indicators with progress
- AI reasoning display
- Alternative designs viewer
- Confidence scores

### Step 5: Testing & Validation

- Unit tests for AI hook functions
- Integration tests with mock API
- E2E tests with real Qwen API
- Performance benchmarks

---

## API Specifications

### Image-to-Terrain Endpoint

**Endpoint:** `POST /api/ai/image-to-terrain`

**Request:**
```typescript
FormData {
  image: File,              // Image file (JPEG, PNG)
  parcelId: string,         // Reference parcel ID
  options: {
    enhanceDetail: boolean, // Enhance terrain detail
    extractContours: boolean // Extract elevation contours
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  data: {
    terrainMesh: {
      vertices: number[],   // Flat array [x,y,z, x,y,z, ...]
      faces: number[],      // Triangle indices
      normals: number[],    // Normal vectors
    },
    contours: Array<{
      elevation: number,    // Elevation in feet
      points: Array<{x: number, z: number}>
    }>,
    elevationData: number[][], // 2D grid of elevations
    confidence: number,   // 0-1 confidence score
  },
  processingTime: number, // milliseconds
  model: string,          // Qwen model version
}
```

---

### Design Generation Endpoint

**Endpoint:** `POST /api/ai/generate-design`

**Request:**
```typescript
{
  prompt: string,          // Natural language prompt
  constraints: {
    unitCount?: number,
    unitMix?: {
      studio: number,      // percentage
      oneBR: number,
      twoBR: number,
      threeBR: number,
    },
    maxHeight?: number,    // feet
    minEfficiency?: number, // percentage
    amenities?: string[],
  },
  parcelBoundary: {
    coordinates: Array<{lat: number, lng: number}>,
    area: number,          // square feet
  },
  zoningEnvelope: {
    maxHeight: number,
    setbacks: {
      front: number,
      rear: number,
      side: number,
    },
    far: number,
  },
}
```

**Response:**
```typescript
{
  success: boolean,
  data: {
    buildingSections: Array<BuildingSection>, // See design3d.types.ts
    metrics: BuildingMetrics,
    unitLayouts: Array<Unit>,
    reasoning: string,                        // AI's design rationale
    alternatives?: Array<{
      variant: string,
      sections: Array<BuildingSection>,
      metrics: BuildingMetrics,
      score: number,                          // 0-100 optimization score
    }>,
  },
  processingTime: number,
  model: string,
}
```

---

## Code Modifications

### Files to Modify:

1. ✅ **`src/hooks/design/useDesign3D.ts`**
   - Replace TODO comments with API calls
   - Add error handling
   - Implement retry logic

2. ✅ **`src/components/design/Building3DEditor.tsx`**
   - Update loading states
   - Add AI reasoning display
   - Improve error messages

3. ⚠️ **Create: `src/utils/ai/qwenProcessors.ts`**
   - Data transformation utilities
   - Response validation
   - Error handling helpers

4. ⚠️ **Create: `src/services/api/aiService.ts`**
   - Centralized API client
   - Request/response types
   - Retry & timeout logic

5. ⚠️ **Backend API Routes**
   - `/api/ai/image-to-terrain`
   - `/api/ai/generate-design`
   - `/api/ai/optimize-layout`

---

## Testing & Validation

### Unit Tests

```typescript
// src/hooks/design/__tests__/useDesign3D.test.ts

describe('useAIDesignGeneration', () => {
  it('should call Qwen API with correct payload', async () => {
    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockQwenResponse),
      })
    );
    
    const { result } = renderHook(() => useAIDesignGeneration());
    
    await act(async () => {
      await result.current.generateDesign(mockRequest);
    });
    
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ai/generate-design',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(mockRequest),
      })
    );
  });
  
  it('should fallback to algorithmic generation on API failure', async () => {
    // Test error handling
  });
});
```

### Integration Tests

```typescript
// e2e/3d-editor-ai.spec.ts

describe('3D Editor AI Integration', () => {
  it('should generate building from prompt', async () => {
    await page.goto('/deals/123/design');
    await page.click('button[title*="AI Design"]');
    await page.fill('input[name="prompt"]', 'Design 280-unit building');
    await page.click('button:has-text("Generate")');
    
    // Wait for AI response
    await page.waitForSelector('.building-section-mesh');
    
    // Verify metrics updated
    const unitCount = await page.textContent('[data-metric="unitCount"]');
    expect(unitCount).toContain('280');
  });
});
```

---

## Environment Variables

Add to `.env`:

```bash
# Qwen API Configuration
QWEN_API_KEY=your_api_key_here
QWEN_API_ENDPOINT=https://api.qwen.ai/v1
QWEN_MODEL_VERSION=qwen-turbo
QWEN_MAX_TOKENS=4096
QWEN_TIMEOUT_MS=30000

# Feature Flags
ENABLE_AI_TERRAIN=true
ENABLE_AI_DESIGN=true
ENABLE_AI_OPTIMIZATION=true

# Fallback Configuration
AI_FALLBACK_TO_ALGORITHMIC=true
```

---

## Performance Considerations

### Optimization Strategies:

1. **Request Batching**
   - Batch multiple design requests
   - Reduce API call overhead

2. **Response Caching**
   - Cache common design patterns
   - Redis/memory cache layer

3. **Streaming Responses**
   - Stream large 3D meshes
   - Progressive rendering

4. **Worker Threads**
   - Process terrain data in background
   - Don't block main thread

5. **Lazy Loading**
   - Load AI features on-demand
   - Code splitting

---

## Success Metrics

### Phase 2 Completion Criteria:

- ✅ Image-to-terrain API integrated
- ✅ Design generation API integrated
- ✅ Response processing utilities created
- ✅ Error handling implemented
- ✅ Loading states functional
- ✅ Unit tests passing (>80% coverage)
- ✅ Integration tests passing
- ✅ Documentation updated
- ✅ Performance benchmarks met (<3s response time)

---

## Support & Resources

### Documentation:
- [Qwen API Docs](https://qwen.ai/docs)
- [Three.js Docs](https://threejs.org/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)

### Contact:
- **Phase 1 Lead:** Development Team
- **Phase 2 Lead:** AI Integration Team
- **Support:** dev@jedire.com

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2025 | Initial guide with Phase 1 foundation complete |

---

**🚀 Ready for Phase 2 Integration!**

All hooks, types, and placeholders are in place. Follow this guide to seamlessly integrate Qwen AI capabilities when ready.
