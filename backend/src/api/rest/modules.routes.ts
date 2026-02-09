/**
 * Modules API Routes
 * User module settings and module marketplace
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import db from '../../database/connection';

const router = Router();

/**
 * GET /api/v1/modules
 * Get all modules with user settings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    // Get all module definitions
    const modules = await db.query(`
      SELECT 
        slug,
        name,
        category,
        description,
        price_monthly,
        is_free,
        bundles,
        icon,
        enhances,
        sort_order
      FROM module_definitions
      ORDER BY category, sort_order
    `);

    // Get user's module settings
    const settings = await db.query(`
      SELECT 
        module_slug,
        enabled,
        subscribed,
        bundle_id,
        activated_at
      FROM user_module_settings
      WHERE user_id = $1
    `, [userId]);

    // Create settings map
    const settingsMap = new Map();
    settings.rows.forEach((s: any) => {
      settingsMap.set(s.module_slug, {
        moduleSlug: s.module_slug,
        enabled: s.enabled,
        subscribed: s.subscribed,
        bundleId: s.bundle_id,
        activatedAt: s.activated_at,
      });
    });

    // Get user's bundle (from first subscribed module)
    const userBundle = settings.rows.find((s: any) => s.subscribed && s.bundle_id)?.bundle_id;

    // Group modules by category
    const categoriesMap = new Map();
    
    modules.rows.forEach((m: any) => {
      const module = {
        slug: m.slug,
        name: m.name,
        category: m.category,
        description: m.description,
        priceMonthly: m.price_monthly / 100, // Convert cents to dollars
        isFree: m.is_free,
        bundles: m.bundles,
        icon: m.icon,
        enhances: m.enhances,
        sortOrder: m.sort_order,
        userSettings: settingsMap.get(m.slug),
      };

      if (!categoriesMap.has(m.category)) {
        categoriesMap.set(m.category, []);
      }
      categoriesMap.get(m.category).push(module);
    });

    // Convert to array of categories
    const categories = Array.from(categoriesMap.entries()).map(
      ([name, modules]) => ({ name, modules }),
    );

    res.json({
      categories,
      userBundle,
    });
  } catch (error) {
    logger.error('[Modules] Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

/**
 * PATCH /api/v1/modules/:slug/toggle
 * Toggle module enabled/disabled
 */
router.patch('/:slug/toggle', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { enabled } = req.body;
    const userId = (req as any).user?.userId;

    // Check if module exists
    const moduleExists = await db.query(
      'SELECT slug FROM module_definitions WHERE slug = $1',
      [slug],
    );

    if (moduleExists.rows.length === 0) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Upsert user module setting
    const now = enabled ? new Date() : null;
    const result = await db.query(`
      INSERT INTO user_module_settings (user_id, module_slug, enabled, activated_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, module_slug)
      DO UPDATE SET
        enabled = $3,
        activated_at = CASE 
          WHEN $3 = true AND user_module_settings.activated_at IS NULL 
          THEN $4 
          ELSE user_module_settings.activated_at 
        END,
        updated_at = NOW()
      RETURNING module_slug, enabled, subscribed, bundle_id, activated_at
    `, [userId, slug, enabled, now]);

    const row = result.rows[0];
    res.json({
      moduleSlug: row.module_slug,
      enabled: row.enabled,
      subscribed: row.subscribed,
      bundleId: row.bundle_id,
      activatedAt: row.activated_at,
    });
  } catch (error) {
    logger.error('[Modules] Error toggling module:', error);
    res.status(500).json({ error: 'Failed to toggle module' });
  }
});

/**
 * GET /api/v1/modules/enabled
 * Get user's enabled modules (for quick checks)
 */
router.get('/enabled', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await db.query(`
      SELECT module_slug
      FROM user_module_settings
      WHERE user_id = $1 AND enabled = true
    `, [userId]);

    const modules = result.rows.map((r: any) => r.module_slug);
    res.json({ modules });
  } catch (error) {
    logger.error('[Modules] Error fetching enabled modules:', error);
    res.status(500).json({ error: 'Failed to fetch enabled modules' });
  }
});

/**
 * POST /api/v1/modules/:slug/purchase
 * Purchase module (initiates Stripe checkout)
 * TODO: Integrate with Stripe
 */
router.post('/:slug/purchase', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).user?.userId;
    
    // TODO: Create Stripe checkout session
    // For now, just return success (development mode)
    logger.info(`[Modules] Purchase request for ${slug} by user ${userId}`);
    
    res.json({
      success: true,
      checkoutUrl: '/settings/billing', // Placeholder
    });
  } catch (error) {
    logger.error('[Modules] Error purchasing module:', error);
    res.status(500).json({ error: 'Failed to initiate purchase' });
  }
});

/**
 * POST /api/v1/modules/:slug/subscribe
 * Subscribe user to module (called by webhook after payment)
 * Internal endpoint, should be protected
 */
router.post('/:slug/subscribe', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { userId, bundleId } = req.body;

    const result = await db.query(`
      INSERT INTO user_module_settings (user_id, module_slug, enabled, subscribed, bundle_id, activated_at)
      VALUES ($1, $2, true, true, $3, NOW())
      ON CONFLICT (user_id, module_slug)
      DO UPDATE SET
        subscribed = true,
        enabled = true,
        bundle_id = $3,
        activated_at = COALESCE(user_module_settings.activated_at, NOW()),
        updated_at = NOW()
      RETURNING module_slug, enabled, subscribed, bundle_id, activated_at
    `, [userId, slug, bundleId]);

    const row = result.rows[0];
    res.json({
      moduleSlug: row.module_slug,
      enabled: row.enabled,
      subscribed: row.subscribed,
      bundleId: row.bundle_id,
      activatedAt: row.activated_at,
    });
  } catch (error) {
    logger.error('[Modules] Error subscribing to module:', error);
    res.status(500).json({ error: 'Failed to subscribe to module' });
  }
});

export default router;
