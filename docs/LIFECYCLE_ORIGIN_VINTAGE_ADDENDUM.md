# SPEC ADDENDUM — Deal Lifecycle: Origin Classes & Projection Vintages
**Status:** Approved design (operator sign-off 2026-07-02) · Addendum to Deal Lifecycle ↔ Timeline Alignment Spec (phases A–H)
**Related:** `PROFORMA_TIMELINE_MODEL_SPEC.md`, `HISTORICAL_OBSERVATIONS_SPEC.md`, M22 post-close calibration, Correlation Engine Phase 1B

---

## 1. Core rulings

**R1 — Actuals never live in lifecycle state.** `deal_monthly_actuals` (surfaced via the console: AssetHub / Live Tracking) is the sole home of operating actuals: ingested monthly, mutable, alive. Lifecycle state stores no copy. Rationale: a second actuals store is the same defect class as the `deals.actuals_through_month` sibling-column drift found 2026-07-02.

**R2 — The lifecycle pins projection vintages.** Lifecycle transitions are the events that FREEZE projections. There are two projection artifacts, previously conflated:
- **Living proforma** — the periodic seed, rebased as actuals arrive (`deriveProjectionForSeed`). Console-owned. Expected to change. "Staleness" of a living seed is a rebase trigger, not corruption.
- **Vintage** — the projection as-of-a-decision. Immutable once pinned. The Bishop stale-seed bug exists only because nothing distinguished these; after this addendum, both behaviors are correct in their own artifact.

**R3 — Phase H derives, never stores, the comparison.** The archive event (→ Sold/Archived) computes vintage-vs-realized from `deal_monthly_actuals` + the pinned vintage, and freezes the resulting comparison artifact as part of the immutable historical record. Nothing is lost at archive; nothing is duplicated before it.

## 2. Origin classes

New column: `deals.origin` — enum, set at creation, immutable.

| origin | Entry point | Phases A–E | Vintage source | Phase H claim |
|---|---|---|---|---|
| `platform_underwritten` | Prospect / Underwriting | Real, walked | Auto-pinned at commit transition | Full: tests JediRE underwriting |
| `owned_import` | Directly at Owned/Operate (Highlands, Frisco, McKinney) | Rendered **pre-platform** (greyed, honestly absent, never fabricated) | (a) user-uploaded original underwriting (provenance-tagged, `column_basis` discipline applies) or (b) **onboarding baseline** — proforma snapshot auto-generated at import, labeled `as-of-onboarding`, never presented as underwriting | Partial: tests projection engine only |
| `archive_import` | Directly at Sold/Archived (Bishop) | Pre-platform ribbon + whatever real actuals segment exists | Only if user-supplied; else none | Historical actuals record; comparison only with supplied vintage |

**Onboarding baseline default: auto-generated at import** (maximizes calibration substrate; labeling prevents misrepresentation). Configurable off per org later if generation cost warrants — not a launch concern.

## 3. Vintage pinning — schema & semantics

New table `deal_projection_vintages`:
- `id`, `deal_id`, `vintage_type` (`underwriting` | `onboarding_baseline` | `user_supplied`), `pinned_at`, `pinned_by`
- **Inputs (version-inputs invariant):** `assumption_set_snapshot` (full `deal_assumptions` at pin time), `data_snapshot_hash`, `analysis_date`, `seeder_version`
- **Materialized output:** the derived projection series at pin time. Justified exception to derive-not-store: an immutable record must survive seeder code evolution; inputs are retained for audit/re-derivation, the materialization is the artifact of record. Same exception class as Phase H archives.
- Rows are append-only. No update path. A re-underwrite pins a NEW vintage; prior vintages remain.

**Pin triggers:**
- `platform_underwritten`: the Underwriting → Committed/Closed lifecycle transition pins `underwriting` automatically. Configures-never-gates: a missing pin blocks nothing in the deal's operation; it degrades Phase H's claim (recorded as such).
- `owned_import`: import completion pins `onboarding_baseline` (or registers user upload as `user_supplied`).
- `archive_import`: no auto-pin.

## 4. Phase H — the historical record & comparison artifact

At archive transition, derive and freeze `deal_outcome_records`:
- Realized series (from `deal_monthly_actuals`, verbatim reference by month range — not copied rows)
- Vintage reference + per-month variance (NOI, EGI, opex), stabilization timing vs projected (where applicable), terminal metrics
- `origin` and `vintage_type` carried onto the record

**Calibration weighting (binding on consumers):** M22 and CE-1B MUST weight by provenance — `platform_underwritten`+`underwriting` vintage = full-weight underwriting outcome; `onboarding_baseline` comparisons test only the projection engine; `user_supplied` vintages are third-party claims (Lane B rules apply if sourced from licensed docs). No consumer may pool these as equivalent observations.

## 5. Card rendering rules
- One card per deal regardless of origin; `origin` drives segment rendering.
- Pre-platform phases: greyed, labeled `pre-platform` — never synthesized, never inferred.
- Vintage pins render as markers on the ribbon (pin date + vintage type).
- Gap zones (per seeder fix) render amber on the card ribbon identically to the chart.
- Empty ≠ error: an `archive_import` card with only an actuals segment is complete and honest.

## 6. Out of scope (this addendum)
- Implementation dispatches (separate; schema first, then pin triggers, then Phase H derivation, then card rendering)
- Reseed/rebase policy for living seeds on assumption change (parked: version-inputs violation noted 2026-07-02)
- CE-1B stabilization schema (still blocked per its own track; this addendum supplies its future provenance dimension)
- Multi-vintage comparison UX (v2)

## 7. Resolution of open items this addendum closes
- "Should actuals join the lifecycle?" → No (R1); archive comparison preserved via R3.
- "Cards for non-underwritten / already-owned assets?" → §2 origin classes.
- Bishop stale-seed class → living-vs-vintage split (R2); living seeds rebase freely.
