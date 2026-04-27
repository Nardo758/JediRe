/**
 * Platform Hooks
 * 
 * Wires the agent system into existing platform actions.
 * Call these hooks from your existing routes/services to trigger agents.
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { eventDispatcher } from './event-dispatcher';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';

// ============================================================================
// FILE UPLOAD HOOKS
// ============================================================================

/**
 * Call this after a file is successfully uploaded to a deal
 * Location: documentsFiles.routes.ts or wherever file uploads are handled
 */
export async function onFileUploaded(params: {
  dealId: string;
  userId: string;
  fileId: string;
  filename: string;
  category: string;
  mimeType: string;
}): Promise<void> {
  logger.info('Platform hook: file uploaded', { dealId: params.dealId, filename: params.filename });
  
  await eventDispatcher.onDocumentUploaded(params.dealId, params.userId, {
    fileId: params.fileId,
    filename: params.filename,
    category: params.category,
    mimeType: params.mimeType,
  });
}

/**
 * Call this after T-12 or financial data is extracted/uploaded
 */
export async function onFinancialsUploaded(params: {
  dealId: string;
  userId: string;
  type: 't12' | 'rent_roll' | 'actuals' | 'budget';
  period?: string;
  source?: string;
}): Promise<void> {
  logger.info('Platform hook: financials uploaded', { dealId: params.dealId, type: params.type });
  
  await eventDispatcher.onFinancialsUpdated(params.dealId, params.userId, {
    updateType: params.type,
    period: params.period,
    source: params.source,
  });
}

// ============================================================================
// DEAL LIFECYCLE HOOKS
// ============================================================================

/**
 * Call this after a new deal is created
 * Location: deals.routes.ts or deal creation service
 */
export async function onDealCreated(params: {
  dealId: string;
  userId: string;
  name: string;
  propertyType: string;
  city: string;
  state: string;
  units?: number;
  askingPrice?: number;
  address?: string;
}): Promise<void> {
  logger.info('Platform hook: deal created', { dealId: params.dealId, name: params.name });
  
  // Seed the Knowledge Graph with a Deal node — the neural network synapse.
  // This creates a base node so future enrichment (OM, T12, comps) has a target.
  try {
    const pool = getPool();
    const nodeId = `Deal__${params.dealId}`;
    await pool.query(`
      INSERT INTO knowledge_graph_nodes (id, type, name, properties)
      VALUES ($1, 'Deal', $2, $3::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        properties = knowledge_graph_nodes.properties || EXCLUDED.properties,
        updated_at = NOW()
    `, [
      nodeId,
      params.name,
      JSON.stringify({
        deal_id: params.dealId,
        property_type: params.propertyType,
        city: params.city,
        state: params.state,
        units: params.units || null,
        asking_price: params.askingPrice || null,
        address: params.address || null,
        status: 'new',
        created_at: new Date().toISOString(),
      }),
    ]);
    logger.info('KG: seeded Deal node', { nodeId });
  } catch (err: any) {
    // KG seeding is non-blocking; deal creation must succeed regardless
    logger.warn('KG: failed to seed Deal node on creation', { dealId: params.dealId, error: err?.message });
  }
  
  await eventDispatcher.onDealCreated(params.dealId, params.userId, {
    name: params.name,
    propertyType: params.propertyType,
    city: params.city,
    state: params.state,
    units: params.units,
    askingPrice: params.askingPrice,
  });
}

/**
 * Call this when a deal's status changes
 * Location: deals.routes.ts or wherever status updates happen
 */
export async function onDealStatusChanged(params: {
  dealId: string;
  userId: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
}): Promise<void> {
  logger.info('Platform hook: deal status changed', { 
    dealId: params.dealId, 
    from: params.previousStatus, 
    to: params.newStatus 
  });
  
  await eventDispatcher.onDealStatusChanged(params.dealId, params.userId, {
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    reason: params.reason,
  });
}

/**
 * Call this when a deal is closed/acquired
 */
export async function onDealClosed(params: {
  dealId: string;
  userId: string;
  closingPrice: number;
  closingDate: string;
}): Promise<void> {
  logger.info('Platform hook: deal closed', { dealId: params.dealId });
  
  await eventDispatcher.onDealStatusChanged(params.dealId, params.userId, {
    previousStatus: 'closing',
    newStatus: 'closed',
    reason: `Closed at $${params.closingPrice.toLocaleString()} on ${params.closingDate}`,
  });
}

// ============================================================================
// EMAIL HOOKS
// ============================================================================

/**
 * Call this when an email is received/synced
 * Location: gmail-sync.service.ts or email sync handler
 */
export async function onEmailReceived(params: {
  userId: string;
  emailId: string;
  subject: string;
  from: string;
  hasAttachments: boolean;
  dealId?: string;
  detectedType?: 'broker_om' | 'lender' | 'general';
}): Promise<void> {
  logger.info('Platform hook: email received', { subject: params.subject?.slice(0, 50) });
  
  await eventDispatcher.onEmailReceived(params.userId, {
    emailId: params.emailId,
    subject: params.subject,
    from: params.from,
    hasAttachments: params.hasAttachments,
    dealId: params.dealId,
    type: params.detectedType,
  });
}

// ============================================================================
// TASK HOOKS
// ============================================================================

/**
 * Call this when a task becomes due (within 24 hours)
 * Can be called from a scheduled job that checks task due dates
 */
export async function onTaskDue(params: {
  dealId: string;
  userId: string;
  taskId: string;
  title: string;
  dueDate: string;
  priority: string;
}): Promise<void> {
  logger.info('Platform hook: task due', { taskId: params.taskId, title: params.title });
  
  await eventDispatcher.onTaskDue(params.dealId, params.userId, {
    taskId: params.taskId,
    title: params.title,
    dueDate: params.dueDate,
    priority: params.priority,
  });
}

// ============================================================================
// MARKET DATA HOOKS
// ============================================================================

/**
 * Call this when market data changes significantly
 * Location: market data sync service or manual update
 */
export async function onMarketDataChanged(params: {
  type: 'rents' | 'cap_rates' | 'rates' | 'supply';
  msaId?: string;
  dealId?: string;
  change: Record<string, any>;
}): Promise<void> {
  logger.info('Platform hook: market data changed', { type: params.type });
  
  await eventDispatcher.onMarketDataChanged(params);
}

// ============================================================================
// THRESHOLD HOOKS
// ============================================================================

/**
 * Call this when a monitored metric breaches a threshold
 * Location: monitoring service or scheduled checks
 */
export async function onThresholdBreach(params: {
  dealId: string;
  metric: string;
  threshold: number;
  actualValue: number;
  direction: 'above' | 'below';
}): Promise<void> {
  logger.info('Platform hook: threshold breach', { 
    dealId: params.dealId, 
    metric: params.metric,
    value: params.actualValue 
  });
  
  await eventDispatcher.onThresholdBreach(params.dealId, {
    metric: params.metric,
    threshold: params.threshold,
    actualValue: params.actualValue,
    direction: params.direction,
  });
}

// ============================================================================
// EXPORT ALL HOOKS
// ============================================================================

export const platformHooks = {
  // Files
  onFileUploaded,
  onFinancialsUploaded,
  
  // Deals
  onDealCreated,
  onDealStatusChanged,
  onDealClosed,
  
  // Email
  onEmailReceived,
  
  // Tasks
  onTaskDue,
  
  // Market
  onMarketDataChanged,
  
  // Monitoring
  onThresholdBreach,
};

export default platformHooks;
