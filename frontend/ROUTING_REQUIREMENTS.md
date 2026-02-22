# Market Intelligence Routing Requirements

## Routes to Add to Main Router (App.tsx)

Add the following routes to your main React Router configuration:

### Import Statement
```typescript
import {
  MarketIntelligencePage,
  MyMarketsDashboard,
  CompareMarketsPage,
  ActiveOwnersPage,
  FutureSupplyPage
} from './pages/MarketIntelligence';
```

### Route Definitions

```typescript
// Market Intelligence Section
<Route path="/market-intelligence">
  {/* Main landing page - overview of all market intelligence features */}
  <Route index element={<MarketIntelligencePage />} />
  
  {/* My Markets Dashboard - personalized market tracking */}
  <Route path="markets/:marketId" element={<MyMarketsDashboard />} />
  
  {/* Compare Markets - side-by-side market comparison tool */}
  <Route path="compare" element={<CompareMarketsPage />} />
  
  {/* Active Owners - portfolio and ownership intelligence */}
  <Route path="owners" element={<ActiveOwnersPage />} />
  
  {/* Future Supply - construction pipeline and supply forecasting */}
  <Route path="supply" element={<FutureSupplyPage />} />
</Route>
```

## Route Structure

```
/market-intelligence
├── /                           → MarketIntelligencePage (landing/overview)
├── /markets/:marketId          → MyMarketsDashboard (individual market detail)
├── /compare                    → CompareMarketsPage (market comparison)
├── /owners                     → ActiveOwnersPage (ownership intelligence)
└── /supply                     → FutureSupplyPage (supply pipeline)
```

## Navigation Examples

- **Main overview**: `/market-intelligence`
- **Specific market**: `/market-intelligence/markets/austin-tx`
- **Compare markets**: `/market-intelligence/compare?markets=austin-tx,dallas-tx`
- **Owner intelligence**: `/market-intelligence/owners?owner=blackstone`
- **Supply pipeline**: `/market-intelligence/supply?market=miami-fl`

## Integration Notes

1. **Protected Routes**: Consider wrapping these routes with authentication if not already done
2. **Layout**: Market Intelligence pages should use the main app layout with sidebar navigation
3. **Query Parameters**: Pages support query params for filtering and deep linking
4. **Breadcrumbs**: Implement breadcrumb navigation for better UX
5. **Navigation Links**: Update sidebar/nav menu to include Market Intelligence section

## Sidebar Navigation Structure

```typescript
{
  label: 'Market Intelligence',
  icon: 'chart-line',
  children: [
    { label: 'Overview', path: '/market-intelligence' },
    { label: 'My Markets', path: '/market-intelligence/markets' },
    { label: 'Compare Markets', path: '/market-intelligence/compare' },
    { label: 'Active Owners', path: '/market-intelligence/owners' },
    { label: 'Future Supply', path: '/market-intelligence/supply' }
  ]
}
```

## Testing Checklist

- [ ] All routes load correctly
- [ ] Navigation between pages works
- [ ] Dynamic route parameter (`:marketId`) passes correctly
- [ ] Query parameters are preserved during navigation
- [ ] Browser back/forward buttons work properly
- [ ] Direct URL access works for all routes
- [ ] 404 handling for invalid market IDs
- [ ] Proper page titles and meta tags

---

**Ready for integration in Replit!** Wire these routes into your main App.tsx router configuration.
