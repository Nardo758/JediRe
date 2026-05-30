# JEDI RE — PIECE C: AGENT SYNTHESIS INTERFACE

**Purpose:** Define how agents (cashflow agent, research agent, Opus) consume the reconciled multi-vendor view from Piece B as research material to author defensible underwriting findings. Establish agents as authors who fuse multi-source data into narrative claims, not consumers of pre-resolved values.

**Status:** Piece C of four (A, B, C, D). Companion to the Vendor Market Data Architecture overview.

**Predecessor work:** The cashflow agent's existing F9 work (22 assumptions across batches), the Opus integration in F12 custom tabs, the revised calc-vs-assumption doc, the Deal Details audit.

---

## THE CENTRAL ARCHITECTURAL CLARIFICATION

A persistent confusion through this session's work was whether agents *consume* market data or *produce* it. The operator clarification settled this: **agents author the platform's research narrative by fusing multi-source data into findings.**

Specifically:

- **Pieces A and B prepare the substrate.** Vendor data ingests, gets reconciled field-by-field, surfaces divergences. The substrate is multi-vendor, divergence-aware, provenance-tracked.
- **Piece C is the agent layer that synthesizes findings from the substrate.** Agents read the reconciled view, reason across it (citing which sources support which claims), and write findings to the platform's narrative surfaces (deal capsule, F-key commentary, Validation Grid evidence).
- **Operators consume the findings, not the raw substrate.** The substrate is available for operators who want to inspect provenance, but the platform's primary value proposition is the synthesized narrative grounded in transparent multi-source evidence.

This is the architecture the platform's positioning ("Bloomberg Terminal for real estate") implies. Bloomberg's terminal doesn't show traders raw vendor feeds; it shows synthesized analytical views grounded in feeds with provenance. JEDI's architecture mirrors this.

---

## WHAT AGENTS AUTHOR

Three classes of authorship, all expressed through LayeredValue's Layer 2 (agent) slot per the revised calc-vs-assumption doc:

### Class 1 — Field values (assumptions and calculations)

The agent writes specific numbers to specific fields. Market rent, vacancy, LTL trajectory inputs, OpEx ratios, exit cap rate, NOI computation, IRR computation — for each field, the agent reasons from the reconciled substrate and writes its value to the Layer 2 (agent) slot.

Per Piece B's commitment, Layer 1 (operator override) sits above. Per the revised calc-vs-assumption doc, the agent legitimately writes across both assumptions and calculations.

### Class 2 — Narrative findings (paragraph-level)

The agent writes paragraph-length analytical findings for surfaces that require synthesis: the deal capsule's market summary, F3 Markets commentary, F4 Supply Pipeline narrative, the strategy verdict on F8 Decision, the exit timing rationale on F12.

These findings cite specific sources from the substrate. Example: "Atlanta Midtown submarket vacancy stands at 9.8% per Q2 CoStar data, reflecting stabilization from 11.4% a year prior. Yardi Matrix's slightly higher reading (10.6%) reflects their broader submarket definition, but the directional trend is consistent across both sources."

### Class 3 — Recommendation logic (decision-relevant)

The agent writes structured recommendations: "Strategy recommended: Value-Add given LTL upside of 13.8% and stabilized comp evidence supporting $1,900/unit post-renovation market rent. Confidence: Medium-High. Risk factors: supply pipeline of 1,200 units delivering in 18 months may compress lease-up velocity."

These recommendations are also Layer 2 values (agent-authored), with operator override available to disagree.

---

## THE SUBSTRATE THE AGENT READS

The reconciled substrate Piece B produces has a specific shape the agent consumes:

```typescript
interface FieldSubstrate {
  field_name: string;
  resolved: any;
  resolved_from: string;  // Layer that won
  alert_level: 'none' | 'low' | 'medium' | 'high' | 'extreme';
  contributing_sources: Array<{
    source: string;       // 'costar', 'yardi_matrix', 'apartment_locator', 't12', 'om', etc.
    value: any;
    as_of_date: Date;
    confidence: number;
    delta_from_resolved: number | null;
    delta_significance: string;
    license_posture: 'restricted' | 'open';
    freshness_status: 'fresh' | 'aging' | 'stale';
  }>;
  interpretation_hint: string | null;  // Piece B-generated context for the agent
  divergence_signature: object | null;
  trajectory: TrajectoryShape | null;  // For hold-year fields
}
```

The agent reads `FieldSubstrate` objects, not raw vendor tables. This gives agents:

1. **Full provenance** — every contributing source visible
2. **Reconciliation outcome** — the resolved value and why
3. **Disagreement context** — when sources diverge, the magnitude and significance
4. **License awareness** — restricted vendor data tagged for citation handling
5. **Freshness awareness** — stale sources flagged so the agent can weight appropriately
6. **Trajectory data** — for hold-year fields, the trajectory inputs the agent can reason about

