# CLASSIFICATION MAP A — DATA + SURFACE CLASSIFICATION SPINE

**HEAD SHA:** `06296754a75dd5ba0abdb08894d1c696df4a169a`  
**Mode:** READ-ONLY — no mutations performed  
**Date:** 2026-06-30  
**Dispatch:** A (Breadth) — public/private classification + scoping rule  
**Dispatch B columns:** LEFT EMPTY — B fills action semantics (versioning/sharing/export)

---

## Summary Counts

| Classification | Tables | Terminal Surfaces | Deal-Capsule Modules |
|---|---|---|---|
| PUBLIC | ~110 | 1 (F7 News, mostly) | 4 (M04, M05, M06, M19) |
| PRIVATE | ~220 | 6 (F2, F3, F6, F8, F9, F10) | 20 |
| MIXED | **5 tables** | **3 surfaces** (F1, F4, F1-Deal) | **5 modules** (M02, M15, M20, M25, M27) |
| AMBIGUOUS | 0 | — | — |

**org_id-ready tables (9):** `activity_log`, `deal_agent_tasks`, `deal_templates`, `deals`, `investors`, `notarize_sessions`, `org_invitations`, `org_members`, `strategies`

---

## A1 — DATA LAYER

### SHARED VOCABULARY REMINDER
- **PUBLIC** = platform-ingested. Same for every tenant. Never org-filtered. Readable by all authenticated users.
- **PRIVATE** = user-generated. Belongs to one org/deal. Must be org-scoped.
- **MIXED** = both populations in one table. Requires split predicate.
- Scoping: PUBLIC → `requireAuth`, global. PRIVATE → `requireAuth` + `WHERE org_id = <ws>` or `WHERE deal_id IN (SELECT id FROM deals WHERE org_id = <ws>)`. MIXED → split predicate.

---

### Table Family: INFRASTRUCTURE / AUTH (PRIVATE — user-level, not org-scoped)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `users` | PRIVATE | user registration | user-level (no org filter needed for own record) | no |
| `refresh_tokens` | PRIVATE | auth system | WHERE user_id = caller | no |
| `password_reset_tokens` | PRIVATE | auth system | WHERE user_id = caller | no |
| `org_members` | PRIVATE | org admin | WHERE org_id = $ws | yes |
| `org_invitations` | PRIVATE | org admin | WHERE org_id = $ws | yes |
| `organizations` | PRIVATE | org admin | WHERE id = $ws | no |
| `subscriptions` | PRIVATE | billing | WHERE user_id = caller | no |
| `user_credit_balances` | PRIVATE | billing | WHERE user_id = caller | no |

---

### Table Family: DEALS (PRIVATE — all deal_* tables are tenant-owned)

All tables below have `deal_id` as a scope key. Deals themselves are `org_id`-stamped. Scoping rule for all: `requireAuth` + `WHERE deal_id IN (SELECT id FROM deals WHERE org_id = $ws)`.

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `deals` | PRIVATE | user-created | **yes** (direct org_id) |
| `deal_assumptions` | PRIVATE | user/agent writes | no — scoped via deal |
| `deal_monthly_actuals` | PRIVATE | operator uploads + actuals | no — scoped via deal |
| `deal_monthly_actuals_lines` | PRIVATE | same | no |
| `deal_monthly_assumptions` | PRIVATE | user writes | no |
| `deal_properties` | PRIVATE | user-created | no |
| `deal_documents` | PRIVATE | user uploads | no |
| `deal_document_files` | PRIVATE | user uploads | no |
| `deal_files` | PRIVATE | user uploads | no |
| `deal_file_access_log` | PRIVATE | system | no |
| `deal_notes` | PRIVATE | user-created | no |
| `deal_comments` | PRIVATE | user-created | no |
| `deal_tasks` | PRIVATE | user-created | no |
| `deal_task_comments` | PRIVATE | user-created | no |
| `deal_contacts` | PRIVATE | user-created | no |
| `deal_decisions` | PRIVATE | user-created | no |
| `deal_risks` | PRIVATE | user/agent | no |
| `deal_scenarios` | PRIVATE | user-created | no |
| `deal_underwriting_scenarios` | PRIVATE | user-created | no |
| `deal_underwriting_snapshots` | PRIVATE | system | no |
| `deal_versions` | PRIVATE | system | no |
| `deal_capsules` | PRIVATE | system | no |
| `capsule_shares` | PRIVATE | user-created | no |
| `capsule_external_shares` | PRIVATE | user-created | no |
| `capsule_summary` | PRIVATE | system | no |
| `deal_collaborators` | PRIVATE | user-created | no |
| `deal_shares` | PRIVATE | user-created | no |
| `deal_team_members` | PRIVATE | user-created | no |
| `deal_team_tasks` | PRIVATE | user-created | no |
| `deal_team_activity` | PRIVATE | system | no |
| `deal_team_assignments` | PRIVATE | user-created | no |
| `deal_team_comments` | PRIVATE | user-created | no |
| `deal_team_notifications` | PRIVATE | system | no |
| `deal_team_roster` | PRIVATE | user-created | no |
| `deal_alerts` | PRIVATE | system | no |
| `deal_signal_acknowledgements` | PRIVATE | user action | no |
| `deal_notifications` | PRIVATE | system | no |
| `deal_activity` | PRIVATE | system | no |
| `deal_lifecycle_events` | PRIVATE | system | no |
| `deal_state_tracking` | PRIVATE | system | no |
| `deal_debt_schedule` | PRIVATE | user/agent | no |
| `deal_waterfall_config` | PRIVATE | user-created | no |
| `deal_waterfalls` | PRIVATE | user/agent | no |
| `deal_investments` | PRIVATE | user-created | no |
| `deal_zoning_profiles` | PRIVATE | user/agent | no |
| `deal_zoning_confirmations` | PRIVATE | system | no |
| `deal_designs` | PRIVATE | user-created | no |
| `deal_rate_sheets` | PRIVATE | user uploads | no |
| `deal_lease_transactions` | PRIVATE | user uploads | no |
| `deal_leasing_metrics` | PRIVATE | system | no |
| `deal_traffic_snapshots` | PRIVATE | system | no |
| `deal_traffic_comp_selections` | PRIVATE | user-created | no |
| `deal_key_dates` | PRIVATE | user-created | no |
| `deal_roadmaps` | PRIVATE | system/agent | no |
| `deal_pipeline` | PRIVATE | system | no |
| `deal_summary` | PRIVATE | system | no |
| `deal_modules` | PRIVATE | system | no |
| `deal_context_fields` | PRIVATE | system | no |
| `deal_context_items` | PRIVATE | system | no |
| `deal_contexts` | PRIVATE | system | no |
| `deal_balance_sheets` | PRIVATE | system | no |
| `deal_financial_model_analyses` | PRIVATE | system/agent | no |
| `deal_financial_models` | PRIVATE | user/agent | no |
| `deal_market_data` | PRIVATE | system | no |
| `deal_market_intelligence` | PRIVATE | agent | no |
| `deal_capex_items` | PRIVATE | user-created | no |
| `deal_comparable_properties` | PRIVATE | user/agent selection | no |
| `deal_rent_comp_sets` | PRIVATE | user/agent selection | no |
| `deal_handoffs` | PRIVATE | system | no |
| `deal_reconciliation_log` | PRIVATE | system | no |
| `deal_receivables_aging` | PRIVATE | user uploads | no |
| `deal_structuring_recommendations` | PRIVATE | agent | no |
| `deal_contract_clauses` | PRIVATE | agent | no |
| `deal_compliance_issues` | PRIVATE | agent | no |
| `deal_timelines` | PRIVATE | system | no |
| `deal_historical_outcomes` | PRIVATE | system | no |
| `deal_unit_programs` | PRIVATE | user-created | no |
| `deal_custom_tabs` | PRIVATE | user-created | no |
| `deal_context_email_links` | PRIVATE | system | no |
| `deal_templates` | PRIVATE | user-created | **yes** (direct org_id) |
| `deal_agent_tasks` | PRIVATE | system | **yes** (direct org_id) |
| `deal_annotations` | PRIVATE | user-created | no |
| `deal_emails` | PRIVATE | system | no |
| `deal_role_templates` | PRIVATE | user-created | no |

