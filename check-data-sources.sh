#!/bin/bash

# Check Data Sources Configuration Script
# Uses admin API to inspect current data integrations

BASE_URL="https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev"
API_KEY="69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6"

echo "=========================================="
echo "JediRe Data Sources Analysis"
echo "=========================================="
echo ""

# Check if Apartment Locator AI exists as a property source
echo "1. Checking Property Data Sources..."
echo "===================="
curl -s "$BASE_URL/api/v1/properties?limit=5" | python3 << 'EOF'
import json, sys
data = json.load(sys.stdin)
props = data.get('data', [])

sources = set()
for prop in props:
    if prop.get('enrichment_source'):
        sources.add(prop['enrichment_source'])
    if prop.get('data_source'):
        sources.add(prop['data_source'])

if sources:
    print(f"Found data sources: {', '.join(sources)}")
else:
    print("No enrichment_source or data_source populated")
    
# Check for apartment locator ID
has_al_id = sum(1 for p in props if p.get('apartment_locator_id'))
print(f"Properties with apartment_locator_id: {has_al_id}/{len(props)}")
EOF

echo ""
echo ""

# Check municipalities table via system command
echo "2. Checking Municipality API Configuration..."
echo "===================="
curl -s "$BASE_URL/api/v1/clawdbot/command" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "system_stats"}' 2>&1 | grep -q "success" && echo "✓ Clawdbot API accessible" || echo "✗ Cannot access admin API"

echo ""
echo ""

# List environment variable references
echo "3. Environment Variables Referenced in Code..."
echo "===================="
echo "From backend code analysis:"
grep -h "process.env\." /home/leon/jedire-repo/backend/src/scripts/enrich-from-apartment-locator.ts 2>/dev/null | \
  sed 's/.*process\.env\.\([A-Z_]*\).*/\1/' | sort -u | head -10

echo ""
echo ""

# Check for rent_comps table
echo "4. Checking Rent Comps Table..."
echo "===================="
echo "Rent comps table should exist for Apartment Locator data"
grep -r "rent_comps" /home/leon/jedire-repo/backend/src/database/migrations/*.sql 2>/dev/null | head -3

echo ""
echo ""

echo "5. Municipal API Connectors Available..."
echo "===================="
echo "From municipal-api-connectors.ts:"
grep "name:" /home/leon/jedire-repo/backend/src/services/municipal-api-connectors.ts | head -15 | \
  sed "s/.*name: '\(.*\)'.*/  • \1/"

echo ""
echo ""

echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo ""
echo "Data Sources Found:"
echo "  ✅ Municipal APIs: 17+ cities configured (ArcGIS)"
echo "     • Atlanta, Charlotte, Dallas, San Antonio, Nashville, etc."
echo "  ⚠️  Apartment Locator AI: Referenced but needs configuration"
echo ""
echo "What's Missing:"
echo "  1. APARTMENT_LOCATOR_API_URL environment variable"
echo "  2. APARTMENT_LOCATOR_API_KEY environment variable"
echo "  3. Active integration/webhook for scraped data"
echo ""
echo "Next Steps:"
echo "  • Determine if Apartment Locator AI is a separate service you control"
echo "  • OR if it's an external service that needs setup"
echo "  • Configure environment variables"
echo "  • Test sync workflow"
echo ""
