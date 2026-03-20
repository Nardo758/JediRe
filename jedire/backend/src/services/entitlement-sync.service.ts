/**
 * Entitlement Sync Service
 *
 * Bidirectional sync between Zoning Module (M02) and Context Tracker (M18).
 * When a development path is selected, auto-creates entitlement milestones.
 * When entitlement status changes, notifies downstream modules.
 */

import { dataFlowRouter } from './module-wiring/data-flow-router';
import { moduleEventBus, ModuleEventType } from './module-wiring/module-event-bus';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface PathMilestoneTemplate {
  name: string;
  phase: string;
  sortOrder: number;
  estimatedDays: number;
  requiresHearing: boolean;
  requiredDocuments: string[];
}

export interface AutoMilestone {
  dealId: string;
  entitlementType: string;
  name: string;
  phase: string;
  sortOrder: number;
  scheduledDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  source: string;
}

export interface SyncResult {
  dealId: string;
  direction: 'zoning_to_context' | 'context_to_zoning';
  milestonesCreated: number;
  documentsLinked: number;
  eventsEmitted: string[];
}

// ============================================================================
// Path-to-Milestone Templates
// ============================================================================

const PATH_MILESTONES: Record<string, PathMilestoneTemplate[]> = {
  by_right: [
    { name: 'Site Plan Preparation', phase: 'pre_application', sortOrder: 1, estimatedDays: 14, requiresHearing: false, requiredDocuments: ['site_plan', 'survey'] },
    { name: 'Site Plan Submission', phase: 'submitted', sortOrder: 2, estimatedDays: 7, requiresHearing: false, requiredDocuments: ['site_plan', 'drainage_study'] },
    { name: 'Administrative Review', phase: 'under_review', sortOrder: 3, estimatedDays: 45, requiresHearing: false, requiredDocuments: [] },
    { name: 'Building Permit Application', phase: 'submitted', sortOrder: 4, estimatedDays: 14, requiresHearing: false, requiredDocuments: ['construction_drawings', 'engineering'] },
    { name: 'Permit Issuance', phase: 'approved', sortOrder: 5, estimatedDays: 30, requiresHearing: false, requiredDocuments: [] },
  ],
  overlay_bonus: [
    { name: 'Pre-Application Conference', phase: 'pre_application', sortOrder: 1, estimatedDays: 21, requiresHearing: false, requiredDocuments: ['concept_plan'] },
    { name: 'Overlay Compliance Review', phase: 'pre_application', sortOrder: 2, estimatedDays: 30, requiresHearing: false, requiredDocuments: ['overlay_compliance', 'affordable_housing_plan'] },
    { name: 'Application Filing', phase: 'submitted', sortOrder: 3, estimatedDays: 7, requiresHearing: false, requiredDocuments: ['site_plan', 'compliance_docs'] },
    { name: 'Staff Review', phase: 'under_review', sortOrder: 4, estimatedDays: 60, requiresHearing: false, requiredDocuments: [] },
    { name: 'Administrative Approval', phase: 'approved', sortOrder: 5, estimatedDays: 14, requiresHearing: false, requiredDocuments: [] },
    { name: 'Building Permit', phase: 'approved', sortOrder: 6, estimatedDays: 30, requiresHearing: false, requiredDocuments: ['construction_drawings'] },
  ],
  variance: [
    { name: 'Pre-Application Meeting', phase: 'pre_application', sortOrder: 1, estimatedDays: 21, requiresHearing: false, requiredDocuments: ['concept_plan', 'hardship_statement'] },
    { name: 'Variance Application', phase: 'submitted', sortOrder: 2, estimatedDays: 7, requiresHearing: false, requiredDocuments: ['variance_application', 'site_plan', 'neighbor_notification'] },
    { name: 'Staff Technical Review', phase: 'under_review', sortOrder: 3, estimatedDays: 45, requiresHearing: false, requiredDocuments: [] },
    { name: 'Public Notice & Comment', phase: 'under_review', sortOrder: 4, estimatedDays: 30, requiresHearing: false, requiredDocuments: ['public_notice'] },
    { name: 'Board of Zoning Appeals', phase: 'hearing', sortOrder: 5, estimatedDays: 14, requiresHearing: true, requiredDocuments: ['presentation'] },
    { name: 'Variance Decision', phase: 'approved', sortOrder: 6, estimatedDays: 7, requiresHearing: false, requiredDocuments: [] },
    { name: 'Building Permit', phase: 'approved', sortOrder: 7, estimatedDays: 30, requiresHearing: false, requiredDocuments: ['construction_drawings'] },
  ],
  rezone: [
    { name: 'Pre-Application Conference', phase: 'pre_application', sortOrder: 1, estimatedDays: 30, requiresHearing: false, requiredDocuments: ['concept_plan', 'traffic_study_scope'] },
    { name: 'Community Engagement', phase: 'pre_application', sortOrder: 2, estimatedDays: 45, requiresHearing: false, requiredDocuments: ['community_engagement_plan'] },
    { name: 'Rezone Application Filing', phase: 'submitted', sortOrder: 3, estimatedDays: 7, requiresHearing: false, requiredDocuments: ['rezone_application', 'site_plan', 'traffic_study', 'impact_analysis'] },
    { name: 'Staff Technical Review', phase: 'under_review', sortOrder: 4, estimatedDays: 90, requiresHearing: false, requiredDocuments: [] },
    { name: 'Planning Commission Hearing', phase: 'hearing', sortOrder: 5, estimatedDays: 14, requiresHearing: true, requiredDocuments: ['staff_report', 'presentation'] },
    { name: 'NPU / Neighborhood Review', phase: 'hearing', sortOrder: 6, estimatedDays: 30, requiresHearing: true, requiredDocuments: [] },
    { name: 'Zoning Review Board', phase: 'hearing', sortOrder: 7, estimatedDays: 14, requiresHearing: true, requiredDocuments: [] },
    { name: 'City Council Vote', phase: 'hearing', sortOrder: 8, estimatedDays: 30, requiresHearing: true, requiredDocuments: ['conditions_proffer'] },
    { name: 'Post-Approval Compliance', phase: 'approved', sortOrder: 9, estimatedDays: 21, requiresHearing: false, requiredDocuments: ['recorded_conditions'] },
    { name: 'Building Permit', phase: 'approved', sortOrder: 10, estimatedDays: 30, requiresHearing: false, requiredDocuments: ['construction_drawings'] },
  ],
};

