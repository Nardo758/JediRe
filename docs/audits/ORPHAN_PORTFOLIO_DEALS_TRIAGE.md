# Orphaned Portfolio Deals Triage

**Audit date:** 2026-06-29  
**Scope:** Nine `deal_category='portfolio'` deal rows from a February 2026 seed batch, orphaned by the A8-F1 fix.  
**Excluded:** `eaabeb9f` (Highlands at Sweetwater Creek) — confirmed real owned asset, untouched.  
**Method:** Full reference scan across all 210 base tables with a `deal_id` column, plus downstream `property_id` scan for linked property stubs.

---

## Key upfront finding

**Zero `deal_monthly_actuals` rows for any of the 9 deals.** No actuals data exists. All 9 linked `properties` rows have `name = NULL` — synthetic stubs auto-created by the old deal-creation flow, with no independent downstream references beyond circular back-references to `deal_properties` and `deals` themselves.

---

## Reference scan — per row

| Table | fb46a388 College Park | 7235a6f9 Midtown Tower | 8205a985 Westside Lofts | 9ee2bc0c Alpharetta | 451d65eb Sandy Springs | 5191737b Downtown OC | 5d738adc Buckhead Lux | c7a7338a Midtown MU | 1f8e270a Buckhead MU |
|---|---|---|---|---|---|---|---|---|---|
| **deal_activity** | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **deal_properties** | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **jedi_score_history** | 65 | 65 | 65 | 65 | 65 | 65 | 65 | 65 | 65 |
| **properties** (stub) | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **state_transitions** | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| deal_rent_comp_sets | — | — | — | 8 | 15 | — | 15 | 16 | 15 |
| news_event_geo_impacts | — | 1 | — | — | 1 | — | 1 | 3 | 2 |
| deal_assumptions | — | — | 1 | — | — | — | — | — | — |
| deal_underwriting_snapshots | — | — | 3 | — | — | — | — | — | — |
| underwriting_evidence | — | — | 52 | — | — | — | — | — | — |
| cashflow_projections | — | — | 1 | — | — | — | — | — | — |
| agent_runs | — | — | 3 | — | — | — | — | — | — |
| ai_usage_log | — | — | 35 | — | — | — | — | — | — |
| **deal_monthly_actuals** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

---

## Table classification

The reference tables fall into two categories:

**Auto-generated / uniformly seeded (non-meaningful):**

| Table | Pattern | Assessment |
|---|---|---|
| `deal_activity` | 1 row per deal — "deal created" event | Auto-created by deal creation handler |
| `state_transitions` | 1 row per deal — initial status set | Auto-created by state machine |
| `jedi_score_history` | exactly 65 rows per deal across all 9 | Uniform seed batch; identical count proves synthetic origin |
| `properties` (stub) | 1 row per deal, `name = NULL` | Auto-created stub; zero downstream dependents; property_id scan confirms only back-refs to `deals` and `deal_properties` |
| `deal_properties` | 1 row per deal — junction | Circular reference back to the deal itself |

**Potentially meaningful data (requires human decision before deletion):**

| Table | Deals affected | Assessment |
|---|---|---|
| `deal_rent_comp_sets` | 4 deals (8–16 rows each) | Seeded comp sets, but non-zero analytical intent |
| `news_event_geo_impacts` | 4 deals (1–3 rows each) | Auto-matched news; low-value but non-trivial |
| `deal_assumptions` | Westside Lofts only (1 row) | Actual underwriting assumptions entered |
| `deal_underwriting_snapshots` | Westside Lofts only (3 rows) | Snapshotted underwriting state |
| `underwriting_evidence` | Westside Lofts only (52 rows) | AI-produced evidence citations — substantial |
| `cashflow_projections` | Westside Lofts only (1 row) | Computed projection |
| `agent_runs` + `ai_usage_log` | Westside Lofts only (3 + 35 rows) | Real AI activity performed on this deal |

---

## Row-level classification

