# Neural Network Data Map

Complete map of every data source, API, and pipeline the neural network can tap into.

## The Deal Lifecycle & Graph Ingestion Points

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        DEAL LIFECYCLE → GRAPH                               ║
║                                                                              ║
║  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  ║
║  │ EMAIL ARRIVES │───→│ CLASSIFY     │───→│ EXTRACT      │                  ║
║  │ (Gmail Sync)  │    │ (deal? news?)│    │ (OM parser)  │                  ║
║  └──────────────┘    └──────────────┘    └──────┬───────┘                  ║
║                                                   │                          ║
║                                                   ▼                          ║
║                                          ┌──────────────┐                   ║
║                                          │ CREATE DEAL  │ ← inline-deals    ║
║                                          │ (capsule)    │   routes.ts        ║
║                                          └──────┬───────┘                   ║
║                                                  │                           ║
║                              inngest: deal.created                           ║
║                                                  │                           ║
║                    ┌─────────────┬────────────────┼────────────────┐         ║
║                    ▼             ▼                ▼                ▼         ║
║              ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐       ║
║              │ RESEARCH │ │ SUPPLY   │ │ ZONING       │ │ CASHFLOW │       ║
║              │ Agent    │ │ Agent    │ │ Agent        │ │ Agent    │       ║
║              └────┬─────┘ └────┬─────┘ └──────┬───────┘ └────┬─────┘       ║
║                   │            │               │              │              ║
║                   └────────────┴───────────────┴──────────────┘              ║
║                                       │                                      ║
║                                       ▼                                      ║
║                              ┌──────────────────┐                           ║
║                              │ KNOWLEDGE GRAPH  │                           ║
║                              │ (auto-ingest)    │                           ║
║                              └──────────────────┘                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 1. INTERNAL APIs (Backend Routes)

### Deal & Pipeline
| Route | Method | Purpose | Graph Event |
|-------|--------|---------|-------------|
| `/api/v1/capsules` | POST | Create deal capsule | → `deal.created` |
| `/api/v1/capsules/:id/documents` | POST | Upload docs to deal | → `document.uploaded` |
| `/api/v1/inline-deals` | POST | Create deal from email | → `deal.created` (Inngest) |
| `/api/v1/deals` | GET | List deals | read-only |
| `/api/v1/deals/:dealId/activity` | GET | Deal activity feed | read-only |
| `/api/v1/deals/:dealId/traffic` | GET | Deal traffic forecast | read-only |

### Market Intelligence
| Route | Method | Purpose | Graph Event |
|-------|--------|---------|-------------|
| `/api/v1/data-matrix/context/:dealId` | GET | Full 9-layer context | read-only |
| `/api/v1/knowledge-graph/nodes` | GET/POST | Graph CRUD | node.created |
| `/api/v1/knowledge-graph/impact/:nodeId` | GET | Blast radius | read-only |
| `/api/v1/knowledge-graph/search` | POST | Hybrid search | read-only |
| `/api/v1/context/analyze` | POST | Context awareness | read-only |
| `/api/v1/context/supply-pipeline/:id` | GET | Supply expansion | read-only |
| `/api/v1/context/trigger-research` | POST | Fill data gaps | → agent tasks |

### Property & Enrichment
| Route | Method | Purpose | Graph Event |
|-------|--------|---------|-------------|
| `/api/v1/property-enrichment/enrich` | POST | County GIS + rent data | → `property.enriched` |
| `/api/v1/property-discovery/discover` | POST | Auto-find properties | → `property.created` |
| `/api/v1/georgia/ingest/:county` | POST | Georgia county data | → bulk `property.created` |
| `/api/v1/proximity/score/:lat/:lng` | GET | Proximity score | read-only |

### News & Email
| Route | Method | Purpose | Graph Event |
|-------|--------|---------|-------------|
| `/api/v1/news/feed` | GET | Aggregated news | read-only |
| `/api/v1/news/search` | GET | Search articles | read-only |
| `/api/v1/gmail/sync` | POST | Sync Gmail inbox | → emails classified |
| `/api/v1/inbox` | GET | Unified inbox | read-only |
| `/api/v1/email-extractions` | GET | Extracted deal data | read-only |

