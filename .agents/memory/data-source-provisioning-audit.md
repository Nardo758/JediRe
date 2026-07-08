---
name: Data source provisioning audit (2026-07-08)
description: Full external-data-source inventory for Research/Supply/Zoning agents — credential naming gotcha, dead tool→route links, dead fallback table, and CoStar firewall re-confirmation. Full report at docs/audits/DATA_SOURCE_PROVISIONING_AUDIT.md.
---

## Anthropic/Claude credential naming gotcha

Anthropic access does NOT check the generic `ANTHROPIC_API_KEY` env var name. The actual code (`llm.service.ts`, `zoning-agent.service.ts`) reads `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (primary) with `CLAUDE_API_KEY` as a local-dev fallback. `ANTHROPIC_API_KEY` being unset is a red herring — do not classify Claude-backed features (Commentary, Zoning, Cashflow, design-assistant) as missing credentials on that basis alone; check `AI_INTEGRATIONS_ANTHROPIC_API_KEY` instead.

**Why:** an earlier pass in this same audit almost mis-classified all Claude-dependent agents as NO-CREDENTIAL before this was caught.

## Two Supply-agent tools call routes that don't exist (dead 404s)

`fetch_permits.ts` calls `/supply/permits` and `fetch_submarket_deliveries.ts` calls `/supply/deliveries` — neither route exists anywhere in `backend/src/api/rest/` (confirmed by full grep). Every invocation 404s. A working, real-data-backed route already exists at `GET /api/v1/supply/historical-deliveries` (in `supply.routes.ts`, queries `apartment_supply_pipeline`) but no tool points at it.

**How to apply:** if fixing Supply agent data quality, either build the missing routes or repoint the two tools at `historical-deliveries`.

## `market_inventory` table is never populated

`fetch_costar_metrics`'s city/state fallback path queries the `market_inventory` table, but there is no `INSERT INTO market_inventory` anywhere in the codebase — it's a permanently-empty dead fallback, not a bug in the query itself.

## CoStar firewall — reconfirmed intact (2026-07-08)

No live CoStar API call or scrape exists anywhere in `backend/src`. CoStar data enters only via manual operator upload of 3 export types, parsed by `costar.vendor.ts` (`licensePosture: 'restricted'`). Tools named `fetch_costar_metrics`/`fetch_costar_pipeline` are misleadingly named — they hit 100% internal Postgres-backed routes (`/supply/deals/:dealId/supply`, `/market/inventory/:city/:state`), never CoStar's servers. Re-confirm this same way (grep for `costar.com`, CoStar SDK, or CoStar env vars outside the vendor-registry parser) before ever asserting the firewall has broken.

## `data-sources.ts` legacy registry — orphan status unconfirmed

`backend/src/services/discovery/data-sources.ts` defines a `DATA_SOURCES` registry (BLS, FRED, Census, NewsAPI, Treasury, Yahoo Finance, SEC, Serper, RSS feeds) with declared auth types, but no caller of `getDataSource`/`DATA_SOURCES` was found outside the file itself in the areas explored. Treat as suspected-orphaned, not confirmed-orphaned — a full caller grep across all of `backend/src` was not completed before the audit closed.
