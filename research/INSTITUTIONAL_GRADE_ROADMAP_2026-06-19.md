# JEDIRE DEAL CAPSULE: INSTITUTIONAL-GRADE REMEDIATION ROADMAP
*Deep Research + Code Audit Reconciliation · v1.0 · 2026-06-19*

> **Origin:** This document reconciles two independent investigations:
> 1. **Tab-by-tab code audit** (`DEAL_CAPSULE_TAB_ALIGNMENT_AUDIT_2026-06-18.md`) — 50 gaps across 11 F-key tabs
> 2. **Deep research swarm** (`research/deal_capsule_wide01-06.md` + `research/deal_capsule_cross_verification.md`) — 6 facets, 60+ searches, 10 cross-cutting insights
>
> **Output:** A unified, prioritized build plan ordered by institutional impact.

---

## EXECUTIVE SUMMARY

| | Count | Status |
|---|---|---|
| **P0 Blockers** (fix first or platform is unusable) | 5 | 2 code bugs, 1 architecture gap, 1 legal risk, 1 regulatory non-compliance |
| **P1 Institutional Gaps** (required for LP adoption) | 18 | 7 code features, 6 backend capabilities, 5 compliance/governance items |
| **P2 Competitive Moats** (differentiators vs. Dealpath, Apers, Smart Bricks) | 14 | 6 AI/agent features, 4 UX features, 4 data/model features |
| **P3 Polish** (nice-to-have, high effort) | 13 | 7 content hardening, 6 UX refinement |
| **Total** | **50** | |

**Strategic verdict:** The Deal Capsule concept is **architecturally correct and genuinely differentiated** — no competitor has field-level assumption transparency (LayeredValue) combined with a lane-guarded data container (Lane A/B scope guard). But the implementation is **incomplete and has 5 P0 structural bugs** that make it unusable for institutional sharing. Fix the P0s, then build the 7 missing institutional-grade features. The market window is open: $12.8B → $32B by 2033, and no competitor has solved the "live model data room" problem.

---

## PART 1: THE 5 P0 BLOCKERS — FIX FIRST

### P0-1: Keyboard F-Key Mapping Is Broken (TB-01)

**Problem:** F3–F12 are all shifted by one position in `DealDetailPage.tsx:788`. F3 opens `comps` (not a tab), F4 opens Market instead of Supply, etc. The keyboard is unusable for F3+.

**Fix:** One-line change. Correct the `fKeyMap` to match spec §4.1.

```typescript
const fKeyMap: { [key: string]: string } = {
  F1: 'overview',   F2: 'zoning',    F3: 'market',      F4: 'supply',
  F5: 'strategy',    F6: 'traffic',   F7: 'design-3d',   F8: 'capital',
  F9: 'proforma',    F10: 'risk',     F11: 'deal-tools',
  // F12 removed — spec only defines F1–F11
};
```

**Effort:** 5 minutes. **Impact:** Unblocks keyboard navigation.

---

### P0-2: F9 Pro Forma Has Wrong ModuleId (TB-02)

**Problem:** `moduleId: 'M08'` (Strategy) instead of `M09` (Pro Forma). F9 visibility governed by Strategy rules, not Pro Forma rules. Proforma template variant is never read.

**Fix:** Change `DealDetailPage.tsx:848`:

```typescript
{ id: 'proforma', moduleId: 'M09', fkey: 'F9', code: 'M09', short: 'PRO FORMA', ... }
```

**Effort:** 1 minute. **Impact:** Correct tab behavior and variant routing.

---

### P0-3: F10 Risk Module ID Conflict (TB-03)

**Problem:** Code uses `M13` (DD Tracker), spec says `M14` (Risk Dashboard). Risk weights from M14 config are not applied. The DD tracker is a sub-tab, not an F-key tab.

**Fix:** Change F10 to `moduleId: 'M14'`, `code: 'M14'`. Update `RiskDDPage` to consume M14 variants (risk weight profiles per deal type). Move M13 DD tracker to a sub-tab within F10 or F11.

**Effort:** 1 hour (update component + variant config). **Impact:** Correct risk weighting and tab taxonomy.

---

### P0-4: Visibility Model Is 1D, Spec Requires 2D (TB-04)

**Problem:** `DealType: 'existing' | 'development' | 'redevelopment'` is a 1D enum. The spec requires a 2D `(use × archetype)` model. This causes F7 to show for all "existing" deals even when archetype=Stabilized, F6 to not hide for Land, and F9 to lack use-specific schemas.

**Fix:** Introduce the two-axis model:

```typescript
// New types
type AssetUseType = 'multifamily' | 'retail' | 'office' | 'industrial' | 'land';
type DealArchetype = 'stabilized' | 'value_add' | 'lease_up' | 'development' | 'redevelopment' | 'land_hold';

// Validation: invalid pairs blocked at deal creation
const INVALID_PAIRS: [AssetUseType, DealArchetype][] = [
  ['land', 'stabilized'], ['land', 'value_add'], ['land', 'lease_up'],
  // etc.
];

// Visibility predicates per spec §4.3b
const TAB_VISIBILITY: Record<string, (use: AssetUseType, archetype: DealArchetype) => boolean> = {
  'design-3d': (use, archetype) => archetype === 'development' || archetype === 'redevelopment' || use === 'land',
  'traffic': (use, archetype) => use !== 'land',
  'zoning': () => true, // never hidden, demoted for stabilized
};
```

**Effort:** 1–2 days (update Deal type, validation, visibility predicates, deal creation flow). **Impact:** Correct tab behavior for all asset types and archetypes. Unlocks use-specific proforma schemas.

