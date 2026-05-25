# Trade Press Ingest — Design Document

**Task:** #1070
**Date:** 2026-05-25
**Status:** DESIGN ONLY — no scraping code implemented in this document
**Scope:** Per-source inventory, robots.txt compliance, technical architecture, LLM extraction design,
deduplication strategy, cost estimates, and licensing roadmap.

---

## §1 Infrastructure Baseline

The platform already has a functioning trade press ingest layer across two distinct paths.

### Path A — Scheduled Discovery (`cre-rss.ts`)

`backend/src/services/discovery/sources/cre-rss.ts`

- `CRE_FEEDS` registry of RSS URLs polled by the discovery engine
- Token-bucket rate limiting: 1 req/sec, burst 3; 429/503 triggers a 5-minute backoff
- User-Agent: `JediRE/1.0 (+https://jedire.app) CRE-News-Aggregator` (honest identification)
- **Known bug:** Bisnow URLs use stale `/feed/` and `/national/feed/` patterns (all return 404);
  correct pattern is `/rss/{market}` (confirmed working in `bisnow.provider.ts`)
- **Known dead source:** `multifamilyexecutive.com/rss` returns 404 silently
- Covers: GlobeSt (stale URL), Bisnow (stale URLs), Connect CRE, REJournals, Multifamily
  Executive, Multi-Housing News, BiggerPockets, SEC EDGAR 8-K, Reddit
  (`r/CommercialRealEstate`, `r/multifamily`)

### Path B — Provider-Based (`news.service.ts`)

`backend/src/services/news/news.service.ts` + `backend/src/services/news/providers/`

Registered providers: `bisnow`, `globest` (proxied → Commercial Observer + Trepp + PropModo),
`housingwire`.

- Provider adapters perform RSS fetch via native `fetch()` — not `safeFetchText()` (acceptable
  for known-good hardcoded URLs; only an SSRF risk if URLs become user-configurable)
- Credit metering: 1 credit/news.search, 3/article_full, 5/morning_brief
- `globestProvider` silently maps GlobeSt's dead RSS to three working replacement feeds

### Landing Tables

| Table | Purpose |
|-------|---------|
| `user_news_items` | Per-user RSS items from user-connected feeds (`rss-feeds.ts`) |
| `demand_events` | Structured demand events extracted from news (currently unpopulated) |
| `key_events` | M35 event data (consumed by `fetch_m35_event_forecast.ts`) |

### SSRF Protection

`safeFetchText()` in `backend/src/services/news-connections/ssrf-guard.ts`:
1. Hostname-level rejection (localhost, 0.0.0.0, private literal IPs)
2. DNS resolution check across all A/AAAA records (blocks 10.x, 127.x, 169.254.x, link-local,
   ULA, multicast)
3. Custom `safeLookup` callback re-validates at TCP connect time (defeats DNS rebinding between
   the check and the connection)
4. Manual redirect following with full guard re-run on every hop (max 3 hops)
5. 5 MB body cap; 10-second timeout

All article full-body fetches in the new pipeline must route through `safeFetchText()`.

---

## §2 Per-Source Investigation

### 2.1 Bisnow

**Profile:** National CRE news + events. Regional granularity across 17+ metro markets.
**Coverage:** Office, multifamily, retail, industrial, hospitality, land, capital markets
**Audience:** Brokers, developers, investors, lenders

**RSS Status:** WORKING (verified 2026-05-25)
**National URL:** `https://www.bisnow.com/rss/national` (~30 items, ~70-day rolling window)
**Regional pattern:** `https://www.bisnow.com/rss/{market}` where `{market}` =

```
national, new-york, los-angeles, chicago, dallas-ft-worth, phoenix, atlanta,
south-florida, boston, washington-dc, san-francisco, denver, seattle, houston,
tampa-bay, austin-san-antonio, charlotte, nashville
```

Each regional feed returns ~30 items spanning 1–2 weeks.

**robots.txt** (`https://www.bisnow.com/robots.txt`, verified 2026-05-25):
- Disallows: `/admin/`, `/newsletters/`, `/user/`, `/events/`, `/videos/watch/`,
  `/preview_story/`, `/archives/`, `/more-news`, `/subscribe*`, `/orders`, `/logout`
- `/rss/*` path: **NOT disallowed** ✓
- Sitemap: `https://www.bisnow.com/sitemap/xml`

**Full-body access:** RSS provides headline + excerpt (~300 chars, HTML-stripped).
Article pages are partially gated by Cloudflare WAF — selective full-body fetch via
`safeFetchText()` is possible but success is not guaranteed.

**Content fields from RSS:** `title`, `description` (truncated), `link`, `pubDate`, `guid`,
`dc:creator`, `media:content` or `enclosure` (image URL), `category` elements

**Current registry bug:** `cre-rss.ts` uses `/feed/` and `/national/feed/` patterns (404).
Must be corrected to `/rss/{market}` across all 17 entries.

**ToS note:** `bisnow.com/legal/terms` prohibits unauthorized scraping and commercial
redistribution. RSS feeds are publicly machine-readable by design; however, no commercial
aggregation license is held. Internal demand-signal extraction with source attribution is
defensible under a narrow interpretation. Public resale or bulk redistribution of article
text would violate ToS. See §10 for licensing roadmap.

---

### 2.2 Connect CRE

**Profile:** Concise deal-announcement news. Short, structured transaction summaries.
**Coverage:** Sales, leasing, financing, development — national with strong regional focus
(Southeast, Southwest, Texas, Midwest, West, Mid-Atlantic)
**Audience:** Brokers, investors, developers

**RSS Status:** WORKING (verified 2026-05-25)
**URL:** `https://www.connectcre.com/feed/` (32+ items per poll, WordPress RSS)
**Alternative path:** `https://www.connectcre.com/stories/feed/` (also confirmed working)

