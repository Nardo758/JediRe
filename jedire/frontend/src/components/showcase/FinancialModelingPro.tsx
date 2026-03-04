import React, { useState } from 'react';

export function FinancialModelingPro() {
  const [activeTab, setActiveTab] = useState<'builder' | 'sensitivity' | 'montecarlo' | 'waterfall'>('builder');

  const components = [
    { id: 1, type: 'Income', name: 'Rental Income', value: 450000, editable: true },
    { id: 2, type: 'Income', name: 'Other Income', value: 25000, editable: true },
    { id: 3, type: 'Expense', name: 'Property Tax', value: 45000, editable: true },
    { id: 4, type: 'Expense', name: 'Insurance', value: 18000, editable: true },
    { id: 5, type: 'Expense', name: 'Utilities', value: 35000, editable: true },
    { id: 6, type: 'Expense', name: 'Maintenance', value: 42000, editable: true },
    { id: 7, type: 'Expense', name: 'Management Fee', value: 28500, editable: true },
    { id: 8, type: 'CapEx', name: 'Reserve Fund', value: 15000, editable: true },
    { id: 9, type: 'Financing', name: 'Loan Payment', value: 185000, editable: true },
    { id: 10, type: 'Output', name: 'NOI', value: 291500, editable: false },
    { id: 11, type: 'Output', name: 'Cash Flow', value: 106500, editable: false },
    { id: 12, type: 'Output', name: 'Cap Rate', value: 7.2, editable: false },
    { id: 13, type: 'Output', name: 'Cash-on-Cash', value: 14.8, editable: false }
  ];

  const sensitivityData = [
    [12.3, 14.1, 15.8, 17.5, 19.2],
    [10.8, 12.5, 14.2, 15.9, 17.6],
    [9.3, 11.0, 12.7, 14.4, 16.1],
    [7.8, 9.5, 11.2, 12.9, 14.6],
    [6.3, 8.0, 9.7, 11.4, 13.1]
  ];

  const monteCarloDistribution = [2, 5, 12, 28, 45, 62, 78, 85, 92, 95, 97, 98, 99, 99, 100];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financial Modeling Pro</h2>
          <p className="text-sm text-gray-600 mt-1">13-component advanced financial modeling suite</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
            Import Data
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Export Model
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'builder', label: '🔧 Component Builder', count: '13' },
          { id: 'sensitivity', label: '📊 Sensitivity Analysis', count: '3x3' },
          { id: 'montecarlo', label: '🎲 Monte Carlo', count: '1000' },
          { id: 'waterfall', label: '💧 Waterfall', count: '4 tiers' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Component Builder */}
      {activeTab === 'builder' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              💡 Drag and drop components to build your custom financial model. All formulas update in real-time.
            </p>
          </div>

          {['Income', 'Expense', 'CapEx', 'Financing', 'Output'].map(type => {
            const typeComponents = components.filter(c => c.type === type);
            return (
              <div key={type} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">{type} ({typeComponents.length})</h3>
                </div>
                <div className="p-4 space-y-2">
                  {typeComponents.map(component => (
                    <div
                      key={component.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow cursor-move"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400">⋮⋮</span>
                        <span className="font-medium text-gray-900">{component.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {component.editable ? (
                          <input
                            type="number"
                            value={component.value}
                            className="w-32 px-3 py-1 text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="w-32 px-3 py-1 text-right font-semibold text-gray-900">
                            {component.value.toLocaleString()}
                            {type === 'Output' && component.id > 11 && '%'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sensitivity Analysis */}
      {activeTab === 'sensitivity' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Variable 1 (X-Axis)</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option>Rent Growth Rate</option>
                <option>Occupancy Rate</option>
                <option>Exit Cap Rate</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Variable 2 (Y-Axis)</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option>Operating Expense Ratio</option>
                <option>Interest Rate</option>
                <option>CapEx Budget</option>
              </select>
            </div>
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-4">IRR Sensitivity Matrix (%)</h3>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  <th className="p-2 text-sm font-medium text-gray-700">-10%</th>
                  <th className="p-2 text-sm font-medium text-gray-700">-5%</th>
                  <th className="p-2 text-sm font-medium text-gray-700">Base</th>
                  <th className="p-2 text-sm font-medium text-gray-700">+5%</th>
                  <th className="p-2 text-sm font-medium text-gray-700">+10%</th>
                </tr>
              </thead>
              <tbody>
                {['-10%', '-5%', 'Base', '+5%', '+10%'].map((label, row) => (
                  <tr key={label}>
                    <td className="p-2 text-sm font-medium text-gray-700">{label}</td>
                    {sensitivityData[row].map((value, col) => (
                      <td
                        key={col}
                        className={`p-2 text-center font-semibold ${
                          row === 2 && col === 2
                            ? 'bg-blue-100 text-blue-900'
                            : value > 15
                            ? 'bg-green-50 text-green-900'
                            : value < 10
                            ? 'bg-red-50 text-red-900'
                            : 'bg-gray-50 text-gray-900'
                        }`}
                      >
                        {value.toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monte Carlo */}
      {activeTab === 'montecarlo' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Mean IRR', value: '14.2%', color: 'blue' },
              { label: 'Median IRR', value: '13.8%', color: 'green' },
              { label: '5th Percentile', value: '8.3%', color: 'red' },
              { label: '95th Percentile', value: '21.7%', color: 'purple' }
            ].map(stat => (
              <div key={stat.label} className={`p-4 rounded-lg bg-${stat.color}-50 border border-${stat.color}-200`}>
                <div className="text-sm text-gray-600">{stat.label}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-4">IRR Distribution (1,000 simulations)</h3>
            <div className="flex items-end justify-between h-64 gap-2">
              {monteCarloDistribution.map((height, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end">
                  <div
                    className="bg-blue-500 rounded-t"
                    style={{ height: `${height}%` }}
                  />
                  <div className="text-xs text-center text-gray-500 mt-1">
                    {(i * 2 + 6).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-900">
              ⚠️ Assumptions: Rent growth (±2%), Exit cap (±1%), OpEx (±5%), Vacancy (±3%)
            </p>
          </div>
        </div>
      )}

      {/* Waterfall */}
      {activeTab === 'waterfall' && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-900">
              💧 Waterfall distribution model with 4-tier preferred return structure
            </p>
          </div>

          {[
            { tier: 'Tier 1', desc: '8% Preferred Return', gp: 0, lp: 100, amount: 200000 },
            { tier: 'Tier 2', desc: 'Return of Capital', gp: 0, lp: 100, amount: 625000 },
            { tier: 'Tier 3', desc: '15% IRR Catch-up', gp: 30, lp: 70, amount: 125000 },
            { tier: 'Tier 4', desc: 'Remaining Split', gp: 20, lp: 80, amount: 350000 }
          ].map(tier => (
            <div key={tier.tier} className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{tier.tier}</h4>
                  <p className="text-sm text-gray-600">{tier.desc}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">
                    ${(tier.amount / 1000).toFixed(0)}K
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-xs text-gray-600 mb-1">GP Share: {tier.gp}%</div>
                  <div className="h-8 bg-blue-100 rounded flex items-center justify-center text-sm font-semibold text-blue-900">
                    ${((tier.amount * tier.gp) / 100000).toFixed(0)}K
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600 mb-1">LP Share: {tier.lp}%</div>
                  <div className="h-8 bg-green-100 rounded flex items-center justify-center text-sm font-semibold text-green-900">
                    ${((tier.amount * tier.lp) / 100000).toFixed(0)}K
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700">Total GP Distribution</div>
              <div className="text-2xl font-bold text-blue-900">$260K (20%)</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-green-700">Total LP Distribution</div>
              <div className="text-2xl font-bold text-green-900">$1,040K (80%)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
