# JEDI RE - Developer Setup Guide

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites

```bash
# Node.js 18+ and npm
node --version  # Should be 18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
```

### 2. Clone & Install

```bash
cd jedire/frontend
npm install
```

### 3. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your values
nano .env.local  # or use your preferred editor
```

**Required Configuration:**

```env
# Mapbox (required for Map View)
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbHh4eHh4eHgifQ.xxxxxxxxxxxxxxxxxx

# API (required)
VITE_API_BASE_URL=http://localhost:3000

# Optional: Use mock data for development
VITE_USE_MOCK_DATA=true
```

### 4. Get Your Mapbox Token

1. Visit: https://account.mapbox.com/access-tokens/
2. Sign up for free (50,000 monthly map loads included)
3. Create a new token or use your default public token
4. Copy the token starting with `pk.`
5. Paste into `.env.local`

### 5. Run Development Server

```bash
npm run dev
```

Visit: http://localhost:5173

---

## 🏗️ Project Structure

```
jedire/frontend/
├── src/
│   ├── components/
│   │   ├── deal/
│   │   │   ├── sections/          # 17 tab sections
│   │   │   │   ├── OverviewSection.tsx
│   │   │   │   ├── MapViewSection.tsx
│   │   │   │   ├── AIAgentSection.tsx
│   │   │   │   ├── FinancialSection.tsx
│   │   │   │   └── ... (13 more)
│   │   │   ├── DealSection.tsx    # Section wrapper
│   │   │   ├── DealMapView.tsx    # Mapbox integration
│   │   │   └── SectionCard.tsx    # Legacy wrapper
│   │   ├── Opus/                  # AI Agent components
│   │   └── ...
│   ├── pages/
│   │   ├── DealPage.tsx           # Standard deal page
│   │   └── DealPageEnhanced.tsx   # 17-tab enhanced page ⭐
│   ├── data/                      # Mock data files
│   │   ├── overviewMockData.ts
│   │   ├── financialMockData.ts
│   │   ├── notesMockData.ts
│   │   └── ...
│   ├── hooks/
│   │   └── useDealMode.ts         # Acquisition/Performance mode
│   ├── utils/
│   │   └── dealTabNavigation.ts   # Cross-tab linking
│   ├── types/
│   │   └── deal.ts                # TypeScript types
│   └── ...
├── .env.example                   # Environment template
├── .env.local                     # Your local config (gitignored)
├── INTEGRATION_GUIDE.md           # Integration documentation
├── TAB_OVERVIEW.md                # Complete tab reference
└── DEVELOPER_SETUP.md             # This file
```

---

## 🎯 Key Entry Points

### Enhanced Deal Page (17 Tabs)

**File:** `src/pages/DealPageEnhanced.tsx`

**Route:** `/deals/:dealId/enhanced`

**Features:**
- 17 comprehensive tabs
- Dual-mode (acquisition/performance)
- Cross-tab navigation
- AI Agent integration
- Interactive map

**Test URL:**
```
http://localhost:5173/deals/1/enhanced
```

### Standard Deal Page (11 Tabs)

**File:** `src/pages/DealPage.tsx`

**Route:** `/deals/:dealId/view` or `/deals/:dealId`

**Features:**
- Simplified view
- Core sections only
- Faster load time

---

## 🔧 Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

---

## 🧪 Testing the 17-Tab System

### 1. Load Enhanced Deal Page

```
http://localhost:5173/deals/1/enhanced
```

### 2. Verify All Tabs Load

Check the quick navigation bar:
- 📊 Overview
- 🗺️ Map View
- 🤖 AI Agent
- 🏢 Properties
- 💰 Financial
- 📈 Market
- 🏆 Competition
- 📦 Supply
- 💳 Debt
- 🎯 Strategy
- 🚪 Exit
- ✅ DD
- 📄 Docs
- 👥 Team
- 🧭 Context
- 💬 Notes
- 📅 Timeline

### 3. Test Cross-Tab Navigation

**From Notes:**
- Click "🗺️ View on Map" → should scroll to Map View
- Click "🤖 Ask AI Agent" → should scroll to AI Agent

**From Financial:**
- Click "🎯 View Strategy" → should scroll to Strategy
- Click "🚪 Exit Strategy" → should scroll to Exit

**From Overview:**
- Click "Open Map View Module" → should scroll to Map View

### 4. Test Mode Switching

**Acquisition Mode (Pipeline Deals):**
- Create a deal with `status: 'pipeline'`
- Tabs should show: Deal analysis, underwriting, market research

**Performance Mode (Owned Deals):**
- Create a deal with `status: 'owned'`
- Tabs should show: Asset management, NOI tracking, leasing

### 5. Test Map View

**Requirements:**
- Mapbox token must be set in `.env.local`
- Deal must have boundary coordinates

**Check:**
- Map loads with Mapbox tiles
- Boundary renders (blue polygon or point)
- Layer controls work (properties, competition, demographics, all)
- Full screen mode toggles
- Legend displays

### 6. Test AI Agent

**Check:**
- Chat interface loads
- Message history displays
- Context includes data from all tabs
- Role switches based on mode

---

## 🗺️ Mapbox Integration

### Token Setup

1. **Get Token:** https://account.mapbox.com/access-tokens/
2. **Add to .env.local:**
   ```env
   VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbHh4eHh4eHgifQ.xxxx
   ```
3. **Restart dev server:** `npm run dev`

### Verify Integration

Check browser console for:
- ✅ No Mapbox token errors
- ✅ Map tiles loading
- ✅ Boundary rendering

Common Issues:
- **"Mapbox token missing"** → Check `.env.local` has correct token
- **"Token invalid"** → Verify token is active at mapbox.com
- **Map not rendering** → Check deal has valid boundary coordinates

---

## 🤖 AI Agent (Opus) Integration

### Configuration

```env
# OpenAI (GPT-4)
VITE_OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Anthropic (Claude)
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Data Sources

