# JediRe — LIUS + Neural Network Integration Architecture

**Status:** Specification
**Version:** 0.3
**Owner:** CashFlow Agent / Data Intelligence

---

## 1. Why This Architecture Exists

The system has five independent subsystems that should talk to each other:

| Subsystem | What It Does | Current Problem |
|-----------|-------------|-----------------|
| **LIUS** (planning) | Deterministic line-item underwriting schemas | Not built yet |
| **Knowledge Graph** (existing) | Relationship discovery, contextual connections | Only data-layer nodes, no underwriting evidence |
| **Deal Capsule** (existing) | F9 ProForma, user-facing deal UI | Evidence panel exists but shows ad-hoc data |
| **Agent Layer** (existing) | CashFlow, Commentary, Research, Supply agents | Free-form reasoning, no schema enforcement |
| **Building Profiles** (week 1 new) | Profile-matched OpEx benchmarks | Just created, not wired to anything |
| **Schema Feedback** (week 2 new) | Learn from post-close actuals | Table exists, no aggregation job |

The architecture below wires them together so they amplify each other rather than run in parallel.

---

## 2. System Architecture — End to End

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE (Deal Capsule)                          │
│                                                                                 │
│  F9 ProForma Grid                    Evidence Panel (right drawer)              │
│  ┌────────┬────────┬──────┐         ┌─────────────────────────────────┐       │
│  │ Line   │ Agent  │ User │         │ Posterior: $1,200/unit (±$180)  │       │
│  │ Item   │ Value  │Value │         │ Prior: archive $1,100 (n=47)    │       │
│  ├────────┼────────┼──────┤         │ T12: $1,722 — est. one-time     │       │
│  │ Insur. │ $210K  │  —   │────────▶│ Profile P50: $215 (n=12)        │       │
│  │ Tax    │ $145K  │ $140K│         │ Broker OM: $120K — COLLISION!   │       │
│  │ R&M    │ $95K   │  —   │         │                                   │       │
│  │ ...    │  ...   │  ... │         │ 🧠 Agent reasoning template...   │       │
│  └────────┴────────┴──────┘         └─────────────────────────────────┘       │
│                                                                                 │
│  F9 Walkthrough (Commentary)           Building Profile Card                   │
│  "Insurance jumped from $158K to        ┌────────────────────────┐            │
│   $267K in Year 2 due to FL coastal      │ Garden | 2017 | 194u   │            │
│   renewal reset. Tax step similar        │ Pool ✓ Fitness ✓ Club✓ │            │
│   per reassessment..."                   │ 9 structural twins     │            │
│                                          │ Matched at 92% conf    │            │
│                                          └────────────────────────┘            │
└────────────────────────────────┬────────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│    LIUS ENGINE      │ │  KNOWLEDGE GRAPH    │ │  BUILDING PROFILES  │
│    (new)            │ │  (existing)          │ │  (week 1)           │
│                     │ │                     │ │                     │
│  Schema catalog     │ │  Deal nodes         │ │  Profile clusters   │
│  Source resolver    │ │  Agent run nodes    │ │  OpEx benchmarks    │
│  Trajectory engine  │ │  Underwriting evid. │ │  Fingerprint match  │
│  Materiality calc   │ │  Event/impact nodes │ │                     │
│  Collision detector │ │                     │ │                     │
│  Reasoning template │ │  KG → LIUS: feed    │ │  Profile → LIUS:    │
│                     │ │  "4 similar deals   │ │  Tier 2.5 source    │
│                     │ │   with roof events" │ │                     │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │   AGENT RUNTIME          │
                    │   (CashFlow Agent)       │
                    │                          │
                    │  LLM only at step:       │
                    │  "translate schema       │
                    │   derivation → prose"    │
                    └─────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   SCHEMA FEEDBACK LOOP   │
                    │                          │
                    │  deal_monthly_actuals    │
                    │  → compare vs prediction │
                    │  → if bias: update schema│
                    │  → write to KG           │
                    └─────────────────────────┘
```

---

## 3. Data Flow — Step by Step

### 3.1 Deal enters the system

```
1. User uploads OM / creates deal
2. Building Profile Service runs:
   a. Extract: year_built, stories, amenities from OM parser
   b. Enrich county parcel data (existing GA ingestion pipelines)
   c. Compute fingerprint: garden|2010-2019|elev|pool|fit|club
   d. Query profile cluster: n=9 structural twins found
   e. Display Building Profile Card in Deal Capsule
