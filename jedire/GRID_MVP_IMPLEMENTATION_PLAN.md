# Grid View MVP - Implementation Plan

**Created:** 2026-02-08 21:25 EST  
**Target:** Build MVP grid views for Pipeline + Assets Owned  
**Estimated Time:** 12 hours

---

## MVP Scope

### Pipeline Grid (20 columns)
**Groups:**
- Identity & Status: 7 columns (all)
- Financial Snapshot: 5 columns (Ask Price, JEDI Price, IRR Broker, IRR JEDI, NOI)
- Strategy Arbitrage: 2 columns (Best Strategy, Confidence)
- Market Context: 2 columns (Supply Risk, Imbalance Score)
- Velocity: 4 columns (Source, LOI Date, Close Date, DD %)

### Assets Owned Grid (25 columns)
**Groups:**
- Identity: 5 columns (all)
- Performance vs UW: 9 columns (NOI, Occupancy, Rent - actual/pf/variance)
- Returns: 5 columns (IRR, CoC, Equity Multiple, Distributions)
- Operational: 4 columns (Occ Trend, Rent Growth, Opex, Capex)
- Risk: 2 columns (Loan Maturity, Refi Risk)

### Features Included
- ✓ Sortable columns (click header)
- ✓ Basic filtering (text search, range filters, enum select)
- ✓ Export CSV
- ✓ View Details (click row)
- ✓ Visual indicators (badges, color coding)
- ✓ Responsive layout
- ✓ Toggle Grid/Kanban (Pipeline) or Grid/Map (Assets)

---

## Phase 1: Backend (4 hours)

### 1.1 Database Schema (1 hour)

**Extend deals table:**
```sql
-- 015_pipeline_grid_columns.sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS days_in_stage INTEGER DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_opportunity_score INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS jedi_adjusted_price NUMERIC(15,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS jedi_adjusted_noi NUMERIC(15,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS jedi_adjusted_cap_rate NUMERIC(5,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS jedi_adjusted_irr NUMERIC(5,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS broker_projected_irr NUMERIC(5,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS best_strategy VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS strategy_confidence INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS supply_risk_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS imbalance_score INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS source VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS loi_deadline DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS inspection_period_end DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS dd_checklist_pct NUMERIC(5,2);

-- Update days_in_stage automatically
CREATE OR REPLACE FUNCTION update_days_in_stage()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.days_in_stage := 0;
  ELSE
    NEW.days_in_stage := EXTRACT(DAY FROM NOW() - NEW.updated_at)::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_days_in_stage
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_days_in_stage();
```

