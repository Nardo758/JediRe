# DISPATCH — #1: METER skill-chat + COLLABORATION LLM CALLS (REVENUE)

**The real dollars.** Unlike #3 (Haiku tool calls, ~0.2% understatement), skill-chat + the
collaboration services make ~7 SONNET calls per session, firing in production, hitting NO meter.
Sonnet per-token cost × multiple calls × real usage = a material uncounted line on the Anthropic
bill and revenue not collected. This wires them into the credit meter so the session's cost is billed.
**Repo:** `Nardo758/JediRe.git` — branch `claude/meter-skill-chat`.
**Verification rule (S1-01):** proven by a LIVE skill-chat session where credits debit and the debit
matches actual Sonnet token cost — DB + usage logs. Because the dollars are MATERIAL here, the live
run is REQUIRED (unlike #3, which could ride on construction+tests). No keyed-run, no sign-off.
**Report to:** `docs/audits/SKILL_CHAT_METERING_VERDICT.md`

---

## PHASE 1 — SCOPE THE CALL SET + THE BILLING MODEL (READ-ONLY, STOP)

**1. Enumerate every LLM call in skill-chat + the 7 collaboration services.** Grep the skill-chat
route/handler and each collaboration service:
```
grep -rniE "anthropic|messages\.create|sonnet|claude-" backend/src --include=*.ts | grep -iE "skill|chat|collab"
```
For each: `file:line`, model used (confirm Sonnet), and whether it's per-user-message,
per-session-setup, or background. Count the ~7 calls per session concretely — which fire always vs
conditionally.

**2. Confirm the metering path fits.** skill-chat is a USER route (not an agent run), so it uses
MeteringAdapter directly, not AgentRuntime. Read how a user route should debit:
   - Does MeteringAdapter work outside the agent context (does it need a RunContext, or take
     user/org directly)? `file:line`.
   - Where does skill-chat get the caller's user/org? (It's behind the auth floor now — confirm the
     authed user/org is available at the call site for attribution.)

**3. The billing-model question — DECIDE before wiring (this is a product call, flag for human):**
   Skill-chat is conversational — ~7 Sonnet calls per session. How should it debit?
   - **Per-call:** each Sonnet call debits its token cost. Accurate, but a chatty session burns
     credits fast and unpredictably for the user.
   - **Per-session / per-message flat:** a fixed credit cost per skill-chat message or session,
     regardless of internal call count. Predictable for the user, but may under/over-recover.
   - **Per-token passthrough:** debit actual tokens across all 7 calls. Most accurate to cost.
   State the options; RECOMMEND per-token passthrough (matches the "cost is attributable" principle
   and the existing agent metering model) but flag that the UX/pricing choice is the human's. Do NOT
   pick a flat model unilaterally — it changes the credit economics.

**=== STOP: report the call set (count + models), the attribution source, and the billing-model
options with a recommendation. Human confirms the billing model before Phase 2 wires it. ===**

---

## PHASE 2 — WIRE THE METER (after billing model confirmed)

1. Route every skill-chat + collaboration Sonnet call through MeteringAdapter, using the confirmed
   billing model, attributed to the session's authed user/org. Reuse the existing adapter — no
   parallel meter. `file:line` per call.
2. **Credit-balance enforcement:** does skill-chat CHECK the user has credits before spending Sonnet
   calls, or spend-then-debit (risking negative balance / free usage past zero)? Wire the balance
   check so a user out of credits is stopped BEFORE the Sonnet calls fire — same enforcement the 5
   agents have (credit metering was proven enforced+idempotent across agents earlier; match it).
3. Idempotency: a retried/duplicated session message must not double-debit. Match the agent
   idempotency guard.

---

## ACCEPTANCE — LIVE skill-chat session (REQUIRED, not deferred)

1. **Run a real skill-chat session** end-to-end that triggers the ~7 Sonnet calls. Capture:
   - total Sonnet tokens consumed across all calls (from `ai_usage_log` / provider usage). Paste.
   - the credit debit recorded for the session (ledger / balance delta). Paste.
2. **Debit matches cost** per the confirmed billing model — paste the arithmetic. Was zero before,
   is now the session's real cost.
3. **Enforcement works:** a user with insufficient credits is STOPPED before the Sonnet calls fire
   (not allowed to run up cost past zero). Test with a low/zero-balance test user. Paste the block.
4. **No double-debit** on retry/duplicate. Paste.
5. **Attribution:** debit lands on the session's user/org, not a system account. Paste.
6. Clean up test users/sessions.

**Because the dollars are material, all 6 must pass LIVE. Construction + unit tests are NOT sufficient
sign-off for this one.**

---

## DELIVERABLE

- SHA + Phase 1 (call set, attribution source, billing-model recommendation) → STOP for human
- Phase 2 (post-confirmation): calls wired, balance enforcement added, `file:line` each
- Live acceptance: total Sonnet tokens vs credit debit, enforcement blocks zero-balance, counted once,
  attributed correctly
- One-line: skill-chat now meters ~N Sonnet calls/session; was $0 collected, now debits [model];
  enforcement stops zero-balance users before spend

---

## OUT OF SCOPE

- #2 dev-scenarios and the rest of the ranked queue — separate per-route dispatches.
- Non-LLM cost sites (Google Places, ATTOM) — separate.
- **The Notarize absorb-vs-cap decision** — still an open human call (highest per-doc cost, $25–150;
  low frequency is currently the only thing protecting margin). Flag it again; it deserves a decision.
- Credit PRICING changes — this debits at current pricing; whether skill-chat's real Sonnet cost
  fits the tier credit allotments is a margin analysis worth doing once the debit is live and real.

**This is the one where wiring the meter actually changes what you collect. Live proof required
because the magnitude justifies it — the opposite call from #3.**