**robots.txt** (`https://www.connectcre.com/robots.txt`, verified 2026-05-25):
```
Disallow: /feed
Disallow: /feed?
Disallow: /events/
Disallow: /get-daily-news/
Disallow: /faq/
Disallow: /cdn-cgi/
Disallow: /wp-admin/
Disallow: /story-market/developers-of-the-year/
Disallow: /story-market/transactions-of-the-year/
Disallow: /story-market/texas/
Disallow: /story-market/global/
```

**Compliance note:** `Disallow: /feed` (no trailing slash) is ambiguous under RFC 9309 — most
user-agent implementations treat it as also matching `/feed/`. The `/stories/feed/` path is
**not explicitly disallowed** and is the safer access route.

**Recommendation:** Change registry URL from `/feed/` to `/stories/feed/` in `cre-rss.ts`.

**Full-body access:** Connect CRE articles are short deal announcements (200–400 words),
frequently fully available in the RSS excerpt. Full-body fetches unlikely to add value.

**Content fields:** `title`, `description` (~300-char deal summary), `link`, `pubDate`,
`dc:creator`, `category`

**ToS note:** `connectcre.com/terms-and-conditions/` — Connect Group Media, Inc. Standard
publisher ToS. Internal aggregation for intelligence purposes is defensible; bulk redistribution
is not permitted.

---

### 2.3 Multi-Housing News (MHN)

**Profile:** Long-form analysis, property transactions, market data. Owned by Yardi Systems.
**Coverage:** Multifamily, affordable housing, student housing, senior housing
**Audience:** Property managers, investors, developers

**RSS Status:** WORKING (verified 2026-05-25)
**URL:** `https://www.multihousingnews.com/feed/` (WordPress RSS)

**robots.txt** (`https://www.multihousingnews.com/robots.txt`, verified 2026-05-25):
```
Disallow: /wp-admin
Disallow: /rss/          ← blocks the /rss/ sub-path
Disallow: /rss-feeds/    ← blocks the feed directory page
Disallow: /tag/
Disallow: /search/
...
```
- `/feed/` path (WordPress standard): **NOT disallowed** ✓
- Notable: Explicitly blocks `owlin bot`, `owlin bot v.3.0`, `mj12bot`, `naver`, `charlotte`
  by user-agent — indicating deliberate awareness of news aggregation crawlers.
  JediRE's honest `JediRE/1.0` User-Agent would not be blocked by these rules.

**Full-body access:** Articles are full-length (500–1,500 words). RSS provides excerpt only.
Full body available via `safeFetchText()`; no paywall detected.

**Content fields:** `title`, `description` (excerpt), `link`, `pubDate`, `author`, `category`,
`media:content` (image)

**ToS note:** Yardi Systems (MHN owner) has standard enterprise publisher ToS. No known
commercial aggregation licensing program. Internal intelligence use with attribution is standard
industry practice.

---

### 2.4 Multifamily Executive (MFE)

**Profile:** Builder/developer-oriented multifamily news. Owned by Zonda (formerly Builder Media).
**Coverage:** Construction, design, technology, finance, policy
**Audience:** Multifamily developers, builders

**RSS Status:** DEAD (verified 2026-05-25)

| URL Attempted | Result |
|--------------|--------|
| `multifamilyexecutive.com/rss` | HTTP 404 |
| `multifamilyexecutive.com/rss.xml` | Drupal HTML page — not RSS XML |
| `multifamilyexecutive.com/feed/` | HTTP 404 |

MFE runs on a Drupal CMS; WordPress's standard `/feed/` pattern does not apply, and no
active RSS endpoint was discovered.

**robots.txt** (`https://www.multifamilyexecutive.com/robots.txt`, verified 2026-05-25):
- Standard Drupal rules — no explicit RSS disallows, but those paths 404 regardless.

**Alternative access pattern:** Sitemap crawl from `multifamilyexecutive.com/sitemap.xml`
then per-article `safeFetchText()` with heavy rate limiting. This requires a ToS review
before implementation — NOT recommended for Phase 1.

**Current registry bug:** `cre-rss.ts` includes `multifamilyexecutive.com/rss` which fails
silently (no error thrown on 404). This entry should be removed from the registry to
stop polluting error logs and wasting poll cycles.

**Recommended approach for Phase 1:** Remove MFE from registry. Revisit in a later phase
when/if a working feed is identified.

---

### 2.5 REBusinessOnline — Gap Source (Recommended Add)

**Profile:** Regional CRE transactions and market reports. Owned by France Media.
**Coverage:** Southeast, Southwest, Texas, Midwest, West. Office, retail, industrial,
multifamily.
**Audience:** Brokers, investors, developers

**RSS Status:** WORKING (verified 2026-05-25)
**URL:** `https://rebusinessonline.com/feed/` (WordPress RSS, 24 KB body, active)
Content confirmed: deal announcements, market reports, transaction summaries.

**robots.txt** (`https://rebusinessonline.com/robots.txt`, verified 2026-05-25):
```
# START YOAST BLOCK
User-agent: *
Disallow:            ← blank = allows everything

Sitemap: http://rebusinessonline.com/sitemap_index.xml
# END YOAST BLOCK
```
**Most permissive robots.txt of all sources investigated.** ✓

**Full-body access:** Articles are full-text (300–800 words). No paywall detected.

**Content fields:** `title`, `description` (excerpt), `link`, `pubDate`, `author`, `category`,
`media:content` (image)

**ToS note:** No dedicated API or syndication ToS page found. France Media standard publisher
ToS applies. RSS is publicly offered. Internal intelligence use is defensible; REBusinessOnline
is a smaller regional publisher with no known enforcement history.

**This is the highest-value gap source: working feed + zero access friction + most permissive
robots.txt. Add immediately in Phase 1.**

---

### 2.6 The Real Deal — Gap Source (Partial)

