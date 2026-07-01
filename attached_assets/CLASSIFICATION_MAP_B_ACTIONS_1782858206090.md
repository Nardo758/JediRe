# DISPATCH B (DEPTH) — ACTION-LAYER SEMANTICS (READ-ONLY)

**Runs in parallel with Dispatch A (breadth/spine).** A and B write DIFFERENT columns of ONE shared
map, keyed on surface name. B owns ACTION SEMANTICS (versioning, sharing, export, attribution). B
does NOT classify tables PUBLIC/PRIVATE — that's A's column. When B's findings contradict A's
classification, B FLAGS A CONFLICT — it does not overwrite.
**Mode:** READ-ONLY. Go DEEP on the boundary-crossing features — the ones most likely to leak data
once scoping turns on. Build nothing.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Report to:** `docs/audits/CLASSIFICATION_MAP_B_ACTIONS.md`

---

## SHARED VOCABULARY (identical to A — do not vary)

PUBLIC = platform-provided, global. PRIVATE = user-generated, org-scoped. MIXED = both in one place.
(B uses these to describe what an action touches, but does NOT assign the table's classification —
that's A.)

**B's own axes (the action layer):**
- **OWNERSHIP** — does the action's output belong to the USER (member-private) or the ORG (shared
  across members)? The proforma-version question: is my saved version mine, or my org's?
- **VISIBILITY** — member-private (only the creator sees it) vs org-shared (all org members see it)
  vs cross-org (shared outside the org). This is the third bucket inside PRIVATE data.
- **BOUNDARY** — does the action stay within one org, or deliberately CROSS orgs (sharing/export)?
  Boundary-crossers are the leak surface.
- **TENANCY-AWARE?** — was this feature built BEFORE org-scoping existed? Pre-tenancy features assume
  no boundary and are the highest leak risk when scoping turns on.

---

## THE BOUNDARY-CROSSING FEATURES — go deep on each

**B1 — Proforma versioning.** (`F9 Pro Forma`, version saving.)
   - Trace where versions are stored + read. `file:line`.
   - OWNERSHIP: does a saved version carry user_id, org_id, both? Who can read another member's
     versions? Can a teammate in the same org see my proforma versions, or only their own?
   - Is version save org-scoped at all today, or user-only / unscoped?
   - Flag: if versions have no org_id, once deal-scoping lands, version reads may leak or orphan.

**B2 — Capsule sharing.** (`capsule-sharing.routes.ts` — the deliberate boundary-crosser.)
   - Trace the share grant: what does sharing a capsule actually do — copy, or grant-reference?
     `file:line`.
   - BOUNDARY: can a capsule be shared OUTSIDE the owning org? To a specific user? Public link?
   - What does the recipient see — the whole capsule, scoped, or a snapshot? Does the recipient's
     org_id matter, or does the share bypass org-scoping entirely?
   - **This is the #1 leak candidate:** a sharing feature built before tenancy may grant
     cross-org access with no org check. Confirm whether the share path enforces ANY org boundary.
   - (Recall A9 found capsule-sharing tier attribution issues — check whether org-scoping is
     similarly absent.)

**B3 — Export / anything that leaves the system.** Reports, PDF/Excel export, API responses that
   serialize private data.
   - What private data can exit, and does export respect org-scoping or dump broader?
   - `file:line` per export path.

**B4 — Attribution / authorship.** Where private artifacts record who/which-org created them
   (capsule attribution, ai_usage_log, underwriting_evidence).
   - Does attribution correctly carry org_id, and could a scoping change mis-attribute or expose
     cross-org authorship?

---

## CONFLICT PROTOCOL (the parallelism guard)

If, going deep, B finds that a surface A would classify PRIVATE actually behaves as PUBLIC (or vice
versa) — e.g. a "private" capsule that sharing makes effectively public — **write it in B's CONFLICTS
section, keyed on the surface name. Do NOT edit A's classification.** These conflicts are the
highest-value findings: a feature whose action semantics contradict its data classification is
exactly where a leak lives.

---

## DELIVERABLE — B's columns only

ONE table, one row per boundary-crossing feature, columns B owns:
| feature | surface (matches A's key) | ownership (user/org) | visibility (member/org/cross-org) | boundary (in-org/crosses) | tenancy-aware? | leak risk |

Plus:
- **CONFLICTS section:** every surface where B's action semantics contradict A's PUBLIC/PRIVATE call,
  keyed on surface name for merge.
- **Leak-risk ranking:** the boundary-crossing features ordered by exposure if scoping turns on
  without fixing them. Capsule sharing is the expected #1 — confirm or correct.
- One-line: how many boundary-crossing features are NOT tenancy-aware (built pre-scoping) — that
  count is the pre-launch fix queue for Track 1.

**STOP at the report. B produces action semantics + conflicts. Merge with A on surface name. B never
overwrites A's classification; contradictions are FINDINGS.**