> **None of the 9 qualify as "safe-to-delete" (zero references)** under the strict definition — all have at least the 5 auto-generated reference tables. Within the `has-references` class, three tiers emerge:

### Tier 1 — Metadata-only (2 deals)

All references are auto-generated. No comp sets, no news impacts, no analytical data.

| Deal ID | Name | Status |
|---|---|---|
| `fb46a388` | College Park Workforce Housing | CLOSED_OWNED |
| `5191737b` | Downtown Office Conversion | PROSPECT |

**Human judgment required:** only the uniform-seed metadata tables. If those are acceptable to cascade-delete, these 2 are the lowest-risk candidates.

### Tier 2 — Metadata + auto-matched news (1 deal)

| Deal ID | Name | Extra ref |
|---|---|---|
| `7235a6f9` | Midtown Tower | `news_event_geo_impacts`: 1 |

**Human judgment required:** same as Tier 1 plus 1 auto-matched news geo row.

### Tier 3 — Metadata + seeded comp sets (5 deals)

| Deal ID | Name | deal_rent_comp_sets | news_event_geo_impacts |
|---|---|---|---|
| `9ee2bc0c` | Alpharetta Retail Center | 8 | — |
| `451d65eb` | Sandy Springs Office Park | 15 | 1 |
| `5d738adc` | Buckhead Luxury Apartments | 15 | 1 |
| `c7a7338a` | Midtown Mixed-Use Development | 16 | 3 |
| `1f8e270a` | Buckhead Mixed-Use Development | 15 | 2 |

**Human judgment required:** confirm comp sets are seeded detritus before deletion. No actuals, no underwriting data.

### Tier 4 — Substantial analytical data (1 deal)

| Deal ID | Name | Key refs |
|---|---|---|
| `8205a985` | Westside Lofts | `underwriting_evidence`: 52, `deal_underwriting_snapshots`: 3, `deal_assumptions`: 1, `agent_runs`: 3, `ai_usage_log`: 35, `cashflow_projections`: 1 |

**Do not delete without explicit human review.** This deal had real AI analytical activity. The 52 `underwriting_evidence` rows represent actual LLM-produced citations. Whether that analytical work has any value is a human call.

---

## Recommendation

1. **Tiers 1 and 2** (3 deals: College Park, Downtown OC, Midtown Tower): strongest candidates for deletion. References are exclusively auto-generated or auto-matched. Confirm with the migration script below.

2. **Tier 3** (5 deals): safe to delete if you're comfortable losing the seeded comp sets. No actuals, no underwriting. The comp sets are uniform-batch seeded and serve no live query. Deletable alongside Tier 1/2 if confirmed.

3. **Tier 4** (Westside Lofts, `8205a985`): **flag for explicit human review**. The underwriting evidence and AI activity make this materially different from the others. Options: archive the underwriting outputs before deleting, or leave the deal in place as a read-only artifact.

**Draft migration is at:** `backend/src/database/migrations/20260629_delete_orphan_portfolio_deals.sql`  
It uses `BEGIN / ROLLBACK` (not `COMMIT`) — safe to run for a dry preview, will not persist until `ROLLBACK` is changed to `COMMIT`.

---

## Deletion cascade order

For any deal chosen for deletion, the correct delete order (child-before-parent) is:

```
1. underwriting_evidence          (deal_id FK)
2. deal_underwriting_snapshots    (deal_id FK)
3. deal_assumptions               (deal_id FK)
4. cashflow_projections           (deal_id FK)
5. agent_runs                     (deal_id FK)
6. ai_usage_log                   (deal_id FK)
7. news_event_geo_impacts         (deal_id FK)
8. deal_rent_comp_sets            (deal_id FK)
9. jedi_score_history             (deal_id FK)
10. deal_activity                 (deal_id FK)
11. state_transitions             (deal_id FK)
12. deal_properties               (deal_id FK + property_id FK)
13. properties                    (deal_id FK — the stub rows)
14. deals                         (the target rows)
```
