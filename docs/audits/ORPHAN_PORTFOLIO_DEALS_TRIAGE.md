# Orphaned Portfolio Deals Triage

**Audit date:** 2026-06-29  
**Scope:** Nine `deal_category='portfolio'` deal rows from a February 2026 seed batch, orphaned by the A8-F1 fix.  
**Excluded:** `eaabeb9f` (Highlands at Sweetwater Creek) — confirmed real owned asset, untouched.  
**Method:** Per-table loop across all 210 base tables with a `deal_id` column (type-aware UUID/text query per table), plus a downstream `property_id` scan for linked property stub rows. Full table list in the appendix.

---

## Key upfront finding

**Zero `deal_monthly_actuals` rows for any of the 9 deals.** No actuals data exists. All 9 linked `properties` rows have `name = NULL` — synthetic stubs auto-created by the old deal-creation flow, with no independent downstream references beyond circular back-references to `deal_properties` and `deals` themselves.

---

## Mandated tables — explicit zero confirmation

Counts across all 9 deals combined for the FK tables called out in the task requirements:

| Table | Total rows across all 9 deals | Notes |
|---|---|---|
| `deal_files` | **0** | No files attached to any of the 9 deals |
| `deal_waterfalls` | **0** | No waterfall configs |
| `capital_calls` | **0** | No capital call records |
| `deal_investments` | **0** | No investor records (`investors` is `deal_investments` in schema) |
| `market_sale_comps` | **0** | No sale comps linked |
| `deal_comments` | **0** | No comments |
| `deal_monthly_actuals` | **0** | No actuals data (confirmed independently via `deal_id` scan) |
| `deal_assumptions` | **1** | Westside Lofts only (`8205a985`) — see Tier 4 |
| `market_rent_comps` | **0** | No rent comp records |

---

## Full reference scan — per row

Only non-zero counts are shown. All tables not listed for a given deal returned 0.

| Table | fb46a388 College Park | 7235a6f9 Midtown Tower | 8205a985 Westside Lofts | 9ee2bc0c Alpharetta | 451d65eb Sandy Springs | 5191737b Downtown OC | 5d738adc Buckhead Lux | c7a7338a Midtown MU | 1f8e270a Buckhead MU |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **deal_activity** | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **deal_properties** | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **jedi_score_history** | 65 | 65 | 65 | 65 | 65 | 65 | 65 | 65 | 65 |
| **properties** (stub) | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **state_transitions** | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| deal_rent_comp_sets | 0 | 0 | 0 | 8 | 15 | 0 | 15 | 16 | 15 |
| news_event_geo_impacts | 0 | 1 | 0 | 0 | 1 | 0 | 1 | 3 | 2 |
| deal_assumptions | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 |
| deal_underwriting_snapshots | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 |
| underwriting_evidence | 0 | 0 | **52** | 0 | 0 | 0 | 0 | 0 | 0 |
| cashflow_projections | 0 | 0 | **1** | 0 | 0 | 0 | 0 | 0 | 0 |
| agent_runs | 0 | 0 | **3** | 0 | 0 | 0 | 0 | 0 | 0 |
| ai_usage_log | 0 | 0 | **35** | 0 | 0 | 0 | 0 | 0 | 0 |
| deal_files | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| deal_waterfalls | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| capital_calls | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| deal_investments | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| market_sale_comps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| deal_comments | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| market_rent_comps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **All other 189 tables** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

---

## Table classification

**Auto-generated / uniformly seeded (non-meaningful):**

| Table | Pattern | Assessment |
|---|---|---|
| `deal_activity` | 1 row per deal — "deal created" event | Auto-created by deal creation handler |
| `state_transitions` | 1 row per deal — initial status set | Auto-created by state machine |
| `jedi_score_history` | exactly 65 rows per deal across all 9 | Uniform seed batch; identical count proves synthetic origin |
| `properties` (stub) | 1 row per deal, `name = NULL` | Auto-created stub; zero downstream dependents; property_id scan confirms only back-refs to `deals` and `deal_properties` |
| `deal_properties` | 1 row per deal — junction | Circular reference back to the deal itself |

**Non-zero but potentially synthetic (requires human confirmation):**

| Table | Deals affected | Assessment |
|---|---|---|
| `deal_rent_comp_sets` | 4 deals (8–16 rows each) | Seeded comp sets, but non-zero analytical intent |
| `news_event_geo_impacts` | 4 deals (1–3 rows each) | Auto-matched news; low-value but non-trivial |

**Meaningful analytical data (do not delete without explicit human review):**

