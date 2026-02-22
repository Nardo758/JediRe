# 3D Building Design Component

**Status:** ✅ Production Ready (Phase 1 Complete)  
**AI Integration:** 🔄 Hooks Ready for Phase 2

---

## Overview

The `Building3DEditor` is a fully-featured 3D building design component built with Three.js and React Three Fiber. It provides an interactive WebGL-based viewport for designing multifamily real estate projects with real-time metrics calculation.

## Features

### Phase 1 (Complete) ✅
- ✅ **WebGL 3D Viewport** - Hardware-accelerated rendering
- ✅ **Orbital Camera Controls** - Rotate, zoom, pan
- ✅ **Interactive Building Editing** - Click to select, hover highlights
- ✅ **Real-time Metrics** - Unit count, SF, parking, height, coverage, FAR
- ✅ **Parcel Boundary Visualization** - Extruded polygon mesh
- ✅ **Zoning Envelope** - Wireframe buildable volume
- ✅ **Context Buildings** - Placeholder boxes for nearby structures
- ✅ **Grid Floor Reference** - Configurable grid overlay
- ✅ **Undo/Redo** - Full history management (50 snapshots)
- ✅ **Keyboard Shortcuts** - Ctrl+Z, Delete, G, M
- ✅ **State Persistence** - Zustand with localStorage
- ✅ **AI Integration Hooks** - Ready for Phase 2 Qwen API

### Phase 2 (Coming Soon) 🔄
- 🔄 AI Image-to-3D terrain generation
- 🔄 AI-powered design generation from prompts
- 🔄 Intelligent unit mix optimization
- 🔄 Multiple design alternatives

---

## Installation

The component is already integrated into the JEDI RE frontend. Dependencies:

```json
{
  "three": "^0.160.0",
  "@react-three/fiber": "^8.15.0",
  "@react-three/drei": "^9.88.0",
  "@types/three": "^0.160.0",
  "zustand": "^4.4.7"
}
```

All dependencies are installed via:
```bash
npm install
```

---

## Quick Start

### Basic Usage

```tsx
import { Building3DEditor } from '@/components/design/Building3DEditor';

function DealDesignPage() {
  return (
    <div className="w-full h-screen">
      <Building3DEditor
        dealId="deal-123"
        onMetricsChange={(metrics) => console.log(metrics)}
        onSave={() => console.log('Design saved')}
      />
    </div>
  );
}
```

### With Custom Parcel Data

```tsx
import { Building3DEditor } from '@/components/design/Building3DEditor';
import { useDesign3DStore } from '@/stores/design/design3d.store';
import { useEffect } from 'react';

function DealDesignPage({ parcelData }) {
  const setParcelBoundary = useDesign3DStore((state) => state.setParcelBoundary);
  
  useEffect(() => {
    setParcelBoundary({
      id: parcelData.id,
      coordinates: parcelData.coordinates,
      area: parcelData.area,
      extrusionHeight: 2,
      color: '#10b981',
      opacity: 0.3,
    });
  }, [parcelData]);
  
  return <Building3DEditor dealId={parcelData.dealId} />;
}
```

### Using the Hook Directly

```tsx
import { useDesign3D, useBuildingGenerator } from '@/hooks/design/useDesign3D';

function CustomDesignTool() {
  const { state, actions } = useDesign3D();
  const { generateSimpleBuilding } = useBuildingGenerator();
  
  const handleGenerate = () => {
    if (state.parcelBoundary) {
      generateSimpleBuilding(state.parcelBoundary, 200); // 200 units
    }
  };
  
  return (
    <div>
      <h2>Units: {state.metrics.unitCount}</h2>
      <h2>Total SF: {state.metrics.totalSF.toLocaleString()}</h2>
      <button onClick={handleGenerate}>Generate Building</button>
      <button onClick={actions.undo} disabled={!actions.canUndo}>
        Undo
      </button>
    </div>
  );
}
```

---

## API Reference

### Component Props

