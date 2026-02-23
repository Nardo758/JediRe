/**
 * Overview Tab - 30-second market health check
 * 25 outputs total, 8 using real data (32% real for Atlanta)
 */

import React from 'react';

interface OverviewTabProps {
  marketId: string;
}

interface OutputSection {
  title: string;
  outputs: Array<{
    id: string;
    name: string;
    status: 'REAL' | 'MOCK' | 'PENDING';
    description: string;
  }>;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ marketId }) => {
  const isAtlanta = marketId === 'atlanta';

  const sections: OutputSection[] = [
    {
      title: 'Market Vitals Bar (6 outputs)',
      outputs: [
        { id: 'D-12', name: 'Population & Demographics', status: 'MOCK', description: 'Census data integration needed' },
        { id: 'D-01', name: 'Jobs-to-Apartments Ratio', status: 'MOCK', description: 'BLS + S-01 calculation needed' },
        { id: 'D-12', name: 'Median Income', status: 'MOCK', description: 'Census data needed' },
        { id: 'M-01', name: 'Average Rent', status: 'MOCK', description: 'Apartments.com scraper needed' },
        { id: 'M-06', name: 'Occupancy Estimate', status: 'MOCK', description: 'Apartments.com scraper needed' },
        { id: 'C-01', name: 'JEDI Score', status: 'PENDING', description: 'Composite calculation' },
      ],
    },
    {
      title: 'Data Coverage Bar (3 outputs)',
      outputs: [
        { id: 'S-01', name: 'Property Count', status: isAtlanta ? 'REAL' : 'MOCK', description: isAtlanta ? '1,028 properties from Fulton County' : 'No data yet' },
        { id: 'P-04', name: 'Ownership Coverage', status: isAtlanta ? 'REAL' : 'MOCK', description: isAtlanta ? 'Owner names from deed records' : 'No data yet' },
        { id: 'S-02', name: 'Pipeline Data', status: 'MOCK', description: 'Municipal permits integration needed' },
      ],
    },
    {
      title: '5-Signal Health Bar (5 composites)',
      outputs: [
        { id: 'D-09', name: 'Demand Momentum', status: 'MOCK', description: 'BLS + Census needed' },
        { id: 'DC-04', name: 'Supply Overhang Risk', status: 'PENDING', description: 'DC calculation needed' },
        { id: 'M-02', name: 'Momentum Composite', status: 'MOCK', description: 'Rent data needed' },
        { id: 'P-10', name: 'Position Average', status: 'PENDING', description: 'Property-level aggregation' },
        { id: 'R-01', name: 'Risk Composite', status: 'MOCK', description: 'Multiple sources needed' },
      ],
    },
    {
      title: 'Recent Market Intelligence (1 output)',
      outputs: [
        { id: 'R-10', name: 'News Sentiment & Alerts', status: 'MOCK', description: 'NewsAPI integration needed' },
      ],
    },
    {
      title: 'Supply Snapshot (Enhanced) (10 outputs)',
      outputs: [
        { id: 'S-01', name: 'Existing Inventory', status: isAtlanta ? 'REAL' : 'MOCK', description: isAtlanta ? '1,028 properties, 249K units' : 'No data' },
        { id: 'S-02', name: 'Under Construction', status: 'MOCK', description: 'Permits needed' },
        { id: 'S-03', name: 'Permitted Not Started', status: 'MOCK', description: 'Permits needed' },
        { id: 'S-10', name: 'Vintage Breakdown', status: isAtlanta ? 'REAL' : 'MOCK', description: isAtlanta ? 'From year_built field' : 'No data' },
        { id: 'DC-01', name: 'Capacity Ratio', status: 'PENDING', description: 'Zoning analysis needed' },
        { id: 'DC-04', name: 'Overhang Risk', status: 'PENDING', description: 'Capacity calculation' },
        { id: 'DC-08', name: '10-Year Supply Wave', status: 'PENDING', description: 'DC calculation' },
        { id: 'S-04', name: 'Absorption Runway', status: 'MOCK', description: 'Pipeline + absorption data' },
        { id: 'S-05', name: 'Delivery Clustering', status: 'MOCK', description: 'Pipeline data needed' },
        { id: 'S-06', name: 'Permit Momentum', status: 'MOCK', description: 'Permits QoQ trend' },
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

  // Calculate stats
  const totalOutputs = sections.reduce((sum, section) => sum + section.outputs.length, 0);
  const realOutputs = sections.reduce(
    (sum, section) => sum + section.outputs.filter(o => o.status === 'REAL').length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-2">Overview Tab</h2>
        <p className="text-gray-600 mb-4">30-second market health check</p>
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

      {/* Output Sections */}
      {sections.map((section, idx) => (
        <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
          <div className="space-y-3">
            {section.outputs.map((output, outputIdx) => (
              <div key={outputIdx} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <span className="font-mono text-sm font-medium text-blue-600">{output.id}</span>
                    <span className="font-medium">{output.name}</span>
                    {getStatusBadge(output.status)}
                  </div>
                  <div className="text-sm text-gray-600">{output.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Placeholder for actual UI */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold mb-2">🚧 Phase 2: Component Build</h3>
        <p className="text-sm text-gray-700">
          This tab will be enhanced with actual UI components showing:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 mt-2 space-y-1">
          <li>Market Vitals Bar (6 key metrics)</li>
          <li>Data Coverage visualization</li>
          <li>5-Signal Health Bar with AI narrative</li>
          <li>Recent alerts and news</li>
          <li>Enhanced Supply Snapshot with 10-year wave chart</li>
        </ul>
      </div>
    </div>
  );
};

export default OverviewTab;
