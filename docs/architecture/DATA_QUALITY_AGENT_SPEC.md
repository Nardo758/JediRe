# Data Quality Agent — Architecture Spec

**Service:** `backend/src/services/data-quality-agent.service.ts`
**Tasks:** #691 (initial build), #696 (taxonomy expansion — see §5)
**Model:** `claude-3-5-haiku-20241022`

> **Spec status:** Section 5 documents the post-#696 taxonomy (9 classifications,
> `SEED_PLUMBING` retired). Until #696 merges, the live service still contains the
> pre-#696 7-class union. Once #696 ships, this notice should be removed and the
> service and spec will be in full parity.
>
> **Maintenance rule:** The live service's `DqaClassification` type union, `SEVERITY_MAP`,
> tool-use schema enum, and post-call allowlist filter are the authoritative runtime
> source of truth. If drift between them and this spec is observed, update this file.
> Never leave the spec silently ahead of or behind the code.

---

## 1. Purpose

The Data Quality Agent (DQA) audits each document extraction against the source
document and the current Pro Forma `year1` slot, then writes structured findings to
`data_quality_alerts`. It runs asynchronously and never blocks extraction or rendering.

The agent answers one question per proforma row: _does the value in the year1 slot
accurately reflect what the source document contains?_ It does not make underwriting
decisions — it surfaces discrepancies so underwriters can adjudicate.

---

## 2. Triggers

The agent fires on two events:

| Trigger | Function | Notes |
|---|---|---|
| Per-extraction | `runDataQualityAgent(pool, opts)` | Called after each parser invocation completes |
| Per-reseed | `runDataQualityAgentAfterReseed(pool, dealId, seedGaps)` | Called after `ensureDealAssumptionsSeeded` completes; filters to gaps relevant to each uploaded document type |

Both triggers are fire-and-forget: errors are caught and logged; callers are not blocked.

---

## 3. Audit scope

Only rows where the document type is the primary or sole source are audited.

| Document type | Proforma column | Rows audited |
|---|---|---|
| OM | `broker` | gpr, vacancy_pct, real_estate_tax, contract_services, payroll, insurance, management_fee_pct, noi |
| T12 | `t12` | gpr, vacancy_pct, real_estate_tax, contract_services, payroll, repairs_maintenance, turnover, marketing, utilities, insurance, management_fee_pct, noi |
| RENT_ROLL | `rent_roll` | gpr, vacancy_pct, other_income_total |
| TAX_BILL | `tax_bill` | real_estate_tax |

Document types not in `AUDIT_ROWS_BY_DOCTYPE` return `null` immediately with no Claude
call.

---

## 4. Caching

Findings are skipped when both conditions hold:
- `document_hash` matches the SHA-256 (first 16 hex chars) of the current file on disk
- `parser_version` matches the current `PARSER_VERSION` constant (`1.0.0`)

The cache is read from `data_quality_alerts` rows with `status = 'open'` for the
`(dealId, documentType)` pair. On a cache hit, the existing findings are returned
immediately; no Claude call is made.

Cache invalidation is implicit: any file change produces a new hash, and any parser
upgrade bumps `PARSER_VERSION`.

---

## 5. Classification taxonomy

Nine active classifications. `SEED_PLUMBING` is retired; existing rows in
`data_quality_alerts` with `classification = 'SEED_PLUMBING'` age out naturally when
the deal is re-touched and the supersede logic fires (Option B migration — no backfill
batch job). The post-call allowlist filter drops any `'SEED_PLUMBING'` string the LLM
emits; it never reaches `data_quality_alerts` after Task #696 ships.

TypeScript exhaustiveness (`Record<DqaClassification, DqaSeverity>`) enforces that
adding or removing a union member without updating `SEVERITY_MAP` is a compile error.
The tool-use schema enum and post-call allowlist must be updated in lockstep with the
type union; a mismatch causes hallucinated legacy tags to pass the schema but get
silently dropped.

