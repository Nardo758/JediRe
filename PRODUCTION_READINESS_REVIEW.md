# JediRe Production Readiness Review

**Date:** 2026-02-16
**Scope:** Full-stack audit of backend, frontend, Python agents, infrastructure, and CI/CD

---

## Executive Summary

JediRe is an ambitious AI-powered real estate investment platform with a React/TypeScript frontend, Node.js/Express backend, Python AI agents, Kafka event streaming, and PostgreSQL + PostGIS. The codebase has significant functionality built out across 60+ REST routes, real-time WebSocket collaboration, and multiple analytical engines.

**However, the application has several critical security vulnerabilities and infrastructure gaps that must be resolved before production deployment.** The issues below are ordered by severity.

---

## CRITICAL — Must Fix Before Any Production Deployment

### 1. Shell Command Injection via User Input

**Files:**
- `backend/src/api/rest/analysis.routes.ts:49,112,200`
- `backend/src/services/pythonPipeline.ts:52,78,115`

User-supplied JSON from `req.body` is interpolated directly into shell command strings via `exec()`:

```typescript
const cmd = `cd ${ENGINES_DIR} && echo '${input}' | ${PYTHON_CMD} demand_signal_wrapper.py`;
```

An attacker can escape the single quotes and execute arbitrary OS commands. These routes have **no authentication**, making this exploitable by any HTTP request.

**Fix:** Replace `exec()` with `spawn()` using argument arrays. Pass data to Python via stdin piping, not shell interpolation.

---

### 2. Hardcoded Demo Credentials in Production Code Path

**File:** `backend/src/index.ts:214`

```typescript
if (email === 'demo@jedire.com' && password === 'demo123') {
```

This credential bypass is in the same code path used when `NODE_ENV=production`. The password `demo123` is also printed to stdout by `run.sh`. Any attacker who knows these credentials gets full authenticated access.

**Fix:** Gate behind `NODE_ENV !== 'production'` or remove entirely. Never log credentials to stdout.

---

### 3. Weak/Default JWT Secrets