**Profile:** Premier CRE news. Deep reporting, investigative coverage, transaction databases.
**Coverage:** NYC (primary), national, South Florida, LA, Chicago, San Francisco
**Audience:** Investors, developers, brokers, policy, finance

**RSS Status:** PARTIAL (verified 2026-05-25)

| URL Attempted | Result |
|--------------|--------|
| `therealdeal.com/feed/` | Returns full HTML page (JS-rendered, no XML) |
| `therealdeal.com/national/feed/` | **Working RSS — 4.7 KB, ~10 items** ✓ |
| `therealdeal.com/new-york/feed/` | Not verified — expected to follow same pattern |
| `therealdeal.com/south-florida/feed/` | Not verified — expected to follow same pattern |

**robots.txt** (`https://therealdeal.com/robots.txt`, verified 2026-05-25):
```
User-agent: *
Disallow: /wp-admin/
Disallow: /wp-includes/
Disallow: /wp-json/
Disallow: /api/
Disallow: /wp-*.php
Disallow: /?p=*
Disallow: /new-york?p=*  (etc. per market)
Allow: *                 ← catch-all allow
```
`/national/feed/` and regional `/*/feed/` paths: **NOT disallowed** ✓

**Full-body access:** TRD employs a soft paywall (metered access, ~3–5 free articles/month
per browser). RSS items include title + excerpt without hitting the paywall gate. Full-body
fetch behind paywall is NOT recommended — headline + excerpt is sufficient for demand
signal classification.

**CoStar News note:** CoStar News (`costar.com/news`) is entirely separate from trade press
RSS. It is market data delivered exclusively through CoStar's commercial API subscription,
already handled by `fetch_costar_metrics.ts` and `fetch_costar_pipeline.ts`. It has no
RSS feed and should not appear in any trade press registry.

**ToS note:** `therealdeal.com/terms-of-service/` — standard premium publisher ToS. No
commercial aggregation license available publicly. RSS is offered for public consumption;
internal intelligence use is standard practice. TRD's paywall indicates revenue sensitivity;
do NOT attempt to circumvent the paywall via authentication tokens or cookie injection.

**Recommendation:** Add `therealdeal.com/national/feed/` to registry in Phase 1. Verify and
add regional feeds (NYC, South Florida, LA) selectively given the small per-feed item count.

---

### 2.7 HousingWire

**Profile:** Broad housing finance and market coverage. Strong on mortgage, GSE, policy,
PropTech.
**Coverage:** Single-family, multifamily (residential), mortgage markets, regulatory
**Audience:** Lenders, investors, servicers, developers

**RSS Status:** WORKING (verified 2026-05-25)
**URL:** `https://www.housingwire.com/feed/`

HW Media umbrella properties also publish separate sitemaps (per robots.txt):
`finledger.com`, `hwmedia.com`, `realtrends.com`, `reversemortgagedaily.com` —
not currently registered and out of scope for CRE-specific ingest.

**robots.txt** (`https://www.housingwire.com/robots.txt`, verified 2026-05-25):
- Disallows search, tag pages, media subdirectory, job listings, pagination parameters
- `/feed/` path: **NOT disallowed** ✓
- Yoast block at bottom sets final `Disallow:` (blank = allow all) — net-permissive

**Full-body access:** Articles are full-text. No hard paywall (newsletter signup prompt only).

**Current state:** Registered and working as `housingwireProvider` in `news.service.ts`. ✓

---

### 2.8 SEC EDGAR 8-K Feed

**Profile:** REIT event filings — material announcements (acquisitions, dispositions,
financings, quarterly earnings, development announcements).
**Coverage:** All public REITs filing with the SEC

**RSS/Atom Status:** WORKING
**URL:** EDGAR full-text search Atom feed filtered to `forms=8-K` + keyword `"REIT"`
(accessed via `cre-rss.ts`)

**robots.txt:** SEC EDGAR is a US government system. Public data endpoints carry no robots.txt
restrictions. Publicly mandated disclosure — no access friction.

**Full-body access:** EDGAR filing documents are public record. Full XBRL/HTML filing text
available at no cost.

**Current state:** In `cre-rss.ts`. 8-K items flow into the news discovery engine as articles
but are not parsed for structured supply/pipeline data. This is a noted gap in
`SUPPLY_DEMAND_PIPELINE_AUDIT.md §1E` — addressed as Dispatch 7 of that plan (SEC 10-K
REIT supply pipeline parsing), which is separate from this trade press ingest track.

---

## §3 robots.txt Compliance Table

All checks performed live 2026-05-25. "Feed path" refers to the URL path used in the
current or recommended registry entry.

| Source | Feed Path | Explicitly Disallowed? | Status | Notes |
|--------|-----------|----------------------|--------|-------|
| Bisnow | `/rss/national`, `/rss/{market}` | No | ✅ PERMITTED | `/archive/`, `/newsletters/` disallowed; `/rss/*` clear |
| Connect CRE | `/stories/feed/` | No | ✅ PERMITTED | Use `/stories/feed/` — `/feed` (root, no trailing slash) is ambiguous |
| Multi-Housing News | `/feed/` | No | ✅ PERMITTED | `/rss/` disallowed; `/feed/` is not |
| Multifamily Executive | `/rss`, `/feed/` | No (but 404) | ⚠️ DEAD | robots.txt permissive; no working endpoint |
| REBusinessOnline | `/feed/` | No (fully open) | ✅ PERMITTED | Blank disallow = allow everything |
| The Real Deal | `/national/feed/` | No | ✅ PERMITTED | `Allow: *` catch-all; explicit bot allows |
| Commercial Observer | `/feed/` | No | ✅ PERMITTED | Only `/wp-admin/` disallowed |
| Trepp | `/trepptalk/rss.xml` | No | ✅ PERMITTED | Only HubSpot preview paths disallowed |
| PropModo | `/feed/` | No | ✅ PERMITTED | Only `/wp-admin/` disallowed |
| HousingWire | `/feed/` | No | ✅ PERMITTED | Complex rules; `/feed/` path is clear |
| SEC EDGAR | EDGAR Atom endpoint | N/A | ✅ PERMITTED | US government public data |

