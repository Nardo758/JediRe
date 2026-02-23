# Deal Capsule Module Reorganization
**Date:** February 22, 2026  
**Scope:** Module organization WITHIN individual deals  
**Goal:** Create natural workflow progression inside a deal

---

## Current Structure (Issues)

### Current Categories (6 groups, 21 modules):
```
1. DEAL STATUS (4)
   - Overview
   - 3D Building Design
   - Deal Lifecycle
   - Context Tracker

2. ANALYSIS (5)
   - Market Intelligence
   - Competition Analysis
   - Supply Pipeline
   - Trends Analysis
   - Traffic Engine

3. FINANCIAL (3)
   - Financial Model
   - Debt & Financing
   - Exit Strategy

4. OPERATIONS (4)
   - Due Diligence
   - Project Timeline
   - Project Management
   - Zoning & Entitlements

5. DOCUMENTS (3)
   - Documents
   - Files & Assets
   - Notes

6. AI TOOLS (2)
   - Opus AI Agent
   - AI Recommendations
```

### Problems Identified:
1. **No Clear Deal Stage Progression** - Doesn't match underwriting → development → operations flow
2. **Mixed Abstraction Levels** - "Overview" vs "Traffic Engine" in different categories but similar importance
3. **Analysis Too Broad** - 5 modules is overwhelming, some are more critical than others
4. **3D Design Buried** - Super important but hidden in "Deal Status" 
5. **No Priority Signals** - Can't tell what's urgent vs optional
6. **AI Tools Separated** - Should be contextual, not isolated

---

## Proposed Structure: Deal Stage-Based Flow

### Philosophy:
**Organize by WHEN you need it in the deal lifecycle, not WHAT it is**

---

## 📋 NEW ORGANIZATION (6 stages)

### 1️⃣ OVERVIEW & SETUP
**When:** Starting the deal, getting oriented  
**Purpose:** Quick snapshot and essential info

```
📋 OVERVIEW & SETUP
├── 🎯 Deal Overview           [Existing: Overview]
├── 📊 Deal Lifecycle          [Existing: Deal Lifecycle]
└── 🧭 Context Tracker         [Existing: Context Tracker]
```

**Why this order:**
- Start with high-level view
- Understand current stage
- Track changes and context

---

### 2️⃣ MARKET RESEARCH
**When:** Evaluating the opportunity  
**Purpose:** Understand market, competition, and demand

```
🔍 MARKET RESEARCH
├── 🏙️ Market Intelligence    [Existing: Market Intelligence]
├── 🎯 Competition Analysis    [Existing: Competition Analysis]
├── 📦 Supply Pipeline         [Existing: Supply Pipeline]
├── 📈 Trends Analysis         [Existing: Trends Analysis]
└── 🚗 Traffic Engine          [Existing: Traffic Engine]
```

**Renamed from:** "ANALYSIS" (more specific)  
**Order logic:** Market → Competition → Supply → Trends → Traffic (broad to specific)

---

### 3️⃣ DEAL DESIGN
**When:** Designing the project  
**Purpose:** Create physical and financial structure

```
🎨 DEAL DESIGN
├── 🏗️ 3D Building Design     [Existing: 3D Building Design]
├── 💰 Financial Model         [Existing: Financial Model]
├── 💳 Debt & Financing        [Existing: Debt & Financing]
└── 🚪 Exit Strategy           [Existing: Exit Strategy]
```

**Why together:**
- 3D design drives unit mix
- Unit mix drives financial model
- Financial model determines debt needs
- Exit strategy validates returns

**Order logic:** Design → Model → Finance → Exit (creative to analytical)

---

### 4️⃣ DUE DILIGENCE
**When:** Before closing/construction  
**Purpose:** Verify assumptions and risks

```
✅ DUE DILIGENCE
├── 📋 Due Diligence Checklist [Existing: Due Diligence]
├── 🏛️ Zoning & Entitlements   [Existing: Zoning & Entitlements]
├── 📄 Documents               [Existing: Documents]
└── 📁 Files & Assets          [Existing: Files & Assets]
```

**Why together:**
- All verification activities
- Legal and regulatory focus
- Documentation-heavy
- Must complete before proceeding

**Order logic:** Checklist → Legal → Documents → Files (high-level to granular)

---

### 5️⃣ EXECUTION
**When:** Active construction/development  
**Purpose:** Manage the build and delivery

```
🚀 EXECUTION
├── 📅 Project Timeline        [Existing: Project Timeline]
├── 💼 Project Management      [Existing: Project Management]
└── 📝 Notes                   [Existing: Notes]
```

**Why together:**
- Active project management
- Day-to-day operations
- Timeline-driven work