| Table | Deals affected | Assessment |
|---|---|---|
| `deal_assumptions` | Westside Lofts only (1 row) | Actual underwriting assumptions entered |
| `deal_underwriting_snapshots` | Westside Lofts only (3 rows) | Snapshotted underwriting state |
| `underwriting_evidence` | Westside Lofts only (52 rows) | AI-produced evidence citations — substantial |
| `cashflow_projections` | Westside Lofts only (1 row) | Computed projection |
| `agent_runs` + `ai_usage_log` | Westside Lofts only (3 + 35 rows) | Real AI activity performed on this deal |

---

## Row-level classification

> **None of the 9 qualify as "safe-to-delete" (zero references)** under the strict definition — all have at least the 5 auto-generated reference tables. Within the `has-references` class, three tiers emerge:

### Tier 1 — Metadata-only (2 deals) — `has-references`

All references are auto-generated seeded metadata. No comp sets, no news impacts, no analytical data.

| Deal ID | Name | Status |
|---|---|---|
| `fb46a388` | College Park Workforce Housing | CLOSED_OWNED |
| `5191737b` | Downtown Office Conversion | PROSPECT |

**References to resolve before deletion:** deal_activity (1 each), state_transitions (1 each), deal_properties (1 each), jedi_score_history (65 each), properties stub (1 each).

### Tier 2 — Metadata + 1 auto-matched news row (1 deal) — `has-references`

| Deal ID | Name | Extra ref |
|---|---|---|
| `7235a6f9` | Midtown Tower | `news_event_geo_impacts`: 1 |

### Tier 3 — Metadata + seeded comp sets (5 deals) — `has-references`

| Deal ID | Name | deal_rent_comp_sets | news_event_geo_impacts |
|---|---|---|---|
| `9ee2bc0c` | Alpharetta Retail Center | 8 | 0 |
| `451d65eb` | Sandy Springs Office Park | 15 | 1 |
| `5d738adc` | Buckhead Luxury Apartments | 15 | 1 |
| `c7a7338a` | Midtown Mixed-Use Development | 16 | 3 |
| `1f8e270a` | Buckhead Mixed-Use Development | 15 | 2 |

**Human judgment required:** confirm comp sets are seeded detritus before deletion.

### Tier 4 — Substantial analytical data (1 deal) — `has-references`, flag for explicit review

| Deal ID | Name | Key refs |
|---|---|---|
| `8205a985` | Westside Lofts | `underwriting_evidence`: 52, `deal_underwriting_snapshots`: 3, `deal_assumptions`: 1, `agent_runs`: 3, `ai_usage_log`: 35, `cashflow_projections`: 1 |

**Do not delete without explicit human review.** See Task #1867.

---

## Recommendation

1. **Tiers 1 and 2** (3 deals): strongest candidates for deletion. All references are auto-generated or auto-matched.
2. **Tier 3** (5 deals): safe to delete if comp sets are confirmed seeded detritus. No actuals, no underwriting.
3. **Tier 4** (Westside Lofts): flag for explicit human review before any deletion action.

**Migration file:** `backend/src/database/migrations/20260629_delete_orphan_portfolio_deals.sql`  
Contains `BEGIN / ROLLBACK` — safe to run for preview; change to `COMMIT` only after human approval per tier. IN list is currently empty pending human decision.

---

## Deletion cascade order

