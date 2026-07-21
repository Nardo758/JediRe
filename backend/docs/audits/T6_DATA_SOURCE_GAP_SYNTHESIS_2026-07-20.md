# T6 — DATA SOURCE UNIFICATION GAP TABLE (Synthesis of T1–T5)

**Date:** 2026-07-20
**HEAD:** `34f4405bf`
**Sources:** T1–T3 (data-source unification audit, prior session) + T4a/T4bc/T4d/T4e/T5 (agents dispatched 2026-07-20)
**Rule:** One row per `module.field-group`. Target source order = the 5-layer contract (subject → deal → submarket → market → baseline). Gap class = PROVISION / FIX / FREE-WIN / FIREWALL / PII.

---

## MODULE: Ingestion (T1 + T4a + T4e)

| Field group | Target source order | Actual | Provenance rendered? | Gap class | Finding | File:Line |
|---|---|---|---|---|---|---|
| `rent_roll` upload | subject (uploaded doc) | subject ✓ | PARTIAL — `ProvenanceStamp` created but **trapped in `deal_data._provenance`** | FIX | T1: no stamp-at-entry on ingestion routes; T5: `ProvenanceStamp` never exposed via API | `email-intake.function.ts:255`, `data-router.ts` |
| `weekly_report` upload | subject | subject ✓ | PARTIAL — same trap | FIX | T1: stamp created but not surfaced | `leasing-traffic.routes.ts:423` |
| `costar_export` upload | S4 restricted | S4 ✓ at parser, **S0 (unrestricted) at R2 register** | NO — `redistribution_restricted` hardcoded `FALSE` | **FIREWALL** | T4bc-F2: CoStar files enter global pool unflagged | `data-library-upload/index.ts:73` |
| `pst_email` body | subject | subject ✓ | NO — raw body stored **unencrypted** | **PII** | T4e-F2: PST raw_body plaintext | `pstPipeline.ts:23`, `pst-backflow.service.ts:40` |
| `tenant_name` in lease txns | subject (internal) | subject ✓ | NO — leaked to **LLM prompts** | **PII** | T4e-F1: `tenant_name` passed to `buildSystemPrompt()` without redaction | `deal-financial-context.service.ts:183-189`, `agent-chat.service.ts:294` |
| `property_id` lookup | org-scoped | **CROSS-ORG** — `data-upload.routes.ts` queries by `property_id` without org filter | N/A | FIX | T4a: unscoped `property_id` queries leak across orgs | `data-upload.routes.ts` |
| `data_library` LIST/DOWNLOAD | org-scoped | **CROSS-ORG** — `data-library-files.routes.ts` returns all files | N/A | FIX | T4a-F1: LIST/DOWNLOAD leaks cross-org | `data-library-files.routes.ts` |

---

## MODULE: Conversion Coefficients (T2 + T4d + P0)

| Field group | Target source order | Actual | Provenance rendered? | Gap class | Finding | File:Line |
|---|---|---|---|---|---|---|
| `visit_to_tour_ratio` | deal → submarket → market → baseline | **3 independent namespaces**, zero unification | YES (TrafficCoefficientsTab) but **no write path back to engine** | FIX | T4d-F2: M07 backend (`0.40`), Leasing Traffic frontend (`0.50`), Revenue Engine (`CONFIG` hardcoded) | `multifamilyTrafficService.ts:28`, `leasingTrafficService.ts:91`, `revenue-engine.service.ts:149` |
| `closing_ratio` | deal → submarket → market → baseline | same 3-namespace chaos | YES (display only) | FIX | T4d-F2: same as above | same |
| `inquiry_to_tour_ratio` | deal → submarket → market → baseline | **NOT DEFINED** — only `toursConversionRate = 0.98` placeholder exists | NO | FIX | T4d-F2 + V6 ticket: no registry entry for inquiry→tour | `leasingTrafficService.ts:91` |
| `traffic_calibration` default | market default (0.50) | **0.99 (pre-P0)** — stale default in calibration stats | YES (shows as "platform default") | **P0** | T4d-F5: calibration UI shows 0.99 as platform default; P0 fix did not reach calibration service | `traffic-calibration.service.ts:212` |
| `LayeredValue` resolution | subject→deal→submarket→market→baseline | **deal layer hardcoded `null`** — 4-layer, not 5 | N/A | FIX | T4d-F4: resolver excludes deal layer | `coefficient-resolver.service.ts:215` |

---

## MODULE: DemandContext / Projection (T3 + T4d)