The interpretation_hint is a key affordance. It's Piece B's structured commentary on what a divergence might mean, written specifically for the agent's consumption. The agent can incorporate, dispute, or expand on the hint.

---

## HOW THE AGENT REASONS

### Per-field reasoning pattern

For each field the agent authors, the reasoning follows this pattern:

1. **Read the substrate** — what do sources say? Are they consistent?
2. **Apply tier authority** — Tier 1 (deal documents) > Tier 2 (owned portfolio) > Tier 3a (authoritative public records) > Tier 3b (third-party market data) > inferred. This is the discipline from the cashflow agent's existing F9 work.
3. **Resolve to a value** — agent's best estimate given the evidence. If sources agree, the value is clear. If they disagree, the agent reasons about which is more authoritative for this specific case.
4. **Cite sources** — every value written to the agent layer carries a citation indicating which substrate sources supported the value.
5. **Surface uncertainty** — confidence rating + explanation of what would change the agent's view.

### Cross-field reasoning pattern

For findings that synthesize across fields (strategy recommendation, exit timing, market thesis), the agent reasons across the substrate's whole field set:

1. **Build a deal-level picture** from all substrate fields
2. **Apply strategy-aware framing** per the strategy-aware modules doc — different strategies (stabilized, value-add, opportunistic, development) emphasize different signals
3. **Identify the dominant signals** — which fields most strongly support which strategy
4. **Synthesize the narrative** — paragraph or short-section output suitable for the relevant F-key surface
5. **Flag deal completeness gaps** — when material substrate fields are missing or have unresolved high-alert divergences, the agent surfaces these as caveats in the finding

---

## THE UNIFIED DEAL COMPLETENESS FRAMEWORK

Per Commitment 6 from the overview: deal completeness is a first-class status. Piece C is where this framework is centrally defined because the agent is the entity that depends on substrate completeness to produce defensible findings.

### What deal completeness tracks

A deal completeness record per deal captures:

```typescript
interface DealCompleteness {
  deal_id: string;
  overall_status: 'complete' | 'partial' | 'minimal';
  signals: Array<{
    signal_id: string;
    description: string;        // 'M07 traffic projection has run', 'Cashflow agent has reasoned year1', etc.
    status: 'present' | 'stale' | 'missing' | 'unresolved_divergence';
    severity: 'required' | 'recommended' | 'optional';
    last_resolved_at: Date | null;
    blocking_findings: string[];  // What findings or capsule sections can't be authored without this signal
  }>;
  completeness_score: number;     // 0-100, weighted by signal severity
  next_action_recommendations: string[];
}
```

### Signals the framework tracks

Audit-derived list of signals (will expand as Pieces A-D produce more):

| Signal | Severity | Blocking effect when missing |
|---|---|---|
| M07 has produced a traffic_projections row | Required | Vacancy trajectory falls back to flat percentage; LTL trajectory has degraded lease roll velocity input |
| Cashflow agent has reasoned current year1 | Required | Year 1 values may not reflect operator's latest assumptions; agent narrative is stale |
| Validation Grid evidence resolved | Required | Per-field confidence indicators degrade |
| Property identity linked (deals.property_id) | Required | Subject characteristics fall back to deals.deal_data; comp matching impaired |
| JEDI score computed | Required | F1 dashboard, F8 decision tab missing signal |
| Deal market intelligence pulled | Required | F1 market context, F8 market overlay empty |
| Sale comps populated (≥3) | Recommended | F7 Valuation Grid missing comp-based methods |
| Rent comps populated (≥3) | Recommended | F7 rent comp method missing; F3 market context degraded |
| Debt schedule populated | Recommended | F5 capital hub partial; F6 returns missing LP/GP |
| Waterfall config populated | Recommended | F6 LP/GP returns can't be computed |
| Capex items populated (for value-add) | Recommended | F5 sources & uses incomplete |
| CoStar submarket data uploaded (or recent enough) | Recommended | F3 Markets cross-deal data degraded |
| Operator stance set | Recommended | Agent reasoning may use default posture rather than operator's view |
| Material divergence resolved (per field) | Variable | Each unresolved high-alert divergence is its own signal |

### Where deal completeness surfaces

**1. Deal-level UI badge** — every deal lists its completeness status. Operators see at a glance whether they're working with complete, partial, or minimal analysis.

**2. Per-surface gating** — surfaces that depend on missing signals show explicit "this analysis requires X" rather than silently displaying degraded views. The Valuation Grid that can't run cap-rate-method-based valuation shows "Comp data missing — provide ≥3 sale comps to enable this method" rather than just returning INSUFFICIENT.

**3. Agent narrative caveats** — when the agent writes a finding that depends on a missing signal, it explicitly notes the dependency: "This vacancy projection assumes submarket equilibrium absent traffic engine output for this property. With M07 data, the trajectory would incorporate property-specific absorption signals."

