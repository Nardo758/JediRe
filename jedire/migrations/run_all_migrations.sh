#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

echo "Running all migrations..."

for migration in \
  001_core_extensions.sql \
  002_core_tables.sql \
  003_zoning_agent.sql \
  004_supply_demand_agents.sql \
  005_price_agent.sql \
  006_news_event_agents.sql \
  007_cashflow_financial_agents.sql \
  008_development_network_agents.sql \
  009_collaboration_analytics.sql \
  010_indexes_views_functions.sql \
  011_llm_integration.sql \
  012_microsoft_integration.sql \
  013_multi_map_system.sql \
  014_account_structure.sql \
  015_user_preferences.sql \
  016_collaboration_proposals.sql \
  025_proforma_adjustments.sql \
  031_event_bus.sql \
  032_rent_scraper_tables.sql
do
  echo "  Running $migration..."
  psql "$DATABASE_URL" -f "$SCRIPT_DIR/$migration" 2>&1 || echo "  WARNING: $migration had errors (may already exist)"
done

echo "All migrations complete."
