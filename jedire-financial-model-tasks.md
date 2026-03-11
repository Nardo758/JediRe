# JEDI RE Financial Model Implementation - Task List

## Overview
Three-model architecture: **Acquisition | Development | Redevelopment**  
Claude Compute Engine for structured JSON financial modeling output

---

## 🏗️ **Phase 0: DealStore Architecture & Cascade System** (Foundation)

**Goal:** Single source of truth for all deal data across modules. No module owns its own mock data.

**📦 Reference Implementations:**
- **Store:** `/home/leon/clawd/jedire-dealstore-reference.js` (~700 lines) - Complete Zustand store
- **Types:** `/home/leon/clawd/jedire-dealcontext-types-reference.ts` (~612 lines) - Full type system

### Task 0.1: DealStore Setup (Zustand)
- [ ] Copy `frontend/src/stores/dealContext.types.ts` from reference
  - Contains complete type system (612 lines):
    - `LayeredValue<T>` - 3-layer collision type
    - `DealIdentity` - Deal metadata & classification
    - `ZoningContext` - M02 zoning constraints
    - `DevelopmentPath` - M03 keystone type (buildingType, unitMixProgram, constructionCost, timeline, zoningCompliance)
    - `UnitMixRow` - Unit type, count, SF, targetRent
    - `MarketContext` - M05 market intelligence
    - `SupplyContext` - M04 pipeline tracking
    - `FinancialContext` - Assumptions & outputs
    - `CapitalContext` - Debt & equity structure
    - `StrategyContext` - M08 strategy scores
    - `ScoresContext` - M25 JEDI score
    - `RiskContext` - M14 risk assessment
    - `DealContext` - Root interface tying everything together
- [ ] Create `frontend/src/stores/dealStore.ts` (Zustand store)
  - [ ] Implement `useDealStore()` base hook
  - [ ] Implement `useDealOverview()` - For M01
  - [ ] Implement `useUnitMixIntelligence()` - For M-PIE
  - [ ] Implement `useDevCapacity()` - For M03
  - [ ] Implement `useStrategyArbitrage()` - For M08
  - [ ] Implement `useProForma()` - For M09
- [ ] Populate `INITIAL_CONTEXT` with current mock data shape

### Task 0.2: Keystone Cascade Logic
- [ ] Implement `selectDevelopmentPath(pathId)` action
  - [ ] Step 1: Set `selectedDevelopmentPathId`
  - [ ] Step 2: Look up path → extract `unitMixProgram`
  - [ ] Step 3: Apply user overrides from M-PIE (merge on top)
  - [ ] Step 4: Write to `resolvedUnitMix` + `totalUnits`
  - [ ] Step 5: Mark financial/strategy/scores as STALE
  - [ ] Step 6: Fire async backend recompute
- [ ] Implement `overrideUnitMix(rowId, updates)` action
  - [ ] User layer collision resolution
  - [ ] Propagate to `resolvedUnitMix`
  - [ ] Trigger downstream recompute
- [ ] Implement `addDevelopmentPath(path)` action
- [ ] Implement `updatePath(pathId, updates)` action

### Task 0.3: Three-Layer Collision System
- [ ] Implement `LayeredValue` resolution logic
  - [ ] Priority: user > platform > broker > default
  - [ ] Confidence scoring
  - [ ] Timestamp tracking
- [ ] Build `CollisionIndicator` component
  - [ ] Shows "Broker: $X | Platform: $Y | You: $Z"
  - [ ] Click to see full history
  - [ ] Reset to platform/broker value action
- [ ] Apply to all editable fields:
  - [ ] Unit mix (count, rent, SF)
  - [ ] Financial assumptions (cap rate, rent growth, expenses)
  - [ ] Timeline (construction months, lease-up)

### Task 0.4: Module Refactoring (connect to DealStore)
- [ ] **M01 Deal Overview**
  - [ ] Replace mock data with `useDealOverview()`
  - [ ] Read `resolvedUnitMix`, `scores`, `strategy`, `selectedPath`
  - [ ] Remove local state
- [ ] **M-PIE Unit Mix**
  - [ ] Replace mock with `useUnitMixIntelligence()`
  - [ ] Wire `overrideUnitMix()` to edit handlers
  - [ ] Show collision indicators
