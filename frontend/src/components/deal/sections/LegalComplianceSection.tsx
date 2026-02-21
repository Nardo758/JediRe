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
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-gray-600">
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
          <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
            Learn More
          </button>
        </div>
      </div>
    </PlaceholderContent>
  );
};

export default LegalComplianceSection;
