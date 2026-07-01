# DISPATCH — STRUCTURAL: BLANKET AUTH ON /api/v1 + PUBLIC ALLOWLIST (TWO-PHASE, GATED)

**Why:** `/api/v1` is public-by-default with per-route auth opt-in. This produced a real leak
(`/properties`), false-alarm-but-fragile cases (exports), and an ACCIDENTAL shield (`/markets/...`
protected only by another router's mount-order side-effect). Result: you cannot currently reason
about which routes are safe without simulating Express mount order. This fix inverts the default —
auth-by-default + an explicit public allowlist — so route safety becomes READABLE, not coincidental.
**Shape:** PHASE 1 READ-ONLY enumerates every genuinely-public route that MUST be allowlisted (or the
floor breaks it), hard stop. PHASE 2 adds the floor + allowlist on approval, with live proof.
**Repo:** `Nardo758/JediRe.git` — branch `claude/structural-blanket-auth`.
**Verification rule (S1-01):** proven by live HTTP — public routes still 200, everything else now
401-by-default — not by reading the middleware chain.
**Report to:** `docs/audits/BLANKET_AUTH_VERDICT.md`

---

## THE DANGER THIS FIX CARRIES (read first)

Adding `requireAuth` at the `/api/v1` mount will 401 EVERY route that is supposed to be public unless
it's on the allowlist. Get the allowlist wrong and you break: token-share links, genuinely-public
market/reference endpoints, health checks, the dev-login/auth routes themselves, webhooks. So the
allowlist enumeration (Phase 1) is the whole risk. Under-list → break public features. Over-list →
leave holes. Phase 1 must be exhaustive before Phase 2 runs.

---

## PHASE 1 — ENUMERATE THE PUBLIC ALLOWLIST (READ-ONLY, STOP)

**1. Every `/api/v1` route + its current auth reality.** From the sibling sweeps + a full pass:
```
grep -rniE "router\.(get|post|put|patch|delete)\(|app\.(get|post|use)\(" backend/src --include=*.ts | grep -iE "/api/v1|routes"
```
Build the complete route inventory: path, method, current auth (inline / mount-prefix-accidental /
none). Mark which are currently protected ONLY by an accidental mount-order prefix guard (like
`/markets/...`) — those are the ones silently relying on coincidence.

**2. Classify each route into exactly one:**
   - **MUST-BE-PUBLIC** — has to serve unauthenticated by design. Candidates:
     - auth/login routes (`/auth/*`, dev-login) — can't require auth to log in
     - token-share links (capsule token export B2b/B3d — auth is the token, not a session)
     - health/status/ping
     - webhooks (Stripe `customer.subscription.*`, Twilio inbound) — authenticated by signature, not
       session; a session `requireAuth` would BREAK them. **Critical — find every webhook.**
     - genuinely-public market/reference reads, IF any are intended public (confirm — most should be
       auth'd)
   - **MUST-BE-AUTHED** — everything else. The default.
   For each MUST-BE-PUBLIC, state WHY and what authenticates it instead (token, signature, nothing).
   `file:line`.

**3. Webhooks are the highest-risk allowlist item — enumerate exhaustively.**
   A blanket session-auth floor will 401 Stripe/Twilio webhooks and silently kill billing +
   messaging. Grep every webhook handler:
   ```
   grep -rniE "webhook|/stripe|/twilio|subscription\.|signature|svix|x-signature" backend/src --include=*.ts
   ```
   List each, its path, and how it authenticates (signature verification). ALL must be allowlisted
   from session-auth. Missing one = a broken webhook that fails silently until billing/SMS stops.

**4. Propose the implementation (write, do NOT run):**
   - The mount-level guard approach: a single `app.use('/api/v1', conditionalAuth)` where
     `conditionalAuth` checks the request path against the allowlist and calls `requireAuth` for
     everything not on it — OR an explicit allowlist-router-first ordering. State which fits the
     codebase with least risk.
   - The exact allowlist (paths + why public + what authenticates them).
   - Confirm the existing accidental prefix-guards (`buildingEnvelopeRoutes`, `propertyProxyRoutes`
     broad mounts) — do they get REMOVED once the intentional floor lands, or left? (Prefer remove:
     the accidental shields become dead once the real floor exists, and leaving them preserves the
     mount-order fragility.)

**=== HARD STOP. Phase 1 deliverable: full route inventory, the exhaustive MUST-BE-PUBLIC allowlist
(especially every webhook + token route + auth route), the proposed floor mechanism, and the list of
accidental guards to remove. Approve the allowlist before Phase 2 — an incomplete allowlist breaks
production. ===**

---

## PHASE 2 — ADD THE FLOOR (ONLY ON APPROVAL)

1. Implement the auth-by-default floor + the approved allowlist.
2. Remove the now-redundant accidental prefix-guards (if Phase 1 said remove).
3. **Live acceptance — the floor works AND nothing public broke:**
   - **Default-deny proof:** 3+ previously-unauth'd-by-accident routes (incl. `/markets/...` and any
     that relied on the prefix side-effect) → now 401 unauth by the INTENTIONAL floor. Paste.
   - **Allowlist proof — every MUST-BE-PUBLIC still works unauth:**
     - auth/login → still reachable. Paste.
     - a token-share export via valid token → still 200. Paste.
     - **every webhook** → still accepts a correctly-signed request (or at least is NOT 401'd by the
       session floor). Test each with a signature-valid or minimal call; a 401 here = BROKEN billing/
       messaging. Paste per webhook. THIS IS THE ACCEPTANCE THAT MATTERS MOST.
     - health/status → still 200.
   - **Authed routes still work:** a normal authenticated request to a private route → 200. Paste.
4. If ANY webhook or auth route 401s after the floor → STOP, it's a broken allowlist, report before
   merging. Do not ship a floor that kills webhooks.

---

## DELIVERABLE

- SHA + Phase 1 inventory + allowlist (webhooks exhaustively listed) → STOP
- Phase 2 (post-approval): floor implemented, accidental guards removed, live proof that
  default-deny works AND every public/webhook/auth/token route still serves
- One-line: /api/v1 is now auth-by-default; N routes allowlisted public (M webhooks, K token, etc.);
  auth is now readable from the allowlist, not mount order

---

## OUT OF SCOPE

- PREEXIST-AUDIT-POOL (broken audit import) — separate, though it can ride the same branch if trivial;
  flag don't bundle.
- MARKET-ENHANCED-INLINE-AUTH — subsumed by this fix (the accidental shield becomes irrelevant once
  the real floor exists); note it as resolved-by-structural.
- Org cleanup, deal_id/org_id scoping pass — separate Track-1 items, resume after this.
- Deal/property org-scoping — this is the AUTH floor (are you logged in), NOT tenant-scoping (can you
  see THIS org's data). Different layer. Do not add org-scoping here.

**Phase 1 read-only ends at STOP. The allowlist is the risk — an incomplete one breaks webhooks/login
in production. Phase 2 runs only on explicit approval of the allowlist, and its acceptance is proving
every public route (especially webhooks) still serves after the floor lands.**