**4. Recommended next actions** — the completeness record's `next_action_recommendations` populate operator-facing prompts: "Upload CoStar submarket data for Atlanta Midtown to enable cross-deal market context." "Run M07 traffic engine for this property to enable vacancy trajectory."

### Deal completeness drives M07 visibility specifically

Per the audit finding that M07 hasn't run for 464 Bishop: the deal completeness framework makes this visible as a required signal. When operators view the deal, the UI shows "M07 traffic projection: not yet run" as an explicit incompleteness marker. The "fix it" workstream (separate from this architecture) addresses *why* M07 didn't run; the deal completeness framework ensures operators never silently make decisions on degraded vacancy projections without knowing it.

---

## THE AGENT'S NARRATIVE OUTPUT FORMAT

Agents produce structured findings that consumers (UI, exports, deal capsule) render appropriately. The structure:

```typescript
interface AgentFinding {
  finding_id: string;
  deal_id: string;
  surface: string;              // 'f1_overview', 'f3_market_commentary', 'capsule_market_thesis', etc.
  author: 'cashflow_agent' | 'research_agent' | 'opus';
  authored_at: Date;
  
  narrative: string;            // Paragraph-level text
  
  citations: Array<{
    claim: string;              // The specific claim in the narrative
    sources: Array<{            // The substrate sources supporting it
      source: string;
      value: any;
      as_of_date: Date;
      license_posture: 'restricted' | 'open';
    }>;
  }>;
  
  confidence: 'high' | 'medium' | 'low';
  
  completeness_caveats: Array<{
    missing_signal: string;
    impact: string;             // What the finding would say differently with the signal
  }>;
  
  alternative_views: Array<{    // Where the agent considered and rejected alternative interpretations
    view: string;
    reason_not_adopted: string;
  }>;
  
  divergences_acknowledged: Array<{  // Material substrate divergences the finding addresses
    field: string;
    sources: object;
    resolution: string;
  }>;
}
```

### Why this format matters

Three reasons:

**1. Citations enable verification.** Operators reading "Atlanta Midtown vacancy is 9.8%" can click through to see which sources supported that claim. The narrative isn't trust-me; it's substantiated.

**2. Completeness caveats prevent overconfidence.** Findings explicitly state what's missing and how their conclusions would change with better data. This prevents the platform from sounding confident about analyses built on incomplete substrate.

**3. License posture flows through.** When an operator exports a finding externally, the platform knows which citations are restricted (CoStar) vs open (county records) and can redact appropriately per Piece A's license enforcement.

---

## OPERATOR OVERRIDE OF AGENT FINDINGS

Per Layer 1 discipline, operators can override agent findings at multiple granularities:

**Field-level override** — operator disagrees with the agent's vacancy value. Per Piece B, Layer 1 override wired; resolution chain selects override.

**Citation-level override** — operator disagrees with which source the agent cited. Operator can flag "use Yardi instead of CoStar for this field" via a per-field source preference, which the agent honors on next reasoning.

**Finding-level override** — operator disagrees with the agent's narrative entirely. Operator can write their own version, marked as operator-authored. The agent's version is retained for audit but not displayed.

**Confidence override** — operator can elevate or downgrade the agent's confidence rating with rationale. Useful when operators have non-platform knowledge the agent doesn't.

**Completeness override** — operator can mark a signal as "acknowledged missing, proceeding anyway" rather than waiting for the missing signal to resolve. Useful for time-sensitive decisions.

---

## TRIGGER AND ORCHESTRATION

When does the agent reason? Three triggers:

**1. Substrate changed.** When Piece B's resolved values for relevant fields change (new vendor data uploaded, new extraction completed, divergence resolved), the agent re-reasons over the affected fields. This is event-driven.

**2. Operator request.** Operator clicks "Refresh agent analysis" on a surface, or asks the agent (via chat) to reconsider a specific question.

**3. Scheduled refresh.** For long-running deals, the agent re-reasons on a cadence (weekly?) to catch market drift even when no new data has uploaded.

Orchestration manages these triggers, with rate limiting and cost awareness. The cashflow agent's existing F9 batches infrastructure is the foundation; Piece C extends it across the platform's findings surfaces.

---

## IMPLEMENTATION SCOPE

**Phase 2C-1 — Substrate interface (3-4 weeks):**
1. Define `FieldSubstrate` type
2. Build the field-substrate query layer that produces the interface from Piece B's reconciled data
3. Migrate the cashflow agent's existing F9 reasoning to consume `FieldSubstrate` rather than reading from disparate tables

**Phase 2C-2 — Deal completeness framework (3-4 weeks):**
1. Define `DealCompleteness` type and signal registry
2. Build signal evaluation logic per signal (each signal has its own check)
3. Surface completeness in the UI: deal-level badge, per-surface gating, recommended next actions
4. Wire M07-missing as the first instance; other signals follow

