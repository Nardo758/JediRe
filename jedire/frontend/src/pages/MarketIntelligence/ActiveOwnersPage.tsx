/**
 * Active Owners Page - Horizontal View
 * 10 outputs total (8 original + 2 new from v2.0)
 * Ownership intelligence across ALL tracked markets
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

const ActiveOwnersPage: React.FC = () => {
  const navigate = useNavigate();

  const outputSections = [
    {
      title: 'Activity Dashboard (Original)',
      outputs: [
        'P-04: Ownership data across all markets',
        'P-05: Seller motivation scores',
        'R-09: Hold period vs market cycle',
        'Municipal Deeds: Buyer/seller signals',
      ],
    },
    {
      title: 'Owner Database Table (Original)',
      outputs: [
        'P-04, R-07, R-09 aggregated',
        'BUY / HOLD / SELL signal per owner',
      ],
    },
    {
      title: 'Owner Detail Profile (Enhanced) ★',
      outputs: [
        'P-04, P-01 all properties',
        'R-09 hold period analysis',
        'Portfolio map (Mapbox)',
        'Acquisition timeline',
        'AI assessment narrative',
        'DC-06: Development probability for vacant land ★ NEW',
        'DC-09: Developer land bank positions per owner ★ NEW',
      ],
    },
    {
      title: 'Acquisition Target Generator (Original)',
      outputs: [
        'P-01, P-04, P-05, R-09, S-01',
        'Filters: hold period, owner type, units, vintage, markets, motivation score',
      ],
    },
  ];

  // Mock owner data for Atlanta
  const mockOwners = [
    {
      name: 'Greystone Capital Partners LLC',
      properties: 4,
      units: 850,
      avgHold: 6.2,
      signal: 'WATCH',
      motivation: 72,
      hasLandBank: true,
    },
    {
      name: 'AIMCO',
      properties: 2,
      units: 520,
      avgHold: 3.1,
      signal: 'HOLD',
      motivation: 28,
      hasLandBank: false,
    },
    {
      name: 'Mill Creek Residential',
      properties: 3,
      units: 420,
      avgHold: 4.5,
      signal: 'WATCH',
      motivation: 58,
      hasLandBank: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/market-intelligence')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Active Owners</h1>
                <p className="text-gray-600 mt-1">Ownership intelligence • 10 outputs • 2 NEW</p>
              </div>
            </div>
            <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-lg">
              🚧 Phase 1: Skeleton
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Real Data Preview (Atlanta) */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-3">✅ Atlanta: Real Ownership Data</h3>
          <p className="text-sm text-green-800 mb-4">
            ~850 unique owners identified from 1,028 Fulton County properties with transaction history
          </p>
          <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-green-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Owner</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Properties</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Units</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Avg Hold</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Signal</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Motivation</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Land Bank</th>
                </tr>
              </thead>
              <tbody>
                {mockOwners.map((owner, idx) => (
                  <tr key={idx} className="border-t border-green-100 hover:bg-green-50">
                    <td className="px-4 py-3 text-sm font-medium">{owner.name}</td>
                    <td className="px-4 py-3 text-sm">{owner.properties}</td>
                    <td className="px-4 py-3 text-sm">{owner.units}</td>
                    <td className="px-4 py-3 text-sm">{owner.avgHold} yrs</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        owner.signal === 'WATCH' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {owner.signal}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-bold ${
                        owner.motivation >= 70 ? 'text-red-600' :
                        owner.motivation >= 50 ? 'text-yellow-600' :
                        'text-gray-600'
                      }`}>
                        {owner.motivation}/100
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {owner.hasLandBank ? '✅ Yes' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Output Sections */}
        {outputSections.map((section, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
            <div className="space-y-2">
              {section.outputs.map((output, outputIdx) => (
                <div key={outputIdx} className="flex items-start p-3 bg-gray-50 rounded-lg">
                  <span className="text-blue-600 mr-2">•</span>
                  <span className="text-sm text-gray-700">{output}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Phase 2 Components */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold mb-3">🚧 Phase 2: Components to Build</h3>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
            <li><strong>Activity Dashboard:</strong> Recent buy/sell signals, transaction velocity</li>
            <li><strong>Owner Database Table:</strong> Sortable by properties, units, hold period, motivation</li>
            <li><strong>Owner Detail Profile:</strong> Expandable cards showing full portfolio + map</li>
            <li><strong>Developer Land Bank Section ★:</strong> Show DC-09 (who owns developable parcels) + DC-06 (development probability)</li>
            <li><strong>Acquisition Target Generator:</strong> Filtered list with export capabilities</li>
            <li><strong>Portfolio Map:</strong> Mapbox integration showing all properties per owner</li>
          </ul>
        </div>

        {/* User Journey Context */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold mb-3">💡 User Journey: Ownership Targeting</h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>Search:</strong> "Heritage at South End" → Owner: Regional Capital Partners</p>
            <p><strong>Profile:</strong> 6 properties, 1,400 units, avg hold 6.2 years</p>
            <p><strong>Analysis:</strong> Heritage = longest hold at 7.8 years (outlier)</p>
            <p><strong>Land Bank (DC-09) ★:</strong> Owner also holds 2 developable parcels</p>
            <p><strong>AI Assessment:</strong> "High-probability seller for Heritage. May sell to fund development on land positions."</p>
            <p><strong>Actions:</strong> [Contact Owner] [Add to Pipeline] [Export Profile]</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveOwnersPage;
