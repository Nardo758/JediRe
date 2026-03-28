# JediRe Data Capture Architecture

## Deal Lifecycle Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEAL LIFECYCLE                                     │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│   SOURCING  │     DD      │  CONTRACT   │   CLOSING   │       OWNED         │
│   (Lead)    │  (Active)   │  (LOI/PSA)  │  (Closing)  │    (Portfolio)      │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────────────┤
│ • Property  │ • Phase I   │ • LOI       │ • Title     │ • Rent rolls        │
│   data      │ • Appraisal │ • PSA       │ • Deed      │ • Financials        │
│ • Market    │ • Survey    │ • Amendments│ • Wire      │ • Maintenance       │
│   research  │ • Title     │ • Lender    │ • Insurance │ • Tenant data       │
│ • Pro forma │ • Inspects  │   docs      │ • Closing   │ • Capex tracking    │
│   (draft)   │ • Rent roll │ • Insurance │   statement │ • LP reports        │
│             │ • Financials│   quote     │             │ • Tax docs          │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘
```

## Current State Assessment

### ✅ What Exists

| Component | Table(s) | Status |
|-----------|----------|--------|
| Deal Core | `deals` | ✅ Has stage, status, deal_data JSONB |
| Notes | `deal_notes` | ✅ Full CRUD with tags, attachments |
| Activity | `deal_activity` | ✅ Event logging |
| Contacts | `deal_contacts` | ✅ Role-based contacts |
| Documents | `deal_documents` + file storage | ✅ Categorized uploads |
| Key Dates | `deal_key_dates` | ✅ Deadlines & milestones |
| Decisions | `deal_decisions` | ✅ Decision log with rationale |
| Risks | `deal_risks` | ✅ Risk register |
| Team | `deal_team_members`, `deal_team_tasks` | ✅ Team assignments |
| Zoning | `zoning_profiles`, `zoning_verification` | ✅ Zoning data |
| Pro Forma | `opus_proforma_versions` | ✅ Versioned financials |

### ⚠️ Gaps Identified

| Gap | Impact | Priority |
|-----|--------|----------|
| No explicit stage transitions | Can't track deal progression | HIGH |
| No "Owned Asset" data model | Post-close ops not supported | HIGH |
| No historical snapshots | Can't see deal at point-in-time | MEDIUM |
| No data validation rules by stage | Incomplete data passes through | MEDIUM |
| No document templates by stage | Users don't know what's needed | LOW |

---

## Proposed Data Architecture

### 1. Deal Stages & Statuses

```sql
-- Deal stage enum (lifecycle position)
CREATE TYPE deal_stage AS ENUM (
  'lead',           -- Initial sourcing
  'qualification',  -- Initial analysis
  'loi',           -- LOI submitted/negotiating
  'due_diligence', -- Under contract, DD period
  'contract',      -- Past DD, finalizing terms
  'closing',       -- Closing process
  'closed',        -- Deal completed
  'owned'          -- Asset in portfolio
);

-- Deal status (current state within stage)
CREATE TYPE deal_status AS ENUM (
  'active',        -- In progress
  'paused',        -- On hold
  'dead',          -- Deal fell through
  'archived'       -- Historical record
);

-- Stage transition log
CREATE TABLE deal_stage_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id),
  from_stage deal_stage,
  to_stage deal_stage NOT NULL,
  transitioned_by UUID REFERENCES users(id),
  transitioned_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  required_docs_complete BOOLEAN DEFAULT FALSE
);
```

### 2. Document Requirements by Stage

```sql
CREATE TABLE stage_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage deal_stage NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  description TEXT,
  template_url TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Seed with standard requirements