---

### Table Family: PROFORMA / FINANCIALS (PRIVATE)

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `proforma_assumptions` | PRIVATE | user/agent | no |
| `proforma_projections` | PRIVATE | system | no |
| `proforma_snapshots` | PRIVATE | system | no |
| `proforma_adjustment_history` | PRIVATE | user/agent | no |
| `proforma_line_item_anchors` | PRIVATE | user/agent | no |
| `cashflow_projections` | PRIVATE | system | no |
| `assumption_snapshots` | PRIVATE | system | no |
| `assumption_history` | PRIVATE | user/agent | no |
| `assumption_adjustments` | PRIVATE | user/agent | no |
| `assumption_outcomes` | PRIVATE | system | no |
| `assumption_override_training_signals` | PRIVATE | user/agent | no |
| `opus_proforma_versions` | PRIVATE | system | no |
| `deal_underwriting_snapshots` | PRIVATE | system | no |
| `capex_actuals` | PRIVATE | user uploads | no |
| `capex_budget` | PRIVATE | user-created | no |
| `construction_cost_tracking` | PRIVATE | user-created | no |
| `balance_sheets` | PRIVATE | system | no |
| `deal_balance_sheets` | PRIVATE | system | no |

---

### Table Family: RENT ROLL / ACTUALS (PRIVATE)

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `rent_roll` | PRIVATE | user uploads (T12) | no |
| `rent_roll_units` | PRIVATE | parsed from rent roll | no |
| `rent_roll_diffs` | PRIVATE | system | no |
| `rent_roll_snapshots` | PRIVATE | system | no |
| `lease_transactions` | PRIVATE | user uploads | no |
| `lease_events` | PRIVATE | system | no |
| `lease_expiration_schedule` | PRIVATE | system | no |
| `operations_actuals` | PRIVATE | user uploads | no |
| `operations_recommendations` | PRIVATE | agent | no |
| `other_income_tracking` | PRIVATE | user-created | no |
| `unit_mix` | PRIVATE | user uploads/agent | no |
| `actual_performance` | PRIVATE | system | no |

---

### Table Family: INVESTORS / CAPITAL (PRIVATE)

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `investors` | PRIVATE | user-created | **yes** (direct org_id) |
| `capital_calls` | PRIVATE | user-created | no |
| `capital_call_items` | PRIVATE | user-created | no |
| `capital_account_entries` | PRIVATE | system | no |
| `commitment_tranches` | PRIVATE | user-created | no |
| `distributions` | PRIVATE | user-created | no |
| `distribution_items` | PRIVATE | user-created | no |
| `waterfall_tiers` | PRIVATE | user-created | no |
| `investor_communications` | PRIVATE | user-created | no |
| `deal_investments` | PRIVATE | user-created | no |

---