**Create deal_performance table:**
```sql
-- 016_deal_performance_table.sql
CREATE TABLE IF NOT EXISTS deal_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Actuals
  actual_noi NUMERIC(15,2),
  actual_occupancy NUMERIC(5,2),
  actual_avg_rent NUMERIC(10,2),
  actual_opex_ratio NUMERIC(5,2),
  actual_capex NUMERIC(15,2),
  
  -- Pro Forma
  proforma_noi NUMERIC(15,2),
  proforma_occupancy NUMERIC(5,2),
  proforma_rent NUMERIC(10,2),
  proforma_opex_ratio NUMERIC(5,2),
  proforma_capex NUMERIC(15,2),
  
  -- Returns
  current_irr NUMERIC(5,2),
  projected_irr NUMERIC(5,2),
  coc_return NUMERIC(5,2),
  equity_multiple NUMERIC(5,2),
  total_distributions NUMERIC(15,2),
  
  -- Risk
  loan_maturity_date DATE,
  refi_risk_flag BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_performance_deal ON deal_performance(deal_id);
CREATE INDEX idx_deal_performance_period ON deal_performance(period_start, period_end);

-- Auto-update updated_at
CREATE TRIGGER trigger_deal_performance_updated
  BEFORE UPDATE ON deal_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 1.2 API Endpoints (2 hours)

**File:** `backend/src/api/rest/grid.routes.ts`

```typescript
import { Router } from 'express';
import { pool } from '../../database/connection';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// GET /api/v1/grid/pipeline - Pipeline grid data
router.get('/pipeline', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sort, filter } = req.query;
    
    // Build query with filters and sorting
    let query = `
      SELECT 
        d.id,
        d.name as property_name,
        d.property_address as address,
        d.project_type as asset_type,
        d.target_units as unit_count,
        d.status as pipeline_stage,
        d.days_in_stage,
        d.ai_opportunity_score,
        d.budget as ask_price,
        d.jedi_adjusted_price,
        d.broker_projected_irr,
        d.jedi_adjusted_irr,
        d.jedi_adjusted_noi as noi,
        d.best_strategy,
        d.strategy_confidence,
        d.supply_risk_flag,
        d.imbalance_score,
        d.source,
        d.loi_deadline,
        d.timeline_end as closing_date,
        d.dd_checklist_pct,
        d.created_at
      FROM deals d
      WHERE d.user_id = $1
        AND d.deal_category = 'pipeline'
        AND d.status != 'archived'
    `;
    
    // Add filters
    const params = [userId];
    let paramIndex = 2;
    
    if (filter) {
      const filters = JSON.parse(filter as string);
      if (filters.stage) {
        query += ` AND d.status = $${paramIndex++}`;
        params.push(filters.stage);
      }
      if (filters.minScore) {
        query += ` AND d.ai_opportunity_score >= $${paramIndex++}`;
        params.push(filters.minScore);
      }
      if (filters.maxPrice) {
        query += ` AND d.budget <= $${paramIndex++}`;
        params.push(filters.maxPrice);
      }
    }
    
    // Add sorting
    if (sort) {
      const { column, direction } = JSON.parse(sort as string);
      query += ` ORDER BY d.${column} ${direction === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      query += ` ORDER BY d.created_at DESC`;
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      deals: result.rows
    });
  } catch (error) {
    console.error('Pipeline grid error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline grid data' });
  }
});

// GET /api/v1/grid/owned - Assets owned grid data
router.get('/owned', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sort, filter } = req.query;
    
    let query = `
      SELECT 
        d.id,
        d.name as property_name,
        d.property_address as address,
        d.project_type as asset_type,
        d.created_at as acquisition_date,
        EXTRACT(MONTH FROM AGE(NOW(), d.created_at))::INTEGER as hold_period,
        
        -- Performance (from latest deal_performance record)
        dp.actual_noi,
        dp.proforma_noi,
        CASE WHEN dp.proforma_noi > 0 
          THEN ((dp.actual_noi - dp.proforma_noi) / dp.proforma_noi * 100)
          ELSE 0 
        END as noi_variance,
        
        dp.actual_occupancy,
        dp.proforma_occupancy,
        (dp.actual_occupancy - dp.proforma_occupancy) as occupancy_variance,
        
        dp.actual_avg_rent,
        dp.proforma_rent,
        CASE WHEN dp.proforma_rent > 0
          THEN ((dp.actual_avg_rent - dp.proforma_rent) / dp.proforma_rent * 100)
          ELSE 0
        END as rent_variance,
        
        -- Returns
        dp.current_irr,
        dp.projected_irr,
        dp.coc_return,
        dp.equity_multiple,
        dp.total_distributions,
        
        -- Operational
        dp.actual_opex_ratio,
        dp.actual_capex,
        
        -- Risk
        dp.loan_maturity_date,
        dp.refi_risk_flag
        
      FROM deals d
      LEFT JOIN LATERAL (
        SELECT * FROM deal_performance
        WHERE deal_id = d.id
        ORDER BY period_end DESC
        LIMIT 1
      ) dp ON true
      WHERE d.user_id = $1
        AND d.deal_category = 'portfolio'
    `;
    
    const params = [userId];
    let paramIndex = 2;
    
    // Add filters
    if (filter) {
      const filters = JSON.parse(filter as string);
      if (filters.minIRR) {
        query += ` AND dp.current_irr >= $${paramIndex++}`;
        params.push(filters.minIRR);
      }
      if (filters.refiRisk) {
        query += ` AND dp.refi_risk_flag = true`;
      }
    }
    
    // Add sorting
    if (sort) {
      const { column, direction } = JSON.parse(sort as string);
      query += ` ORDER BY ${column} ${direction === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      query += ` ORDER BY d.created_at DESC`;
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      assets: result.rows
    });
  } catch (error) {
    console.error('Owned grid error:', error);
    res.status(500).json({ error: 'Failed to fetch owned grid data' });
  }
});

