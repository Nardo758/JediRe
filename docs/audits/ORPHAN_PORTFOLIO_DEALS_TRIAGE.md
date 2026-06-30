# Orphaned Portfolio Deals — Triage & Classification

**Audit date:** 2026-06-29  
**Revised:** 2026-06-30 (LEAVE-AND-DOCUMENT decision recorded; migration deleted)  
**Scope:** `deal_category='portfolio'` rows from the February 2026 seed batch, orphaned by the A8-F1 portfolio UX refactor.  
**Excluded always:** `eaabeb9f` (Highlands at Sweetwater Creek) — confirmed real owned asset.

---

## Recorded decision: LEAVE-AND-DOCUMENT

**No rows deleted. No migration executed. No migration file exists.**

These are synthetic stubs: zero actuals, NULL property names, no files, no waterfall, no capital calls. They are safe to leave in place. Deletion is deferred to a post-launch window where any FK cascade can be observed with lower blast radius. At that point, Tiers 1–3 (8 rows) may be deleted in a single scoped window. **See open items below for what must be resolved first.**

---

## Count reconciliation — 9 confirmed

A prior session turn referenced "10" orphan rows; a recount query settled this:

```sql
SELECT id, name, deal_category, status, created_at
FROM deals
WHERE deal_category = 'portfolio'
  AND id != 'eaabeb9f-830e-44f9-a923-56679ad0329d'   -- exclude Highlands
ORDER BY created_at;
```

**Result: 9 rows.** The "10" was a miscounting error in an earlier session turn. Live DB is authoritative.

---

## Mandated tables — explicit zero confirmation

Counts across all 9 deals combined:

| Table | Total rows (all 9) | Notes |
|---|:---:|---|
| `deal_files` | **0** | No files attached to any deal |
| `deal_waterfalls` | **0** | No waterfall configs |
| `capital_calls` | **0** | No capital call records |
| `deal_investments` | **0** | No investor records |
| `market_sale_comps` | **0** | No sale comps linked |
| `deal_comments` | **0** | No comments |
| `deal_monthly_actuals` | **0** | No actuals data |
| `market_rent_comps` | **0** | No rent comp records |
| `deal_assumptions` | **1** | Westside Lofts only — see Open Item #2 |

---

## Per-row inventory

| # | Deal ID | Name | Status | Seeded |
|---|---|---|---|---|
| 1 | `fb46a388` | College Park Workforce Housing | CLOSED_OWNED | 2026-02-09 |
| 2 | `7235a6f9` | Midtown Tower | CLOSED_OWNED | 2026-02-09 |
| 3 | `9ee2bc0c` | Alpharetta Retail Center | CLOSED_OWNED | 2026-02-09 |
| 4 | `451d65eb` | Sandy Springs Office Park | CLOSED_OWNED | 2026-02-09 |
| 5 | `5191737b` | Downtown Office Conversion | PROSPECT | 2026-02-09 |
| 6 | `5d738adc` | Buckhead Luxury Apartments | PROSPECT | 2026-02-09 |
| 7 | `c7a7338a` | Midtown Mixed-Use Development | PROSPECT | 2026-02-09 |
| 8 | `1f8e270a` | Buckhead Mixed-Use Development | UNDERWRITING | 2026-02-06 |
| 9 | `8205a985` | **Westside Lofts** *(open item)* | CLOSED_OWNED | 2026-02-09 |

**Evidence common to all 9:**
- `deal_monthly_actuals`: **0** rows (no actuals)
- `properties.name`: **NULL** on all linked stub rows
- `deal_files`, `deal_waterfalls`, `capital_calls`, `deal_investments`, `market_sale_comps`, `deal_comments`, `market_rent_comps`: **0** each
- `jedi_score_history`: exactly **65 rows per deal** — uniform batch seed, not real scoring history
- `deal_activity`, `state_transitions`, `deal_properties`: 1 row each — auto-created by deal creation handler

**Per-row non-zero additional references (rows 1–8 only):**

| Deal | `deal_rent_comp_sets` | `news_event_geo_impacts` |
|---|:---:|:---:|
| `fb46a388` College Park | 0 | 0 |
| `7235a6f9` Midtown Tower | 0 | 1 |
| `9ee2bc0c` Alpharetta Retail | 8 | 0 |
| `451d65eb` Sandy Springs Office | 15 | 1 |
| `5191737b` Downtown OC | 0 | 0 |
| `5d738adc` Buckhead Lux Apts | 15 | 1 |
| `c7a7338a` Midtown MU | 16 | 3 |
| `1f8e270a` Buckhead MU | 15 | 2 |

All rent comp sets and news impacts are system-auto-generated, not user-entered. Westside Lofts has additional meaningful references — see Open Item #2.

---

## Tier classification (for future deletion window, rows 1–8)