### 5.1 Classification table

| Classification | Severity | Description | Recommended action |
|---|---|---|---|
| `PARSER_MISS` | warning | Document clearly contains a value for this row but extracted value is null/zero | Re-run extraction; inspect parser regex for the field |
| `PARSER_INCORRECT` | critical | Extracted value differs from source document value by >5% | Correct the extracted value; file parser bug if systematic |
| `RANGE_ANOMALY` | warning | Value present but implausible (e.g. NOI/unit >$30k/yr or <$500/yr for multifamily) | Verify with source document; override if document is correct |
| `INCONSISTENCY` | warning | Internal contradiction within the same document (e.g. stated NOI ≠ Revenue − Expenses) | Flag for underwriter review; determine which figure is authoritative |
| `SEED_PLUMBING_WRITE_RACE` | warning | Value extracted and stored in broker_claims but did not propagate to the Pro Forma year1 slot; source-write and seed-write timestamps within 5 minutes of each other (`deltaSeconds < WRITE_RACE_WINDOW_SECONDS = 300`), suggesting a pipeline write-race between routeOM and routeExtractionResult | Pipeline issue — engineering ticket recommended. Back-fill displays correct value temporarily; year1 stays stale until fix. |
| `SEED_PLUMBING_STALE_SEED` | warning | Value exists in broker_claims now, but the seed was written significantly earlier (`deltaSeconds >= 300` or timestamps unknown); seeder ran when the value was not yet present | Trigger a reseed to refresh year1 from current source data. Back-fill protects display in the meantime. |
| `NOT_IN_DOC` | info | Document checked; field genuinely absent. Curated: emitted only when at least one other document type on this deal has the field. Claude must verify absence by scanning the source document before emitting (see §5.3) | Verified — document does not contain this field. No action required. |
| `CROSS_DOC_VARIANCE` | info | Value differs materially from another uploaded document's data for the same field | Review both documents; select authoritative source |
| `LOW_CONFIDENCE_EXTRACTION` | info | Extracted value present but document text is ambiguous or unclear | Manual review of source section recommended |

**Minimum confidence threshold:** `MIN_CONFIDENCE = 0.6`. Only findings at or above
this value are written to `data_quality_alerts`.

### 5.2 Write-race threshold

```
WRITE_RACE_WINDOW_SECONDS = 300   // 5 minutes — named constant, not a magic number
```

Stored as a module-level constant. The system prompt references both the numeric value
(`deltaSeconds < 300`) and the verbal description ("5 minutes") for LLM robustness.
If production monitoring shows the threshold needs adjustment, change the constant; the
prompt copy references it verbatim.

### 5.3 NOT_IN_DOC: curated-scope rule and verification requirement

`NOT_IN_DOC` is candidate-verified, not caller-asserted. Before calling Claude, the
server builds an `absentFields` candidate list — fields where `year1SlotValue` is null
AND at least one other document type on this deal has a non-null value for the field.
This limits the scope from ~50 potential findings per deal to a meaningful signal set.

Claude receives `absentFields` as a candidate input and must verify absence by scanning
the relevant section of the source document. Two override rules apply:

- If the relevant section is **unreadable** → emit `LOW_CONFIDENCE_EXTRACTION` instead
- If the field **is visible** in the source despite year1 being null → emit `PARSER_MISS`

`absentFields` membership is necessary but not sufficient for `NOT_IN_DOC`.

Default display: `NOT_IN_DOC` findings are hidden in the alert panel (severity `info`)
and counted in an "N absences verified" footnote. The "Show absences" toggle reveals
them inline.

### 5.4 Phase 1 timestamp proxy and Phase 2 path

The WRITE_RACE vs STALE_SEED classification uses `deals.updated_at` as a proxy for
"when source data was last written to `broker_claims.proforma`." This is coarse:
`deals.updated_at` fires on any edit to the deal record, not specifically on changes
to the source field. An unrelated edit after seeding can cause a STALE_SEED case to
be misclassified as WRITE_RACE.

