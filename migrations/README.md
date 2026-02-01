# JediRe Database Migrations

Complete PostgreSQL database schema for the JediRe Real Estate Operating System.

## Overview

This migration suite creates a production-ready database schema with:
- ✅ 12 AI agent modules (Zoning, Supply, Demand, Price, News, Event, SF Strategy, Development, Cash Flow, Debt, Network, Financial Model)
- ✅ Core tables for users, properties, markets, organizations
- ✅ Time-series data with TimescaleDB
- ✅ Geospatial queries with PostGIS
- ✅ Vector embeddings for semantic search
- ✅ Collaboration features (pins, comments, sessions)
- ✅ Analytics tables (scores, predictions, alerts)
- ✅ Optimized indexes and materialized views

## Migration Files

### 001_core_extensions.sql
**PostgreSQL Extensions & Custom Types**
- UUID generation (uuid-ossp, pgcrypto)
- PostGIS for geospatial operations
- TimescaleDB for time-series data
- pgvector for embeddings
- Custom ENUM types (user_role, property_type, module_type, etc.)

### 002_core_tables.sql
**Core Platform Tables**
- `organizations` - Teams/companies using the platform
- `users` - User accounts with authentication
- `markets` - Cities/municipalities covered
- `properties` - Property records with geographic data
- `property_analyses` - Cached analysis results

### 003_zoning_agent.sql
**Zoning Intelligence Module**
- `zoning_districts` - Zoning boundaries and rules
- `property_zoning` - Property-to-district lookups (cached)
- `zoning_analyses` - AI-powered development feasibility
- `zoning_rag_queries` - RAG query logs for learning
- Point-in-polygon lookup functions

### 004_supply_demand_agents.sql
**Market Dynamics Modules**
- `supply_snapshots` - Inventory tracking (time-series)
- `supply_trends` - Aggregated supply trends
- `demand_metrics` - Buyer activity tracking (time-series)
- `demand_trends` - Aggregated demand trends
- `market_balance` - Supply/demand balance analysis
- TimescaleDB continuous aggregates

### 005_price_agent.sql
**Valuation & Pricing Module**
- `property_valuations` - AI-powered valuations
- `comparable_sales` - Recent comps for CMA
- `price_history` - Price change events (time-series)
- `market_price_trends` - Area-level price trends
- `avm_factors` - Automated valuation model parameters

### 006_news_event_agents.sql
**News Sentiment & Local Events**
- `news_items` - News articles with AI sentiment analysis
- `property_news` - Property-to-news associations
- `local_events` - Development projects and events
- `property_events` - Property-to-event associations
- `news_sentiment_trends` - Sentiment tracking (time-series)
- `event_impact_tracking` - Event impact monitoring (time-series)
- `news_alert_rules` - User alert preferences

### 007_cashflow_financial_agents.sql
**Investment Analysis Modules**
- `cash_flow_analyses` - Detailed cash flow models
- `proforma_projections` - Multi-year projections
- `financial_models` - Complex development/syndication models
- `market_rental_rates` - Rental market data
- `expense_benchmarks` - Operating expense benchmarks
- `financing_options` - Available loan products (Debt Agent)

### 008_development_network_agents.sql
**Development Opportunities & Owner Networks**
- `development_opportunities` - Identified development sites
- `construction_costs` - Cost benchmarks by market
- `permit_activity` - Building permits (leading indicator)
- `property_owners` - Owner entities and portfolios
- `property_ownership` - Historical ownership records
- `owner_networks` - Relationship graph between owners
- `transaction_patterns` - Analyzed investment strategies

### 009_collaboration_analytics.sql
**Team Collaboration & Intelligence**
- `collaboration_sessions` - Real-time team sessions
- `property_pins` - User annotations on properties
- `property_lists` - Custom property portfolios
- `property_comments` - Discussion threads
- `activity_feed` - Team activity stream
- `property_insights` - AI-generated insights
- `opportunity_scores` - Aggregated opportunity scores
- `predictions` - ML predictions and forecasts
- `alerts` - User notifications
- `alert_preferences` - Alert delivery settings

