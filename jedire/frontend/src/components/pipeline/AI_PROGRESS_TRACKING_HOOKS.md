# AI Progress Tracking Integration Hooks

**Status:** 🚧 Future Enhancement  
**AI Model:** Qwen (vision + reasoning)  
**Purpose:** Automated construction progress tracking and quality control

---

## Overview

The Pipeline 3D Progress system is designed with AI integration points for future automation. Currently, all functionality is manual (photo upload, progress updates, tagging), but the architecture supports seamless AI enhancement via the `Pipeline3DService` interface.

---

## Current vs Future State

### ✅ Current (Manual Operations)

```typescript
// Manual photo tagging
interface CurrentOperations {
  tagPhoto(photo: File, location: Vector3): Promise<PhotoTag>;
  updateProgress(sectionId: string, percent: number): Promise<void>;
  uploadPhotos(photos: File[], sectionId: string): Promise<PhotoTag[]>;
}
```

**User Flow:**
1. User uploads construction photos via PhotoGeoTagger
2. User manually selects building section
3. User manually adds caption and tags
4. Progress updates are manual input

### 🚀 Future (AI-Powered)

```typescript
// AI-enhanced operations
interface AIOperations extends CurrentOperations {
  // Auto-detect building section from photo
  autoTagPhotos(photos: File[], model: 'qwen'): Promise<PhotoTag[]>;
  
  // Estimate construction progress from photos
  estimateProgress(photos: File[], section: string, model: 'qwen'): Promise<ProgressEstimate>;
  
  // Quality control via visual inspection
  analyzeConstructionQuality(photos: File[], model: 'qwen'): Promise<QualityReport>;
  
  // Predictive completion analysis
  predictCompletion(progress: ConstructionProgress, model: 'qwen'): Promise<CompletionPrediction>;
}
```

---

## Integration Point 1: Auto-Photo Tagging

### Description
Automatically identify building sections, construction phases, and relevant metadata from uploaded photos.

### AI Prompt Template

```typescript
const autoTagPrompt = `
You are analyzing a construction progress photo. Identify:

1. Building section (floor number, zone)
2. Construction phase (foundation, structure, MEP, interior, etc.)
3. Estimated completion percentage
4. Notable features or issues
5. Suggested tags

Building context:
- Total floors: ${building.floors}
- Current phase: ${building.currentPhase}
- Expected progress: ${building.expectedProgress}%

Return JSON:
{
  "sectionId": "floor-5",
  "phase": "structure",
  "estimatedPercent": 65,
  "features": ["steel framing", "concrete deck"],
  "issues": ["possible rebar exposure"],
  "tags": ["framing", "progress", "floor-5"],
  "confidence": 0.87
}
`;
```

### Implementation Hook

```typescript
// src/services/aiProgressService.ts
export class AIProgressService implements Pipeline3DService {
  async autoTagPhotos(photos: File[], model = 'qwen'): Promise<PhotoTag[]> {
    const results = await Promise.all(
      photos.map(async (photo) => {
        // Convert photo to base64
        const base64 = await fileToBase64(photo);
        
        // Call Qwen vision API
        const response = await qwenVision({
          model: 'qwen-vl-plus',
          messages: [{
            role: 'user',
            content: [
              { type: 'image', image: base64 },
              { type: 'text', text: autoTagPrompt }
            ]
          }]
        });
        
        const analysis = JSON.parse(response.content);
        
        return {
          id: generateId(),
          filename: photo.name,
          url: URL.createObjectURL(photo),
          sectionId: analysis.sectionId,
          location: await calculateLocationFromSection(analysis.sectionId),
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'AI:Qwen',
          caption: `Auto-tagged: ${analysis.features.join(', ')}`,
          tags: analysis.tags,
          confidence: analysis.confidence,
        };
      })
    );
    
    return results;
  }
}
```

### UI Integration

In `PhotoGeoTagger.tsx`, add AI mode toggle:

