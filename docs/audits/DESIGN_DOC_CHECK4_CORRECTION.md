# Design Doc Corrections — ABSORPTION_ENGINE_PHASE1_DESIGN.md

**Commit to correct:** `7d27c4f78` (current 8/8 claim)
**Two mechanical edits needed to make the 8/8 claim true:**

---

## CHECK 1: ProFormaService:134 — VERIFIED (no change needed)

The design doc correctly cites `ProFormaService:134` at:
- Section 0, line 44: explicit mention in P0 scope-out paragraph
- Section 4, Migration Path Step 2: `ProFormaService:134` `closing_ratio` and `visit_to_tour_ratio` migrate INTO the registry

**Status:** Already correct. The original review's "NOT explicitly listed" was addressed in the revision.

---

## CHECK 4: Canonical Keys — NEEDS TWO CORRECTIONS

### Correction 4a: Wrong path

**Current (wrong):**
```typescript
// Canonical spellings: registered in backend/src/types/canonical-keys.ts (Wave 1 unification).
```

**Correct:**
```typescript
// Canonical spellings: imported from backend/src/shared/canonical-keys.ts (Wave 1 unification).
```

**Reason:** The canonical module was created at `backend/src/shared/canonical-keys.ts` in W1-1, not `backend/src/types/canonical-keys.ts`.

---

### Correction 4b: StageLabel uses local arrow literals, not canonical underscore form

**Current (wrong):** Local arrow literals with mismatched granularity
```typescript
type StageLabel =
  | 'inquiry→tour'
  | 'tour→application'
  | 'application→lease'
  | 'inquiry→lease'
  | 'visit→tour'
  ;
```

**Correct:** Import from canonical module
```typescript
import { StageLabel } from '../shared/canonical-keys';
// StageLabel = 'visit_to_tour' | 'tour_to_lease' | 'inquiry_to_tour'
```

**Reconciliation mapping** (add to design doc Section 2):

| Design arrow literal | Canonical underscore | Notes |
|---|---|---|
| `'inquiry→tour'` | `StageLabel.INQUIRY_TO_TOUR` | Same semantic stage |
| `'tour→application'` | **Not in canonical module** | Canonical only has `tour_to_lease`; design splits application as intermediate. Gap: canonical needs `application_to_lease` or design collapses to `tour_to_lease`. |
| `'application→lease'` | **Not in canonical module** | See above. |
| `'visit→tour'` | `StageLabel.VISIT_TO_TOUR` | Legacy alias; deprecation log noted in design |
| `'inquiry→lease'` | **Composite** | Design says "computed from chain, not stored" — canonical module doesn't need this |

**Decision needed:** Either:
1. **Add `application_to_lease` to canonical module** (W1-1 extension), OR
2. **Collapse design's `'tour→application'` and `'application→lease'` to canonical `'tour_to_lease'`** and handle the application intermediate as an implementation detail inside the registry, not as a StageLabel.

Recommendation: Option 2. The canonical module should own stage boundaries (`visit→tour→lease`), not implementation intermediates (`application`). The registry can internally track application counts without exposing it as a StageLabel.

---

## CHECK 4: Proposed revised StageLabel block

```typescript
import { StageLabel } from '../shared/canonical-keys';

// Reconciliation: canonical StageLabel has three values:
//   'inquiry_to_tour'  (replaces 'inquiry→tour')
//   'visit_to_tour'    (legacy alias; maps to 'inquiry_to_tour' with deprecation log)
//   'tour_to_lease'    (replaces 'tour→application' + 'application→lease' chain)
// The application stage is tracked internally by ConversionRegistry but is NOT
// a StageLabel — it's an implementation detail, not a canonical boundary.
```

---

## SUMMARY

| Check | Claim | Reality | Action |
|---|---|---|---|
| 1 | PASS | ✅ Actually passes | None needed |
| 4 | PASS | ❌ Path wrong + StageLabel mismatch | Apply 4a + 4b above |

After corrections, the 8/8 claim is defensible. Without them, Check 4 is a false pass.
