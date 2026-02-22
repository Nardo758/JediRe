# Financial Analysis Section Components

## Overview
This directory contains the Financial Analysis Section for deal pages, including both basic and enhanced versions based on module activation.

## Components

### FinancialAnalysisSection
The main financial analysis component with two modes:

**Basic Mode** (no module):
- Simple loan calculator
- Input fields: Purchase price, down payment, interest rate, term
- Calculated outputs: Monthly payment, annual debt service
- Manual inputs: Estimated NOI, cap rate
- Basic metrics display (Cash-on-Cash, DSCR, Cap Rate)
- Module upsell banner

**Enhanced Mode** (with Financial Modeling Pro module):
- Component builder with 13 customizable blocks
- Sensitivity analysis sliders (Revenue ±10%, Expenses ±5%, Cap Rate ±50bps)
- Monte Carlo results display (P90/P50/P10 IRR)
- Export buttons (Excel/PDF)

### ModuleUpsellBanner
Reusable banner component for promoting module upgrades.

## Usage

```tsx
import { FinancialAnalysisSection } from './components/deal/sections';
import { Deal } from './types';

// Basic usage
<FinancialAnalysisSection
  deal={dealObject}
  enhanced={false}
  onToggleModule={() => handleModuleActivation()}
/>

// With module active
<FinancialAnalysisSection
  deal={dealObject}
  enhanced={true}
  onToggleModule={() => handleModuleActivation()}
/>
```

## Module Checking

To check if a user has the Financial Modeling Pro module active:

```tsx
const enhanced = checkModule(userId, 'financial-modeling-pro');
```

Currently `checkModule` is a stub that returns `false`. Implement the actual logic in your user/subscription service.

## Styling

Components use Tailwind CSS classes following the jedire design system:
- Blue color scheme for primary actions
- Card-based layouts with shadows
- Responsive grid layouts
- Consistent spacing and typography

## Props

### FinancialAnalysisSectionProps
```tsx
{
  deal: Deal;              // Deal object with financial data
  enhanced: boolean;       // Is Financial Modeling Pro module active?
  onToggleModule?: () => void;  // Handler for module activation
}
```

### ModuleUpsellBannerProps
```tsx
{
  moduleName: string;      // Display name of the module
  benefits: string[];      // Array of benefit bullet points
  price: string;           // Price display (e.g., "$29")
  bundleInfo?: {           // Optional bundle promotion
    name: string;
    price: string;
    savings: string;
  };
  onAddModule?: () => void;
  onUpgradeBundle?: () => void;
  onLearnMore?: () => void;
}
```

## Future Enhancements

1. **Implement checkModule utility**: Connect to actual subscription service
2. **Add API integration**: Save/load financial scenarios
3. **Real Excel/PDF export**: Implement actual export functionality
4. **Component persistence**: Save active component selections
5. **Advanced calculations**: Implement actual Monte Carlo simulations
6. **Historical data**: Load and display past scenarios
7. **Collaboration**: Real-time multi-user editing

## Related Files

- `/types/deal.ts` - Deal type definitions
- `/components/deal/DealStrategy.tsx` - Similar section component pattern
- `WIREFRAME_V3.0.md` - Original design specifications (lines 1020-1120)
