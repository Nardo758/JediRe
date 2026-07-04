---
name: deal_assumptions column shapes (per_year_overrides vs year1)
description: debt:* and other namespaced keys live in the separate per_year_overrides column, not year1 — easy to misattribute when eyeballing a combined JSON dump
---

`deal_assumptions` has both a `year1` JSONB column (LayeredValue-shaped: `{om, t12, override, platform, resolved, resolution, ...}`) and a separate `per_year_overrides` JSONB column (flat-shaped: `{year, field, value, source, resolution}`, keyed by strings like `debt:senior:loanAmount`).

**Why:** When dumping a full `deal_assumptions` row to JSON for inspection, both columns appear side by side. It's easy to assume a `debt:senior:*` key you see in the dump is nested inside `year1` when it's actually a sibling top-level column (`per_year_overrides`). Querying `year1['debt:senior:loanAmount']` directly will silently return `undefined` even though the data exists in the row.

**How to apply:** Before writing any code (test script or otherwise) that reads a namespaced (`debt:`, etc.) key from a `deal_assumptions` row, confirm which column it actually lives in via a direct `SELECT per_year_overrides FROM deal_assumptions WHERE ...` — don't infer from a merged/pretty-printed dump.
