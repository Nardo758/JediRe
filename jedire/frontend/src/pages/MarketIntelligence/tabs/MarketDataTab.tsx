/**
 * Market Data Tab - Full research library
 * 44 outputs total, 12 using real data (27% real for Atlanta)
 * Highest priority tab - most outputs
 */

import React, { useState } from 'react';

interface MarketDataTabProps {
  marketId: string;
}

interface OutputSection {
  title: string;
  description: string;
  outputs: Array<{
    id: string;
    name: string;
    status: 'REAL' | 'MOCK' | 'PENDING';
    description: string;
  }>;
}

const MarketDataTab: React.FC<MarketDataTabProps> = ({ marketId }) => {
  const isAtlanta = marketId === 'atlanta';
  const [showAll, setShowAll] = useState(false);

  const sections: OutputSection[] = [
    {
      title: 'Property Database Table',
      description: 'Main table of all properties with new columns',
      outputs: [
        { id: 'P-01', name: 'Property Card', status: isAtlanta ? 'REAL' : 'MOCK', description: '1,028 properties with address, units, year, lot, SF' },
        { id: 'P-02', name: 'Vintage Class', status: isAtlanta ? 'REAL' : 'MOCK', description: 'Derived from year_built (A/A-/B+/B/B-/C)' },
        { id: 'P-04', name: 'Ownership', status: isAtlanta ? 'REAL' : 'MOCK', description: 'Owner name, purchase date/price from deeds' },
        { id: 'M-01', name: 'Market Rent', status: 'MOCK', description: 'Apartments.com scraper needed' },
        { id: 'M-06', name: 'Occupancy Proxy', status: 'MOCK', description: 'Apartments.com available units' },
        { id: 'T-02', name: 'Physical Traffic Score', status: 'PENDING', description: 'NEW: DOT data + calculation' },
        { id: 'DC-07', name: 'Pricing Power Index', status: 'PENDING', description: 'NEW: Composite calc' },
      ],
    },
    {
      title: 'Property Flyout (Enhanced with T/TA/DC)',
      description: 'PropertyIntelligenceModal - click any row',
      outputs: [
        { id: 'P-01', name: 'Municipal Record', status: isAtlanta ? 'REAL' : 'MOCK', description: 'All property basics' },
        { id: 'P-03', name: 'Loss-to-Lease', status: 'MOCK', description: 'Needs M-01 comp rent' },
        { id: 'P-05', name: 'Seller Motivation', status: isAtlanta ? 'REAL' : 'MOCK', description: 'Can calculate from P-04' },
        { id: 'P-06', name: 'Tax Assessment', status: isAtlanta ? 'REAL' : 'MOCK', description: 'From municipal tax records' },
        { id: 'P-07', name: 'Price Benchmarks', status: isAtlanta ? 'REAL' : 'MOCK', description: 'From deed records' },
        { id: 'P-08', name: 'Zoning', status: isAtlanta ? 'REAL' : 'MOCK', description: 'Partially available' },
        { id: 'T-01', name: 'Walk-In Prediction', status: 'PENDING', description: 'NEW: Traffic calc' },
        { id: 'T-02', name: 'Physical Traffic Score', status: 'PENDING', description: 'NEW: DOT data' },
        { id: 'T-03', name: 'Digital Traffic Score', status: 'PENDING', description: 'NEW: Google Trends' },
        { id: 'T-04', name: 'Correlation Signal (Hidden Gem)', status: 'PENDING', description: 'NEW: T-02 vs T-03' },
        { id: 'T-06', name: 'Capture Rate', status: 'PENDING', description: 'NEW: Calc' },
        { id: 'T-08', name: 'Generator Proximity', status: 'PENDING', description: 'NEW: POI data' },
        { id: 'T-10', name: 'Validation Confidence', status: 'PENDING', description: 'NEW: User feedback' },
        { id: 'TA-01', name: 'Trade Area Definition', status: 'PENDING', description: 'NEW: Geospatial' },
        { id: 'TA-02', name: 'Competitive Set', status: 'PENDING', description: 'NEW: Matching algo' },
        { id: 'TA-03', name: 'Trade Area Balance', status: 'PENDING', description: 'NEW: Scoped D-01' },
        { id: 'TA-04', name: 'Digital Competitive Intel', status: 'PENDING', description: 'NEW: SpyFu data' },
      ],
    },
    {
      title: 'Demand-Supply Dashboard',
      description: 'D-01 through D-11, S-04 through S-09',
      outputs: [
        { id: 'D-01', name: 'Jobs/Apartments', status: 'MOCK', description: 'BLS + S-01' },
        { id: 'D-02', name: 'New Jobs/New Units', status: 'MOCK', description: 'BLS + S-02' },
        { id: 'S-04', name: 'Absorption Runway', status: 'MOCK', description: 'Pipeline / absorption' },
        { id: 'S-05', name: 'Delivery Clustering', status: 'MOCK', description: 'Geospatial + temporal' },
        { id: 'S-08', name: 'Saturation Index', status: 'MOCK', description: 'Units per capita' },
      ],
    },
    {
      title: 'Rent & Pricing Intelligence',
      description: 'M-01, M-03, M-05, M-07, R-01, R-02, R-03, DC-07',
      outputs: [
        { id: 'M-01', name: 'Rent by Vintage', status: 'MOCK', description: 'Apts.com needed' },
        { id: 'M-03', name: 'Concessions', status: 'MOCK', description: 'Apts.com needed' },
        { id: 'R-02', name: 'Vintage Convergence', status: 'MOCK', description: 'M-01 spread trend' },
        { id: 'DC-07', name: 'Pricing Power Index', status: 'PENDING', description: 'NEW: Composite' },
      ],
    },
    {
      title: 'Ownership Intelligence',
      description: 'P-04, P-05, R-07, R-09',
      outputs: [
        { id: 'P-04', name: 'Ownership Profile', status: isAtlanta ? 'REAL' : 'MOCK', description: 'From deeds' },
        { id: 'P-05', name: 'Seller Motivation', status: isAtlanta ? 'REAL' : 'MOCK', description: 'Calc from P-04' },
        { id: 'R-07', name: 'Ownership Concentration', status: isAtlanta ? 'REAL' : 'MOCK', description: 'P-04 aggregated' },
        { id: 'R-09', name: 'Hold Period vs Cycle', status: isAtlanta ? 'REAL' : 'MOCK', description: 'P-04 + time' },
      ],
    },
    {
      title: 'Transaction History',
      description: 'M-08, M-09, P-07',
      outputs: [
        { id: 'M-08', name: 'Cap Rate Trends', status: isAtlanta ? 'REAL' : 'MOCK', description: 'From deed records' },
        { id: 'M-09', name: 'Investor Activity', status: isAtlanta ? 'REAL' : 'MOCK', description: 'Deed frequency' },
        { id: 'P-07', name: 'Price/Unit Benchmarks', status: isAtlanta ? 'REAL' : 'MOCK', description: 'Recent sales' },
      ],
    },
    {
      title: 'Traffic & Demand Heatmap',
      description: 'D-05 through D-09, T-02, T-04',
      outputs: [
        { id: 'D-05', name: 'Traffic Growth Rate', status: 'MOCK', description: 'DOT needed' },
        { id: 'D-09', name: 'Demand Momentum', status: 'MOCK', description: 'Composite' },
        { id: 'T-02', name: 'Physical Traffic (overlays)', status: 'PENDING', description: 'NEW: Map layer' },
        { id: 'T-04', name: 'Correlation Signal (colors)', status: 'PENDING', description: 'NEW: Hidden Gems' },
      ],
    },
  ];

  const getStatusBadge = (status: 'REAL' | 'MOCK' | 'PENDING') => {
    switch (status) {
      case 'REAL':
        return <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">🟢 REAL</span>;
      case 'MOCK':
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">⚪ MOCK</span>;
      case 'PENDING':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">⏳ PENDING</span>;
    }
  };

  const totalOutputs = sections.reduce((sum, section) => sum + section.outputs.length, 0);
  const realOutputs = sections.reduce(
    (sum, section) => sum + section.outputs.filter(o => o.status === 'REAL').length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-2">Market Data Tab</h2>
        <p className="text-gray-600 mb-4">Full research library - 5-15 minute deep dive</p>
        <div className="flex items-center space-x-4 text-sm">
          <div>
            <span className="text-gray-600">Total Outputs:</span>
            <span className="ml-2 font-bold">{totalOutputs}</span>
          </div>
          <div>
            <span className="text-gray-600">Real Data:</span>
            <span className="ml-2 font-bold text-green-600">{realOutputs}</span>
          </div>
          <div>
            <span className="text-gray-600">Coverage:</span>
            <span className="ml-2 font-bold">{Math.round((realOutputs / totalOutputs) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Key Feature Highlight */}
      {isAtlanta && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-2">✅ Atlanta: Real Data Available</h3>
          <p className="text-sm text-green-800 mb-3">
            1,028 properties from Fulton County with municipal records, ownership, and transaction history
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded p-3">
              <div className="text-gray-600">Properties (P-01)</div>
              <div className="text-2xl font-bold text-green-600">1,028</div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-gray-600">Total Units (P-01)</div>
              <div className="text-2xl font-bold text-green-600">249,964</div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-gray-600">Owners (P-04)</div>
              <div className="text-2xl font-bold text-green-600">~850</div>
            </div>
          </div>
        </div>
      )}

      {/* Output Sections */}
      {sections.slice(0, showAll ? sections.length : 3).map((section, idx) => (
        <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{section.title}</h3>
            <p className="text-sm text-gray-600">{section.description}</p>
          </div>
          <div className="space-y-2">
            {section.outputs.map((output, outputIdx) => (
              <div key={outputIdx} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <span className="font-mono text-sm font-medium text-blue-600">{output.id}</span>
                    <span className="font-medium text-sm">{output.name}</span>
                    {getStatusBadge(output.status)}
                  </div>
                  <div className="text-xs text-gray-600">{output.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Show More/Less */}
      {sections.length > 3 && (
        <div className="text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            {showAll ? '▲ Show Less' : `▼ Show ${sections.length - 3} More Sections`}
          </button>
        </div>
      )}

      {/* PropertyIntelligenceModal Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold mb-2">✅ PropertyIntelligenceModal - BUILT</h3>
        <p className="text-sm text-gray-700 mb-3">
          The property flyout with 5 tabs (Overview, Traffic, Trade Area, Financial, Ownership) has been built with all outputs structured.
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li><strong>Phase 2 Integration:</strong> Connect modal to table row clicks</li>
          <li><strong>Real Data:</strong> Show actual municipal records for Atlanta properties</li>
          <li><strong>Mock Data:</strong> Display structured placeholders for T/TA/DC outputs</li>
          <li><strong>DataSourceIndicator:</strong> Hover attribution showing data provenance</li>
        </ul>
      </div>

      {/* Phase 2 Components */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <h3 className="font-semibold mb-2">🚧 Phase 2: Components to Build</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          <li><strong>MarketDataTable:</strong> Sortable table with new columns (Avg Unit Size, Traffic Score, Motivation, Hold Period)</li>
          <li><strong>Filter Bar:</strong> Submarket, Vintage, Units, Owner Type, Search</li>
          <li><strong>Demand-Supply Dashboard:</strong> Charts and metrics</li>
          <li><strong>Rent Intelligence Section:</strong> Vintage comp analysis</li>
          <li><strong>Ownership Intelligence:</strong> Portfolio views</li>
          <li><strong>Transaction History:</strong> Cap rate trends, investor activity</li>
          <li><strong>Traffic Heatmap:</strong> Map overlay with T-02/T-04 visualization</li>
        </ul>
      </div>
    </div>
  );
};

export default MarketDataTab;