---

### P0-5: `scope_id` Column Missing — Legal Risk for Licensed Data (TB-04 + Insight 3)

**Problem:** The `scope_id` column (Lane A/B scope guard) is spec'd but not built. Without it, the platform cannot formally distinguish GLOBAL (Lane A) from user-scoped (Lane B) data. The `redistribution_restricted` flag exists but is ad-hoc. CoStar/Yardi data could leak into shared surfaces, violating their Terms of Service.

**Fix:**

1. Add `scope_id` column to `deal_assumptions`, `metric_time_series`, `comp_*` tables
2. Default values: `scope_id = 'GLOBAL'` for platform data, `scope_id = 'user:<id>'` for user uploads
3. Set `redistribution_restricted = TRUE` for licensed sources (CoStar, Yardi) at ingest
4. Update all shared-corpus queries to filter: `WHERE scope_id = 'GLOBAL' OR (scope_id = 'user:<id>' AND NOT redistribution_restricted)`
5. Update the 3 unguarded shared-layer writers (per spec §6)

**Effort:** 2–3 days (DB migration + query updates + ingest pipeline updates). **Impact:** Legal compliance. Prevents CoStar/Yardi copyright claims. Enables safe sharing.

---

## PART 2: P1 INSTITUTIONAL GAPS — REQUIRED FOR LP ADOPTION

### P1-1: Build `deal_capsules` Table + Snapshot Service (TB-38 + Insight 10)

**Problem:** No `deal_capsules` table exists. "Capsule" is a UI concept with no durable artifact. Sharing is a UI mock, not a backend feature. The spec's §5 sharing layer is greenfield.

**What to build:**

```sql
CREATE TABLE deal_capsules (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  encryption_key_id TEXT, -- AES-256-GCM key reference
  shortcode TEXT UNIQUE, -- e.g., "/c/abc123"
  scope_filter JSONB, -- which layers to include: {broker: true, platform: true, override: false, user: false}
  recipient_tier ENUM('free', 'professional', 'team', 'enterprise'),
  share_metering JSONB, -- Stripe integration
  snapshot_data JSONB, -- frozen year1 + Projections at mint time
  status ENUM('active', 'expired', 'revoked') DEFAULT 'active'
);
```

**Why it matters:** The deep research found that institutional VDRs (iDeals, Datasite) have "per-LP-class permissioning" — different investor tiers see different documents. The spec's layer-filter permission model is the technical equivalent and is the core innovation that makes the capsule "institutional grade." Without it, the platform is just another deal viewer.

**Effort:** 3–5 days. **Impact:** Enables sharing. Differentiates from Dealpath (no sharing) and VDRs (passive documents).

---

### P1-2: Role-Based Views (Insight 8)

**Problem:** The DealDetailPage has no concept of viewer role. A lender, LP, JV partner, and internal analyst all see the same tabs with the same data. Institutions require different views per role.

**What to build:**

```typescript
type ViewerRole = 'gp_analyst' | 'gp_director' | 'lp_investor' | 'lp_due_diligence' | 'lender' | 'jv_partner' | 'viewer';

// Each tab has role-specific sub-views
const ROLE_VIEWS: Record<string, Record<ViewerRole, string[]>> = {
  'f1-overview': {
    gp_analyst: ['jedi_score', 'alerts', '3_layer_assumptions', 'ai_brief', 'team'],
    lp_investor: ['jedi_score', 'key_financials', 'strategy_summary', 'risk_verdict'],
    lender: ['debt_metrics', 'dscr', 'ltv', 'stress_test', 'collateral'],
    viewer: ['jedi_score', 'key_financials'], // limited
  },
  // etc. for each tab
};
```

**Why it matters:** The deep research found that LPs evaluate models on 5 criteria (transparency, granularity, waterfall accuracy, stress-testability, fee clarity). A lender cares about DSCR and LTV; an LP cares about IRR and equity multiple. The same tab should show different metrics per role. This is what makes the capsule a "shared container" — not a one-size-fits-all dashboard.

**Effort:** 2–3 days per tab. **Impact:** Enables multi-stakeholder collaboration.

---

### P1-3: Excel Export with Formula Integrity (Insight 4 + wide04)

**Problem:** No Excel export exists. The deep research found that "LPs expect Excel deliverables. Lenders review Excel models. Investment committees open Excel workbooks, trace the formulas, challenge the assumptions, and make decisions." Any platform that doesn't export to Excel with live formulas fails the institutional test.

**What to build:**

1. Export endpoint: `POST /capsules/:id/export/xlsx`
2. Use HyperFormula or similar deterministic engine to generate `.xlsx` with live formulas
3. Every exported cell must include assumption provenance metadata (source, confidence, extracted from)
4. Support use-specific templates: MF (unit mix + RUBS), Retail (NNN + recoveries), Office (MG + TI/LC), Industrial (NNN + clear-height), Land (residual land value)

**Why it matters:** This is the #1 feature that makes an institutional LP comfortable receiving a shared model instead of an Excel file. ModelTree (Exquance) built its entire platform around this feature and has $25B+ AUM on the platform. The spec's LayeredValue architecture makes it possible to export every assumption with its pedigree — no competitor has this.

**Effort:** 5–7 days. **Impact:** Passes the "investment committee test." Unlocks institutional adoption.

---

### P1-4: Assumption Pedigree UI (Insight 4)

**Problem:** LayeredValue exists in the backend but is not exposed in the UI. Users can't see the source, confidence, or provenance of each field. The "You" column in F1 Overview is a non-functional placeholder.

**What to build:**