| Tier | Deals | Extra references beyond base auto-metadata |
|---|---|---|
| **T1** — metadata-only | `fb46a388`, `5191737b` | None |
| **T2** — + 1 auto-matched news row | `7235a6f9` | `news_event_geo_impacts`: 1 |
| **T3** — + seeded comp sets | `9ee2bc0c`, `451d65eb`, `5d738adc`, `c7a7338a`, `1f8e270a` | `deal_rent_comp_sets`: 8–16; some with 1–3 news impacts |

All T1–T3 have zero user-entered data. Deletion cascade order when the window opens:

```
1. underwriting_evidence          (deal_id FK)
2. deal_underwriting_snapshots    (deal_id FK)
3. deal_assumptions               (deal_id FK)
4. cashflow_projections           (deal_id FK)
5. agent_runs / ai_usage_log      (deal_id FK)
6. news_event_geo_impacts         (deal_id FK)
7. deal_rent_comp_sets            (deal_id FK)
8. jedi_score_history             (deal_id FK)
9. deal_activity                  (deal_id FK)
10. state_transitions             (deal_id FK)
11. deal_properties               (deal_id FK)
12. properties                    (stub rows — name IS NULL guard)
13. deals                         (target rows — deal_category='portfolio' guard)
```

---

## Consumer guard note (documentation only — no code in this task)

Any query that reads `deal_category = 'portfolio'` as a signal of a **live portfolio deal** (i.e., to populate dashboards, grid views, or rankings) will inadvertently surface these 9 stub rows until they are deleted. The following consumers need an exclusion guard scoped to rows where `deal_monthly_actuals` is empty or `properties.name IS NULL`:

| Consumer | File | Lines | Risk |
|---|---|---|---|
| Portfolio asset queries | `backend/src/api/rest/portfolio.routes.ts` | 370, 457, 483, 494 | Stub rows appear in the owned-portfolio asset list |
| Grid view | `backend/src/api/rest/grid.routes.ts` | 284, 329 | Stub deals appear in the deal grid |
| Dashboard analytics | `backend/src/api/rest/dashboard.routes.ts` | 480, 510, 626, 657 | JEDI score and post-close analytics skewed by stub rows |

`useDealMode` (frontend) and `rankings.routes.ts:566` also read this field but the rankings route already excludes portfolio at line 630 and `useDealMode` is a deal-level context selector (not a batch query), so risk is lower.

**This guard is a separate scoped dispatch — not part of this task.**

---

## Open items

### Open Item #1 — Consumer guard dispatch

Write the exclusion guard for `portfolio.routes.ts`, `grid.routes.ts`, and `dashboard.routes.ts` to filter out stub portfolio rows (zero actuals or `name IS NULL`). Scope: backend query changes only. Block on this before the deletion window if the dashboard is user-facing.

### Open Item #2 — Westside Lofts individual review (`8205a985`)

Westside Lofts is **not part of the leave-and-document batch.** It has meaningful AI-generated data that the other 8 do not:

| Table | Count |
|---|:---:|
| `underwriting_evidence` | 52 |
| `deal_underwriting_snapshots` | 3 |
| `deal_assumptions` | 1 |
| `cashflow_projections` | 1 |
| `agent_runs` | 3 |
| `ai_usage_log` | 35 |

Options: (a) retain permanently as an analysis archive, (b) export evidence then delete, (c) convert to a real deal. Requires explicit individual human decision. Do not batch with T1–T3.

---

## Appendix — Scan completeness

**210 base tables scanned** (`table_type = 'BASE TABLE'`, `deal_id` column present, `public` schema):

