# Rent Scraper Architecture

## Overview

The Rent Scraper Pipeline uses Cloudflare Browser Rendering to scrape live rent data from competitor apartment websites. Results are stored in the database and accessible via Clawdbot commands. A weekly cron job automates scraping across all active markets.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID for Browser Rendering API |
| `CLOUDFLARE_BR_TOKEN` | Yes | Cloudflare API token with Browser Rendering permissions |

## Database Tables

### `rent_scrape_targets`
Tracks competitor apartment properties to scrape.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Property name |
| address | TEXT | Street address |
| market | TEXT | Market name (e.g., "Atlanta") |
| website_url | TEXT | Leasing website URL to scrape |
| active | BOOLEAN | Whether target is actively scraped |
| created_at | TIMESTAMPTZ | Creation timestamp |

### `rent_scrape_results`
Stores each scrape attempt and parsed results.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| target_id | UUID | FK to rent_scrape_targets |
| scraped_at | TIMESTAMPTZ | When the scrape occurred |
| raw_html | TEXT | Raw HTML (nullable, omitted for storage) |
| parsed_units | JSONB | Array of parsed unit/rent data |
| avg_rent | NUMERIC | Average rent across parsed units |
| min_rent | NUMERIC | Minimum rent found |
| max_rent | NUMERIC | Maximum rent found |
| error | TEXT | Error message if scrape failed |

## Services

### RentScraperService (`rent-scraper.service.ts`)
Core service that:
- Calls Cloudflare Browser Rendering REST API to fetch rendered HTML
- Parses rent/unit data from HTML via regex patterns
- Persists results to `rent_scrape_results`
- Supports querying rent changes over time

### RentScraperScheduler (`rent-scraper-scheduler.ts`)
Weekly cron that:
- Runs every Sunday at 2:00 AM EST (7:00 UTC)
- Iterates all markets with active targets
- Calls `runScrapeJob` for each market

## Clawdbot Commands

| Command | Params | Description |
|---|---|---|
| `scrape_property` | `{ url }` | Scrape a single URL and return parsed results |
| `run_scrape_job` | `{ market }` | Scrape all active targets for a market |
| `get_rent_changes` | `{ market?, days? }` | Query rent deltas over past N days |
| `add_scrape_target` | `{ name, address, websiteUrl, market? }` | Add a new property to track |
| `list_scrape_targets` | `{ market? }` | List tracked targets |

## Cloudflare Browser Rendering API

Endpoint: `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/browser-rendering/content`

The API renders JavaScript-heavy pages and returns the full DOM HTML. This is necessary because most apartment leasing websites load rent data dynamically.

## Seed Data

The initial seed includes 100+ Atlanta-area multifamily properties with known leasing website URLs. Run the seed script manually:

```bash
npx tsx jedire/backend/src/scripts/seed-atlanta-scrape-targets.ts
```

## Future Enhancements

- Google Places API integration to auto-discover website URLs for new properties
- Frontend UI for viewing scraped rent trends
- Expand to additional markets beyond Atlanta
