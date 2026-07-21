# T4e PII Boundary Audit Report

**Audit Date:** 2026-07-20
**Auditor:** T4e_pii_boundary (Read-Only Security Agent)
**HEAD:** 34f4405bf on master
**Scope:** DATA SOURCE UNIFICATION AUDIT (T4+T5 phase) - PII Boundary Analysis

---------

## 1. EXECUTIVE SUMMARY

This audit assesses the PII (Personally Identifiable Information) boundary across the JediRe platform, examining how tenant names, contact information, email addresses, and other sensitive data are stored, transmitted, logged, and protected. The audit covers database schema, document extraction pipelines, email intake systems, contact synchronization, encryption practices, and LLM prompt boundaries.

### Overall Grade: MIXED (Pass + Gaps)

- **Encryption at Rest (OAuth tokens, RSS feeds, Plaid credentials):** PASS
- **Tenant Name Storage in Schema:** PASS (acknowledged business requirement)
- **PII in LLM Prompts (Agent Chat):** GAP - tenant names leak to LLM
- **Email Body Logging:** GAP - raw email bodies logged without redaction
- **Data Retention / Purge Policies:** GAP - no automated retention controls
- **Deal Team Member PII:** PASS (basic storage, no encryption needed for names/emails)
- **Contact Sync (Microsoft/Google):** PASS - tokens encrypted, data transient
- **PST Email Import Raw Body Storage:** GAP - raw_body stored unencrypted

---

## 2. DETAILED FINDINGS

### FINDING 1: PII Leakage to LLM via Agent Chat (SEVERITY: HIGH)

- **File:** `backend/src/services/deal-financial-context.service.ts`
- **Lines:** 21, 183-189, 364-374
- **File:** `backend/src/services/agent-chat.service.ts`
- **Lines:** 282-292, 294, 362-364

**What was found:**
The `getDealFinancialContext()` function queries `deal_lease_transactions` and pulls `tenant_name` into `LeaseSnapshot` objects (line 22-23, 183-189). These snapshots are then passed through `formatFinancialContextForPrompt()` (line 434+) which renders tenant names directly into LLM prompts. The `agentChat()` function in `agent-chat.service.ts` (line 288-292) calls `getDealFinancialContext()` and passes the result to `buildSystemPrompt()`, which injects the full financial context (including tenant names from the rent roll) into the LLM system prompt.

**Specific code path:**
```
deal-financial-context.service.ts:183-189
  SELECT unit_number, tenant_name, monthly_rent, ... FROM deal_lease_transactions

deal-financial-context.service.ts:364-374
  items: leaseRows.map((l: any) => ({
    unitNumber: l.unit_number,
    tenantName: l.tenant_name,  // <-- PII leaked
    monthlyRent: Number(l.monthly_rent) || 0,
    ...
  }))

agent-chat.service.ts:294
  const systemPrompt = buildSystemPrompt(agentCode, agentConfig, dealContext, marketContext, alerts, financialContext);
```

**Impact:** Resident/tenant names (PII) are transmitted to third-party LLM APIs (OpenAI, DeepSeek, etc.) without redaction, anonymization, or user consent. This violates privacy best practices and may violate GDPR/CCPA if EU/California residents are involved.

**Recommendation:** Add a PII redaction layer before `formatFinancialContextForPrompt()` that masks tenant names (e.g., Resident A, Resident B) or excludes them from LLM-bound prompts. The `tenantName` field should be stripped from `LeaseSnapshot` items before serialization to the prompt.

**Classification:** GAP

---

### FINDING 2: Raw Email Body Stored Unencrypted in PST Pipeline (SEVERITY: MEDIUM)

- **File:** `backend/src/db/schema/pstPipeline.ts`
- **Lines:** 15-31, specifically line 23
- **File:** `backend/src/services/pst-backflow.service.ts`
- **Lines:** 40-41

**What was found:**
The `pst_email_imports` table stores the full raw email body in the `raw_body` column (type `text`, line 23). This column contains unredacted email content including broker communications, deal details, and potentially PII of third parties. The PST ingestion pipeline extracts email bodies and persists them without encryption or content scanning for PII.

```
pstPipeline.ts:23
  rawBody: text(raw_body),

pst-backflow.service.ts:40-41
  LEFT(pei.raw_body, 500),
  pei.raw_body,
```

**Impact:** Email bodies may contain sensitive information (SSN fragments, bank details, personal addresses) from broker communications. Stored in plaintext, a database breach would expose this content.

