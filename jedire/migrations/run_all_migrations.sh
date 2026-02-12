#!/bin/bash

# =====================================================
# JediRe Database Migration Runner
# =====================================================
# Description: Runs all database migrations in order
# Usage: ./run_all_migrations.sh
# =====================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${DB_NAME:-jedire}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Migration files in order
MIGRATIONS=(
    "001_core_extensions.sql"
    "002_core_tables.sql"
    "003_zoning_agent.sql"
    "004_supply_demand_agents.sql"
    "005_price_agent.sql"
    "006_news_event_agents.sql"
    "007_cashflow_financial_agents.sql"
    "008_development_network_agents.sql"
    "009_collaboration_analytics.sql"
    "010_indexes_views_functions.sql"
)

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         JediRe Database Migration Runner               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if database exists
echo -e "${YELLOW}Checking database connection...${NC}"
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo -e "${GREEN}✓ Database '$DB_NAME' found${NC}"
else
    echo -e "${RED}✗ Database '$DB_NAME' not found${NC}"
    echo -e "${YELLOW}Creating database...${NC}"
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    echo -e "${GREEN}✓ Database created${NC}"
fi

echo ""
echo -e "${YELLOW}Database:${NC} $DB_NAME"
echo -e "${YELLOW}Host:${NC} $DB_HOST:$DB_PORT"
echo -e "${YELLOW}User:${NC} $DB_USER"
echo ""

# Confirm before running
read -p "$(echo -e ${YELLOW}Do you want to proceed with migrations? [y/N]: ${NC})" -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Migration cancelled${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Starting migrations...${NC}"
echo ""

# Create migration tracking table if it doesn't exist
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW()
);" > /dev/null 2>&1

# Run each migration
SUCCESS_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0

for MIGRATION in "${MIGRATIONS[@]}"; do
    # Check if migration already ran
    ALREADY_RAN=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
        "SELECT COUNT(*) FROM schema_migrations WHERE migration_name = '$MIGRATION'")
    
    if [ "$ALREADY_RAN" -gt 0 ]; then
        echo -e "${YELLOW}⊙ $MIGRATION (already executed, skipping)${NC}"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
    fi
    
    echo -e "${BLUE}▶ Running $MIGRATION...${NC}"
    
    # Run migration
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION" > /dev/null 2>&1; then
        # Record successful migration
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
            "INSERT INTO schema_migrations (migration_name) VALUES ('$MIGRATION')" > /dev/null 2>&1
        echo -e "${GREEN}✓ $MIGRATION completed successfully${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}✗ $MIGRATION failed${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        
        # Show error details
        echo -e "${RED}Error details:${NC}"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION"
        
        # Ask if should continue
        read -p "$(echo -e ${YELLOW}Continue with remaining migrations? [y/N]: ${NC})" -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Migration stopped${NC}"
            exit 1
        fi
    fi
    echo ""
done

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Migration Summary                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo -e "${GREEN}✓ Successful:${NC} $SUCCESS_COUNT"
echo -e "${YELLOW}⊙ Skipped:${NC} $SKIP_COUNT"
if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${RED}✗ Failed:${NC} $FAIL_COUNT"
fi
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 All migrations completed successfully!${NC}"
    echo ""
    
    # Run health check
    echo -e "${BLUE}Running database health check...${NC}"
    echo ""
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT * FROM database_health_check();"
    echo ""
    
    # Show database size
    echo -e "${BLUE}Database size:${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT pg_size_pretty(pg_database_size('$DB_NAME')) AS database_size;
    "
    echo ""
    
    echo -e "${GREEN}✓ Database is ready for use!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Set up continuous aggregate refresh policies (see README.md)"
    echo "  2. Set up retention policies for time-series data"
    echo "  3. Configure automated backups"
    echo "  4. Schedule materialized view refreshes"
    echo ""
else
    echo -e "${RED}⚠ Some migrations failed. Please check the errors above.${NC}"
    exit 1
fi