```typescript
<button
  onClick={handleAIAutoTag}
  disabled={!photos.length}
  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
>
  🤖 AI Auto-Tag ({photos.length} photos)
</button>
```

---

## Integration Point 2: Progress Estimation

### Description
Analyze construction photos to estimate completion percentage and identify completed work items.

### AI Prompt Template

```typescript
const progressEstimationPrompt = `
You are analyzing construction progress for ${section.name}.

Expected work items for ${section.phase} phase:
${section.expectedWorkItems.join('\n')}

Current baseline: ${section.percentComplete}%
Last update: ${section.lastUpdate}

From the provided photos, estimate:
1. Completion percentage (0-100)
2. Completed work items
3. In-progress work items
4. Blocked/delayed items
5. Quality concerns

Return JSON with detailed analysis and confidence score.
`;
```

### Implementation Hook

```typescript
async estimateProgress(
  photos: File[], 
  section: string, 
  model = 'qwen'
): Promise<ProgressEstimate> {
  const base64Photos = await Promise.all(photos.map(fileToBase64));
  
  const response = await qwenVision({
    model: 'qwen-vl-plus',
    messages: [{
      role: 'user',
      content: [
        ...base64Photos.map(img => ({ type: 'image', image: img })),
        { type: 'text', text: progressEstimationPrompt }
      ]
    }]
  });
  
  const analysis = JSON.parse(response.content);
  
  return {
    sectionId: section,
    estimatedPercent: analysis.completionPercent,
    confidence: analysis.confidence,
    method: 'ai',
    timestamp: new Date().toISOString(),
    notes: analysis.summary,
    completedItems: analysis.completed,
    inProgressItems: analysis.inProgress,
    concerns: analysis.qualityConcerns,
  };
}
```

### UI Integration

Show AI suggestion alongside manual input:

```typescript
{aiEstimate && (
  <div className="p-4 bg-purple-50 border border-purple-300 rounded-lg">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-purple-900">
          🤖 AI Estimate: {aiEstimate.estimatedPercent}%
        </div>
        <div className="text-xs text-purple-700 mt-1">
          Confidence: {(aiEstimate.confidence * 100).toFixed(0)}%
        </div>
      </div>
      <button
        onClick={() => applyAIEstimate(aiEstimate)}
        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
      >
        Apply
      </button>
    </div>
  </div>
)}
```

---

## Integration Point 3: Quality Control

### Description
Automated visual inspection for construction quality issues, code compliance, and safety concerns.

### AI Prompt Template

```typescript
const qualityControlPrompt = `
You are a construction quality control inspector analyzing photos from ${section.name}.

Phase: ${section.phase}
Standards: ${project.buildingCode}, ${project.qualityStandards}

Inspect for:
1. Code compliance issues
2. Workmanship quality
3. Safety hazards
4. Material defects
5. Installation errors

For each issue found, provide:
- Severity (critical/major/minor)
- Location description
- Recommended action
- Code reference (if applicable)

Return JSON with structured quality report.
`;
```

### Implementation Hook

```typescript
async analyzeConstructionQuality(
  photos: File[], 
  model = 'qwen'
): Promise<QualityReport> {
  const base64Photos = await Promise.all(photos.map(fileToBase64));
  
  const response = await qwenVision({
    model: 'qwen-vl-plus',
    messages: [{
      role: 'user',
      content: [
        ...base64Photos.map(img => ({ type: 'image', image: img })),
        { type: 'text', text: qualityControlPrompt }
      ]
    }]
  });
  
  const analysis = JSON.parse(response.content);
  
  return {
    id: generateId(),
    sectionId: analysis.sectionId,
    inspectionDate: new Date().toISOString(),
    inspector: 'AI:Qwen',
    status: analysis.overallStatus,
    issues: analysis.issues.map(issue => ({
      id: generateId(),
      description: issue.description,
      severity: issue.severity,
      location: issue.location,
      status: 'open',
      photos: photos.map(p => URL.createObjectURL(p)),
      recommendedAction: issue.recommendedAction,
      codeReference: issue.codeReference,
    })),
    photos: await Promise.all(photos.map(async p => ({
      id: generateId(),
      filename: p.name,
      url: URL.createObjectURL(p),
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'AI:Qwen',
    }))),
    notes: analysis.summary,
  };
}
```