**Recommendation:** Consider encrypting the `raw_body` column at the application layer using the existing `encrypt()` utility, or implement column-level PostgreSQL encryption. Alternatively, store only extracted metadata and discard raw bodies after processing.

**Classification:** GAP

---

### FINDING 3: Email Address Logging in Audit Trail (SEVERITY: LOW)

- **File:** `backend/src/inngest/functions/email-intake.function.ts`
- **Lines:** 102-107, 136, 255-266

**What was found:**
The email intake function logs `from_address` in multiple places: tier gate skip (line 102-107), broker filter rejection (line 136), and the audit_log table (line 255-266). The `from_address` is a broker email address which, while not strictly resident PII, is a business email that could identify individuals.

```
email-intake.function.ts:255-266
  JSON.stringify({
    gmail_message_id: message_id,
    from_address,        // <-- logged
    subject,
    classification_confidence: ...,
    ...
  })
```

**Impact:** Low. Broker email addresses are business contact information, not sensitive PII. The audit_log is an internal system table.

**Recommendation:** This is acceptable for operational logging. No action required unless GDPR Article 17 (right to erasure) requests are received, in which case a data map would be needed.

**Classification:** PASS (acceptable risk)

---

### FINDING 4: No Data Retention or PII Purge Policies (SEVERITY: MEDIUM)

- **Scope:** Platform-wide

**What was found:**
No automated data retention policies, PII purge jobs, or expiration mechanisms were found. Searched for patterns: `delete.*user`, `user.*delete`, `purge`, `data.*retention`, `retention.*policy` across the entire backend codebase. No cron jobs, scheduled functions, or admin endpoints exist for purging old PII or expiring soft-deleted user data.

Tables containing PII with no TTL or purge mechanism:
- `deal_lease_transactions` (tenant_name)
- `pst_email_imports` (raw_body, sender, recipients)
- `emails` (from_address, to_addresses, body_text, body_preview)
- `deal_team_members` (name, email, phone)
- `agent_chat_logs` (user_message, agent_response)
- `user_notifications` (title, body - may contain PII)

**Impact:** Without retention policies, PII accumulates indefinitely. This increases breach exposure and complicates GDPR/CCPA compliance (right to erasure, data minimization).

**Recommendation:** Implement tiered retention:
1. Raw email bodies (`pst_email_imports.raw_body`): purge after 30 days post-processing
2. Agent chat logs: anonymize user_id after 90 days, purge after 1 year
3. Extracted tenant names: purge when deal is deleted or archived > 2 years
4. Add a `retention_until` timestamp column to PII-bearing tables

**Classification:** GAP

---

### FINDING 5: Tenant Name Storage in deal_lease_transactions (SEVERITY: INFO)

- **File:** `backend/src/db/schema/dataPipeline.ts`
- **Line:** 322
- **File:** `backend/src/services/document-extraction/types.ts`
- **Lines:** 93-111 (RentRollUnit interface)
- **File:** `backend/src/services/document-extraction/data-router.ts`
- **Lines:** 669-743 (routeRentRoll function)

**What was found:**
The `tenantName` column exists in `deal_lease_transactions` (line 322, `tenantName: varchar(tenant_name, { length: 200 })`). This is populated by the rent roll parser from Yardi/RealPage exports (data-router.ts line 695). The `RentRollUnit` type definition includes `tenantName: string | null` (types.ts line 98).

```
dataPipeline.ts:322
  tenantName: varchar(tenant_name, { length: 200 }),

data-router.ts:695
  unit.tenantName,  // inserted into DB
```

**Analysis:** This is a legitimate business data field. Property management software (Yardi, RealPage) exports resident names as part of rent rolls. For deal underwriting and investor reporting, knowing which units are occupied vs vacant is essential. The tenant name helps operators identify model units, employee units, and non-revenue units. This is not a GAP per se, but it is a PII boundary that must be acknowledged and protected.

**Recommendation:** Document this in the privacy policy. Ensure the field is never exposed in public APIs, shareable capsules, or LLM prompts without explicit opt-in. Consider adding a `pii_level` column to mark fields that require special handling.

**Classification:** PASS (with documentation requirement)

---

### FINDING 6: OAuth Token Encryption (Gmail, Microsoft) - PASS

- **File:** `backend/src/services/gmail-sync/token-encryption.ts`
- **Lines:** 1-163 (entire file)
- **File:** `backend/src/services/contacts-sync.service.ts`
- **Lines:** 32-44, 120-146

