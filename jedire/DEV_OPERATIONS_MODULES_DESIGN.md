# Development-First Operations Modules Design

**Created:** 2025-01-10  
**Module Group:** OPERATIONS (Due Diligence, Project Management, Timeline)  
**Purpose:** Transform operations modules from tracking tools to proactive development management systems

---

## Overview

Traditional operations modules track what happened. JEDI RE's operations modules **orchestrate** what needs to happen - from pre-development diligence through construction to lease-up. They're integrated with 3D design and neighboring property workflows.

---

## Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   OPERATIONS MODULE GROUP                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   3D DESIGN & NEIGHBORING PROPERTIES                            │
│                 │                                               │
│                 ▼                                               │
│  ┌──────────────────────────┐                                  │
│  │   DEVELOPMENT-SPECIFIC   │                                  │
│  │    DUE DILIGENCE         │                                  │
│  └────────────┬──────────────┘                                  │
│               │                                                 │
│               ▼                                                 │
│  ┌──────────────────────────┐      ┌─────────────────────────┐ │
│  │   PROJECT MANAGEMENT     │◄────▶│  TIMELINE & MILESTONES  │ │
│  │   (Construction Focus)   │      │  (Development Phases)   │ │
│  └──────────────────────────┘      └─────────────────────────┘ │
│               │                               │                 │
│               └───────────┬───────────────────┘                 │
│                           ▼                                     │
│                   DEVELOPMENT PIPELINE                          │
│                   TRACKING & ALERTS                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Due Diligence Module (Redesigned for Development)

### Purpose in Development Context
Manages pre-development investigations specific to ground-up construction and neighboring property acquisitions. Goes beyond acquisition DD to include entitlements, environmental, geotechnical, and assemblage complexity.

### User Stories
- **As a developer**, I need to track entitlement feasibility before designing
- **As a developer**, I need environmental assessments for my site + neighbors
- **As a developer**, I need to manage DD for multiple parcels in an assemblage
- **As a developer**, I need geotechnical data to inform foundation design
- **As a developer**, I need to track utility availability and capacity

### Wireframe Description

