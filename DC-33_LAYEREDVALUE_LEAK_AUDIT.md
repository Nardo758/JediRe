# DC-33: LayeredValue Raw Layer Leak Audit

## Scope
Audit of 4 tabs identified in the deal-capsule audit as leaking raw `.platform` / `.broker` layer values instead of using the backend-resolved `.resolved` value.

**Affected Files:**
1. `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx` (3,712 lines)
2. `frontend/src/pages/development/financial-engine/OverviewTab.tsx` (637 lines)
3. `frontend/src/pages/development/financial-engine/DealTermsTab.tsx` (1,977 lines)
4. `frontend/src/pages/development/financial-engine/SourcesUsesTab.tsx` (683 lines)

## Backend Contract

`OSRow` interface (line 51-59 of AssumptionsTab.tsx):
```typescript
interface OSRow {
  field: string; label: string;
  broker: number|null; platform: number|null;
  t12: number|null; t6: number|null; t3: number|null; t1: number|null;
  rentRoll: number|null; taxBill: number|null;
  resolved: number|null; resolution: string|null; perUnit: number|null;
  source: string|null; confidence: number|null;
  benchmarkPosition: 'above'|'below'|'within'|null;
}
```

The `resolved` field contains the canonical value after backend resolution. The `resolution` field indicates which layer won (e.g., `"platform"`, `"broker"`, `"t12"`, `"user"`). The frontend should display `resolved` as the authoritative value, with `resolution` driving the color code.

---

## Tab 1: AssumptionsTab.tsx — 14 Leaks Found

### Leak 1: LayeredCell primary display (CRITICAL)
**Location:** `LayeredCell` component, lines 1005-1013
**Code:**
```tsx
{!hasUser && platform != null && (
  <div className="text-[9px] font-mono font-bold text-cyan-400 leading-[1.3]">
    {format(platform)}
  </div>
)}
{!hasUser && platform == null && broker != null && (
  <div className="text-[9px] font-mono font-bold text-amber-400 leading-[1.3]">
    {format(broker)}
  </div>
)}
```
**Problem:** When no user override exists, the cell unconditionally shows `platform` (cyan) if it exists, falling back to `broker` (amber). It never consults the backend's `resolved` field. If the backend resolved to `broker` because platform confidence was low, the UI still shows platform in cyan — misleading the operator.
**Fix:** Add `backendResolved` and `resolution` props to `LayeredCell`. Display `resolved` as the primary value, with color determined by `resolution`.

### Leak 2: LayeredCell resolved computation (MEDIUM)
**Location:** `LayeredCell`, line 956
**Code:** `const resolved = formulaResult ?? user ?? platform ?? broker;`
**Problem:** The frontend computes its own "resolved" value with a naive fallback chain. It ignores the backend's `resolved` and `resolution` fields entirely. This can diverge from the backend's algorithm (which may consider confidence, data quality, refusal state, etc.).
**Fix:** Use `backendResolved` as the fallback before `platform ?? broker`.

### Leak 3: Grid cell rendering — no resolved passed (CRITICAL)
**Location:** Grid rendering, lines 2911-2956
**Code:**
```tsx
{years.map(yr => {
  const broker   = financials ? rd.getBroker(financials, yr) : null;
  let platform   = resolvePlatform(rd, yr);
  const user     = getUser(rd.key, yr);
  // ...
  <LayeredCell key={yr}
    vals={{ broker, platform: displayPlatform, user: displayUser }}
    ...
  />
})}
```
**Problem:** The `LayeredCell` only receives `broker`, `platform`, and `user`. It never receives the backend's `resolved` or `resolution` for the row. The `getResolved` getter exists on `RowDef` but is never invoked in the grid rendering path.
**Fix:** Call `rd.getResolved?.(financials, yr)` and pass the result plus `resolution` to `LayeredCell`.

