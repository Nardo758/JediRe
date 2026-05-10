# DQA Monitoring Runbook

Operational reference for the Data Quality Agent (`data-quality-agent.service.ts`).
Covers false-classification monitoring, Bishop verification, and Phase 2 readiness checks.

---

## 1. False-classification rate — WRITE_RACE vs STALE_SEED

Run after 4+ weeks of production data to determine whether the Phase 1 timestamp
proxy (`deals.updated_at`) is producing acceptable results. If misclassification
rate exceeds ~5% of findings in a manual spot-check, activate Phase 2 (Task #698).

```sql
-- Weekly WRITE_RACE vs STALE_SEED counts (post-#696)
SELECT
  DATE_TRUNC('week', created_at)                  AS week,
  classification,
  COUNT(*)                                         AS findings,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER
    (PARTITION BY DATE_TRUNC('week', created_at)), 1) AS pct_of_week
FROM data_quality_alerts
WHERE classification IN ('SEED_PLUMBING_WRITE_RACE', 'SEED_PLUMBING_STALE_SEED')
  AND status = 'open'
  AND created_at >= NOW() - INTERVAL '8 weeks'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

**Interpreting results:**
- A sustained WRITE_RACE rate > 70% suggests the 5-minute window is too wide,
  or a systematic pipeline bug (investigate `routeOM` → seeder timing).
- A STALE_SEED rate > 80% is expected pre-extraction (seeder runs on deal create;
  OM is uploaded later). High post-extraction STALE_SEED may indicate the reseed
  trigger isn't firing after OM extraction.

---

## 2. Phase 2 field-level write times — extraction_events health

```sql
-- Recent extraction events by source type and field (last 7 days)
SELECT
  source_type,
  field_name,
  COUNT(*)                           AS event_count,
  MAX(written_at)                    AS latest_write,
  COUNT(DISTINCT deal_id)            AS distinct_deals
FROM extraction_events
WHERE written_at >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1, 2;
```

**Expected post-Phase 2 deploy:** OM rows (gpr, vacancy_pct, real_estate_tax,
contract_services, payroll, insurance, management_fee_pct, noi) should appear within
minutes of any OM document upload.

```sql
-- Check a specific deal's extraction event timeline
SELECT
  source_type,
  field_name,
  field_value,
  written_by,
  written_at
FROM extraction_events
WHERE deal_id = '<deal-uuid>'
ORDER BY written_at DESC;
```

---

## 3. Bishop canonical test case

Deal: `3f32276f-aacd-4da3-b306-371c5109b403`

```sql
-- Post-#696 DQA alert state
SELECT classification, proforma_row, proforma_column, severity, status, created_at
FROM data_quality_alerts
WHERE deal_id = '3f32276f-aacd-4da3-b306-371c5109b403'
ORDER BY created_at DESC
LIMIT 20;

-- Phase 2: extraction events for Bishop OM fields
SELECT field_name, field_value, written_at, written_by
FROM extraction_events
WHERE deal_id      = '3f32276f-aacd-4da3-b306-371c5109b403'
  AND source_type  = 'OM'
ORDER BY written_at DESC;
```

**Expected post-#696 + Phase 2 state:**
- `contract_services / broker` → `NOT_IN_DOC` (info)
- `gpr / broker` → no finding (correctly populated)
- No new `SEED_PLUMBING` findings (post-call filter drops retired tag)
- Extraction events: 8 OM rows (gpr through noi) present if OM was re-uploaded

---

## 4. Legacy SEED_PLUMBING row monitoring

Existing `SEED_PLUMBING` rows are left as-is (Option B migration — no backfill).
Track how many remain open to understand the natural age-out rate.

```sql
-- Legacy SEED_PLUMBING open findings (should trend to zero over weeks)
SELECT
  DATE_TRUNC('week', created_at) AS cohort_week,
  COUNT(*)                        AS still_open
FROM data_quality_alerts
WHERE classification = 'SEED_PLUMBING'
  AND status = 'open'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## 5. Signed-delta accuracy check (Phase 2 only)

Once `extraction_events` is populated, compare the Phase 2 signed-delta
classification with the Phase 1 proxy for the same findings to estimate
the historical proxy misclassification rate.

```sql
-- For each WRITE_RACE or STALE_SEED finding, compare classification
-- against the extraction_events-based delta for the same deal/field.
-- Run after Phase 2 has 2+ weeks of data.
SELECT
  dqa.id,
  dqa.proforma_row,
  dqa.proforma_column,
  dqa.classification                   AS phase1_classification,
  ee.written_at                        AS source_written_at,
  da.updated_at                        AS seed_written_at,
  EXTRACT(EPOCH FROM (da.updated_at - ee.written_at))
                                       AS delta_seconds,
  CASE
    WHEN ee.written_at IS NULL         THEN 'unknown_source'
    WHEN da.updated_at >= ee.written_at THEN 'SEED_PLUMBING_WRITE_RACE'
    ELSE                                    'SEED_PLUMBING_STALE_SEED'
  END                                  AS phase2_classification,
  CASE
    WHEN ee.written_at IS NULL         THEN 'n/a'
    WHEN dqa.classification = CASE
      WHEN da.updated_at >= ee.written_at THEN 'SEED_PLUMBING_WRITE_RACE'
      ELSE 'SEED_PLUMBING_STALE_SEED'
    END THEN 'match'
    ELSE 'MISMATCH'
  END                                  AS agreement
FROM data_quality_alerts dqa
JOIN deals d ON d.id = dqa.deal_id
LEFT JOIN deal_assumptions da ON da.deal_id = dqa.deal_id
LEFT JOIN LATERAL (
  SELECT written_at
  FROM extraction_events
  WHERE deal_id    = dqa.deal_id
    AND source_type = dqa.document_type
    AND field_name  = dqa.proforma_row
  ORDER BY written_at DESC
  LIMIT 1
) ee ON TRUE
WHERE dqa.classification IN ('SEED_PLUMBING_WRITE_RACE', 'SEED_PLUMBING_STALE_SEED')
  AND dqa.status = 'open'
ORDER BY agreement DESC, dqa.created_at DESC
LIMIT 50;
```

A low `MISMATCH` rate (< 5%) confirms Phase 1 proxy was acceptable. A high rate
motivates wiring Phase 2 `fetchFieldWriteTimes()` into the DQA timestamp lookup
(currently a Phase 2 TODO in `data-quality-agent.service.ts`).
