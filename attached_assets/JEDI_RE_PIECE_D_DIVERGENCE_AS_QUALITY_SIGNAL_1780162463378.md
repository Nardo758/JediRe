# JEDI RE — PIECE D: DIVERGENCE AS QUALITY SIGNAL

**Purpose:** Track field-level divergences between sources over time. Build source-reliability intelligence the platform uses to weight reconciliations and to inform agent confidence. The architectural piece where the platform's data quality compounds over time rather than each conflict being a one-off resolution.

**Status:** Piece D of four (A, B, C, D). Companion to the Vendor Market Data Architecture overview.

**Predecessor work:** Piece A (vendor abstraction provides source tagging), Piece B (field-level reconciliation captures divergence signatures), Piece C (agents consume reliability intelligence when reasoning).

---

## THE PROBLEM PIECE D SOLVES

Pieces A, B, and C give the platform multi-vendor data ingestion, field-level reconciliation, and agent-synthesized findings grounded in transparent provenance. That's significant. But there's a missing piece: **the platform doesn't learn from disagreement.**

Today (and even after Pieces A-C):
- CoStar says Atlanta Midtown vacancy is 9.2%
- Yardi Matrix says 10.6% for the same period
- The reconciliation picks one per documented precedence; the other is retained as a contributing source
- This happens on Deal 1, Deal 2, Deal 3, ..., Deal N across the platform's history
- Each conflict resolves identically based on precedence
- The accumulated divergence pattern (CoStar tends to read 1.4pp below Yardi in Atlanta Midtown) is never extracted, examined, or used

Piece D extracts it. Over time, the platform learns:

- CoStar is generally lower than Yardi for occupancy figures by ~1.2pp in Atlanta MSA (probable submarket boundary definition difference)
- Apartment Locator's asking rents lag market by ~30-60 days vs CoStar
- T12-derived LTL is structurally lower than lease-level LTL by 5-15× in value-add positioned deals (because T12 captures past period not current gap)
- Berkadia surveys consistently show 15-25bp higher cap rates than CoStar for the same submarket (probable deal-size mix difference)

These aren't bugs. They're systematic differences between sources reflecting methodology, sampling, timing, and definition. Knowing them lets the platform:

1. **Weight reconciliations smarter** — when reconciling Atlanta Midtown vacancy, knowing CoStar runs lower than Yardi by ~1.2pp informs whether the divergence in any specific deal is normal or anomalous
2. **Inform agent confidence** — agents reasoning about market vacancy can incorporate "this divergence is within the typical CoStar-Yardi pattern for this submarket" rather than treating each divergence as equally informative
3. **Surface anomalies as signal** — when CoStar suddenly runs 5pp higher than Yardi for a submarket where it normally runs 1.2pp lower, that's a real signal (something changed)
4. **Calibrate reconciliation precedence per submarket** — instead of one global precedence rule, the platform can learn that certain sources are more reliable for certain submarkets

---

## WHAT PIECE D STORES

A divergence ledger that captures every material field-level divergence over time:

```typescript
interface DivergenceObservation {
  observation_id: UUID;
  observed_at: timestamp;
  
  field_name: string;
  geography_level: 'msa' | 'submarket' | 'property';
  geography_id: string;
  observation_period: string;       // 'Q2 2026', '2026-05', specific date
  
  source_a: string;                  // 'costar'
  source_a_value: any;
  source_a_as_of: date;
  
  source_b: string;                  // 'yardi_matrix'
  source_b_value: any;
  source_b_as_of: date;
  
  delta_absolute: number;            // |source_a_value - source_b_value|
  delta_relative: number;            // delta / mean(source_a_value, source_b_value)
  delta_direction: string;           // 'a_higher' | 'b_higher' | 'equal'
  
  context: {
    submarket: string;
    property_type: string;
    deal_id?: string;                // If observed in a deal context
    methodology_notes?: string;
  };
}
```