**Summary:** 10 of 11 sources have clear robots.txt permission for their RSS feed path.
Connect CRE requires the path change from `/feed/` to `/stories/feed/` for unambiguous
compliance. MFE is moot — the feed is dead.

---

## §4 Recommended Access Patterns

### 4.1 Fetch Hierarchy

Use the minimal-access pattern that yields sufficient data for demand signal classification:

1. **RSS polling only (preferred):** Collect `title`, `description` (excerpt), `url`,
   `publishedAt`, `author`, `category` from feed. Sufficient for demand signal classification
   in most cases. No article page fetch required.

2. **RSS + article fetch (selective):** Use `safeFetchText()` on the article URL only when
   the LLM extraction confidence on excerpt-only is below 0.60. Never fetch paywalled content.

3. **Sitemap crawl (MFE only, future):** Parse `sitemap_index.xml` → individual article
   sitemaps → fetch new URLs not yet in `cre_news_items`. Requires separate ToS review before
   implementation. Not part of Phase 1–3.

### 4.2 Poll Cadence

| Source Type | Recommended Cadence | Rationale |
|-------------|--------------------|-----------| 
| National news (Bisnow national, TRD national, CO) | Every 4 hours | 5–15 new items/day; 4h catches same-day stories |
| Regional/metro feeds (Bisnow markets, TRD regional) | Every 8 hours | Lower volume; 8h sufficient |
| Deal announcement feeds (Connect CRE, REBusinessOnline) | Every 4 hours | Fast-moving deal flow; time-sensitive for M35 |
| Finance/analysis (Trepp, HousingWire) | Every 6 hours | Analysis pieces; less time-sensitive |
| SEC EDGAR 8-K | Every 2 hours (market hours) | Filing events are material |

### 4.3 Rate Limiting

Retain the existing TokenBucket from `cre-rss.ts` as the global rate governor. Add
domain-level isolation to prevent parallel requests to the same host:

```typescript
// Per-domain token buckets prevent parallel hammering of a single origin
const domainBuckets = new Map<string, TokenBucket>();

function getDomainBucket(url: string): TokenBucket {
  const domain = new URL(url).hostname;
  if (!domainBuckets.has(domain)) {
    domainBuckets.set(domain, new TokenBucket({
      tokensPerSecond: 0.5, // 1 req per 2 sec per domain
      burst: 2,
    }));
  }
  return domainBuckets.get(domain)!;
}
```

For selective article full-body fetches via `safeFetchText()`: additional 2–5 second
per-domain delay between fetches.

### 4.4 What NOT to Fetch

Never fetch:
- `/newsletters/*` or any authenticated newsletter content
- Paginated archive pages (`/archives/`, `/page/N/`, `?paged=N`)
- Event listings or attendee data
- Any URL matching a `Disallow` rule in the source's `robots.txt`
- Any URL behind a hard paywall or login wall
- The CoStar News editorial site (`costar.com/news`) — handled via CoStar API subscription

---

## §5 Technical Architecture

### 5.1 Proposed Storage Schema

#### New table: `cre_news_items` (platform-level, not per-user)

```sql
CREATE TABLE cre_news_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         TEXT NOT NULL,           -- 'bisnow', 'connectcre', 'mhn', etc.
  dedupe_key        TEXT NOT NULL UNIQUE,    -- SHA-256(canonical_url)
  url               TEXT NOT NULL,
  canonical_url     TEXT NOT NULL,
  title             TEXT NOT NULL,
  excerpt           TEXT,                    -- From RSS description (max 2000 chars)
  full_body         TEXT,                    -- Populated only when article fetch runs
  author            TEXT,
  published_at      TIMESTAMPTZ,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- LLM extraction results
  extraction_status TEXT NOT NULL DEFAULT 'pending', -- pending | extracted | skipped | failed
  extracted_at      TIMESTAMPTZ,
  demand_event_type TEXT,          -- employment | university | military | migration | null
  demand_event_raw  JSONB,         -- Raw Claude output
  confidence        NUMERIC(3,2),  -- 0.00–1.00

  -- Demand signal linkage
  demand_event_id   UUID REFERENCES demand_events(id),

  -- Metadata
  market_tags       TEXT[],        -- ['atlanta', 'multifamily'] extracted from content
  source_metadata   JSONB          -- Feed-specific data (image URL, categories, etc.)
);

CREATE INDEX cre_news_source_fetched ON cre_news_items(source_id, fetched_at DESC);
CREATE INDEX cre_news_published      ON cre_news_items(published_at DESC);
CREATE INDEX cre_news_extraction     ON cre_news_items(extraction_status)
  WHERE extraction_status = 'pending';
CREATE INDEX cre_news_demand_event   ON cre_news_items(demand_event_id)
  WHERE demand_event_id IS NOT NULL;
```

**Rationale for a new table vs. reusing `user_news_items`:**
- `user_news_items` is scoped to `user_id` and `user_news_connection_id` — it models a
  user's personal RSS subscription, not a platform-curated source
- Platform-level trade press ingest must not require a user ID or connection row
- LLM extraction columns (`extraction_status`, `demand_event_type`, `confidence`) do not
  belong on the user-facing news table

#### New table: `cre_rss_sources` (replaces hardcoded `CRE_FEEDS` map)

Moving the registry to the database allows admin-UI management without deploys:

