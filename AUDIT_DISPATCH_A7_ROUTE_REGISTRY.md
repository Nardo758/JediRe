# A7 Audit — Route Registry + Frontend Reachability

> **Audit domain:** Backend route completeness and frontend API coverage.
> **Status:** Dispatch written
> **Date:** 2026-06-25
> **Auditor:** Agent
> **Rule:** Read-only. Findings → fix backlog.

---

## Scope

**Backend:** All routes mounted in `index.replit.ts` and `routes/index.ts`. Check:
1. Is every imported router actually mounted?
2. Is every mounted router non-empty (has handlers)?
3. Are route paths correct (no double-slash, no missing prefix)?

**Frontend:** API client coverage. Check:
1. Does `frontend/src/api/client.ts` have typed methods for all backend routes?
2. Are there frontend components that call routes not in the API client?
3. Are there API client methods for routes that don't exist?

**Cross-check:** Dead routes (backend has, frontend never calls) and missing routes (frontend calls, backend doesn't have).

---

## Method

### Phase 1: Backend Route Inventory
1. Extract all `app.use('/path', ...)` from `index.replit.ts`
2. Extract all `app.use('/path', ...)` from `routes/index.ts` mount functions
3. For each router file, count actual route handlers
4. Flag: imported but not mounted, mounted but empty, path collisions

### Phase 2: Frontend API Client Inventory
1. Extract all methods from `frontend/src/api/client.ts`
2. Check for `fetch`, `axios.get`, `apiClient.get` calls in frontend components
3. Map each frontend call to a backend route

### Phase 3: Cross-Reference
1. For each frontend API call, does the backend route exist?
2. For each backend route, does the frontend ever call it?
3. Flag: dead routes, missing routes, path mismatches

---

## Known Issues (from prior audits)

| ID | Route | Status | Finding |
|----|-------|--------|---------|
| DC-25 | `investor-capital` | Unmounted | Route file exists but never mounted in index.replit.ts |
| DC-25 | `capsule-intelligence` | Unmounted | Route file exists but never mounted |
| DC-25 | `demand-intelligence` | Unmounted | Route file exists but never mounted |
| DC-25 | `reporting-package` | Unmounted | Route file exists but never mounted |
| DC-25 | `zoning-comparator` | Unmounted | Route file exists but never mounted |
| DC-25 | `audit` | Unmounted | Route file exists but never mounted |
| DC-26 | `/balance-sheets` | Ghost | UI references but route returns 404 |
| DC-26 | `/roadmap` | Ghost | UI references but route returns 404 |
| DC-26 | `/timeline` | Ghost | UI references but route returns 404 |

---

## Report Template

| Backend Route | Method | Mounted? | Has Handlers? | Frontend Calls? | API Client Method? | Finding |
|---------------|--------|----------|---------------|-----------------|-------------------|---------|
| ... | ... | ... | ... | ... | ... | ... |

---

*END OF A7 DISPATCH. Halting for triage.*
