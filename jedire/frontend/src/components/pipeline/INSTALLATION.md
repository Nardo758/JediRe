# Pipeline 3D Progress - Installation Guide

## Dependencies Required

The Pipeline 3D Progress visualization requires Three.js and React Three Fiber libraries.

### Install Required Packages

```bash
cd /home/leon/clawd/jedire/frontend

npm install three@^0.161.0 @react-three/fiber@^8.15.0 @react-three/drei@^9.96.0

# Also install TypeScript types
npm install --save-dev @types/three@^0.161.0
```

### Verify Installation

Check that these packages appear in `package.json`:

```json
{
  "dependencies": {
    "three": "^0.161.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.96.0"
  },
  "devDependencies": {
    "@types/three": "^0.161.0"
  }
}
```

---

## Quick Start

### 1. Import the Component

```typescript
import { Pipeline3DProgress } from '@/components/pipeline/Pipeline3DProgress';
```

### 2. Basic Usage

```typescript
function DealPage() {
  const dealId = 'deal-123';

  return (
    <div className="h-screen">
      <Pipeline3DProgress 
        dealId={dealId}
        onProgressUpdate={(progress) => {
          console.log('Progress updated:', progress);
          // Save to backend
        }}
      />
    </div>
  );
}
```

### 3. With Mock Data

```typescript
import { MOCK_DATA } from '@/components/pipeline/mockConstructionData';

function Demo() {
  return (
    <Pipeline3DProgress 
      dealId="demo-deal"
      onProgressUpdate={(progress) => {
        console.log('Demo progress:', progress);
      }}
    />
  );
}
```

---

## Component Architecture

```
Pipeline3DProgress.tsx          # Main component with 3D canvas
├── ConstructionPhaseTracker.tsx  # Right sidebar - phase progress
├── PhotoGeoTagger.tsx            # Modal - photo upload & tagging
├── DrawScheduleView.tsx          # Modal - draw schedule visualization
└── mockConstructionData.ts       # Test data generator
```

---

## Integration with Backend

### API Endpoints Needed

```typescript
// Get construction progress
GET /api/v1/deals/{dealId}/construction-progress
Response: ConstructionProgress

// Update section progress
PUT /api/v1/deals/{dealId}/construction-progress/sections/{sectionId}
Body: { percentComplete: number, notes?: string }

// Upload photo
POST /api/v1/deals/{dealId}/construction-progress/photos
Body: FormData { file, sectionId, caption?, tags? }

// Get draw schedule
GET /api/v1/deals/{dealId}/draw-schedule
Response: DrawSchedule[]
```

### Service Integration Example

```typescript
// src/services/constructionProgressService.ts
export class ConstructionProgressService {
  async getProgress(dealId: string): Promise<ConstructionProgress> {
    const response = await fetch(`/api/v1/deals/${dealId}/construction-progress`);
    return response.json();
  }

  async updateSectionProgress(
    dealId: string, 
    sectionId: string, 
    percent: number
  ): Promise<void> {
    await fetch(
      `/api/v1/deals/${dealId}/construction-progress/sections/${sectionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentComplete: percent }),
      }
    );
  }

  async uploadPhoto(
    dealId: string,
    file: File,
    sectionId: string,
    caption?: string,
    tags?: string[]
  ): Promise<PhotoTag> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sectionId', sectionId);
    if (caption) formData.append('caption', caption);
    if (tags) formData.append('tags', JSON.stringify(tags));

    const response = await fetch(
      `/api/v1/deals/${dealId}/construction-progress/photos`,
      {
        method: 'POST',
        body: formData,
      }
    );
    return response.json();
  }
}
```

---

## Customization

### Custom Building Model

Replace the simplified box geometry with actual 3D models:

```typescript
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

function RealBuildingModel({ modelUrl, sections }) {
  const gltf = useLoader(GLTFLoader, modelUrl);
  
  return (
    <primitive 
      object={gltf.scene} 
      onClick={(e) => handleModelClick(e)}
    />
  );
}
```

### Custom Color Scheme

Override progress colors:

```typescript
const CUSTOM_COLORS = {
  notStarted: '#E5E7EB',
  inProgress: '#FBBF24',
  complete: '#22C55E',
  paid: '#16A34A',
  unpaid: '#EA580C',
};
```

### Custom Phases

Modify `PHASES` in `ConstructionPhaseTracker.tsx` to match your workflow:

```typescript
const CUSTOM_PHASES = [
  { id: 'demolition', name: 'Demolition', ... },
  { id: 'foundation', name: 'Foundation', ... },
  // ... your phases
];
```

---

## Troubleshooting

### Canvas is Black/Empty

- Check browser console for WebGL errors
- Ensure proper lighting (ambient + directional lights)
- Verify camera position is not inside geometry

### Performance Issues

- Reduce section count for complex buildings
- Use `<Instances>` for repeated geometry
- Enable frustum culling
- Lower shadow map resolution

### Photos Not Uploading

- Check CORS settings on file upload endpoint
- Verify file size limits
- Ensure proper FormData serialization

### TypeScript Errors

- Ensure `@types/three` is installed
- Add to `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "types": ["three"]
    }
  }
  ```

---

## Testing

### Run with Mock Data

```bash
# Start dev server
npm run dev

# Navigate to component demo
http://localhost:5173/demo/pipeline-3d
```

### Unit Tests

```typescript
import { render, screen } from '@testing-library/react';
import { Pipeline3DProgress } from './Pipeline3DProgress';

test('renders 3D canvas', () => {
  render(<Pipeline3DProgress dealId="test" />);
  const canvas = screen.getByRole('canvas');
  expect(canvas).toBeInTheDocument();
});
```

---

## Performance Optimization

### Lazy Loading

```typescript
import { lazy, Suspense } from 'react';

const Pipeline3DProgress = lazy(() => 
  import('./components/pipeline/Pipeline3DProgress')
);

function DealPage() {
  return (
    <Suspense fallback={<div>Loading 3D view...</div>}>
      <Pipeline3DProgress dealId="deal-123" />
    </Suspense>
  );
}
```

### Memory Management

```typescript
useEffect(() => {
  return () => {
    // Cleanup on unmount
    sections.forEach(section => {
      section.photos?.forEach(photo => {
        URL.revokeObjectURL(photo.url);
      });
    });
  };
}, [sections]);
```

---

## Next Steps

1. Install dependencies: `npm install three @react-three/fiber @react-three/drei`
2. Review component files in `/components/pipeline/`
3. Test with mock data
4. Integrate with backend APIs
5. Customize for your workflow
6. Review AI integration docs: `AI_PROGRESS_TRACKING_HOOKS.md`

---

**Questions?** Check the README or review the inline component documentation.
