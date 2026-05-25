# Trade Press Ingest — Design Document

**Task:** #1070
**Date:** 2026-05-25
**Status:** DESIGN ONLY — no scraping code implemented in this document
**Scope:** Per-source inventory, robots.txt compliance, technical architecture,
LLM extraction design, deduplication strategy, cost estimates, and licensing roadmap.
Pipeline objective: `DevelopmentAnnouncement` extraction from CRE trade press.

---

## §1 Infrastructure Baseline

The platform already has a functioning trade press fetch layer across two paths. Understanding
both is necessary to avoid duplicating infrastructure and to identify what needs to be
extended vs. replaced.

### Path A — Scheduled Discovery (`cre-rss.ts`)

`backend/src/services/discovery/sources/cre-rss.ts`

- `CRE_FEEDS` map: hardcoded RSS registry polled by the discovery engine
- Token-bucket rate limiting: 1 req/sec global, burst 3; 5-minute backoff on 429/503
- User-Agent: `JediRE/1.0 (+https://jedire.app) CRE-News-Aggregator`
- `canonicalizeUrl()` already implemented here — strips UTM params, lowercases host,
  removes fragment. Reuse directly in the new pipeline.
- **Known bug — Bisnow:** All entries use stale `/feed/` pattern (404); correct pattern is
  `/rss/{market}` (verified working in `bisnow.provider.ts`)
- **Known dead entry — MFE:** `multifamilyexecutive.com/rss` returns 404 silently
- Covers: GlobeSt (stale URL), Bisnow (stale URLs), Connect CRE, REJournals, MFE, MHN,
  BiggerPockets, SEC EDGAR 8-K, Reddit

### Path B — Provider-Based (`news.service.ts`)

`backend/src/services/news/news.service.ts` + `backend/src/services/news/providers/`

Registered providers: `bisnow`, `globest` (proxied → Commercial Observer + Trepp +
PropModo), `housingwire`. These providers serve on-demand news queries with credit metering.
They do **not** persist articles to a platform table — each query refetches.

**Gap:** Neither path writes to a persistent platform-level article store. The new pipeline
must land articles in a `trade_press_articles` table to enable LLM extraction, dedup, and
operator alerts.

### SSRF Protection

`safeFetchText()` in `backend/src/services/news-connections/ssrf-guard.ts`:
- Hostname-level rejection (localhost, 0.0.0.0, private literal IPs)
- DNS resolution across all A/AAAA records (blocks 10.x, 127.x, 169.254.x, link-local, ULA)
- Custom `safeLookup` callback re-validates at TCP connect time (defeats DNS rebinding)
- Manual redirect following with full guard re-run on every hop (max 3)
- 5 MB body cap, 10-second timeout

All article full-body fetches in the new pipeline must route through `safeFetchText()`.
Do not modify `ssrf-guard.ts` (out of scope).

### Existing Canonicalization

`canonicalizeUrl()` in `cre-rss.ts`: strips UTM params, lowercases scheme+host, removes
fragment. `dedupeKey(userId, canonical)` produces the SHA-256 hash used as the unique
constraint in `user_news_items`. The new pipeline reuses the same canonicalization + hash
pattern without the `userId` dimension.

---

## §2 Per-Source Investigation

### 2.1 Bisnow

**Profile:** National CRE news + events. Strongest for deal announcements, groundbreakings,
tenant signings. Regional granularity across 17+ metro markets.
**Coverage:** Office, multifamily, retail, industrial, hospitality, capital markets
**Audience:** Brokers, developers, investors, lenders
**CRE relevance:** High — deal announcements surface 6–18 months before CoStar reflects them

**RSS Status:** WORKING (verified 2026-05-25)

| Feed | URL | Items | Window |
|------|-----|-------|--------|
| National | `https://www.bisnow.com/rss/national` | ~30 | ~70 days |
| Atlanta | `https://www.bisnow.com/rss/atlanta` | ~30 | 1–2 weeks |
| South Florida | `https://www.bisnow.com/rss/south-florida` | ~30 | 1–2 weeks |
| Dallas–Fort Worth | `https://www.bisnow.com/rss/dallas-ft-worth` | ~30 | 1–2 weeks |
| Tampa Bay | `https://www.bisnow.com/rss/tampa-bay` | ~30 | 1–2 weeks |
| Charlotte | `https://www.bisnow.com/rss/charlotte` | ~30 | 1–2 weeks |
| Nashville | `https://www.bisnow.com/rss/nashville` | ~30 | 1–2 weeks |
| New York | `https://www.bisnow.com/rss/new-york` | ~30 | 1–2 weeks |
| Austin–San Antonio | `https://www.bisnow.com/rss/austin-san-antonio` | ~30 | 1–2 weeks |
| Houston | `https://www.bisnow.com/rss/houston` | ~30 | 1–2 weeks |

Full regional pattern: `https://www.bisnow.com/rss/{market}` where markets include all of
the above plus: `los-angeles`, `chicago`, `phoenix`, `boston`, `washington-dc`,
`san-francisco`, `denver`, `seattle`.

**Body in RSS:** Headline + ~300-char HTML-stripped excerpt only (`hasFullContent: false`).
Full body requires a second fetch to the article URL.

**robots.txt** (`https://www.bisnow.com/robots.txt`, verified 2026-05-25):

| Path | Rule |
|------|------|
| `/admin/*` | Disallow |
| `/newsletters/*` | Disallow |
| `/user/*` | Disallow |
| `/events/*` | Disallow |
| `/videos/watch/*` | Disallow |
| `/archives/*` | Disallow |
| `/preview_story/*` | Disallow |
| `/more-news` | Disallow |
| `/rss/*` | **Not disallowed** ✓ |
| `Crawl-delay` | Not specified |
| Sitemap | `https://www.bisnow.com/sitemap/xml` |

**Estimated volume:** ~8–12 new CRE deal-relevant articles/day across national + top 10
regional feeds combined.

**Recommended access pattern:** RSS polling — national + 9 regional feeds listed above.
Poll interval: 4 hours for national; 8 hours for regional. Follow with article-URL fetch
for full body (for LLM extraction quality — excerpt alone is insufficient for address-level
`DevelopmentAnnouncement` fields).

**Current registry bug:** `cre-rss.ts` uses `/feed/` and `/national/feed/` (all 404).
Must be corrected to `/rss/{market}` across all entries.

---

### 2.2 GlobeSt

**Profile:** Long-form CRE analysis. Owned by ALM Media.
**Coverage:** Office, retail, multifamily, industrial, capital markets — sector-depth focus
**Audience:** Institutional investors, developers, brokers

**RSS Status:** PERMANENTLY DEAD — confirmed 2026-05-25

| URL Attempted | Result |
|--------------|--------|
| `globest.com/feed/` | HTTP 404 — `Can't find the page you are looking for` |
| `globest.com/rss` | Returns an RSS directory page listing legacy FeedBlitz URLs |

**FeedBlitz legacy feeds:** `globest.com/rss` lists market-specific feeds at
`feeds.feedblitz.com/globest/{market}` (Chicago, Dallas, LA, etc.). These are hosted on
FeedBlitz's CDN and were not probed individually — their current status is unknown. They
represent GlobeSt's pre-ALM RSS infrastructure and should be treated as potentially active
but unmaintained.

**Current platform approach:** `globest.provider.ts` silently proxies to three working
replacements that cover the same CRE sectors:

| Replacement | URL | Items | Focus |
|------------|-----|-------|-------|
| Commercial Observer | `https://commercialobserver.com/feed/` | ~17/day | Deals, leasing, sales |
| Trepp | `https://www.trepp.com/trepptalk/rss.xml` | ~10/9 days | CMBS, debt, distress |
| PropModo | `https://www.propmodo.com/feed/` | ~10/2 days | CRE tech, operations |

