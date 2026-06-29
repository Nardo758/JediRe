# REPO RECONCILIATION REPORT — Forensic Ground Truth

> **Dispatch:** REPO_RECONCILIATION_DISPATCH  
> **Date:** 2026-07-16  
> **Mode:** READ-ONLY — forensic determination, zero changes  
> **Current branch:** `master`  
> **HEAD:** `270645e659249194db0ed0db665da99b24f96d7f`

---

## R1 — Commit 270645e65: Does it exist, and what's in it?

**Verdict:** `COMMIT-EXISTS-ON-MASTER` — but it is **only the close report**, not the code.

| Check | Result |
|-------|--------|
| `git cat-file -t 270645e65` | `commit` ✅ |
| `git log --all --oneline \| grep 270645e6` | `270645e65 Phase 1 close report: C1-C4 verification` ✅ |
| `git branch -a --contains 270645e65` | `* master`, `remotes/origin/HEAD -> origin/master`, `remotes/origin/master` ✅ |
| `git show --stat 270645e65` | Only `PHASE1_CLOSE_REPORT.md` (159 lines added). **Zero code files.** |

**The three code files are NOT in commit 270645e65.** They are in **two separate commits** on the same branch:

| Commit | Message | Files touched |
|--------|---------|--------------|
| `a05ddbd43` | Phase 1: Modal shell + button triggers (Step 1) | `PeriodicTimelineModal.tsx` (159 lines), `PeriodicTimelineTrigger.tsx` (62 lines), `AssetHubPage.tsx`, `ProFormaWithTrafficSection.tsx`, `FinancialsTab.tsx`, `ProFormaSummaryTab.tsx` |
| `b2d6064ce` | Phase 1: CHART view (Step 3) | `PeriodicChart.tsx` (407 lines), `PeriodicTimelineModal.tsx` (15-line delta) |

Both commits are **ancestors of 270645e65** — they were committed on 2026-06-28 at 23:53 and 23:56, and the close report was added on top at 2026-06-29 08:28.

**Files in working tree (verified):**
```
frontend/src/components/periodic/PeriodicChart.tsx          13,836 bytes  Jun 28 23:55
frontend/src/components/periodic/PeriodicTimelineModal.tsx   4,463 bytes  Jun 28 23:56
frontend/src/components/periodic/PeriodicTimelineTrigger.tsx 1,693 bytes  Jun 28 23:47
```

The files **are physically present** in the working tree. The "Replit searched all .tsx/.ts and found zero of them" claim from the dispatch was **incorrect** — the files exist and were committed on `master` before the close report.

---

## R2 — Branch State: Where is the work?

| Check | Result |
|-------|--------|
| `git status` | On branch `master`, up to date with `origin/master` |
| `git rev-parse --abbrev-ref HEAD` | `master` |
| `git rev-parse HEAD` | `270645e659249194db0ed0db665da99b24f96d7f` |
| `git ls-remote origin` | `HEAD` → `270645e65...`, `refs/heads/master` → `270645e65...` |
| `git branch -a` | 46 remote branches; `master` is the only local branch |

**Split determination:** **No split.** The Phase 1 code commits (`a05ddbd43`, `b2d6064ce`) and the close report (`270645e65`) are all on the **same branch** (`master` → `origin/master`). There is no unmerged branch, no fork, no local-only state. The work was committed to `master` and pushed to the remote.

The discrepancy is not a branch/environment split — it is a **search failure** (the Replit tool that searched for the files did not find them despite their presence in the working tree and git history).

---

## R3 — Inline Grid Verification

| Mount | File:Line | Component | Preset | Status |
|-------|-----------|-----------|--------|--------|
| AssetHubPage | `frontend/src/pages/AssetHubPage.tsx:1880` | `PeriodicTimelineTrigger` | `monitoring` | ✅ Converted to trigger/modal |
| DealDetailPage | `frontend/src/pages/DealDetailPage.tsx:146` | `PeriodicGrid` (inline) | `overview` | ❌ Still inline — NOT converted |
| FinancialsTab | `frontend/src/components/terminal/tabs/FinancialsTab.tsx:476` | `PeriodicTimelineTrigger` | `monitoring` | ✅ Converted to trigger/modal |
| ProFormaSummaryTab | `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx:1226` | `PeriodicTimelineTrigger` | `full` | ✅ Converted to trigger/modal |

