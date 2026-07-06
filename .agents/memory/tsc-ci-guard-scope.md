---
name: TypeScript CI guard scope and baseline-diff pattern
description: backend's CI typecheck step only compiles a narrow include list; how the deterministic-engine test/fixture surface was brought under coverage without blocking on unrelated pre-existing errors
---

`backend/tsconfig.json`'s default `include` lists only 2 entry files. CI's typecheck step (`.github/workflows/typecheck.yml`) runs `npx tsc --noEmit --skipLibCheck` with **no `-p` flag**, so it silently inherits that narrow include — most of the repo, including all test/fixture files, is structurally never type-checked by CI.

**Why this matters:** a broken import, duplicated block, or wrong type annotation in any file outside that narrow include can reach `master` with a green typecheck. This was the root cause that let repeated merge-corruption in golden fixture files go undetected across multiple commits.

**How to apply:** when adding CI type-checking for a surface not covered by the default `tsconfig.json` include (e.g. a specific test/fixture directory), use a scoped `tsconfig.*.json` + a small Node script that diffs `tsc` output against a pre-registered baseline file of known/pre-existing errors (matched by file + error code + message, ignoring line/col so line drift elsewhere doesn't false-negative). This lets a new guard catch *new* regressions immediately without being blocked on unrelated pre-existing bugs that are out of scope to fix in the same pass. Always prove the guard actually fails (inject a synthetic error, confirm non-zero exit, then revert) — a guard that always exits 0 is worse than no guard, because it creates false confidence.

Example implementation: `backend/tsconfig.test.json` (scoped include), `backend/tsconfig.test.baseline.json` (baseline error list with rationale), `backend/scripts/check-deterministic-types.js` (diff-and-fail script), wired as an additional CI step alongside (not replacing) the existing repo-wide check.