- [ ] **M03 Development Capacity**
  - [ ] Replace mock with `useDevCapacity()`
  - [ ] Wire `selectDevelopmentPath()` to path selection
  - [ ] Wire `addPath()` to massing AI output
- [ ] **M08 Strategy Arbitrage**
  - [ ] Replace mock with `useStrategyArbitrage()`
  - [ ] Read `resolvedUnitMix`, `zoning`, `market`
- [ ] **M09 ProForma**
  - [ ] Replace mock with `useProForma()`
  - [ ] Revenue reads `resolvedUnitMix`
  - [ ] Dev costs read `selectedPath.constructionCost`

### Task 0.5: Backend Hydration API
- [ ] `GET /api/v1/deals/:dealId/context`
  - [ ] Assemble `DealContext` from `deal_capsules` + agent cache
  - [ ] Include broker data, platform intelligence, user overrides
  - [ ] Return full cascaded state
- [ ] `POST /api/v1/deals/:dealId/recompute`
  - [ ] Accept trigger type + parameters
  - [ ] Recompute affected sections (strategy, risk, financial)
  - [ ] Return updated state slices
- [ ] `PATCH /api/v1/deals/:dealId/context`
  - [ ] Persist user overrides to database
  - [ ] Update `selectedDevelopmentPathId`
  - [ ] Save override history for audit trail

### Task 0.6: Testing & Validation
- [ ] Test path selection cascade (M03 → M01/M-PIE/M09/M08)
- [ ] Test unit mix override propagation
- [ ] Test collision resolution (broker vs platform vs user)
- [ ] Test backend hydration with real deal data
- [ ] Performance test: full recompute time target <3s

**Deliverable:** Unified DealStore architecture, module refactoring complete (~1,200 lines)

---

## 🎯 **Phase 1: Foundation & Type System** (Backend)

### Task 1.1: Core Type Definitions
- [ ] Create `backend/src/types/financial-model.types.ts`
- [ ] Define all Layer 1 primitives:
  - [ ] `ModelType`, `AssumptionSource`, `TrackedAssumption`
  - [ ] `DebtTerms`, `WaterfallTerms`
  - [ ] `AnnualProjection`, `DispositionAnalysis`
  - [ ] `SensitivityCell`, `WaterfallDistribution`
  - [ ] `ComputationTrace`, `ValidationResult`

### Task 1.2: Model-Specific Types
- [ ] Define `AcquisitionAssumptions` interface
- [ ] Define `AcquisitionOutput` interface
- [ ] Define `DevelopmentAssumptions` interface
  - [ ] Include `ConstructionLineItem`, `MonthlyDraw`, `LeaseUpMonth`
- [ ] Define `DevelopmentOutput` interface
- [ ] Define `RedevelopmentAssumptions` interface
  - [ ] Include `RenovationPhase`, `RedevelopmentMonthDetail`
- [ ] Define `RedevelopmentOutput` interface

### Task 1.3: Validation & Prompt System
- [ ] Define `ClaudeComputeRequest` interface
- [ ] Define `ValidationRule` interface
- [ ] Implement `VALIDATION_RULES` for all 3 model types
- [ ] Implement `PROMPT_TEMPLATES` for all 3 model types
- [ ] Create discriminated union types: `FinancialAssumptions`, `FinancialOutput`

**Deliverable:** Complete TypeScript type system (estimated ~1,600 lines)

---

## 🔧 **Phase 2: Database Schema** (Backend)

### Task 2.1: Financial Models Table
- [ ] Create migration: `financial_models` table
  ```sql
  - id, deal_id, model_type, model_version
  - assumptions (JSONB)
  - output (JSONB)
  - assumptions_hash (for cache invalidation)
  - computed_at, created_by
  ```

### Task 2.2: Computation Cache
- [ ] Create migration: `model_computation_cache` table
  - Stores Claude responses keyed by assumptions_hash
  - TTL strategy for cache expiration

### Task 2.3: Tracked Assumptions Audit Trail
- [ ] Create migration: `assumption_history` table
  - Tracks all user overrides with timestamps
  - Links back to source modules (M05, M15, etc.)

**Deliverable:** 3 database migrations

---

## 🤖 **Phase 3: Claude Integration Service** (Backend)

