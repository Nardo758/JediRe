# Debt Ticket D: Missing `pino` Dependency

**Type:** Missing dependency (ambient, pre-existing)
**Files affected:** 10 sigma services
**Error count:** 10 errors (`TS2307: Cannot find module 'pino'`)

## Problem

10 services in `src/services/sigma/` import `type { Logger } from 'pino'`:

```typescript
// analog-engine.ts, calibration-ledger.ts, causal-discipline-engine.ts,
// conditional-sampler.ts, factor-estimator.ts, hmm-regime-classifier.ts,
// macro-anchored-mean.ts, multi-tier-factor.ts, peer-intelligence.ts,
// spatial-kernel.ts
import type { Logger } from 'pino';
```

But `pino` is **not in package.json** and **not in node_modules**.

## Root Cause

The project uses **Winston** for actual logging (`src/utils/logger.ts`). The sigma services likely copied a pino-based type import from another codebase or template. The actual logger instances come from the local `createLogger` utility (Winston-based), not pino.

## Fix Options

1. **Add pino (quick, correct if pino is intentional):**
   ```bash
   npm install pino
   # or
   npm install --save-dev pino
   ```

2. **Replace with local type (cleaner, no new dependency):**
   ```typescript
   // Remove pino import
   import type { Logger } from '../../utils/logger';  // Export a Logger interface
   ```
   Or use `winston.Logger` type directly.

3. **Inline the needed interface:**
   ```typescript
   interface Logger {
     info(msg: string, meta?: Record<string, unknown>): void;
     warn(msg: string, meta?: Record<string, unknown>): void;
     error(msg: string, meta?: Record<string, unknown>): void;
     debug(msg: string, meta?: Record<string, unknown>): void;
   }
   ```

## Recommendation

Option 2 — the project already uses Winston. No need to add pino as a dependency just for a type import. Create a `Logger` interface export in `utils/logger.ts` and repoint the sigma services.

## Acceptance Criteria

- [ ] `npx tsc --noEmit` shows zero `Cannot find module 'pino'` errors
- [ ] No new runtime dependency added (unless pino is actually needed)
- [ ] Sigma services still compile and their logger usage is type-safe

## Severity

**P2** — Build debt. Easy fix (~10 min).