// POST /api/v1/grid/export - Export grid to CSV
router.post('/export', authMiddleware, async (req, res) => {
  try {
    const { type, data } = req.body; // type: 'pipeline' or 'owned'
    
    // Generate CSV from data array
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row: any) => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_grid_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export grid data' });
  }
});

export default router;
```

**Register routes:**
```typescript
// backend/src/api/rest/index.ts
import gridRoutes from './grid.routes';
router.use('/grid', gridRoutes);
```

### 1.3 Type Definitions (30 min)

**File:** `frontend/src/types/grid.ts`

```typescript
export interface PipelineDeal {
  id: string;
  property_name: string;
  address: string;
  asset_type: string;
  unit_count: number;
  pipeline_stage: string;
  days_in_stage: number;
  ai_opportunity_score: number;
  ask_price: number;
  jedi_adjusted_price: number;
  broker_projected_irr: number;
  jedi_adjusted_irr: number;
  noi: number;
  best_strategy: string;
  strategy_confidence: number;
  supply_risk_flag: boolean;
  imbalance_score: number;
  source: string;
  loi_deadline: string;
  closing_date: string;
  dd_checklist_pct: number;
  created_at: string;
}

export interface OwnedAsset {
  id: string;
  property_name: string;
  address: string;
  asset_type: string;
  acquisition_date: string;
  hold_period: number;
  actual_noi: number;
  proforma_noi: number;
  noi_variance: number;
  actual_occupancy: number;
  proforma_occupancy: number;
  occupancy_variance: number;
  actual_avg_rent: number;
  proforma_rent: number;
  rent_variance: number;
  current_irr: number;
  projected_irr: number;
  coc_return: number;
  equity_multiple: number;
  total_distributions: number;
  actual_opex_ratio: number;
  actual_capex: number;
  loan_maturity_date: string;
  refi_risk_flag: boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  filterable: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string;
  render?: (value: any, row: any) => React.ReactNode;
}

export interface GridFilter {
  column: string;
  operator: 'eq' | 'gt' | 'lt' | 'contains' | 'in';
  value: any;
}

export interface GridSort {
  column: string;
  direction: 'asc' | 'desc';
}
```

---

## Phase 2: Frontend Components (4 hours)

### 2.1 DataGrid Component (2 hours)

**File:** `frontend/src/components/grid/DataGrid.tsx`

```typescript
import React, { useState } from 'react';
import { ColumnDef, GridSort } from '../../types/grid';

interface DataGridProps {
  columns: ColumnDef[];
  data: any[];
  onRowClick?: (row: any) => void;
  onSort?: (sort: GridSort) => void;
  onExport?: () => void;
  loading?: boolean;
}

