# A4: Public Ingress Security Audit

**Date:** 2026-06-24  
**Auditor:** Orchestrator (multi-agent deep research)  
**Scope:** Public-facing routes, auth bypasses, rate limiting, CORS, input validation, file upload security  
**Status:** 🔴 LAUNCH GATE — 6 findings require resolution before commercial launch  

---

## 1. Executive Summary

The public ingress surface has **critical security gaps** before launch. The most severe: **no rate limiting on login/register endpoints**, enabling brute-force attacks. Advanced rate limiters are defined but never mounted. Multiple public routes lack proper auth validation. Security headers are partially disabled.

### Launch Gate Verdict

| Finding | Severity | Launch Blocker? |
|---------|----------|-----------------|
| A4-F1: No auth rate limiter mounted | **CRITICAL** | ✅ YES |
| A4-F2: In-memory rate limit store | **HIGH** | ✅ YES |
| A4-F3: CSP and COEP disabled | **HIGH** | ✅ YES |
| A4-F4: Public routes without validation | **MEDIUM** | ⚠️ Partial |
| A4-F5: Socket.IO anonymous fallback | **MEDIUM** | ⚠️ Partial |
| A4-F6: Admin routes without auth mount | **HIGH** | ✅ YES |

---

## 2. Findings

### A4-F1: No Auth Rate Limiter Mounted — CRITICAL

**Evidence:**

```typescript
// backend/src/middleware/rateLimit.ts:170-175
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true,
});
```

The `authLimiter` is exported but **never mounted** on `/api/v1/auth/*` in `index.replit.ts`:

```typescript
// backend/src/index.replit.ts:141-142
app.use('/api/v1/auth', authRouter); // NO authLimiter here
```

**Impact:** Login and registration endpoints have no brute-force protection. An attacker can attempt unlimited password guesses.

**Additionally:** The `strictLimiter` (10 req/min), `uploadLimiter` (10/hr), `searchLimiter` (30/min), `emailLimiter` (10/hr), and `userLimiter` (500/15min) are all defined but **never mounted** on any route.

---

### A4-F2: In-Memory Rate Limit Store — HIGH

**Evidence:**

```typescript
// backend/src/middleware/rateLimit.ts:20
const store: RateLimitStore = {};
```

The rate limit store is a plain JavaScript object. In a multi-instance deployment (e.g., Kubernetes, Heroku, multiple Replit deployments), each instance has its own store. A user can make 100 requests per instance × N instances.

**Impact:** Rate limits are effectively bypassed in any multi-instance or multi-process deployment.

**Also:** The legacy `rateLimiter` (`backend/src/middleware/rateLimiter.ts`) has a localhost bypass:

```typescript
const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
if (LOCALHOST_IPS.has(ip)) { next(); return; }
```

If the app sits behind a reverse proxy that doesn't properly set `X-Forwarded-For`, an attacker could spoof the client IP as 127.0.0.1.

---

### A4-F3: CSP and COEP Disabled in Helmet — HIGH

**Evidence:**

```typescript
// backend/src/index.replit.ts:96-99
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
```

`contentSecurityPolicy` and `crossOriginEmbedderPolicy` are explicitly disabled. CSP is the primary defense against XSS attacks. COEP prevents cross-origin embedded resources from leaking data via side-channel attacks.

**Impact:** The backend is vulnerable to XSS if any route renders HTML or allows inline scripts. COEP being disabled allows cross-origin resource embedding that can be exploited for timing attacks.

---

### A4-F4: Public Routes Without Input Validation — MEDIUM

**Evidence:** Multiple public routes accept raw query parameters without validation:

```typescript
// backend/src/index.replit.ts:194-196
app.use('/api/v1/ticker', tickerRoutes); // NO auth, NO validation
app.use('/api/v1/time-series', timeSeriesRoutes); // NO auth, NO validation
app.use('/api/v1/data-macro', dataMacroRoutes); // NO auth, NO validation
```

These routes accept user-controlled query parameters (e.g., `?city=Atlanta`, `?limit=30`) and pass them directly to SQL queries. While parameterized queries prevent SQL injection, unvalidated inputs can cause:
- DoS via `?limit=9999999` (large result sets)
- Information disclosure via invalid parameters
- Cache poisoning

**Also:** The `dataRouter` (`/api/v1`) is mounted without auth at the app level, but contains some routes that may need auth:

```typescript
// backend/src/index.replit.ts:156
app.use('/api/v1', dataRouter); // NO requireAuth here
```

The `dataRouter` itself has some unauthenticated routes (`/supply/:market`, `/markets`, `/properties`) that may expose sensitive data.

---

### A4-F5: Socket.IO Anonymous Fallback — MEDIUM

**Evidence:**

```typescript
// backend/src/index.replit.ts:694-710
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const payload = verifyAccessToken(token);
    if (payload) {
      (socket as any).userId = payload.userId;
      (socket as any).email = payload.email;
      return next();
    }
  } catch {}
  (socket as any).userId = socket.id; // ANONYMOUS fallback
  (socket as any).email = 'anonymous';
  next();
});
```

