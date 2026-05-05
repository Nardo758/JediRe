# Submarket Extension Wiring Update

**Spec relationship:** Companion to `M36_Multi_Tier_Factor_Addendum.md` and `Submarket_Peer_Intelligence_Spec.md`. Updates the integration surfaces in `WIRING_UPDATE.md` and `jedi_re_module_wiring_blueprint_v2.xlsx` with the new edges, contracts, and cascades introduced by submarket-level analysis.
**Status:** Implementation-grade

**Scope of changes:** Six new edges, four new data contracts, three new Kafka topics, two updates to existing contracts, and one new module entry (M39 Submarket Peer Intelligence).

---

## 1. New Module Entry

**M39 Submarket Peer Intelligence** added to the Module Registry.

| Field | Value |
|---|---|
| Module ID | M39 |
| Name | Submarket Peer Intelligence |
| Surface | S4: Inference (with UI surface in Deal Capsule + F-key screen) |
| Category | Core |
| Purpose | User-facing dual-ranking peer surface. Direct competitors within MSA (drive-time + MSA factor + character) and structural analogs across MSAs (national factor + character + macro tier). Wraps M36 multi-tier loadings + M37 similarity primitives into a discoverable feature. |
| Has UI | Yes |
| Outputs | Competitor rankings, analog rankings, combined rankings per use case, peer detail comparisons, peer dynamics over time |
| Consumers | M15 Competition, Cashflow Agent, M07 Traffic, Investment Memo, UI surfaces |
| Inputs | M36 multi-tier loadings (β_sm, γ_sm), M36 spatial kernels, M37 similarity primitives, submarket characters, recent peer metrics from M05/M07 |
| Status | New (specced) |
| Priority | P1 |
| Notes | Surfaces inside Deal Capsule + standalone F-key screen + agent rationale links + auto-generated investment memo sections |

---

## 2. New Edges in Data Flow

Six new edges added to the Data Flow Matrix v2. All marked ★ to indicate new edges.

### 2.1 M36 → M39 (factor loadings to peer engine)

Multi-tier loadings flow into peer ranking computation. Both β_sm (national factor loadings) and γ_sm (MSA factor loadings) are read for every candidate-pair similarity computation.

**Trigger:** `peer.ranking_requested` (synchronous request) or `factors.refreshed` (proactive cache rebuild).

### 2.2 M37 → M39 (similarity primitives)

M39 reuses M37's similarity computation infrastructure rather than reimplementing it. The kernel functions (exponential decay on factor distance, character distance) are shared.

**Trigger:** Library-level dependency, not message-passing. M39 imports M37's similarity functions directly.

### 2.3 M39 → M15 (peer-suggested comp set)

M15 Competition queries M39 for use_case=comp_set rankings to seed comp set construction. User then refines with manual overrides.

**Trigger:** `comp_set.construction_requested` from M15 to M39.

### 2.4 M39 → M07 (competitor peers for traffic)

M07 reads competitor peers (use_case=traffic) when computing traffic projections. Competitor concession trends, occupancy levels, lease-up velocity feed into M07's covariate inputs at submarket grain.

**Trigger:** `traffic.competitor_set_requested` from M07 to M39 on each traffic projection update.

### 2.5 M39 → Cashflow Agent (analog visibility)

Cashflow Agent's rationale for any analog-driven assumption includes a link to the M39 peer intelligence view showing which submarkets contributed to the M37 forecast.

**Trigger:** Synchronous read from M39 during agent rationale generation.

### 2.6 M39 → Investment Memo (auto-generated comparable markets section)

Investment Memo template calls M39 for the deal's top competitors and analogs to populate the "Comparable Markets" section automatically.

**Trigger:** `memo.generation_requested` reads M39 peer rankings.

---

## 3. New Data Contracts

Four new DCs added to the Data Contracts sheet, numbered DC-17 through DC-20.

### DC-17: M36 → M39 Factor Loadings

