# 🚀 JEDI RE - Start Here

## Welcome to the 17-Tab Deal Management System!

Everything is wired together and ready to go. This guide will get you started in 5 minutes.

---

## 📚 Documentation Quick Links

### 🎯 **START HERE** (You are here!)
**File:** `START_HERE.md`
Quick orientation and links to all documentation.

### ⚙️ **Developer Setup** (5-minute setup)
**File:** `DEVELOPER_SETUP.md`
Step-by-step instructions to get the system running locally.

### 🔗 **Integration Guide** (How it all works)
**File:** `INTEGRATION_GUIDE.md`
Complete technical overview of the integration.

### 📊 **Tab Overview** (Reference guide)
**File:** `TAB_OVERVIEW.md`
Detailed documentation of all 17 tabs.

### ✅ **Integration Complete** (Delivery summary)
**File:** `INTEGRATION_COMPLETE.md`
Full deliverables checklist and status.

### 🎨 **Visual Summary** (At-a-glance overview)
**File:** `INTEGRATION_VISUAL_SUMMARY.md`
Visual diagrams and achievement summary.

---

## 🏃 Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
cd jedire/frontend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Mapbox token:
```env
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbHh4eHh4eHgifQ.xxxx
```

**Get your token:** https://account.mapbox.com/access-tokens/

### 3. Start Dev Server
```bash
npm run dev
```

### 4. Open Enhanced Deal Page
```
http://localhost:5173/deals/1/enhanced
```

### 5. Explore All 17 Tabs! 🎉

---

## 📋 The 17-Tab System

```
🔵 CORE INTELLIGENCE
├─ 📊 Overview           (Deal snapshot)
├─ 🗺️ Map View          (Interactive location intelligence)
└─ 🤖 AI Agent          (Opus intelligence hub)

🟢 ASSET & FINANCIAL
├─ 🏢 Properties        (Asset listing)
├─ 💰 Financial         (Pro forma & analysis)
└─ 📈 Market            (Market intelligence)

🟠 MARKET & COMPETITION
├─ 🏆 Competition       (Competitive landscape)
├─ 📦 Supply            (Pipeline tracking)
└─ 💳 Debt              (Financing & lenders)

🟣 STRATEGY & PLANNING
├─ 🎯 Strategy          (Value-add opportunities)
├─ 🚪 Exit              (Disposition planning)
└─ ✅ Due Diligence     (DD checklists)

⚪ OPERATIONS & SUPPORT
├─ 📄 Documents         (File management)
├─ 👥 Team              (Collaboration)
├─ 🧭 Context Tracker   (Deal state memory)
├─ 💬 Notes             (Activity log)
└─ 📅 Timeline          (Milestones)
```

---

## 🎯 Key Features

### ✅ Fully Integrated
- All 17 tabs wired together
- Seamless navigation with smooth scrolling
- Visual feedback on tab switching

### ✅ Cross-Tab Linking
- Overview → Map View (interactive CTA)
- Notes → Map, AI Agent, Context, Documents
- Financial → Strategy, Exit, AI Agent, Debt
- Ring effect highlights on navigation

### ✅ AI-Powered Intelligence
- Opus AI Agent connected to ALL tabs
- Context from every section
- Role-based responses (acquisition/performance)

### ✅ Interactive Mapping
- Dedicated Map View tab
- Mapbox GL integration
- Layer controls, full screen, legend
- Deal boundary rendering

### ✅ Dual-Mode System
- **Acquisition Mode:** Deal sourcing, analysis, closing
- **Performance Mode:** Asset management, operations
- Mode auto-detects from deal status

### ✅ Production-Ready
- Loading states, error boundaries
- Empty states, responsive design
- Consistent styling, polished UI

---

## 🗂️ Project Structure