1. Every editable field in the capsule shows a "pedigree badge" on hover: source document, extraction confidence, timestamp, who set the override
2. A "source inspector" panel that shows the full priority walk for a selected field: `broker_claims → extraction_t12 → extraction_rent_roll → platform → override`
3. Color-coding: green = platform data, amber = extraction, red = broker claim, purple = override
4. The 4 tabs that currently leak raw LayeredValue (AssumptionsTab, OverviewTab, DealTermsTab, SourcesUsesTab) must show `.resolved` values with pedigree metadata

**Why it matters:** This is the core moat. No competitor (Dealpath, Apers, ModelTree, ARGUS) has field-level assumption transparency. The spec's architecture is genuinely differentiated — but the UI must expose it.

**Effort:** 3–4 days. **Impact:** Core differentiator. Makes the platform auditable.

---

### P1-5: Authority Matrix + Human-in-the-Loop (Insight 6 + wide05)

**Problem:** The user's vision of "agents work autonomously without any human input" is regulatorily incompatible with institutional deployment. FINRA, SEC, EU AI Act, and Colorado AI Act all require human oversight for high-stakes financial decisions. The platform has no authority matrix, no escalation protocols, and no HITL architecture.

**What to build:**

```typescript
interface AuthorityMatrix {
  dealId: string;
  roles: Record<ViewerRole, {
    canView: boolean;
    canEdit: boolean;
    canOverride: boolean;
    canApprove: boolean;
    canShare: boolean;
    maxAuthorityValue: number; // e.g., $10M deal size limit
  }>;
  approvalChains: {
    assumption_override: ['gp_analyst', 'gp_director'], // analyst proposes, director approves
    capital_deployment: ['gp_director', 'ic_chair'], // director proposes, IC chair approves
    share_mint: ['gp_director'], // director can mint shares
  };
  autoEscalation: {
    dealSizeThreshold: number; // >$10M → always human approval
    riskScoreThreshold: number; // risk > 0.7 → always human approval
    anomalyFlag: boolean; // any data quality alert → human review
  };
}
```

**Why it matters:** This is not optional. Otera, Smart Bricks, AcquiOS — all platforms that claim autonomous underwriting — have authority matrices and human escalation. The spec's Invariant 10 ("Deterministic logic is NOT agent work") already encodes this, but the platform needs a formal governance layer.

**Effort:** 5–7 days. **Impact:** Regulatory compliance. Enables institutional deployment.

---

### P1-6: MCP Server Exposure (Insight 2 + wide02)

**Problem:** The spec's Research Agent → DealContext pattern is wired ad-hoc, not via standard protocols. No MCP server or A2A agent card exists. The platform is not AI-native by design.

**What to build:**

1. **MCP Server** exposing these tools:
   - `extract_rent_roll` — upload PDF, return structured rent roll
   - `build_dcf_model` — create acquisition/dev/redev model from deal data
   - `validate_assumptions` — cross-reference against market comps
   - `run_scenario` — flex assumptions, return delta
   - `generate_ic_memo` — compile analysis into investment memo
   - `fetch_market_intel` — retrieve M05 market data for a submarket
   - `fetch_traffic_projection` — retrieve M07 traffic forecast
   - `get_deal_financials` — return current F9 model state

2. **A2A Agent Cards** for each agent type:
   - Research Agent: discovers comps, market data, regulatory info
   - Underwriting Agent: builds/validates financial models
   - Risk Agent: scores risk, runs stress tests
   - IC Memo Agent: compiles findings into investment memo

**Why it matters:** The deep research found that MCP is the "USB-C for AI" with 16,000+ active servers. A2A is the emerging agent-to-agent standard. The dual-protocol architecture enables a true multi-agent ecosystem. This is what makes the platform "AI-native" rather than "AI-bolted-on." Without it, agents can't connect reliably.

**Effort:** 7–10 days. **Impact:** AI-native architecture. Enables third-party agent integration.

---

### P1-7: Stabilization Marker Governance UI (Insight 5)

**Problem:** The stabilization_marker is computed but not exposed as a governance artifact. Users can't see why the model stabilized in year 3 vs. year 4, or what the binding constraint was.

**What to build:**

1. Stabilization panel on F9 Pro Forma and F1 Overview:
   - "Stabilizes Y3 — binding constraint: rent roll burn-off (last in-place lease expires Mar 2028)"
   - Shows the 4 factors: occupancy, capex, burn-off, expense-normalization
   - Highlights which factor is binding with a visual indicator
   - Locked value: can only be recomputed via LeaseVelocityEngine, not manually edited

2. Invariant enforcement: Projections terminus.period must equal ProForma.Y_S.period — show a warning if they diverge

**Why it matters:** The deep research found that institutions require "exact waterfall matching" and "standardized, consistent reporting." The stabilization marker is a "single source of truth" that prevents the silent divergence failure mode. Exposing it as a locked, auditable value turns a calculation into a governance artifact.

**Effort:** 1–2 days. **Impact:** Prevents model drift. Audit-grade transparency.

---

### P1-8: `per_year_overrides` Read Path (PF-02 from PROFORMA_SUBSYSTEM_AUDIT)

**Problem:** `per_year_overrides` is saved to the DB but never read by `getDealFinancials`. Overrides are orphaned.

**Fix:** Wire `per_year_overrides` into the financials projection calculation. When computing year N, check for an override in `per_year_overrides` before falling back to the base calculation.

**Effort:** 1–2 days. **Impact:** Feature works as intended. No orphan data.

---

### P1-9: NOI Formula Bug (CF-01 from PROFORMA_SUBSYSTEM_AUDIT)

