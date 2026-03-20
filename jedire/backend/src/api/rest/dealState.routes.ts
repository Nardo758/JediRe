/**
 * Deal State Persistence API Routes
 * Handles saving, loading, and versioning of deal development data
 */

import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();
const pool = getPool();

/**
 * GET /api/v1/deals/:dealId/state
 * Load full deal state including all development data
 */
router.get('/:dealId/state', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const client = req.dbClient || pool;
    
    // Verify deal ownership
    const dealCheck = await client.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, userId]
    );
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or access denied'
      });
    }
    
    // Load deal state
    const result = await client.query(`
      SELECT 
        ds.*,
        d.name as deal_name,
        d.address as deal_address
      FROM deals_state ds
      JOIN deals d ON d.id = ds.deal_id
      WHERE ds.deal_id = $1 AND ds.user_id = $2
    `, [dealId, userId]);
    
    if (result.rows.length === 0) {
      // Return empty state if no data exists yet
      return res.json({
        success: true,
        deal: dealCheck.rows[0],
        design_3d: null,
        market_analysis: null,
        competition_data: null,
        supply_data: null,
        due_diligence: null,
        timeline_data: null,
        version: 1,
        last_saved: null,
      });
    }
    
    const row = result.rows[0];
    
    res.json({
      success: true,
      deal: dealCheck.rows[0],
      design_3d: row.design_3d,
      market_analysis: row.market_analysis,
      competition_data: row.competition_data,
      supply_data: row.supply_data,
      due_diligence: row.due_diligence,
      timeline_data: row.timeline_data,
      version: row.version,
      last_saved: row.last_saved,
    });
  } catch (error) {
    console.error('Error loading deal state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load deal state'
    });
  }
});

/**
 * POST /api/v1/deals/:dealId/state
 * Save full deal state (creates or updates)
 */
router.post('/:dealId/state', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const client = req.dbClient || pool;
    
    const {
      design_3d,
      market_analysis,
      competition_data,
      supply_data,
      due_diligence,
      timeline_data,
      version,
    } = req.body;
    
    // Verify deal ownership
    const dealCheck = await client.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, userId]
    );
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or access denied'
      });
    }
    
    // Upsert deal state
    const result = await client.query(`
      INSERT INTO deals_state (
        deal_id,
        user_id,
        design_3d,
        market_analysis,
        competition_data,
        supply_data,
        due_diligence,
        timeline_data,
        version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 1))
      ON CONFLICT (deal_id) 
      DO UPDATE SET
        design_3d = EXCLUDED.design_3d,
        market_analysis = EXCLUDED.market_analysis,
        competition_data = EXCLUDED.competition_data,
        supply_data = EXCLUDED.supply_data,
        due_diligence = EXCLUDED.due_diligence,
        timeline_data = EXCLUDED.timeline_data,
        version = deals_state.version + 1,
        updated_at = NOW()
      RETURNING *
    `, [
      dealId,
      userId,
      design_3d ? JSON.stringify(design_3d) : null,
      market_analysis ? JSON.stringify(market_analysis) : null,
      competition_data ? JSON.stringify(competition_data) : null,
      supply_data ? JSON.stringify(supply_data) : null,
      due_diligence ? JSON.stringify(due_diligence) : null,
      timeline_data ? JSON.stringify(timeline_data) : null,
      version,
    ]);
    
    res.json({
      success: true,
      message: 'Deal state saved successfully',
      version: result.rows[0].version,
      last_saved: result.rows[0].last_saved,
    });
  } catch (error) {
    console.error('Error saving deal state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save deal state'
    });
  }
});

/**
 * PATCH /api/v1/deals/:dealId/state
 * Update partial deal state (only specified fields)
 */
router.patch('/:dealId/state', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const client = req.dbClient || pool;
    
    // Verify deal ownership
    const dealCheck = await client.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, userId]
    );
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or access denied'
      });
    }
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [dealId, userId];
    let paramIndex = 3;
    
    const allowedFields = [
      'design_3d',
      'market_analysis',
      'competition_data',
      'supply_data',
      'due_diligence',
      'timeline_data',
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(JSON.stringify(req.body[field]));
        paramIndex++;
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }
    
    // Add version increment and timestamp
    updates.push('version = version + 1');
    updates.push('updated_at = NOW()');
    
    const query = `
      UPDATE deals_state
      SET ${updates.join(', ')}
      WHERE deal_id = $1 AND user_id = $2
      RETURNING version, last_saved
    `;
    
    const result = await client.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal state not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Deal state updated successfully',
      version: result.rows[0].version,
      last_saved: result.rows[0].last_saved,
    });
  } catch (error) {
    console.error('Error updating deal state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update deal state'
    });
  }
});