### Table Family: TRAFFIC ENGINE (PRIVATE — per-deal; PUBLIC — calibration coefficients)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `traffic_projections` | PRIVATE | system (per deal) | via deal | no |
| `traffic_projection_overrides` | PRIVATE | user-created | via deal | no |
| `traffic_funnel` | PRIVATE | system | via deal | no |
| `traffic_counts` | PRIVATE | user uploads | via deal | no |
| `traffic_upload_history` | PRIVATE | user uploads | user-level | no |
| `deal_traffic_snapshots` | PRIVATE | system | via deal | no |
| `weekly_traffic_snapshots` | PRIVATE | system | via deal | no |
| `subject_traffic_history` | PRIVATE | system | via deal | no |
| `traffic_calibration_coefficients` | PUBLIC | platform calibration | global | no |
| `traffic_calibration_factors` | PUBLIC | platform calibration | global | no |
| `traffic_calibration_history` | PUBLIC | platform calibration | global | no |
| `traffic_calibration_legacy_factors` | PUBLIC | platform calibration | global | no |
| `traffic_submarket_calibration` | PUBLIC | platform calibration | global | no |
| `traffic_learned_rates` | PUBLIC | platform calibration | global | no |
| `traffic_model_versions` | PUBLIC | platform | global | no |
| `traffic_correlation_signals` | PUBLIC | platform | global | no |
| `traffic_weight_config` | PUBLIC | platform | global | no |
| `traffic_competitive_share` | PUBLIC | platform | global | no |
| `traffic_prediction_history` | PUBLIC | platform | global | no |
| `leasing_traffic_predictions` | PUBLIC | platform | global | no |
| `leasing_weekly_observations` | PUBLIC | platform | global | no |
| `latest_traffic_predictions` | PUBLIC | platform (view) | global | no |
| `digital_traffic_scores` | PUBLIC | platform | global | no |
| `digital_traffic_events` | PUBLIC | ingested | global | no |

---

### Table Family: AGENT / AI (PRIVATE — deal or user-scoped)

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `agent_chat_logs` | PRIVATE | user interactions | no |
| `agent_runs` | PRIVATE | system | no |
| `agent_tasks` | PRIVATE | system | no |
| `agent_run_steps` | PRIVATE | system | no |
| `agent_workflow_runs` | PRIVATE | system | no |
| `agent_events` | PRIVATE | system | no |
| `agent_activity_log` | PRIVATE | system | no |
| `agent_data_matrix_cache` | PRIVATE | system (TTL cache) | no |
| `agent_collaboration_after_tax_returns` | PRIVATE | agent | no |
| `agent_collaboration_debt_recommendations` | PRIVATE | agent | no |
| `agent_collaboration_legal_protections` | PRIVATE | agent | no |
| `agent_collaboration_pricing_recommendations` | PRIVATE | agent | no |
| `agent_collaboration_screening_adjustments` | PRIVATE | agent | no |
| `agent_collaboration_variance_impacts` | PRIVATE | agent | no |
| `ai_usage_log` | PRIVATE | system | no |
| `opus_conversations` | PRIVATE | user interactions | no |
| `opus_messages` | PRIVATE | user interactions | no |
| `opus_learned_patterns` | PRIVATE | system | no |
| `opus_template_structures` | PRIVATE | system | no |
| `confirmation_chain_results` | PRIVATE | system | no |
| `orchestrator_logs` | PRIVATE | system | no |

---

### Table Family: ZONING / ENTITLEMENTS (MIXED — public regulatory data + private deal analyses)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `zoning_districts` | PUBLIC | county/municipal ingest | global | no |
| `zoning_districts_canonical` | PUBLIC | platform-curated | global | no |
| `zoning_district_boundaries` | PUBLIC | county ingest | global | no |
| `county_zoning_categories` | PUBLIC | county ingest | global | no |
| `county_parcels` | PUBLIC | county ingest | global | no |
| `zoning_code_interpretations` | PUBLIC | platform-curated | global | no |
| `municipal_benchmarks` | PUBLIC | platform-curated | global | no |
| `municipalities` | PUBLIC | platform-curated | global | no |
| `municipality_fee_schedules` | PUBLIC | platform-curated | global | no |
| `planning_applications` | PUBLIC | public records ingest | global | no |
| `zoning_analyses` | PRIVATE | agent (per deal) | via deal | no |
| `zoning_agent_analyses` | PRIVATE | agent (per deal) | via deal | no |
| `deal_zoning_profiles` | PRIVATE | user/agent | via deal | no |
| `deal_zoning_confirmations` | PRIVATE | user action | via deal | no |
| `zoning_profiles` | PRIVATE | user/agent | via deal | no |
| `zoning_recommendations` | PRIVATE | agent | via deal | no |
| `zoning_triangulations` | PRIVATE | system | via deal | no |
| `zoning_predictions` | PRIVATE | agent | via deal | no |
| `zoning_verification` | PRIVATE | system | via deal | no |
| `zoning_verification_cases` | PRIVATE | system | via deal | no |
| `zoning_ai_analysis_cache` | PRIVATE | agent cache | via deal | no |
| `zoning_precedents` | PRIVATE | agent | via deal | no |
| `zoning_learning_precedents` | PRIVATE | agent | via deal | no |
| `zoning_outcomes` | PRIVATE | system | via deal | no |
| `zoning_changes` | PUBLIC | public records | global | no |
| `zoning_source_citation` | PUBLIC | platform | global | no |
| `zoning_corrections` | PRIVATE | user actions | user-level | no |
| `zoning_overlays` | PUBLIC | county ingest | global | no |
| `property_zoning_cache` | PRIVATE | system cache (per deal) | via deal | no |
| `zoning_capacity` | PRIVATE | agent (per deal) | via deal | no |
| `entitlements` | PRIVATE | user-created (per deal) | via deal | no |
| `entitlement_milestones` | PRIVATE | user-created | via deal | no |

---

