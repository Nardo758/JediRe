# REPLIT DIAGNOSTIC — RENT ROLL vs UNIT MIX TAB SOURCE OF TRUTH

## Why this audit

The Cash Flow Agent's tool orchestration map references `fetch_rent_roll` for unit-level data. Separately, the platform has a Unit Mix tab that displays per-floor-plan aggregated data to the sponsor and accepts overrides.

It's unclear whether:

1. The agent reads from the raw rent roll source document, ignoring the Unit Mix tab entirely
2. The agent reads from the Unit Mix tab, treating it as the canonical aggregated view
3. The agent reads from both inconsistently, with some tools pointing to one and other tools pointing to the other

The answer determines two downstream design decisions that are currently in flight:

- **The Floor-Plan Grid for GPR** (UI Spec v1.2, Section 5.1) requires per-floor-plan unit counts, current market rents, and comp ceilings. Whichever source the agent reads from is what flows into the grid.
- **The Other Income Reasoning Method spec** (Method 3 specifically) relies on rent roll ancillary detail for per-category breakdown. The spec assumes raw rent roll, but if the agent actually reads the Unit Mix tab, Method 3 may not work as specified.

A 20-minute code audit unblocks both. Without it, downstream specs are building on an unverified assumption.

---

## Phase 1 — Locate the tool implementations

For each of the tools below, find the implementation file, capture the function signature, and document what data shape it returns.

### Required findings per tool

For each tool: file path, line range, return type, source of returned data, presence/absence of Unit Mix tab integration.

### Tools to audit

1. **`fetch_rent_roll`** — definitely exists per the v3 prompt patch orchestration map. Find the implementation. Document:
   - Where does the data come from? (raw rent roll parser output, deal_capsule, deal_assumptions, somewhere else?)
   - Does it return per-row rent roll detail, or aggregated unit-mix data, or both?
   - If both: what is the data shape that distinguishes them?

2. **`fetch_unit_mix`** — may or may not exist. Search for any tool with a name containing `unit_mix`, `unit mix`, `floor_plan`, `floor plan`, or `unitmix`. Document:
   - Does this tool exist?
   - If yes, what does it return?
   - If yes, is it called from any agent (Cash Flow Agent, Zoning Agent, Supply Agent, Research Agent)?
   - If no, confirm — agent has no programmatic way to read the Unit Mix tab's aggregated state.

3. **`fetch_data_matrix`** — the agent's Phase 1 first tool call. Document:
   - Does its return shape include unit mix data?
   - Does its return shape include rent roll data?
   - If both: are they distinct or merged?

4. **`fetch_owned_asset_actuals`** — used for comparable owned-portfolio data. Document:
   - Does it return rent-roll-equivalent detail for the comparable assets, or only aggregates?
   - This is relevant for adoption rate sourcing in Method 1 / Method 3 of the Other Income spec.

### Output format for Phase 1

```json
{
  "phase": 1,
  "tools_audited": [
    {
      "tool_name": "fetch_rent_roll",
      "file_path": "<path>",
      "line_range": "<start-end>",
      "return_type_signature": "<typescript>",
      "data_source": "<where data comes from>",
      "returns_raw_rent_roll": <boolean>,
      "returns_unit_mix_aggregates": <boolean>,
      "notes": "<observations>"
    }
    // ... one entry per tool
  ]
}
```

---

## Phase 2 — Trace the Unit Mix tab data path

The Unit Mix tab is a UI surface. Its data comes from somewhere and goes somewhere. Trace both directions.

### Required findings

1. **Where does the Unit Mix tab read its data from?**
   - Direct from rent roll parser output?
   - From a transformed/aggregated state stored separately?
   - From `deal_assumptions` or `deal_capsule` with a specific JSONB path?
   - Document the file path and the read pattern.

2. **When the sponsor edits a cell in the Unit Mix tab (e.g., reclassifies a unit as non-revenue, adjusts floor plan grouping, overrides market rent), where does that change land?**
   - Same `deal_assumptions.year1` location as other overrides?
   - A separate `unit_mix_overrides` JSONB?
   - A separate table?
   - Does it trigger a re-run of any parser or seeder?

3. **What is the read path the Pro Forma surface uses for unit count, unit mix, and per-floor-plan rents?**
   - Does the Pro Forma read from the rent roll source data?
   - From the Unit Mix tab's overridden state?
   - From a third source?

4. **Is there a sync mechanism between sponsor overrides in the Unit Mix tab and the agent's view of unit data?**
   - When the sponsor changes the Unit Mix tab, does the next agent run see the override?
   - If no, the agent's underwriting can drift from the displayed Unit Mix on the same deal.

### Output format for Phase 2

```json
{
  "phase": 2,
  "unit_mix_tab_read_source": "<file path + read pattern>",
  "unit_mix_tab_write_destination": "<file path + JSONB path or table>",
  "proforma_surface_read_source_for_unit_data": "<file path + read pattern>",
  "sync_to_agent": {
    "mechanism": "<description or 'none found'>",
    "agent_sees_overrides": <boolean>,
    "evidence": "<code reference>"
  }
}
```

---

## Phase 3 — Classify the architecture

Based on Phase 1 and Phase 2 findings, classify the platform's current state into one of four scenarios:

### Scenario A — Clean separation, rent roll is source-of-truth
- Agent reads raw rent roll via `fetch_rent_roll`
- Unit Mix tab is a UI presentation; reads from the same rent roll data and renders it
- Sponsor overrides in the Unit Mix tab land in a designated override location
- Agent's next run reads the overrides via `fetch_rent_roll` (which is rent-roll-and-overrides-merged)
- **No divergence.** Floor-plan grid spec works as-is. Other Income Method 3 works as-is.