**robots.txt** (`https://www.globest.com/robots.txt`, verified 2026-05-25):

| Directive | Value |
|-----------|-------|
| `Crawl-delay` | **1 second** (explicitly specified) |
| `ai-train` | `no` (Content-Signal header — prohibits AI training use) |
| `Allow: /` | Catch-all allow for `*` user-agent |
| Sitemap | `https://www.globest.com/sitemap.xml` |

**Important:** The `ai-train=no` directive in the Content-Signal header indicates GlobeSt
explicitly prohibits use of their content for AI model training. The new pipeline's
extraction step is inference (not training), which is a distinct use. However, this signal
flags elevated legal sensitivity — document and monitor.

**Recommendation:** Do NOT re-add GlobeSt direct RSS to the registry. The FeedBlitz feeds
are unmaintained; the direct `/feed/` is dead. Continue routing via Commercial Observer,
Trepp, and PropModo as the existing `globest.provider.ts` does. These three sources serve
as GlobeSt's functional replacement and have clear, permissive robots.txt postures.

---

### 2.3 Connect CRE

**Profile:** Concise deal-announcement news. Short, structured transaction summaries.
**Coverage:** Sales, leasing, financing, development — national with regional market focus
**Audience:** Brokers, investors, developers
**CRE relevance:** High — deal summaries directly map to `DevelopmentAnnouncement` fields

**RSS Status:** WORKING (verified 2026-05-25)

| Feed | URL | Items |
|------|-----|-------|
| National (all stories) | `https://www.connectcre.com/stories/feed/` | 32+ |
| National (root) | `https://www.connectcre.com/feed/` | 32+ (same content) |

**Regional edition feeds:** Attempted `/location/{region}/feed/` paths for West, Texas,
Florida, Southeast, Midwest — all return full WordPress HTML page (61 KB), not RSS. Connect
CRE does not publish regional RSS feeds; regional content is mixed into the national feed.

**Body in RSS:** Short deal summary (~300 chars). Most Connect CRE articles are 200–400
words — full body adds meaningful context for address, developer, and unit_count fields.

**robots.txt** (`https://www.connectcre.com/robots.txt`, verified 2026-05-25):

| Path | Rule |
|------|------|
| `/feed` (no trailing slash) | Disallow (ambiguous — may match `/feed/`) |
| `/feed?` | Disallow |
| `/events/` | Disallow |
| `/wp-admin/` | Disallow |
| `/stories/feed/` | **Not disallowed** ✓ |
| `Crawl-delay` | Not specified |

**Compliance note:** Use `/stories/feed/` — this path is explicitly not disallowed and
avoids the ambiguity of the `/feed` rule.

**Estimated volume:** ~15–20 new deal-relevant articles/day.

**Recommended access pattern:** RSS polling at `connectcre.com/stories/feed/`, every 4
hours. Follow with article URL fetch for full body.

---

### 2.4 REBusinessOnline

**Profile:** Regional CRE transactions and market reports. Owned by France Media.
**Coverage:** Southeast, Southwest, Texas, Midwest, West. Retail, office, industrial, MF.
**Audience:** Brokers, investors, developers
**CRE relevance:** High — strong deal transaction coverage, especially Sun Belt markets
**Not currently in any registry — this is a gap.**

**RSS Status:** WORKING (verified 2026-05-25)
**URL:** `https://rebusinessonline.com/feed/` — WordPress RSS, 24 KB body, active

**Body in RSS:** Title + excerpt (~300 chars). Full body requires article URL fetch.

**robots.txt** (`https://rebusinessonline.com/robots.txt`, verified 2026-05-25):

| Directive | Value |
|-----------|-------|
| `Disallow` | (blank — allows everything) |
| `Crawl-delay` | Not specified |
| Sitemap | `http://rebusinessonline.com/sitemap_index.xml` |

Most permissive robots.txt of all sources investigated. Yoast SEO default — intentionally
open.

**Estimated volume:** ~5–8 new deal-relevant articles/day.

**Recommended access pattern:** RSS polling at `rebusinessonline.com/feed/`, every 4 hours.
Follow with article URL fetch for full body. This is the highest-value gap source: working
feed, zero access friction, fully permissive robots.txt. **Add immediately.**

---

### 2.5 Multi-Housing News (MHN)

**Profile:** Long-form multifamily analysis, property transactions, market data.
Owned by Yardi Systems.
**Coverage:** Multifamily, affordable housing, student housing, senior housing
**Audience:** Property managers, investors, developers, lenders
**CRE relevance:** Medium-high — strong on multifamily deal announcements and groundbreakings

**RSS Status:** WORKING (verified 2026-05-25)
**URL:** `https://www.multihousingnews.com/feed/` — WordPress RSS

**Body in RSS:** Excerpt only (300–500 chars). Full body requires article URL fetch.
Articles are 500–1,500 words; full body significantly improves address and unit_count
extraction accuracy.

**robots.txt** (`https://www.multihousingnews.com/robots.txt`, verified 2026-05-25):

| Path | Rule |
|------|------|
| `/rss/` | Disallow (blocks `/rss/` sub-path) |
| `/rss-feeds/` | Disallow (blocks feed directory page) |
| `/feed/` | **Not disallowed** ✓ |
| `/wp-admin` | Disallow |
| `/search/` | Disallow |
| `/tag/` | Disallow |
| `Crawl-delay` | Not specified |
| Bot blocks | `owlin bot`, `owlin bot v.3.0`, `mj12bot`, `naver`, `charlotte` explicitly blocked by UA |

JediRE's honest `JediRE/1.0` User-Agent is not in the block list. The `/feed/` path is
clear. Note that MHN explicitly blocks known news-aggregation bots, indicating awareness
of the aggregation use case.

**Estimated volume:** ~4–6 new multifamily deal-relevant articles/day.

**Recommended access pattern:** RSS polling at `multihousingnews.com/feed/`, every 6 hours.
Follow with article URL fetch for full body.

---

### 2.6 Multifamily Executive (MFE)

**Profile:** Builder/developer-oriented multifamily news. Owned by Zonda.
**Coverage:** Multifamily construction, design, technology, finance, policy
**Audience:** Multifamily developers, builders
**CRE relevance:** Medium — development-focused but less deal-transaction coverage than MHN

**RSS Status:** DEAD — no working endpoint found (verified 2026-05-25)

| URL Attempted | Result |
|--------------|--------|
| `multifamilyexecutive.com/rss` | HTTP 404 |
| `multifamilyexecutive.com/rss.xml` | Drupal HTML page (not RSS XML) |
| `multifamilyexecutive.com/feed/` | HTTP 404 |

MFE runs on Drupal CMS. WordPress `/feed/` and `/rss` patterns do not apply. No active
RSS endpoint was discovered.

**robots.txt** (`https://www.multifamilyexecutive.com/robots.txt`, verified 2026-05-25):
Standard Drupal rules — no RSS disallows, but the paths 404 regardless. No Crawl-delay.

**Alternative access — sitemap crawl:**
MFE's `sitemap_index.xml` (linked from robots.txt) would support a sitemap-discovery +
per-article-fetch approach. This requires a separate ToS review and is NOT recommended for
Phase 1 due to the additional implementation complexity and ToS uncertainty.

**MHN vs MFE coverage overlap:** Both cover multifamily. MHN has a working RSS and broader
deal transaction coverage. MFE's Drupal site focuses more on design and operational
articles. For supply pipeline intelligence, MHN is higher-value.