| Field group | Target source order | Actual | Provenance rendered? | Gap class | Finding | File:Line |
|---|---|---|---|---|---|---|
| `rent_growth_current` | subject (override) → agent_confirmed → perYearOverride → platform_default | **last-write-wins** — no precedence enforcement | PARTIAL — override wins but provenance not stored | FIX | T3: `rent_growth_current` last-write-wins; no layer precedence | `assumption-store-builder.ts` |
| `weekly_traffic_forecast` | subject (actuals) → submarket peer → market default | **mock data** — `FLYWHEEL_FEEDS` array is static fiction | NO — "+8.4% avg over-prediction" fabricated | FIX | T4d-F1: dashboard renders static mock data with no backend connection | `DealFlywheelDashboard.tsx:78-139` |
| `months_to_stabilize` | derived from `occupancyPath` | **assumed** — `?? 12` heuristic in B5 | NO | FIX | T4d: B5 consumes assumed value, not derived | `b5-io-from-lease-up.ts` |

---

## MODULE: S3/R2 Storage (T4bc)

| Field group | Target source order | Actual | Provenance rendered? | Gap class | Finding | File:Line |
|---|---|---|---|---|---|---|
| `upload_proxy_token` | org-scoped + HMAC secret | **HMAC secret has hardcoded fallback** `'r2-proxy-fallback-secret'` | N/A | **FIREWALL** | T4bc-F1: token forgery possible if env vars unset | `archive.routes.ts:1620-1621` |
| `redistribution_restricted` | S4-flagged at ingestion | **hardcoded `FALSE`** for all uploads | NO | **FIREWALL** | T4bc-F2: CoStar files enter global pool unflagged | `data-library-upload/index.ts:73` |
| `s3_client_credentials` | env-driven | env-driven ✓ | N/A | PASS | T4bc-F3/F4: no hardcoded secrets | `archive.routes.ts:1659`, `data-library-upload-processor.ts:30` |

---

## MODULE: Provenance Rendering (T5)

| Field group | Target source order | Actual | Provenance rendered? | Gap class | Finding | File:Line |
|---|---|---|---|---|---|---|
| `SourceBadge` component | canonical shared type | **TWO forks** — `primitives/` vs `financial-engine/` with divergent props | N/A | FIX | T5-G1: type system fork, no shared canonical source | `SourceBadge.tsx` (two files) |
| `LayeredValue` API payload | full 5-layer with `agentId`, `runAt`, `metadata` | **frontend receives truncated** — `agentId`, `runAt`, `metadata` dropped at API boundary | N/A | FIX | T5-G2: API serialization drops provenance fields | API boundary (unspecified serializer) |
| `ProvenancedValue.rich_fields` | rendered in UI | **defined but invisible** — `sourceRefs`, `modelVersion`, `userReviewed`, `rationale` never rendered | NO | FIX | T5-G3: rich fields defined in type but not in component | `ProvenancedValue.ts` type |
| `ProvenanceStamp` | exposed via API for audit | **trapped in `deal_data._provenance`** — no API endpoint exposes it | NO | FIX | T5-G4: ingestion timestamps, raw source refs, job IDs inaccessible | `deal_data._provenance` JSONB |
| `ingestion_source_mapping` | all sources mapped to `LayeredValueSource` | **gaps** — `capsule_bridge`/`comp_set_sync` unmapped; `archive_import`/`owned_import` collapsed | N/A | FIX | T5-G5: ingestion-to-source mapping incomplete | `ingestionToLayeredValueSource.ts` |
| `DataQualityBadge` | renders ACTUAL/INFERRED/ESTIMATED/DEFAULT | renders correctly ✓ | YES | PASS | T5-P4: Spec §12 buckets rendered | `DataQualityBadge.tsx` |
| `SourceDocPill` | document extraction provenance | renders with popover ✓ | YES | PASS | T5-P4: full provenance rendered | `SourceDocPill.tsx` |

---

## MODULE: Data Source Inventory (T4bc + prior audit)

| Field group | Target source order | Actual | Provenance rendered? | Gap class | Finding | File:Line |
|---|---|---|---|---|---|---|
| `fetch_permits` | internal route | **NOT-WIRED** — calls `/supply/permits` (404) | N/A | FIX | T4bc-F8: dead tool→route link | `fetch_permits.ts:61` |
| `fetch_submarket_deliveries` | internal route | **NOT-WIRED** — calls `/supply/deliveries` (404) | N/A | FIX | T4bc-F8: dead tool→route link | `fetch_submarket_deliveries.ts:60` |
| `market_inventory` fallback | internal table | **EMPTY-BY-BUG** — no INSERT statements anywhere | N/A | FIX | T4bc-F9: permanently empty table | `market_inventory` table |
| `CoStar` API call | restricted vendor API | **no live calls** — firewall intact ✓ | N/A | PASS | T4bc-F7: no `costar.com`, SDK, or env vars | Platform-wide grep |
| `Anthropic/Claude` | LLM API | **WIRED** — `AI_INTEGRATIONS_ANTHROPIC_API_KEY` set | N/A | PASS | T4bc: correct credential name, not generic `ANTHROPIC_API_KEY` | `llm.service.ts:56` |

