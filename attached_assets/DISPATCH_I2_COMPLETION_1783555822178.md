# DISPATCH — I2 COMPLETION: The Doors That Actually Exist

**Why:** I2's firewall was built and proven — on `skill_chat_messages`, a table **that doesn't exist** (migration present, never applied, error silently swallowed). So the fix is PREVENTIVE, not a closed active leak. Record it as such. Meanwhile `agent_chat_logs` and `opus_messages` DO exist and DO store chat content — if either stores assistant responses and replays them into prompts, the live version of the leak sits there, unfirewalled. This is the I1-EXTENSION lesson repeating: **the empty/nonexistent sibling hid the populated one.** Check the doors that are actually installed.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. Requires real DB.
**Standing rules:** S1-01 pasted live output · scope-don't-strip (live agent context intact; the LOG loses the value) · no licensed values in reports · nothing deleted.

## J1 · The live chat surfaces — same treatment or exemption, with evidence
For **`agent_chat_logs`** and **`opus_messages`** (and any other table storing chat/assistant content — verify counts, don't trust this list):
1. **Do they store assistant/model output content?** (schema + a row-shape check, no content pasted.) Or user turns only?
2. **Does anything replay them into a subsequent prompt?** Grep every reader; specifically any `loadConversationHistory`-equivalent, context-builder, or memory/summary path that feeds prior turns back to an LLM.
3. **Can restricted-vendor-derived values reach them?** Bishop's 270 deal-scoped correlations (204 CS×public) are exactly the content an agent cites in reasoning. Trace one path or prove none.
4. **Verdict per table:** NEEDS-FIREWALL (apply the same `contains_restricted` flag + replay-exclusion pattern proven on skill_chat_messages) / EXEMPT-WITH-REASON (user turns only, or never replayed — state which). If NEEDS-FIREWALL: implement, and prove with the same four-step proof (lineage flag correct per turn, assistant turn flagged, replay excludes restricted, display unimpaired).

## J2 · The ghost migration — why did it silently fail, and how many others?
`skill_chat_messages`' migration exists on disk, was never applied, and the backend **caught and swallowed the error**. The app has been running against a table it believes exists.
1. **Root cause:** why did it fail to apply, and where is the error swallowed (file:line)? Is the swallow deliberate (idempotent-skip) or a bug?
2. **Blast radius:** the migration runner reported `applied 1, skipped 326`. How many of those 326 skips are legitimate already-applied vs. **silently failed**? Produce the classification — or if the runner can't distinguish, say so plainly (that itself is the finding: *a migration runner that cannot distinguish "already applied" from "failed and ignored" provides no safety*).
3. **Ruling to encode:** migrations that fail must fail LOUDLY. Propose the minimal change (fail-fast, or a startup schema-assert listing expected-vs-actual tables) — report before building.
4. Log as a named finding. This is how a table becomes a ghost.

## J3 · Nightly deal-scoped sweep (X2's ruling → build)
The 03:00 `sweepAllGeographies()` is GLOBAL-only, so Bishop's 270 deal-scoped correlations go stale silently whenever metrics update.
1. Extend the scheduled sweep: iterate deals holding restricted rows; run each deal-scoped (`scope_id = 'deal:<id>'`, restricted auto-set per `computePairCorrelation:584`); GLOBAL pass unchanged.
2. **Orphan guard (the 106-row lesson, now a standing rule):** a deletion path that only cleans what it re-computes cannot clean what it can no longer see. The sweep must reconcile: any correlation row whose inputs are now restricted but whose scope is GLOBAL gets purged. Prove with one forced case.
3. Paste: post-sweep counts (GLOBAL unchanged; Bishop's deal-scoped recomputed), zero CS_ pairs in GLOBAL, non-Bishop query returns none of Bishop's.

## J4 · Record correction
Update `docs/architecture/costar-firewall-enforcement-report.md`:
- I2 status: **PREVENTIVE on `skill_chat_messages` (table absent at fix time — migration ghost).** Add J1's verdicts per live table; the firewall is complete only when every *existing* chat surface is either firewalled or exempt-with-reason.
- Add the standing rules: (a) *the empty/nonexistent sibling hides the populated one — verify every table in the family with queries, never by pattern*; (b) *a deletion path that only cleans what it re-computes cannot clean what it can no longer see*; (c) *migrations must fail loudly*. All three to `CLAUDE.md`.

## ACCEPTANCE
- J1: per-table verdict with evidence; any NEEDS-FIREWALL implemented + four-step proof pasted.
- J2: root cause + swallow site + the 326-skip classification (or the honest "runner can't tell" finding) + fail-loudly proposal.
- J3: scheduled deal-scoped sweep live; orphan reconciliation proven; three counts pasted.
- J4: report + CLAUDE.md updated.
- Both baselines green · Bishop/Highlands unchanged · agent live answers unimpaired (if any firewall lands) · no licensed values in report · zero rows deleted.
**On green: the CoStar firewall is complete across every surface that exists.** Then D3-W2/W3 — first demos already named by X1's four EVIDENCE-AVAILABLE fields.

## OUT OF SCOPE
D3-W2/W3 · deleting rows (counsel) · applying the skill_chat_messages migration (unless J2's root cause makes it trivially safe — then report, don't assume) · rebuilding the migration runner beyond the fail-loudly proposal.

**Order: J1 → J2 → J3 → J4. STOP if a live agent answer degrades, or if any migration change would drop data.**
