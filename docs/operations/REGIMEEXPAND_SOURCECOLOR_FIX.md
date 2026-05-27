# RegimeExpand sourceColor Fix — Closing Note

**Date:** 2026-05-27  
**File changed:** `frontend/src/components/f9/RegimeExpand.tsx`  
**Tier:** Tier 1 from `docs/operations/MANDATE_CONSUMER_WIRING.md §6.1`  
**Status:** SHIPPED — build clean, Tier 1 closed

---

## Context

The MANDATE_CONSUMER_WIRING.md investigation identified that `RegimeExpand.tsx`'s `sourceColor()` helper used exact-key lookup against a `SOURCE_COLOR` map. The cashflow agent writes tiered source strings (`'tier1:t12'`, `'agent:cashflow'`, `'tier3:market_comp'`, etc.) into sub-field JSONB, but none of these matched the exact keys in `SOURCE_COLOR`. Every sub-field source badge rendered gray with an ugly compound label (`TIER1:T12`, `AGENT:CASHFLOW`).

---

## Before / After

### Before (original `sourceColor()`)

```typescript
const SOURCE_COLOR: Record<string, string> = {
  agent: '#a78bfa',
  platform: '#06b6d4',
  broker: '#f59e0b',
  archive: '#60a5fa',
  t12: '#34d399',
  default: '#475569',
};

function sourceColor(src: string | null): string {
  if (!src) return SOURCE_COLOR.default;
  return SOURCE_COLOR[src.toLowerCase()] ?? SOURCE_COLOR.default;
}
```

Badge label: `{src.toUpperCase()}` → produced `TIER1:T12`, `AGENT:CASHFLOW`

### After (with normalizeSource + sourceLabel)

```typescript
const SOURCE_COLOR: Record<string, string> = {
  agent: '#a78bfa',
  platform: '#06b6d4',
  broker: '#f59e0b',
  archive: '#60a5fa',
  t12: '#34d399',
  default: '#475569',
};

/** Strip tier prefix from compound source strings like 'tier1:t12' → 't12', 'agent:cashflow' → 'agent' */
function normalizeSource(src: string): string {
  const lower = src.toLowerCase();
  const colonIdx = lower.indexOf(':');
  if (colonIdx === -1) return lower;
  const suffix = lower.slice(colonIdx + 1);
  const prefix = lower.slice(0, colonIdx);
  // 'agent:*' → 'agent'; 'tier*:key' → key
  if (prefix === 'agent') return 'agent';
  return suffix || lower;
}

function sourceColor(src: string | null): string {
  if (!src) return SOURCE_COLOR.default;
  const key = normalizeSource(src);
  return SOURCE_COLOR[key] ?? SOURCE_COLOR.default;
}

function sourceLabel(src: string | null): string {
  if (!src) return '';
  return normalizeSource(src).toUpperCase();
}
```

Badge label: `{sourceLabel(src)}` → produces `T12`, `AGENT`, `PLATFORM`

---

## Normalization Mapping

| Source string written by agent | Before (color / label) | After (color / label) |
|---|---|---|
| `'tier1:t12'` | gray / `TIER1:T12` | green (#34d399) / `T12` |
| `'tier1:rent_roll'` | gray / `TIER1:RENT_ROLL` | gray / `RENT_ROLL` (no exact key — acceptable fallback for Phase 1) |
| `'tier2:owned_asset'` | gray / `TIER2:OWNED_ASSET` | gray / `OWNED_ASSET` (no exact key — acceptable) |
| `'tier3:market_comp'` | gray / `TIER3:MARKET_COMP` | gray / `MARKET_COMP` (no exact key) |
| `'tier3:platform_benchmark'` | gray / `TIER3:PLATFORM_BENCHMARK` | gray / `PLATFORM_BENCHMARK` |
| `'agent:cashflow'` | gray / `AGENT:CASHFLOW` | violet (#a78bfa) / `AGENT` |
| `'t12'` (non-tiered, T12 fallback) | green / `T12` | green / `T12` (unchanged — no regression) |
| `'platform'` (non-tiered) | cyan / `PLATFORM` | cyan / `PLATFORM` (unchanged) |
| `'broker'` (non-tiered) | amber / `BROKER` | amber / `BROKER` (unchanged) |

**The two most common agent sub-field sources are fixed:** `'tier1:t12'` (pre-renovation anchored in T12 actuals) now renders green, and `'agent:cashflow'` (default postprocess fallback) now renders violet. The remaining tier-3 sources (market_comp, platform_benchmark, owned_asset) still render gray — Phase 2 enhancement if needed would add these to SOURCE_COLOR.

---

## Effort Discrepancy

The investigation estimated ~8 lines. Actual implementation was ~19 lines (normalizeSource helper: 10 lines; updated sourceColor: 4 lines; new sourceLabel: 4 lines; badge label update: 1 line). The approach was as described; the helper function required a few extra lines for the `agent:*` prefix special-case. No design changes were needed.

---

## Build Verification

`cd frontend && npm run build` — **clean build** (warnings only — TradeAreaDefinitionPanel dynamic import, xlsx chunk size — both pre-existing, unrelated to this change). No TypeScript errors. No new warnings introduced.

---

## Regression Check

Non-tiered sources that were working before the fix:
- `'t12'` → still green / `T12` ✓ (normalizeSource returns `'t12'` unchanged — no colon, lowercase match)
- `'platform'` → still cyan / `PLATFORM` ✓
- `'broker'` → still amber / `BROKER` ✓
- `'agent'` → still violet / `AGENT` ✓ (if ever used without suffix)
- `null` → still gray / no badge rendered ✓

All existing non-tiered sources pass through `normalizeSource()` unchanged (the `colonIdx === -1` early return handles them).

---

## Tier 1 Status — CLOSED

Per `docs/operations/MANDATE_CONSUMER_WIRING.md §6.1`, Tier 1 work was:

> "Fix `sourceColor()` to handle tiered strings (`'tier1:t12'` → T12 color)" + "Fix source label display (`src.toUpperCase()` → normalized last segment)"

Both items are done. Tier 1 is closed.

**Next: Tier 2** — postprocess directional consistency and delta validation checks (4 `logger.warn` additions to `cashflow.postprocess.ts`) + Gap 2 ruling comment. See `docs/operations/MANDATE_CONSUMER_WIRING.md §6.2`.
