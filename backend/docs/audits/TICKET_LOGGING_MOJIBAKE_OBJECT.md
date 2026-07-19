# TICKET: Logging bugs — mojibake + `[object Object]`

**Severity:** P2 — cosmetic, but erodes trust in logs
**Discovered:** 2026-07-18 during D3 integration proof run
**File:** `financial-model-engine.service.ts` (M26/M27 log line)

## Symptom
1. Mojibake in the M26/M27 enhancement summary log line:
   ```
   M26/M27ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ...M09 Enhancement for deal ...
   ```
2. `[object Object]` appearing in log output (likely `logger.info` called with an object that wasn't stringified).

## Impact
Log noise makes debugging harder. Mojibake suggests an encoding issue in the source file or during a prior edit. `[object Object]` means data is being lost in logs.

## Fix Direction
1. Mojibake: re-type the affected log line (line ~1498) with plain ASCII/UTF-8 characters.
2. `[object Object]`: find the logger call passing a raw object and add `JSON.stringify()` or use the structured-logging variant.

## Acceptance
- [ ] M26/M27 log line is human-readable
- [ ] No `[object Object]` in build logs
