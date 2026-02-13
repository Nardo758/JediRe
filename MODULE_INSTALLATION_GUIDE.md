# Module Installation Guide

**New Features:** 9 Module Skeletons + 3D Building Diagram  
**Date:** February 2024

---

## Quick Start

This guide will help you install and integrate the new modules and 3D building diagram into your JEDI RE instance.

---

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Existing JEDI RE installation at commit `3153b37` or later

---

## Installation Steps

### Step 1: Install Frontend Dependencies

The 3D Building Diagram requires Three.js libraries:

```bash
cd frontend
npm install three @types/three @react-three/fiber @react-three/drei
```

**Package Versions:**
- `three`: ^0.160.0
- `@types/three`: ^0.160.0
- `@react-three/fiber`: ^8.15.0
- `@react-three/drei`: ^9.96.0

### Step 2: Run Database Migration

Apply the new module definitions and 3D data tables:

```bash
cd backend
psql -U your_username -d jedire_db -f migrations/021_new_modules_3d_diagram.sql
```

**Or using environment variables:**
```bash
psql $DATABASE_URL -f migrations/021_new_modules_3d_diagram.sql
```

**Verify Migration:**
```sql
SELECT name, display_name, status FROM module_definitions WHERE status = 'coming-soon';
```

You should see 9 modules returned.

### Step 3: Update Frontend Routes (Optional)

If you want to add dedicated routes for the new modules:

**File:** `frontend/src/routes/index.tsx`

```typescript
// Import new sections
import { FinancialModelingSection } from '../components/deal/sections/FinancialModelingSection';
import { ZoningEntitlementsSection } from '../components/deal/sections/ZoningEntitlementsSection';
// ... import others

// Add to route configuration
// (This step depends on your routing setup)
```

### Step 4: Rebuild Frontend

```bash
cd frontend
npm run build
```

Or for development:
```bash
npm run dev
```

---

## Component Integration

### Using Skeleton Modules

Each skeleton module is ready to use. Import and render:

```tsx
import { FinancialModelingSection } from './components/deal/sections/FinancialModelingSection';

function DealPage({ dealId }: { dealId: string }) {
  return (
    <div>
      <FinancialModelingSection dealId={dealId} />
    </div>
  );
}
```

**Available Skeleton Components:**
- `FinancialModelingSection.tsx`
- `ZoningEntitlementsSection.tsx`
- `EnvironmentalESGSection.tsx`
- `CapitalEventsSection.tsx`
- `RiskManagementSection.tsx`
- `VendorManagementSection.tsx`
- `MarketingLeasingSection.tsx`
- `LegalComplianceSection.tsx`
- `ConstructionManagementSection.tsx`

### Using 3D Building Diagram

Import and provide building data:

```tsx
import { BuildingDiagram3D, Building3DModel } from './components/property/BuildingDiagram3D';

const buildingData: Building3DModel = {
  floors: 5,
  units: [
    {
      unitNumber: '101',
      floor: 1,
      position: { x: 0, y: 0, z: 0 },
      size: { width: 3, length: 2, height: 2.5 },
      status: 'occupied',
      rent: 1200,
      tenant: 'John Doe',
      leaseExpiry: '2024-12-31'
    },
    // ... more units
  ],
  amenities: []
};

function PropertyPage() {
  return (
    <BuildingDiagram3D
      buildingData={buildingData}
      onUnitClick={(unit) => console.log('Unit clicked:', unit)}
    />
  );
}
```

**Enhanced Properties Section (Recommended):**
```tsx
import { PropertiesSectionEnhanced } from './components/deal/sections/PropertiesSectionEnhanced';

// This includes tabs for List, Unit Mix, 3D View, Rent Roll
<PropertiesSectionEnhanced deal={dealData} />
```

---

## Configuration

### Module Visibility

Control which modules appear for which users by updating `module_definitions`:

```sql
-- Enable a module for all users
UPDATE module_definitions 
SET status = 'active' 
WHERE name = 'financial-modeling';

-- Restrict to premium tier
UPDATE module_definitions 
SET tier_requirement = 'premium' 
WHERE name = 'environmental-esg';
```

### Feature Flags

Enable/disable specific features within modules:

```sql
-- Enable 3D diagram export feature
INSERT INTO module_features (module_name, feature_name, is_enabled)
VALUES ('property-information', '3d-export', true)
ON CONFLICT (module_name, feature_name) DO UPDATE SET is_enabled = true;
```

---

## Testing

### Test Skeleton Modules

1. Navigate to a deal page
2. Look for new module tabs/sections
3. Verify "Coming Soon" badges appear
4. Click "Request Early Access" button (should log to console for now)

### Test 3D Diagram

1. Navigate to Properties section
2. Click "3D View" tab
3. Verify building renders with colored units
4. Test mouse controls:
   - Left drag to rotate
   - Scroll to zoom
   - Right drag to pan
5. Click on a unit – detail panel should appear
6. Test floor filter dropdown

### Automated Tests

Run the test suite:

```bash
cd frontend
npm test -- BuildingDiagram3D
```

---

## Troubleshooting

### Three.js Installation Issues

**Error:** `Module not found: Can't resolve 'three'`

**Fix:**
```bash
npm install --save three @types/three
npm install --save @react-three/fiber @react-three/drei
```

### Database Migration Fails

**Error:** `relation "module_definitions" already exists`

**Fix:** The table already exists. Run:
```sql
-- Skip CREATE TABLE, just run the INSERTs
-- Or use ON CONFLICT clauses in the migration
```

**Error:** `column "features" does not exist`

**Fix:** Add the column manually:
```sql
ALTER TABLE module_definitions ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';
```

### 3D Canvas Not Rendering

**Error:** Blank white box where 3D view should be

**Checks:**
1. Verify Three.js is installed: `npm list three`
2. Check browser console for WebGL errors
3. Enable hardware acceleration in browser settings
4. Try a different browser (Chrome recommended)

### Module Not Appearing

**Check:**
1. Module is inserted in `module_definitions` table
2. Module status is not 'deprecated'
3. User's tier matches `tier_requirement`
4. Component is imported correctly in your routing

---

## Environment Variables

No new environment variables are required for these modules. However, if you want to customize Three.js settings:

**`.env`**
```
# Optional: Configure 3D rendering quality
VITE_3D_QUALITY=high  # low, medium, high
VITE_3D_SHADOWS=true  # Enable/disable shadows
VITE_3D_ANTIALIASING=true
```

---

## Rollback Instructions

If you need to roll back these changes:

### Rollback Frontend
```bash
cd frontend
npm uninstall three @types/three @react-three/fiber @react-three/drei
git checkout HEAD~1 -- src/components/deal/sections/
git checkout HEAD~1 -- src/components/property/BuildingDiagram3D.tsx
```

### Rollback Database
```sql
-- Remove new modules
DELETE FROM module_definitions WHERE status = 'coming-soon';

-- Drop new tables
DROP TABLE IF EXISTS building_3d_models;
DROP TABLE IF EXISTS module_features;
```

---

## Performance Considerations

### 3D Diagram Optimization

For buildings with 100+ units:
- Use floor filtering to show fewer units at once
- Consider lazy loading units outside viewport
- Reduce polygon count in unit meshes

### Bundle Size

Three.js adds ~600KB to your bundle. To optimize:
- Enable tree-shaking in your bundler
- Use dynamic imports for 3D components:
  ```tsx
  const BuildingDiagram3D = lazy(() => import('./components/property/BuildingDiagram3D'));
  ```

---

## Next Steps

1. **Customize Skeletons:** Add your own "Request Early Access" logic
2. **Populate 3D Data:** Create a CSV import tool for building data
3. **Enable Beta Features:** Gradually activate coming-soon modules
4. **User Feedback:** Set up analytics to track which modules get the most interest

---

## Support

Need help with installation?

- **GitHub Issues:** [repo]/issues
- **Email:** dev-support@jedire.com
- **Slack:** #jedi-re-dev

---

## Changelog

| Date | Change |
|------|--------|
| Feb 2024 | Initial release of 9 modules + 3D diagram |

---

**Installation Complete!** 🚀

Next: See `NEW_MODULES_ROADMAP.md` for feature details and `3D_DIAGRAM_USER_GUIDE.md` for user documentation.