### Table Family: MARKET DATA (PUBLIC — ingested, global)

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `msas` | PUBLIC | platform-curated | no |
| `submarkets` | PUBLIC | platform-curated | no |
| `geographies` | PUBLIC | platform-curated | no |
| `market_inventory` | PUBLIC | ArcGIS/CoStar ingest | no |
| `market_trends` | PUBLIC | ingested | no |
| `market_snapshots` | PUBLIC | ingested | no |
| `market_vitals` | PUBLIC | ingested | no |
| `market_sentiment_history` | PUBLIC | ingested | no |
| `market_commentary` | PUBLIC | ingested/platform | no |
| `market_basket_prices` | PUBLIC | BLS/FRED ingest | no |
| `market_basket_snapshots` | PUBLIC | BLS/FRED ingest | no |
| `available_markets` | PUBLIC | platform-curated | no |
| `market_coverage_status` | PUBLIC | platform | no |
| `market_data_connections` | PUBLIC | platform | no |
| `market_data_snapshots` | PUBLIC | platform | no |
| `market_data_sync_jobs` | PUBLIC | platform | no |
| `market_events` | PUBLIC | ingested | no |
| `market_risk_indicators` | PUBLIC | platform/ingested | no |
| `submarket_characters` | PUBLIC | platform-curated | no |
| `submarket_corporate_health` | PUBLIC | platform/ingested | no |
| `submarket_employers` | PUBLIC | platform/ingested | no |
| `metric_time_series` | PUBLIC | ingested | no |
| `metric_correlations` | PUBLIC | platform | no |
| `msa_economic_snapshot` | PUBLIC | FRED/BLS ingest | no |
| `inflation_snapshots` | PUBLIC | BLS/FRED ingest | no |
| `inflation_cache` | PUBLIC | BLS/FRED cache | no |
| `inflation_alerts` | PUBLIC | platform | no |
| `rent_inflation_observations` | PRIVATE | per-deal observations | no |
| `insurance_cost_observations` | PRIVATE | per-deal observations | no |
| `expense_inflation_observations` | PRIVATE | per-deal observations | no |
| `tax_assessment_observations` | PRIVATE | per-deal observations | no |

---

### Table Family: SALE COMPS (⚠️ MIXED — nullable deal_id)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `market_sale_comps` | **MIXED** | ArcGIS ingest (deal_id=NULL) + deal comp sets (deal_id SET) | `WHERE deal_id IS NULL` (public) / `WHERE deal_id IN (...)` (private) | no |
| `georgia_property_sales` | PUBLIC | ArcGIS ingest | global | no |
| `recorded_transactions` | PUBLIC | public records ingest | global | no |
| `property_sales` | PUBLIC | ingested | global | no |
| `property_sales_legacy` | PUBLIC | ingested | global | no |
| `sale_comp_sets` | PRIVATE | user/agent (per deal) | via deal | no |
| `sale_comp_set_members` | PRIVATE | user/agent | via deal | no |
| `deal_comparable_properties` | PRIVATE | user/agent selection | via deal | no |
| `comp_properties` | PRIVATE | user/agent (per deal) | via deal | no |
| `admin_comp_set_properties` | PUBLIC | admin-managed reference | global | no |
| `market_research_reports` | PRIVATE | agent-generated (per deal) | via deal | no |
| `market_research_metrics` | PRIVATE | agent (per deal) | via deal | no |
| `market_research_cache` | PUBLIC | platform cache | global | no |

---

### Table Family: RENT COMPS (MIXED — nullable deal_id)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `market_rent_comps` | **MIXED** | ingested (deal_id=NULL) + deal selections (deal_id SET) | same split as market_sale_comps | no |
| `rent_comps` | PUBLIC | ingested | global | no |
| `apartment_rent_comps` | PUBLIC | Apartment Locator AI ingest | global | no |
| `comp_pricing_snapshots` | PRIVATE | per-deal | via deal | no |
| `comp_pricing_alerts` | PRIVATE | per-deal | via deal | no |
| `deal_rent_comp_sets` | PRIVATE | user/agent | via deal | no |

---

### Table Family: PROPERTIES (⚠️ MIXED — two populations)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `properties` | **MIXED** | ArcGIS ingest (1,059,994 rows, deal_id=NULL) + tenant-created (35 rows, deal_id SET or created_by SET) | `WHERE is_market_data = TRUE` (public) / `WHERE deal_id IN (...)` OR `WHERE created_by IS NOT NULL` (private). Net-new `is_market_data` flag pending Phase 2. | no |
| `property_descriptions` | PRIVATE | agent enrichment (per property-deal) | via deal | no |
| `property_info_cache` | PUBLIC | county assessor cache | global | no |
| `property_boundaries` | PRIVATE | per-deal | via deal | no |
| `property_metrics` | PUBLIC | ingested/computed | global | no |
| `property_characteristics` | PUBLIC | ingested | global | no |
| `property_demographics` | PUBLIC | census ingest | global | no |
| `property_competition` | PUBLIC | ingested | global | no |
| `property_proximity` | PUBLIC | computed | global | no |
| `property_proximity_scorecard` | PUBLIC | computed | global | no |
| `property_transit_access` | PUBLIC | transit data ingest | global | no |
| `property_actuals` | PRIVATE | user uploads | user-level | no |
| `property_operating_data` | PRIVATE | user uploads (deprecated flag) | via property | no |
| `property_profiles` | PUBLIC | ingested/computed | global | no |
| `property_records` | PUBLIC | public records ingest | global | no |
| `property_tax_records` | PUBLIC | public records ingest | global | no |
| `property_rent_data` | PUBLIC | ingested | global | no |
| `property_analyses` | PRIVATE | user/agent | user-level | no |
| `property_enrichment_jobs` | PRIVATE | system | user-level | no |
| `property_validation_summary` | PUBLIC | system | global | no |
| `property_dual_write_failures` | PRIVATE | system | via deal | no |
| `property_website_analytics` | PUBLIC | ingested | global | no |
| `property_ga_connections` | PRIVATE | user-configured | user-level | no |
| `property_digital_competitors` | PUBLIC | ingested | global | no |
| `property_traffic_intelligence` | PUBLIC | computed | global | no |
| `property_traffic_context` | PUBLIC | ingested/computed | global | no |
| `property_traffic_actual` | PRIVATE | operator uploads | via property | no |
| `property_email_links` | PRIVATE | system | user-level | no |
| `apartment_locator_properties` | PUBLIC | Apartment Locator AI ingest | global | no |
| `fulton_parcels` | PUBLIC | Fulton county ingest | global | no |
| `fulton_structures` | PUBLIC | Fulton county ingest | global | no |
| `property_type_strategies` | PUBLIC | platform-curated | global | no |
| `property_types` | PUBLIC | platform reference | global | no |

