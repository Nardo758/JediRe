# TICKET: Logging bugs — mojibake + `[object Object]`

**Severity:** P3 — cosmetic, but erodes trust in logs  
**Discovered:** 2026-07-18 during D3 integration proof run  
**File:** `backend/src/services/financial-model-engine.service.ts`  
**Status:** FIXED — committed `e770891d5`, pushed to master

## Symptom
1. Mojibake in the M26/M27 enhancement summary log line and three comment lines:
   ```
   M26/M27ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ...M09 Enhancement for deal ...
   ```
2. `[object Object]` appearing in log output from `logger.info` called with an object interpolated into a template literal.

## Impact
Log noise made debugging harder. Mojibake suggested an encoding issue in the source file from a prior edit. `[object Object]` meant data was being lost in logs.

## Root Cause
1. **Mojibake:** Four lines in `financial-model-engine.service.ts` contained UTF-8 mojibake (garbled em-dash/box-drawing characters that were double-encoded or corrupted during a prior edit).
   - Line ~289: Tier-2 wiring comment header
   - Line ~303: `schema-misaligned` comment
   - Line ~409: `Only fills slots` comment
   - Line ~1513: M26/M27 log line
2. **`[object Object]`:** Line 1513 used template-literal interpolation with `enhancementSummary`, which is typed as `Record<string, unknown>` (an object). JavaScript coerces objects in template literals to `"[object Object]"`.
   ```typescript
   // BEFORE (broken)
   logger.info(`M26/M27 / M09 Enhancement for deal ${dealId}:\n${enhancementSummary}`);
   ```

## Fix
1. **Mojibake:** Replaced all four garbled sequences with plain ASCII/UTF-8 text:
   - Tier-2 headers: `// ── Tier-2 §12 ... ──`
   - Comments: `" -- "` instead of corrupted em-dash
   - Log line: `"M26/M27 / M09"` instead of corrupted characters
2. **`[object Object]`:** Split the logger call into a string message + structured object pass:
   ```typescript
   // AFTER (fixed)
   logger.info(`M26/M27 / M09 Enhancement for deal ${dealId}:`);
   logger.info(enhancementSummary);
   ```
   This preserves the object's structure in the structured log output rather than coercing it to a string.

## Acceptance
- [x] M26/M27 log line is human-readable
- [x] No `[object Object]` in build logs
- [x] No remaining mojibake in `financial-model-engine.service.ts`
