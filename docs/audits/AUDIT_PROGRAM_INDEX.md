# JEDI RE — AUDIT PROGRAM INDEX

> Index of record for the launch-readiness audit program. Mirrors the discipline of
> `JEDI_RE_MASTER_SPEC_INDEX.md`: one governing doc, one row per audit, no parallel trackers.
> A dispatch with no row here is considered out-of-program. Drop at repo root or `docs/audits/`.

**Purpose:** answer one question — *is the platform's plumbing, correctness, monetization, economics,
security, and ops where they need to be to charge real users?* — without the audit set fragmenting
the way the specs did.

---

## SHARED CONVENTIONS (every dispatch inherits these — stated once, here)

- **Read-only.** Audits report; they never fix. Fixes are a separate, later, human-gated dispatch.
- **Cardinal rule of evidence.** Specs, `BUILD_STATUS.md`, registry `buildStatus`, green tests, and
  prior agent self-reports are NOT evidence. Only **(a)** a `file:line` code path traced
  caller→callee, or **(b)** a pasted live-DB query result. This is the forceReseed / S1-01 lesson
  encoded as a rule.
- **Six labels** for wiring nodes: WIRED · PARTIAL · STUB · MOCK · ORPHANED · ABSENT. Invariants and
  threat classes use their own scales (PASS/VIOLATED/UNVERIFIED; PRESENT/PARTIAL/ABSENT).
- **Live-DB over fixtures.** Schema ≠ populated ≠ wired. If the live DB is unreachable, the finding
  is UNVERIFIED, never inferred.
- **STOP at the report.** Each dispatch ends by producing its report and halting for triage.

---

## THE PROGRAM

**Status legend:** ◑ dispatch written, not yet run · ○ not written · ● run + report in hand.

| # | Audit | Axis | Gating? | Status | Dispatch file | Report |
|---|---|---|---|---|---|---|
| A1 | Plumbing & Invariants | horizontal (shared infra) | **LAUNCH** (the [LAUNCH]-tagged subset) | ● | `AUDIT_DISPATCH_PLUMBING_AND_INVARIANTS.md` | `PLUMBING_AND_INVARIANTS_AUDIT.md` (root) |
| A2 | S1 Chat Launch Chain (+ failure-mode) | vertical (revenue path) | **LAUNCH** | ● | `AUDIT_DISPATCH_S1_CHAT_LAUNCH_CHAIN.md` | `S1_CHAT_LAUNCH_CHAIN_AUDIT.md` (root) |
| A3 | Unit Economics & Credit-Cost | quantitative (margin) | **LAUNCH** | ● | `AUDIT_DISPATCH_UNIT_ECONOMICS.md` | `UNIT_ECONOMICS_AUDIT.md` (root) |
| A4 | Public-Ingress Security | adversarial (untrusted input) | **LAUNCH** | ◑ | `AUDIT_DISPATCH_PUBLIC_INGRESS_SECURITY.md` | — |
| A5 | Billing / Tier / Automation-Level Gating | wiring (monetization) | **LAUNCH** | ○ | — | — |
| A6 | Feature ↔ UI ↔ Backend (per surface) | vertical, per-surface | surface-dependent † | ○ | — | — |
| A7 | Route Audit (backend reg + FE reachability) | horizontal + per-surface | mostly fast-follow ‡ | ○ | — | — |
| A8 | User-Flow Audits (per journey) | vertical, per-journey | core flow gating; rest fast-follow | ○ | — | — |
| A9 | Auth / RBAC Depth | adversarial | fast-follow (core in A4) | ○ | — | — |
| A10 | Licensing Leak-Vector Full Sweep | compliance | fast-follow (barrier in A1 §9) | ○ | — | — |

† **A6 gating depends on the launch surface.** If chat-first: A6 is largely fast-follow — the chat
surface is conversational, there is no rendered UI to mismatch, so feature↔UI is a web-app concern.
If launching the web app too: A6 is gating for the surfaces shipping. **This fork is still open.**

‡ A7's `api.client.ts` missing-typed-methods gap may need pulling forward if the chat path depends
on those methods; the rest (dead routes, 5-variant consolidation) is fast-follow.

---

## RUN ORDER

Sequence by dependency and risk, not by document number.

1. **A1 Plumbing first.** It's the foundation every chain rides on. If it comes back FRAGILE on a
   [LAUNCH] subsystem, fix that *before* trusting a GREEN from any chain audit — a green slice over a
   cracked pipe is the forceReseed trap at platform scale.
2. **A2 Chat chain** — the revenue path works end to end.
3. **A3 Unit economics + A5 billing gating** — coupled. Billing must be *wired* (A5) and must *read a
   profit* (A3). Wired-but-loss-making is worse than unwired. Run together.
4. **A4 Public-ingress security** — before exposing the bot to untrusted users.

That set is the launch gate. Everything below runs in the first weeks post-launch:

5. A6 feature↔UI (gating only if launching web surfaces — resolve the fork)
6. A7 routes · A8 user flows · A9 RBAC depth · A10 licensing sweep

---

## THE COMPLETE SURFACE (so "is this all?" has an answer)

Six dimensions of launch-readiness, each owned by at least one audit:

- **Data flow / wiring** → A2, A6, A7, A8
- **Architectural correctness** → A1 (invariants)
- **Monetization** → A5
- **Economics** → A3
- **Security** → A4, A9
- **Ops / failure modes** → A1 (no-silent-stale, cache, fallback) + A2 (failure-mode section)

Past these, you are past de-risking and into delaying. This index is the line.

**Explicitly out of program (tracked elsewhere):** spec/doc hygiene — hollow files, competing SSOTs,
duplicates, stale paths. Already cataloged in `JEDI_RE_MASTER_SPEC_INDEX.md` §C; don't re-audit it
here. Test-coverage-as-proxy is superseded by the wiring audits (green tests aren't evidence).

---

## MAINTENANCE PROTOCOL

- New audit → add a row to THE PROGRAM table **and** name its dispatch file, in the same change. A
  dispatch with no row here is out-of-program.
- One report per audit. When an audit runs, flip its status to ● and link the report.
- This is the only audit tracker. No new file may claim to be one.
- Triaged findings that become fix work go to a fix backlog, not back into the dispatch — dispatches
  stay read-only by construction.
