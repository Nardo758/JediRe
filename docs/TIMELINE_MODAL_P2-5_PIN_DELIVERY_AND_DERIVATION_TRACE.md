# DISPATCH — Timeline Modal P2-5: Pin Delivery Fix + Bishop Series Derivation Trace

**Arc:** Proforma Timeline — follows `TIMELINE_MODAL_P2-4_CRASH_HOTFIX_CHART_FIRST.md`
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Status:** Crash fixed (hooks violation, confirmed dead). CHART-first confirmed. P2-0 inline defect closed by observation. **P2-3 blocker #4 FAILED by observation:** Bishop's chart rendered with ZERO pins and the M35 legend still greyed — the 16 events never reached the chart. Additionally, the rendered series exposed a derivation-integrity problem (P2-5b).
**Fix authority:** P2-5a carries fix authority (plumbing). **P2-5b is READ-ONLY with a hard STOP — no seeder or derivation code may be edited in this dispatch.**
**Standing rule (S1-01):** browser-observed evidence for anything user-facing; live DB output for anything data. A ts-node probe against the DB is not proof the HTTP route delivers — that gap is exactly what P2-5a exists to close.

**Operator-observed screenshot facts (ground truth for this dispatch):**
- X-axis 2017 → 2028; actuals zone ends at boundary 2018-07-01; actual NOI ends ≈ $66k/mo
- Projection: flat line ≈ $1.3M/mo from boundary to 2028 — a ~20× step discontinuity at the boundary, zero trend
- No actual-zone rendering anywhere right of 2018-07, despite 12 raw rows of 2026 data existing
- Zero pins; M35 legend badge greyed (events.length === 0 at the chart)

---

## P2-5a — PIN DELIVERY: trace the browser path, fix, prove (FIX AUTHORITY)

The endpoint returned 16 events under ts-node. The browser got zero. Find where the chain breaks — **walk it in order, paste evidence at each hop, stop at the first break:**

1. **Did the fetch fire?** Open Bishop's modal with devtools Network tab. Paste: the request URL as actually sent, method, status code, and response body. If NO request appears → the modal's `useEffect` isn't firing (check `isOpen`/`dealId` deps, conditional guards); fix there.
2. **If fired and non-200:** which failure?
   - 401/403 → auth: is the fetch sending session credentials the same way `usePeriodicData`'s fetch does? Compare the two call sites line-by-line (`credentials`, headers, base URL). Also check `assertDealOrgAccess` — is Bishop in org `dd201183`, and does the session org match? Paste the org check inputs.
   - 404 → route mismatch: paste the mounted path from `routes/index.ts` vs. the fetched path. Watch for double-prefix (`/api/v1/deals/deals/...`) or missing `/api/v1`.
   - 500 → paste the backend stack.
3. **If 200 with events but chart shows none:** the break is modal→chart. Paste the response body, then the prop chain: fetch result → state → `<PeriodicChart events={...}>`. Check shape mismatch (e.g. response is `{events: [...]}` but state stores the wrapper object), stale closure, or the fetch resolving after an unmount/close.
4. **Fix at the broken hop.** No shotgun changes at hops that tested clean.
5. **Prove:** screenshot of Bishop's chart with pins rendered and M35 legend active, plus the Network tab entry (200, 16 events) in the same session. Count pins on screen; report the exact number vs. 16. If pins overlap into uncountability, report as render-quality finding with the count from the DOM (`document.querySelectorAll` on the pin element) pasted.
6. **Empty path unchanged:** Highlands modal — still `no_geography_resolved` badge, zero pins, no crash. Screenshot.

## P2-5b — BISHOP SERIES DERIVATION TRACE (READ-ONLY — HARD STOP BEFORE ANY FIX)

The rendered series contradicts the timeline spec (§3: projection must derive from last actual + assumption trends; §zone rules: every month with a real observation is `actual`). Trace what the seeder actually did with Bishop's 24 raw rows. **No code edits, no reseeds, no data writes.**

1. **Raw rows, verbatim:** `SELECT report_month, <noi/egi columns> FROM <monthly actuals table> WHERE deal = Bishop ORDER BY report_month;` — paste all 24. Confirm the split (12 × 2017-08→2018-07, 12 × 2026-01→12) and paste the actual NOI values of the 2026 rows. Are they ≈ $1.3M/mo? Are they plausibly monthly, or do they look like annual figures landed in monthly slots (~12× too large — the known bug family)?
2. **Derived series, verbatim:** dump `periodic_seed.fields.noi` for Bishop — all 135 points with `month`, `value`, `zone`. Paste (or attach as file if long). Answer from the dump, not from code reading:
   - What zone are the 2026 months tagged? (Screenshot says they render as projection — confirm in data.)
   - What value do the 2018-08→2025-12 gap months carry, and where did it come from?
   - Is the flat ≈$1.3M projection value traceable to the 2026 rows, an assumption default, or something else?
3. **Boundary:** paste `periodic_seed.boundary` for Bishop. The chart shows 2018-07-01. Per spec, with 2026 actuals existing, `actuals_through_month` should be 2026-12. Which is stored, and what wrote it?
4. **Seeder path attribution:** identify (file:line, read-only) the code path that (a) assigned zones, (b) filled the gap, (c) set the boundary — for Bishop's specific ingest (manual ingest path). Name the responsible function per defect; do not fix.
5. **Blast radius:** run the same three checks (zone tags vs raw actuals, boundary vs last actual, step discontinuity at boundary) for the other seeded deals — Highlands, Frisco, McKinney at minimum. One-line verdict each: CLEAN / SAME DEFECT / DIFFERENT DEFECT, with the one query output that proves it. Highlands passed its numeric checks in P1 but was never checked for this specific failure mode.
6. **Report and STOP.** Findings table: defect → evidence → responsible code path → affected deals. **No fix proposals executed. Fix dispatch will be issued separately after operator review.**

## ACCEPTANCE
| # | Item | Evidence |
|---|---|---|
| 1 | Pin break located at a specific hop | Network/console/code evidence at the failing hop |
| 2 | Pins render on Bishop, M35 legend active | Screenshot + Network 200 same session |
| 3 | Pin count exact vs 16 | On-screen count or DOM count pasted |
| 4 | Highlands empty path unchanged | Screenshot |
| 5 | Bishop raw vs derived reconciled | 24 rows + 135-point dump pasted |
| 6 | Zone/boundary/gap/flat-projection each attributed to a code path | file:line per defect, read-only |
| 7 | Blast radius across all seeded deals | Verdict + proof query each |

**Blockers: 2, 5, 6. P2-5b ends at the STOP — any seeder edit in this dispatch is itself a dispatch failure.**

## OUT OF SCOPE
- Any seeder/derivation/zone-assignment fix (next dispatch, after review)
- Reseeding or mutating Bishop's data
- Submarket band, interventions, event→curve modeling, lifecycle wiring
- `PeriodicGrid.tsx` internals

**Run P2-5a to completion. Run P2-5b to the STOP. Report both.**
