TASK: Verify current Engine A and M07 behavior for five fields that
should anchor to deal-specific reality (rent roll, lease expirations,
actual occupancy) rather than submarket baselines or portfolio
shortcuts. Read-only audit, single output document. No code changes.

CONTEXT
The calc-vs-assumption doc is being revised to describe how GPR,
loss-to-lease, other income, vacancy, and M07 occupancy projections
should anchor to deal-level data (per-unit lease expirations from
deal_lease_transactions; current rent roll occupancy) rather than
portfolio-level math or submarket baselines. Before treating that
as the canonical description, we need to know what the platform
actually does today.

The Deal Details audit (DEAL_DETAILS_DATA_AUDIT.md) is the foundation
for this check — 464 Bishop has 260 lease transactions in
deal_lease_transactions with lease_end populated, so the data exists.
Question is whether Engine A and M07 use it.

The pattern matters beyond any single field. If Engine A and M07 both
use submarket/portfolio shortcuts, the platform's analytics are
running on generic-deal proxies rather than deal-specific reality.
This audit surfaces whether the shortcut pattern is consistent or
hybrid, and the architectural decision (commit to deal-anchored
math vs accept submarket-baseline shortcuts) follows the findings.

═══════════════════════════════════════════════════════════════════════════
WHAT TO PRODUCE
═══════════════════════════════════════════════════════════════════════════

A single document: /tmp/engine-a-lease-roll-audit.md

For each of the five fields below, document:
  - The exact computation Engine A (or M07 for field 5) performs (cite file:line)
  - What data sources it reads from
  - Whether it uses deal-specific data (per-unit lease expirations,
    actual rent roll occupancy) or portfolio/submarket averages
  - What it does when deal-specific data is missing or incomplete
  - The actual computed values for 464 Bishop (test deal:
    3f32276f-aacd-4da3-b306-317c5109b403)

═══════════════════════════════════════════════════════════════════════════
THE FIVE FIELDS
═══════════════════════════════════════════════════════════════════════════

1A — GPR Year 1
  File trail: trace from getDealFinancials() in
    proforma-adjustment.service.ts through the GPR computation step
  Specific questions:
    - Does the computation iterate over individual units from a rent
      roll source (deal_lease_transactions, year1.unit_mix, or
      similar), or compute (market_rent × units × 12) at portfolio
      level?
    - If per-unit: where is the in-place contract rent read from?
      Where is the lease_end date read from? At lease expiration,
      what market rent does the unit re-rent at?
    - If portfolio-level: where does market_rent_per_unit come from?
      Is it from year1.gpr.resolved divided by units, from
      year1.market_rent_per_unit, or from elsewhere?
    - What value does it produce for 464 Bishop Year 1?
    - How does that value compare to: (a) the OM extraction GPR
      ($4,901,400 per audit), (b) the T12 GPR ($4,876,535), (c) the
      rent roll GPR ($4,932,300)?

1B — GPR Year 2 through Year N (projections)
  File trail: the projections loop in proforma-adjustment.service.ts
    (per audit, line ~3278)
  Specific questions:
    - Does Year N+1 GPR compute by escalating Year N GPR by rent
      growth (portfolio-level compound), or by iterating individual
      units' lease rolls?
    - Where does the rent growth scalar come from?
      proforma_assumptions.rent_growth_current?
    - Does the per_year_overrides path (per_year_overrides['gpr:yrN'])
      get read on each projection year, or ignored?
    - Confirm CF-02 from the deal details audit: are operator edits
      to individual projection years actually being respected?

2 — Loss-to-Lease
  Specific questions:
    - Is loss-to-lease computed as the per-unit gap between in-place
      contract rent and market rent, summed across units?
    - Or is it stored/read as a portfolio percentage (year1.
      loss_to_lease_pct.resolved) applied to GPR?
    - If percentage-based: where does the percentage come from? Is
      it computed from rent roll data, extracted from T12, or
      operator-entered?
    - What value does Engine A use for 464 Bishop?

3 — Other Income (per unit)
  Specific questions:
    - Is other_income computed as a per-unit dollar amount × units ×
      12 (the portfolio shortcut)?
    - Or does it scale at lease-roll dates (i.e., does it grow over
      time tied to individual unit re-leasing)?
    - Where does the per-unit dollar amount come from? Rent roll,
      T12, OM?
    - Does it have its own growth rate, or does it inherit GPR's
      rent growth rate?

4 — Vacancy Timing (Engine A consumption)
  Specific questions:
    - Is vacancy applied as a flat percentage (year1.vacancy_pct ×
      GPR) for Year 1, or does it produce a monthly trajectory based
      on lease expirations and absorption?
    - For projection years: does vacancy follow a curve based on the
      M07 traffic projection, or does it stay flat at the proforma_
      assumptions.vacancy_current value?
    - Where does the M07 traffic projection feed into the vacancy
      computation, if at all?
    - What value does Engine A use for 464 Bishop?