**Problem:** `getFieldValues` forces `egi - total_opex` for NOI, ignores OM-extracted `year1.noi.om`. This cascades into IRR, cap rate, S&U, returns, valuation grid.

**Fix:** Update `getFieldValues` to read `year1.noi.om` when available, with fallback to `egi - total_opex`. Audit all downstream consumers to ensure they use the corrected NOI.

**Effort:** 1–2 days. **Impact:** Correct financials. Prevents cascading errors.

---

### P1-10: Fix F6 Land-Use Visibility Guard (TB-23)

**Problem:** F6 Traffic should be hidden when `use === 'Land'`, but no guard exists. Land deals would show traffic intel for "dirt."

**Fix:** After implementing P0-4 (2D visibility model), add the F6 predicate: `visible iff use !== 'land'`.

**Effort:** Included in P0-4. **Impact:** Correct tab visibility.

---

### P1-11: Fix F7 Visibility for Stabilized Deals (TB-30)

**Problem:** F7 Design-3D is hidden only for `existing` deal type, but should be hidden for all archetypes except Development, Redevelopment, and Land. A Stabilized MF deal incorrectly shows F7.

**Fix:** After implementing P0-4, update F7 predicate: `visible iff archetype ∈ {Development, Redevelopment} OR use === Land`.

**Effort:** Included in P0-4. **Impact:** Correct tab visibility.

---

### P1-12: Risk Weights from M14 Config (TB-41)

**Problem:** RiskDDPage uses hardcoded default risk categories, not the M14 variant config. Existing/development/redevelopment risk weight profiles are never applied.

**Fix:** Update RiskDDPage to consume `getRiskWeightProfile(dealType)` from `deal-type-visibility.ts` and apply the weights to the risk scoring calculation.

**Effort:** 1 day. **Impact:** Correct risk scoring per deal type.

---

### P1-13: Financial Stress Tests (TB-42)

**Problem:** F10 Risk has no financial stress tests (DSCR, debt yield, vacancy sensitivity). These are required for lender review and LP due diligence.

**What to build:**

1. Add stress test section to RiskDDPage:
   - DSCR at various occupancy levels (90%, 85%, 80%, 75%)
   - Debt yield at various cap rates (+50bps, +100bps, +150bps)
   - Vacancy sensitivity matrix (current vs. stressed)
   - Interest rate sensitivity (current vs. +200bps)

2. Integrate with F9 Pro Forma: stress tests should use the live model, not static values

**Why it matters:** The deep research found that LPs require "stress-testability" as one of the 5 evaluation criteria. Without stress tests, the platform fails the institutional test.

**Effort:** 3–4 days. **Impact:** LP due diligence requirement.

---

### P1-14: DD Checklist Integration (TB-43)

**Problem:** F10 Risk has no DD checklist / contingency tracker. The spec's M13 DD Tracker has presets (existing_acquisition, ground_up, redevelopment) but no UI.

**What to build:**

1. DD Checklist sub-tab within F10 Risk or F11 Deal Tools
2. Load checklist from `getDDChecklistPreset(dealType)` in `deal-type-visibility.ts`
3. Track status: pending / in_progress / completed / waived
4. Assign owners and due dates
5. Link checklist items to documents (e.g., "Phase I ESA" links to the uploaded environmental report)

**Why it matters:** DD checklists are standard in institutional transactions. VDRs (iDeals, Datasite) have structured Q&A and checklist workflows. The platform needs this for competitive parity.

**Effort:** 3–4 days. **Impact:** Standard institutional workflow.

---

### P1-15: Deal Stage / Pipeline Tracker (TB-47)

**Problem:** F11 Deal Tools has no deal stage tracker (LOI → DD → Closing). The context bar shows `pipeline_stage` but there's no workflow visualization.

**What to build:**

1. Stage tracker sub-tab in F11 Deal Tools or F1 Overview:
   - Pipeline stages: Prospect → LOI → Under Contract → DD → Closing → Owned
   - For each stage: tasks, owners, deadlines, documents required
   - Visual pipeline (kanban or timeline)
   - Stage transition requires approval (authority matrix)

2. Integrate with `close_deal` modal already in DealDetailPage

**Why it matters:** Dealpath's core value is pipeline tracking. The platform needs this for competitive parity. Also, the deep research found that "standardized, consistent reporting" is a table-stakes requirement.

**Effort:** 3–4 days. **Impact:** Competitive parity with Dealpath.

---

### P1-16: Task Assignments / Action-Item Workflow (TB-48)

**Problem:** No task system exists. Users can't assign underwriting tasks, track completion, or manage action items.

**What to build:**

1. Task CRUD: title, description, assignee, due date, priority, status
2. Task integration: can be linked to a tab, a specific assumption, a document, or a checklist item
3. Notifications: assignee gets notified, overdue tasks are flagged
4. Task dashboard: global view of all open tasks across deals

**Why it matters:** Institutional teams manage deals through task assignments. This is a basic workflow feature that Dealpath, Northspyre, and even generic tools (Asana, Monday) provide. The platform needs it for operational maturity.

**Effort:** 2–3 days. **Impact:** Team workflow.

---

### P1-17: IC Memo / Approval Workflow (TB-50)

**Problem:** No IC memo generation or approval workflow exists. The platform generates analysis but no investment committee deliverable.

**What to build:**

1. IC Memo template sub-tab in F11 Deal Tools or F1 Overview:
   - Executive summary (auto-generated from F1 Overview + F9 key metrics)
   - Investment thesis (user-editable)
   - Market analysis (auto-populated from F3)
   - Financial summary (auto-populated from F9)
   - Risk assessment (auto-populated from F10)
   - Recommendation (user-editable)
   - Approval workflow: analyst → director → IC chair → approved/rejected