3. Knowledge Graph seeds deal node:
   a. Creates DEAL node with building profile properties
   b. Creates RELATES_TO edges to similar profile cluster
   c. Links deal to submarket/county/msa nodes
```

### 3.2 LIUS engine runs (CashFlow Agent trigger)

```
4. resolveProjectType() → 'value_add' (example)
5. resolveLifecycleTimeline() → lease_up (m0-12) → stabilized (m13-60)
6. Load LIUS catalog filtered by: archetype + variant + lifecycle phase
7. Build dependency DAG from schemas (topo sort)
8. For each line item in topo order:
   a. Read schema entry
   b. Resolve hard rules → modify source_preference:
      - "FL coastal acquisition → replace T12 insurance with jurisdiction service"
   c. For each tier in source_preference:
      - Tier 1: Query deal_data (T12, rent roll) via existing extraction
      - Tier 2: Query deal_monthly_actuals (owned portfolio)
      - Tier 2.5: Query building_profile_opex_benchmarks (profile cluster)
      - Tier 3: Query Knowledge Graph for similar deal underwriting evidence
      - Tier 4: Compare to broker OM assumptions (collision detect only)
   d. Generate trajectory events from:
      - Schema-defined scheduled events (HVAC cycle, renewal reset)
      - Lifecycle phase transitions (lease_up→stabilized staffing reset)
      - Knowledge Graph: "4 deals in this submarket had insurance spikes at renewal"
   e. Compose trajectory per three-primitive model
   f. Run cross-checks → flags + auto-adjustments
   g. Compute confidence (scoring function, not Bayes — see §4)
   h. Detect broker collision with materiality function
   i. LLM CALL: fill reasoning template → prose explanation
   j. Persist evidence object to deal_data JSON
```

### 3.3 KG updated with underwriting evidence

```
9. For each line item evidence object:
   a. Create UNDERWRITING_EVIDENCE node
   b. RELATES_TO deal, tenant line item, agent run
   c. Copy posterior value, confidence, schema version to node properties
10. Update KG edges:
    a. Connect evidence nodes to building profile nodes
    b. Connect conflicting evidence to archive for flywheel
```

### 3.4 UI surfaces evidence

```
11. F9 ProForma grid renders agent-underwritten values
12. Click any cell → Evidence Panel opens showing:
    a. Posterior value + confidence band (p10/p90)
    b. All tier contributions (T12 $X, owned $Y, profile $Z)
    c. Collision report if broker ≠ agent (magnitude, narrative)
    d. Agent reasoning (filled template)
    e. Override controls (accept agent / accept broker / custom)
13. F9 Walkthrough tab shows Commentary Agent narrative
14. Building Profile Card shows profile cluster stats
```

### 3.5 Post-close feedback (M22)

```
15. deal_monthly_actuals populated for owned asset
16. Nightly aggregation job:
    a. For each line_item + schema_version:
       - Query actual median
       - Compare to predicted median
       - Compute bias: (actual - predicted) / predicted
    b. If bias significant AND n >= 30:
       - Write schema_feedback row
       - Update Knowledge Graph with actual outcome nodes
       - Connect to equivalent evidence nodes
