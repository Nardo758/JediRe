#!/bin/bash

###############################################################################
# Database Migration Runner
# 
# Runs all pending database migrations on deployment.
# Safe to run multiple times (idempotent).
# 
# Usage:
#   ./scripts/run-migrations.sh
# 
# Environment Variables Required:
#   DATABASE_URL - PostgreSQL connection string
###############################################################################

set -e  # Exit on error

echo "🔄 Starting database migrations..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# Navigate to backend directory if not already there
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Check if migrations directory exists
if [ ! -d "migrations" ]; then
  echo "⚠️  No migrations directory found. Creating it..."
  mkdir -p migrations
fi

# Count migration files
MIGRATION_COUNT=$(find migrations -name "*.sql" 2>/dev/null | wc -l)
echo "📁 Found $MIGRATION_COUNT migration file(s)"

# If using a migration tool (e.g., node-pg-migrate, Drizzle, etc.)
# Uncomment and adjust the appropriate section below:

# Option 1: Using node-pg-migrate
# if command -v node-pg-migrate &> /dev/null; then
#   echo "Running migrations with node-pg-migrate..."
#   node-pg-migrate up
# fi

# Option 2: Using Drizzle ORM
# if [ -f "drizzle.config.ts" ]; then
#   echo "Running migrations with Drizzle..."
#   npm run db:migrate
# fi

# Option 3: Raw SQL migrations
echo "Running raw SQL migrations..."

# Create migrations tracking table if it doesn't exist
psql "$DATABASE_URL" <<-EOSQL
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW()
  );
EOSQL

# Run each migration file in order
for migration_file in $(ls -1 migrations/*.sql 2>/dev/null | sort); do
  MIGRATION_NAME=$(basename "$migration_file")
  
  # Check if migration has already been applied
  APPLIED=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM schema_migrations WHERE version = '$MIGRATION_NAME'")
  
  if [ "$APPLIED" -eq 0 ]; then
    echo "  ▶️  Applying migration: $MIGRATION_NAME"
    psql "$DATABASE_URL" -f "$migration_file"
    psql "$DATABASE_URL" -c "INSERT INTO schema_migrations (version) VALUES ('$MIGRATION_NAME')"
    echo "  ✅ Migration applied: $MIGRATION_NAME"
  else
    echo "  ⏭️  Skipping (already applied): $MIGRATION_NAME"
  fi
done

echo "✅ All migrations completed successfully!"
echo ""
echo "Migration status:"
psql "$DATABASE_URL" -c "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;"

exit 0
