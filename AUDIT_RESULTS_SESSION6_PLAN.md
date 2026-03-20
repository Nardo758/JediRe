# JEDI RE PHASE 1 SESSION 6: STORE & STATE MANAGEMENT FIXES

**Session:** Phase 1, Session 6: Store & State Management Fixes
**Date:** March 20, 2026
**Status:** AUDIT & PLANNING (identifying consolidation strategy)

---

## ISSUE 1: Five Deal Page Variants — Consolidate to Canonical

### Current State: Route Fragmentation

| Route | Component | File | Lines | Status | Notes |
|-------|-----------|------|-------|--------|-------|
| `/deals/:dealId/detail` | **DealDetailPage** | DealDetailPage.tsx | 617 | ✅ ACTIVE | Tabbed interface, most complete, canonical |
| `/deals/:dealId/view` | DealPage | DealPage.tsx | 324 | ⚠️ LEGACY | Old variant, less features |
| `/deals/:dealId/enhanced` | DealPageEnhanced | DealPageEnhanced.tsx | 416 | ⚠️ ALTERNATE | Collapsible sections variant |
| `/deals/:id` | **DealView** | DealView.tsx | 439 | ⚠️ CATCH-ALL | Simplified module-based view |
| `/deals/:id/:module` | **DealView** | DealView.tsx | 439 | ⚠️ CATCH-ALL | With module parameter |
| `/capsules/:id` | CapsuleDetailPage | CapsuleDetailPage.tsx | 23 | ✅ FIXED | Already redirects to `/deals/:id/detail` |

### Analysis: DealDetailPage vs DealView

**DealDetailPage (617 lines) — THE CANONICAL SURFACE**
- ✅ Tabbed interface (M01-M25 modules as tabs)
- ✅ Full module integration (22+ sections imported and wired)
- ✅ Development capacity → unit mix cascade (documented flow)
- ✅ Team collaboration features (PresenceIndicator, ActivityFeed, CommentThread, DealTeamPanel)
- ✅ Trade area definition
- ✅ 3D design integration
- ✅ Proper state management (dealStore, zoningModuleStore, tradeAreaStore)
- ✅ Tab URL parameters (`?tab=overview`, `?tab=zoning`, etc.)

**DealView (439 lines) — CATCH-ALL FALLBACK**
- ⚠️ Module-based sections (not tabs)
- ⚠️ Simpler layout (sidebar + content)
- ⚠️ Map-centric (module='map' is default)
- ⚠️ Less team collaboration features
- ⚠️ Still functional but less feature-complete

**DealPage (324 lines) — LEGACY**
- ❌ Minimal module integration
- ❌ Old structure
- ❌ Should be deprecated

**DealPageEnhanced (416 lines) — ABANDONED**
- ❌ Collapsible sections approach
- ❌ Inconsistent with DealDetailPage
- ❌ Not actively used

### Consolidation Strategy

**Goal:** Single entry point for all deal views

**Plan:**
1. **Keep DealDetailPage** as canonical (already has most features)
2. **Redirect all other routes to DealDetailPage:**
   - `/deals/:dealId/view` → `/deals/:dealId/detail`
   - `/deals/:dealId/enhanced` → `/deals/:dealId/detail`
   - `/deals/:id` → `/deals/:id/detail?tab=map` (DealView module parameter → tab)
   - `/deals/:id/:module` → `/deals/:id/detail?tab=:module`
3. **Delete** DealPage, DealPageEnhanced (after verifying no external references)
4. **Keep DealView temporarily** if external links depend on it (but don't develop it further)

### Implementation Steps

1. Update routing in `App.tsx` to redirect variants
2. Update internal navigation calls to use `/deals/:dealId/detail`
3. Add module-to-tab mapping for legacy `/deals/:id/:module` routes
4. Deprecate unused components (DealPage, DealPageEnhanced) with notices
5. Update any API documentation that references old URLs

---

## ISSUE 2: Store-as-Message-Bus Pattern Violations

### Current Pattern (CORRECT)

**Pattern Definition:** Zustand store acts as sole inter-component communication mechanism. Components should:
1. **Only read** from store slices (subscribe via selectors)
2. **Only write** through store actions (via `setAction()`)
3. **NOT import** other components' stores directly
4. **NOT call** functions from sibling components

**Reference Implementation:** `dealStore.ts` (185 lines)
```typescript
// Correct: Store as message bus
const deal = useDealStore((state) => state.deal);
const { setDeal, setActiveTab } = useDealStore();

// Incorrect: Direct component import
// import { OverviewSection } from './OverviewSection';
// OverviewSection.doSomething(); // ❌ WRONG
```

### Investigation: Store Violations

Searching for cross-module imports that bypass the store pattern...

**Files to Check:**
- Component imports within `frontend/src/components/deal/sections/`
- Direct service calls in section components
- Props drilling instead of store subscription

### Expected Findings

Based on code pattern, violations likely in:
1. **OverviewSection** — might call strategy-arbitrage output directly
2. **StrategySection** — might import ProForma calculations directly
3. **ProFormaTab** — might bypass capital-structure-adapter
4. **CapitalStructureSection** — might have circular dependency with ProForma

**Action:** Search for these patterns and require wire through store.

---

## SUMMARY OF SESSION 6 WORK

| Task | Status | Complexity |
|------|--------|-----------|
| Consolidate 5 deal page variants | 🔴 PLANNED | Medium |
| Redirect old routes to canonical | 🔴 PLANNED | Low |
| Identify store-pattern violations | 🔴 PLANNED | High |
| Fix violations via store refactoring | 🔴 PLANNED | High |
| Add deprecation notices to old pages | 🔴 PLANNED | Low |

---

## Next Actions

1. **Immediate:** Update App.tsx routing to consolidate variants
2. **Follow-up:** Search for and document store-pattern violations
3. **Refactor:** Wire all violations through store pattern
4. **Cleanup:** Mark unused components as deprecated
5. **Test:** Verify all deal page routes work through canonical surface

---

*Planning phase complete. Ready for implementation.*
