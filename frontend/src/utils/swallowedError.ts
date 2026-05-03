/**
 * Logging helper for errors that are intentionally not surfaced to the
 * user but should still leave a trace for debugging.
 *
 * Background (Task #426): the codebase had ~85 empty `catch {}` blocks
 * that silently swallowed every failure — failed API calls, failed JSON
 * parses, failed cleanup teardowns. When analysts reported "the page
 * just doesn't update", there was no signal anywhere to point at the
 * actual failure. This helper writes a console.warn with a stable
 * `[swallowed:<context>]` prefix so:
 *
 *   - Empty catches are greppable in the browser console.
 *   - The error object (and its stack) is preserved.
 *   - We don't pile thousands of low-signal entries onto the backend
 *     `/api/v1/errors/log` queue (those are reserved for boundary-level
 *     crashes via `errorLogging.ts`).
 *
 * If you find yourself reaching for this helper in a NEW catch block,
 * first ask whether the error should instead bubble up or trigger a
 * user-visible error state. This helper exists for the cases where
 * swallowing is genuinely the right behavior (best-effort cleanup,
 * race-condition guards, optional-feature probes).
 */
export function logSwallowedError(context: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(`[swallowed:${context}]`, err);
}