17. Schema steward (human) reviews feedback queue
18. Promotion decisions tracked in schema_promotion_log
```

---

## 4. Scored Confidence (Not Bayesian)

The spec defines a scoring function that ships in 2 days instead of 3 weeks:

```typescript
function computeConfidence(
  sources: EvidenceSource[],
  crossCheckFlags: CrossCheckFlag[],
  sampleCount: number,
): ConfidenceScore {
  // Source freshness: 0-1
  const freshness = Math.min(1, sources.reduce((sum, s) => sum + s.freshness, 0) / sources.length);
  
  // Cross-check concordance: proportion of checks that pass
  const concordance = crossCheckFlags.filter(f => f.severity === 'pass').length / 
                      Math.max(1, crossCheckFlags.length);
  
  // Sample count factor: cap at 30
  const sampleFactor = Math.min(1, sampleCount / 30);
  
  // Weighted composite
  const raw = freshness * 0.4 + concordance * 0.4 + sampleFactor * 0.2;
  
  // Decode
  return {
    score: raw,
    level: raw >= 0.8 ? 'high' : raw >= 0.5 ? 'medium' : 'low',
    posterior: { p10: null, p90: null },  // set from distribution if archive available
    weakestLinks: [
      ...(freshness < 0.6 ? ['source_freshness'] : []),
      ...(concordance < 0.6 ? ['cross_check_conflict'] : []),
      ...(sampleFactor < 0.3 ? ['small_sample'] : []),
    ],
  };
}
```

Upgrade path: when the archive has n≥30 per line × profile × submarket, replace with Bayesian posterior. The interface stays the same; the implementation swaps.

---

## 5. Reasoning Templates

The LLM's only job in LIUS is turning derivations into prose. Templates per archetype prevent quality variance:

```typescript
// Template: Archetype B (T12-anchored, cross-validated)
const B_TEMPLATE = (ctx: TemplateContext) => `
For {{line_name}}, the agent started with the T12 value of ${{t12_value}}/unit 
{{one_time_strip_info}}.

Cross-validating against:
- Profile-matched cluster median: ${{profile_p50}}/unit (n={{n}} structural twins)
- Owned portfolio average: ${{owned_avg}}/unit (n={{owned_n}} similar assets)
- Archive P50 for {{vintage}} {{building_type}} properties: ${{archive_p50}}

The profile cluster suggests {{comparison_text}} — this is {{consistent|divergent|one_time_suspect}}.

Decision: ${{final_value}} is used. {{rationale}}
{{collision_note_if_applicable}}
`;
```

This ensures every line explanation has the same structure regardless of the model being used. The LLM fills in blanks from deterministic data. No room for hallucination or inconsistency.

---

## 6. KG ↔ LIUS — Bidirectional Wire Protocol

### 6.1 KG → LIUS (input enrichment)

Before LIUS executes source_preference, it queries KG for:

```typescript
interface KGContextForLIUS {
  similarDeals: {
    dealId: string;
    similarity: number;           // 0-1 composite score
    buildingProfileFingerprint: string;
    lineItems: Record<string, {   // keyed by LIUS id
      value: number;
      confidence: number;
      schemaVersion: number;
    }>;
    actualOutcomes: Record<string, {  // from deal_monthly_actuals if owned
      predicted: number;
      actual: number;
      biasPct: number;
    }>;
  }[];
  
  submarketEvents: {
    type: 'construction' | 'absorption' | 'regulatory' | 'economic';
    timing: string;
    impact: number;
    source: string;
  }[];
  