### Leak 4: Y1 source selection logic (MEDIUM)
**Location:** Lines 2920-2928
**Code:**
```tsx
if (y1Source === 'BROKER')        platform = broker;
else if (y1Source === 'T12')      platform = y1Row?.t12 ?? broker ?? platform;
else if (y1Source === 'T6')       platform = y1Row?.t6  ?? y1Row?.t12 ?? platform;
else if (y1Source === 'T3')       platform = y1Row?.t3  ?? y1Row?.t12 ?? platform;
else if (y1Source === 'T1')       platform = y1Row?.t1  ?? y1Row?.t12 ?? platform;
```
**Problem:** When the user selects a Y1 source (BROKER, T12, T6, T3, T1), the code directly assigns raw layer values to `platform`. These raw values bypass the backend's resolution algorithm. The user should be selecting which layer to *display* as the Y1 source, but the backend's `resolved` should still be the authoritative value for the cell.
**Fix:** The Y1 source selection should control which layer is shown in the Y1 column, but the `resolved` value should still be the primary display value. When a Y1 source is selected, show that layer's value, but the resolution should reflect the selected source.

### Leak 5: computeFormulaResult uses raw layers (MEDIUM)
**Location:** Lines 2193-2210
**Code:**
```tsx
yearVals[y] = getUser(rd.key, y) ?? (financials ? resolvePlatform(rd, y) ?? rd.getBroker(financials, y) : null);
```
**Problem:** Formula evaluation uses raw platform/broker as the base for year values. If the backend resolved to a different layer (e.g., T12), the formula evaluates against the wrong base value.
**Fix:** Use `rd.getResolved?.(financials, y) ?? resolvePlatform(rd, y) ?? rd.getBroker(financials, y)`.

### Leak 6: Protector inputs (Gordon coupling, NOI identity) (MEDIUM)
**Location:** Lines 2387-2431
**Code:**
```tsx
const resolve = (key: string, yr: number): number | null => {
  const u = getUser(key, yr);
  if (u != null) return u;
  const row = findRow(key);
  if (!row) return null;
  return resolvePlatform(row, yr) ?? row.getBroker(financials, yr);
};
```
**Problem:** F9 Protector inputs (exitCap, terminalRentGrowth, opexGrowth, noiMargin) use raw platform/broker instead of resolved. The Gordon coupling and NOI identity warnings are computed against raw layers, not the authoritative resolved values.
**Fix:** Use `row.getResolved?.(financials, yr) ?? resolvePlatform(row, yr) ?? row.getBroker(financials, yr)`.

### Leak 7: NOI margin computation (MEDIUM)
**Location:** Lines 2415-2419
**Code:**
```tsx
const noiCell = y1?.find(r => r.field === 'net_operating_income') ?? y1?.find(r => r.field === 'noi');
const egiCell = y1?.find(r => r.field === 'effective_gross_income') ?? y1?.find(r => r.field === 'egi');
const noi = noiCell?.platform ?? noiCell?.broker;
const egi = egiCell?.platform ?? egiCell?.broker;
```
**Problem:** NOI margin for the protector panel uses raw `platform ?? broker` instead of `resolved`. If the backend resolved NOI to T12, the protector uses the wrong value.
**Fix:** Use `noiCell?.resolved ?? noiCell?.platform ?? noiCell?.broker` and same for egi.

### Leak 8: getYearNPlatform for GPR (LOW)
**Location:** Line 264
**Code:** `const base = y1(f,'gpr')?.platform;`
**Problem:** The GPR year-N platform getter uses `.platform` directly. If the backend resolved GPR to broker (e.g., when M07 is offline), the year-N platform projection still uses the raw platform value. This is a platform-specific getter, so using `.platform` is intentional for the *platform* layer, but it means the fallback is wrong when the backend resolved to broker.
**Fix:** This is the `getYearNPlatform` function which is supposed to return the platform layer. It should continue to use `.platform`. But the consumer (`LayeredCell`) should prefer `resolved` over this raw platform value. No fix needed here — fix the consumer.

