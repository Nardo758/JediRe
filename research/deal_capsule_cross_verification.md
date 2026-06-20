# DEAL CAPSULE CROSS-VERIFICATION & INSIGHT EXTRACTION
*Phase 4–6 Synthesis · Deep Research Swarm · 2026-06-19*

---

## DIMENSIONS IDENTIFIED (12)

From the 6-facet wide exploration, the following dimensions were decomposed:

| # | Dimension | Primary Source | Overlap With |
|---|-----------|---------------|------------|
| 01 | Deal Sharing & Model Collaboration | wide01 | wide04, wide06 |
| 02 | AI Agent Interoperability Standards | wide02 | wide05 |
| 03 | Proprietary Data Licensing & Compliance | wide03 | wide01, wide06 |
| 04 | Excel vs. Platform Dilemma | wide04 | wide01, wide06 |
| 05 | Autonomous Underwriting Governance | wide05 | wide02, wide06 |
| 06 | Competitive Landscape Gaps | wide06 | wide01, wide04 |
| 07 | Institutional LP Requirements | wide01 | wide04, wide05, wide06 |
| 08 | Assumption Transparency & Pedigree | wide04 | wide01, wide03 |
| 09 | Version Control & Audit Trail | wide01 | wide04, wide05 |
| 10 | Market Opportunity & TAM | wide06 | wide01, wide04 |
| 11 | Security & Threat Model for Agentic AI | wide02 | wide05 |
| 12 | Insurance & Liability Stack | wide05 | wide02, wide06 |

---

## CROSS-VERIFICATION: CONFIDENCE TIERS

### HIGH CONFIDENCE (≥2 independent sources, consistent evidence)

| Finding | Evidence | Dimensions |
|---------|----------|------------|
| **Excel remains the institutional standard for RE financial modeling** | wide01: "Excel is not going away in institutional commercial real estate"; wide04: "Excel is the lingua franca"; wide06: "60-70% of analyst time on data entry" | 01, 04, 06 |
| **No platform integrates all three pillars (documents + market data + live modeling)** | wide06: "No single platform today seamlessly integrates all three"; wide01: Dealpath for pipeline, Juniper Square for LP reporting, ARGUS for DCF; wide04: ModelTree augments Excel but doesn't replace it | 01, 04, 06 |
| **CoStar and Yardi prohibit redistribution in shared models** | wide03: CoStar bans "any data sharing arrangement"; Yardi prohibits "searchable database or data-sharing arrangement"; wide01: VDRs with NDAs are the workaround | 03, 01 |
| **MCP is the de facto standard for AI-to-tool communication** | wide02: 16,000+ active MCP servers; FMP, OpenLedger, Daloopa, LSEG all use it; Anthropic donated to Linux Foundation | 02 |
| **FINRA Notice 24-09 applies existing rules to AI outputs** | wide05: "FINRA's rules are technology-neutral"; wide02: Recordkeeping requirements for AI-generated content; wide05: Examiners actively request AI governance docs | 05, 02 |
| **Human-in-the-loop is effectively mandatory for high-stakes decisions** | wide05: EU AI Act Article 14; Colorado AI Act; US Treasury AI Risk Framework; wide02: Tiered governance (autonomous → approval → human execution) | 05, 02 |
| **Institutional LPs evaluate models on 5 criteria** | wide01: Tilt Analytics — transparency, granularity, waterfall accuracy, stress-testability, fee clarity; wide04: Same criteria repeated across PE/VC sources | 01, 07 |
| **The "deal capsule" vision (docs + data + model in one container) does not exist at scale** | wide06: "The gap is the connective tissue between them"; wide01: "No platform solves this by embedding licensed data"; wide04: "What CRE lacks is a live model data room" | 06, 01, 04 |
| **AI adoption in CRE is 92% aspirational but only 5% realized** | wide06: JLL 2025 survey; wide02: Only 21% of companies have proper AI governance; wide05: Infrastructure gap is the binding constraint | 06, 02, 05 |
| **Real estate software market is $12.8B (2025) → $32B (2033) at 12.2% CAGR** | wide06: Grand View Research; wide01: PropTech M&A surging (163 deals, $6.8B in 2025) | 10 |

### MEDIUM CONFIDENCE (1 authoritative source, plausible)