`activity_log`, `actual_performance`, `agent_activity_log`, `agent_chat_logs`, `agent_collaboration_after_tax_returns`, `agent_collaboration_debt_recommendations`, `agent_collaboration_legal_protections`, `agent_collaboration_pricing_recommendations`, `agent_collaboration_variance_impacts`, `agent_data_matrix_cache`, `agent_events`, `agent_runs`, `agent_workflow_runs`, `ai_usage_log`, `alerts`, `analysis_results`, `apartment_api_sync_log`, `asset_news_links`, `asset_notes`, `assumption_adjustments`, `assumption_history`, `assumption_outcomes`, `assumption_override_training_signals`, `assumption_snapshots`, `balance_sheets`, `broker_narratives`, `building_designs_3d`, `capex_actuals`, `capex_budget`, `capital_account_entries`, `capital_calls`, `cashflow_projections`, `comp_pricing_alerts`, `comp_pricing_snapshots`, `comp_properties`, `competitive_sets`, `confirmation_chain_results`, `costar_submarket_stats`, `custom_metric_values`, `custom_strategy_usage`, `data_library_assets`, `data_library_files`, `data_library_files_legacy`, `data_quality_alerts`, `dd_checklists`, `deal_activity`, `deal_agent_tasks`, `deal_alerts`, `deal_annotations`, `deal_assumptions`, `deal_balance_sheets`, `deal_capex_items`, `deal_collaborators`, `deal_comments`, `deal_comparable_properties`, `deal_compliance_issues`, `deal_contacts`, `deal_context_fields`, `deal_context_items`, `deal_contexts`, `deal_contract_clauses`, `deal_custom_tabs`, `deal_debt_schedule`, `deal_decisions`, `deal_designs`, `deal_document_files`, `deal_documents`, `deal_emails`, `deal_files`, `deal_financial_models`, `deal_handoffs`, `deal_investments`, `deal_key_dates`, `deal_lease_transactions`, `deal_leasing_metrics`, `deal_lifecycle_events`, `deal_market_data`, `deal_market_intelligence`, `deal_modules`, `deal_monthly_actuals`, `deal_monthly_assumptions`, `deal_notes`, `deal_notifications`, `deal_pipeline`, `deal_properties`, `deal_rate_sheets`, `deal_receivables_aging`, `deal_reconciliation_log`, `deal_rent_comp_sets`, `deal_risks`, `deal_roadmaps`, `deal_scenarios`, `deal_shares`, `deal_signal_acknowledgements`, `deal_state_tracking`, `deal_structuring_recommendations`, `deal_task_comments`, `deal_tasks`, `deal_team_activity`, `deal_team_assignments`, `deal_team_comments`, `deal_team_members`, `deal_team_notifications`, `deal_team_roster`, `deal_team_tasks`, `deal_timelines`, `deal_traffic_comp_selections`, `deal_traffic_snapshots`, `deal_underwriting_scenarios`, `deal_underwriting_snapshots`, `deal_unit_programs`, `deal_versions`, `deal_waterfall_config`, `deal_waterfalls`, `deal_zoning_confirmations`, `deal_zoning_profiles`, `debt_positions`, `decision_log`, `deferred_maintenance`, `design_references`, `development_scenarios`, `disposition_cash_flows`, `dispositions`, `distributions`, `emails`, `entitlements`, `expense_inflation_observations`, `extraction_events`, `financial_models`, `historical_observations`, `identity_verifications`, `insurance_cost_observations`, `integration_events`, `investor_communications`, `jedi_score_history`, `jedi_scores`, `lease_events`, `lease_expiration_schedule`, `lease_transactions`, `leasing_events`, `lifecycle_reforecasts`, `market_rent_comps`, `market_research_metrics`, `market_research_reports`, `market_research_source_log`, `market_research_usage`, `market_sale_comps`, `monte_carlo_simulations`, `news_event_geo_impacts`, `news_items`, `notarize_sessions`, `notifications`, `operations_actuals`, `operations_recommendations`, `opus_conversations`, `opus_proforma_versions`, `other_income_tracking`, `platform_intel`, `proactive_alerts_log`, `proforma_assumptions`, `proforma_projections`, `properties`, `property_boundaries`, `property_dual_write_failures`, `property_zoning_cache`, `refi_test_scenarios`, `refinance_events`, `reforecasts`, `rent_inflation_observations`, `rent_roll`, `rent_roll_diffs`, `rent_roll_snapshots`, `rent_roll_units`, `revenue_management_snapshots`, `sale_comp_sets`, `signing_envelopes`, `site_intelligence`, `state_transitions`, `strategy_analyses`, `subject_traffic_history`, `supply_analyses`, `supply_events`, `tasks`, `tax_assessment_observations`, `tax_comp_analyses`, `tax_projections`, `traffic_counts`, `traffic_funnel`, `traffic_projection_overrides`, `traffic_projections`, `triangulation_outcomes`, `underwriting_evidence`, `unit_mix`, `user_notifications`, `user_saved_articles`, `variance_analysis`, `vendor_market_observations`, `weekly_traffic_snapshots`, `yardi_matrix_rent_survey`, `yardi_matrix_supply_pipeline`, `zoning_agent_analyses`, `zoning_analyses`, `zoning_capacity`, `zoning_outcomes`, `zoning_precedents`, `zoning_predictions`, `zoning_profiles`, `zoning_recommendations`, `zoning_triangulations`, `zoning_verification`, `zoning_verification_cases`

**13 tables with non-zero rows for any of the 9 deals:**
`agent_runs`, `ai_usage_log`, `cashflow_projections`, `deal_activity`, `deal_assumptions`, `deal_properties`, `deal_rent_comp_sets`, `deal_underwriting_snapshots`, `jedi_score_history`, `news_event_geo_impacts`, `properties`, `state_transitions`, `underwriting_evidence`

**197 tables with zero rows for all 9 deals** — including all mandated tables listed above.
