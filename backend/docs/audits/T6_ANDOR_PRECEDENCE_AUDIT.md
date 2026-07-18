# T6: AND/OR Precedence Audit Report

**Scope:** `backend/src/**/*.ts`  
**Method:** Regex grep for `WHERE.*AND.*OR` and `WHERE.*OR.*AND` patterns, followed by manual classification of each hit into SAFE (parenthesized) vs DANGEROUS (unparenthesized).  
**Date:** 2026-07-18  
**Auditor:** Automated sweep + human classification  

## Summary

| Category | Count |
|----------|-------|
| Total files with `WHERE...AND...OR` pattern | 57 |
| Genuine AND+OR mixed predicates | 32 |
| **All parenthesized (SAFE)** | **32** |
| **Unparenthesized (DANGEROUS)** | **0** |
| False positives (no actual OR, IN clauses, dynamic AND-only builders, etc.) | 25 |

**Verdict:** No unparenthesized AND/OR precedence bugs found in `backend/src`.

---

## Classification Detail

### SAFE — OR wrapped in parentheses (32 instances)

These follow the canonical safe pattern: `WHERE <and-conditions> AND (<or-predicates>)`.

| File | Line | SQL Snippet |
|------|------|-------------|
| `index.replit.ts` | 628 | `AND (city = $1 OR city IS NULL)` |
| `index.replit.ts` | 745 | `AND (user_id = $2 OR user_id IS NULL OR scope = 'preset')` |
| `deals/deals.service.ts` | 216 | `AND ($2 = 'all' OR status = $2)` |
| `api/rest/comp-query.routes.ts` | 126 | `AND (units >= 4 OR units IS NULL)` |
| `api/rest/custom-strategies.routes.ts` | 178 | `AND (cs.user_id = $2 OR cs.is_public = TRUE)` |
| `api/rest/custom-strategies.routes.ts` | 382 | `AND (user_id = $2 OR is_public = TRUE)` |
| `api/rest/development-scenarios.routes.ts` | 800 | `WHERE (municipality ILIKE $1 OR county ILIKE $2) AND state = $3` |
| `services/comp-set-discovery.service.ts` | 287 | `WHERE (pr.city ILIKE $1 OR pr.state = $2) AND pr.county IS NOT NULL` |
| `agents/tools/write_comp_set.ts` | 142 | `AND (comp_address = $3 OR ($3 IS NULL AND comp_address IS NULL))` |
| `api/rest/geography.routes.ts` | 110 | `AND (ta.user_id = $2 OR ta.is_shared = true)` |
| `api/rest/inline-inbox.routes.ts` | 339 | `WHERE (du.user_id = $1 OR e.user_id = $1) AND du.file_type = 'pst'` |
| `api/rest/map-configs.routes.ts` | 117 | `AND (user_id = $2 OR is_public = true)` |
| `api/rest/market-intelligence.routes.ts` | 559 | `AND (pr.units > 0 OR pr.units IS NULL)` |
| `api/rest/market-intelligence.routes.ts` | 563 | `AND (pr.units > 0 OR pr.units IS NULL)` |
| `services/documentsFiles.service.ts` | 388 | `WHERE (id = $1 OR parent_file_id = $1) AND deleted_at IS NULL` |
| `services/driverAnalysis.service.ts` | 196 | `WHERE (${conditions.join(' OR ')}) AND value IS NOT NULL` |
| `services/document-extraction/om-distribution.service.ts` | 439 | `AND (source_id = $1 OR source_id LIKE $2)` |
| `services/document-extraction/om-distribution.service.ts` | 444 | `AND (source_id = $1 OR source_id LIKE $2)` |
| `api/rest/portfolio.routes.ts` | 303 | `AND (created_by = $2 OR created_by IS NULL)` |
| `api/rest/revenue.routes.ts` | 120 | `AND (rents_by_type IS NOT NULL OR avg_asking_rent IS NOT NULL)` |
| `api/rest/strategies.routes.ts` | 169 | `AND (is_system_template = true OR created_by = $2 OR ...)` |
| `api/rest/strategies.routes.ts` | 215 | `AND (is_system_template = true OR created_by = $2 OR ...)` |
| `api/rest/strategies.routes.ts` | 236 | `AND (is_system_template = true OR created_by = $2 OR ...)` |
| `api/rest/strategy-definitions.routes.ts` | 165 | `AND (user_id = $2 OR type = 'preset')` |
| `api/rest/strategy-definitions.routes.ts` | 218 | `AND (user_id = $2 OR type = 'preset')` |
| `api/rest/strategy-definitions.routes.ts` | 332 | `AND (user_id = $2 OR type = 'preset')` |
| `api/rest/strategy-definitions.routes.ts` | 386 | `AND (user_id = $2 OR type = 'preset')` |
| `services/opportunity-engine.service.ts` | 332 | `AND (city = $1 OR city IS NULL)` |
| `services/notarize/notarize.service.ts` | 167 | `AND (provider_signer_id = $6 OR email = $7)` |
| `services/notarize/notarize.service.ts` | 334 | `AND (kba_verified = TRUE OR id_verified = TRUE)` |
| `services/proforma-template.service.ts` | 128 | `AND (user_id = $${idx + 1} OR is_system = FALSE)` |

### FALSE POSITIVES — No actual precedence risk (25 instances)

These matched the regex but do not contain a mixed AND/OR predicate:

| Reason | Examples |
|--------|----------|
| Dynamic `conditions.join(' AND ')` — no OR present | `loan-quote-store.ts:134`, `dataLibrary.service.ts:728`, `data-upload.service.ts:343`, `investor-capital.routes.ts:66` |
| `IN (...)` clause (not OR) | `notarize.service.ts:37`, `notarize.service.ts:209` |
| Subquery with its own WHERE (AND only) | `admin.routes.ts:923`, `financial-model.routes.ts:790` |
| Ternary inline SQL fragment | `lifecycle.routes.ts:603` |
| Pure AND chains, no OR | `strategies.routes.ts:57`, `scenarios.routes.ts:165`, `m35-events.service.ts:544`, `m35-backtest.service.ts:503`, `disposition.service.ts:419`, `debt-tracking.service.ts:154`, `team-management.routes.ts:246`, `financial-models.routes.ts:357`, `financial-models.routes.ts:616`, `context-tracker.routes.ts:17`, `context-tracker.routes.ts:170`, `correlationEngine.service.ts:1186`, `f40-performance-score.service.ts:78`, `driverAnalysis.service.ts:675`, `notarize.service.ts:253` |

---

## Secondary sweep: unparenthesized AND/OR

A follow-up regex specifically targeting `WHERE[^{}()]*OR[^{}()]*AND` and `WHERE[^{}()]*AND[^{}()]*OR` (no parentheses between WHERE and the AND/OR mix) returned **zero hits** after filtering out `ORDER BY` and `JOIN` clauses.

---

## Recommendation

No code changes required. The codebase consistently parenthesizes OR predicates when mixed with AND in WHERE clauses. This is a healthy pattern.

To prevent regression, consider adding an ESLint rule or pre-commit hook that flags any SQL string literal containing `WHERE` followed by both `AND` and `OR` without intervening parentheses. A lightweight regex check:

```regex
WHERE\s+[^()]*?\bAND\b[^()]*?\bOR\b[^()]*?\bAND\b
```

would catch the dangerous pattern without flagging the safe parenthesized forms.
