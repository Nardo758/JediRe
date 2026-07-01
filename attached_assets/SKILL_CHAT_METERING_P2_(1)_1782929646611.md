# DISPATCH — SKILL-CHAT METERING PHASE 2: PASSTHROUGH + MESSAGE-LEVEL GATE

**Confirmed structure:** per-token passthrough metering on all 11 Sonnet sites + a MESSAGE-LEVEL
balance gate that blocks zero-balance users BEFORE the first Sonnet call. No between-turn checks
(bounded single-message overshoot accepted). No reservation. Block response is upgrade-legible;
blocked attempts logged as demand signal.
**Repo:** `Nardo758/JediRe.git` — branch `claude/meter-skill-chat-p2`.
**Verification rule (S1-01):** proven LIVE — debit matches real Sonnet cost across a DEEP session,
zero-balance user blocked at message start, bounded overshoot confirmed. Material dollars → live run
REQUIRED, no construction-only sign-off.
**Report to:** `docs/audits/SKILL_CHAT_METERING_P2_VERDICT.md`

---

## PART A — PASSTHROUGH METERING (11 sites)

Swap each bare `anthropic.messages.create()` → `meteringAdapter.createMessage()` at all 11 sites
(from Phase 1: skill-chat.service.ts 136/185, personas.ts 154/192, + 7 collaboration-service sites).
Each uses identical `MeteringMetadata` from the already-threaded `SkillContext` (userId + dealId
verified before first call). `file:line` per swap.
- Reuse the adapter — no parallel meter.
- `triggered_by: 'user'`, attributed to the session's authed user/org, not a system account.
- Confirm every one of the 11 now fires `jedi_input_tokens` + `jedi_output_tokens` to Stripe.

## PART B — MESSAGE-LEVEL BALANCE GATE (the enforcement)

**Where:** at the start of handling each user message in skill-chat, BEFORE the first Sonnet call
(orchestrator A1). One check per message, at the message boundary — NOT before each persona/collab
sub-loop.

1. **Check balance before spend.** Read the caller's credit balance. If insufficient (≤ 0, or below
   a minimal floor if one exists), BLOCK — do not fire any Sonnet call for this message. `file:line`.
2. **Positive balance → whole message runs.** However deep it nests (orchestrator + personas +
   collaboration), the message completes. Accepted tradeoff: a barely-positive user can go bounded-
   negative by at most one deep session (~$0.30) before the NEXT message blocks. This is intentional
   — do not add between-turn re-checks to prevent it.
3. **Block response is upgrade-legible.** The block returns a structured response the frontend can
   render as an upgrade/credits prompt (not a bare 402 / silent fail). Include: reason
   (out-of-credits), current balance, and enough for the UI to show an upgrade path. This is a
   conversion surface, not a dead end. State the response shape.
4. **Log the blocked attempt** — record that this user TRIED to run a session while out of credits
   (user/org, timestamp, intended deal). This is demand signal for tier-allotment tuning. A small
   insert / existing usage-log row marked blocked. `file:line`.

## PART C — IDEMPOTENCY

A retried/duplicated user message must not double-debit. Match the agent idempotency guard
(`ON CONFLICT DO NOTHING` or equivalent already proven across the 5 agents). Confirm it holds with
the passthrough swaps in place.

**Explicitly NOT building:** pre-flight credit RESERVATION (pre-auth then settle). Overkill at
~$0.30 worst-case/message. Message-level gate on spend-then-report is sufficient. Note this as a
deliberate non-goal.

---

## ACCEPTANCE — LIVE, all required (material dollars)

1. **Deep-session debit matches cost.** Run a real skill-chat session that triggers a MULTI-PERSONA
   deep path (orchestrator + ≥1 persona sub-loop + ≥1 collaboration skill — the 11-call worst case,
   not a shallow 2-call one). Capture total Sonnet tokens (all calls, from `ai_usage_log`) and the
   credit debit. Paste both + the arithmetic. Debit was $0 before; now equals real cost.
2. **Zero-balance blocked at message start.** A test user with 0 credits sends a skill-chat message →
   BLOCKED before any Sonnet call fires (confirm via `ai_usage_log`: zero new Sonnet rows for that
   attempt). Paste the block response (must be upgrade-legible) + the empty usage log.
3. **Bounded overshoot confirmed.** A barely-positive user runs one deep session → goes slightly
   negative (bounded, ~one session), and the NEXT message blocks. Paste the balance trajectory
   (positive → slightly-negative → blocked). This proves the accepted tradeoff behaves as designed,
   not unbounded.
4. **Blocked attempt logged.** The zero-balance block from #2 produced a demand-signal record. Paste.
5. **No double-debit** on retry. Paste.
6. **Attribution:** debits land on the session user/org. Paste.
7. Clean up test users/sessions.

**All 7 live. Construction + unit tests are NOT sufficient — this changes what you collect and what
you stop.**

---

## DELIVERABLE

- SHA + Part A (11 swaps, `file:line`), Part B (gate location + block-response shape + demand log),
  Part C (idempotency confirmed)
- Live acceptance 1–7 pasted
- One-line: skill-chat now meters 11 Sonnet sites (passthrough); zero-balance users blocked at
  message start with upgrade prompt; bounded ≤1-session overshoot; blocked attempts logged

---

## FEEDS THE NEXT DECISION (note, don't act)

Once the debit is live and real, run the **tier-allotment margin check**: does a typical skill-chat
session's real Sonnet cost fit inside Scout's 100 credits / Operator's 500 / etc.? The blocked-
attempt log (Part B4) + real per-session cost (acceptance #1) are the inputs. If a few deep sessions
exhaust a Scout month, the allotment or pricing needs revisiting. This is a margin ANALYSIS, not a
dispatch — flagged for you once the numbers are live.

---

## OUT OF SCOPE

- #2 dev-scenarios + rest of ranked queue — separate.
- Notarize absorb-vs-cap decision — STILL an open human call, flag again.
- Credit pricing changes — this debits at current pricing; the margin check above decides if pricing
  moves.
- Reservation model — deliberate non-goal (see Part C note).
