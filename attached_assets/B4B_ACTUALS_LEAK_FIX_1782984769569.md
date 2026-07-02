# DISPATCH — FIX: PRIVATE-ACTUALS LEAK ON SHARED PUBLIC PROPERTIES

**From B4b verification.** Three reads join to PRIVATE actuals through a SHARED PUBLIC property by
bare `property_id` with NO owner scope. They don't leak TODAY (single org) but become live
cross-operator leaks the instant a second operator has actuals on the same public property — i.e.
they fire exactly when multi-org onboarding succeeds. Close them now, before a second operator
exists. Same pattern as B4a deal-scoping: scope the PRIVATE side by the caller's deal/org; the public
property stays global.
**Plus a rider:** PUT/DELETE on `properties` have no ownership check (data-integrity, not privacy) —
any user can overwrite/delete shared market rows. Addressed as Part C.
**Repo:** `Nardo758/JediRe.git` — branch `claude/fix-actuals-leak`.
**Verification rule (S1-01):** proven LIVE — the scoped read returns only the caller's actuals for a
shared property; a second-org row (real or synthetic) does NOT appear. Not by code reading.
**Report to:** `docs/audits/ACTUALS_LEAK_FIX_VERDICT.md`

---

## THE PATTERN (all three sites are the same bug)

A public property P is a shared join key. Private actuals hang off it keyed by `property_id`. The
leak read:
```
SELECT ... FROM deal_monthly_actuals WHERE property_id = <public P>   -- returns EVERY org's actuals
```
The fix: scope the private side by the caller's ownership, the way the CORRECT reads already do
(via `deal_id` or a `deal_properties` JOIN that ties actuals to the caller's deal/org). The public
property stays global; only the private actuals get filtered.

## PART A — FIX-1: financial-documents.routes.ts:270

1. Read the current query + its handler's auth context (what caller identity is available —
   `req.user`, deal_id, org). `file:line`.
2. Scope the actuals read to the caller's deal/org — join through `deal_properties`/`deal_id` to the
   caller's deal, or filter by the caller's org via `resolveOrgForUser` (the SAME resolution deals +
   entitlement use — one identity path, no new resolver). `file:line`.
3. If the endpoint is inherently deal-scoped (it's a deal's financial documents), the deal_id is
   already in scope — use it. If it's property-first, resolve caller org and filter actuals to it.

## PART B — FIX-2: the Cashflow Agent portfolio reads

`fetch_owned_asset_actuals.ts:205` reads portfolio actuals across ALL orgs;
`fetch_owned_asset_opex_ratios.ts:64` inherits the same unscoped property_ids.
1. **Thread the caller's org through the agent read.** The agent runs on behalf of a deal/user — that
   run has a RunContext (org/user/deal, per B2a's attribution). Pass the caller org into the actuals
   fetch and filter `deal_monthly_actuals` to it. `file:line` both files.
2. **Both files must be fixed together** — opex-ratios inherits actuals' property_ids, so fixing only
   actuals leaves opex reading the unscoped set. Confirm the org filter flows into BOTH.
3. Agent caveat: the Cashflow Agent computes on the CALLER's portfolio, not the platform's — so
   scoping to the caller's org is correct behavior, not a restriction. Confirm no legitimate
   cross-org aggregation is intended here (if the agent is SUPPOSED to see platform-wide actuals for
   benchmarking, that's a DIFFERENT read that must go through the anonymized/aggregated path, NOT raw
   per-org actuals — flag if you find that intent).

## PART C (rider) — property write-auth gap (data-integrity)

PUT/DELETE on `properties` lack an ownership/role check — any user can overwrite/delete shared public
market rows.
1. `file:line` the PUT and DELETE property handlers.
2. Add an authorization guard: who may mutate a public property row? Options — platform/admin only
   (market data is platform-owned, so arguably NO user should DELETE a market row), or the
   creating/owning user for user-added property metadata. Decide the rule (likely: market-data rows =
   admin/platform-write only; user-added address metadata = owner-writable). State the rule, apply
   it. This is data-integrity on the shared corpus, not privacy — lower stakes, but "any user can
   delete market rows" shouldn't ship.
3. If the write-auth rule needs a product decision (who owns user-added property metadata), FLAG it
   rather than guessing — but at minimum block unauthenticated/cross-user DELETE of platform rows.

---

## ACCEPTANCE — live, the isolation proof

The B4b proof was analytic (single org, scoped==unscoped==53 on Highlands). Make it REAL:
1. **Construct a two-org scenario on a shared property:** Operator A (org dd201183) has actuals on a
   public property P. Create a second org B with its own actuals on the SAME property P (synthetic
   test rows, real deal_ids). Paste the setup.
2. **FIX-1 scoped:** call the financial-documents read as an org-A caller for property P → returns
   ONLY A's actuals, NOT B's. Paste the row counts (A's n, not A+B). Then as org-B → only B's.
3. **FIX-2 scoped:** run the Cashflow Agent actuals + opex fetch for an org-A context on property P →
   returns only A's portfolio actuals, not B's. Paste.
4. **The delta proof:** show that BEFORE the fix the unscoped read returned A+B (the leak), AFTER it
   returns only the caller's. This is the concrete "leak closed" evidence B4b could only show
   analytically. Paste before/after counts.
5. **Part C:** a non-authorized user's DELETE/PUT on a platform property row is rejected. Paste.
6. **No over-scoping:** the legitimate owner still sees ALL their own actuals for P (the fix filters
   OTHER orgs, not the caller's own). Paste — dd201183 still sees its 53 (or full set) for Highlands.
7. Clean up synthetic org B + test rows.

---

## DELIVERABLE

- SHA + Part A/B/C fixes (`file:line` each)
- Live acceptance: two-org shared-property isolation proven REAL (not analytic) — caller sees only
  own actuals, second org's hidden; before/after delta; owner not over-scoped; write-auth enforced
- One-line: three actuals-leak reads scoped to caller org; cross-operator isolation proven live on a
  shared property; property write-auth gap closed; boundary now holds at multi-org

---

## OUT OF SCOPE

- Properties org_id column — RETIRED (B4b). Not needed; these fixes scope the PRIVATE side, property
  stays public.
- B5 Institutional polish.
- Anonymized/aggregated platform-wide benchmarking reads (if any) — different path, not these raw
  per-org reads.

**The proof that matters: acceptance #4 — before the fix, unscoped returns A+B on a shared property;
after, only the caller's. That's the latent multi-org leak closed and proven REAL, not analytic. These
land BEFORE a second operator onboards — they're armed to fire exactly when you succeed at multi-org.**
