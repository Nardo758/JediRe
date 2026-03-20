#!/usr/bin/env bash
# ============================================================
# JediRe Smoke Test Phase 2 — Zoning / Property / Design Routes
# Routes covered:
#   zoning-analyze (zoningAnalyzeRouter → /api/v1)
#   building-envelope (buildingEnvelopeRoutes → /api/v1)
#   property-proxy (propertyProxyRoutes → /api/v1)
#   property-metrics (createPropertyMetricsRouter → /api/v1/property-metrics)
#   property-scoring (createPropertyScoringRouter → /api/v1/property-scoring)
#   zoning-capacity (zoningCapacityRouter → /api/v1)
#   zoning-intelligence (createZoningIntelligenceRoutes → /api/v1/zoning-intelligence)
#   zoning-learning (createZoningLearningRoutes → /api/v1/zoning-learning)
#   zoning-triangulation (zoningTriangulationRouter → /api/v1)
#   zoning-verification (zoningVerificationRouter → /api/v1/zoning-verification)
#   zoning-profile (zoningProfileRouter → /api/v1)
#   development-scenarios (developmentScenariosRouter → /api/v1)
#   entitlement (entitlementRouter → /api/v1/entitlements)
#   property-boundary (propertyBoundaryRouter → /api/v1)
#   design-references (designReferencesRouter → /api/v1/design-references)
#   ai-rendering (NOT mounted → expect 404)
#   building-design-3d (NOT mounted → expect 404)
#   design-assistant (NOT mounted → expect 404)
#   municode (municodeRouter → /api/v1/municode)
#   neighboring-properties (neighboringPropertiesRoutes → /api/v1/properties)
#   regulatory-alerts (regulatoryAlertRouter → /api/v1/regulatory-alerts)
#   site-intelligence (siteIntelligenceRouter → /api/v1)
# ============================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
DEAL_ID="${DEAL_ID:-12eb9e11-3b2d-44d5-9f59-877a76344c18}"
PROP_ID="${PROP_ID:-750a68ce-d0cf-4d3e-b184-82335a774b9c}"
MUNI_ID="${MUNI_ID:-montgomery-al}"
ZONE_DIST_ID="${ZONE_DIST_ID:-f3a91101-29f1-4057-b360-54aa78a9c824}"
DISTRICT_CODE="${DISTRICT_CODE:-CP}"
DESIGN_REF_ID="${DESIGN_REF_ID:-00bc469c-44ae-404f-bad6-b50ecf9dd8f3}"
USER_ID="${USER_ID:-6253ba3f-d40d-4597-86ab-270c8397a857}"
JWT_SECRET="${JWT_SECRET:-your-secret-key-change-this}"
REPORT_OUT="${REPORT_OUT:-$(dirname "$0")/smoke-results-zoning.txt}"
TIMEOUT="${TIMEOUT:-8}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0; WARN=0; FAIL=0; TOTAL=0
FAIL_LIST=()

TOKEN=$(cd "$BACKEND_DIR" && node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign(
  { userId: '$USER_ID', email: 'demo@jedire.com', role: 'investor' },
  '$JWT_SECRET',
  { expiresIn: '1h', algorithm: 'HS256', issuer: 'jedire-api', audience: 'jedire-client' }
));
" 2>/dev/null)

ADMIN_TOKEN=$(cd "$BACKEND_DIR" && node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign(
  { userId: '$USER_ID', email: 'admin@jedire.com', role: 'admin' },
  '$JWT_SECRET',
  { expiresIn: '1h', algorithm: 'HS256', issuer: 'jedire-api', audience: 'jedire-client' }
));
" 2>/dev/null)