| Finding | Evidence | Dimensions |
|---------|----------|------------|
| **A2A protocol will complement MCP for multi-agent workflows** | wide02: Google A2A launched April 2025, 30+ partners; "80% of enterprises will use AI agents by 2026, but only 30% will achieve interoperability without A2A" | 02 |
| **ModelTree (Exquance) is the closest to institutional-grade model sharing** | wide04: $25B+ AUM, Big Four-audited, exports to Excel with formulas; wide01: European institutional adoption | 04, 01 |
| **Smart Bricks (a16z-backed) is the only fully autonomous RE underwriting platform** | wide05: $5M pre-seed, "3-6 month process compressed to minutes"; wide06: Not yet at institutional scale | 05, 06 |
| **Derived data exception is extremely narrow and legally risky** | wide03: Fried Frank analysis; wide03: "Adding an analytics layer does not automatically insulate"; wide01: No platform embeds licensed data directly | 03, 01 |
| **Traditional E&O policies exclude AI-generated decisions** | wide05: Munich Re analysis; wide05: Dunn v. Upstart (2026) precedent; wide02: Only Armilla AI, Vouch, Relm offer AI-specific coverage | 12, 05 |

### CONFLICT ZONE

| Conflict | Evidence A | Evidence B | Resolution |
|----------|-----------|-----------|------------|
| **Can AI fully replace human underwriters?** | wide05: Smart Bricks claims full autonomy; Otera claims 99.9% post-validation accuracy | wide05: FINRA 24-09 requires supervision; EU AI Act mandates HITL; Colorado requires appeal rights; SEC fiduciary duties attach to AI recommendations | **PARTIAL AUTONOMY is the consensus.** AI handles sourcing, screening, analysis, drafting. Humans retain approval for execution, adverse decisions, and exceptions. |
| **Should the platform replace Excel or augment it?** | wide04: ModelTree, U-Rite, Apers all say "augment, not replace"; wide01: "LPs expect Excel deliverables" | wide04: Rockport VAL is a cloud-native ARGUS alternative; wide06: Northspyre integrates modeling natively | **AUGMENT is the institutional consensus.** Excel as first-class output with platform-generated, traceable assumptions. Replace only for specific use cases (development, not acquisition). |
| **Is the derived data exception safe for shared models?** | wide03: EMMI derived data license acknowledges licensee IP rights | wide03: CoStar v. CREXi litigation; NIP Authority says "adding analytics layer does not insulate"; wide03: Derived data must be "non-reversible and non-substitutable" — embedding comp points fails this test | **NOT SAFE for point-level data.** Safe only for aggregated, anonymized trends where individual data points cannot be reverse-engineered. |

---

## INSIGHT EXTRACTION (Phase 6)

### Insight 1: The "Live Model Data Room" Gap Is the Core Opportunity

**Insight:** The real estate industry has VDRs for documents (iDeals, Datasite), Excel for models, and CoStar/Yardi for data — but no single environment where a live financial model recalculates in real-time while sitting alongside its source documents and market data, with all changes tracked and all assumptions traceable to their source documents.

**Derived From:** Dim 01 (wide01: VDRs are passive), Dim 04 (wide04: "What CRE lacks is a live model data room"), Dim 06 (wide06: "No single platform integrates all three pillars")

**Rationale:** This gap is not a technology problem — it's a legal and business model problem. The technology exists (cloud spreadsheets, real-time collaboration, API integrations). The barrier is that no platform has solved the licensed data problem (Dim 03) while simultaneously building institutional trust in non-Excel outputs (Dim 04). The first platform to solve both wins the category.

**Implications:** JediRe's Deal Capsule is conceptually well-positioned — it aims to be exactly this "live model data room." But the spec and code must address the licensed data barrier (user-brings-own-license or proprietary data capture) and the Excel export requirement (first-class, formula-preserving output).

**Confidence:** High

---

### Insight 2: The Two-Protocol Architecture (MCP + A2A) Is the Future of AI Underwriting

**Insight:** The convergence of MCP (agent-to-tool) and A2A (agent-to-agent) creates a dual-protocol architecture that could enable a true multi-agent underwriting ecosystem: a Research Agent discovers comps via MCP, delegates to an Underwriting Agent via A2A, which uses MCP to access the platform's DCF engine, while a Risk Agent monitors via A2A — all within governed, auditable boundaries.

**Derived From:** Dim 02 (wide02: MCP is dominant; A2A is complementary), Dim 05 (wide05: Tiered HITL governance), Dim 11 (wide02: Security frameworks for agent-to-agent communication)

