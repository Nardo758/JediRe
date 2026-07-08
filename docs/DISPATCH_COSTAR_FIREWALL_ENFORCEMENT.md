# DISPATCH — CoStar FIREWALL ENFORCEMENT (Priority — Jumps the Queue)

**Why this is first:** the capsule-fill audit found an ACTIVE, code-confirmed CoStar redistribution leak in production + zero fine-tuning firewall. This is legal exposure (ToU redistribution), not tech debt. It ships ahead of D3, the supply stub, FREE-WINS, everything. Item 1 is ship-today.
**Governing principle — SCOPE, DON'T STRIP:** the fix must PRESERVE the legitimate feature (a user's own CoStar upload runs the correlation engine FOR THEIR DEAL so agents get context) while CLOSING the leak (that data being pooled cross-deal and served platform-wide to non-licensees). The correct move is deal-scoping, the same treatment `market_sale_comps` already has — NOT a blunt `restricted=FALSE` filter that would break the feature.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Standing rules:** S1-01 live evidence · value identity (the fix must not change what the OWNING deal's correlation returns — only what non-owning consumers see) · both baselines · no licensed-data content in reports.

## The distinction the whole dispatch turns on
- **LEGITIMATE (must keep working):** user uploads CoStar → correlation engine runs for THEIR deal → agents read it for THAT deal's assumptions. Not redistribution — user consuming own licensed data in own deal.
- **LEAK (must stop):** that same data averaged with other operators' uploads into GLOBAL `metric_time_series`, served platform-wide as "CoStar avg" to users who never licensed it. Redistribution.
- **The fix:** restricted-vendor data feeds correlation ONLY for the owning deal/org; never enters the cross-deal global pool; and correlations DERIVED from restricted data inherit the restriction (deal-scoped output too — a CoStar-derived correlation served platform-wide is still redistribution one step removed).

## I1 · Stop the active leak — SHIP TODAY (scope, don't strip)
Root cause: `market_snapshots` has NO `deal_id` column (`20260423_proximity_events_backtest.sql:230`), so CoStar submarket data had nowhere to live except the global geography-keyed pool. Give it a deal-scoped home.
1. **Deal-scope the CoStar-derived correlation inputs:** `extractConcessionsFromSnapshots` (`concession-time-series.service.ts:44-180`) and any sibling reading `market_snapshots`/`historical_observations` for cross-deal aggregation — restricted-vendor rows must NOT flow into the GLOBAL-scoped `metric_time_series` pool. Options (agent picks the cleaner given the schema, reports which): (a) add deal/license-scope to the snapshot rows + filter the global aggregate to exclude `redistribution_restricted` rows from GLOBAL scope while a deal-scoped path serves the owning deal; (b) route restricted-derived series into a deal-scoped table (mirror the `market_sale_comps` deal_id pattern) that the correlation engine reads per-deal.
2. **Preserve the feature — PROVE it:** the owning deal's correlation output is UNCHANGED (agents still get their CoStar-informed context for that deal). Paste: same deal, correlation result identical before/after the fix.
3. **Close the leak — PROVE it:** a DIFFERENT deal / non-licensee querying the same geography no longer receives the CoStar-derived "avg" benchmark. Paste: the global-pool query no longer returns restricted-derived rows.
4. This is the confirmed active vector (iv). It ships first and alone if needed — the other items can follow same-day or next.

## I2 · Fine-tuning / prompt-logging firewall (highest cumulative-damage priority)
No barrier exists today between CoStar-derived prompt content and any future training corpus; damage is cumulative and retroactive.
1. Add a license/source field to `AICallContext` and `MeteringMetadata` (there's nothing to filter on today — this is the enabling change).
2. Redact or exclude restricted-vendor-derived content before it reaches: `ai_usage_log` content fields, `skill_chat_messages` (`skill-chat.service.ts:251-311`), and the `TrainingExample` extraction (`pattern-extractor.ts` — which reads `broker_rent`, CoStar-derivable).
3. Interim acceptable if full is large: flag-and-exclude at the log boundary NOW to stop cumulative accumulation, fuller redaction design to follow — but SOMETHING ships this pass. Paste: a CoStar-derived value in a prompt does NOT appear in the logged content (or appears redacted).

## I3 · Wire the tag into the correlation-engine read path (make it structural)
`redistribution_restricted`/`scope_id` are modeled and written correctly but read by almost nothing (only the external-share redaction + dataLibrary file browser enforce today).
1. Extend the `dataLibrary.service.ts` filter pattern (`WHERE redistribution_restricted = FALSE unless includeRestricted`) to every query reading `historical_observations`/`metric_time_series` for platform-wide (non-owning-deal) consumption — `correlationEngine.service.ts`, `metric_correlation-engine.service.ts`.
2. `metric_correlations` already carries `scope_id`/`redistribution_restricted` — enforce on read, not just store on write.
3. Derivation-chain rule (operator-confirmed): a correlation computed from restricted input is itself restricted — deal-scoped output, never platform-pooled.

## I4 · Calibration-job trace (MANDATORY — vector i, same class as the leak, currently unverified)
The audit could not confirm whether calibration jobs read restricted rows — coefficients fit on CoStar data = lineage baked into model behavior, harder to prove clean than a DB read.
1. Trace the Bayesian traffic/pricing calibration job(s) inputs — do they read `market_snapshots`/`historical_observations`/restricted rows?
2. If YES: that's a second active leak vector — add the exclusion, report the blast radius (which coefficients, fit on what).
3. If NO: document clean with the traced evidence. Either way, this is a verdict, not a "flagged for later."

## ACCEPTANCE
- I1: leak closed AND feature preserved, both PASTED (owning-deal correlation unchanged; non-owning-deal no longer gets restricted-derived benchmark). SHIP-TODAY item.
- I2: logging firewall — restricted content excluded/redacted from at least one logged path, proven; the enabling license-field added.
- I3: correlation read-path filters restricted data for platform-wide consumption; derivation-chain rule enforced.
- I4: calibration trace verdict with evidence (clean or leak-found-and-fixed).
- Both baselines green · owning-deal value identity held · no licensed content in report.

## OPERATOR-ONLY (not in this dispatch — flag for Leon)
- **Historical remediation vs future-blocking:** this dispatch stops NEW leakage and future accumulation. Whether the data ALREADY pooled in `metric_time_series`/logs needs PURGING (not just future-blocking) is a legal/counsel decision the code can't make. Flag it; don't act on it here.
- User-license attribution field (audit's lowest-priority item) — deferred; moot until platform holds its own CoStar relationship.

## OUT OF SCOPE
Supply-stub honesty fix (next after this) · FREE-WINS · D3 · Zoning · T2 · purging historical data (operator/legal call).

**Order: I1 (ship-today) → I2 → I3 → I4 → report. I1 preserves the feature while closing the leak — prove BOTH. STOP on: owning-deal correlation changing (that means you stripped instead of scoped), or any licensed content reaching a report.**