### Financial & Analysis
| Route | Method | Purpose | Graph Event |
|-------|--------|---------|-------------|
| `/api/v1/inflation/composite` | POST | JCIS score | read-only |
| `/api/v1/inflation/replacement-cost/v2` | POST | Replacement cost | read-only |
| `/api/v1/capital-structure` | GET/POST | Capital stack | read-only |
| `/api/v1/proforma` | GET/POST | Pro forma model | read-only |
| `/api/v1/ticker` | GET | Macro data (FRED) | read-only |
| `/api/v1/economic-context` | GET | BLS + FRED | read-only |

### Agents
| Route | Method | Purpose | Graph Event |
|-------|--------|---------|-------------|
| `/api/v1/agents/:id/run` | POST | Run agent manually | → agent results |
| `/api/v1/agent-runs` | GET | Agent run history | read-only |
| `/api/v1/planner/execute` | POST | Plan + execute (DeepSeek) | depends on task |
| `/api/v1/scheduled-refresh/run` | POST | Refresh stale nodes | → agent tasks |

---

## 2. EXTERNAL DATA SOURCES

### Government & Municipal (FREE)
| Source | URL | Data | Service |
|--------|-----|------|---------|
| **FRED** | api.stlouisfed.org | Treasury rates, CPI, GDP, unemployment, SOFR | `fred-api.client.ts` |
| **BLS** | api.bls.gov | Employment, wages, CPI by metro, RPP | `bls-api.client.ts` |
| **Census** | api.census.gov | ACS demographics, population, income | `census.service.ts` |
| **Census Geocoder** | geocoding.geo.census.gov | Address → lat/lng | `geocoding.service.ts` |
| **SEC EDGAR** | efts.sec.gov | REIT filings, 10-K/10-Q | `sec-api.client.ts` |
| **Treasury** | api.fiscaldata.treasury.gov | Yield curve, fiscal data | `rate-index.service.ts` |
| **BEA** | www.bea.gov | GDP by metro, regional accounts | `economic-context.service.ts` |
| **EIA** | www.eia.gov | Energy prices (utility costs) | `market-basket.service.ts` |

### County GIS / Property Data (FREE)
| County | URL | Data | Service |
|--------|-----|------|---------|
| **Cobb County GA** | gis.cobbcounty.gov | Parcels, permits, sales | `cobb-ingestion.service.ts` |
| **Fulton County GA** | gis.fultoncountyga.gov | Parcels, tax, sales | `fulton-ingestion.service.ts` |
| **DeKalb County GA** | gis.dekalbcountyga.gov | Parcels, assessments | `dekalb-ingestion.service.ts` |
| **Gwinnett County GA** | (ArcGIS) | Parcels, permits | `gwinnett-ingestion.service.ts` |
| **ArcGIS Services** | services.arcgis.com | Multi-county GIS queries | `arcgis-client.ts` |
| **Miami-Dade** | gis.miamidade.gov | Parcels, permits | `county-configs.ts` |
| **Harris County TX** | arcgis.harriscountytx.gov | Parcels | `county-configs.ts` |
| **Dallas County TX** | gis.dallascad.org | Assessments | `county-configs.ts` |
| **Cook County IL** | www.cookcountyassessor.com | Assessments | `county-configs.ts` |
| **Pinellas County FL** | egis.pinellas.gov | Parcels | `county-configs.ts` |
| **Charlotte NC** | gis.charlottenc.gov | Parcels | `county-configs.ts` |
| **Shelby County TN** | gis.shelbycountytn.gov | Parcels | `county-configs.ts` |

### Real Estate Data
| Source | URL | Data | Service |
|--------|-----|------|---------|
| **Apartments.com** | www.apartments.com | Rent data, listings | `apartments-com-provider.ts` |
| **Zillow (ZHVI/ZORI)** | zillow-com1.p.rapidapi.com | Home values, rent index | `zillow-zhvi-ingest.service.ts` |
| **MARTA GTFS** | www.itsmarta.com | Transit schedules | `marta-gtfs.service.ts` |
| **OSM Overpass** | overpass-api.de | POIs, grocery, schools | `osm-overpass.service.ts` |
| **Atlanta PD** | data.atlantaga.gov | Crime data | `atlanta-pd-crime.service.ts` |