```
Edge ID: DC-17
From → To: M36 → M39
Trigger: peer.ranking_requested OR factors.refreshed
Payload Schema:
  SubmarketLoadings {
    submarket_id,
    parent_msa_id,
    asset_class,
    national_loadings: {
      factor_id: { loading_value, std_error, t_stat },
      ...
    },
    msa_loadings: {
      factor_id: { loading_value, std_error, t_stat },
      ...
    },
    residual_variance,
    estimation_date,
    shrinkage_weight   // 0 if no shrinkage applied; >0 indicates thin-data submarket
  }
Update Cadence: Monthly refresh (with M36 multi-tier estimation pipeline)
Notes: Loadings cached per submarket × asset class. Cache invalidated on factors.refreshed Kafka event.
```

### DC-18: M39 → M15 Competitor Peers

```
Edge ID: DC-18
From → To: M39 → M15
Trigger: comp_set.construction_requested
Payload Schema:
  CompetitorPeerSet {
    subject_submarket_id,
    asset_class,
    competitors: [
      {
        candidate_submarket_id,
        rank,
        similarity_score,
        similarity_breakdown: {
          geographic: float,
          msa_factor: float,
          character: float
        },
        recent_metrics: {
          rent_psf_current, rent_growth_yoy, occupancy_pct
        }
      }
    ],
    cache_expires_at
  }
Update Cadence: Cached weekly; refreshed on factors.refreshed
Notes: M15 uses this as seed; user refines with manual overrides via DC-19.
```

### DC-19: M15 → M39 User Override Submission

```
Edge ID: DC-19
From → To: M15 (user input) → M39
Trigger: User pins, removes, or demotes a peer in comp set UI
Payload Schema:
  PeerOverride {
    user_id,
    deal_id,
    subject_submarket_id,
    ranking_type: 'competitor' | 'analog' | 'comp_set',
    candidate_submarket_id,
    override_action: 'pin_top' | 'remove' | 'demote',
    rationale,
    expires_at  // nullable; permanent if not set
  }
Update Cadence: User-driven, ad hoc
Notes: Stored in user_peer_overrides table. Applied on subsequent peer_rankings queries within the override scope (deal-scoped by default).
```

### DC-20: M39 → M07 Competitor Set for Traffic

```
Edge ID: DC-20
From → To: M39 → M07
Trigger: traffic.competitor_set_requested
Payload Schema:
  TrafficCompetitorSet {
    subject_submarket_id,
    competitor_submarket_ids: [string],   // top 5 within MSA, weighted by traffic use case
    competitor_metrics: [
      {
        submarket_id,
        weight,                           // similarity-derived weight
        recent_concessions,
        recent_occupancy,
        recent_lease_up_velocity
      }
    ]
  }
Update Cadence: On each traffic projection update
Notes: M07 uses the weighted competitor metrics as covariate inputs to its conversion funnel computation.
```

---

## 4. Updates to Existing Contracts

### DC-06 (M36 → M07) — Updated

The existing DC-06 sigma_overlay contract is updated to use submarket-grained Σ when the multi-tier factor model is operational.

**Changes:**
- `sigma_local` is now genuinely submarket-level (constructed from three-tier components per M36 multi-tier addendum) rather than falling back to MSA-level
- `factor_loadings` field expands to include both national and MSA tier loadings:
  ```
  factor_loadings: {
    national: [{variable, factor, loading}],
    msa: [{variable, factor, loading}]
  }
  ```
- New field `loading_confidence`: indicates whether loadings are full-data (no shrinkage) or shrunk-toward-typical (sparse submarket case)

**Backward compatibility:** M07 must handle both old (single-tier) and new (multi-tier) formats during transition. Field presence detection: if `factor_loadings.national` exists, use new format; else fall back to old.

### DC-13 (M37 → Cashflow Agent) — Updated

M37's forecast response now includes peer attribution that links to M39 rankings.

**Changes:**
- Existing `analogs` field gains a `submarket_id` per analog (was previously implicit)
- New field `peer_intelligence_link`: URL pointing to M39 peer view filtered to the contributing analogs
- New field `submarket_grained`: boolean indicating whether forecast was computed at submarket or MSA grain