```
┌────────────────────────────────────────────────────────────────┐
│ DUE DILIGENCE - Development & Assemblage Tracker               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │                  MULTI-PARCEL DD DASHBOARD                  ││
│ │                                                            ││
│ │  ┌─────────────┬─────────────┬─────────────┐              ││
│ │  │ MAIN SITE   │ NORTH PARCEL│ SOUTH PARCEL│              ││
│ │  │ 123 Main St │ 125 Main St │ 121 Main St │              ││
│ │  ├─────────────┼─────────────┼─────────────┤              ││
│ │  │ ████████ 85%│ ██████ 60%  │ ████ 40%    │              ││
│ │  │             │             │             │              ││
│ │  │ Title ✅    │ Title ✅    │ Title ⏳     │              ││
│ │  │ Survey ✅   │ Survey ⏳   │ Survey ⏳    │              ││
│ │  │ Environ ✅  │ Environ ⚠️  │ Environ ❌   │              ││
│ │  │ Geotech ✅  │ Geotech ⏳  │ Geotech ⏳   │              ││
│ │  │ Zoning ✅   │ Zoning ✅   │ Zoning ❓    │              ││
│ │  └─────────────┴─────────────┴─────────────┘              ││
│ │                                                            ││
│ │  Overall Assemblage Risk: MEDIUM                           ││
│ │  Critical Path Item: South Parcel Environmental            ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌─────────────────────────────────┐ ┌────────────────────────┐│
│ │  ENTITLEMENT FEASIBILITY        │ │ ENVIRONMENTAL TRACKER  ││
│ │                                 │ │                        ││
│ │  Current Zoning: RM-4           │ │ Phase I ESA:           ││
│ │  • By-right: 180 units         │ │ • Main: ✅ Clean       ││
│ │  • Height: 85 ft (8 stories)    │ │ • North: ⚠️ UST found  ││
│ │  • FAR: 4.0                     │ │ • South: ❌ Not started││
│ │                                 │ │                        ││
│ │  Upzoning Potential: RM-5       │ │ Phase II Required:     ││
│ │  • Units: 287 (+107)            │ │ • North parcel only    ││
│ │  • Height: 120 ft (+35 ft)      │ │ • Est cost: $45k       ││
│ │  • FAR: 5.0 (+1.0)              │ │ • Timeline: 6 weeks    ││
│ │  • Process: 6-9 months          │ │                        ││
│ │  • Success likelihood: 75%      │ │ Remediation Estimate:  ││
│ │                                 │ │ • UST removal: $125k   ││
│ │  Community Support: MIXED       │ │ • Timeline: 8 weeks    ││
│ │  Council Member: SUPPORTIVE     │ │ • Impact: Minimal      ││
│ │                                 │ │                        ││
│ │  [Model Upzoning Impact] →      │ │ [View ESA Reports] →   ││
│ └─────────────────────────────────┘ └────────────────────────┘│
│                                                                │
│ ┌─────────────────────────────────┐ ┌────────────────────────┐│
│ │  GEOTECHNICAL ANALYSIS          │ │  UTILITY CAPACITY      ││
│ │                                 │ │                        ││
│ │  Soil Conditions:               │ │  Infrastructure:       ││
│ │  • 0-15 ft: Fill/clay          │ │                        ││
│ │  • 15-25 ft: Dense sand        │ │  Water:                ││
│ │  • 25+ ft: Bedrock             │ │  • 12" main ✅         ││
│ │  • Water table: 18 ft          │ │  • Capacity: Adequate  ││
│ │                                 │ │                        ││
│ │  Foundation Recommendation:     │ │  Sewer:                ││
│ │  • Auger cast piles to bedrock  │ │  • 24" main ✅         ││
│ │  • Est depth: 28-32 ft         │ │  • Capacity: 70% used  ││
│ │  • Cost impact: +$850k         │ │  • Upgrade needed: No  ││
│ │                                 │ │                        ││
│ │  Special Considerations:        │ │  Electric:             ││
│ │  • Dewatering required          │ │  • Substation: 0.5 mi  ││
│ │  • Adjacent building impact     │ │  • Capacity: Available ││
│ │  • Shoring for neighbor         │ │  • Service: 4160V ✅   ││
│ │                                 │ │                        ││
│ │  [Update 3D Foundation] →       │ │  Gas: Available ✅     ││
│ └─────────────────────────────────┘ └────────────────────────┘│
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │                    AI DD INSIGHTS                          ││
│ │                                                            ││
│ │ 💡 Critical Risks Identified:                              ││
│ │    1. North parcel UST will delay closing by 8 weeks      ││
│ │    2. South parcel owner unresponsive - consider dropping ││
│ │    3. Pile foundations add $850k - update pro forma       ││
│ │                                                            ││
│ │ 🎯 Recommended Actions:                                    ││
│ │    • Start Phase II on north parcel immediately           ││
│ │    • Engage community early for upzoning support          ││
│ │    • Design flexibility for 180 or 287 units              ││
│ │                                                            ││
│ │ [Generate DD Report] [Update Risk Matrix]                 ││
│ └────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

### 3D Visualization Integration
- Geotechnical data → Foundation design in 3D model
- Utility locations → Site plan optimization
- Setback requirements → Building envelope updates
- Environmental constraints → Developable area mapping

### AI Recommendation Touchpoints
1. **Risk Prioritization**: Identifies critical path DD items
2. **Cost Impact Analysis**: Quantifies DD findings in dollars
3. **Timeline Optimization**: Suggests parallel DD processes
4. **Go/No-Go Recommendations**: Based on DD red flags

### Component Hierarchy
```
DueDiligenceSection/
├── MultiParcelDashboard/
│   ├── ParcelCards
│   ├── ProgressTracking
│   ├── RiskAggregation
│   └── CriticalPath
├── EntitlementFeasibility/
│   ├── ZoningAnalysis
│   ├── UpzoningPotential
│   ├── CommunitySupport
│   └── ProcessTimeline
├── EnvironmentalTracker/
│   ├── PhaseIStatus
│   ├── PhaseIIRequirements
│   ├── RemediationPlanning
│   └── ReportStorage
├── GeotechnicalAnalysis/
│   ├── SoilConditions
│   ├── FoundationDesign
│   ├── CostImpacts
│   └── 3DIntegration
├── UtilityCapacity/
│   ├── InfrastructureMap
│   ├── CapacityChecks
│   ├── UpgradeRequirements
│   └── ServiceApplications
└── AIInsights/
    ├── RiskSummary
    ├── ActionItems
    └── ReportGeneration