### News Providers
| Source | Type | Data | Service |
|--------|------|------|---------|
| **Bisnow** | RSS/Scrape | CRE news | `bisnow.provider.ts` |
| **GlobeSt** | RSS | CRE news | `globest.provider.ts` |
| **Bloomberg** | RSS | Market news | `bloomberg.provider.ts` |
| **WSJ** | RSS | Market/economy | `wsj.provider.ts` |
| **CNBC** | RSS/Search | Market news | `cnbc.provider.ts` |
| **Reuters** | RSS | Global news | `reuters.provider.ts` |
| **NYT** | API | Business/real estate | `nyt.provider.ts` |
| **FT** | RSS | Financial news | `ft.provider.ts` |
| **MarketWatch** | RSS | Market data | `marketwatch.provider.ts` |
| **Guardian** | API | Business news | `guardian.provider.ts` |
| **HousingWire** | RSS | Housing/mortgage news | `housingwire.provider.ts` |
| **CoStar** | RSS | CRE data | via `news-connections/rss-feeds.ts` |
| **The Real Deal** | RSS | CRE deals | via `news-connections/rss-feeds.ts` |
| **Seeking Alpha** | Scrape | REIT analysis | via `discovery/sources/cre-rss.ts` |
| **GDELT** | API | Global event database | `market-event-extraction.service.ts` |

### AI Models
| Provider | Models | Use | Service |
|----------|--------|-----|---------|
| **Anthropic** | Opus, Sonnet, Haiku | Planning, analysis, chat | `llm.service.ts` |
| **DeepSeek** | V3, R1 | Cheap execution | `planner-executor.service.ts` |
| **OpenAI** | ada-002 | Embeddings | `embeddings.service.ts` |
| **Hugging Face** | Various | Fallback | `agents/runtime/` |

### Third-Party Integrations
| Service | URL | Purpose | Service |
|---------|-----|---------|---------|
| **Google OAuth** | accounts.google.com | Gmail auth | `oauth.ts` |
| **Google Maps** | maps.google.com | Geocoding, places | `geocoding.ts` |
| **Mapbox** | api.mapbox.com | Maps, isochrones | `isochrone.routes.ts` |
| **DocuSign** | demo.docusign.net | Contract signing | `docusign.service.ts` |
| **Notarize** | api.notarize.com | Remote notarization | `notarize.service.ts` |
| **Plaid** | production.plaid.com | Bank verification | `plaid.service.ts` |
| **Dropbox** | api.dropboxapi.com | Cloud storage | `dropbox.adapter.ts` |
| **Google Drive** | www.googleapis.com | Cloud storage | `google-drive.adapter.ts` |
| **DuckDuckGo** | api.duckduckgo.com | Web search (agents) | `web_search.ts` |
| **SerpAPI** | serpapi.com | Search results | `agents/config/search.ts` |

### Web Scraping (Agent Tools)
| Tool | Target | Data |
|------|--------|------|
| `fetch_webpage` | Any URL | Page content |
| `web_search` | DuckDuckGo/SerpAPI | Search results |
| `fetch_municode` | Municode.com | Zoning ordinances |
| `fetch_permits` | County portals | Building permits |
| `fetch_costar_metrics` | CoStar | Market metrics |
| `fetch_costar_pipeline` | CoStar | Development pipeline |
| `read_gmail_thread` | Gmail | Email content |

---

## 3. GRAPH INGESTION POINTS (What Needs Wiring)

### Currently Wired ✅
| Source | Event | Graph Action |
|--------|-------|-------------|
| Supply Agent | `supply.completed` | Market node updated + dev projects ingested |
| Research Agent | `research.completed` | Market node updated + properties ingested |

