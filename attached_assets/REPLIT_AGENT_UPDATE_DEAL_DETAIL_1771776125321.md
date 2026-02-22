# Replit Agent Instructions: Update DealDetailPage.tsx

## Objective
Update `jedire/frontend/src/pages/DealDetailPage.tsx` to:
1. Replace old section components with new enhanced pages from Friday's build
2. Add 3D Design Dashboard
3. Consolidate redundant modules

---

## Part 1: Update Imports

**ADD these imports at the top:**

```typescript
import { CompetitionPage } from './development/CompetitionPage';
import { DueDiligencePage } from './development/DueDiligencePage';
import { MarketAnalysisPage } from './development/MarketAnalysisPage';
import { ProjectTimelinePage } from './development/ProjectTimelinePage';
import { SupplyPipelinePage } from './development/SupplyPipelinePage';
import { Design3DPageEnhanced } from './Design3DPage.enhanced';
import { Cube } from 'lucide-react';
```

**REMOVE these old imports:**
```typescript
import MarketSection from '../components/deal/sections/MarketSection';
import { CompetitionSection } from '../components/deal/sections/CompetitionSection';
import SupplySection from '../components/deal/sections/SupplySection';
import TimelineSection from '../components/deal/sections/TimelineSection';
import DocumentsSection from '../components/deal/sections/DocumentsSection';
import NotesSection from '../components/deal/sections/NotesSection';
```

---

## Part 2: Update analysisTabs Array

**REPLACE the entire analysisTabs array with:**

```typescript
const analysisTabs: Tab[] = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: <BarChart3 size={16} />, 
    component: OverviewSection 
  },
  { 
    id: '3d-design', 
    label: '3D Building Design', 
    icon: <Cube size={16} />, 
    component: Design3DPageEnhanced 
  },
  { 
    id: 'market-analysis', 
    label: 'Market Analysis', 
    icon: <TrendingUp size={16} />, 
    component: MarketAnalysisPage 
  },
  { 
    id: 'competition', 
    label: 'Competition Analysis', 
    icon: <Target size={16} />, 
    component: CompetitionPage 
  },
  { 
    id: 'supply', 
    label: 'Supply Pipeline', 
    icon: <Package size={16} />, 
    component: SupplyPipelinePage 
  },
];
```

**KEY CHANGES:**
- Added "3D Building Design" (NEW)
- Replaced MarketSection with MarketAnalysisPage
- Replaced CompetitionSection with CompetitionPage
- Replaced SupplySection with SupplyPipelinePage
- REMOVED "Exit Analysis" (moving to FINANCIAL)

---

## Part 3: Update financialTabs Array

**REPLACE the entire financialTabs array with:**

```typescript
const financialTabs: Tab[] = [
  { 
    id: 'strategy', 
    label: 'Investment Strategy', 
    icon: <Target size={16} />, 
    component: InvestmentStrategySection 
  },
  { 
    id: 'financial-model', 
    label: 'Financial Model', 
    icon: <Calculator size={16} />, 
    component: FinancialModelingSection 
  },
  { 
    id: 'debt', 
    label: 'Debt & Financing', 
    icon: <CreditCard size={16} />, 
    component: DebtSection 
  },
  { 
    id: 'exit', 
    label: 'Exit Analysis', 
    icon: <LogOut size={16} />, 
    component: ExitSection 
  },
];
```

**KEY CHANGES:**
- MOVED "Investment Strategy" to FIRST position (before Financial Model)
- MOVED "Exit Analysis" from ANALYSIS to FINANCIAL (last position)

---

## Part 4: Update operationsTabs Array

**REPLACE the entire operationsTabs array with:**

```typescript
const operationsTabs: Tab[] = [
  { 
    id: 'due-diligence', 
    label: 'Due Diligence', 
    icon: <ClipboardCheck size={16} />, 
    component: DueDiligencePage 
  },
  { 
    id: 'timeline', 
    label: 'Project Timeline', 
    icon: <Calendar size={16} />, 
    component: ProjectTimelinePage 
  },
  { 
    id: 'team', 
    label: 'Team & Roles', 
    icon: <Users size={16} />, 
    component: TeamSection 
  },
];
```

**KEY CHANGES:**
- Replaced TimelineSection with ProjectTimelinePage
- Replaced DueDiligenceSection with DueDiligencePage

---

## Part 5: Update documentsTabs Array

**REPLACE the entire documentsTabs array with:**

```typescript
const documentsTabs: Tab[] = [
  { 
    id: 'files', 
    label: 'Files & Assets', 
    icon: <FolderOpen size={16} />, 
    component: FilesSection 
  },
];
```

**KEY CHANGES:**
- REMOVED "Documents" tab (redundant with Files & Assets)
- REMOVED "Notes" tab (features merged into Context Builder)

---

## Part 6: Update aiToolsTabs Array

**REPLACE the entire aiToolsTabs array with:**

```typescript
const aiToolsTabs: Tab[] = [
  { 
    id: 'ai-agent', 
    label: 'AI Agent / Opus', 
    icon: <Bot size={16} />, 
    component: OpusAISection 
  },
  { 
    id: 'context', 
    label: 'Context Builder', 
    icon: <Globe size={16} />, 
    component: ContextTrackerSection 
  },
];
```

**KEY CHANGES:**
- Context Builder now includes Deal Capsule Summary features
- Context Builder now includes Notes features
- These enhancements need to be made to ContextTrackerSection component separately

---

## Part 7: Update dealStatusTabs Array

**REMOVE this entire array** - Deal Status will be handled by Context Builder

