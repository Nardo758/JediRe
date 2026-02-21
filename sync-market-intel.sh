#!/bin/bash
# Sync Market Intelligence files to Replit
# Run this in Replit shell

REPO="https://raw.githubusercontent.com/Nardo758/JediRe/market-intelligence-phase1"

echo "Creating directories..."
mkdir -p frontend/src/pages/MarketIntelligence/tabs
mkdir -p frontend/src/components/MarketIntelligence
mkdir -p frontend/src/types
mkdir -p frontend/src/mock

echo "Downloading Market Intelligence pages..."
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/MarketIntelligencePage.tsx" -o frontend/src/pages/MarketIntelligence/MarketIntelligencePage.tsx
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/MyMarketsDashboard.tsx" -o frontend/src/pages/MarketIntelligence/MyMarketsDashboard.tsx
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/CompareMarketsPage.tsx" -o frontend/src/pages/MarketIntelligence/CompareMarketsPage.tsx
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/ActiveOwnersPage.tsx" -o frontend/src/pages/MarketIntelligence/ActiveOwnersPage.tsx
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/FutureSupplyPage.tsx" -o frontend/src/pages/MarketIntelligence/FutureSupplyPage.tsx

echo "Downloading tabs..."
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/tabs/OverviewTab.tsx" -o frontend/src/pages/MarketIntelligence/tabs/OverviewTab.tsx
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/tabs/MarketDataTab.tsx" -o frontend/src/pages/MarketIntelligence/tabs/MarketDataTab.tsx
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/tabs/SubmarketsTab.tsx" -o frontend/src/pages/MarketIntelligence/tabs/SubmarketsTab.tsx
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/tabs/TrendsTab.tsx" -o frontend/src/pages/MarketIntelligence/tabs/TrendsTab.tsx
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/tabs/DealsTab.tsx" -o frontend/src/pages/MarketIntelligence/tabs/DealsTab.tsx

echo "Downloading components..."
curl -sf "$REPO/frontend/src/components/MarketIntelligence/PropertyIntelligenceModal.tsx" -o frontend/src/components/MarketIntelligence/PropertyIntelligenceModal.tsx
curl -sf "$REPO/frontend/src/components/MarketIntelligence/DataSourceIndicator.tsx" -o frontend/src/components/MarketIntelligence/DataSourceIndicator.tsx

echo "Downloading types and mock data..."
curl -sf "$REPO/frontend/src/types/marketIntelligence.types.ts" -o frontend/src/types/marketIntelligence.types.ts
curl -sf "$REPO/frontend/src/mock/mockPropertyIntelligence.ts" -o frontend/src/mock/mockPropertyIntelligence.ts

echo "Downloading index files..."
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/index.ts" -o frontend/src/pages/MarketIntelligence/index.ts
curl -sf "$REPO/frontend/src/pages/MarketIntelligence/tabs/index.ts" -o frontend/src/pages/MarketIntelligence/tabs/index.ts

echo "✅ Done! Files synced."
echo "Next: Add routes to App.tsx (see WIRING_GUIDE.md)"
