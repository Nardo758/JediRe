# Proforma Tab Extensibility Investigation

**Date:** 2026-05-26
**Scope:** Audit what exists today around F9 proforma tab extensibility and evaluate compatibility with a two-layer Calculations/Assumptions architecture.

---

## 1. What User-Tab Features Exist Today

The feature is fully built and live. It is called the **Custom Tabs system** (Task #451) and is implemented end-to-end across backend schema, validation, storage, REST API, and frontend renderer.

### How a user creates a tab

There is **no "+" or "Add Tab" button** in the F9 UI. Custom tabs are created exclusively by chatting with **Opus** (the Claude-backed AI assistant panel embedded in the F9 financial engine page). The user types a request in natural language — e.g. "Create a waterfall distribution tab" — and Opus generates the tab definition and persists it automatically.

Internally, Opus emits a `customtab` fenced JSON block inside its chat response. The backend streaming handler detects this fence, validates it through a strict server-side validator, and persists it on success. The new tab appears immediately in the F9 tab strip.

**Discovery mechanism:** When a user has no custom tabs yet, three auto-surfaced quick prompts appear in the Opus panel:
- "Create a custom analysis tab"
- "Build a waterfall summary view"
- "Add a capital structure breakdown"

### What the tab strip looks like

`[OVERVIEW] [DEAL TERMS] [PROFORMA] [PROJECTIONS] [RETURNS] [DEBT] [INVESTORS] [ROADMAP] ✦ CUSTOM-TAB-1 ✦ CUSTOM-TAB-2 …`

Built-in tabs always come first. Custom tabs are appended at the end, each prefixed with a purple `✦` symbol.

### Full CRUD available

| Operation | How it is triggered |
|---|---|
| Create | Opus chat — `customtab` fence detected in streaming response |
| Refresh (regenerate) | Opus chat — `refresh_custom_tab` action; or frontend refresh button on the tab |
| Rename | Inline rename via context menu on the custom tab label |
| Replace (full payload swap) | Opus chat — PATCH with new payload |
| Delete | Opus chat — `delete_custom_tab` action; or frontend delete button |

---

## 2. Architectural Model of Custom Tabs

### Tab definition format

Each custom tab is a **`CustomTabPayload`** — a structured JSON object containing:

```
{
  tabId: string,          // stable slug, e.g. "waterfall_summary"
  title: string,          // ≤80 chars
  description?: string,   // optional one-liner shown above blocks
  blocks: Block[],         // ordered list, up to 20
  generationPrompt?: string,
  modelVersion?: string
}
```

### The five block types

| Block type | What it renders |
|---|---|
| `markdown` | Text with `{{dot.path}}` inline value placeholders resolved at render time |
| `kpi_tile` | Single large KPI metric with optional comparison delta |
| `table` | Tabular view — up to 12 columns, 60 rows |
| `ratio_bar` | Horizontal progress bar with numerator/denominator refs and optional benchmark marker |
| `line_chart` | SVG polyline chart with primary + optional comparison series |

### How blocks reference data

Every value a block displays is addressed via a **dot-path field reference** validated against a hardcoded server-side catalog of 22 allowed patterns across 5 logical data surfaces:

| Surface prefix | What it resolves to |
|---|---|
| `assumptions.*` | User-editable inputs (10 refs: purchasePrice, exitCapRate, holdPeriod, ltv, interestRate, loanType, revenue.rentGrowth, revenue.vacancy, opex.expenseGrowth, units) |
| `results.summary.*` | Computed return metrics (5 refs: irr, equityMultiple, cashOnCash, noi, dscr) |
| `f9.proforma.year1[*].*` | Per-P&L-line year-1 values across broker/platform/t12/rentRoll/resolved/perUnit/benchmarkPosition slots (9 refs) |
| `projections[*].*` | Multi-year time-series array (3 refs: year, noi, revenue) |
| `deal.*` | Deal metadata (4 refs: name, address, city, units) |

Any reference outside the catalog is **hard-rejected** at the server. The validator runs Levenshtein distance over all catalog patterns and surfaces a "did you mean?" suggestion in the Opus chat thread when a reference is unknown.

### Key architectural characteristics

- **AI-authored, not user-authored.** The user describes intent in natural language; Opus decides block types and field refs. There is no formula editor, drag-and-drop canvas, or layout tool exposed to the user.
- **Declarative, not procedural.** Blocks declare *what data to display*, not *how to compute it*. All values come from pre-computed surfaces.
- **Read-only renderer.** `CustomTabRenderer.tsx` is explicitly documented as read-only by design. Blocks cannot mutate assumptions.
- **Provenance-aware.** Every rendered value carries a provenance badge (source label, confidence %, quality flag colour) sourced from the same `evidenceFieldMap` used by built-in F9 tabs.
- **User-scoped.** Tabs are keyed by `(deal_id, user_id, tab_id)` — each user sees their own set of custom tabs for a given deal.

---

## 3. Storage for User-Defined Tab Configurations

### Primary table: `deal_custom_tabs`

Created at runtime via `ensureCustomTabsTable()` (not a formal migration file — follows the same pattern as `opus_proforma_rejected_payloads`).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `deal_id` | TEXT | |
| `user_id` | TEXT | Authenticated session identity; falls back to `deal:<id>` in unauthenticated environments |
| `tab_id` | TEXT | Slug matching `/^[a-z0-9_-]{1,64}$/` |
| `title` | TEXT | |
| `description` | TEXT | nullable |
| `payload` | JSONB | Full `CustomTabPayload` |
| `generation_prompt` | TEXT | The Opus prompt that produced this tab |
| `model_version` | TEXT | e.g. `claude-sonnet-4-5` |
| `conversation_id` | INT | FK to `opus_conversations` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Uniqueness constraint: `UNIQUE (deal_id, user_id, tab_id)` — refresh/replace is an upsert, replacing the payload in-place.

### Secondary: `opus_proforma_versions`

Stores full proforma data snapshots tied to named "Save Version" actions. These are distinct from custom tabs — they capture the full assumptions + results at a point in time for version comparison, not user-defined views.

### No per-user layout tables

There is no table for column preferences, row ordering, or display configuration outside the tab's `payload` JSONB. Layout is entirely self-contained in the stored payload.

---

## 4. Compatibility with a Two-Layer Calculations/Assumptions Split

### What the two-layer model means

- **Layer A (Assumptions):** user-editable inputs — purchase price, cap rates, hold period, LTV, rent growth, expense growth, etc.
- **Layer B (Calculations):** computed outputs derived from Layer A — NOI, IRR, CoC, DSCR, annual cash flows, projections, waterfall distributions, etc.

### How the current system maps to that split

The field catalog already enforces this boundary:

| Catalog surface | Maps to |
|---|---|
| `assumptions.*` (10 refs) | **Layer A** — user-editable inputs |
| `results.*`, `f9.*`, `projections.*` (17 refs) | **Layer B** — computed outputs |
| `deal.*` (4 refs) | Deal metadata — outside either layer |

The renderer is already read-only, meaning custom tabs can *display* Layer A values alongside Layer B values but cannot write to either. This is consistent with Layer A being owned exclusively by the assumptions editor.

### Compatibility verdict: **Compatible, with one structural gap**

**What is compatible as-is:**
- The catalog surface split already mirrors the Calculations/Assumptions boundary precisely
- Provenance badges render correctly on values from both layers
- Opus can already author tabs that juxtapose assumption inputs against calculated outputs (e.g., a `kpi_tile` for `assumptions.exitCapRate` next to one for `results.summary.irr`)
- The read-only renderer requires no changes under a two-layer model
- The `deal_custom_tabs` storage schema is layer-agnostic — it stores the payload and resolves values at render time

**The structural gap:**
There is no mechanism for a custom tab to express a **user-defined calculation** — for example, a custom ratio like NOI / purchase price that is not already a pre-computed entry in the catalog. All blocks reference pre-computed values; there is no formula layer. If the two-layer architecture intends to allow users to author their own intermediate calculations in Layer B, that would require:

1. A new block type (e.g. `formula_cell`) with an expression grammar
2. A server-side formula evaluator over catalog refs
3. Expansion of the catalog to permit arithmetic expressions referencing existing entries

This is **not currently scoped or built.** The system today is strictly a display layer over pre-computed surfaces.

---

## 5. Summary

| Question | Answer |
|---|---|
| Does a user-tab feature exist? | Yes — fully built and live (Task #451) |
| How are tabs created? | Exclusively via Opus AI chat; no manual "+" button |
| Are they predefined templates? | No — Opus generates unique block layouts per request |
| Are they formula-based? | No — declarative field refs only, no user-authored calculations |
| Where are they stored? | `deal_custom_tabs` table, keyed by `(deal_id, user_id, tab_id)` |
| Architectural model | AI-authored declarative view layer (Approach: AI-generates layout) |
| Compatible with Calculations/Assumptions split? | Yes for display; gap exists if user-authored formulas are required in Layer B |
