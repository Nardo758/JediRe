#!/usr/bin/env bash
# ============================================================
# JediRe Smoke Test Phase 2 — Zoning / Property / Design Routes
# Routes covered (all mounted in index.replit.ts):
#   zoningAnalyzeRouter       → /api/v1 (geocode,zoning/lookup,zoning/districts/:muni,analyze)
#   buildingEnvelopeRoutes    → /api/v1
#   propertyProxyRoutes       → /api/v1 (requires JWT)
#   createPropertyMetricsRouter → /api/v1/property-metrics
#   createPropertyScoringRouter → /api/v1/property-scoring
#   zoningCapacityRouter      → /api/v1
#   createZoningIntelligenceRoutes → /api/v1/zoning-intelligence
#   createZoningLearningRoutes → /api/v1/zoning-learning
#   zoningTriangulationRouter → /api/v1
#   zoningVerificationRouter  → /api/v1/zoning-verification
#   zoningProfileRouter       → /api/v1
#   developmentScenariosRouter → /api/v1
#   entitlementRouter         → /api/v1/entitlements
#   propertyBoundaryRouter    → /api/v1
#   siteIntelligenceRouter    → /api/v1
#   designReferencesRouter    → /api/v1/design-references
#   regulatoryAlertRouter     → /api/v1/regulatory-alerts
#   municodeRouter            → /api/v1/municode
#   neighboringPropertiesRoutes → /api/v1/properties
#   propertyAnalyticsRouter   → /api/v1/property-analytics
#   propertyTypesRouter       → /api/v1/property-types
#   propertyTypeStrategiesRouter → /api/v1/property-type-strategies
#   isochroneRoutes           → /api/v1/isochrone
#   NOT mounted: ai-rendering, building-design-3d, design-assistant
#   NOT mounted: zoning.routes.ts, zoning-comparator.routes.ts
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
# No auth required at mount; validation schemas are strict
# geocode:      POST  { address: string }
# zoning/lookup: POST { lat, lng, municipality? }
# zoning/districts/:muni: GET (no body)
# analyze:      POST  { address, lat, lng, lot_size_sqft }
# ============================================================
section "INLINE ZONING ANALYZE"
hit POST "/api/v1/geocode"         none '{"address":"123 Main St Atlanta GA"}'
hit POST "/api/v1/zoning/lookup"   none '{"lat":33.7490,"lng":-84.3880,"municipality":"Atlanta"}'
hit GET  "/api/v1/zoning/districts/atlanta-ga" none
hit POST "/api/v1/analyze"         none '{"address":"123 Main St Atlanta GA","lat":33.749,"lng":-84.388,"lot_size_sqft":10000}'

# ============================================================
# BUILDING ENVELOPE (buildingEnvelopeRoutes → /api/v1, requires JWT at mount)
# POST /deals/:id/building-envelope  — needs landArea > 0
# GET  /property-type-configs
# ============================================================
section "BUILDING ENVELOPE"
hit GET  "/api/v1/property-type-configs"  jwt
hit POST "/api/v1/deals/$DEAL_ID/building-envelope" jwt \
  '{"propertyType":"multifamily","landArea":50000,"setbacks":{"front":20,"side":5,"rear":20},"maxFAR":3,"maxHeight":65,"maxStories":5}'

# ============================================================
# PROPERTY PROXY (propertyProxyRoutes → /api/v1, requires JWT)
# External Cloudflare Worker — network timeout/5xx possible; counted as WARN
# ============================================================
section "PROPERTY PROXY (requires JWT; external worker timeout = WARN)"
hit GET  "/api/v1/properties/health"     jwt
hit GET  "/api/v1/properties/api-health" jwt
hit POST "/api/v1/properties/scrape"     jwt '{"address":"123 Main St Atlanta GA","county":"Fulton"}'