### Leak 9: getYearNPlatform for vacancy (LOW)
**Location:** Line 279
**Code:** `getYearNPlatform: (f, yr) => tyr(f, yr)?.vacancyPct ?? y1(f,'vacancy_loss')?.platform ?? null,`
**Problem:** Falls back to `.platform` for vacancy when traffic data is unavailable. Should use `.resolved` first.
**Fix:** Use `y1(f,'vacancy_loss')?.resolved ?? y1(f,'vacancy_loss')?.platform ?? null`.

### Leak 10: getDivergenceColor uses frontend effective (LOW)
**Location:** Lines 927-942
**Code:** `const effective = user ?? platform ?? broker;`
**Problem:** The divergence color computation uses the frontend's naive effective value instead of the backend's `resolved`. The confidence band comparison and divergence detection may flag false positives or miss real divergences.
**Fix:** Use `user ?? backendResolved ?? platform ?? broker`.

### Leak 11: handleUsePlatform (LOW)
**Location:** Lines 2259-2280
**Code:** `const v = rd.getPlatform(financials, yr);`
**Problem:** The "Use All Platform" bulk action applies raw platform values as user overrides. This is intentional for the action (the user explicitly wants platform), but the values should be the *resolved* platform values, not raw. Actually, `getPlatform` already applies growth rates, so it's fine for this action. But the values are raw platform, not the backend-resolved platform.
**Fix:** No change needed — the user explicitly wants to apply the platform layer.

### Leak 12: handleUseBroker (LOW)
**Location:** Lines 2282-2300
**Code:** `const v = rd.getBroker(financials, yr);`
**Problem:** Same as above — intentional for the bulk action.
**Fix:** No change needed.

### Leak 13: handleUseResolved (CORRECT)
**Location:** Lines 2302-2320
**Code:** `const v = rd.getResolved?.(financials, yr) ?? null;`
**Problem:** This is the correct pattern! It uses `getResolved`. The other bulk actions should follow this pattern for consistency, but they're intentionally applying a specific layer.
**Fix:** No change needed.

### Leak 14: openDrawer passes raw layers (LOW)
**Location:** Lines 2322-2337
**Code:**
```tsx
vals: {
  broker:   rd.getBroker(financials, yr),
  platform: resolvePlatform(rd, yr),
  user:     getUser(rd.key, yr),
},
```
**Problem:** The drawer doesn't show the resolved value. The user sees raw platform/broker in the drawer but not the resolved value.
**Fix:** Add `resolved` to the drawer payload and display it in the drawer UI.

---

## Tab 2: OverviewTab.tsx — 3 Leaks Found

### Leak 1: proFormaRows missing resolved column (MEDIUM)
**Location:** Lines 160-166
**Code:**
```tsx
const proFormaRows: ProFormaRow[] = [
  { label: 'EXIT CAP RATE', brokerFmt: ..., platformFmt: ..., brokerRaw: ..., platformRaw: ... },
  ...
];
```
**Problem:** The 3-LAYER MODEL comparison table shows Broker, Platform, and You columns. But the "You" column is always empty (`—`). The resolved value from the backend is never displayed. The user sees broker vs platform divergence but has no visibility into the authoritative resolved value.
**Fix:** Add a `resolvedFmt` and `resolvedRaw` field to `ProFormaRow`, and display the resolved value in the "You" column (or add a "RESOLVED" column).

### Leak 2: brokerPurchasePrice fallback to raw deal (LOW)
**Location:** Lines 73-76
**Code:**
```tsx
const brokerPurchasePrice =
  f9Financials?.capitalStack?.purchasePrice ??
  (typeof deal?.purchase_price === 'number' ? deal.purchase_price as number
    : typeof deal?.asking_price === 'number' ? deal.asking_price as number : null);
```
**Problem:** When `f9Financials` is unavailable, the code falls back to raw `deal?.purchase_price` or `deal?.asking_price`. These are unprocessed broker values, not resolved values. The "Broker" column in the proFormaRows shows this raw value.
**Fix:** The fallback is intentional for when F9 hasn't loaded. But the label should indicate it's a raw value. Or better, only show the row when F9 data is available.

