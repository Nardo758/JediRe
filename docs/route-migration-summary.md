# Route Migration Summary — Task #132

**Date:** March 28, 2026
**Goal:** Migrate all user-facing routes off the old 3-ticker MainLayout to either standalone (full-screen) rendering or terminal redirects.

---

## Standalone Pages (moved outside MainLayout — render full-screen)

| Route | Page Component | Content |
|---|---|---|
| `/news` | NewsPage | 4-view intelligence hub: Event Feed (with impact quantification), Market Dashboard, Network Intelligence (contact credibility), Alerts |
| `/deals` | DealsPage | Full pipeline grid with 20+ columns, Mapbox map with deal boundaries, CSV export, quadrant/tier/rank filters |
| `/deals/create` | CreateDealPage | 6-step deal creation wizard: name/address, deal type, category, property type, documents/data upload, trade area definition (with Mapbox map) |
| `/deals/:dealId/detail` | DealDetailPage | 14-tab deal workstation (F1-F14): Overview, Zoning, Market Intel, Supply Pipeline, Strategy, Traffic, 3D Design, Pro Forma, Capital/Exit, Comps, Documents, Execution (timeline/PM/construction/closing/Opus AI), Risk, AI Agent |
| `/deals/:dealId/flywheel` | DealFlywheelDashboard | Full-screen deal flywheel dashboard |
| `/deals/:dealId/design` | Design3DPage | Full-screen 3D design/massing view |
| `/properties` | PropertiesPage | Property portfolio grid: search bar, building class & neighborhood filters, stats summary row, property cards with lease info |
| `/properties/:id` | PropertyDetailsPage | Individual property detail view with metrics |
| `/market-intelligence/property/:id` | PropertyDetailsPage | Same property detail component (alternate route) |
| `/property-card`, `/property-card/:id` | PropertyCardPage | Bloomberg-style property card: breadcrumb nav, photo gallery, key metrics (units, built, occupancy, cap rate), financials (concessions, NOI, revenue, expenses, absorption), peer comparison table, JEDI score, quick-switch between 7 properties |
| `/capsules` | DealCapsulesPage | Capsule dashboard: stats bar (total capsules, avg JEDI score, total deal value, active analysis), searchable/sortable table with JEDI scores & status badges, creation modal (upload OM, manual entry, or email forward) |
| `/capsules/:id` | CapsuleDetailPage | 3-layer deal analysis: broker truth vs. market reality vs. user model, collision analysis, AI agent chat, ML training status |
| `/leasing-forecast/:propertyId` | LeasingForecastPage | 12-week leasing projection: weekly breakdown table, summary KPIs, Excel export |
| `/assets-owned/:dealId/property` | PortfolioPropertyPage | 4-tab owned asset dashboard: Financials, Leasing, Unit Mix, Traffic |

---

## Redirected Pages (legacy routes now point to terminal sections)

| Old Route(s) | Redirects To | What It Replaced |
|---|---|---|
| `/settings/modules`, `/settings/module-libraries`, `/settings/module-libraries/:module`, `/settings/email`, `/settings/marketplace`, `/settings/strategies` | `/terminal/settings` | Individual settings sub-pages (modules list, module library browser, email settings, marketplace, strategy builder) |
| `/strategies`, `/strategies/:id` | `/terminal/strategies` | Strategy control panel & individual strategy builder |
| `/opportunities` | `/terminal/strategies` | "Coming Soon" placeholder page |
| `/map` | `/terminal/dashboard` | Placeholder page with "coming soon" Mapbox map |
| `/dashboard/contents` | `/terminal/dashboard` | Navigation hub (just links to other pages) |
| `/dashboard`, `/dashboard/email/*` | `/terminal/dashboard` | Old dashboard & email sub-routes |
| `/tasks`, `/reports` | `/terminal/reports` | Task list & reports pages |
| `/team` | `/terminal/settings` | Team management page |
| `/market-data/*`, `/market-research/*`, `/market-intelligence/*` (non-content), `/competitive-intelligence/*`, `/news-intel/*`, `/strategy-builder/*` | Respective terminal sections | Old market/intel/strategy routes |

---

## Kept in MainLayout (admin/dev tools only)

| Route | Page Component | Content |
|---|---|---|
| `/admin` | AdminDashboard | Admin overview |
| `/admin/command-center` | CommandCenterPage | System command center |
| `/admin/property-coverage` | PropertyCoveragePage | Property data coverage tracking |
| `/admin/data-tracker` | DataTrackerPage | Data pipeline monitoring |
| `/admin/intelligence` | IntelligenceDashboard | Intelligence system dashboard |
| `/architecture` | SystemArchitecturePage | System architecture diagrams (dev tool) |
| `/demo/m28-widgets` | M28WidgetsDemo | Widget demo page |
| `/demo/flywheel` | DealFlywheelDashboard | Flywheel demo |

---

## Key File

- `frontend/src/App.tsx` — all route definitions
