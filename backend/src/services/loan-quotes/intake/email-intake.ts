/**
 * email-intake.ts
 * Component 4: Email intake channel stub.
 *
 * Intake channel #2: Email.
 * The email module is a document-INGESTION surface, not just a reader — a
 * broker emails a rate sheet, the module detects "financing quote," extracts
 * to loan_quotes with sender-as-lender provenance, appears in comparison
 * automatically.
 *
 * Design the email module as an ingestion path from the start, not a retrofit.
 * Same pipeline as upload, different channel.
 *
 * Provenance chain:
 *   email_receive → detect_financing_quote → extract → broker_claims
 *
 * TODO: Integrate with email module once built.
 */

import type { LoanQuote, BrokerClaimsProvenance } from '../loan-quote.types';

/**
 * Input: a parsed email that may contain a rate sheet attachment or inline
 * rate information.
 * TODO: Define Email type once email module provides it.
 */
export interface FinancingEmail {
  /** Email message ID. */
  messageId: string;

  /** Sender email address. */
  from: string;

  /** Sender display name. */
  fromName: string;

  /** Email subject line. */
  subject: string;

  /** Received timestamp (ISO 8601). */
  receivedAt: string;

  /** Org scope — Lane B privacy. */
  orgId: string;

  /** Attachments (if any). */
  attachments: Array<{
    attachmentId: string;
    fileName: string;
    mimeType: string;
  }>;

  /** Plain-text body (for inline rate quotes). */
  bodyText: string;
}

/**
 * Process an email that contains a financing quote.
 *
 * This is a STUB. Real implementation will:
 * 1. Detect "financing quote" intent from subject/body
 * 2. Extract lender from sender domain / signature
 * 3. If attachment: route to OM Extraction pipeline
 * 4. If inline: parse rate table from body text
 * 5. Populate broker_claims with sender-as-lender provenance
 * 6. Write to loan_quotes store
 *
 * @param email — the parsed financing email
 * @returns a LoanQuote (stub returns a synthetic quote for testing)
 */
export async function processEmailQuote(email: FinancingEmail): Promise<LoanQuote> {
  // TODO: Replace with real email module integration.
  // For the stub, infer lender from sender domain and return a synthetic quote.

  const lender = inferLenderFromEmail(email.from, email.fromName);
  const now = new Date();
  const quoteDate = now.toISOString().split('T')[0];
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const provenance: BrokerClaimsProvenance = {
    source: 'email_extraction',
    date: now.toISOString(),
    confidence: 0.9,
    sourceId: email.messageId,
    context: `Subject: "${email.subject}" | From: ${email.fromName} <${email.from}>`,
  };

  return {
    id: `quote-email-${Date.now()}`,
    orgId: email.orgId,
    lender,
    program: 'Fannie DUS',
    quoteDate,
    expires,
    indexBasis: 'treasury_10yr',
    rateType: 'fixed',
    spreadMatrix: {
      program: 'Fannie DUS',
      grid: {
        'Tier-3': {
          7: { min: 0.0126, max: 0.0136 },
          10: { min: 0.0130, max: 0.0140 },
        },
      },
    },
    adjustments: [
      { name: 'Green building', bps: -20, provenance: 'email_body_parsed' },
      { name: 'MAH', bps: -30, provenance: 'email_body_parsed' },
    ],
    prepayStructure: {
      type: 'yield_maintenance',
      terms: { lockoutMonths: 0, formula: 'treasury_rate + spread - note_rate' },
    },
    brokerClaims: provenance,
    notes: 'STUB: Replace with email module pipeline output',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * Infer lender name from sender email domain or display name.
 * Stub heuristic — real implementation will use a lookup table.
 */
function inferLenderFromEmail(from: string, fromName: string): string {
  const domain = from.split('@')[1]?.toLowerCase() ?? '';

  if (domain.includes('newpoint') || fromName.toLowerCase().includes('newpoint')) return 'NewPoint';
  if (domain.includes('fannie') || fromName.toLowerCase().includes('fannie')) return 'Fannie Mae';
  if (domain.includes('freddie') || fromName.toLowerCase().includes('freddie')) return 'Freddie Mac';
  if (domain.includes('cbre') || fromName.toLowerCase().includes('cbre')) return 'CBRE';
  if (domain.includes('hunt') || fromName.toLowerCase().includes('hunt')) return 'Hunt';

  return fromName || 'Unknown Lender';
}
