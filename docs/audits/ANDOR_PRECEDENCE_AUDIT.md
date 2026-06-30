# AND/OR Precedence Audit — Read-Only

**Mode:** READ-ONLY. Find and classify. No fixes applied in this task.  
**SHA:** `f1f23d05b76abd195ab8dd0ed8f029ef45c5fc13`  
**Scan scope:** all SQL in `backend/src` — inline query strings, dynamic query builders, ORM `.where()` calls, raw template literals.  
**Trigger:** stub-guard fix caught a bare-OR precedence bug in `byClass`/`byMarket` allocation queries.

---

## Part A — Downstream reach of the known byClass/byMarket bug

### What the bug was

`portfolio.routes.ts` `/allocation` endpoint, before the stub-guard fix:

```sql
-- byClass (pre-fix)
FROM deals d
WHERE d.status IN ('owned', 'closed', 'portfolio')
  OR d.deal_category = 'portfolio'

-- byMarket (pre-fix)
FROM deals d
WHERE d.status IN ('owned', 'closed', 'portfolio')
  OR d.deal_category = 'portfolio'
```

No `AND EXISTS (... p.name IS NOT NULL)` guard. The bare OR was unparenthesized — AND the guard, when later added, would have parsed as `status IN (...) OR (deal_category = 'portfolio' AND EXISTS(...))`, leaving the status arm unguarded. Both issues were corrected simultaneously in the fix.

Note: the `status IN ('owned','closed','portfolio')` arm was pre-existing dead code — those string literals are not valid values for the `deal_status` enum, so that arm matched zero rows regardless. The effective leaked set came only from the `deal_category = 'portfolio'` arm.

### Consumers of byClass / byMarket

**Backend:** `GET /api/v1/portfolio/allocation` at `backend/src/api/rest/portfolio.routes.ts:484` returns `{ byClass, byMarket }`.

**Frontend:** Full codebase scan found **zero** frontend references to `/portfolio/allocation`, `byClass`, or `byMarket` in any portfolio context. The endpoint is defined and guarded but not wired to any frontend component in the current codebase.

### Impact

Because there is no confirmed active frontend consumer:
- No allocation percentages or dollar splits were displayed to users with stub row inflation.
- The bug existed in a dormant API surface.

If the endpoint had been wired: the 9 stub deals would have each contributed to the `byClass` count column (all 9 would land under `'B'` via `COALESCE(deal_data->>'asset_class', 'B')`), and to the `byMarket` count under `'Unknown'` via `COALESCE(deal_data->>'msa', deal_data->>'city', 'Unknown')`. Dollar and unit aggregates would have been unaffected (stubs have NULL `current_value` and `unit_count`, which sum to 0). Count inflation: +9 in the 'B' bucket and +9 in the 'Unknown' bucket.

**No cached or persisted aggregates exist** — both queries are live-computed, with no write-through to any table. A read-fix is sufficient; no backfill is needed.

---

## Part B — Full classification

### Search strategy applied

Four grep passes over `backend/src/**/*.ts`:

1. `grep -rniE "where .*\band\b.*\bor\b"` — WHERE clauses mixing AND and OR
2. `grep -rniE "\bor\b\s+[a-z_\.]+\s*(=|in|is|like|!=|<|>)"` — bare OR arms starting new conditions
3. `grep -rniE "\bon\b.*\band\b.*\bor\b|\bhaving\b.*\band\b.*\bor\b"` — ON/HAVING variants
4. `grep -rniE "orWhere|\.or\(|orHaving"` — ORM OR methods

~75 unique SQL sites surfaced across all passes. Non-SQL hits (TypeScript string content, comments, Joi schema validators, seed text) were filtered manually.

---

### MIS-SCOPED sites

