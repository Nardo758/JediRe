# Debt Ticket B: `query<T>` Signature Mismatch

**Type:** TypeScript type debt (ambient, pre-existing)
**Files affected:** `src/api/rest/investor-capital.routes.ts` (lines 116, 142, 303, 386, 448)
**Error count:** 5 errors

## Problem

The `pg` driver's `pool.query()` returns `QueryResult<any>`, which lacks the `Record<string, unknown>` index signature. Code that passes query results into functions expecting `Record<string, unknown>` fails type-check.

```typescript
// Error: Argument of type 'QueryResult<any>' is not assignable to parameter of type 'Record<string, unknown>'
const result = await pool.query(`SELECT ...`, [dealId]);
someFunction(result);  // TS2345
```

Also: property access on `QueryResult<any>` fails when code expects `QueryResult<any>.rows[0].id`.

## Root Cause

Likely an `@types/pg` version mismatch or an Express `@types` version conflict that changed the `query` generic signature. The `QueryResult` type from `pg` is not directly indexable as a `Record`.

## Fix Options

1. **Narrow fix:** Add explicit `.rows[0]` extraction before passing to functions:
   ```typescript
   const result = await pool.query(`SELECT ...`, [dealId]);
   const row = result.rows[0];
   someFunction(row as Record<string, unknown>);
   ```

2. **Broad fix:** Audit all `pool.query()` calls in investor-capital.routes.ts and ensure result typing is correct. The `pool.query()` return type should be `QueryResult<YourRowType>`, not `QueryResult<any>`.

3. **Dependency fix:** Check if `@types/pg` version aligns with installed `pg` version.

## Acceptance Criteria

- [ ] `npx tsc --noEmit` shows zero errors in `investor-capital.routes.ts`
- [ ] No `as any` casts introduced to silence the compiler

## Severity

**P2** — Type debt, not runtime bug. Blocks clean build.
