# Development Due Diligence Module

## Overview

The Development Due Diligence module is a comprehensive system for managing pre-development investigations specific to ground-up construction and multi-parcel assemblages. Unlike acquisition due diligence, this focuses on **buildability, entitlement risk, and development feasibility**.

## Location

- **Page Component**: `/pages/development/DueDiligencePage.tsx`
- **Sub-Components**: `/components/development/`
- **Types**: `/types/development/dueDiligence.types.ts`

## Key Features

### 1. Multi-Parcel Dashboard
**Component**: `MultiParcelDashboard`

Displays DD progress across multiple parcels in an assemblage:
- Individual parcel DD tracking (title, survey, environmental, geotechnical, zoning, utilities)
- Overall assemblage progress
- Critical path identification
- Risk aggregation across all parcels

### 2. Zoning & Entitlements Tracker
**Component**: `ZoningEntitlementsTracker`

Manages entitlement feasibility analysis:
- **Current Zoning (By-Right)**: Units, height, FAR allowed without approvals
- **Upzoning Potential**: Scenario modeling for additional density
- **Community Support**: Sentiment tracking
- **Entitlement Checklist**: Permits, variances, conditional use permits
- **Timeline Tracking**: Approval stages and dependencies

### 3. Environmental Checklist
**Component**: `EnvironmentalChecklist`

Tracks environmental assessments:
- **Phase I ESA**: Findings, RECs (Recognized Environmental Conditions)
- **Phase II ESA**: Contaminants found, testing timeline
- **Remediation Plan**: Cost, timeline, impact assessment
- Multi-parcel support with tabbed interface

### 4. Geotechnical Analysis
**Component**: `GeotechnicalAnalysis`

Displays soil conditions and foundation requirements:
- **Soil Conditions**: Layered display with depths and bearing capacity
- **Water Table Depth**: Dewatering requirements
- **Foundation Recommendations**: Type, depth, cost impact
- **Special Considerations**: Shoring, adjacent building impacts
- **3D Integration**: Button to update 3D foundation design

### 5. Utility Capacity Grid
**Component**: `UtilityCapacityGrid`

Assesses infrastructure adequacy:
- **Water, Sewer, Electric, Gas, Telecom**
- Capacity status (adequate/marginal/insufficient)
- Upgrade requirements with cost and timeline
- Provider information
- Current utilization percentage

### 6. Assemblage Due Diligence
**Component**: `AssemblageDD`

Manages multi-parcel coordination:
- **Closing Strategy**: Simultaneous, sequential, or contingent
- **Critical Path Parcel**: Identifies bottleneck
- **Synchronization Risks**: Cross-parcel dependencies
- **Total Cost**: Aggregated across all parcels

### 7. Risk Matrix Heatmap
**Component**: `RiskMatrixHeatmap`

Visualizes and tracks development risks:
- **Risk Scoring**: Probability × Impact
- **Heatmap Visualization**: 10×10 grid showing risk distribution
- **Category Filtering**: Entitlement, environmental, geotechnical, utility, assemblage, financial
- **Mitigation Plans**: Action items for each risk
- **Risk Status**: Identified, monitoring, mitigating, resolved, accepted

### 8. AI Insights Panel
**Component**: `AIInsightsPanel`

Provides AI-generated recommendations:
- **Go/No-Go Recommendation**: Proceed, caution, or reconsider
- **Critical Risks**: Top 5 issues to address
- **Recommended Actions**: Prioritized action items
- **Timeline Impacts**: Delay predictions
- **Cost Impacts**: Budget adjustments needed
- **Confidence Score**: AI certainty level

## Data Model

### Core Types

```typescript
DueDiligenceState {
  id: string;
  dealId: string;
  parcels: ParcelDueDiligence[];
  overallProgress: number; // 0-100
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  criticalPathItem?: string;
}

ZoningAnalysis {
  currentZoning: string;
  byRightUnits: number;
  byRightHeight: number;
  byRightFAR: number;
  upzoningPotential?: UpzoningScenario;
  communitySupport: 'supportive' | 'neutral' | 'opposed' | 'mixed';
}

EnvironmentalAssessment {
  phaseI: PhaseIESA;
  phaseII?: PhaseIESA;
  remediation?: RemediationPlan;
  overallRisk: RiskLevel;
}

RiskMatrix {
  risks: RiskItem[];
  overallRiskScore: number; // 0-100
}
```

## API Endpoints

### GET Endpoints
- `GET /api/v1/deals/{dealId}/due-diligence` - Overall DD state
- `GET /api/v1/deals/{dealId}/zoning-analysis` - Zoning data
- `GET /api/v1/deals/{dealId}/environmental` - Environmental assessments
- `GET /api/v1/deals/{dealId}/geotechnical` - Geotechnical reports
- `GET /api/v1/deals/{dealId}/utilities` - Utility capacity data
- `GET /api/v1/deals/{dealId}/assemblage-dd` - Multi-parcel DD
- `GET /api/v1/deals/{dealId}/risk-matrix` - Risk tracking