# ============================================================
# PROPERTY METRICS (createPropertyMetricsRouter → /api/v1/property-metrics, requires JWT)
# GET  /property/:parcelId/metrics
# GET  /property/:parcelId/density
# GET  /neighborhoods/benchmarks
# GET  /submarkets/comparison
# GET  /owners/top
# GET  /owners/search?name=...
# GET  /rent-comps
# GET  /rent-comps/summary
# ============================================================
section "PROPERTY METRICS"
hit GET  "/api/v1/property-metrics/property/$PROP_ID/metrics"     jwt
hit GET  "/api/v1/property-metrics/property/$PROP_ID/density"     jwt
hit GET  "/api/v1/property-metrics/neighborhoods/benchmarks"      jwt
hit GET  "/api/v1/property-metrics/submarkets/comparison"         jwt
hit GET  "/api/v1/property-metrics/owners/top"                    jwt
hit GET  "/api/v1/property-metrics/owners/search?name=Smith"      jwt
hit GET  "/api/v1/property-metrics/rent-comps"                    jwt
hit GET  "/api/v1/property-metrics/rent-comps/summary"            jwt

# ============================================================
# PROPERTY SCORING (createPropertyScoringRouter → /api/v1/property-scoring, requires JWT)
# ============================================================
section "PROPERTY SCORING"
hit GET  "/api/v1/property-scoring/seller-propensity"    jwt
hit GET  "/api/v1/property-scoring/value-add"            jwt
hit GET  "/api/v1/property-scoring/hidden-gems"          jwt
hit GET  "/api/v1/property-scoring/cap-rates"            jwt
hit GET  "/api/v1/property-scoring/tax-burden"           jwt
hit GET  "/api/v1/property-scoring/supply-intelligence"  jwt
hit GET  "/api/v1/property-scoring/design-inputs"        jwt

# ============================================================
# PROPERTY ANALYTICS (propertyAnalyticsRouter → /api/v1/property-analytics, requires JWT)
# POST /connect        { propertyId, dealId?, domain }
# POST /disconnect     { propertyId }
# GET  /connection/:propertyId
# GET  /:propertyId
# GET  /:propertyId/history
# GET  /:propertyId/score
# POST /:propertyId/comp-proxy  { profileUrl }
# GET  /:propertyId/digital-share
# POST /sync           { propertyIds[] }
# ============================================================
section "PROPERTY ANALYTICS"
hit POST "/api/v1/property-analytics/connect"               jwt "{\"propertyId\":\"$PROP_ID\",\"domain\":\"example.com\"}"
hit POST "/api/v1/property-analytics/disconnect"            jwt "{\"propertyId\":\"$PROP_ID\"}"
hit GET  "/api/v1/property-analytics/connection/$PROP_ID"  jwt
hit GET  "/api/v1/property-analytics/$PROP_ID"             jwt
hit GET  "/api/v1/property-analytics/$PROP_ID/history"     jwt
hit GET  "/api/v1/property-analytics/$PROP_ID/score"       jwt
hit POST "/api/v1/property-analytics/$PROP_ID/comp-proxy"  jwt '{"profileUrl":"https://apartments.com/example"}'
hit GET  "/api/v1/property-analytics/$PROP_ID/digital-share" jwt
hit POST "/api/v1/property-analytics/sync"                 jwt "{\"propertyIds\":[\"$PROP_ID\"]}"

# ============================================================
# PROPERTY TYPES (propertyTypesRouter → /api/v1/property-types, requires JWT)
# GET /
# GET /:typeKey
# ============================================================
section "PROPERTY TYPES"
hit GET  "/api/v1/property-types"                   jwt
hit GET  "/api/v1/property-types/multifamily"       jwt
hit GET  "/api/v1/property-types/garden_apartments" jwt

# ============================================================
# PROPERTY TYPE STRATEGIES (propertyTypeStrategiesRouter → /api/v1/property-type-strategies, requires JWT)
# GET /
# GET /:propertyTypeKey
# ============================================================
section "PROPERTY TYPE STRATEGIES"
hit GET  "/api/v1/property-type-strategies"                   jwt
hit GET  "/api/v1/property-type-strategies/garden_apartments" jwt
hit GET  "/api/v1/property-type-strategies/multifamily"       jwt

