# Data Quality Agent — Architecture Spec

**Service:** `backend/src/services/data-quality-agent.service.ts`
**Task:** #691 (initial build), #696 (taxonomy expansion — pending, see §5.2)
**Model:** `claude-3-5-haiku-20241022`
**Status:** Phase 1 in production; Phase 2 path documented in Section 8.

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

> **Spec maintenance rule:** The live service's `DqaClassification` type union,
> `SEVERITY_MAP`, tool-use schema enum, and post-call allowlist filter are the
> authoritative source of truth. This spec section must match them exactly. If drift
> is observed, update this file — never silently leave the spec ahead of or behind
> the code.

### 5.1 Current taxonomy (live as of Task #691)

Seven active classifications are defined in `data-quality-agent.service.ts:24-31`
and `SEVERITY_MAP` at `:66-74`.

| Classification | Severity | Description | Recommended action |
|---|---|---|---|
| `PARSER_MISS` | warning | Document clearly contains a value for this row but extracted value is null/zero | Re-run extraction; inspect parser regex for the field |
| `PARSER_INCORRECT` | critical | Extracted value differs from source document value by >5% | Correct the extracted value; file parser bug if systematic |
| `RANGE_ANOMALY` | warning | Value present but implausible (e.g. NOI/unit >$30k/yr or <$500/yr for multifamily) | Verify with source document; override if document is correct |
| `INCONSISTENCY` | warning | Internal contradiction within the same document (e.g. stated NOI ≠ Revenue − Expenses) | Flag for underwriter review; determine which figure is authoritative |
| `SEED_PLUMBING` | warning | Value extracted and stored but did not propagate to the Pro Forma year1 slot | Investigate pipeline; trigger reseed or file engineering ticket |
| `CROSS_DOC_VARIANCE` | info | Value differs materially from another uploaded document's data for the same field | Review both documents; select authoritative source |
| `LOW_CONFIDENCE_EXTRACTION` | info | Extracted value present but document text is ambiguous or unclear | Manual review of source section recommended |

Minimum confidence threshold: `MIN_CONFIDENCE = 0.6`. Only findings at or above this
value are written to `data_quality_alerts`.

### 5.2 Pending taxonomy expansion — Task #696

> **Status:** Planned, not yet merged. Section 5.1 reflects the live service.
> Once #696 ships, update §5.1 in place to match the new 9-class set and remove this
> §5.2 subsection. The design decisions, prompt copy, and acceptance criteria that
> govern the implementation are in `.local/tasks/dqa-seed-plumbing-taxonomy-split.md`.

Task #696 splits `SEED_PLUMBING` into two specific variants and adds a verified-absence
class. The change inventory:

| Action | Classification | Severity | Rationale |
|---|---|---|---|
| **Add** | `SEED_PLUMBING_WRITE_RACE` | warning | Scenario A — pipeline write-race between routeOM and routeExtractionResult |
| **Add** | `SEED_PLUMBING_STALE_SEED` | warning | Scenario B — seed written before broker data arrived |
| **Add** | `NOT_IN_DOC` | info | Scenario C — field verified absent from the source document |
| **Retire** | `SEED_PLUMBING` | — | Replaced by two specific variants; existing rows age out naturally |

**Post-#696 full taxonomy** (9 classes):

| Classification | Severity | Description | Recommended action |
|---|---|---|---|
| `PARSER_MISS` | warning | Document contains the field but extracted value is null/zero | Re-run extraction; inspect parser |
| `PARSER_INCORRECT` | critical | Extracted value differs from source by >5% | Correct extracted value; file parser bug |
| `RANGE_ANOMALY` | warning | Value present but implausible | Verify with source; override if correct |
| `INCONSISTENCY` | warning | Internal contradiction within same document | Flag for underwriter; determine authoritative figure |
| `SEED_PLUMBING_WRITE_RACE` | warning | Value in broker_claims but not in year1 slot; source-write and seed-write timestamps within 5 min (`deltaSeconds < 300`) | Pipeline issue — engineering ticket; back-fill protects display temporarily |
| `SEED_PLUMBING_STALE_SEED` | warning | Value now in broker_claims but seed predates it (`deltaSeconds >= 300` or timestamps unknown) | Trigger reseed to refresh year1; back-fill protects display in the meantime |
| `NOT_IN_DOC` | info | Field verified absent from source document (curated: emitted only when another source on the deal has the field) | Verified absence — no action required |
| `CROSS_DOC_VARIANCE` | info | Value differs materially across uploaded documents for same field | Review both; select authoritative source |
| `LOW_CONFIDENCE_EXTRACTION` | info | Extracted value present but document text ambiguous | Manual review of source section |

