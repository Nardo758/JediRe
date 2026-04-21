/**
 * Organization Service
 * 
 * Multi-tenant organization management, team assignments, and handoffs.
 */

import { query, pool } from '../database/connection';
import { logger } from '../utils/logger';
import {
  TeamAssignment,
  AssignTeamMemberRequest,
  DealRole,
  DealPhase,
} from './integrations/types';

// ─── Organization Management ──────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  maxUsers: number;
  maxDeals: number;
  status: string;
}

/**
 * Get organization by ID
 */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const result = await query(
    `SELECT id, name, slug, plan_tier, max_users, max_deals, status
     FROM organizations WHERE id = $1`,
    [orgId]
  );
  
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    planTier: String(row.plan_tier),
    maxUsers: Number(row.max_users),
    maxDeals: Number(row.max_deals),
    status: String(row.status),
  };
}

/**
 * Get organization by user
 */
export async function getOrganizationByUser(userId: string): Promise<Organization | null> {
  const result = await query(
    `SELECT o.id, o.name, o.slug, o.plan_tier, o.max_users, o.max_deals, o.status
     FROM organizations o
     JOIN organization_members om ON om.organization_id = o.id
     WHERE om.user_id = $1 AND om.status = 'active'
     LIMIT 1`,
    [userId]
  );
  
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    planTier: String(row.plan_tier),
    maxUsers: Number(row.max_users),
    maxDeals: Number(row.max_deals),
    status: String(row.status),
  };
}

// ─── Member Management ────────────────────────────────────────────────

export interface OrganizationMember {
  id: string;
  userId: string;
  role: string;
  title?: string;
  department?: string;
  workEmail?: string;
  emailConnected: boolean;
  status: string;
}

/**
 * Get all members of an organization
 */
export async function getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  const result = await query(
    `SELECT id, user_id, role, title, department, work_email, email_connected, status
     FROM organization_members
     WHERE organization_id = $1 AND status != 'disabled'
     ORDER BY 
       CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
       title`,
    [orgId]
  );
  
  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    userId: String(row.user_id),
    role: String(row.role),
    title: row.title as string | undefined,
    department: row.department as string | undefined,
    workEmail: row.work_email as string | undefined,
    emailConnected: Boolean(row.email_connected),
    status: String(row.status),
  }));
}

/**
 * Invite a member to an organization
 */
export async function inviteMember(
  orgId: string,
  email: string,
  role: string = 'member',
  title?: string,
  department?: string
): Promise<string> {
  const result = await query(
    `INSERT INTO organization_members (
      organization_id, user_id, role, title, department, work_email, status, invited_at
    ) VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, 'invited', NOW())
    RETURNING id`,
    [orgId, role, title, department, email]
  );
  
  logger.info('[organization] Invited member', { orgId, email, role });
  return result.rows[0]?.id;
}

/**
 * Update member's email connection
 */
