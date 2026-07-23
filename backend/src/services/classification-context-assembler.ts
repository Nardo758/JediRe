/**
 * ClassificationContext — canonical deal classification assembled from all sources.
 *
 * Wave 1 W3: Resolved assembler with override tracking, source classification,
 * and defensive null handling. Reads every classification field from every source
 * (deals table, deal_data, deal_context_fields, agent outputs, user overrides)
 * and resolves them into the canonical types defined in
 * backend/src/types/classification.ts.
 *
 * Precedence (highest → lowest):
 *   1. user_override    — explicit user edit
 *   2. agent_output     — agent-written value (research, cashflow, etc.)
 *   3. document_extraction — parsed from T12 / OM / rent roll
 *   4. email_intake     — broker email classification
 *   5. platform_default — system fallback
 */

import {
  isDealType,
  isStrategyType,
  isAssetClass,
  isDealMode,
  isViewMode,
  canonicalizeStrategy,
  PROJECT_INTENTS,
} from '../types/classification';
import type {
  DealType,
  StrategyType,
  AssetClass,
  DealMode,
  ProjectIntent,
  ViewMode,
} from '../types/classification';
import type { ProvenanceStamp } from '../utils/provenance-stamp';

// ═════════════════════════════════════════════════════════════════════════════
// ClassificationContext — the assembled output
// ═════════════════════════════════════════════════════════════════════════════

export interface ClassificationValue<T> {
  value: T;
  provenance: ProvenanceStamp;
  confidence: number; // 0–1
  /** Whether this winning value was established by a user or agent override. */
  overriddenBy?: 'user' | 'agent' | null;
}

