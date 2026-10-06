---
name: Site Finder measurement privacy
description: Privacy and counting constraints for optional instruction-driven Site Finder analytics.
---

Custom Site Finder events must sanitize tracker URL and referrer defaults, not just event properties. Keep instruction/run identifiers in memory only for deduplication.

**Why:** Site Finder navigation carries instruction and run IDs in query strings; an otherwise safe event can disclose those IDs through default tracker metadata.

**How to apply:** Preserve the deployment-injected tracker, override custom-event URL with the fixed Site Finder route, remove identity metadata and referrers, and never add instructions, addresses, parcel IDs, or user IDs. Measurement remains optional and cannot delay or fail searches. Restoring historical snapshots is not a new search outcome.