---

### Table Family: VENDOR DATA (PRIVATE — user-uploaded per deal)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `costar_submarket_stats` | PRIVATE | operator upload (per deal) | via deal | no |
| `vendor_market_observations` | PRIVATE | operator upload (per deal) | via deal | no |
| `yardi_matrix_rent_survey` | PRIVATE | operator upload (per deal) | via deal | no |
| `yardi_matrix_supply_pipeline` | PRIVATE | operator upload (per deal) | via deal | no |
| `data_library_files` | PRIVATE | user uploads | via deal | no |
| `data_library_assets` | PRIVATE | user uploads | via deal | no |
| `data_library_enrichment_log` | PRIVATE | system | user-level | no |
| `data_uploads` | PRIVATE | user uploads | user-level | no |

---

### Table Family: HISTORICAL OBSERVATIONS (⚠️ MIXED)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `historical_observations` | **MIXED** | Platform-ingested public comps (deal_id=NULL) + operator-supplied monthly financials (deal_id SET, per HISTORICAL_OBSERVATIONS_SPEC §7.9 Invariant 2) | `WHERE deal_id IS NULL` (public substrate) / `WHERE deal_id IN (...)` (operator-supplied rows) | no |

---

### Table Family: SUPPLY PIPELINE (PUBLIC — ingested)

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `supply_pipeline` | PUBLIC | county permit ingest | no |
| `supply_pipeline_projects` | PUBLIC | county permit ingest | no |
| `supply_pipeline_aggregates` | PUBLIC | computed | no |
| `supply_analyses` | PRIVATE | per-deal agent | no |
| `supply_events` | PUBLIC | ingested | no |
| `supply_absorption_tracking` | PUBLIC | platform | no |
| `supply_delivery_timeline` | PUBLIC | platform | no |
| `supply_metrics` | PUBLIC | platform | no |
| `supply_risk_scores` | PUBLIC | computed | no |
| `building_permits` | PUBLIC | county ArcGIS ingest | no |
| `apartment_supply_pipeline` | PUBLIC | Apartment Locator AI ingest | no |

---

### Table Family: CORPORATE / ECONOMIC DATA (PUBLIC — ingested)

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `corporate_financials` | PUBLIC | external data ingest | no |
| `corporate_health_scores` | PUBLIC | computed from ingested | no |
| `corporate_stock_prices` | PUBLIC | external ingest | no |
| `employer_concentration` | PUBLIC | computed | no |
| `corporate_facility_events` | PUBLIC | ingested | no |
| `crime_statistics` | PUBLIC | Atlanta PD ArcGIS ingest | no |
| `adt_counts` | PUBLIC | FDOT ingest | no |
| `natural_disaster_events` | PUBLIC | ingested | no |
| `climate_risk_assessments` | PUBLIC | ingested | no |
| `dot_temporal_profiles` | PUBLIC | FDOT ingest | no |
| `points_of_interest` | PUBLIC | ingested | no |

---

### Table Family: EVENTS / DEMAND SIGNALS (PUBLIC — platform)

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `demand_events` | PUBLIC | ingested | no |
| `demand_event_types` | PUBLIC | platform reference | no |
| `demand_driver_events` | PUBLIC | platform | no |
| `demand_projections` | PUBLIC | computed | no |
| `demand_signal_weights` | PUBLIC | platform config | no |
| `demand_phasing_templates` | PUBLIC | platform | no |
| `event_taxonomy` | PUBLIC | platform reference | no |
| `event_type_treatments` | PUBLIC | platform reference | no |
| `key_events` | PUBLIC | ingested | no |
| `market_events` | PUBLIC | ingested | no |
| `news_events` | PUBLIC | ingested | no |
| `risk_events` | PUBLIC | ingested | no |
| `regulatory_risk_events` | PUBLIC | ingested | no |
| `regime_shift_alerts` | PUBLIC | platform | no |

---

### Table Family: STRATEGIES (MIXED — platform reference + user-defined)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `strategies` | **MIXED** | Platform-seeded global strategies + user/org-defined custom strategies | `WHERE org_id IS NULL` (public) / `WHERE org_id = $ws` (private) | **yes** (direct org_id) |
| `strategy_definitions` | PRIVATE | user-defined | WHERE user_id = caller | no |
| `custom_strategies` | PRIVATE | user-defined | WHERE user_id = caller | no |
| `custom_strategy_exports` | PRIVATE | user action | WHERE user_id = caller | no |
| `custom_strategy_usage` | PRIVATE | system | via deal | no |
| `strategy_analyses` | PRIVATE | agent (per deal) | via deal | no |
| `strategy_backtest_results` | PUBLIC | platform | global | no |
| `strategy_backtest_summary` | PUBLIC | platform | global | no |
| `property_type_strategy_summary` | PUBLIC | platform | global | no |
| `user_property_type_strategies` | PRIVATE | user preferences | WHERE user_id = caller | no |

---

### Table Family: NEWS / INTELLIGENCE (PRIVATE — user-specific subscriptions over PUBLIC data)