if [ -z "$TOKEN" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: Could not generate JWT tokens (is jsonwebtoken installed?)"
  exit 1
fi

echo "============================================================"
echo " JediRe Zoning/Property/Design Smoke Test (Phase 2)"
echo " BASE_URL : $BASE_URL"
echo " DEAL_ID  : $DEAL_ID"
echo " PROP_ID  : $PROP_ID"
echo " MUNI_ID  : $MUNI_ID"
echo " REPORT   : $REPORT_OUT"
echo "============================================================"
echo ""

RESULTS_BUF=""

hit() {
  local method="$1"
  local path="$2"
  local auth="${3:-jwt}"
  local body="${4:-}"
  local label status

  TOTAL=$((TOTAL+1))

  local curl_args=(-s -o /dev/null -w "%{http_code}" -X "$method" --max-time "$TIMEOUT")
  [ -n "$body" ] && curl_args+=(-H 'Content-Type: application/json' -d "$body")

  case "$auth" in
    jwt)    curl_args+=(-H "Authorization: Bearer $TOKEN") ;;
    admin)  curl_args+=(-H "Authorization: Bearer $ADMIN_TOKEN") ;;
    apikey) curl_args+=(-H "x-api-key: test-admin-key-smoke") ;;
    none)   ;;
  esac

  status=$(curl "${curl_args[@]}" "$BASE_URL$path" 2>/dev/null || echo "000")

  if   [[ "$status" =~ ^[23] ]]; then label="PASS"; PASS=$((PASS+1))
  elif [[ "$status" =~ ^5    ]]; then label="FAIL"; FAIL=$((FAIL+1)); FAIL_LIST+=("$label $status $method $path")
  else                                label="WARN"; WARN=$((WARN+1))
  fi

  local line
  line=$(printf "%-4s %3s  %-6s %s" "$label" "$status" "$method" "$path")
  echo "$line"
  RESULTS_BUF="${RESULTS_BUF}${line}"$'\n'
}

section() {
  local hdr="── $1 ──"
  echo ""
  echo "$hdr"
  RESULTS_BUF="${RESULTS_BUF}"$'\n'"${hdr}"$'\n'
}

# ============================================================
# INLINE ZONING ANALYZE (zoningAnalyzeRouter → /api/v1)
# Routes: /geocode, /zoning/lookup, /zoning/districts/:muni, /analyze
# ============================================================
section "INLINE ZONING ANALYZE"
hit GET  "/api/v1/geocode?address=123+Main+St+Atlanta+GA"          none
hit GET  "/api/v1/zoning/lookup?address=123+Main+St+Atlanta+GA"    none
hit GET  "/api/v1/zoning/districts/atlanta-ga"                     none
hit POST "/api/v1/analyze"                                         none '{"address":"123 Main St Atlanta GA"}'

# ============================================================
# BUILDING ENVELOPE (buildingEnvelopeRoutes → /api/v1)
# Routes: POST /deals/:id/building-envelope, GET /property-type-configs
# Note: POST requires property_boundaries row with parcel_area_sf, or explicit landArea
# ============================================================
section "BUILDING ENVELOPE"
hit GET  "/api/v1/property-type-configs"                           jwt
hit POST "/api/v1/deals/$DEAL_ID/building-envelope"               jwt '{"propertyType":"multifamily","landArea":50000,"setbacks":{"front":20,"side":5,"rear":20},"maxFAR":3,"maxHeight":65,"maxStories":5}'

# ============================================================
# PROPERTY PROXY (propertyProxyRoutes → /api/v1)
# Routes hit external Cloudflare Worker — may timeout/500; treat 5xx as WARN-level
# ============================================================
section "PROPERTY PROXY (external worker — 5xx expected if worker down)"
hit GET  "/api/v1/properties/health"     none
hit GET  "/api/v1/properties/api-health" none
hit POST "/api/v1/properties/scrape"     none '{"address":"123 Main St Atlanta GA","county":"Fulton"}'

# ============================================================
# PROPERTY METRICS (createPropertyMetricsRouter → /api/v1/property-metrics)
# ============================================================
section "PROPERTY METRICS"
hit GET  "/api/v1/property-metrics/property/$PROP_ID/metrics"    jwt
hit GET  "/api/v1/property-metrics/property/$PROP_ID/density"    jwt
hit GET  "/api/v1/property-metrics/neighborhoods/benchmarks"     jwt
hit GET  "/api/v1/property-metrics/submarkets/comparison"        jwt
hit GET  "/api/v1/property-metrics/owners/top"                   jwt
hit GET  "/api/v1/property-metrics/owners/search?q=Smith"       jwt
hit GET  "/api/v1/property-metrics/rent-comps"                   jwt
hit GET  "/api/v1/property-metrics/rent-comps/summary"           jwt