```

---

## 2. Project Management Module (Development-Focused)

### Purpose in Development Context
Orchestrates the entire development process from predevelopment through construction to lease-up. Integrates with 3D model for visual progress tracking and manages complex stakeholder coordination.

### User Stories
- **As a developer**, I need to track construction progress against 3D model milestones
- **As a developer**, I need to coordinate between architect, GC, and subs
- **As a developer**, I need to manage change orders and budget impacts
- **As a developer**, I need construction photos linked to 3D locations
- **As a developer**, I need to track pre-leasing during construction

### Wireframe Description

```
┌────────────────────────────────────────────────────────────────┐
│ PROJECT MANAGEMENT - 3D-Integrated Construction Tracker         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │           3D CONSTRUCTION PROGRESS VISUALIZATION            ││
│ │                                                            ││
│ │  [3D Building Model]                                       ││
│ │                                                            ││
│ │  ■ Complete (45%)     Current Status:                     ││
│ │  ■ In Progress (15%)  • Floors 1-4: Complete             ││
│ │  □ Not Started (40%)  • Floor 5: Framing                 ││
│ │                       • Floors 6-12: Not started          ││
│ │                                                            ││
│ │  📸 Click any area to view progress photos                ││
│ │                                                            ││
│ │  Schedule Status: 3 days ahead 🟢                         ││
│ │  Budget Status: 2% under 🟢                               ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌─────────────────────────────────┐ ┌────────────────────────┐│
│ │  STAKEHOLDER COORDINATION       │ │  BUDGET & CHANGE ORDERS││
│ │                                 │ │                        ││
│ │  Active Team Members:           │ │  Original Budget: $59.5M││
│ │                                 │ │  Approved COs: $1.2M   ││
│ │  Architect: SBA Design          │ │  Current: $60.7M       ││
│ │  • Weekly OAC: Tuesdays 10am    │ │                        ││
│ │  • Last RFI: #47 (foundation)   │ │  Recent Changes:       ││
│ │                                 │ │                        ││
│ │  GC: Turner Construction        │ │  CO #12: MEP routing   ││
│ │  • Super: Mike Chen             │ │  • Cost: +$125k        ││
│ │  • PM: Sarah Williams           │ │  • Schedule: Neutral   ││
│ │  • Contract: GMP $52.1M         │ │  • Status: Approved ✅  ││
│ │                                 │ │                        ││
│ │  Key Subs on Site:              │ │  CO #13: Add'l shoring ││
│ │  • Concrete: ABC (85% complete) │ │  • Cost: +$87k         ││
│ │  • Framing: XYZ (25% complete)  │ │  • Schedule: -3 days   ││
│ │  • MEP: Starting next week      │ │  • Status: Pending ⏳   ││
│ │                                 │ │                        ││
│ │  [View Contact List] [Meeting Notes] │ [CO Log] [Contingency]││
│ └─────────────────────────────────┘ └────────────────────────┘│
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │              CONSTRUCTION MILESTONE TRACKER                 ││
│ │                                                            ││
│ │  Milestone              Plan      Actual    Variance       ││
│ │  ────────────────────────────────────────────────────────  ││
│ │  ✅ Groundbreaking      Jan 15    Jan 12    +3 days       ││
│ │  ✅ Foundation Pour     Mar 1     Feb 28    +1 day        ││
│ │  ✅ Parking Complete    May 15    May 18    -3 days       ││
│ │  ✅ Top Off            Aug 30    Aug 27    +3 days       ││
│ │  ⏳ Windows/Dry-in     Oct 15    On track  --            ││
│ │  ⏳ MEP Rough-in       Dec 1     At risk   ⚠️             ││
│ │  □ Interior Finishes   Feb 2026  --        --            ││
│ │  □ TCO                May 2026  --        --            ││
│ │                                                            ││
│ │  Critical Path: MEP coordination delaying drywall start    ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌─────────────────────────────────┐ ┌────────────────────────┐│
│ │  CONSTRUCTION PHOTOS/DOCS       │ │  PRE-LEASING TRACKER   ││
│ │                                 │ │                        ││
│ │  Recent Uploads:                │ │  Marketing Launch: -90d││
│ │                                 │ │                        ││
│ │  📸 Floor 5 rebar inspection    │ │  Current Activity:     ││
│ │     Location: Grid C-4          │ │  • Inquiries: 127      ││
│ │     Uploaded: Today 2:30pm      │ │  • Tours: 0 (model pending)││
│ │                                 │ │  • Deposits: 0         ││
│ │  📄 Concrete test results       │ │  • LOIs: 8             ││
│ │     Floor 4 - 4,200 psi ✅      │ │                        ││
│ │                                 │ │  Unit Interest:        ││
│ │  📸 Drone progress video        │ │  • 1BR: 67% of inquiries││
│ │     Week 24 overview            │ │  • 2BR: 28%            ││
│ │                                 │ │  • 3BR: 5%             ││
│ │  [View All] [Upload] [3D Link]  │ │                        ││
│ └─────────────────────────────────┘ │  [Pre-lease Dashboard] ││
│                                     └────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

