# PRO FORMA MATH DISPLAY AUDIT — 464 BISHOP

## The setup

The math engine v1.1 is deployed and integrated. The post-processor runs `correctSnapshotMath` and snapshots are persisting with `was_math_corrected: true`. The validation report on the snapshot shows the math engine corrected subtotals to their proper values.

**Despite this, the Pro Forma displayed on the 464 Bishop deal still shows wrong math.**

This means the math engine is doing its job. The bug lives **between the corrected snapshot and the user's screen**. The audit's purpose is to find exactly where the corrected values are getting lost, ignored, overwritten, or recomputed wrong downstream.

This is not a "find the math bug" audit. It is a "find why the fix isn't reaching the user" audit. Treat it as a data flow trace.

---

## PHASE 1 — CAPTURE THE EVIDENCE

Pull these artifacts from production for 464 Bishop. Save each with a timestamp.

### A. The corrected snapshot from the database

```sql
SELECT
  id,
  deal_id,
  created_at,
  was_math_corrected,
  math_validation_report,
  broker_column,
  t12_column,
  platform_column,
  resolved_column,
  prompt_version,
  agent_run_id
FROM deal_underwriting_snapshots
WHERE deal_id = '<464_bishop_deal_id>'
ORDER BY created_at DESC
LIMIT 5;
```

Save the top result as `01_db_snapshot.json`. Confirm:
- `was_math_corrected: true`
- `math_validation_report.summary.total_critical: 0` after correction
- `resolved_column` contains the corrected subtotal values (Base Rental Revenue ≈ $3,567,362, Total OpEx ≈ $1,873,015, NOI ≈ $2,021,935, etc.)

If `was_math_corrected: false` or critical findings remain, the engine did not actually correct this snapshot — the bug is upstream of the engine, not downstream. Stop and surface this.

### B. The API response that serves this snapshot to the frontend

Hit the production endpoint that the Pro Forma page calls. Likely something like `GET /api/deals/:dealId/proforma` or `GET /api/snapshots/:snapshotId`. Save the raw JSON response as `02_api_response.json`.

Compare `02_api_response.json` against `01_db_snapshot.json`:

- Are the resolved subtotal values identical?
- Are there any transformations between DB shape and API shape? (e.g., does the API rename `resolved_column` to `resolved` or flatten `proforma_fields`?)
- Is there a `Cache-Control` header on the response? Is `Age` non-zero?
- Does the API response carry `was_math_corrected` through, or is that flag dropped?

### C. The frontend state at render time

Open 464 Bishop in the production UI. Open browser dev tools. Capture:

- The Network tab response for the Pro Forma API call (should match `02_api_response.json`)
- The Zustand store state at render time. Run in the console:
  ```js
  // Adjust import path to match production
  const store = window.__JEDI_STORE__ || (await import('/path/to/dealStore.ts')).default;
  console.log(JSON.stringify(store.getState().proforma, null, 2));
  ```
  Save as `03_frontend_store.json`.
- The actual rendered DOM values for the Pro Forma cells. For each subtotal row (Base Rental Revenue, EGI, Controllable OpEx, Non-Controllable OpEx, Total OpEx, NOI, NOI After Reserves), capture:
  - The text content shown to the user
  - The data attributes on the cell element
  - The source path the cell is bound to in React DevTools

  Save as `04_rendered_dom.json`.

### D. The component code paths

Identify and capture:

- The component responsible for rendering each subtotal row (likely `<ProFormaRow>` or `<SubtotalRow>`)
- The selector or hook the component uses to read the value (e.g., `useDealStore(state => state.proforma...)`)
- Any computation that happens between the store value and the rendered display

Save relevant code snippets as `05_render_code.md` with file paths and line numbers.

---

## PHASE 2 — RUN THE FIVE HYPOTHESES

For each of the five candidate failure modes, run the specific check below. Document pass/fail for each.

### Hypothesis 1 — UI reads a different field than the engine writes to

The math engine writes to specific field paths (e.g., `proforma.opex.total.value_numeric`). The UI may render from a sibling field that wasn't updated.

**Check:**

```
From 03_frontend_store.json, find the value for 'proforma.opex.total' (or whatever path the UI binds to).
Compare to the corrected value in 01_db_snapshot.json.

If frontend store shows the wrong value but the API response (02) shows the right value:
  -> The bug is in the store hydration logic. The store has a transform/normalize step that's losing the correction.

If frontend store and API response both show the correct value but the rendered DOM (04) shows the wrong value:
  -> The bug is in the rendering component. There's computation between store and render.

If frontend store shows the wrong value AND the API response (02) shows the wrong value:
  -> Bug is in the API layer, not the frontend. Go to Hypothesis 3.
```

**Specific paths to check:**

| Subtotal | Engine writes to | UI may be reading from |
|----------|------------------|------------------------|
| Base Rental Revenue | `proforma.revenue.base_rental_revenue` | also check: `proforma.base_rental`, `proforma.gross_rental_revenue`, `revenue.base_rental` |
| EGI | `proforma.revenue.egi` | also check: `proforma.egi`, `revenue.egi`, `proforma.effective_gross_income` |
| Total OpEx | `proforma.opex.total` | also check: `proforma.total_opex`, `opex.total`, `proforma.expenses.total` |
| NOI | `proforma.noi` | also check: `proforma.net_operating_income`, `noi`, `proforma.below_line.noi` |

