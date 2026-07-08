---
name: Capsule fill-lane audit (CoStar upload restricted-data enforcement)
description: Findings on whether uploaded restricted-vendor (CoStar) data stays deal-scoped and license-respecting, vs where the tag is only descriptive metadata.
---

Full report: `docs/audits/CAPSULE_FILL_LANE_AUDIT.md`.

- `vendor_license_posture`/`licensePosture` has exactly one real enforcement consumer platform-wide: `vendor-freshness.service.ts`'s `redactRestrictedVendorPlatformIntel()`, wired only into the external share/export path (`capsule-sharing.routes.ts`). Everywhere else (internal correlation engine, calibration, comp pools) the tag is written but never read as a filter — convention, not enforcement.

**Why this matters:** before trusting that "restricted" data can't leak internally, always verify a read-path filter exists — a column being modeled and written correctly says nothing about whether anything downstream actually checks it.

- Confirmed active leak: `market_snapshots` (no `deal_id` column, geography-keyed only) is fed by CoStar uploads and pooled across all deals/users per submarket+period in `concession-time-series.service.ts`, then written into `metric_time_series` — the direct input to the platform-wide correlation engine (`correlationEngine.service.ts`). One operator's CoStar upload becomes a shared cross-deal benchmark.
- Sale/rent comp tables (`market_sale_comps`/`market_rent_comps`) DO stay deal-scoped (`deal_id` required on every write) — the leak is specific to aggregated submarket time-series, not comps.
- No fine-tuning/prompt-logging firewall exists anywhere: `ai_usage_log`, `skill_chat_messages`, and the pattern-training extraction pipeline (`pattern-extractor.ts`) log/consume all LLM content indiscriminately with no license-source field to even filter on.

**How to apply:** when auditing any "restricted data" claim in this codebase, grep for actual read-side `WHERE`/filter usage of the flag column, not just where it's set. A stored-but-unread flag is the default state here, not the exception.

**Remediation status (2026-07-08):** `costar_market_metrics` (the table actually read by
COR-21/22/26/27 via city-name `LIKE`, not `market_snapshots` as originally suspected) was fixed:
added `deal_id`/`is_restricted` columns; every read now requires `AND (is_restricted = FALSE OR
deal_id = $dealId)`, with restricted rows excluded entirely when no `dealId` is supplied (safe
default). See `docs/architecture/costar-firewall-enforcement-report.md` for full proof. The
`market_snapshots` CoStar bridge described above was separately confirmed to be **dead code**
(geography_id key mismatch) — it doesn't currently move CoStar data anywhere, so it was
deprioritized rather than fixed. I2 (fine-tuning/prompt-logging firewall) re-audited and found
`ai_usage_log` is metadata-only (no prompt/completion text column) — no fix needed there; only a
future agent-tool integration of correlation output would need to apply this same scoping.