The AI Agent aggregates data from:
- Overview → Property specs, location
- Financial → Pro forma, budgets
- Market → Demographics, trends
- Properties → Asset details
- Strategy → Value-add plays
- Notes → Activity log
- Documents → File metadata
- **All 17 tabs!**

### Testing

1. Open AI Agent tab
2. Ask: "Analyze this deal's financial performance"
3. Verify response includes data from Financial tab
4. Ask: "What's the market like?"
5. Verify response includes Market tab data

---

## 📊 Mock Data

All tabs use mock data for development.

### Enable/Disable Mock Data

```env
# In .env.local
VITE_USE_MOCK_DATA=true   # Use mock data
VITE_USE_MOCK_DATA=false  # Use real API
```

### Mock Data Files

Located in `src/data/`:
- `overviewMockData.ts` - Stats, activities, team
- `financialMockData.ts` - Pro formas, budgets
- `notesMockData.ts` - Notes, categories
- `marketMockData.ts` - Demographics, trends
- `competitionMockData.ts` - Competitors
- ... (one file per section)

### Creating New Mock Data

```typescript
// src/data/myNewMockData.ts
export interface MyDataType {
  id: string;
  name: string;
  value: number;
}

export const acquisitionMyData: MyDataType[] = [
  { id: '1', name: 'Item 1', value: 100 },
  { id: '2', name: 'Item 2', value: 200 }
];

export const performanceMyData: MyDataType[] = [
  { id: '1', name: 'Performance 1', value: 150 },
  { id: '2', name: 'Performance 2', value: 250 }
];
```

---

## 🔗 Cross-Tab Navigation

### Using the Utility

```typescript
import { navigateToTab } from '@/utils/dealTabNavigation';

// Simple navigation
navigateToTab('map-view');

// With visual highlight (ring effect)
navigateToTab('ai-agent', 'smooth');

// In a button
<button onClick={() => navigateToTab('financial')}>
  💰 View Financial
</button>
```

### Available Tab IDs