  archiveDistributions: {
    lineItem: string;
    p10: number;
    p50: number;
    p90: number;
    n: number;
  }[];
}
```

LIUS uses this as Tier 3 input — after owned portfolio (Tier 2) and profile (Tier 2.5) but before raw archive. If KG surfaces 4 structurally similar deals with actual outcomes, that's higher authority than generic archive.

### 6.2 LIUS → KG (output persistence)

After each line is resolved, LIUS writes:

```typescript
interface LIUSOutputToKG {
  type: 'UNDERWRITING_EVIDENCE';
  properties: {
    liuId: string;
    proformaSection: string;
    archetype: string;
    schemaVersion: number;
    primaryTier: number;
    posteriorValue: number;
    confidence: 'high' | 'medium' | 'low';
    p10: number | null;
    p90: number | null;
    hasCollision: boolean;
    collisionSeverity: 'minor' | 'material' | 'severe' | null;
    alternativeValues: Array<{ source: string; value: number; reason: string }>;
    brokerValue: number | null;
  };
  relationships: [
    { type: 'BELONGS_TO', target: dealNodeId },
    { type: 'HAS_SOURCE', target: profileClusterNodeId },
    { type: 'COMPARES_TO', target: archiveDistributionNodeId },
    ...similarDealTargets.map(d => ({ type: 'AKIN_TO', target: d })),
  ];
}
```

After 50 deals with this wire protocol, the KG can answer queries like:
- "Show me all deals where the profile cluster was the primary tier for R&M"
- "Of those, which had actual outcomes >2σ from prediction?"
- "What's the common pattern in the failures?"

---

## 7. Deal Capsule Integration Points

The existing Deal Capsule has these UI surfaces that change:

### 7.1 F9 ProForma Tab (existing → modified)

| Cell | Current | With LIUS |
|------|---------|-----------|
| Insurance $210K | Display from deal_data JSON | Click → Evidence Panel with full provenance |
| Tax $145K | User can override | Shows collision vs broker $120K before user overrides |
| R&M $95K | No source indicator | Source badge: T12 → profile cluster → archive |
| Each cell | Static number | Hover shows confidence band, click opens drawer |

### 7.2 Evidence Panel (exists, needs enhancement)

The panel already has the right structure (Reasoning, Evidence, Alternatives tabs). It needs:

- **Posterior header**: "Insurance: $210K ±$35K (medium confidence)" instead of just a number
- **Tier table**: Show all contributing tiers with weights, not just primary
- **Collision callout**: Severity-badged broker delta with narrative
- **Profile cluster badge**: "Matched to 9 structural twins | 92% confidence"

### 7.3 Building Profile Card (new)

New card in the Deal Capsule right-hand column:

```
┌─ Building Profile ──────────────────┐
│  Garden | 2017 | 194 units          │
│  Stories: 3  |  Parking: 1.2/unit   │
│                                      │
│  Amenities:                          │
│  ✓ Pool  ✓ Fitness  ✓ Clubhouse     │
│  ✓ Dog Park  ✓ Business Center      │
│                                      │
│  🏗️ 9 profile matches               │
│  Matching fingerprints:              │
│  garden|2010-2019|noelev|pool|...    │
│                                      │
│  [View profile benchmarks →]         │
│  [Edit profile specs]                │
└──────────────────────────────────────┘
```

### 7.4 Underwriting Walkthrough (exists, enhanced)

The Commentary Agent's walkthrough narrative gets richer data:

| Current | With LIUS |
|---------|-----------|
| "Tax increased due to reassessment" | "Tax: $120K broker → $145K LIUS. Reassessment triggers $25K step in Year 1, then FL 10% cap binds Years 2-5. The archiver cluster shows median $142K for 2017 garden builds in FL — consistent." |
| Generic narrative | Per-line structured narrative from reasoning templates |
| Agent "reasons about everything" | 80% code execution, 20% template-filling |

### 7.5 Admin: Schema Feedback Queue (new)

Admin panel view:

```
┌─ Schema Feedback ── 3 unresolved ─────────┐
│                                            │
│  🟡 FL_insurance_inflation: +8.2% bias     │
│     n=42 | recommend: adjust_param         │
│     Proposed: 0.08 → 0.12                 │
│     [Review] [Accept] [Dismiss]            │
│                                            │
│  🟡 pine_hills_R&M: +18% bias over n=8    │
│     n=8 | recommend: review (insufficient) │
│     [Review]                               │
│                                            │
│  🟢 Atlanta 2017 garden tax: 0.3% bias     │
│     n=31 | recommend: no_change            │
│     [Dismiss]                              │
└────────────────────────────────────────────┘
```

---

## 8. Knowledge Graph Schema Extension

New node types and edge types LIUS needs:

### 8.1 New Node Types

```cypher
// Already deployed by building profiles migration
(:BuildingProfile {
  fingerprint: string,
  type: string,
  vintage: string,
  amenityVector: string,  // "elev|nopool|fit|club"
  nMatched: int,
  nodeCategory: "building_profile"
})

(:UnderwritingEvidence {
  liuId: string,
  dealId: string,
  agentRunId: string,
  schemaVersion: int,
  primaryTier: int,
  posteriorValue: float,
  confidence: string,
  p10: float?,
  p90: float?,
  hasCollision: bool,
  brokerValue: float?,
  nodeCategory: "underwriting_evidence"
})

(:ActualOutcome {
  liuId: string,
  dealId: string,
  actualValue: float,
  predictedValue: float,
  monthOffset: int,
  biasPct: float,
  significant: bool,
  nodeCategory: "actual_outcome"
})
```

### 8.2 New Edge Types

```cypher
// Evidence provenance
(:UnderwritingEvidence)-[:USED_TIER { tier: 1, weight: 0.4 }]->(:DataSource { type: 't12' })
(:UnderwritingEvidence)-[:USED_TIER { tier: 2.5, weight: 0.3 }]->(:BuildingProfile)
(:UnderwritingEvidence)-[:BELONGS_TO]->(:Deal)
(:UnderwritingEvidence)-[:GENERATED_BY]->(:AgentRun)