**What was found:**
Gmail and Microsoft OAuth tokens are encrypted at rest using AES-256-GCM with application-layer encryption. The `token-encryption.ts` module implements:
- Self-describing ciphertext format (`enc:v1:<base64>`)
- 12-byte IV + 16-byte GCM auth tag
- Plaintext fallback for legacy migration
- `safeEncryptToken()` / `safeDecryptToken()` for graceful degradation

The contacts-sync service decrypts tokens before use (line 122-123, 32-44) and re-encrypts refreshed tokens before persistence (line 135-136).

**Classification:** PASS

---

### FINDING 7: RSS Feed URL Encryption - PASS

- **File:** `backend/src/services/news-connections/rss-feeds.ts`
- **Lines:** 28-42, 113-121

**What was found:**
RSS feed URLs (which often contain personalized auth tokens) are encrypted before storage using `encryptFeedSecret()` (line 29-31), which wraps the platform `encrypt()` utility. Decryption happens only at fetch time (line 116). URLs are never logged in plaintext; a SHA-1 fingerprint is used for logging (line 47-52).

```
rss-feeds.ts:29-31
  export function encryptFeedSecret(plain: string): string {
    return encrypt(plain);
  }

rss-feeds.ts:47-52
  function fingerprintUrl(url: string): string {
    return rss: + crypto.createHash(sha1).update(url).digest(hex).slice(0, 10);
  }
```

**Classification:** PASS

---

### FINDING 8: Plaid Credentials Encryption - PASS

- **File:** `backend/src/services/integrations/plaid.service.ts`
- **Lines:** 10, 34-37, 47-48

**What was found:**
Plaid API credentials (clientId, secret) are encrypted using AES-256-CBC before storage in `org_integrations.credentials_encrypted`. The `encrypt()` and `decrypt()` utilities from `backend/src/utils/encryption.ts` are used.

```
plaid.service.ts:47-48
  const credentialsEncrypted = encrypt(JSON.stringify({
    clientId: credentials.clientId,
    secret: credentials.secret,
  }));
```

**Classification:** PASS

---

### FINDING 9: Contact Name Extraction from PST Emails (SEVERITY: LOW)

- **File:** `backend/src/services/pst-ai-extraction.service.ts`
- **Lines:** 10-16, 70-81, 138-149
- **File:** `backend/src/db/schema/pstPipeline.ts`
- **Lines:** 43-46

**What was found:**
The AI extraction service extracts `contactName` from email bodies (line 11, 79-80) and stores it in `pst_extracted_entities.contact_name` (schema line 44). This is a broker/contact name, not a resident name. The LLM prompt explicitly asks for contact names (line 79: Contact names (people mentioned in relation to deals)).

```
pst-ai-extraction.service.ts:11
  contactName: string | null;

pstPipeline.ts:44
  contactName: text(contact_name),
```

**Analysis:** Broker contact names are business PII, not sensitive personal data. This is acceptable for a CRE platform where deal contacts are part of normal operations. However, this field should be excluded from any public/shared API responses.

**Classification:** PASS (with awareness)

---

### FINDING 10: Notarize.com Integration - PII in Third-Party Handoff (SEVERITY: LOW)

- **File:** `backend/src/services/notarize/notarize-com.adapter.ts`
- **Lines:** 55-88 (createSession)

**What was found:**
The Notarize.com adapter sends signer PII (full_name, email, phone) to the Notarize API for remote notarization sessions. This is a required integration point for the e-closing workflow. The data is transmitted over HTTPS with Bearer token auth.

```
notarize-com.adapter.ts:62-67
  participants: request.signers.map(s => ({
    full_name: s.name,
    email: s.email,
    phone: s.phone,
    role: s.role || signer,
  })),
```

**Analysis:** This is a legitimate third-party handoff for notarization services. The signer data is required by Notarize.com to perform identity verification. No JediRe database storage of this PII was observed in the adapter. The integration is secure (HTTPS + API key auth).

**Recommendation:** Ensure a DPA (Data Processing Agreement) exists with Notarize.com. Document this PII flow in the privacy policy.

**Classification:** PASS

---

### FINDING 11: Agent Chat Logs Store User Messages (SEVERITY: MEDIUM)

- **File:** `backend/src/services/agent-chat.service.ts`
- **Lines:** 433-458 (logChatInteraction)

