# DISPATCH — FIX UNAUTHENTICATED PROPERTY ENDPOINT (inline-data.routes.ts:57)

**Severity:** live data-exposure. An endpoint returning the properties table appears to have no
`requireAuth`. This is independent of the multi-tenancy work — it's a present security hole and
fixes first. Verify reachability and payload LIVE before deciding the fix shape.
**Repo:** `Nardo758/JediRe.git` — branch `claude/fix-unauth-property-endpoint`, one commit.
**Verification rule (S1-01):** reachability and the fix are proven by live HTTP requests against the
running app, not by reading the route definition. "Looks unauthenticated" ≠ "is reachable
unauthenticated" (a proxy/gateway may differ).
**Report to:** `docs/audits/UNAUTH_ENDPOINT_FIX_VERDICT.md`

---

## STEP 1 — TRIAGE LIVE (READ-ONLY, determines severity + fix shape)

Before changing anything, establish the real exposure against the RUNNING app:

1. **Is it reachable unauthenticated?** Hit the `inline-data.routes.ts:57` endpoint with NO auth
   token/cookie. Paste the HTTP status + a sample of the body. 200 with data = confirmed open.
   401/403 = a gateway is catching it; lower severity, but still fix the route.
2. **What does it actually return — tenant rows or only market data?** Inspect the response:
   - If it returns the 35 tenant/owned properties (or any deal-linked rows) → **HIGH** — owned-asset
     data is public. Fix immediately.
   - If it returns only ArcGIS market-data rows → **LOWER** — public market data is far less severe,
     but the endpoint should still require auth (and may be rate/abuse exposed).
   Paste evidence of which population comes back (look for org_id / deal_id / known tenant names vs
   pure ArcGIS rows).
3. **Who calls it?** Grep the frontend + any internal caller for this endpoint path. Is it used by a
   live feature, or orphaned? `file:line`. This decides fix-vs-remove.

Report the triage verdict: HIGH (tenant data public) / LOWER (market data public) / DEAD (no caller).

---

## STEP 2 — FIX (shape depends on triage)

- **If it has a legitimate caller (live feature):** add `requireAuth`. Then decide scoping by what it
  returns — if it serves tenant properties, it ALSO needs org-scoping (but that's Track-2 property
  scoping; for THIS fix, `requireAuth` closes the public hole — note the scoping as a follow-up, do
  not build the full split here). If it serves only market data, `requireAuth` is sufficient (market
  data is global-but-authenticated).
- **If it's DEAD (no caller):** remove the route entirely. Cleaner than guarding dead code. Confirm
  no caller first (Step 1.3).
- **If unsure between the two:** default to `requireAuth` (safe, non-breaking) rather than removal,
  and flag for caller confirmation.

Cite `file:line` of the change. Do NOT bundle the Track-2 property read-scoping into this — this
dispatch only closes the unauthenticated hole.

---

## ACCEPTANCE — live HTTP

1. **Unauthenticated request now rejected:** re-hit the endpoint with no auth → expect 401/403 (or
   404 if removed). Paste status.
2. **Authenticated request still works** (if kept): hit it WITH a valid token → expect 200 and the
   intended data. Paste. (Confirms the fix didn't break a live feature.)
3. **If removed:** confirm no frontend feature broke — grep clean for the path, paste.
4. Severity + resolution recorded: was tenant data exposed (HIGH) or only market (LOWER), and how
   it's now closed.

---

## PR

- Branch `claude/fix-unauth-property-endpoint`, one commit:
  `fix(security): require auth on inline-data property endpoint` (or `remove dead unauth endpoint`)
- PR body: triage verdict (what was exposed), the live before/after HTTP (unauth rejected, auth
  works), caller status.

---

## OUT OF SCOPE

- Track-2 property read-scoping / is_market_data (separate, not launch-gating).
- The other 5 MIXED sites (those are Track-2 scoping, not open-auth holes — unless triage finds any
  of THEM also lack requireAuth, in which case flag immediately, same severity).
- property.routes.ts:357 dead-column (separate verify-dead check).

**While triaging, if ANY other property-read site is found with NO requireAuth, flag it loud — the
same hole elsewhere is the same severity. This dispatch fixes :57; report siblings.**