**Rationale:** No single agent can be an expert in everything. The spec's Research Agent → DealContext → analytical agents pattern is prescient, but it must be formalized as MCP server declarations (what tools are available) + A2A agent cards (what each agent can do). Without this formalization, the "agents use the same API doors humans use" principle (Invariant 11) is an aspiration, not an architecture.

**Implications:** JediRe should expose its core services as MCP servers: `extract_rent_roll`, `build_dcf_model`, `validate_assumptions`, `run_scenario`, `generate_ic_memo`. Each agent gets an A2A agent card. This makes the platform AI-native by design, not AI-bolted-on.

**Confidence:** High

---

### Insight 3: The Lane A/B Scope Guard Is Not Just a Privacy Feature — It's a Legal Requirement

**Insight:** The spec's Lane A/B scope guard (platform data vs. user-uploaded data) and `redistribution_restricted` flag are not just architectural preferences — they are legal necessities. CoStar's and Yardi's terms of service explicitly prohibit embedding their data into "any data-sharing arrangement." The spec's design of keeping Lane B data deal-scoped and never writing it to the shared corpus is the only legally defensible architecture.

**Derived From:** Dim 03 (wide03: CoStar/Yardi redistribution restrictions), Dim 08 (wide04: Assumption transparency requires source tracking), Dim 01 (wide01: VDRs with granular access are the workaround)

**Rationale:** The spec's three source classes (Class 1 = subject uploads, Class 2 = third-party licensed, Class 3 = platform data) map exactly to the legal reality: Class 2 data (CoStar, Yardi) can never be redistributed. The `redistribution_restricted` flag and `scope_id` guard are the technical implementation of a legal compliance requirement. The fact that `scope_id` is "to build" (not yet implemented) is a P0 legal risk.

**Implications:** Building `scope_id` and enforcing the Lane A/B guard before any sharing feature ships is not optional — it's a legal prerequisite. The platform could face copyright infringement claims from CoStar or Yardi if Lane B data leaks into shared surfaces.

**Confidence:** High

---

### Insight 4: "Assumption Transparency" Is the Killer Feature Institutions Will Pay For

**Insight:** The spec's LayeredValue design (per-field source tracking with override, broker, platform, extraction layers) addresses exactly the institutional LP's #1 concern: "Can I trace every assumption from input to output?" This is the feature that would make an institutional LP comfortable receiving a shared model instead of an Excel file. No competitor has this at the field level.