export function DataGrid({
  columns,
  data,
  onRowClick,
  onSort,
  onExport,
  loading = false
}: DataGridProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (columnKey: string) => {
    const newDirection = sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnKey);
    setSortDirection(newDirection);
    onSort?.({ column: columnKey, direction: newDirection });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header with Export button */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Showing {data.length} results
        </h3>
        {onExport && (
          <button
            onClick={onExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    <span>{col.label}</span>
                    {col.sortable && sortColumn === col.key && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                onClick={() => onRowClick?.(row)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${
                      col.align === 'right' ? 'text-right' :
                      col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : col.format
                      ? col.format(row[col.key])
                      : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No data found</p>
        </div>
      )}
    </div>
  );
}
```

### 2.2 Pipeline Grid Page (1 hour)

**File:** `frontend/src/pages/PipelineGridPage.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataGrid } from '../components/grid/DataGrid';
import { ColumnDef, PipelineDeal } from '../types/grid';
import { api } from '../services/api.client';

export function PipelineGridPage() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    try {
      const response = await api.get('/grid/pipeline');
      setDeals(response.data.deals);
    } catch (error) {
      console.error('Failed to load deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = async (sort: any) => {
    setLoading(true);
    try {
      const response = await api.get(`/grid/pipeline?sort=${JSON.stringify(sort)}`);
      setDeals(response.data.deals);
    } catch (error) {
      console.error('Failed to sort:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.post('/grid/export', {
        type: 'pipeline',
        data: deals
      }, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pipeline_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  const columns: ColumnDef[] = [
    { key: 'property_name', label: 'Property', sortable: true, filterable: true, width: 200 },
    { key: 'asset_type', label: 'Type', sortable: true, filterable: true, width: 120 },
    { key: 'pipeline_stage', label: 'Stage', sortable: true, filterable: true, width: 120 },
    { key: 'days_in_stage', label: 'Days', sortable: true, filterable: true, width: 80, align: 'right' },
    { 
      key: 'ai_opportunity_score',
      label: 'AI Score',
      sortable: true,
      filterable: true,
      width: 100,
      align: 'right',
      render: (value) => (
        <span className={value >= 85 ? 'font-bold text-green-600' : 'text-gray-900'}>
          {value}
        </span>
      )
    },
    { key: 'ask_price', label: 'Ask Price', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },
    { key: 'jedi_adjusted_price', label: 'JEDI Price', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },
    { key: 'broker_projected_irr', label: 'IRR (Broker)', sortable: true, filterable: true, width: 100, align: 'right', format: (v) => `${v}%` },
    { key: 'jedi_adjusted_irr', label: 'IRR (JEDI)', sortable: true, filterable: true, width: 100, align: 'right', format: (v) => `${v}%` },
    { key: 'noi', label: 'NOI', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },
    { key: 'best_strategy', label: 'Strategy', sortable: true, filterable: true, width: 150 },
    { key: 'strategy_confidence', label: 'Confidence', sortable: true, filterable: true, width: 100, align: 'right' },
    {
      key: 'supply_risk_flag',
      label: 'Supply Risk',
      sortable: true,
      filterable: true,
      width: 100,
      align: 'center',
      render: (value) => value ? <span className="text-orange-600">⚠️ Risk</span> : <span className="text-gray-400">—</span>
    },
    { key: 'imbalance_score', label: 'Imbalance', sortable: true, filterable: true, width: 100, align: 'right' },
    { key: 'source', label: 'Source', sortable: true, filterable: true, width: 120 },
    { key: 'loi_deadline', label: 'LOI Deadline', sortable: true, filterable: true, width: 120 },
    { key: 'closing_date', label: 'Closing', sortable: true, filterable: true, width: 120 },
    { key: 'dd_checklist_pct', label: 'DD %', sortable: true, filterable: true, width: 80, align: 'right', format: (v) => `${v}%` },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pipeline Grid View</h1>
            <p className="text-gray-600">Track deals across acquisition pipeline</p>
          </div>
          <button
            onClick={() => navigate('/deals')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            ← Back to Kanban
          </button>
        </div>

        {/* Grid */}
        <DataGrid
          columns={columns}
          data={deals}
          onRowClick={(row) => navigate(`/deals/${row.id}`)}
          onSort={handleSort}
          onExport={handleExport}
          loading={loading}
        />
      </div>
    </div>
  );
}
```

### 2.3 Assets Owned Grid Page (1 hour)

Similar structure to Pipeline Grid, with 25 columns for owned assets.

---

## Phase 3: Integration (2 hours)

### 3.1 Add Toggle Buttons

Update DealsPage and AssetsOwnedPage to add "Switch to Grid View" buttons.

### 3.2 Add Routes

```typescript
// frontend/src/App.tsx
<Route path="/deals/grid" element={<PipelineGridPage />} />
<Route path="/assets/grid" element={<AssetsOwnedGridPage />} />
```

### 3.3 Test End-to-End

---

## Phase 4: Polish (2 hours)

- Visual indicators (badges, alerts)
- Responsive layout
- Loading states
- Error handling
- Empty states

---

## Total Estimated Time: 12 hours

**Breakdown:**
- Backend: 4 hours
- Frontend: 4 hours  
- Integration: 2 hours
- Polish: 2 hours

---

**Status:** Ready to implement  
**Next Step:** Start with Phase 1 (Database + Backend)