### Task 3.1: Claude Compute Service
- [ ] Create `backend/src/services/claude-compute.service.ts`
- [ ] Implement `computeFinancialModel<T>(request: ClaudeComputeRequest<T>)`
  - [ ] Build system prompt from template
  - [ ] Inject assumptions JSON
  - [ ] Call Anthropic API with structured output mode
  - [ ] Parse JSON response
  - [ ] Apply validation rules
  - [ ] Cache result

### Task 3.2: Model Type Inference
- [ ] Create `backend/src/services/model-type-inference.service.ts`
- [ ] Logic to infer model type from deal context:
  - Acquisition: has T-12, no construction
  - Development: no T-12, has construction budget
  - Redevelopment: has T-12 AND renovation budget

### Task 3.3: Assumption Assembly
- [ ] Create `backend/src/services/assumption-assembly.service.ts`
- [ ] Gather tracked assumptions from:
  - [ ] Broker OM (Layer 1)
  - [ ] Platform modules: M02-M08, M14, M15, M25, F32, F33 (Layer 2)
  - [ ] User overrides (Layer 3)
- [ ] Build complete `TrackedAssumption` objects with source attribution

### Task 3.4: Output Validator
- [ ] Create `backend/src/services/model-validator.service.ts`
- [ ] Implement all validation rules from `VALIDATION_RULES`
- [ ] Custom validators:
  - Sources = Uses check
  - First cash flow negative check
  - Equity-before-debt waterfall check (development)
  - Unit state sum check (redevelopment)

**Deliverable:** 4 backend services (~800 lines)

---

## 🛣️ **Phase 4: API Routes** (Backend)

### Task 4.1: Financial Model Endpoints
- [ ] Create `backend/src/api/rest/financial-model.routes.ts`
- [ ] `POST /api/v1/deals/:dealId/financial-model/compute`
  - Trigger computation for a deal
  - Auto-detect model type or accept override
- [ ] `GET /api/v1/deals/:dealId/financial-model`
  - Return cached model output
- [ ] `GET /api/v1/deals/:dealId/financial-model/assumptions`
  - Return assembled assumptions with sources
- [ ] `PATCH /api/v1/deals/:dealId/financial-model/assumptions`
  - Update specific assumptions (user overrides)
- [ ] `POST /api/v1/deals/:dealId/financial-model/validate`
  - Re-run validation without re-computing

### Task 4.2: Sensitivity Analysis
- [ ] `POST /api/v1/deals/:dealId/financial-model/sensitivity`
  - Run custom sensitivity table (2 variables)
  - Uses cached base case, computes deltas

### Task 4.3: Export Endpoints
- [ ] `GET /api/v1/deals/:dealId/financial-model/export/:format`
  - Formats: `json`, `pdf`, `excel`
  - Includes full output + assumptions + trace

**Deliverable:** REST API with 7 endpoints

---

## 🎨 **Phase 5: Frontend - Financial Model Viewer** (Frontend)

### Task 5.1: Core Components
- [ ] `FinancialModelViewer.tsx` (main container)
  - Tab navigation: Summary | Projections | Debt | Waterfall | Sensitivity | Assumptions
- [ ] `SummaryTab.tsx` - High-level metrics dashboard
- [ ] `ProjectionsTab.tsx` - Annual/monthly cash flow table
- [ ] `DebtScheduleTab.tsx` - Amortization schedule visualization
- [ ] `WaterfallTab.tsx` - LP/GP distribution waterfall
- [ ] `SensitivityTab.tsx` - Heatmap grid for IRR/EM sensitivity
- [ ] `AssumptionsTab.tsx` - Editable assumptions with source attribution

### Task 5.2: Model-Specific Views
- [ ] `AcquisitionSummary.tsx` - Simplified one-period view
- [ ] `DevelopmentTimeline.tsx` - Construction → Lease-up → Operating timeline
- [ ] `RedevelopmentPhaseTracker.tsx` - Renovation phase progress + unit states

### Task 5.3: Charts & Visualizations
- [ ] Cash flow waterfall chart (SVG/canvas)
- [ ] Sensitivity heatmap (color-coded grid)
- [ ] Debt balance over time (line chart)
- [ ] Unit mix pie chart (development)
- [ ] Renovation progress Gantt chart (redevelopment)

### Task 5.4: Assumption Editor
- [ ] `TrackedAssumptionInput.tsx` component
  - Shows platform-suggested value
  - User override input
  - Delta display
  - Source badge (broker | platform | user | default)
  - Confidence indicator

