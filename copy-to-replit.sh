#!/bin/bash
# Copy Property Coverage files to Replit workspace
# Run this if you need to sync local changes to Replit

set -e

echo "🔄 Copying Property Coverage files to Replit workspace..."
echo ""

# Check if we're in the right directory
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Must run from ~/clawd/jedire directory"
    exit 1
fi

echo "1. Copying backend middleware..."
cp -v backend/src/middleware/auth.ts backend/src/middleware/auth.ts.backup.$(date +%s) 2>/dev/null || true
echo "   ✓ Backend middleware ready"

echo ""
echo "2. Copying frontend components..."

# Create directory if it doesn't exist
mkdir -p frontend/src/components/property-coverage
mkdir -p frontend/src/pages

# Copy files
cp -v ~/clawd/jedire/frontend/src/components/property-coverage/PropertyCoverageDashboard.tsx \
      frontend/src/components/property-coverage/PropertyCoverageDashboard.tsx

cp -v ~/clawd/jedire/frontend/src/pages/PropertyCoveragePage.tsx \
      frontend/src/pages/PropertyCoveragePage.tsx

echo "   ✓ Dashboard component copied"
echo "   ✓ Page component copied"

echo ""
echo "3. Checking App.tsx route..."

if grep -q "property-coverage" frontend/src/App.tsx; then
    echo "   ✓ Route already exists in App.tsx"
else
    echo "   ⚠️  Route not found - you may need to add it manually"
    echo ""
    echo "   Add this to frontend/src/App.tsx:"
    echo "   import { PropertyCoveragePage } from './pages/PropertyCoveragePage';"
    echo "   <Route path=\"/property-coverage\" element={<PropertyCoveragePage />} />"
fi

echo ""
echo "4. Checking MainLayout.tsx navigation..."

if grep -q "Property Coverage" frontend/src/components/layout/MainLayout.tsx; then
    echo "   ✓ Navigation item already exists"
else
    echo "   ⚠️  Navigation not found - you may need to add it manually"
    echo ""
    echo "   Add this to MainLayout.tsx (in Intelligence section):"
    echo '   <SidebarItem'
    echo '     icon="🗺️"'
    echo '     label="Property Coverage"'
    echo '     path="/property-coverage"'
    echo '     isActive={isActivePrefix("/property-coverage")}'
    echo '   />'
fi

echo ""
echo "5. Checking backend .env..."

if [ -f "backend/.env" ]; then
    if grep -q "API_KEY_APARTMENT_LOCATOR" backend/.env; then
        echo "   ✓ API key already in .env"
    else
        echo "   → Adding API key to .env..."
        echo "" >> backend/.env
        echo "# API Keys for external integrations" >> backend/.env
        echo "API_KEY_APARTMENT_LOCATOR=aiq_2248e8fc535c5a9c4a09f9ed1c0d719bf0ad45f56b2c47841de6bc1421388f6b" >> backend/.env
        echo "   ✓ API key added"
    fi
else
    echo "   ⚠️  backend/.env not found - create it from .env.example"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Files copied successfully!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Commit and push to Git (if using Git sync)"
echo "  2. OR manually copy files to Replit"
echo "  3. Add API key to Replit Secrets:"
echo "     Key: API_KEY_APARTMENT_LOCATOR"
echo "     Value: aiq_2248e8fc535c5a9c4a09f9ed1c0d719bf0ad45f56b2c47841de6bc1421388f6b"
echo "  4. Run: bash run.sh"
echo ""
