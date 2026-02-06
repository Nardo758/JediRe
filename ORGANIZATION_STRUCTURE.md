# 🗂️ JEDI RE - Organization Structure

**Goal:** Everything connected, easy to find, well-organized

---

## 📐 Structure Overview

```
JEDI RE Platform
│
├── 🎨 Wireframe Pages (Visual UI)
│   ├── Map View ─────────────┐
│   ├── Dashboard ─────────────┤
│   ├── Properties ────────────┤
│   ├── Deals ─────────────────┼──► Each links to Architecture
│   ├── Email ─────────────────┤
│   ├── Reports ───────────────┤
│   ├── Team ──────────────────┤
│   └── Settings ──────────────┘
│
├── 🏗️ Architecture Page (Technical Diagrams)
│   ├── System Overview
│   ├── Data Model
│   ├── Module Architecture
│   ├── Authentication Flow
│   ├── Map & Boundaries
│   ├── Email Integration
│   ├── WebSocket
│   ├── AI Agents
│   ├── Property Search Flow
│   ├── Analysis Flow
│   ├── Deployment
│   └── Subscription Tiers
│
├── 📖 Documentation (Markdown Files)
│   ├── WIREFRAME_GUIDE.md
│   ├── SYSTEM_DIAGRAMS.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── PYTHON_ENGINE_INTEGRATION.md
│   ├── QUICK_TEST_GUIDE.md
│   └── ARCHITECTURE_PAGE_GUIDE.md
│
└── 🔗 Cross-Links
    └── Every page → Relevant architecture → Relevant docs
```

---

## 🔗 How It's Connected

### **From UI Page → Architecture**

Each wireframe page has a header with links:

```tsx
<PageHeader
  title="Properties"
  description="Manage your property portfolio"
  icon="🏠"
  architectureDiagram="property-search"  // Links to Property Search diagram
  documentation="/docs/PROPERTIES.md"    // Links to properties docs
/>
```

### **From Architecture → UI Pages**

Each diagram shows which UI pages use it:

```
Property Search Flow
↓
Used by:
• Properties Page
• Map View
• Dashboard (property cards)
```

### **From Docs → Everything**

Documentation references both UI and architecture:

```markdown
See: Properties Page (/properties)
Architecture: Property Search Flow (/architecture?diagram=property-search)
```

---

## 📋 Page-to-Architecture Mapping

| Page | Primary Architecture Diagram | Secondary Diagrams |
|------|------------------------------|-------------------|
| Map View | Map & Boundaries | System Overview, Property Search |
| Dashboard | System Overview | Data Model, All Flows |
| Properties | Property Search Flow | Data Model, Map & Boundaries |
| Deals | Data Model | Module Architecture, Analysis Flow |
| Email | Email Integration | System Overview, AI Agents |
| Reports | Analysis Flow | Data Model |
| Team | Authentication Flow | Subscription Tiers |
| Settings | Subscription Tiers | Authentication Flow |

---

## 🎯 Navigation Patterns

### **Pattern 1: Quick Reference**
```
Working on Properties Page
    ↓ Click "🏗️ View Architecture"
    ↓ See Property Search Flow diagram
    ↓ Understand: UI → API → PostGIS → Response
```

### **Pattern 2: Deep Dive**
```
Planning new feature
    ↓ Start at Architecture Page
    ↓ See System Overview
    ↓ Identify which layers it touches
    ↓ Navigate to relevant UI pages
    ↓ Check documentation links
```

### **Pattern 3: Learning**
```
New team member
    ↓ Architecture Page (System Overview)
    ↓ Data Model (understand deal-centric approach)
    ↓ Click through each page
    ↓ See how architecture manifests in UI
```

---

## 🗂️ File Organization

### **Frontend Structure**
```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx        # Sidebar + header + chat
│   │   └── PageHeader.tsx        # Page titles + arch links
│   ├── chat/
│   │   ├── ChatOverlay.tsx       # Floating chat
│   │   └── ChatInput.tsx
│   └── dashboard/
│       └── AgentStatusBar.tsx    # Bottom status
│
├── pages/
│   ├── MapPage.tsx               # 🗺️ Map view
│   ├── Dashboard.tsx             # 📊 Dashboard
│   ├── PropertiesPage.tsx        # 🏠 Properties
│   ├── DealsPage.tsx             # 💼 Deals
│   ├── DealView.tsx              # Individual deal
│   ├── EmailPage.tsx             # 📧 Email
│   ├── ReportsPage.tsx           # 📈 Reports
│   ├── TeamPage.tsx              # 👥 Team
│   ├── SystemArchitecturePage.tsx # 🏗️ Architecture
│   └── SettingsPage.tsx          # ⚙️ Settings
│
└── App.tsx                        # Main router
```