**Phase 1 acceptance:** misclassification is recoverable in both directions.
- WRITE_RACE misclassified → engineering noise; underwriter sees a low-severity alert
- STALE_SEED misclassified → harmless reseed prompt

Monitor false-classification rate after 4+ weeks of production data. A code comment
at the callsite in `runDataQualityAgentAfterReseed` documents this limitation and the
Phase 2 path so future engineers see it in context, not only here.

**Phase 2 path (Task #698):** introduce an `extraction_events` table recording per-field
write timestamps for `broker_claims.proforma`. With true field-level timestamps, the
`deals.updated_at` proxy is replaced by exact per-field `written_at` values, and
signed-delta logic becomes implementable (`seed_written_at < source_written_at` →
STALE_SEED; `seed_written_at >= source_written_at` → WRITE_RACE with 5-minute
tolerance). Signed-delta refinement is currently parking-lot material — deferred until
production monitoring motivates it.

---

## 6. Data model

### Finding shape (`DqaFinding`)

| Field | Type | Notes |
|---|---|---|
| `classification` | `DqaClassification` | One of the 9 active classifications |
| `proforma_column` | string | e.g. `'broker'`, `'t12'`, `'rent_roll'`, `'tax_bill'` |
| `proforma_row` | string | e.g. `'gpr'`, `'contract_services'` |
| `source_evidence` | `{ page, section, snippet }` | Page number and snippet from the source document |
| `reasoning` | string | Claude's explanation of the finding |
| `extracted_value` | string \| number \| null | What the parser extracted |
| `expected_value` | string \| number \| null | What the source document shows |
| `confidence` | number 0–1 | Claude's certainty this is a genuine problem |
| `recommended_action` | string | Human-readable remediation step |

### `data_quality_alerts` table columns

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `deal_id` | uuid | FK to deals |
| `document_type` | text | OM, T12, RENT_ROLL, TAX_BILL |
| `proforma_column` | text | broker, t12, rent_roll, tax_bill |
| `proforma_row` | text | gpr, contract_services, etc. |
| `classification` | text | One of the 9 active classifications |
| `severity` | text | critical, warning, info |
| `agent_finding` | jsonb | Full `DqaFinding` + `document_hash` + `parser_version` |
| `status` | text | open, dismissed, acknowledged, fixed |
| `superseded_by` | uuid \| null | ID of the newer finding that replaced this one |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## 7. Supersede pattern

When a new finding is written for a `(dealId, documentType, proformaColumn, proformaRow)`
tuple, all prior open findings for the same tuple are marked `superseded_by = <newId>`.
Status is set back to `'open'` on the superseding record (not `'fixed'` — the problem
may or may not be resolved). Legacy `SEED_PLUMBING` rows are superseded by their
specific-variant successors on the next per-reseed or per-extraction trigger.

---

## 8. Bishop canonical test case

Deal: `3f32276f-aacd-4da3-b306-317c5109b403`

Post-#696-deploy expected state (verify via DB query):

```sql
SELECT classification, proforma_row, proforma_column, status
FROM data_quality_alerts
WHERE deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
ORDER BY created_at DESC LIMIT 20;
```

| Row | Column | Expected classification | Severity | Notes |
|---|---|---|---|---|
| `contract_services` | `broker` | `NOT_IN_DOC` | info | OM absent; T-12 has it → curated criterion met |
| `gpr` | `broker` | _(no new finding)_ | — | `gpr.om = 4,901,400` correctly populated |
| any | any | _(no new `SEED_PLUMBING`)_ | — | Post-call filter drops retired tag |

Legacy `SEED_PLUMBING` rows remain `status = 'open'` until naturally superseded on
next re-touch; they are not backfilled.
