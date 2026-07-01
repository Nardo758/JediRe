# DISPATCH — #3: METER AGENT TOOL LLM CALLS (CORRECTNESS FIX)

**Not a new-revenue fix — a correctness fix.** Research agent runs ARE metered (main LLM loop debits
credits via MeteringAdapter), but the agent's TOOLS (`classify_as_deal_opportunity`,
`extract_deal_fields`, + any others) make DIRECT Anthropic calls that bypass MeteringAdapter. So every
run's credit debit UNDERSTATES its real Anthropic cost. This corrupts the one number the credit model
rests on — margin math is silently wrong. Fix the meter you already trust before extending metering
elsewhere.
**Repo:** `Nardo758/JediRe.git` — branch `claude/meter-agent-tool-llm-calls`.
**Verification rule (S1-01):** proven by a live agent run where the credit debit MATCHES the actual
token cost (main loop + tools), shown by DB + usage logs — not by code review.
**Report to:** `docs/audits/AGENT_TOOL_METERING_VERDICT.md`

---

## PHASE 1 — FIND EVERY BYPASSING TOOL CALL (READ-ONLY, brief STOP)

Before wiring, enumerate the full set — the audit named 2; confirm there aren't more.
1. **Every direct Anthropic/DeepSeek call reachable from within an agent run** that does NOT route
   through MeteringAdapter. Grep the agent tool implementations + anything an agent tool calls:
   ```
   grep -rniE "anthropic|messages\.create|deepseek" backend/src --include=*.ts
   ```
   Cross-reference against the MeteringAdapter path: which of these calls debit credits, which don't.
   List every UNMETERED call reachable during an agent run. `file:line` each.
2. **Confirm the metering path.** Read MeteringAdapter + AgentRuntime: how does the main loop's debit
   work (per-token? per-call? what's the credit formula)? The tool calls must use the SAME formula so
   costs are consistent, not a parallel accounting. `file:line`.
3. **Quantify the understatement.** For one representative research run, estimate: main-loop tokens
   (metered) vs tool-call tokens (unmetered). What % is the current debit understating? This sizes
   the margin impact and gives the acceptance a target.

**Brief STOP: report the full unmetered-tool-call list + the understatement estimate before wiring.**
(This is small — if the list matches the audit's 2 and the path is clear, proceed after reporting.)

---

## PHASE 2 — ROUTE TOOL CALLS THROUGH THE METER

1. Wire each unmetered tool call to debit credits via the SAME MeteringAdapter path the main loop
   uses — same token accounting, same credit formula, same idempotency handling. Do NOT build a
   parallel meter; reuse the adapter. `file:line` per call converted.
2. **Idempotency / double-debit guard:** confirm wiring the tool call doesn't double-count if the
   tool result is already partially reflected in the main loop's token count. The tool call's tokens
   must be counted ONCE. (Recall credit metering was proven idempotent across the 5 agents earlier —
   match that discipline.)
3. **Attribution:** the tool-call debit attributes to the SAME user/org/run as the parent agent run,
   not a separate context. Confirm the run context propagates into the tool call.

---

## ACCEPTANCE — live agent run, debit matches cost

1. **Baseline (pre-fix behavior, for the delta):** if reproducible, note a run's OLD credit debit.
2. **Run a real research agent** end-to-end that exercises the tool calls
   (`classify_as_deal_opportunity` / `extract_deal_fields`). Capture:
   - total Anthropic tokens consumed by the run (main loop + tools) — from `ai_usage_log` or provider
     usage. Paste.
   - the credit debit recorded for that run — from the credit ledger / `user_credit_balances` delta.
     Paste.
3. **The proof:** the credit debit now reflects main-loop + tool tokens, NOT just main-loop. The
   understatement from Phase 1.3 is closed. Show the before/after debit for an equivalent run if
   possible, or show the debit now matches total token cost.
4. **No double-count:** confirm tool tokens are counted once — the debit equals actual total, not
   inflated. Paste the arithmetic (main tokens + tool tokens = metered tokens).
5. **Idempotency intact:** re-running / retry doesn't double-debit (spot-check the existing
   idempotency guard still holds with tool calls in the path).
6. Attribution correct: the debit lands on the run's user/org, not a system/agent account.

---

## DELIVERABLE

- SHA + Phase 1 list (every unmetered tool call) + understatement estimate
- Phase 2 wiring (`file:line` per call routed through MeteringAdapter)
- Live acceptance: total tokens vs credit debit, proving the debit now matches real cost, counted
  once, attributed to the run's user/org
- One-line: agent tool LLM calls now metered; research-run credit debit was understating cost by
  ~X%, now accurate

---

## OUT OF SCOPE

- #1 skill-chat, #2 dev-scenarios, and the rest of the ranked queue — separate per-route metering
  dispatches (this fixes the CORRECTNESS of the already-metered path; those ADD metering to uncovered
  routes).
- Non-LLM cost sites (Google Places, ATTOM, Notarize) — separate decisions (absorb vs pass-through).
- The Notarize per-doc cost / cap decision — flag for the human, not this dispatch.
- Changing credit PRICING — this makes the debit accurate at current pricing; whether current pricing
  yields 40% margin given the corrected cost is a SEPARATE analysis (worth doing once the debit is
  true).

**This makes the metered number TRUE. Every downstream margin calculation depends on it — which is
why it's first. Acceptance is: credit debit = actual token cost, counted once, per run.**
