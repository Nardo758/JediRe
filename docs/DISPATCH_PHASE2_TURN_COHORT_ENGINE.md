# DISPATCH — Phase 2: Turn-Cohort Monthly Engine, One NOI Truth

**Arc:** F9 Underwriter Model. Follows the One-NOI-Truth Phase 1 report. Operator rulings 2026-07-03 encoded below. Fixture pinning and Excel parity remain BLOCKED until this dispatch's re-acceptance passes.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Standing rule (S1-01):** live proof; the new monthly model's realism claims are proven with pasted month-by-month series, not descriptions.

## OPERATOR RULINGS (encoded)
1. **Y1 is neither endpoint.** In-place NOI and stabilized NOI are the M09 bridge endpoints; Year 1 (and every year) derives from a REAL monthly model. The PRO FORMA tab keeps both endpoints — that's what the bridge is.
2. **The monthly model is a TURN-COHORT engine**, not an abstract ramp: units bucketed by lease-expiry month; expiring cohorts re-price to the market-rent trajectory; non-expired cohorts hold in-place rent; vacant-unit absorption paced by the `months_to_stabilization` chain (existing, Traffic-fed). `ramp(t)` becomes an OUTPUT. No unit-level simulation — cohort math only. M07/Lease Velocity remains the absorption input, not re-implemented.
3. **Downtime is modeled, two classes:** standard turn (make-ready days, platform default ~14d, ruleset) and renovation turn (weeks, derived from the strategy overlay's reno schedule where present). Optional new-lease concession per turn (default 0). All provenance-tagged assumptions.
4. **Growth-rate source is LayeredValue:** `market_rent_growth` sourceable from CPI (FRED), CE outputs, source-material extrapolation, or owned-asset performance — each with its provenance tag; owned-asset-derived values tagged as user-lane data; user override wins.
5. **`year1.noi` semantics repaired:** the field is the IN-PLACE endpoint and gets named/documented as such (`in_place` endpoint vs `stabilized` endpoint); nothing named "year 1" stores an endpoint again.
6. **Compile guard: hook AND CI** (pre-push `tsc --noEmit --skipLibCheck` hook + CI gate in the harness slot).

## W1 · Expiry ladder + assumption schema
1. Expiry ladder source: extracted rent roll lease dates where present (provenance `document`); uniform 1/12 monthly distribution default otherwise (provenance `platform_default`). Ladder is derived at build time, never stored as independent truth.
2. New assumptions (LayeredValue pattern, ruleset defaults): `standard_turn_downtime_days` (14), `reno_turn_downtime_weeks` (from overlay schedule; standalone default 6 if flagged reno without schedule), `new_lease_concession` (0), `market_rent_growth` (per ruling 4), `annual_turnover_rate` for post-stabilization steady-state turns (default per asset-class ruleset).

## W2 · The monthly engine (replaces yearly÷12 in `computeMonthOperating`)
Per month m: expiring cohort count (ladder) + vacant-absorption count (stabilization pace) → turned units re-price at market_rent(m); turn downtime removes turned units' revenue days; occupied non-turned units at in-place; vacancy/concessions/bad-debt on the resulting revenue; opex steps/inflates (no fake monthly noise). NOI(m) emerges. Yearly rows = Σ months — the identity becomes REAL. Loss-to-lease burns off only as fast as the ladder + pace allow.
Value-add case: reno turns consume units per the overlay schedule with reno downtime — the J-curve dip must be visible in the output for a deal with a reno plan.

## W3 · Overlay root cause (the $243K-vs-$70K contradiction)
Before re-wiring: trace why the ribbon showed $70,019/mo while the model's monthly said $243,507 — stale overlay, failed trigger, or divergent builds. file:line + the event history. The trigger-not-wired class gets a named root cause, then the seed consumes the NEW engine months with a value-equality proof (seed m == engine m, pasted, multiple months, both deals).

## W4 · Semantics + guards
Ruling 5 field repair (migration + read-site updates, enumerated). Ruling 6 hook + CI gate installed; proof: a deliberately-broken branch fails both.

## W5 · RE-ACCEPTANCE (full runbook Phases 1–2 re-run + realism checks)
All prior Phase 1–2 steps re-run with the new engine, PLUS:
1. **Bishop month series pasted (m1–m36):** starts near in-place run-rate, climbs as ladder turns + vacants absorb, reaches stabilized band; no cliff at any boundary; Y1 total strictly between in-place×12 and stabilized×12.
2. **Downtime visible:** a month with heavy scheduled turns shows the revenue dent; toggling reno schedule on/off changes the path (paste both).
3. **Highlands (stabilized):** turn engine degenerates gracefully — steady-state turnover only, values within canary tolerances (2026-04-01 / 57.17% / $6,315,308 unchanged). BLOCKER.
4. Capital-structure matrix (R3 fix) still agrees everywhere.
5. Tri-tab identity re-verified — now meaningful (months are not constant within years; paste variance).
6. THEN AND ONLY THEN: fixture pinning + property tests + Excel parity (oracle values from operator).

## OUT OF SCOPE
Unit-level simulation · M07 re-implementation · seasonal vacancy curves (v2) · owned-asset downtime calibration (v2 — flagged: Highlands actuals may contain turn-cost signal) · deal_data hygiene · F-P1.