export interface ClassificationContext {
  dealId: string;
  dealType: ClassificationValue<DealType> | null;
  strategy: ClassificationValue<StrategyType> | null;
  assetClass: ClassificationValue<AssetClass> | null;
  dealMode: ClassificationValue<DealMode> | null;
  projectIntent: ClassificationValue<ProjectIntent> | null;
  viewMode: ClassificationValue<ViewMode> | null;
  assembledAt: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Raw source rows — what the assembler reads
// ═════════════════════════════════════════════════════════════════════════════

export interface RawClassificationRow {
  field: string;
  value: string;
  source: string;
  confidence: number;
  stampedAt: string;
  userId: string | null;
  agentRunId?: string | null;
}

// ═════════════════════════════════════════════════════════════════════════════
// Precedence ranking for resolution
// ═════════════════════════════════════════════════════════════════════════════

const SOURCE_PRECEDENCE: Record<string, number> = {
  user_override: 100,
  override: 100,
  user: 90,
  agent_output: 80,
  'agent:research': 80,
  'agent:cashflow': 80,
  'agent:zoning': 80,
  'agent:supply': 80,
  document_extraction: 70,
  'tier1:t12': 70,
  'tier1:rent_roll': 70,
  'tier1:tax_bill': 70,
  'tier4:broker': 60,
  email_intake: 60,
  archive_import: 50,
  owned_import: 50,
  api_import: 40,
  platform_default: 30,
  platform: 30,
  computed: 20,
};

function precedenceOf(source: string): number {
  return SOURCE_PRECEDENCE[source] ?? 10;
}

// ═════════════════════════════════════════════════════════════════════════════
// Canonical field mapping — raw field names → canonical keys
// ═════════════════════════════════════════════════════════════════════════════

const FIELD_MAP: Record<string, string> = {
  deal_type: 'dealType',
  dealType: 'dealType',
  strategy: 'strategy',
  asset_class: 'assetClass',
  assetClass: 'assetClass',
  deal_mode: 'dealMode',
  dealMode: 'dealMode',
  project_intent: 'projectIntent',
  projectIntent: 'projectIntent',
  view_mode: 'viewMode',
  viewMode: 'viewMode',
};

// ═════════════════════════════════════════════════════════════════════════════
// Guard: validate a raw value against a canonical type
// ═════════════════════════════════════════════════════════════════════════════

function isProjectIntent(v: unknown): v is ProjectIntent {
  return typeof v === 'string' && (PROJECT_INTENTS as readonly string[]).includes(v);
}

function validateCanonical(field: string, raw: string): unknown {
  const trimmed = raw.trim().toLowerCase();
  switch (field) {
    case 'dealType':
      return isDealType(trimmed) ? trimmed : isDealType(raw.trim()) ? raw.trim() : null;
    case 'strategy':
      return canonicalizeStrategy(raw.trim()) ?? canonicalizeStrategy(trimmed) ?? null;
    case 'assetClass':
      return isAssetClass(trimmed) ? trimmed : isAssetClass(raw.trim()) ? raw.trim() : null;
    case 'dealMode':
      // DealMode is uppercase in canonical type
      return isDealMode(raw.trim()) ? raw.trim() : isDealMode(raw.trim().toUpperCase()) ? raw.trim().toUpperCase() : null;
    case 'projectIntent':
      return isProjectIntent(trimmed) ? trimmed : null;
    case 'viewMode':
      return isViewMode(raw.trim()) ? raw.trim() : null;
    default:
      return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Source-class confidence hook (W1-3)
// Deterministic mapping from ingestion source → confidence 0–1.
// Replaces raw pass-through of winner.row.confidence.
// ═════════════════════════════════════════════════════════════════════════════

function sourceClassToConfidence(source: string): number {
  const normalized = source.toLowerCase();
  if (normalized === 'user_override' || normalized === 'override' || normalized === 'user' || normalized === 'manual_entry') {
    return 1.0;
  }
  if (normalized === 'agent_output' || normalized.startsWith('agent:')) {
    return 0.9;
  }
  if (normalized === 'document_extraction') {
    return 0.85;
  }
  if (normalized === 'email_intake') {
    return 0.7;
  }
  if (normalized === 'platform_default' || normalized === 'platform' || normalized === 'computed') {
    return 0.5;
  }
  if (normalized === 'archive_import' || normalized === 'owned_import' || normalized === 'api_import') {
    return 0.6;
  }
  return 0.1;
}

// ═════════════════════════════════════════════════════════════════════════════
// Source classification — determine override origin for the winning value
// ═════════════════════════════════════════════════════════════════════════════

function classifyOverrideSource(source: string): 'user' | 'agent' | null {
  if (source === 'user_override' || source === 'override' || source === 'user' || source === 'manual_entry') {
    return 'user';
  }
  if (source === 'agent_output' || source.startsWith('agent:')) {
    return 'agent';
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// Assembler
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Assemble a ClassificationContext from raw rows.
 *
 * @param dealId     The deal identifier.
 * @param rows       All classification rows from all sources for this deal.
 * @returns          Resolved ClassificationContext with precedence-applied values.
 */
export function assembleClassificationContext(
  dealId: string,
  rows: RawClassificationRow[]
): ClassificationContext {
  // Bucket rows by canonical field
  const buckets: Record<string, RawClassificationRow[]> = {};
  for (const row of rows) {
    const canonicalField = FIELD_MAP[row.field];
    if (!canonicalField) continue;
    if (!buckets[canonicalField]) buckets[canonicalField] = [];
    buckets[canonicalField].push(row);
  }

  // Resolve each bucket by precedence (highest wins), tie-break by recency
  const resolve = (field: string, candidates: RawClassificationRow[]): ClassificationValue<unknown> | null => {
    if (!candidates || candidates.length === 0) return null;

    const valid = candidates
      .map(r => {
        // Defensive: skip null, undefined, or empty values
        const rawValue = r.value;
        if (rawValue == null || String(rawValue).trim() === '') {
          return { row: r, canonical: null };
        }
        return { row: r, canonical: validateCanonical(field, String(rawValue)) };
      })
      .filter(x => x.canonical !== null);

    if (valid.length === 0) return null;

    // Sort by precedence desc, then stampedAt desc
    valid.sort((a, b) => {
      const pDiff = precedenceOf(b.row.source) - precedenceOf(a.row.source);
      if (pDiff !== 0) return pDiff;
      return new Date(b.row.stampedAt).getTime() - new Date(a.row.stampedAt).getTime();
    });

    const winner = valid[0];

    // NOTE: winner.row.source may be an internal granular source (e.g. 'agent:research')
    // that is not a canonical IngestionSource. We preserve the raw source string in
    // provenance for backward compatibility with consumers that expect it.
    // The ProvenanceStamp type expects IngestionSource, so we cast through unknown
    // to avoid a compilation break while keeping runtime behavior identical.
    return {
      value: winner.canonical,
      provenance: {
        ingestionSource: winner.row.source as unknown as ProvenanceStamp['ingestionSource'],
        userId: winner.row.userId,
        agentRunId: winner.row.agentRunId ?? null,
        stampedAt: winner.row.stampedAt,
      },
      confidence: sourceClassToConfidence(winner.row.source),
      overriddenBy: classifyOverrideSource(winner.row.source),
    };
  };

  return {
    dealId,
    dealType: resolve('dealType', buckets['dealType']) as ClassificationValue<DealType> | null,
    strategy: resolve('strategy', buckets['strategy']) as ClassificationValue<StrategyType> | null,
    assetClass: resolve('assetClass', buckets['assetClass']) as ClassificationValue<AssetClass> | null,
    dealMode: resolve('dealMode', buckets['dealMode']) as ClassificationValue<DealMode> | null,
    projectIntent: resolve('projectIntent', buckets['projectIntent']) as ClassificationValue<ProjectIntent> | null,
    viewMode: resolve('viewMode', buckets['viewMode']) as ClassificationValue<ViewMode> | null,
    assembledAt: new Date().toISOString(),
  };
}
