# Module System - Implementation Plan

**Date:** February 9, 2026  
**Status:** APPROVED - Ready to build  
**Architecture:** Contextual tools embedded in sections (not navigation items)

---

## Confirmed Architecture

### Core Principles
1. **Modules are contextual tools**, not pages
2. **Single comprehensive page** per entity (deal/asset/project)
3. **All sections always visible** (upsell for inactive modules)
4. **Separate database tables** per module
5. **Expandable/accordion** sections for mobile
6. **Auto-suggest modules** on entity creation (one-time popup)

### Leon's Decisions
- ✅ All sections visible (easier than conditional show/hide)
- ✅ Separate tables per module (cleaner architecture)
- ✅ Expandable sections (accordion UI)
- ✅ Auto-suggest with popup (contextual recommendations)
- ✅ Map panel OFF by default
- ✅ Back navigation to Grid view
- ✅ Phased data migration with feature flags

---

## Phase 1: Settings > Modules Page (Week 1)

### Goal
Build global module control center where users activate/deactivate modules.

### UI Components

**1. ModuleMarketplace Component**
```typescript
interface Module {
  slug: string;              // "financial-modeling-pro"
  name: string;              // "Financial Modeling Pro"
  category: string;          // "Financial & Analysis"
  description: string;       // "Component-based builder..."
  priceMonthly: number;      // 34 (dollars)
  isFree: boolean;           // false
  bundles: string[];         // ["flipper", "developer", "portfolio"]
  icon: string;              // "💰"
  enhances: string[];        // ["Financial Analysis section"]
}

interface UserModuleSetting {
  moduleSlug: string;
  enabled: boolean;
  subscribed: boolean;
  bundleId?: string;
}
```

**2. ModuleCategoryGroup Component**
- Collapsible section per category
- Shows all modules in category
- Visual hierarchy: Category > Modules

**3. ModuleToggleCard Component**
```tsx
<ModuleToggleCard
  module={module}
  enabled={isEnabled}
  subscribed={isSubscribed}
  onToggle={handleToggle}
  onAddModule={handlePurchase}
  onUpgradeBundle={handleUpgrade}
/>
```

**States:**
- **Enabled + Subscribed:** Green checkmark, can toggle OFF
- **Disabled + Subscribed:** Gray, can toggle ON
- **Not Subscribed:** Grayed out, shows price, [Add Module] button

### Database Schema

```sql
-- User module settings (global)
CREATE TABLE user_module_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_slug     TEXT NOT NULL,
  enabled         BOOLEAN DEFAULT true,
  subscribed      BOOLEAN DEFAULT false,
  bundle_id       TEXT,
  activated_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, module_slug)
);

CREATE INDEX idx_user_module_settings_user ON user_module_settings(user_id);
CREATE INDEX idx_user_module_settings_enabled ON user_module_settings(user_id, enabled) WHERE enabled = true;

-- Module definitions (static config, seed on deploy)
CREATE TABLE module_definitions (
  slug            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  description     TEXT,
  price_monthly   INTEGER,  -- cents
  is_free         BOOLEAN DEFAULT false,
  bundles         TEXT[],
  icon            TEXT,
  enhances        TEXT[],   -- e.g., ["Financial Analysis section", "Deal Overview"]
  sort_order      INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Seed data example
INSERT INTO module_definitions (slug, name, category, price_monthly, bundles, enhances) VALUES
  ('financial-modeling-pro', 'Financial Modeling Pro', 'Financial & Analysis', 3400, 
   ARRAY['flipper', 'developer', 'portfolio'], 
   ARRAY['Financial Analysis section']),
  ('strategy-arbitrage', 'Strategy Arbitrage Engine', 'Strategy & Arbitrage', 3900,
   ARRAY['flipper', 'developer', 'portfolio'],
   ARRAY['Strategy section']),
  ('dd-suite', 'Due Diligence Suite', 'Due Diligence', 3900,
   ARRAY['flipper', 'developer', 'portfolio'],
   ARRAY['Due Diligence section']);
```

### API Endpoints

**GET /api/v1/modules**
```json
{
  "categories": [
    {
      "name": "Financial & Analysis",
      "modules": [
        {
          "slug": "financial-modeling-pro",
          "name": "Financial Modeling Pro",
          "description": "Component-based builder with 13 blocks",
          "priceMonthly": 34,
          "bundles": ["flipper", "developer", "portfolio"],
          "enhances": ["Financial Analysis section"],
          "userSettings": {
            "enabled": true,
            "subscribed": true,
            "bundleId": "flipper"
          }
        }
      ]
    }
  ]
}
```

**PATCH /api/v1/modules/:slug/toggle**
```json
Request: { "enabled": true }
Response: { 
  "success": true,
  "moduleSlug": "financial-modeling-pro",
  "enabled": true
}
```