INSERT INTO stage_document_requirements (stage, document_type, category, is_required) VALUES
-- LOI Stage
('loi', 'Letter of Intent', 'legal', true),
('loi', 'Initial Pro Forma', 'financial', true),
-- Due Diligence Stage
('due_diligence', 'Phase I ESA', 'environmental', true),
('due_diligence', 'Property Condition Assessment', 'inspection', true),
('due_diligence', 'ALTA Survey', 'legal', true),
('due_diligence', 'Title Commitment', 'legal', true),
('due_diligence', 'Appraisal', 'financial', true),
('due_diligence', 'Rent Roll', 'financial', true),
('due_diligence', 'T12 Operating Statement', 'financial', true),
-- Contract Stage
('contract', 'Purchase & Sale Agreement', 'legal', true),
('contract', 'Lender Term Sheet', 'financial', false),
('contract', 'Insurance Quote', 'legal', true),
-- Closing Stage
('closing', 'Final Title Policy', 'legal', true),
('closing', 'Closing Statement', 'legal', true),
('closing', 'Deed', 'legal', true),
('closing', 'Wire Confirmation', 'financial', true);
```

### 3. Owned Asset Data Model

```sql
-- When deal closes, create asset record
CREATE TABLE portfolio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id), -- Link to original deal
  
  -- Asset Identity
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  property_type VARCHAR(100),
  units INTEGER,
  square_footage INTEGER,
  
  -- Ownership
  acquisition_date DATE NOT NULL,
  acquisition_price DECIMAL(15, 2),
  ownership_entity VARCHAR(255),
  ownership_percentage DECIMAL(5, 2) DEFAULT 100.00,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, under_contract, sold, refinanced
  disposition_date DATE,
  disposition_price DECIMAL(15, 2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Periodic operational data
CREATE TABLE asset_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES portfolio_assets(id),
  
  -- Period
  period_type VARCHAR(20) NOT NULL, -- monthly, quarterly, annual
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Income
  gross_potential_rent DECIMAL(15, 2),
  vacancy_loss DECIMAL(15, 2),
  effective_gross_income DECIMAL(15, 2),
  other_income DECIMAL(15, 2),
  
  -- Expenses
  operating_expenses DECIMAL(15, 2),
  property_taxes DECIMAL(15, 2),
  insurance DECIMAL(15, 2),
  management_fees DECIMAL(15, 2),
  
  -- NOI
  net_operating_income DECIMAL(15, 2),
  
  -- Debt Service
  debt_service DECIMAL(15, 2),
  cash_flow DECIMAL(15, 2),
  
  -- Metadata
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rent roll snapshots
CREATE TABLE asset_rent_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES portfolio_assets(id),
  as_of_date DATE NOT NULL,
  
  -- Summary
  total_units INTEGER,
  occupied_units INTEGER,
  occupancy_rate DECIMAL(5, 2),
  average_rent DECIMAL(10, 2),
  
  -- Detailed unit data
  unit_data JSONB, -- Array of {unit, bed, bath, sqft, rent, status, tenant, lease_end}
  
  -- Source
  source_file_id UUID, -- Reference to uploaded document
  created_at TIMESTAMP DEFAULT NOW()
);