If the UI is bound to a legacy path that doesn't match the engine's canonical paths, that's the bug.

### Hypothesis 2 — A second computation layer in the UI is recomputing subtotals

The most insidious failure mode. UI fetches leaf values, computes subtotals client-side, ignores the stored subtotal entirely.

**Check:**

In `05_render_code.md`, look for any component that does inline computation like:

```js
// SMOKING GUN — recomputing subtotals client-side
const totalOpex = controllableOpex + nonControllableOpex;
const noi = egi - totalOpex;

// OR
const baseRentalRevenue = gpr - lossToLease - vacancyLoss - concessions - badDebt;

// OR (worse — wrong sign handling)
const baseRentalRevenue = [gpr, lossToLease, vacancyLoss, concessions, badDebt].reduce((a, b) => a + b, 0);
```

If found:
- The math engine's correction is invisible to the user because the UI ignores it
- The fix is to delete the client-side computation and use the stored subtotal directly
- Document the exact file, line, and computation

Search the frontend codebase for these patterns. Specific search terms:
- `egi`, `noi`, `base_rental`, `total_opex` followed by `=` or `:` in a computation context
- `reduce(`, `sum(`, mathematical operators applied to revenue/opex variables
- Hook return values that include computed totals

Report any client-side subtotal computation found, with file + line + the exact computation.

### Hypothesis 3 — API caching serving stale values

Snapshot was corrected in the DB but the API response is stale.

**Check:**

- Fetch the API endpoint twice with `Cache-Control: no-cache` header
- Compare response payloads
- If responses match but display is wrong, caching is not the issue
- If responses differ, the API layer is caching

Also check:
- CDN caching headers on the response
- Any in-process caching in the API server (Redis, in-memory)
- The `Age` header on the response

If caching is identified:
- Document the cache layer and its TTL
- Document how to invalidate (e.g., new snapshot write should invalidate; if it doesn't, that's the bug)

### Hypothesis 4 — The agent overwrites corrected values on subsequent runs

The post-processor's correction may run only on initial snapshot write but not on re-runs (user override, refresh, assumption change).

**Check:**

Look at the agent_runs table for 464 Bishop:

```sql
SELECT
  ar.id,
  ar.created_at,
  ar.prompt_version,
  ar.trigger_source,  -- 'initial' | 'user_override' | 'refresh' | etc.
  s.was_math_corrected,
  s.math_validation_report->'summary'->>'total_critical' as critical_count
FROM agent_runs ar
JOIN deal_underwriting_snapshots s ON s.agent_run_id = ar.id
WHERE ar.deal_id = '<464_bishop_deal_id>'
ORDER BY ar.created_at DESC;
```

If the latest snapshot for 464 Bishop has `was_math_corrected: false`, this is likely the bug. Path:
- Initial run: post-processor corrected, snapshot has right values
- User overrode a cell or triggered a re-run
- Re-run post-processor either skipped correction, or the correction logic didn't fire
- Stale corrected values were overwritten by new uncorrected values

Document:
- Which run is the latest
- Whether the post-processor's `correctSnapshotMath` invocation is conditional on `trigger_source`
- Whether re-runs go through the same post-processor path or a separate, lighter path that bypasses correction

### Hypothesis 5 — Store-as-message-bus drift

Per the architecture, `dealStore.ts` is the single source of truth. If a Pro Forma component bypasses it and reads from a different source, the corrected values never reach render.

**Check:**

In `05_render_code.md`, verify every Pro Forma component reads from `dealStore.ts` (or whatever the canonical store is). If any component:
- Directly imports from another module
- Reads from a context provider that wraps the store
- Has its own local state that mirrors but doesn't subscribe to the store
- Uses `useState` to hold a value that should come from the store

— that's a candidate failure point.

Document any components that don't read from the canonical store.

---

## PHASE 3 — TRACE THE SPECIFIC WRONG VALUE END TO END

Pick the most obviously wrong subtotal — likely Total OpEx (was $3.13M, should be ~$1.87M). Trace its journey:

1. **DB value:** What does the DB store have for `proforma.opex.total` (or whatever path) in the resolved column?
2. **API value:** What does the API response return for the same path?
3. **Store value:** What does `dealStore.getState()` show?
4. **Component prop:** What value does the `<ProFormaRow>` component receive as a prop?
5. **Render value:** What does the DOM show?

Build a table:

| Layer | Path/Selector | Value | Matches Expected? |
|-------|---------------|-------|-------------------|
| DB (resolved_column) | proforma.opex.total | ? | ? |
| API response | data.proforma.opex.total | ? | ? |
| Zustand store | state.proforma.opex.total | ? | ? |
| Component prop | row.value | ? | ? |
| Rendered DOM | textContent | ? | ? |

