# Development-First Settings Module Design

**Created:** 2025-01-10  
**Module Group:** SETTINGS  
**Purpose:** Transform settings from basic preferences to comprehensive development configuration management

---

## Overview

Development projects require complex configuration - from design standards and financial assumptions to construction preferences and market parameters. JEDI RE's Settings module provides intelligent defaults while allowing deep customization for sophisticated developers.

---

## Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SETTINGS MODULE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   DEVELOPMENT PREFERENCES                                       │
│   ┌──────────────┬──────────────┬──────────────┐              │
│   │   DESIGN     │  FINANCIAL   │ CONSTRUCTION │              │
│   │  STANDARDS   │ ASSUMPTIONS  │  PREFERENCES │              │
│   └──────────────┴──────────────┴──────────────┘              │
│                                                                 │
│   PROJECT TEMPLATES                                             │
│   ┌──────────────┬──────────────┬──────────────┐              │
│   │ MULTIFAMILY  │  MIXED-USE   │    CUSTOM    │              │
│   │   PRESETS    │   PRESETS    │   CONFIGS    │              │
│   └──────────────┴──────────────┴──────────────┘              │
│                                                                 │
│   AI CONFIGURATIONS                                             │
│   ┌──────────────┬──────────────┬──────────────┐              │
│   │ OPTIMIZATION │ NOTIFICATION │   LEARNING    │              │
│   │   PARAMS     │   TRIGGERS   │ PREFERENCES  │              │
│   └──────────────┴──────────────┴──────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Settings Module - Development Configuration Center

### Purpose in Development Context
Centralizes all development preferences, from unit mix standards to construction cost assumptions. Enables template creation for different project types and markets. Configures AI behavior and optimization parameters.

### User Stories
- **As a developer**, I need to set my standard unit sizes and mix preferences
- **As a developer**, I need to maintain different assumptions for different markets
- **As a developer**, I need templates for different development types
- **As a developer**, I need to configure AI optimization boundaries
- **As a developer**, I need to control notification and alert preferences

### Wireframe Description

