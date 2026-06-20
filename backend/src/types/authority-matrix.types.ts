/**
 * Authority Matrix — Role-based governance and human-in-the-loop architecture
 * P1-5: Defines who can approve what, with escalation protocols
 * Required by FINRA 24-09, SEC, EU AI Act, Colorado AI Act
 *
 * The authority matrix is the foundation of compliant autonomous underwriting.
 * It determines which actions can be taken autonomously, which require approval,
 * and which require human execution.
 */

export type ViewerRole =
  | 'gp_analyst'      // Junior analyst: can view, edit assumptions, propose changes
  | 'gp_director'     // Senior/director: can approve analyst proposals, mint shares
  | 'lp_investor'     // LP: can view shared capsules, flex assumptions (if permitted)
  | 'lp_due_diligence'// LP DD team: can view detailed assumptions, run stress tests
  | 'lender'          // Lender: can view debt metrics, DSCR, LTV, stress tests
  | 'jv_partner'      // JV partner: can view capital stack, returns, waterfall
  | 'viewer'          // Read-only viewer: can view summary only
  | 'ic_chair'        // Investment Committee chair: can approve capital deployment
  | 'compliance_officer'; // Compliance: can review audit trails, override decisions

export type PermissionAction =
  | 'view_summary'
  | 'view_assumptions'
  | 'view_documents'
  | 'view_debt_metrics'
  | 'view_waterfall'
  | 'edit_assumptions'
  | 'override_year1'
  | 'set_per_year_override'
  | 'run_scenario'
  | 'save_model'
  | 'export_excel'
  | 'mint_share'
  | 'revoke_share'
  | 'approve_assumption_change'
  | 'approve_capital_deployment'
  | 'approve_deal_stage_transition'
  | 'assign_task'
  | 'review_audit_trail'
  | 'run_stress_test';

export type ApprovalChain = 'assumption_override' | 'capital_deployment' | 'share_mint' | 'stage_transition' | 'scenario_branch';

export type DecisionTier = 'autonomous' | 'approval_required' | 'human_execution';

export interface AuthorityRule {
  role: ViewerRole;
  action: PermissionAction;
  allowed: boolean;
  /** Maximum deal value ($) this role can act on without escalation. Null = no limit. */
  maxDealValue?: number | null;
  /** Maximum authority value ($) this role can approve. Null = no limit. */
  maxAuthorityValue?: number | null;
  /** Whether this action requires a second approver (dual custody). */
  requiresSecondApprover?: boolean;
  /** Which tier of decision this action falls into. */
  tier: DecisionTier;
}

export interface ApprovalChainConfig {
  chainId: ApprovalChain;
  /** Roles that can initiate the proposal. */
  proposers: ViewerRole[];
  /** Roles that can approve the proposal (in order — first matching role wins). */
  approvers: ViewerRole[];
  /** Whether all approvers must sign off (true) or first approver is sufficient (false). */
  requiresAllApprovers: boolean;
  /** Time limit (hours) for approval before auto-escalation. */
  approvalTimeoutHours: number;
  /** Role to escalate to if timeout expires. */
  escalationRole: ViewerRole;
  /** Whether to auto-approve if no one objects within the timeout. */
  autoApproveOnTimeout: boolean;
}

export interface AutoEscalationRule {
  /** Deal value threshold ($) above which human approval is always required. */
  dealSizeThreshold: number;
  /** Risk score threshold (0–1) above which human approval is always required. */
  riskScoreThreshold: number;
  /** Any data quality alert triggers human review. */
  anomalyFlag: boolean;
  /** Any assumption override outside the P10–P90 confidence band triggers review. */
  confidenceBandViolation: boolean;
  /** Any adverse decision (rejection, negative recommendation) triggers review. */
  adverseDecision: boolean;
}