If no token is provided, the socket connection is allowed as "anonymous" with a random socket ID as the user ID. This means any unauthenticated user can:
- Join deal rooms (`deal:join`)
- Broadcast cursor movements (`cursor:move`)
- Emit deal field changes (`deal:field_change`)
- Emit comments (`deal:comment_added`)
- Receive presence data for any deal room

**Impact:** Unauthenticated users can eavesdrop on deal collaboration data and potentially emit events that appear to come from real users.

---

### A4-F6: Admin Routes Without Auth Mount — HIGH

**Evidence:**

```typescript
// backend/src/routes/index.ts:24-31
export function mountAdminRoutes(app: Express) {
  app.use('/api/v1/admin/data-tracker', dataTrackerRoutes);
  app.use('/api/v1/admin/data-coverage', adminDataCoverageRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/admin', dotAdminRouter);
  app.use('/api/v1/admin/atlanta-url-discovery', atlantaUrlDiscoveryRouter);
  app.use('/api/v1/admin', enrichmentAdminRouter);
  app.use('/api/v1/admin-api', adminApiKeyRouter);
}
```

None of the admin routes have `requireAuth` at the mount level. They may have internal auth checks, but the mount point is unprotected.

**Impact:** If any admin route has a missing internal auth check, it's exposed to the public.

---

### A4-F7: Rate Limiter Mounted After express.json() — MEDIUM

**Evidence:**

```typescript
// backend/src/index.replit.ts:129-139
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter); // Mounted AFTER body parsers
```

Large JSON payloads are fully parsed before the rate limiter runs. An attacker can send massive JSON payloads to exhaust memory before being rate limited.

---

### A4-F8: CORS Wildcard Subdomain Patterns — LOW

**Evidence:**

```typescript
// backend/src/index.replit.ts:69
const allowedOriginPatterns = [/\.replit\.dev(:\d+)?$/, /\.replit\.app(:\d+)?$/, /\.repl\.co(:\d+)?$/];
```

Any subdomain of `replit.dev`, `replit.app`, or `repl.co` is allowed. Combined with `credentials: true`, this means any malicious Replit project can make authenticated cross-origin requests to the JediRe backend.

**Impact:** In a shared hosting environment (Replit), another user's project can steal credentials if the user is already logged in.

---

## 3. Route Classification

### Public Routes (No Auth Required)

| Route | File | Risk |
|-------|------|------|
| `GET /health` | `inline-health.routes.ts` | Low — health check only |
| `POST /api/stripe/webhook` | `webhookHandlers.ts` | Low — Stripe signature verified |
| `POST /api/v1/auth/*` | `inline-auth.routes.ts` | **CRITICAL** — no rate limiter |
| `GET /api/v1/ticker/*` | `ticker.routes.ts` | Low — public FRED data |
| `GET /api/v1/time-series/*` | `time-series.routes.ts` | Low — public data |
| `GET /api/v1/data-macro/*` | `data-macro.routes.ts` | Low — public macro data |
| `GET /api/v1/driver-analysis/*` | `driver-analysis.routes.ts` | Medium — may expose sensitive data |
| `GET /api/v1/derived-metrics/*` | `derived-metrics.routes.ts` | Medium — may expose sensitive data |
| `GET /api/v1/columns/*` | `column-catalog.routes.ts` | Medium — column metadata |
| `GET /api/v1/column-catalog` | `column-catalog.routes.ts` | Medium — column metadata |
| `GET /api/v1/grid-data` | `column-catalog.routes.ts` | Medium — grid data |
| `GET /api/v1/column-insights` | `column-catalog.routes.ts` | Medium — insights |
| `GET /api/v1/shares/:shortcode` | `capsule-sharing.routes.ts` | Low — designed to be public |
| `GET /api/v1/deals/:dealId/deal-book` | `capsule-sharing.routes.ts` | Low — rate limited (30/hr) |
| `GET /api/v1/capsule-links/:token/deal-book` | `capsule-sharing.routes.ts` | Low — rate limited |
| `GET /capsule-link/:token` | `index.replit.ts` | Low — redirect only |
| `POST /api/v1/clawdbot/*` | `clawdbot-webhooks.routes.ts` | Medium — webhook, verify auth? |
| `GET /api/v1/kg/semantic-search` | `kg-aliases.routes.ts` | Medium — public KG search |
| `GET /api/v1/supply/:market` | `inline-data.routes.ts` | Medium — supply data |
| `GET /api/v1/markets` | `inline-data.routes.ts` | Medium — market list |
| `GET /api/v1/properties` | `inline-data.routes.ts` | Medium — property list |

### Authenticated Routes (requireAuth)

