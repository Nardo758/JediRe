# MASTER SEQUENCE — Deal Pipeline Remediation (6 Dispatches, Ordered by Dependency)

**How to use:** execute in the numbered order. Each dispatch states its GATE at the top — do not start one until its gate is clear. QW-1 and QW-2 have no gates and go immediately. The two SPECs are design docs (author anytime, build later). D3-W2+ is the only one with a hard double-gate (CREATE-1 done AND F-P1 window clear).

| # | Dispatch | Type | Gate | Why here |
|---|----------|------|------|----------|
| 1 | QW-1 Capital-structure mock fix | code, fast | none — go now | Live bug: real deals may render mock `defaultCapitalStack`. Independent. |
| 2 | QW-2 `origin_class` DB migration | migration, small | none — go now | Makes origin real in DB before anything keys off it. Prereq for CREATE-1. |
| 3 | CREATE-1 Create-path materialization | build arc | QW-2 done | Property link + real assembly + `deal_assumptions` at create + origin set. The foundation D3 needs. |
| 4 | D3-W2+ Agent seam resume | build | CREATE-1 done AND F-P1 window clear | Agent writes need a materialized row (CREATE-1) and the overlay write-path free (window). |
| 5 | SPEC OM Extraction | design doc | none (author now, build later) | Full architecture — classify→locate→extract. Hardest problem, design while fresh. |
| 6 | SPEC Multi-Year History Capture | design stub | none (author now, build later) | BPI series + OM appendix. Partly shaped by OM spec output. |

**Critical fence:** #4 is the one that bites if rushed. The whole reason this batch exists is the audit finding that agent writes are invisible on fresh deals. #4 must NOT run until #3 gives it a real deal-state. Both #3-gate and window-gate stated in the #4 dispatch.

**Files (this batch):**
- `DISPATCH_QW1_CAPSTRUCT_MOCK_FIX.md`
- `DISPATCH_QW2_ORIGIN_CLASS_MIGRATION.md`
- `DISPATCH_CREATE1_MATERIALIZATION.md`
- `DISPATCH_D3_W2_RESUME.md`
- `SPEC_OM_EXTRACTION.md`
- `SPEC_MULTIYEAR_HISTORY_CAPTURE.md`

Source audits: `docs/audits/DEAL_CREATION_PIPELINE_AUDIT.md`, `docs/audits/SOURCE_TO_CAPSULE_PIPELINE_AUDIT.md`.
