#!/bin/bash
# Re-apply Fix 1 (<T> restoration) and Fix 3 (ExtractedFieldSources repoint)

cd ~/workspace/backend

# === Fix 1: Restore <T> to renamed interfaces ===
echo "Fix 1: Restoring generic parameters..."

# TrafficCoefficientCascade
sed -i 's/export interface TrafficCoefficientCascade$/export interface TrafficCoefficientCascade<T = number>/' src/types/traffic-calibration.types.ts

# ExtractedFieldSources
sed -i 's/export interface ExtractedFieldSources$/export interface ExtractedFieldSources<T = number>/' src/services/document-extraction/types.ts

# StrategyLayeredValue (fix doubled name if present, add <T>)
sed -i 's/export interface StrategyStrategyLayeredValue/export interface StrategyLayeredValue/' src/services/m08-strategies.service.ts
sed -i 's/export interface StrategyLayeredValue$/export interface StrategyLayeredValue<T = number>/' src/services/m08-strategies.service.ts

# InflationCostValue
sed -i 's/export interface InflationCostValue<T>$/export interface InflationCostValue<T = number>/' src/services/inflation/replacement-cost-v2.service.ts

echo "Fix 1 complete."

# === Fix 3: Repoint proforma-seeder and bridge to ExtractedFieldSources ===
echo "Fix 3: Repointing proforma files to ExtractedFieldSources..."

# proforma-seeder.service.ts
sed -i "s|import type { LayeredValue } from .*document-extraction/types.*|import type { ExtractedFieldSources } from './document-extraction/types';|" src/services/proforma-seeder.service.ts
sed -i 's/LayeredValue</ExtractedFieldSources</g' src/services/proforma-seeder.service.ts

# proforma-assumptions-bridge.ts
sed -i "s|import type { LayeredValue } from .*document-extraction/types.*|import type { ExtractedFieldSources } from '../document-extraction/types';|" src/services/deterministic/proforma-assumptions-bridge.ts
sed -i 's/LayeredValue</ExtractedFieldSources</g' src/services/deterministic/proforma-assumptions-bridge.ts

echo "Fix 3 complete."

# === Verify build ===
echo "Running tsc..."
npx tsc --noEmit --skipLibCheck 2>&1 | tee /tmp/tsc-after-fix.txt
echo "Residual W1-6b errors: $(grep -c 'error TS' /tmp/tsc-after-fix.txt)"
