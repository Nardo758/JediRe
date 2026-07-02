import { Router, Request, Response } from 'express';
import { requireAuthOrApiKey, AuthenticatedRequest } from '../../middleware/auth';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';
import {
  modelPreferenceService,
  SURFACES,
  KNOWN_MODELS,
  getModelFamily,
  type SurfaceType,
} from '../../services/ai/modelPreferenceService';
import { jediAI } from '../../services/ai/aiService';

const router = Router();

const PREFERENCE_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Per-surface default (cheap for long tasks, Sonnet for specialized)', model: null },
  { value: 'cheap', label: 'Cheap', description: 'DeepSeek Chat — ultra-low cost, ideal for plumbing/codegen', model: 'deepseek-chat' },
  { value: 'fast', label: 'Fast', description: 'Claude Haiku — quick responses, lower credit cost', model: 'claude-haiku-4-5-20251001' },
  { value: 'balanced', label: 'Balanced', description: 'Claude Sonnet — best balance of speed and quality', model: 'claude-sonnet-4-5' },
  { value: 'powerful', label: 'Powerful', description: 'Claude Opus — highest quality, 2x credit cost', model: 'claude-opus-4-5', requiredTier: ['principal', 'institutional'] },
];

const VALID_PREFERENCES = ['auto', 'cheap', 'fast', 'balanced', 'powerful'];

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    // B3: tier is org-authoritative — read from org_credit_balances via default_org_id.
    const result = await query(
      `SELECT
         COALESCE(
           (SELECT ocb.subscription_tier FROM users uu JOIN org_credit_balances ocb ON ocb.org_id = uu.default_org_id WHERE uu.id = $1),
           'scout'
         ) AS subscription_tier,
         llm_preference
       FROM user_credit_balances WHERE user_id = $1`,
      [userId]
    );

    const tier = result.rows.length > 0 ? result.rows[0].subscription_tier : 'scout';
    const currentPreference = result.rows.length > 0 ? (result.rows[0].llm_preference || 'auto') : 'auto';

    const options = PREFERENCE_OPTIONS.map(opt => ({
      ...opt,
      locked: opt.requiredTier ? !opt.requiredTier.includes(tier) : false,
      lockedReason: opt.requiredTier && !opt.requiredTier.includes(tier)
        ? 'Requires Principal or higher tier'
        : null,
    }));

    res.json({
      success: true,
      data: {
        currentPreference,
        tier,
        options,
      },
    });
  } catch (error: any) {
    console.error('Error fetching AI preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch AI preferences' });
  }
});

router.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { preference } = req.body;

    if (!preference || !VALID_PREFERENCES.includes(preference)) {
      return res.status(400).json({
        success: false,
        error: `Invalid preference. Must be one of: ${VALID_PREFERENCES.join(', ')}`,
      });
    }

    // B3: tier is org-authoritative.
    const result = await query(
      `SELECT COALESCE(
         (SELECT ocb.subscription_tier FROM users uu JOIN org_credit_balances ocb ON ocb.org_id = uu.default_org_id WHERE uu.id = $1),
         'scout'
       ) AS subscription_tier`,
      [userId]
    );

    const tier = result.rows.length > 0 ? result.rows[0].subscription_tier : 'scout';

    if (preference === 'powerful' && !['principal', 'institutional'].includes(tier)) {
      return res.status(403).json({
        success: false,
        error: 'Powerful (Opus) model requires Principal or higher tier',
      });
    }

    if (result.rows.length === 0) {
      await query(
        `INSERT INTO user_credit_balances (user_id, subscription_tier, llm_preference, credits_included_monthly, credits_remaining, credits_used_this_period, period_start, period_end)
         VALUES ($1, 'scout', $2, 100, 100, 0, NOW(), NOW() + INTERVAL '1 month')`,
        [userId, preference]
      );
    } else {
      await query(
        `UPDATE user_credit_balances SET llm_preference = $1, updated_at = NOW() WHERE user_id = $2`,
        [preference, userId]
      );
    }

    res.json({
      success: true,
      data: { preference },
    });
  } catch (error: any) {
    console.error('Error saving AI preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to save AI preferences' });
  }
});

// ── Per-surface routing endpoints ─────────────────────────────────────────────

/**
 * GET /surfaces — list all configurable surfaces, available models for the
 * caller's tier, and any per-surface overrides the user has saved.
 */