---

## PRIORITIZED ACTION LIST

### P0 — Block multi-org onboarding / production

| # | Action | Owner | File:Line |
|---|---|---|---|
| 1 | **Redact `tenant_name` before LLM prompt** — add `redactForLLM()` utility | T4e | `deal-financial-context.service.ts:364-374` |
| 2 | **Fix stale calibration default 0.99 → 0.50** — `traffic-calibration.service.ts` | T4d | `traffic-calibration.service.ts:212` |
| 3 | **Remove hardcoded proxy token secret** — throw if env vars absent | T4bc | `archive.routes.ts:1620-1621` |
| 4 | **Wire `redistribution_restricted` from caller** — don't hardcode FALSE | T4bc | `data-library-upload/index.ts:73` |

### P1 — Pre-Wave 3

| # | Action | Owner | File:Line |
|---|---|---|---|
| 5 | Scope `data_library` LIST/DOWNLOAD to org | T4a | `data-library-files.routes.ts` |
| 6 | Scope `data-upload.routes.ts` by org | T4a | `data-upload.routes.ts` |
| 7 | Build canonical coefficient registry (R4) — one vocabulary, one set of baselines | T4d + P0 V6 | `ConversionRegistry` (design doc §4) |
| 8 | Merge calibration Path A + Path B | T4d | `m07-calibration.routes.ts:410` + `leasing-traffic.routes.ts:846` |
| 9 | Fix `LayeredValue` resolver — un-hardcode `deal: null` | T4d | `coefficient-resolver.service.ts:215` |
| 10 | Surface `ProvenanceStamp` via API | T5 | `deal_data._provenance` → new endpoint |
| 11 | Unify `SourceBadge` components | T5 | `primitives/` + `financial-engine/` merge |
| 12 | Complete ingestion source mapping | T5 | `ingestionToLayeredValueSource.ts` |
| 13 | Replace `FLYWHEEL_FEEDS` mock with live data | T4d | `DealFlywheelDashboard.tsx:78-139` |

### P2 — Wave 3 or later

| # | Action | Owner | File:Line |
|---|---|---|---|
| 14 | Encrypt PST raw_body | T4e | `pstPipeline.ts:23` |
| 15 | Data retention / PII purge policy | T4e | Platform-wide |
| 16 | Wire `fetch_permits` / `fetch_submarket_deliveries` to working route | T4bc | `supply.routes.ts:940` |
| 17 | Populate `market_inventory` or remove dead fallback | T4bc | `market_inventory` table |
| 18 | Revenue engine `CONFIG` → learned coefficients | T4d | `revenue-engine.service.ts:149` |

---

## VERDICT

**Wave 0 cannot close on T6 until P0 items 1–4 are ticketed with severity and owner.** The PII leak (T4e-F1) is the highest-stakes finding — it outranks every other gap on the board. The firewall gaps (T4bc-F1/F2) are production-exploitable today. The stale calibration default (T4d-F5) is a live data-integrity defect affecting operator-facing UI.

**Recommended sequence:**
1. Ticket P0 items 1–4 immediately (bot can draft in next response)
2. Leon runs D3-W7 DDL+proofs (independent, parallel)
3. On both landing: Wave 0 closes, design re-review resumes

---

**Cross-references:**
- T4a report: `backend/docs/audits/T4a_ORG_SCOPING_AUDIT_REPORT_2026-07-20.md`
- T4bc report: `backend/docs/audits/T4BC_UNIVERSE_S3_FIREWALL_AUDIT_2026-07-20.md`
- T4d report: `backend/docs/audits/T4D_FLYWHEEL_COEFFICIENTS_AUDIT_2026-07-20.md`
- T4e report: `backend/docs/audits/T4E_PII_BOUNDARY_AUDIT_2026-07-20.md`
- T5 report: `backend/docs/audits/T5_PROVENANCE_RENDERING_AUDIT.md`
- P0 V6 ticket: `backend/docs/tickets/TICKET_LEASINGTRAFFICSERVICE_098_INQUIRY_TOUR.md`
- Rent-growth ticket: `backend/docs/audits/TICKET_RENT_GROWTH_ALLOWLIST_GAP.md`
