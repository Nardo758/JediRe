# Piece C — Agent Synthesis Interface

**Status:** Partially operational (deal completeness framework shipped; full agent authorship pipeline aspirational)  
**Date:** 2026-05-30  
**Authority over:** Agent authorship of findings, deal completeness framework, operator override granularities

---

## Problem Piece C Solves

Multi-vendor market data and AI synthesis are only useful if the operator can trust what they're seeing and audit where it came from. Piece C defines how AI agents:

1. **Author** findings with source citations
2. **Signal** when inputs are missing or low-confidence
3. **Allow operators to override** at multiple granularities (field, citation, finding, confidence)

Without Piece C, agents produce outputs that look authoritative but are actually opaque — the operator can't tell if a GPR estimate came from a T-12 document, an OM, a CoStar rent survey, or a platform benchmark.

---

## Agent Authorship

### The four-layer author model

Agents author findings at four granularities:

| Granularity | What the operator can override |
|---|---|
| Field level | Pin a specific value (e.g., set GPR to $1,240/unit/mo regardless of what the agent derived) |
| Citation level | Dismiss a specific source (e.g., "ignore the OM-stated GPR, I know it's inflated") |
| Finding level | Override the agent's narrative conclusion while keeping the underlying numbers |
| Confidence level | Adjust the confidence score the agent assigned to a finding |

**Current status:** Field-level overrides are partially operational (7 fields fully wired). Citation-level, finding-level, and confidence-level overrides are aspirational — infrastructure supports them but no UI surfaces them yet.

### Agent citation requirements

For every field the cashflow agent derives, it must supply:
- The field value
- The sources consulted (T-12, OM, CoStar, platform benchmark, archive)
- The reasoning for choosing this value over alternatives
- A confidence level (high / medium / low)

These are persisted in `deal_underwriting_snapshots.evidence_json` and `deal_evidence_rows`.

---

## Deal Completeness Framework

### What it is

The deal completeness framework scores each deal's input completeness and surfaces that score to the operator. It prevents the platform from silently producing confident-looking outputs when the underlying data is sparse.

### Architecture

```
signal-registry.ts  →  completeness signals per surface
       ↓
CompletenesBadge    →  frontend component showing score + missing signals
       ↓
Operator sees what's missing and can choose to proceed or fill gaps
```

The backend signal registry (`backend/src/services/deal-completeness/signal-registry.ts`) defines which signals contribute to completeness for each surface. The frontend badge renders the result.

**Current status (per corpus-sweep audit 2026-05-31):** `signal-registry.ts` confirmed operational. Frontend CompletenesBadge exists. Full backend API path between the registry and the badge was not directly grepped in the corpus-sweep — treat as inferred pending a targeted audit. 10+ surfaces still silently degrade rather than surfacing completeness warnings (count inferred from Deal Details audit, not re-verified).

### Module-apply pattern and Piece C

The module-apply pattern (tasks #1256–#1261) — where strategy module, debt advisor, and other modules push their outputs to F9 assumptions via `POST /:dealId/assumptions/apply-from-module` — operationalizes Piece C's "operator overrides at four granularities" commitment. When a module pushes a value to F9, it writes to the field's Layer 1 override slot, which means the operator sees the module's recommendation as a pinned value they can then accept or clear.

This pattern is queued (tasks #1256–#1261) and can proceed independently of T-B1 — it doesn't depend on vendor infrastructure.

---

## Completeness Caveats in Agent Findings

The long-term target: when an agent produces a finding based on incomplete data, the finding itself carries a completeness caveat:

> "GPR estimated at $1,240/unit/mo based on CoStar rent survey only. T-12 trailing data was not available. Confidence: medium. Consider uploading T-12 to validate."

**Current status:** Aspirational. The completeness framework exists; agent authorship is not yet using it to annotate findings.

---

## License Posture Flows Through to Exports

When a finding cites a `platform_only` source (e.g., a CoStar-licensed field), that finding must not appear in client-facing exports or deal capsule shares.

**Current status:** Aspirational — tied to Piece A Phase 2C (license posture enforcement at display/export time).

---

## 6-Point Wiring Checklist for Agent-Authored Fields

For a field to be considered "fully wired" under Piece C, it needs all six:

1. ✅ Read path: `getFieldValue` returns canonical value
2. ✅ API write: endpoint persists override to `year1[field].override`
3. ✅ UI: operator can pin a value in the relevant tab
4. ✅ Clear path: clearing override re-resolves via `reResolveClearedLayeredValue`
5. ✅ Override persistence: override survives OperatorStance reblends
6. ✅ Evidence trail: override tagged with timestamp and user ID

Tasks tracking wiring completion: T-B1 (task-1541) uses this checklist as its per-field quality gate.

---

## Commitments and Status

| Commitment | Status |
|---|---|
| Agents author findings with citations | Partially operational — cashflow agent reasons with evidence; full FieldSubstrate interface aspirational |
| Deal completeness framework operational | Partially operational — signal-registry.ts and CompletenesBadge exist; per-surface coverage incomplete |
| Operator overrides at all four granularities | Partially operational — field-level wired for ~7 fields; citation/finding/confidence granularities aspirational |
| Module-apply pattern operationalizes field-level overrides | Queued — tasks #1256–#1261 |
| License posture flows through to exports | Aspirational — tied to Piece A Phase 2C |
| Completeness caveats appear in agent findings | Aspirational |
