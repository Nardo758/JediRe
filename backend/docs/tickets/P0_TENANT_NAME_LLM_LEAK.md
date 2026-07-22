# P0 TICKET — Tenant Name PII Leaked to LLM Prompts

**Severity:** P0 — blocks multi-org onboarding / production
**Discovered:** 2026-07-20, T4e agent audit
**File:** `backend/src/services/deal-financial-context.service.ts:183-189`, `agent-chat.service.ts:294`

## The Leak

`deal-financial-context.service.ts:183-189` queries `deal_lease_transactions` and selects `tenant_name`:

```typescript
SELECT unit_number, tenant_name, monthly_rent, ... FROM deal_lease_transactions
```

This data is passed through `formatFinancialContextForPrompt()` (line 364-374) which renders `tenantName` into a text block:

```typescript
items: leaseRows.map((l) => ({
  unitNumber: l.unit_number,
  tenantName: l.tenant_name,  // ← PII
  ...
}))
```

The formatted text is then passed to `buildSystemPrompt()` in `agent-chat.service.ts:294`, which sends it to third-party LLM APIs (OpenAI, DeepSeek, etc.) without redaction, anonymization, or user consent.

## Why This Is P0

Resident names are **personally identifiable information (PII)** under GDPR/CCPA. Transmitting them to third-party LLM APIs without consent is a privacy violation with regulatory exposure. It also breaches the platform's own data-classification contract (S1/S2 data must not reach external inference surfaces).

## Fix

**Primary: minimize at source.** Don't SELECT `tenant_name` at all for LLM-bound context — the prompt never needed it. This makes the leak structurally impossible, not just scrubbed at the sink.

```typescript
// deal-financial-context.service.ts:183-189 — BEFORE (leaky):
SELECT unit_number, tenant_name, monthly_rent, lease_start, lease_end
FROM deal_lease_transactions WHERE deal_id = $1

// AFTER (safe):
SELECT unit_number, monthly_rent, lease_start, lease_end
FROM deal_lease_transactions WHERE deal_id = $1
// tenant_name REMOVED from LLM-context query
```

**Secondary: belt-and-suspenders guard.** Keep `redactForLLM()` at the formatting layer to catch any future query refactor that re-adds PII fields:

```typescript
// backend/src/utils/redact-for-llm.ts
export function redactForLLM<T extends Record<string, any>>(item: T, piiKeys: string[]): T {
  const redacted = { ...item };
  for (const key of piiKeys) {
    delete redacted[key];
  }
  return redacted;
}

// Usage in deal-financial-context.service.ts:364-374:
items: leaseRows.map((l) => redactForLLM(l, ['tenantName', 'ssn', 'phoneNumber', 'email']))
```

The `unitNumber` and financial fields (`monthlyRent`, `leaseStart`, `leaseEnd`) remain — they are not PII at the unit-grain.

## Verification

1. **Source:** Confirm `tenant_name` is absent from the LLM-context SELECT.
2. **Sink:** Log the prompt payload before API send; assert no `tenantName` substring present.
3. **Guard:** Unit test `redactForLLM` — input with `tenantName: 'John Doe'` → output without that key.
4. **Regression:** Bishop deal with lease transactions → prompt inspection confirms no PII.

Add a `redactForLLM()` utility that strips `tenantName` (and any other PII fields) from `LeaseSnapshot` items before `formatFinancialContextForPrompt()` renders them into the prompt.

```typescript
// Proposed location: backend/src/utils/redact-for-llm.ts
export function redactForLLM<T extends Record<string, any>>(item: T, piiKeys: string[]): T {
  const redacted = { ...item };
  for (const key of piiKeys) {
    delete redacted[key];
  }
  return redacted;
}

// Usage in deal-financial-context.service.ts:364-374:
items: leaseRows.map((l) => redactForLLM(l, ['tenantName', 'ssn', 'phoneNumber']))
```

The `unitNumber` and financial fields (`monthlyRent`, `leaseStart`, `leaseEnd`) remain — they are not PII at the unit-grain.

## Verification

1. After fix: `buildSystemPrompt()` receives financial context with no `tenantName` field.
2. Proof: log the prompt payload before API send; assert no `tenantName` substring present.
3. Regression test: Bishop deal with lease transactions → prompt inspection.

## Cross-references

- T4e report: `backend/docs/audits/T4E_PII_BOUNDARY_AUDIT_2026-07-20.md`
- T6 synthesis: `backend/docs/audits/T6_DATA_SOURCE_GAP_SYNTHESIS_2026-07-20.md` (P0 item 1)
- Related: PST raw_body encryption (T4e-F2, P2)