2. Integrate with MCP server: `generate_ic_memo` tool for agents

**Why it matters:** The deep research found that AcquiOS claims "5–10 hours saved per IC deck" as a key value proposition. IC memo generation is a high-value feature that institutions will pay for. The platform already has all the data — it just needs to be compiled into a deliverable.

**Effort:** 4–5 days. **Impact:** High-value institutional feature.

---

### P1-18: Audit Trail for All Changes (TB-09 + wide05)

**Problem:** No comprehensive audit trail exists. The platform tracks some changes (assumption overrides) but not all. FINRA, SEC, and SOX require complete audit trails for any system that touches financial data.

**What to build:**

1. `audit_log` table:
   ```sql
   CREATE TABLE audit_log (
     id UUID PRIMARY KEY,
     deal_id UUID,
     user_id UUID,
     agent_id TEXT, -- NULL for human actions
     action_type TEXT, -- 'assumption_change', 'document_upload', 'share_mint', 'override_set', etc.
     entity_type TEXT, -- 'assumption', 'document', 'share', 'scenario'
     entity_id TEXT,
     old_value JSONB,
     new_value JSONB,
     source_ip TEXT,
     timestamp TIMESTAMP DEFAULT NOW()
   );
   ```

2. Log all changes: assumption overrides, document uploads, share creation, model version saves, scenario changes, task assignments, stage transitions

3. Expose audit trail in UI: F11 Deal Tools → Audit Log sub-tab

4. Export audit trail for compliance: PDF or CSV export

**Why it matters:** The deep research found that "complete audit trails connecting every decision to model version, inputs, timestamp, and configuration" are a regulatory requirement. This is non-negotiable for institutional deployment.

**Effort:** 3–4 days. **Impact:** Regulatory compliance. Audit readiness.

---

## PART 3: P2 COMPETITIVE MOATS — DIFFERENTIATORS

### P2-1: Use-Specific Proforma Schemas (TB-37)

**Problem:** F9 Pro Forma uses one schema for all deal types. No use-specific schemas (Retail NNN, Office MG, Industrial, Land residual).

**What to build:** Implement the `PROFORMA_TEMPLATES` already defined in `deal-type-visibility.ts`:

```typescript
// acquisition template: purchase price, renovation, stabilized rents, hold, exit
// development template: land cost, hard costs, soft costs, construction timeline, absorption
// redevelopment template: acquisition + demo/renovation + new construction + phased stabilization
```

Plus use-specific line items:
- **MF:** unit mix, RUBS, lease-up velocity, renewal probability
- **Retail:** NNN + recoveries, % rent, co-tenancy, anchor/junior anchor splits
- **Office:** gross/MG, TI/LC, tenant downtime, renewal probability
- **Industrial:** NNN, clear-height, dock doors, loading ratios
- **Land:** residual land value, entitlement timeline, carry costs

**Why it matters:** ARGUS handles all asset types but is desktop-only. The platform can differentiate by being cloud-native with use-specific schemas. This is what makes the platform "institutional grade" — not just a generic model.

**Effort:** 5–7 days. **Impact:** Differentiation vs. generic platforms.

---

### P2-2: Multi-Scenario Comparison (wide04)

**Problem:** No scenario comparison exists. Users can't create "Base Case," "Upside," "Downside," and compare them side-by-side.

**What to build:**

1. Scenario engine sub-tab in F9:
   - Create scenario from current model (branch)
   - Flex assumptions: rent growth, exit cap, occupancy, opex, construction cost, timeline
   - Side-by-side comparison: IRR, EM, CoC, DSCR, LTV, NOI, cap rate across scenarios
   - Visual delta: waterfall chart showing what changed and why

2. Scenario persistence: save to DB, share with team, export to Excel

**Why it matters:** ModelTree claims "5× faster scenario turnaround than Excel" as a core value prop. Scenario comparison is a standard institutional requirement. The platform needs it for competitive parity.

**Effort:** 4–5 days. **Impact:** Core institutional feature.

---

### P2-3: Real-Time Collaboration (wide04)

**Problem:** No real-time collaboration exists. Multiple users can't edit the same model simultaneously.

**What to build:**

1. WebSocket-based real-time sync for assumption changes
2. Presence indicators: who is viewing/editing which tab
3. Comment threads on assumptions (inline discussion)
4. Conflict resolution: if two users edit the same assumption, show both values and prompt for resolution

**Why it matters:** Google Sheets and ModelTree both offer real-time collaboration. Excel Online does too. The platform needs this for competitive parity. The spec's PresenceIndicator is already partially implemented — extend it to full real-time sync.

**Effort:** 5–7 days. **Impact:** Team collaboration.

---

### P2-4: Document AI Extraction Results Viewer (TB-49)

**Problem:** Documents are uploaded but extraction results are not viewable in the UI. Users can't see what the AI extracted from their OM, T12, or rent roll.

**What to build:**

1. Document viewer sub-tab in F11 Deal Tools:
   - Show uploaded document (PDF) side-by-side with extraction results
   - Highlight extracted values in the PDF (bounding boxes)
   - Confidence scores per extraction
   - User can correct extractions → corrections feed back into the model
   - Extraction history: version tracking for each document

**Why it matters:** The deep research found that "AI grounded in proprietary structured data" is what institutions want. Showing extraction results builds trust in the AI. It also enables the feedback loop that improves extraction accuracy over time.

**Effort:** 4–5 days. **Impact:** AI trust and feedback loop.

---

### P2-5: Market Signal Synthesis (TB-13)