**Phase 2C-3 — Narrative authoring extension (4-5 weeks):**
1. Define `AgentFinding` type
2. Extend cashflow agent (and add research agent capabilities) to produce findings, not just field values
3. Build narrative rendering for relevant surfaces (capsule market thesis, F-key commentaries)
4. Citation rendering with click-through to substrate provenance

**Phase 2C-4 — Override granularities (3 weeks):**
1. Field-level override (existing Layer 1 wiring; verify universal coverage)
2. Citation-level override (per-field source preference)
3. Finding-level override (operator-authored alternative)
4. Confidence and completeness overrides

**Phase 2C-5 — Triggering and orchestration (2-3 weeks):**
1. Event-driven re-reasoning on substrate changes
2. Operator-requested refresh
3. Scheduled refresh cadence
4. Cost awareness and rate limiting

**Total estimated Piece C scope:** 15-19 weeks, runs after Piece B is substantially complete (the substrate must exist before the agent can consume it).

---

## ACCEPTANCE CRITERIA

Piece C is complete when:

1. **The cashflow agent consumes `FieldSubstrate` for every assumption it reasons.** Old direct-table-read patterns removed. The agent's reasoning is grounded in reconciled multi-vendor data with explicit provenance.

2. **Deal completeness framework operational across the platform.** Every required signal evaluated per deal; UI surfaces completeness status; per-surface gating implemented; M07-missing visible (with the "fix M07" workstream separately addressing the root cause).

3. **Agent findings produced with citations.** Every agent-authored narrative cites specific substrate sources. Operators can click through from claim to source.

4. **Operator overrides work at all four granularities.** Field, citation, finding, confidence/completeness — all override paths tested and operational.

5. **License posture flows through to exports.** When operators export deal capsule with agent findings, restricted-vendor citations redact appropriately per Piece A's license enforcement.

6. **Completeness caveats appear in findings.** When the agent's reasoning is degraded by missing signals, the finding explicitly states what's missing and how it limits the conclusion.

7. **Triggering and orchestration prevents stale agent output.** When substrate changes materially, the agent re-reasons. Operators can refresh on demand. Scheduled refreshes catch drift on long-running deals.

---

## RELATIONSHIP TO OTHER DOCUMENTS

| Document | How Piece C relates |
|---|---|
| Vendor Market Data Architecture (overview) | Piece C operationalizes Commitments 5, 6 (Layer 1 override universal; deal completeness first-class) |
| Piece A (Vendor Abstraction) | Piece C consumes Piece A's vendor metadata (license posture, source identity) for citation handling |
| Piece B (Field-Level Reconciliation) | Piece C consumes Piece B's reconciled substrate as the input to agent reasoning |
| Piece D (Divergence as Quality Signal) | Piece C agents read Piece D's source-reliability intelligence when reasoning across divergences |
| Revised calc-vs-assumption doc | Piece C is the operationalization of the doc's "agent legitimately writes across both assumptions and calculations" framing |
| Deal Capsule Vision | The capsule's narrative sections are populated by Piece C agent findings |
| Strategy-Aware Modules doc | Strategy-aware framing applies at the agent reasoning layer; Piece C's narrative output reflects strategy stance |
| Deal Details Audit | The 65 EMPTY fields are partially addressed by Piece C — many are empty because no agent has reasoned them; the framework gives the agent the substrate to do so |
| F-key triage Wave A (freshness) | Agent findings carry freshness through citations — when a CoStar source is stale, the finding notes this |

---

## NOTE TO REPLIT

Three things worth being explicit about:

**First, the agent's role expands meaningfully here.** Today's cashflow agent reasons within F9 batches; Piece C extends its scope to author findings across multiple surfaces. This is a real expansion. The Opus integration (F12 custom tabs) is the precedent — Opus already authors structured analysis. Piece C generalizes that pattern.

**Second, the deal completeness framework is the operator's primary visibility into platform reliability.** Today operators see resolved values without knowing which were degraded by missing data. After Piece C, they see explicit completeness state with clear next actions. This is a meaningful UX shift. Design the visibility carefully — it should empower operators, not overwhelm them with caveats.

**Third, the M07-missing example is the test case.** Build the deal completeness framework with M07-missing as the first instance. If the framework can clearly surface "M07 hasn't run for this deal, vacancy trajectory is degraded, here's how to fix it" without burying operators in detail, the framework works. If it produces operator confusion, the design needs iteration before expanding to other signals.

Per CLAUDE.md P8: state-verify the cashflow agent's current reasoning pipeline, the Opus integration's existing findings output format, and the M07 trigger logic against live code before implementing. The audit caught structural gaps in M07's integration; expect similar findings in agent infrastructure.