**What was found:**
The `logChatInteraction()` function stores both user messages and agent responses in the `agent_chat_logs` table. Users may input PII in their chat queries (e.g., asking about a specific resident, deal address, or personal financial data).

```
agent-chat.service.ts:440-453
  INSERT INTO agent_chat_logs (
    agent_code, user_id, deal_id, msa_id, user_message,
    agent_response, execution_time_ms, session_id
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
```

**Impact:** Without retention limits, chat logs accumulate PII indefinitely. This creates compliance risk under GDPR/CCPA right to erasure.

**Recommendation:** Add a retention policy to `agent_chat_logs` (e.g., purge after 90 days or anonymize user_id). Consider adding a PII detection step before logging that redacts suspected PII patterns (SSN, phone numbers, etc.).

**Classification:** GAP

---

## 3. SUMMARY TABLE

| # | Finding | File | Line | Classification | Severity |
|---|---------|------|------|----------------|----------|
| 1 | PII Leakage to LLM via Agent Chat | deal-financial-context.service.ts | 21,183-189,364-374 | GAP | HIGH |
|   |                                     | agent-chat.service.ts | 282-292,294,362-364 | GAP | HIGH |
| 2 | Raw Email Body in PST (unencrypted) | pstPipeline.ts | 23 | GAP | MEDIUM |
|   |                                     | pst-backflow.service.ts | 40-41 | GAP | MEDIUM |
| 3 | Email Address in Audit Log | email-intake.function.ts | 102-107,136,255-266 | PASS | LOW |
| 4 | No Data Retention/Purge Policies | Platform-wide | - | GAP | MEDIUM |
| 5 | Tenant Name in deal_lease_transactions | dataPipeline.ts | 322 | PASS | INFO |
| 6 | OAuth Token Encryption | gmail-sync/token-encryption.ts | 1-163 | PASS | N/A |
| 7 | RSS Feed URL Encryption | news-connections/rss-feeds.ts | 28-42,113-121 | PASS | N/A |
| 8 | Plaid Credentials Encryption | integrations/plaid.service.ts | 10,34-37,47-48 | PASS | N/A |
| 9 | Contact Name in PST Extraction | pst-ai-extraction.service.ts | 10-16,70-81,138-149 | PASS | LOW |
| 10 | Notarize.com PII Handoff | notarize/notarize-com.adapter.ts | 55-88 | PASS | LOW |

---

## 4. PRIORITIZED RECOMMENDATIONS

### P0 (Critical - Fix Immediately)
1. **Add PII Redaction Layer for LLM Prompts**
   - Modify `formatFinancialContextForPrompt()` to strip `tenantName` from LeaseSnapshot items before rendering
   - Add a `redactForLLM()` utility that masks PII patterns (names, SSNs, phone numbers) from prompt-bound data
   - Target: `backend/src/services/deal-financial-context.service.ts`

### P1 (High - Fix in Next Sprint)
2. **Implement Data Retention Policies**
   - Create a `data-retention.cron.ts` job that runs nightly
   - Purge `pst_email_imports.raw_body` after 30 days
   - Anonymize `agent_chat_logs.user_id` after 90 days, purge after 1 year
   - Add `retention_until` timestamps to PII-bearing tables

3. **Encrypt PST Raw Body Column**
   - Use existing `encrypt()` utility from `backend/src/utils/encryption.ts`
   - Encrypt `raw_body` before insert in `PstIngestionService.parseFromBuffer()`
   - Decrypt on read in `pst-backflow.service.ts` and `PstAiExtractionService.extractFromEmails()`
   - Alternative: truncate raw_body to 0 after extraction is complete

### P2 (Medium - Fix in Next Quarter)
4. **Add PII Classification to Schema**
   - Add metadata annotations to Drizzle schema columns indicating PII level
   - Use this for automated API response filtering and audit trail generation

5. **Add User Consent Flow for LLM Data Sharing**
   - Before sending deal data to LLM APIs, prompt user for consent
   - Store consent record in user profile
   - Provide opt-out toggle in settings

### P3 (Low - Nice to Have)
6. **Document Privacy Policy Updates**
   - Explicitly mention tenant name storage for underwriting purposes
   - Document Notarize.com data flow

---

## 5. APPENDIX A: PII-BEARING TABLES INVENTORY