export async function connectMemberEmail(
  memberId: string,
  provider: string,
  oauthToken: string
): Promise<void> {
  // In production, encrypt the token
  await query(
    `UPDATE organization_members 
     SET email_connected = true, 
         email_provider = $1,
         email_oauth_token_encrypted = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [provider, oauthToken, memberId]
  );
}

// ─── Deal Team Assignments ────────────────────────────────────────────

/**
 * Assign a team member to a deal
 */
export async function assignTeamMember(request: AssignTeamMemberRequest): Promise<string> {
  // Get org ID from deal
  const dealResult = await query(
    `SELECT organization_id FROM deals WHERE id = $1`,
    [request.dealId]
  );
  const orgId = dealResult.rows[0]?.organization_id;
  
  if (!orgId) {
    throw new Error('Deal not found or not associated with an organization');
  }
  
  const result = await query(
    `INSERT INTO deal_team_assignments (
      deal_id, organization_id, member_id, deal_role, phase,
      can_edit, can_approve, can_sign, receives_notifications
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (deal_id, member_id, phase) DO UPDATE SET
      deal_role = EXCLUDED.deal_role,
      can_edit = EXCLUDED.can_edit,
      can_approve = EXCLUDED.can_approve,
      can_sign = EXCLUDED.can_sign,
      receives_notifications = EXCLUDED.receives_notifications,
      status = 'active'
    RETURNING id`,
    [
      request.dealId,
      orgId,
      request.memberId,
      request.dealRole,
      request.phase,
      request.canEdit ?? true,
      request.canApprove ?? false,
      request.canSign ?? false,
      request.receivesNotifications ?? true,
    ]
  );
  
  logger.info('[organization] Assigned team member', {
    dealId: request.dealId,
    memberId: request.memberId,
    role: request.dealRole,
    phase: request.phase,
  });
  
  return result.rows[0]?.id;
}

/**
 * Get team assignments for a deal
 */
export async function getDealTeam(
  dealId: string,
  phase?: DealPhase
): Promise<TeamAssignment[]> {
  const conditions = ['dta.deal_id = $1', 'dta.status = \'active\''];
  const params: unknown[] = [dealId];
  
  if (phase) {
    params.push(phase);
    conditions.push(`dta.phase = $${params.length}`);
  }
  
  const result = await query(`
    SELECT 
      dta.id, dta.deal_id, dta.member_id, dta.deal_role, dta.phase,
      dta.can_edit, dta.can_approve, dta.can_sign, dta.receives_notifications,
      dta.assigned_at,
      om.work_email as member_email,
      om.title as member_title
    FROM deal_team_assignments dta
    JOIN organization_members om ON om.id = dta.member_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY 
      CASE dta.deal_role WHEN 'lead' THEN 1 WHEN 'analyst' THEN 2 ELSE 3 END
  `, params);
  
  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    dealId: String(row.deal_id),
    memberId: String(row.member_id),
    memberEmail: row.member_email as string | undefined,
    memberTitle: row.member_title as string | undefined,
    dealRole: row.deal_role as DealRole,
    phase: row.phase as DealPhase,
    canEdit: Boolean(row.can_edit),
    canApprove: Boolean(row.can_approve),
    canSign: Boolean(row.can_sign),
    receivesNotifications: Boolean(row.receives_notifications),
    assignedAt: new Date(row.assigned_at as string),
  }));
}

/**
 * Remove a team member from a deal
 */
export async function removeTeamMember(
  dealId: string,
  memberId: string,
  phase: DealPhase
): Promise<void> {
  await query(
    `UPDATE deal_team_assignments 
     SET status = 'removed', removed_at = NOW()
     WHERE deal_id = $1 AND member_id = $2 AND phase = $3`,
    [dealId, memberId, phase]
  );
  
  logger.info('[organization] Removed team member', { dealId, memberId, phase });
}

// ─── Deal Handoffs ────────────────────────────────────────────────────

export interface DealHandoff {
  id: string;
  dealId: string;
  handoffType: string;
  fromTeamLeadId?: string;
  toTeamLeadId?: string;
  handoffDate: Date;
  effectiveDate?: Date;
  handoffNotes?: string;
  status: string;
}

/**
 * Initiate a handoff from one team to another
 */
export async function initiateHandoff(
  dealId: string,
  handoffType: 'acquisition_to_operations' | 'operations_to_disposition',
  fromLeadId: string,
  toLeadId: string,
  handoffDate: Date,
  notes?: string
): Promise<string> {
  const dealResult = await query(
    `SELECT organization_id FROM deals WHERE id = $1`,
    [dealId]
  );
  const orgId = dealResult.rows[0]?.organization_id;
  
  const result = await query(
    `INSERT INTO deal_handoffs (
      deal_id, organization_id, handoff_type,
      from_team_lead_id, to_team_lead_id,
      handoff_date, handoff_notes, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
    RETURNING id`,
    [dealId, orgId, handoffType, fromLeadId, toLeadId, handoffDate, notes]
  );
  
  logger.info('[organization] Initiated handoff', {
    dealId,
    handoffType,
    fromLeadId,
    toLeadId,
  });
  
  return result.rows[0]?.id;
}

/**
 * Complete a handoff
 */
export async function completeHandoff(
  handoffId: string,
  approvedBy: string,
  checklistCompleted: Record<string, boolean>
): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get handoff details
    const handoffResult = await client.query(
      `SELECT deal_id, handoff_type, to_team_lead_id FROM deal_handoffs WHERE id = $1`,
      [handoffId]
    );
    const handoff = handoffResult.rows[0] as Record<string, unknown>;
    
    // Mark handoff as completed
    await client.query(
      `UPDATE deal_handoffs 
       SET status = 'completed',
           approved_by = $1,
           approved_at = NOW(),
           effective_date = CURRENT_DATE,
           checklist_completed = $2
       WHERE id = $3`,
      [approvedBy, JSON.stringify(checklistCompleted), handoffId]
    );
    
    // Update deal status if acquisition → operations
    if (handoff.handoff_type === 'acquisition_to_operations') {
      await client.query(
        `UPDATE deals SET status = 'owned', updated_at = NOW() WHERE id = $1`,
        [handoff.deal_id]
      );
    }
    
    await client.query('COMMIT');
    
    logger.info('[organization] Completed handoff', { handoffId, approvedBy });
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get handoffs for a deal
 */
export async function getDealHandoffs(dealId: string): Promise<DealHandoff[]> {
  const result = await query(
    `SELECT id, deal_id, handoff_type, from_team_lead_id, to_team_lead_id,
            handoff_date, effective_date, handoff_notes, status
     FROM deal_handoffs
     WHERE deal_id = $1
     ORDER BY handoff_date DESC`,
    [dealId]
  );
  
  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    dealId: String(row.deal_id),
    handoffType: String(row.handoff_type),
    fromTeamLeadId: row.from_team_lead_id as string | undefined,
    toTeamLeadId: row.to_team_lead_id as string | undefined,
    handoffDate: new Date(row.handoff_date as string),
    effectiveDate: row.effective_date ? new Date(row.effective_date as string) : undefined,
    handoffNotes: row.handoff_notes as string | undefined,
    status: String(row.status),
  }));
}