**Recommendation:** Remove MFE from `cre-rss.ts` registry (current entry silently 404s).
Document as "sitemap-accessible, RSS-dead" and revisit in Phase 2 or later with a
sitemap-based crawler after explicit ToS review.

---

### 2.7 CoStar News

**Profile:** Authoritative CRE market intelligence. Owned and operated by CoStar Group.
**Coverage:** All CRE asset classes, all major US markets
**Audience:** Institutional investors, brokers, developers, lenders
**CRE relevance:** Highest — CoStar data reflects confirmed, structured deal intelligence
**Access:** Already integrated via CoStar API subscription

**Current integration:**

| Tool | File | Content fetched |
|------|------|----------------|
| `fetch_costar_pipeline` | `backend/src/agents/tools/fetch_costar_pipeline.ts` | Units under construction, planned, permitted; 12/24-month deliveries; pipeline as % of stock; months of supply; absorption rate |
| `fetch_costar_metrics` | `backend/src/agents/tools/fetch_costar_metrics.ts` | Vacancy, effective rent, absorption, cap rates, price/unit — submarket level |

**Is editorial news content separate from market data?**
Yes. CoStar's API subscription delivers structured market data (metrics, pipeline, comps).
CoStar News editorial content (`costar.com/news`) is a separate product delivered via the
CoStar web UI and subscriber email — it is NOT available as a data feed or API endpoint
within the existing API subscription. CoStar News articles would require a separate media
licensing arrangement.

**What IS available via the API (relevant to `DevelopmentAnnouncement`):**

The `development_projects` table (populated by CoStar API) contains:
`construction_status` (planned/permitted/under_construction/delivered), `units`,
`expected_delivery`, `groundbreaking_date`, `developer`, `data_source = 'costar'`.

This is **structured supply pipeline data**, not editorial news. For the trade press ingest
pipeline, CoStar data serves as a **verification and enrichment layer** — after LLM
extraction produces a `DevelopmentAnnouncement` from a trade press article, the record can
be cross-referenced against `development_projects` to confirm CoStar has or has not yet
picked up the project.

**Recommended access pattern:** Already integrated — no additional RSS or fetch pipeline.
Use `development_projects` table as the post-extraction verification step:
```sql
SELECT id FROM development_projects
WHERE developer ILIKE '%{developer_name}%'
  AND city = '{city}'
  AND ABS(units - {unit_count}) < 50
  AND data_source = 'costar'
```
If a matching row exists, the `DevelopmentAnnouncement` is CoStar-confirmed; if not, it
represents a lead-time opportunity (6–18 months before CoStar ingestion).

---

### 2.8 The Real Deal / Commercial Observer

**Profile:** The Real Deal — premier CRE publication with investigative reporting and
transaction databases. Commercial Observer — New York-focused but national CRE deals coverage.
**Coverage:** NYC (TRD primary), national, South Florida, LA, Chicago, San Francisco
**Audience:** Investors, developers, brokers, finance, policy

#### The Real Deal (Gap — not in any registry)

**RSS Status:** PARTIAL (verified 2026-05-25)

| URL Attempted | Result |
|--------------|--------|
| `therealdeal.com/feed/` | Returns full JS-rendered HTML — no XML |
| `therealdeal.com/national/feed/` | **Working RSS — ~10 items, permissive** ✓ |

Regional feeds (`/new-york/feed/`, `/south-florida/feed/`, etc.) follow the same WordPress
pattern and are expected to be active but were not individually verified.

**Paywall structure:** TRD employs metered access (~3–5 free articles/month per browser via
cookie). RSS items contain title + excerpt without hitting the paywall gate. Full-body fetch
via `safeFetchText()` reaches the full article text without authentication on most articles
(metering is browser-cookie-based, not server-side auth). Do NOT attempt to circumvent
hard paywall gates or inject authentication cookies.

**Body in RSS:** Title + excerpt (~200 chars). Full body available via article URL fetch
on most articles.

**robots.txt** (`https://therealdeal.com/robots.txt`, verified 2026-05-25):

| Path | Rule |
|------|------|
| `/wp-admin/`, `/wp-includes/`, `/wp-json/` | Disallow |
| `/api/`, `/wp-*.php` | Disallow |
| `/?p=*`, `/?locale=*`, `/?altu=*` | Disallow |
| `/national/feed/` | **Not disallowed** — `Allow: *` catch-all ✓ |
| `Crawl-delay` | Not specified |
| Sitemap | `https://therealdeal.com/sitemap_index.xml` |

**Estimated volume:** ~5–8 national deal-relevant articles/day.

**Recommended access pattern:** RSS polling at `therealdeal.com/national/feed/`, every
4 hours. Add regional feeds (New York, South Florida, LA) in Phase 2 once volume is
confirmed. Follow with article URL fetch for full body.

#### Commercial Observer (already integrated)

Embedded in `globest.provider.ts` at `https://commercialobserver.com/feed/`.

**robots.txt** (`https://commercialobserver.com/robots.txt`, verified 2026-05-25):
- `Disallow: /wp-admin/`, `Disallow: /wp-content/uploads/sites/3/wpforms/`
- `/feed/` path: Not disallowed ✓
- No Crawl-delay specified

**Body in RSS:** ~17 items/day, 1-day window. Headline + excerpt. Full body requires fetch.

**Recommended access pattern:** Existing `globest.provider.ts` registration handles headlines.
For the `trade_press_articles` pipeline, add `commercialobserver.com/feed/` directly to
the registry as a named source (rather than routing through the globest provider).

---

## §3 robots.txt Compliance Table

Verified live 2026-05-25. "Feed path" = the recommended URL for the new pipeline.

| Source | Feed Path | Crawl-delay | Disallows Feed Path? | Status |
|--------|-----------|-------------|---------------------|--------|
| Bisnow | `/rss/national`, `/rss/{market}` | None | No | ✅ PERMITTED |
| GlobeSt | (no working feed — see §2.2) | **1 second** | N/A (dead) | ⚠️ DEAD — use CO/Trepp/PropModo |
| Connect CRE | `/stories/feed/` | None | No (unambiguous path) | ✅ PERMITTED |
| REBusinessOnline | `/feed/` | None | No (fully open) | ✅ PERMITTED |
| Multi-Housing News | `/feed/` | None | No (`/rss/` ≠ `/feed/`) | ✅ PERMITTED |
| Multifamily Executive | (no working feed) | None | N/A (dead) | ⚠️ DEAD — sitemap only |
| CoStar News editorial | N/A — API subscription | N/A | N/A | ✅ VIA API CONTRACT |
| The Real Deal | `/national/feed/` | None | No (`Allow: *` catch-all) | ✅ PERMITTED |
| Commercial Observer | `/feed/` | None | No | ✅ PERMITTED |
| Trepp | `/trepptalk/rss.xml` | None | No | ✅ PERMITTED |
| PropModo | `/feed/` | None | No | ✅ PERMITTED |

**GlobeSt special note:** `globest.com` robots.txt includes `ai-train=no` in a
Content-Signal header. This prohibits using GlobeSt content for AI model training. The
pipeline's inference step (extracting fields from an article) is distinct from training.
Nonetheless, GlobeSt direct access is moot since `/feed/` is dead. If FeedBlitz feeds
are activated in future, re-verify this directive.

---

## §4 Recommended Access Pattern per Source

