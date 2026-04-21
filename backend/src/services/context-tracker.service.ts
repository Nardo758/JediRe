/**
 * Context Tracker Service
 * 
 * Tracks decisions, action items, risks, and key information per deal.
 * Wired to emails for automatic extraction and linking.
 */

import { query, getClient } from '../database/connection';
import { logger } from '../utils/logger';
import {
  DealContextItem,
  CreateContextItemRequest,
  ContextType,
} from './integrations/types';

// ─── Context Item Management ──────────────────────────────────────────

/**
 * Create a context item
 */
export async function createContextItem(
  request: CreateContextItemRequest,
  createdBy?: string,
  aiExtracted: boolean = false,
  aiConfidence?: number,
  aiSourceSnippet?: string
): Promise<string> {
  const dealResult = await query(
    `SELECT organization_id FROM deals WHERE id = $1`,
    [request.dealId]
  );
  const orgId = dealResult.rows[0]?.organization_id;

  const result = await query(
    `INSERT INTO deal_context_items (
      deal_id, organization_id, context_type,
      title, description, category, priority, status,
      due_date, assigned_to,
      source_type, source_email_id,
      ai_extracted, ai_confidence, ai_source_snippet,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id`,
    [
      request.dealId,
      orgId,
      request.contextType,
      request.title,
      request.description,
      request.category,
      request.priority,
      request.dueDate,
      request.assignedTo,
      aiExtracted ? 'ai_extracted' : request.sourceEmailId ? 'email' : 'manual',
      request.sourceEmailId,
      aiExtracted,
      aiConfidence,
      aiSourceSnippet,
      createdBy,
    ]
  );

  const contextId = result.rows[0]?.id;

  // Link to source email if provided
  if (request.sourceEmailId) {
    await query(
      `INSERT INTO deal_context_email_links (context_item_id, email_id, link_type)
       VALUES ($1, $2, 'created_from')`,
      [contextId, request.sourceEmailId]
    );
  }

  logger.info('[context-tracker] Created item', {
    dealId: request.dealId,
    contextType: request.contextType,
    aiExtracted,
  });

  return contextId;
}

/**
 * Get context items for a deal
 */
export async function getContextItems(
  dealId: string,
  options?: {
    contextType?: ContextType;
    status?: string;
    assignedTo?: string;
    limit?: number;
  }
): Promise<DealContextItem[]> {
  const conditions = ['dci.deal_id = $1'];
  const params: unknown[] = [dealId];

  if (options?.contextType) {
    params.push(options.contextType);
    conditions.push(`dci.context_type = $${params.length}`);
  }
  if (options?.status) {
    params.push(options.status);
    conditions.push(`dci.status = $${params.length}`);
  }
  if (options?.assignedTo) {
    params.push(options.assignedTo);
    conditions.push(`dci.assigned_to = $${params.length}`);
  }

  const limit = options?.limit ?? 100;
  params.push(limit);

  const result = await query(`
    SELECT 
      dci.*,
      om.work_email as assignee_email,
      om.title as assignee_title
    FROM deal_context_items dci
    LEFT JOIN organization_members om ON om.id = dci.assigned_to
    WHERE ${conditions.join(' AND ')}
    ORDER BY 
      CASE dci.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      dci.due_date NULLS LAST,
      dci.created_at DESC
    LIMIT $${params.length}
  `, params);

  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    dealId: String(row.deal_id),
    contextType: row.context_type as ContextType,
    title: String(row.title),
    description: row.description as string | undefined,
    category: row.category as string | undefined,
    priority: row.priority as 'high' | 'medium' | 'low' | undefined,
    status: row.status as DealContextItem['status'],
    dueDate: row.due_date ? new Date(row.due_date as string) : undefined,
    assignedTo: row.assigned_to as string | undefined,
    assigneeName: row.assignee_email as string | undefined,
    sourceType: row.source_type as DealContextItem['sourceType'],
    sourceEmailId: row.source_email_id as string | undefined,
    aiExtracted: Boolean(row.ai_extracted),
    aiConfidence: row.ai_confidence ? Number(row.ai_confidence) : undefined,
    createdAt: new Date(row.created_at as string),
    createdBy: row.created_by as string | undefined,
  }));
}