# ============================================================
# PROPERTY SCORING (createPropertyScoringRouter → /api/v1/property-scoring)
# ============================================================
section "PROPERTY SCORING"
hit GET  "/api/v1/property-scoring/seller-propensity"   jwt
hit GET  "/api/v1/property-scoring/value-add"           jwt
hit GET  "/api/v1/property-scoring/hidden-gems"         jwt
hit GET  "/api/v1/property-scoring/cap-rates"           jwt
hit GET  "/api/v1/property-scoring/tax-burden"          jwt
hit GET  "/api/v1/property-scoring/supply-intelligence" jwt
hit GET  "/api/v1/property-scoring/design-inputs"       jwt

# ============================================================
# ZONING CAPACITY (zoningCapacityRouter → /api/v1)
# ============================================================
section "ZONING CAPACITY — Deal"
hit GET  "/api/v1/deals/$DEAL_ID/zoning-capacity"             jwt
hit POST "/api/v1/deals/$DEAL_ID/zoning-capacity"             jwt '{"zoning_code":"R-4","max_far":2.5,"max_height_feet":55,"max_stories":5}'
hit POST "/api/v1/deals/$DEAL_ID/zoning-capacity/auto-fill"   jwt '{}'
hit DELETE "/api/v1/deals/$DEAL_ID/zoning-capacity"           jwt

section "ZONING CAPACITY — Districts"
hit GET  "/api/v1/zoning-districts/lookup?municipality=atlanta&state=GA" jwt
hit GET  "/api/v1/zoning-districts/by-code?code=R-4&municipality=atlanta" jwt
hit GET  "/api/v1/zoning-districts/$ZONE_DIST_ID/rezone-history"         jwt
hit GET  "/api/v1/zoning-districts/$ZONE_DIST_ID"                        jwt
hit GET  "/api/v1/zoning-districts/$ZONE_DIST_ID/detail"                 jwt

section "ZONING CAPACITY — Municipalities"
hit GET  "/api/v1/municipalities"                   jwt
hit GET  "/api/v1/municipalities/$MUNI_ID"          jwt

section "ZONING CAPACITY — Lookup / Misc"
hit GET  "/api/v1/zoning/lookup?address=123+Main+St+Atlanta+GA"   jwt
hit GET  "/api/v1/zoning/parcel-lookup?parcelId=12345"            jwt
hit GET  "/api/v1/reverse-geocode?lat=33.7490&lng=-84.3880"       jwt
hit POST "/api/v1/zoning-capacity/reconcile"                      jwt '{"dealId":"'"$DEAL_ID"'"}'
hit POST "/api/v1/zoning-agent/retrieve"                          jwt '{"query":"setback requirements"}'

# ============================================================
# ZONING INTELLIGENCE (createZoningIntelligenceRoutes → /api/v1/zoning-intelligence)
# ============================================================
section "ZONING INTELLIGENCE"
hit GET  "/api/v1/zoning-intelligence/"                                           jwt
hit POST "/api/v1/zoning-intelligence/query"                                      jwt '{"query":"What is the FAR for R-4 in Atlanta?"}'
hit POST "/api/v1/zoning-intelligence/analyze"                                    jwt '{"dealId":"'"$DEAL_ID"'"}'
hit GET  "/api/v1/zoning-intelligence/resolve/$DEAL_ID"                           jwt
hit GET  "/api/v1/zoning-intelligence/constraints/$DEAL_ID"                       jwt
hit GET  "/api/v1/zoning-intelligence/profile/$DISTRICT_CODE/$MUNI_ID"           jwt
hit POST "/api/v1/zoning-intelligence/extract-profile"                            jwt '{"districtCode":"R-4","municipality":"atlanta"}'
hit POST "/api/v1/zoning-intelligence/use-check"                                  jwt '{"use":"multifamily","districtCode":"R-4","municipality":"atlanta"}'
hit POST "/api/v1/zoning-intelligence/parking-calc"                               jwt '{"units":100,"districtCode":"R-4","municipality":"atlanta"}'
hit GET  "/api/v1/zoning-intelligence/maturity/atlanta"                           jwt
hit GET  "/api/v1/zoning-intelligence/analyses"                                   jwt
hit GET  "/api/v1/zoning-intelligence/analyses/fake-analysis-id"                  jwt