**Problem:** F3 Market Intel has 8+ sub-tabs but no synthesized market signal. Users must navigate sub-tabs to understand the market thesis.

**What to build:**

1. Market Signal card at the top of F3 Market:
   - "BUY / HOLD / CAUTION" signal with confidence score
   - Key drivers: rent growth, absorption, supply pressure, job growth, demographic trend
   - Synthesized narrative: 2–3 paragraphs summarizing the market thesis
   - Generated by AI from the market data, but editable by the analyst

2. The signal should update in real-time as market data changes

**Why it matters:** The deep research found that institutions want "AI insights rooted in the same data that drives their investment decisions." A synthesized market signal is exactly this — it turns raw data into actionable intelligence.

**Effort:** 2–3 days. **Impact:** AI-driven decision support.

---

### P2-6: Zoning Verdict Card (TB-08)

**Problem:** F2 Zoning has 6 sub-tabs but no top-level zoning verdict. Users must drill into sub-tabs to understand the zoning situation.

**What to build:**

1. Zoning Verdict card at the top of F2 Zoning:
   - Zoning code, permitted uses, FAR, max units, max GFA
   - Entitlement timeline estimate (months to approval)
   - Zoning risk score (low/medium/high)
   - Binding constraint (e.g., "parking limits max units to 120, not FAR")
   - Signal back to F1: "Zoning constrains max units to 120"

2. The card should be auto-generated from boundary + zoning API data, but editable by the analyst

**Why it matters:** The deep research found that zoning is a key factor in institutional underwriting. A top-level verdict card saves time and surfaces critical constraints immediately. The signal back to F1 is also important — it ensures the overview reflects the latest zoning analysis.

**Effort:** 2–3 days. **Impact:** Time-saving UX.

---

### P2-7: F8 Capital Stack Designer (TB-34)

**Problem:** F8 Capital has hardcoded strategy presets (Bridge, Agency, Construction) but no actual capital stack designer. Users can't model their own debt structure.

**What to build:**

1. Capital Stack Designer sub-tab in F8:
   - Drag-and-drop tranches: senior debt, mezzanine, preferred equity, common equity
   - Per-tranche: amount, rate, term, amortization, prepayment, covenants
   - Live recalculation: LTV, LTC, DSCR, weighted average cost of capital
   - Waterfall visualization: cash flows to each tranche over time
   - Stress test: what happens if NOI drops 20%?

2. Integrate with live rate feed (SOFR, EFFR, Prime, Treasuries) — already implemented

**Why it matters:** The deep research found that "no real capital stack designer" is a gap in current platforms. This is a genuinely differentiated feature that no competitor (Dealpath, Juniper Square, ARGUS) has in a cloud-native, collaborative format.

**Effort:** 7–10 days. **Impact:** High differentiation.

---

### P2-8: ESG / Climate Risk Integration (wide06)

**Problem:** No ESG or climate risk data exists in the capsule. Institutions are increasingly required to evaluate climate risk (SEC climate disclosure, GRESB, TCFD).

**What to build:**

1. ESG sub-tab in F10 Risk or F3 Market:
   - Energy score (EPA Energy Star, EUI)
   - Climate risk: flood zone, wildfire risk, heat stress (using NOAA/FEMA data)
   - Regulatory risk: MEPS compliance, carbon pricing impact
   - Estimated capex to comply with upcoming regulations
   - Impact on exit cap (climate-aligned vs. misaligned assets)

2. Integrate with PCRAM (Physical Climate Risk Assessment Methodology) or ULI Preserve tool

**Why it matters:** The deep research found that "ESG reporting automation and climate risk modeling" is a top institutional demand. The OECD's 2025 report on future-proofing real estate investment identifies 12 material climate risks that should be quantified in financial models. This is a forward-looking differentiator.

**Effort:** 5–7 days. **Impact:** Future-proofing. Regulatory readiness.

---

### P2-9: Investment Thesis / Deal Narrative (TB-05)

**Problem:** F1 Overview has no executive narrative or investment thesis. Users must infer the thesis from scattered data.

**What to build:**

1. Investment Thesis card at the top of F1 Overview:
   - Auto-generated from deal data, market intel, and strategy analysis
   - 3–5 paragraphs: market opportunity, competitive positioning, value creation strategy, risk mitigation, exit strategy
   - AI-generated but editable by the analyst
   - Linked to source data: every claim has a citation to the relevant tab/data

2. The thesis should be included in the IC memo export

**Why it matters:** The deep research found that "institutional LPs evaluate fund models on 5 criteria" and the first is transparency. An investment thesis is the narrative that ties the numbers together. Without it, the model is just a spreadsheet.

**Effort:** 2–3 days. **Impact:** Narrative completeness.

---

### P2-10: Site-Visit Log / Photo Gallery (TB-49 extension)

**Problem:** No site-visit tracking or photo management exists. Institutions require site visits as part of due diligence.

**What to build:**

1. Site Visit sub-tab in F11 Deal Tools:
   - Log visits: date, attendees, notes, photos
   - Photo gallery: property exterior, interior, units, amenities, surrounding area
   - Photo tags: condition, location, timestamp, GPS coordinates
   - Comparison: before/after photos for redevelopment deals

**Why it matters:** Site visits are a standard DD requirement. Photos are often the first thing an LP looks at. This is a basic feature that all institutional platforms should have.

**Effort:** 2–3 days. **Impact:** DD completeness.

---

### P2-11: Co-Investment Workflow (wide06)

**Problem:** No co-investment workflow exists. The platform assumes a single GP per deal. Institutions increasingly co-invest (60% of $10B+ AUM investors are active or considering co-investments).