This ledger grows over time as deals are processed. After 6-12 months of active use, the ledger has enough data to compute reliable patterns.

---

## WHAT PIECE D PRODUCES

Aggregated source-reliability intelligence:

```typescript
interface SourceReliabilityProfile {
  profile_id: UUID;
  computed_at: timestamp;
  
  field_name: string;
  geography_scope: {
    level: 'msa' | 'submarket' | 'national';
    id?: string;
  };
  
  sources_compared: string[];        // ['costar', 'yardi_matrix']
  
  observation_count: number;         // How many divergence observations underlie this profile
  
  patterns: {
    mean_delta: number;              // CoStar runs X higher/lower than Yardi on average
    median_delta: number;
    delta_stddev: number;
    consistency: 'high' | 'medium' | 'low';  // How consistent is the directional pattern
    
    by_market_phase?: object;        // Does the pattern change in different market cycles?
    by_property_type?: object;       // Does the pattern differ for value-add vs stabilized?
  };
  
  recommendations: {
    reconciliation_weighting: object;  // Suggested per-source weight for this field/scope
    confidence_signal: string;          // What this pattern tells agents about confidence
    anomaly_thresholds: object;         // What delta magnitudes should trigger anomaly flags
  };
  
  last_updated: timestamp;
  next_recompute_at: timestamp;
}
```

These profiles are computed periodically (weekly? monthly?) from the divergence ledger. They're consumed by:

- **Piece B's reconciliation logic** — when reconciling a field with known divergence patterns, the reconciliation can weight sources per the profile
- **Piece C's agent reasoning** — agents incorporate "this divergence is consistent with typical CoStar-Yardi pattern for this submarket"
- **Anomaly detection** — when a new divergence observation falls outside the profile's typical range, the system flags it for review

---

## ANOMALY DETECTION

The most actionable output of Piece D is anomaly flagging. The platform learns:

> "CoStar typically reads 1.2pp lower than Yardi for Atlanta Midtown vacancy, with standard deviation 0.4pp."

When a new observation comes in:

> "Atlanta Midtown vacancy Q3: CoStar 7.1%, Yardi 12.3% — delta 5.2pp"

That delta is way outside the typical -1.2pp ± 0.4pp pattern. Something changed:
- CoStar may have re-sampled a different building set
- Yardi may have updated submarket boundaries
- A major lease-up or distress event may be affecting one source's average more than the other
- One source may have a stale period being read against a fresh period from the other

Anomalies don't auto-resolve. They surface to:
- **The operator** — as a finding worth investigating
- **The agent's reasoning** — as a signal warranting explicit treatment in the narrative ("Note: Q3 sources diverge unusually; investigation recommended before relying on either")
- **Source quality monitoring** — accumulating anomalies for a vendor in a submarket may indicate broader data quality issues with that vendor

---

## WHERE DIVERGENCE PATTERNS INFORM AGENT BEHAVIOR

Piece C agents consume Piece D's profiles when reasoning. Three concrete examples:

**Example 1 — Confidence calibration:**

Agent reasoning about Atlanta Midtown vacancy reads:
- CoStar Q2: 9.2%
- Yardi Q2: 10.6%
- Delta: -1.4pp (CoStar lower)
- Piece D profile: typical CoStar-Yardi delta for Atlanta Midtown vacancy is -1.2pp ± 0.4pp

The agent's confidence is high — the divergence is exactly typical. The narrative might say: "Atlanta Midtown vacancy near 9-11% range per CoStar (9.2%) and Yardi Matrix (10.6%), with the spread between sources consistent with their typical methodological differences in this submarket."

**Example 2 — Anomaly handling:**

Agent reasoning about a different submarket reads:
- CoStar: 8.4%
- Yardi: 14.7%
- Delta: -6.3pp
- Piece D profile: typical delta is -1.5pp ± 0.5pp

