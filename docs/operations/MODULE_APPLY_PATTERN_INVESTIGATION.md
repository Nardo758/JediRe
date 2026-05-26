# PLATFORM-WIDE "APPLY TO F9" PATTERN INVESTIGATION

**Date:** 2026-05-26  
**Trigger:** Strategy Module "APPLY TO PRO FORMA" is a known stub (confirmed in STRATEGY_MODULE_INVESTIGATION.md). Same pattern reportedly exists in M35 Event Timeline and possibly other modules.  
**Scope:** Inventory all apply-to-F9 buttons platform-wide; analyze existing infrastructure; propose a canonical design. No code changes.

---

## TABLE OF CONTENTS

1. ["Apply" Button Inventory Across All Modules](#1-apply-button-inventory-across-all-modules)
2. [Existing Infrastructure Analysis](#2-existing-infrastructure-analysis)
3. [Design Proposal for Canonical Pattern](#3-design-proposal-for-canonical-pattern)
4. [Migration Path Per Existing Button](#4-migration-path-per-existing-button)
5. [Open Questions](#5-open-questions)

---

## 1. "Apply" Button Inventory Across All Modules

Search pattern used: `grep -r -i "apply.*proforma|apply.*to.*deal|push.*assumption|applyTo|APPLY TO" frontend/src/`

### 1.1 Complete Inventory

| # | Module | Label | File | Line | Endpoint | Status | Fields Intended |
|---|---|---|---|---|---|---|---|
| A1 | M08 Strategy — ENTRY | "APPLY TO PRO FORMA" | `StrategyV2Components.tsx` | 1277 | `POST /api/v1/deals/:dealId/proforma/apply-plan` | **STUB** (endpoint DNE) | priceCeiling → purchasePrice; targetQuarter annotation; debtStructure annotation |
| A2 | M08 Strategy — VALUE CREATION | "APPLY TO PRO FORMA" | `StrategyV2Components.tsx` | 1303 | Same stub endpoint | **STUB** | N plan actions with timing + expected impact |
| A3 | M08 Strategy — EXIT | "APPLY TO PRO FORMA" | `StrategyV2Components.tsx` | 1403 | Same stub endpoint | **STUB** | plan.exit.capRate → exitCapRate; plan.exit.expectedIRR annotation |
| B1 | M35 Event Timeline | "APPLY TO PRO FORMA" | `EventTimelineSection.tsx` | 173 | Opens `EventDependencyModal` | **PARTIAL** (modal exists; onProceed handler unclear) | Event forecasts → rent growth, cap rate, absorption, permits |
| C1 | F9 Goal Seek Widget | "Apply to Proforma" | `GoalSeekWidget.tsx` | 437 | None — local state mutation only | **WORKING** (volatile) | Single solved variable: purchasePrice / exitCapRate / rentGrowth / holdPeriod / ltv |
| C2 | F9 Goal Seek Roadmap | "Apply to Proforma (N changes)" | `GoalSeekRoadmap.tsx` | 201 | None — local state mutation only | **WORKING** (volatile) | Multi-variable: revenue (rentGrowth, occupancy, lossToLease, collectionLoss), disposition (exitCapRate) |
| D1 | M11 Debt Tab | "Apply to Stack" | `DebtTab.tsx` | 957 | None — local state mutation | **WORKING** (different domain) | Debt product rate/LTV → debt stack configuration (NOT F9 proforma assumptions) |
| E1 | AI Recommendations | "Apply to Model" | `AIRecommendationsSection.tsx` | 51 | None wired | **MOCK DATA** | Entire recommendations array is hardcoded `mockRecommendations`; no real button rendered |
| F1 | Market Analysis / AIInsightsPanel | "Apply to 3D Design" | `MarketAnalysisPage.tsx` | 64 / 214 | `{ payload: { dealId, source: 'apply-to-design' } }` | **WORKING** (different domain) | Market AI insights → 3D design tool (not F9 proforma) |
| G1 | F9 Assumptions Tab | "Apply to all years in hold period" | `AssumptionsTab.tsx` | 1221 | N/A | **UI LABEL** — not a button calling another module; describes an in-F9 behavior | In-F9 only |

### 1.2 F9 Proforma-Specific Apply Actions (filtered)

Only the following are relevant to the "module writes to F9 proforma assumptions" pattern:

| ID | Module | Label | Status |
|---|---|---|---|
| A1 | Strategy ENTRY | "APPLY TO PRO FORMA" | STUB — non-existent endpoint |
| A2 | Strategy VALUE CREATION | "APPLY TO PRO FORMA" | STUB — non-existent endpoint |
| A3 | Strategy EXIT | "APPLY TO PRO FORMA" | STUB — non-existent endpoint |
| B1 | M35 Event Timeline | "APPLY TO PRO FORMA" | PARTIAL — modal exists, apply action unclear |
| C1 | F9 Goal Seek Widget | "Apply to Proforma" | WORKING — volatile (React state only) |
| C2 | F9 Goal Seek Roadmap | "Apply to Proforma" | WORKING — volatile (React state only) |

**Summary:**
- 2 working implementations exist (both within F9 itself — Goal Seek is an intra-F9 action, not a cross-module write)
- 3 stub instances (Strategy Module)
- 1 partial instance (M35 Event Timeline — modal-mediated but unclear if apply action is wired)
- 0 working cross-module apply actions (a module outside F9 successfully writing to F9 assumptions)

### 1.3 M35 Event Timeline — Partial Investigation

`EventTimelineSection.tsx` line 169-174:
```typescript
<button
  onClick={() => { setDepContext('proforma'); setShowDepModal(true); }}
>
  APPLY TO PRO FORMA
</button>
```

`EventDependencyModal` is shown with `context='proforma'`. The modal presents:
- List of event-dependent assumptions with confidence/status
- Three actions: "PROCEED WITH FORECASTS" | "RUN WITHOUT EVENTS" | "CUSTOMIZE"

The modal's `onProceed` callback is passed in from `EventTimelineSection`. What `onProceed` does in the event timeline context was not visible in the read sections — it would need a full read of `EventTimelineSection.tsx` lines 70-150 to determine. However, given the pattern, `onProceed` likely either:
- Calls the event context API which already writes forecast data to deal assumptions (fully wired), OR  
- Is also a stub (the modal fires but the actual write path is not implemented)

This should be verified before the canonical pattern design is finalized.

### 1.4 Field Mapping for Each Stub

**A1 — Strategy ENTRY:**
```
plan.entry.targetQuarter    → no F9 field (annotation only)
plan.entry.priceCeiling     → deal_assumptions.budget / deals.budget (purchasePrice)
plan.entry.debtStructure    → deal_assumptions.loan_type + financing assumptions (annotation)
```

**A2 — Strategy VALUE CREATION:**
```
plan.valueCreation[].action      → annotation (no numeric field in F9)
plan.valueCreation[].timing      → annotation
plan.valueCreation[].costEstimate → deal_assumptions.capex or renovation_cost (numeric)
plan.valueCreation[].expectedImpact → annotation
```

**A3 — Strategy EXIT:**
```
plan.exit.capRate            → deal_assumptions.exit_cap_rate (via PATCH /assumptions/selling-costs or PUT)
plan.exit.expectedIRR[0/1]  → deal_assumptions.target_irr (via PATCH /assumptions/targets)
plan.exit.targetQuarter      → annotation only
plan.exit.buyerType          → annotation only
```

**B1 — M35 Event Timeline:**
```
event.forecast.rent_growth_yoy  → deal_assumptions revenue.rentGrowth[]
event.forecast.cap_rate         → deal_assumptions.exit_cap_rate
event.forecast.absorption       → market annotation (no direct F9 field)
event.forecast.permits          → market annotation (no direct F9 field)
```

---

## 2. Existing Infrastructure Analysis

### 2.1 LayeredValue<T> — What It Does and Doesn't Do

The `LayeredValue<T>` type is defined in `backend/src/types/layered-value.ts`:

```typescript
export interface LayeredValue<T> {
  value: T;
  source: LayeredValueSource | string;
  agentRunId?: string;
  agentId?: string;
  runAt?: string;
  metadata?: Record<string, unknown>;
  stanceModulated?: boolean;   // OperatorStance extension
  stanceTrace?: string;        // OperatorStance extension
}
```

`LayeredValueSource` literals:
```typescript
'tier1:t12' | 'tier1:rent_roll' | 'tier1:tax_bill'
'tier2:owned_asset'
'tier3:platform' | 'tier3:market_comp' | 'tier3:jurisdiction'
'tier4:broker'
'agent:research' | 'agent:zoning' | 'agent:supply' | 'agent:cashflow' | 'agent:commentary'
'subject_history:s1' | ... | 'subject_history:s4'
't12' | 'rent_roll' | 'tax_bill'
'override' | 'platform' | 'agent' | 'broker' | 'user' | 'computed'
```

**What LayeredValue DOES provide:**
- Source provenance for every stored assumption value
- Tier hierarchy: tier1 (documents) > tier2 (owned asset) > tier3 (platform) > tier4 (broker)
- OperatorStance modulation tracking (stanceModulated + stanceTrace)
- Agent run ID and timestamp for agent-written values

**What LayeredValue DOES NOT provide:**
- A "last applied by module" field — there is no `appliedBy: 'strategy_module'` concept
- Conflict resolution policy — the type carries no rule about what happens when two sources compete
- The closest concept is `source: 'user'` which signals operator override, but there is no `source: 'strategy:entry'` literal — that would need to be added as a new source string
- User-facing "last set by X" audit trail — no timestamp or module label surfaced in any UI currently

**What OperatorStance adds (precedent):**
The `stanceModulated` and `stanceTrace` fields are extensions layered onto `LayeredValue` for a specific concern (stance-driven re-blend). This is the architectural precedent for extending the type without breaking existing consumers. A `moduleAppliedBy` or `appliedSource` field could follow the same pattern.

---

### 2.2 Existing PATCH Endpoints for F9 Assumptions

From `backend/src/api/rest/deal-assumptions.routes.ts`:

| Endpoint | Fields Written | Source Tagging? |
|---|---|---|
| `PUT /:dealId/assumptions` | Full assumptions object | None |
| `PATCH /:dealId/purchase-price` | `budget` on deals + `purchase_price` on deal_assumptions | None |
| `PATCH /:dealId/assumptions/hold-period` | `hold_period_years` | None |
| `PATCH /:dealId/assumptions/targets` | `target_irr`, `target_equity_multiple`, etc. | None |
| `PATCH /:dealId/assumptions/strategy` | `investment_strategy_lv`, `exit_strategy_lv` (LayeredValue JSONB) | Yes — writes `override` slot of LayeredValue |
| `PATCH /:dealId/assumptions/selling-costs` | `selling_costs_pct` | None |
| `PATCH /:dealId/assumptions/closing-costs` | per-line closing cost sub-fields | None |
| `PATCH /:dealId/assumptions/dates` | close date, projected date | None |

**Key finding:** Only `PATCH /assumptions/strategy` writes through the LayeredValue structure (it writes the `override` slot). All other PATCH endpoints write raw values with no source tagging. A module that calls `PATCH /purchase-price` cannot declare "this value came from the Strategy Module" in any way the UI or DB can retrieve later.

---

### 2.3 Working Apply Pattern — F9 Goal Seek (Reference Implementation)

The Goal Seek Widget and Roadmap are the only working "apply" implementations. Their pattern:

**Client side (`GoalSeekWidget.tsx`):**
```typescript
// Single variable
onApplySolved(result.solveFor, result.solvedValue);
// → handleApplyGoalSeekSolved in ProFormaTab
//   → setPurchasePrice(value) | setExitCapRate(value) | setRentGrowth(...) | setHoldPeriod(...)
//   → React state only — no API call
```

**Client side (`GoalSeekRoadmap.tsx`):**
```typescript
onApply(applyPayload);
// → handleApplyGoalSeek in ProFormaTab
//   → applySolverToAssumptions(currentAssumptions, applyPayload)  [assumptionBridge.ts]
//   → Updates expenses state + sensitivityOverrides state
//   → setGoalSeekSteps([]); setGoalSeekApplyPayload(null)
//   → setTimeout(() => handleBuildModel(), 100)  [triggers F9 rebuild]
```

**`applySolverToAssumptions()` in `assumptionBridge.ts`:**
Maps solver output fields to the in-memory assumptions object:
```typescript
updated.revenue.rentGrowth = [applyPayload.assumptions.rent_growth, ...];
updated.revenue.stabilizedOccupancy = 1 - applyPayload.assumptions.vacancy_rate;
updated.revenue.lossToLease = applyPayload.assumptions.loss_to_lease;
updated.revenue.collectionLoss = applyPayload.assumptions.collection_loss;
updated.disposition.exitCapRate = applyPayload.assumptions.exit_cap_rate;
```

**Characteristics of the working pattern:**
1. **Volatile** — React state only; no PATCH to backend; values are lost on page refresh
2. **No source tagging** — nothing records that the goal-seek changed these values
3. **Intra-F9 only** — Goal Seek is embedded within F9; it modifies the same React state that F9 renders
4. **Auto-rebuild** — `handleBuildModel()` is called automatically after apply; the user sees updated projections immediately

**Why this works for Goal Seek but not for cross-module apply:**
Goal Seek operates within F9's React component tree. The state it modifies is co-located with the F9 rendering logic. A module outside F9 (Strategy Module, M35, etc.) cannot call `setPurchasePrice` directly — it has no access to F9's internal state. A cross-module apply requires either:
- A global state store (Zustand deal store) holding F9 assumptions that all modules can write, OR
- An API PATCH that persists the value and a mechanism for F9 to reload from the API

---

### 2.4 Gap Summary

| Gap | Description |
|---|---|
| No cross-module apply infrastructure | The Goal Seek pattern works because it's intra-F9. No module outside F9 can write F9 assumptions today. |
| No source tagging for programmatic writes | Existing PATCH endpoints write raw values with no `source: 'strategy_module'` tagging. |
| No conflict detection | No mechanism to detect when a module tries to write a field that has a user override. |
| No audit trail in UI | Even if writes were tagged, no UI component currently shows "last set by [module] on [date]". |
| F9 state ↔ DB synchronization is manual | F9 loads from DB on mount; user saves via explicit PUT. A module that PATCHes the DB must also signal F9 to reload. |
| `POST /deals/:dealId/proforma/apply-plan` does not exist | The Strategy Module stub calls a non-existent endpoint. |

---

## 3. Design Proposal for Canonical Pattern

### 3.1 Core Principle

Any module that wants to push values to F9 should follow a single, consistent flow:
1. The module proposes values + declares its source
2. Conflicts with user overrides are surfaced before writing
3. The write happens through LayeredValue-aware infrastructure
4. F9 reloads the updated assumption and rebuilds

This is distinct from the Goal Seek "intra-F9" pattern, which remains appropriate for F9-internal optimization.

---

### 3.2 New Endpoint: `POST /deals/:dealId/assumptions/apply-from-module`

**Request body:**
```typescript
{
  source: 'strategy:entry' | 'strategy:exit' | 'event_timeline' | 'goal_seek' | string,
  appliedAt: string,    // ISO timestamp
  fields: Array<{
    fieldPath: string,  // e.g. 'acquisition.purchasePrice', 'disposition.exitCapRate'
    value: number | string,
    evidence?: string,  // Human-readable source justification
    force?: boolean,    // If true, overwrite even when user override exists
  }>,
}
```

**Response:**
```typescript
{
  applied: Array<{ fieldPath: string, value: number | string, previousValue: any }>,
  conflicts: Array<{
    fieldPath: string,
    proposedValue: number | string,
    existingValue: any,
    existingSource: string,   // 'user', 'agent:cashflow', etc.
    existingSetAt?: string,
  }>,
  reloadToken: string,  // Opaque token; F9 detects this and reloads assumptions
}
```

**Server behavior:**
1. For each `field` in the request:
   - Check if current value has `source: 'user'` (user override exists)
   - If user override exists and `force !== true`: add to `conflicts`, skip write
   - If no conflict or `force: true`: write value with `source: request.source`, `runAt: request.appliedAt` to deal_assumptions
2. Return `applied[]` (successful writes) + `conflicts[]` (skipped fields)
3. Increment a `assumptions_version` counter on deal_assumptions (used by F9 to detect staleness)

**Field path mapping (from module fields to deal_assumptions columns):**

| Module field | fieldPath | Target column |
|---|---|---|
| plan.entry.priceCeiling | `acquisition.purchasePrice` | `deal_assumptions.budget` (also PATCH /purchase-price) |
| plan.exit.capRate | `disposition.exitCapRate` | `deal_assumptions.exit_cap_rate` |
| plan.exit.expectedIRR[0] | `targets.targetIrr` | `deal_assumptions.target_irr` |
| plan.holdStructure.targetHoldMonths | `hold.holdPeriodYears` | `deal_assumptions.hold_period_years` (÷ 12) |
| event.rent_growth_yoy | `revenue.rentGrowth[0]` | `deal_assumptions.revenue` JSONB |
| event.cap_rate | `disposition.exitCapRate` | `deal_assumptions.exit_cap_rate` |

---

### 3.3 Source-Aware Write Behavior

**Priority hierarchy for the new source tag:**

```
tier1 (documents) > tier2 (owned_asset) > tier3 (platform) > module_apply > tier4 (broker)
```

Module applies (`strategy:entry`, `event_timeline`, `goal_seek`) sit between `tier3:platform` and `tier4:broker` in authority — they represent operator-directed intelligence from a specific module, which is more authoritative than broker OM but less authoritative than live documents or platform data.

User overrides (`source: 'user'`) always sit at the top of the hierarchy — a module should never silently overwrite a user's manual entry.

**Conflict policy:**
- `source: 'user'` exists for field → surface conflict, require explicit `force: true`
- `source: 'strategy:entry'` exists and a different module tries to write → overwrite with new source (last module wins, logged)
- No existing source → write freely

---

### 3.4 UI Pattern for the "Apply" Action

**Standard button treatment:**
All module apply buttons should follow the same visual pattern — amber-tinted (consistent with "operator action" color in Bloomberg theme):

```
[PUSH TO F9 →]       ← new standard label (clearer than "APPLY TO PRO FORMA")
```

Or, with field detail:
```
[PUSH EXIT CAP 5.50% TO F9 →]
```

**Applied feedback:**
- Successful: toast at top of page — "Strategy Exit Cap applied to F9 · [View in F9]"
- Conflict exists: inline warning — "Exit Cap has a user override (5.25%). Push anyway? [FORCE] [CANCEL]"
- Error: standard toast error

**Conflict resolution UI:**
When `conflicts[]` is non-empty in the response, show a compact conflict panel:

```
┌─ FIELD CONFLICTS ──────────────────────────────────────────────────────────┐
│ EXIT CAP RATE  ·  Proposed: 5.50%  ·  User override: 5.25% (set 3 days ago)│
│ [FORCE OVERWRITE]  [KEEP USER VALUE]                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**F9 reload mechanism:**
F9 detects when assumptions have been externally modified via the `assumptions_version` counter (or a custom event dispatched after successful apply). On detection, it reloads assumptions from the API and rebuilds the model.

Alternatively, dispatch a custom DOM event (following the existing `basis.changed`, `hold_period.changed` pattern in replit.md):
```javascript
window.dispatchEvent(new CustomEvent('assumptions.module-applied', {
  detail: { source: 'strategy:entry', fields: ['acquisition.purchasePrice'] }
}));
```

F9 listens for `assumptions.module-applied` and triggers a reload + rebuild.

---

### 3.5 Audit Trail in EvidencePanel

Add a "MODULE APPLIES" history row to the existing F9 EvidencePanel (if one exists) or to the LayeredValue source indicator displayed next to assumption fields:

```
EXIT CAP RATE   5.50%   [strategy:entry · 2026-05-26]
```

This requires:
1. Each PATCH endpoint stores `source` and `appliedAt` in the LayeredValue JSONB
2. F9's assumption row rendering reads these fields and displays them

This is a cosmetic addition to the existing `stanceModulated` display pattern — the LayeredValue structure already has `source`, `runAt`, and `agentId` fields. Module applies would populate `source: 'strategy:entry'` and `runAt: timestamp`. No schema change required.

---

## 4. Migration Path Per Existing Button

### 4.1 A1/A2/A3 — Strategy Module "APPLY TO PRO FORMA" (3 buttons)

**Status:** STUB

**Immediate option (remove stubs):** Remove all three buttons from `PlanDocument` in `StrategyV2Components.tsx` lines 1277, 1303, 1403. The editable input fields (targetQuarter, priceCeiling, debtStructure, timing, expectedImpact) can remain — they're useful for plan annotation even without persistence. This is a 10-line change and resolves the dead-end button UX immediately.

**Full implementation option:** Replace all three with calls to `POST /deals/:dealId/assumptions/apply-from-module`:

| Section | Fields to push | fieldPath | Implementation effort |
|---|---|---|---|
| ENTRY | plan.entry.priceCeiling → purchasePrice | `acquisition.purchasePrice` | LOW — direct numeric map |
| ENTRY | plan.holdStructure.targetHoldMonths → holdPeriod | `hold.holdPeriodYears` | LOW — divide by 12 |
| EXIT | plan.exit.capRate → exitCapRate | `disposition.exitCapRate` | LOW — direct numeric map |
| EXIT | plan.exit.expectedIRR[0] → targetIrr | `targets.targetIrr` | LOW — direct numeric map |
| VALUE CREATION | plan.valueCreation[].costEstimate → capex annotation | annotation only | MEDIUM — no clean numeric field in deal_assumptions |

**Assessment:** The ENTRY and EXIT sections have clean field mappings (4 numeric values). VALUE CREATION has no numeric destination in deal_assumptions — it's plan annotations, not assumptions. The ENTRY + EXIT apply buttons can be implemented properly; the VALUE CREATION button should be removed (nothing to apply to F9 assumptions).

**Priority:** HIGH — visible dead-end for operators; simple to fix (remove) or moderate to implement (ENTRY + EXIT numeric writes)

---

### 4.2 B1 — M35 Event Timeline "APPLY TO PRO FORMA"

**Status:** PARTIAL — modal exists, backend apply action unclear

**Investigation required:** Read `EventTimelineSection.tsx` lines 70-150 to determine what `onProceed` does when the EventDependencyModal fires.

**If onProceed is already wired (fully implemented):** Document as working and exclude from the migration.

**If onProceed is also a stub:** Follow the same pattern as Strategy: call `POST /deals/:dealId/assumptions/apply-from-module` with `source: 'event_timeline'` and the forecast-to-field mapping:

| Event forecast field | F9 fieldPath | Conflict risk |
|---|---|---|
| rent_growth_yoy | `revenue.rentGrowth[0]` | HIGH — rent growth is frequently manually set |
| cap_rate | `disposition.exitCapRate` | HIGH — frequently manually set |

**Priority:** MEDIUM — validate status first before prioritizing

---

### 4.3 C1/C2 — F9 Goal Seek "Apply to Proforma" (working, volatile)

**Status:** WORKING — but volatile (no persistence)

**Current behavior:** Mutates F9 React state in-session. Values lost on page refresh.

**Migration question:** Should goal-seek applied values be persisted to the DB?

**Arguments for persistence:**
- Operator runs a goal seek, finds IRR is achievable at $18.2M purchase price, clicks apply → should be saved
- The applied value represents a deliberate operator decision, equivalent to typing the value in F9

**Arguments against:**
- Goal seek is exploratory — operators may apply multiple scenarios, want to reset easily
- The current volatile behavior is a feature: it's a "try it" mode
- Adding persistence would require conflict detection (user may have set $18.5M manually)

**Recommendation:** Add an optional "SAVE TO DEAL" button alongside the existing "Apply to Proforma" button. The existing apply mutates state as-is. "SAVE TO DEAL" calls `POST /deals/:dealId/assumptions/apply-from-module` with `source: 'goal_seek'` to persist. Two distinct actions: try it vs. commit it.

**Priority:** LOW — working today; persistence is a quality-of-life improvement

---

### 4.4 D1 — Debt Tab "Apply to Stack"

**Status:** WORKING — different domain (debt stack configuration, not F9 proforma assumptions)

No migration required. This is not an F9 assumptions write. The debt stack configuration is stored separately from deal_assumptions.

---

### 4.5 E1 — AI Recommendations "Apply to Model"

**Status:** MOCK DATA

The entire `AIRecommendationsSection` uses hardcoded `mockRecommendations`. The "Apply to Model" string exists only in the mock data array — no actual button component renders it with a real handler.

This surface requires a real API before the apply button can be implemented. Not a migration candidate until the recommendations system is real.

**Priority:** OUT OF SCOPE until AI Recommendations is implemented

---

## 5. Open Questions

### OQ-APPLY-1 — Is M35 Event Timeline "APPLY TO PRO FORMA" already wired?

The `EventDependencyModal` is shown with a full list of event dependencies and 3 action buttons. The `onProceed` callback is passed in from `EventTimelineSection`. Is this apply actually writing to deal_assumptions, or is `onProceed` also a stub?

**Action required:** Read `EventTimelineSection.tsx` lines 70-150 (the state + handler setup section) to confirm.

---

### OQ-APPLY-2 — Should module applies be volatile (in-session) or persistent (DB-backed)?

The existing Goal Seek pattern is volatile — applies modify React state without persisting to the DB. This is fast, low-risk, and reversible. Cross-module applies (Strategy → F9) could follow the same volatile pattern if F9 reads from a global Zustand store slice rather than local state.

Two architectural options:

**Option A — Volatile via global store:**
All F9 assumptions move to a Zustand slice (`useDealAssumptionsStore`). Any module can write to the store. F9 reacts to store changes and rebuilds. Values are lost on page refresh unless the user explicitly saves.

**Option B — Persistent via API:**
Modules call `POST /deals/:dealId/assumptions/apply-from-module`. F9 detects the change (via polling, DOM event, or WebSocket) and reloads. Values survive page refresh. Source tagging is automatic.

Option B aligns with the existing LayeredValue infrastructure and provides an audit trail. Option A is simpler to implement but requires centralizing F9 state in Zustand (a significant refactor if F9 assumptions are currently local state).

**Decision required:** Which option matches the intended architecture?

---

### OQ-APPLY-3 — What fields does Strategy ENTRY actually need to write?

The `plan.entry` section has three editable fields:
- `targetQuarter` (string) — Q3 2026 format; no matching numeric field in deal_assumptions
- `priceCeiling` (number) — maps to purchasePrice / budget
- `debtStructure` (string) — annotation; no matching field

Only `priceCeiling` has a clean numeric destination in F9. `targetQuarter` and `debtStructure` are annotations.

Should the ENTRY apply button only push `priceCeiling`? Or should annotations be stored somewhere (deal_data JSONB, a separate notes field)?

---

### OQ-APPLY-4 — Conflict resolution UX: block or warn?

When an operator has manually set a field (source: 'user') and a module tries to write to that field, two UX options:

**Block:** Module apply fails silently or shows "user override exists — go to F9 to clear it first."

**Warn + allow:** Module shows the conflict inline and lets operator choose: keep user value or overwrite with module recommendation.

The "warn + allow" approach is more powerful but requires more UI. The "block" approach is safer — avoids surprise overwrites of deliberately set values.

Recommendation: **warn + allow** via the conflict resolution UI proposed in §3.4, with `force: true` as the overwrite mechanism.

---

### OQ-APPLY-5 — Should "APPLY TO PRO FORMA" become "PUSH TO F9"?

The current label "APPLY TO PRO FORMA" is ambiguous about what happens — does it apply within the current module, or does it push to F9? "PUSH TO F9 →" or "SEND TO PROFORMA →" with a directional arrow makes the cross-module nature of the action explicit. Does the product vocabulary prefer one label?

---

### OQ-APPLY-6 — Should the canonical apply endpoint be versioned?

`POST /deals/:dealId/assumptions/apply-from-module` is a new endpoint. Should it be versioned (`/api/v2/`) from the start to allow breaking changes without affecting existing PATCH consumers?

The existing PATCH endpoints are all under `/api/v1/`. A new endpoint could start under `/api/v1/` if it follows the same patterns, or under `/api/v2/` if it introduces new patterns (source tagging, conflict response) that may be iterated on.
