# JEDI RE — UI CONFLATION PATTERN TASKS

**Source:** Deal Details UI/Backend audit follow-up (2026-05-31). Replit surfaced four UI conflation patterns that the original audit prompt didn't surface because it asked specifically about "literal duplicate sections." Three of those four warrant their own scoped tasks; the fourth (NOI consistently wrong) is already tracked via Task #1520 + Decision Item B.

**Reference:** Reconciliation document §7b "UI Conflation Patterns"

**Status:** Drafted; pending Replit task creation.

---

## T-CONF-1 — JEDI Score Relabel + F8 Verdict Integration

### Problem

F1 Overview displays `jedi_scores.total_score` from the database — the comprehensive multi-dimensional deal quality composite. NULL for 464 Bishop because no `jedi_scores` row has been computed.

F8 Decision tab displays a live-derived CAUTION/FAVORABLE verdict computed from integrity checks + benchmark deltas + exit cap spread. This produces a non-null value even when `jedi_scores` is empty.

Both are labeled in ways that suggest they're the same construct. They aren't. F1 is a comprehensive deal-quality score; F8 is a narrower decision-support signal computed from currently-available data. Operators reasonably expect them to agree because of the shared labeling. They don't agree — and shouldn't, since they measure different things.

Additionally, F8's verdict runs independently of `jedi_scores` even when the score is populated. The two constructs run on parallel tracks with no integration.

### Decision committed (2026-05-31)

**Rename plus integration:**
- Rename F8's verdict to a label distinct from "JEDI Score." Replit selects the name based on what the verdict actually represents conceptually — candidates include "Deal Verdict," "Operational Signal," "Decision Status," or whatever fits the platform's naming conventions.
- Integrate JEDI Score as the primary input to F8's verdict logic when `jedi_scores.total_score` is present.
- Fall back to current integrity-checks-and-benchmark-deltas computation when `jedi_scores` is empty.
- Verdict recomputes when JEDI Score lands or updates (event-driven refresh).

### Scope