**Deliverable:** Financial model viewer UI (~1,500 lines)

---

## 📊 **Phase 6: Integration with Existing Modules**

### Task 6.1: Link to Market Intelligence (M02-M08)
- [ ] Wire `platformOverlays` from market intelligence endpoints
- [ ] F32: News-adjusted rent growth → revenue assumptions
- [ ] F33: News-adjusted vacancy → revenue assumptions
- [ ] M08: Strategy recommendation → model type hint

### Task 6.2: Link to Zoning (M02)
- [ ] Development model: populate `zoning` block from M02 output
- [ ] Validate unit count against max density

### Task 6.3: Link to Comps (M05, M15)
- [ ] Acquisition: market rent from M05/M15 comp analysis
- [ ] Redevelopment: renovation premium from M15 rehab comps

### Task 6.4: Link to Risk (M14) & JEDI Score (M25)
- [ ] Display risk scores in assumptions sidebar
- [ ] JEDI Score → confidence indicator for rent growth assumptions

### Task 6.5: PropertyDetailsPage Integration
- [ ] Add **FINANCIALS** tab to PropertyDetailsPage
- [ ] Embed `FinancialModelViewer` when deal exists
- [ ] "RUN FINANCIAL MODEL" button → triggers compute API

**Deliverable:** Wiring between modules + UI integration

---

## 🧪 **Phase 7: Testing & Validation**

### Task 7.1: Backend Unit Tests
- [ ] Test each model type computation (mock Claude responses)
- [ ] Test validation rules (edge cases)
- [ ] Test assumption assembly from mixed sources
- [ ] Test cache hit/miss behavior

### Task 7.2: Frontend Unit Tests
- [ ] Test assumption editor (override flow)
- [ ] Test sensitivity grid rendering
- [ ] Test cash flow chart with negative values

### Task 7.3: Integration Tests
- [ ] End-to-end: Deal → Compute → Display
- [ ] Test all 3 model types with real Claude API
- [ ] Verify IRR/EM calculations against Excel benchmarks

### Task 7.4: Performance Testing
- [ ] Claude response time (target <15s for acquisition, <30s for development)
- [ ] Cache effectiveness (>80% hit rate after first compute)
- [ ] Frontend render time (<2s for projections table)

**Deliverable:** Test suite with >80% coverage

---

## 🚀 **Phase 8: Documentation & Rollout**

### Task 8.1: Developer Docs
- [ ] Type system architecture doc
- [ ] Claude prompt engineering guide
- [ ] Validation rule reference
- [ ] API integration guide for new modules

### Task 8.2: User Documentation
- [ ] Financial model user guide
- [ ] Assumption override best practices
- [ ] Sensitivity analysis tutorial
- [ ] Export & sharing workflow

### Task 8.3: Deployment
- [ ] Deploy backend services to production
- [ ] Configure Claude API keys & rate limits
- [ ] Set up monitoring for computation failures
- [ ] Create admin dashboard for model versions

**Deliverable:** Production-ready financial modeling system

---

## 📦 **Summary by Numbers**

| Phase | Backend Lines | Frontend Lines | DB Migrations | API Endpoints |
|-------|--------------|----------------|---------------|---------------|
| 0     | 300          | 900            | 0             | 3             |
| 1     | 1,600        | 0              | 0             | 0             |
| 2     | 0            | 0              | 3             | 0             |
| 3     | 800          | 0              | 0             | 0             |
| 4     | 400          | 0              | 0             | 7             |
| 5     | 0            | 1,500          | 0             | 0             |
| 6     | 200          | 300            | 0             | 0             |
| 7     | 400          | 200            | 0             | 0             |
| 8     | 0            | 0              | 0             | 0             |
| **TOTAL** | **3,700** | **2,900**   | **3**         | **10**        |

**Estimated Total:** ~6,600 lines of code + 3 migrations + 10 endpoints

---

## 🎯 **Starting Point Recommendation**

**Start with Phase 1 + Phase 3.1** (type system + Claude service) to validate the Claude structured output approach with a simple acquisition model test case. This proves the core architecture before building the full system.

**Immediate Next Step:**
1. Create type definitions file
2. Build minimal Claude compute service
3. Test with 1 acquisition deal
4. Iterate on prompt quality

Once validated, proceed with database, full API, and frontend in parallel.