// ============================================================================
// Service
// ============================================================================

class EntitlementSyncService {
  /**
   * Generate auto-milestones when a development path is selected.
   * Called from M02 (Zoning) → creates entitlement records in Context Tracker.
   */
  async onPathSelected(
    dealId: string,
    developmentPath: string,
    envelope?: { max_units: number; max_gfa_sf: number },
  ): Promise<SyncResult> {
    const templates = PATH_MILESTONES[developmentPath] || PATH_MILESTONES.by_right;

    const now = new Date();
    const milestones: AutoMilestone[] = [];
    let cumulativeDays = 0;

    for (const template of templates) {
      cumulativeDays += template.estimatedDays;
      const scheduledDate = new Date(now.getTime() + cumulativeDays * 24 * 60 * 60 * 1000);

      milestones.push({
        dealId,
        entitlementType: developmentPath,
        name: template.name,
        phase: template.phase,
        sortOrder: template.sortOrder,
        scheduledDate: scheduledDate.toISOString().split('T')[0],
        status: 'pending',
        source: 'auto_path_selection',
      });
    }

    // Publish milestone data for Context Tracker consumption
    dataFlowRouter.publishModuleData('M02', dealId, {
      auto_milestones: milestones,
      entitlement_type: developmentPath,
      total_milestone_count: milestones.length,
      estimated_total_days: cumulativeDays,
      required_hearings: templates.filter(t => t.requiresHearing).length,
    });

    // Emit event for M18 Context Tracker to pick up
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M02',
      dealId,
      data: {
        event: 'path_milestones_created',
        development_path: developmentPath,
        milestone_count: milestones.length,
        estimated_days: cumulativeDays,
      },
      timestamp: new Date(),
    });

    logger.info('Auto-milestones created from path selection', {
      dealId,
      path: developmentPath,
      milestoneCount: milestones.length,
      totalDays: cumulativeDays,
    });

    return {
      dealId,
      direction: 'zoning_to_context',
      milestonesCreated: milestones.length,
      documentsLinked: templates.reduce((s, t) => s + t.requiredDocuments.length, 0),
      eventsEmitted: ['path_milestones_created'],
    };
  }

  /**
   * When entitlement status changes in Context Tracker, notify Zoning module.
   * Called from M18 → updates M02 zoning risk and timeline data.
   */
  async onEntitlementStatusChanged(
    dealId: string,
    entitlementId: string,
    newStatus: string,
    oldStatus: string,
  ): Promise<SyncResult> {
    const events: string[] = [];

    // Update zoning module with latest entitlement progress
    const statusProgress: Record<string, number> = {
      pre_application: 10,
      submitted: 25,
      under_review: 50,
      hearing: 70,
      approved: 100,
      denied: 0,
      withdrawn: 0,
    };

    const progress = statusProgress[newStatus] || 0;

    dataFlowRouter.publishModuleData('M02', dealId, {
      entitlement_progress_pct: progress,
      entitlement_status: newStatus,
      entitlement_last_updated: new Date().toISOString(),
    });

    events.push('entitlement_progress_updated');

    // If approved, trigger cascade recalculation
    if (newStatus === 'approved') {
      moduleEventBus.emit({
        type: ModuleEventType.CALCULATION_COMPLETE,
        sourceModule: 'M02',
        dealId,
        data: {
          event: 'entitlement_approved',
          entitlementId,
        },
        timestamp: new Date(),
      });
      events.push('entitlement_approved');
    }

    // If denied, emit risk alert
    if (newStatus === 'denied') {
      moduleEventBus.emit({
        type: ModuleEventType.RISK_ALERT,
        sourceModule: 'M02',
        dealId,
        data: {
          riskType: 'entitlement_denied',
          entitlementId,
          severity: 'critical',
        },
        timestamp: new Date(),
      });
      events.push('entitlement_denied_alert');
    }

    logger.info('Entitlement status synced', {
      dealId,
      entitlementId,
      from: oldStatus,
      to: newStatus,
      progress,
    });

    return {
      dealId,
      direction: 'context_to_zoning',
      milestonesCreated: 0,
      documentsLinked: 0,
      eventsEmitted: events,
    };
  }

  /**
   * Get the milestone template for a given development path.
   */
  getMilestoneTemplate(developmentPath: string): PathMilestoneTemplate[] {
    return PATH_MILESTONES[developmentPath] || PATH_MILESTONES.by_right;
  }

  /**
   * Get required documents for a development path.
   */
  getRequiredDocuments(developmentPath: string): string[] {
    const templates = PATH_MILESTONES[developmentPath] || PATH_MILESTONES.by_right;
    const docs = new Set<string>();
    for (const t of templates) {
      for (const d of t.requiredDocuments) {
        docs.add(d);
      }
    }
    return Array.from(docs);
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const entitlementSyncService = new EntitlementSyncService();