The agent's confidence is degraded. The narrative might say: "Source disagreement on submarket vacancy is unusually large for this market (CoStar 8.4% vs Yardi 14.7%, vs typical 1-2pp difference). Recommend investigation before relying on either source. Possible causes: recent submarket re-definition by one vendor, large-property delivery affecting samples, or one source carrying stale data."

**Example 3 — Per-vendor weighting:**

When the platform reconciles a field where Piece D profile shows CoStar systematically more reliable than Berkadia for that submarket type:
- Piece B's reconciliation logic weights CoStar more heavily in the resolved value
- The agent's citation explicitly notes the source preference
- Operator can override the weighting via per-field source preference (per Piece C)

---

## OPERATIONAL CONSIDERATIONS

### Storage scale

The divergence ledger grows with every deal and every field. Rough estimate:
- 100 active deals × 50 multi-source fields per deal × monthly observations = 5,000 observations/month
- After 24 months: 120,000 observations
- Each observation maybe 500 bytes → 60MB
- Manageable scale; PostgreSQL handles easily

### Profile computation cost

Aggregating divergence observations into source reliability profiles is computationally moderate. Done weekly per submarket per field per source pair. Probably runnable as a scheduled job in 10-30 minutes for a portfolio of 100-500 deals.

### Bootstrap problem

