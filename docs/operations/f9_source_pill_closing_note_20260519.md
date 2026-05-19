# F9 Source Pill — Closing Note
**Date:** 2026-05-19 | **Task:** Wire source_documents REST endpoint into F9 evidence drawer

---

## What shipped

### New files
- **`frontend/src/hooks/useSourceDocuments.ts`** — React hook. Fetches `GET /api/v1/deals/:dealId/source-documents` once per deal. Returns `{ documents, byDocType, loading }` where `byDocType` is keyed by `document_type` for O(1) lookup. Deduplicates by doc type (first/most-recently-extracted wins). Best-effort: silently returns `[]` on 4xx/5xx.

- **`frontend/src/components/f9/SourceDocPill.tsx`** — Self-contained clickable badge. Props: `{ doc: SourceDocument | null | undefined }`. Renders nothing when `doc` is null (graceful degradation). Click opens an inline popover (click-outside dismisses) showing: filename, extracted_at, key_fields chips, rows_inserted. Colors match `ReconciliationChip` SOURCE_COLOR pattern: T-12=green, Rent Roll=cyan, OM=amber, Tax Bill=blue. No network calls; purely display.

### Modified files
- **`frontend/src/pages/development/financial-engine/types.ts`** — Re-exports `SourceDocument` from the hook. Adds `sourceDocuments?: SourceDocument[]` to `FinancialEngineTabProps`.

- **`frontend/src/pages/development/FinancialEnginePage.tsx`** — Imports `useSourceDocuments`, calls it once per `resolvedDealId`, passes `sourceDocuments` into `tabProps` (and its `useMemo` dep array).

- **`frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx`** — Imports `SourceDocPill` and `SourceDocument`. Adds `mapSourceToDocType()` helper (row.source → document_type key). Builds `byDocType` memo. Destructures `sourceDocuments` from props. Wires `sourceDoc` prop into all **5 DataRow call sites** and inline into the **NOI row** and **Reserves row** source cells.

---

## The 12 typed fields with source pill binding

Rather than hardcoding a field allowlist, the pill is data-driven: any ProForma row where `row.source` maps to an extracted document_type in the source_documents catalogue gets a pill. Under normal extraction conditions this covers:

| Field | Typical row.source | Doc type |
|---|---|---|
| GPR | t12 / rent_roll | T-12 / Rent Roll |
| Vacancy | t12 / rent_roll | T-12 / Rent Roll |
| Loss to Lease | t12 | T-12 |
| Concessions | t12 / rent_roll | T-12 / Rent Roll |
| Bad Debt | t12 | T-12 |
| Other Income | t12 / rent_roll | T-12 / Rent Roll |
| Payroll | t12 | T-12 |
| Repairs & Maintenance | t12 | T-12 |
| Utilities | t12 | T-12 |
| Management Fee | t12 | T-12 |
| Insurance | t12 | T-12 |
| Real Estate Tax | tax_bill / t12 | Tax Bill / T-12 |
| NOI (inline) | t12 | T-12 |
| Replacement Reserves (inline) | platform / t12 | — / T-12 |

`mapSourceToDocType` mapping:  
`t12 / t-12 → 't12'` | `rent_roll → 'rent_roll'` | `om / offering_memorandum → 'om'` | `broker → 'om'` | `tax_bill → 'tax_bill'`

---

## Evidence drawer behavior

The **existing** `EvidencePanel` (right-side fixed 440px panel, opens via `fe-evidence-click` custom event) is unchanged. The `SourceDocPill` opens its own lightweight inline popover — not the full EvidencePanel. This is intentional:

- EvidencePanel = AI-derived underwriting evidence chain (tier, confidence, reasoning, alternatives, override)
- SourceDocPill popover = extraction provenance (which file, when extracted, what was pulled from it)

Both can be active simultaneously: click the tier badge → EvidencePanel; click the source pill → provenance popover.

---

## Graceful degradation

- Deal with no extractions: `useSourceDocuments` returns `[]`, `byDocType = {}`, all `sourceDoc` lookups return `null`, no pills render. ProForma table looks exactly as it did before.
- Deal with partial extractions (e.g. rent roll but no T-12): only rows with `row.source = 'rent_roll'` get pills.
- Network error on source-documents fetch: silently returns `[]`, zero broken UI.
- Multiple files of same type: first in array wins (most recently extracted, per backend sort order).

---

## Deferred work

1. **Click-through to the EvidencePanel from the pill** — currently the pill opens its own popover. A "View full evidence →" link could open EvidencePanel with a synthetic `fe-evidence-click` event. Low effort, deferred pending UX feedback.
2. **AssumptionsHubTab wiring** — the source pill is wired into `ProFormaSummaryTab` only. `AssumptionsHubTab` (the editable assumptions grid) has its own row rendering and was not touched. Could receive the same `sourceDocuments` prop via `tabProps` and use `SourceDocPill` inline.
3. **Per-field extraction granularity** — `key_fields` in the popover shows all fields extracted from the document, not filtered to "fields relevant to this row". This is informative but not field-specific. A future schema extension could carry per-field extraction confidence scores.
4. **OM pill for broker-sourced rows** — `broker → 'om'` mapping means broker-entered rows (from OM claims) will show an OM pill if an OM was ever extracted. This is accurate but may confuse operators who manually set a broker value without uploading an OM. Monitor for confusion.
