# INPUTS Tab Source-of-Truth Principle — One Editable Surface Per Concept

**Status:** Accepted · Implemented May 2026

## Context

The INPUTS tab accumulated triple-home duplicates: `stabilizedOcc`,
`loss_to_lease_pct`, and `concessions_pct` were each editable in multiple
surfaces simultaneously — General Section 5A, General Section 5B, and their
respective Leasing Category (A, C, D). Operators could edit the "wrong" surface
and see no effect, because a different surface held the authoritative value and
silently overrode the edit on the next fetch cycle.

The problem has the same shape as the Purchase Price dual-write bug: two edit
surfaces, one backing field, last write wins, no provenance, no clear winner.
The specific duplicates were identified during the General tab inventory audit
that preceded Tasks #628 and #629 — see
`docs/architecture/INPUTS_TAB_SECTION_AUDIT.md` for the full field-level inventory.

## Decision

**One editable surface per concept.**

For leasing-related fields, the LEASING sub-tab owns the editable driver. The
GENERAL sub-tab displays resolved Pro Forma Year 1 outputs as read-only values.

Read-only appearances of a field in a non-authoritative surface use the
**cross-reference pattern**: each read-only row carries a description string
pointing operators to the authoritative edit location. No silent mirrors without
navigation guidance.

### Categorization Boundary Rule

Codified in `frontend/src/config/leasing-fields.config.ts:15–18`:

> "Does this assumption affect leasing velocity, occupancy, or rent capture?"
> YES → Leasing tab. NO → General tab.

Applied categorization:

| Field class | Home tab | Examples |
|---|---|---|
| Leasing-driven | **LEASING** | Vacancy, LTL, concessions, stabilized occupancy, renewal rate, bad debt |
| Macro escalators | **GENERAL** | CPI, expense growth, rent growth baseline |
| Deal facts | **DEAL TERMS** | Purchase price, hold period, exit cap rate |

Bad debt is Leasing (revenue-side, M22 pipeline same as renewal rate).

## Consequences

- One write path per concept. No silent shadowing or last-write-wins races.
- Visual cross-references make navigation explicit — operators don't need to
  discover the correct surface by trial and error.
- Future fields follow the same process: apply the categorization question before
  any UI work begins.
- `leasing-fields.config.ts` is the authoritative list for every editable
  leasing field. Adding a field there is a deliberate commitment to validation
  rules, default sources, tooltip content, and tier classification.

## Implementation

| Location | Role |
|---|---|
| `frontend/src/config/leasing-fields.config.ts:5–9` | `EDITABILITY-IS-INTENTIONAL RULE` — a field becomes editable only when it appears in this config; bypassing it is forbidden |
| `frontend/src/config/leasing-fields.config.ts:15–18` | Boundary rule prose — the categorization question |
| `frontend/src/config/leasing-fields.config.ts:805–807` | `LEASING_CATEGORIES` export — single ordered list (A → J); `LeasingAssumptionsTab.tsx:21` imports and renders from this only |
| `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx:15` | `SECTION5_MIGRATION_MAP, LEASING_FIELDS_BY_PATH` imports — migration map drives which General rows are readonly mirrors |
| `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx:552` | Readonly mirror of stabilized occupancy — description: `"Read-only mirror of the LEASING tab canonical value (Cat A — Target stabilized occupancy). To override, edit in INPUTS → LEASING → Cat A."` |
| `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx:636` | Readonly mirror of LTL — description: `"Read-only mirror of the LEASING tab LTL driver (Cat C — Loss-to-lease %). The canonical % driver and LTL decay rate live in INPUTS → LEASING → Cat C."` |
| `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx:646` | Readonly mirror of concessions — description: `"Read-only resolved concession rate derived from LEASING Cat D inputs. Edit concession assumptions in INPUTS → LEASING → Cat D."` |
| `frontend/src/pages/development/financial-engine/LeasingAssumptionsTab.tsx:7` | Architectural rules header — `EDITABILITY-IS-INTENTIONAL` and `TIER-DEFAULTS-PROTECT-USERS` rules re-stated in the consuming component |

## Open Follow-Ups

- **Spot-check pass on formerly-duplicated fields.** Tasks #628/#629 completed the
  structural work. A final pass confirming `stabilizedOcc`, `loss_to_lease_pct`,
  and `concessions_pct` are now `readonly: true` in every General Section 5A/5B
  row definition (and editable only in Leasing Categories A, C, D) would formally
  close the audit. The cross-reference descriptions at `AssumptionsTab.tsx:552,636,646`
  are already in place; verification is the remaining step.
- See `docs/architecture/INPUTS_TAB_SECTION_AUDIT.md` — the field-level inventory
  doc that identified the duplicates and preceded this decision.

## Related Decisions

- Pattern is consistent with the LayeredValue single-resolution approach in
  `docs/architecture/STRATEGY_FIELDS_LV_PATTERN.md` — same principle (one source
  of truth per concept) applied at the UI layer instead of the data layer.
- `docs/architecture/OPERATOR_STANCE_PHASE1_SPEC.md` — the same categorization
  principle governs why `leasingCostTreatment` moves to the StanceTab in Phase 2
  rather than remaining on the AssumptionsTab toggle.
