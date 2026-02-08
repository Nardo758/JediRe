/**
 * Map Layers API
 * Provides data sources for map layer rendering
 */

import { Router, Request, Response } from 'express';
import { query } from '../../database/connection';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/layers/news-intelligence
 * Returns news event locations for map layer
 */
router.get('/news-intelligence', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        id,
        title,
        category,
        impact_level,
        confidence,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        created_at
      FROM news_events
      WHERE location IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    const locations = result.rows.map(row => ({
      id: row.id,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      title: row.title,
      category: row.category,
      impactLevel: row.impact_level,
      confidence: row.confidence,
      popupHTML: `
        <div class="p-3 min-w-[200px]">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xl">📰</span>
            <h4 class="font-bold text-gray-900">${row.title}</h4>
          </div>
          <div class="space-y-1 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-gray-600">Category:</span>
              <span class="font-medium">${row.category}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-600">Impact:</span>
              <span class="font-medium ${
                row.impact_level === 'high' ? 'text-red-600' :
                row.impact_level === 'medium' ? 'text-yellow-600' :
                'text-green-600'
              }">${row.impact_level}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-600">Confidence:</span>
              <span class="font-medium">${Math.round(row.confidence * 100)}%</span>
            </div>
          </div>
        </div>
      `
    }));
    
    logger.info(`[Layers] News Intelligence: ${locations.length} events`);
    
    res.json({
      success: true,
      layerId: 'news-intelligence',
      count: locations.length,
      locations
    });
    
  } catch (error: any) {
    logger.error('[Layers] Error fetching news intelligence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch news intelligence layer'
    });
  }
});

/**
 * GET /api/v1/layers/assets-owned
 * Returns user's owned properties for map layer
 */
router.get('/assets-owned', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || 1;
    
    const result = await query(`
      SELECT 
        id,
        name,
        address,
        property_type,
        units,
        occupancy,
        avg_rent,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng
      FROM properties
      WHERE user_id = $1
        AND location IS NOT NULL
      ORDER BY name
    `, [userId]);
    
    const locations = result.rows.map(row => ({
      id: row.id,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      title: row.name,
      address: row.address,
      propertyType: row.property_type,
      units: row.units,
      occupancy: row.occupancy,
      popupHTML: `
        <div class="p-3 min-w-[200px]">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xl">🏢</span>
            <h4 class="font-bold text-gray-900">${row.name}</h4>
          </div>
          <div class="space-y-1 text-sm">
            <p class="text-gray-600">${row.address}</p>
            <div class="flex items-center gap-2">
              <span class="text-gray-600">Type:</span>
              <span class="font-medium">${row.property_type || 'N/A'}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-600">Units:</span>
              <span class="font-medium">${row.units || 0}</span>
            </div>
            ${row.occupancy ? `
              <div class="flex items-center gap-2">
                <span class="text-gray-600">Occupancy:</span>
                <span class="font-medium ${
                  row.occupancy > 90 ? 'text-green-600' :
                  row.occupancy > 80 ? 'text-yellow-600' :
                  'text-red-600'
                }">${row.occupancy}%</span>
              </div>
            ` : ''}
            ${row.avg_rent ? `
              <div class="flex items-center gap-2">
                <span class="text-gray-600">Avg Rent:</span>
                <span class="font-medium">$${row.avg_rent}/mo</span>
              </div>
            ` : ''}
          </div>
        </div>
      `
    }));
    
    logger.info(`[Layers] Assets Owned: ${locations.length} properties for user ${userId}`);
    
    res.json({
      success: true,
      layerId: 'assets-owned',
      count: locations.length,
      locations
    });
    
  } catch (error: any) {
    logger.error('[Layers] Error fetching assets owned:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assets owned layer'
    });
  }
});

/**
 * GET /api/v1/layers/pipeline
 * Returns user's pipeline deals for map layer
 */
router.get('/pipeline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || 1;
    
    const result = await query(`
      SELECT 
        d.id,
        d.name,
        d.address,
        d.tier,
        d.deal_category,
        d.development_type,
        dgc.active_scope,
        ST_Y(ST_Centroid(d.boundary::geometry)) as lat,
        ST_X(ST_Centroid(d.boundary::geometry)) as lng
      FROM deals d
      LEFT JOIN deal_geographic_context dgc ON d.id = dgc.deal_id
      WHERE d.user_id = $1
        AND d.boundary IS NOT NULL
      ORDER BY d.created_at DESC
    `, [userId]);
    
    const locations = result.rows.map(row => ({
      id: row.id,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      title: row.name,
      address: row.address,
      tier: row.tier,
      category: row.deal_category,
      developmentType: row.development_type,
      popupHTML: `
        <div class="p-3 min-w-[200px]">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xl">📊</span>
            <h4 class="font-bold text-gray-900">${row.name}</h4>
          </div>
          <div class="space-y-1 text-sm">
            ${row.address ? `<p class="text-gray-600">${row.address}</p>` : ''}
            <div class="flex items-center gap-2">
              <span class="text-gray-600">Tier:</span>
              <span class="px-2 py-0.5 rounded text-xs font-medium ${
                row.tier === 'basic' ? 'bg-yellow-100 text-yellow-800' :
                row.tier === 'pro' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }">${row.tier}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-600">Category:</span>
              <span class="font-medium">${row.deal_category || 'N/A'}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-600">Type:</span>
              <span class="font-medium">${row.development_type || 'N/A'}</span>
            </div>
          </div>
          <a href="/deals/${row.id}" class="block mt-2 text-xs text-blue-600 hover:text-blue-800">
            View Details →
          </a>
        </div>
      `
    }));
    
    logger.info(`[Layers] Pipeline: ${locations.length} deals for user ${userId}`);
    
    res.json({
      success: true,
      layerId: 'pipeline',
      count: locations.length,
      locations
    });
    
  } catch (error: any) {
    logger.error('[Layers] Error fetching pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pipeline layer'
    });
  }
});

export default router;
