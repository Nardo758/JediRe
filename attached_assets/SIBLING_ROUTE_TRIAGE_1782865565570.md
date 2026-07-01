# DISPATCH — TRIAGE /organization + /portfolio (READ-ONLY, LIVE)

**Why:** the export sibling sweep listed ~14 no-mount-auth routes; two are tenant-boundary surfaces
— `/api/v1/organization` and `/api/v1/portfolio`. The sweep LISTED them from static reading; it did
not TEST them. The export triage just proved static classification can be wrong in BOTH directions
(three "NO AUTH" routes turned out gateway-gated). So test these live before deciding severity.
**Mode:** READ-ONLY triage. Hit them, classify, STOP. Fix nothing — a confirmed-open result becomes
its own fix dispatch.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Verification rule (S1-01):** severity is decided by live HTTP against the running app, not by
reading route/mount definitions.
**Report to:** `docs/audits/SIBLING_ROUTE_TRIAGE_VERDICT.md`

---

## THE QUESTION (per route family)

For `/api/v1/organization*` and `/api/v1/portfolio*`: is each route GATEWAY-GATED (401 unauth, like
the exports) or ACTUALLY OPEN (200 with tenant data, like `/properties` was)? Organization and
portfolio are the tenant containers — an open route here leaks org/portfolio data across tenants,
higher stakes than a single deal export.

---

## STEP 1 — ENUMERATE the routes in both families

```
grep -rniE "router\.(get|post|put|patch|delete)\(" backend/src --include=*.routes.ts | grep -iE "organization|portfolio"
```
Plus find their mount points and any mount-level middleware:
```
grep -rniE "app\.use.*(organization|portfolio)" backend/src --include=*.ts
```
List every organization/portfolio route: method, path, mount-level auth (if any), inline auth (if
any). `file:line` each.

## STEP 2 — HIT EACH LIVE, UNAUTHENTICATED

For every route in both families, against the RUNNING app, with NO token:
- GET routes: call directly.
- POST/PUT/etc: call with a minimal body (enough to reach the handler, not to mutate — or use a
  safe/read variant; do NOT trigger a destructive write just to test auth — if a route is a
  mutation, testing that it REJECTS unauth is sufficient; a 401 before the handler is the pass).
- Paste status + body sample for each.

Classify each route:
   - **GATEWAY-GATED** — 401/403 unauth. Safe (mount or inline catches it). Note which layer.
   - **OPEN — PUBLIC data** — 200, but returns only public/reference data. Low severity; auth still
     advised.
   - **OPEN — PRIVATE/TENANT data** — 200 returning org/portfolio/tenant rows. **HOLE.** Same
     severity as `/properties`. Flag LOUD.

## STEP 3 — For any OPEN-PRIVATE route, confirm the leak concretely

If any route returns tenant data unauth, paste the specific fields proving it's private (org names,
member lists, portfolio assets, org_id-bearing rows) — not just a 200. The concrete payload
determines whether it's "fix this hour" or "fix this week," same as the `/properties` call.

---

## DELIVERABLE

- SHA + READ-ONLY header
- Enumeration table: every organization/portfolio route, its mount + inline auth, `file:line`
- Live triage result per route: GATEWAY-GATED / OPEN-PUBLIC / OPEN-PRIVATE, with pasted status+body
- **The verdict line:** are `/organization` and `/portfolio` safe (all gated) or is either OPEN with
  tenant data? If OPEN-PRIVATE → that's the next emergency fix dispatch, scoped to the exact routes.
- If all gated: note which layer gates them (mount vs inline) — mount-only is the fragile pattern,
  flag it for the structural blanket-auth fix even though it's not currently open.

**STOP at the report. A confirmed-open route becomes its own fix dispatch (requireAuth +
appropriate org-scoping). This triage only tells you which world you're in.**

---

## NOT IN SCOPE

- The structural `/api/v1` blanket-auth fix (the root cause of the mount-only fragility) — separate.
- The other ~12 swept routes (mostly public/MIXED/inline-guarded) — unless STEP 1 shows one of them
  is also a tenant-boundary route with no auth, in which case add it and flag.
- PREEXIST-AUDIT-POOL (the broken audit import) — separate fix.
- Org cleanup, scoping pass — separate.
