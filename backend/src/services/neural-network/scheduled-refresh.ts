/**
 * Scheduled Refresh Service
 * 
 * Periodically checks for stale knowledge graph nodes and triggers refreshes.
 * Designed to run via cron every 6 hours.
 * 
 * Staleness thresholds:
 * - Metrics: 1 day (need fresh data)
 * - Markets/Submarkets: 7 days
 * - Events: 14 days
 * - Properties: 30 days
 * - Sales: 90 days (historical, less urgent)
 */

import { Pool } from 'pg';
import { getKnowledgeGraph, KnowledgeGraphService } from './knowledge-graph.service';

// Try to import inngest, but make it optional
let inngest: any = null;
try {
  inngest = require('../../lib/inngest').inngest;
} catch (e) {
  console.warn('[ScheduledRefresh] Inngest not available, will log tasks instead');
}

export interface RefreshTask {
  nodeId: string;
  nodeType: string;
  externalId: string;
  name?: string;
  priority: 'high' | 'medium' | 'low';
  lastUpdated: Date;
  staleDays: number;
}

export interface RefreshStats {
  totalNodes: number;
  staleNodes: number;
  byType: Record<string, number>;
  oldestNode?: RefreshTask;
}

export class ScheduledRefreshService {
  private kg: KnowledgeGraphService;
  private pool: Pool;

  // Staleness thresholds by node type (in days)
  static readonly STALENESS_THRESHOLDS: Record<string, number> = {
    Metric: 1,
    Market: 7,
    Submarket: 7,
    Event: 14,
    Property: 30,
    Deal: 30,
    Permit: 30,
    Sale: 90,
    Owner: 90,
  };

  // Priority weights (higher = check more often)
  static readonly PRIORITY_WEIGHTS: Record<string, number> = {
    Metric: 10,
    Market: 8,
    Submarket: 8,
    Event: 5,
    Property: 3,
    Deal: 3,
    Permit: 2,
    Sale: 1,
    Owner: 1,
  };

  constructor(pool: Pool) {
    this.pool = pool;
    this.kg = getKnowledgeGraph(pool);
  }

  async getStats(): Promise<RefreshStats> {
    const query = `
      SELECT 
        node_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE 
          (node_type = 'Metric' AND updated_at < NOW() - INTERVAL '1 day') OR
          (node_type = 'Market' AND updated_at < NOW() - INTERVAL '7 days') OR
          (node_type = 'Submarket' AND updated_at < NOW() - INTERVAL '7 days') OR
          (node_type = 'Event' AND updated_at < NOW() - INTERVAL '14 days') OR
          (node_type = 'Property' AND updated_at < NOW() - INTERVAL '30 days') OR
          (node_type = 'Deal' AND updated_at < NOW() - INTERVAL '30 days') OR
          (node_type = 'Permit' AND updated_at < NOW() - INTERVAL '30 days') OR
          (node_type = 'Sale' AND updated_at < NOW() - INTERVAL '90 days') OR
          (node_type = 'Owner' AND updated_at < NOW() - INTERVAL '90 days')
        ) as stale
      FROM knowledge_graph_nodes
      GROUP BY node_type
    `;

    const result = await this.pool.query(query);
    
    let totalNodes = 0;
    let staleNodes = 0;
    const byType: Record<string, number> = {};

    for (const row of result.rows) {
      totalNodes += parseInt(row.total);
      staleNodes += parseInt(row.stale);
      byType[row.node_type] = parseInt(row.stale);
    }

    return { totalNodes, staleNodes, byType };
  }