| Source | Access Mode | Feed / Entry URL | Poll Interval | Full Body Fetch? |
|--------|------------|-----------------|---------------|-----------------|
| Bisnow (national) | RSS polling | `bisnow.com/rss/national` | 4 hours | Yes — excerpt insufficient |
| Bisnow (9 regional) | RSS polling | `bisnow.com/rss/{market}` | 8 hours | Yes |
| GlobeSt | — | Routed via CO + Trepp + PropModo | — | — |
| Connect CRE | RSS polling | `connectcre.com/stories/feed/` | 4 hours | Yes |
| REBusinessOnline | RSS polling | `rebusinessonline.com/feed/` | 4 hours | Yes |
| Multi-Housing News | RSS polling | `multihousingnews.com/feed/` | 6 hours | Yes |
| Multifamily Executive | Deferred | Sitemap crawl (Phase 2+) | N/A | Yes |
| CoStar News editorial | Already integrated | `development_projects` table | Existing | N/A |
| The Real Deal | RSS polling | `therealdeal.com/national/feed/` | 4 hours | Yes |
| Commercial Observer | RSS polling | `commercialobserver.com/feed/` | 4 hours | Yes |
| Trepp | RSS polling | `trepp.com/trepptalk/rss.xml` | 6 hours | Yes |
| PropModo | RSS polling | `propmodo.com/feed/` | 8 hours | Lower priority |

**Full-body fetch notes:**
- RSS excerpts are 200–500 chars — insufficient to reliably extract `address`, `unit_count`,
  `developer_name`, and `transaction_amount` for the `DevelopmentAnnouncement` entity
- `safeFetchText()` must be used for all article URL fetches
- Apply per-source Crawl-delay: 1 second minimum between requests to the same domain;
  GlobeSt domains: 1-second explicit delay if ever reactivated
- User-Agent for article fetches: retain the browser UA already in `ssrf-guard.ts`
  (`Mozilla/5.0 ... Chrome/126.0.0.0`) — many publisher CDNs block obvious bot UAs
- Apply article fetch only after keyword pre-filter passes (§9.3) — do not fetch full body
  for articles that cannot be `DevelopmentAnnouncement` candidates

---

## §5 Technical Architecture

### 5.1 Storage Schema

#### `trade_press_articles` — raw article store

```sql
CREATE TABLE trade_press_articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        TEXT NOT NULL,          -- 'bisnow', 'connectcre', 'mhn', etc.
  url              TEXT NOT NULL,
  url_hash         TEXT NOT NULL UNIQUE,   -- SHA-256(canonicalizeUrl(url))
  headline         TEXT NOT NULL,
  body_text        TEXT,                   -- NULL until full-body fetch runs
  excerpt          TEXT,                   -- From RSS description field
  author           TEXT,
  published_at     TIMESTAMPTZ,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  body_fetched_at  TIMESTAMPTZ,           -- When full-body fetch completed
  content_hash     TEXT,                  -- SHA-256(body_text) for cross-source dedup
  extraction_status TEXT NOT NULL DEFAULT 'pending',
                                          -- pending | body_needed | extracted | skipped | failed
  extracted_at     TIMESTAMPTZ,
  source_metadata  JSONB                  -- Feed-specific fields (image, categories, etc.)
);

CREATE INDEX tpa_source_published   ON trade_press_articles(source_id, published_at DESC);
CREATE INDEX tpa_published          ON trade_press_articles(published_at DESC);
CREATE INDEX tpa_extraction_pending ON trade_press_articles(extraction_status)
  WHERE extraction_status IN ('pending', 'body_needed');
CREATE INDEX tpa_content_hash       ON trade_press_articles(content_hash)
  WHERE content_hash IS NOT NULL;
```

#### `development_announcements` — extracted entity store

```sql
CREATE TABLE development_announcements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Extracted fields (from LLM — see §6)
  address               TEXT,
  city                  TEXT,
  state                 CHAR(2),
  developer_name        TEXT,
  project_name          TEXT,
  unit_count            INTEGER,
  asset_class           TEXT,    -- multifamily | office | retail | industrial | mixed_use | other
  deal_type             TEXT,    -- announcement | groundbreaking | completion | sale | lease
  deal_date             DATE,
  transaction_amount    NUMERIC(18,2),  -- USD; null if not stated
  -- Source linkage
  primary_article_id    UUID REFERENCES trade_press_articles(id),
  source_urls           TEXT[]  NOT NULL DEFAULT '{}',  -- All articles covering this deal
  source_names          TEXT[]  NOT NULL DEFAULT '{}',  -- Corresponding source_id values
  -- Quality
  extraction_confidence NUMERIC(3,2),  -- 0.00–1.00
  field_citations       JSONB,         -- Per-field citation passages (see §6)
  -- Lifecycle
  merged_into           UUID REFERENCES development_announcements(id),  -- Cross-source merge
  operator_reviewed     BOOLEAN DEFAULT FALSE,
  costar_confirmed      BOOLEAN DEFAULT FALSE,  -- Matched in development_projects table
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX da_city_state      ON development_announcements(city, state);
CREATE INDEX da_deal_type       ON development_announcements(deal_type);
CREATE INDEX da_published_range ON development_announcements(created_at DESC);
CREATE INDEX da_merged          ON development_announcements(merged_into)
  WHERE merged_into IS NOT NULL;
```

#### `trade_press_rss_sources` — DB-managed registry

Replaces the hardcoded `CRE_FEEDS` map to allow admin management without deploys:

```sql
CREATE TABLE trade_press_rss_sources (
  id              SERIAL PRIMARY KEY,
  source_id       TEXT NOT NULL UNIQUE,
  source_name     TEXT NOT NULL,
  feed_url        TEXT NOT NULL,
  market          TEXT,             -- NULL = national
  asset_class     TEXT,             -- multifamily | office | retail | all
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  poll_interval_h INTEGER NOT NULL DEFAULT 4,
  crawl_delay_s   INTEGER NOT NULL DEFAULT 1,
  last_polled_at  TIMESTAMPTZ,
  last_error      TEXT,
  robots_verified DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 Rate Limiting Architecture

Extend the existing TokenBucket from `cre-rss.ts` with domain-level isolation:

```typescript
// Global bucket: 1 req/sec, burst 3 (existing — keep)
const globalBucket = new TokenBucket({ tokensPerSecond: 1, burst: 3 });

// Per-domain buckets: max 0.5 req/sec per domain (new)
const domainBuckets = new Map<string, TokenBucket>();

function getDomainBucket(url: string): TokenBucket {
  const domain = new URL(url).hostname;
  if (!domainBuckets.has(domain)) {
    domainBuckets.set(domain, new TokenBucket({
      tokensPerSecond: 0.5,  // 1 request per 2 seconds per domain
      burst: 2,
    }));
  }
  return domainBuckets.get(domain)!;
}

// At fetch time: consume global + domain bucket
async function rateLimitedFetch(url: string): Promise<string> {
  await globalBucket.consume();
  await getDomainBucket(url).consume();
  return safeFetchText(url);
}
```

Backoff: 5-minute backoff on 429 or 503 (retain existing `cre-rss.ts` behavior).

### 5.3 Full-Body Fetch Pipeline

```
RSS poll cycle (Inngest cron per source, on poll_interval_h schedule):
  → safeFetchText(feed_url)
  → parseStringPromise(xml)                    ← xml2js
  → for each item:
      → canonical = canonicalizeUrl(item.link)  ← reuse from cre-rss.ts
      → url_hash = SHA-256(canonical)
      → INSERT INTO trade_press_articles
            (source_id, url, url_hash, headline, excerpt, author, published_at)
          ON CONFLICT (url_hash) DO NOTHING     ← within-source dedup
  → UPDATE trade_press_rss_sources SET last_polled_at = NOW()

