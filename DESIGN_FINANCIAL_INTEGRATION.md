# Design → Financial Integration Documentation

## Overview

This integration creates a seamless bi-directional flow between the Design Dashboard and Financial Pro Forma module, enabling users to:

1. **Design → Financial**: Send building designs directly to financial analysis
2. **Financial → Design**: Return to design with financial targets and optimization suggestions
3. **Iterative Refinement**: Continuously improve designs based on financial performance

## Architecture

### Core Components

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Design Dashboard  │────▶│ DesignToFinancial    │────▶│ Financial Section   │
│                     │     │     Service          │     │                     │
│ - 3D Building View  │     │ - Data Export        │     │ - Pro Forma Calc    │
│ - Unit Mix Editor   │     │ - ProForma Calc      │     │ - Target Setting    │
│ - Quick Estimates   │◀────│ - Comparison Logic   │◀────│ - Optimization      │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

### Key Files

1. **DesignToFinancialService.ts** - Core integration service
2. **FinancialSummaryPanel.tsx** - Quick estimates in Design Dashboard
3. **FinancialSection.tsx** - Enhanced financial module with import support
4. **ComparisonView.tsx** - Visual comparison and optimization suggestions
5. **FinancialAssumptionsAPI.ts** - Market-specific cost assumptions
6. **financialApiRoutes.ts** - API endpoint configuration

## Implementation Guide

### 1. Database Setup

Run the migration to create necessary tables:

```sql
psql -U your_user -d your_database -f migrations/001_financial_assumptions.sql
```

### 2. Backend Integration

Add the financial routes to your Express app:

```typescript
// server.ts
import configureFinancialRoutes from './financialApiRoutes';
import { Pool } from 'pg';

const pool = new Pool({
  // your database config
});

configureFinancialRoutes(app, pool);
```

### 3. Frontend Integration

#### In Design Dashboard

```typescript
// DesignDashboard.tsx
import FinancialSummaryPanel from './FinancialSummaryPanel';

function DesignDashboard() {
  const design3D = useDesign3D();
  
  return (
    <div>
      {/* Your existing design UI */}
      
      {/* Add Financial Summary Panel */}
      <FinancialSummaryPanel 
        design3D={design3D}
        className="mt-4"
      />
    </div>
  );
}
```

#### In Financial Module

```typescript
// App.tsx or Router configuration
import FinancialSection from './FinancialSection';

<Route 
  path="/app/financial" 
  element={<FinancialSection projectId={projectId} />} 
/>
```

## User Workflows

### Workflow 1: New Design → Financial Analysis

1. User creates design in Design Dashboard
2. Views quick estimates in Financial Summary Panel
3. Clicks "Send to Financial Model"
4. System navigates to Financial Section with pre-populated data
5. User reviews detailed pro forma and ROI metrics

### Workflow 2: Financial Targets → Design Optimization

1. User sets financial targets (min units, max cost/unit, etc.)
2. Clicks "Return to Design & Optimize"
3. System shows comparison view with specific recommendations
4. User adjusts design based on suggestions
5. Iterates until targets are met

### Workflow 3: Quick Iteration

1. Design changes trigger automatic recalculation
2. Financial panel updates in real-time
3. Color coding shows if targets are met (green) or need attention (orange/red)

## API Reference

### GET /api/v1/financial/assumptions

Get market-specific financial assumptions.

**Query Parameters:**
- `market` (required): Market name (e.g., "Seattle", "Portland")

**Response:**
```json
{
  "market": "Seattle",
  "hardCostPerSF": 250,
  "softCostPercent": 0.25,
  "parkingCostPerSpace": 50000,
  "landCostPerSF": 150,
  "operatingExpensePercent": 0.35,
  "vacancyRate": 0.05,
  "capRate": 5.0,
  "constructionInterestRate": 0.065
}
```

### POST /api/v1/financial/calculate-from-design

Calculate pro forma from design data.

**Request Body:**
```json
{
  "design": {
    "totalUnits": 120,
    "totalSquareFeet": 110000,
    "parkingSpaces": 100,
    "stories": 7,
    "efficiency": 0.85,
    "unitMix": [
      { "type": "Studio", "count": 20, "avgSF": 500 },
      { "type": "1BR", "count": 60, "avgSF": 750 },
      { "type": "2BR", "count": 40, "avgSF": 1100 }
    ],
    "location": {
      "market": "Seattle",
      "submarket": "Capitol Hill"
    }
  }
}
```

