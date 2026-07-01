# DISPATCH A (BREADTH) — DATA + SURFACE CLASSIFICATION SPINE (READ-ONLY)

**Runs in parallel with Dispatch B (depth/action-layer).** A and B write DIFFERENT columns of ONE
shared map, keyed on surface name — they cannot collide. A owns the public/private classification +
scoping rule. A does NOT define action semantics (versioning/sharing) — that's B.
**Mode:** READ-ONLY. Enumerate and classify, shallow but COMPLETE. Decide nothing structural, build
nothing.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Report to:** `docs/audits/CLASSIFICATION_MAP_A_SPINE.md`

---

## SHARED VOCABULARY (identical in A and B — do not vary)

- **PUBLIC** = platform-provided. Ingested from a source (ArcGIS, FRED, BLS, Census, FDOT, comps,
  rulesets). Same for every tenant, owned by no one, never org-scoped, readable by all authenticated
  users. The "Bloomberg terminal" reference layer.
- **PRIVATE** = user-generated. Created by a tenant (deals, owned properties, underwriting,
  assumptions, proforma, notes). Belongs to one org, always org-scoped.
- **MIXED** = a table or surface that touches BOTH populations in one place (e.g. a map view showing
  owned assets + comps). Flag every one — these are where scoping breaks.
- **Scoping rule** that follows: PUBLIC → `requireAuth`, global read, never org-filtered. PRIVATE →
  `requireAuth` + `WHERE org_id = <active org>`. MIXED → split predicate
  `(org_id = <ws> OR <public-signal>)`.

---

## A1 — DATA LAYER (tables/entities)

Enumerate every table. For each, one line: PUBLIC / PRIVATE / MIXED + the origin evidence (ingested
vs user-created) + the scoping rule. Use the DB catalog:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
```
For each meaningful table (skip pure join/lookup unless it carries scope), classify by origin:
   - Does anything user-facing WRITE to it via a tenant action? → PRIVATE candidate.
   - Is it populated only by ingest jobs / seeds? → PUBLIC candidate.
   - Both? → MIXED, flag (properties is the known one — 1.06M public + 35 private).
Mark tables already carrying `org_id` (PRIVATE-ready) vs those without.

## A2 — SURFACE LAYER (terminal routes + capsule modules)

Enumerate every terminal F-key surface (Portfolio Context F1–F9, Deal Context F1–F12) and every
deal-capsule module. For each, one line: which tables it reads, and therefore PUBLIC / PRIVATE /
MIXED + scoping rule. Source: the route definitions + the F-key nav config + module registry.
`file:line` per surface.
   - A surface reading only PUBLIC tables → global.
   - A surface reading any PRIVATE table → org-scoped.
   - A surface reading both → MIXED, flag (these are the Step-4 split sites).

## A3 — THE MIXED INVENTORY (the important output)

Collect every MIXED table and MIXED surface into one list. These are the scoping-break risks — where
a naive `WHERE org_id` either leaks private data or hides public data. For each, state which
population is which and what split predicate is needed. (Properties read-classification already did
this for one table; extend the pattern to the whole map.)

---

## DELIVERABLE — the spine (A's columns only)

ONE table, one row per surface/table, columns A owns:
| surface/table | type (route/module/table) | reads | classification (PUBLIC/PRIVATE/MIXED) | scoping rule | org_id ready? |

Plus:
- The complete MIXED inventory (A3)
- Count: PUBLIC / PRIVATE / MIXED
- **Leave the "action semantics" columns EMPTY** — Dispatch B fills those. Do NOT classify
  versioning/sharing/export here; if you notice one, note the surface name so B's rows align, but do
  not define its semantics.

**STOP at the report. A produces the structural spine. Merge with B on surface name. Conflicts
between A's classification and B's action findings are FINDINGS, not overwrites — neither dispatch
silently changes the other's columns.**
