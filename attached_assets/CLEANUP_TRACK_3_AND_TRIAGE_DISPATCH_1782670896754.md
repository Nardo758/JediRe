# CLEANUP TRACK 3 (minimal delete) + HOLDS-UNIQUE triage

Two parts. Part A deletes exactly what's proven redundant (1, maybe 2 files) — gated, build-verified. Part B does NOT delete — it converts the ~100 HOLDS-UNIQUE bucket into a triage map, and critically **verifies whether core product flows actually work** rather than queuing them for deletion. The audit found 1 redundant file and ~100 parked: most of the 100 are product decisions or possible launch gaps, not cleanup. Treat them that way. STOP at each part's report.

---

## PART A — Delete the proven-redundant (gated, build-verified)

**A1 — `NewsIntelligencePageOld.tsx`** — REDUNDANT, equivalent proven (`NewsIntelligencePage.tsx`, imported by `TerminalPage.tsx:8`).
- Re-confirm: `grep -rn "NewsIntelligencePageOld" frontend/src` returns only the file itself. Paste.
- Delete.
- Run the production build → must pass clean (same baseline as Track 1: 5,165 modules, only the 2 pre-existing dynamic-import warnings). Paste build result.

**A2 — `CapsuleRedirectPage.tsx`** — candidate, needs one confirm before deletion. It's imported at `App.tsx:27` but placed in **no** `<Route>` (dead import). Before deleting:
- Confirm no `<Route element={<CapsuleRedirectPage` anywhere, AND that the capsule-redirect *behavior* (whatever it did) is either dead or handled by `CapsuleDetailPage`/`CapsuleLinkPage`. If the redirect logic is unique and might be needed (capsule short-link → detail), it's HOLDS-UNIQUE, not redundant — **do not delete, report instead.**
- If confirmed dead (no route, logic covered/unneeded): remove the dead `App.tsx:27` import AND delete the file. Build must pass. Paste.
- If unique: leave it, report it as HOLDS-UNIQUE with what the redirect does.

**Part A closes when:** the proven file(s) deleted, dead import removed, production build clean, grep evidence pasted. Delete **nothing** beyond A1/A2.

---

## PART B — Triage the ~100 HOLDS-UNIQUE (NO DELETION — classify + verify)

The ~100 are not a delete queue. Split them into the four real sub-populations below. **Delete nothing.** For each component, assign a sub-population and the disposition listed. Report as four lists.

### B1 — Marketing / legal / public pages (~27: about, blog, careers, privacy, terms, press, etc.)
- These are website content with no Bloomberg-app equivalent — correctly HOLDS-UNIQUE.
- **Disposition: PRODUCT DECISION, not cleanup.** The question is "do you maintain a public marketing/legal site?" — not "delete or keep as app code."
- Action: list them, confirm none is wired into the app router, flag as "marketing-site decision — out of scope for code cleanup." No further analysis needed.

### B2 — Auth / payment flow pages (VERIFY — do not delete, this is the launch-gap check)
- `ResetPasswordPage` (no `/reset-password` route), `VerifyEmailPage` (no `/verify-email`), `UnsubscribePage` (no `/unsubscribe`), `PaymentResultPage` (no payment-result route). Plus any other auth/billing flow page in the orphan list.
- **These are flows a launching product needs. Orphaned ≠ dead — possibly MISSING.** The critical question is not "is this dead code" but **"does this flow work right now?"**
- For each, verify: is the flow handled **somewhere live** (a different component, a backend redirect, an external provider page)? Specifically:
  - Password reset: is there ANY working reset path (a live route, a Supabase/Auth0/provider-hosted flow, an email-link handler)? `file:line` or "none found."
  - Email verification: same — any live verify path?
  - Stripe payment return: where does Stripe redirect after checkout? Is there a live handler, or does the return URL point at a route that doesn't exist?
  - Unsubscribe: any live unsubscribe handler (often backend)?
- **Report per flow: WORKS (live path named, `file:line`) or GAP (no working path found).** A GAP here is a launch-readiness finding, not a cleanup item — flag it loud. These orphaned pages may be the *intended* implementation that was never wired.

### B3 — Features where ALL versions are orphaned (PRODUCT DECISION — which is canonical?)
- `DealsPage` + `DealsPageOld`; `EmailPage` + `EmailPageOld`; `MarketDataPage` + `MarketDataPageV2` + `MarketDataPageOld`; and any other version-cluster where the audit found the "new" version also unreachable.
- The audit correctly refused to call the "Old" ones redundant because the *replacement is also orphaned*. So the whole feature is unwired.
- **Disposition: PRODUCT DECISION.** Per cluster, report: is this feature reachable by ANY route at all today (re-confirm)? If genuinely zero-reachable across all versions, the question is "is this feature supposed to be live, and which version is canonical?" — yours to answer. Do not delete any version; a wrong delete here removes the only copy of a feature.
- Action: list the clusters, confirm total unreachability per cluster, present as "feature wiring decision."

### B4 — Genuine scaffolding / dead imports (read-then-classify — likely deletable, but PROVE)
- `financial-engine/AssumptionsHubTab.tsx`, `financial-engine/Y1SourcePicker.tsx` (zero importers inside the active F9 folder), `development/routes.example.tsx` (dev scaffold), and any other clearly-scaffold file.
- These are the closest to deletable — but the bar still holds: **read each one.** If it's a stub/example/planned-but-empty, it's REDUNDANT-eligible (report for a future gated delete). If it holds unique built logic (e.g. `AssumptionsHubTab` is a real but unwired hub tab with unique layout), it stays HOLDS-UNIQUE.
- Report per file: read verdict → SCAFFOLD (deletable, gated) or HOLDS-UNIQUE (real logic, parked).

### B5 — The parked orphan (unchanged)
- `ProFormaWithTrafficSection.tsx` (882 lines, unique M07→M09 UI, never compiled — duplicate `handleInitialize`) + `GET /proforma/:dealId/traffic-integration` (sole caller). Already parked from Phase 5. **Paired ship-or-discard, human decision.** No action — just carry it forward in the triage map so it's not lost.

---

## Report structure

- **Part A:** files deleted (with grep + build-clean proof), or A2 reported HOLDS-UNIQUE if its logic is unique.
- **Part B:** four+one lists — B1 (marketing, product decision), B2 (auth/payment, **WORKS or GAP per flow** — the launch-readiness finding), B3 (all-versions-orphaned features, product decision), B4 (scaffold read-verdicts), B5 (parked orphan carried forward).

**The most important output is B2.** If password reset, email verification, or Stripe return have no working path, that's a live product gap surfaced by the cleanup — far more valuable than any deletion. Flag any GAP at the top of the report.

STOP after reporting. Delete nothing beyond Part A's proven files. Everything in B is decisions/verifications for human review, not a deletion queue.