**DELETE these lines:**
```typescript
const dealStatusTabs: Tab[] = [
  { id: 'deal-status', label: 'Deal Capsule Summary', icon: <Building2 size={16} />, component: DealStatusComponent },
];
```

---

## Part 8: Update settingsTabs Array

**REMOVE this entire array** - Settings dropdown handles this

**DELETE these lines:**
```typescript
const settingsTabs: Tab[] = [
  { id: 'settings', label: 'Deal Settings', icon: <Settings size={16} />, component: DealSettingsComponent },
];
```

---

## Part 9: Update allTabs Array

**REPLACE with:**

```typescript
const allTabs = [
  ...analysisTabs,
  ...financialTabs,
  ...operationsTabs,
  ...documentsTabs,
  ...aiToolsTabs,
];
```

**KEY CHANGE:**
- REMOVED `...dealStatusTabs` and `...settingsTabs` from concatenation

---

## Part 10: Update TabGroup Rendering (in JSX)

**FIND the section with TabGroup components and REPLACE with:**

```typescript
<nav className="flex-1">
  <TabGroup
    id="analysis"
    title="ANALYSIS"
    icon={<BarChart3 size={18} />}
    tabs={analysisTabs}
    activeTab={activeTab}
    onTabChange={setActiveTab}
    defaultExpanded={true}
  />
  <TabGroup
    id="financial"
    title="FINANCIAL"
    icon={<DollarSign size={18} />}
    tabs={financialTabs}
    activeTab={activeTab}
    onTabChange={setActiveTab}
  />
  <TabGroup
    id="operations"
    title="OPERATIONS"
    icon={<ClipboardCheck size={18} />}
    tabs={operationsTabs}
    activeTab={activeTab}
    onTabChange={setActiveTab}
  />
  <TabGroup
    id="documents"
    title="DOCUMENTS"
    icon={<FileText size={18} />}
    tabs={documentsTabs}
    activeTab={activeTab}
    onTabChange={setActiveTab}
  />
  <TabGroup
    id="ai-tools"
    title="AI TOOLS"
    icon={<Bot size={18} />}
    tabs={aiToolsTabs}
    activeTab={activeTab}
    onTabChange={setActiveTab}
  />
</nav>
```

**KEY CHANGES:**
- REMOVED "DEAL STATUS" TabGroup
- REMOVED "SETTINGS" TabGroup

---

## Part 11: Update Default Tab

**FIND this line:**
```typescript
const [activeTab, setActiveTab] = useState<string>('overview');
```

**No change needed** - 'overview' is still valid

---

## Summary of Changes

### Modules Added:
✅ 3D Building Design (ANALYSIS)
✅ Enhanced Competition, Market Analysis, Supply Pipeline, Due Diligence, Timeline pages

### Modules Consolidated/Removed:
❌ Documents tab (redundant with Files & Assets)
❌ Notes tab (merged into Context Builder)
❌ Deal Capsule Summary (merged into Context Builder)
❌ Deal Settings tab (use Settings dropdown)
❌ Exit Analysis (moved from ANALYSIS to FINANCIAL)

### New Structure (5 Groups, 15 Tabs):

**📊 ANALYSIS (5 tabs)**
1. Overview
2. 3D Building Design ⭐ NEW
3. Market Analysis ⭐ ENHANCED
4. Competition Analysis ⭐ ENHANCED
5. Supply Pipeline ⭐ ENHANCED

**💰 FINANCIAL (4 tabs)**
1. Investment Strategy ⭐ MOVED UP
2. Financial Model
3. Debt & Financing
4. Exit Analysis ⭐ MOVED HERE

**📋 OPERATIONS (3 tabs)**
1. Due Diligence ⭐ ENHANCED
2. Project Timeline ⭐ ENHANCED
3. Team & Roles

**📁 DOCUMENTS (1 tab)**
1. Files & Assets

**🤖 AI TOOLS (2 tabs)**
1. AI Agent / Opus
2. Context Builder ⭐ NOW INCLUDES: Deal Status, Notes, Capsule

---

## Testing Instructions

After making changes:

1. **Restart dev server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Navigate to any deal:**
   ```
   http://localhost:5173/deals/<any-deal-id>
   ```

3. **Verify:**
   - ✅ See 5 groups (not 7)
   - ✅ "3D Building Design" appears in ANALYSIS
   - ✅ "Investment Strategy" appears BEFORE "Financial Model"
   - ✅ "Exit Analysis" appears in FINANCIAL (not ANALYSIS)
   - ✅ Only "Files & Assets" in DOCUMENTS
   - ✅ Context Builder in AI TOOLS
   - ✅ No "Deal Status" or "Settings" groups

4. **Test navigation:**
   - Click "3D Building Design" → Should open full-screen design workspace
   - Click "Competition Analysis" → Should show enhanced competition page
   - Click "Supply Pipeline" → Should show 10-year supply wave

---

## If You Encounter Errors

**Import errors:**
```
Cannot find module './development/CompetitionPage'
```
→ Verify files exist at `jedire/frontend/src/pages/development/`

**Component errors:**
```
ContextTrackerSection is not defined
```
→ This component needs enhancement separately (Context Builder + Deal Status + Notes features)

**Route errors:**
```
Design3DPageEnhanced expects dealId prop
```
→ Pass dealId: `<Design3DPageEnhanced dealId={dealId} />`

---

## Files to Update

1. **Primary:** `jedire/frontend/src/pages/DealDetailPage.tsx`
2. **Later:** `jedire/frontend/src/components/deal/sections/ContextTrackerSection.tsx` (to add Deal Status + Notes features)

---

**Ready to apply these changes?** Make the updates to DealDetailPage.tsx and test!