# ============================================================
# ISOCHRONE (isochroneRoutes → /api/v1/isochrone, requires JWT)
# POST /generate  { lng, lat, minutes, profile }
# ============================================================
section "ISOCHRONE"
hit POST "/api/v1/isochrone/generate" jwt \
  '{"lng":-84.3880,"lat":33.7490,"minutes":15,"profile":"driving"}'

# ============================================================
# ZONING CAPACITY (zoningCapacityRouter → /api/v1, requires JWT)
# ============================================================
section "ZONING CAPACITY — Deal"
hit GET    "/api/v1/deals/$DEAL_ID/zoning-capacity"           jwt
hit POST   "/api/v1/deals/$DEAL_ID/zoning-capacity"           jwt \
  '{"zoning_code":"R-4","max_far":2.5,"max_height_feet":55,"max_stories":5}'
hit POST   "/api/v1/deals/$DEAL_ID/zoning-capacity/auto-fill" jwt '{}'
hit DELETE "/api/v1/deals/$DEAL_ID/zoning-capacity"           jwt

section "ZONING CAPACITY — Districts"
hit GET  "/api/v1/zoning-districts/lookup?municipality=atlanta&state=GA" jwt
hit GET  "/api/v1/zoning-districts/by-code?code=R-4&municipality=atlanta" jwt
hit GET  "/api/v1/zoning-districts/$ZONE_DIST_ID/rezone-history"         jwt
hit GET  "/api/v1/zoning-districts/$ZONE_DIST_ID"                        jwt
hit GET  "/api/v1/zoning-districts/$ZONE_DIST_ID/detail"                 jwt

section "ZONING CAPACITY — Municipalities"
hit GET  "/api/v1/municipalities"           jwt
hit GET  "/api/v1/municipalities/$MUNI_ID"  jwt

section "ZONING CAPACITY — Lookup / Misc"
# zoning/lookup here is from zoningCapacityRouter (GET), different from inline (POST)
hit GET  "/api/v1/zoning/lookup?address=123+Main+St+Atlanta+GA"    jwt
hit GET  "/api/v1/zoning/parcel-lookup?parcel_id=12345"            jwt
hit GET  "/api/v1/reverse-geocode?lat=33.7490&lng=-84.3880"        jwt
hit POST "/api/v1/zoning-capacity/reconcile"                       jwt "{\"dealId\":\"$DEAL_ID\"}"
hit POST "/api/v1/zoning-agent/retrieve"                           jwt '{"question":"What is the FAR for R-4 in Atlanta?"}'

# ============================================================
# ZONING INTELLIGENCE (createZoningIntelligenceRoutes → /api/v1/zoning-intelligence, requires JWT)
# query:           POST  { question, districtCode?, municipality?, state?, dealId? }
# analyze:         POST  { dealId } — needs boundary data, may 400 if missing
# resolve/:dealId: GET
# constraints/:dealId: GET
# profile/:code/:muni: GET
# extract-profile: POST { districtCode, municipality, state }
# use-check:       POST { districtCode, municipality, useType }
# parking-calc:    POST { districtCode, municipality, units? }
# maturity/:muni:  GET
# analyses:        GET
# analyses/:id:    GET (UUID)
# ============================================================
section "ZONING INTELLIGENCE"
hit GET  "/api/v1/zoning-intelligence/"                                                    jwt
hit POST "/api/v1/zoning-intelligence/query"          jwt \
  "{\"question\":\"What is the FAR for R-4 in Atlanta?\",\"districtCode\":\"R-4\",\"municipality\":\"Atlanta\",\"state\":\"GA\"}"
hit POST "/api/v1/zoning-intelligence/analyze"        jwt \
  "{\"dealId\":\"$DEAL_ID\",\"municipality\":\"Atlanta\",\"state\":\"GA\",\"districtCode\":\"R-4\",\"landAreaSf\":10000}"
hit GET  "/api/v1/zoning-intelligence/resolve/$DEAL_ID"                                    jwt
hit GET  "/api/v1/zoning-intelligence/constraints/$DEAL_ID"                                jwt
hit GET  "/api/v1/zoning-intelligence/profile/$DISTRICT_CODE/$MUNI_ID"                    jwt
hit POST "/api/v1/zoning-intelligence/extract-profile" jwt \
  '{"districtCode":"R-4","municipality":"Atlanta","state":"GA"}'