### Scenario B — Clean separation, Unit Mix tab is source-of-truth
- Agent reads aggregated Unit Mix data (via `fetch_rent_roll` or a separate tool)
- Raw rent roll is parsed once at ingestion, transformed into Unit Mix shape, and the agent never sees the raw rows
- Sponsor overrides land in the Unit Mix tab's canonical state
- **No divergence at the platform level, but Method 3 of Other Income spec needs revision** — the agent doesn't have raw per-unit ancillary detail; it has aggregated unit-mix data.

### Scenario C — Mixed sources, inconsistent
- Some agent tools read from raw rent roll; others read from Unit Mix tab aggregates
- Sponsor overrides in the Unit Mix tab may or may not propagate to all agent tools
- **Divergence problem.** Floor-plan grid output may not match the Unit Mix tab. Method 3 partially works. Worth fixing structurally before more specs ship on top.

### Scenario D — No real Unit Mix tab integration; the tab is decorative
- The Unit Mix tab reads its data from the rent roll source but writes nowhere durable
- Sponsor edits are lost on refresh or are visual-only
- **Divergence is a feature** — agent ignores the tab because the tab doesn't change anything

### Output format for Phase 3

```json
{
  "phase": 3,
  "scenario": "A | B | C | D",
  "scenario_rationale": "<why this scenario fits the evidence from Phase 1 and 2>",
  "implications_for_floor_plan_grid_spec": "<does the spec still work as-is, or does it need revision>",
  "implications_for_other_income_method_3": "<does Method 3 still work as-is, or does it need revision>",
  "implications_for_sponsor_override_flow": "<do sponsor overrides reach the agent>"
}
```

---

## Phase 4 — Recommendation

Based on the classified scenario, recommend the path forward:

### If Scenario A
No changes needed. Confirm that the floor-plan grid spec and Method 3 of Other Income reasoning will work correctly. Proceed.

### If Scenario B
The floor-plan grid spec needs revision — the agent doesn't have raw rent roll detail, so the grid must be sourced from the Unit Mix tab's aggregated state. Method 3 of Other Income reasoning needs revision — per-category ancillary detail isn't available at unit level; needs to be sourced from another channel (rent roll memo fields, owned-portfolio, etc.) or Method 3 falls back to a hybrid Method 1+2 approach.

### If Scenario C
This is a real bug class — the agent's view of unit data drifts from the displayed Unit Mix tab. Two fixes possible:
1. **Make the agent read from the Unit Mix tab consistently** — change `fetch_rent_roll` to return Unit Mix tab data, deprecate any tool that reads raw rent roll
2. **Make the Unit Mix tab a pure presentation layer** — store sponsor overrides in `deal_assumptions` where the agent can read them, and have the Unit Mix tab render from the same source the agent uses

Recommend option 2 — the agent's source-of-truth should be the same as the operator's source-of-truth. Asymmetry here is the same bug class as the `_continueRun` vs `run()` issue from Task #824.

### If Scenario D
The Unit Mix tab needs to either become functional (overrides propagate) or be removed. Either way, the floor-plan grid spec cannot rely on the tab's state.

### Output format for Phase 4

```json
{
  "phase": 4,
  "recommendation": "<one of A / B-revise / C-fix / D-decide>",
  "specific_changes_needed": [
    {
      "spec_or_code": "<which spec or code file>",
      "change_summary": "<what to change>",
      "blocking": <boolean>
    }
  ],
  "blast_radius": "<which deals/code paths are affected>"
}
```

---

## Phase 5 — Output

Save findings to two files:

1. `/tmp/unit_mix_audit_findings.json` — the structured output from Phases 1-4
2. `/tmp/unit_mix_audit_summary.md` — a human-readable summary under 800 words covering:
   - Scenario identified
   - Key evidence (3-5 code references)
   - Implications for floor-plan grid and Other Income Method 3
   - Recommended changes
   - Time to fix if changes needed

---

## What to do if the audit reveals something unexpected

The four scenarios cover the patterns I anticipate. If the actual architecture doesn't fit any of them:

1. Document the actual pattern observed with code evidence
2. Identify what's structurally novel about it
3. Surface as a "Scenario E" with description
4. Recommend next steps based on what's actually there

Honest "I found something the audit didn't anticipate" is more valuable than forcing the architecture into one of the four predefined scenarios.

---

## Success criteria

1. Every tool in Phase 1 is audited with code evidence
2. The Unit Mix tab read and write paths are documented with code references
3. Phase 3 classifies the platform into one of the four scenarios (or Scenario E if novel)
4. Phase 4 has a specific recommendation with concrete changes if needed
5. JSON and markdown outputs are produced
6. No vague recommendations — every claim has a file path and line number

The audit is complete when Phase 5 outputs exist. Estimated time: 20-30 minutes.

---

## What this unblocks

Once findings exist, three downstream items become clear:

1. **The Floor-Plan Grid build in M09** — Phase 2 of the UI v1.2 build plan can proceed with confidence about which source the grid reads from
2. **The Other Income Reasoning Method spec rollout** — Method 3's reliance on rent roll detail is either confirmed or needs revision
3. **The Unit Mix tab sponsor override flow** — if Scenario C is identified, fixing it becomes the gate on consistent agent behavior

Until findings exist, all three are blocked on an unverified assumption. The audit is the unblock.
