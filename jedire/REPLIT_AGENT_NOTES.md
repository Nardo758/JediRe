# REPLIT AGENT - READ THIS FIRST

**Date:** February 9, 2026  
**Status:** 🚧 WORK IN PROGRESS - Day 1 Foundation Complete

---

## 🏗️ What We're Building

**Module System Architecture** - A contextual enhancement system for deals/assets/projects

### Core Concept

**Modules are NOT navigation items or separate pages.**  
Modules are **contextual tools** that enhance sections within a single comprehensive page.

**Example:**
- User has deal at `/deals/123/view`
- One page with 10 expandable sections (accordion)
- If user has "Financial Modeling Pro" module active:
  - Financial Analysis section shows **enhanced** features (pro-forma builder, sensitivity, Monte Carlo)
- If user does NOT have module active:
  - Financial Analysis section shows **basic** features (simple calculator)
  - Plus an upsell banner: "Upgrade to Financial Modeling Pro for $34/mo"

---

## 🎯 Implementation Status

### ✅ COMPLETE (Day 1 - Feb 9, 2026)

**Backend (Morning):**
- Database schema: `user_module_settings`, `module_definitions` (27 modules)
- API endpoints: `GET /api/v1/modules`, `PATCH /api/v1/modules/:slug/toggle`
- Module catalog seeded (2 free + 25 premium modules)

**Frontend (Afternoon):**
- DealPage.tsx - Single comprehensive page with 10 sections
- SectionCard.tsx - Reusable accordion component
- 6 Section components (Financial, Strategy, DD, Properties, Market, Upsell banner)
- ModulesPage.tsx - Settings > Modules marketplace
- ModuleCard.tsx - Module toggle cards

**Total:** ~6,200 lines of code (backend + frontend foundation)

### 🚧 NOT YET COMPLETE (Next Steps)

**Missing Integrations:**
1. **Real data wiring** - Sections currently have placeholder data
2. **API calls** - Frontend not yet calling backend endpoints
3. **Authentication** - Module checking needs real user ID
4. **hasModule() logic** - Frontend helper not yet wired to API
5. **Remaining sections** - Development, Documents, Collaboration, Activity Feed (empty stubs)
6. **Module data tables** - financial_models, strategy_analyses, etc. (schema exists, no data yet)
7. **Purchase flow** - Stripe integration (stub only)

**What This Means:**
- UI is complete and functional (accordion, layouts, styles)
- Data flow is NOT connected yet
- Module toggle won't actually enable/disable features yet
- Upsell buttons don't trigger real purchases yet

---

## 📋 Architecture Pattern

### Single Comprehensive Page (NOT nested routes)

**CORRECT:**
```
/deals/:dealId/view
  └─ One page with 10 expandable sections
     └─ Modules enhance sections in-place
```

