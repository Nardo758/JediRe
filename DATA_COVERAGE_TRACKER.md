# Property Data Coverage Tracker - Admin Panel

## Overview
Admin dashboard to monitor property data coverage across counties, track scraping activity, and ensure data freshness.

## Metrics to Track

### County Coverage
- **Counties Available:** List of counties with API access
- **Total Parcels:** Number of parcels per county
- **Scraped Properties:** How many we've imported
- **Coverage %:** (Scraped / Total) × 100
- **Last Updated:** Most recent scrape timestamp

### Data Freshness
- **Stale Properties:** Properties not updated in 30+ days
- **Update Frequency:** Target vs actual refresh rate
- **Failed Scrapes:** Properties that couldn't be refreshed
- **Queue Size:** Pending scrapes

### API Health
- **Response Time:** Average API response time per county
- **Success Rate:** % of successful API calls
- **Rate Limits:** Remaining API quota (if applicable)
- **Uptime:** County API availability status

### Activity Metrics
- **Scrapes Today:** Number of properties scraped today
- **Scrapes This Week:** Weekly scraping activity
- **Properties Added:** New properties discovered
- **Properties Updated:** Existing properties refreshed

## Database Schema

### Coverage Tracking Table
```sql
CREATE TABLE property_data_coverage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  county VARCHAR(100) NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  
  -- Coverage metrics
  total_parcels BIGINT,
  scraped_count BIGINT DEFAULT 0,
  coverage_percentage DECIMAL(5,2),
  
  -- API status
  api_status VARCHAR(20) DEFAULT 'active', -- active, degraded, down
  api_url TEXT,
  last_api_check TIMESTAMP,
  avg_response_time_ms INTEGER,
  
  -- Freshness
  oldest_record_date TIMESTAMP,
  newest_record_date TIMESTAMP,
  stale_count BIGINT DEFAULT 0, -- records > 30 days old
  
  -- Activity
  scrapes_today INTEGER DEFAULT 0,
  scrapes_this_week INTEGER DEFAULT 0,
  scrapes_this_month INTEGER DEFAULT 0,
  
  -- Success metrics
  success_rate_24h DECIMAL(5,2),
  failed_scrapes_24h INTEGER DEFAULT 0,
  
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(county, state_code)
);

CREATE INDEX idx_coverage_state ON property_data_coverage(state_code);
CREATE INDEX idx_coverage_status ON property_data_coverage(api_status);
```

### Scrape Activity Log
```sql
CREATE TABLE scrape_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  county VARCHAR(100) NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  
  -- Activity type
  activity_type VARCHAR(50), -- initial_scrape, refresh, bulk_import
  
  -- Results
  properties_attempted INTEGER,
  properties_succeeded INTEGER,
  properties_failed INTEGER,
  
  -- Performance
  duration_seconds DECIMAL(10,2),
  avg_time_per_property_ms INTEGER,
  
  -- Errors
  error_count INTEGER DEFAULT 0,
  error_summary JSONB,
  
  triggered_by VARCHAR(50), -- cron, manual, api_call
  triggered_by_user_id UUID REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scrape_log_county ON scrape_activity_log(county, state_code);
CREATE INDEX idx_scrape_log_date ON scrape_activity_log(created_at DESC);
```

## Admin Panel Components

### 1. Coverage Dashboard (Main View)

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Property Data Coverage                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📊 QUICK STATS                                         │
│  ┌────────┬────────┬────────┬────────┐                │
│  │ 1      │ 52,431 │ 98.2%  │ 2 min  │                │
│  │ Counties│ Props │ Success│ Avg API│                │
│  └────────┴────────┴────────┴────────┘                │
│                                                         │
│  🗺️ COUNTY BREAKDOWN                                   │
│  ┌─────────────────────────────────────────────┐      │
│  │ County      │ Parcels │ Scraped │ Coverage │ Status│
│  ├─────────────────────────────────────────────┤      │
│  │ Fulton, GA  │ 340K   │ 52.4K   │ 15.4%   │ 🟢    │
│  │ DeKalb, GA  │ 280K   │ 0       │ 0%      │ 🔴    │
│  │ Gwinnett,GA │ 320K   │ 0       │ 0%      │ 🔴    │
│  └─────────────────────────────────────────────┘      │
│                                                         │
│  📈 SCRAPING ACTIVITY (Last 7 Days)                    │
│  [Bar chart showing daily scrape counts]               │
│                                                         │
│  ⚠️ ALERTS                                             │
│  • Fulton County: 1,234 stale properties (>30 days)   │
│  • DeKalb API: Not configured                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. County Detail View