hit POST "/api/v1/zoning-intelligence/use-check"      jwt \
  '{"districtCode":"R-4","municipality":"Atlanta","useType":"multifamily"}'
hit POST "/api/v1/zoning-intelligence/parking-calc"   jwt \
  '{"districtCode":"R-4","municipality":"Atlanta","units":100}'
hit GET  "/api/v1/zoning-intelligence/maturity/atlanta"                                    jwt
hit GET  "/api/v1/zoning-intelligence/analyses"                                            jwt
hit GET  "/api/v1/zoning-intelligence/analyses/$ZONE_DIST_ID"                             jwt

# ============================================================
# ZONING LEARNING (createZoningLearningRoutes → /api/v1/zoning-learning, requires JWT)
# corrections:            POST { dealId, field, correctedValue }
# corrections:            GET
# corrections/:id/resolve: POST (UUID only — fake UUID → 404, real UUID tested below)
# precedents:             POST { municipality, districtCode, outcome }
# precedents/search:      GET ?municipality=
# precedents/similar:     GET ?dealId=
# precedents/patterns:    GET
# outcomes:               POST { dealId, outcome }
# calibration/:muni:      GET
# confidence/:muni:       GET
# maturity:               GET
# maturity/:muni:         GET
# credibility/:userId:    GET
# credibility/:userId/tier: PUT { tier }  (valid tiers only)
# ============================================================
section "ZONING LEARNING"
hit POST "/api/v1/zoning-learning/corrections"  jwt \
  "{\"dealId\":\"$DEAL_ID\",\"field\":\"max_far\",\"correctedValue\":2.5,\"municipality\":\"Atlanta\",\"state\":\"GA\",\"districtCode\":\"R-4\"}"
hit GET  "/api/v1/zoning-learning/corrections"                                             jwt
hit POST "/api/v1/zoning-learning/corrections/$ZONE_DIST_ID/resolve" jwt \
  '{"approved":false,"resolutionNotes":"Smoke test — rejected"}'
hit POST "/api/v1/zoning-learning/precedents"   jwt \
  '{"municipality":"Atlanta","state":"GA","districtCode":"R-4","outcome":"approved","applicationType":"multifamily","scale":"medium"}'
hit GET  "/api/v1/zoning-learning/precedents/search?municipality=Atlanta"                  jwt
hit GET  "/api/v1/zoning-learning/precedents/similar?dealId=$DEAL_ID"                     jwt
hit GET  "/api/v1/zoning-learning/precedents/patterns"                                     jwt
hit POST "/api/v1/zoning-learning/outcomes"     jwt \
  "{\"dealId\":\"$DEAL_ID\",\"outcome\":\"approved\",\"reportedBy\":\"$USER_ID\"}"
hit GET  "/api/v1/zoning-learning/calibration/$MUNI_ID"                                   jwt
hit GET  "/api/v1/zoning-learning/confidence/$MUNI_ID"                                    jwt
hit GET  "/api/v1/zoning-learning/maturity"                                                jwt
hit GET  "/api/v1/zoning-learning/maturity/$MUNI_ID"                                      jwt
hit GET  "/api/v1/zoning-learning/credibility/$USER_ID"                                   jwt
hit PUT  "/api/v1/zoning-learning/credibility/$USER_ID/tier" jwt '{"tier":"investor"}'

# ============================================================
# ZONING VERIFICATION (zoningVerificationRouter → /api/v1/zoning-verification, requires JWT)
# verify:                          POST { dealId, districtCode }
# verify/:id/confirm:              POST (UUID) — uses real zone_dist id
# verify/:id/flag:                 POST (UUID)
# verify/:id/correct:              POST (UUID)
# verify/deal/:dealId:             GET
# citations/:jurisdictionId/:code: GET
# citations/:jurisdictionId:       GET
# sources/:jurisdictionId:         GET
# ============================================================
section "ZONING VERIFICATION"
hit POST "/api/v1/zoning-verification/verify" jwt \
  "{\"dealId\":\"$DEAL_ID\",\"districtCode\":\"R-4\"}"
