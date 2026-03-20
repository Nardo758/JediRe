/**
 * Legal & Compliance Section
 * Coming Soon: Legal issue tracker, compliance calendar, litigation management
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface LegalComplianceSectionProps {
  dealId: string;
}

export const LegalComplianceSection: React.FC<LegalComplianceSectionProps> = ({ dealId }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Legal & Compliance Hub                            │
├────────────────────────────────────────────────────┤
│  ⚖️ Active Legal Matters                           │
│  ┌────────────────────────────────────────────┐   │
│  │ Tenant Dispute - Unit 2C                   │   │
│  │ Type: Security Deposit | Filed: 01/20      │   │
│  │ Attorney: Smith & Co. | Hearing: 03/05     │   │
│  │ [Documents] [Timeline] [Notes]             │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  📅 Compliance Calendar                            │
│  ⚠️ Fair Housing Training Due: 02/28              │
│  ⚠️ Fire Inspection: 03/15                        │
│                                                    │
│  📋 Regulatory Checklist                           │
│  ADA Compliance: ✓ | Lead Disclosure: ✓         │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Legal & Compliance"
      description="Track legal issues, compliance requirements, and regulatory deadlines"
      status="coming-soon"
      icon="⚖️"
      wireframe={wireframe}
    >
      <div className="space-y-4">
        <div className="bg-[#0F1319] rounded-lg p-4 border border-[#1e2a3d]">
          <h4 className="font-semibold text-[#E8E6E1] mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-[#9EA8B4]">
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Legal Issue Tracker:</strong> Manage litigation, disputes, and claims</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Compliance Calendar:</strong> Never miss regulatory deadlines</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Document Vault:</strong> Secure storage for contracts, leases, and filings</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Attorney Directory:</strong> Contact info for your legal team</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Fair Housing Toolkit:</strong> Training tracker and violation alerts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Litigation Cost Tracker:</strong> Monitor legal spend by matter</span>
            </li>
          </ul>
        </div>
        
        <div className="flex items-center justify-center gap-3 pt-2">
          <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
            Request Early Access
          </button>
          <button className="px-6 py-2 bg-[#0F1319] border border-[#253347] text-[#9EA8B4] rounded-lg hover:bg-[#0F1319] transition-colors font-medium">
            Learn More
          </button>
        </div>
      </div>
    </PlaceholderContent>
  );
};

export default LegalComplianceSection;