| table | classification | origin | scoping rule | org_id ready? |
|---|---|---|---|---|
| `news_article_cache` | PUBLIC | ingested | global | no |
| `news_sources` | PUBLIC | platform reference | global | no |
| `news_items` | PRIVATE | user/deal-linked | via deal or user | no |
| `news_alerts` | PRIVATE | user-configured | WHERE user_id = caller | no |
| `user_saved_articles` | PRIVATE | user action | WHERE user_id = caller | no |
| `user_news_connections` | PRIVATE | user-configured | WHERE user_id = caller | no |
| `user_news_preferences` | PRIVATE | user-configured | WHERE user_id = caller | no |
| `user_newsletter_articles` | PRIVATE | system | WHERE user_id = caller | no |
| `user_newsletter_parses` | PRIVATE | system | WHERE user_id = caller | no |
| `user_newsletter_sources` | PRIVATE | user-configured | WHERE user_id = caller | no |
| `morning_briefs` | PRIVATE | agent (per user) | WHERE user_id = caller | no |
| `asset_news_links` | PRIVATE | system (per deal) | via deal | no |

---

### Table Family: CALIBRATION / LEARNING (PUBLIC — platform-maintained)

| table | classification | origin | org_id ready? |
|---|---|---|---|
| `calibration_factors` | PUBLIC | platform calibration | no |
| `active_calibration_factors` | PUBLIC | platform calibration | no |
| `latest_calibration_coefficients` | PUBLIC | platform calibration | no |
| `latest_calibration_factors` | PUBLIC | platform calibration | no |
| `jurisdiction_calibration` | PUBLIC | platform calibration | no |
| `jurisdiction_source_map` | PUBLIC | platform reference | no |
| `backtest_runs` | PUBLIC | platform | no |
| `backtest_results` | PUBLIC | platform | no |
| `backtest_accuracy` | PUBLIC | platform | no |
| `backtest_forecasts` | PUBLIC | platform | no |
| `agent_patterns` | PUBLIC | platform-aggregated | no |
| `agent_task_learnings` | PUBLIC | platform-aggregated | no |
| `learning_adjustments` | PUBLIC | platform | no |
| `model_performance_metrics` | PUBLIC | platform | no |
| `model_performance_timeline` | PUBLIC | platform | no |
| `revenue_engine_calibration` | PUBLIC | platform | no |

---

### Table Family: USER PREFERENCES (PRIVATE — user-scoped)

All `user_*` preference/settings tables: `user_acquisition_preferences`, `user_agent_settings`, `user_branding_settings`, `user_capabilities`, `user_column_preferences`, `user_credibility`, `user_email_accounts`, `user_intelligence_preferences`, `user_map_annotations`, `user_market_preferences`, `user_model_preferences`, `user_module_settings`, `user_module_training`, `user_notifications`, `user_push_tokens`, `user_risk_preferences`, `user_screening_params`, `user_validation_summary`, `user_view_preferences`, `user_workspaces` — all PRIVATE, scoped `WHERE user_id = caller`.

---

### Table Family: PLATFORM REFERENCE (PUBLIC — no user writes)

`standard_line_items`, `proforma_templates`, `proforma_state_rules`, `adjustment_formulas`, `benchmark_projects`, `asset_class_spread_calibration`, `demand_signal_weights`, `event_taxonomy`, `demand_event_types`, `geographic_relationships`, `property_type_strategies`, `risk_categories`, `scenario_templates`, `stage_task_templates`, `line_item_benchmarks`, `archive_assumption_benchmarks`, `seasonality_factors`, `structural_premiums` — all PUBLIC, global read.

---

### Table Family: ADMIN / SYSTEM (PRIVATE — platform admin)

`admin_pricing_alert_rules`, `admin_comp_set_properties`, `prompt_versions`, `schema_migrations`, `geography_columns`, `geometry_columns`, `spatial_ref_sys`, `audit_log`, `decision_log`, `validation_properties`, `archive_deals`, `archived_deals`, `_gps_link_staging` — all PRIVATE/ADMIN.

---

## A2 — SURFACE LAYER

### Terminal F-key Surfaces (Portfolio Context)

Source: `frontend/src/pages/TerminalPage.tsx` lines 156–163.
Note: F4 is a keyboard alias remapped to F5 before router; TABS_META lists it as F4.

| surface | key | route/file | reads | classification | scoping rule |
|---|---|---|---|---|---|
| **Dashboard** | F1 | `TerminalPage.tsx` dashboard section | `deals` (pipeline count/status), `market_*` (signals), `alerts` | MIXED | deal reads: `org_id=$ws`; market reads: global |
| **Pipeline** | F2 | `TerminalPage.tsx` deal grid | `deals`, `deal_properties`, `properties` (linked) | PRIVATE | `WHERE deals.org_id = $ws` |
| **Portfolio** | F3 | `TerminalPage.tsx` portfolio section | `deal_monthly_actuals` (is_portfolio_asset=TRUE), `deals`, `investors` | PRIVATE | `WHERE deals.org_id = $ws` |
| **Markets** | F4/F5 | `MarketIntelligence/F4MarketsPage.tsx` | `market_*`, `msas`, `submarkets`, `supply_pipeline`, `properties` (boundary) | MIXED | market tables: global; properties boundary query: global (ArcGIS corpus) |
| **Email** | F6 | `TerminalPage.tsx` email section | `emails`, `email_accounts`, `email_*` | PRIVATE | `WHERE user_id = caller` |
| **News** | F7 | `TerminalPage.tsx` news section | `news_article_cache` (public), `user_saved_articles`, `user_news_preferences` | MIXED | news corpus: global; user overlays: `WHERE user_id = caller` |
| **Strategies** | F8 | `TerminalPage.tsx` strategies section | `strategies` (org_id), `strategy_definitions` | MIXED | `WHERE org_id = $ws OR org_id IS NULL` |
| **Admin** | F9 | `admin/AdminDashboard.tsx` | all tables (admin) | PRIVATE/ADMIN | admin role only |
| **Settings** | F10 | settings pages | `users`, `user_*`, `org_members`, `org_integrations` | PRIVATE | `WHERE user_id = caller` or `org_id = $ws` |