# ============================================================
# ZONING LEARNING (createZoningLearningRoutes → /api/v1/zoning-learning)
# ============================================================
section "ZONING LEARNING"
hit POST "/api/v1/zoning-learning/corrections"                                    jwt '{"dealId":"'"$DEAL_ID"'","field":"max_far","correctedValue":2.5}'
hit GET  "/api/v1/zoning-learning/corrections"                                    jwt
hit POST "/api/v1/zoning-learning/corrections/fake-corr-id/resolve"               jwt '{"resolution":"accepted"}'
hit POST "/api/v1/zoning-learning/precedents"                                     jwt '{"municipality":"atlanta","districtCode":"R-4","outcome":"approved"}'
hit GET  "/api/v1/zoning-learning/precedents/search?municipality=atlanta"         jwt
hit GET  "/api/v1/zoning-learning/precedents/similar?dealId=$DEAL_ID"            jwt
hit GET  "/api/v1/zoning-learning/precedents/patterns"                            jwt
hit POST "/api/v1/zoning-learning/outcomes"                                       jwt '{"dealId":"'"$DEAL_ID"'","outcome":"approved"}'
hit GET  "/api/v1/zoning-learning/calibration/$MUNI_ID"                          jwt
hit GET  "/api/v1/zoning-learning/confidence/$MUNI_ID"                           jwt
hit GET  "/api/v1/zoning-learning/maturity"                                       jwt
hit GET  "/api/v1/zoning-learning/maturity/$MUNI_ID"                             jwt
hit GET  "/api/v1/zoning-learning/credibility/$USER_ID"                           jwt
hit PUT  "/api/v1/zoning-learning/credibility/$USER_ID/tier"                      jwt '{"tier":"expert"}'

# ============================================================
# ZONING VERIFICATION (zoningVerificationRouter → /api/v1/zoning-verification)
# ============================================================
section "ZONING VERIFICATION"
FAKE_VER_ID="00000000-0000-0000-0000-000000000099"
FAKE_JURI_ID="atlanta-ga"
hit POST "/api/v1/zoning-verification/verify"                                             jwt '{"dealId":"'"$DEAL_ID"'","districtCode":"R-4"}'
hit POST "/api/v1/zoning-verification/verify/$FAKE_VER_ID/confirm"                       jwt '{"confirmed":true}'
hit POST "/api/v1/zoning-verification/verify/$FAKE_VER_ID/flag"                          jwt '{"reason":"Incorrect FAR"}'
hit POST "/api/v1/zoning-verification/verify/$FAKE_VER_ID/correct"                       jwt '{"field":"max_far","correctedValue":3.0}'
hit GET  "/api/v1/zoning-verification/verify/deal/$DEAL_ID"                              jwt
hit GET  "/api/v1/zoning-verification/citations/$FAKE_JURI_ID/$DISTRICT_CODE"            jwt
hit GET  "/api/v1/zoning-verification/citations/$FAKE_JURI_ID"                           jwt
hit GET  "/api/v1/zoning-verification/sources/$FAKE_JURI_ID"                             jwt

# ============================================================
# ZONING TRIANGULATION (zoningTriangulationRouter → /api/v1)
# ============================================================
section "ZONING TRIANGULATION — Parcels"
hit POST "/api/v1/parcels/ingest/geojson"          jwt '{"type":"FeatureCollection","features":[]}'
hit POST "/api/v1/parcels/ingest/batch"            jwt '{"parcels":[]}'
hit GET  "/api/v1/parcels/stats"                   jwt
hit GET  "/api/v1/parcels/nearby?lat=33.749&lng=-84.388&radius=500" jwt
hit GET  "/api/v1/parcels/fake-parcel-id"          jwt

