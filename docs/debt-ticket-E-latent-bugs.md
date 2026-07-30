# Debt Ticket E: Genuine Latent Bugs (Residual TypeScript Errors)

**Type:** Mixed — some latent bugs, some type debt
**Error count:** ~300 residual errors after W1-6b rename repoints
**Status:** Classified from `npx tsc --noEmit` output

## Category E1: Auth Precedence Bug (FIXED in `60f2f9be2`)

**File:** `src/api/rest/valuation-grid.routes.ts`
**Lines:** 72, 101, 134, 183, 252, 309, 371, 397, 432, 456, 482
**Bug:** `!req.user?.role === 'admin'` always evaluates `false` (boolean !== string).
**Fix:** Changed to `req.user?.role !== 'admin'`.
**Status:** ✅ Committed. Needs behavioral verification.

## Category E2: Zod Version Mismatch

**File:** `src/services/skills/skill-registry.ts`
**Lines:** 104, 147, 153
**Error:** `$ZodType` vs `ZodType` — 42 missing properties
**Likely cause:** Zod v3 vs v4 API incompatibility. `$ZodType` is zod@4, `ZodType` is zod@3.
**Fix:** Check `package.json` zod version, align type imports.

## Category E3: Block-Scoped Variable Used Before Declaration

**File:** `src/routes/m35-events.routes.ts`
**Lines:** 684, 692, 693, 694, 709
**Error:** `rentGrowthAttributions` used before declaration
**Fix:** Hoist declaration or restructure the function.

## Category E4: Export Declaration Conflicts

**File:** `src/services/debt-advisor/exit-window-calculator.ts`
**Lines:** 640, 641, 642
**Error:** Export declaration conflicts with exported declaration
**Fix:** Check for duplicate exports or namespace collisions.

## Category E5: Object Literal Multiple Same-Name Properties

**Files:**
- `src/services/agents/deal-structuring.service.ts` (380, 381)
- `src/services/building-profiles/building-profile.service.ts` (153)
- `src/services/ingestion/bls-qcew-ingest.service.ts` (355)
- `src/services/proforma/opex-anchors.service.ts` (224)
**Error:** `TS1117: An object literal cannot have multiple properties with the same name`
**Fix:** Remove or rename duplicate keys.

## Category E6: Type-Only Import Not Exported

**File:** `src/routes/m35-events.routes.ts`
**Line:** 54
**Error:** `classifyMsaTier` declared locally but not exported
**Fix:** Export from `m35-playbook.service` or remove the import.

## Category E7: Missing Module

**Files:**
- `src/services/proforma-adjustment.service.ts` (2105, 3191): `../blueprint/proforma-blueprint`
- `src/services/gmail-sync.service.ts` (507): `../../services/agents/platform-hooks`
- `src/services/skills/skills/index.ts` (576): `../../../lifecycle/transition-guard.service`
**Fix:** Check if files were moved/renamed/deleted.

## Acceptance Criteria

- [ ] All E1-E7 categories ticketed separately or fixed
- [ ] `npx tsc --noEmit` error count tracked per category
- [ ] No "fixed" claims without test evidence

## Severity

**P1 for E1** (security) — already fixed, needs verification.
**P2 for E2-E7** — type debt and latent bugs. Fix in priority order.
