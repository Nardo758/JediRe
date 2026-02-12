# Development Section Component

## Overview

The `DevelopmentSection` component provides zoning analysis and development capacity information for real estate deals. It integrates with the existing Python-based zoning services in the backend and offers both a basic (free) and enhanced (paid module) version.

## Component Location

```
frontend/src/components/deal/sections/DevelopmentSection.tsx
```

## Features

### Basic Version (No Module)
- Shows zoning district name (e.g., "R-4 - Residential Medium Density")
- Basic placeholder information requiring manual lookup
- Upsell banner for "Zoning Interpreter" module ($54/mo)
- Educational content about zoning terminology

### Enhanced Version (With Zoning Interpreter Module)
- **Capacity Analysis:**
  - Maximum units (e.g., "120 units by-right")
  - Height limit with stories (e.g., "75 feet (6 stories)")
  - Lot coverage (e.g., "60% max, 48,000 sqft available")
  - Parking requirements (e.g., "180 spaces at 1.5 per unit")
  
- **Setback Requirements:**
  - Front, Side, and Rear setbacks displayed visually
  
- **Compliance Checks:**
  - ✅ Green icons for compliant items
  - ⚠️ Yellow icons for warnings
  - ❌ Red icons for violations
  - Detailed messages and recommendations
  
- **Zoning Code References:**
  - Clickable section links to municipal codes
  
- **Action Buttons:**
  - View Full Report
  - Export PDF
  - Schedule Pre-Application Meeting

## Props

```typescript
interface DevelopmentSectionProps {
  deal: Deal;              // The deal object
  enhanced: boolean;       // Whether Zoning Interpreter module is active
  onToggleModule?: () => void;  // Handler for module upgrade
}
```

## Conditional Display

The section should only be displayed when:
```typescript
deal.isDevelopment === true
```

Example:
```tsx
{deal.isDevelopment && (
  <DevelopmentSection
    deal={deal}
    enhanced={hasZoningModule}
    onToggleModule={handleModuleToggle}
  />
)}
```

## Backend Integration

### API Endpoint

```
GET /api/v1/pipeline/capacity-analysis?parcelId={id}
```

### Request Parameters
- `parcelId` (string, required): The ID of the property/deal

### Response Format

```typescript
interface CapacityAnalysis {
  parcelId: string;
  districtCode: string;
  districtName: string;
  
  // Capacity metrics
  maxUnits: number;
  maxUnitsByRight: boolean;
  
  // Physical constraints
  maxHeightFt: number;
  maxStories: number;
  lotCoveragePercent: number;
  lotCoverageSqft: number;
  availableCoverageSqft: number;
  
  // Parking
  parkingRequired: number;
  parkingRatio: number;
  
  // Setbacks
  setbacks: {
    frontFt?: number;
    sideFt?: number;
    rearFt?: number;
  };
  
  // Compliance
  complianceChecks: Array<{
    item: string;
    status: 'compliant' | 'warning' | 'violation';
    message: string;
    details?: string;
  }>;
  overallCompliance: 'compliant' | 'warning' | 'violation';
  
  // Recommendations
  recommendations: string[];
  
  // References
  zoningReferences: Array<{
    section: string;
    title: string;
    url?: string;
  }>;
  
  // Additional
  lotSizeSqft?: number;
  analysisDate?: string;
}
```

### Example Response

See `DEVELOPMENT_SECTION_EXAMPLE.tsx` for a complete mock response.

### Error Handling

The component handles:
- Loading states (spinner with message)
- API errors (red alert box with retry button)
- Empty states (no parcel data available)
- Network failures

## Python Services Integration

The backend Python services are located at:
```
backend/python-services/
```

The services should:
1. Accept parcel ID and property address
2. Look up zoning district from municipality GIS/zoning API
3. Parse zoning code regulations
4. Calculate maximum development capacity
5. Check compliance against proposed development
6. Generate recommendations
7. Return structured JSON response

## Design Patterns

### Color Coding
- **Green** (`bg-green-50`, `text-green-600`): Compliant, passing checks
- **Yellow** (`bg-yellow-50`, `text-yellow-600`): Warnings, attention needed
- **Red** (`bg-red-50`, `text-red-600`): Violations, non-compliant

