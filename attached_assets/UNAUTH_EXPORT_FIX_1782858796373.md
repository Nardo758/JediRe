# DISPATCH — CLOSE UNAUTHENTICATED EXPORT ENDPOINTS (SECURITY)

**Severity:** live data-exposure, same class as the `/properties` hole. Three export routes serialize
PRIVATE financial data with no auth floor (CONFLICT-1/-2/-3 from the classification merge). Export is
worse than list: it dumps the full artifact (proforma, audit trail). Fix now, independent of all
tenancy work.
**Repo:** `Nardo758/JediRe.git` — branch `claude/fix-unauth-export-endpoints`, one commit.
**Verification rule (S1-01):** reachability + fix proven by live HTTP against the running app, not by
reading route definitions. A gateway may catch some — confirm per endpoint.
**Report to:** `docs/audits/UNAUTH_EXPORT_FIX_VERDICT.md`

---

## THE THREE KNOWN HOLES

| # | route | current | classification of data |
|---|---|---|---|
| 1 | `GET /api/v1/financial-model/:dealId/export/excel` | NO auth | PRIVATE proforma |
| 2 | `POST /api/v1/audit/export/:dealId` | NO auth | PRIVATE audit trail |
| 3 | `POST .../grid/export` (grid.routes.ts) | optionalAuth (no floor) | MIXED |

---

## STEP 1 — TRIAGE LIVE (per endpoint, READ-ONLY)

For EACH of the three, against the RUNNING app:
1. **Reachable unauthenticated?** Hit it with no token. Paste status + body sample. 200 w/ data =
   confirmed open. 401/403 = a gateway catches it (lower severity, still fix the route).
2. **What does it return?** Confirm it's real private data (a real deal's proforma/audit/grid), not
   empty. For the `:dealId` routes, use a known real deal id (one of the 28 in org `dd201183`).
   Paste evidence of the private payload exiting.
3. Rank each: CONFIRMED-OPEN (200, private data) vs GATEWAY-GATED (401 upstream).

## STEP 2 — SIBLING SWEEP (the pattern is the real finding)

Four unauthenticated holes so far (`/properties`, `/markets`, + these) all share one root cause:
routers mounted at `/api/v1` WITHOUT blanket auth, opting into `requireAuth` per-route. Find the rest
before they're found in production:
```
grep -rniE "export|download|/pdf|/excel|/csv|/report|/book" backend/src --include=*.routes.ts
grep -rniE "router\.(get|post)\(" backend/src --include=*.routes.ts | grep -viE "requireAuth|requireDealAccess|requireWeb|requireAdmin"
```
List every route handler with NO auth middleware. Classify each: serves PUBLIC data (auth still
advised) / serves PRIVATE data (HOLE — same severity) / genuinely public-by-design (token share).
Any PRIVATE-serving route with no auth → add to the fix set in THIS dispatch. Report the full list.

## STEP 3 — FIX

For the three known holes + any PRIVATE sibling the sweep finds:
- **Routes 1 & 2** (`:dealId`): add `requireAuth` + `requireDealAccess` (the existing deal-ownership
  gate — confirm it enforces org/owner, `file:line`). Both, not just `requireAuth` — export of a
  specific deal must check the caller can access THAT deal, not just that they're logged in.
- **Route 3** (grid optionalAuth): elevate to `requireAuth`. If grid export legitimately serves
  public grid data in some mode, gate the PRIVATE path and leave only the genuinely-public path open
  — but default to requireAuth and flag if a public mode is actually needed.
- **Token-share exports** (B2b/B3d — capsule token links): these are intentional cross-org by design.
  Do NOT add requireAuth that breaks them. Confirm they enforce the token check and leave them;
  documentation note only.

Cite `file:line` per change. Do NOT bundle the broader "blanket auth on /api/v1" structural fix into
this — that's a separate dispatch (noted below). This one closes the open PRIVATE-data holes.

---

## ACCEPTANCE — live HTTP, per endpoint

For each fixed route:
1. **Unauth rejected:** hit with no token → 401/403. Paste.
2. **Wrong-deal-access rejected:** hit WITH a valid token but for a deal the user does NOT own →
   403 (proves `requireDealAccess` works, not just `requireAuth`). Paste. (Critical: `requireAuth`
   alone would let any logged-in user export any deal — the gate must be deal-scoped.)
3. **Legitimate access still works:** valid token, owned deal → 200 + the export. Paste.
4. **Token shares unbroken:** confirm the intentional token-export paths still serve via token. Paste.
5. Sibling sweep result: full list of no-auth routes, classified, with any PRIVATE ones fixed here.

---

## PR

- Branch `claude/fix-unauth-export-endpoints`, one commit:
  `fix(security): require auth + deal-access on private export endpoints`
- PR body: per-endpoint triage (what was exposed), live before/after (unauth rejected, wrong-deal
  rejected, owner works), sibling-sweep list.

---

## OUT OF SCOPE (separate dispatches)

- **Structural fix:** blanket `requireAuth` on the `/api/v1` mount + explicit public allowlist — the
  root cause of all 4+ holes. Flag it loud as the follow-up; this dispatch treats symptoms, that one
  treats the disease.
- `deal-access.ts:52` `organization_id → org_id` migration (couple to Phase 2 DDL, not here).
- `deal_capsules` org_id (capsule-sharing design item).
- Org cleanup (separate gated delete).

**If Step 2 finds a PRIVATE-serving route with no auth, it's the same severity — fix it here and
flag it loud. The sibling sweep is the point: stop finding these one at a time in production.**