```sql
CREATE TABLE cre_rss_sources (
  id               SERIAL PRIMARY KEY,
  source_id        TEXT NOT NULL,
  source_name      TEXT NOT NULL,
  feed_url         TEXT NOT NULL,
  market           TEXT,             -- NULL = national
  sector           TEXT,             -- multifamily | office | retail | industrial | NULL
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  poll_interval_h  INTEGER NOT NULL DEFAULT 4,
  last_polled_at   TIMESTAMPTZ,
  last_error       TEXT,
  robots_verified  DATE,             -- Date robots.txt compliance was last verified
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 Fetch Pipeline

```
Inngest cron (configurable per source, default every 4h)
  → pollCRENewsFeeds()
       → SELECT * FROM cre_rss_sources WHERE is_active = TRUE
       → for each source:
           → getDomainBucket(feedUrl).consume()
           → safeFetchText(feedUrl)            ← SSRF-safe, redirect-aware
           → parseStringPromise(xml)           ← xml2js
           → for each item:
               → canonicalizeUrl(item.link)
               → dedupe_key = SHA-256(canonical_url)
               → INSERT INTO cre_news_items
                   ON CONFLICT (dedupe_key) DO NOTHING
           → UPDATE cre_rss_sources SET last_polled_at = NOW()

  → (after insert batch completes) enqueueExtractionBatch()

Inngest function: extractDemandSignals()  ← separate function
  → SELECT * FROM cre_news_items
      WHERE extraction_status = 'pending'
      ORDER BY published_at DESC
      LIMIT 50
  → applyKeywordPreFilter(items)          ← §9.3 — skip obvious non-events
  → for each item passing pre-filter:
      → buildExtractionPrompt(item)
      → call Claude claude-3-5-haiku-20241022
      → parseClaudeResponse()
      → UPDATE cre_news_items SET extraction_status, demand_event_type,
          confidence, demand_event_raw, extracted_at
      → if demand_event_type IS NOT NULL AND confidence >= 0.80:
          → DemandSignalService.createDemandEvent(demand_event_input)
          → UPDATE cre_news_items SET demand_event_id = new_event.id
      → if confidence 0.60–0.79:
          → surface to operator review queue (future UI)
```

---

## §6 LLM Extraction Design

### 6.1 Extraction Scope

The LLM extraction step has a **single narrow objective**: determine whether a news article
describes a real event that would generate net-new housing demand in a specific submarket,
and if so, extract the structured `DemandEventInput` that `DemandSignalService` expects.

It does NOT attempt to:
- Summarize or rewrite the article
- Extract deal pricing, cap rate, or financing data (separate pipeline)
- Classify supply events (new construction announcements)
- Rate sentiment or generate editorial commentary

### 6.2 Model Selection

| Model | Input cost | Recommended for |
|-------|-----------|----------------|
| `claude-3-5-haiku-20241022` | $0.80/M tokens | **Primary** — batch processing 50+ items/run |
| `claude-3-5-sonnet-20241022` | $3.00/M tokens | Re-runs on low-confidence items (< 0.70) |
| Claude Opus | $15.00/M tokens | **Not recommended** for batch extraction |

### 6.3 Extraction Prompt

```
You are a commercial real estate demand signal extractor. Determine whether the article
below describes an event that will bring net-new workers, residents, or students to a
specific metro market.

DEMAND CATEGORIES (use exactly one, or null):
- "employment"  : New employer, corporate relocation, office opening, factory/warehouse
                  opening, company expansion
- "university"  : New campus, enrollment expansion, new student housing program
- "military"    : New base, base expansion, troop deployment
- "migration"   : Government program, tax incentive, or infrastructure project that
                  drives population inflow

OUTPUT — strict JSON, no markdown, no explanation:
{
  "is_demand_event":   boolean,
  "category":          "employment" | "university" | "military" | "migration" | null,
  "confidence":        number (0.00–1.00),
  "location": {
    "city":            string | null,
    "state":           string | null,
    "metro":           string | null
  },
  "people_count":      number | null,     // Direct headcount if stated
  "employer_name":     string | null,     // For employment events
  "event_description": string | null,     // One sentence, max 100 chars
  "source_quote":      string | null      // Verbatim supporting quote, max 150 chars
}

RULES:
1. Set is_demand_event = false for: market statistics, cap rates, financing terms, property
   sales/acquisitions, construction delays, or general market analysis.
2. Set is_demand_event = false if location cannot be determined to at least city-level.
3. Set confidence < 0.50 if people_count is unstated and must be inferred.
4. If is_demand_event = false, all other fields may be null.

ARTICLE TITLE: {title}

ARTICLE EXCERPT: {excerpt}
{full_body_block}
```

Where `{full_body_block}` is either empty (excerpt-only mode) or:

```
FULL ARTICLE TEXT: {full_body}
```

### 6.4 Response Parsing

```typescript
interface ExtractionResult {
  is_demand_event: boolean;
  category: 'employment' | 'university' | 'military' | 'migration' | null;
  confidence: number;
  location: { city: string | null; state: string | null; metro: string | null };
  people_count: number | null;
  employer_name: string | null;
  event_description: string | null;
  source_quote: string | null;
}