| Table | PII Columns | Drizzle Schema File | Line |
|-------|-------------|---------------------|------|
| deal_lease_transactions | tenant_name | dataPipeline.ts | 322 |
| pst_email_imports | sender, recipients, raw_body | pstPipeline.ts | 20,21,23 |
| pst_extracted_entities | contact_name, property_address | pstPipeline.ts | 44,38 |
| org_invitations | email | org.ts | 44 |
| deal_team_members | name, email, phone | contacts-sync.routes.ts (SQL) | 105 |
| identity_verifications | subject_name, subject_email | integrations/plaid.service.ts (SQL) | 212-228 |
| emails | from_address, to_addresses, body_text, body_preview | N/A (migration table) | - |
| agent_chat_logs | user_message, agent_response | N/A (migration table) | - |

---

## 6. APPENDIX B: ENCRYPTION COVERAGE MATRIX

| Data Type | Encryption | Algorithm | Key Storage | File |
|-----------|-----------|-----------|-------------|------|
| Gmail OAuth tokens | YES | AES-256-GCM | GMAIL_TOKEN_ENCRYPTION_KEY env | token-encryption.ts |
| Microsoft OAuth tokens | YES | AES-256-GCM | GMAIL_TOKEN_ENCRYPTION_KEY env | token-encryption.ts |
| RSS feed URLs | YES | AES-256-CBC | ENCRYPTION_KEY env | encryption.ts |
| Plaid credentials | YES | AES-256-CBC | ENCRYPTION_KEY env | encryption.ts |
| PST raw_body | NO | - | - | pstPipeline.ts |
| Tenant names | NO | - | - | dataPipeline.ts |
| Email bodies | NO | - | - | emails table |

---

## 7. APPENDIX C: AUDIT METHODOLOGY

This audit was conducted as a read-only analysis of the JediRe codebase at HEAD 34f4405bf on master. The following tools and techniques were used:

1. **Code Search:** Grep patterns for PII-related terms (tenant_name, contact_name, email, phone, ssn, pii, encrypt, decrypt, redact, purge, retention)
2. **Schema Review:** Read all Drizzle schema files in `backend/src/db/schema/`
3. **Pipeline Tracing:** Followed data flow from ingestion (PST, email, rent roll) through extraction to LLM prompt construction
4. **Encryption Audit:** Verified all encryption usage via grep for encrypt/decrypt imports and calls
5. **Logging Review:** Checked logger calls for PII leakage in log statements

### Files Read During Audit:
- backend/src/db/schema/dataPipeline.ts
- backend/src/db/schema/pstPipeline.ts
- backend/src/db/schema/org.ts
- backend/src/db/schema/propertyEntity.ts
- backend/src/inngest/functions/email-intake.function.ts
- backend/src/services/deal-financial-context.service.ts
- backend/src/services/agent-chat.service.ts
- backend/src/services/pst-ai-extraction.service.ts
- backend/src/services/pst-ingestion.service.ts
- backend/src/services/pst-backflow.service.ts
- backend/src/services/document-extraction/types.ts
- backend/src/services/document-extraction/data-router.ts
- backend/src/services/document-extraction/parsers/rent-roll-parser.ts
- backend/src/services/gmail-sync/token-encryption.ts
- backend/src/services/integrations/plaid.service.ts
- backend/src/services/news-connections/rss-feeds.ts
- backend/src/services/news-connections/inbound-email.ts
- backend/src/services/notarize/notarize-com.adapter.ts
- backend/src/services/contacts-sync.service.ts
- backend/src/api/rest/contacts-sync.routes.ts
- backend/src/api/rest/email.routes.ts
- backend/src/agents/tools/create_deal_draft.ts
- backend/src/agents/tools/read_gmail_thread.ts
- backend/src/utils/encryption.ts

---

## 8. CONCLUSION

The JediRe platform has a solid foundation for PII protection at rest, with strong encryption for OAuth tokens, credentials, and feed URLs. However, two critical gaps require immediate attention:

1. **PII leakage to LLM APIs** is the highest-risk finding. Tenant names from rent rolls are flowing to third-party LLM providers without redaction or user consent. This must be fixed before the agent chat feature is widely deployed.

2. **Data retention policies** are entirely absent. The platform accumulates PII indefinitely, creating compliance risk and increasing breach exposure.

The remaining findings are either acceptable business practices (tenant name storage for underwriting) or low-risk items (broker email in audit logs) that can be addressed with documentation.

---

*Report generated by T4e_pii_boundary audit agent on 2026-07-20T20:01 EDT*
*HEAD: 34f4405bf on master*
