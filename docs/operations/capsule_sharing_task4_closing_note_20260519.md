# Capsule Sharing Task 4 closing note — 2026-05-19

## Background
Per TONIGHT_ROADMAP.md, Task 4 extends the evidence drawer to show a "Source" section with actual document references and "View document" links. The roadmap identified this as the final remaining gap in the evidence-linkage UX.

## Investigation
- The EvidencePanel already showed source *categories* via `SourceBadge` (DEAL DOCS, BROKER OM, MARKET DATA) per evidence data point
- The `f9_source_pill` component added the source pill on *cells* in the ProForma summary tab (Gap 2, shipped by user)
- Missing: a unified source documents section *inside the evidence drawer* showing filenames, document types, extraction dates, and download links
- `useSourceDocuments` hook existed (from Gap 2) and fetches `GET /api/v1/deals/:dealId/source-documents`
- Document download endpoint existed (Piece 1, via our earlier `source-documents.routes.ts`)

## Investigation Findings
- Q1 (Is evidence drawer showing all three: reasoning, cohort, source attribution?): No — reasoning and cohort comparison were present but source attribution was per-point `SourceBadge` only, not a dedicated section
- Q2 (Parser page-level metadata): The extraction pipeline outputs `source_documents` entries with `file_id`, `filename`, `document_type`, `extracted_at`, `key_fields`. No per-span or per-page metadata
- Q3 (document viewer or link): The download endpoint existed (Piece 1) but was not linked from the evidence drawer. The link is now in place.

## Changes Applied

### Modified: `EvidencePanel.tsx`
- Imported `useSourceDocuments` hook
- Added "SOURCE DOCUMENTS" section in the Reasoning tab (after primary evidence, before cohort baseline)
- Shows up to 4 documents with: document type badge, filename, extraction date, and "↓ VIEW" download link
- "+N more documents" overflow indicator for deals with 5+ documents
- Download links point to `GET /api/v1/deals/:dealId/documents/:file_id/download`
- Links use `e.stopPropagation()` to prevent closing the drawer when clicked

## Verification
- Frontend TypeScript: compiles clean (only tsconfig deprecation warning, no code errors)
- Backend: all source files compile with 0 new errors

## Remaining
- Per-span highlight-at-location not yet implemented (downstream — requires per-page extraction metadata)
- The source section shows *all* documents for the deal, not specifically the document(s) containing the current evidence field. A future enhancement could cross-reference `source_ref` in the evidence payload against the source document catalogue

## Canvas
Narrative walk completed. The source section sits between the primary evidence rendering and the cohort baseline section — the natural place for an underwriter to scroll past as they work through the evidence chain.
