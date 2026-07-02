import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';

const router = Router();

const ATTRIBUTION_ELIGIBLE_TIERS = ['principal', 'institutional'];

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT ubs.company_name, ubs.logo_url, ubs.show_attribution,
              COALESCE((SELECT ocb.subscription_tier FROM org_credit_balances ocb WHERE ocb.org_id = u.default_org_id), 'scout') AS tier
       FROM users u
       LEFT JOIN user_branding_settings ubs ON ubs.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    const row = result.rows[0];
    const tier: string = row?.tier ?? 'free';
    const canRemoveAttribution = ATTRIBUTION_ELIGIBLE_TIERS.includes(tier);

    res.json({
      success: true,
      data: {
        company_name: row?.company_name ?? null,
        logo_url: row?.logo_url ?? null,
        show_attribution: row?.show_attribution ?? true,
        can_remove_attribution: canRemoveAttribution,
        tier,
      },
    });
  } catch (error: any) {
    console.error('Error fetching branding settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch branding settings' });
  }
});

router.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { company_name, logo_url, show_attribution } = req.body;

    const tierResult = await query(
      `SELECT COALESCE((SELECT ocb.subscription_tier FROM org_credit_balances ocb WHERE ocb.org_id = u.default_org_id), 'scout') AS tier
       FROM users u
       WHERE u.id = $1`,
      [userId]
    );
    const tier: string = tierResult.rows[0]?.tier ?? 'free';
    const canRemoveAttribution = ATTRIBUTION_ELIGIBLE_TIERS.includes(tier);

    // Only allow overriding attribution for eligible tiers
    const resolvedAttribution: boolean | null = (show_attribution !== undefined && canRemoveAttribution)
      ? Boolean(show_attribution)
      : null;

    const warning = (show_attribution !== undefined && !canRemoveAttribution)
      ? 'Attribution toggle requires Principal or higher tier — setting ignored'
      : null;

    // Resolve company_name / logo_url — explicit null clears the field; undefined is treated as null (full save from UI)
    const resolvedCompanyName = company_name != null ? String(company_name).slice(0, 120) : null;
    const resolvedLogoUrl = logo_url != null ? String(logo_url) : null;

    await query(
      `INSERT INTO user_branding_settings (user_id, company_name, logo_url, show_attribution, updated_at)
       VALUES ($1, $2, $3, COALESCE($4, TRUE), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         company_name      = $2,
         logo_url          = $3,
         show_attribution  = CASE WHEN $4 IS NULL THEN user_branding_settings.show_attribution ELSE $4 END,
         updated_at        = NOW()`,
      [userId, resolvedCompanyName, resolvedLogoUrl, resolvedAttribution]
    );

    const updated = await query(
      `SELECT company_name, logo_url, show_attribution FROM user_branding_settings WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        company_name: updated.rows[0]?.company_name ?? null,
        logo_url: updated.rows[0]?.logo_url ?? null,
        show_attribution: updated.rows[0]?.show_attribution ?? true,
        can_remove_attribution: canRemoveAttribution,
        tier,
        ...(warning ? { warning } : {}),
      },
    });
  } catch (error: any) {
    console.error('Error saving branding settings:', error);
    res.status(500).json({ success: false, error: 'Failed to save branding settings' });
  }
});

export default router;
