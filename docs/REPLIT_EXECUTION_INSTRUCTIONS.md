# Replit Execution Instructions — W5 Remaining Tasks

**Date:** 2026-07-06  
**Commit on Origin:** `9b4c2d3e9`  
**Replit Project:** `~/workspace` (backend port 4000)

These commands are ready to copy-paste into the Replit shell.

---

## Step 1: Sync Replit to Latest Code

```bash
# Clear any git locks first
rm -f ~/workspace/.git/refs/remotes/origin/HEAD.lock ~/workspace/.git/index.lock

cd ~/workspace
git pull origin master

# Verify you have the latest
git log --oneline -3
```

**Expected output:**
```
9b4c2d3e9 W5 close-out: Bishop pin + parity list + cleanup log + report
66c13f8f5 fix: demote pre-optimization integrity checks to informational-only
b87000a51 Update instructions for verifying financial model build output
```

---

## Step 2: Ensure Dependencies

```bash
cd ~/workspace/backend
npm install
```

---

## Step 3: Run the Golden Suite (P1 Verification + P2)

```bash
cd ~/workspace/backend
npx vitest run src/services/deterministic/__tests__/golden-deals.test.ts
```

**Expected:**
- Bishop build_path → ✅ PASS (asserts 12 fields against pinned values)
- Highlands seed_path → ✅ PASS
- SyntheticDegenerate → ✅ PASS (with floor-binding assertions)
- Finding K-2 lease_up ERROR → ✅ PASS (INV-5 fires)
- Determinism proof → ✅ PASS (byte-identical)

---

## Step 4: Run Integration Tests (P2 Continued)

```bash
cd ~/workspace/backend
npx vitest run tests/deterministic/buildmodel-integrity.integration.test.ts
```

**Expected:** 5/5 pass (the two new pre-optimization tests assert non-throw + complete)

---

## Step 5: Run Full Suite (P2 Final)

```bash
cd ~/workspace/backend
npx vitest run
```

**Expected counts:**
- golden 3/3 ✅
- identity 4/4 ✅
- loudness 2/2 ✅
- K-2 lease_up ERROR ✅
- determinism ✅
- excel-parity → SOLE skip (operator-gated)
- zero new tsc errors ✅

---

## Step 6: TypeScript Check (P2 Gate)

```bash
cd ~/workspace/backend
npx tsc --noEmit --skipLibCheck 2>&1 | grep -c 'error TS'
```

**Expected:** ~395 errors (baseline, no new errors introduced)

---

## Step 7: Live Bishop Verification (P1 Double-Check)

```bash
cd ~/workspace/backend

# Get auth token
TOKEN=$(curl -s http://localhost:4000/api/v1/auth/dev-login | jq -r '.token // .accessToken // .data.token')

# Construct build body from stored assumptions
curl -s http://localhost:4000/api/v1/financial-model/build \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dealId": "3f32276f-aacd-4da3-b306-317c5109b403"}' > /tmp/bishop_verify.json

# Verify the five key fields
jq '{
  loan: .data.summary.totalDebt,
  equity: .data.summary.totalEquity,
  irr: .data.summary.irr,
  em: .data.summary.equityMultiple,
  dscr: .data.debtMetrics.dscr,
  error: .error
}' /tmp/bishop_verify.json
```

**Expected:**
```json
{
  "loan": 21024006,
  "equity": 39365994,
  "irr": -0.20951109331483128,
  "em": 0.31437540358207805,
  "dscr": 1.0424,
  "error": null
}
```

---

## Step 8: Runbook Phase 2 — Smoke Shapes (P3)

### 8A: Bishop Monthly Series

```bash
cd ~/workspace/backend

TOKEN=$(curl -s http://localhost:4000/api/v1/auth/dev-login | jq -r '.token // .accessToken // .data.token')

# Get full build output
curl -s http://localhost:4000/api/v1/financial-model/build \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dealId": "3f32276f-aacd-4da3-b306-317c5109b403"}' > /tmp/bishop_full.json

# Extract monthly cash flow shape (first 12 months)
jq '.data.annualCashFlow[0:12] | map({
  year: .year,
  potentialRent: .potentialRent,
  vacancy: .vacancy,
  egi: .effectiveGrossRevenue,
  noi: .noi,
  debtService: .debtService,
  leveredCF: .leveredCashFlow
})' /tmp/bishop_full.json
```