### Needs Wiring ❌
| Source | Event | Graph Action | Priority |
|--------|-------|-------------|----------|
| **Deal Creation** | `inline-deals POST` | Deal + Property nodes | 🔴 Critical |
| **Document Upload** | `capsule/:id/documents POST` | Document node + extraction | 🔴 Critical |
| **Email Classification** | `email-classification.service` | Deal/News nodes from email | 🔴 Critical |
| **News Extraction** | `market-event-extraction.service` | Event nodes from articles | 🟡 High |
| **Newsletter Parse** | `newsletter-parser.service` | Event/Article nodes | 🟡 High |
| **Property Enrichment** | `enrichment-orchestrator.ts` | Update Property nodes | 🟡 High |
| **Georgia Ingestion** | `georgia-orchestrator.ts` | Bulk Property + Permit nodes | 🟡 High |
| **Property Discovery** | `property-discovery.service` | New Property nodes | 🟡 High |
| **Sales Recorded** | `cobb-ingestion / fulton / etc` | Sale nodes | 🟡 High |
| **Permit Issued** | County ingestion services | Permit nodes | 🟡 High |
| **Zoning Agent** | `zoning.completed` | Update Property zoning props | 🟢 Medium |
| **CashFlow Agent** | `cashflow.completed` | Update Deal financial props | 🟢 Medium |
| **Commentary Agent** | `commentary.completed` | Commentary nodes | 🟢 Medium |
| **FRED Data Refresh** | `fred-ingest.service` | Metric nodes | 🟢 Medium |
| **BLS Data Refresh** | `bls-api.client` | Metric nodes | 🟢 Medium |
| **Census Data** | `census-acs-ingest.service` | Demographic metrics | 🟢 Medium |
| **Zillow Data** | `zillow-zhvi-ingest / zori` | Market metric nodes | 🟢 Medium |
| **Cloud Storage Sync** | `cloud-storage.service` | Document nodes | 🔵 Low |
| **Contact Sync** | `contacts-sync.service` | Owner/Broker nodes | 🔵 Low |

---

## 4. THE MISSING INFORMATION PROBLEM

When context analysis finds a gap, here's where to look:

### "What's the rent?" → Rent Data
```
1. Check Data Matrix Layer 2 (RentData)
2. → apartments-com-provider.ts (scrape listing)
3. → zillow-zori-ingest.service.ts (ZORI index)
4. → Agent: web_search for "[property name] rent"
5. → Data Library (user-uploaded rent rolls)
```

### "What's the cap rate?" → Sales Comps
```
1. Check Data Matrix Layer 3 (SalesComps)
2. → County GIS (recorded deed + price)
3. → Agent: fetch_comp_set tool
4. → Archive deals (internal benchmarks)
5. → Web search: "[market] multifamily cap rate 2026"
```

### "What's under construction?" → Supply Pipeline
```
1. Check development_projects table
2. → County permit APIs (arcgis-client.ts)
3. → Agent: fetch_costar_pipeline
4. → Agent: fetch_submarket_deliveries
5. → News: market-event-extraction ("approved", "groundbreaking")
6. → Web search: "[submarket] new apartments construction"
```

### "Who's the owner?" → Ownership
```
1. Check knowledge graph (Owner nodes)
2. → County GIS (deed records)
3. → Agent: fetch_ownership tool
4. → SEC EDGAR (if REIT)
5. → Web search: "[property name] owner"
```

### "What's the zoning?" → Zoning
```
1. Check property node zoning properties
2. → Agent: fetch_zoning_code
3. → Agent: fetch_municode
4. → County GIS overlay
5. → Web search: "[address] zoning"
```

### "What's the macro outlook?" → Economic
```
1. FRED API: Treasury rates, CPI, GDP, unemployment
2. BLS API: Employment by metro, wages, CPI-U
3. Census ACS: Population, income, migration
4. BEA: GDP by metro
5. Zillow ZHVI: Home values trend
```

### "Is this a good deal?" → Full Analysis
```
1. Data Matrix (all 9 layers)
2. Knowledge Graph (impact analysis)
3. Context Awareness (analyst questions)
4. Archive benchmarks (similar past deals)
5. Agent collaboration (Research + Supply + CashFlow)
6. News sentiment (recent articles about market)
7. Macro context (rate environment, employment)
```

