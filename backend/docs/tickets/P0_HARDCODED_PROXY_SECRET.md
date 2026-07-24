# P0 TICKET — Hardcoded Proxy Token Secret Enables R2 Upload Forgery

**Severity:** P0 — authentication bypass on upload proxy
**Discovered:** 2026-07-20, T4bc agent audit
**File:** `backend/src/api/rest/archive.routes.ts:1620-1621`

## The Gap

The `proxyTokenSecret()` function in `archive.routes.ts` has a hardcoded fallback:

```typescript
function proxyTokenSecret(): string {
  return process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? 'r2-proxy-fallback-secret';
}
```

If both `JWT_SECRET` and `SESSION_SECRET` are unset, the HMAC key becomes a **publicly known constant** (`'r2-proxy-fallback-secret'`). An attacker with knowledge of this codebase can forge proxy tokens and write arbitrary files to permitted R2 keys.

## Attack Path

1. Attacker reads this repo (public or leaked).
2. Attacker computes `HMAC-SHA256('uploads/library/<any-uuid>.pdf' + timestamp, 'r2-proxy-fallback-secret')`.
3. Attacker calls `POST /files/upload-proxy` with forged token.
4. File is written to R2 under `uploads/library/` namespace.

## Fix

Remove the hardcoded fallback. Throw if both env vars are absent:

```typescript
function proxyTokenSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'Upload proxy unavailable: JWT_SECRET or SESSION_SECRET must be set. ' +
      'This is a required environment variable; there is no safe fallback.'
    );
  }
  return secret;
}
```

This matches the standing rule: **no silent defaults** (S1-01).

## Deployment Guard

**Before merging:** Verify `JWT_SECRET` and/or `SESSION_SECRET` are actually set in the Replit production environment. The throw is correct; throwing in production on day one is not.

```bash
# Replit verification one-liner:
echo "JWT_SECRET=${JWT_SECRET:+SET} SESSION_SECRET=${SESSION_SECRET:+SET}"
# Expected: at least one shows SET. If both empty, set one before merging this fix.
```

If either is missing in the target environment, **set it first** — then merge the fix. Do not merge the throw without confirming the safety net exists.

Remove the hardcoded fallback. Throw if both env vars are absent:

```typescript
function proxyTokenSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'Upload proxy unavailable: JWT_SECRET or SESSION_SECRET must be set. ' +
      'This is a required environment variable; there is no safe fallback.'
    );
  }
  return secret;
}
```

This matches the standing rule: **no silent defaults** (S1-01).

## Verification

1. Unit test: call `proxyTokenSecret()` with both env vars unset → expect throw.
2. Integration: upload-proxy request without env vars → 500 with explicit error, not forged acceptance.
3. Regression: with env vars set → upload works as before.

## Cross-references

- T4bc report: `backend/docs/audits/T4BC_UNIVERSE_S3_FIREWALL_AUDIT_2026-07-20.md`
- T6 synthesis: `backend/docs/audits/T6_DATA_SOURCE_GAP_SYNTHESIS_2026-07-20.md` (P0 item 3)
- Standing rule: S1-01 — no silent defaults