// Outcome feedback
(:ActualOutcome)-[:EXPLAINS_BIAS]->(:UnderwritingEvidence)
(:ActualOutcome)-[:BELONGS_TO]->(:Deal)

// Similarity
(:Deal)-[:PROFILE_MATCH { similarity: 0.92 }]->(:BuildingProfile)
(:Deal)-[:SIMILAR { composite: 0.85 }]->(:Deal)  // LIUS-semantic similarity
```

### 8.3 Query Examples

```cypher
// "Find all evidence where profile tier was primary and actuals deviated"
MATCH (ev:UnderwritingEvidence)-[:BELONGS_TO]->(d:Deal)
MATCH (a:ActualOutcome)-[:EXPLAINS_BIAS]->(ev)
WHERE ev.primaryTier = 2.5 AND a.significant = true
RETURN ev.liuId, a.biasPct, d.name
ORDER BY a.biasPct DESC LIMIT 20

// "Show me the building profile cluster for this deal"
MATCH (d:Deal {id: $dealId})-[:PROFILE_MATCH]->(bp:BuildingProfile)
MATCH (bp)<-[:PROFILE_MATCH]-(twin:Deal)
WHERE twin.id != $dealId
RETURN bp.fingerprint, count(twin) AS clusterSize,
       collect(twin.name)[0..5] AS sampleDeals

// "What's the most common underwriting error pattern?"
MATCH (ev:UnderwritingEvidence)-[:USED_TIER]->(src)
MATCH (a:ActualOutcome)-[:EXPLAINS_BIAS]->(ev)
WHERE a.significant = true AND a.biasPct > 0.15
RETURN ev.liuId, ev.primaryTier, avg(a.biasPct) AS avgBias,
       count(*) AS n