---

### Deal Capsule Modules (Deal Context — M01–M29)

Source: `backend/src/services/module-wiring/module-registry.ts`. All deal-capsule surfaces are accessed within a specific deal (`deal_id` in URL/context). The outer deal gate (`WHERE deals.org_id = $ws`) must be enforced at deal access time; module reads that go via `deal_id` are then implicitly scoped.

| module | name | primary tables | classification | scoping rule | action semantics (B) |
|---|---|---|---|---|---|
| **M01** | Deal Overview | `deals`, `properties`, `jedi_scores`, `jedi_score_history`, `market_sale_comps` | MIXED | deal: via `deal_id`; market benchmarks: global | — |
| **M02** | Zoning & Entitlements | `zoning_districts` (public), `deal_zoning_profiles`, `zoning_analyses`, `county_parcels` | MIXED | zoning reference: global; deal analysis: via `deal_id` | — |
| **M03** | Development Capacity | `deal_designs`, `building_designs_3d`, `zoning_capacity`, `development_scenarios` | PRIVATE | via `deal_id` | — |
| **M04** | Supply Pipeline | `supply_pipeline`, `supply_pipeline_projects`, `building_permits` | PUBLIC | global | — |
| **M05** | Market Analysis | `market_*`, `apartment_*`, `historical_observations` (public rows) | PUBLIC | global | — |
| **M06** | Demand Signals | `demand_events`, `demand_projections`, `demand_driver_events` | PUBLIC | global | — |
| **M07** | Traffic Intelligence | `deal_traffic_snapshots`, `traffic_projections`, `deal_monthly_actuals`, `traffic_calibration_*` (public) | MIXED | deal traffic: via `deal_id`; calibration: global | — |
| **M08** | Strategy Arbitrage | `strategies` (global + org), `strategy_analyses`, `deals` | MIXED | global strategies + `org_id=$ws` for user-defined | — |
| **M09** | Pro Forma Engine | `deal_assumptions`, `proforma_*`, `cashflow_projections`, `rent_roll` | PRIVATE | via `deal_id` | — |
| **M10** | Scenario Engine | `deal_scenarios`, `deal_underwriting_scenarios`, `scenario_*` | PRIVATE | via `deal_id` | — |
| **M11** | Capital Structure Engine | `deal_debt_schedule`, `debt_positions`, `deals` | PRIVATE | via `deal_id` | — |
| **M12** | Exit Analysis | `deals`, `deal_assumptions`, `market_sale_comps` | MIXED | deal: via `deal_id`; comps: split predicate | — |
| **M13** | Due Diligence Tracker | `dd_tasks`, `dd_checklists`, `deal_documents` | PRIVATE | via `deal_id` | — |
| **M14** | Risk Dashboard | `deal_risks`, `composite_risk_profiles`, `risk_scores` | PRIVATE | via `deal_id` | — |
| **M15** | Competition Analysis | `market_rent_comps` (MIXED), `deal_comparable_properties`, `competitive_sets` | MIXED | market comps: split predicate; deal comps: via `deal_id` | — |
| **M16** | Deal Pipeline | `deals`, `deal_pipeline`, `deal_state_tracking` | PRIVATE | via `deal_id` / `org_id=$ws` | — |
| **M17** | Team & Collaboration | `deal_team_members`, `deal_tasks`, `deal_team_activity` | PRIVATE | via `deal_id` | — |
| **M18** | Documents & Files | `deal_files`, `deal_documents`, `capsule_documents` | PRIVATE | via `deal_id` | — |
| **M19** | News Intelligence | `news_article_cache` (public), `market_research_reports` (private) | MIXED | news: global; research reports: via `deal_id` | — |
| **M20** | Map Intelligence | `properties` (MIXED), `msas`, `supply_pipeline`, `deal_properties` | MIXED | public properties: global; tenant properties: via `deal_id` or `org_id=$ws` | — |
| **M21** | AI Chat (Opus) | `opus_conversations`, `opus_messages`, `agent_chat_logs` | PRIVATE | via `deal_id` + `user_id` | — |
| **M22** | Portfolio Manager | `deal_monthly_actuals`, `investors`, `capital_calls`, `distributions` | PRIVATE | via `org_id=$ws` | — |
| **M23** | Alerts & Notifications | `alerts`, `notifications`, `deal_alerts` | PRIVATE | `WHERE user_id = caller` + `deal_id` filter | — |
| **M24** | Settings & Preferences | `user_*` preference tables | PRIVATE | `WHERE user_id = caller` | — |
| **M25** | JEDI Score Engine | `jedi_scores`, `deals`, `properties` (all ~1.06M for boundary) | MIXED | jedi scores: via `deal_id`; property corpus: **global — cannot be org-scoped** | — |
| **M26** | Tax Intelligence | `deal_assumptions`, `property_tax_records`, `jurisdiction_tax_cache` | MIXED | deal: via `deal_id`; tax reference: global | — |
| **M27** | Sale Comp Intelligence | `market_sale_comps` (MIXED), `deal_comparable_properties` | MIXED | ArcGIS comps: global; deal comps: via `deal_id` | — |
| **M29** | Unit Mix Intelligence | `unit_mix`, `rent_roll`, `deal_unit_programs` | PRIVATE | via `deal_id` | — |

---

### Financial Engine (F9 Proforma) Sub-Tabs

Source: `frontend/src/pages/development/financial-engine/` file listing.

