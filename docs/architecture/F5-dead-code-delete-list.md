# F5 Dead-Code Verification — Delete List
*Task #1332 · verified May 2026*

## Methodology

Full `grep` sweep of `frontend/src` for any `import` of each target file.
App.tsx route table inspected for any active `<Route>` that renders a target
component (not just a redirect shim). Barrel files traced to confirm no
downstream consumer reaches a target via re-export.

---

## Targets — Verification Results

### 1. `frontend/src/pages/DealPage.tsx`
**DEAD — safe to delete**

- No import found in any file outside `DealPage.tsx` itself.
- App.tsx routes:
  - `/deals/:dealId` → `DealIdRedirect` (redirects to `/assets-owned/:id/property`)
  - `/deals/:dealId/view` → `DealIdRedirectByDealId` (redirects to `/assets-owned/:id/property`)
  - Neither helper imports or renders `DealPage`.
- Side-note: File still contains `import { InvestmentStrategySection }` (deleted in
  Task #1331). The build passes because Vite never resolves this file — it is
  fully tree-shaken out of the bundle.

---

### 2. `frontend/src/pages/DealPageEnhanced.tsx`
**DEAD — safe to delete**

- Zero imports found outside the file itself.
- App.tsx route `/deals/:dealId/enhanced` → `DealIdRedirectByDealId`
  (redirects to `/assets-owned/:id/property`). `DealPageEnhanced` is never
  rendered.
- Side-note: Still imports `StrategySection` (deleted in Task #1331); same
  tree-shaking reason above.

---

### 3. `frontend/src/pages/DealView.tsx`
**DEAD — safe to delete**

- Zero imports found outside the file itself.
- App.tsx routes:
  - `/deals/:id` → `DealIdRedirect`
  - `/deals/:id/:module` → `RedirectDealViewToTab` (redirects to `/deals/:id/detail?tab=:module`)
  - Neither helper imports or renders `DealView`.
- Side-note: Still imports `StrategySection` (deleted in Task #1331); same
  tree-shaking reason above.

---

### 4. `frontend/src/components/deal/sections/DebtTab.tsx`
**DEAD — safe to delete**

- Exported from `frontend/src/components/deal/sections/index.ts` line 43, but
  **no consumer imports `DebtTab` from the sections barrel or directly from
  `sections/DebtTab.tsx`**.
- The only apparent consumer is
  `frontend/src/pages/development/financial-engine/CapitalHubTab.tsx`, but
  that file imports from its own **local** `./DebtTab` — i.e.
  `frontend/src/pages/development/financial-engine/DebtTab.tsx`, which is a
  **completely separate file** that must not be touched.
- `DealDetailPage.tsx` uses `ExitCapitalModule` (the replacement) instead.
- **Barrel cleanup required**: remove `export { DebtTab } from './DebtTab';`
  from `frontend/src/components/deal/sections/index.ts` line 43.

---

### 5. `frontend/src/components/deal/sections/ExitStrategyTabs.tsx`
**DEAD — safe to delete**

- The only importer is `sections/DebtTab.tsx` (also dead — see #4 above).
  Lines 23–24 of `DebtTab.tsx`:
  ```ts
  import { ExitWindowsTab, SensitivityTab, MonitorTab } from './ExitStrategyTabs';
  import type { ExitStrategyConfig } from './ExitStrategyTabs';
  ```
- No other file imports `ExitStrategyTabs` or any of its named exports
  (`ExitWindowsTab`, `SensitivityTab`, `MonitorTab`, `ExitStrategyConfig`,
  `useProjectionModel`).
- Not exported from `sections/index.ts` — no barrel cleanup needed.
- `ExitCapitalModule.tsx`'s doc comment confirms: *"Replaces DebtTab,
  ExitDrivesCapital, ExitStrategyTabs, DebtCycleChart, DebtProductsChart"*.

---

## Files with Live Consumers — DO NOT DELETE

| File | Live consumer |
|---|---|
| `frontend/src/components/deal/sections/ExitCapitalModule.tsx` | `DealDetailPage.tsx` line 75 / 189 |
| `frontend/src/pages/development/financial-engine/DebtTab.tsx` | `CapitalHubTab.tsx` line 4 / 57 |

---

## Complete Delete-List

### Files to delete
```
frontend/src/pages/DealPage.tsx
frontend/src/pages/DealPageEnhanced.tsx
frontend/src/pages/DealView.tsx
frontend/src/components/deal/sections/DebtTab.tsx
frontend/src/components/deal/sections/ExitStrategyTabs.tsx
```

### Barrel exports to remove from `frontend/src/components/deal/sections/index.ts`
```
Line 43:  export { DebtTab } from './DebtTab';
```

### Additional related files to review (not in original scope — flag for product decision)
- `frontend/src/components/deal/sections/DebtCycleChart.tsx` — imported only
  by `sections/DebtTab.tsx` (dead). Likely also dead; verify before deleting.
- `frontend/src/components/deal/sections/DebtProductsChart.tsx` — same as above.
- `frontend/src/components/deal/sections/ExitDrivesCapital.tsx` — same as above.

---

## Build Impact

- Removing these 5 files and the 1 barrel line will leave the build clean.
- `sections/DealPage.tsx` and `sections/DealPageEnhanced.tsx` currently contain
  broken imports of deleted components from Task #1331. Their deletion resolves
  those dangling references entirely.
- The financial-engine's `DebtTab.tsx` and `CapitalHubTab.tsx` are unaffected —
  they live in a completely separate directory and import from their own local
  barrel.