```typescript
type DealTabId =
  | 'overview'
  | 'map-view'
  | 'ai-agent'
  | 'properties'
  | 'financial'
  | 'market'
  | 'competition'
  | 'supply-tracking'
  | 'debt-market'
  | 'strategy'
  | 'exit'
  | 'due-diligence'
  | 'documents'
  | 'team'
  | 'context-tracker'
  | 'notes'
  | 'timeline';
```

---

## 🎨 Styling Guidelines

### Mode-Based Colors

```typescript
// Acquisition Mode
className="bg-blue-100 text-blue-700"           // Badge
className="bg-gradient-to-r from-blue-50 to-purple-50"  // Card

// Performance Mode
className="bg-green-100 text-green-700"         // Badge
className="bg-gradient-to-r from-green-50 to-teal-50"   // Card
```

### Quick Stats Cards

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <div className="text-2xl mb-1">🏢</div>
    <div className="text-xs text-gray-500">Label</div>
    <div className="text-2xl font-bold">Value</div>
  </div>
</div>
```

### Section Wrapper

```typescript
<DealSection
  id="my-section"
  icon="🏢"
  title="My Section"
  isPremium={true}
  defaultExpanded={false}
>
  {/* Content */}
</DealSection>
```

---

## 🐛 Common Issues & Solutions

### Issue: Mapbox not loading

**Solution:**
1. Check `.env.local` has `VITE_MAPBOX_TOKEN`
2. Verify token is valid at mapbox.com
3. Restart dev server: `Ctrl+C` then `npm run dev`

### Issue: Tabs not scrolling

**Solution:**
- Check section IDs match: `section-{tab-id}`
- Verify `navigateToTab()` is imported correctly
- Check browser console for errors

### Issue: Mock data not loading

**Solution:**
1. Check `VITE_USE_MOCK_DATA=true` in `.env.local`
2. Verify mock data file exists in `src/data/`
3. Check import path is correct

### Issue: AI Agent not responding

**Solution:**
1. Check `VITE_OPENAI_API_KEY` or `VITE_ANTHROPIC_API_KEY` in `.env.local`
2. Verify API key is valid
3. Check browser console for API errors

---

## 📚 Documentation Reference

- **Integration Guide:** `INTEGRATION_GUIDE.md` - Complete integration details
- **Tab Overview:** `TAB_OVERVIEW.md` - All 17 tabs documented
- **Environment Setup:** `.env.example` - Configuration template
- **Section READMEs:** Check `src/components/deal/sections/` for individual section docs

---

## 🚀 Next Steps

1. **Explore the code:** Start with `DealPageEnhanced.tsx`
2. **Review mock data:** Check `src/data/` files
3. **Test navigation:** Try cross-tab links
4. **Customize tabs:** Add your own sections
5. **Connect real API:** Replace mock data with API calls

---

## 🤝 Contributing

### Adding a New Tab

1. Create section component: `src/components/deal/sections/MySection.tsx`
2. Create mock data: `src/data/myMockData.ts`
3. Export from index: `src/components/deal/sections/index.ts`
4. Add to DealPageEnhanced: Import and render
5. Add to navigation bar: Update tab list
6. Add cross-links: Use `navigateToTab()`
7. Document: Update `TAB_OVERVIEW.md`

### Code Standards

- TypeScript for all components
- Tailwind CSS for styling
- Mock data separated from components
- Dual-mode support (acquisition/performance)
- 5 quick stats per tab
- Cross-tab navigation
- Responsive design (mobile-first)

---

## 🎉 You're Ready!

Run `npm run dev` and navigate to:
```
http://localhost:5173/deals/1/enhanced
```

Explore all 17 tabs and start building! 🚀

---

## 📞 Support

**Documentation:**
- INTEGRATION_GUIDE.md
- TAB_OVERVIEW.md
- Individual section READMEs

**Debugging:**
- Check browser console
- Review `.env.local` configuration
- Verify mock data files exist

**Questions?**
- Review the code comments
- Check TypeScript types in `src/types/`
- Read component documentation

Happy coding! 🏗️