```
┌────────────────────────────────────────────────────────────────┐
│ SETTINGS - Development Configuration Center                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ [🏗️ Design] [💰 Financial] [🔨 Construction] [🤖 AI] [🔔 Alerts]│
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │                    DESIGN STANDARDS                         ││
│ │                                                            ││
│ │  Unit Size Standards (Rentable SF)                         ││
│ │  ┌─────────────────────────────────────────────────────┐  ││
│ │  │ Unit Type    Min     Target   Max     Efficiency   │  ││
│ │  ├─────────────────────────────────────────────────────┤  ││
│ │  │ Studio       450     500      550     88%          │  ││
│ │  │ 1 Bedroom    650     725      800     85%          │  ││
│ │  │ 2 Bedroom    950     1,100    1,250   83%          │  ││
│ │  │ 3 Bedroom    1,350   1,500    1,650   82%          │  ││
│ │  └─────────────────────────────────────────────────────┘  ││
│ │  [Edit Ranges] [Import from Project] [Market Comparison]  ││
│ │                                                            ││
│ │  Preferred Unit Mix Ranges                                ││
│ │  ┌─────────────────────────────────────────────────────┐  ││
│ │  │             Min │████████████│ Max                  │  ││
│ │  │ Studio      10% │████████████│ 20%                  │  ││
│ │  │ 1 Bedroom   40% │████████████████████│ 60%          │  ││
│ │  │ 2 Bedroom   20% │████████████│ 35%                  │  ││
│ │  │ 3 Bedroom    5% │████│ 15%                          │  ││
│ │  └─────────────────────────────────────────────────────┘  ││
│ │                                                            ││
│ │  Amenity Standards                                        ││
│ │  ┌─────────────────────────────────────────────────────┐  ││
│ │  │ ☑ Fitness Center (2,000 SF min)                     │  ││
│ │  │ ☑ Coworking Space (15 SF/unit)                     │  ││
│ │  │ ☑ Pool & Deck (3,500 SF min)                       │  ││
│ │  │ ☑ Pet Spa (500 SF min)                             │  ││
│ │  │ ☐ Golf Simulator                                    │  ││
│ │  │ ☑ Package Room (8 SF/unit)                         │  ││
│ │  │ ☑ Resident Lounge (2,500 SF min)                   │  ││
│ │  └─────────────────────────────────────────────────────┘  ││
│ │  Total Amenity Target: 15-18% of residential SF          ││
│ │                                                            ││
│ │  Parking Ratios by Unit Type                             ││
│ │  Studio: 0.7 | 1BR: 0.9 | 2BR: 1.2 | 3BR: 1.5          ││
│ │  EV Charging: 20% of spaces (future-proof to 50%)        ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │                 FINANCIAL ASSUMPTIONS                      ││
│ │                                                            ││
│ │  Construction Costs (per SF)         Soft Cost Factors    ││
│ │  ┌──────────────────────────┐      ┌──────────────────┐  ││
│ │  │ Type A (Wood)     $185   │      │ Architecture  6%  │  ││
│ │  │ Type III         $225   │      │ Engineering   3%  │  ││
│ │  │ Type I (Steel)   $275   │      │ Legal         2%  │  ││
│ │  │ Parking-Surface  $25    │      │ Permits       1.5%│  ││
│ │  │ Parking-Struct   $65    │      │ Marketing     2%  │  ││
│ │  │ Site Work        $35    │      │ Financing     3%  │  ││
│ │  └──────────────────────────┘      │ Contingency   5%  │  ││
│ │                                    │ Developer Fee 4%  │  ││
│ │  Annual Escalation: 4.5%           └──────────────────┘  ││
│ │                                                            ││
│ │  Operating Assumptions               Revenue Assumptions   ││
│ │  ┌──────────────────────────┐      ┌──────────────────┐  ││
│ │  │ Expense Ratio      35%   │      │ Rent Growth   3.5%│  ││
│ │  │ Vacancy-Stabilized 5%    │      │ Loss to Lease 2%  │  ││
│ │  │ Vacancy-Year 1     8%    │      │ Concessions   1mo │  ││
│ │  │ Management Fee     3%    │      │ Other Income  $75 │  ││
│ │  │ Replacement Res    $350  │      │ Annual Increases: │  ││
│ │  │ Insurance         $850   │      │ • Expenses    3%  │  ││
│ │  │ RE Taxes (% value) 1.2%  │      │ • Rents      3.5% │  ││
│ │  └──────────────────────────┘      └──────────────────┘  ││
│ │                                                            ││
│ │  Return Thresholds                  Exit Assumptions      ││
│ │  Min Levered IRR: 18%              Hold Period: 5-7 yr   ││
│ │  Min Equity Multiple: 2.0x         Exit Cap Expansion: 50bp││
│ │  Min Development Yield: 7.5%       Sales Costs: 2%        ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │              PROJECT TEMPLATES LIBRARY                     ││
│ │                                                            ││
│ │  Saved Templates:                                          ││
│ │                                                            ││
│ │  📁 Urban High-Rise (Type I)                              ││
│ │     • 200-400 units, 0.8 parking, premium finishes        ││
│ │     • $325/SF construction, 24-month timeline              ││
│ │     [Load] [Edit] [Duplicate]                             ││
│ │                                                            ││
│ │  📁 Garden Style (Type III)                               ││
│ │     • 150-250 units, 1.5 parking, standard finishes       ││
│ │     • $185/SF construction, 18-month timeline              ││
│ │     [Load] [Edit] [Duplicate]                             ││
│ │                                                            ││
│ │  📁 Mixed-Use Urban                                       ││
│ │     • 100-200 units + 15k SF retail, structured parking   ││
│ │     • $275/SF residential, $150/SF retail                 ││
│ │     [Load] [Edit] [Duplicate]                             ││
│ │                                                            ││
│ │  [+ Create New Template] [Import Template] [Share]        ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │                  AI CONFIGURATION                          ││
│ │                                                            ││
│ │  Optimization Preferences           Alert Thresholds       ││
│ │  ┌──────────────────────────┐     ┌───────────────────┐  ││
│ │  │ ☑ Auto-optimize unit mix │     │ Cost increase: 5% │  ││
│ │  │ ☑ Suggest amenities      │     │ Timeline slip: 7d │  ││
│ │  │ ☑ Neighboring properties │     │ IRR drop: 1%      │  ││
│ │  │ ☑ Design efficiency      │     │ New supply: 200u  │  ││
│ │  │ ☐ Financing alternatives │     │ Rate change: 50bp │  ││
│ │  └──────────────────────────┘     └───────────────────┘  ││
│ │                                                            ││
│ │  AI Learning Preferences                                   ││
│ │  ☑ Learn from my decisions and improve recommendations    ││
│ │  ☑ Share anonymized data to improve platform AI           ││
│ │  ☐ Conservative mode (only high-confidence suggestions)   ││
│ │                                                            ││
│ │  Recommendation Frequency                                  ││
│ │  ○ Real-time  ● Daily digest  ○ Weekly summary           ││
│ └────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

### Market-Specific Configurations

```
┌────────────────────────────────────────────────────────────────┐
│                 MARKET-SPECIFIC OVERRIDES                       │
│                                                                │
│  Default Market: Atlanta Metro                                  │
│                                                                │
│  Market Overrides:                                             │
│                                                                │
│  📍 Austin Metro                                               │
│     • Construction +15% (labor shortage)                       │
│     • Parking ratio -0.2 (transit-oriented)                    │
│     • Tech amenities priority                                  │
│     [Edit] [Remove]                                            │
│                                                                │
│  📍 Tampa Bay                                                  │
│     • Hurricane standards required                             │
│     • Pool/outdoor amenity priority                            │
│     • Senior housing mix consideration                         │
│     [Edit] [Remove]                                            │
│                                                                │
│  [+ Add Market Override]                                       │
└────────────────────────────────────────────────────────────────┘
```

### Import/Export Capabilities

```
┌────────────────────────────────────────────────────────────────┐
│                    SETTINGS MANAGEMENT                          │
│                                                                │
│  Export Settings:                    Import From:              │
│  [📥 Download JSON]                  [📤 Upload File]          │
│  [📊 Export to Excel]                [🏢 Another Project]      │
│  [🔗 Share Link]                     [🏭 Industry Standards]  │
│                                                                │
│  Version History:                                              │
│  • Mar 10, 2024 - Updated construction costs (+5%)            │
│  • Feb 28, 2024 - Added EV charging requirements              │
│  • Feb 15, 2024 - Initial configuration                       │
│  [View History] [Restore Version]                             │
└────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy
```
SettingsSection/
├── DesignStandards/
│   ├── UnitSizeConfig
│   ├── UnitMixRanges
│   ├── AmenityStandards
│   └── ParkingRatios
├── FinancialAssumptions/
│   ├── CostAssumptions
│   ├── RevenueProjections
│   ├── ReturnThresholds
│   └── ExitParameters
├── ConstructionPreferences/
│   ├── BuildingTypes
│   ├── QualityStandards
│   ├── TimelineDefaults
│   └── ContractorPrefs
├── ProjectTemplates/
│   ├── TemplateLibrary
│   ├── TemplateEditor
│   ├── ImportExport
│   └── Sharing
├── AIConfiguration/
│   ├── OptimizationSettings
│   ├── AlertThresholds
│   ├── LearningPrefs
│   └── NotificationConfig
└── MarketOverrides/
    ├── MarketList
    ├── OverrideEditor
    ├── Validation
    └── Synchronization
```