### Leak 3: collisionDot uses raw layers (LOW)
**Location:** Lines 48-59
**Code:**
```tsx
function collisionDot(broker: number | null, platform: number | null): React.ReactNode {
  if (broker == null || platform == null || platform === 0) return null;
  const diverge = Math.abs((broker - platform) / platform);
  ...
}
```
**Problem:** The collision dot compares raw broker and platform values. This is intentional for raw-layer divergence detection, but it doesn't consider the resolved value. If the backend resolved to broker, there's no collision from the user's perspective.
**Fix:** This is actually a feature — it detects raw-layer divergence. But the collision should be computed against the resolved value, not raw layers. Actually, no — the collision dot is meant to show when broker and platform diverge. If they diverge, the user needs to know. But the resolved value should also be shown.
**Resolution:** Keep collisionDot as-is (it serves a purpose), but add resolved display to the table.

---

## Tab 3: DealTermsTab.tsx — 4 Leaks Found

### Leak 1: Selling Costs platform hardcoded (MEDIUM)
**Location:** Lines 1669-1676
**Code:**
```tsx
<LvRow label="Selling Costs %"
  broker={undefined} platform="2.00%"
  override={sellingCosts} setOverride={setSellingCosts}
  overrideKind="pct"
  onCommit={() => void saveSellingCosts()}
  resolved={sellingCostsPctResolved != null ? `${(sellingCostsPctResolved * 100).toFixed(2)}%` : '2.00%'}
  source={sellingCostsPctResolved != null ? 'Override' : 'Platform'}
/>
```
**Problem:** The `platform` prop is hardcoded to `"2.00%"`. This is a raw platform default, not the resolved value. The backend may have resolved a different value (e.g., from broker OM). The Platform column shows the hardcoded 2.00% regardless of what the backend actually resolved.
**Fix:** Use the resolved value from the backend for the `platform` prop. If the backend has no resolved selling costs, show the benchmark/default.

### Leak 2: Exit Cap Rate platform is raw M07 value (LOW)
**Location:** Lines 1658-1668
**Code:**
```tsx
<LvRow label="Exit Cap Rate"
  broker={undefined}
  platform={fmtPct(platformExitCap)}
  override={exitCap} setOverride={setExitCap}
  ...
  resolved={fmtPct(exitCapResolved)}
  ...
/>
```
**Problem:** The `platform` prop shows `platformExitCap` which is `f9Financials?.trafficProjection?.calibrated?.exitCap`. This is the raw M07 platform value. The `resolved` prop shows `exitCapResolved` which is `fin?.assumptions?.exitCap`. The Platform column shows the raw M07 value, while the Resolved column shows the resolved value. This is technically correct separation, but the Platform column is showing a raw platform value that may not be the resolved value.
**Fix:** This is actually correct for a layered table — the Platform column should show the raw platform value. The issue is only when the resolved value should be shown as the primary value. The `LvRow` component already has a `resolved` column that shows the resolved value. So this is not a leak per se.

### Leak 3: Going-in Cap Rate platform shows resolved (MISLEADING)
**Location:** Lines 1458-1466
**Code:**
```tsx
<LvRow label="Going-in Cap Rate"
  broker={undefined}
  platform={fmtPct(goingInCapResolved)}
  ...
  readOnly readOnlyValue={fmtPct(goingInCapResolved)}
  ...
/>
```
**Problem:** The `platform` prop is set to `goingInCapResolved` which is a *resolved* value. But the column is labeled "Platform" in the header. This is misleading — the Platform column shows a resolved value, not the raw platform value. The raw platform value for going-in cap rate would be `f9Financials?.proforma?.valuationSnapshot?.goingInCapT12` (which is what `goingInCapResolved` already resolves to). So this is actually the resolved value being shown in the Platform column.
**Fix:** This is a labeling issue. The value in the Platform column should be the raw platform value (if available), not the resolved value. But going-in cap rate is computed, so there's no separate platform layer. This is fine.

