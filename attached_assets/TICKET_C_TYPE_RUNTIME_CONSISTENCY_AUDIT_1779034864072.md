# TICKET C — TYPE-RUNTIME CONSISTENCY AUDIT

**Priority:** High
**Estimated effort:** 1-2 focused sessions for audit; remediation effort variable based on findings
**Type:** Architecture audit + remediation
**Sibling/source:**
- Task #824 (surfaced `_continueRun` postProcess bypass)
- Tickets A & B (codepath consistency + seeder write pattern)
- Unit Mix Source Audit (surfaced `floorPlanMix` and `otherIncomeMonthly` hydration gaps)

This is the third ticket in a series that collectively addresses the platform's recurring **silent failure mode** pattern. A and B fix two confirmed instances. This audit finds the rest.

---

## Context

Five distinct silent failures have been confirmed in production over the past three weeks:

1. **`_continueRun` silently bypassed `postProcess`** (Task #824) — fixed in #824
2. **proforma-seeder silently clobbered agent contributions** via full-replace UPDATE (Task #824 deferred, now Ticket B)
3. **`jsonb_set` silently failed for missing intermediate keys** (Task #824) — fixed in #824
4. **`floorPlanMix` declared in TypeScript but never hydrated at runtime** (unit mix audit) — fixing in unit mix PR 1
5. **`otherIncomeMonthly` available in source but never mapped through hydration** (unit mix audit) — fixing in unit mix PR 1

These look like five different bugs. They are the same bug class, manifesting in different layers.

**The shared pattern: the platform's type system claims symmetry, consistency, or presence that the runtime doesn't enforce.**

- Types say `floorPlanMix` exists. Runtime doesn't populate it.
- Types say `postProcess` is part of the agent config. Runtime in one codepath doesn't invoke it.
- Types say `deal_assumptions.year1` is a coherent layered structure. Runtime in the seeder replaces it wholesale.
- Types say `otherIncomeMonthly` is a field on the extraction capsule. Runtime never maps it through hydration.
- Types say `jsonb_set` updates a JSONB path. Runtime returns null when the path's parents don't exist.

In every case, the divergence is invisible until something breaks visibly downstream. The agent reasons against undefined fields. The user-facing display drifts from the database. Operator overrides vanish on the next agent run. Decks ship with inflated numbers.

This ticket audits the codebase to find the remaining instances of this pattern before they surface as more user-visible breakage.

---

## Problem statement

Identify and remediate every instance of type-runtime divergence in the platform's data flow. Specifically:

1. Fields declared in TypeScript interfaces (or database schemas) but never assigned in any hydration, write, or transformation
2. Tools registered in agent configs but never invoked by any code path
3. JSONB structures that consumers read but no producer fully populates
4. Conditional invocations gated on truthy config values that may be silently undefined at runtime
5. Database operations (UPDATE, jsonb_set, etc.) that silently no-op on certain edge cases without error

The audit produces a categorized finding list with proof-of-divergence for each. Remediation per finding ranges from a 5-line hydration fix to architectural changes — each finding carries its own scoped remediation recommendation.

---

## Done looks like

1. A categorized finding list covering all five divergence types above
2. Per finding: file path, line numbers, divergence proof (specific code or schema mismatch), severity classification, recommended remediation, blast radius
3. Critical and major findings have remediation PRs queued
4. Informational findings are documented but don't require immediate fix
5. A regression test framework that catches at least one class of these divergences automatically (e.g., a CI check that flags TypeScript fields never assigned in the producing code)

---

## Steps

### Phase 1 — Field declaration vs runtime population (3-4 hours)

For every interface in the platform's core schemas, verify each field has at least one runtime assignment path.

**Method:**

1. List the top-level interfaces in:
   - `src/services/neural-network/data-matrix.service.ts` (DealContext-related types)
   - `src/services/proforma-*` (proforma structures)
   - `src/services/deal-capsule-*` (capsule structures)
   - `src/agents/types/*` (agent input/output types)
   - Database schemas in `migrations/` matching JSONB columns

2. For each interface field, grep the codebase for assignment patterns:
   - Direct assignment: `<field_name>:` or `.<field_name> =`
   - Destructuring assignment: `{ <field_name> }`
   - JSON merge patterns: `...{ <field_name>: ... }`
   - JSONB SQL assignment: `jsonb_set(... '{<field_name>}' ...)`

3. Classify each field:
   - **Populated**: at least one production code path assigns the field
   - **Test-only**: only test/mock code assigns the field
   - **Never populated**: no assignment exists in production code
   - **Conditionally populated**: assignment exists but is gated on conditions that may rarely fire

4. For "never populated" and "test-only" fields, identify consumers — code that reads the field. Each consumer is a potential silent-failure site.

**Output format:**

```json
{
  "phase_1_field_audit": {
    "fields_inventoried": <number>,
    "populated": <number>,
    "test_only": <number>,
    "never_populated": <number>,
    "conditionally_populated": <number>,
    "findings": [
      {
        "interface": "string",
        "field": "string",
        "declared_at": "<file:line>",
        "classification": "never_populated | test_only | conditionally_populated",
        "consumers": ["<file:line>", ...],
        "severity": "critical | major | minor | informational",
        "remediation": "<specific change>"
      }
    ]
  }
}
```

### Phase 2 — Tool registration vs invocation (1-2 hours)

Every tool registered in an agent config should be invoked by something. Unused tools are dead code at best, missed integration at worst.

**Method:**

1. List all agent configs: `src/agents/configs/*.config.ts`
2. For each config, extract the registered tools list
3. Grep the codebase for invocations of each tool name (in prompts, in code, in tests)
4. Classify each tool:
   - **Actively invoked**: production code or agent prompts reference the tool
   - **Prompt-only**: prompt mentions the tool but no test or code exercises it
   - **Dead**: no reference exists anywhere

5. For dead tools, determine: was the tool deprecated and the config not cleaned up, or was the tool intended to be invoked and the integration was forgotten?

**Output format:**

```json
{
  "phase_2_tool_audit": {
    "tools_inventoried": <number>,
    "actively_invoked": <number>,
    "prompt_only": <number>,
    "dead": <number>,
    "findings": [
      {
        "tool_name": "string",
        "registered_in": "<config file>",
        "classification": "dead | prompt_only",
        "invocation_pattern": "string (description of any references found)",
        "severity": "major | minor",
        "remediation": "<remove from config | wire into agent flow | document as informational>"
      }
    ]
  }
}
```

### Phase 3 — JSONB read/write asymmetry (2-3 hours)

For each JSONB column the platform uses, identify all read paths and all write paths. Flag asymmetries.

**Method:**

1. List JSONB columns in `deal_assumptions`, `deal_underwriting_snapshots`, `deals.deal_data`, `deal_capsules`, etc.
2. For each column, identify:
   - All read paths (selects, JSON path extractions, deserializations)
   - All write paths (inserts, updates, jsonb_set, jsonb_merge)
3. Map read paths' expected schema vs write paths' actual schema
4. Flag mismatches: fields that readers expect but writers never produce, OR fields that writers produce but readers ignore

5. Specifically check:
   - The `deal_assumptions.year1` LayeredValue structure — every consumer should read the resolved value via a central helper, not by reading raw layer values
   - The `deal_underwriting_snapshots.resolved_column` structure — verify all field paths the math engine references are actually written by either the agent or seeder
   - The `deal_capsules` structures — verify deal type, scope, strategy fields are consistently populated and read

**Output format:**

```json
{
  "phase_3_jsonb_audit": {
    "jsonb_columns_inventoried": <number>,
    "findings": [
      {
        "column": "<table.column>",
        "field_path": "<JSONB path>",
        "read_by": ["<file:line>", ...],
        "written_by": ["<file:line>", ...],
        "mismatch_type": "expected_but_never_written | written_but_never_read | schema_drift",
        "severity": "critical | major | minor",
        "remediation": "<specific change>"
      }
    ]
  }
}
```

### Phase 4 — Conditional invocation patterns (1-2 hours)

The `_continueRun` postProcess bypass was a conditional invocation pattern: `if (this.config.postProcess) { ... }` where one codepath wired the config and another didn't. Find more.

**Method:**

1. Grep for conditional invocation patterns:
   - `if (this.config\.<name>)`
   - `if (config\.<name>)`
   - `if (options\.<name>)`
   - `<name> && <name>(`

2. For each pattern, trace where the conditional value comes from. Verify it's set consistently across all entry points.

3. Specifically focus on `AgentRuntime`, `cashflowPostProcess`, capsule processors, ingestion pipelines.

**Output format:**

```json
{
  "phase_4_conditional_audit": {
    "patterns_found": <number>,
    "findings": [
      {
        "pattern": "<code snippet>",
        "file": "<file:line>",
        "config_source": "<where the conditional value comes from>",
        "verified_consistent_across_entry_points": <boolean>,
        "severity": "critical | major | minor",
        "remediation": "<specific change if needed>"
      }
    ]
  }
}
```

### Phase 5 — Silent database operation audit (1 hour)

Database operations that silently no-op are particularly insidious because they pass type-checking and return success but don't actually do what the caller intended.

**Method:**

1. Grep for `jsonb_set` calls; verify each handles the missing-intermediate-keys case explicitly (either via `create_missing => true` flag or via prior key existence check or via `||` merge pattern as a fallback)
2. Grep for UPDATE statements that match on conditions that may not exist (e.g., WHERE id = $1 where the id may not exist)
3. Grep for SET column = jsonb_set(...) patterns to find places where a failed jsonb_set silently produces a null column
4. Identify operations that should be loud (raise an error) but are currently silent

**Output format:**

```json
{
  "phase_5_silent_db_audit": {
    "operations_audited": <number>,
    "findings": [
      {
        "operation": "<SQL or function call>",
        "file": "<file:line>",
        "failure_mode": "<description of how it can silently fail>",
        "severity": "critical | major | minor",
        "remediation": "<add explicit error handling | restructure operation | etc>"
      }
    ]
  }
}
```

### Phase 6 — Regression test framework (1-2 hours)

Add at least one automated test that catches future instances of these divergences.

**Suggested test patterns:**

1. **Type-runtime field assignment lint:** a static analysis check that warns when a TypeScript field is declared but never assigned in non-test code (use ts-morph or similar AST tooling)
2. **Tool registration sanity check:** a unit test that asserts every tool in every agent config is referenced in either prompts or test fixtures
3. **JSONB schema contract test:** for each canonical JSONB column, a test that verifies the production write paths produce a schema the production read paths can consume
4. **Conditional invocation symmetry test:** automated check that asserts `_continueRun` and `run()` invoke the same set of config hooks (extends Ticket A's regression test)

At minimum, ship one of these. The others can be future enhancements.

---

## Severity classification

For each finding across all phases:

- **Critical**: actively producing user-visible wrong data right now, OR has high probability of producing wrong data on common code paths
- **Major**: latent failure mode that hasn't surfaced yet but will surface on edge cases or scale
- **Minor**: cleanup opportunity, code hygiene, dead code removal
- **Informational**: intentional patterns that look like divergences but are by design (these get inline code comments documenting the rationale)

---

## Acceptance criteria

1. All five phases complete with structured JSON output
2. Critical findings have remediation PRs queued (or applied if quick)
3. Major findings have tickets opened with priority and effort estimate
4. Minor findings are documented in a cleanup backlog
5. Informational findings have inline code comments explaining intentional behavior
6. At least one regression test framework is in place (Phase 6)
7. The full audit findings document is committed to the repository for future reference

---

## Out of scope

- Refactoring existing architecture beyond what's needed to remediate specific findings (e.g., don't redesign the LayeredValue pattern unless an audit finding directly requires it)
- Performance optimization
- New feature work
- Type system changes (e.g., switching from interfaces to runtime schema validation libraries like zod) — separate consideration

---

## Risk and rollout

The audit itself is read-only and low-risk. The remediation PRs vary:

- **Critical fixes** (e.g., missing hydration of a field that's actively consumed): ship as small focused PRs, one per finding
- **Major fixes** (latent issues): ship in batched PRs by domain (e.g., all proforma-related hydration fixes in one PR)
- **Cleanup** (dead tool removal, unused field removal): ship in a single cleanup PR at the end

For each remediation PR, include a brief description of what was silently failing and what the fix changes. Build the audit trail explicitly so future engineers understand why these changes were made.

---

## Why this matters

The five known instances of this pattern produced concrete user-visible breakage:

- Task #824 unit-mismatch bug: $145M Other Income value displayed on 464 Bishop
- Proforma-seeder clobber: agent contributions silently wiped between runs
- floorPlanMix gap: per-floor-plan reasoning broken for an unknown duration
- otherIncomeMonthly gap: Method 3 of Other Income reasoning never working as specced
- jsonb_set on missing keys: agent fields silently not written

The unknown unknowns — the divergences we haven't yet surfaced — will produce similar breakage as features grow. The audit's job is to convert unknown unknowns into known knowns, prioritize them by severity, and remediate before they ship breakage.

The pattern also has a strategic implication for the platform's positioning. JEDI RE's value proposition includes "every value carries source provenance and audit trail." Silent failure modes undermine that promise — if the platform silently writes wrong values, silently bypasses validation, silently produces undefined fields, the provenance claim becomes unverifiable in practice.

Closing this pattern is not optional work. It's part of the trust foundation the platform sits on.