### API Requirements
```typescript
// Get user settings
GET /api/v1/settings
Response: {
  designStandards: {
    unitSizes: { studio: { min: 450, target: 500, max: 550 } },
    unitMix: { studio: { min: 0.1, max: 0.2 } },
    amenities: ["fitness", "coworking", "pool"],
    parkingRatios: { studio: 0.7, oneBed: 0.9 }
  },
  financialAssumptions: {
    constructionCosts: { typeIII: 225, parking: 65 },
    softCosts: { architecture: 0.06, engineering: 0.03 },
    returnThresholds: { minIRR: 0.18, minMultiple: 2.0 }
  },
  aiConfiguration: {
    optimizationEnabled: true,
    alertThresholds: { costIncrease: 0.05, timelineSlip: 7 },
    learningEnabled: true
  }
}

// Update settings
PUT /api/v1/settings
Body: {
  section: "designStandards",
  updates: {
    unitSizes: { studio: { target: 525 } }
  }
}

// Save template
POST /api/v1/settings/templates
Body: {
  name: "Urban High-Rise Type I",
  description: "200-400 units, premium finishes",
  settings: { ... }
}

// Apply market override
POST /api/v1/settings/market-overrides
Body: {
  marketId: "austin-metro",
  overrides: {
    constructionCostMultiplier: 1.15,
    parkingRatioAdjustment: -0.2
  }
}
```

---

## Intelligent Defaults System

```
┌────────────────────────────────────────────────────────────────┐
│              AI-POWERED SMART DEFAULTS                          │
│                                                                │
│  Based on analysis of 1,028 Atlanta properties:                │
│                                                                │
│  Recommended Settings:                    Your Current:        │
│  • 1BR target size: 725 SF              750 SF ⚠️ (3% high)  │
│  • Parking ratio: 1.05/unit             1.1 ⚠️ (oversupply)  │
│  • Amenity space: 16% of RSF            15% ✅ (on target)   │
│  • Construction: $235/SF                $225 ⚠️ (may be low) │
│                                                                │
│  [Accept All Recommendations] [Review Each] [Keep Current]     │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Estimates

### Phase 1: Core Settings (Week 1)
- Design standards UI: 16 hours
- Financial assumptions: 16 hours
- Data models: 8 hours
- API endpoints: 8 hours
**Total: 48 hours**

### Phase 2: Templates System (Week 2)
- Template management: 12 hours
- Import/Export: 12 hours
- Version control: 8 hours
- Sharing features: 8 hours
**Total: 40 hours**

### Phase 3: AI Configuration (Week 3)
- AI settings UI: 12 hours
- Alert configuration: 8 hours
- Learning preferences: 8 hours
- Smart defaults: 12 hours
**Total: 40 hours**

### Phase 4: Advanced Features (Week 4)
- Market overrides: 12 hours
- Validation system: 8 hours
- Mobile optimization: 8 hours
- Testing: 8 hours
**Total: 36 hours**

**TOTAL ESTIMATE: 164 hours (4 weeks, 1 developer)**

---

## Success Metrics

1. **Configuration Efficiency**
   - Time to configure new project: <5 minutes
   - Template reuse rate: >80%
   - Settings accuracy: 95%+ valid configs

2. **AI Performance**
   - Smart default adoption: >60%
   - Alert relevance: >90%
   - Optimization success: >85%

3. **User Satisfaction**
   - Settings changes per project: <3
   - Template library growth: 2-3/month
   - Support tickets: <5% related to settings

---

**The Settings module transforms basic preferences into a sophisticated development configuration system that learns and improves over time.**