**POST /api/v1/modules/:slug/purchase**
```json
Request: { "paymentMethodId": "pm_xxx" }
Response: {
  "success": true,
  "subscribed": true,
  "subscriptionId": "sub_xxx"
}
```

### UI Flow

**1. User navigates to /settings/modules**
```
Settings Navigation → Modules → Module Marketplace
```

**2. Page loads with user's current state**
- Fetches user's bundle (Flipper/Developer/Portfolio/None)
- Fetches all module definitions
- Fetches user's module settings (enabled/subscribed)
- Renders categories with modules

**3. User toggles module ON**
```
User clicks checkbox [✓] on "Financial Modeling Pro"
→ If subscribed: API call to enable
→ If not subscribed: Show modal
   "This module costs $34/mo or is included in Developer bundle ($159/mo)"
   [Add Module] [Upgrade Bundle] [Cancel]
```

**4. Effect propagates globally**
```
Module enabled
→ All deals now show enhanced Financial Analysis sections
→ No page refresh needed (optimistic UI update)
```

---

## Phase 2: Deal Page Redesign (Week 2)

### Goal
Redesign /deals/:dealId as single comprehensive page with expandable sections.

### Page Structure

```tsx
<DealPage dealId={dealId}>
  <DealHeader deal={deal} />
  
  <DealContent>
    <OverviewSection deal={deal} />
    
    <PropertiesSection 
      deal={deal}
      enhanced={hasModule('property-intelligence')}
    />
    
    <FinancialAnalysisSection
      deal={deal}
      enhanced={hasModule('financial-modeling-pro')}
      upsellModule={!hasModule('financial-modeling-pro')}
    />
    
    <StrategySection
      deal={deal}
      enhanced={hasModule('strategy-arbitrage')}
      upsellModule={!hasModule('strategy-arbitrage')}
    />
    
    <DueDiligenceSection
      deal={deal}
      enhanced={hasModule('dd-suite')}
      upsellModule={!hasModule('dd-suite')}
    />
    
    <MarketAnalysisSection
      deal={deal}
      enhanced={hasModule('market-signals')}
      upsellModule={!hasModule('market-signals')}
    />
    
    {deal.isDevelopment && (
      <DevelopmentSection
        deal={deal}
        enhanced={hasModule('development-tracker')}
        upsellModule={!hasModule('development-tracker')}
      />
    )}
    
    <DocumentsSection deal={deal} />
    
    <CollaborationSection
      deal={deal}
      enhanced={hasModule('deal-room')}
      upsellModule={!hasModule('deal-room')}
    />
    
    <ActivityFeedSection deal={deal} />
  </DealContent>
</DealPage>
```

### Section Component Pattern

**Every section follows this pattern:**

```tsx
interface SectionProps {
  deal: Deal;
  enhanced: boolean;      // Is module active?
  upsellModule?: boolean; // Show upsell if module inactive?
}

function FinancialAnalysisSection({ deal, enhanced, upsellModule }: SectionProps) {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <SectionCard
      title="Financial Analysis"
      icon="💰"
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {enhanced ? (
        <FinancialModelingProContent deal={deal} />
      ) : (
        <>
          <BasicFinancialContent deal={deal} />
          {upsellModule && (
            <ModuleUpsellBanner
              module="financial-modeling-pro"
              benefits={[
                "Component-based pro-forma builder (13 blocks)",
                "Sensitivity analysis & stress testing",
                "Monte Carlo simulations",
                "Waterfall distribution models"
              ]}
            />
          )}
        </>
      )}
    </SectionCard>
  );
}
```

### Expandable Sections (Accordion)

**Desktop:**
```
┌─────────────────────────────────────────────────────────┐
│ Overview Section                                    [▼] │
│ Basic info, map, quick stats                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 💰 Financial Analysis                               [▲] │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Financial Modeling Pro                              │ │
│ │                                                     │ │
│ │ Component Builder:                                  │ │
│ │ [Purchase Price] [Financing] [Operating Income]    │ │
│ │ [Operating Expenses] [CapEx] [Disposition]         │ │
│ │                                                     │ │
│ │ Sensitivity Analysis:                               │ │
│ │ [Revenue ±10%] [Expenses ±5%] [Cap Rate ±50bps]    │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🎯 Strategy                                         [▼] │
│ (Collapsed)                                             │
└─────────────────────────────────────────────────────────┘
```

**Mobile:**
```
┌──────────────────────────┐
│ Overview            [▼] │
│ Basic info, map          │
└──────────────────────────┘

┌──────────────────────────┐
│ 💰 Financial        [▲] │
│                          │
│ Financial Modeling Pro   │
│ (Stacked vertically)     │
│                          │
│ [Components]             │
│ [Sensitivity]            │
│ [Results]                │
└──────────────────────────┘

┌──────────────────────────┐
│ 🎯 Strategy         [▼] │
│ (Collapsed)              │
└──────────────────────────┘
```