| Route | File | Notes |
|-------|------|-------|
| `GET /api/v1/*` | Various | Most routes protected via `requireAuth` |
| `/api/v1/deals/*` | `dealsRouter` | Core deal routes |
| `/api/v1/admin/*` | `adminRouter` | Admin routes (but mount lacks auth) |
| `/api/v1/chat` | `chatRouter` | Protected + aiLimiter |
| `/api/v1/agents/*` | `agentRouter` | Agent routes |

### Routes with Inconsistent Auth

| Route | Auth Status | Issue |
|-------|-------------|-------|
| `/api/v1/billing/*` | Unclear | Not explicitly mounted with auth |
| `/api/v1/f40/*` | Unclear | Not explicitly mounted with auth |
| `/api/v1/opportunities/*` | Unclear | Not explicitly mounted with auth |
| `/api/v1/microsoft/*` | Unclear | OAuth routes may need auth |
| `/api/v1/oppgrid/*` | Unclear | Not explicitly mounted with auth |
| `/api/v1/clawdbot/*` | Unclear | Webhook routes |
| `/api/v1/deals/:dealId/costar` | `createCoStarUploadRoutes` | No auth at mount |

---

## 4. Recommended Fixes

### Fix A4-F1: Mount Auth Rate Limiter

```typescript
// backend/src/index.replit.ts:141
import { authLimiter } from './middleware/rateLimit';
app.use('/api/v1/auth', authLimiter, authRouter);
```

Also mount the other limiters:
```typescript
app.use('/api/v1/uploads', uploadLimiter, uploadRoutes);
app.use('/api/v1/search', searchLimiter, searchRoutes);
app.use('/api/v1/admin', strictLimiter, adminRoutes);
app.use('/api/v1/email', emailLimiter, emailRoutes);
```

### Fix A4-F2: Redis-Backed Rate Limiting

Replace the in-memory store with Redis for distributed rate limiting:

```typescript
// Use a Redis-backed store or external rate limiter service
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Store rate limit data in Redis with TTL
async function checkRateLimit(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) await redis.pexpire(key, windowMs);
  return count <= maxRequests;
}
```

### Fix A4-F3: Re-enable Security Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // if needed for inline styles
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### Fix A4-F4: Add Input Validation to Public Routes

Add query parameter validation to all public routes:

```typescript
// For ticker, time-series, data-macro, etc.
import { z } from 'zod';

const publicQuerySchema = z.object({
  city: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(1000).optional().default(30),
});

app.use('/api/v1/ticker', validateQuery(publicQuerySchema), tickerRoutes);
```

### Fix A4-F5: Require Socket Auth

```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  const payload = verifyAccessToken(token);
  if (!payload) {
    return next(new Error('Invalid token'));
  }
  (socket as any).userId = payload.userId;
  (socket as any).email = payload.email;
  next();
});
```

### Fix A4-F6: Mount Auth on Admin Routes

```typescript
export function mountAdminRoutes(app: Express) {
  app.use('/api/v1/admin', requireAuth, requireRole('admin'), adminRouter);
  app.use('/api/v1/admin-api', requireAuth, requireRole('admin'), adminApiKeyRouter);
  // ... etc
}
```

### Fix A4-F7: Mount Rate Limiter Before Body Parsers

```typescript
app.use(rateLimiter); // Move BEFORE express.json()
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

### Fix A4-F8: Narrow CORS Origins

```typescript
const allowedOriginPatterns = [
  /^(https?:\/\/\w+\.replit\.dev(:\d+)?)$/,
  /^(https?:\/\/\w+\.replit\.app(:\d+)?)$/,
];
// Or better: use exact allowedOrigins only
```

---

## 5. Fix Priority & Effort

| Fix | Priority | Effort | Launch Blocker? |
|-----|----------|--------|-----------------|
| A4-F1: Mount authLimiter | P0 | Small (1 file) | ✅ YES |
| A4-F3: Re-enable CSP/COEP | P0 | Small (1 file) | ✅ YES |
| A4-F6: Mount auth on admin routes | P0 | Small (1 file) | ✅ YES |
| A4-F2: Redis-backed rate limiting | P1 | Medium (new dep) | ✅ YES |
| A4-F5: Require socket auth | P1 | Small (1 file) | ⚠️ Partial |
| A4-F7: Rate limiter before body parsers | P1 | Small (1 file) | ⚠️ No |
| A4-F4: Input validation on public routes | P2 | Medium (multiple files) | ⚠️ No |
| A4-F8: Narrow CORS origins | P2 | Small (1 file) | ⚠️ No |

---

## 6. Conclusion

The public ingress has **critical gaps** that must be fixed before launch:

1. **Auth rate limiter** is defined but never mounted — brute-force is trivial
2. **CSP is disabled** — XSS is unprotected
3. **Admin routes** may be accessible without auth
4. **Socket.IO** allows anonymous connections to deal rooms
5. **Rate limiting** is per-process only and mounted after body parsing

**Recommendation:** Fix A4-F1, A4-F3, and A4-F6 immediately (small effort, high impact). These are 1-file changes that can be done in under an hour.

---

*Audit completed: 2026-06-24T22:00:00-0400*
