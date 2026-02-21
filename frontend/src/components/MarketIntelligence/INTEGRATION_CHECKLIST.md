# MarketDataTable Integration Checklist

Use this checklist to integrate the MarketDataTable component into your JEDI RE application.

## ✅ Pre-Integration Verification

### Files Created
- [ ] `frontend/src/components/MarketIntelligence/MarketDataTable.tsx` exists
- [ ] `frontend/src/mock/mockPropertyIntelligence.ts` exists
- [ ] `frontend/src/components/MarketIntelligence/index.ts` exists
- [ ] All files compile without TypeScript errors

### Dependencies
Verify these packages are installed in `frontend/package.json`:
- [ ] `react` (v18+)
- [ ] `lucide-react` (for icons)
- [ ] `tailwindcss` (for styling)
- [ ] TypeScript support enabled

---

## 🔧 Integration Steps

### Step 1: Import Component
In your `MarketDataTab.tsx` (or wherever you want to use it):

```typescript
import { MarketDataTable } from '@/components/MarketIntelligence';
// or
import MarketDataTable from '@/components/MarketIntelligence/MarketDataTable';
```

### Step 2: Add State for Property Selection
```typescript
const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
```

### Step 3: Use Component
```tsx
<MarketDataTable 
  marketId={yourMarketId}
  onPropertyClick={(propertyId) => {
    setSelectedPropertyId(propertyId);
    // TODO: Open PropertyIntelligenceModal
  }}
/>
```

### Step 4: Test in Browser
- [ ] Component renders without errors
- [ ] Shows "1,028 of 1,028 properties"
- [ ] Table displays with all 7 columns
- [ ] "MOCK DATA" badge appears in header
- [ ] Search box is functional
- [ ] Filters button opens filter panel
- [ ] Pagination shows at bottom

---

## 🧪 Functional Testing

### Search Functionality
- [ ] Type "Peachtree" - filters results
- [ ] Type "LLC" - filters by owner
- [ ] Type parcel ID - filters by ID
- [ ] Clear search - returns all results
- [ ] Search is case-insensitive

### Sorting
- [ ] Click "Address" header - sorts A-Z
- [ ] Click again - sorts Z-A  
- [ ] Click third time - removes sort
- [ ] Click "Units" - sorts numerically
- [ ] Click "Year Built" - sorts by year
- [ ] Chevron icons update correctly (up/down/both)
- [ ] Page resets to 1 on sort

### Filtering
- [ ] Open filter panel (click Filters button)
- [ ] Select "Pre-1980" vintage - filters correctly
- [ ] Select multiple vintages - shows all selected
- [ ] Select "LLC" owner type - filters correctly
- [ ] Enter min units (50) - filters >= 50
- [ ] Enter max units (200) - filters <= 200
- [ ] Enter both min and max - filters range
- [ ] Filter count badge updates
- [ ] Active filters display below panel
- [ ] Reset filters clears everything
- [ ] Page resets to 1 on filter change

### Pagination
- [ ] Shows "Showing 1 to 50 of 1,028 results"
- [ ] Click "Next" - goes to page 2
- [ ] Click page number (e.g., 5) - jumps to page 5
- [ ] Click "Previous" - goes back
- [ ] Previous disabled on page 1
- [ ] Next disabled on last page (21)
- [ ] Page numbers update (shows 5 at a time)
- [ ] Last page shows remaining (e.g., "1001 to 1028")

### Row Interaction
- [ ] Click any row - triggers onPropertyClick
- [ ] Row highlights on hover (blue background)
- [ ] Property ID is passed correctly to callback
- [ ] Console logs property ID (for testing)

### Edge Cases
- [ ] Search "ZZZZZ" - shows empty state
- [ ] Filter units 900-1000 - shows subset
- [ ] Combine search + filter + sort - works
- [ ] Reset filters - returns to initial state
- [ ] Filter to zero results - shows "No properties found"

---

## 🎨 Visual QA

### Desktop (1920x1080)
- [ ] Table fits within container
- [ ] All 7 columns visible without scroll
- [ ] Filter panel displays 3 columns
- [ ] Pagination controls centered
- [ ] Hover states working on all buttons
- [ ] Font sizes readable

### Tablet (768x1024)
- [ ] Filter panel stacks to 2 columns
- [ ] Table scrolls horizontally if needed
- [ ] Search bar full width
- [ ] Pagination wraps nicely

### Mobile (375x667)
- [ ] Filter panel stacks to 1 column
- [ ] Table scrolls horizontally
- [ ] Buttons are touch-friendly (44x44px min)
- [ ] Search input full width
- [ ] Pagination controls accessible