```
AnalogForecast {
  ...existing fields...,
  analogs: [
    { event_id, market: { msa, submarket }, similarity, realized_impact }
  ],
  peer_intelligence_link,
  submarket_grained
}
```

---

## 5. New Kafka Topics

Three new topics added to the Recomputation Cascade sheet.

### 5.1 `factors.refreshed`

Emitted by: M36 multi-tier estimation pipeline (monthly)
Subscribers:
- M39: invalidate peer ranking cache; rebuild lazily on next request
- M37: invalidate analog similarity cache (factor loadings changed)
- M07: refresh sigma_overlay cache
- M14: refresh factor variance attribution cache
- M38: log factor refresh event for calibration tracking

Payload: `{ refresh_id, asset_classes_affected: [...], loadings_version }`

### 5.2 `peer.rankings_updated`

Emitted by: M39 when rankings are recomputed (typically weekly + on factors.refreshed)
Subscribers:
- M15: refresh comp set seeding for all open deals in affected submarkets
- Cashflow Agent: log that rationale-link cache should refresh on next agent invocation
- UI: invalidate any cached peer ranking displays in active sessions

Payload: `{ refresh_id, submarket_ids_affected: [...], asset_classes: [...] }`

### 5.3 `peer.override_applied`

Emitted by: M39 when user submits an override via DC-19
Subscribers:
- M15: re-seed comp set immediately for the affected deal
- M38: log override as user feedback signal (potential calibration input)
- Audit log: persistent record of override decisions for compliance

Payload: `{ override_id, user_id, deal_id, subject_submarket_id, action, rationale }`

---

## 6. New Recomputation Cascades

Three new cascades added to the Recomputation Cascade sheet.

### Cascade: Submarket factor loadings refreshed

```
Trigger: M36 multi-tier estimation pipeline completes monthly run
Source: M36
Kafka: factors.refreshed
Subscribers (in order): M39 → M37 → M07 → M14 → M38

Action per subscriber:
  M39: invalidate peer ranking cache; rebuild on next request
  M37: invalidate analog similarity cache; recompute on next forecast query
  M07: refresh sigma_overlay; re-run traffic projections for affected deals
  M14: refresh factor variance attribution
  M38: log refresh event for calibration record-keeping

UI Effect: Aggressiveness badges may shift on next interaction. Peer rankings 
may reorder. Risk attribution refreshed.

Latency Target: < 5min for cache rebuild propagation
```

### Cascade: Peer ranking computed/refreshed

```
Trigger: User opens deal capsule peer view OR M39 weekly batch refresh
Source: M39
Kafka: peer.rankings_updated
Subscribers (in order): M15 → UI

Action per subscriber:
  M15: refresh comp set seed if peer view is for an active deal
  UI: invalidate display cache

UI Effect: Peer ranking view populates. M15 comp set view shows updated 
suggestions if user navigates there.

Latency Target: < 2s for first display, < 30s for batch refresh propagation
```

### Cascade: User pins/removes peer

```
Trigger: User clicks pin/remove/demote on peer in M39 UI or M15 comp set UI
Source: M39
Kafka: peer.override_applied
Subscribers (in order): M15 → M38 → audit_log

Action per subscriber:
  M15: re-seed comp set with override applied; refresh display
  M38: log override as user feedback signal
  audit_log: persistent record

UI Effect: Comp set view refreshes within < 1s. Override visible in peer 
ranking with badge indicator.

Latency Target: < 1s end-to-end (synchronous user interaction)
```

---

## 7. Document Triggers — Submarket-Aware Outlier Checks

The existing Document Triggers sheet already has F47 outlier scoring on parsed values. With submarket-level Σ available, outlier scoring becomes more precise: parsed values are scored against submarket-specific μ and σ rather than MSA-level aggregates.

**Updated rule for all parser → M36 outlier checks (DC-16):**