function parseExtractionResult(raw: string): ExtractionResult | null {
  try {
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.is_demand_event !== 'boolean') return null;
    if (typeof parsed.confidence !== 'number') return null;
    return parsed as ExtractionResult;
  } catch {
    return null;
  }
}
```

**Confidence thresholds and downstream routing:**

| Confidence | Action |
|-----------|--------|
| ≥ 0.80 | Auto-create `demand_event`; feed to M35 via `DemandSignalService` |
| 0.60–0.79 | Create `demand_event` with `verified = false`; surface in operator review queue |
| 0.40–0.59 | Store extraction result; do NOT create `demand_event` without operator promotion |
| < 0.40 | Set `extraction_status = 'skipped'`; do not store a demand event |

---

## §7 Sample Test Plan

### 7.1 RSS Fetch Validation

For each active source in `cre_rss_sources`, validate:

1. Feed returns HTTP 200 with `Content-Type: application/rss+xml` or `text/xml`
2. Parsed item count ≥ 1 and ≤ 500
3. Every item has: `title` (non-empty), `link` (valid HTTPS URL), `pubDate` (parseable date)
4. At least 50% of items have a non-empty `description`
5. Most-recent item's `pubDate` is within 7 calendar days

```typescript
interface FeedValidationResult {
  sourceId: string;
  feedUrl: string;
  httpOk: boolean;
  itemCount: number;
  hasMinItems: boolean;        // ≥ 1
  allHaveTitle: boolean;
  allHaveLink: boolean;
  descriptionCoverage: number; // 0.0–1.0
  mostRecentAgeDays: number;
  freshWithin7Days: boolean;
}
```

Expected results per source:

| Source | Expected Items | Expected Freshness |
|--------|---------------|-------------------|
| Bisnow national | 25–35 | < 3 days |
| Connect CRE | 20–40 | < 2 days |
| MHN | 10–30 | < 5 days |
| REBusinessOnline | 10–25 | < 5 days |
| TRD national | 5–15 | < 3 days |
| Commercial Observer | 10–20 | < 2 days |
| Trepp | 8–15 | < 10 days |
| PropModo | 8–15 | < 3 days |
| HousingWire | 15–30 | < 2 days |
| SEC EDGAR 8-K | 5–50 | < 1 day |

### 7.2 LLM Extraction Test Corpus

20 labeled articles — 10 demand events, 10 non-events:

| Article (simulated title) | Expected `is_demand_event` | Expected Category |
|--------------------------|---------------------------|------------------|
| "Apple opens 2,000-employee Austin campus" | true | employment |
| "Multifamily cap rates compressed 50bps in Q1" | false | null |
| "Amazon announces 1,500-job distribution center in Atlanta" | true | employment |
| "Freddie Mac tightens multifamily underwriting standards" | false | null |
| "Georgia Tech announces 500-student enrollment expansion" | true | university |
| "Office vacancy hits 22% nationally" | false | null |
| "Fort Bragg to receive 3,000 additional troops" | true | military |
| "CMBS delinquencies rise to 4.5%" | false | null |
| "HUD Section 8 expansion brings 800 vouchers to Miami" | true | migration |
| "CRE lending volume fell 30% year-over-year" | false | null |
| "Rivian adds 5,000 manufacturing jobs in Normal, IL" | true | employment |
| "Average effective rent declined in Sun Belt markets" | false | null |
| "Johns Hopkins opens satellite medical campus in DC" | true | university |
| "Blackstone acquires 10,000-unit apartment portfolio" | false | null |
| "Governor signs tech incentive package attracting 3 firms to Phoenix" | true | migration |
| "Self-storage cap rates widen 75bps" | false | null |
| "Navy relocates 1,200 personnel to Norfolk Naval Station" | true | military |
| "Multifamily starts fell 40% from peak" | false | null |
| "State incentivizes Tesla Gigafactory 3 in Tennessee" | true | employment |
| "CRE investment sales volume up 12% QoQ" | false | null |

**Acceptance criteria:**
- Precision ≥ 0.85 (false positive rate ≤ 15%)
- Recall ≥ 0.80 (false negative rate ≤ 20%)
- Average confidence on true positives ≥ 0.75
- JSON parse failure rate < 5%

### 7.3 Deduplication Tests

1. **Same-source re-poll:** Insert same article URL twice across two poll cycles → confirm
   exactly one row in `cre_news_items` (ON CONFLICT DO NOTHING)
2. **UTM parameter stripping:** Same URL with `?utm_source=newsletter&utm_campaign=daily`
   appended → canonical URL strips params → same `dedupe_key` → single row
3. **Fragment stripping:** Same URL with `#section-anchor` → canonical strips fragment →
   single row
4. **Cross-source pair:** Same story appearing on both Bisnow and REBusinessOnline (different
   canonical URLs) → confirm two rows with different `source_id` — cross-source dedup is
   handled at query time (see §8.2)

---

## §8 Deduplication Strategy

### 8.1 Within-Source Deduplication

**Mechanism:** SHA-256 hash of the canonical URL as the `dedupe_key` unique constraint.

**Canonical URL algorithm** (reuse `canonicalizeUrl()` from `inbound-email.ts`):
1. Remove tracking parameters: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
   `utm_term`, `fbclid`, `gclid`
2. Lowercase scheme and host
3. Remove trailing slash (unless root path `/`)
4. Remove URL fragment (`#anchor`)
5. Sort remaining query parameters alphabetically for deterministic keys

**Insert pattern:** `ON CONFLICT (dedupe_key) DO NOTHING` — identical to `user_news_items`.

### 8.2 Cross-Source Deduplication

A breaking story may appear on Bisnow, REBusinessOnline, and Connect CRE within the same
24-hour window, each with a different canonical URL. At the `cre_news_items` level, these are
three separate rows (different `source_id`, different canonical URLs). Cross-source dedup is
performed at **query time**, not at insert time — this preserves all sourcing data for audit.

**Query-time algorithm:**
1. Group candidate items by `published_at` window (±12 hours)
2. Within each window, compute normalized title similarity using `pg_trgm`
3. Rows with `similarity(normalize_title(a.title), normalize_title(b.title)) > 0.65` are
   treated as covering the same story
4. Return only the item with the highest-priority source:

```
Priority order: therealdeal > bisnow > commercialobserver > connectcre
              > rebusinessonline > mhn > housingwire > (others)
```