section "ZONING TRIANGULATION — Zoning"
hit POST "/api/v1/zoning/triangulate"                              jwt '{"dealId":"'"$DEAL_ID"'","address":"123 Main St Atlanta GA"}'
hit GET  "/api/v1/zoning/triangulation/$DEAL_ID"                   jwt
hit POST "/api/v1/zoning/triangulation/fake-tri-id/confirm"        jwt '{"confirmed":true}'
hit POST "/api/v1/zoning/outcome"                                  jwt '{"dealId":"'"$DEAL_ID"'","outcome":"approved"}'
hit POST "/api/v1/zoning/calibrate/atlanta"                        jwt '{}'
hit GET  "/api/v1/zoning/calibration"                              jwt
hit POST "/api/v1/zoning/chain/execute"                            jwt '{"dealId":"'"$DEAL_ID"'"}'
hit GET  "/api/v1/zoning/chain/$DEAL_ID"                           jwt
hit POST "/api/v1/zoning/recommendations/$DEAL_ID/analyze"         jwt '{}'
hit GET  "/api/v1/zoning/recommendations/$DEAL_ID"                 jwt

section "ZONING TRIANGULATION — Entitlements / Properties"
hit GET  "/api/v1/deals/$DEAL_ID/nearby-entitlements"              jwt
hit GET  "/api/v1/deals/$DEAL_ID/properties"                       jwt
hit POST "/api/v1/deals/$DEAL_ID/properties/$PROP_ID/link"         jwt '{}'
hit DELETE "/api/v1/deals/$DEAL_ID/properties/$PROP_ID"            jwt
hit POST "/api/v1/admin/deal-property-autolink"                    admin '{}'

# ============================================================
# ZONING PROFILE (zoningProfileRouter → /api/v1)
# ============================================================
section "ZONING PROFILE"
hit GET  "/api/v1/deals/$DEAL_ID/zoning-profile"                   jwt
hit POST "/api/v1/deals/$DEAL_ID/zoning-profile/resolve"           jwt '{}'
hit PUT  "/api/v1/deals/$DEAL_ID/zoning-profile/overrides"         jwt '{"max_far":3.0}'
hit POST "/api/v1/deals/$DEAL_ID/zoning-profile/overlays"          jwt '{"overlay":"floodplain"}'

# ============================================================
# DEVELOPMENT SCENARIOS (developmentScenariosRouter → /api/v1)
# ============================================================
section "DEVELOPMENT SCENARIOS"
hit GET  "/api/v1/deals/$DEAL_ID/scenarios/hbu"                    jwt
hit GET  "/api/v1/deals/$DEAL_ID/regulatory-risk-analysis"         jwt
hit GET  "/api/v1/deals/$DEAL_ID/timeline-intelligence"            jwt
hit GET  "/api/v1/deals/$DEAL_ID/scenarios/recommendations"        jwt
hit GET  "/api/v1/deals/$DEAL_ID/scenarios"                        jwt
hit GET  "/api/v1/deals/$DEAL_ID/scenarios/lookup-district?districtCode=R-4" jwt
hit POST "/api/v1/deals/$DEAL_ID/scenarios"                        jwt '{"name":"Smoke Scenario","strategy":"multifamily"}'
hit GET  "/api/v1/deals/$DEAL_ID/rezone-analysis"                  jwt
hit GET  "/api/v1/deals/$DEAL_ID/envelope-enrichment"              jwt
FAKE_SCEN_ID="00000000-0000-0000-0000-000000000098"
hit PUT  "/api/v1/deals/$DEAL_ID/scenarios/$FAKE_SCEN_ID"          jwt '{"name":"Updated"}'
hit PUT  "/api/v1/deals/$DEAL_ID/scenarios/$FAKE_SCEN_ID/sync"     jwt '{}'
hit POST "/api/v1/deals/$DEAL_ID/scenarios/deactivate-all"         jwt '{}'
hit PUT  "/api/v1/deals/$DEAL_ID/scenarios/$FAKE_SCEN_ID/activate" jwt '{}'
hit DELETE "/api/v1/deals/$DEAL_ID/scenarios/$FAKE_SCEN_ID"        jwt