### Icons (Lucide React)
- `CheckCircle`: Compliant status
- `AlertTriangle`: Warning status
- `XCircle`: Violation status
- `Building2`: Building/zoning related
- `Ruler`: Measurements/setbacks
- `Car`: Parking
- `Home`: Housing units
- `FileText`: Documents/code references
- `Download`: Export functionality
- `Calendar`: Scheduling

### Layout
- Max width: `max-w-6xl` for enhanced version
- Max width: `max-w-4xl` for basic version
- Consistent spacing: `space-y-6` between sections
- Card-based UI: `bg-white rounded-lg shadow p-6`

## Usage Examples

### Basic Integration

```tsx
import { DevelopmentSection } from './components/deal/sections';

function DealDetailPage({ deal }) {
  const hasZoningModule = checkUserModule('zoning');
  
  return (
    <div>
      {deal.isDevelopment && (
        <DevelopmentSection
          deal={deal}
          enhanced={hasZoningModule}
          onToggleModule={handleUpgrade}
        />
      )}
    </div>
  );
}
```

### With Accordion

```tsx
const [expandedSections, setExpandedSections] = useState(new Set(['overview']));

{deal.isDevelopment && (
  <AccordionSection
    id="development"
    title="Development Analysis"
    icon="🏗️"
    expanded={expandedSections.has('development')}
    onToggle={() => toggleSection('development')}
  >
    <DevelopmentSection
      deal={deal}
      enhanced={hasZoningModule}
      onToggleModule={handleUpgrade}
    />
  </AccordionSection>
)}
```

## Module Activation

The `enhanced` prop should be determined by checking the user's subscription:

```tsx
const hasZoningModule = user?.subscription?.modules?.includes('zoning');
```

Or via an API call:
```tsx
const checkModule = async (moduleName: string) => {
  const { data } = await api.get('/api/v1/user/modules/check', {
    params: { module: moduleName }
  });
  return data.hasModule;
};
```

## Development Workflow

1. **Mark deal as development:**
   ```tsx
   deal.isDevelopment = true;
   ```

2. **Add property address and parcel data:**
   - Required for capacity analysis
   - Store parcel ID in deal object

3. **Enable Zoning Interpreter module:**
   - User purchases module
   - Module flag activates enhanced features

4. **Component fetches analysis:**
   - Automatic API call on mount
   - Shows loading state
   - Displays results or errors

5. **User interactions:**
   - View full report (navigate to detailed page)
   - Export PDF (download generated report)
   - Schedule pre-app meeting (calendar integration)

## Testing

### Manual Testing

1. **Basic Version:**
   - Set `enhanced={false}`
   - Verify upsell banner appears
   - Verify static placeholder data shown
   - Test "Add Module" button

2. **Enhanced Version:**
   - Set `enhanced={true}`
   - Mock API response
   - Verify all metrics display correctly
   - Test compliance status icons
   - Verify color coding (green/yellow/red)
   - Test action buttons

3. **Edge Cases:**
   - No parcel data (empty state)
   - API error (error state)
   - Loading state (spinner)
   - Missing optional fields

### Unit Tests

```tsx
describe('DevelopmentSection', () => {
  it('shows upsell banner when not enhanced', () => {
    // Test basic version
  });
  
  it('fetches capacity analysis when enhanced', () => {
    // Test API call
  });
  
  it('displays compliance checks with correct colors', () => {
    // Test color coding
  });
  
  it('handles API errors gracefully', () => {
    // Test error state
  });
});
```

## Future Enhancements

1. **Interactive Setback Diagram:**
   - Visual representation of buildable envelope
   - Interactive SVG showing setback lines

2. **3D Massing Model:**
   - Show allowable building height and footprint
   - Interactive 3D viewer

3. **Comparison Tool:**
   - Compare multiple zoning scenarios
   - Side-by-side analysis

4. **Historical Changes:**
   - Track zoning code updates
   - Alert on regulation changes

5. **AI Recommendations:**
   - LLM-powered optimization suggestions
   - Alternative design configurations

## Support

For questions or issues:
- Frontend: Check component props and state
- Backend: Verify Python service is running
- API: Check network tab for request/response
- Docs: See `DEVELOPMENT_SECTION_EXAMPLE.tsx`

## License

Part of JEDI RE platform.