5 — M07 Occupancy Baseline Source (M07 input — NEW)
  File trail: trafficPredictionEngine.ts and related services
  Specific questions:
    - When M07 produces the absorption/occupancy projection that
      feeds Engine A's vacancy (field 4 above), what does it use as
      the starting occupancy condition?
    - Options to verify against:
        (a) The deal's actual rent roll occupancy (computed from
            deal_lease_transactions filtered for currently-occupied
            units, or from year1.vacancy_pct.resolved inverted, or
            from a rent_roll occupancy column)
        (b) A submarket baseline occupancy from apartment_market_
            snapshots, costar_submarket_stats, or similar
        (c) A flat platform default (e.g., 95%, 92%)
        (d) Operator-entered value in deal_assumptions
    - Where in the code is this starting condition read?
    - For 464 Bishop specifically: what starting occupancy did M07
      use for the most recent snapshot? Does it match the actual
      rent roll occupancy?
    - If M07 starts from a submarket baseline rather than rent roll:
      does it surface this in the snapshot output (so consumers know
      the projection isn't deal-anchored), or is the source silent?

6 — Fallback Behavior (renumbered from original #5)
  When the data needed for deal-anchored math is missing or
  incomplete, what does the platform do? Specifically:
    - If deal_lease_transactions is empty for a deal, does Engine A
      fall back to portfolio-level math silently, or does it surface
      an error/warning?
    - If lease_end dates are NULL on some units, does Engine A
      compute lease-roll for the ones with dates and portfolio-level
      for the others?
    - If rent roll occupancy can't be computed (no transaction data,
      or no occupancy column populated), what does M07 fall back to?
    - Is there a feature flag, a settings toggle, or an inferable
      "compute mode" that determines which math is used?

═══════════════════════════════════════════════════════════════════════════
ARCHITECTURAL PATTERN QUESTION
═══════════════════════════════════════════════════════════════════════════

After auditing all five fields plus fallback, characterize the overall
pattern:

  Across these five fields, is the platform consistently anchoring to
  deal-specific reality (rent roll, lease expirations, actual
  occupancy), consistently using portfolio-level / submarket-baseline
  shortcuts, or hybrid? If hybrid, where is the inconsistency?

This question gets at the architectural commitment underneath the
individual field findings. If the answer is "consistently shortcut,"
the architectural decision is whether to commit to deal-anchored math
across the board (richer, more accurate, more data-intensive) or
accept the shortcut pattern as the platform's design. If hybrid, the
question is whether the inconsistency is intentional (some fields
have richer data than others) or accidental (different engineers
implemented different patterns over time).

═══════════════════════════════════════════════════════════════════════════
INVESTIGATION METHOD
═══════════════════════════════════════════════════════════════════════════

1. Open proforma-adjustment.service.ts at the entry point of
   getDealFinancials()
2. Trace each of the four Engine A field computations through the code
3. Open trafficPredictionEngine.ts and trace the starting condition
   for the absorption/occupancy projection
4. For each computation, identify:
   - The SQL queries it triggers (note the source tables)
   - The transforms it applies (note formulas explicitly)
   - The fallback behavior (what happens when inputs are NULL)
5. Run the actual functions on 464 Bishop's data and report the
   computed values
6. Compare computed values to what's stored in year1[field].resolved
   to verify the read paths match
7. For M07: confirm the most recent deal_traffic_snapshots row for
   464 Bishop and verify what starting occupancy produced it

═══════════════════════════════════════════════════════════════════════════
SPECIFIC THINGS TO SURFACE
═══════════════════════════════════════════════════════════════════════════

Beyond the per-field documentation:

- If deal-anchored math is implemented but only partially (e.g., GPR
  uses it but loss-to-lease doesn't), call out the asymmetry
  explicitly
- If the portfolio-level / submarket-baseline math is used everywhere,
  note this as the current state without judgment (the architectural
  correction is a separate decision)
- If there's a third pattern not anticipated above (e.g., unit-mix-
  based escalation that uses unit_mix JSONB rather than per-unit
  lease transactions, or M07 using a hybrid of submarket baseline
  with deal-level adjustment), document it
- Per CF-02, confirm whether per_year_overrides are being read on
  projection years for these fields specifically (the audit said
  they're stored but ignored across the board)
- For the M07 traffic projection input to vacancy (field 4): trace
  whether deal_traffic_snapshots is actually being read by Engine A
  or whether it's an unrelated surface
- For M07's starting occupancy (field 5): if it uses submarket
  baseline, note which submarket data source is read (apartment_
  market_snapshots? costar_submarket_stats? costar_market_metrics?)

═══════════════════════════════════════════════════════════════════════════
OUT OF SCOPE
═══════════════════════════════════════════════════════════════════════════

- Don't fix anything you find. This is observation only.
- Don't recommend the correct architecture. The architectural decision
  follows the audit findings.
- Don't audit fields beyond the five listed (NOI, EGI, etc. are
  computed downstream and inherit whatever GPR/OpEx logic feeds them;
  audit those five directly)
- Don't audit M07's overall accuracy or methodology — only the
  starting condition (field 5) and its consumption by Engine A
  (field 4)

═══════════════════════════════════════════════════════════════════════════
DELIVERABLE
═══════════════════════════════════════════════════════════════════════════

/tmp/engine-a-lease-roll-audit.md

Structure:
1. Executive summary
   - For each of the five fields: "deal-anchored" / "portfolio-or-
     submarket-shortcut" / "hybrid" / "other"
   - Overall architectural pattern characterization
   - Fallback behavior summary
   - Whether per_year_overrides are respected for these fields
2. Per-field documentation (1A, 1B, 2, 3, 4, 5)
3. Fallback behavior section (6)
4. Architectural pattern question — answer with citations
5. 464 Bishop computed values for each field
6. Architectural implications surfaced (asymmetries, hybrid
   patterns, surprises)

═══════════════════════════════════════════════════════════════════════════
TIMELINE EXPECTATION
═══════════════════════════════════════════════════════════════════════════

This is a focused audit — five fields plus fallback behavior and the
architectural pattern question. Should complete in 1-2 days. If it
surfaces complications that materially expand scope (e.g., the five
fields turn out to have completely different patterns and each needs
its own deep investigation), surface the scope expansion rather than
truncating.

Per CLAUDE.md P8: state-verify every claim against live code and live
data, not against documentation or prior assumptions. The Deal Details
audit established that 464 Bishop has 260 lease transactions with
lease_end populated — confirm this before running computations against
that deal.
