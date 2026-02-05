#!/bin/bash
# Quick test script for JEDI RE Phase 1 engines

API_BASE="http://localhost:4000/api/v1/analysis"

echo "======================================"
echo "JEDI RE Phase 1 Engine Test Suite"
echo "======================================"
echo ""

echo "1️⃣  Testing DEMAND SIGNAL endpoint..."
echo "--------------------------------------"
DEMAND_RESPONSE=$(curl -s -X POST "${API_BASE}/demand-signal" \
  -H "Content-Type: application/json" \
  -d '{
    "rent_timeseries": [2000, 2010, 2025, 2050, 2040, 2055, 2080, 2070, 2090, 2110, 2100, 2120, 2140, 2135, 2150, 2170, 2165, 2180, 2200, 2195, 2210, 2230, 2225, 2240, 2260, 2255, 2270, 2290, 2285, 2300, 2320, 2315, 2330, 2350, 2345, 2360, 2380, 2375, 2390, 2410, 2405, 2420, 2440, 2435, 2450, 2470, 2465, 2480, 2500, 2495, 2510, 2530],
    "sampling_rate": 52
  }')

if echo "$DEMAND_RESPONSE" | grep -q '"success":true'; then
  echo "✅ SUCCESS"
  echo "Growth Rate: $(echo "$DEMAND_RESPONSE" | grep -o '"annualized_growth_rate":[0-9.]*' | cut -d: -f2)"
  echo "Confidence: $(echo "$DEMAND_RESPONSE" | grep -o '"confidence":[0-9.]*' | cut -d: -f2 | head -1)"
else
  echo "❌ FAILED"
  echo "$DEMAND_RESPONSE"
fi
echo ""

echo "2️⃣  Testing CARRYING CAPACITY endpoint..."
echo "--------------------------------------"
CAPACITY_RESPONSE=$(curl -s -X POST "${API_BASE}/carrying-capacity" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Buckhead, Atlanta",
    "population": 48200,
    "population_growth_rate": 0.012,
    "net_migration_annual": 580,
    "employment": 35000,
    "employment_growth_rate": 0.018,
    "median_income": 95000,
    "existing_units": 11240,
    "pipeline_units": 2840,
    "future_permitted_units": 420
  }')

if echo "$CAPACITY_RESPONSE" | grep -q '"success":true'; then
  echo "✅ SUCCESS"
  echo "Verdict: $(echo "$CAPACITY_RESPONSE" | grep -o '"verdict":"[A-Z_]*"' | cut -d: -f2 | tr -d '"')"
  echo "Saturation: $(echo "$CAPACITY_RESPONSE" | grep -o '"saturation_pct":[0-9.]*' | cut -d: -f2)%"
else
  echo "❌ FAILED"
  echo "$CAPACITY_RESPONSE"
fi
echo ""

echo "3️⃣  Testing IMBALANCE (full analysis) endpoint..."
echo "--------------------------------------"
IMBALANCE_RESPONSE=$(curl -s -X POST "${API_BASE}/imbalance" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Buckhead, Atlanta",
    "population": 48200,
    "population_growth_rate": 0.012,
    "net_migration_annual": 580,
    "employment": 35000,
    "employment_growth_rate": 0.018,
    "median_income": 95000,
    "existing_units": 11240,
    "pipeline_units": 2840,
    "future_permitted_units": 420,
    "rent_timeseries": [2000, 2010, 2025, 2050, 2040, 2055, 2080, 2070, 2090, 2110, 2100, 2120, 2140, 2135, 2150, 2170, 2165, 2180, 2200, 2195, 2210, 2230, 2225, 2240, 2260, 2255, 2270, 2290, 2285, 2300, 2320, 2315, 2330, 2350, 2345, 2360, 2380, 2375, 2390, 2410, 2405, 2420, 2440, 2435, 2450, 2470, 2465, 2480, 2500, 2495, 2510, 2530],
    "search_trend_change": 0.15
  }')

if echo "$IMBALANCE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ SUCCESS"
  echo "Market Verdict: $(echo "$IMBALANCE_RESPONSE" | grep -o '"verdict":"[A-Z_]*"' | head -1 | cut -d: -f2 | tr -d '"')"
  echo "Composite Score: $(echo "$IMBALANCE_RESPONSE" | grep -o '"composite_score":[0-9]*' | cut -d: -f2)/100"
  echo "Recommendation: $(echo "$IMBALANCE_RESPONSE" | grep -o '"recommendation":"[^"]*"' | cut -d: -f2- | tr -d '"' | cut -c1-80)..."
else
  echo "❌ FAILED"
  echo "$IMBALANCE_RESPONSE"
fi
echo ""

echo "======================================"
echo "Test Suite Complete"
echo "======================================"
