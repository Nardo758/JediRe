import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import {
  DealCapsule,
} from '../../models/deal-capsule-updated';

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

      if (!user_id) {
        return res.status(400).json({ error: 'Missing required parameter: user_id' });
      }

      let query = `
        SELECT * FROM capsule_summary 
        WHERE user_id = $1
      `;
      const params: any[] = [user_id];
      let paramIndex = 2;

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (search) {
        query += ` AND (property_address ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await pool.query(query, params);

      let countQuery = `SELECT COUNT(*) FROM deal_capsules WHERE user_id = $1`;
      const countParams: any[] = [user_id];
      let countParamIndex = 2;

      if (status) {
        countQuery += ` AND status = $${countParamIndex}`;
        countParams.push(status);
        countParamIndex++;
      }

      if (search) {
        countQuery += ` AND (property_address ILIKE $${countParamIndex})`;
        countParams.push(`%${search}%`);
      }

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
   * GET /api/capsules/:id/activity
   * Get activity log for a capsule
   */
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

  return router;
}