# ============================================================
# ENTITLEMENTS (entitlementRouter → /api/v1/entitlements)
# ============================================================
section "ENTITLEMENTS"
FAKE_ENT_ID="00000000-0000-0000-0000-000000000097"
FAKE_MILE_ID="00000000-0000-0000-0000-000000000096"
hit GET  "/api/v1/entitlements"                                     jwt
hit GET  "/api/v1/entitlements/kanban"                              jwt
hit GET  "/api/v1/entitlements/deal/$DEAL_ID"                      jwt
hit GET  "/api/v1/entitlements/$FAKE_ENT_ID"                       jwt
hit GET  "/api/v1/entitlements/$FAKE_ENT_ID/risk-factors"          jwt
hit POST "/api/v1/entitlements"                                     jwt '{"deal_id":"'"$DEAL_ID"'","path":"by-right","title":"Smoke Entitlement"}'
hit PATCH "/api/v1/entitlements/$FAKE_ENT_ID"                      jwt '{"status":"in_progress"}'
hit DELETE "/api/v1/entitlements/$FAKE_ENT_ID"                     jwt
hit POST  "/api/v1/entitlements/$FAKE_ENT_ID/milestones"           jwt '{"title":"Submit Application","due_date":"2026-06-01"}'
hit PATCH "/api/v1/entitlements/milestones/$FAKE_MILE_ID"          jwt '{"status":"completed"}'
hit POST  "/api/v1/entitlements/sync/path-selected"                jwt '{"dealId":"'"$DEAL_ID"'","path":"by-right"}'
hit POST  "/api/v1/entitlements/sync/status-changed"               jwt '{"dealId":"'"$DEAL_ID"'","status":"approved"}'
hit GET   "/api/v1/entitlements/sync/milestone-template/by-right"  jwt

# ============================================================
# PROPERTY BOUNDARY (propertyBoundaryRouter → /api/v1)
# ============================================================
section "PROPERTY BOUNDARY"
hit GET  "/api/v1/deals/$DEAL_ID/boundary"                         jwt
hit POST "/api/v1/deals/$DEAL_ID/boundary"                         jwt '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}'
hit DELETE "/api/v1/deals/$DEAL_ID/boundary"                       jwt
hit GET  "/api/v1/deals/$DEAL_ID/boundary/export"                  jwt
hit GET  "/api/v1/deals/$DEAL_ID/development-capacity"             jwt
hit POST "/api/v1/deals/$DEAL_ID/zoning-confirmation"              jwt '{"districtCode":"R-4","municipalityId":"'"$MUNI_ID"'"}'
hit GET  "/api/v1/deals/$DEAL_ID/zoning-confirmation"              jwt

# ============================================================
# SITE INTELLIGENCE (siteIntelligenceRouter → /api/v1)
# ============================================================
section "SITE INTELLIGENCE"
hit GET  "/api/v1/deals/$DEAL_ID/site-intelligence"                jwt
hit POST "/api/v1/deals/$DEAL_ID/site-intelligence"                jwt '{"environmental":{"soilType":"clay","score":75},"infrastructure":{"waterCapacity":"adequate","score":80}}'

# ============================================================
# DESIGN REFERENCES (designReferencesRouter → /api/v1/design-references)
# ============================================================
section "DESIGN REFERENCES"
hit GET  "/api/v1/design-references/file/fake-filename.jpg"                      jwt
hit GET  "/api/v1/design-references/$DEAL_ID"                                    jwt
hit GET  "/api/v1/design-references/$DEAL_ID/$DESIGN_REF_ID"                    jwt
hit PUT  "/api/v1/design-references/$DEAL_ID/$DESIGN_REF_ID"                    jwt '{"category":"facade","notes":"updated"}'
hit DELETE "/api/v1/design-references/$DEAL_ID/00000000-0000-0000-0000-000000000099" jwt
hit POST   "/api/v1/design-references/$DEAL_ID/00000000-0000-0000-0000-000000000099/analyze" jwt '{}'

# ============================================================
# REGULATORY ALERTS (regulatoryAlertRouter → /api/v1/regulatory-alerts)
# ============================================================
section "REGULATORY ALERTS"
FAKE_ALERT_ID="00000000-0000-0000-0000-000000000095"
hit GET  "/api/v1/regulatory-alerts"                                              jwt
hit GET  "/api/v1/regulatory-alerts/municipality/atlanta?state=GA"               jwt
hit GET  "/api/v1/regulatory-alerts/strategy-matrix?municipality=atlanta&state=GA" jwt
hit GET  "/api/v1/regulatory-alerts/categories"                                   jwt
hit GET  "/api/v1/regulatory-alerts/$FAKE_ALERT_ID"                              jwt
hit POST "/api/v1/regulatory-alerts"                                              jwt '{"municipality":"atlanta","state":"GA","category":"zoning","title":"Smoke Alert"}'
hit PATCH "/api/v1/regulatory-alerts/$FAKE_ALERT_ID/deactivate"                  jwt '{}'
hit POST  "/api/v1/regulatory-alerts/score-risk"                                  jwt '{"dealId":"'"$DEAL_ID"'","categories":["zoning","environmental"]}'