### Color/Contrast
- [ ] Blue accent (#2563eb) used consistently
- [ ] Text readable on all backgrounds
- [ ] Vintage badges have good contrast:
  - Green for 2010+
  - Blue for 2000-2009
  - Yellow for 1980-1999
  - Gray for Pre-1980
- [ ] MOCK DATA badge is visible (amber)

---

## 🔗 Backend Integration (Future)

When ready to connect real data:

### 1. Create API Endpoint
File: `backend/src/routes/marketIntelligence.ts`

```typescript
router.get('/properties', async (req, res) => {
  const { marketId } = req.query;
  
  const properties = await db.query(`
    SELECT 
      pr.id,
      pr.parcel_id,
      pr.address,
      pr.city,
      pr.zip_code,
      pr.owner_name,
      pr.units,
      pr.year_built,
      pr.building_sqft,
      pr.assessed_value,
      pr.appraised_value,
      pr.land_use_code,
      pr.neighborhood_code,
      CASE WHEN pr.units > 0 THEN pr.building_sqft / pr.units ELSE NULL END AS sqft_per_unit,
      CASE WHEN pr.units > 0 THEN pr.appraised_value / pr.units ELSE NULL END AS appraised_per_unit,
      CASE
        WHEN pr.year_built::integer < 1980 THEN 'Pre-1980'
        WHEN pr.year_built::integer < 2000 THEN '1980-1999'
        WHEN pr.year_built::integer < 2010 THEN '2000-2009'
        ELSE '2010+'
      END AS vintage_class,
      ps.sale_year AS last_sale_year,
      ps.sale_price AS last_sale_price,
      (EXTRACT(YEAR FROM NOW()) - ps.sale_year)::integer AS hold_period_years,
      'REAL' AS data_source
    FROM property_records pr
    LEFT JOIN (
      SELECT DISTINCT ON (parcel_id) 
        parcel_id, sale_year, sale_price
      FROM property_sales
      ORDER BY parcel_id, sale_year DESC
    ) ps ON pr.parcel_id = ps.parcel_id
    WHERE pr.county = 'Fulton' AND pr.state = 'GA'
    ORDER BY pr.address
  `);
  
  res.json({ properties, total_count: properties.length });
});
```

### 2. Update Component to Use API

In `MarketDataTable.tsx`, replace:

```typescript
// OLD: Mock data
const allProperties = useMemo(() => generateMockPropertyData(1028), []);

// NEW: API data
const [allProperties, setAllProperties] = useState<PropertyIntelligenceRecord[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchProperties() {
    setLoading(true);
    try {
      const response = await fetch(`/api/market-intelligence/properties?marketId=${marketId}`);
      const data = await response.json();
      setAllProperties(data.properties);
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    } finally {
      setLoading(false);
    }
  }
  
  fetchProperties();
}, [marketId]);
```

### 3. Add Loading State UI

```tsx
{loading ? (
  <div className="py-12 text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
    <p className="mt-4 text-gray-600">Loading properties...</p>
  </div>
) : (
  // ... existing table code
)}
```

### 4. Backend Checklist
- [ ] API endpoint created
- [ ] Database query tested
- [ ] Returns correct data structure
- [ ] CORS configured (if needed)
- [ ] Rate limiting added
- [ ] Error handling implemented
- [ ] Response cached (optional)

---

## 🐛 Troubleshooting

### Component doesn't render
- [ ] Check console for errors
- [ ] Verify all imports resolve
- [ ] Check `@/` path alias is configured in tsconfig.json
- [ ] Ensure lucide-react is installed

### Table is empty
- [ ] Check if `generateMockPropertyData()` returns data
- [ ] Console.log `allProperties.length`
- [ ] Verify filters aren't too restrictive
- [ ] Check pagination state

### Sorting doesn't work
- [ ] Check `sortField` and `sortDirection` state
- [ ] Verify sort function logic
- [ ] Check if column field names match data keys

### Filters not filtering
- [ ] Console.log filter values
- [ ] Check `filteredProperties` length
- [ ] Verify filter logic in useMemo
- [ ] Check field name matches (e.g., `vintage_class`)

### Pagination issues
- [ ] Check `totalPages` calculation
- [ ] Verify `startIndex` and `endIndex`
- [ ] Check `currentPage` state
- [ ] Ensure itemsPerPage = 50

### Icons not showing
- [ ] Verify lucide-react is installed: `npm install lucide-react`
- [ ] Check import statement
- [ ] Try different icon to isolate issue

### Styling issues
- [ ] Verify Tailwind is configured
- [ ] Check if classes are being purged
- [ ] Ensure gray/blue color variants exist
- [ ] Check responsive classes (md:, lg:)

---

## 📊 Performance Checklist

- [ ] Initial render < 500ms
- [ ] Search/filter < 100ms
- [ ] Sort < 100ms
- [ ] Pagination instant
- [ ] No memory leaks (check DevTools)
- [ ] Table doesn't re-render unnecessarily
- [ ] useMemo optimizations working

---

## ♿ Accessibility Checklist

- [ ] All buttons keyboard accessible
- [ ] Tab order logical
- [ ] Search input has label
- [ ] Filter inputs have labels
- [ ] Table has semantic HTML
- [ ] Screen reader can announce results
- [ ] Focus indicators visible
- [ ] Color not only indicator (badges have text)

---

## 📱 Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## ✅ Sign-Off

- [ ] Functional requirements met
- [ ] Visual design approved
- [ ] Performance acceptable
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Accessible
- [ ] Code reviewed
- [ ] Ready for production

---

**Integration completed by**: _______________  
**Date**: _______________  
**Notes**: _______________

