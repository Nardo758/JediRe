import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';

const router = Router();

const PREFERENCE_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Tier-based default model selection', model: null },
  { value: 'fast', label: 'Fast', description: 'Claude Haiku — quick responses, lower credit cost', model: 'claude-haiku-4-5-20251001' },
  { value: 'balanced', label: 'Balanced', description: 'Claude Sonnet — best balance of speed and quality', model: 'claude-sonnet-4-20250514' },
  { value: 'powerful', label: 'Powerful', description: 'Claude Opus — highest quality, 2x credit cost', model: 'claude-opus-4-20250514', requiredTier: ['principal', 'institutional'] },
];

const VALID_PREFERENCES = ['auto', 'fast', 'balanced', 'powerful'];

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT subscription_tier, llm_preference FROM user_credit_balances WHERE user_id = $1`,
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

    const result = await query(
      `SELECT subscription_tier FROM user_credit_balances WHERE user_id = $1`,
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

export default router;
