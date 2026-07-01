# DISPATCH — BLANKET AUTH PHASE 2: IMPLEMENT FLOOR + ALLOWLIST (GATED)

**Runs only after Phase 1's allowlist enumeration (done).** Replaces the ACCIDENTAL floor
(`routes/index.ts:176`, `requireAuth requireWeb` on documentsFilesRoutes leaking to all post-line-240
routes) with an INTENTIONAL auth-by-default floor + explicit public allowlist. Auth becomes readable
from the allowlist, not mount order.
**Repo:** `Nardo758/JediRe.git` — branch `claude/structural-blanket-auth`.
**Verification rule (S1-01):** proven by live HTTP — public routes 200, cost/private routes 401
unauth, webhooks accept signed calls — not by reading middleware.
**Report to:** `docs/audits/BLANKET_AUTH_PHASE2_VERDICT.md`

---

## DECISIONS BAKED IN (C1–C5 resolved)

- **Cost-incurring routes → AUTH-REQUIRED.** Principle: any route that incurs external/metered cost
  must be attributable so it can be billed or capped — never anonymous. `/geocode`, `/zoning/lookup`,
  `/analyze`, and any other route hitting a paid third-party API (Google Places, county GIS, ATTOM,
  RentCast, etc.) are NOT allowlisted → they fall under the floor → auth-required. (Metering them to
  the credit system is the SEPARATE cost-surface audit, not this dispatch. This dispatch only ensures
  they're behind auth so metering is possible.)
- **Floor uses `requireAuth` ONLY, not `requireAuth requireWeb`.** The accidental floor's `requireWeb`
  blocks agent + API-key callers from private routes. The intentional floor must be plain
  `requireAuth` so surface-gating (web vs chat vs api) stays a per-route concern, not a blanket one.
- **`/deals/:dealId/deal-book` (capsule):** confirm intentionally token-gated (mounts pre-floor at
  line 116). Leave as token-gated; document it — do not let its safety rest on mount order silently.
- Accidental prefix-guards → converted to specific-path mounts AFTER the floor proves live (step 4).

---

## THE ALLOWLIST (from Phase 1 — 17 prefixes, public by design)

Only these serve unauthenticated. Everything else under `/api/v1` requires auth by default.
- `/auth/*` — login/register (can't auth to log in)
- `/ticker`, `/time-series`, `/data-macro`, `/driver-analysis`, `/derived-metrics`, `/columns` —
  public market data (validatePublicQuery); currently 401-broken, this FIXES them
- `/microsoft/auth/callback` — OAuth callback; currently 401-broken, this FIXES it
- `/oppgrid/*` (read routes) — public market intelligence
- `/shares`, `/capsule-links`, `/capsules` — token-gated capsule sharing (token IS the auth)
- `/webhooks/notarize` — HMAC-verified
- `/clawdbot/*` — HMAC-verified (command + query)
- `/grid-templates` — optionalAuth (serves both)

**NOT on the allowlist (fall under the floor, auth-required):** geocode/zoning/analyze (cost),
and every other private route.

---

## IMPLEMENTATION

1. **Add the intentional floor.** A single mechanism that applies `requireAuth` to all `/api/v1/*`
   EXCEPT the allowlisted prefixes. Prefer: mount the allowlisted public routers FIRST, then
   `app.use('/api/v1', requireAuth)` as the floor, then all private routers after. OR a
   path-allowlist middleware. Pick the one that fits the current mount structure with least
   reordering risk. `file:line`.
2. **Do NOT remove the accidental floor / prefix-guards yet** — leave them until the intentional
   floor is proven live (step 3). Removing first opens a gap.
3. **Prove the floor live (acceptance, below).**
4. **Only after acceptance passes:** convert the 16 accidental broad-prefix guards
   (`app.use('/api/v1', requireAuth, X)`) to specific-path mounts
   (`app.use('/api/v1/<specific>', requireAuth, X)`) so they stop side-effect-shielding. Re-run the
   floor acceptance after cleanup to confirm nothing opened.

---

## ACCEPTANCE — live HTTP (the allowlist is the risk)

**A. Default-deny works (the floor):**
   - 3+ private routes that were only accidentally-shielded (incl. a post-line-240 route and
     `/markets/...`) → 401 unauth by the INTENTIONAL floor. Paste.
   - geocode/zoning/analyze → 401 unauth (cost routes now behind auth). Paste.

**B. Every allowlisted public route STILL serves unauth (the thing that breaks if allowlist wrong):**
   - `/auth/*` login → reachable. Paste.
   - the 6 validatePublicQuery routes (`/ticker` etc.) → now 200 unauth (were 401-broken). Paste —
     this is the fix-as-side-effect, confirm it.
   - `/microsoft/auth/callback` → reachable unauth (was 401-broken). Paste.
   - `/oppgrid` read → 200 unauth. Paste.
   - a `/shares` or `/capsule-links` token route → serves via valid token. Paste.
   - **`/webhooks/notarize` and `/clawdbot`** → accept a correctly-signed/HMAC request, NOT 401'd by
     the floor. Paste each. (Only 2 webhooks under /api/v1; Stripe/Twilio/Telegram/Inngest are
     outside it and untouched — confirm one Stripe call still works as a sanity check.)

**C. requireWeb no longer over-blocks:**
   - an agent/API-key caller (non-web surface) → can now reach a private route it should, where the
     accidental `requireWeb` floor previously blocked it. Paste before/after if reproducible, or
     confirm the floor uses requireAuth-only.

**D. Authed happy path:**
   - normal web user, valid token, private route → 200. Paste.

**If ANY allowlisted route (esp. the 2 webhooks or /auth) 401s after the floor → STOP, broken
allowlist, report before merge.**

---

## DELIVERABLE

- SHA + the floor mechanism (`file:line`), allowlist as implemented
- Acceptance A–D pasted (default-deny + every public route serves + requireWeb fix + authed happy)
- Step-4 cleanup: the 16 accidental guards converted, floor re-proven after
- One-line: `/api/v1` is auth-by-default; N public routes allowlisted; 6 broken public routes + OAuth
  callback now fixed; cost routes (geocode/zoning/analyze) now auth-required; auth readable from
  allowlist not mount order

---

## OUT OF SCOPE

- **Cost-surface audit / metering** — the NEXT dispatch. This only puts cost routes behind auth so
  they CAN be metered; it does not wire them to the credit system.
- PREEXIST-AUDIT-POOL — separate (can ride the branch if trivial, don't bundle).
- Deal/property org-SCOPING — different layer (tenant-scoping, not auth-floor). Not here.
- Org cleanup — separate Track-1 item.

**The allowlist is the whole risk — an incomplete one breaks login/webhooks/OAuth/public-data in
production. Acceptance B is the proof that matters: every public route still serves after the floor.
Convert accidental guards only AFTER the floor is proven, then re-prove.**
