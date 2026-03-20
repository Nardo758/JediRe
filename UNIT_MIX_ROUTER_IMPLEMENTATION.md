# Unit Mix Router Implementation Guide (Session 6 · Phase 3, Tasks 3.1–3.2)

## Overview

The **UnitMixRouter** is an intelligent routing component that renders different unit mix UIs based on deal type and mode:

| Deal Type | Mode | Component | Purpose |
|-----------|------|-----------|---------|
| **Existing** | `analyzer` | unit-mix-positioning-v5 | Competitive analysis of current unit mix |
| **Development** | `designer` | development-program-builder | Design new program from market demand |
| **Redevelopment** | `analyzer_designer` | Both (stacked) | Compare Current → Target with divider |
| *(Any)* | `hidden` | None | Module not rendered |

## Files Created/Modified

### 1. **Configuration Types** (`frontend/src/shared/config/product-type-adaptation.ts`)

Added three exports:
- `UnitMixMode` type: union of `'analyzer' | 'designer' | 'analyzer_designer' | 'hidden'`
- `UnitMixConfig` interface: defines mode + description per deal type
- `UNIT_MIX_CONFIG` record: mapping of DealType → UnitMixConfig
- `getUnitMixMode(dealType)` function: helper to retrieve mode

```typescript
export type UnitMixMode = 'analyzer' | 'designer' | 'analyzer_designer' | 'hidden';

export const UNIT_MIX_CONFIG: Record<DealType, UnitMixConfig> = {
  existing: { mode: 'analyzer', description: '...' },
  development: { mode: 'designer', description: '...' },
  redevelopment: { mode: 'analyzer_designer', description: '...' },
};

export function getUnitMixMode(dealType: DealType): UnitMixMode { ... }
```

### 2. **Router Component** (`frontend/src/components/deal/sections/UnitMixRouter.tsx`)

New React component that:
- Reads `dealType` from `useDealType()`
- Derives `mode` using `getUnitMixMode(dealType)`
- Renders appropriate component(s) based on mode
- For `analyzer_designer` mode: stacks both components with a "Current → Target" divider
- Handles lazy loading with Suspense
- Returns `null` for hidden mode

```typescript
export const UnitMixRouter: React.FC<UnitMixRouterProps> = ({ deal, dealId }) => {
  const dealType = useDealType();
  const mode = useMemo(() => getUnitMixMode(dealType), [dealType]);

  if (mode === 'hidden') return null;
  if (mode === 'analyzer') return <UnitMixPositioningV5 ... />;
  if (mode === 'designer') return <DevelopmentProgramBuilder ... />;
  if (mode === 'analyzer_designer') return <Both stacked with divider ... />;
};
```

## Integration Steps

### Step 1: Move Components to Module Structure

The unit mix components need to be accessible at:
- `src/components/modules/unit-mix/unit-mix-positioning-v5.jsx`
- `src/components/modules/unit-mix/development-program-builder.jsx`

**Current locations:**
- `unit-mix-positioning-v5 (1).jsx` → rename and move to modules folder
- `development-program-builder.jsx` → move to modules folder

```bash
# Create directory
mkdir -p src/components/modules/unit-mix

# Move files
mv unit-mix-positioning-v5\ \(1\).jsx src/components/modules/unit-mix/unit-mix-positioning-v5.jsx
mv development-program-builder.jsx src/components/modules/unit-mix/development-program-builder.jsx
```

### Step 2: Replace Unit Program Tab Renderer

Find where the Unit Program tab currently renders (likely in M03 Development Capacity section or a tab router).

**Before:**
```typescript
{activeTab === 'unit-program' && <SomeUnitMixComponent />}
```

**After:**
```typescript
import { UnitMixRouter } from './UnitMixRouter';

{activeTab === 'unit-program' && <UnitMixRouter deal={deal} dealId={deal.id} />}
```

### Step 3: Adjust Component Props