export interface AuthorityMatrix {
  dealId: string;
  orgId: string;
  /** Effective rules for this deal. */
  rules: AuthorityRule[];
  /** Approval chains for this deal. */
  approvalChains: ApprovalChainConfig[];
  /** Auto-escalation triggers. */
  autoEscalation: AutoEscalationRule;
  /** Custom rules beyond the defaults. */
  customRules?: Record<string, unknown>;
  /** Created by and updated tracking. */
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default authority matrix for a new deal.
 * Can be customized per organization or deal type.
 */
export const DEFAULT_AUTHORITY_MATRIX: Omit<AuthorityMatrix, 'dealId' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'> = {
  rules: [
    // GP Analyst: can do most analysis work but needs approval for changes
    { role: 'gp_analyst', action: 'view_summary', allowed: true, tier: 'autonomous' },
    { role: 'gp_analyst', action: 'view_assumptions', allowed: true, tier: 'autonomous' },
    { role: 'gp_analyst', action: 'view_documents', allowed: true, tier: 'autonomous' },
    { role: 'gp_analyst', action: 'edit_assumptions', allowed: true, tier: 'autonomous' },
    { role: 'gp_analyst', action: 'override_year1', allowed: true, tier: 'approval_required', maxAuthorityValue: 500000 },
    { role: 'gp_analyst', action: 'set_per_year_override', allowed: true, tier: 'approval_required' },
    { role: 'gp_analyst', action: 'run_scenario', allowed: true, tier: 'autonomous' },
    { role: 'gp_analyst', action: 'save_model', allowed: true, tier: 'autonomous' },
    { role: 'gp_analyst', action: 'export_excel', allowed: true, tier: 'autonomous' },
    { role: 'gp_analyst', action: 'mint_share', allowed: false, tier: 'human_execution' },
    { role: 'gp_analyst', action: 'approve_assumption_change', allowed: false, tier: 'human_execution' },
    { role: 'gp_analyst', action: 'approve_capital_deployment', allowed: false, tier: 'human_execution' },

    // GP Director: can approve analyst work and mint shares
    { role: 'gp_director', action: 'view_summary', allowed: true, tier: 'autonomous' },
    { role: 'gp_director', action: 'view_assumptions', allowed: true, tier: 'autonomous' },
    { role: 'gp_director', action: 'view_documents', allowed: true, tier: 'autonomous' },
    { role: 'gp_director', action: 'edit_assumptions', allowed: true, tier: 'autonomous' },
    { role: 'gp_director', action: 'override_year1', allowed: true, tier: 'autonomous', maxAuthorityValue: 10000000 },
    { role: 'gp_director', action: 'set_per_year_override', allowed: true, tier: 'autonomous' },
    { role: 'gp_director', action: 'run_scenario', allowed: true, tier: 'autonomous' },
    { role: 'gp_director', action: 'save_model', allowed: true, tier: 'autonomous' },
    { role: 'gp_director', action: 'export_excel', allowed: true, tier: 'autonomous' },
    { role: 'gp_director', action: 'mint_share', allowed: true, tier: 'approval_required' },
    { role: 'gp_director', action: 'approve_assumption_change', allowed: true, tier: 'autonomous' },
    { role: 'gp_director', action: 'approve_capital_deployment', allowed: false, tier: 'human_execution' },

    // LP Investor: view-only with limited flexibility
    { role: 'lp_investor', action: 'view_summary', allowed: true, tier: 'autonomous' },
    { role: 'lp_investor', action: 'view_assumptions', allowed: true, tier: 'autonomous' },
    { role: 'lp_investor', action: 'view_documents', allowed: true, tier: 'autonomous' },
    { role: 'lp_investor', action: 'view_debt_metrics', allowed: true, tier: 'autonomous' },
    { role: 'lp_investor', action: 'view_waterfall', allowed: true, tier: 'autonomous' },
    { role: 'lp_investor', action: 'edit_assumptions', allowed: false, tier: 'human_execution' },
    { role: 'lp_investor', action: 'flex_assumptions', allowed: true, tier: 'autonomous' }, // flex = own copy only
    { role: 'lp_investor', action: 'export_excel', allowed: true, tier: 'autonomous' },
    { role: 'lp_investor', action: 'run_stress_test', allowed: true, tier: 'autonomous' },

    // Lender: debt-focused view
    { role: 'lender', action: 'view_summary', allowed: true, tier: 'autonomous' },
    { role: 'lender', action: 'view_debt_metrics', allowed: true, tier: 'autonomous' },
    { role: 'lender', action: 'view_documents', allowed: true, tier: 'autonomous' },
    { role: 'lender', action: 'run_stress_test', allowed: true, tier: 'autonomous' },
    { role: 'lender', action: 'export_excel', allowed: true, tier: 'autonomous' },

    // JV Partner: returns and capital stack focused
    { role: 'jv_partner', action: 'view_summary', allowed: true, tier: 'autonomous' },
    { role: 'jv_partner', action: 'view_waterfall', allowed: true, tier: 'autonomous' },
    { role: 'jv_partner', action: 'view_documents', allowed: true, tier: 'autonomous' },
    { role: 'jv_partner', action: 'export_excel', allowed: true, tier: 'autonomous' },

    // Viewer: read-only summary
    { role: 'viewer', action: 'view_summary', allowed: true, tier: 'autonomous' },

    // IC Chair: ultimate approval authority
    { role: 'ic_chair', action: 'approve_capital_deployment', allowed: true, tier: 'autonomous', maxDealValue: 100000000 },
    { role: 'ic_chair', action: 'approve_deal_stage_transition', allowed: true, tier: 'autonomous' },
    { role: 'ic_chair', action: 'review_audit_trail', allowed: true, tier: 'autonomous' },

    // Compliance Officer: oversight and review
    { role: 'compliance_officer', action: 'review_audit_trail', allowed: true, tier: 'autonomous' },
    { role: 'compliance_officer', action: 'approve_assumption_change', allowed: true, tier: 'autonomous' },
    { role: 'compliance_officer', action: 'approve_capital_deployment', allowed: false, tier: 'human_execution' },
  ],
  approvalChains: [
    {
      chainId: 'assumption_override',
      proposers: ['gp_analyst'],
      approvers: ['gp_director', 'compliance_officer'],
      requiresAllApprovers: false,
      approvalTimeoutHours: 48,
      escalationRole: 'gp_director',
      autoApproveOnTimeout: false,
    },
    {
      chainId: 'capital_deployment',
      proposers: ['gp_director'],
      approvers: ['ic_chair'],
      requiresAllApprovers: true,
      approvalTimeoutHours: 72,
      escalationRole: 'ic_chair',
      autoApproveOnTimeout: false,
    },
    {
      chainId: 'share_mint',
      proposers: ['gp_director'],
      approvers: ['gp_director'], // self-approval for directors
      requiresAllApprovers: false,
      approvalTimeoutHours: 24,
      escalationRole: 'gp_director',
      autoApproveOnTimeout: true,
    },
    {
      chainId: 'stage_transition',
      proposers: ['gp_analyst', 'gp_director'],
      approvers: ['gp_director', 'ic_chair'],
      requiresAllApprovers: false,
      approvalTimeoutHours: 24,
      escalationRole: 'gp_director',
      autoApproveOnTimeout: false,
    },
  ],
  autoEscalation: {
    dealSizeThreshold: 10000000, // $10M
    riskScoreThreshold: 0.7,
    anomalyFlag: true,
    confidenceBandViolation: true,
    adverseDecision: true,
  },
};

