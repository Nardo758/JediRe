/**
 * Provenance Stamp — stamp-at-entry utility for every ingestion route.
 *
 * Wave 1 W1: Every value that enters the platform carries a source stamp at birth.
 * No more inferred sources, no more decorative badges, no more last-write-wins
 * without knowing who wrote.
 *
 * Usage: call `stampProvenance()` at the top of every ingestion route handler,
 * then pass the stamp into the service layer.
 */

import type { LayeredValueSource } from '../types/layered-value';

// ═════════════════════════════════════════════════════════════════════════════
// Ingestion Source Enum — canonical classification of HOW data entered
// ═════════════════════════════════════════════════════════════════════════════

export type IngestionSource =
  | 'email_intake'           // broker email → create_deal_draft
  | 'manual_entry'           // user typed directly
  | 'document_extraction'    // uploaded PDF/Excel → parser pipeline
  | 'csv_upload'             // CSV actuals upload
  | 'api_import'             // external API pull (Zillow, FRED, etc.)
  | 'agent_output'           // research/supply/zoning/cashflow agent
  | 'platform_default'       // system-supplied default
  | 'user_override'          // user explicitly overrode
  | 'computed'               // engine-derived (M11 sizing, etc.)
  | 'archive_import'         // historical portfolio data import
  | 'owned_import'           // owned asset data import
  | 'capsule_bridge'         // shared capsule import
  | 'comp_set_sync';         // comparable set synchronization

export const INGESTION_SOURCES: readonly IngestionSource[] = [
  'email_intake',
  'manual_entry',
  'document_extraction',
  'csv_upload',
  'api_import',
  'agent_output',
  'platform_default',
  'user_override',
  'computed',
  'archive_import',
  'owned_import',
  'capsule_bridge',
  'comp_set_sync',
] as const;

// ═════════════════════════════════════════════════════════════════════════════
// Provenance Stamp — what gets attached to every ingested value
// ═════════════════════════════════════════════════════════════════════════════

export interface ProvenanceStamp {
  /** How this value entered the platform. */
  ingestionSource: IngestionSource;

  /** Specific source within the ingestion channel (e.g. 't12', 'rent_roll', 'om'). */
  documentSource?: string;

  /** User who triggered the ingestion (null for system/automated). */
  userId: string | null;

  /** Agent run that produced this value (null for non-agent sources). */
  agentRunId?: string | null;

  /** When the value entered the platform. */
  stampedAt: string;

  /** Optional: ingestion job ID for batch operations. */
  jobId?: string;

  /** Optional: raw source identifier (Gmail message ID, API request ID, etc.). */
  rawSourceRef?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Stamp Factory
// ═════════════════════════════════════════════════════════════════════════════

export interface StampInput {
  ingestionSource: IngestionSource;
  userId?: string | null;
  agentRunId?: string | null;
  documentSource?: string;
  jobId?: string;
  rawSourceRef?: string;
}

/**
 * Create a provenance stamp. Call this at the entry point of every ingestion route.
 *
 * @example
 *   const stamp = stampProvenance({
 *     ingestionSource: 'email_intake',
 *     userId: req.user!.userId,
 *     rawSourceRef: metadata.gmail_message_id,
 *   });
 *   await createDealDraft(fields, stamp);
 */
export function stampProvenance(input: StampInput): ProvenanceStamp {
  return {
    ingestionSource: input.ingestionSource,
    userId: input.userId ?? null,
    agentRunId: input.agentRunId ?? null,
    documentSource: input.documentSource,
    jobId: input.jobId,
    rawSourceRef: input.rawSourceRef,
    stampedAt: new Date().toISOString(),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Map ingestion source to LayeredValue source tier
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Map an ingestion source to its canonical LayeredValueSource tier.
 * This is the bridge between "how it entered" and "how the evidence system
 * classifies it".
 */
export function ingestionToLayeredValueSource(
  ingestion: IngestionSource,
  documentSource?: string
): LayeredValueSource {
  switch (ingestion) {
    case 'document_extraction':
      if (documentSource === 't12') return 'tier1:t12';
      if (documentSource === 'rent_roll') return 'tier1:rent_roll';
      if (documentSource === 'tax_bill') return 'tier1:tax_bill';
      if (documentSource === 'om') return 'tier4:broker';
      return 'tier1:t12'; // default document tier

    case 'archive_import':
    case 'owned_import':
      return 'tier2:owned_asset';

    case 'api_import':
      return 'tier3:platform';

    case 'email_intake':
      return 'tier4:broker';

    case 'agent_output':
      return 'agent:cashflow';

    case 'user_override':
      return 'override';

    case 'platform_default':
      return 'platform';

    case 'computed':
      return 'computed';

    case 'manual_entry':
    case 'csv_upload':
    default:
      return 'user';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Guard
// ═════════════════════════════════════════════════════════════════════════════

export function isIngestionSource(v: unknown): v is IngestionSource {
  return typeof v === 'string' && INGESTION_SOURCES.includes(v as IngestionSource);
}
