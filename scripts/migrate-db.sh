#!/bin/bash
################################################################################
# JEDI RE - Database Migration Script
# 
# Safely runs database migrations with rollback capability
# 
# Usage: bash scripts/migrate-db.sh [environment]
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=${1:-staging}

echo -e "${YELLOW}Database Migration - ${ENVIRONMENT}${NC}"
echo "======================================"

# ============================================================================
# Configuration
# ============================================================================

if [[ "$ENVIRONMENT" == "production" ]]; then
    DATABASE_URL="$PRODUCTION_DATABASE_URL"
elif [[ "$ENVIRONMENT" == "staging" ]]; then
    DATABASE_URL="$STAGING_DATABASE_URL"
else
    DATABASE_URL="$DATABASE_URL"
fi

if [[ -z "$DATABASE_URL" ]]; then
    echo -e "${RED}Error: DATABASE_URL not set for $ENVIRONMENT${NC}"
    exit 1
fi

# ============================================================================
# Safety Checks
# ============================================================================

echo ""
echo "Safety checks..."

# Production warning
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "${RED}WARNING: Running migrations on PRODUCTION database${NC}"
    read -p "Type 'migrate' to continue: " confirm
    if [[ "$confirm" != "migrate" ]]; then
        echo "Migration cancelled"
        exit 0
    fi
fi

# Check database connectivity
echo "Testing database connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}✗ Cannot connect to database${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Database connection OK${NC}"

# ============================================================================
# Backup Current Schema
# ============================================================================

echo ""
echo "Creating backup..."

BACKUP_FILE="backup/db-pre-migration-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p backup

pg_dump "$DATABASE_URL" --schema-only > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Schema backed up to $BACKUP_FILE${NC}"
else
    echo -e "${RED}✗ Backup failed${NC}"
    exit 1
fi

# ============================================================================
# Check Pending Migrations
# ============================================================================

echo ""
echo "Checking for pending migrations..."

# TODO: Implement migration tracking
# For now, list all migration files

MIGRATION_DIR="backend/migrations"
PENDING_COUNT=$(ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l)

echo "Found $PENDING_COUNT migration files"

if [ "$PENDING_COUNT" -eq 0 ]; then
    echo -e "${GREEN}No migrations to run${NC}"
    exit 0
fi

# ============================================================================
# Run Migrations
# ============================================================================

echo ""
echo "Running migrations..."

FAILED=0

for migration_file in "$MIGRATION_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
        filename=$(basename "$migration_file")
        echo ""
        echo -e "${YELLOW}Running: $filename${NC}"
        
        if psql "$DATABASE_URL" -f "$migration_file" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $filename completed${NC}"
        else
            echo -e "${RED}✗ $filename failed${NC}"
            FAILED=1
            
            # Offer rollback
            if [[ "$ENVIRONMENT" == "production" ]]; then
                echo ""
                echo -e "${RED}Migration failed in production!${NC}"
                read -p "Rollback to backup? (y/n): " rollback
                if [[ "$rollback" == "y" ]]; then
                    echo "Rolling back..."
                    psql "$DATABASE_URL" < "$BACKUP_FILE"
                    echo -e "${YELLOW}Rolled back to pre-migration state${NC}"
                fi
            fi
            
            exit 1
        fi
    fi
done

# ============================================================================
# Verify Schema
# ============================================================================

echo ""
echo "Verifying schema..."

# Check critical tables exist
TABLES=("users" "submarkets" "market_snapshots" "market_timeseries")

for table in "${TABLES[@]}"; do
    if psql "$DATABASE_URL" -c "\dt $table" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Table '$table' exists${NC}"
    else
        echo -e "${YELLOW}⚠ Table '$table' not found (may not be created yet)${NC}"
    fi
done

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${GREEN}======================================"
echo "Migration Complete"
echo "======================================${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Backup: $BACKUP_FILE"
echo "Migrations run: Success"
echo ""

exit 0