Verify that both unit mix components accept:
- `deal?: any` — deal object
- `dealId?: string` — deal ID
- `readonly?: boolean` (for analyzer in analyzer_designer mode)

If props differ, update the UnitMixRouter imports to match.

## Component Behavior

### Mode: `analyzer` (Existing)
- Renders unit-mix-positioning-v5
- Shows current unit mix with competitive comps analysis
- Read-only interface (user views current state)

### Mode: `designer` (Development)
- Renders development-program-builder
- User designs unit mix from scratch
- Includes cost modeling and absorption curves
- Editable unit type definitions

### Mode: `analyzer_designer` (Redevelopment)
- **Top section:** unit-mix-positioning-v5 (readonly) showing current/as-is mix
- **Divider:** "Current → Target" label with visual separators
- **Bottom section:** development-program-builder showing target post-repositioning program
- Users can compare existing vs. repositioned mix side-by-side

### Mode: `hidden`
- Component returns `null`
- Tab/module not visible in UI

## Custom Hooks

The router uses:
- `useDealType()` — from `stores/dealStore` — returns current deal type
- `getUnitMixMode(dealType)` — from `shared/config/product-type-adaptation` — maps deal type → mode

You can also access the full config:
```typescript
import { UNIT_MIX_CONFIG } from '@/shared/config/product-type-adaptation';
const config = UNIT_MIX_CONFIG[dealType]; // { mode, description }
```

## Error Handling & Fallbacks

The router uses React.lazy + Suspense for safe code splitting:
- If components fail to load, displays `LoadingFallback`
- Each mode section has its own Suspense boundary
- Graceful degradation if imports fail

To customize the loading state, modify `LoadingFallback`:
```typescript
const LoadingFallback = () => (
  <div>Custom loading UI...</div>
);
```

## Testing Checklist

- [ ] Existing deal → shows unit-mix-positioning-v5 only
- [ ] Development deal → shows development-program-builder only
- [ ] Redevelopment deal → shows both with divider, Current on top
- [ ] Switching deal type → router updates mode automatically
- [ ] Lazy loading → components load without blocking UI
- [ ] Props pass through correctly to child components
- [ ] Readonly mode works on analyzer in analyzer_designer layout

## Troubleshooting

**Problem:** "Cannot find module unit-mix-positioning-v5"
**Solution:** Verify component file paths match imports in UnitMixRouter. Update import statements if needed.

**Problem:** `useDealType()` returns undefined
**Solution:** Ensure DealModuleContext or dealStore is initialized. Check parent component provides context.

**Problem:** Divider label doesn't appear in analyzer_designer mode
**Solution:** Check viewport width — divider uses flexbox, may wrap on mobile. Add responsive classes if needed.

**Problem:** Components don't accept deal/dealId props
**Solution:** Wrapper props in UnitMixRouter or modify component signatures to match. Current props structure:
```typescript
interface ComponentProps {
  deal?: any;
  dealId?: string;
  readonly?: boolean; // optional, analyzer mode in analyzer_designer
}
```

## Future Enhancements

1. **Persistence:** Save unit mix changes to deal context/API on blur
2. **Comparison View:** Toggle side-by-side vs. stacked layout in analyzer_designer
3. **Undo/Redo:** Add state management for design iterations
4. **Presets:** Load common unit mix patterns from library
5. **Validation:** Zoning constraints validation (max density, FAR, height limits)
6. **Market Sync:** Auto-pull demand signals from M05/M06 modules

## References

- **Configuration:** `frontend/src/shared/config/product-type-adaptation.ts`
- **Router:** `frontend/src/components/deal/sections/UnitMixRouter.tsx`
- **Analyzer:** `src/components/modules/unit-mix/unit-mix-positioning-v5.jsx`
- **Designer:** `src/components/modules/unit-mix/development-program-builder.jsx`
- **Deal Type System:** `deal-type-visibility.ts` (DealType, getProFormaTemplate, etc.)
