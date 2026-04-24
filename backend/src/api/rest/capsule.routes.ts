import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import {
  DealCapsule,
} from '../../models/deal-capsule-updated';
import { getReplacementCostServiceV2 } from '../../services/inflation';

export function createCapsuleRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/capsules
   * Create a new deal capsule
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const {
        user_id,
        property_address,
        deal_data,
        platform_intel,
        user_adjustments,
        asset_class,
        status = 'DISCOVER'
      } = req.body as {
        user_id: string;
        property_address: string;
        deal_data: any;
        platform_intel?: any;
        user_adjustments?: any;
        asset_class?: string;
        status?: string;
      };

      if (!user_id || !property_address || !deal_data) {
        return res.status(400).json({ error: 'Missing required fields: user_id, property_address, deal_data' });
      }

      const result = await pool.query(
        `INSERT INTO deal_capsules 
         (user_id, property_address, deal_data, platform_intel, user_adjustments, asset_class, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          user_id,
          property_address,
          deal_data,
          platform_intel || {},
          user_adjustments || {},
          asset_class || null,
          status
        ]
      );

      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, 'created', $3)`,
        [
          result.rows[0].id,
          user_id,
          { message: 'Capsule created', property_address }
        ]
      );

      res.json({
        success: true,
        capsule: result.rows[0],
        message: 'Capsule created successfully'
      });
    } catch (error) {
      console.error('Error creating capsule:', error);
      res.status(500).json({ error: 'Failed to create capsule' });
    }
  });

  /**
   * GET /api/capsules
   * List all capsules for a user (with filters)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { user_id, status, search, limit = 50, offset = 0 } = req.query;

      const isValidUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      const useUserFilter = isValidUuid(user_id);

      let query = `SELECT * FROM capsule_summary`;
      const params: any[] = [];
      let paramIndex = 1;
      const conditions: string[] = [];

      if (useUserFilter) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(user_id);
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }

      if (search) {
        conditions.push(`property_address ILIKE $${paramIndex++}`);
        params.push(`%${search}%`);
      }

      if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await pool.query(query, params);

      let countQuery = `SELECT COUNT(*) FROM deal_capsules`;
      const countParams: any[] = [];
      const countConditions: string[] = [];
      let countParamIndex = 1;

      if (useUserFilter) {
        countConditions.push(`user_id = $${countParamIndex++}`);
        countParams.push(user_id);
      }
      if (status) {
        countConditions.push(`status = $${countParamIndex++}`);
        countParams.push(status);
      }
      if (search) {
        countConditions.push(`property_address ILIKE $${countParamIndex++}`);
        countParams.push(`%${search}%`);
      }
      if (countConditions.length > 0) countQuery += ` WHERE ${countConditions.join(' AND ')}`;

      const countResult = await pool.query(countQuery, countParams);

      res.json({
        success: true,
        capsules: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      console.error('Error listing capsules:', error);
      res.status(500).json({ error: 'Failed to list capsules' });
    }
  });

  /**
   * GET /api/capsules/:id
   * Get a single capsule by ID (with full details)
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'Missing required parameter: user_id' });
      }

      const result = await pool.query(
        `SELECT * FROM deal_capsules 
         WHERE id = $1 AND user_id = $2`,
        [id, user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      const docsResult = await pool.query(
        `SELECT * FROM capsule_documents 
         WHERE capsule_id = $1 
         ORDER BY created_at DESC`,
        [id]
      );

      const activityResult = await pool.query(
        `SELECT * FROM capsule_activity 
         WHERE capsule_id = $1 
         ORDER BY created_at DESC 
         LIMIT 20`,
        [id]
      );

      const sharesResult = await pool.query(
        `SELECT * FROM capsule_shares 
         WHERE capsule_id = $1`,
        [id]
      );

      res.json({
        success: true,
        capsule: result.rows[0],
        documents: docsResult.rows,
        activity: activityResult.rows,
        shares: sharesResult.rows
      });
    } catch (error) {
      console.error('Error fetching capsule:', error);
      res.status(500).json({ error: 'Failed to fetch capsule' });
    }
  });

  /**
   * PUT /api/capsules/:id
   * Update a capsule
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        user_id,
        deal_data,
        platform_intel,
        user_adjustments,
        module_outputs,
        asset_class,
        status
      } = req.body as {
        user_id: string;
        deal_data?: any;
        platform_intel?: any;
        user_adjustments?: any;
        module_outputs?: any;
        asset_class?: string;
        status?: string;
      };

      if (!user_id) {
        return res.status(400).json({ error: 'Missing required field: user_id' });
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (deal_data !== undefined) {
        updates.push(`deal_data = $${paramIndex}`);
        values.push(deal_data);
        paramIndex++;
      }

      if (platform_intel !== undefined) {
        updates.push(`platform_intel = $${paramIndex}`);
        values.push(platform_intel);
        paramIndex++;
      }

      if (user_adjustments !== undefined) {
        updates.push(`user_adjustments = $${paramIndex}`);
        values.push(user_adjustments);
        paramIndex++;
      }

      if (module_outputs !== undefined) {
        updates.push(`module_outputs = $${paramIndex}`);
        values.push(module_outputs);
        paramIndex++;
      }

      if (asset_class !== undefined) {
        updates.push(`asset_class = $${paramIndex}`);
        values.push(asset_class);
        paramIndex++;
      }

      if (status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id, user_id);

      const result = await pool.query(
        `UPDATE deal_capsules 
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, 'updated', $3)`,
        [
          id,
          user_id,
          { updated_fields: Object.keys(req.body).filter(k => k !== 'user_id') }
        ]
      );

      res.json({
        success: true,
        capsule: result.rows[0],
        message: 'Capsule updated successfully'
      });
    } catch (error) {
      console.error('Error updating capsule:', error);
      res.status(500).json({ error: 'Failed to update capsule' });
    }
  });

  /**
   * DELETE /api/capsules/:id
   * Delete a capsule
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'Missing required parameter: user_id' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(`DELETE FROM capsule_activity WHERE capsule_id = $1`, [id]);
        await client.query(`DELETE FROM capsule_shares WHERE capsule_id = $1`, [id]);
        await client.query(`DELETE FROM capsule_documents WHERE capsule_id = $1`, [id]);
        
        const result = await client.query(
          `DELETE FROM deal_capsules 
           WHERE id = $1 AND user_id = $2
           RETURNING id`,
          [id, user_id]
        );

        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Capsule not found' });
        }

        await client.query('COMMIT');

        res.json({
          success: true,
          message: 'Capsule deleted successfully'
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error deleting capsule:', error);
      res.status(500).json({ error: 'Failed to delete capsule' });
    }
  });

  /**
   * POST /api/capsules/:id/documents
   * Upload a document to a capsule
   */
  router.post('/:id/documents', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user_id, file_name, document_type, file_path, file_size_bytes, mime_type, extracted_data } = req.body;

      if (!user_id || !file_name || !file_path) {
        return res.status(400).json({ error: 'Missing required fields: user_id, file_name, file_path' });
      }

      const capsuleResult = await pool.query(
        `SELECT id FROM deal_capsules WHERE id = $1 AND user_id = $2`,
        [id, user_id]
      );

      if (capsuleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      const result = await pool.query(
        `INSERT INTO capsule_documents 
         (capsule_id, file_name, document_type, file_path, file_size_bytes, mime_type, uploaded_by, extracted_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, file_name, document_type || null, file_path, file_size_bytes || null, mime_type || null, user_id, extracted_data || {}]
      );

      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, 'document_uploaded', $3)`,
        [id, user_id, { file_name, document_type }]
      );

      res.json({
        success: true,
        document: result.rows[0],
        message: 'Document uploaded successfully'
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });

  /**
   * DELETE /api/capsules/:id/documents/:documentId
   * Delete a document from a capsule
   */
  router.delete('/:id/documents/:documentId', async (req: Request, res: Response) => {
    try {
      const { id, documentId } = req.params;
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'Missing required parameter: user_id' });
      }

      const result = await pool.query(
        `DELETE FROM capsule_documents 
         WHERE id = $1 AND capsule_id = $2 
         AND capsule_id IN (SELECT id FROM deal_capsules WHERE user_id = $3)
         RETURNING file_name`,
        [documentId, id, user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }

      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, 'document_deleted', $3)`,
        [id, user_id, { file_name: result.rows[0].file_name }]
      );

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  /**
   * POST /api/capsules/:id/share
   * Share a capsule with someone
   */
  router.post('/:id/share', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        user_id,
        shared_with,
        permission_tier,
        expires_at
      } = req.body as {
        user_id: string;
        shared_with: string;
        permission_tier: string;
        expires_at?: string;
      };

      if (!user_id || !shared_with || !permission_tier) {
        return res.status(400).json({ error: 'Missing required fields: user_id, shared_with, permission_tier' });
      }

      const capsuleResult = await pool.query(
        `SELECT id FROM deal_capsules WHERE id = $1 AND user_id = $2`,
        [id, user_id]
      );

      if (capsuleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      const shareToken = `share_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const result = await pool.query(
        `INSERT INTO capsule_shares 
         (capsule_id, shared_by, shared_with, permission_tier, share_token, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, user_id, shared_with, permission_tier, shareToken, expires_at || null]
      );

      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, 'shared', $3)`,
        [id, user_id, { shared_with, permission_tier }]
      );

      res.json({
        success: true,
        share: result.rows[0],
        share_url: `/capsules/${id}?token=${shareToken}`,
        message: 'Capsule shared successfully'
      });
    } catch (error) {
      console.error('Error sharing capsule:', error);
      res.status(500).json({ error: 'Failed to share capsule' });
    }
  });

  /**
   * DELETE /api/capsules/:id/share/:shareId
   * Revoke a share
   */
  router.delete('/:id/share/:shareId', async (req: Request, res: Response) => {
    try {
      const { id, shareId } = req.params;
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'Missing required parameter: user_id' });
      }

      const result = await pool.query(
        `DELETE FROM capsule_shares 
         WHERE id = $1 AND capsule_id = $2 
         AND capsule_id IN (SELECT id FROM deal_capsules WHERE user_id = $3)
         RETURNING shared_with`,
        [shareId, id, user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Share not found' });
      }

      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, 'share_revoked', $3)`,
        [id, user_id, { shared_with: result.rows[0].shared_with }]
      );

      res.json({
        success: true,
        message: 'Share revoked successfully'
      });
    } catch (error) {
      console.error('Error revoking share:', error);
      res.status(500).json({ error: 'Failed to revoke share' });
    }
  });

  /**
   * POST /api/capsules/:id/activity
   * Push an intel item to a capsule's activity feed
   */
  router.post('/:id/activity', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { activity_type, activity_data } = req.body;

      if (!activity_type) {
        return res.status(400).json({ error: 'Missing required parameter: activity_type' });
      }

      const capsuleResult = await pool.query(
        `SELECT id, user_id FROM deal_capsules WHERE id = $1`,
        [id]
      );

      if (capsuleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      const ownerUserId = capsuleResult.rows[0].user_id;

      const result = await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, ownerUserId, activity_type, JSON.stringify(activity_data ?? {})]
      );

      res.status(201).json({ success: true, activity: result.rows[0] });
    } catch (error) {
      console.error('Error logging capsule activity:', error);
      res.status(500).json({ error: 'Failed to log capsule activity' });
    }
  });

  router.get('/:id/activity', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user_id, limit = 50, offset = 0 } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'Missing required parameter: user_id' });
      }

      const capsuleResult = await pool.query(
        `SELECT id FROM deal_capsules WHERE id = $1 AND user_id = $2`,
        [id, user_id]
      );

      if (capsuleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      const result = await pool.query(
        `SELECT * FROM capsule_activity 
         WHERE capsule_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [id, parseInt(limit as string), parseInt(offset as string)]
      );

      res.json({
        success: true,
        activity: result.rows
      });
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  });

  // ============================================================================
  // REPLACEMENT COST
  // ============================================================================

  /**
   * GET /api/capsules/:id/replacement-cost
   * Get replacement cost analysis for a deal capsule
   */
  router.get('/:id/replacement-cost', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'Missing required parameter: user_id' });
      }

      // Get capsule with deal data
      const capsuleResult = await pool.query(
        `SELECT id, deal_data, platform_intel, property_address 
         FROM deal_capsules 
         WHERE id = $1 AND user_id = $2`,
        [id, user_id]
      );

      if (capsuleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      const capsule = capsuleResult.rows[0];
      const dealData = capsule.deal_data || {};

      // Extract property info from deal_data
      const units = dealData.units || dealData.unit_count || 0;
      const totalSF = dealData.sf || dealData.total_sf || dealData.square_footage || (units * 900);
      const city = dealData.city || '';
      const state = dealData.state || '';
      const county = dealData.county || '';
      const assetClass = dealData.asset_class || 'B';
      const yearBuilt = dealData.year_built || dealData.vintage || null;
      const stories = dealData.stories || null;
      const askingPrice = dealData.asking_price || dealData.purchase_price || null;

      if (!units || !city || !state) {
        return res.status(400).json({ 
          error: 'Insufficient deal data for replacement cost estimate',
          required: ['units', 'city', 'state'],
          found: { units, city, state }
        });
      }

      // Get replacement cost estimate
      const replacementService = getReplacementCostServiceV2(pool);
      const estimate = await replacementService.estimateReplacementCost({
        units,
        totalSF,
        city,
        state,
        county,
        assetClass,
        yearBuilt,
        stories,
        userId: user_id as string
      });

      // Build comparison if we have asking price
      let comparison = null;
      if (askingPrice) {
        const ratio = askingPrice / estimate.totalCost.value;
        const discount = (1 - ratio) * 100;
        
        comparison = {
          askingPrice,
          replacementCost: estimate.totalCost.value,
          ratio: Math.round(ratio * 100) / 100,
          discountToReplacement: Math.round(discount * 10) / 10,
          signal: discount > 15 ? 'strong_buy' : 
                  discount > 5 ? 'buy' : 
                  discount > -5 ? 'fair_value' : 
                  discount > -15 ? 'premium' : 'significant_premium',
          interpretation: discount > 15 
            ? `Buying at ${discount.toFixed(0)}% below replacement cost - strong value signal`
            : discount > 5
            ? `Buying at ${discount.toFixed(0)}% below replacement cost`
            : discount > -5
            ? 'Near replacement cost - fair market value'
            : `Paying ${Math.abs(discount).toFixed(0)}% premium to replacement cost`
        };
      }

      // Store in platform_intel for future reference
      await pool.query(
        `UPDATE deal_capsules 
         SET platform_intel = platform_intel || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            replacement_cost: {
              estimate: estimate.totalCost.value,
              costPerUnit: estimate.costPerUnit.value,
              costPerSF: estimate.costPerSF.value,
              confidence: estimate.confidenceLevel,
              source: estimate.costPerSF.source,
              comparison,
              computedAt: new Date().toISOString()
            }
          }),
          id
        ]
      );

      // Log activity
      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, 'replacement_cost_computed', $3)`,
        [
          id,
          user_id,
          {
            totalCost: estimate.totalCost.value,
            costPerUnit: estimate.costPerUnit.value,
            confidence: estimate.confidenceLevel,
            comparison: comparison?.signal
          }
        ]
      );

      res.json({
        success: true,
        capsuleId: id,
        propertyAddress: capsule.property_address,
        
        // Summary
        summary: {
          totalReplacementCost: estimate.totalCost.value,
          costPerUnit: estimate.costPerUnit.value,
          costPerSF: estimate.costPerSF.value,
          confidence: estimate.confidenceLevel,
          methodology: estimate.methodology
        },
        
        // Full LayeredValue with provenance
        estimate,
        
        // Comparison to asking price
        comparison,
        
        // Input used
        input: {
          units,
          totalSF,
          city,
          state,
          county,
          assetClass,
          yearBuilt,
          stories
        }
      });
    } catch (error) {
      console.error('Error computing replacement cost:', error);
      res.status(500).json({ error: 'Failed to compute replacement cost' });
    }
  });

  /**
   * POST /api/capsules/:id/replacement-cost/override
   * Override replacement cost with user's own estimate
   */
  router.post('/:id/replacement-cost/override', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user_id, costPerSF, totalCost, source, notes } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'Missing required field: user_id' });
      }

      if (!costPerSF && !totalCost) {
        return res.status(400).json({ error: 'Provide either costPerSF or totalCost' });
      }

      // Verify capsule exists
      const capsuleResult = await pool.query(
        `SELECT id, deal_data FROM deal_capsules WHERE id = $1 AND user_id = $2`,
        [id, user_id]
      );

      if (capsuleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      const dealData = capsuleResult.rows[0].deal_data || {};
      const units = dealData.units || dealData.unit_count || 1;
      const totalSF = dealData.sf || dealData.total_sf || (units * 900);

      // Calculate both values
      const finalCostPerSF = costPerSF || (totalCost / totalSF);
      const finalTotalCost = totalCost || (costPerSF * totalSF);
      const finalCostPerUnit = finalTotalCost / units;

      // Store override in platform_intel
      await pool.query(
        `UPDATE deal_capsules 
         SET platform_intel = platform_intel || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            replacement_cost: {
              estimate: finalTotalCost,
              costPerUnit: finalCostPerUnit,
              costPerSF: finalCostPerSF,
              confidence: 'high',
              source: 'override',
              override: {
                source: source || 'User estimate',
                notes,
                setAt: new Date().toISOString(),
                setBy: user_id
              },
              computedAt: new Date().toISOString()
            }
          }),
          id
        ]
      );

      // Log activity
      await pool.query(
        `INSERT INTO capsule_activity (capsule_id, user_id, activity_type, activity_data)
         VALUES ($1, $2, 'replacement_cost_override', $3)`,
        [
          id,
          user_id,
          { totalCost: finalTotalCost, costPerSF: finalCostPerSF, source: source || 'User estimate' }
        ]
      );

      res.json({
        success: true,
        message: 'Replacement cost override saved',
        override: {
          totalCost: Math.round(finalTotalCost),
          costPerUnit: Math.round(finalCostPerUnit),
          costPerSF: Math.round(finalCostPerSF * 100) / 100,
          source: source || 'User estimate',
          notes
        }
      });
    } catch (error) {
      console.error('Error saving replacement cost override:', error);
      res.status(500).json({ error: 'Failed to save override' });
    }
  });

  /**
   * POST /api/capsules/:id/insurance-check
   * Validate insurance coverage against replacement cost
   */
  router.post('/:id/insurance-check', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user_id, currentCoverage } = req.body;

      if (!user_id || !currentCoverage) {
        return res.status(400).json({ error: 'Missing required fields: user_id, currentCoverage' });
      }

      // Get capsule with replacement cost
      const capsuleResult = await pool.query(
        `SELECT id, deal_data, platform_intel 
         FROM deal_capsules 
         WHERE id = $1 AND user_id = $2`,
        [id, user_id]
      );

      if (capsuleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Capsule not found' });
      }

      const capsule = capsuleResult.rows[0];
      const platformIntel = capsule.platform_intel || {};
      
      let replacementCost = platformIntel.replacement_cost?.estimate;

      // If no replacement cost, compute it
      if (!replacementCost) {
        const dealData = capsule.deal_data || {};
        const units = dealData.units || dealData.unit_count || 0;
        const totalSF = dealData.sf || dealData.total_sf || (units * 900);
        const city = dealData.city || '';
        const state = dealData.state || '';
        const county = dealData.county || '';
        const assetClass = dealData.asset_class || 'B';

        if (!units || !city || !state) {
          return res.status(400).json({ 
            error: 'Compute replacement cost first via GET /replacement-cost'
          });
        }

        const service = getReplacementCostServiceV2(pool);
        const estimate = await service.estimateReplacementCost({
          units, totalSF, city, state, county, assetClass
        });
        replacementCost = estimate.totalCost.value;
      }

      // Calculate adequacy
      const gap = replacementCost - currentCoverage;
      const gapPct = (gap / replacementCost) * 100;

      let adequacy: 'adequate' | 'underinsured' | 'overinsured';
      let recommendation: string;

      if (gapPct > 10) {
        adequacy = 'underinsured';
        recommendation = `⚠️ UNDERINSURED by $${(gap / 1000).toFixed(0)}K (${gapPct.toFixed(0)}%). Increase coverage to at least $${(replacementCost / 1000000).toFixed(2)}M.`;
      } else if (gapPct < -15) {
        adequacy = 'overinsured';
        recommendation = `Potentially overinsured by $${(Math.abs(gap) / 1000).toFixed(0)}K. May reduce premiums by adjusting coverage.`;
      } else {
        adequacy = 'adequate';
        recommendation = `Coverage is adequate. Current $${(currentCoverage / 1000000).toFixed(2)}M vs replacement $${(replacementCost / 1000000).toFixed(2)}M.`;
      }

      // Store in platform_intel
      await pool.query(
        `UPDATE deal_capsules 
         SET platform_intel = platform_intel || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            insurance_check: {
              currentCoverage,
              replacementCost,
              gap,
              gapPct: Math.round(gapPct * 10) / 10,
              adequacy,
              recommendation,
              checkedAt: new Date().toISOString()
            }
          }),
          id
        ]
      );

      res.json({
        success: true,
        insuranceCheck: {
          currentCoverage,
          recommendedCoverage: Math.round(replacementCost),
          gap: Math.round(gap),
          gapPct: Math.round(gapPct * 10) / 10,
          adequacy,
          recommendation
        }
      });
    } catch (error) {
      console.error('Error checking insurance:', error);
      res.status(500).json({ error: 'Failed to check insurance coverage' });
    }
  });

  return router;
}