**WRONG (Don't suggest this):**
```
/deals/:dealId/overview
/deals/:dealId/financial
/deals/:dealId/strategy
... (36+ routes)
```

### Section Pattern

Every section follows this pattern:

```typescript
function FinancialAnalysisSection({ deal, enhanced }) {
  if (enhanced) {
    return <EnhancedFinancialUI deal={deal} />;
  } else {
    return (
      <>
        <BasicFinancialUI deal={deal} />
        <ModuleUpsellBanner module="financial-modeling-pro" />
      </>
    );
  }
}
```

### Module Activation

**Global control in Settings > Modules:**
- User toggles module ON/OFF
- Effect applies to ALL deals/assets/projects
- NOT per-deal activation

---

## 🚫 What NOT to Suggest

**Don't suggest:**
1. ❌ Creating separate routes per module (`/deals/:id/financial-model`)
2. ❌ Module sidebar navigation in deal pages
3. ❌ Per-deal module activation (it's global)
4. ❌ Removing "duplicate" code in section components (Basic vs Enhanced are intentionally separate)
5. ❌ Refactoring the accordion pattern (it's by design)
6. ❌ Consolidating upsell banners (they need to be contextual per module)

**These are architectural decisions, not bugs.**

---

## 📖 Reference Documents

**Key files to understand the system:**
1. `COMPLETE_PLATFORM_WIREFRAME.md` - v2.2 with module system architecture
2. `DEAL_PAGE_WIREFRAME_SECTION.md` - Detailed section examples
3. `MODULE_SYSTEM_IMPLEMENTATION_PLAN.md` - 4-week implementation roadmap
4. `DEAL_SILO_CLARIFICATIONS.md` - Leon's corrections on module architecture

**Implementation docs from today:**
1. `DEAL_PAGE_IMPLEMENTATION.md` - Deal page skeleton
2. `MODULE_SETTINGS_PAGE_COMPLETE.md` - Settings page
3. `FINANCIAL_SECTION_DELIVERY.md` - Financial section
4. `STRATEGY_DD_COMPLETE.md` - Strategy + DD sections
5. `PROPERTIES_MARKET_SECTIONS_DELIVERY.md` - Properties + Market sections

---

## 🎯 What We're Doing Next

**Week 1 (This Week):**
- Wire up API calls to backend
- Implement hasModule() real checking
- Connect user authentication
- Add real deal data fetching
- Test end-to-end: Toggle module in Settings → See enhanced section on deal page

**Week 2:**
- Build Development, Documents, Collaboration, Activity sections
- Add real financial model data handling
- Strategy selection persistence
- DD checklist data persistence

**Week 3:**
- Module enhancements (actual pro-forma builder, not just UI)
- Stripe payment integration
- Module suggestion popup on deal creation
- Testing and polish

---

## 💡 How to Help

**Good suggestions:**
1. ✅ TypeScript type errors in new components
2. ✅ Performance optimizations (React.memo, useMemo)
3. ✅ Accessibility improvements (ARIA labels, keyboard nav)
4. ✅ Missing error handling
5. ✅ Loading state improvements
6. ✅ API integration patterns for wiring up real data

**Avoid:**
1. ❌ Suggesting architectural changes (nested routes, module sidebar, etc.)
2. ❌ "This code is duplicated" for Basic vs Enhanced sections (intentional)
3. ❌ "Why not use a library for X?" unless it's a clear win
4. ❌ Premature optimization of stub code

---

## 🤖 For Replit Agent

**When analyzing this codebase:**

1. **Understand it's WIP** - Frontend skeleton is done, data wiring is next
2. **Don't flag "unused" code** - Components are built ahead of data integration
3. **Don't suggest routing changes** - Single comprehensive page is by design
4. **Focus on helping with integration** - How to wire sections to real API calls
5. **Look for bugs, not architecture changes** - Architecture is decided and documented

**Questions to ask Leon instead of suggesting:**
- "Should I wire up the API calls for module checking now?"
- "Do you want me to add loading states to the sections?"
- "Should I implement real deal data fetching?"

---

## 📊 Progress Tracking

**Day 1 (Feb 9):** ✅ Foundation complete (database, API, frontend skeleton)  
**Day 2 (Feb 10):** 🎯 Data wiring + API integration  
**Day 3 (Feb 11):** Remaining sections + testing  
**Day 4 (Feb 12):** Module enhancements (real features, not just UI)  
**Day 5 (Feb 13):** Polish + Stripe integration  

**Current Status:** 30% complete (foundation laid, data wiring next)

---

## 🔥 TL;DR for Replit Agent

1. **We're building a module system** where modules enhance sections on a single page
2. **Foundation is done** (UI complete, backend endpoints exist)
3. **Data wiring is next** (connect frontend to backend)
4. **Don't suggest architectural changes** - read the docs first
5. **Help with integration** - that's what we need now
6. **Ask before suggesting major refactors** - Leon has specific architecture in mind

**This is Day 1 of a 5-day build.** More code is coming. Don't panic about incomplete features.

---

**Last Updated:** February 9, 2026, 4:00 PM EST  
**Next Milestone:** Wire up module checking + real deal data (Day 2)