For any deal chosen for deletion, the correct child-before-parent order:

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
13. properties                    (deal_id FK — stub rows only, name IS NULL guard)
14. deals                         (target rows)
```

---

## Appendix — Scan completeness

**210 base tables scanned** (all `table_type = 'BASE TABLE'` with a `deal_id` column in `public` schema):

`activity_log`, `actual_performance`, `agent_activity_log`, `agent_chat_logs`, `agent_collaboration_after_tax_returns`, `agent_collaboration_debt_recommendations`, `agent_collaboration_legal_protections`, `agent_collaboration_pricing_recommendations`, `agent_collaboration_variance_impacts`, `agent_data_matrix_cache`, `agent_events`, `agent_runs`, `agent_workflow_runs`, `ai_usage_log`, `alerts`, `analysis_results`, `apartment_api_sync_log`, `asset_news_links`, `asset_notes`, `assumption_adjustments`, `assumption_history`, `assumption_outcomes`, `assumption_override_training_signals`, `assumption_snapshots`, `balance_sheets`, `broker_narratives`, `building_designs_3d`, `capex_actuals`, `capex_budget`, `capital_account_entries`, `capital_calls`, `cashflow_projections`, `comp_pricing_alerts`, `comp_pricing_snapshots`, `comp_properties`, `competitive_sets`, `confirmation_chain_results`, `costar_submarket_stats`, `custom_metric_values`, `custom_strategy_usage`, `data_library_assets`, `data_library_files`, `data_library_files_legacy`, `data_quality_alerts`, `dd_checklists`, `deal_activity`, `deal_agent_tasks`, `deal_alerts`, `deal_annotations`, `deal_assumptions`, `deal_balance_sheets`, `deal_capex_items`, `deal_collaborators`, `deal_comments`, `deal_comparable_properties`, `deal_compliance_issues`, `deal_contacts`, `deal_context_fields`, `deal_context_items`, `deal_contexts`, `deal_contract_clauses`, `deal_custom_tabs`, `deal_debt_schedule`, `deal_decisions`, `deal_designs`, `deal_document_files`, `deal_documents`, `deal_emails`, `deal_files`, `deal_financial_models`, `deal_handoffs`, `deal_investments`, `deal_key_dates`, `deal_lease_transactions`, `deal_leasing_metrics`, `deal_lifecycle_events`, `deal_market_data`, `deal_market_intelligence`, `deal_modules`, `deal_monthly_actuals`, `deal_monthly_assumptions`, `deal_notes`, `deal_notifications`, `deal_pipeline`, `deal_properties`, `deal_rate_sheets`, `deal_receivables_aging`, `deal_reconciliation_log`, `deal_rent_comp_sets`, `deal_risks`, `deal_roadmaps`, `deal_scenarios`, `deal_shares`, `deal_signal_acknowledgements`, `deal_state_tracking`, `deal_structuring_recommendations`, `deal_task_comments`, `deal_tasks`, `deal_team_activity`, `deal_team_assignments`, `deal_team_comments`, `deal_team_members`, `deal_team_notifications`, `deal_team_roster`, `deal_team_tasks`, `deal_timelines`, `deal_traffic_comp_selections`, `deal_traffic_snapshots`, `deal_underwriting_scenarios`, `deal_underwriting_snapshots`, `deal_unit_programs`, `deal_versions`, `deal_waterfall_config`, `deal_waterfalls`, `deal_zoning_confirmations`, `deal_zoning_profiles`, `debt_positions`, `decision_log`, `deferred_maintenance`, `design_references`, `development_scenarios`, `disposition_cash_flows`, `dispositions`, `distributions`, `emails`, `entitlements`, `expense_inflation_observations`, `extraction_events`, `financial_models`, `historical_observations`, `identity_verifications`, `insurance_cost_observations`, `integration_events`, `investor_communications`, `jedi_score_history`, `jedi_scores`, `lease_events`, `lease_expiration_schedule`, `lease_transactions`, `leasing_events`, `lifecycle_reforecasts`, `market_rent_comps`, `market_research_metrics`, `market_research_reports`, `market_research_source_log`, `market_research_usage`, `market_sale_comps`, `monte_carlo_simulations`, `news_event_geo_impacts`, `news_items`, `notarize_sessions`, `notifications`, `operations_actuals`, `operations_recommendations`, `opus_conversations`, `opus_proforma_versions`, `other_income_tracking`, `platform_intel`, `proactive_alerts_log`, `proforma_assumptions`, `proforma_projections`, `properties`, `property_boundaries`, `property_dual_write_failures`, `property_zoning_cache`, `refi_test_scenarios`, `refinance_events`, `reforecasts`, `rent_inflation_observations`, `rent_roll`, `rent_roll_diffs`, `rent_roll_snapshots`, `rent_roll_units`, `revenue_management_snapshots`, `sale_comp_sets`, `signing_envelopes`, `site_intelligence`, `state_transitions`, `strategy_analyses`, `subject_traffic_history`, `supply_analyses`, `supply_events`, `tasks`, `tax_assessment_observations`, `tax_comp_analyses`, `tax_projections`, `traffic_counts`, `traffic_funnel`, `traffic_projection_overrides`, `traffic_projections`, `triangulation_outcomes`, `underwriting_evidence`, `unit_mix`, `user_notifications`, `user_saved_articles`, `variance_analysis`, `vendor_market_observations`, `weekly_traffic_snapshots`, `yardi_matrix_rent_survey`, `yardi_matrix_supply_pipeline`, `zoning_agent_analyses`, `zoning_analyses`, `zoning_capacity`, `zoning_outcomes`, `zoning_precedents`, `zoning_predictions`, `zoning_profiles`, `zoning_recommendations`, `zoning_triangulations`, `zoning_verification`, `zoning_verification_cases`

Tables with non-zero rows for any of the 9 deals (13 of 210):
`agent_runs`, `ai_usage_log`, `cashflow_projections`, `deal_activity`, `deal_assumptions`, `deal_properties`, `deal_rent_comp_sets`, `deal_underwriting_snapshots`, `jedi_score_history`, `news_event_geo_impacts`, `properties`, `state_transitions`, `underwriting_evidence`

Tables with zero rows for all 9 deals (197 of 210): all remaining tables, including all mandated tables listed above.