Piece D is only useful with enough data. For the first 3-6 months of operation, profiles will have thin sample sizes and low confidence. The platform should:
- Flag low-confidence profiles explicitly (don't pretend to know patterns from 5 observations)
- Fall back to global defaults when submarket-specific patterns aren't confident yet
- Let global patterns inform submarket patterns gradually as data accumulates

### Bias risks

Two important biases to manage:

**Selection bias** — the platform only sees divergences for deals operators actually work on. If operators tend to underwrite specific submarkets, profiles for those submarkets will be confident; profiles for other submarkets will stay thin. The platform should acknowledge this explicitly rather than projecting confidence outside the empirical sample.

**Confirmation bias** — if the platform learns "CoStar is more reliable than Yardi for cap rates," operators might tune out Yardi-based divergences. The architecture should treat reliability profiles as priors that can be overridden by anomaly evidence, not as deterministic precedence rules.

---

## VENDOR-LEVEL QUALITY INTELLIGENCE

Piece D produces not just field-level patterns but vendor-level intelligence:

```typescript
interface VendorQualityIntelligence {
  vendor_id: string;
  computed_at: timestamp;
  
  by_field_category: {
    submarket_metrics: { reliability_score: number; sample_size: number; },
    sale_comps: { ... },
    rent_comps: { ... },
  };
  
  by_geography: {
    msas: { [msa_name]: { reliability_score: number; sample_size: number; } }
    submarkets: { [submarket_name]: { ... } }
  };
  
  freshness_consistency: number;     // Does this vendor's data arrive when expected, with claimed as_of dates?
  
  divergence_anomaly_rate: number;   // How often does this vendor produce anomalous outliers?
  
  notes: string[];
}
```

This intelligence informs:

- **Operator-facing vendor evaluations** — operators considering whether to subscribe to a new vendor see how that vendor performs against existing sources
- **Platform-level vendor selection** — when the platform chooses default sources for a field, the intelligence informs the choice
- **Vendor relationship management** — patterns of anomalies might inform conversations with vendor support

---

## IMPLEMENTATION SCOPE

**Phase 2D-1 — Divergence ledger (3-4 weeks):**
1. Define `DivergenceObservation` schema
2. Wire Piece B's reconciliation to write to the ledger on every material divergence
3. Build query interfaces for ledger inspection
4. Verify ledger growth at expected rate as Pieces A and B come online

**Phase 2D-2 — Source reliability profiles (4-5 weeks):**
1. Define `SourceReliabilityProfile` schema
2. Build aggregation logic (weekly scheduled job)
3. Compute initial profiles from accumulated ledger data
4. Surface profiles in admin/internal UI for inspection

**Phase 2D-3 — Anomaly detection (3 weeks):**
1. Define anomaly threshold logic (delta vs profile mean/stddev)
2. Wire anomaly flagging into Piece B's reconciliation output
3. Surface anomalies in Validation Grid and per-field provenance
4. Wire anomalies into agent narrative (Piece C consumer)

**Phase 2D-4 — Reconciliation weighting (3-4 weeks):**
1. Wire profile-informed weighting into Piece B's reconciliation
2. Surface weighting transparency to operators (why this source won)
3. Per-field source preference override (per Piece C)

**Phase 2D-5 — Vendor quality intelligence (3 weeks):**
1. Compute vendor-level intelligence from field-level patterns
2. Surface in operator-facing vendor evaluation UI
3. Use in platform-level default source selection

**Total estimated Piece D scope:** 16-19 weeks. Significant gating dependency: meaningful Piece D output requires Pieces A and B accumulating data for 3-6 months first. Piece D starts late in the architecture rollout, not concurrently with A/B.

---

## ACCEPTANCE CRITERIA

Piece D is complete when:

1. **Divergence ledger captures every material divergence** Piece B identifies, with full context (field, sources, deltas, geography).

2. **Source reliability profiles computed and refreshed** on schedule. Profiles have explicit confidence ratings based on sample size; thin samples don't pretend to be reliable.

3. **Anomaly detection operational.** New divergences are evaluated against profiles; anomalies flag appropriately; agents and operators see anomaly context.

4. **Reconciliation weighting informed by profiles.** Piece B's reconciliation uses profile data to inform per-source weighting; the weighting is transparent to operators.

5. **Vendor quality intelligence operational.** Vendor-level patterns visible to operators; used in platform default source selection.

6. **Bias acknowledged and managed.** Selection bias surfaces explicitly (profiles only confident where operators have worked); confirmation bias managed by anomaly-evidence overrides.

7. **Piece D output flows back into agent reasoning** (Piece C). The narrative agents produce reflects the platform's accumulated source-reliability intelligence.

---

## RELATIONSHIP TO OTHER DOCUMENTS

| Document | How Piece D relates |
|---|---|
| Vendor Market Data Architecture (overview) | Piece D is "Divergence as Quality Signal" — the compounding play of the architecture |
| Piece A (Vendor Abstraction) | Piece D consumes Piece A's vendor identity tagging on every observation |
| Piece B (Field-Level Reconciliation) | Piece D consumes Piece B's divergence signatures; produces output that informs Piece B's future reconciliations |
| Piece C (Agent Synthesis Interface) | Piece D's source reliability profiles inform agent confidence calibration and anomaly handling |
| Deal Details Audit | The audit-found divergences (LTL 0.35% vs 13.8%) are example inputs to Piece D's ledger |
| Engine A + M07 lease-roll audit | The cross-source patterns identified in the audit (T12 vs lease-level for LTL) are systemic patterns Piece D would surface explicitly |

---

## NOTE TO REPLIT

Three things worth being explicit about:

**First, Piece D is genuinely optional in the sense that Pieces A-C are complete architecture without it.** The platform works (and improves significantly over current state) with just Pieces A-C. Piece D is the compounding-value play that makes the platform smarter over time.

**Second, Piece D is meaningless without sustained data accumulation.** The bootstrap period is real — meaningful reliability profiles need 3-6 months of active platform use across multiple deals in multiple submarkets. Building Piece D's infrastructure early is fine; expecting it to produce useful intelligence in the first quarter is not.

**Third, the biases (selection and confirmation) deserve genuine architectural attention.** Piece D risks producing confident-sounding intelligence that reflects platform usage patterns rather than ground truth. The framework needs explicit acknowledgment of where profiles are weak; explicit anomaly-evidence override paths; explicit operator visibility into the limitations.

Per CLAUDE.md P8: this piece is the most forward-looking of the four. Many implementation details depend on what Pieces A, B, C surface as they mature. The framework here is the target; specifics will refine as data accumulates and patterns become visible. State-verify before implementing each phase.