hit POST "/api/v1/zoning-verification/verify/$ZONE_DIST_ID/confirm"  jwt '{"confirmed":true}'
hit POST "/api/v1/zoning-verification/verify/$ZONE_DIST_ID/flag"     jwt '{"reason":"Incorrect FAR"}'
hit POST "/api/v1/zoning-verification/verify/$ZONE_DIST_ID/correct"  jwt '{"field":"max_far","correctedValue":3.0}'
hit GET  "/api/v1/zoning-verification/verify/deal/$DEAL_ID"          jwt
hit GET  "/api/v1/zoning-verification/citations/atlanta-ga/$DISTRICT_CODE" jwt
hit GET  "/api/v1/zoning-verification/citations/atlanta-ga"          jwt
hit GET  "/api/v1/zoning-verification/sources/atlanta-ga"            jwt

# ============================================================
# ZONING TRIANGULATION (zoningTriangulationRouter → /api/v1, no per-route auth)
# ============================================================
section "ZONING TRIANGULATION — Parcels"
hit POST "/api/v1/parcels/ingest/geojson"   jwt '{"type":"FeatureCollection","features":[]}'
hit POST "/api/v1/parcels/ingest/batch"     jwt '{"parcels":[]}'
hit GET  "/api/v1/parcels/stats"            jwt
hit GET  "/api/v1/parcels/nearby?lat=33.749&lng=-84.388&radius=500" jwt
hit GET  "/api/v1/parcels/$ZONE_DIST_ID"   jwt

section "ZONING TRIANGULATION — Zoning"
hit POST "/api/v1/zoning/triangulate"                  jwt \
  "{\"dealId\":\"$DEAL_ID\",\"address\":\"123 Main St Atlanta GA\"}"
hit GET  "/api/v1/zoning/triangulation/$DEAL_ID"       jwt
hit POST "/api/v1/zoning/triangulation/$ZONE_DIST_ID/confirm" jwt '{"confirmed":true}'
hit POST "/api/v1/zoning/outcome"                      jwt \
  "{\"triangulationId\":\"$ZONE_DIST_ID\",\"actualOutcome\":\"approved\",\"reportedBy\":\"$USER_ID\",\"dealId\":\"$DEAL_ID\"}"
hit POST "/api/v1/zoning/calibrate/atlanta"            jwt '{}'
hit GET  "/api/v1/zoning/calibration"                  jwt
hit POST "/api/v1/zoning/chain/execute"                jwt "{\"dealId\":\"$DEAL_ID\"}"
hit GET  "/api/v1/zoning/chain/$DEAL_ID"               jwt
hit POST "/api/v1/zoning/recommendations/$DEAL_ID/analyze" jwt '{}'
hit GET  "/api/v1/zoning/recommendations/$DEAL_ID"     jwt

section "ZONING TRIANGULATION — Entitlements / Properties"
hit GET    "/api/v1/deals/$DEAL_ID/nearby-entitlements"               jwt
hit GET    "/api/v1/deals/$DEAL_ID/properties"                        jwt
hit POST   "/api/v1/deals/$DEAL_ID/properties/$PROP_ID/link"          jwt '{}'
hit DELETE "/api/v1/deals/$DEAL_ID/properties/$PROP_ID"               jwt
hit POST   "/api/v1/admin/deal-property-autolink"                      admin '{}'

# ============================================================
# ZONING PROFILE (zoningProfileRouter → /api/v1, requires JWT)
# ============================================================
section "ZONING PROFILE"
hit GET  "/api/v1/deals/$DEAL_ID/zoning-profile"            jwt
hit POST "/api/v1/deals/$DEAL_ID/zoning-profile/resolve"    jwt '{}'
hit PUT  "/api/v1/deals/$DEAL_ID/zoning-profile/overrides"  jwt '{"max_far":3.0}'
hit POST "/api/v1/deals/$DEAL_ID/zoning-profile/overlays"   jwt '{"overlay":"floodplain"}'