```sql
WITH candidates AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY date_trunc('day', published_at),
                   -- pg_trgm bucket (approximate; exact dedup uses similarity() in WHERE)
                   left(lower(regexp_replace(title, '[^a-z0-9 ]', '', 'gi')), 30)
      ORDER BY
        CASE source_id
          WHEN 'therealdeal'       THEN 1
          WHEN 'bisnow'            THEN 2
          WHEN 'commercialobserver' THEN 3
          WHEN 'connectcre'        THEN 4
          WHEN 'rebusinessonline'  THEN 5
          WHEN 'mhn'               THEN 6
          WHEN 'housingwire'       THEN 7
          ELSE 8
        END
    ) AS source_rank
  FROM cre_news_items
  WHERE published_at > NOW() - INTERVAL '48 hours'
)
SELECT * FROM candidates WHERE source_rank = 1;
```

Note: Full production implementation should use `pg_trgm`'s `similarity()` function in a
join condition before the window ranking. The above is a simplified illustration.

**Prerequisite:** `pg_trgm` extension must be enabled (`CREATE EXTENSION IF NOT EXISTS pg_trgm`).

### 8.3 Extraction Deduplication

LLM extraction only runs on items with `extraction_status = 'pending'`. Once set to
`extracted` or `skipped`, an item is never re-processed. This prevents duplicate
`demand_event` creation even if the same article URL is polled again in a future cycle.

---

## §9 Cost Estimate

### 9.1 Polling Costs

RSS polling uses public feeds — no per-request API cost. All costs are infrastructure.

**Request volume estimate:**
- 10 active national feeds × 6 polls/day = 60 requests
- 17 Bisnow regional feeds × 3 polls/day = 51 requests
- 3 TRD regional feeds × 3 polls/day = 9 requests
- **Total: ~120 RSS requests/day**

At the existing 1 req/sec global rate with per-domain spacing, a full poll cycle completes
in approximately 3–5 minutes. Negligible compute overhead.

### 9.2 LLM Extraction Costs

**Assumptions:**
- 120 new articles/day ingested across all active sources
- Keyword pre-filter (§9.3) eliminates ~60% → ~48 items pass to LLM
- Excerpt-only mode: 800 tokens input avg (title + excerpt + prompt)
- Full-body fetch (selective, ~25% of items): 3,000 tokens input avg
- Response: ~200 tokens

| Scenario | Items/day | Cost/day (Haiku) | Cost/month |
|----------|----------|-----------------|------------|
| Excerpt-only extractions | 36 | 36 × 1,000 × $0.80/1M = $0.029 | $0.87 |
| Full-body fetch + extract | 12 | 12 × 3,200 × $0.80/1M = $0.031 | $0.93 |
| Sonnet re-runs (confidence < 0.70) | 10 | 10 × 1,200 × $3.00/1M = $0.036 | $1.08 |
| **Total** | **58** | **~$0.10/day** | **~$2.88** |

### 9.3 Keyword Pre-Filter Gate

Before sending to LLM, apply a fast regex keyword filter. This cuts LLM calls by ~60%
and adds no measurable latency.

**Pass to LLM if title OR excerpt contains any of (case-insensitive):**
```
headquarter|relocat|campus|employ|hire|hiring|jobs|workforce|open[s]? [a-z]* office|
expansion|facility|manufacturing|distribution center|data center|
university|college|enrollment|student housing|
military|base|troops|battalion|deployment|
migration|voucher|incentive|program|attract talent|tech hub|
announce[sd] [0-9]|adding [0-9]|bringing [0-9]
```

**Skip (set `extraction_status = 'skipped'`) if title matches:**
```
cap rate|vacancy rate|delinquency|CMBS|lending volume|refinanc|
interest rate[s]?|NOI|DSCR|underwriting|spreads|basis points|
multifamily market report|quarterly.*report|market update|
investment sales volume|transaction volume
```

### 9.4 Article Fetch Costs

`safeFetchText()` uses server outbound bandwidth. At ~30 selective article fetches/day ×
~100 KB average HTML page = 3 MB/day. Negligible.

### 9.5 Total Monthly Infrastructure Estimate

| Component | Monthly Cost |
|-----------|-------------|
| LLM extraction (Haiku primary + selective Sonnet) | $3–6 |
| Inngest function runs (~6 poll runs/day + extraction runs) | Included in Inngest free tier |
| RSS egress bandwidth (~120 req/day × ~25 KB avg) | < $0.05 |
| Article fetch bandwidth (~30/day × ~100 KB) | < $0.10 |
| **Total** | **~$3–7 / month** |

---

## §10 Licensing Roadmap

### 10.1 Current Status: No Commercial Licenses

The platform currently holds no syndication or licensing agreements with any trade press
source. All access is via:
1. Publicly offered RSS feeds (machine-readable by design, published by the sources themselves)
2. Standard HTTP fetch of publicly available article pages

### 10.2 Legal Risk Assessment

| Source | Risk Level | Basis |
|--------|-----------|-------|
| SEC EDGAR | None | US government public data, legally mandated disclosure |
| REBusinessOnline | Low | Fully permissive robots.txt; small regional publisher; no enforcement history |
| Connect CRE | Low–Medium | robots.txt path ambiguity; small publisher; internal use defensible |
| Multi-Housing News | Low | `/feed/` permitted; Yardi-owned enterprise but no known enforcement history |
| HousingWire | Low | Permissive robots.txt; RSS clearly offered for aggregation |
| Trepp | Low–Medium | B2B data company; RSS offered publicly; internal use defensible |
| PropModo | Low | Small publisher; RSS public and unrestricted |
| Commercial Observer | Medium | Quality publisher; standard ToS; premium brand increases enforcement sensitivity |
| The Real Deal | Medium | Premium publication; partial paywall indicates revenue sensitivity |
| Bisnow | Medium | `bisnow.com/legal/terms` explicitly prohibits unauthorized commercial use; RSS is public but ToS is restrictive |

### 10.3 Risk Mitigation: Fair Use Posture

Maintain the following posture to minimize legal exposure:

1. **Internal use only:** Do not expose raw trade press article text to end users via API
   or UI export. Surface extracted demand signals and attribution links — not article bodies.