**Response:**
```json
{
  "inputs": { /* design and assumptions */ },
  "proForma": {
    "grossPotentialRent": 3456000,
    "effectiveGrossIncome": 3283200,
    "netOperatingIncome": 2133080,
    "totalDevelopmentCost": 35500000,
    "yieldOnCost": 6.01,
    "costPerUnit": 295833
  },
  "metrics": {
    "debtCoverageRatio": 1.42,
    "cashOnCashReturn": 8.5,
    "breakEvenOccupancy": 72.5
  }
}
```

### POST /api/v1/financial/compare-to-targets

Compare design performance against financial targets.

**Request Body:**
```json
{
  "design3D": { /* design object */ },
  "targets": {
    "minUnits": 100,
    "maxCostPerUnit": 300000,
    "minYieldOnCost": 6.0,
    "maxCostPerSF": 250
  }
}
```

## Data Flow

### Design → Financial

```typescript
// 1. User clicks "Send to Financial Model"
const financialInputs = await service.exportDesignData(design3D);

// 2. Store in session for handoff
sessionStorage.setItem('designImportData', JSON.stringify({
  inputs: financialInputs,
  designId: design3D.getId(),
  timestamp: new Date().toISOString()
}));

// 3. Navigate with source parameter
navigate('/app/financial?source=design');

// 4. Financial section detects and loads data
const source = searchParams.get('source');
if (source === 'design') {
  const data = JSON.parse(sessionStorage.getItem('designImportData'));
  // Process imported data
}
```

### Financial → Design

```typescript
// 1. User clicks "Return to Design"
sessionStorage.setItem('financialTargets', JSON.stringify({
  targets: financialTargets,
  currentProForma: proForma
}));

// 2. Navigate back with source parameter
navigate(`/app/design/${designId}?source=financial`);

// 3. Design dashboard shows comparison view
if (source === 'financial') {
  const targets = JSON.parse(sessionStorage.getItem('financialTargets'));
  showOptimizationSuggestions(targets);
}
```

## Styling Guide

### Imported Values (Blue Theme)
```css
.imported-input {
  background: #dbeafe;
  border: 2px solid #3b82f6;
  color: #1e40af;
}
```

### Success Indicators (Green)
```css
.metric.pass {
  background: #d1fae5;
  color: #065f46;
}
```

### Warning Indicators (Orange/Red)
```css
.metric.fail {
  background: #fee2e2;
  color: #991b1b;
}
```

## Best Practices

### 1. Performance
- Cache market assumptions locally
- Debounce design changes before recalculating
- Use React.memo for expensive components

### 2. User Experience
- Show loading states during calculations
- Provide clear visual feedback for imports
- Use tooltips to explain financial metrics

### 3. Data Integrity
- Validate all inputs before calculation
- Handle missing data gracefully
- Maintain audit trail of changes

### 4. Error Handling
```typescript
try {
  const proForma = await service.generateProFormaFromDesign(design3D);
} catch (error) {
  console.error('Pro forma calculation failed:', error);
  showErrorToast('Unable to calculate financials. Please try again.');
}
```

## Testing

### Unit Tests
```typescript
// DesignToFinancialService.test.ts
describe('DesignToFinancialService', () => {
  it('should export design data correctly', async () => {
    const design3D = mockDesign3D();
    const service = new DesignToFinancialService();
    const inputs = await service.exportDesignData(design3D);
    
    expect(inputs.totalUnits).toBe(100);
    expect(inputs.hardCostPerSF).toBe(250);
  });
});
```

### Integration Tests
- Test full workflow from design to financial
- Verify data persistence across navigation
- Test error scenarios and edge cases

## Troubleshooting

### Common Issues

1. **Import data not appearing**
   - Check sessionStorage is not cleared
   - Verify source parameter in URL
   - Check browser console for errors

2. **Calculations incorrect**
   - Verify market assumptions are loaded
   - Check unit mix data is complete
   - Validate efficiency factor

3. **Navigation not working**
   - Ensure routes are properly configured
   - Check design/financial IDs are stored
   - Verify navigation guards

## Future Enhancements

1. **Real-time Collaboration**
   - WebSocket updates for team members
   - Shared financial scenarios
   - Version control for assumptions

2. **Advanced Analytics**
   - Monte Carlo simulations
   - Sensitivity analysis
   - Market comparison tools

3. **Export Capabilities**
   - PDF reports with charts
   - Excel pro forma templates
   - Integration with banking APIs

## Support

For questions or issues:
- Check console logs for detailed errors
- Review network tab for API failures
- Contact: support@example.com