/**
 * POST /api/v1/deals/:dealId/snapshots
 * Create a snapshot of current deal state
 */
router.post('/:dealId/snapshots', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const client = req.dbClient || pool;
    
    const { name, description } = req.body;
    
    // Verify deal ownership and get current state
    const stateResult = await client.query(
      'SELECT * FROM deals_state WHERE deal_id = $1 AND user_id = $2',
      [dealId, userId]
    );
    
    if (stateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal state not found'
      });
    }
    
    const currentState = stateResult.rows[0];
    
    // Create snapshot
    const snapshotData = {
      design_3d: currentState.design_3d,
      market_analysis: currentState.market_analysis,
      competition_data: currentState.competition_data,
      supply_data: currentState.supply_data,
      due_diligence: currentState.due_diligence,
      timeline_data: currentState.timeline_data,
      version: currentState.version,
    };
    
    const result = await client.query(`
      INSERT INTO deal_snapshots (
        deal_id,
        user_id,
        state_id,
        snapshot_data,
        name,
        description
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      dealId,
      userId,
      currentState.id,
      JSON.stringify(snapshotData),
      name || `Snapshot ${new Date().toISOString()}`,
      description || null,
    ]);
    
    res.json({
      success: true,
      message: 'Snapshot created successfully',
      snapshot: {
        id: result.rows[0].id,
        dealId: result.rows[0].deal_id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create snapshot'
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/snapshots
 * List all snapshots for a deal
 */
router.get('/:dealId/snapshots', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const client = req.dbClient || pool;
    
    // Verify deal ownership
    const dealCheck = await client.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, userId]
    );
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or access denied'
      });
    }
    
    // Get snapshots
    const result = await client.query(`
      SELECT 
        id,
        deal_id,
        name,
        description,
        created_at
      FROM deal_snapshots
      WHERE deal_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `, [dealId, userId]);
    
    res.json({
      success: true,
      snapshots: result.rows.map(row => ({
        id: row.id,
        dealId: row.deal_id,
        name: row.name,
        description: row.description,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch snapshots'
    });
  }
});

/**
 * POST /api/v1/deals/:dealId/restore
 * Restore deal state from a snapshot
 */
router.post('/:dealId/restore', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const { snapshot_id } = req.body;
    const client = req.dbClient || pool;
    
    if (!snapshot_id) {
      return res.status(400).json({
        success: false,
        error: 'snapshot_id is required'
      });
    }
    
    // Get snapshot
    const snapshotResult = await client.query(
      'SELECT * FROM deal_snapshots WHERE id = $1 AND deal_id = $2 AND user_id = $3',
      [snapshot_id, dealId, userId]
    );
    
    if (snapshotResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Snapshot not found'
      });
    }
    
    const snapshot = snapshotResult.rows[0];
    const snapshotData = snapshot.snapshot_data;
    
    // Update current state with snapshot data
    await client.query(`
      UPDATE deals_state
      SET
        design_3d = $3,
        market_analysis = $4,
        competition_data = $5,
        supply_data = $6,
        due_diligence = $7,
        timeline_data = $8,
        version = version + 1,
        updated_at = NOW()
      WHERE deal_id = $1 AND user_id = $2
    `, [
      dealId,
      userId,
      snapshotData.design_3d ? JSON.stringify(snapshotData.design_3d) : null,
      snapshotData.market_analysis ? JSON.stringify(snapshotData.market_analysis) : null,
      snapshotData.competition_data ? JSON.stringify(snapshotData.competition_data) : null,
      snapshotData.supply_data ? JSON.stringify(snapshotData.supply_data) : null,
      snapshotData.due_diligence ? JSON.stringify(snapshotData.due_diligence) : null,
      snapshotData.timeline_data ? JSON.stringify(snapshotData.timeline_data) : null,
    ]);
    
    res.json({
      success: true,
      message: 'Snapshot restored successfully',
      design_3d: snapshotData.design_3d,
      market_analysis: snapshotData.market_analysis,
      competition_data: snapshotData.competition_data,
      supply_data: snapshotData.supply_data,
      due_diligence: snapshotData.due_diligence,
      timeline_data: snapshotData.timeline_data,
    });
  } catch (error) {
    console.error('Error restoring snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore snapshot'
    });
  }
});

export default router;