-- Capital expenditures
CREATE TABLE asset_capex (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES portfolio_assets(id),
  
  -- Project
  project_name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- interior, exterior, amenities, deferred_maintenance
  
  -- Budget
  budgeted_amount DECIMAL(15, 2),
  actual_amount DECIMAL(15, 2),
  
  -- Timeline
  start_date DATE,
  completion_date DATE,
  status VARCHAR(50), -- planned, in_progress, completed, deferred
  
  -- Details
  description TEXT,
  vendor VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Data Import/Export Architecture

```sql
-- Import jobs tracking
CREATE TABLE data_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  
  -- Import details
  import_type VARCHAR(50) NOT NULL, -- deals, contacts, rent_roll, financials
  source_file_name VARCHAR(255),
  source_file_url TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  records_total INTEGER,
  records_processed INTEGER,
  records_failed INTEGER,
  
  -- Results
  error_log JSONB,
  created_records JSONB, -- Array of created record IDs
  
  -- Timestamps
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Export jobs
CREATE TABLE data_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  
  -- Export details
  export_type VARCHAR(50) NOT NULL,
  filters JSONB, -- What was exported
  format VARCHAR(20), -- csv, xlsx, json
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  file_url TEXT,
  expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Data Flow by Lifecycle Stage

### Stage 1: Sourcing (Lead)

**User Actions:**
- Create deal from property search or manual entry
- Upload initial property photos
- Create draft pro forma

**Data Captured:**
```
deals (core info)
├── deal_documents (photos, OM, flyers)
├── deal_notes (initial observations)
└── opus_proforma_versions (draft underwriting)
```

**Validation:** Minimal - just property address required

---

### Stage 2: Qualification → LOI

**User Actions:**
- Refine pro forma
- Upload market research
- Submit LOI

**Data Captured:**
```
deals (updated with strategy)
├── deal_documents (LOI, market reports)
├── deal_contacts (broker, seller)
├── deal_decisions (go/no-go decision)
└── deal_key_dates (LOI expiration)
```

**Validation:** Property type, unit count, target price required

---

### Stage 3: Due Diligence

**User Actions:**
- Order inspections, surveys, environmental
- Review rent rolls, financials
- Track DD checklist items

**Data Captured:**
```
deals (verified data replaces estimates)
├── deal_documents (DD reports, title, appraisal)
├── deal_notes (inspection findings)
├── deal_risks (identified issues)
├── deal_key_dates (DD deadlines)
└── deal_activity (all updates logged)
```

**Validation:** Required documents checklist (Phase I, Survey, Title, etc.)

---

### Stage 4: Contract → Closing

**User Actions:**
- Finalize PSA terms
- Coordinate closing logistics
- Track wire transfers

**Data Captured:**
```
deals (final terms)
├── deal_documents (PSA, amendments, closing docs)
├── deal_contacts (lender, title, attorney)
├── deal_key_dates (closing date, extensions)
└── deal_team_tasks (closing checklist)
```

**Validation:** All DD docs uploaded, lender approval

---

### Stage 5: Closed → Owned (Portfolio)

**Transition Actions:**
1. Create `portfolio_assets` record from deal
2. Move deal to `closed` stage
3. Initialize operational tracking

**User Actions (Ongoing):**
- Upload monthly/quarterly financials
- Update rent rolls
- Track capital projects
- Generate LP reports

**Data Captured:**
```
portfolio_assets (asset master record)
├── asset_financials (periodic P&L)
├── asset_rent_rolls (occupancy snapshots)
├── asset_capex (improvement projects)
├── deal_documents (ongoing docs: tax returns, insurance)
└── deal_notes (operational notes)
```

---

## API Endpoints by Stage

### Deal CRUD
```
POST   /api/v1/deals                    # Create deal (stage=lead)
GET    /api/v1/deals/:id                # Get deal with context
PUT    /api/v1/deals/:id                # Update deal
DELETE /api/v1/deals/:id                # Soft delete
```

### Stage Transitions
```
POST   /api/v1/deals/:id/transition     # Move to next stage
GET    /api/v1/deals/:id/transitions    # Stage history
GET    /api/v1/deals/:id/requirements   # Docs needed for current stage
```

### Document Management
```
POST   /api/v1/deals/:id/files          # Upload (existing)
GET    /api/v1/deals/:id/files          # List files
GET    /api/v1/deals/:id/files/required # Required docs checklist
```

### Portfolio (Post-Close)
```
POST   /api/v1/deals/:id/close          # Convert to portfolio asset
GET    /api/v1/portfolio                # List owned assets
GET    /api/v1/portfolio/:id            # Asset detail
POST   /api/v1/portfolio/:id/financials # Upload period financials
POST   /api/v1/portfolio/:id/rent-roll  # Upload rent roll
GET    /api/v1/portfolio/:id/reports    # Generate LP report
```

### Import/Export
```
POST   /api/v1/import/deals             # Bulk import deals
POST   /api/v1/import/rent-roll         # Import rent roll
GET    /api/v1/export/deals             # Export deals
GET    /api/v1/export/portfolio/:id     # Export asset data package
```

---

## Implementation Priority

### Phase 1 (Core)
1. ✅ Deal stages enum and transition tracking
2. ✅ Document requirements by stage
3. Stage transition API with validation

### Phase 2 (Portfolio)
4. Portfolio assets table
5. Asset financials periodic upload
6. Rent roll import & tracking

### Phase 3 (Operations)
7. CapEx tracking
8. LP reporting automation
9. Data export packages

### Phase 4 (Advanced)
10. Historical snapshots (point-in-time views)
11. Automated data validation rules
12. Integration with property management systems

---

## Migration Path

To implement this architecture:

1. **Add stage/status enums** to deals table
2. **Create stage_document_requirements** table and seed
3. **Create deal_stage_transitions** table for audit
4. **Create portfolio_assets** and related tables
5. **Add `/transition` and `/close` API endpoints
6. **Update UI** to show stage-appropriate forms and checklists
