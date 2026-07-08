# DISPATCH — DEAL-SCOPED CORRELATION SWEEP + CoStar COVERAGE MAP (Bishop)

**Why:** I1-EXTENSION proved the owning deal *can see* its CoStar rows, and correctly excluded them from the GLOBAL sweep (`Seeded 4209, skipped 4746`). But nothing has *computed* Bishop's deal-scoped correlations from them — so the data is contained but unused. This dispatch does the missing half (compute deal-scoped signals) and then reads what came out (coverage map), so the operator learns whether this CoStar upload is rich enough to matter before D3 builds on it.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. Requires real DB.
**Deal:** Bishop `3f32276f-aacd-4da3-b306-317c5109b403` (the only deal with CoStar lineage — 125 `costar_submarket_stats` rows, 23,488 `metric_time_series` rows, all attributed).
**Standing rules:** S1-01 pasted live output · scope discipline: deal-scoped outputs stay deal-scoped (derivation-chain rule) · no licensed-data content in the report — report METRIC NAMES and COUNTS, never CoStar values.

## S1 · Deal-scoped correlation sweep (the missing half)
1. **Design check first (report before building):** does the correlation engine support a deal-scoped sweep today (a `dealId` parameter path that computes and STORES results scoped), or does it only do GLOBAL? If deal-scoped storage doesn't exist: the outputs table (`metric_correlations`) already carries `scope_id`/`redistribution_restricted` — propose the minimal shape (`scope_id = 'deal:3f32276f'`, `redistribution_restricted = true`) and confirm before writing.
2. **Run the sweep for Bishop** with his CoStar rows INCLUDED (the read-gate passes because dealId matches). Store outputs deal-scoped + restricted (derivation-chain rule: restricted input ⇒ restricted output).
3. **Paste:** how many correlations computed for Bishop, how many of those *depended on* CoStar-lineage inputs (i.e. would not exist in the GLOBAL sweep), and confirm none of them are readable by a non-Bishop query (one negative proof, same shape as E3.2).
4. **Guard check:** a deal-scoped restricted correlation must never be promoted into GLOBAL. Confirm no write path does that (grep + one attempted-promotion forced-failure if a path exists).

## S2 · Coverage map (read-only, the operator's actual question)
**Question: what does Bishop's CoStar data contain, and which of his empty assumption fields could an agent plausibly evidence from it?**
1. **What's in it:** enumerate the DISTINCT metric types present in Bishop's `costar_submarket_stats` (125 rows) and his `metric_time_series` CoStar rows (23,488) — metric names/ids, date ranges, geographies covered, row counts per metric. **Names and counts only, no values.**
2. **What signals it produces:** which COR-xx correlation signals now compute for Bishop *because* of CoStar inputs (i.e. present in the deal-scoped sweep, absent from GLOBAL). List by signal id + what each measures.
3. **Bishop's gaps:** enumerate his `deal_assumptions` fields that are NULL, defaulted, or flagged low-confidence (the `platform_fallback`/`inPlaceRentDefaulted`/`rentRollMissing` family). Which fields is the model currently guessing at?
4. **The map:** for each gap field, state whether a CoStar-derived signal exists that an agent could *cite as evidence* when proposing a value (e.g. submarket vacancy → informs `stabilized_vacancy`; asking-rent series → informs `market_rent`; concessions → informs `concession_pct`; absorption → informs `months_to_stabilize`). Three verdicts per field: **EVIDENCE-AVAILABLE** (a signal maps) / **PARTIAL** (related but indirect) / **NO-COVERAGE**.
5. **Explicit non-goal, state it in the report:** CoStar market data does NOT populate assumption fields by assignment. It becomes evidence an agent cites when *proposing* a value through the D3 seam (`agent_confirmed` + `reasoning` + `evidence_refs`). This map tells the operator what D3's agent will be able to justify — not what gets auto-filled.

## S3 · Verdict for the operator
End the report with: **is Bishop's CoStar upload rich enough to matter?** Count of gap-fields with EVIDENCE-AVAILABLE vs NO-COVERAGE. If most gaps have no coverage, say so plainly — that shapes expectations before D3 invests in the consumption path. If coverage is strong, name the top three fields where an agent proposal would be well-evidenced (these become D3's first demos).

## ACCEPTANCE
- S1: deal-scoped sweep run + stored restricted; counts pasted; non-Bishop query returns none of them (negative proof); no promotion path to GLOBAL.
- S2: metric inventory (names/counts, no values) · CoStar-only signal list · Bishop's gap-field list · the coverage map with three verdicts per field.
- S3: the rich-enough verdict with counts.
- GLOBAL sweep unchanged (4209/4746 pattern holds) · Bishop/Highlands build outputs unchanged · both baselines green · no licensed content in report.

## OUT OF SCOPE
Writing any assumption value (that's D3's seam, not this) · I2 remediation (next) · D3-W2/W3 · purging any row · exposing CoStar values in any artifact.

**Order: S1 design-check → S1 sweep → S2 map → S3 verdict. STOP if a deal-scoped restricted output would land in GLOBAL scope.**