```typescript
interface Building3DEditorProps {
  dealId?: string;                          // Optional deal identifier
  onMetricsChange?: (metrics: BuildingMetrics) => void; // Metrics callback
  onSave?: () => void;                      // Save callback
}
```

### Hook: useDesign3D()

```typescript
const { state, actions, hasUnsavedChanges } = useDesign3D();

// State Access
state.buildingSections    // BuildingSection[]
state.metrics             // BuildingMetrics
state.parcelBoundary      // ParcelBoundary | null
state.zoningEnvelope      // ZoningEnvelope | null
state.selectedSectionId   // string | null
state.editMode            // 'view' | 'edit' | 'measure' | 'section'

// Actions
actions.addBuildingSection(section)
actions.updateBuildingSection(id, updates)
actions.removeBuildingSection(id)
actions.selectSection(id)
actions.undo()
actions.redo()
actions.recalculateMetrics()
actions.toggleGrid()
actions.toggleMeasurements()
```

### Hook: useBuildingGenerator()

```typescript
const { generateSimpleBuilding, generateFromUnitMix } = useBuildingGenerator();

// Generate simple rectangular building
const section = generateSimpleBuilding(parcelBoundary, targetUnits);

// Generate from unit mix
const section = generateFromUnitMix(
  parcelBoundary,
  { studio: 15, '1BR': 45, '2BR': 30, '3BR': 10 },
  287 // total units
);
```

### Hook: useAIDesignGeneration() (Phase 2 Ready)

```typescript
const { generateDesign, loading, error } = useAIDesignGeneration();

// Generate design from natural language prompt
const response = await generateDesign({
  prompt: 'Design a 280-unit building with modern amenities',
  constraints: {
    unitCount: 280,
    maxHeight: 120,
    minEfficiency: 82,
    amenities: ['coworking', 'gym', 'rooftop deck'],
  },
  parcelBoundary,
  zoningEnvelope,
});
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected section |
| `G` | Toggle grid |
| `M` | Toggle measurements |

---

## State Management

The component uses **Zustand** for state management with persistence:

```typescript
// Direct store access (advanced)
import { useDesign3DStore } from '@/stores/design/design3d.store';

// Select specific state (optimized re-renders)
const metrics = useDesign3DStore((state) => state.metrics);
const buildingSections = useDesign3DStore((state) => state.buildingSections);

// Selectors (pre-defined)
import { selectBuildingSections, selectMetrics } from '@/stores/design/design3d.store';
const sections = useDesign3DStore(selectBuildingSections);
```

### Persistence

State is automatically persisted to `localStorage` under key `design3d-storage`. Persisted data includes:
- Parcel boundary
- Zoning envelope
- Building sections
- Metrics
- View settings

---

## Type Definitions

All types are defined in `src/types/design/design3d.types.ts`:

### Key Types

```typescript
// Building Section
interface BuildingSection {
  id: string;
  name: string;
  geometry: {
    footprint: Polygon2D;
    height: number;
    floors: number;
  };
  position: Point3D;
  selected: boolean;
  hovered: boolean;
  visible: boolean;
}

// Building Metrics
interface BuildingMetrics {
  unitCount: number;
  totalSF: number;
  residentialSF: number;
  amenitySF: number;
  parkingSpaces: number;
  height: { feet: number; stories: number };
  coverage: { percentage: number; buildableArea: number; usedArea: number };
  efficiency: number;
  far: number;
}

// AI Integration Types (Phase 2)
interface AIDesignGenerationRequest {
  prompt: string;
  constraints: { /* ... */ };
  parcelBoundary: ParcelBoundary;
  zoningEnvelope: ZoningEnvelope;
}

interface AIDesignGenerationResponse {
  buildingSections: BuildingSection[];
  metrics: BuildingMetrics;
  unitLayouts: Unit[];
  reasoning: string;
  alternatives?: Array<{ /* ... */ }>;
}
```

---

## Examples

### Example 1: Load Existing Design

```tsx
import { useEffect } from 'react';
import { Building3DEditor } from '@/components/design/Building3DEditor';
import { useDesign3DStore } from '@/stores/design/design3d.store';