# ============================================================
# DEVELOPMENT SCENARIOS (developmentScenariosRouter → /api/v1, requires JWT)
# ============================================================
section "DEVELOPMENT SCENARIOS"
hit GET  "/api/v1/deals/$DEAL_ID/scenarios/hbu"                       jwt
hit GET  "/api/v1/deals/$DEAL_ID/regulatory-risk-analysis"            jwt
hit GET  "/api/v1/deals/$DEAL_ID/timeline-intelligence"               jwt
hit GET  "/api/v1/deals/$DEAL_ID/scenarios/recommendations"           jwt
hit GET  "/api/v1/deals/$DEAL_ID/scenarios"                           jwt
hit GET  "/api/v1/deals/$DEAL_ID/scenarios/lookup-district?districtCode=R-4" jwt
hit POST "/api/v1/deals/$DEAL_ID/scenarios" jwt \
  '{"name":"Smoke Scenario","strategy":"multifamily"}'
hit GET  "/api/v1/deals/$DEAL_ID/rezone-analysis"                     jwt
hit GET  "/api/v1/deals/$DEAL_ID/envelope-enrichment"                 jwt
FAKE_SCEN_ID="00000000-0000-0000-0000-000000000098"
hit PUT    "/api/v1/deals/$DEAL_ID/scenarios/$FAKE_SCEN_ID"           jwt '{"name":"Updated"}'
hit PUT    "/api/v1/deals/$DEAL_ID/scenarios/$FAKE_SCEN_ID/sync"      jwt '{}'
hit POST   "/api/v1/deals/$DEAL_ID/scenarios/deactivate-all"          jwt '{}'
hit PUT    "/api/v1/deals/$DEAL_ID/scenarios/$FAKE_SCEN_ID/activate"  jwt '{}'
hit DELETE "/api/v1/deals/$DEAL_ID/scenarios/$FAKE_SCEN_ID"           jwt

# ============================================================
# ENTITLEMENTS (entitlementRouter → /api/v1/entitlements, requires JWT)
# ============================================================
section "ENTITLEMENTS"
FAKE_ENT_ID="00000000-0000-0000-0000-000000000097"
FAKE_MILE_ID="00000000-0000-0000-0000-000000000096"
hit GET    "/api/v1/entitlements"                                       jwt
hit GET    "/api/v1/entitlements/kanban"                                jwt
hit GET    "/api/v1/entitlements/deal/$DEAL_ID"                        jwt
hit GET    "/api/v1/entitlements/$FAKE_ENT_ID"                         jwt
hit GET    "/api/v1/entitlements/$FAKE_ENT_ID/risk-factors"            jwt
hit POST   "/api/v1/entitlements" jwt \
  "{\"deal_id\":\"$DEAL_ID\",\"path\":\"by-right\",\"title\":\"Smoke Entitlement\"}"
hit PATCH  "/api/v1/entitlements/$FAKE_ENT_ID"                        jwt '{"status":"in_progress"}'
hit DELETE "/api/v1/entitlements/$FAKE_ENT_ID"                        jwt
hit POST   "/api/v1/entitlements/$FAKE_ENT_ID/milestones" jwt \
  '{"title":"Submit Application","due_date":"2026-06-01"}'
hit PATCH  "/api/v1/entitlements/milestones/$FAKE_MILE_ID"            jwt '{"status":"completed"}'
hit POST   "/api/v1/entitlements/sync/path-selected" jwt \
  "{\"dealId\":\"$DEAL_ID\",\"path\":\"by-right\"}"
hit POST   "/api/v1/entitlements/sync/status-changed" jwt \
  "{\"dealId\":\"$DEAL_ID\",\"status\":\"approved\"}"
hit GET    "/api/v1/entitlements/sync/milestone-template/by-right"    jwt

# ============================================================
# PROPERTY BOUNDARY (propertyBoundaryRouter → /api/v1, requires JWT)
# ============================================================
section "PROPERTY BOUNDARY"
hit GET    "/api/v1/deals/$DEAL_ID/boundary"           jwt
hit POST   "/api/v1/deals/$DEAL_ID/boundary"           jwt \
  '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}'