**Key design decisions for #696:**

- `WRITE_RACE_WINDOW_SECONDS = 300` — named constant, not a magic number. Phase 1
  uses `deals.updated_at` as the source-write proxy (coarse; see §8.1 limitation).
- `NOT_IN_DOC` is candidate-verified, not caller-asserted. The server passes an
  `absentFields` candidate list; Claude must confirm absence by scanning the source
  document. If the section is unreadable → `LOW_CONFIDENCE_EXTRACTION`. If the field
  is visible despite null year1 → `PARSER_MISS`.
- Post-call allowlist drops any `'SEED_PLUMBING'` string the LLM emits; it never
  reaches `data_quality_alerts` after #696 ships.
- TypeScript exhaustiveness (`Record<DqaClassification, DqaSeverity>`) enforces that
  adding or removing a union member without updating `SEVERITY_MAP` is a compile error.
- Migration: Option B — existing `SEED_PLUMBING` rows age out naturally when the deal
  is re-touched and the supersede logic fires. No backfill batch job.

---

## 6. Data model

### Finding shape (`DqaFinding`)

| Field | Type | Notes |
|---|---|---|
| `classification` | `DqaClassification` | One of the active classifications |
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
| `classification` | text | One of the active classifications |
| `severity` | text | critical, warning, info |
| `agent_finding` | jsonb | Full `DqaFinding` object + `document_hash` + `parser_version` |
| `status` | text | open, dismissed, acknowledged, fixed |
| `superseded_by` | uuid \| null | ID of the newer finding that replaced this one |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## 7. Supersede pattern

When a new finding is written for a `(dealId, documentType, proformaColumn, proformaRow)`
tuple, all prior open findings for the same tuple are marked `superseded_by = <newId>`.
Status is set back to `'open'` on the superseding record (not `'fixed'` — the problem
may or may not be resolved). After #696 ships, legacy `SEED_PLUMBING` rows are
superseded by their specific-variant successors on the next per-reseed or
per-extraction trigger.

---

## 8. Known limitations and Phase 2 path

### 8.1 Phase 1 timestamp proxy (`deals.updated_at`) — planned for #696

The WRITE_RACE vs STALE_SEED split (coming in #696) will use `deals.updated_at` as a
proxy for "when source data was last written to `broker_claims.proforma`." This is
coarse: `deals.updated_at` fires on any edit to the deal record (e.g. renaming the
deal), not specifically on changes to the source field. An unrelated edit after seeding
can cause a STALE_SEED case to be misclassified as WRITE_RACE.

**Phase 1 acceptance:** misclassification is recoverable in both directions.
- WRITE_RACE misclassified → engineering noise; underwriter sees a low-severity alert
- STALE_SEED misclassified → harmless reseed prompt

Monitor false-classification rate after 4+ weeks of production data before escalating.

A code comment at the callsite in `runDataQualityAgentAfterReseed` will document this
limitation and the Phase 2 path so future engineers see it in context.

### 8.2 Phase 2: field-level extraction events audit table (Task #698)

The Phase 2 path introduces an `extraction_events` table that records per-field write
timestamps for `broker_claims.proforma` and other source slots. With true field-level
timestamps:
- The `deals.updated_at` proxy is replaced with an exact per-field `written_at`
- Signed-delta logic becomes implementable: `seed_written_at < source_written_at` →
  STALE_SEED; `seed_written_at >= source_written_at` → WRITE_RACE (with 5-minute
  tolerance)

**Trigger for Phase 2:** production false-classification rate exceeds comfort threshold
after the 4-week monitoring window, OR a downstream feature independently requires the
audit table.

### 8.3 Signed vs unsigned delta (parking lot)

The #696 heuristic uses absolute delta. A source written 30 s after seeding
(`|delta| < 300`) is classified as WRITE_RACE, but structurally it is a stale-seed
case. Acceptable Phase 1 false-classification rate expected to be low. Deferred to
Phase 2 signed-delta refinement (see Task #698).

---

## 9. Bishop canonical test case

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