**Order logic:** Timeline → Management → Notes (planning to execution to tracking)

---

### 6️⃣ AI ASSISTANT
**When:** Throughout all stages  
**Purpose:** AI-powered help and recommendations

```
🤖 AI ASSISTANT
├── 🎯 Opus AI Agent           [Existing: Opus AI Agent]
└── 💡 AI Recommendations      [Existing: AI Recommendations]
```

**Why separate:**
- Available at all times
- Cross-cutting functionality
- Different interaction model

---

## Visual Comparison

### BEFORE (Current):
```
┌─────────────────────────┐
│ DEAL STATUS        [4]  │  ← Mix of important stuff
│ ANALYSIS           [5]  │  ← Too many modules
│ FINANCIAL          [3]  │  ← Separated from design
│ OPERATIONS         [4]  │  ← Mix of DD and execution
│ DOCUMENTS          [3]  │  ← Isolated from DD
│ AI TOOLS           [2]  │  ← Bottom of list
└─────────────────────────┘
```

### AFTER (Proposed):
```
┌─────────────────────────┐
│ 📋 OVERVIEW & SETUP [3] │  ← Start here
│ 🔍 MARKET RESEARCH  [5] │  ← Evaluate opportunity
│ 🎨 DEAL DESIGN      [4] │  ← Create the deal
│ ✅ DUE DILIGENCE    [4] │  ← Verify & validate
│ 🚀 EXECUTION        [3] │  ← Build & deliver
│ 🤖 AI ASSISTANT     [2] │  ← Always available
└─────────────────────────┘
```

---

## Module Progression Flow

### Example: New Deal Workflow
```
START
  ↓
1. OVERVIEW & SETUP
   → Get oriented with deal basics
   → Review lifecycle stage
   ↓
2. MARKET RESEARCH
   → Analyze market conditions
   → Study competition
   → Review supply pipeline
   → Check trends and traffic
   ↓
3. DEAL DESIGN
   → Design 3D building
   → Build financial model
   → Structure debt
   → Plan exit strategy
   ↓
4. DUE DILIGENCE
   → Complete DD checklist
   → Verify zoning/entitlements
   → Collect documents
   → Organize files
   ↓
5. EXECUTION
   → Track project timeline
   → Manage construction
   → Document progress
   ↓
COMPLETE
```

### Visual Deal Stage Indicator
Each section could show progress:
```
┌─────────────────────────────────┐
│ Deal Stage: DESIGN              │
├─────────────────────────────────┤
│ ✅ Overview & Setup    Complete │
│ ✅ Market Research     Complete │
│ 🟡 Deal Design        In Progress│
│ ⬜ Due Diligence      Not Started│
│ ⬜ Execution          Not Started│
└─────────────────────────────────┘
```

---

## Enhanced Features

### 1. Smart Suggestions
Show next logical steps based on current progress:
```
┌──────────────────────────────┐
│ 💡 Suggested Next Steps      │
├──────────────────────────────┤
│ → Complete Financial Model   │
│   80% done, finish debt calc │
│                              │
│ → Start Due Diligence        │
│   Design phase nearly done   │
└──────────────────────────────┘
```

### 2. Module Status Badges
```
📋 OVERVIEW & SETUP
├── 🎯 Deal Overview           ✅
├── 📊 Deal Lifecycle          ✅
└── 🧭 Context Tracker         🟡 (2 updates)

🔍 MARKET RESEARCH
├── 🏙️ Market Intelligence    ✅
├── 🎯 Competition Analysis    ✅
├── 📦 Supply Pipeline         ✅
├── 📈 Trends Analysis         ⚠️ (Data stale)
└── 🚗 Traffic Engine          ✅
```

**Badge meanings:**
- ✅ Complete
- 🟡 In Progress
- ⚠️ Needs Attention
- ⬜ Not Started
- 🆕 Recently Added

### 3. Contextual AI
AI assistant appears contextually in each section:
```
Currently viewing: 3D Building Design
┌────────────────────────────────┐
│ 🤖 AI Suggestions              │
├────────────────────────────────┤
│ "Your unit mix may impact      │
│  parking requirements.         │
│  Review zoning requirements."  │
│                                │
│ [View Details] [Ask AI]        │
└────────────────────────────────┘
```

### 4. Progress Tracking
Show overall deal completion:
```
┌─────────────────────────────────────┐
│ Deal Progress: 45% Complete         │
│ ████████████░░░░░░░░░░░░░░          │
├─────────────────────────────────────┤
│ ✅ Overview & Setup       100%      │
│ ✅ Market Research        100%      │
│ 🟡 Deal Design            80%       │
│ ⬜ Due Diligence          0%        │
│ ⬜ Execution               0%        │
└─────────────────────────────────────┘
```