---

## Integration Point 4: Completion Prediction

### Description
Predict project completion date based on historical progress, current velocity, and identified risks.

### AI Prompt Template

```typescript
const completionPredictionPrompt = `
You are analyzing construction progress to predict completion date.

Historical data:
${progress.phases.map(p => `${p.name}: ${p.percentComplete}% (${p.daysInPhase} days)`).join('\n')}

Current metrics:
- Overall progress: ${progress.metrics.overallPercent}%
- Schedule variance: ${progress.metrics.scheduleVariance} days
- Budget variance: ${progress.metrics.budgetVariance}%

Target completion: ${project.targetDate}
Days remaining: ${project.daysRemaining}

Consider:
1. Current velocity
2. Remaining work complexity
3. Identified risks and blockers
4. Historical similar projects
5. Seasonal factors (weather, inspections)

Provide:
- Estimated completion date
- Confidence level
- Key risks to timeline
- Recommendations to accelerate
`;
```

---

## Migration Path

### Phase 1: Prepare Infrastructure (Week 1)
- [ ] Create `aiProgressService.ts` with interface
- [ ] Add AI toggle flags to components
- [ ] Implement base64 conversion utilities
- [ ] Add confidence score UI components

### Phase 2: Qwen Integration (Week 2)
- [ ] Set up Qwen API client
- [ ] Implement auto-tagging endpoint
- [ ] Test with sample construction photos
- [ ] Tune prompts for accuracy

### Phase 3: Progress Estimation (Week 3)
- [ ] Implement progress estimation
- [ ] Build side-by-side comparison UI (manual vs AI)
- [ ] Add confidence thresholds and warnings
- [ ] Collect user feedback for training

### Phase 4: Quality Control (Week 4)
- [ ] Implement quality analysis
- [ ] Build issue tracking workflow
- [ ] Integrate with existing quality reports
- [ ] Set up notification system for critical issues

### Phase 5: Predictive Analytics (Week 5)
- [ ] Implement completion prediction
- [ ] Build scenario modeling
- [ ] Integrate with timeline module
- [ ] Add risk mitigation suggestions

---

## Testing Strategy

### Mock AI Responses
For testing without Qwen API:

```typescript
// src/mocks/aiProgressMocks.ts
export const mockAutoTagResponse = {
  sectionId: 'floor-5',
  phase: 'structure',
  estimatedPercent: 65,
  features: ['steel framing', 'concrete deck', 'rebar placement'],
  issues: [],
  tags: ['framing', 'progress', 'floor-5', 'steel'],
  confidence: 0.87,
};

export const mockProgressEstimate = {
  sectionId: 'floor-5',
  estimatedPercent: 68,
  confidence: 0.82,
  method: 'ai',
  timestamp: new Date().toISOString(),
  notes: 'Structural framing approximately 2/3 complete. Deck pour in progress.',
  completedItems: ['Column installation', 'Beam placement', 'Rebar layout'],
  inProgressItems: ['Concrete deck pour', 'MEP sleeve installation'],
  concerns: ['Minor rebar spacing issue on north side'],
};
```

---

## Success Metrics

- **Auto-tagging accuracy:** >85% correct section identification
- **Progress estimation error:** <10% deviation from manual inspection
- **Quality issue detection:** >90% catch rate for critical issues
- **Time savings:** 60%+ reduction in manual data entry
- **User adoption:** 70%+ of users prefer AI-assisted mode

---

## Security & Privacy

- All photos processed locally where possible
- Sensitive project data sanitized before AI analysis
- User review required before applying AI suggestions
- Audit trail for all AI-generated updates
- Opt-in/opt-out per project

---

**Note:** All AI features are additive. Manual workflows remain fully supported.