### 010_indexes_views_functions.sql
**Optimizations & Utilities**
- Composite indexes for common queries
- Materialized views (`market_summary`, `property_details_enriched`, `top_opportunities`)
- Helper functions (distance calculations, nearby properties, comparables)
- Score calculation functions
- Cleanup and maintenance functions
- Database health check

## Prerequisites

```bash
# PostgreSQL 15+ with extensions
sudo apt-get install postgresql-15 postgresql-15-postgis-3
sudo apt-get install timescaledb-2-postgresql-15

# pgvector extension (for embeddings)
cd /tmp
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

## Running Migrations

### Option 1: All at Once

```bash
# Run all migrations in order
psql -U postgres -d jedire -f run_all_migrations.sh
```

### Option 2: One by One

```bash
# Set database connection
export PGDATABASE=jedire
export PGUSER=postgres
export PGPASSWORD=your_password

# Run in order
psql -f 001_core_extensions.sql
psql -f 002_core_tables.sql
psql -f 003_zoning_agent.sql
psql -f 004_supply_demand_agents.sql
psql -f 005_price_agent.sql
psql -f 006_news_event_agents.sql
psql -f 007_cashflow_financial_agents.sql
psql -f 008_development_network_agents.sql
psql -f 009_collaboration_analytics.sql
psql -f 010_indexes_views_functions.sql
```

### Option 3: Using Node.js Migration Tool

```javascript
// migrations.js
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'jedire',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432
});