---

## Implementation Details

### Code Changes Required:

#### 1. Update Tab Groups (DealDetailPage.tsx):
```typescript
// NEW organization
const overviewTabs: Tab[] = [
  { id: 'overview', label: 'Deal Overview', ... },
  { id: 'deal-status', label: 'Deal Lifecycle', ... },
  { id: 'context-tracker', label: 'Context Tracker', ... },
];

const marketResearchTabs: Tab[] = [
  { id: 'market-intelligence', label: 'Market Intelligence', ... },
  { id: 'competition', label: 'Competition Analysis', ... },
  { id: 'supply', label: 'Supply Pipeline', ... },
  { id: 'trends', label: 'Trends Analysis', ... },
  { id: 'traffic', label: 'Traffic Engine', ... },
];

const dealDesignTabs: Tab[] = [
  { id: '3d-design', label: '3D Building Design', ... },
  { id: 'financial-model', label: 'Financial Model', ... },
  { id: 'debt', label: 'Debt & Financing', ... },
  { id: 'exit', label: 'Exit Strategy', ... },
];

const dueDiligenceTabs: Tab[] = [
  { id: 'due-diligence', label: 'DD Checklist', ... },
  { id: 'zoning', label: 'Zoning & Entitlements', ... },
  { id: 'documents', label: 'Documents', ... },
  { id: 'files', label: 'Files & Assets', ... },
];

const executionTabs: Tab[] = [
  { id: 'timeline', label: 'Project Timeline', ... },
  { id: 'project-management', label: 'Project Management', ... },
  { id: 'notes', label: 'Notes', ... },
];

const aiAssistantTabs: Tab[] = [
  { id: 'ai-agent', label: 'Opus AI Agent', ... },
  { id: 'ai-recommendations', label: 'AI Recommendations', ... },
];
```

#### 2. Update TabGroup Components:
```typescript
<TabGroup
  id="overview-setup"
  title="OVERVIEW & SETUP"
  emoji="📋"
  tabs={overviewTabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  defaultExpanded={true}
  progress={100}  // NEW: Show completion %
/>
```

#### 3. Add Progress Tracking:
```typescript
const [moduleProgress, setModuleProgress] = useState({
  'overview-setup': 100,
  'market-research': 100,
  'deal-design': 80,
  'due-diligence': 0,
  'execution': 0,
});
```

---

## Benefits

### 1. **Clear Workflow** 
Users know exactly where they are in the deal process

### 2. **Natural Progression**
Modules appear in the order you actually use them

### 3. **Better Context**
Related modules grouped together (design + financial)

### 4. **Reduced Cognitive Load**
Fewer categories with clearer purposes

### 5. **Smart Guidance**
System can suggest next steps based on progress

### 6. **Scalable**
Easy to add new modules in the right stage

### 7. **Professional**
Matches how real estate pros actually work

---

## Phased Implementation

### Phase 1: Reorganize Categories (30 min)
- Update tab group definitions
- Change category names and icons
- Test navigation still works

### Phase 2: Add Progress Indicators (1 hour)
- Add completion % to each category
- Show overall deal progress
- Visual progress bars

### Phase 3: Smart Suggestions (2 hours)
- "Next Steps" recommendations
- Status badges on modules
- Warning for stale data

### Phase 4: Contextual AI (2 hours)
- AI assistant appears in each section
- Context-aware suggestions
- Quick AI actions per module

---

## Alternative Considerations

### Option A: Deal Type Specific
Different module organization based on deal type:
- **Acquisition** → Focus on DD and financial
- **Development** → Focus on design and timeline
- **Disposition** → Focus on marketing and exit

### Option B: User Role Specific
Different view for different roles:
- **Developer** → Design and timeline first
- **Analyst** → Financial and market first
- **PM** → Timeline and execution first

### Option C: Smart Sections
System auto-organizes based on:
- Current deal stage
- Most frequently used modules
- User preferences

---

## Questions for Leon

1. **Does the stage-based flow match your process?**
   - Overview → Research → Design → DD → Execution

2. **Any modules you'd move to different stages?**
   - e.g., Should Financial Model be in Research instead of Design?

3. **Priority on implementation phases?**
   - Start with Phase 1 (reorganize) or Phase 3 (smart features)?

4. **Interest in role-specific views?**
   - Different layouts for different team members?

5. **Any missing modules or stages?**
   - Marketing stage? Operations stage?

---

## Next Steps

1. **Review & Approve** this structure
2. **Choose implementation phase** to start with
3. **Build Phase 1** (30 min - just reorganization)
4. **Test with real deal**
5. **Iterate based on feedback**

Ready to implement! 🚀
