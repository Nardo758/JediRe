/**
 * ModelPreferenceService
 *
 * Per-surface LLM model resolution. A "surface" is any place in the
 * platform that calls an LLM and which a user might want to control
 * independently (e.g. cashflow agent, CFO skill, OM parser pipeline).
 *
 * Resolution order:
 *   1. user_model_preferences[user, surface_type, surface_id]   -> winner
 *   2. global user_credit_balances.llm_preference (cheap/fast/balanced/powerful)
 *   3. tier default (passed in by caller; for agents that's MODEL_ROUTING)
 *
 * Tier-gated models (Opus) are still enforced — if a user pins Opus to
 * a surface but their tier doesn't allow it, the resolver falls through
 * to the next layer.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { SubscriptionTier } from '../../types/dealContext';

export type SurfaceType = 'agent' | 'skill' | 'pipeline';

export interface SurfaceDefinition {
  type: SurfaceType;
  id: string;
  /** Human label shown in settings UI. */
  label: string;
  /** One-line description shown in settings UI. */
  description: string;
  /**
   * Optional: warn the user when they pick a particular model family
   * for this surface (rendered as a soft inline message in the UI).
   * Returning null means "no warning".
   */
  modelWarning?: (model: string) => string | null;
}

// ── Models known to the platform ────────────────────────────────

export interface ModelDefinition {
  id: string;
  family: 'claude' | 'deepseek';
  label: string;
  /** Tiers that may select this model. Empty = available to everyone. */
  requiredTiers?: SubscriptionTier[];
  /** Short description shown in the picker. */
  description: string;
}

export const KNOWN_MODELS: ModelDefinition[] = [
  {
    id: 'deepseek-chat',
    family: 'deepseek',
    label: 'DeepSeek Chat',
    description: 'Ultra-cheap; great for plumbing, codegen, simple chat',
  },
  {
    id: 'deepseek-reasoner',
    family: 'deepseek',
    label: 'DeepSeek Reasoner',
    description: 'Cheap reasoning model; slower than Chat, ~2x cost',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    family: 'claude',
    label: 'Claude Haiku',
    description: 'Fast Claude; quick lookups, low credit cost',
  },
  {
    id: 'claude-sonnet-4-20250514',
    family: 'claude',
    label: 'Claude Sonnet',
    description: 'Balanced Claude; the workhorse',
  },
  {
    id: 'claude-opus-4-20250514',
    family: 'claude',
    label: 'Claude Opus',
    description: 'Top-tier reasoning; 2x credits',
    requiredTiers: ['principal', 'institutional'],
  },
];

export function getModelFamily(model: string): 'claude' | 'deepseek' | 'unknown' {
  if (model.startsWith('deepseek')) return 'deepseek';
  if (model.startsWith('claude')) return 'claude';
  return 'unknown';
}

// ── Surface registry ────────────────────────────────────────────
// Curated whitelist of surfaces a user can pin. Adding a new surface
// is just a matter of appending to this list and reading the resolver
// from the call site.

const FINANCIAL_RISK_WARNING = (model: string) =>
  getModelFamily(model) === 'deepseek'
    ? 'DeepSeek may produce less accurate financial projections. We recommend Claude Sonnet or Opus for investment-grade underwriting.'
    : null;

export const SURFACES: SurfaceDefinition[] = [
  // Agents
  { type: 'agent', id: 'research',    label: 'Research Agent',    description: 'Market research, data assembly, single-source lookups' },
  { type: 'agent', id: 'zoning',      label: 'Zoning Agent',      description: 'Zoning analysis, entitlement risk, land-use classification' },
  { type: 'agent', id: 'supply',      label: 'Supply Agent',      description: 'Pipeline checks, permit tracking, submarket delivery analysis' },
  { type: 'agent', id: 'cashflow',    label: 'Cashflow Agent',    description: 'Underwriting, pro forma, sensitivity analysis', modelWarning: FINANCIAL_RISK_WARNING },
  { type: 'agent', id: 'coordinator', label: 'Coordinator',       description: 'Routes chat questions, synthesizes multi-agent answers' },
  { type: 'agent', id: 'commentary',  label: 'Commentary Agent',  description: 'Narrative generation, signal/strategy orchestration' },

  // Skills (curated families)
  { type: 'skill', id: 'cfo',                  label: 'CFO Skill',             description: 'Portfolio financial analysis & advisory', modelWarning: FINANCIAL_RISK_WARNING },
  { type: 'skill', id: 'debt_advisor',         label: 'Debt Advisor',          description: 'Capital stack, debt structuring guidance' },
  { type: 'skill', id: 'tax_advisor',          label: 'Tax Advisor',           description: 'Tax implications, after-tax return analysis', modelWarning: FINANCIAL_RISK_WARNING },
  { type: 'skill', id: 'market_expert',        label: 'Market Expert',         description: 'Market trends, comp analysis, signals' },
  { type: 'skill', id: 'document_extraction',  label: 'Document Extraction',   description: 'Pulling structured data out of uploaded documents' },

  // Pipelines (non-agent LLM call sites)
  { type: 'pipeline', id: 'om_parsing',                 label: 'OM Parser',                  description: 'Extracts deal data from offering memorandums' },
  { type: 'pipeline', id: 'email_intake_classification', label: 'Email Intake Classifier',   description: 'Decides whether an inbound email is a deal' },
  { type: 'pipeline', id: 'document_classification',    label: 'Document Classifier',         description: 'Identifies T12 / rent roll / tax bill before parsing' },
];