**Click any county to see:**
- API endpoint URL
- Last 100 scrape activities
- Success/failure trends
- Sample properties scraped
- Error logs
- Manual scrape button

### 3. Bulk Actions

**Actions available:**
- **Refresh All Stale:** Update properties >30 days old
- **Import County:** Bulk import all parcels from new county
- **Test API:** Verify county API is working
- **Schedule Scrape:** Set up automated refresh

## API Endpoints

### Backend Routes

```typescript
// GET /api/v1/admin/data-coverage
// Get overall coverage summary
router.get('/admin/data-coverage', requireAuth, requireAdmin, async (req, res) => {
  const coverage = await query(`
    SELECT 
      county,
      state_code,
      total_parcels,
      scraped_count,
      coverage_percentage,
      api_status,
      avg_response_time_ms,
      scrapes_today,
      success_rate_24h,
      updated_at
    FROM property_data_coverage
    ORDER BY state_code, county
  `);
  
  const stats = await query(`
    SELECT 
      COUNT(DISTINCT CONCAT(county, state_code)) as total_counties,
      SUM(scraped_count) as total_properties,
      AVG(success_rate_24h) as avg_success_rate,
      AVG(avg_response_time_ms) as avg_api_response
    FROM property_data_coverage
  `);
  
  res.json({
    counties: coverage.rows,
    summary: stats.rows[0]
  });
});

// GET /api/v1/admin/data-coverage/:county/:state
// Get detailed coverage for specific county
router.get('/admin/data-coverage/:county/:state', requireAuth, requireAdmin, async (req, res) => {
  const { county, state } = req.params;
  
  const coverage = await query(
    'SELECT * FROM property_data_coverage WHERE county = $1 AND state_code = $2',
    [county, state]
  );
  
  const recentActivity = await query(`
    SELECT * FROM scrape_activity_log 
    WHERE county = $1 AND state_code = $2 
    ORDER BY created_at DESC 
    LIMIT 100
  `, [county, state]);
  
  const staleProperties = await query(`
    SELECT COUNT(*) as count 
    FROM property_records 
    WHERE county = $1 AND state_code = $2 AND scraped_at < NOW() - INTERVAL '30 days'
  `, [county, state]);
  
  res.json({
    coverage: coverage.rows[0],
    recentActivity: recentActivity.rows,
    staleCount: staleProperties.rows[0].count
  });
});

// POST /api/v1/admin/scrape/county
// Trigger bulk scrape for county
router.post('/admin/scrape/county', requireAuth, requireAdmin, async (req, res) => {
  const { county, state, limit = 100 } = req.body;
  
  // Call property API worker for bulk import
  const response = await fetch('https://property-api.m-dixon5030.workers.dev/multifamily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minUnits: 1, limit })
  });
  
  const data = await response.json();
  
  // Log activity
  await query(`
    INSERT INTO scrape_activity_log 
      (county, state_code, activity_type, properties_attempted, properties_succeeded, triggered_by)
    VALUES ($1, $2, 'bulk_import', $3, $4, 'manual')
  `, [county, state, data.total, data.total]);
  
  // Update coverage
  await updateCoverageStats(county, state);
  
  res.json({ success: true, imported: data.total });
});

// POST /api/v1/admin/scrape/refresh-stale
// Refresh all stale properties
router.post('/admin/scrape/refresh-stale', requireAuth, requireAdmin, async (req, res) => {
  const staleProperties = await query(`
    SELECT parcel_id, county, state_code 
    FROM property_records 
    WHERE scraped_at < NOW() - INTERVAL '30 days'
    LIMIT 100
  `);
  
  let refreshed = 0;
  for (const prop of staleProperties.rows) {
    try {
      const response = await fetch('https://property-api.m-dixon5030.workers.dev/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId: prop.parcel_id })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update property record
        refreshed++;
      }
    } catch (error) {
      console.error(`Failed to refresh ${prop.parcel_id}:`, error);
    }
  }
  
  res.json({ success: true, refreshed });
});
```

## Frontend Component