Full-body fetch cycle (Inngest cron, every 30 minutes):
  → SELECT * FROM trade_press_articles
      WHERE extraction_status IN ('pending', 'body_needed')
        AND body_text IS NULL
        AND published_at > NOW() - INTERVAL '7 days'
      ORDER BY published_at DESC
      LIMIT 100
  → applyKeywordPreFilter(articles)            ← §9.3 — skip obvious non-announcements
  → for each article passing filter:
      → rateLimitedFetch(article.url)           ← safeFetchText + domain bucket
      → extract visible text from HTML          ← strip scripts, nav, ads
      → UPDATE trade_press_articles SET
            body_text = extracted_text,
            content_hash = SHA-256(extracted_text),
            body_fetched_at = NOW(),
            extraction_status = 'pending'
  → for each article NOT passing filter:
      → UPDATE trade_press_articles SET extraction_status = 'skipped'

LLM extraction cycle (Inngest cron, every 1 hour):
  → SELECT * FROM trade_press_articles
      WHERE extraction_status = 'pending'
        AND body_text IS NOT NULL
      ORDER BY published_at DESC
      LIMIT 50
  → for each article:
      → buildExtractionPrompt(article)           ← §6.3
      → call Claude claude-3-5-haiku-20241022
      → parseAnnouncementResult()
      → if extraction_confidence >= 0.60:
          → INSERT INTO development_announcements
          → UPDATE trade_press_articles SET extraction_status = 'extracted'
      → else:
          → UPDATE trade_press_articles SET extraction_status = 'skipped'
  → crossSourceMerge()                          ← §8 — merge entities across sources
```

### 5.4 User-Agent Strategy

| Fetch type | User-Agent | Reason |
|-----------|-----------|--------|
| RSS feed fetch | `JediRE/1.0 (+https://jedire.app) CRE-News-Aggregator` | Honest identification per existing `cre-rss.ts` convention |
| Article full-body fetch | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36` | Cloudflare/Akamai WAF on publisher CDNs blocks obvious bot UAs; already in `ssrf-guard.ts` comment and headers |

---

## §6 LLM Extraction Prompt Design

### 6.1 Extraction Objective

Extract a structured `DevelopmentAnnouncement` entity from a CRE trade press article.
Every populated field must be supported by a verbatim citation from the article text.
Fields that cannot be directly supported by the text must remain null. No synthesis,
inference, or default-filling is permitted.

### 6.2 Target Entity

```typescript
interface DevelopmentAnnouncement {
  address:               string | null;     // Street address if stated
  city:                  string | null;     // City name
  state:                 string | null;     // 2-letter state code
  developer_name:        string | null;     // Primary developer/owner entity
  project_name:          string | null;     // Named project or property name if given
  unit_count:            number | null;     // Total units/beds (residential); GLA sqft (commercial)
  asset_class:           AssetClass | null; // multifamily | office | retail | industrial | mixed_use | hotel | other
  deal_type:             DealType | null;   // announcement | groundbreaking | completion | sale | lease
  deal_date:             string | null;     // ISO date (YYYY-MM-DD) if stated; null if only year
  transaction_amount:    number | null;     // USD amount; null if not stated
  extraction_confidence: number;            // 0.00–1.00 — overall confidence in all fields combined
  citations: {                              // Per-field citation discipline
    address?:           string;             // Verbatim article passage supporting each field
    city?:              string;
    state?:             string;
    developer_name?:    string;
    project_name?:      string;
    unit_count?:        string;
    asset_class?:       string;
    deal_type?:         string;
    deal_date?:         string;
    transaction_amount?: string;
  };
}

type AssetClass = 'multifamily' | 'office' | 'retail' | 'industrial' | 'mixed_use' | 'hotel' | 'other';
type DealType   = 'announcement' | 'groundbreaking' | 'completion' | 'sale' | 'lease';
```

### 6.3 Extraction Prompt (Full Text)

```
You are a commercial real estate data extractor. Your task is to extract structured
fields from the article below into a DevelopmentAnnouncement JSON object.

EXTRACTION RULES — READ CAREFULLY:

1. CITATION DISCIPLINE: Every non-null field in your output must have a corresponding
   entry in the "citations" object containing the verbatim passage from the article that
   supports it. If you cannot provide a citation, the field must be null.

2. NULL ON AMBIGUITY: If a field is ambiguous, implied, or requires reasoning beyond what
   the article explicitly states, set it to null. Do not infer, estimate, or default.
   Examples: if only "Atlanta area" is mentioned, city = "Atlanta", address = null.
   If the article says "hundreds of units," unit_count = null (not numeric, not 100).

3. SCOPE: Only extract DevelopmentAnnouncement fields. Do NOT extract: cap rates, vacancy
   rates, financing terms, market statistics, or executive changes. If the article is
   purely about market conditions with no specific project/deal, set is_announcement = false
   and all other fields to null.

4. ASSET CLASS: Use exactly one of: multifamily | office | retail | industrial |
   mixed_use | hotel | other. If a project contains both residential and commercial
   components, use mixed_use.

5. DEAL TYPE: Use exactly one of:
   - announcement: project publicly announced for the first time
   - groundbreaking: ceremonial or actual start of construction
   - completion: ribbon cutting, certificate of occupancy, grand opening
   - sale: property changes ownership
   - lease: major tenant signing (anchor tenant or full-building)
   If multiple deal types apply, choose the one with the most recent event described.

6. TRANSACTION AMOUNT: Only populate if an explicit dollar figure is stated. Do not
   convert from other currencies. Round to nearest dollar. Do not include "approx" figures
   unless the article uses a specific number with a qualifier.

7. DEAL DATE: Use ISO format (YYYY-MM-DD). If only month + year is stated, use the 1st
   of the month. If only year is stated, set to null (not "YYYY-01-01").

8. CONFIDENCE: Score 0.00–1.00 across all fields combined:
   - 0.90–1.00: city, state, developer_name, deal_type all populated with verbatim citations
   - 0.70–0.89: most key fields populated; minor ambiguity in 1–2 fields
   - 0.50–0.69: significant gaps (e.g., city inferred from context, unit_count missing)
   - < 0.50: core fields absent; article is unlikely to produce useful supply intelligence

OUTPUT — strict JSON, no markdown wrapper, no explanation outside the JSON:
{
  "is_announcement": boolean,
  "address":            string | null,
  "city":               string | null,
  "state":              string | null,
  "developer_name":     string | null,
  "project_name":       string | null,
  "unit_count":         number | null,
  "asset_class":        "multifamily" | "office" | "retail" | "industrial" | "mixed_use" | "hotel" | "other" | null,
  "deal_type":          "announcement" | "groundbreaking" | "completion" | "sale" | "lease" | null,
  "deal_date":          "YYYY-MM-DD" | null,
  "transaction_amount": number | null,
  "extraction_confidence": number,
  "citations": {
    "address"?:            string,
    "city"?:               string,
    "state"?:              string,
    "developer_name"?:     string,
    "project_name"?:       string,
    "unit_count"?:         string,
    "asset_class"?:        string,
    "deal_type"?:          string,
    "deal_date"?:          string,
    "transaction_amount"?: string
  }
}

ARTICLE SOURCE: {source_name}
ARTICLE HEADLINE: {headline}
ARTICLE TEXT:
{body_text}
```

### 6.4 Response Parsing

```typescript
interface ExtractionResult {
  is_announcement:       boolean;
  address:               string | null;
  city:                  string | null;
  state:                 string | null;
  developer_name:        string | null;
  project_name:          string | null;
  unit_count:            number | null;
  asset_class:           string | null;
  deal_type:             string | null;
  deal_date:             string | null;
  transaction_amount:    number | null;
  extraction_confidence: number;
  citations:             Record<string, string>;
}

function parseExtractionResult(raw: string): ExtractionResult | null {
  try {
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
    const parsed  = JSON.parse(cleaned);
    if (typeof parsed.is_announcement      !== 'boolean') return null;
    if (typeof parsed.extraction_confidence !== 'number') return null;
    return parsed as ExtractionResult;
  } catch {
    return null;
  }
}
```

**Downstream routing by confidence:**

| Confidence | Action |
|-----------|--------|
| ≥ 0.70 | Auto-insert into `development_announcements`; run cross-source merge |
| 0.50–0.69 | Insert with `operator_reviewed = false`; surface in review queue |
| < 0.50 | Set `extraction_status = 'skipped'`; do not insert announcement |

### 6.5 Model Selection

| Model | Use case | Input tokens | Cost estimate |
|-------|---------|-------------|--------------|
| `claude-3-5-haiku-20241022` | **Primary batch extraction** | 2,000–5,000 | $0.80/M |
| `claude-3-5-sonnet-20241022` | Re-runs on confidence 0.50–0.69 | 2,000–5,000 | $3.00/M |
| Claude Opus | Not recommended for batch | — | $15.00/M |

---

## §7 Extraction Sample Test Plan

### 7.1 Test Corpus Composition

20 real CRE articles across sources:

| # | Source | Article Type | Expected `is_announcement` | Expected `deal_type` |
|---|--------|-------------|--------------------------|---------------------|
| 1 | Bisnow | Multifamily groundbreaking, 350 units, Atlanta, developer named, date stated | true | groundbreaking |
| 2 | Bisnow | Market cap rate statistics piece, no specific deal | false | — |
| 3 | Bisnow | Office building sale, $42M, buyer/seller named, address stated | true | sale |
| 4 | Bisnow | Developer profile — no specific project announced | false | — |
| 5 | Bisnow | Mixed-use tower announced, Dallas CBD, 400 units + 20k sqft retail | true | announcement |
| 6 | Connect CRE | Industrial lease signed, 250k sqft, tenant named, city stated | true | lease |
| 7 | Connect CRE | Retail center sold, $28M, Florida, seller named | true | sale |
| 8 | Connect CRE | Multifamily market report — no specific deal | false | — |
| 9 | Connect CRE | Senior housing groundbreaking, 120 units, no address | true | groundbreaking |
| 10 | Connect CRE | Financing closed — no construction or lease event | false | — |
| 11 | MHN | Affordable housing completion, 200 units, ribbon cutting, full address | true | completion |
| 12 | MHN | Rent growth analysis — Sun Belt markets, no specific deal | false | — |
| 13 | MHN | Student housing announced, 500 beds, university-adjacent, developer named | true | announcement |
| 14 | MFE (archived) | Modular construction technology article — no specific project | false | — |
| 15 | MFE (archived) | Garden-style complex broken ground, Texas, 280 units, date stated | true | groundbreaking |
| 16 | REBusinessOnline | Retail center sale, $15M, Southeast, buyer named | true | sale |
| 17 | REBusinessOnline | Office park lease, law firm, Charlotte, sqft stated | true | lease |
| 18 | TRD national | Luxury condo announcement, Miami, 300 units, price per unit stated | true | announcement |
| 19 | Commercial Observer | NYC office lease, 50k sqft, tenant named, floor stated | true | lease |
| 20 | Trepp | CMBS payoff analysis — no specific deal or announcement | false | — |

### 7.2 Scoring Rubric

For each article where `is_announcement = true`, score field-level extraction:

| Metric | Method | Target |
|--------|--------|--------|
| **Precision** | True positives / (true positives + false positives) where false positive = `is_announcement = true` on a non-announcement | ≥ 0.85 |
| **Recall** | True positives / (true positives + false negatives) where false negative = `is_announcement = false` on a real announcement | ≥ 0.80 |
| **Field coverage** | For all true positive predictions: fraction of expected non-null fields that are non-null | ≥ 0.70 |
| **Hallucination rate** | Fraction of populated fields with no matching citation in the article text | ≤ 0.05 |
| **Citation accuracy** | Fraction of citations where the cited passage is verbatim in the article | ≥ 0.95 |
| **Parse failure rate** | JSON parse errors / total extraction calls | ≤ 0.05 |

For each false positive or false negative, document: source, headline, the extraction
output, and the reason for the error (ambiguous phrasing, missing context, etc.).

### 7.3 Field-Level Failure Analysis

Track per-field null rates on true positives. Fields with null rate > 30% on known deals
indicate that excerpt-only mode is insufficient and full-body fetch is required for that
source:

| Field | Expected null rate (full body) | Flag threshold |
|-------|-------------------------------|---------------|
| `address` | 40–60% (many deals don't state full address) | > 70% |
| `city` | < 10% | > 25% |
| `developer_name` | < 20% | > 35% |
| `unit_count` | < 30% | > 50% |
| `deal_type` | < 5% | > 15% |
| `transaction_amount` | 40–60% (often undisclosed) | > 75% |

---

## §8 Deduplication Strategy

### 8.1 Within-Source Deduplication (Fetch Level)

**Mechanism:** SHA-256 hash of `canonicalizeUrl(url)` stored as `url_hash` unique constraint.

**Canonical URL algorithm** (reuse `canonicalizeUrl()` from `cre-rss.ts`):
1. Lowercase scheme + host
2. Remove UTM params (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`,
   `fbclid`, `gclid`)