### Module Enhancement Examples

**1. Financial Modeling Pro (Active)**
```tsx
<FinancialModelingProContent>
  <ComponentBuilder blocks={13} />
  <SensitivityAnalysis />
  <MonteCarloSimulation />
  <WaterfallModels />
  <ResultsDashboard />
</FinancialModelingProContent>
```

**2. Basic Financial (No Module)**
```tsx
<BasicFinancialContent>
  <SimpleCalculator>
    Purchase Price: $5,000,000
    Down Payment: $1,000,000
    Monthly Payment: $24,532
    Estimated NOI: $350,000
    Cap Rate: 7.0%
  </SimpleCalculator>
  
  <ModuleUpsellBanner module="financial-modeling-pro" />
</BasicFinancialContent>
```

---

## Phase 3: Module Enhancements (Week 3)

### Financial Modeling Pro

**Features to Build:**
1. **Component Builder** - Drag-drop 13 financial blocks
2. **Sensitivity Analysis** - Multi-variable stress testing
3. **Monte Carlo** - Probabilistic modeling (1000 scenarios)
4. **Waterfall Models** - Distribution calculations
5. **Export** - Excel/PDF pro-forma

**Database:**
```sql
CREATE TABLE financial_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  name            TEXT,
  version         INTEGER DEFAULT 1,
  components      JSONB,  -- Array of component configs
  assumptions     JSONB,  -- Base case assumptions
  results         JSONB,  -- Calculated metrics
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

### Strategy Arbitrage Engine

**Features:**
1. **39 Pre-loaded Strategies** - Value-Add, Core, Opportunistic, etc.
2. **Custom Strategy Builder** - Define your own
3. **ROI Comparison Matrix** - Compare strategies side-by-side
4. **Risk Scoring** - Quantify strategy risk
5. **Recommendations** - AI-suggested best fit

**Database:**
```sql
CREATE TABLE strategy_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  strategy_slug   TEXT NOT NULL,
  assumptions     JSONB,
  roi_metrics     JSONB,
  risk_score      DECIMAL(3,2),
  recommended     BOOLEAN DEFAULT false,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### Due Diligence Suite

**Features:**
1. **Smart Checklist** - Contextual tasks based on deal type
2. **Risk Scoring** - Auto-calculate DD risk score
3. **Document Review** - AI extraction & validation
4. **Property Condition** - Inspection tracking
5. **Timeline Management** - Critical dates & deadlines

**Database:**
```sql
CREATE TABLE dd_checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  checklist_type  TEXT NOT NULL,  -- "multifamily-value-add", "office-core", etc.
  tasks           JSONB,          -- Array of task objects
  completion_pct  DECIMAL(5,2),
  risk_score      DECIMAL(3,2),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dd_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES dd_checklists(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  category        TEXT,
  priority        TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status          TEXT CHECK (status IN ('pending', 'in_progress', 'complete', 'blocked')),
  due_date        DATE,
  assigned_to     UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  completed_at    TIMESTAMP
);
```

---

## Phase 4: Module Suggestion Popup (Week 3)

### Goal
Show contextual module recommendations on deal creation.

### Trigger
After user completes /deals/new wizard and deal is created.

### Popup UI
```
┌───────────────────────────────────────────────────────┐
│ 🎯 Recommended Modules for This Deal                  │
│                                                       │
│ Based on your Multifamily Value-Add deal, we         │
│ recommend activating these modules:                   │
│                                                       │
│ [✓] Financial Modeling Pro          Included ✓       │
│     Component-based pro-forma builder                 │
│                                                       │
│ [✓] Market Signals                  Included ✓       │
│     Supply pipeline & competitor tracking             │
│                                                       │
│ [✓] Due Diligence Suite             Included ✓       │
│     Smart checklist with risk scoring                 │
│                                                       │
│ [ ] Development Tracker             $39/mo           │
│     Not in your plan. Add for $39/mo?                │
│     [Add Module]                                      │
│                                                       │
│ [Activate Recommended (3)]           [Skip]          │
└───────────────────────────────────────────────────────┘
```

### Logic
```typescript
function getSuggestedModules(deal: Deal): Module[] {
  const suggestions: Record<string, string[]> = {
    'multifamily-value-add': [
      'financial-modeling-pro',
      'market-signals',
      'dd-suite',
      'strategy-arbitrage'
    ],
    'multifamily-core': [
      'financial-analysis-pro',
      'rent-roll-manager',
      'portfolio-dashboard'
    ],
    'office-development': [
      'development-tracker',
      'zoning-interpreter',
      'site-plan-analyzer',
      'dev-budget'
    ],
    // ... more mappings
  };
  
  const key = `${deal.productType}-${deal.strategy}`.toLowerCase();
  const moduleSlugs = suggestions[key] || [];
  
  return moduleSlugs
    .map(slug => getModule(slug))
    .filter(module => userHasAccess(module));
}
```

