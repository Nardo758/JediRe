# DISPATCH — CREATE-1 COMPLETION: Automation Model + Address-Collision Fix + Research Re-Trace

**Closes CREATE-1.** Bundles the automation-model implementation (operator-ruled), the address-collision property-link fix, and the re-trace that finally observes research filling a capsule end-to-end. Prereqs now met: DeepSeek topped up, Inngest healthy.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. Requires DB + a running create path + Inngest up.
**Standing rules:** S1-01 live evidence per item · honest-absence over fabrication (the invariant that held through the last trace — keep it) · value identity Bishop/Highlands · both baselines · reversible-op discipline.

## C1 · Automation model — credit-gated, per-org (operator ruling)
**Ruling:** research fires on create through the CREDIT / circuit-breaker path — automatic where the org has credits, honest-absence (null + reason) where it doesn't or where the LLM 402s. Retire the dead `automation_level >= 2` integer gate as the trigger; the gate becomes ORG CREDIT BALANCE, tied to the existing entitlement/tier model.
1. Replace the `automation_level >= 2` trigger check on the Research Agent (and Supply, same gate) with a credit-availability check against the org's balance via the existing billing/entitlement path.
2. **Credit present** → research fires on `deal.created`. **Credit absent / 402** → the circuit-breaker path already proven in the last trace engages: no fabrication, `deal_context_fields`/`year1` stay null-with-reason, deal still creates. Never silently skip WITHOUT a recorded reason (the old failure was silent skip; the new behavior is explicit "research skipped — no credits" as a visible state).
3. Preserve `automation_level` as a column if other logic uses it, but it is NO LONGER the research trigger — grep for other readers before touching, report them.
4. Tier interaction: note (don't necessarily build) how Scout/Operator/Principal credit pools govern how much autonomous research fires — flag for the billing arc if it needs wiring.

## C2 · Address-collision property-link fix (CREATE-1's last gap)
**Bug (found in last trace, reproduced live):** `properties.address_line1` has a unique constraint; the create path's insert THROWS on a duplicate address; the throw is swallowed ("never block deal creation") → second deal at same address gets NO property row, silently.
**Fix: find-or-LINK, not find-or-create-that-throws.**
1. Property resolution on create: query for an existing `properties` row by normalized address FIRST. Exists → LINK the new deal to it (the join-table row). Not exists → create, then link.
2. The unique constraint is CORRECT — keep it. The swallow is the bug — a collision now means "link to existing," not "silently no property."
3. Address normalization: define the match key (normalized `address_line1` + city + state — handle casing/whitespace/abbreviation so "464 Bishop St" and "464 Bishop Street" match or are explicitly ruled not to). State the normalization rule.
4. Two deals, same real address → both end with a property link to the SAME `properties` row. Paste the DB proof (both deals, both join rows, one property id).

## C3 · Research-fills-capsule re-trace (the proof CREATE-1 never got)
With C1 (gate open via credits) + C2 (link fixed) + DeepSeek funded + Inngest healthy:
1. Create a fresh deal from a real address, org with credits. Watch the chain fire end-to-end.
2. **Paste per-source results:** Research (`fetch_comps`, `fetch_tax_bill`, `fetch_parcel`, `fetch_ownership`) and Supply — which returned USABLE data, which returned empty, which errored. Distinguish "returned empty" (source dry for this parcel — honest-absence) from "errored" (a bug) from "never called" (gate/credit issue).
3. **Capsule fill proof:** `deal_context_fields`, `deal_assumptions.year1`, `deal_data` now POPULATED where sources returned data — paste the before (empty) vs after (filled) for the fields that filled. This is the first observation of autonomous capsule-fill; it's the point of the arc.
4. **Honest-absence still holds:** any source that returned empty/errored left null-with-reason, no fabricated value. Paste one such field.
5. Note Zoning's status (expected to still fail schema validation — that's the separate Zoning dispatch, NOT fixed here; just confirm it fails honestly without corrupting the capsule).

## ACCEPTANCE / CREATE-1 CLOSE
- C1: credit-gated research trigger live; old integer gate retired; grep of other `automation_level` readers pasted.
- C2: two-deals-one-property proof pasted; collision no longer silently drops the link.
- C3: end-to-end research trace with per-source verdicts + capsule before/after fill + honest-absence held.
- Bishop/Highlands untouched; both baselines green; test data cleaned up.
**On green: CREATE-1 CLOSES.** D3-W2+ then waits only on the F-P1 confidence window. Named residuals out of this: Zoning source-routing (own dispatch), the other-agents health (own dispatch).

## OUT OF SCOPE
Zoning fix (next dispatch — source-routing, not schema-patching) · D3-W2 agent reroute · billing-tier credit-pool wiring beyond the trigger check (flag it) · OM/history specs.