3. Remove URL fragment (`#anchor`)
4. Remove trailing slash (unless root `/`)

**Insert pattern:** `ON CONFLICT (url_hash) DO NOTHING`

### 8.2 Content-Hash Cross-Source Deduplication (Fetch Level)

The same article text occasionally appears verbatim on multiple domains (syndication).
After full-body fetch, store `content_hash = SHA-256(body_text)`. Before LLM extraction:

```sql
-- Check whether this body has already been extracted from another source
SELECT id, source_id FROM trade_press_articles
WHERE content_hash = $1
  AND extraction_status = 'extracted'
  AND id != $2
LIMIT 1;
```

If a match is found, copy the `development_announcement` link from the prior article and
set `extraction_status = 'skipped'` on the duplicate. Add the new article's `url` to the
announcement's `source_urls[]` array.

### 8.3 Cross-Source Entity Merge (Announcement Level)

The same deal — e.g., a 350-unit groundbreaking in Atlanta — may be covered by Bisnow,
Connect CRE, and REBusinessOnline within a 72-hour window. Each produces a separate
article and a separate extracted `development_announcements` row. The merge step collapses
these into one entity.

**Merge trigger:** Run after each LLM extraction batch (hourly).

**Matching keys** (in priority order — stop at first match):

| Key | Match condition |
|-----|----------------|
| Address + city + state | Exact canonical address match (after normalization) |
| Project name + state | `similarity(project_name, ?) > 0.80` via pg_trgm |
| Developer name + city + unit_count | Developer name similarity > 0.75 AND city exact AND `ABS(unit_count - ?) < 50` |
| Developer name + city + deal_type + deal_date | Same developer, city, deal_type; deal_date within ±7 days |

**Merge algorithm:**