**What to build:**

1. Co-Investment sub-tab in F8 Capital or F11 Deal Tools:
   - Co-investor list: name, commitment, ownership percentage
   - Side-car terms: promote structure, fee sharing, governance rights
   - Co-investor-specific views: each co-investor sees their own economics
   - Shared assumption model: all co-investors work from the same model, but see different returns

**Why it matters:** The deep research found that co-investment is growing rapidly. Co-investors need deal-level transparency, not just quarterly fund reports. This is a high-value institutional feature.

**Effort:** 4–5 days. **Impact:** High-value institutional feature.

---

### P2-12: Waterfall Modeling (TB-35 + wide04)

**Problem:** No equity waterfall modeling exists. The platform shows simple returns (IRR, EM) but not the actual distribution waterfall.

**What to build:**

1. Waterfall sub-tab in F9 Pro Forma or F8 Capital:
   - Preferred return (hurdle rate, compounding, accrual)
   - Catch-up mechanics (GP catch-up percentage)
   - Promote splits ( tiers: 80/20, 70/30, 60/40)
   - Clawback provisions
   - LP/GP capital accounts over time
   - Visual waterfall chart showing cash flow distribution by tier

2. Match LPA terms precisely — this is a critical LP requirement

**Why it matters:** The deep research found that "exact waterfall matching" is one of the 5 LP criteria. Waterfall errors are a common deal-killer in due diligence. This is a table-stakes feature for institutional platforms.

**Effort:** 5–7 days. **Impact:** Table-stakes for institutional deals.

---

### P2-13: Portfolio Aggregation (wide06)

**Problem:** The platform is deal-centric. No portfolio-level view exists. Institutions manage portfolios, not individual deals.

**What to build:**

1. Portfolio Dashboard (new page, not a tab):
   - All deals in portfolio: name, type, stage, IRR, EM, DSCR, LTV
   - Concentration analysis: by geography, property type, vintage, lender
   - Risk aggregation: portfolio-level risk score, weighted average cap rate, NOI growth
   - Pacing: committed vs. deployed capital, capital calls, distributions
   - Drill-down: click any metric to see the underlying deals

2. Integrate with F1 Overview: each deal's F1 metrics feed into the portfolio dashboard

**Why it matters:** The deep research found that "real-time portfolio exposure analytics" is a top institutional demand. Dealpath and MRI Software offer this, but implementation takes 6–18 months and costs $500K–$5M+. The platform can differentiate by making portfolio aggregation lightweight and API-first.

**Effort:** 7–10 days. **Impact:** Portfolio management. Competitive with Dealpath.

---

### P2-14: API-First Integration (wide02 + wide06)

**Problem:** The platform is monolithic. No public API exists for external integrations (property management systems, accounting, CRM, VDRs).

**What to build:**

1. Public REST API v2:
   - `/deals` — CRUD, list, filter
   - `/deals/{id}/financials` — get/set financial model
   - `/deals/{id}/assumptions` — get/set assumptions with pedigree
   - `/deals/{id}/documents` — upload, list, download
   - `/deals/{id}/scenarios` — create, compare, branch
   - `/deals/{id}/shares` — mint, revoke, list
   - `/portfolio` — aggregate metrics
   - `/market` — M05 market data
   - `/traffic` — M07 traffic projections

2. Webhooks: notify external systems when deal stage changes, assumptions are updated, documents are uploaded

3. OAuth 2.0 + API key authentication

**Why it matters:** The deep research found that "seamless integration across the tech stack" is the most common implementation failure. API-first design is what enables the platform to become the "system of record" for institutional real estate workflows.

**Effort:** 7–10 days. **Impact:** Integration ecosystem. Platform lock-in.

---

## PART 4: P3 POLISH — NICE-TO-HAVE

### P3-1: F1 Investment Thesis (TB-05) — see P2-9
### P3-2: F1 Functional "You" Column (TB-06)
### P3-3: F1 Deal Timeline / Milestone Tracker (TB-07)
### P3-4: F2 Collapsed/Demoted UI for Stabilized Deals (TB-11)
### P3-5: F3 Reduce Sub-Tab Bloat (TB-12)
### P3-6: F3 Replace Mock Data in Program/Amenity Panels (TB-15)
### P3-7: F4 Mark Synthetic Data with Provenance Badges (TB-16–18)
### P3-8: F5 Comparable Strategy Overlays (TB-19)
### P3-9: F5 Exit Strategy Timeline by Hold Period (TB-20)
### P3-10: F5 Deal-Specific Sensitivity Analysis (TB-21)
### P3-11: F6 Commercial Tenant Leasing Model (TB-22)
### P3-12: F6 Lease Expiration Schedule (TB-26)
### P3-13: F6 CRM Channel Attribution (TB-27)

These are documented in the tab-by-tab audit (`DEAL_CAPSULE_TAB_ALIGNMENT_AUDIT_2026-06-18.md`) and are lower priority than the P1/P2 items above. They should be addressed after P0–P2 are complete.

---

## BUILD ORDER: RECOMMENDED SEQUENCE

### Sprint 1 (Week 1–2): P0 Structural Fixes
1. P0-1: Fix F-key mapping (5 min)
2. P0-2: Fix F9 moduleId (1 min)
3. P0-3: Resolve F10 M13/M14 conflict (1 hour)
4. P0-4: Add `assetUseType` + `dealArchetype` to Deal type, validate pairs (2 days)
5. P0-5: Add `scope_id` column + enforce Lane A/B guard (3 days)

**Deliverable:** Platform is structurally sound. Tab navigation works. Legal compliance for data sharing is enforced.

