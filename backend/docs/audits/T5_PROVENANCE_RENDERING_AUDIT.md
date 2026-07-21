---
T5 PROVENANCE RENDERING AUDIT
Data Source Unification Audit (T4+T5 Phase)
Head: 34f4405bf on master
Auditor: read-only security/audit agent
Date: 2026-07-20
---

## Executive Summary

The JediRe platform has a mature backend provenance system (ProvenanceStamp, ProvenancedValue, LayeredValue) and multiple frontend rendering surfaces. However, T5_provenance_rendering reveals significant gaps between the canonical backend types and what is actually rendered in the UI. The frontend operates on an older, divergent type system, and several provenance fields defined in the backend spec are never displayed to users.

## S1-01 Findings

### FINDING-01 - Dual SourceBadge Components - Type System Fork
**file:line citations:**
- frontend/src/components/primitives/SourceBadge.tsx:23-54
- frontend/src/pages/development/financial-engine/SourceBadge.tsx:6-23

**What was found:** Two unrelated SourceBadge components exist with different source type systems. The primitives version uses LayeredValueSource (agent:research, tier1:t12, etc.) while the financial-engine version uses SOURCE_META keys (t12, rent_roll, extraction_om, etc.). They do not share a canonical source-of-truth type. The financial-engine SourceBadge does not handle any agent-derived sources (agent:*, tier3:*, tier4:*, subject_history:*, vault:*).

**Classification:** GAP
**Severity:** P1 - Inconsistent provenance labeling across tabs; users see different source badges depending on which surface renders the value.

---

### FINDING-02 - Frontend LayeredValue Missing Backend Fields
**file:line citations:**
- backend/src/types/layered-value.ts:56-97 - LayeredValue<T> with agentId?, runAt?, metadata?
- frontend/src/stores/dealContext.types.ts:72-112 - LayeredValue<T> without agentId, runAt, metadata

**What was found:** The backend LayeredValue carries agentId, runAt, and metadata (lines 61-64) for full agent-run provenance. The frontend mirror in dealContext.types.ts omits all three fields. This means agent-run timestamps, agent identities, and opaque metadata are dropped at the API boundary and cannot be rendered even if the backend supplies them.

**Classification:** GAP
**Severity:** P1 - Loss of agent-run traceability in the UI; violates Wave-1 W1 principle.

---

### FINDING-03 - ProvenancedValue Fields Never Rendered
**file:line citations:**
- backend/src/types/provenanced-value.ts:56-97 - defines ProvenancedValue<T> with qualityFlag, sourceRefs, modelVersion, userReviewed, dataQuality, fillMethod
- frontend/src/pages/development/financial-engine/CustomTabRenderer.tsx:157-160 - isProvenanced guard only checks value, confidence, source, qualityFlag

**What was found:** ProvenancedValue<T> is the canonical envelope per F9 Spec S12, yet four of its fields are never surfaced in the main UI:
- sourceRefs (line 79-84) - upstream module/formula/document pointers
- modelVersion (line 87) - version of the model/agent that produced the value
- userReviewed (line 90) - explicit user has reviewed and accepted flag
- rationale (line 76) - free-text justification/cap-rate explanation

The only place qualityFlag is partially consumed is CustomTabRenderer.tsx (lines 217-221), which maps it to a colour but ignores the richer provenance envelope.

**Classification:** GAP
**Severity:** P1 - Spec S12 compliance gap; users cannot see why a value was chosen, what model version produced it, or whether they have formally reviewed it.

---

### FINDING-04 - ingestionToLayeredValueSource Mapping Gaps
**file:line citations:**
- backend/src/utils/provenance-stamp.ts:121-160 - ingestionToLayeredValueSource

**What was found:** The bridge from ingestion source to layered value source has several questionable mappings:
1. csv_upload -> user (line 156) - CSV uploads are not necessarily user-authored.
2. archive_import and owned_import both -> tier2:owned_asset (lines 133-135) - Collapses semantically different sources.
3. capsule_bridge and comp_set_sync ingestion sources (lines 30-31) have no mapping at all and fall through to user via the default case (line 157).

**Classification:** GAP
**Severity:** P2 - Misclassification propagates into badge colours, tier filtering, and evidence resolution.

---

### FINDING-05 - ProvenanceStamp Trapped in deal_data JSONB
**file:line citations:**
- backend/src/agents/tools/create_deal_draft.ts:79-96 - _provenance stored inside deal_data JSONB
- backend/src/services/classification-context-loader.ts:21-27 - loader reads _provenance from deal_data
- backend/src/api/rest/source-documents.routes.ts:46-57 - source-documents route reads from deal_data->source_documents, not from _provenance

**What was found:** The ProvenanceStamp created at ingestion is stored as deal_data._provenance. It is only consumed by the classification-context loader. No API endpoint exposes the full ProvenanceStamp to the frontend. The source-documents API reads a separate source_documents array from deal_data, not the _provenance stamp. Therefore, frontend surfaces cannot display ingestion timestamps, raw source refs (e.g., Gmail message ID), or job IDs.

**Classification:** GAP
**Severity:** P1 - The stamp at birth data exists but is invisible to users; breaks the provenance chain at the API layer.

---

### FINDING-06 - stanceModulated / stanceTrace Under-Rendered
**file:line citations:**
- backend/src/types/layered-value.ts:91-96 - stanceModulated?: boolean, stanceTrace?: string
- frontend/src/stores/dealContext.types.ts:105-111 - same fields mirrored
- frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx:568-575 - stanceByPath lookup exists but only used for a yellow attention marker