**Files:**
- `backend/src/auth/jwt.ts:9-12`
- `backend/.env.replit:12` (committed to git)

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
```

The `.env.replit` file sets `JWT_SECRET=change-this-to-a-random-secret-key`. Anyone with repo access can forge tokens for any user.

**Fix:** Remove fallback defaults. Fail at startup if `JWT_SECRET` is unset. Generate a cryptographically random secret (min 256 bits) for production.

---

### 4. XSS — Unsanitized HTML Email Rendering

**File:** `frontend/src/components/outlook/EmailViewer.tsx:218`

```tsx
dangerouslySetInnerHTML={{ __html: email.body.content }}
```

Email HTML from Microsoft Graph is rendered directly into the DOM with no sanitization. A malicious email sender can execute arbitrary JavaScript in the user's session.

**Fix:** Apply `DOMPurify.sanitize()` before rendering.

---

### 5. No CI/CD Pipeline

No `.github/workflows/` directory exists. The `CICD_PIPELINE.md` document describes a pipeline but no actual workflow files are configured. No automated tests run on commit or deploy.

**Fix:** Create GitHub Actions (or equivalent) workflows for: lint, type-check, test, build, and deploy.

---

## HIGH — Must Fix Before Beta/Staging

### 6. Committed `.env.replit` Files with Secrets

**Files:**
- `backend/.env.replit`
- `frontend/.env.replit`
- `jedire/backend/.env.replit`
- `jedire/frontend/.env.replit`

These contain JWT secrets, CORS settings, and database configuration. They are tracked in git.

**Fix:** `git rm --cached` these files. Add `*.env.replit` to `.gitignore`. Use `.env.example` files instead.

---

### 7. Rate Limiter Exists But Is Never Applied

**File:** `backend/src/middleware/rateLimiter.ts` is implemented but never mounted in `backend/src/index.ts`. The login endpoint, analysis routes, and all API routes have zero rate limiting.

**Fix:** Apply rate limiting globally or at minimum on auth, analysis, and LLM endpoints. Use Redis-backed store for multi-process deployments.

---

### 8. Python `venv/` Directory Committed to Git

**Path:** `agents/supply/venv/` — the entire virtual environment (hundreds of files) is tracked in git.

**Fix:** `git rm -r --cached agents/supply/venv/`. Add `venv/` to `.gitignore`.

---

### 9. Missing Backend `package-lock.json`

`backend/.gitignore` explicitly ignores `package-lock.json` (line 3). This is incorrect — lockfiles should always be committed for reproducible builds. Without it, `npm install` can pull different dependency versions on each run, enabling supply-chain attacks.

**Fix:** Remove `package-lock.json` from `backend/.gitignore`. Run `npm install` and commit the lockfile.

---

### 10. Hardcoded Developer Machine Paths

**Files:**
- `backend/src/api/rest/analysis.routes.ts:19-20`
- `backend/src/services/pythonPipeline.ts:15-16`

```typescript
const PYTHON_CMD = process.env.PYTHON_PATH || '/home/leon/clawd/jedi-re/venv/bin/python3';
const ENGINES_DIR = '/home/leon/clawd/jedire/backend/python-services/engines';
```

These will always fail in any environment other than the original developer's machine.

**Fix:** Use environment variables with no default, or compute paths relative to `__dirname`.

---

### 11. Wildcard CORS in Production

**Files:**
- `backend/.env.replit:21` — `CORS_ORIGIN=*`
- `backend/src/index.ts:24` — Socket.IO uses `CORS_ORIGIN || '*'`

Wildcard CORS allows any website to make credentialed requests to the API and WebSocket server.

**Fix:** Set `CORS_ORIGIN` to the specific production frontend domain(s).

---

### 12. Content Security Policy Disabled

**File:** `backend/src/index.ts:38-41`

```typescript
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
```

CSP is a primary defense against XSS. With CSP disabled and the XSS vulnerability in issue #4, exploitation is trivial.

**Fix:** Enable CSP with a policy that allows only known origins for scripts, styles, and connections.

---

### 13. Duplicate Database Connection Pools

**Files:**
- `backend/src/index.ts:32` — creates a `new Pool()`
- `backend/src/database/connection.ts` — creates another singleton pool
- `backend/src/config/database.config.ts` — creates a third pool

Three separate connection pools exist simultaneously, consuming 3x the database connections. Route handlers use the pool from `index.ts`, while auth middleware uses the singleton from `connection.ts`.

**Fix:** Consolidate to a single pool exported from `database/connection.ts`. Import it everywhere.

---

### 14. Minimal Test Coverage

Only 2 test files exist in the entire backend (`asset-map-intelligence.test.ts`, `email-extraction.test.ts`). They test only utility functions. No `"test"` script exists in `backend/package.json`. Critical paths with zero coverage: authentication, deals CRUD, JWT verification, database operations, all 60+ REST routes.

**Fix:** Add a test runner (Vitest or Jest). Write tests for auth flows, deal CRUD, and critical services at minimum.

---

### 15. No `unhandledRejection` / `uncaughtException` Handlers

**File:** `backend/src/index.ts`

There are no `process.on('unhandledRejection')` or `process.on('uncaughtException')` handlers. An unhandled promise rejection in any route can silently crash the process.

**Fix:** Add global handlers that log the error and initiate graceful shutdown.

---

### 16. Missing Input Validation on Most Routes

**File:** `backend/src/index.ts` — routes at lines 91, 147, 867, 1291, 1369

Most routes in `index.ts` accept user input without Joi validation. The dedicated auth routes correctly use `validate(schema, req.body)`, but this pattern is not consistently applied. Examples:
- `GET /api/v1/supply/:market` — no validation on `market` parameter
- `POST /api/v1/tasks` — `priority`, `status`, `dueDate` accepted without enum/type checks
- `POST /api/v1/zoning/lookup` — `lat`/`lng` not validated as legal coordinates

**Fix:** Apply Joi validation schemas to all route handlers consistently.

---

## MEDIUM — Should Fix Before Production

### 17. Error Messages Leak Internal Details

**File:** `backend/src/index.ts:113,139,175,200,1773`

Internal error messages (including PostgreSQL errors with table/column names) are returned directly to clients:

```typescript
res.status(500).json({ error: err.message || 'Internal server error' });
```

**Fix:** Return generic error messages to clients. Log full details server-side only.

---

### 18. Admin Endpoint Missing Authorization Check

**File:** `backend/src/api/rest/jedi.routes.ts:400-402`

```typescript
// TODO: Add admin check
router.post('/recalculate-all', authMiddleware.requireAuth, ...)
```

Any authenticated user can trigger a bulk recalculation of all JEDI scores.

**Fix:** Add admin role check middleware.

---

### 19. Modules Controller Falls Back to `'demo-user'`

**File:** `backend/src/modules/modules/modules.controller.ts:15,29,44,62`

```typescript
const userId = req.user?.id || 'demo-user';
```

If auth middleware is missing or fails, all operations execute as `'demo-user'`.

**Fix:** Require authentication. Return 401 if `req.user` is missing.

---

### 20. OAuth State Parameter Not Validated

**File:** `backend/src/index.ts:1728,1734`

The OAuth state parameter is set to `Date.now()` (predictable) and never validated in the callback. This enables CSRF attacks on the OAuth flow.

**Fix:** Generate state with `crypto.randomBytes(32).toString('hex')`, store in session, validate on callback.

---

### 21. Silent Error Swallowing

**File:** `backend/src/index.ts:1417`

```typescript
} catch (e) {}
```

Empty catch block in GeoJSON parsing silently discards errors.

**File:** `backend/src/index.ts:637-639`

Returns `{ success: true, data: [] }` on database errors — client cannot distinguish failure from empty results.

**Fix:** Log errors. Return appropriate error responses.

---

### 22. Memory Leak Risks

| File | Issue |
|------|-------|
| `backend/src/agents/orchestrator.ts:82` | `setInterval` never stored/cleared; no shutdown hook |
| `backend/src/tasks/notificationTasks.ts:187,199` | Nested `setInterval` inside `setTimeout`; never clearable |
| `backend/src/index.ts:1625` | `activeUsers` Map grows unbounded on abnormal disconnects |
| `backend/src/api/rest/documentsFiles.routes.ts:255` | File stream piped without error handler |

**Fix:** Store interval references. Clear them on shutdown. Add error handlers to streams.

---

### 23. Incomplete Graceful Shutdown

**File:** `backend/src/index.ts:1803-1819`

- `SIGTERM` handled but `SIGINT` is not — Ctrl+C won't cleanly shut down
- `httpServer.close()` doesn't await in-flight requests
- Multiple Kafka services register their own `SIGTERM`/`SIGINT` handlers (potential race conditions)

**Fix:** Handle both signals. Drain in-flight requests before closing. Centralize signal handling.

---

### 24. Mixed Logging (console.log vs Winston)

**File:** `backend/src/index.ts` — 50+ `console.log` calls, including PII (user email on line 211)

A Winston logger exists at `backend/src/utils/logger.ts` but the main server file bypasses it entirely. The Kafka consumer manager (`kafka-consumer-manager.service.ts:22-27`) also creates its own inline logger.

**Fix:** Replace all `console.log/error` with the shared Winston logger. Never log PII (email addresses) in request logs.

---

## LOW — Nice to Have

### 25. 62 TODO/FIXME Comments Indicating Incomplete Features

Notable incomplete items:
- Virus scanning is a stub (`fileValidation.ts:158`, `fileUpload.service.ts:170`)
- Stripe payment integration returns success without charging (`modules.controller.ts:36`)
- Microsoft OAuth tokens never stored (`index.ts:1761`)
- Multiple routes serve hardcoded mock data in production (`mapAnnotations.routes`, `task-completion.routes`, `trade-areas.routes`)

### 26. 508 Uses of `: any` Across 106 Backend Files

TypeScript strict mode is disabled. The codebase has heavy use of `any` types, particularly in the main `index.ts` file. This reduces the value of TypeScript's type checking.

### 27. `run.sh` Overwrites Source Files

`run.sh` copies `index.replit.ts` over `index.ts` (`cp src/index.replit.ts src/index.ts`), meaning the committed `index.ts` diverges from what runs in production.

### 28. Sub-Projects Committed in Main Repo

`Apartment-Locator-AI-Real/`, `Traveloure-Platform/`, `polymarket-trader/`, `rocketman-dashboard/` are separate projects checked into the main repo. Consider splitting them into separate repositories.

---

## Recommended Remediation Order

| Phase | Items | Goal |
|-------|-------|------|
| **Immediate** | #1, #2, #3, #4 | Eliminate critical security vulnerabilities |
| **This week** | #6, #7, #8, #9, #10, #11, #12, #15 | Secure configuration and infrastructure |
| **Before beta** | #5, #13, #14, #16 | CI/CD, testing, and architectural cleanup |
| **Before production** | #17–#24 | Operational hardening |
| **Ongoing** | #25–#28 | Code quality improvements |