The layer where the value first diverges from the corrected value is the bug site. The audit's job is to identify that layer with specificity.

---

## PHASE 4 — STRUCTURED OUTPUT

Produce a JSON file at `/tmp/proforma_display_audit_464_bishop_{timestamp}.json`:

```json
{
  "audit_id": "string",
  "deal_id": "464_bishop",
  "timestamp": "ISO8601",
  "snapshot_id_audited": "string",

  "phase_1_evidence_captured": {
    "db_snapshot": "01_db_snapshot.json saved at: <path>",
    "api_response": "02_api_response.json saved at: <path>",
    "frontend_store": "03_frontend_store.json saved at: <path>",
    "rendered_dom": "04_rendered_dom.json saved at: <path>",
    "render_code": "05_render_code.md saved at: <path>"
  },

  "phase_2_hypothesis_results": {
    "h1_ui_reads_wrong_field": {
      "tested": true,
      "passed": boolean,  // true if no issue found
      "findings": "string",
      "evidence": "string"
    },
    "h2_client_side_recomputation": {
      "tested": true,
      "passed": boolean,
      "findings": "string",
      "evidence": "string (specific file + line + code)"
    },
    "h3_api_caching": {
      "tested": true,
      "passed": boolean,
      "findings": "string",
      "evidence": "string"
    },
    "h4_agent_overwrites_on_rerun": {
      "tested": true,
      "passed": boolean,
      "findings": "string",
      "evidence": "string (agent_runs query results)"
    },
    "h5_store_bypass": {
      "tested": true,
      "passed": boolean,
      "findings": "string",
      "evidence": "string"
    }
  },

  "phase_3_value_trace": {
    "tracked_field": "proforma.opex.total",
    "expected_value": 1873015,
    "trace": [
      {"layer": "db", "path": "...", "value": 0, "matches": false},
      {"layer": "api", "path": "...", "value": 0, "matches": false},
      {"layer": "store", "path": "...", "value": 0, "matches": false},
      {"layer": "component_prop", "path": "...", "value": 0, "matches": false},
      {"layer": "dom", "path": "...", "value": 0, "matches": false}
    ],
    "divergence_layer": "string (which layer first showed wrong value)"
  },

  "root_cause": {
    "hypothesis_confirmed": "h1 | h2 | h3 | h4 | h5 | other",
    "description": "string",
    "file_path": "string",
    "line_number": number,
    "explanation": "string (why this causes the symptom)"
  },

  "recommended_fix": {
    "summary": "string",
    "specific_changes": [
      {
        "file": "string",
        "current_code": "string",
        "proposed_code": "string",
        "rationale": "string"
      }
    ],
    "test_to_verify": "string (specific manual or automated test that confirms the fix worked)"
  },

  "blast_radius": {
    "other_deals_likely_affected": "string (all deals, only specific ones, etc.)",
    "other_fields_likely_affected": ["string"],
    "remediation_for_existing_bad_displays": "string"
  }
}
```

---

## PHASE 5 — MARKDOWN SUMMARY

Save `/tmp/proforma_display_audit_464_bishop_summary_{timestamp}.md`:

1. **Headline finding** — one sentence on the root cause
2. **The value trace** — the table from Phase 3 showing where the value first diverges
3. **The fix** — what to change, where, and how to verify
4. **Blast radius** — what else this affects
5. **Time to fix** — small (hours), medium (1-2 days), large (architectural)

Under 800 words. The JSON is the operational data; the markdown is the executive read.

---

## WHAT TO DO IF NONE OF THE FIVE HYPOTHESES MATCH

If all five hypothesis checks pass (i.e., none found to be the cause), the bug is somewhere this audit didn't anticipate. In that case:

1. Document each hypothesis check with the evidence showing it's not the cause
2. Surface the unexpected pattern — what is the value at each layer, and what doesn't fit the five candidate failure modes?
3. Generate three new hypotheses based on the observed pattern
4. Run those checks the same way (capture evidence, document pass/fail)
5. Surface findings to the team for triage

Do not invent a "probable" root cause without evidence. An honest "I checked these five paths, none match, here's the unexpected pattern" is more useful than a confidently-wrong diagnosis.

---

## WHAT TO DO IF THE VALUES IN THE DB ARE WRONG

If Phase 1.A shows the DB resolved_column already has wrong subtotal values (despite `was_math_corrected: true`), the math engine has a bug. This is a different audit. Stop and:

1. Document the discrepancy between `math_validation_report` and the actual stored values
2. Check whether the post-processor writes the corrected snapshot to the DB or whether it writes the original snapshot with the validation_report attached as metadata
3. This is a critical engine integration bug — surface immediately

---

## SUCCESS CRITERIA

The audit is complete when:

1. All five hypotheses are tested with documented evidence
2. The value trace shows the exact layer where the corrected value first diverges from what the user sees
3. The root cause is identified with file path and line number
4. The recommended fix has specific code changes (current vs proposed)
5. The blast radius is characterized — same deal only, all deals, only specific fields
6. A verification test is named that will prove the fix worked

Do not produce vague findings. Every claim has evidence. Every recommendation has a file path.
