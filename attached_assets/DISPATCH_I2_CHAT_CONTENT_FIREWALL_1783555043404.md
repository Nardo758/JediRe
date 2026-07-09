# DISPATCH — I2 REMEDIATION: Chat-Content License Firewall (+ 3 Carry-Overs)

**Why now (top security item):** `skill_chat_messages.content` stores assistant responses verbatim, and `loadConversationHistory` (skill-chat.service.ts:273) **replays them unfiltered into every subsequent AI prompt** for that conversation. CoStar-derived values therefore recirculate through the LLM continuously — not passive storage, active re-ingestion. The deal-scoped sweep just made this worse in the good way: Bishop now has 270 restricted correlations (204 CS×public cross-signals) that agents will cite in reasoning, which lands in chat content, which replays. **Richer signals ⇒ more contamination through the same open path.** This is the last active leak vector and the closest one to the distillation risk.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. Requires real DB.
**Standing rules:** S1-01 pasted live output · no licensed-data content in reports (metric names/counts only) · scope-don't-strip (agents keep their evidence; the LOG loses it).

---

## PART 0 — CARRY-OVERS (small, do first)

### X1 · The S3 coverage table, by name (read-only)
The sweep report gave counts (4 EVIDENCE-AVAILABLE / 2 PARTIAL / 4 NO-COVERAGE), not fields. Paste the table: each of Bishop's gap fields → its verdict → the mapped CoStar-derived signal(s) by metric_id/COR-id. **These four are D3's first demos** — the agent proposals we'll watch first. Names and signal ids only; no CoStar values.

### X2 · Nightly sweep — deal-scoped coverage (audit + ruling)
Bishop's 270 deal-scoped pairs exist because a one-off script ran them. Does the scheduled 03:00 `computeTimeSeriesCorrelations` sweep run **deal-scoped passes for deals holding restricted data**, or GLOBAL only?
- If GLOBAL-only → Bishop's correlations go stale silently when metrics update. Propose the minimal scheduling change (iterate deals with restricted rows; run each deal-scoped; store restricted). Report before building.
- Also encode the standing rule discovered this arc: **a deletion path that only cleans what it re-computes cannot clean what it can no longer see.** Any schema change altering a job's visibility ⇒ post-deploy orphan sweep. (This is what produced the 106 stale rows.) Add to `CLAUDE.md`.

### X3 · Forecast-vs-actual tagging (design note, no build)
CoStar rows span 2000–2031: some series are realized, some are `costar_forecast` projections. A correlation between a real series and a vendor's *forecast* is a different evidentiary animal. Record the requirement for D3's evidence chain: every evidence_ref carries `data_kind: actual | forecast`, and an agent citing forecast-derived evidence must say so in its `reasoning`. Note it in the D3 spec; don't build here.

---

## PART 1 — I2 REMEDIATION (the firewall)

### I2-A · The enabling change: license context on the write path
1. Add a license/source field to `AICallContext` and `MeteringMetadata` (today there is nothing to filter on — this is the prerequisite, per the original firewall dispatch).
2. Define the marker: any value derived from a restricted vendor (CoStar today; the vendor registry's `licensePosture`/`redistribution_restricted` is the source of truth) carries restricted lineage when it enters agent context.

### I2-B · Firewall the storage path
`skill_chat_messages.content` and `skill_calls` must not persist restricted-vendor-derived content in a form that can be replayed or harvested.
1. **Redact-on-write** (preferred): restricted-derived values are replaced with a stable placeholder + reference (e.g. `[restricted:costar:corr:COR-24]`) that preserves the *shape* of the reasoning without the licensed value. The agent's live context is untouched — only the LOG loses the number. (Scope-don't-strip, applied to logging.)
2. If full redaction is too large this pass: **flag-and-exclude** — mark the row `contains_restricted = true` and exclude those rows from `loadConversationHistory` replay AND from any corpus-eligible read. Ship something this pass; the accumulation is cumulative and retroactive.
3. **Prove it:** run one agent turn on Bishop where the response cites a CoStar-derived correlation. Paste: (a) the agent's live answer is correct and complete (feature preserved), (b) the stored `skill_chat_messages.content` contains no CoStar value (placeholder or excluded), (c) `loadConversationHistory` on the next turn does not replay a CoStar value into the prompt.

### I2-C · Close the harvest paths
1. `training_examples`: `sanitizeTrainingCharacteristics` covers `deal_characteristics` only. Confirm (grep + paste) that no other path reads `skill_chat_messages.content` or `skill_calls` into a training/fine-tuning corpus. Readers already known: `skill-chat.routes.ts:159` (frontend history), `skill-chat.service.ts:273` (replay), `:283` (row mapping). Verify no fourth.
2. `pattern-extractor.ts` reads `broker_rent` (CoStar-derivable). Confirm its input set post-fix excludes restricted lineage, or flag as a remaining finding with its exact exposure.
3. `ai_usage_log`: confirm it stores metadata only (no content). Paste the schema.

### I2-D · Historical rows (report, do not delete)
Count existing `skill_chat_messages` rows whose content plausibly carries CoStar lineage (heuristic: conversations on Bishop after CoStar upload date; or rows whose `skill_calls` reference CS_ metrics / restricted correlations). **Report the count for counsel — delete nothing.** Same posture as the row-purge question: engineering blocks the future; counsel rules the past.

---

## ACCEPTANCE
- X1 table pasted (fields + verdicts + signal ids, no values) · X2 audit + proposal + CLAUDE.md rule added · X3 requirement recorded in the D3 spec.
- I2-A license field lands. I2-B: agent answer correct AND log clean AND replay clean — all three pasted. I2-C: reader census pasted, pattern-extractor verdict. I2-D: historical count for counsel, zero deletions.
- Both baselines green · Bishop/Highlands unchanged · no licensed values anywhere in the report.
**On green: the CoStar firewall is complete** — I1 (deal-scoped reads) + I1-EXTENSION (deal_id from birth, guard fires) + I2 (logging/replay firewalled). Then D3-W2/W3, with the first agent demos already named by X1.

## OPERATOR-ONLY (flag, don't act)
Purge question remains counsel's: four tables + now a `skill_chat_messages` row count. Facts: all CoStar lineage traces to ONE deal (Bishop), uploaded under the operator's own license; derived rows are aggregates, not raw records; all now scoped/restricted; zero rows deleted by engineering.

## OUT OF SCOPE
D3-W2/W3 execution · deleting any row · building the nightly deal-scoped sweep before X2's ruling · exposing CoStar values in any artifact.

**Order: X1 → X2 → X3 → I2-A → I2-B → I2-C → I2-D. STOP if the agent's live answer degrades (that means you stripped context, not the log).**