**Mount count:** 3 of 4 mounts use the new `PeriodicTimelineTrigger` + `PeriodicTimelineModal`. Only `DealDetailPage.tsx:146` still uses the inline `PeriodicGrid`. The dispatch's claim that "the grid is still inline in two places" is **one mount off** — only one place remains inline.

**Screenshot verification:** Not executed — no runtime environment available for this session. The code-level evidence above confirms the mount states.

---

## R4 — Spot-Check: Is other "done" work actually in the repo?

| Item | Status | Evidence | Assessment |
|------|--------|----------|------------|
| **EGI / tax key fix** (`periodic-field.types.ts`) | ✅ **PRESENT** | Lines 144–145: `egi: 'effectiveGrossIncome'` (canonical alias). Lines 158–159: `property_tax: 'propertyTax'`, `real_estate_tax: 'propertyTax'` (canonical alias). | Isolated — present and correct. |
| **÷12 fallback** (`SUM_ROLLUP_DOLLAR_FIELDS` + `year1_accrual`) | ✅ **PRESENT** | `backend/src/services/proforma/periodic-field.types.ts:195-209`: `SUM_ROLLUP_DOLLAR_FIELDS` includes `'egi'`. `backend/src/services/proforma/periodic-seeder.service.ts:325-345`: `year1_accrual` resolution logic with `SUM_ROLLUP_DOLLAR_FIELDS.has(fieldName)` → `resolved = year1Annual / 12`. | Isolated — present and correct. |
| **Password-reset routes** (`/api/v1/auth/password-reset/*`) | ✅ **PRESENT** | `backend/src/api/rest/inline-auth.routes.ts:235-351`: `POST /password-reset/request` and `POST /password-reset/confirm` both implemented. `backend/src/index.replit.ts:222`: `app.use('/api/v1/auth', authLimiter, authRouter)` — router is mounted. | Isolated — present and mounted. |

**Systemic assessment:** The "phantom commit" problem is **isolated to the close report commit (270645e65)**. The commit SHA referenced in the dispatch was for the **report file only**, not the code. The actual code commits (`a05ddbd43`, `b2d6064ce`) are on the same branch and the files are in the working tree. All other spot-checked "done" work (EGI fix, ÷12 fallback, password-reset) is **present and correct**. There is no evidence of a broader pattern of missing commits.

**Root cause:** A **misattribution of commit SHA** — the build agent reported "pushed to GitHub (master → 270645e65)" but 270645e65 only contains the markdown report, not the code. The code was committed in earlier commits on the same branch. This is a reporting/communication gap, not a branch split or missing push.

---

## SUMMARY TABLE

| Item | Finding |
|------|---------|
| **R1** | `COMMIT-EXISTS-ON-MASTER` — 270645e65 is HEAD on master and origin/master. File list: only `PHASE1_CLOSE_REPORT.md`. The three code files are in **ancestor commits** `a05ddbd43` and `b2d6064ce` on the same branch. |
| **R2** | No branch split. `master` is active, matches `origin/master`. All Phase 1 work is on `master` — no unmerged branch, no fork, no local-only state. |
| **R3** | 3 of 4 mounts converted to `PeriodicTimelineTrigger` (AssetHubPage, FinancialsTab, ProFormaSummaryTab). Only `DealDetailPage.tsx:146` remains inline `PeriodicGrid`. The dispatch claim of "two inline places" is off by one. |
| **R4** | EGI fix: **PRESENT**. ÷12 fallback: **PRESENT**. Password-reset routes: **PRESENT** and mounted. Phantom-commit problem is **isolated** — the commit SHA referenced was the report, not the code. |

---

## RECOMMENDATION

1. **No recovery needed.** The code is in the repo and on the right branch. The only issue is that `DealDetailPage.tsx:146` still uses the inline `PeriodicGrid` instead of `PeriodicTimelineTrigger` — this is the one remaining conversion from the Phase 1 plan.
2. **Update the close report** (or add a note) clarifying that `270645e65` is the report commit and the code commits are `a05ddbd43` (modal+trigger) and `b2d6064ce` (chart).
3. **Convert `DealDetailPage.tsx:146`** from inline `PeriodicGrid` to `PeriodicTimelineTrigger` to complete the Phase 1 migration.

---

*END OF REPORT — STOP. No changes made.*