### 3D Visualization Integration
- Progress tracking overlaid on 3D model
- Click areas to see related photos/documents
- Visual completion percentage by building zone
- Camera positions for progress photos mapped in 3D

### API Requirements
```typescript
// Update construction progress
PUT /api/v1/deals/{dealId}/construction-progress
Body: {
  zone: "floor-5",
  percentComplete: 25,
  status: "framing",
  photos: ["photo-url-1", "photo-url-2"],
  notes: "Steel framing 25% complete, on schedule"
}

// Track change orders
POST /api/v1/deals/{dealId}/change-orders
Body: {
  description: "Additional shoring for adjacent building",
  costImpact: 87000,
  scheduleImpact: -3,
  status: "pending",
  attachments: ["co-13-proposal.pdf"]
}
```

---

## 3. Timeline & Milestones Module (Development Lifecycle)

### Purpose in Development Context
Manages the entire development timeline from land acquisition through stabilization. Integrates with 3D phases, tracks dependencies, and provides early warning for delays.

### User Stories
- **As a developer**, I need to see how entitlement delays impact construction start
- **As a developer**, I need to track multiple interconnected timelines
- **As a developer**, I need milestone alerts before critical dates
- **As a developer**, I need to model timeline scenarios (fast/expected/slow)
- **As a developer**, I need to coordinate closings for multiple parcels

### Wireframe Description

```
┌────────────────────────────────────────────────────────────────┐
│ TIMELINE & MILESTONES - Development Lifecycle Orchestrator     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │              MASTER DEVELOPMENT TIMELINE                    ││
│ │                                                            ││
│ │  2024         2025         2026         2027               ││
│ │  Q1 Q2 Q3 Q4  Q1 Q2 Q3 Q4  Q1 Q2 Q3 Q4  Q1 Q2            ││
│ │  ─────────────────────────────────────────────────────────││
│ │  LAND ACQUISITION                                          ││
│ │  ████████                                                  ││
│ │    └─ Main: ✅                                            ││
│ │    └─ Adjacent: ⏳                                         ││
│ │                                                            ││
│ │  ENTITLEMENTS                                              ││
│ │      ██████████████                                        ││
│ │         └─ Zoning: ⏳                                      ││
│ │         └─ Permits: ⏳                                     ││
│ │                                                            ││
│ │  FINANCING                                                 ││
│ │         ████████                                           ││
│ │                                                            ││
│ │  CONSTRUCTION                                              ││
│ │              ████████████████████████                      ││
│ │                 └─ Current: Foundations                    ││
│ │                                                            ││
│ │  LEASE-UP                                                  ││
│ │                          ████████████████                  ││
│ │                                                            ││
│ │  [Scenario: Expected] [▼]  Completion: May 2026           ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌─────────────────────────────────┐ ┌────────────────────────┐│
│ │  CRITICAL PATH ANALYSIS         │ │  MILESTONE ALERTS      ││
│ │                                 │ │                        ││
│ │  Current Critical Path:         │ │  Next 30 Days:         ││
│ │                                 │ │                        ││
│ │  1. Adjacent parcel closing     │ │  ⚠️ Mar 15: Adjacent   ││
│ │     └─ Mar 15 deadline          │ │     parcel DD deadline ││
│ │                                 │ │                        ││
│ │  2. Zoning variance hearing     │ │  ⚠️ Mar 22: Zoning     ││
│ │     └─ Apr 5 (prep needed)      │ │     application due    ││
│ │                                 │ │                        ││
│ │  3. Construction loan close     │ │  📅 Mar 28: Construction││
│ │     └─ Must close by Apr 30     │ │     loan commitment exp││
│ │                                 │ │                        ││
│ │  Total Float: 12 days           │ │  ✅ Apr 5: OAC meeting ││
│ │                                 │ │                        ││
│ │  Risk Level: MEDIUM             │ │  [Set Alert Preferences]││
│ └─────────────────────────────────┘ └────────────────────────┘│
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │               SCENARIO MODELING                             ││
│ │                                                            ││
│ │  Scenario        Completion    First Rent    IRR Impact   ││
│ │  ────────────────────────────────────────────────────────  ││
│ │  🚀 Fast Track   Mar 2026     Apr 2026      +2.1%        ││
│ │     (All goes perfectly, no delays)                        ││
│ │                                                            ││
│ │  📊 Expected     May 2026     Jun 2026      Base         ││
│ │     (Current plan with normal delays)                      ││
│ │                                                            ││
│ │  🐌 Slow Case    Aug 2026     Oct 2026      -3.4%        ││
│ │     (Permitting delays, weather, etc.)                     ││
│ │                                                            ││
│ │  Key Variables:                                            ││
│ │  • Entitlement approval: ±3 months                        ││
│ │  • Weather delays: ±2 months                              ││
│ │  • Inspection delays: ±1 month                            ││
│ │                                                            ││
│ │  [Run Monte Carlo Simulation]                             ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │                  DEPENDENCY TRACKER                        ││
│ │                                                            ││
│ │  Task Dependencies Map:                                   ││
│ │                                                            ││
│ │  Land Closing ──┬─→ Site Work Start                       ││
│ │                 └─→ Construction Loan                     ││
│ │                                                            ││
│ │  Zoning Approval ──┬─→ Building Permit                    ││
│ │                    └─→ Final Design                       ││
│ │                                                            ││
│ │  Foundation Complete ──→ Vertical Construction            ││
│ │                                                            ││
│ │  TCO ──┬─→ First Move-ins                               ││
│ │         └─→ Permanent Financing                           ││
│ │                                                            ││
│ │  ⚠️ Blocked: Permit application waiting on zoning         ││
│ │                                                            ││
│ │  [View Full Dependency Chart]                             ││
│ └────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

### AI Recommendation Touchpoints
1. **Critical Path Optimization**: Suggests ways to compress timeline
2. **Risk Mitigation**: Identifies high-risk dependencies
3. **Resource Allocation**: Recommends where to focus efforts
4. **Scenario Planning**: Provides probability weights for outcomes

### Component Hierarchy
```
TimelineSection/
├── MasterTimeline/
│   ├── GanttChart
│   ├── PhaseTracking
│   ├── ScenarioSelector
│   └── CompletionProjection
├── CriticalPath/
│   ├── PathAnalysis
│   ├── FloatCalculation
│   ├── RiskAssessment
│   └── OptimizationSuggestions
├── MilestoneAlerts/
│   ├── UpcomingDeadlines
│   ├── AlertConfiguration
│   ├── NotificationSystem
│   └── CalendarIntegration
├── ScenarioModeling/
│   ├── FastTrackScenario
│   ├── ExpectedScenario
│   ├── DelayScenario
│   └── MonteCarloSimulation
└── DependencyTracker/
    ├── TaskRelationships
    ├── BlockerIdentification
    ├── DependencyVisualization
    └── ImpactAnalysis
