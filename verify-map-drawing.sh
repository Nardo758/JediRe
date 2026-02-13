#!/bin/bash

# Map Drawing Tools - Verification Script
# Checks that all components are properly installed

echo "🔍 Verifying Map Drawing Tools Installation..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check file exists
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} Found: $1"
  else
    echo -e "${RED}✗${NC} Missing: $1"
    ((ERRORS++))
  fi
}

# Function to check directory exists
check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} Found: $1"
  else
    echo -e "${RED}✗${NC} Missing: $1"
    ((ERRORS++))
  fi
}

# Function to check string in file
check_contains() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $3"
  else
    echo -e "${YELLOW}⚠${NC} Warning: $3"
    ((WARNINGS++))
  fi
}

echo "📁 Checking Backend Files..."
echo "----------------------------"
check_file "backend/src/database/migrations/007_create_map_annotations.sql"
check_file "backend/src/api/rest/mapAnnotations.routes.ts"
check_contains "backend/src/api/rest/index.ts" "mapAnnotationsRoutes" "Route registered in index.ts"

echo ""
echo "📁 Checking Frontend Files..."
echo "----------------------------"
check_file "frontend/src/services/mapAnnotations.service.ts"
check_file "frontend/src/components/map/MapDrawingTools.tsx"

echo ""
echo "📄 Checking Documentation..."
echo "----------------------------"
check_file "MAP_DRAWING_TOOLS_INTEGRATION.md"
check_file "MAP_DRAWING_QUICK_START.md"
check_file "MAP_DRAWING_COMPLETION_REPORT.md"
check_file "MAP_DRAWING_HANDOFF.md"

echo ""
echo "📦 Checking Dependencies..."
echo "----------------------------"
if [ -f "frontend/package.json" ]; then
  check_contains "frontend/package.json" "@mapbox/mapbox-gl-draw" "Mapbox GL Draw installed"
  check_contains "frontend/package.json" "mapbox-gl" "Mapbox GL installed"
  check_contains "frontend/package.json" "react-map-gl" "React Map GL installed"
else
  echo -e "${RED}✗${NC} frontend/package.json not found"
  ((ERRORS++))
fi

echo ""
echo "🔍 Checking Code Quality..."
echo "----------------------------"

# Check TypeScript types
if grep -q "interface MapAnnotation" "frontend/src/services/mapAnnotations.service.ts" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} TypeScript interfaces defined"
else
  echo -e "${YELLOW}⚠${NC} Warning: TypeScript interfaces may be missing"
  ((WARNINGS++))
fi

# Check API endpoints
if grep -q "router.get('/'," "backend/src/api/rest/mapAnnotations.routes.ts" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} API endpoints implemented"
else
  echo -e "${YELLOW}⚠${NC} Warning: API endpoints may be incomplete"
  ((WARNINGS++))
fi

# Check database table
if grep -q "CREATE TABLE.*user_map_annotations" "backend/src/database/migrations/007_create_map_annotations.sql" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Database migration looks good"
else
  echo -e "${YELLOW}⚠${NC} Warning: Database migration may be incomplete"
  ((WARNINGS++))
fi

echo ""
echo "================================"
echo "📊 Verification Summary"
echo "================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "🎉 Map Drawing Tools are ready to integrate!"
  echo ""
  echo "Next steps:"
  echo "1. Run database migration:"
  echo "   cd backend && psql -U postgres -d jedire_db -f src/database/migrations/007_create_map_annotations.sql"
  echo ""
  echo "2. Add to PipelineMapView (see MAP_DRAWING_QUICK_START.md)"
  echo "3. Add to AssetsMapView (see MAP_DRAWING_QUICK_START.md)"
  echo "4. Restart backend and test!"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
  echo "Installation may be incomplete. Please review warnings above."
  exit 1
else
  echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
  echo "Installation is incomplete. Please fix errors above."
  exit 2
fi
