# Due Diligence Module - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Add Route (1 min)

In `App.tsx`:

```tsx
import { DueDiligencePage } from '@/pages/development/DueDiligencePage';

// Add to routes
<Route 
  path="/deals/:dealId/due-diligence" 
  element={<DueDiligencePage />} 
/>
```

### 2. Test with Mock Data (2 min)

Replace API calls in `DueDiligencePage.tsx` with mock data:

```tsx
// At top of file
import { mockDDApi, exampleDueDiligence, exampleZoningAnalysis } from './DueDiligencePage.example';

// Replace API calls in useEffect:
const ddResponse = await mockDDApi.getDueDiligence(dealId);
const zoningResponse = await mockDDApi.getZoningAnalysis(dealId);
// ... etc
```

### 3. View in Browser (1 min)

Navigate to:
```
http://localhost:3000/deals/deal-sunset-towers/due-diligence
```

### 4. Explore Features (1 min)

- Click tabs: **Overview** → **Entitlements** → **Environmental** → **Risk**
- Check the **AI Insights** sidebar
- View **Risk Matrix** heatmap
- Expand **Upzoning Potential** section

---

## 📁 File Structure

```
frontend/src/
├── pages/development/
│   ├── DueDiligencePage.tsx          ← Main page
│   ├── DueDiligencePage.example.ts   ← Mock data
│   ├── README.md                      ← Full docs
│   └── BUILD_SUMMARY.md               ← Build checklist
│
├── components/development/
│   ├── MultiParcelDashboard.tsx       ← Parcel grid
│   ├── ZoningEntitlementsTracker.tsx  ← Zoning analysis
│   ├── EnvironmentalChecklist.tsx     ← Phase I/II ESA
│   ├── GeotechnicalAnalysis.tsx       ← Soil/foundation
│   ├── UtilityCapacityGrid.tsx        ← Water/sewer/etc
│   ├── AssemblageDD.tsx               ← Multi-parcel
│   ├── RiskMatrixHeatmap.tsx          ← Risk tracking
│   ├── AIInsightsPanel.tsx            ← AI recommendations
│   └── index.ts                       ← Exports
│
└── types/development/
    └── dueDiligence.types.ts          ← All TypeScript types
```

---

## 🎨 Component Preview

### Main Page Tabs
1. **Overview** - Multi-parcel dashboard + quick stats
2. **Entitlements** - Zoning analysis + upzoning potential
3. **Environmental** - Phase I/II ESA + remediation
4. **Utilities** - Water, sewer, electric, gas capacity
5. **Risk** - Risk matrix heatmap + mitigation plans

### Sidebar
- **AI Insights Panel** (sticky, always visible)
  - Go/No-Go recommendation
  - Critical risks
  - Recommended actions
  - Timeline/cost impacts

---

## 🔌 API Integration (When Ready)

Replace mock API calls with real ones:

```tsx
// Before (mock)
const response = await mockDDApi.getDueDiligence(dealId);

// After (real)
const response = await apiClient.get(`/api/v1/deals/${dealId}/due-diligence`);
```

Required endpoints:
- `GET /api/v1/deals/{dealId}/due-diligence`
- `GET /api/v1/deals/{dealId}/zoning-analysis`
- `GET /api/v1/deals/{dealId}/environmental`
- `GET /api/v1/deals/{dealId}/geotechnical`
- `GET /api/v1/deals/{dealId}/utilities`
- `GET /api/v1/deals/{dealId}/risk-matrix`
- `POST /api/v1/deals/{dealId}/dd-insights`

---

## 🎯 Key Features to Demo

1. **Multi-Parcel Tracking**
   - See 3 parcels: Main, North (issue), South (delayed)
   - North parcel shows environmental contamination

2. **Upzoning Analysis**
   - Click "Entitlements" tab
   - Expand "Upzoning Potential" section
   - See 180 → 287 units (+59% density)

3. **Risk Matrix**
   - Click "Risk" tab
   - See 5 color-coded risks
   - Try filtering by category (click "entitlement")

4. **AI Insights**
   - Right sidebar shows:
     - "Proceed with Caution" recommendation
     - 5 critical risks
     - 5 action items with priority
     - Timeline impacts (+8 weeks delay)

---

## 🐛 Troubleshooting

### Components not found?
Ensure export in `components/development/index.ts`

### Types not found?
Import from:
```tsx
import type { DueDiligenceState } from '@/types/development/dueDiligence.types';
```

### Icons not showing?
Install lucide-react:
```bash
npm install lucide-react
```

### Styling broken?
Ensure Tailwind CSS is configured

---

## 📚 Learn More

- **Full Documentation**: `README.md`
- **Build Summary**: `BUILD_SUMMARY.md`
- **Design Spec**: `../../jedire/DEV_OPERATIONS_MODULES_DESIGN.md`
- **Example Data**: `DueDiligencePage.example.ts`

---

## ✅ Checklist for Production

- [ ] Replace mock data with real API calls
- [ ] Add error handling for API failures
- [ ] Implement loading skeletons
- [ ] Add edit modals for DD items
- [ ] Wire up document upload
- [ ] Test responsive design on mobile
- [ ] Add permission checks (only deal team can edit)
- [ ] Set up analytics tracking
- [ ] Write unit tests
- [ ] Conduct user acceptance testing

---

**Need Help?** Check `BUILD_SUMMARY.md` for complete implementation details.