### **Documentation Structure**
```
jedire/
├── WIREFRAME_GUIDE.md              # How to use wireframes
├── ARCHITECTURE_PAGE_GUIDE.md      # How to use arch page
├── ORGANIZATION_STRUCTURE.md       # This file
├── SYSTEM_DIAGRAMS.md              # Full ASCII diagrams
├── TECHNICAL_ARCHITECTURE.md       # Backend details
├── COMPLETE_UI_DESIGN_SYSTEM.md    # Complete UI specs
├── PYTHON_ENGINE_INTEGRATION.md    # Analysis engines
└── QUICK_TEST_GUIDE.md             # Deployment guide
```

---

## ✅ Benefits of This Organization

### **For Development**
- ✅ Easy to find relevant architecture
- ✅ Clear connection UI ↔ Backend
- ✅ Quick reference while coding
- ✅ Documentation always one click away

### **For Planning**
- ✅ See full system at a glance
- ✅ Understand feature dependencies
- ✅ Estimate complexity accurately
- ✅ Identify integration points

### **For Onboarding**
- ✅ Visual learning (UI first)
- ✅ Technical depth (arch diagrams)
- ✅ Documentation (detailed specs)
- ✅ Progressive disclosure (learn as you go)

### **For Team Collaboration**
- ✅ Shared understanding
- ✅ Common visual language
- ✅ Easy to discuss features
- ✅ Clear handoff points

---

## 🎨 Visual Indicators

### **Page Headers**
Every page shows:
```
┌─────────────────────────────────────────────┐
│ 🏠 Properties                              │
│ Manage your property portfolio             │
│                                             │
│ 🏗️ View Architecture  📖 Documentation     │
└─────────────────────────────────────────────┘
```

### **Architecture Diagrams**
Every diagram shows:
```
┌─────────────────────────────────────────────┐
│ 🔍 Property Search Flow                    │
│                                             │
│ [Diagram content]                           │
│                                             │
│ Used in:                                    │
│ • Properties Page                           │
│ • Map View                                  │
│ • Dashboard                                 │
└─────────────────────────────────────────────┘
```

---

## 📝 How to Use This Structure

### **When Building Features:**
1. Check relevant wireframe page
2. Click "View Architecture" link
3. Understand data flow
4. Read linked documentation
5. Build with full context

### **When Reviewing:**
1. Start at wireframe
2. Verify UI matches intent
3. Check architecture diagram
4. Confirm data flow makes sense
5. Validate against documentation

### **When Debugging:**
1. Identify affected page
2. View architecture diagram
3. Trace data flow
4. Check each layer
5. Reference docs for details

---

## 🔄 Keeping It Organized

### **When Adding New Pages:**
1. Create wireframe page
2. Add to MainLayout navigation
3. Create PageHeader with arch links
4. Update architecture diagram (if needed)
5. Document in relevant .md files

### **When Modifying Architecture:**
1. Update architecture diagram
2. Update related wireframe pages
3. Update documentation
4. Test cross-links still work

### **Regular Maintenance:**
1. Weekly: Check links still valid
2. Sprint end: Update diagrams with changes
3. Monthly: Review organization structure
4. As needed: Add new diagrams/docs

---

## 🎯 Next Steps

### **Immediate:**
- ✅ Wireframe structure complete
- ✅ Architecture page built (2 diagrams)
- ✅ Organization structure documented
- ⏳ Add PageHeader to all pages (optional)
- ⏳ Build remaining diagrams (as needed)

### **Review Phase:**
1. Navigate through all pages
2. Check if organization makes sense
3. Test cross-links
4. Identify any missing connections
5. Adjust structure as needed

### **Build Phase:**
After organization approved:
1. Fill in feature functionality
2. Keep architecture diagrams updated
3. Document as you build
4. Maintain cross-links

---

## 💡 Tips for Staying Organized

**Do:**
- ✅ Update diagrams when architecture changes
- ✅ Link related pages together
- ✅ Keep documentation current
- ✅ Use consistent naming
- ✅ Add comments in code referencing diagrams

**Don't:**
- ❌ Let docs drift from reality
- ❌ Create orphan pages
- ❌ Duplicate information
- ❌ Hide important diagrams
- ❌ Break cross-links

---

## 📊 Current Status

**Wireframe:** ✅ Complete (8 pages)  
**Architecture:** ✅ Page built, 2 diagrams complete  
**Documentation:** ✅ 6 comprehensive guides  
**Cross-linking:** ⏳ PageHeader ready, needs adoption  
**Organization:** ✅ This document  

---

**Status:** 🎯 Well-organized structure ready for review and use

**Everything is connected. Everything has a place. Nothing is lost.**

🚀
