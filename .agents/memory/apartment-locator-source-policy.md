---
name: Apartment Locator source policy
description: Approved rent-data source and interpretation limits for property-level rent history.
---

Use Apartment Locator AI for rental observations instead of scraping Apartments.com. Enrichment should consume locally synced data, not add per-property external calls.

**Why:** The user approved a dispatch stating “We don't need to scrap them. we have an API to Apartment Locator AI.” The same dispatch requires keeping unknown API capabilities explicit rather than guessing endpoints, floor-plan identity, historical availability, or actual asset class.

**How to apply:** Preserve existing latest-data readers while collecting forward daily history. Beds/baths/square footage are a proxy for unit-type identity, not a guaranteed floor-plan identifier. Year-built categories are vintage proxies, not observed quality classes. Do not infer effective rent from concession text without lease-term evidence.

**Delivery scope:** Keep rent-history changes separate from authentication, TypeScript cleanup, and Clawdbot assumption-edit work.

**Why:** The approved dispatch explicitly separates those efforts. GitHub master and the main app's history can diverge, so synchronizing a GitHub-based branch into the main app can replay unrelated commits.

**How to apply:** Check the change list against each destination's own base. Keep only the rent-history commits on each base rather than importing unrelated features or deleting work already accepted in the destination.