export function getSurface(type: SurfaceType, id: string): SurfaceDefinition | undefined {
  return SURFACES.find(s => s.type === type && s.id === id);
}

// ── Resolution ──────────────────────────────────────────────────

interface ResolveArgs {
  userId: string | null | undefined;
  surfaceType: SurfaceType;
  surfaceId: string;
  /** Tier-default fallback (e.g. MODEL_ROUTING[tier][agentId] for agents). */
  defaultModel: string;
  /** User's resolved tier, used to enforce per-model tier locks. */
  tier: SubscriptionTier;
}

const PREFERENCE_TO_MODEL: Record<string, string> = {
  cheap: 'deepseek-chat',
  fast: 'claude-haiku-4-5-20251001',
  balanced: 'claude-sonnet-4-20250514',
  powerful: 'claude-opus-4-20250514',
};

function modelAllowedForTier(model: string, tier: SubscriptionTier): boolean {
  const def = KNOWN_MODELS.find(m => m.id === model);
  if (!def?.requiredTiers || def.requiredTiers.length === 0) return true;
  return def.requiredTiers.includes(tier);
}

class ModelPreferenceService {
  /**
   * Resolve the model to use for a given (user, surface) pair.
   * Never throws — falls back to defaultModel on any error.
   */
  async resolveModel(args: ResolveArgs): Promise<string> {
    const { userId, surfaceType, surfaceId, defaultModel, tier } = args;

    if (!userId) return defaultModel;

    // 1. Per-surface override
    try {
      const r = await query(
        `SELECT model FROM user_model_preferences
         WHERE user_id = $1 AND surface_type = $2 AND surface_id = $3`,
        [userId, surfaceType, surfaceId]
      );
      if (r.rows.length > 0) {
        const pinned = r.rows[0].model as string;
        if (modelAllowedForTier(pinned, tier)) return pinned;
        logger.warn('ModelPreferenceService: pinned model gated by tier, falling back', {
          userId, surfaceType, surfaceId, pinned, tier,
        });
      }
    } catch (err) {
      logger.warn('ModelPreferenceService: per-surface lookup failed', { err });
    }

    // 2. Global preference
    try {
      const r = await query(
        `SELECT llm_preference FROM user_credit_balances WHERE user_id = $1`,
        [userId]
      );
      const pref = r.rows[0]?.llm_preference as string | undefined;
      if (pref && pref !== 'auto' && PREFERENCE_TO_MODEL[pref]) {
        const candidate = PREFERENCE_TO_MODEL[pref];
        if (modelAllowedForTier(candidate, tier)) return candidate;
      }
    } catch (err) {
      logger.warn('ModelPreferenceService: global preference lookup failed', { err });
    }

    // 3. Tier default
    return defaultModel;
  }

  async getAllForUser(userId: string): Promise<Array<{ surface_type: string; surface_id: string; model: string }>> {
    const r = await query(
      `SELECT surface_type, surface_id, model
       FROM user_model_preferences
       WHERE user_id = $1`,
      [userId]
    );
    return r.rows;
  }

  async setPreference(
    userId: string,
    surfaceType: SurfaceType,
    surfaceId: string,
    model: string | null
  ): Promise<void> {
    if (!getSurface(surfaceType, surfaceId)) {
      throw new Error(`Unknown surface: ${surfaceType}:${surfaceId}`);
    }
    if (model === null) {
      await query(
        `DELETE FROM user_model_preferences
         WHERE user_id = $1 AND surface_type = $2 AND surface_id = $3`,
        [userId, surfaceType, surfaceId]
      );
      return;
    }
    if (!KNOWN_MODELS.some(m => m.id === model)) {
      throw new Error(`Unknown model: ${model}`);
    }
    await query(
      `INSERT INTO user_model_preferences (user_id, surface_type, surface_id, model)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, surface_type, surface_id)
       DO UPDATE SET model = EXCLUDED.model, updated_at = NOW()`,
      [userId, surfaceType, surfaceId, model]
    );
  }
}

export const modelPreferenceService = new ModelPreferenceService();