| tab | primary APIs hit | classification |
|---|---|---|
| AssumptionsTab | `/deals/{id}/assumptions`, `/deals/{id}/financials` | PRIVATE |
| DealTermsTab | `/deals/{id}/context` | PRIVATE |
| DebtTab (M11) | `/deals/{id}/debt-*` | PRIVATE |
| DecisionTab | `/jedi/score/{id}` | PRIVATE |
| LeasingAssumptionsTab | `/deals/{id}/assumptions/monthly` | PRIVATE |
| OtherIncomeTab | `/deals/{id}/financials` | PRIVATE |
| OverviewTab | `/market-research/intelligence/{id}`, `/strategy-analyses/{id}` | MIXED |
| ProFormaSummaryTab | `/deals/{id}/completeness` | PRIVATE |
| ProjectionsTab | `/deals/{id}/projections` | PRIVATE |
| ReturnsTab | `/deals/{id}/financials/override` | PRIVATE |
| RoadmapTab | `/deals/{id}/roadmap/comp-candidates` | MIXED |
| SourcesUsesTab | `/deals/{id}/financials/override`, `/deals/{id}/renovation` | PRIVATE |
| StanceTab | `/deals/{id}/stance` | PRIVATE |
| ValuationGridTab | `/deals/{id}/valuation-grid/comps` | MIXED |
| ValidationGridTab | `/deals/{id}/completeness`, `/deals/{id}/assumptions` | PRIVATE |

---

## A3 — MIXED INVENTORY (Scoping-Break Risks)

These are the tables and surfaces where a naive `WHERE org_id = $ws` either leaks private data or hides public data that is legitimately needed.

| # | table / surface | public population | private population | required split predicate |
|---|---|---|---|---|
| **1** | `properties` | 1,059,994 ArcGIS/county-ingested rows (`deal_id IS NULL`, `created_by IS NULL`) | 35 tenant-created rows (`deal_id SET` or `created_by SET`) | `WHERE is_market_data = TRUE` (public) / `WHERE deal_id IN (SELECT id FROM deals WHERE org_id=$ws)` (private). Net-new `is_market_data` flag needed (Phase 2). |
| **2** | `market_sale_comps` | ArcGIS/Georgia-ingested rows (`deal_id IS NULL`) | Deal comp-set rows (`deal_id SET`) | `WHERE deal_id IS NULL` (public) / `WHERE deal_id IN (...)` (private). No new column needed — `deal_id IS NULL` is the signal. |
| **3** | `market_rent_comps` | Ingested rent comps (`deal_id IS NULL`) | Deal-selected comps (`deal_id SET`) | Same pattern as market_sale_comps. |
| **4** | `historical_observations` | Platform-ingested empirical substrate (`deal_id IS NULL`) | Operator-supplied monthly financials (`deal_id SET`, per HISTORICAL_OBSERVATIONS_SPEC §7.9 Invariant 2) | `WHERE deal_id IS NULL` (public calibration) / `WHERE deal_id IN (...)` (private actuals). |
| **5** | `strategies` | Platform-seeded global strategies (`org_id IS NULL`) | User/org-defined strategies (`org_id SET`) | `WHERE org_id IS NULL OR org_id = $ws`. Already has `org_id` — query fix only, no schema change needed. |
| **6** | Terminal F4/F5 Markets surface | Market data tables (global) | Owned asset overlay (`deal_monthly_actuals` with `is_portfolio_asset=TRUE`) | Market queries: no filter. Asset overlay: `WHERE deals.org_id = $ws`. |
| **7** | Terminal F1 Dashboard | Market signals (`market_*`) | Deal pipeline counts, owned portfolio metrics | Market reads: global. Deal reads: `WHERE deals.org_id = $ws`. |
| **8** | M25 JEDI Score Engine | `properties` full corpus for boundary geo-queries (ST_Contains) | `jedi_scores` per deal | Boundary query must remain global — cannot org-scope. Score reads: via `deal_id`. |
| **9** | M15 Competition Analysis | `market_rent_comps` (null deal_id rows) | `deal_comparable_properties`, `competitive_sets` (deal-scoped) | Comp market query: `WHERE deal_id IS NULL`. Deal comp query: `WHERE deal_id = $dealId`. |
| **10** | M27 Sale Comp Intelligence | `market_sale_comps` (null deal_id rows) | `deal_comparable_properties` (deal-scoped) | Same split as M15. |
| **11** | M20 Map Intelligence | `properties` ArcGIS corpus, `supply_pipeline` | Tenant `deal_properties` layer | Public layers: global. Tenant layer: `WHERE deals.org_id = $ws`. |

---

## Notes for Step-4 Implementation

1. **`properties` is the hardest MIXED table** — Phase 2 DDL (`is_market_data BOOLEAN`) + backfill required before `org_id` scoping is safe. Without the flag, the split predicate is fragile (`deal_id IS NULL` excludes the 5 fixture properties and 1 f2a test property correctly only if those rows are cleaned up first).

2. **`market_sale_comps` and `market_rent_comps`** — split on `deal_id IS NULL` is clean and already exists. No schema change needed; query-level fix only.

3. **`historical_observations`** — same `deal_id IS NULL` split. Already has the column.

4. **`strategies`** — already has `org_id`; scoping is a query fix (`WHERE org_id IS NULL OR org_id = $ws`), not a schema change.

5. **Tables with `deal_id` only (no `org_id`)** — scoped via deal ownership: `WHERE deal_id IN (SELECT id FROM deals WHERE org_id = $ws)`. This is the correct pattern for all ~200 `deal_*` tables. Adding `org_id` to each would be redundant; the join through `deals` is sufficient.

6. **M25 JEDI Score boundary query** — must remain global. Restricting the `properties` corpus would make boundary discovery useless for Atlanta deals (1.06M ArcGIS rows carry the boundaries). The score storage (`jedi_scores`) is private and deal-scoped.
