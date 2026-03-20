# Deal Capsule Overview Adaptation — Wiring Guide

## Files to Place

```
src/shared/types/project-type.ts        ← Type definitions + resolveProjectType()
src/components/deal/sections/OverviewRouter.tsx    ← Adapter (drop-in replacement)
src/components/deal/sections/DevelopmentOverview.tsx  ← 7-section variant
src/components/deal/sections/RedevelopmentOverview.tsx ← 9-section variant  
src/components/deal/DealCreationModal.tsx  ← 3-type fork creation flow
```

The existing `OverviewSection.tsx` stays untouched — it becomes the "Existing Acquisition" variant.

## Wiring Steps (in order)

### Step 1: Place files
Copy all 5 files to their destinations. Verify TypeScript compiles: `npm run build`

### Step 2: Wire OverviewRouter into DealDetailPage

In `src/pages/DealDetailPage.tsx`, make TWO changes:

**Change the import (line 19):**
```diff
- import OverviewSection from '../components/deal/sections/OverviewSection';
+ import { OverviewRouter } from '../components/deal/sections/OverviewRouter';
```

**Change the tab component (line 209):**
```diff
  const overviewSetupTabs: Tab[] = [
    { 
      id: 'overview', 
      label: 'Deal Overview', 
      icon: <BarChart3 size={16} />, 
-     component: OverviewSection 
+     component: OverviewRouter 
    },
```

**Also update the fallback on line 430:**
```diff
- const ActiveComponent = activeTabData?.component || OverviewSection;
+ const ActiveComponent = activeTabData?.component || OverviewRouter;
```

That's it for the overview routing. `OverviewRouter` reads `deal.project_type` (or `deal.projectType`) and renders the correct variant.

### Step 3: Wire DealCreationModal

Find where new deals are created (currently `DealPipeline.tsx` or wherever the "+ New Deal" button lives). Import and use `DealCreationModal`:

```tsx
import { DealCreationModal } from '../DealCreationModal';

// In the component:
const [showCreateModal, setShowCreateModal] = useState(false);

// In JSX:
{showCreateModal && (
  <DealCreationModal
    onClose={() => setShowCreateModal(false)}
    onDealCreated={(deal) => {
      setShowCreateModal(false);
      // Navigate to the new deal
      navigate(`/deals/${deal.id}/detail?tab=overview`);
    }}
  />
)}
```

### Step 4: Verify the deal table has project_type column

Check if the `deals` table already has a `project_type` column. If not, create a migration:

```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS project_type VARCHAR(20) DEFAULT 'existing';
```

The `dealStore.ts` transform function (line 26) already maps this:
```ts
projectType: deal.project_type || deal.projectType,
```

### Step 5: Verify the POST /api/v1/deals endpoint accepts project_type

The deal creation API endpoint needs to accept `project_type` in the body and insert it into the deals table. Check the route handler and add if missing.

## How the Routing Works

```
Deal record has project_type = 'existing' | 'development' | 'redevelopment'
                    ↓
DealDetailPage loads deal via GET /api/v1/deals/:id
                    ↓
OverviewRouter reads deal.project_type via resolveProjectType()
                    ↓
Renders: ExistingOverview (OverviewSection.tsx)  — 4 sections
    OR:  DevelopmentOverview.tsx                  — 7 sections
    OR:  RedevelopmentOverview.tsx                — 9 sections
```

`resolveProjectType()` handles all field-name variants: `project_type`, `projectType`, `development_type`, `developmentType`. Falls back to `'existing'` if nothing is set (backward compatible — all existing deals render the current overview).

## Section Comparison

| Section | Existing | Development | Redevelopment |
|---------|----------|-------------|---------------|
| §1 Acquisition + As-Is | ✓ | — | ✓ |
| §1 Site + Zoning | — | ✓ | — |
| §2 Operating Intelligence / Building Config | ✓ | ✓ | — |
| §2 NOI Transformation | — | — | ✓ |
| §3 Capital Structure / Entitlement | ✓ | ✓ | ✓ |
| §4 DD + Module Access / Unit Mix | ✓ | ✓ | ✓ |
| §5 Competitive Set / Unit Mix | — | ✓ | ✓ |
| §6 Budget + Timeline | — | ✓ | ✓ |
| §7 Returns + Diligence / Capital Structure | — | ✓ | ✓ |
| §8 Value Bridge + Returns | — | — | ✓ |
| §9 DD + Module Access | — | — | ✓ |

## Props Contract

All three variants receive the same props from `DealDetailPage`:
```typescript
interface OverviewVariantProps {
  deal: any;           // Full deal record from API
  dealId?: string;     // Deal ID for API calls
  embedded?: boolean;  // Always true in DealDetailPage
  onUpdate?: () => void;
  onBack?: () => void;
  onTabChange?: (tabId: string) => void;
}
```

## What NOT to Do
- Don't delete OverviewSection.tsx — it's the Existing variant
- Don't modify the Tab interface — OverviewRouter matches the existing `component: React.ComponentType<any>` pattern
- Don't hardcode deal IDs in the variant components — they read from the `deal` prop
- Don't add projectType to the DealContext store separately — it's already part of the deal record
