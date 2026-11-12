---
name: Apartment Locator source policy
description: Approved rent-data source and interpretation limits for property-level rent history.
---

Use Apartment Locator AI for rental observations instead of scraping Apartments.com. Enrichment should consume locally synced data, not add per-property external calls.

**Why:** The user approved a dispatch stating “We don't need to scrap them. we have an API to Apartment Locator AI.” The same dispatch requires keeping unknown API capabilities explicit rather than guessing endpoints, floor-plan identity, historical availability, or actual asset class.

**How to apply:** Preserve existing latest-data readers while collecting forward daily history. Beds/baths/square footage are a proxy for unit-type identity, not a guaranteed floor-plan identifier. Year-built categories are vintage proxies, not observed quality classes. Do not infer effective rent from concession text without lease-term evidence.