```
F47 outlier score uses submarket-level (μ, σ) when available:
  - Submarket has full-data factor loadings → use submarket-level
  - Submarket has shrunk loadings → blend submarket-level with MSA-level
  - Submarket has insufficient history → fall back to MSA-level

This makes outlier flags more accurate at the deal level — a T12 expense 
ratio that's normal for the broader MSA but anomalous for the specific 
submarket gets flagged appropriately.
```

No new contract; this is a refinement to existing behavior.

---

## 8. Implementation Priority Updates

Three new entries added to the Implementation Priority sheet.

| Priority | Task | Description | Dependencies | Effort | Criticality |
|---|---|---|---|---|---|
| P1-9 | M36 Multi-Tier Factor Pipeline | Implement Stages 1-5 of the multi-tier estimation pipeline (national factors, MSA factor extraction, submarket loadings, spatial kernel, on-demand Σ assembly) | M36 base implementation, submarket boundary definition | Very High | Critical for submarket capabilities |
| P1-10 | M39 Submarket Peer Intelligence — Core | Implement schema + ranking computation service + APIs (Phases 1-2 of M39 spec) | M36 multi-tier (P1-9) | High | High |
| P1-11 | M39 UI Surfaces + Consumer Integration | Implement Deal Capsule peer view, F-key screen, M15 integration, agent rationale linking, memo generation (Phases 3-4 of M39 spec) | M39 core (P1-10) | High | High |
| P2-4 | Submarket boundary definition | Algorithmic polygon generation + vernacular name mapping for tier-1 + tier-2 markets | None (parallelizable with M36 base work) | High | Critical for P1-9 |

P2-4 is critical-path for P1-9 but can be worked in parallel with M36 base implementation. The boundary definition can begin before national-tier factor estimation completes; they don't block each other.

---

## 9. Migration Considerations

The submarket extension introduces capabilities that don't exist today. A few migration-style concerns worth flagging:

**Existing deals with MSA-level scope.** Deals already in the platform have implicit MSA-scoped Σ overlays (via M36 base). When the multi-tier pipeline lands, these deals can be re-scoped to their actual submarket without losing history. The deal record adds submarket_id; existing MSA-level cached values stay valid as fallback while submarket-level values populate.

**Comp sets configured manually today.** Existing user-curated comp sets remain valid; M39 doesn't replace them. The peer-suggested comp set is a *seed* for new deals; existing deals can opt into the suggestion without losing their manual configuration.

**Investment memos generated before M39.** Memos auto-generated before M39 won't have the "Comparable Markets" section. Re-generating updates them; old versions remain accessible in audit history.

**Backward compatibility on DC-06.** As noted in Section 4, M07 must handle both single-tier and multi-tier sigma_overlay formats during the transition. After all asset classes have been migrated to multi-tier, single-tier fallback can be removed.

---

## 10. Summary

The submarket extension adds:

- **One new module** (M39 Submarket Peer Intelligence)
- **Six new edges** (M36→M39, M37→M39, M39→M15, M39→M07, M39→Agent, M39→Memo)
- **Four new data contracts** (DC-17 through DC-20)
- **Two updated contracts** (DC-06, DC-13)
- **Three new Kafka topics** (factors.refreshed, peer.rankings_updated, peer.override_applied)
- **Three new recomputation cascades**
- **Three new implementation priorities** (P1-9, P1-10, P1-11) plus one supporting (P2-4)

The wiring is mostly additive — no removals, no breaking changes to existing contracts beyond backward-compatible field additions. Existing modules can continue operating MSA-level until their submarket-level integration is complete; M39 + M36 multi-tier provides the new capability without forcing a coordinated cutover.

When this lands together with the multi-tier factor pipeline and the M39 peer intelligence feature, the deal-level utility of the platform takes a meaningful step up. Underwriters get peer intelligence; the agent gets defensible analog evidence; M14 risk gets granular factor attribution; M07 gets submarket-grained traffic projections; investment memos get auto-generated comparable markets sections.

This is the wiring that makes the submarket capability operationally complete.

---