```

---

## Data Flow Integration

```
Due Diligence Findings ──────┐
                            │
3D Design Phases ───────────┤
                            ├──→ PROJECT ORCHESTRATION
Construction Progress ──────┤
                            │
Market Timing Windows ──────┘
                            │
                            ▼
                    Optimized Timeline
                    Risk Mitigation
                    Resource Allocation
```

---

## Implementation Estimates

### Phase 1: Due Diligence Module (Week 1)
- Multi-parcel tracker: 16 hours
- Entitlement analysis: 12 hours
- Environmental/Geotech: 12 hours
- AI insights: 8 hours
**Total: 48 hours**

### Phase 2: Project Management (Week 2)
- 3D progress integration: 16 hours
- Stakeholder coordination: 8 hours
- Budget/CO tracking: 12 hours
- Photo/doc management: 8 hours
**Total: 44 hours**

### Phase 3: Timeline Module (Week 3)
- Master timeline viz: 12 hours
- Critical path analysis: 12 hours
- Scenario modeling: 8 hours
- Dependency tracking: 8 hours
**Total: 40 hours**

### Phase 4: Integration (Week 4)
- Module interconnections: 12 hours
- Alert system: 8 hours
- Reporting tools: 8 hours
- Testing: 12 hours
**Total: 40 hours**

**TOTAL ESTIMATE: 172 hours (4 weeks, 1 developer)**

---

## Success Metrics

1. **Development Efficiency**
   - DD completion time: -20% vs. traditional
   - Issue identification: 2x earlier
   - Timeline accuracy: ±5% of actual

2. **Construction Management**
   - RFI response time: <48 hours
   - Change order processing: <72 hours
   - Progress tracking accuracy: Daily updates

3. **Risk Mitigation**
   - Critical path visibility: Real-time
   - Delay prediction: 2+ weeks advance notice
   - Dependency conflicts: Zero missed

---

**These Operations modules transform project tracking into proactive development orchestration.**