### Database
```sql
CREATE TABLE deal_module_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  module_slug     TEXT NOT NULL,
  suggested_at    TIMESTAMP DEFAULT NOW(),
  activated       BOOLEAN DEFAULT false,
  activated_at    TIMESTAMP,
  dismissed       BOOLEAN DEFAULT false
);
```

---

## Development Timeline

### Week 1: Settings > Modules (Feb 10-16)
- **Day 1:** Database schema + seed data
- **Day 2:** API endpoints (GET, PATCH, POST)
- **Day 3:** ModuleMarketplace component
- **Day 4:** ModuleToggleCard + categories
- **Day 5:** Purchase/upgrade flows
- **Testing:** User can toggle modules, see bundle status

### Week 2: Deal Page Redesign (Feb 17-23)
- **Day 1:** DealPage layout + SectionCard component
- **Day 2:** OverviewSection + PropertiesSection
- **Day 3:** FinancialAnalysisSection (basic + pro stub)
- **Day 4:** StrategySection + DDSection (basic + stubs)
- **Day 5:** DocumentsSection + ActivityFeed
- **Testing:** All sections render, expand/collapse works

### Week 3: Module Enhancements (Feb 24-Mar 2)
- **Day 1-2:** Financial Modeling Pro (component builder)
- **Day 3:** Strategy Arbitrage (pre-loaded strategies)
- **Day 4:** DD Suite (smart checklist)
- **Day 5:** Module suggestion popup
- **Testing:** Enhanced features vs basic comparison

### Week 4: Assets Owned + Projects (Mar 3-9)
- Apply same pattern to /assets-owned/:assetId
- Apply same pattern to /projects/:projectId (future)

---

## Testing Checklist

### Settings > Modules
- [ ] User can view all modules grouped by category
- [ ] User can toggle modules ON/OFF if subscribed
- [ ] User sees upsell for unsubscribed modules
- [ ] Purchase flow opens Stripe checkout
- [ ] Bundle upgrade flow works
- [ ] Changes persist (refresh keeps state)
- [ ] Effect visible on deal pages (sections enhanced/basic)

### Deal Page
- [ ] All sections render
- [ ] Sections expand/collapse (accordion)
- [ ] Enhanced sections show pro features
- [ ] Basic sections show simplified version
- [ ] Upsell banners appear for inactive modules
- [ ] Mobile responsive (expandable sections)
- [ ] Performance OK with all sections expanded
- [ ] Back navigation returns to grid view

### Module Enhancements
- [ ] Financial Modeling Pro: Component builder works
- [ ] Financial Modeling Pro: Calculations accurate
- [ ] Strategy Arbitrage: 39 strategies loaded
- [ ] Strategy Arbitrage: Custom strategy creation works
- [ ] DD Suite: Smart checklist generates
- [ ] DD Suite: Risk scoring calculates
- [ ] Module data saves/loads correctly
- [ ] Switching module OFF hides data (doesn't delete)

### Module Suggestions
- [ ] Popup shows after deal creation
- [ ] Correct modules suggested for deal type
- [ ] User can activate recommended modules
- [ ] User can skip suggestions
- [ ] Dismissed suggestions don't re-appear
- [ ] Purchase flow works for unsubscribed modules

---

## Rollout Plan

### Stage 1: Internal Testing (Week 1-2)
- Deploy to dev environment
- Test with Leon's account
- Settings > Modules page functional
- Deal page basic structure working

### Stage 2: Beta Testing (Week 3)
- Deploy to staging
- Invite 5-10 beta users
- Module enhancements visible
- Collect feedback

### Stage 3: Phased Production (Week 4)
- Deploy to production with feature flag
- Enable for new deals only (schema v2)
- Legacy deals see "Upgrade" button
- Monitor usage, errors, performance

### Stage 4: General Availability (Week 5+)
- Feature flag ON for all users
- Legacy deal migration available
- Marketing push (module marketplace)
- Subscription upsells active

---

## Success Metrics

**Week 1:**
- Settings > Modules page complete
- Users can toggle modules
- Effect visible on deal pages

**Week 2:**
- Deal page redesign complete
- All sections rendering
- Accordion working

**Week 3:**
- 3 module enhancements live
- Module suggestions working
- Beta testing started

**Week 4:**
- Production rollout started
- 10+ users testing
- Zero critical bugs

**Month 2:**
- 50% of users activated at least 1 module
- 20% purchased a la carte module
- 10% upgraded bundle

---

**Status:** Ready to build  
**Start Date:** Monday, February 10, 2026  
**First Milestone:** Settings > Modules page (end of Week 1)
