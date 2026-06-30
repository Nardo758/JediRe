# DISPATCH — F5a ADMIN-AUTH CLASSIFICATION + F2/F3 REVERIFY (READ-ONLY)

**Mode:** READ-ONLY. Classify, reverify, report. Consolidate nothing, fix nothing.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Evidence rule (S1-01):** behavior claims carry `file:line` of the actual check body, or live-instance
proof. "Same name → same behavior" is an assumption to test, not accept.
**Report to:** `docs/audits/F5a_ADMIN_AUTH_CLASSIFICATION.md`

This dispatch does two independent things. Keep them separate in the report.

---

## PART 1 — F5a: what do the six admin guards ACTUALLY check?

The six sites use three names across seven routes. Names are not behavior. Read each middleware's
BODY and classify by what it verifies.

Sites (verify this list against HEAD first — route files have moved before):
- `admin.routes.ts:35` — `requireAdmin` (inline)
- `admin-data-coverage.routes.ts:15` — `requireAdmin` (async variant)
- `dot-admin.routes.ts:12` — `requireAdminAuth`
- `atlanta-url-discovery.routes.ts:9` — `requireAdminAuth`
- `correlation.routes.ts:26` — `requireAdminApiKey`
- `admin-api-key.routes.ts:17` — `requireAdminApiKey`
- `ingestion.routes.ts:22` — `requireAdmin`

For EACH, trace to the middleware definition and record:

| field | content |
|---|---|
| site | `file:line` |
| name | the symbol used |
| definition | `file:line` of the middleware body |
| mechanism | what it actually checks — session role? `users.role='admin'`? a static API key/env secret? a header? JWT claim? |
| failure mode | what an unauthorized caller gets (401/403/silent pass) |
| bucket | see below |

**Bucket by MECHANISM, not by name.** Likely the seven collapse into distinct behaviors such as:
- **SESSION-ADMIN** — authenticated user whose role/flag = admin
- **API-KEY** — static secret / env key, no user identity (machine-to-machine)
- **OTHER/HYBRID** — anything that doesn't cleanly fit, or mixes both

**The finding that matters:** does the `requireAdmin` name map to ONE mechanism everywhere, or do
same-named guards check different things? And critically — is any route that SHOULD be
session-admin actually behind only an API-key (or vice versa)? Flag any route whose mechanism looks
mismatched to its purpose (e.g. a human-facing admin route gated by a static key, or a
machine-ingestion route gated by session role).

**Do NOT recommend a consolidation target yet.** The deliverable is "there are N actually-distinct
checks, here's which route uses which, here are the M mismatches." The consolidation design is a
separate dispatch that depends on this count.

---

## PART 2 — F2 / F3 live-instance reverify (the two with security cost)

The A9 table reports six findings CLOSED with `file:line`. Two carry privilege/automation
consequence and are being signed off by a different session than fixed them. Reverify these two
against the RUNNING app, not the source.

**F2 — tier derives from UCB, not request body.**
The claim: `inline-deals.routes.ts:455` sets `userTier` from `balance?.subscriptionTier`, not
`req.body`. Prove it at runtime:
- Send a deal-create (or the relevant) request with a FORGED `tier`/`subscriptionTier` in the body
  set to a higher tier than the calling user's actual UCB tier.
- Confirm the created/affected row reflects the user's REAL UCB tier, not the forged one. Paste the
  request body sent and the resulting row's tier from a live DB query.
- Expected: forged value ignored; real tier wins. If the forged value takes effect → F2 is NOT
  closed, report immediately.

**F3 — automation_level rises on real tier upgrade.**
The claim: `creditService.ts:287` sets `automation_level = config.maxAutomationLevel` on tier
update. Prove the pipeline actually goes live:
- Take a test user at a low tier, trigger a real tier upgrade through the actual upgrade path.
- Query the user's `automation_level` before and after. Paste both.
- Expected: it rises to the new tier's max. If it stays flat → the event-driven agent pipeline is
  still dark for upgraded users → F3 NOT closed, report immediately.

The other four CLOSED findings (F1, F4, F6, F2b) ride on their existing `file:line` evidence — do
NOT reverify them here unless Part 2 turns up something that implicates them.

---

## PART 3 — F5b (record only, do not investigate)

Note in the report that F5b (non-admin roles investor/developer/flipper/broker stored but checked
nowhere) remains an OPEN PRODUCT DECISION: does `role` gate anything, or does tier do all
entitlement work? One line. Do not trace it, do not fix it — it's a human decision, logged as a
known open item so "roles checked nowhere" doesn't sit silently in the codebase.

---

## DELIVERABLE

- SHA + READ-ONLY header
- **Part 1:** the classification table; a count of actually-distinct mechanisms; an explicit list of
  any mechanism/purpose MISMATCHES (the security-relevant findings)
- **Part 2:** F2 and F3 each marked CONFIRMED-AT-RUNTIME or FAILED, with pasted request + DB output
- **Part 3:** the one-line F5b open-item record
- **Summary:** is A9 safe to sign as closed (F2/F3 hold at runtime), and how many distinct admin
  checks F5a really has

**STOP at the report.** Consolidation design and F5b's product decision are separate, human-approved
next steps. If Part 2 fails on either F2 or F3, that jumps ahead of everything — report it loud.
