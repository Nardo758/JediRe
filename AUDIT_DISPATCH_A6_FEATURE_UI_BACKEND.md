# A6 Audit — Feature↔UI↔Backend (Per Surface)

> **Audit domain:** Surface-level correctness — does every frontend feature have a working backend route, and does the UI render real data?
> **Status:** Dispatch written
> **Date:** 2026-06-25
> **Auditor:** Agent
> **Rule:** Read-only. Findings → fix backlog.

---

## Scope

Focus on **launch-gating surfaces only**. Per AUDIT_PROGRAM_INDEX §A6: if chat-first, web surfaces are fast-follow. We audit the core deal/financial surfaces that are actively used.

**Surfaces audited:**
1. **Deal Capsule** (F1–F12 tabs) — already partially covered by DC audit
2. **F9 ProForma / Financial Engine** — already partially covered by PF audit
3. **Asset Hub** — already partially covered by AH audit
4. **Chat surface** — covered by S1 audit

**New focus for this audit:** Cross-surface consistency — do features that span multiple surfaces (e.g., a deal field edited in F9 shows correctly in Asset Hub) stay in sync?

---

## Method

For each surface:
1. **Feature inventory:** List every feature/button/data element
2. **Backend trace:** For each, trace the API call to the backend route
3. **Data validation:** Is the data real or mocked? If mocked, is there a backend source?
4. **Cross-surface check:** Same data shown in multiple surfaces — do values match?

---

## Surface 1: Deal Capsule (Cross-Surface Check)

**Already audited:** DC-01 through DC-42 (structural + content gaps)
**New question:** If a user edits `rent_growth_pct` in F9 AssumptionsTab, does the same value appear in:
- Asset Hub PerformanceScreen?
- F5 Strategy tab sensitivity analysis?
- F8 Exit Timing convergence chart?

**Trace method:** Follow the field through deal_assumptions → per_year_overrides → getDealFinancials → mergedFinancials → each surface's props.

**Expected finding:** F9 uses `mergedFinancials` (live model). Asset Hub uses `f9Financials` (static GET). If the user hasn't run the model, they diverge. Document this as a design decision or a bug.

---

## Surface 2: F9 ProForma (Real-Time Model vs Static GET)

**Already audited:** PF-01 through PF-16
**New question:** The `mergedFinancials` useMemo in FinancialEnginePage.tsx:
- IF `modelResults === null` → clones `f9Financials` (static)
- IF `modelResults present` → merges model into financials (live)

This means the F9 tabs show **different data** depending on whether the user has run the model. The Returns tab shows `lpNetIrr` from `getDealFinancials` when `modelResults === null`, but from `model.summary.irr` when present. Is this divergence visible to the user? Is there a "Run Model" prompt?

**Trace method:** Check `ReturnsTab.tsx`, `ProFormaSummaryTab.tsx`, `DealTermsTab.tsx` for `modelResults` conditional rendering.

---

## Surface 3: Asset Hub (Live Data Sync)

**Already audited:** AH-1A through AH-5G
**New question:** Now that AH-1C has real debt data flowing, does the CapitalScreen refresh when the user updates debt terms in F9 DealTermsTab? Or does it require a page reload?

**Trace method:** Check if `CapitalScreen` has a `useEffect` dependency that triggers on deal changes, or if it caches data on mount only.

---

## Surface 4: Chat Surface (S1 Chain Verification)

**Already audited:** S1-01 through S1-07
**New question:** Post-S1-01 fix (Zod schema resolved), do research agents actually produce non-zero tokens? Check the most recent agent runs in the DB.

**Method:** Live DB query on `agent_runs` table for runs since 2026-06-21.

---

## Report Template

| Surface | Feature | Backend Route | Data Source | Mock? | Cross-Surface Match | Finding |
|---------|---------|--------------|-------------|-------|-------------------|---------|
| ... | ... | ... | ... | ... | ... | ... |

---

*END OF A6 DISPATCH. Halting for triage.*