ORDER BY n DESC LIMIT 10
```

---

## 9. Build Sequencing — 8 Weeks (Revised)

### Week 1: Minimum Viable LIUS (what we build now)

**Core schema system:**
- LIUS type system — TypeScript types + Zod validation for full schema shape
- 6 archetype base schemas (A-F) as typed classes
- Schema catalog loader — loads YAML/JSON schemas from `lius/lines/`
- DAG dependency validator with cycle detection
- Iterative solver shell (for debt cycle, tax cycle)

**Profile service wiring:**
- Wire building_profiles → fetch_line_item_benchmarks tool
- Profile card UI component in Deal Capsule

**Evidence persistence:**
- Evidence object writer → deal_data JSON
- Evidence Panel backend adapter

### Week 2: Trajectory Engine + Materiality

**Trajectory:**
- Three-primitive event types (rate_delta, level_reset, discrete_spike)
- Event composition rules per §5
- Lifecycle timeline resolver
- Lifecycle → event generator (lease_up→stabilized staffing reset, etc.)

**Materiality:**
- Multi-axis composite function
- Per-line materiality tables for all 45 F9 lines
- Aggregate roll-up validator

### Week 3: Hard Rules + Source Resolver + KG Wire

**Hard rule engine:**
- Conditional resolver with discriminator support
- Rule fixture unit tests
- Jurisdiction overrides (FL_coastal, GA, TX, CA)

**Source resolver:**
- Full source_preference execution engine
- Tier 1 (deal_data), Tier 2 (owned), Tier 2.5 (profile), Tier 3 (KG/archive)
- Collision detector → broker vs agent

**KG integration:**
- KG → LIUS adapter (query similar deals, archive distributions)
- LIUS → KG writer (persist evidence nodes)
- KG query templates for LIUS context

### Week 4: Reasoning Templates + Evidence Panel

**Reasoning template system:**
- 6 archetype templates
- Template context extractor (fills blanks from deterministic data)
- Archetype B template: T12 + one-time strip + profile cross + decision

**UI work:**
- Evidence Panel update: posterior, tier table, collision callout
- F9 cell hover: confidence band tooltip
- Building Profile Card component
- Admin: Schema Feedback queue (table + review actions)

### Week 5: Full 45-Line Schema Catalog

Write and test schemas for every F9 line:

Complete the line item catalog from the v0.2 spec — all 45 lines (income, controllable opex, non-controllable opex, reserves, capex, strategy, transaction, exit, lease-up) with individual schemas inheriting from archetypes. Each schema gets:

- Archetype assignment
- Hard rules (for jurisdiction-sensitive lines)
- Cross-checks (for lines with known failure modes)
- Materiality thresholds
- Trajectory events

### Week 6: Schema Feedback Loop

- Nightly aggregation job (stub until deal_monthly_actuals populated)
- Bias computation + significance test
- Feedback table writer
- Admin queue UI

### Week 7: Full Integration Testing

- End-to-end fixture: 464 Bishop with full LIUS pipeline
- KG verification: evidence nodes created, queryable
- Profile cluster verification: 9 structural twins matched
- Evidence Panel renders correctly
- User override → deal_data update → verified

### Week 8: Commentary Agent Integration + Polish

- Commentary Agent reads from LIUS evidence, not raw schema
- Walkthrough narrative structured per reasoning templates
- Performance optimization (schema caching, lazy trajectory computation)
- Edge case handling (sparse data, missing county, partial T12)

---

## 10. Build Commandments

1. **Code executes, LLM explains.** LIUS is 80% code (schema resolution, trajectory composition, materiality calculation) and 20% LLM (reasoning template filling). If you find yourself prompting for something you could compute, stop and write the code.

2. **Every line item gets a schema file.** No "default fallback" schemas. 45 lines → 45 files. Empty sections are explicit (contains comments explaining why), not missing.

3. **Tier 2.5 (profile) is a hard requirement for Archetypes B, C, D.** Don't build those archetypes without the building_profiles infrastructure in place. Profile matching is what makes LIUS structurally different from generic benchmarks.

4. **Schemas are frozen after promotion.** Never mutate a schema in place. Bump schema_version, write the new version. Old evidence stays attached to old version numbers for auditability.

5. **Every rule is a function.** `hard_rules` and `cross_checks` are not YAML blobs — they're compiled to testable TypeScript functions. Unit test every rule's firing behavior in at least one positive and one negative context.

6. **The KG is a feedback medium, not an execution dependency.** LIUS runs without the KG — it falls back to archive queries if the KG is unavailable. The KG enriches but does not gate. Start with the fallback path working, add KG enrichment later.

7. **Schema feedback ships with stubs.** The table, the admin queue UI, and the promotion log exist from day one. The actual nightly aggregation job stays optional until deal_monthly_actuals populates. Don't block schema feedback on data availability.

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Building profile cluster too small (<5 per fingerprint) for 191 archived deals | Medium | Tier 2.5 useless for rare building types | n≥1 for display, n≥5 for authoritative; fall back to Tier 3 for small clusters |
| T12 parser can't handle originator's format | Medium | Tier 1 extraction fails | Let users upload corrected T12; treat bad parse as "no T12" and degrade gracefully |
| deal_monthly_actuals never populates | High | Schema feedback loop never activates | Build mock-actuals fixture for unit testing; schema feedback queue shows "pending actuals" state |
| LLM reasoning template produces inconsistent prose | Low | Walkthrough quality varies | Lock templates to strict archetype patterns; validate output structure in CI |
| Event-based trajectory engine changes NOI shape vs current compound growth model | Medium | Existing deals have different projections | Run side-by-side comparison on 464 Bishop before flipping the switch; document the delta |
| FL insurance market hardens faster than ruleset updates | Medium | Systematic underpricing for FL deals | Schema feedback auto-promote gated by backtest; set aggressive review cadence for FL lines |

---

## 12. What We Ship First (Week 1)

Given what's already done (building_profiles migration, service, agent tool), Week 1 is:

1. **LIUS type system** — Types + Zod schemas for the canonical shape
2. **6 archetype base schemas** — A-F as typed classes or YAML files
3. **Schema catalog loader** — loads from `src/services/lius/lines/{section}/{name}.yaml`
4. **Blank schema files** for all 45 lines (inheriting from archetypes with section-specific overrides)
5. **DAG validator** — detects undeclared cycles in depends_on.required
6. **Iterative solver** — shell for debt cycle
7. **Source resolver** — executes source_preference for each line
8. **Evidence writer** — persists evidence to deal_data
9. **Profile card UI** — Deal Capsule right-hand column

Everything else builds on these foundations.