router.get('/surfaces', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    // B3: tier is org-authoritative.
    const tierRow = await query(
      `SELECT COALESCE(
         (SELECT ocb.subscription_tier FROM users uu JOIN org_credit_balances ocb ON ocb.org_id = uu.default_org_id WHERE uu.id = $1),
         'scout'
       ) AS subscription_tier`,
      [userId]
    );
    const tier = tierRow.rows[0]?.subscription_tier ?? 'scout';

    const overrides = await modelPreferenceService.getAllForUser(userId);
    const overrideMap = new Map(
      overrides.map(o => [`${o.surface_type}:${o.surface_id}`, o.model])
    );

    const models = KNOWN_MODELS.map(m => ({
      id: m.id,
      label: m.label,
      family: m.family,
      description: m.description,
      locked: !!m.requiredTiers && !m.requiredTiers.includes(tier),
      lockedReason: m.requiredTiers && !m.requiredTiers.includes(tier)
        ? 'Requires Principal or higher tier'
        : null,
    }));

    const surfaces = SURFACES.map(s => {
      const override = overrideMap.get(`${s.type}:${s.id}`) ?? null;
      return {
        type: s.type,
        id: s.id,
        label: s.label,
        description: s.description,
        // What "Auto" resolves to for this surface (registry default).
        // The UI renders this as a hint next to the picker so users know
        // what they get if they don't override.
        defaultModel: s.defaultModel,
        currentModel: override,
        warning: override && s.modelWarning ? s.modelWarning(override) : null,
      };
    });

    res.json({ success: true, data: { tier, models, surfaces } });
  } catch (error: any) {
    console.error('Error fetching surface model preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch surface preferences' });
  }
});

/**
 * PUT /surfaces — set or clear a per-surface model.
 * Body: { surfaceType, surfaceId, model | null }
 * Returns: { warning } if the chosen combination has a soft warning.
 */
router.put('/surfaces', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { surfaceType, surfaceId, model } = req.body as {
      surfaceType: SurfaceType;
      surfaceId: string;
      model: string | null;
    };

    if (!surfaceType || !surfaceId) {
      return res.status(400).json({ success: false, error: 'surfaceType and surfaceId required' });
    }

    const surface = SURFACES.find(s => s.type === surfaceType && s.id === surfaceId);
    if (!surface) {
      return res.status(400).json({ success: false, error: `Unknown surface ${surfaceType}:${surfaceId}` });
    }

    if (model !== null) {
      const modelDef = KNOWN_MODELS.find(m => m.id === model);
      if (!modelDef) {
        return res.status(400).json({ success: false, error: `Unknown model ${model}` });
      }
      // Tier gate — B3: org-authoritative tier.
      const tierRow = await query(
        `SELECT COALESCE(
           (SELECT ocb.subscription_tier FROM users uu JOIN org_credit_balances ocb ON ocb.org_id = uu.default_org_id WHERE uu.id = $1),
           'scout'
         ) AS subscription_tier`,
        [userId]
      );
      const tier = tierRow.rows[0]?.subscription_tier ?? 'scout';
      if (modelDef.requiredTiers && !modelDef.requiredTiers.includes(tier)) {
        return res.status(403).json({
          success: false,
          error: `${modelDef.label} requires Principal or higher tier`,
        });
      }
    }

    await modelPreferenceService.setPreference(userId, surfaceType, surfaceId, model);

    const warning = model && surface.modelWarning ? surface.modelWarning(model) : null;
    res.json({ success: true, data: { surfaceType, surfaceId, model, warning } });
  } catch (error: any) {
    console.error('Error saving surface model preference:', error);
    res.status(500).json({ success: false, error: 'Failed to save surface preference' });
  }
});

/**
 * POST /surfaces/test — small "are you alive" round-trip against a candidate
 * model so the user can sanity-check a choice before pinning it.
 * Body: { model }
 */
router.post('/surfaces/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { model } = req.body as { model: string };
    if (!model) return res.status(400).json({ success: false, error: 'model required' });

    const modelDef = KNOWN_MODELS.find(m => m.id === model);
    if (!modelDef) return res.status(400).json({ success: false, error: `Unknown model ${model}` });

    // Tier gate: don't let lower-tier users burn platform $$ test-driving Opus.
    // B3: tier is org-authoritative.
    const tierRow = await query(
      `SELECT COALESCE(
         (SELECT ocb.subscription_tier FROM users uu JOIN org_credit_balances ocb ON ocb.org_id = uu.default_org_id WHERE uu.id = $1),
         'scout'
       ) AS subscription_tier`,
      [userId]
    );
    const tier = tierRow.rows[0]?.subscription_tier ?? 'scout';
    if (modelDef.requiredTiers && !modelDef.requiredTiers.includes(tier)) {
      return res.status(403).json({
        success: false,
        error: `${modelDef.label} requires Principal or higher tier`,
      });
    }

    const result = await jediAI.testModel(
      model,
      `Say "Hello from ${modelDef.label}" and nothing else.`
    );

    res.json({
      success: true,
      data: {
        model,
        family: getModelFamily(model),
        latencyMs: result.latencyMs,
        reply: result.text,
        usage: result.usage,
      },
    });
  } catch (error: any) {
    console.error('Model test failed:', error);
    res.status(500).json({ success: false, error: error?.message || 'Model test failed' });
  }
});

// ── Reseed Agent Prompts ────────────────────────────────────────────────────
// Triggers re-seeding of all agent prompts from their TypeScript source files.
// Useful after prompt changes without restarting the whole server.
router.post('/reseed-prompts', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { seedAllAgentPrompts } = await import('../../agents/seeds/index');
    await seedAllAgentPrompts();
    res.json({ success: true, message: 'All agent prompts re-seeded successfully' });
  } catch (error: any) {
    console.error('Reseed failed:', error);
    res.status(500).json({ success: false, error: error?.message || 'Reseed failed' });
  }
});

export default router;