```
jedire/frontend/
├── src/
│   ├── components/
│   │   └── deal/
│   │       ├── sections/          # All 17 tab sections
│   │       │   ├── OverviewSection.tsx
│   │       │   ├── MapViewSection.tsx
│   │       │   ├── AIAgentSection.tsx
│   │       │   └── ... (14 more)
│   │       └── DealMapView.tsx    # Mapbox integration
│   ├── pages/
│   │   └── DealPageEnhanced.tsx   # Main 17-tab page
│   ├── utils/
│   │   └── dealTabNavigation.ts   # Cross-tab navigation
│   └── data/                      # Mock data files
│
├── .env.example                   # Configuration template
├── START_HERE.md                  # This file!
├── DEVELOPER_SETUP.md             # Setup guide
├── INTEGRATION_GUIDE.md           # Technical overview
├── TAB_OVERVIEW.md                # Complete tab reference
├── INTEGRATION_COMPLETE.md        # Delivery summary
└── INTEGRATION_VISUAL_SUMMARY.md  # Visual overview
```

---

## 🧪 Test the System

### Basic Navigation
1. Load `/deals/1/enhanced`
2. Click tabs in the navigation bar
3. Verify smooth scrolling to each section

### Cross-Tab Links
1. Open Notes tab
2. Click "🗺️ View on Map" → should jump to Map View
3. Click "🤖 Ask AI Agent" → should jump to AI Agent
4. Verify ring highlight effect

### Map View
1. Ensure Mapbox token is in `.env.local`
2. Navigate to Map View tab
3. Verify map loads with tiles
4. Test layer controls
5. Try full screen mode

### Mode Switching
1. View a pipeline deal → Acquisition mode (blue/purple)
2. View an owned deal → Performance mode (green/teal)
3. Verify quick stats change per mode

---

## 🎨 Styling

### Color Schemes

**Acquisition Mode (Pipeline Deals):**
- Primary: Blue (#3B82F6)
- Secondary: Purple (#8B5CF6)
- Gradient: `from-blue-50 to-purple-50`

**Performance Mode (Owned Assets):**
- Primary: Green (#10B981)
- Secondary: Teal (#14B8A6)
- Gradient: `from-green-50 to-teal-50`

### Quick Stats Format
Every tab includes 5 quick stat cards:
```
┌─────────────┐
│ 🏢 Icon     │
│ Label       │
│ Value       │
│ Trend ↗     │
└─────────────┘
```

---

## 🔗 Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Testing
npm run type-check       # TypeScript validation
npm run lint             # ESLint checks
npm run format           # Prettier formatting

# Debugging
npm run dev -- --host    # Expose to network
npm run dev -- --port 3000  # Change port
```

---

## 📞 Need Help?

### Documentation
- Read `DEVELOPER_SETUP.md` for detailed setup
- Check `INTEGRATION_GUIDE.md` for technical details
- Reference `TAB_OVERVIEW.md` for tab documentation

### Common Issues

**Mapbox not loading?**
- Check `.env.local` has `VITE_MAPBOX_TOKEN`
- Verify token is valid at mapbox.com
- Restart dev server

**Tabs not scrolling?**
- Check section IDs: `section-{tab-id}`
- Verify `navigateToTab()` import
- Check browser console for errors

**Mock data not loading?**
- Set `VITE_USE_MOCK_DATA=true` in `.env.local`
- Check mock data files exist in `src/data/`
- Verify import paths

---

## 🎉 You're Ready!

Run `npm run dev` and start exploring the 17-tab system!

Navigate to: **http://localhost:5173/deals/1/enhanced**

Happy building! 🚀

---

**Next Steps:**
1. Read `DEVELOPER_SETUP.md` for detailed instructions
2. Explore `TAB_OVERVIEW.md` to understand each tab
3. Check `INTEGRATION_GUIDE.md` for technical details
4. Start customizing and building!

---

🏗️ **Built with:** React + TypeScript + Tailwind + Mapbox GL
🤖 **AI-Powered by:** Opus (Claude Sonnet 4)
🗺️ **Maps by:** Mapbox
⚡ **Fast:** Vite + SWC

**Status:** ✅ Production Ready!
