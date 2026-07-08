# SPEC — OM EXTRACTION: Classify → Locate → Extract

**#5 of 6. Type: architecture spec (author now, build when scheduled). No gate.**
**Problem (from audit Part C):** OMs run 20+ pages, ~3 pages of signal. Current path = whole-document text (pdf-parse → tesseract fallback) truncated at 50k chars (~14k tokens) → LLM. No page selection, no page provenance (LLM-best-effort, null if omitted), no `column_basis`. Verdict: WEAK. Three failures: cost (14k+ tokens/OM), accuracy (signal diluted by narrative/photos/legal), provenance (can't cite the source page — breaks evidence_refs and broker_claims routing).

## The architecture: three stages

### Stage 1 — CLASSIFY (segment + label pages, cheap)
Split the OM into pages/sections; classify each by type WITHOUT full extraction:
- Page classes: `rent_roll`, `financials_t12`, `financials_historical` (multi-year — feeds the history-capture spec), `operating_proforma` (BROKER projections → broker_claims), `market_comps`, `narrative`, `photos`, `legal`, `unit_mix`, `capital_needs`.
- Method: cheap classifier — page text signature / layout heuristics / a small classification LLM pass on page headers+first-lines, NOT full-page extraction. Target: label 20 pages for a fraction of one full extraction's cost.
- Output: page-index → class map, with confidence.

### Stage 2 — LOCATE (route only high-signal pages)
- Only pages classed as data-bearing (`rent_roll`, `financials_*`, `operating_proforma`, `unit_mix`, `market_comps`) proceed to extraction. Narrative/photos/legal are dropped (or kept as low-priority context, not extracted).
- Each routed page carries its page number forward — this IS the page-provenance the current path lacks.
- Multi-page tables (a rent roll spanning 3 pages) reassemble before extraction.

### Stage 3 — EXTRACT (structured, per-class, provenance-tagged)
- Per-class extractors (a rent-roll extractor differs from a T-12 extractor) run only on located pages.
- **Every extracted value carries:** source page number, source class, and `column_basis` (which OM column — as-is vs pro-forma vs T-12 — the value came from). This is the discipline the current path drops.
- **broker_claims routing (the critical invariant):** anything from `operating_proforma` pages = broker projection → `broker_claims`, NEVER an actuals field. Class drives routing structurally, so a projected NOI cannot leak into `deal_monthly_actuals`. This makes the audited-solid boundary (`data-router.ts:1083`) robust by construction rather than by post-hoc check.
- Historical financials pages → hand to the Multi-Year History Capture pipeline (spec #6) for month-keyed `deal_monthly_actuals` landing.

## Cost model
Classify (cheap, all pages) + Extract (structured, ~3-5 pages) should undercut the current whole-document 14k-token dump on both cost AND accuracy — quantify against a real 20-page OM at build time.

## Provenance contract
Every OM-derived value: `{value, source_page, source_class, column_basis, provenance: 'document', evidence_ref: <om_file + page>}` — directly satisfies D3's evidence_refs referential integrity (the ref points at a real page, not a best-effort guess).

## Open design questions (resolve at build)
1. Classifier method: heuristic vs small-LLM vs hybrid — cost/accuracy tradeoff on real OMs.
2. Multi-page table reassembly: how robust across varied OM layouts.
3. Confidence thresholds: when a page's class is uncertain, extract-anyway vs flag-for-review.
4. Deterministic vs LLM per extractor class (rent rolls are tabular → more deterministic; narrative-embedded figures → LLM).

## Dependencies
Feeds and is fed by: D3 (evidence_refs consume the page-provenance), broker_claims boundary (this makes it structural), Multi-Year History Capture (#6, receives historical pages). Build-order: after CREATE-1 (deals must materialize before extraction seeds them); can precede or follow D3-W6 but W6's evidence integrity is stronger with this landed.
