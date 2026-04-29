/**
 * Agent Fill-In Pass — F9 Pro Forma Tier-2 (Spec §12).
 *
 * Before the proforma is generated, walk template.requiredFields and fill any
 * missing assumption from the data library with INFERRED quality. The result
 * is a partial map of {field -> ProvenancedValue} that the proforma generator
 * merges over the existing assumption envelope.
 *
 * Library lookup is injected so production wires it to the real data-library
 * service while tests use a stub.
 */

import { provenanced, missing, type ProvenancedValue } from '../../types/provenanced-value';
import { stampModelVersion } from './model-versions';

export interface DealContext {
  dealId: string;
  state?: string | null;
  msa?: string | null;
  submarket?: string | null;
  assetClass?: string | null;
  vintageBand?: string | null;
  unitCount?: number | null;
}

export interface TemplateForFill {
  sections: Array<{ id: string; fields: string[]; required?: boolean }>;
}

/** Library hit — value plus the lookup-key to record as fillMethod. */
export interface LibraryHit {
  value: number | string | null;
  fillMethod: string;       // e.g. "regional_avg_class_b_2024"
  confidence?: number;      // 0-1 (default 0.5 per spec)
}

export type LibraryResolver = (
  field: string,
  ctx: DealContext
) => Promise<LibraryHit | null>;

export interface AgentFillInInput {
  context: DealContext;
  template: TemplateForFill;
  /** Existing assumption map. Keys missing OR with null/undefined value are filled. */
  existing: Record<string, ProvenancedValue<unknown> | null | undefined>;
  resolver: LibraryResolver;
}

export interface AgentFillInResult {
  filledCount: number;
  skippedCount: number;
  defaultedCount: number;
  fields: Record<string, ProvenancedValue<unknown>>;
}

/**
 * Walk requiredFields; for each missing field, attempt a library lookup. On
 * hit → INFERRED at the resolver-supplied confidence (default 0.5). On miss →
 * explicit DEFAULT placeholder so the caller never sees an undefined cell.
 */
export async function agentFillIn(input: AgentFillInInput): Promise<AgentFillInResult> {
  const { context, template, existing, resolver } = input;
  const out: Record<string, ProvenancedValue<unknown>> = {};
  let filledCount = 0;
  let skippedCount = 0;
  let defaultedCount = 0;

  // De-dup field list across sections.
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const s of template.sections ?? []) {
    for (const f of s.fields ?? []) {
      if (!seen.has(f)) { seen.add(f); fields.push(f); }
    }
  }

  for (const field of fields) {
    const present = existing[field];
    if (present && present.value !== null && present.value !== undefined) {
      skippedCount++;
      continue;
    }

    const hit = await resolver(field, context);
    if (hit && hit.value !== null && hit.value !== undefined) {
      const pv = provenanced(
        hit.value as unknown,
        'platform',
        clamp01(hit.confidence ?? 0.5),
        'comp_set',
        `library hit: ${hit.fillMethod}`
      );
      pv.fillMethod = hit.fillMethod;
      pv.dataQuality = 'INFERRED';
      stampModelVersion(pv, 'agent_fill_in');
      out[field] = pv;
      filledCount++;
    } else {
      const pv = missing(`required by template; no library comp for ${field}`);
      pv.dataQuality = 'DEFAULT';
      stampModelVersion(pv, 'agent_fill_in');
      out[field] = pv;
      defaultedCount++;
    }
  }

  return { filledCount, skippedCount, defaultedCount, fields: out };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}
