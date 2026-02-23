/**
 * Environmental & ESG Section
 * Coming Soon: Phase I/II tracking, risk scoring, ESG metrics
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface EnvironmentalESGSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

export const EnvironmentalESGSection: React.FC<EnvironmentalESGSectionProps> = ({ deal, dealId }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Environmental & ESG Management                    │
├────────────────────────────────────────────────────┤
│  ⚠️ Environmental Site Assessments                 │
│  ┌────────────────────────────────────────────┐   │
│  │ Phase I ESA: Complete ✓                    │   │
│  │ Status: Low Risk | Date: 01/15/2024        │   │
│  │ [View Report] [Upload Phase II]            │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  🌱 ESG Score: 72/100                              │
│  Energy Efficiency: A- | Water Conservation: B+   │
│  Social Impact: B | Governance: A                 │
│                                                    │
│  📊 Risk Heat Map                                  │
│  Asbestos: Low | Lead Paint: Low | Soil: Clear   │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Environmental & ESG"
      description="Environmental assessments, compliance tracking, and ESG performance metrics"
      status="coming-soon"
      icon="🌍"
      wireframe={wireframe}
    >
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Phase I/II Tracker:</strong> Manage environmental site assessments and reports</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Risk Scoring:</strong> Automated risk assessment for asbestos, lead, soil contamination</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>ESG Metrics:</strong> Track environmental, social, and governance performance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Green Certification:</strong> LEED, Energy Star, WELL Building tracking</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Carbon Footprint:</strong> Calculate and monitor property emissions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Compliance Alerts:</strong> Notifications for environmental regulations</span>
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

export default EnvironmentalESGSection;
