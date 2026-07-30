# Debt Ticket C: `upsertNode` Contract Violation

**Type:** TypeScript type debt (ambient, pre-existing)
**Files affected:** 10+ services and routes
**Error count:** ~15 errors ("Property 'id' is missing in type...")

## Problem

`upsertNode()` expects `Omit<GraphNode, "updatedAt" | "createdAt" | "staleness">`, which **still requires `id`**. But consumers pass objects without `id`, expecting the function to generate one.

```typescript
// Consumer (cloud-storage.service.ts:309)
await kg.upsertNode({
  type: "Document",
  externalId: string,
  name: string,
  properties: { ... },
  // ❌ id is missing
});

// Error: Property 'id' is missing in type '{ type: "Document"; ... }' 
// but required in type 'Omit<GraphNode, "updatedAt" | "createdAt" | "staleness">'
```

## Affected Files

| File | Line |
|---|---|
| `src/services/cloud-storage/cloud-storage.service.ts` | 309 |
| `src/services/document-extraction/broker-sentiment.service.ts` | 177 |
| `src/services/gmail-sync.service.ts` | 767, 786 |
| `src/services/neural-network/graph-ingestion-listener.ts` | 89, 167, 206, 259, 296, 365, 388, 444, 501, 544 |
| `src/services/news/newsletter-parser.service.ts` | 338 |
| `src/services/property-enrichment/discovery/property-discovery.service.ts` | 380 |
| `src/services/sentiment-history.service.ts` | 454 |

## Root Cause

The `upsertNode` type definition requires `id`, but the implementation likely generates `id` internally when not provided (common upsert pattern). The type contract is stricter than the runtime behavior.

## Fix Options

1. **Type fix (preferred):** Make `id` optional in the `upsertNode` parameter type:
   ```typescript
   type UpsertNodeInput = Omit<GraphNode, "id" | "updatedAt" | "createdAt" | "staleness"> & { id?: string };
   ```

2. **Consumer fix (noisy):** Add `id: crypto.randomUUID()` or similar to every call site.

## Acceptance Criteria

- [ ] `upsertNode` parameter type correctly reflects that `id` is optional
- [ ] All 10+ call sites type-check without modification
- [ ] `npx tsc --noEmit` shows zero `upsertNode`-related errors

## Severity

**P2** — Type debt. The runtime works (ids are generated), but the type contract is wrong.