```typescript
async function mergeAnnouncements(
  candidate: DevelopmentAnnouncement,
  existing: DevelopmentAnnouncement
): Promise<void> {
  // existing is the canonical record (earlier created_at)
  // candidate is the newer record to merge in

  // 1. Append source attribution
  await db.query(`
    UPDATE development_announcements
       SET source_urls  = array_append(source_urls,  $1),
           source_names = array_append(source_names, $2),
           updated_at   = NOW()
     WHERE id = $3
  `, [candidate.source_urls[0], candidate.source_names[0], existing.id]);

  // 2. Field-level conflict resolution: higher confidence wins
  const fields: (keyof DevelopmentAnnouncement)[] = [
    'address', 'unit_count', 'transaction_amount', 'deal_date', 'project_name'
  ];
  for (const field of fields) {
    if (existing[field] === null && candidate[field] !== null) {
      // Fill in null fields from candidate (no conflict)
      await db.query(
        `UPDATE development_announcements SET ${field} = $1 WHERE id = $2`,
        [candidate[field], existing.id]
      );
    } else if (existing[field] !== null && candidate[field] !== null
               && existing[field] !== candidate[field]) {
      // Conflict: higher confidence source wins; mark unresolved if equal
      if (candidate.extraction_confidence > existing.extraction_confidence) {
        await db.query(
          `UPDATE development_announcements SET ${field} = $1,
             source_metadata = jsonb_set(
               COALESCE(source_metadata, '{}'),
               '{conflicts,${field}}',
               $2::jsonb
             ) WHERE id = $3`,
          [candidate[field], JSON.stringify({
            original: existing[field],
            override: candidate[field],
            from_source: candidate.source_names[0],
          }), existing.id]
        );
      } else if (candidate.extraction_confidence === existing.extraction_confidence) {
        // Equal confidence — mark as unresolved, do not overwrite
        await db.query(
          `UPDATE development_announcements
              SET source_metadata = jsonb_set(
                COALESCE(source_metadata, '{}'),
                '{unresolved,${field}}',
                $1::jsonb
              ) WHERE id = $2`,
          [JSON.stringify({
            existing_value: existing[field],
            candidate_value: candidate[field],
            from_source: candidate.source_names[0],
          }), existing.id]
        );
      }
      // Lower confidence candidate: keep existing value, no action
    }
  }

  // 3. Mark candidate as merged
  await db.query(
    `UPDATE development_announcements SET merged_into = $1 WHERE id = $2`,
    [existing.id, candidate.id]
  );
}
```