# ============================================================
# MUNICODE (municodeRouter → /api/v1/municode)
# ============================================================
section "MUNICODE"
hit GET  "/api/v1/municode/resolve?municipality=atlanta&section=16-18"            jwt
hit GET  "/api/v1/municode/district/$MUNI_ID/$DISTRICT_CODE"                     jwt
hit GET  "/api/v1/municode/sections/$MUNI_ID"                                    jwt
hit GET  "/api/v1/municode/chapter/$MUNI_ID"                                     jwt

# ============================================================
# NEIGHBORING PROPERTIES (neighboringPropertiesRoutes → /api/v1/properties)
# Note: requireAuth — parcel lookup may return 404 if parcel not in DB
# ============================================================
section "NEIGHBORING PROPERTIES"
hit GET  "/api/v1/properties/$PROP_ID/neighbors"                                  jwt
hit GET  "/api/v1/properties/$PROP_ID/neighbors?includeNearby=true"              jwt
hit GET  "/api/v1/properties/$PROP_ID/neighbors/fake-neighbor-id"                jwt
hit GET  "/api/v1/properties/$PROP_ID/assemblage-scenarios"                       jwt
hit POST "/api/v1/properties/$PROP_ID/neighbors/ai-analysis"                      jwt '{"type":"owner-disposition"}'

# ============================================================
# AI-RENDERING / BUILDING-DESIGN-3D / DESIGN-ASSISTANT
# These are NOT mounted in index.replit.ts — expect 404
# ============================================================
section "AI RENDERING (not mounted — expect 404)"
hit GET  "/api/v1/ai/render/styles"  none
hit GET  "/api/v1/ai/render/status"  none
hit POST "/api/v1/ai/render"         jwt '{"imageBase64":"abc","style":"modern-glass"}'

section "BUILDING DESIGN 3D (not mounted — expect 404)"
hit GET  "/api/v1/deals/$DEAL_ID/design-3d"  jwt
hit POST "/api/v1/deals/$DEAL_ID/design-3d"  jwt '{"buildingSections":[]}'

section "DESIGN ASSISTANT (not mounted — expect 404)"
hit GET  "/api/v1/design-assistant/status"  none
hit POST "/api/v1/design-assistant/chat"    jwt '{"userPrompt":"Add a floor","currentDesign":{}}'

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "============================================================"
echo " RESULTS: PASS=$PASS  WARN=$WARN  FAIL=$FAIL  TOTAL=$TOTAL"
echo "============================================================"

if [ ${#FAIL_LIST[@]} -gt 0 ]; then
  echo ""
  echo "FAILURES (5xx errors):"
  for f in "${FAIL_LIST[@]}"; do
    echo "  $f"
  done
fi

echo ""
echo "Legend: PASS=2xx|3xx  WARN=4xx|000  FAIL=5xx"

{
  echo "JediRe Zoning/Property/Design Smoke Test Results (Phase 2)"
  echo "Run: $(date -u)"
  echo "BASE_URL: $BASE_URL"
  echo "DEAL_ID : $DEAL_ID"
  echo "PROP_ID : $PROP_ID"
  echo "MUNI_ID : $MUNI_ID"
  echo ""
  echo "PASS=$PASS  WARN=$WARN  FAIL=$FAIL  TOTAL=$TOTAL"
  echo ""
  echo "$RESULTS_BUF"
  echo ""
  if [ ${#FAIL_LIST[@]} -gt 0 ]; then
    echo "FAILURES (5xx errors):"
    for f in "${FAIL_LIST[@]}"; do
      echo "  $f"
    done
  else
    echo "No 5xx failures."
  fi
} > "$REPORT_OUT"

echo "Results saved to: $REPORT_OUT"

[ "$FAIL" -eq 0 ]