**Derived From:** Dim 07 (wide01: 5 LP criteria, transparency is #1), Dim 08 (wide04: "The black box risk" — no trust without visibility), Dim 01 (wide01: LPs use the model as a primary underwriting tool)

**Rationale:** Competitors like ModelTree export to Excel with formulas, but they don't track the *pedigree* of each assumption — which document it came from, when it was extracted, what the confidence score was, whether it was overridden. The spec's LayeredValue + `year1` resolved snapshot + per-field source priority walk is a genuinely differentiated architecture. But 4 tabs in the current code leak raw LayeredValue instead of resolved values (audit finding TB-04), undermining the feature.

**Implications:** The LayeredValue architecture is the core moat. Fix the 4 tabs that leak raw layers, build the assumption pedigree UI (show source + confidence + provenance for every field), and market this as "audit-grade assumption transparency" — it's a feature no competitor has.

**Confidence:** High

---

### Insight 5: The Stabilization Marker Is a Governance Innovation, Not Just a Calculation

**Insight:** The spec's stabilization_marker invariant (resolved once, consumed by both Pro Forma Y_S and Projections terminus) is not just a computational optimization — it's a governance mechanism that prevents the "two surfaces silently diverge" failure mode. This is exactly the kind of "single source of truth" design that institutions require for auditability.

**Derived From:** Dim 07 (wide01: LPs require exact waterfall matching), Dim 09 (wide04: Version control and audit trails are non-negotiable), Dim 05 (wide05: OCC SR 11-7 requires independent validation and documentation)

**Rationale:** In Excel-based underwriting, the "stabilized year" might be calculated in the Pro Forma tab, then copied into the Projections tab, then manually adjusted by an analyst. If someone changes the Pro Forma but forgets to update Projections, the surfaces diverge. The spec's invariant prevents this by design. This is the kind of "error-resistant calculation" that platforms provide and Excel doesn't.

**Implications:** The stabilization_marker should be exposed in the UI as a locked, auditable value with provenance ("Stabilizes Y3 — binding constraint: rent roll burn-off (last in-place lease expires Mar 2028)"). This turns a calculation into a governance artifact.

**Confidence:** High

---

### Insight 6: Autonomous Underwriting Without Human Approval Is a Regulatory Dead End

**Insight:** The user's vision of "agents work autonomously to underwrite deals without any human input" is technically achievable (see Smart Bricks, Otera) but **regulatorily incompatible** with institutional-grade deployment. FINRA, SEC, EU AI Act, Colorado AI Act, and OCC all require human oversight for high-stakes financial decisions. The correct framing is "autonomous analysis with human approval," not "autonomous underwriting."

**Derived From:** Dim 05 (wide05: Full governance checklist), Dim 02 (wide02: Tiered HITL governance), Dim 12 (wide05: Liability rests with deploying firm)

**Rationale:** The spec's Invariant 10 ("Deterministic if-then logic is NOT agent work") already encodes this: agents handle only "true reasoning residue." But the user's stated vision of "without any human input" goes beyond the spec. The platform must be designed for "human-in-the-loop" as a first-class feature, not as an afterthought. The authority matrix (who can approve what) should be a core data model, not a UI toggle.

**Implications:** Redesign the autonomous underwriting narrative from "no human input" to "AI handles 90% of analysis; humans retain approval rights for capital deployment, adverse decisions, and exceptions." This is what Otera, Smart Bricks, and AcquiOS all do. Build the authority matrix and escalation protocols into the platform architecture.

**Confidence:** High

---

### Insight 7: The Market Is Ripe for a Platform That Solves the "AI Foundation" Problem

**Insight:** 92% of CRE firms have piloted AI, but only 5% achieved their goals. The #1 reason for failure is "lack of infrastructure" — not lack of AI models. A platform that provides the structured data foundation, governance layer, and API access that AI agents need would capture a massive first-mover advantage. JediRe's spec is architecturally correct (structured data spine, assumption resolution, agent API), but the implementation is incomplete (50 gaps in the audit).

**Derived From:** Dim 10 (wide06: 92% piloted, 5% achieved goals), Dim 02 (wide02: MCP adoption is the infrastructure layer), Dim 06 (wide06: "The gap is the connective tissue")

**Rationale:** Most CRE firms are trying to bolt AI onto fragmented Excel workflows. The spec's approach — building a structured data spine first, then layering AI on top — is the correct one. But the data spine must be complete (fix the 50 gaps) and the AI layer must be formalized (MCP servers, A2A agent cards) before the platform can claim to solve the infrastructure problem.

**Implications:** The marketing narrative should be "AI-ready infrastructure for institutional real estate underwriting" — not "AI underwriting." The platform's value is that it makes a firm's proprietary deal data AI-accessible with governance, audit, and compliance built in.

**Confidence:** High

---

### Insight 8: The F-Key Tab Misalignment Is a Symptom, Not the Disease

**Insight:** The 5 P0 structural bugs (F-key mapping, module IDs, visibility model) are symptoms of a deeper problem: the DealDetailPage was built as a "Bloomberg terminal" for a single user, not as a "shared deal container" for institutional collaboration. The keyboard shortcuts, the module IDs, the one-dimensional visibility model — all assume one user at one desk. An institutional-grade deal capsule requires multi-user, multi-role, multi-permission design from the ground up.

**Derived From:** Dim 01 (wide01: VDRs have granular permissions, role-based access), Dim 07 (wide01: LPs require different views than GPs), Dim 09 (wide04: Version control and audit trails for multi-user), Dim 06 (wide06: "No live model collaboration")

**Rationale:** The current DealDetailPage has no concept of "viewer role." A lender, an LP, a JV partner, and an internal analyst all see the same tabs with the same data. In an institutional setting, these roles need different views: the lender sees debt metrics and stress tests; the LP sees returns and waterfall; the JV partner sees capital stack and exit strategy; the analyst sees all assumptions and source layers. The spec's "layer filter" for sharing (§5) is the right concept, but the UI doesn't implement it.

**Implications:** The DealDetailPage needs a role-based view system. Each F-key tab should have sub-views per role (GP, LP, Lender, Analyst, Viewer). The LayeredValue architecture makes this possible — the same data, different resolution per role. But this requires redesigning the tab system, not just fixing the F-key mapping.

**Confidence:** High

---

### Insight 9: The "No Jurisdiction Literals" Invariant Is Undermined by the 1D DealType Model

**Insight:** Invariant 12 ("No `if (state === 'FL')` outside ruleset files") is an architectural aspiration for jurisdiction-agnostic code. But the 1D `DealType` model (`existing`/`development`/`redevelopment`) is itself a jurisdiction-literal-like simplification that collapses the two-axis `(use × archetype)` model into a single enum. This is why the visibility model fails for Land use cases and why F9 can't load use-specific schemas.

**Derived From:** Dim 01 (wide01: Dealpath handles pipeline for all deal types), Dim 06 (wide06: Northspyre is development-only), Dim 04 (wide04: ARGUS handles lease-level for all asset types)

**Rationale:** The two-axis model (use: MF/Retail/Office/Industrial/Land × archetype: Stabilized/Value-Add/Lease-Up/Development/Redevelopment/Land-hold) is the correct abstraction. It encodes the legal and financial reality: a Retail development has different zoning, comps, leasing model, and proforma schema than a Multifamily acquisition. The 1D `DealType` enum loses this information, forcing workarounds and incorrect defaults.

**Implications:** Replace the 1D `DealType` with the 2D `(use, archetype)` model. Validate pairs at deal creation. Use the pair to drive tab visibility, proforma schema, traffic model, and comp lens. This is a structural change, not a UI fix.

**Confidence:** High

---

### Insight 10: The Sharing Layer Should Be a "Layer Filter," Not a "Tab Toggle"

**Insight:** The spec's §5 sharing design proposes a layer filter (show `t12`/`platform` evidence, hide `override` thesis) because each field is already layered. This is more granular and more powerful than tab-level sharing. But the current implementation has no concept of sharing at all — the Share button opens a modal that doesn't exist in the backend. The `deal_capsules` table is missing.

**Derived From:** Dim 03 (wide03: VDRs have per-LP-class permissioning), Dim 07 (wide01: LPs require different views than GPs), Dim 08 (wide04: Assumption transparency requires pedigree visibility), Dim 01 (wide01: Granular permissions are the standard)

**Rationale:** Institutional VDRs (iDeals, Datasite) have "per-LP-class permissioning" — different investor tiers see different documents. The spec's layer filter is the technical equivalent: different recipient tiers see different assumption layers. This is more powerful than tab toggles because it allows sharing the *evidence* (t12, platform comps) without sharing the *bet* (override assumptions). It also preserves the audit trail: the recipient can see that the sponsor overrode the broker's rent assumption, but not what the override value was (if that's the filter policy).

**Implications:** Build the `deal_capsules` table and snapshot service. Implement AES encryption + shortcode. But the core innovation is the layer-filter permission model, not the encryption. The layer filter is what makes the capsule "institutional grade" — it enables sharing evidence without sharing thesis, which is what LPs want.

**Confidence:** High

---

## SUMMARY: 10 INSIGHTS, 1 STRATEGIC NARRATIVE

The deep research reveals that JediRe's Deal Capsule concept is **architecturally correct but implementationally incomplete**. The spec gets the hard problems right:

1. ✅ **LayeredValue assumption transparency** — no competitor has this at the field level
2. ✅ **Lane A/B scope guard** — legally necessary for licensed data
3. ✅ **Single-source stabilization marker** — prevents the silent divergence failure mode
4. ✅ **Two data planes** (DISPLAY vs. ASSUMPTION) — matches institutional LP requirements
5. ✅ **Two libraries** (Documents vs. Data) — correct separation of concerns

But the implementation has 50 gaps, 5 P0 structural bugs, and several critical missing pieces:

1. ❌ **No MCP/A2A formalization** — agents are wired ad-hoc, not via standard protocols
2. ❌ **No role-based views** — all users see the same tabs, same data
3. ❌ **No `deal_capsules` table** — sharing is a UI mock, not a backend feature
4. ❌ **No `scope_id` column** — Lane A/B guard cannot be enforced
5. ❌ **No Excel export** — the institutional standard output is missing
6. ❌ **No authority matrix / HITL** — autonomous underwriting without governance
7. ❌ **1D `DealType` instead of 2D** — loses use-specific schema information

**The unified recommendation:** Fix the 5 P0 structural bugs first, then build the 7 missing institutional-grade features in priority order. The market opportunity ($12.8B → $32B) is real, the competitive gap is wide, and the spec's architecture is genuinely differentiated. But the clock is ticking — platforms like Smart Bricks, Dealpath AI, and Apers are moving fast.

---

*End of Phase 4-6 Synthesis. Ready for Phase 7: Reconciliation with code audit findings.*
