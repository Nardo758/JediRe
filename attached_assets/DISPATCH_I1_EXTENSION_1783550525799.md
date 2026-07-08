# DISPATCH — I1-EXTENSION: Scope the Populated Tables (ACTIVE LEAK — Ships First)

**Why now:** the Tier-1-close queries found what code review couldn't — **23,488 CoStar-lineage rows in `metric_time_series`** and **40 in `market_snapshots`**, served platform-wide via `correlationEngine` COR-23/24/25/28/29/30 through an unscoped city-name LIKE query. This is the same structural defect I1 closed on `costar_market_metrics` — but that table was EMPTY (preventive fix), and the populated tables were never scoped. **The leak is live on real rows.** This jumps D3-W2 and everything else.
**Governing principle (operator, 2026-07-08):** *any CoStar data is for a specific deal.* Every CoStar-lineage row must be attributable to the deal whose licensed upload created it. A row that can't answer "whose deal are you?" serves no one.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. Requires real DB.
**Standing rules:** S1-01 pasted live output · **scope, don't strip** (owning deal's correlation UNCHANGED; non-owning gets nothing — prove BOTH) · no licensed-data content in reports · nothing deleted (purge is counsel's call).

## E0 · Lineage probe (read-only, FIRST — determines E2's branch)
Can the 40 `market_snapshots` CoStar rows be traced to their uploading deal?
1. Inspect their provenance columns (`data_sources`, timestamps, any upload/vendor-observation linkage). Cross-reference `vendor_market_observations` (the 1 costar row) and any upload records (`costar-upload.routes.ts` commit path artifacts) for a deal association.
2. Same for the 125 `costar_submarket_stats` rows (do they already carry deal_id? report).
3. Verdict: **LINEAGE-RECOVERABLE** (deal attribution derivable for some/all rows — list counts) or **UNATTRIBUTABLE** (no path back to an owning deal).
Paste the evidence. This is a read-only probe; do not modify rows yet.

## E1 · Structural fix — deal_id from birth, not just on read (the stronger lesson)
1. **Schema:** add `deal_id` + `is_restricted` to `market_snapshots` and `metric_time_series` (mirroring the I1 pattern on `costar_market_metrics`). Migration additive.
2. **Write path:** CoStar-lineage rows MUST carry `deal_id` at insert. Where a derivation produces a row from restricted input (`concession-time-series.service.ts` → `metric_time_series`), the derived row **inherits the source's `deal_id` and `is_restricted`** (the operator-ratified derivation-chain rule). If a derivation cannot determine a single owning deal (cross-deal aggregate), it **must not write a restricted-derived row at all** — no unattributed restricted data is created, ever again. Enforce with NOT NULL where feasible for restricted rows, or a write-path guard that throws.
3. **Read path:** `correlationEngine` COR-23/24/25/28/29/30 (and any sibling reading these tables) require a matching `dealId` to see restricted rows. No dealId → restricted rows excluded. Same guard shape as I1's four CoStar reads.

## E2 · The existing rows — operator ruling encoded, branch on E0
- **If LINEAGE-RECOVERABLE:** backfill `deal_id` on the traceable `market_snapshots`/`costar_submarket_stats` rows; propagate to their derived `metric_time_series` rows. Report counts attributed vs not.
- **Any row that remains UNATTRIBUTABLE → QUARANTINE (default, operator-ruled):** set `is_restricted = true`, `deal_id = NULL`. A NULL owner matches no deal ⇒ served to no one. Rows are preserved (not deleted) for counsel's purge decision. **Do NOT delete anything.**
- Paste: counts attributed / counts quarantined / zero deleted.

## E3 · Proof (both halves, per scope-don't-strip)
1. **Feature preserved:** an owning deal (one with attributable CoStar data, if any exists post-E2) gets its correlation output UNCHANGED vs before the fix — paste both.
2. **Leak closed:** a non-owning deal / anonymous query for the same geography receives NO CoStar-derived rows — paste the query result (empty).
3. **Quarantined rows serve nobody:** a query for their geography returns nothing from restricted rows — paste.
4. **Write-path guard fires:** attempt to create a restricted-derived row without a resolvable deal_id → blocked/throws (forced-failure proof). Paste.
5. Both compile baselines green · Bishop/Highlands outputs unchanged · no licensed content in report.

## E4 · Update the record
`docs/architecture/costar-firewall-enforcement-report.md`: add **I1-EXTENSION** section — the populated-table gap (why I1's preventive close missed it: empty table hid the defect), the structural rule now enforced (`deal_id` from birth + derivation-chain inheritance + write-path guard), row dispositions (attributed/quarantined/zero deleted), and the standing lesson: **verify with queries, never code review — a 23,488-row leak hid behind an empty sibling table.**

## OPERATOR-ONLY (flag, do not act)
- **Purge question is LIVE** (not moot): four tables hold CoStar-lineage rows (125 · 1 · 40 · 23,488). Counsel decides whether existing rows are purged and whether prior platform-wide service creates exposure. Give counsel row counts + architecture, never the data. Helpful facts: derived rows are aggregates, not raw CoStar records; the platform holds no CoStar license — data entered via operator upload under an operator's license.
- **I2 remediation upgraded to near-term:** `loadConversationHistory` replays stored assistant responses verbatim into every subsequent prompt — CoStar-derived values recirculate through the LLM continuously, not just sit in storage. Own dispatch, high priority.

## OUT OF SCOPE
Deleting any row · I2 remediation build (next dispatch) · D3-W2 (waits) · FREE-WINS/Zoning/T2.

**Order: E0 probe → E1 structure → E2 disposition → E3 proof → E4 record. STOP if the owning deal's correlation CHANGES (that means stripped, not scoped) or if any row would be deleted.**