```typescript
// src/pages/admin/DataCoverage.tsx
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface CountyCoverage {
  county: string;
  state_code: string;
  total_parcels: number;
  scraped_count: number;
  coverage_percentage: number;
  api_status: 'active' | 'degraded' | 'down';
  avg_response_time_ms: number;
  scrapes_today: number;
  success_rate_24h: number;
}

export const DataCoverageDashboard: React.FC = () => {
  const [counties, setCounties] = useState<CountyCoverage[]>([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchCoverage();
  }, []);
  
  const fetchCoverage = async () => {
    const response = await fetch('/api/v1/admin/data-coverage');
    const data = await response.json();
    setCounties(data.counties);
    setSummary(data.summary);
    setLoading(false);
  };
  
  const handleRefreshStale = async () => {
    await fetch('/api/v1/admin/scrape/refresh-stale', { method: 'POST' });
    fetchCoverage();
  };
  
  const handleBulkImport = async (county: string, state: string) => {
    await fetch('/api/v1/admin/scrape/county', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ county, state, limit: 1000 })
    });
    fetchCoverage();
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Property Data Coverage</h1>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard title="Counties" value={summary.total_counties} />
        <StatCard title="Properties" value={summary.total_properties.toLocaleString()} />
        <StatCard title="Success Rate" value={`${summary.avg_success_rate}%`} />
        <StatCard title="Avg API Time" value={`${summary.avg_api_response}ms`} />
      </div>
      
      {/* County Table */}
      <div className="bg-white rounded-lg shadow mb-8">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="p-4 text-left">County</th>
              <th className="p-4 text-right">Total Parcels</th>
              <th className="p-4 text-right">Scraped</th>
              <th className="p-4 text-right">Coverage</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {counties.map((county) => (
              <tr key={`${county.county}-${county.state_code}`} className="border-b hover:bg-gray-50">
                <td className="p-4">{county.county}, {county.state_code}</td>
                <td className="p-4 text-right">{county.total_parcels?.toLocaleString() || 'Unknown'}</td>
                <td className="p-4 text-right">{county.scraped_count.toLocaleString()}</td>
                <td className="p-4 text-right">
                  <span className={getCoverageColor(county.coverage_percentage)}>
                    {county.coverage_percentage}%
                  </span>
                </td>
                <td className="p-4 text-center">
                  {getStatusBadge(county.api_status)}
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => handleBulkImport(county.county, county.state_code)}
                    className="btn-sm btn-primary"
                  >
                    Import More
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Actions */}
      <div className="flex gap-4">
        <button onClick={handleRefreshStale} className="btn btn-primary">
          Refresh Stale Properties
        </button>
        <button className="btn btn-secondary">
          Add New County
        </button>
      </div>
    </div>
  );
};
```

## Automated Updates

### Cron Job (Daily)
```typescript
// Update coverage stats every day at 2 AM
// wrangler.toml:
[[triggers.crons]]
cron = "0 2 * * *"

// Handler:
async function updateAllCoverageStats() {
  const counties = await query('SELECT DISTINCT county, state_code FROM property_records');
  
  for (const { county, state_code } of counties.rows) {
    const stats = await query(`
      SELECT 
        COUNT(*) as scraped_count,
        MIN(scraped_at) as oldest,
        MAX(scraped_at) as newest,
        COUNT(*) FILTER (WHERE scraped_at < NOW() - INTERVAL '30 days') as stale_count
      FROM property_records
      WHERE county = $1 AND state_code = $2
    `, [county, state_code]);
    
    await query(`
      INSERT INTO property_data_coverage (county, state_code, scraped_count, oldest_record_date, newest_record_date, stale_count, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (county, state_code) 
      DO UPDATE SET 
        scraped_count = EXCLUDED.scraped_count,
        oldest_record_date = EXCLUDED.oldest_record_date,
        newest_record_date = EXCLUDED.newest_record_date,
        stale_count = EXCLUDED.stale_count,
        updated_at = NOW()
    `, [county, state_code, stats.rows[0].scraped_count, stats.rows[0].oldest, stats.rows[0].newest, stats.rows[0].stale_count]);
  }
}
```

## Next Steps

1. **Create database migrations** (2 new tables)
2. **Build backend API routes** (5 endpoints)
3. **Build frontend dashboard** (DataCoverage.tsx)
4. **Set up cron job** for daily stats updates
5. **Test with Fulton County data** (52K properties)
6. **Deploy to production**

## Future Enhancements

- **Email alerts** when coverage drops or API goes down
- **Historical trends** showing coverage growth over time
- **Cost tracking** per county (API usage costs)
- **Data quality metrics** (missing fields, invalid data)
- **Competitive comparison** (our coverage vs CoStar, LoopNet)