### Leak 4: Investment Strategy resolved field used correctly (CORRECT)
**Location:** Lines 1595-1613
**Code:**
```tsx
<LvRow label="Investment Strategy"
  ...
  resolved={investStrategyResolved ?? '--'}
  source={
    investmentStrategyLv?.override != null ? 'Override'
    : investmentStrategyLv?.detected != null ? 'Detected'
    : 'Not Provided'
  }
/>
```
**Problem:** None. This is the correct pattern! The `resolved` prop uses `investStrategyResolved` which comes from `investmentStrategyLv?.resolved`. This is a proper LayeredValue object with `resolved`, `platform`, `broker`, `override`, `detected` fields. The `LvRow` component correctly separates the layers.
**Fix:** No change needed. This is the canonical pattern other rows should follow.

---

## Tab 4: SourcesUsesTab.tsx — 1 Leak Found

### Leak 1: mezzAmtFb uses .platform (LOW)
**Location:** Line 140
**Code:**
```tsx
const mezzAmtFb = f9Financials?.debt?.loans?.find(l => l.id === 'mezz')?.loanAmount?.platform ?? 0;
```
**Problem:** The fallback mezzanine amount uses `.platform` directly on the loan amount. If the backend resolved the loan amount to a different layer (e.g., broker), the fallback uses the wrong value. However, this is a fallback (the backend `su` object is preferred when available).
**Fix:** Use `.resolved ?? .platform ?? 0` instead of `.platform ?? 0`.

### Leak 2: purchasePriceFb uses raw deal (LOW)
**Location:** Lines 132-134
**Code:**
```tsx
const purchasePriceFb = f9Financials?.capitalStack?.purchasePrice
  ?? assumptions?.acquisition?.purchasePrice
  ?? (typeof deal?.purchase_price === 'number' ? deal.purchase_price as number : 0);
```
**Problem:** The fallback chain uses raw `deal?.purchase_price` as the last resort. This is a raw broker value.
**Fix:** This is intentional — when no resolved value is available, we fall back to the raw deal data. The `purchasePriceFb` is a fallback, not the display value. The display value comes from `su` (backend sources & uses) which uses resolved values. This is acceptable.

---

## Summary of Fixes Required

| Priority | Tab | Fix | Lines |
|----------|-----|-----|-------|
| **P0** | AssumptionsTab | LayeredCell: add `backendResolved` + `resolution` props, display resolved as primary | 947-1020 |
| **P0** | AssumptionsTab | Grid rendering: pass `getResolved` and `resolution` to LayeredCell | 2911-2956 |
| **P0** | AssumptionsTab | computeFormulaResult: use `getResolved` instead of raw layers | 2193-2210 |
| **P0** | AssumptionsTab | Protector inputs: use `getResolved` instead of raw layers | 2387-2431 |
| **P1** | AssumptionsTab | NOI margin: use `.resolved` instead of `.platform ?? .broker` | 2415-2419 |
| **P1** | AssumptionsTab | getYearNPlatform vacancy: use `.resolved` first | 279 |
| **P1** | AssumptionsTab | getDivergenceColor: use `backendResolved` in effective | 927-942 |
| **P1** | AssumptionsTab | openDrawer: pass resolved to drawer payload | 2322-2337 |
| **P1** | OverviewTab | proFormaRows: add resolved display to table | 160-166, 453-466 |
| **P1** | DealTermsTab | Selling Costs: use resolved value instead of hardcoded "2.00%" | 1669-1676 |
| **P2** | SourcesUsesTab | mezzAmtFb: use `.resolved` instead of `.platform` | 140 |

## Root Cause

The `LayeredValue<T>` pattern in the backend produces `resolved` and `resolution` fields. The frontend `LayeredCell` component was designed before the backend added `resolved` resolution, and it implements its own naive fallback (`platform ?? broker`). When the backend resolution algorithm diverges from this naive fallback (e.g., choosing broker over platform due to low confidence), the UI shows the wrong layer.

The canonical fix is: **always display `resolved` as the primary value; use `resolution` to determine the color; show raw `platform`/`broker` only in the tooltip/drawer for transparency.**