function LoadDesignExample({ designData }) {
  const loadDesign = useDesign3DStore((state) => state.loadDesign);
  
  useEffect(() => {
    loadDesign(designData);
  }, [designData]);
  
  return <Building3DEditor />;
}
```

### Example 2: Export Design State

```tsx
import { useDesign3DStore } from '@/stores/design/design3d.store';

function ExportButton() {
  const exportState = useDesign3DStore((state) => state.exportState);
  
  const handleExport = () => {
    const state = exportState();
    const json = JSON.stringify(state, null, 2);
    
    // Download as JSON file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-export.json';
    a.click();
  };
  
  return <button onClick={handleExport}>Export Design</button>;
}
```

### Example 3: Custom Metrics Display

```tsx
import { useDesign3D } from '@/hooks/design/useDesign3D';

function CustomMetricsPanel() {
  const { state } = useDesign3D();
  const { metrics } = state;
  
  return (
    <div className="metrics-panel">
      <h3>Project Metrics</h3>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Units" value={metrics.unitCount} />
        <MetricCard label="SF" value={metrics.totalSF.toLocaleString()} />
        <MetricCard label="Parking" value={`${metrics.parkingSpaces} spaces`} />
        <MetricCard label="Height" value={`${metrics.height.stories} stories`} />
        <MetricCard label="FAR" value={metrics.far.toFixed(2)} />
        <MetricCard label="Efficiency" value={`${metrics.efficiency}%`} />
      </div>
    </div>
  );
}
```

---

## Performance Tips

1. **Use Selectors** - Avoid subscribing to entire state:
   ```tsx
   // ❌ Bad - re-renders on any state change
   const state = useDesign3DStore();
   
   // ✅ Good - re-renders only when metrics change
   const metrics = useDesign3DStore((state) => state.metrics);
   ```

2. **Memoize Callbacks** - Use `useCallback` for event handlers:
   ```tsx
   const handleSelect = useCallback((id: string) => {
     actions.selectSection(id);
   }, [actions]);
   ```

3. **Lazy Load 3D Models** - Use `<Suspense>` for heavy assets:
   ```tsx
   <Suspense fallback={<LoadingFallback />}>
     <Building3DEditor />
   </Suspense>
   ```

4. **Limit History** - History is automatically limited to 50 snapshots

---

## Troubleshooting

### Issue: "Cannot read property 'map' of undefined"
**Solution:** Ensure parcel boundary is set before adding building sections.

### Issue: Metrics not updating
**Solution:** Call `actions.recalculateMetrics()` manually or wait for automatic calculation after state change.

### Issue: Performance degradation with many sections
**Solution:** Use LOD (Level of Detail) for distant buildings, or limit visible sections.

### Issue: AI hooks not working
**Solution:** AI integration is Phase 2. Current hooks use algorithmic fallbacks. See `AI_INTEGRATION_GUIDE.md`.

---

## Testing

### Unit Tests

```bash
npm test src/hooks/design/
npm test src/stores/design/
```

### Integration Tests

```bash
npm run test:e2e -- 3d-editor
```

---

## Contributing

When adding features:

1. Update TypeScript types in `design3d.types.ts`
2. Add actions to `design3d.store.ts`
3. Create custom hooks in `useDesign3D.ts`
4. Update this README
5. Add tests

---

## Resources

- **AI Integration Guide:** `/frontend/AI_INTEGRATION_GUIDE.md`
- **Type Definitions:** `/src/types/design/design3d.types.ts`
- **Three.js Docs:** https://threejs.org/docs
- **React Three Fiber:** https://docs.pmnd.rs/react-three-fiber
- **Zustand Docs:** https://zustand-demo.pmnd.rs/

---

## License

Proprietary - JEDI RE

---

**🚀 Ready to build!**