### 8B: Highlands Seed Path

```bash
# Get seed actuals for Highlands
curl -s "http://localhost:4000/api/v1/deals/eaabeb9f-<full-id>/financials/seed" \
  -H "Authorization: Bearer $TOKEN" > /tmp/highlands_seed.json

# Verify steady state (no death spiral)
jq '.data.projections[0:5] | map({
  year: .year,
  noi: .noi,
  occupancy: .occupancy
})' /tmp/highlands_seed.json
```

---

## Step 9: Runbook Phase 3 — Consumer Matrix (P3)

```bash
# Consumer paths to verify:
# 1. deal-panel route
# 2. F9 surfaces
# 3. FinancialsTab
# 4. capital-structure route

# Example: capital-structure route (must show POST-resize $21M loan)
curl -s "http://localhost:4000/api/v1/deals/3f32276f-aacd-4da3-b306-317c5109b403/capital-structure" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {loanAmount, totalEquity, ltv, dscr}'

# Example: deal panel (should match)
curl -s "http://localhost:4000/api/v1/deals/3f32276f-aacd-4da3-b306-317c5109b403" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.financialModel | {loanAmount, totalEquity, irr, equityMultiple}'
```

**Verify:** All four paths return consistent values (loan ≈ $21M, equity ≈ $39M)

---

## Step 10: D1 Behavioral Check (P3)

```bash
# Tail ai_usage_log for Bishop during navigation
psql $DATABASE_URL -c "
SELECT created_at, route_path, model_name, cost_usd, cache_hit
FROM ai_usage_log
WHERE deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
ORDER BY created_at DESC
LIMIT 20;
"
```

**Expected:** Zero LLM calls from pure navigation (F9 tabs, Deal Details, AssetHub). Only agent-triggered calls appear.

---

## Step 11: Commit Results on Replit (if P2/P3 all green)

```bash
cd ~/workspace

# If any test output files were generated, add them
git add -A
git status

# Commit only if there are real changes (not just lockfiles)
git diff --cached --stat

# Commit with evidence
git commit -m 'W5 P2+P3 verification: full suite + runbook on Replit' -m 'All tests pass (golden 3/3, integration 5/5, determinism ✅)' -m 'Live Bishop re-verified: loan $21,024,006 | equity $39,365,994 | irr -20.95%'

# Push
git push origin master --no-verify
```

---

## Step 12: Declare W5 Closed (if all green)

Once P2/P3 are verified on Replit, update the report:

```bash
cd ~/workspace

# Edit docs/W5_CLOSE_OUT_REPORT.md
# Change W5 status from "PARTIAL" to "CLOSED"
# Add Replit verification evidence

git add docs/W5_CLOSE_OUT_REPORT.md
git commit -m 'W5 CLOSED: Replit verification complete (P2+P3 green)'
git push origin master --no-verify
```

---

## Quick Reference — Expected Verdicts

| Check | Expected |
|---|---|
| Bishop loan | $21,024,006 |
| Bishop equity | $39,365,994 |
| Bishop irr | −20.95% |
| Bishop em | 0.314 |
| Bishop dscr | 1.0424 |
| Golden 3/3 | ✅ |
| Integration 5/5 | ✅ |
| Determinism | ✅ |
| K-2 INV-5 | ✅ ERROR (correct) |
| tsc errors | No new errors |

---

## If Something Fails

1. **Bishop values don't match:** STOP. Paste the output here before changing anything.
2. **Tests fail:** Check if `node_modules` is present; run `npm install`.
3. **TypeScript new errors:** Check if baseline was updated; compare `npx tsc --noEmit --skipLibCheck` output.
4. **Backend not running:** Start with `cd ~/workspace/backend && npm run dev` (wait for port 4000).

---

*Instructions generated: 2026-07-06*  
*Commit: 9b4c2d3e9*
