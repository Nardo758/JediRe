/**
 * Agent Collaboration Services Index
 * 
 * Cross-agent intelligence sharing:
 * 
 * 1. CFO → Lender: Debt sizing optimization
 * 2. Asset Manager → CFO: Variance impact on returns
 * 3. Research → Acquisitions: Market signals → screening adjustments
 * 4. Leasing → Revenue Management: Traffic/conversion → pricing
 * 5. Compliance → Legal: Issues → protective contract provisions
 * 6. Tax Strategist → CFO: Tax structure → after-tax returns
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

export * from './cfo-lender.service';
export * from './asset-manager-cfo.service';
export * from './research-acquisitions.service';
export * from './leasing-revenue.service';
export * from './compliance-legal.service';
export * from './tax-cfo.service';

// Re-export services as named exports for convenience
import { cfoLenderService } from './cfo-lender.service';
import { assetManagerCFOService } from './asset-manager-cfo.service';
import { researchAcquisitionsService } from './research-acquisitions.service';
import { leasingRevenueService } from './leasing-revenue.service';
import { complianceLegalService } from './compliance-legal.service';
import { taxCFOService } from './tax-cfo.service';

export const collaborationServices = {
  cfoLender: cfoLenderService,
  assetManagerCFO: assetManagerCFOService,
  researchAcquisitions: researchAcquisitionsService,
  leasingRevenue: leasingRevenueService,
  complianceLegal: complianceLegalService,
  taxCFO: taxCFOService,
};

export default collaborationServices;