const migrations = [
  '001_core_extensions.sql',
  '002_core_tables.sql',
  '003_zoning_agent.sql',
  '004_supply_demand_agents.sql',
  '005_price_agent.sql',
  '006_news_event_agents.sql',
  '007_cashflow_financial_agents.sql',
  '008_development_network_agents.sql',
  '009_collaboration_analytics.sql',
  '010_indexes_views_functions.sql'
];

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const migration of migrations) {
      console.log(`Running ${migration}...`);
      const sql = await fs.readFile(path.join(__dirname, migration), 'utf8');
      await client.query(sql);
      console.log(`✅ ${migration} completed`);
    }
    
    await client.query('COMMIT');
    console.log('\n🎉 All migrations completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(console.error);
```

## Database Configuration

### postgresql.conf Recommendations

```ini
# Memory
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
work_mem = 64MB

# TimescaleDB
shared_preload_libraries = 'timescaledb,pg_stat_statements'
timescaledb.max_background_workers = 8

# Connections
max_connections = 200

# Query Performance
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200

# Checkpoints
checkpoint_completion_target = 0.9
wal_buffers = 16MB
```

### Create Database

```sql
CREATE DATABASE jedire;
\c jedire

-- Grant permissions
CREATE ROLE jedire_app WITH LOGIN PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE jedire TO jedire_app;
```

## Post-Migration Tasks

### 1. Set up Continuous Aggregate Refresh Policies

```sql
-- Refresh supply_monthly every hour
SELECT add_continuous_aggregate_policy('supply_monthly',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Refresh demand_monthly every hour
SELECT add_continuous_aggregate_policy('demand_monthly',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Refresh price_monthly_trends every hour
SELECT add_continuous_aggregate_policy('price_monthly_trends',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
```

### 2. Set up Retention Policies

```sql
-- Keep supply data for 2 years
SELECT add_retention_policy('supply_snapshots', INTERVAL '2 years');

-- Keep demand data for 2 years
SELECT add_retention_policy('demand_metrics', INTERVAL '2 years');

-- Keep price history for 5 years
SELECT add_retention_policy('price_history', INTERVAL '5 years');
```

### 3. Schedule Materialized View Refreshes

```sql
-- Create cron job to refresh views daily
-- Install pg_cron extension first
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Refresh market summary every 4 hours
SELECT cron.schedule('refresh-market-summary', '0 */4 * * *', 
    'SELECT refresh_market_summary();');

-- Refresh property details daily at 2 AM
SELECT cron.schedule('refresh-property-details', '0 2 * * *',
    'SELECT refresh_property_details();');

-- Refresh top opportunities daily at 3 AM
SELECT cron.schedule('refresh-top-opportunities', '0 3 * * *',
    'SELECT refresh_top_opportunities();');

-- Cleanup expired cache daily at 4 AM
SELECT cron.schedule('cleanup-cache', '0 4 * * *',
    'SELECT cleanup_expired_cache();');
```

### 4. Set up Backup

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql/jedire"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Full database backup
pg_dump -U postgres -Fc jedire > "$BACKUP_DIR/jedire_$DATE.dump"

# Keep only last 7 days
find $BACKUP_DIR -name "jedire_*.dump" -mtime +7 -delete
```

## Schema Statistics

```sql
-- Count tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Count indexes
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';

-- Count functions
SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace;

-- Database size
SELECT pg_size_pretty(pg_database_size('jedire'));

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

## Testing

```sql
-- Run health check
SELECT * FROM database_health_check();

-- Test geospatial queries
SELECT get_zoning_for_point(30.2672, -97.7431, 'Austin');

-- Test nearby properties
SELECT * FROM find_nearby_properties(30.2672, -97.7431, 1.0, 10);

-- Test opportunity score calculation
SELECT calculate_aggregate_opportunity_score(
    '{"zoning": 85, "cash_flow": 90, "price": 75}'::jsonb
);
```

## Troubleshooting

### Extension Installation Issues

```sql
-- Check available extensions
SELECT * FROM pg_available_extensions 
WHERE name IN ('postgis', 'timescaledb', 'vector', 'pg_trgm');

-- If extensions are missing, install them at OS level first
```

### Performance Issues

```sql
-- Analyze tables
ANALYZE;

-- Reindex if needed
REINDEX DATABASE jedire;

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;
```

### TimescaleDB Issues

```sql
-- Verify hypertables
SELECT * FROM timescaledb_information.hypertables;

-- Check chunks
SELECT * FROM timescaledb_information.chunks;

-- Check continuous aggregates
SELECT * FROM timescaledb_information.continuous_aggregates;
```

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE ARCHITECTURE                           │
│                                                                         │
│  Core Layer                                                             │
│  ├── Users & Organizations (auth, teams)                                │
│  ├── Markets & Properties (geographic data)                             │
│  └── Analyses Cache (performance)                                       │
│                                                                         │
│  Agent Layer (12 Modules)                                               │
│  ├── Zoning Agent (development feasibility)                             │
│  ├── Supply Agent (inventory tracking)                                  │
│  ├── Demand Agent (buyer activity)                                      │
│  ├── Price Agent (valuations & comps)                                   │
│  ├── News Agent (sentiment analysis)                                    │
│  ├── Event Agent (local developments)                                   │
│  ├── SF Strategy Agent (single-family opportunities)                    │
│  ├── Development Agent (new construction)                               │
│  ├── Cash Flow Agent (investment analysis)                              │
│  ├── Debt Agent (financing options)                                     │
│  ├── Network Agent (ownership tracking)                                 │
│  └── Financial Model Agent (complex scenarios)                          │
│                                                                         │
│  Analytics Layer                                                        │
│  ├── Opportunity Scores (aggregated)                                    │
│  ├── Predictions (ML forecasts)                                         │
│  ├── Insights (AI-generated)                                            │
│  └── Alerts (notifications)                                             │
│                                                                         │
│  Collaboration Layer                                                    │
│  ├── Sessions (real-time)                                               │
│  ├── Pins & Annotations                                                 │
│  ├── Comments & Discussions                                             │
│  └── Activity Feed                                                      │
│                                                                         │
│  Time-Series Layer (TimescaleDB)                                        │
│  ├── Supply Snapshots                                                   │
│  ├── Demand Metrics                                                     │
│  ├── Price History                                                      │
│  ├── News Sentiment Trends                                              │
│  └── Event Impact Tracking                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## License

Proprietary - JediRe OS

## Support

For questions or issues, contact the development team.

---

**Last Updated:** 2026-01-31  
**Database Version:** 1.0  
**PostgreSQL Version:** 15+  
**Status:** Production Ready ✅