---

## 5. DEAL CAPSULE → GRAPH FLOW (The Missing Link)

### Current Flow (Broken)
```
Email → Gmail Sync → Classification → "Deal Opportunity"
                                          ↓
                                    STOPS HERE ❌
```

### Desired Flow
```
Email → Gmail Sync → Classification → "Deal Opportunity"
                                          ↓
                                    Extract Deal Fields (Haiku)
                                          ↓
                                    Create Deal Capsule
                                          ↓
                                    inngest: deal.created
                                          ↓
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                         Graph Ingest  Run Agents  Notify User
                              │            │            │
                              ▼            ▼            ▼
                         Deal Node    Research +    "New deal
                         + Property   Supply +     from Marcus
                         + Market     Zoning +     & Millichap"
                         edges        CashFlow
```

### Wiring Needed
1. `email-classification.service.ts` → After classifying as deal, call `graph-ingestion-listener`
2. `email-property-automation.service.ts` → After creating deal from email, emit graph events
3. `inline-deals.routes.ts` → After deal.created event, add graph ingestion step
4. `capsule.routes.ts` → After document upload, create Document node

---

## 6. NEWS → GRAPH FLOW (The Other Missing Link)

### Current Flow (Broken)
```
News RSS → news.service.ts → Store in news_articles table
                                          ↓
                                    STOPS HERE ❌
```

### Desired Flow
```
News RSS → news.service.ts → Store article
                                    ↓
                         market-event-extraction.service.ts
                                    ↓
                              Extract Events
                              ("500 units approved in Midtown")
                                    ↓
                              Graph Ingest
                              Event node + AFFECTS edges
                                    ↓
                              Context Awareness
                              (surfaces in supply pipeline expansion)
                                    ↓
                              Supply Agent
                              (auto-triggered to verify)
```

---

## 7. INTERNET SEARCH STRATEGY

When the graph has gaps, agents use these tools to search the internet:

| Tool | Source | Best For |
|------|--------|----------|
| `web_search` | DuckDuckGo | General queries |
| `fetch_webpage` | Any URL | Scrape specific pages |
| `fetch_costar_metrics` | CoStar | Market data |
| `fetch_costar_pipeline` | CoStar | Development pipeline |
| `fetch_municode` | Municode.com | Zoning codes |
| `fetch_permits` | County portals | Building permits |
| `read_gmail_thread` | Gmail | Email context |

### Search Priority Order
1. **Internal data first** (Data Matrix, Knowledge Graph, Archive)
2. **Government APIs** (FRED, BLS, Census, County GIS)
3. **Paid data** (CoStar, apartments.com)
4. **Web search** (DuckDuckGo, Google)
5. **LLM reasoning** (DeepSeek for cheap analysis, Haiku for judgment)

---

## Implementation Order

### Phase 1: Deal Pipeline (Critical Path)
1. Wire `inline-deals.routes.ts` → graph ingestion on deal.created
2. Wire `capsule.routes.ts` → graph ingestion on document upload
3. Wire `email-classification.service.ts` → graph events
4. Wire `email-property-automation.service.ts` → graph events

### Phase 2: News & Events
5. Wire `market-event-extraction.service.ts` → graph events
6. Wire `newsletter-parser.service.ts` → graph events
7. Wire `news.service.ts` → article nodes

### Phase 3: Property Data
8. Wire `enrichment-orchestrator.ts` → update property nodes
9. Wire `georgia-orchestrator.ts` → bulk property ingestion
10. Wire `property-discovery.service.ts` → new property nodes

### Phase 4: All Agents
11. Wire `zoning.inngest.ts` → graph updates
12. Wire `cashflow.agent.ts` → graph updates
13. Wire `commentary.inngest.ts` → graph updates

### Phase 5: External Data
14. Wire `fred-ingest.service.ts` → metric nodes
15. Wire `bls-api.client.ts` → metric nodes
16. Wire `census-acs-ingest.service.ts` → demographic nodes
17. Wire `zillow-zhvi-ingest.service.ts` → market metric nodes