**What was found:** Both backend and frontend types define stanceModulated and stanceTrace. In ProFormaSummaryTab.tsx, the stance trace is used only to drive a generic yellow attention indicator. The actual human-readable trace string is never rendered in a tooltip, drawer, or inline panel.

**Classification:** GAP
**Severity:** P2 - Incomplete transparency for operator-stance overrides.

---

### FINDING-07 - AssumptionsPanel Renders agent_run_id But Not runAt or agentId
**file:line citations:**
- frontend/src/components/deal/AssumptionsPanel.tsx:141 - <AgentSourceBadge source={lv.source} agentRunId={lv.agent_run_id} />
- frontend/src/stores/dealContext.types.ts:88 - agent_run_id?: string defined
- frontend/src/components/primitives/SourceBadge.tsx:118-120 - tooltip appends agentRunId.slice(0,8) and runAt

**What was found:** AssumptionsPanel passes agent_run_id to AgentSourceBadge, and the badge tooltip will show the run ID prefix. However, because the frontend LayeredValue lacks runAt (see FINDING-02), the tooltip runAt branch will never fire. The agentId field is also absent, so the tooltip agentId branch will never fire.

**Classification:** FINDING
**Severity:** P2 - Partial rendering; agent provenance is present but impoverished.

---

### FINDING-08 - EvidenceFieldMeta Lacks ProvenancedValue Rich Fields
**file:line citations:**
- frontend/src/pages/development/financial-engine/types.ts:824-833 - EvidenceFieldMeta interface
- frontend/src/pages/development/financial-engine/CustomTabRenderer.tsx:195-270 - ProvenanceBadge consumes EvidenceFieldMeta

**What was found:** EvidenceFieldMeta exposes tier, confidence, has_collision, collision_magnitude, plausibility_band, and plausibility_score. It does not expose sourceRefs, modelVersion, userReviewed, fillMethod, or rationale. Consequently, the ProvenanceBadge in CustomTabRenderer cannot render the full provenance envelope.

**Classification:** GAP
**Severity:** P2 - Custom tabs cannot show full provenance because the evidence schema is narrower than ProvenancedValue.

---

### FINDING-09 - Source Documents API Does Not Surface ProvenanceStamp
**file:line citations:**
- backend/src/api/rest/source-documents.routes.ts:39-104 - GET /:dealId/source-documents

**What was found:** The source-documents endpoint enriches documents with live_extraction_status and category from deal_files, but it never joins to or emits _provenance data. There is no field in the response for ingestionSource, stampedAt, userId, agentRunId, jobId, or rawSourceRef.

**Classification:** GAP
**Severity:** P2 - Breaks data-source unification goal of distinguishing how it entered at the document level.

---

### PASS-01 - ProvenanceStamp Created at Every Major Ingestion Route
**file:line citations:**
- backend/src/utils/provenance-stamp.ts:100-110 - stampProvenance factory
- backend/src/inngest/functions/email-intake.function.ts:194-199 - email intake stamps with ingestionSource: email_intake
- backend/src/agents/tools/create_deal_draft.ts:81 - draft creation stores _provenance
- backend/src/api/rest/bulk-upload.routes.ts:409 and 524 - archive/zip uploads stamp with ingestionSource: archive_import
- backend/src/services/archive-ingestion.service.ts:647-656 - upsertArchiveDeal merges _provenance into extraction_data

**What was found:** Every ingestion pathway correctly calls stampProvenance() and attaches the stamp. The stamp includes ingestion source, user ID, job ID, and raw source reference where applicable.

**Classification:** PASS

---

### PASS-02 - ClassificationContext Assembler Respects Provenance Precedence
**file:line citations:**
- backend/src/services/classification-context-assembler.ts:67-92 - SOURCE_PRECEDENCE ranking
- backend/src/services/classification-context-assembler.ts:159-200 - resolution by precedence + recency

**What was found:** The assembler correctly ranks sources and tie-breaks by stampedAt. It maps raw rows into ClassificationValue<T> with embedded ProvenanceStamp.

**Classification:** PASS

---

### PASS-03 - DataQualityBadge Renders Spec S12 Buckets
**file:line citations:**
- frontend/src/components/deal/DataQualityBadge.tsx:8-53 - renders ACTUAL/INFERRED/ESTIMATED/DEFAULT

**What was found:** The badge correctly maps DataQuality to inline labels and suppresses the badge for ACTUAL. It falls back to deriveLayeredDataQuality when backend has not stamped dataQuality.

**Classification:** PASS

---

### PASS-04 - SourceDocPill Renders Document Extraction Provenance
**file:line citations:**
- frontend/src/components/F9/SourceDocPill.tsx:11-331 - full popover with filename, extracted_at, key_fields, rows_inserted

**What was found:** The pill correctly maps document types to colours and labels, shows extraction date, key fields, and row counts, and dismisses on outside click.

**Classification:** PASS

---

## Severity Tally

| Severity | Count |
|----------|-------|
| P0 (Critical) | 0 |
| P1 (Data Integrity / Compliance) | 5 |
| P2 (Scalability / Transparency) | 4 |
| PASS | 4 |

---

## Recommended Remediation Order

1. Unify SourceBadge - Merge the two components into one canonical version.
2. Align frontend LayeredValue - Add agentId, runAt, metadata to dealContext.types.ts.
3. Expose ProvenanceStamp via API - Create endpoint or embed _provenance in financials responses.
4. Expand EvidenceFieldMeta - Add sourceRefs, modelVersion, userReviewed, fillMethod, rationale.
5. Fix ingestion mappings - Add explicit cases for capsule_bridge, comp_set_sync; disambiguate archive vs owned.
6. Render stanceTrace inline - Show human-readable stance trace in tooltip or drawer.