hit DELETE "/api/v1/deals/$DEAL_ID/boundary"           jwt
hit GET    "/api/v1/deals/$DEAL_ID/boundary/export"    jwt
hit GET    "/api/v1/deals/$DEAL_ID/development-capacity" jwt
hit POST   "/api/v1/deals/$DEAL_ID/zoning-confirmation" jwt \
  "{\"districtCode\":\"R-4\",\"municipalityId\":\"$MUNI_ID\"}"
hit GET    "/api/v1/deals/$DEAL_ID/zoning-confirmation" jwt

# ============================================================
# SITE INTELLIGENCE (siteIntelligenceRouter → /api/v1, requires JWT)
# ============================================================
section "SITE INTELLIGENCE"
hit GET  "/api/v1/deals/$DEAL_ID/site-intelligence"   jwt
hit POST "/api/v1/deals/$DEAL_ID/site-intelligence"   jwt \
  '{"environmental":{"soilType":"clay","score":75},"infrastructure":{"waterCapacity":"adequate","score":80}}'

# ============================================================
# DESIGN REFERENCES (designReferencesRouter → /api/v1/design-references, requires JWT)
# GET  /file/:filename
# GET  /:dealId
# GET  /:dealId/:referenceId
# PUT  /:dealId/:referenceId
# DELETE /:dealId/:referenceId
# POST /:dealId/:referenceId/analyze
# (POST /:dealId/upload requires multipart — skip in smoke test)
# ============================================================
section "DESIGN REFERENCES"
hit GET    "/api/v1/design-references/file/nonexistent-file.jpg"                  jwt
hit GET    "/api/v1/design-references/$DEAL_ID"                                   jwt
hit GET    "/api/v1/design-references/$DEAL_ID/$DESIGN_REF_ID"                   jwt
hit PUT    "/api/v1/design-references/$DEAL_ID/$DESIGN_REF_ID"                   jwt \
  '{"category":"facade","notes":"smoke-updated"}'
hit DELETE "/api/v1/design-references/$DEAL_ID/$ZONE_DIST_ID"                    jwt
hit POST   "/api/v1/design-references/$DEAL_ID/$DESIGN_REF_ID/analyze"           jwt '{}'

# ============================================================
# REGULATORY ALERTS (regulatoryAlertRouter → /api/v1/regulatory-alerts, requires JWT)
# ============================================================
section "REGULATORY ALERTS"
FAKE_ALERT_ID="00000000-0000-0000-0000-000000000095"
hit GET    "/api/v1/regulatory-alerts"                                             jwt
hit GET    "/api/v1/regulatory-alerts/municipality/atlanta?state=GA"              jwt
hit GET    "/api/v1/regulatory-alerts/strategy-matrix?municipality=atlanta&state=GA" jwt
hit GET    "/api/v1/regulatory-alerts/categories"                                  jwt
hit GET    "/api/v1/regulatory-alerts/$FAKE_ALERT_ID"                             jwt
hit POST   "/api/v1/regulatory-alerts" jwt \
  '{"municipality":"atlanta","state":"GA","category":"zoning","title":"Smoke Alert"}'
hit PATCH  "/api/v1/regulatory-alerts/$FAKE_ALERT_ID/deactivate"                  jwt '{}'
# score-risk: categories as full objects to avoid normalization fallback ambiguity
hit POST   "/api/v1/regulatory-alerts/score-risk" jwt \
  "{\"dealId\":\"$DEAL_ID\",\"municipality\":\"Atlanta\",\"state\":\"GA\",\"categories\":[{\"category\":\"zoning\",\"level\":\"moderate\",\"score\":50,\"weight\":0.5,\"trend\":\"stable\",\"strategyImpact\":{\"build_to_sell\":1.2,\"rental\":1.0}},{\"category\":\"environmental\",\"level\":\"low\",\"score\":25,\"weight\":0.5,\"trend\":\"improving\",\"strategyImpact\":{\"build_to_sell\":0.8,\"rental\":0.9}}]}"

# ============================================================
# MUNICODE (municodeRouter → /api/v1/municode, requires JWT)
# ============================================================
section "MUNICODE"
hit GET  "/api/v1/municode/resolve?municipality=atlanta&section=16-18"  jwt
hit GET  "/api/v1/municode/district/$MUNI_ID/$DISTRICT_CODE"            jwt
hit GET  "/api/v1/municode/sections/$MUNI_ID"                           jwt
hit GET  "/api/v1/municode/chapter/$MUNI_ID"                            jwt