  async getStaleNodes(limit = 100): Promise<RefreshTask[]> {
    const query = `
      SELECT 
        id,
        node_type,
        external_id,
        name,
        updated_at,
        EXTRACT(DAY FROM NOW() - updated_at) as stale_days
      FROM knowledge_graph_nodes
      WHERE 
        (node_type = 'Metric' AND updated_at < NOW() - INTERVAL '1 day') OR
        (node_type = 'Market' AND updated_at < NOW() - INTERVAL '7 days') OR
        (node_type = 'Submarket' AND updated_at < NOW() - INTERVAL '7 days') OR
        (node_type = 'Event' AND updated_at < NOW() - INTERVAL '14 days') OR
        (node_type = 'Property' AND updated_at < NOW() - INTERVAL '30 days') OR
        (node_type = 'Deal' AND updated_at < NOW() - INTERVAL '30 days') OR
        (node_type = 'Permit' AND updated_at < NOW() - INTERVAL '30 days')
      ORDER BY 
        -- Priority order: Metrics first, then Markets, etc.
        CASE node_type 
          WHEN 'Metric' THEN 1
          WHEN 'Market' THEN 2
          WHEN 'Submarket' THEN 3
          WHEN 'Event' THEN 4
          WHEN 'Property' THEN 5
          WHEN 'Deal' THEN 6
          ELSE 7
        END,
        -- Then by staleness (older first)
        updated_at ASC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);

    return result.rows.map(row => ({
      nodeId: row.id,
      nodeType: row.node_type,
      externalId: row.external_id,
      name: row.name,
      priority: this.determinePriority(row.node_type, row.stale_days),
      lastUpdated: row.updated_at,
      staleDays: Math.round(row.stale_days),
    }));
  }

  private determinePriority(nodeType: string, staleDays: number): 'high' | 'medium' | 'low' {
    const threshold = ScheduledRefreshService.STALENESS_THRESHOLDS[nodeType] || 30;
    const ratio = staleDays / threshold;

    // 3x threshold = high priority
    if (ratio >= 3) return 'high';
    // 2x threshold = medium priority
    if (ratio >= 2) return 'medium';
    return 'low';
  }

  async queueRefreshTasks(tasks: RefreshTask[]): Promise<{ queued: number; byAgent: Record<string, number> }> {
    const byAgent: Record<string, number> = {};
    let queued = 0;

    // Group by node type for efficient batching
    const byType: Record<string, RefreshTask[]> = {};
    for (const task of tasks) {
      if (!byType[task.nodeType]) byType[task.nodeType] = [];
      byType[task.nodeType].push(task);
    }

    // Queue agent tasks based on type
    for (const [nodeType, typeTasks] of Object.entries(byType)) {
      const agentType = this.getAgentForNodeType(nodeType);
      if (!agentType) {
        console.log(`[ScheduledRefresh] No agent for node type: ${nodeType}`);
        continue;
      }

      const taskData = {
        agentType,
        nodeType,
        tasks: typeTasks.map(t => ({
          nodeId: t.nodeId,
          externalId: t.externalId,
          name: t.name,
          priority: t.priority,
          staleDays: t.staleDays,
        })),
      };

      if (inngest) {
        // Send to Inngest for background processing
        await inngest.send({
          name: 'agent/scheduled-refresh',
          data: taskData,
        });
        console.log(`[ScheduledRefresh] Queued ${typeTasks.length} ${nodeType} tasks to ${agentType} agent`);
      } else {
        // Log for manual processing
        console.log(`[ScheduledRefresh] Would queue to ${agentType}:`, JSON.stringify(taskData, null, 2));
      }

      byAgent[agentType] = (byAgent[agentType] || 0) + typeTasks.length;
      queued += typeTasks.length;
    }

    return { queued, byAgent };
  }

  private getAgentForNodeType(nodeType: string): string | null {
    const mapping: Record<string, string> = {
      Property: 'research',
      Market: 'research',
      Submarket: 'research',
      Event: 'supply',
      Deal: 'cashflow',
      Permit: 'supply',
      Metric: 'research',
    };
    return mapping[nodeType] || null;
  }

  async run(): Promise<{ stats: RefreshStats; queued: number; byAgent: Record<string, number> }> {
    console.log('[ScheduledRefresh] Starting scheduled refresh check...');

    // Get stats
    const stats = await this.getStats();
    console.log(`[ScheduledRefresh] Found ${stats.staleNodes} stale out of ${stats.totalNodes} total nodes`);

    if (stats.staleNodes === 0) {
      console.log('[ScheduledRefresh] No stale nodes, nothing to do');
      return { stats, queued: 0, byAgent: {} };
    }

    // Get stale nodes (limit to 100 per run to avoid overload)
    const staleTasks = await this.getStaleNodes(100);
    console.log(`[ScheduledRefresh] Processing ${staleTasks.length} stale nodes`);

    // Log breakdown by type
    const breakdown: Record<string, number> = {};
    for (const task of staleTasks) {
      breakdown[task.nodeType] = (breakdown[task.nodeType] || 0) + 1;
    }
    console.log('[ScheduledRefresh] Breakdown:', breakdown);

    // Queue tasks
    const { queued, byAgent } = await this.queueRefreshTasks(staleTasks);

    return { stats, queued, byAgent };
  }

  // Manual trigger for specific node types
  async refreshNodeType(nodeType: string, limit = 50): Promise<{ queued: number }> {
    console.log(`[ScheduledRefresh] Manual refresh for ${nodeType}`);

    const query = `
      SELECT 
        id,
        node_type,
        external_id,
        name,
        updated_at,
        EXTRACT(DAY FROM NOW() - updated_at) as stale_days
      FROM knowledge_graph_nodes
      WHERE node_type = $1
      ORDER BY updated_at ASC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [nodeType, limit]);

    const tasks: RefreshTask[] = result.rows.map(row => ({
      nodeId: row.id,
      nodeType: row.node_type,
      externalId: row.external_id,
      name: row.name,
      priority: 'medium' as const,
      lastUpdated: row.updated_at,
      staleDays: Math.round(row.stale_days || 0),
    }));

    const { queued } = await this.queueRefreshTasks(tasks);
    return { queued };
  }
}

// Singleton
let instance: ScheduledRefreshService | null = null;

export function getScheduledRefreshService(pool: Pool): ScheduledRefreshService {
  if (!instance) {
    instance = new ScheduledRefreshService(pool);
  }
  return instance;
}

export default ScheduledRefreshService;