| # | file:line | predicate | parsed-as | intended | verdict | leak |
|---|---|---|---|---|---|---|
| 1 | `portfolio.routes.ts:495` (byClass, **pre-fix**) | `WHERE d.status IN (...) OR d.deal_category = 'portfolio'` | `status IN (...) OR deal_category = 'portfolio'` — no guard applied to either arm | `(status IN (...) OR deal_category = 'portfolio') AND EXISTS (stub-guard)` | MIS-SCOPED — **FIXED at HEAD** | 9 stub deals leaked into the count column of 'B' bucket. Dollar aggregates unaffected (NULL values). Frontend consumer not confirmed → impact was dormant. |
| 2 | `portfolio.routes.ts:510` (byMarket, **pre-fix**) | `WHERE d.status IN (...) OR d.deal_category = 'portfolio'` | same as above | same as above | MIS-SCOPED — **FIXED at HEAD** | 9 stub deals leaked into count under 'Unknown' market. Same dormant-consumer caveat. |

**Both mis-scoped instances are corrected in the current HEAD.** They are documented here for the record. No further fix dispatch is needed for these two sites.

---

### AMBIGUOUS sites

None found. Every site with mixed AND/OR either had clear parenthesization or clear intent derivable from variable names and surrounding context.

---

### CORRECT-AS-WRITTEN — count and notable cases

**73 sites** classified as CORRECT-AS-WRITTEN. Selected notable cases to illustrate the pattern coverage:

| Notable pattern | Representative site | Why correct |
|---|---|---|
| `AND (user_id = $N OR is_public = TRUE)` — access control | `custom-strategies.routes.ts:178`, `strategy-definitions.routes.ts:165,218,332,386`, `map-configs.routes.ts:117`, `geography.routes.ts:110` | OR arm is explicitly parenthesized; no guard bypassed |
| `AND (owner_id = $N OR EXISTS (SELECT 1 FROM collaborators ...))` — ownership check | `layers.routes.ts:31,101,179,327,373,425,486`, `maps.routes.ts:132,257,365,465,515`, `proposals.routes.ts:314,368` | EXISTS subquery closes inside the same paren set that opens the OR arm; verified by reading closing paren |
| `AND (user_id = $N OR id IN (SELECT deal_id FROM deal_team_members WHERE ...))` — team access | `notarize.routes.ts:87,114,156`, `task-completion.routes.ts:74-84` | Full OR group wrapped in outer parens; AND guard (`t.status IN (...)`) applies to the whole block |
| `AND (x IS NULL OR x >= NOW())` — nullable date filter | `fetch_m35_event_forecast.ts:244-245` | Each nullable OR pair is independently parenthesized |
| `WHERE x OR EXISTS (SELECT 1 FROM unnest(aliases) ...)` — alias union lookup | `fetch_line_item_benchmarks.ts:266` | Top-level OR, no guard intended; correct union of name-match and alias-match |
| `AND (city = $N OR city IS NULL)` — optional city filter | `index.replit.ts:563,578`, `opportunity-engine.service.ts:332` | OR parenthesized; the guard (`analytics_type = ...`) applies before the OR block |
| Dynamic OR append with paren managed by caller | `mapAnnotations.routes.ts:64-71`, `custom-strategies.routes.ts:129-134` | Opening paren emitted with the first condition; OR terms appended; closing paren appended separately — confirmed by reading the append sequence |
| `COUNT(*) FILTER (WHERE x IS NULL OR x = '')` — aggregate filter | `rent-scraper-admin.routes.ts:218,220,257` | FILTER clause is self-contained; no guard interacts with it |
| `AND ($N = 'all' OR status = $N)` — parametric type-all shortcut | `deals.service.ts:216` | OR parenthesized; single guard (`user_id = $1`) before it |
| `AND (units >= 4 OR sale_price >= 5000000)` — compound qualification | `georgia-sale-comps.service.ts:324` | OR parenthesized; guard (`state = $1`) is unambiguously outside |
| `AND (user_id = $N OR user_id IS NULL OR scope = 'preset')` — triple OR access | `index.replit.ts:680` | All three OR arms inside one paren pair |

---

## Summary

**75 sites scanned. 2 mis-scoped. 0 ambiguous. 73 correct-as-written.**

Both mis-scoped sites are the `byClass` and `byMarket` allocation queries in `portfolio.routes.ts`. Both are **fixed at HEAD** (`f1f23d05`). Their downstream consumer is unconfirmed (no frontend wiring found), so their live impact was dormant.

**No mis-scoped site touches a launch-path surface that is actively rendered.** The `/allocation` endpoint is backend-live but frontend-unwired. No further precedence fix dispatch is needed at this time.