# ============================================================
# NEIGHBORING PROPERTIES (neighboringPropertiesRoutes → /api/v1/properties, requires JWT)
# /:id/neighbors — parcel must exist; expect 404 if not found
# /:id/assemblage-scenarios
# /:id/neighbors/ai-analysis
# ============================================================
section "NEIGHBORING PROPERTIES"
hit GET  "/api/v1/properties/$PROP_ID/neighbors"                       jwt
hit GET  "/api/v1/properties/$PROP_ID/neighbors?includeNearby=true"   jwt
hit GET  "/api/v1/properties/$PROP_ID/assemblage-scenarios"            jwt
hit POST "/api/v1/properties/$PROP_ID/neighbors/ai-analysis" jwt \
  '{"type":"owner-disposition"}'

# ============================================================
# NOT MOUNTED — expect 404 / 401
# Files exist but are NOT imported/mounted in index.replit.ts:
#   ai-rendering.routes.ts, building-design-3d.routes.ts,
#   design-assistant.routes.ts, design.routes.ts,
#   zoning.routes.ts, zoning-comparator.routes.ts
# ============================================================

section "ZONING LEGACY ROUTES (zoning.routes.ts — not mounted — expect 404)"
# POST /lookup, GET /districts/:muni/:state, GET /rules/:districtId, POST /analyze
# Would mount at /api/v1/zoning-info if added; hits 404 since file is not imported
hit POST "/api/v1/zoning-info/lookup"                                          jwt \
  '{"lat":33.749,"lng":-84.388,"municipality":"Atlanta"}'
hit GET  "/api/v1/zoning-info/districts/atlanta/GA"                           jwt
hit GET  "/api/v1/zoning-info/rules/$ZONE_DIST_ID"                            jwt
hit POST "/api/v1/zoning-info/analyze"                                         jwt \
  '{"address":"123 Main St Atlanta GA","lat":33.749,"lng":-84.388}'

section "ZONING COMPARATOR (zoning-comparator.routes.ts — not mounted — expect 404)"
# POST /districts, POST /parcels, POST /jurisdictions
# Not imported in index.replit.ts — all paths yield 404
hit POST "/api/v1/zoning-comparator/districts"     jwt \
  '{"districtCodes":["R-4","C-1"],"municipality":"Atlanta"}'
hit POST "/api/v1/zoning-comparator/parcels"       jwt \
  "{\"parcelIds\":[\"$PROP_ID\"]}"
hit POST "/api/v1/zoning-comparator/jurisdictions" jwt \
  '{"jurisdictions":["Atlanta","Marietta"]}'

section "AI RENDERING (not mounted — expect 404)"
hit GET  "/api/v1/ai/render/styles"  none
hit GET  "/api/v1/ai/render/status"  none
hit POST "/api/v1/ai/render"         jwt '{"imageBase64":"abc","style":"modern-glass"}'

section "BUILDING DESIGN 3D (not mounted — expect 404)"
# GET, POST, DELETE /:dealId/design-3d — all three verbs from the route file
hit GET    "/api/v1/deals/$DEAL_ID/design-3d"   jwt
hit POST   "/api/v1/deals/$DEAL_ID/design-3d"   jwt '{"buildingSections":[]}'
hit DELETE "/api/v1/deals/$DEAL_ID/design-3d"   jwt

section "DESIGN ROUTES (design.routes.ts — not mounted — expect 404)"
# POST /:dealId/chat — not mounted in index.replit.ts
hit POST "/api/v1/deals/$DEAL_ID/design-chat"  jwt \
  '{"message":"Generate a modern facade design"}'

section "DESIGN ASSISTANT (not mounted — expect 404)"
hit GET  "/api/v1/design-assistant/status"  none
hit POST "/api/v1/design-assistant/chat"    jwt \
  '{"userPrompt":"Add a floor","currentDesign":{"buildingSections":[]}}'

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
