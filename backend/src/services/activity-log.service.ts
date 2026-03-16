import { getPool } from '../database/connection';

export type ActivityAction =
  | 'deal_created'
  | 'deal_updated'
  | 'deal_deleted'
  | 'collaborator_added'
  | 'collaborator_removed'
  | 'collaborator_updated'
  | 'comment_added'
  | 'comment_resolved'
  | 'comment_replied'
  | 'proforma_updated'
  | 'document_uploaded'
  | 'document_deleted'
  | 'strategy_run'
  | 'score_changed'
  | 'stage_changed'
  | 'task_created'
  | 'task_completed'
  | 'member_joined'
  | 'member_removed';

export interface LogActivityParams {
  dealId?: string;
  orgId?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  action: ActivityAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

export async function logActivity(params: LogActivityParams): Promise<string | null> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO activity_log (deal_id, org_id, user_id, user_name, user_email, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        params.dealId || null,
        params.orgId || null,
        params.userId,
        params.userName,
        params.userEmail || null,
        params.action,
        params.entityType || null,
        params.entityId || null,
        JSON.stringify(params.metadata || {}),
      ]
    );
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('[ActivityLog] Failed to log activity:', error);
    return null;
  }
}

export async function getDealActivity(
  dealId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ activities: any[]; total: number }> {
  const pool = getPool();
  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT * FROM activity_log WHERE deal_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [dealId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int as total FROM activity_log WHERE deal_id = $1`,
      [dealId]
    ),
  ]);
  return {
    activities: dataResult.rows,
    total: countResult.rows[0]?.total || 0,
  };
}

export async function getOrgActivity(
  orgId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ activities: any[]; total: number }> {
  const pool = getPool();
  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT * FROM activity_log WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [orgId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int as total FROM activity_log WHERE org_id = $1`,
      [orgId]
    ),
  ]);
  return {
    activities: dataResult.rows,
    total: countResult.rows[0]?.total || 0,
  };
}