### POST Endpoints
- `POST /api/v1/deals/{dealId}/dd-insights` - Generate AI insights
- `POST /api/v1/deals/{dealId}/dd-report` - Export DD report (PDF)

### PUT/PATCH Endpoints
- `PUT /api/v1/deals/{dealId}/due-diligence` - Update DD progress
- `PATCH /api/v1/deals/{dealId}/risk-matrix` - Update risks

## Integration Points

### 1. Documents Module
Upload and link DD reports:
- Phase I/II ESA reports
- Geotechnical studies
- Zoning letters
- Permit applications

### 2. 3D Design Module
Geotechnical findings → Foundation design:
- Soil conditions inform foundation type
- Setbacks from zoning → Building envelope
- Utility locations → Site planning

### 3. Financial Model
DD findings impact pro forma:
- Remediation costs → Development budget
- Foundation upgrades → Hard costs
- Timeline delays → Carrying costs
- Entitlement risk → Contingency

### 4. Timeline Module
DD milestones feed project schedule:
- Phase II ESA completion
- Permit approval dates
- Remediation timeline
- Assemblage closing sequence

## Usage

### Basic Usage

```tsx
import { DueDiligencePage } from '@/pages/development/DueDiligencePage';

// Route in App.tsx
<Route path="/deals/:dealId/due-diligence" element={<DueDiligencePage />} />
```

### Individual Components

```tsx
import { 
  MultiParcelDashboard,
  ZoningEntitlementsTracker,
  RiskMatrixHeatmap 
} from '@/components/development';

// Use individually in custom layouts
<MultiParcelDashboard 
  dueDiligence={ddData} 
  onUpdate={handleUpdate} 
/>
```

## Development-Specific Considerations

### Key Differences from Acquisition DD

| Aspect | Acquisition DD | Development DD |
|--------|----------------|----------------|
| **Focus** | Current condition | Future buildability |
| **Timeline** | 30-60 days | 6-18+ months |
| **Entitlements** | Existing use | Zoning changes, permits |
| **Environmental** | Phase I only (usually) | Phase II + remediation |
| **Risk** | Purchase price | Entire development budget |
| **Deliverable** | Close/don't close | Build/don't build |

### Critical Success Factors

1. **Early Entitlement Assessment**: Upzoning feasibility determines unit count
2. **Environmental Red Flags**: Contamination can kill deals
3. **Geotechnical Surprises**: Foundation costs can swing 10-20%
4. **Assemblage Complexity**: One bad apple spoils the bunch
5. **Timeline Sensitivity**: Delays = carrying costs

## Roadmap

### Phase 1 (Current) ✅
- [x] Core DD tracking UI
- [x] Multi-parcel support
- [x] Risk matrix visualization
- [x] AI insights integration

### Phase 2 (Next)
- [ ] Document upload integration
- [ ] Timeline dependency mapping
- [ ] Automated report generation
- [ ] Email notifications on critical items

### Phase 3 (Future)
- [ ] Historical DD data comparison
- [ ] Predictive timeline modeling
- [ ] Cost benchmarking by category
- [ ] Third-party consultant portal

## Testing

### Test Data Structure

```json
{
  "dealId": "deal-123",
  "parcels": [
    {
      "parcelId": "parcel-1",
      "address": "123 Main St",
      "parcelType": "main",
      "progress": 85,
      "title": { "status": "complete" },
      "environmental": { "status": "complete", "riskLevel": "low" }
    }
  ],
  "overallProgress": 70,
  "overallRisk": "medium"
}
```

### Component Tests

```tsx
// Test DD page loads
render(<DueDiligencePage />, { route: '/deals/123/due-diligence' });
expect(screen.getByText('Due Diligence')).toBeInTheDocument();

// Test multi-parcel display
expect(screen.getAllByText(/Parcel/)).toHaveLength(3);

// Test risk filtering
fireEvent.click(screen.getByText('entitlement'));
expect(screen.getByText('Zoning approval delay')).toBeVisible();
```

## Performance Considerations

- **Lazy Loading**: AI insights generated on-demand
- **Caching**: DD data cached for 5 minutes
- **Debouncing**: Auto-save on edits after 2 seconds
- **Virtualization**: Risk list virtualized for 100+ items

## Security

- **Role-Based Access**: Only deal team can edit DD
- **Audit Trail**: All DD updates logged
- **Document Security**: Reports stored in encrypted S3
- **PII Handling**: Owner names redacted in exports

---

**Last Updated**: 2025-01-XX  
**Module Owner**: Development Operations Team  
**Design Reference**: `DEV_OPERATIONS_MODULES_DESIGN.md`
