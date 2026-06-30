# DISPATCH — ORG REALITY CLASSIFICATION (READ-ONLY)

**Question:** one user (m.dixon, `dd201183`?) belongs to 34 orgs; 5 humans span 38 orgs total. Are
those orgs REAL tenants or ARTIFACTS (test data / per-deal import / seeding loop)? The answer decides
whether you build multi-org UX (a switcher) or just delete junk — and whether the "current
workspace" problem is real or evaporates.
**Mode:** READ-ONLY. Classify every org, recommend per-bucket treatment, STOP. Delete nothing.
**Target:** running Replit instance + live DB.
**Repo:** `Nardo758/JediRe.git` @ HEAD — record SHA.
**Evidence rule (S1-01):** each org's real/artifact status carries live DB rows (members, deals,
activity, timestamps). Name-based guesses are hypotheses to confirm.
**Report to:** `docs/audits/ORG_REALITY_CLASSIFICATION.md`

---

## TRACE

**1. The full org inventory.**
```sql
SELECT o.id, o.name, o.slug, o.created_at,
       (SELECT COUNT(*) FROM org_members m WHERE m.org_id = o.id) AS members,
       (SELECT COUNT(*) FROM deals d WHERE d.org_id = o.id) AS deals,
       (SELECT COUNT(*) FROM properties p WHERE p.org_id = o.id) AS properties
FROM organizations o
ORDER BY o.created_at;
```
Paste the full 38-row result. This is the whole picture in one table.

**2. Membership shape of the 34-org user.**
```sql
SELECT m.org_id, o.name, o.created_at, m.role, m.joined_at
FROM org_members m JOIN organizations o ON o.id = m.org_id
WHERE m.user_id = '<the 34-org user id>'
ORDER BY o.created_at;
```
Paste. Look for the artifact signatures:
   - **Creation clustering:** were the 34 orgs created in a tight time window (a loop/import) or
     spread over time (organic)? Tight cluster → artifact.
   - **Naming pattern:** generic/sequential/templated names (`Org 1`, `test-org-*`, deal-derived
     names) → artifact. Distinct firm-like names → possibly real.
   - **Emptiness:** how many of the 34 have zero deals AND zero properties AND only this one member?
     Empty orgs with a single member are almost certainly artifacts.

**3. Classify every org into a bucket:**
   | bucket | criteria |
   - **REAL** — has activity (deals/properties) AND/OR multiple members AND/OR a distinct name. A
     genuine tenant.
   - **ARTIFACT-EMPTY** — zero deals, zero properties, single member, generic name / clustered
     creation. Junk.
   - **ARTIFACT-TEST** — name/slug signals test (`test`, `f2a`, `audit`, dev fixtures).
   - **AMBIGUOUS** — has a little signal but unclear; flag for human eyes.
   Count per bucket.

**4. Where does real activity actually concentrate?**
```sql
SELECT o.id, o.name, COUNT(d.id) AS deals, COUNT(DISTINCT m.user_id) AS distinct_members
FROM organizations o
LEFT JOIN deals d ON d.org_id = o.id
LEFT JOIN org_members m ON m.org_id = o.id
GROUP BY o.id, o.name
HAVING COUNT(d.id) > 0 OR COUNT(DISTINCT m.user_id) > 1
ORDER BY deals DESC;
```
This surfaces the orgs that are doing real work. Likely a small number (the operator's primary org
`dd201183` held the 29 backfilled properties + 28 deals). Paste.

**5. The decisive question — how many REAL multi-org humans exist?**
After classifying, answer: once artifacts are excluded, does ANY human belong to more than one REAL
org? If NO → the multi-org problem is artificial; every real human maps to one real org; the
current-workspace switcher is unnecessary and deal-scoping is a one-line `org_id` filter. If YES →
state how many genuine multi-org users and how many real orgs each spans — THAT sizes the switcher
decision.

---

## DELIVERABLE

- SHA + READ-ONLY header
- The 38-org inventory table (members/deals/properties each)
- Per-bucket counts: REAL / ARTIFACT-EMPTY / ARTIFACT-TEST / AMBIGUOUS
- The 34-org user's membership shape + artifact-signature read (clustered? generic-named? empty?)
- **The decisive answer:** after excluding artifacts, does any real human belong to >1 real org?
  - NO → current-workspace problem evaporates; recommend org cleanup; deal-scoping is a simple
    filter. State which orgs are the cleanup set (do NOT delete — separate approved dispatch).
  - YES → N real multi-org humans; the switcher decision is real and sized to N.
- One-line: REAL org count, ARTIFACT count, and whether multi-org UX is needed or not

**STOP at the report. Org deletion is a separate human-approved cleanup dispatch (FK check first —
deals/properties/members reference orgs; deleting an org with refs cascades). This trace only tells
you what's real.**