/**
 * Check if a role is allowed to perform an action on a deal of a given value.
 */
export function canPerform(
  matrix: AuthorityMatrix,
  role: ViewerRole,
  action: PermissionAction,
  dealValue?: number,
): { allowed: boolean; tier: DecisionTier; requiresApproval?: boolean } {
  const rule = matrix.rules.find(r => r.role === role && r.action === action);
  if (!rule) return { allowed: false, tier: 'human_execution' };

  if (!rule.allowed) return { allowed: false, tier: rule.tier };

  if (dealValue != null && rule.maxAuthorityValue != null && dealValue > rule.maxAuthorityValue) {
    return { allowed: false, tier: 'human_execution', requiresApproval: true };
  }

  return { allowed: true, tier: rule.tier };
}

/**
 * Get the approval chain for a given action type.
 */
export function getApprovalChain(
  matrix: AuthorityMatrix,
  chainId: ApprovalChain,
): ApprovalChainConfig | undefined {
  return matrix.approvalChains.find(c => c.chainId === chainId);
}

/**
 * Check if an action should be escalated to human review based on auto-escalation rules.
 */
export function shouldEscalate(
  matrix: AuthorityMatrix,
  {
    dealValue,
    riskScore,
    hasAnomaly,
    hasConfidenceBandViolation,
    isAdverseDecision,
  }: {
    dealValue?: number;
    riskScore?: number;
    hasAnomaly?: boolean;
    hasConfidenceBandViolation?: boolean;
    isAdverseDecision?: boolean;
  },
): { escalate: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (dealValue != null && matrix.autoEscalation.dealSizeThreshold > 0 && dealValue > matrix.autoEscalation.dealSizeThreshold) {
    reasons.push(`Deal value $${dealValue.toLocaleString()} exceeds threshold $${matrix.autoEscalation.dealSizeThreshold.toLocaleString()}`);
  }
  if (riskScore != null && matrix.autoEscalation.riskScoreThreshold > 0 && riskScore > matrix.autoEscalation.riskScoreThreshold) {
    reasons.push(`Risk score ${riskScore.toFixed(2)} exceeds threshold ${matrix.autoEscalation.riskScoreThreshold}`);
  }
  if (hasAnomaly && matrix.autoEscalation.anomalyFlag) {
    reasons.push('Data quality anomaly detected');
  }
  if (hasConfidenceBandViolation && matrix.autoEscalation.confidenceBandViolation) {
    reasons.push('Assumption override outside confidence band');
  }
  if (isAdverseDecision && matrix.autoEscalation.adverseDecision) {
    reasons.push('Adverse decision requires human review');
  }

  return { escalate: reasons.length > 0, reasons };
}
