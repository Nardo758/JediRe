# DISPATCH — QW-2: `origin_class` DB Migration (Make Origin Real)

**#2 of 6. GATE: none — execute immediately. Type: DB migration, small, doctrinally load-bearing.**
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. Requires DB access.
**Finding source:** both audits — `origin_class` is FIXTURE-ONLY; no live DB column. The entire lifecycle/origin doctrine (platform_underwritten / owned_import / archive_import), F-P1-C honest-absence, and provenance-weighted calibration all assume it's real data. It isn't.
**Standing rules:** S1-01 live evidence · irreversible ops proven before execution · value identity (this is additive — no existing output moves).

## Build
1. **Migration:** add `origin_class` to the `deals` table — enum/text with the three canonical values (`platform_underwritten`, `owned_import`, `archive_import`), nullable initially (backfill in step 3), default NULL not a fabricated value.
2. **Backfill the two known deals** from their established doctrine: Bishop = `archive_import`, Highlands = `owned_import`. Any other existing deals: classify by evidence (has underwriting + no actuals = platform_underwritten; has actuals + no platform underwriting = owned_import; has archive-era actuals = archive_import) OR leave NULL and report the unclassifiable set for operator ruling — do NOT guess.
3. **Read-path wiring:** the places that currently infer origin from fixtures/heuristics repoint to the column. Enumerate them (file:line) before changing; the F-P1-C honest-absence check especially.

## Acceptance
1. Migration applied; `SELECT id, name, origin_class FROM deals` pasted — Bishop archive_import, Highlands owned_import, others classified-or-NULL-with-reason.
2. Value identity: both reference deals' build/seed outputs unchanged (additive column, no behavior change yet) — pasted.
3. Reversible-from-backup confirmed (additive column, trivially so).
4. Unclassifiable-deals list reported for operator ruling (if any).

## OUT OF SCOPE
Create-path origin ASSIGNMENT (that's CREATE-1 — this just makes the column exist and backfills known deals) · behavior changes keyed off origin (future) · lifecycle vintage machinery.