1. **Label change:** F8's verdict display, tooltips, and any export/capsule references receive the new label. Audit for the old label everywhere in the codebase to catch references that might otherwise stay stale.
2. **Verdict logic refactor:**
   - Primary path: when `jedi_scores.total_score` is present and recent (define "recent" — likely <30 days), the verdict derives from the score band (e.g., score > 80 → FAVORABLE, 60-80 → NEUTRAL, < 60 → CAUTION).
   - Fallback path: when `jedi_scores` is empty or stale, current integrity-checks-and-benchmark-deltas computation runs.
   - Hybrid case: if JEDI Score is present but integrity checks fire critical alerts, the verdict should incorporate both (a deal with high JEDI Score but failing integrity checks isn't favorable; surface the conflict).
3. **Provenance:** F8's verdict displays which input(s) produced it — JEDI Score band, live integrity computation, or both. Operators see why the verdict landed where it did.
4. **Refresh trigger:** When `jedi_scores` updates for a deal, F8's verdict invalidates and recomputes.

### Acceptance criteria

- F8 verdict no longer shares label with F1 JEDI Score
- For 464 Bishop (no `jedi_scores`): F8 verdict continues to work via fallback path, displaying provenance "derived from integrity checks"
- For a deal with populated `jedi_scores`: F8 verdict reflects the score band, displaying provenance "derived from JEDI Score"
- For a deal with both score and failing integrity checks: F8 verdict shows the conflict, doesn't silently let either input win
- When `jedi_scores` updates, F8 verdict recomputes

### Dependencies

- None blocking — can ship independently
- Touches: F8 DecisionTab, F1 OverviewTab (label consistency)
- Does NOT touch: `jedi_scores` computation logic itself (separate concern; Pattern 2 / JEDI score trigger work)

### Estimated complexity

1-2 weeks

### Source documents

- Reconciliation §7b "JEDI Score F1 vs F8 verdict"
- Audit §1 "Top 5 Most Impactful Misalignments" (entry #4 references the split)
- Audit §11 Finding 7 (silent degradation pattern includes JEDI tile rendering)

---

## T-CONF-2 — Market Context Dual-Surfacing Investigation

### Problem

F1 Overview renders a market context strip from `deal_market_intelligence`. F8 Decision tab renders a market signal overlay from `deal_market_intelligence`. Same source table, two rendering locations.

For 464 Bishop, both are empty (0 rows in `deal_market_intelligence`), so the duplication isn't currently operator-visible. But the same data gap is silently represented in two places, and when the table populates, both surfaces will render the same content.

It's unclear from the audit whether this is:

- **Intentional dual-surfacing:** F1 shows market context as part of overall deal context; F8 shows it specifically for decision-making purposes. Same data, different framings. Reasonable Bloomberg-terminal-style pattern.
- **Accidental duplication:** Two teams or design iterations independently added market context surfaces. Same data, no coordinated framing.

The fix differs depending on which it is.

### Investigation scope

**Phase 1 — Investigate intent (30 min):**

1. Read F1 OverviewTab.tsx and F8 DecisionTab.tsx to see how each surface frames its market context
2. Check git history for both files to see when each market context section was added and by whom
3. Determine: do the two surfaces have distinct framing/headings/purposes, or do they share the same UI shape?
4. Document finding: "intentional dual-surfacing" or "accidental duplication"

**Phase 2A — If intentional dual-surfacing:**

1. Clarify the *purpose* of each surface so operators understand why market data appears in two places
2. Update headings/tooltips to make the framing distinction explicit (e.g., F1 "Market Context" — broad context; F8 "Market Signal Overlay" — decision-relevant signals)
3. Ensure both surfaces compose the data consistently (don't re-implement parsing; share a hook or component)

**Phase 2B — If accidental duplication:**

1. Pick canonical surface (likely F1 for general context, but operator's call)
2. Either remove the duplicate or make it a reference/link to the canonical surface
3. Update any deep-link references that pointed at the removed surface

### Acceptance criteria

- Investigation phase produces a clear "intentional" or "accidental" finding in writing
- Fix phase ships the appropriate remediation
- For 464 Bishop and other empty-data deals: behavior unchanged (still empty, but architecturally clarified)
- For a deal with populated `deal_market_intelligence`: market context renders correctly per the chosen architecture

### Dependencies

- None blocking
- Touches: F1 OverviewTab, F8 DecisionTab
- Does NOT touch: `deal_market_intelligence` writer (separate concern; Pattern 2 / Research Agent trigger work)

### Estimated complexity

- Phase 1 investigation: 30 minutes
- Phase 2 fix: 1-3 days depending on Phase 1 finding

### Source documents

- Reconciliation §7b "Market context F1 vs F8"
- Audit §11 Finding 6 (silent degradation pattern)

---

## T-CONF-3 — Backend Double-Mount Cleanup

### Problem

Two backend routes are mounted twice in `index.replit.ts`:

1. `stabilized-potential.routes.ts` — mounted twice consecutively at `/api/v1/proforma`
2. `apartmentLocatorRouter` — mounted twice at two different paths

No visible UI duplication results from this, but the double-mounts cause:

- Potential confusion in logs (same handler logged twice per request)
- Potential double-execution of middleware (depending on Express routing semantics)
- Maintenance smell — future changes to these routes might miss one mount and produce inconsistent behavior

### Scope

1. **Verify no callers depend on the duplicate paths.** For each duplicate mount, check whether any UI fetch or backend service references the alternate path. If a caller depends on the second path, the cleanup is more involved — needs caller redirection.
2. **Remove the duplicate mounts.** For `stabilized-potential.routes.ts`, keep one mount at `/api/v1/proforma` and remove the duplicate. For `apartmentLocatorRouter`, keep the primary path and remove the secondary.
3. **Verify routes still work after cleanup.** Smoke test each affected endpoint to ensure handlers respond correctly.

### Acceptance criteria

- `index.replit.ts` no longer contains duplicate mount statements for either route
- All UI fetches and backend services that previously hit either route continue to work
- Smoke tests pass for endpoints in `stabilized-potential.routes.ts` and `apartmentLocatorRouter`

### Dependencies

- None blocking
- Touches: `index.replit.ts` only (plus any caller redirections if Phase 1 reveals dependencies)

### Estimated complexity

1 day

### Source documents

- Reconciliation §7b "Backend double-mounts"
- Audit §4 (unmounted route inventory; note that double-mounts are a separate category)

---

## SEQUENCING NOTE

These three tasks are independent of each other and independent of the current T-A through T-B1 work. They can run in parallel with the existing task batch or be slotted between phases based on Replit's bandwidth.

**Recommended order (if sequential):**

1. T-CONF-3 (1 day, cleanup) — fastest fix, clears maintenance debt
2. T-CONF-2 (1-3 days, investigation + fix) — produces architectural clarity that informs other work
3. T-CONF-1 (1-2 weeks, integration) — most significant of the three; can run in parallel with T-A or T-B work

But operator-visible impact ordering is the inverse:

1. T-CONF-1 — operators see immediate clarity on the JEDI Score / verdict distinction
2. T-CONF-2 — less visible (both surfaces empty for current deals)
3. T-CONF-3 — invisible to operators

Replit picks the sequencing based on implementation context.

---

## RELATIONSHIP TO BROADER ARCHITECTURE

These three tasks address operator-visible conflation but don't replace any of the architectural commitments in Pieces A-D. They're cleanup work informed by the audit:

- T-CONF-1 (JEDI Score / F8 verdict) — informs Piece C's agent synthesis interface. The integration pattern (consume primary signal when present, fall back when absent) is exactly what Piece C agents should do across multiple field types. T-CONF-1 is the worked example for that pattern.

- T-CONF-2 (market context) — surfaces a question about Piece C's surface composition. When the same underlying data appears in multiple Piece C agent-authored surfaces, the architecture needs to clarify whether that's coordinated framing or accidental redundancy. T-CONF-2's finding informs how Piece C handles cross-surface data composition.

- T-CONF-3 (double-mounts) — pure cleanup, no architectural implication beyond hygiene.

Worth noting these connections in case Replit's implementation surfaces patterns relevant to Piece C work that's queued behind T-B1.

Per CLAUDE.md P8: state-verify each task's specific code references against live state before implementing. The audit was 2026-05-31; if any of these surfaces have changed since, the task scope adjusts accordingly.