2. **Attribution:** Store `source_id` and `url` with every extracted item. Surface source
   name and link to original article in any UI where a demand event is displayed.

3. **No bulk redistribution:** Do not allow export or bulk download of raw article text
   from `cre_news_items`. Aggregated demand signals (counts, classifications) may be exported.

4. **Excerpt only in UI:** If headlines are surfaced to users, show title + one-sentence
   excerpt + link to original. Never surface full article body.

5. **robots.txt compliance:** Never fetch URLs matching a `Disallow` rule for the
   crawling user-agent. Use `ssrfGuardFeedUrl()` + robots.txt check before any fetch.

6. **Honest User-Agent:** Maintain `JediRE/1.0 (+https://jedire.app) CRE-News-Aggregator`
   for RSS polling. Do not impersonate browsers for RSS fetches (browser UA is acceptable
   only for article page fetches where edge CDNs block bot UAs, per existing `ssrf-guard.ts`
   comment).

### 10.4 Licensing Pursuit Roadmap

**Phase A (Months 1–3) — Establish relationships:**
- Identify editorial/partnership contacts at Bisnow and The Real Deal (highest value,
  medium risk)
- Bisnow has a formal B2B media program ("BisNow Media"); propose co-marketing or
  data licensing arrangement in exchange for referral traffic
- CoStar News is handled separately via CoStar API contract — not trade press

**Phase B (Months 3–6) — Formal agreements:**
- Target: Bisnow RSS syndication agreement (or explicit written permission for aggregation)
- Target: TRD data licensing (The Real Deal has a data products division)
- Lower priority: HousingWire, Connect CRE (low enough risk without formal agreement)

**Phase C (Months 6–12) — Scale or buy:**
- If ingest volume grows to > 500 articles/day, evaluate paid news licensing APIs:

| Service | Coverage | Cost | Notes |
|---------|---------|------|-------|
| NewsAPI.org | General + some CRE | $449/mo (Business) | Already in `news.service.ts`; paid tier has full-body access with licensed distribution rights |
| Diffbot | Structured article extraction | ~$299/mo | LLM-free extraction; licensed resale rights included |
| Meltwater | Enterprise news monitoring | $10k+/yr | Includes syndication rights; appropriate at Series B scale |

---

## §11 Phasing Recommendation

### Phase 1 — Registry Fixes and Gap Fills (Week 1–2)

Code changes only. No schema migration. Immediate compliance and quality improvement.

| # | Work Item | File | Risk |
|---|-----------|------|------|
| 1.1 | Fix Bisnow URLs: replace all `/feed/` with `/rss/{market}` | `cre-rss.ts` | None |
| 1.2 | Remove MFE from registry (dead endpoint) | `cre-rss.ts` | None |
| 1.3 | Add REBusinessOnline: `rebusinessonline.com/feed/` | `cre-rss.ts` + new provider | None |
| 1.4 | Add The Real Deal national: `therealdeal.com/national/feed/` | `cre-rss.ts` + new provider | None |
| 1.5 | Fix Connect CRE path: `/feed/` → `/stories/feed/` | `cre-rss.ts` | None |
| 1.6 | Register new providers in `news.service.ts` | `news.service.ts` | None |

**Estimated effort:** 1 day
**Schema changes:** None
**Expected outcome:** All 10 active sources return valid RSS. Zero silent 404 failures.

---

### Phase 2 — Platform News Table and Scheduled Polling (Weeks 2–4)

Schema migration + Inngest function. Establishes the persistent news layer.

1. Migration: create `cre_news_items` + `cre_rss_sources` tables with seed data
2. Implement `pollCRENewsFeeds()` Inngest cron function
3. Wire to `safeFetchText()` for all article-page fetches
4. Validate against test plan §7.1 (all sources pass feed validation)

**Estimated effort:** 2–3 days
**Schema changes:** 2 new tables
**Risk:** Low

---

### Phase 3 — LLM Extraction and M35 Wiring (Weeks 4–6)

LLM extraction pipeline + `DemandSignalService` integration.

1. Implement `extractDemandSignals()` Inngest function per §6 prompt design
2. Add keyword pre-filter (§9.3) to reduce LLM costs
3. Wire high-confidence extractions (≥ 0.80) to `DemandSignalService.createDemandEvent()`
4. Surface medium-confidence items (0.60–0.79) in operator review queue (new UI widget)
5. Validate against §7.2 test corpus (precision ≥ 0.85, recall ≥ 0.80)

**Estimated effort:** 3–4 days
**Schema changes:** LLM extraction columns added in Phase 2 migration
**Risk:** Medium — LLM cost and false positive rate must be monitored for first 2 weeks;
  adjust keyword pre-filter and confidence thresholds based on observed output

---

### Phase 4 — Cross-Source Dedup and Source Quality Scoring (Weeks 6–8)

`pg_trgm`-based cross-source dedup views + source health metrics.

1. Enable `pg_trgm` extension
2. Implement `cre_news_deduplicated` view per §8.2
3. Add `demand_event_hit_rate` metric to `cre_rss_sources` (extracted / fetched ratio)
4. Operator dashboard widget: "News Intelligence Feed" showing deduplicated items +
   extraction status + demand event confidence distribution

**Estimated effort:** 2–3 days
**Risk:** Low

---

### Do NOT Pursue in This Phase

- Full-text article fetches at scale before confirming excerpt-only extraction achieves
  ≥ 0.80 recall on the §7.2 test corpus
- Multifamily Executive sitemap crawl — requires separate ToS/robots.txt review
- Any automated fetch behind a paywall or authentication wall
- CoStar News editorial content — handled exclusively via CoStar API contract
- Bisnow commercial licensing — pursue in Phase B (business track), not an engineering
  dependency for Phases 1–4

---

*End of document. Design only — no scraping code implemented.*
