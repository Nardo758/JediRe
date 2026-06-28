# CLEANUP TRACKS 1 + 2 — build hygiene + dead-weight inventory (DELETE NOTHING)

Cleanup done right is **audit → classify → gate → delete**, never find-and-sweep. These two tracks change nothing — Track 1 runs a build, Track 2 produces a classified map. Deletion (Track 3) happens only after you review the map, and only on the proven-REDUNDANT bucket. The governing rule, from the 882-line save: **a deletion candidate must be PROVEN redundant (live equivalent named, `file:line`) — never inferred from "unreachable."** Unreachable is how half-migrated unique code looks. Report only. STOP at each track's report.

---

## TRACK 1 — Build hygiene (run the build, delete nothing)

The Phase 5 close fell back to `tsc` because the production build timed out. `tsc` passing ≠ a clean bundler build, and the two bugs just fixed (`MONITORING_FIELDS` type-erasure, `refreshKey` scope) were both invisible to typecheck. Close the asterisk.

1. Run the **full production build** to completion in an environment that can finish it (raise the build-time limit or use a capable runner — the dev server + tsc is not a substitute).
2. Report: clean, or the exact errors. The two known pre-existing warnings (dynamic-import, mapbox type def) are acceptable if unchanged — confirm they're the *only* non-clean output.
3. If it breaks: surface the errors with `file:line`. Do not fix in this track — report, so the fix is a conscious separate step.

**Track 1 closes when:** a full production build completes, output pasted, confirmed clean (or its breakage reported). No code changed.

---

## TRACK 2 — Tree-wide dead-weight inventory (AUDIT ONLY — classify, delete nothing)

Extend the provenance audit from the three grid mounts to the **whole frontend tree**. Every page/route-level component and major section classified. Git-date against the **March 16, 2026** Bloomberg switch. Trace the **router**, not component-name greps.

**Classify every component into exactly one bucket:**

| Bucket | Definition | Action |
|---|---|---|
| `ACTIVE` | routable + rendered in a live nav path | keep, no action |
| `INTENTIONAL-KEEP` | legacy/rollback route, explicitly retained (e.g. `-legacy`, `-old`) | keep, document why |
| `REDUNDANT` | unreachable AND its function provably exists elsewhere (name the live equivalent `file:line`) | eligible for Track-3 deletion |
| `HOLDS-UNIQUE` | unreachable BUT contains logic/UI that exists nowhere else | **park for human decision — never auto-delete** |

**The REDUNDANT bar (non-negotiable):** "zero imports / not in router" proves *unreachable*, NOT *redundant*. To classify REDUNDANT you must name the live component/route that covers its function, `file:line`. If you cannot name the equivalent, it is `HOLDS-UNIQUE`, not REDUNDANT. **Err toward HOLDS-UNIQUE when uncertain** — a wrong REDUNDANT deletes unique work (the `ProFormaWithTrafficSection` lesson: zero imports, held unique UI, never compiled).

**For each component report:**
- path, route (or "no route"), reachability (routable / state-only / orphan / stub)
- birth date + last-change date (`git log --follow --diff-filter=A` / `git log -1`)
- provenance tag (bloomberg / pre-bloomberg / ambiguous) with style+nav corroboration
- bucket + the evidence for it (for REDUNDANT: the live equivalent `file:line`; for HOLDS-UNIQUE: what's unique)
- any compile-state red flags (duplicate declarations, type errors — signals a half-built file, like the `handleInitialize` defect)

**Known inputs to fold in (don't re-derive, confirm + extend):**
- `PropertyTerminalPage.tsx` — already proven REDUNDANT + deleted. Confirm gone.
- `ProFormaWithTrafficSection.tsx` — HOLDS-UNIQUE (882 lines, unique M07→M09 UI, never compiled). Park. Note the paired `GET /proforma/:dealId/traffic-integration` endpoint (sole caller).
- `-legacy` / `-old` routes — INTENTIONAL-KEEP.
- `DealDetailPage` — ambiguous (pre-switch birth, Bloomberg rewrite). Confirm ACTIVE, flag as ambiguous-but-live so it's never mistaken for dead weight.

**Also inventory (not just route-level):**
- Orphaned components (zero imports) anywhere in the tree — each gets a bucket.
- Backend endpoints reachable only via an orphan frontend (like `traffic-integration`) — flag as paired-fate with their sole caller.
- Stub bodies ("awaiting", "wireframe", "coming soon", "TODO", empty returns) — `file:line`.

**Track 2 output:** the full classified inventory table + a **proposed delete-list = REDUNDANT bucket only**, each with its live-equivalent proof. The HOLDS-UNIQUE list (parked decisions) separate. Change nothing.

---

## What does NOT happen in these tracks

- No deletion. No re-mount. No "tidy while we're here." Track 2 is a map; Track 3 (a later dispatch) acts on it after your review.
- `ProFormaWithTrafficSection`'s 882 lines stay untouched — its complete-vs-discard decision is Track 3, paired with the endpoint, made by the human.
- Nothing classified HOLDS-UNIQUE or AMBIGUOUS is deletion-eligible, ever, without an explicit human call.

**Report Track 1 (build result) and Track 2 (classified inventory + proposed REDUNDANT-only delete-list). STOP — human review gate before any Track 3 deletion.**
