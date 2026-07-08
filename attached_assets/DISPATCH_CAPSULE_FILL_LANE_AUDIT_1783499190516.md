# DISPATCH — CAPSULE DATA-FILL LANE AUDIT (Read-Only)

**Purpose:** The provisioning audit mapped OUTBOUND fetch (what the platform pulls). This maps the INBOUND lane — user-uploaded data filling capsule gaps — and answers a specific product question: *can a user with their own CoStar license upload CoStar data to fill their deal's gaps, safely?* The answer is "yes IF it stays deal-scoped, user-license-tagged, and firewalled from the platform corpus" — this audit verifies whether the code actually enforces those three, or only assumes them. Read-only: map, verdict, STOP.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Standing rules:** S1-01 file:line evidence · never paste secret/licensed data content · verify counts. No fixes.

## PART A — Consumption-surface mapping (the breakdown the provisioning audit skipped)
Draw the line the last audit didn't: which data feeds the **terminal** (platform-global surfaces — every user sees) vs the **deal capsule** (deal-scoped — one deal, one owner).
1. For each major data category (comps, tax/parcel, supply, market metrics, zoning, rent), which surface consumes it and at which scope? Table: category → terminal-global | capsule-deal-scoped | both → file:line of the read.
2. **`properties` table (platform-public) vs capsule data (deal-private):** confirm the Lane A/Lane B boundary the earlier work established — `properties` is global, user-provided/uploaded is deal-scoped. Which reads cross the line, if any?

## PART B — Uploaded-data-fills-gaps flow (the core question)
When a user uploads a document/export into a capsule, trace how it fills a data gap:
1. **Upload → extraction → gap-fill path:** file:line. When an uploaded value fills a field that a platform source left empty, what's the mechanism? Does uploaded data have priority over (or merge with) platform-fetched data in the resolution stack?
2. **Deal-scoping enforcement:** does uploaded data stay bound to THIS deal, or can it flow into `properties`, aggregated benchmarks, market_inventory, or any cross-deal surface? Trace every write path an uploaded value can reach. THIS IS THE CRITICAL CHECK — uploaded data escaping deal scope is a Lane B → Lane A leak.
3. **Provenance tagging:** does an uploaded-data-derived value carry provenance recording it came from a user upload (vs platform fetch)? Can a downstream consumer tell "user gave us this" from "platform fetched this"?
4. **broker_claims/actuals discipline on uploads:** an uploaded comp is a comp, not a verified actual — does the upload path respect the broker_claims boundary, or can an uploaded projection land in an actuals field?

## PART C — CoStar-restricted enforcement (the specific posture question)
The `costar.vendor.ts` parser tags uploads `licensePosture: 'restricted'`. Does that tag DO anything, or is it cosmetic?
1. **Trace the `restricted` tag downstream:** once CoStar data is parsed and tagged restricted, what enforces the restriction? Grep every consumer of the licensePosture field. Is restricted-tagged data actually BLOCKED from: (a) the `properties`/global tables, (b) aggregated benchmarks, (c) re-export (SHARE-1/EXPORT-1 paths), (d) any other deal?
2. **The four leak vectors, re-checked for UPLOADED CoStar specifically** (distinct from the provisioning audit's outbound check): (i) calibration against CoStar numbers, (ii) CoStar values pasted into LLM prompts, (iii) manual entry of CoStar-sourced records, (iv) aggregated benchmarks derived from CoStar. For uploaded-and-tagged-restricted data — is each vector blocked by ENFORCEMENT or only by convention?
3. **Fine-tuning corpus firewall (the hard one):** if prompts/outputs are logged for a future fine-tuning corpus, does restricted-tagged (or ANY user-uploaded licensed) data get EXCLUDED from that logging? This is the distillation risk — CoStar lineage carried into weights is the hardest leak to prove clean. Does the logging path filter by licensePosture, or does everything get logged indiscriminately?
4. **User-license vs platform-license distinction:** does the system record that uploaded CoStar is under the USER'S license (their right to use in their deal), never the platform's? Is there anywhere the platform would treat user-uploaded CoStar as platform-licensed (which would be the violation)?

## PART D — The verdict the product question needs
Synthesize: is the "users fill their own gaps with their own CoStar upload" model SAFE AS-BUILT, or does it need enforcement work first?
- If deal-scoping + restricted-enforcement + fine-tuning-exclusion all hold by ENFORCEMENT → safe, document why.
- If any hold only by CONVENTION (tag exists but nothing enforces it) → that's the work needed before the model is safe; name each gap as a FIX item.

## DELIVERABLE + STOP
`docs/audits/CAPSULE_FILL_LANE_AUDIT.md`: Part A surface-map table · Part B upload-fill flow with the deal-scoping leak check · Part C CoStar-restricted enforcement trace (the four vectors + fine-tuning firewall, enforcement-vs-convention per item) · Part D safe-as-built verdict. End with:
- **ENFORCED list:** protections that actually hold in code.
- **CONVENTION-ONLY list:** tags/intentions with no enforcement — the gaps.
- **FIX list:** what's needed to make user-CoStar-fill safe (prioritized: fine-tuning firewall and deal-scoping leaks first — those are the ToU-violation vectors).
**STOP. No fixes. No licensed-data content in the report.**

## OUT OF SCOPE
Any fix/wiring · the supply-stub honesty fix (separate priority dispatch) · FREE-WINS wiring · activating subscriptions · building the upload UI.

**Read-only. The verdict tells the operator whether user-uploaded-CoStar-fills-gaps ships as-is or needs an enforcement arc — and specifically whether the licensePosture tag is real or cosmetic.**