/**
 * Update context item status
 */
export async function updateContextItemStatus(
  itemId: string,
  status: 'open' | 'in_progress' | 'resolved' | 'closed',
  resolvedBy?: string,
  resolutionNotes?: string
): Promise<void> {
  await query(
    `UPDATE deal_context_items 
     SET status = $1,
         resolved_at = CASE WHEN $1 IN ('resolved', 'closed') THEN NOW() ELSE NULL END,
         resolved_by = $2,
         resolution_notes = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [status, resolvedBy, resolutionNotes, itemId]
  );

  logger.info('[context-tracker] Updated status', { itemId, status });
}

/**
 * Link a context item to an email
 */
export async function linkToEmail(
  itemId: string,
  emailId: string,
  linkType: 'mentioned' | 'follow_up' | 'resolved_by' = 'mentioned'
): Promise<void> {
  await query(
    `INSERT INTO deal_context_email_links (context_item_id, email_id, link_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (context_item_id, email_id) DO UPDATE SET link_type = EXCLUDED.link_type`,
    [itemId, emailId, linkType]
  );
}

/**
 * Get emails linked to a context item
 */
export async function getLinkedEmails(itemId: string): Promise<{
  emailId: string;
  linkType: string;
  linkedAt: Date;
}[]> {
  const result = await query(
    `SELECT email_id, link_type, created_at
     FROM deal_context_email_links
     WHERE context_item_id = $1
     ORDER BY created_at DESC`,
    [itemId]
  );

  return (result.rows as Record<string, unknown>[]).map(row => ({
    emailId: String(row.email_id),
    linkType: String(row.link_type),
    linkedAt: new Date(row.created_at as string),
  }));
}

// ─── AI Extraction from Emails ────────────────────────────────────────

/**
 * Extract context items from an email using AI
 * Called by email processing pipeline
 */
export async function extractFromEmail(
  dealId: string,
  emailId: string,
  emailSubject: string,
  emailBody: string,
  extractedBy?: string
): Promise<string[]> {
  // This would call the AI service - simplified for now
  // In production, this calls Anthropic/OpenAI to extract structured data
  
  const extractedItems: CreateContextItemRequest[] = [];
  
  // Simple pattern matching for common patterns (AI would do this better)
  const bodyLower = emailBody.toLowerCase();
  
  // Action items: "please", "need to", "action required"
  if (bodyLower.includes('action required') || bodyLower.includes('please review')) {
    extractedItems.push({
      dealId,
      contextType: 'action_item',
      title: `Review: ${emailSubject}`,
      description: emailBody.substring(0, 500),
      category: 'general',
      priority: bodyLower.includes('urgent') ? 'high' : 'medium',
      sourceEmailId: emailId,
    });
  }
  
  // Decisions: "decided", "agreed", "approved"
  if (bodyLower.includes('decided') || bodyLower.includes('approved') || bodyLower.includes('agreed')) {
    extractedItems.push({
      dealId,
      contextType: 'decision',
      title: `Decision: ${emailSubject}`,
      description: emailBody.substring(0, 500),
      category: 'general',
      sourceEmailId: emailId,
    });
  }
  
  // Risks: "concern", "risk", "issue"
  if (bodyLower.includes('concern') || bodyLower.includes('risk') || bodyLower.includes('issue')) {
    extractedItems.push({
      dealId,
      contextType: 'risk',
      title: `Risk/Issue: ${emailSubject}`,
      description: emailBody.substring(0, 500),
      category: 'general',
      priority: 'medium',
      sourceEmailId: emailId,
    });
  }
  
  // Create extracted items
  const createdIds: string[] = [];
  for (const item of extractedItems) {
    const id = await createContextItem(
      item,
      extractedBy,
      true, // aiExtracted
      0.7, // aiConfidence (would be from AI response)
      emailBody.substring(0, 200) // aiSourceSnippet
    );
    createdIds.push(id);
  }
  
  logger.info('[context-tracker] Extracted from email', {
    dealId,
    emailId,
    extractedCount: createdIds.length,
  });
  
  return createdIds;
}

// ─── Summary & Analytics ──────────────────────────────────────────────

/**
 * Get context summary for a deal
 */
export async function getContextSummary(dealId: string): Promise<{
  totalItems: number;
  byType: Record<ContextType, number>;
  byStatus: Record<string, number>;
  overdueActionItems: number;
  upcomingActionItems: number;
  unresolvedRisks: number;
}> {
  const result = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE context_type = 'decision') as decisions,
      COUNT(*) FILTER (WHERE context_type = 'action_item') as action_items,
      COUNT(*) FILTER (WHERE context_type = 'key_info') as key_info,
      COUNT(*) FILTER (WHERE context_type = 'risk') as risks,
      COUNT(*) FILTER (WHERE context_type = 'contact') as contacts,
      COUNT(*) FILTER (WHERE context_type = 'note') as notes,
      COUNT(*) FILTER (WHERE status = 'open') as open,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) FILTER (WHERE status = 'closed') as closed,
      COUNT(*) FILTER (WHERE context_type = 'action_item' AND status IN ('open', 'in_progress') AND due_date < CURRENT_DATE) as overdue,
      COUNT(*) FILTER (WHERE context_type = 'action_item' AND status IN ('open', 'in_progress') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as upcoming,
      COUNT(*) FILTER (WHERE context_type = 'risk' AND status IN ('open', 'in_progress')) as unresolved_risks
    FROM deal_context_items
    WHERE deal_id = $1
  `, [dealId]);

  const row = result.rows[0] as Record<string, number>;

  return {
    totalItems: Number(row.total ?? 0),
    byType: {
      decision: Number(row.decisions ?? 0),
      action_item: Number(row.action_items ?? 0),
      key_info: Number(row.key_info ?? 0),
      risk: Number(row.risks ?? 0),
      contact: Number(row.contacts ?? 0),
      note: Number(row.notes ?? 0),
    },
    byStatus: {
      open: Number(row.open ?? 0),
      in_progress: Number(row.in_progress ?? 0),
      resolved: Number(row.resolved ?? 0),
      closed: Number(row.closed ?? 0),
    },
    overdueActionItems: Number(row.overdue ?? 0),
    upcomingActionItems: Number(row.upcoming ?? 0),
    unresolvedRisks: Number(row.unresolved_risks ?? 0),
  };
}

/**
 * Get pending action items across all deals for a user
 */
export async function getPendingActionItemsForUser(
  userId: string,
  limit: number = 20
): Promise<(DealContextItem & { dealName: string })[]> {
  const result = await query(`
    SELECT 
      dci.*,
      d.name as deal_name
    FROM deal_context_items dci
    JOIN deals d ON d.id = dci.deal_id
    JOIN organization_members om ON om.id = dci.assigned_to
    WHERE om.user_id = $1
      AND dci.context_type = 'action_item'
      AND dci.status IN ('open', 'in_progress')
    ORDER BY 
      CASE WHEN dci.due_date < CURRENT_DATE THEN 0 ELSE 1 END,
      dci.due_date NULLS LAST,
      CASE dci.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    LIMIT $2
  `, [userId, limit]);

  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    dealId: String(row.deal_id),
    dealName: String(row.deal_name),
    contextType: row.context_type as ContextType,
    title: String(row.title),
    description: row.description as string | undefined,
    category: row.category as string | undefined,
    priority: row.priority as 'high' | 'medium' | 'low' | undefined,
    status: row.status as DealContextItem['status'],
    dueDate: row.due_date ? new Date(row.due_date as string) : undefined,
    assignedTo: row.assigned_to as string | undefined,
    sourceType: row.source_type as DealContextItem['sourceType'],
    sourceEmailId: row.source_email_id as string | undefined,
    aiExtracted: Boolean(row.ai_extracted),
    aiConfidence: row.ai_confidence ? Number(row.ai_confidence) : undefined,
    createdAt: new Date(row.created_at as string),
    createdBy: row.created_by as string | undefined,
  }));
}