**One alert per merged entity:** When emitting an operator alert ("new deal in your
submarket"), query `development_announcements WHERE merged_into IS NULL` — i.e., canonical
records only. This ensures one alert per deal regardless of how many sources covered it.

**pg_trgm prerequisite:** `CREATE EXTENSION IF NOT EXISTS pg_trgm;`

---

## §9 Cost Estimate

### 9.1 Article Volume Estimate

| Source | Est. new articles/day (all topics) | Est. deal-relevant after pre-filter |
|--------|-------------------------------------|-------------------------------------|
| Bisnow national | 15–20 | 6–8 |
| Bisnow regional (9 feeds) | 30–40 | 12–16 |
| Connect CRE | 20–25 | 12–15 |
| REBusinessOnline | 8–12 | 5–7 |
| MHN | 6–10 | 3–5 |
| The Real Deal national | 8–12 | 4–6 |
| Commercial Observer | 15–20 | 6–8 |
| Trepp | 3–5 | 0–1 (finance/CMBS focus) |
| PropModo | 3–5 | 0–1 (tech focus) |
| **Total** | **108–149** | **48–67** |

### 9.2 Token Model

| Parameter | Value | Basis |
|-----------|-------|-------|
| Input tokens per article (full body) | 2,000–5,000 | 500–1,500 word article + 600-token prompt |
| Output tokens per article | 800–1,500 | JSON with citations (~1k tokens avg) |
| Avg input (Haiku, mid-range) | 3,500 tokens | Conservative mid-range |
| Avg output | 1,200 tokens | Includes citation passages |

### 9.3 Keyword Pre-Filter Gate

Before full-body fetch or LLM call, apply fast regex screen. Skips ~40% of articles.

**Pass to full-body fetch if title contains any of:**
```
\b(announc|break ground|ground[- ]?break|open[s]? |complet|ribbon|deliver|
   sold|acqui[rs]|lease[sd]?|sign[s]? lease|units|beds|sqft|sq\.? ft|
   develop[er]|construct|build[s]?|partner[s]? with|joint venture|
   tower|complex|campus|center|project|phase [0-9]|mixed.use|
   multifamily|apartment|office building|retail center|industrial)\b
```

**Skip (set `extraction_status = 'skipped'`) if title matches only:**
```
\b(cap rate[s]?|vacancy|delinquency|CMBS|lending|refinanc|
   interest rate[s]?|NOI|DSCR|underwriting|basis points|
   market report|quarterly|year-over-year|analysis|forecast|survey)\b
```

Estimated filter reduction: 35–45% of articles skipped before full-body fetch;
additional 10–15% skipped after full-body fetch but before LLM call.
Net: ~55% reduction in LLM calls.

### 9.4 Cost per Article and Monthly Totals

**Haiku pricing:** $0.80/M input, $4.00/M output

| Scenario | Articles/day | LLM calls/day | Input cost/day | Output cost/day | Daily total |
|----------|-------------|---------------|---------------|----------------|-------------|
| Pre-filter pass → Haiku | 58 (55% of 128 avg) | 58 | 58 × 3,500 × $0.80/1M = $0.163 | 58 × 1,200 × $4.00/1M = $0.278 | $0.441 |
| Sonnet re-run (confidence 0.50–0.69, ~15% of above) | 9 | 9 | 9 × 3,500 × $3.00/1M = $0.095 | 9 × 1,200 × $15.00/1M = $0.162 | $0.257 |
| **Total** | | **67** | | | **~$0.70/day** |

**Monthly steady-state:** ~$21/month at Haiku + selective Sonnet.

**Cost as a function of filtering aggressiveness:**

| Filter ratio | LLM calls/day | Monthly cost |
|-------------|--------------|-------------|
| No filter (0%) | 128 | ~$47/mo |
| 40% filter (moderate) | 77 | ~$28/mo |
| 55% filter (recommended) | 58 | **~$21/mo** |
| 70% filter (aggressive) | 38 | ~$14/mo |

A 70% filter risks missing real announcements phrased with unusual language (e.g.,
"JV closes on industrial park" — 'closes' not in the keyword list). The 55% filter
is the recommended starting point; tune based on false negative rate from §7.2.

### 9.5 Full-Body Fetch Costs

`safeFetchText()` uses server outbound bandwidth. At 128 article page fetches/day ×
~120 KB average HTML page = ~15 MB/day. Negligible infrastructure cost.

### 9.6 Total Monthly Estimate

| Component | Monthly cost |
|-----------|-------------|
| LLM extraction (Haiku + selective Sonnet) | ~$21 |
| Full-body article fetches (bandwidth) | < $0.20 |
| Inngest function runs (RSS poll + extraction) | Included in Inngest free tier |
| **Total** | **~$21–25/month** |

---

## §10 Licensing Roadmap

### 10.1 Current Status

No commercial syndication or licensing agreements are held. All access is via:
1. Publicly offered RSS feeds (machine-readable by design, published by the sources themselves)
2. Standard HTTP fetch of publicly available article pages (same access as a browser user)

### 10.2 ToS Analysis per Source

| Source | ToS permits automated commercial use? | B2B / API tier available | Risk level |
|--------|---------------------------------------|--------------------------|------------|
| Bisnow | No — `bisnow.com/legal/terms` explicitly prohibits unauthorized scraping and commercial redistribution of content | BisNow Media B2B program exists | Medium |
| GlobeSt | Unclear — `ai-train=no` signals content sensitivity; direct access moot (dead RSS) | No known public API; ALM Media is enterprise-only | Low (moot) |
| Connect CRE | No explicit prohibition found; standard publisher ToS | No B2B tier identified | Low–Medium |
| REBusinessOnline | No prohibition found; France Media standard ToS; no enforcement history | No B2B tier identified | Low |
| MHN | Standard enterprise publisher ToS (Yardi); no known aggregation prohibition | No B2B tier | Low |
| MFE | Standard publisher ToS (Zonda); RSS dead anyway | No B2B tier | Low (moot) |
| CoStar News editorial | Governed by CoStar API subscription agreement; editorial news requires separate license | CoStar Media/Editorial licensing exists (enterprise contract) | N/A (subscription) |
| The Real Deal | Standard premium publisher ToS; metered paywall indicates revenue sensitivity | No public B2B tier identified | Medium |
| Commercial Observer | Standard publisher ToS | No B2B tier identified | Low–Medium |

### 10.3 Risk Mitigation: Fair Use Posture

1. **Internal use only:** Do not expose raw article text to end users via API or UI export.
   Surface only extracted `DevelopmentAnnouncement` fields and attribution links.

2. **Attribution in every downstream use:** Store `source_urls[]` and `source_names[]`
   with every `development_announcements` row. Surface source name + link-to-original
   in any UI showing deal data derived from trade press.

3. **No bulk redistribution:** Do not allow export or bulk download of `trade_press_articles`
   body text. Extracted structured data (address, developer, unit_count) may be exported.

4. **Excerpt only in operator-facing UI:** Where headlines appear, show title + one-sentence
   excerpt + link to original. Never surface full article body to end users.

5. **robots.txt compliance at all times:** Never fetch URLs matching a `Disallow` rule.
   Apply source-specific Crawl-delay (GlobeSt: 1 second) if any GlobeSt direct access
   is reactivated.

6. **ToS-change monitoring:** On a quarterly basis, re-fetch and diff `robots.txt` for
   all active sources. Any new `Disallow` on feed paths or any new `Crawl-delay` directive
   must immediately pause that source pending review.

### 10.4 Formal Licensing Roadmap

**Trigger point for formalization:** When `DevelopmentAnnouncement` records from any
single source account for > 30% of new pipeline deals in the platform, initiate licensing
discussion with that source within 60 days.

**Phase A (Months 1–3): Establish relationships**
- Bisnow: contact BisNow Media team; propose co-marketing or data licensing in exchange
  for deal visibility / referral traffic
- The Real Deal: contact TRD data products team; they have a structured data product for
  institutional clients

**Phase B (Months 3–6): Formal agreements**
- Target: written Bisnow aggregation permission or formal licensing agreement
- Target: TRD data licensing (structured deal data API, not editorial scraping)

**Phase C (Months 6–12): Scale or buy**
If total ingest volume exceeds 500 articles/day or legal risk increases:

| Service | Coverage | Licensing | Cost |
|---------|---------|-----------|------|
| NewsAPI.org Business | General + some CRE publishers | Licensed redistribution rights | $449/mo |
| Diffbot Article API | Structured extraction, any URL | Licensed resale rights included | ~$299/mo |
| CoStar Media Editorial | CoStar News + CRE Intelligence | Requires enterprise CoStar contract extension | Contract |

**IP-ban fallback:** If a source blocks the `JediRE/1.0` User-Agent: rotate to a named
domain-verification UA (`JediRE-Verifier/1.0`), reduce poll frequency, and initiate
licensing discussion. Do not attempt to evade blocks with proxy rotation or UA spoofing on
RSS feeds (ToS violation risk).

---

## §11 Implementation Phasing Recommendation

The existing `cre-rss.ts` infrastructure covers Bisnow, Connect CRE, MHN, and MFE RSS
feeds (though with bugs). The new pipeline builds on top of this foundation rather than
replacing it. Dependencies on the `DevelopmentAnnouncement` entity schema from parallel
planning data work should be coordinated before Phase 2 begins.

### Phase 1 — Wire Existing Feeds into Persistent Table (Weeks 1–2)

**Objective:** Persist trade press articles to `trade_press_articles`. Fix known bugs.
Code changes + one migration; no LLM calls yet.

| # | Work Item | Files |
|---|-----------|-------|
| 1.1 | Migration: create `trade_press_articles`, `development_announcements`, `trade_press_rss_sources` | `backend/src/database/migrations/` |
| 1.2 | Seed `trade_press_rss_sources` with all active feeds (correct Bisnow URLs, remove MFE, add REBusinessOnline, add TRD national, add Commercial Observer as named source) | migration seed |
| 1.3 | Implement `pollTradePressFeeds()` Inngest cron: fetch → canonicalize → dedup insert into `trade_press_articles` | new Inngest function |
| 1.4 | Implement full-body fetch cycle: `safeFetchText()` on pending articles passing keyword pre-filter | new Inngest function |
| 1.5 | Validate: all 9 active sources return valid RSS; `trade_press_articles` populates with no duplicate `url_hash` collisions | feed validation run |

**Estimated effort:** 2–3 days
**Risk:** Low — all RSS feeds verified working; schema is new (no existing table impact)

### Phase 2 — LLM Extraction into `development_announcements` (Weeks 3–5)

**Objective:** Turn raw articles into structured `DevelopmentAnnouncement` entities.

| # | Work Item | Files |
|---|-----------|-------|
| 2.1 | Implement `extractDevelopmentAnnouncements()` Inngest function per §6 prompt | new Inngest function |
| 2.2 | Keyword pre-filter per §9.3 — applied before both full-body fetch and LLM call | utility function |
| 2.3 | Response parser + confidence routing per §6.4 | utility function |
| 2.4 | CoStar cross-reference: after extraction, query `development_projects` to set `costar_confirmed` | integration with existing table |
| 2.5 | Validate against §7 test corpus: precision ≥ 0.85, recall ≥ 0.80, hallucination rate ≤ 0.05 | test run |

**Estimated effort:** 3–4 days
**Risk:** Medium — LLM cost and false positive rate must be monitored first 2 weeks;
adjust keyword filter and confidence thresholds based on initial results

### Phase 3 — Cross-Source Merge and Operator Alerts (Weeks 5–7)

**Objective:** Collapse duplicate deal coverage across sources into single entities;
surface one alert per deal to operators.

| # | Work Item | Files |
|---|-----------|-------|
| 3.1 | Enable `pg_trgm` extension if not already active | migration |
| 3.2 | Implement `crossSourceMergeAnnouncements()` per §8.3 algorithm | service function |
| 3.3 | Operator alert emitter: one "new deal in submarket" alert per canonical `development_announcements` row where `merged_into IS NULL` | alert service |
| 3.4 | Operator review queue UI: list announcements with `extraction_confidence 0.50–0.69`, `operator_reviewed = false` | frontend |
| 3.5 | Admin dashboard: source health table (last polled, article count last 7 days, extraction rate per source) | frontend |

**Estimated effort:** 3–4 days
**Risk:** Low — merge logic is well-defined; alert infrastructure already exists in platform

### Dependencies

- **Phase 2 depends on Phase 1:** `trade_press_articles` must be populated before extraction
- **Phase 3 depends on Phase 2:** Cross-source merge requires `development_announcements` rows
- **Parallel dependency:** Coordinate `development_announcements` schema with any parallel
  planning data dispatch that also targets a `DevelopmentAnnouncement` entity, to ensure
  field names and types are compatible before Phase 2 begins

### Do NOT Pursue in These Phases

- MFE sitemap crawl — requires explicit ToS review before implementation
- GlobeSt FeedBlitz feeds — unmaintained; unknown status; use CO/Trepp/PropModo proxies
- Paywalled full-body access — do not inject auth cookies or attempt paywall bypass
- CoStar News editorial via trade press pipeline — CoStar editorial is governed by the
  existing API subscription contract, not this pipeline

---

*End of document. Design only — no scraping code implemented.*