### Sprint 2 (Week 3–4): P1 Core Institutional Features
6. P1-1: Build `deal_capsules` table + snapshot service (5 days)
7. P1-2: Role-based views (5 days)
8. P1-4: Assumption pedigree UI (4 days)
9. P1-7: Stabilization marker governance UI (2 days)
10. P1-8: Wire `per_year_overrides` (2 days)
11. P1-9: Fix NOI formula (2 days)

**Deliverable:** Platform can share deal capsules with layer-filtered permissions. Users can see assumption pedigree. Stabilization is auditable.

### Sprint 3 (Week 5–6): P1 Excel + Governance
12. P1-3: Excel export with formula integrity (7 days)
13. P1-5: Authority matrix + HITL (7 days)
14. P1-18: Audit trail for all changes (4 days)

**Deliverable:** Platform passes the investment committee test. Excel export works. Governance is enforced.

### Sprint 4 (Week 7–8): P1 Risk + DD + Workflow
15. P1-13: Financial stress tests (4 days)
16. P1-14: DD checklist integration (4 days)
17. P1-15: Deal stage / pipeline tracker (4 days)
18. P1-16: Task assignments (3 days)
19. P1-17: IC memo generation (5 days)

**Deliverable:** Full institutional workflow: DD → underwriting → stress test → IC memo → approval → closing.

### Sprint 5 (Week 9–10): P2 Competitive Moats
20. P2-1: Use-specific proforma schemas (7 days)
21. P2-2: Multi-scenario comparison (5 days)
22. P2-3: Real-time collaboration (7 days)
23. P2-6: Zoning verdict card (3 days)
24. P2-9: Investment thesis (3 days)

**Deliverable:** Platform is differentiated from Dealpath, ARGUS, and Excel. Use-specific schemas + scenario comparison + real-time collaboration = unique value proposition.

### Sprint 6 (Week 11–12): P2 AI + Capital + Portfolio
25. P1-6: MCP server exposure (10 days) — moved here because it depends on stable API
26. P2-7: Capital stack designer (10 days)
27. P2-12: Waterfall modeling (7 days)
28. P2-13: Portfolio aggregation (10 days)
29. P2-14: API-first integration (10 days)

**Deliverable:** Platform is AI-native. Capital stack + waterfall + portfolio = full institutional stack.

### Sprint 7 (Week 13+): P2 Advanced + P3 Polish
30. P2-4: Document extraction results viewer (5 days)
31. P2-5: Market signal synthesis (3 days)
32. P2-8: ESG / climate risk (7 days)
33. P2-10: Site-visit log (3 days)
34. P2-11: Co-investment workflow (5 days)
35. P3 items (ongoing)

**Deliverable:** Platform is feature-complete for institutional-grade deployment. ESG + co-investment + site visits = full DD suite.

---

## STRATEGIC RECOMMENDATION

### The "Don't Build Everything at Once" Strategy

The 13-sprint plan above is the full vision. But the user is a solo founder with limited resources. Here's the **minimum viable institutional-grade** subset:

**Phase 1 (Month 1):** P0-1 through P0-5 + P1-1 (sharing) + P1-4 (pedigree UI) + P1-3 (Excel export)
- This makes the platform structurally sound, shareable, and auditable
- It passes the "investment committee test" because assumptions are traceable and exportable to Excel
- It's the minimum for an LP to trust the platform

**Phase 2 (Month 2):** P1-5 (authority matrix) + P1-18 (audit trail) + P1-15 (pipeline tracker) + P1-16 (tasks)
- This adds governance and workflow — the operational layer that makes it usable for a team

**Phase 3 (Month 3):** P1-6 (MCP) + P2-1 (use-specific schemas) + P2-2 (scenarios)
- This adds AI-native architecture and differentiation

**Phase 4 (Month 4+):** Everything else, prioritized by user feedback

### The "Sell the Vision, Ship the MVP" Strategy

The deep research found that the market is **ripe** for a platform that solves the "live model data room" problem. The competitive gap is **wide**. No existing platform (Dealpath, Juniper Square, ARGUS, Apers) has:

1. Field-level assumption transparency with source pedigree
2. Lane-guarded data container (licensed data safe)
3. AI-native architecture (MCP + A2A)
4. Layer-filtered sharing (evidence without thesis)

These 4 features are the **core moat**. Everything else is table-stakes or nice-to-have. Build these 4 first, then add the table-stakes, then the nice-to-haves.

### Marketing Narrative

The correct positioning is:

> **"AI-ready infrastructure for institutional real estate underwriting."**

Not "AI underwriting." Not "Excel replacement." The platform's value is that it makes a firm's proprietary deal data AI-accessible with governance, audit, and compliance built in. The AI is a layer on top of the infrastructure — not the infrastructure itself.

This matches the deep research finding: "92% of CRE firms have piloted AI, but only 5% achieved their goals. The #1 reason is lack of infrastructure." JediRe is the infrastructure.

---

## CONCLUSION

The Deal Capsule is **architecturally sound, legally necessary, and market-viable**. The spec's 12 invariants and 5 design pillars (sharing, container, AI interactivity, autonomous underwriting) are correct. The code has 50 gaps, but 5 P0 fixes + 18 P1 features would make it institutional-grade. The competitive window is open. The market is growing at 12.2% CAGR. No competitor has solved the "live model data room" problem.

**Build the moat (LayeredValue + Lane A/B + MCP + sharing) first. Add the table-stakes (Excel export, audit trail, governance) second. Then scale.**

---

*End of unified remediation roadmap. 50 gaps, 10 insights, 13 sprints, 1 strategic recommendation.*
