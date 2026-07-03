/**
 * T8 (TOKEN_LEAK_REMEDIATION_TRANCHE1): stable Idempotency-Key generator for
 * the F9 build endpoint (POST /api/v1/financial-model/build).
 *
 * Before this fix, build requests carried no Idempotency-Key header, so the
 * server-side idempotency cache (financial-model.routes.ts) was never hit —
 * every double-click / re-render-triggered call re-ran the LLM. This
 * produces a deterministic key from (dealId + assumptions), so identical
 * requests for the same deal + assumption set resolve to the same cache
 * entry instead of spawning a new LLM call.
 *
 * Deliberately NOT cryptographic — this only needs to be stable and
 * collision-resistant enough to dedupe accidental double-submits within the
 * server's short-lived idempotency TTL, not to be a content hash of record.
 */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function buildFinancialModelIdempotencyKey(
  dealId: string,
  assumptions: unknown,
): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(assumptions, Object.keys(assumptions as object).sort());
  } catch {
    serialized = String(assumptions);
  }
  return `f9-build:${dealId}:${djb2(serialized)}`;
}
