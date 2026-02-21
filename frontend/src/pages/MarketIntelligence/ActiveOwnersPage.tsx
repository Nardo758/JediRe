import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OutputCard, { OutputSection } from './components/OutputCard';
import { SIGNAL_GROUPS } from './signalGroups';

const ActiveOwnersPage: React.FC = () => {
  const navigate = useNavigate();
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

  const dashboardOutputs = ['P-04', 'P-05', 'R-09'];
  const tableOutputs = ['P-04', 'R-07', 'R-09'];
  const profileOutputs = ['P-04', 'P-01', 'R-09', 'DC-06', 'DC-09'];
  const targetOutputs = ['P-01', 'P-04', 'P-05', 'R-09', 'S-01'];

  const mockOwners = [
    { name: 'Greystone Capital Partners LLC', properties: 4, units: 850, avgHold: 6.2, signal: 'SELL', motivation: 72, hasLandBank: true, markets: 'Atlanta, Charlotte' },
    { name: 'AIMCO', properties: 2, units: 520, avgHold: 3.1, signal: 'HOLD', motivation: 28, hasLandBank: false, markets: 'Atlanta' },
    { name: 'Mill Creek Residential', properties: 3, units: 420, avgHold: 4.5, signal: 'BUY', motivation: 58, hasLandBank: true, markets: 'Nashville, Tampa' },
    { name: 'Cortland Partners', properties: 5, units: 1200, avgHold: 5.8, signal: 'HOLD', motivation: 35, hasLandBank: false, markets: 'Atlanta, Nashville' },
    { name: 'Regional Capital Group', properties: 6, units: 1400, avgHold: 7.8, signal: 'SELL', motivation: 85, hasLandBank: true, markets: 'Atlanta, Charlotte, Tampa' },
  ];

  const signalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'bg-green-100 text-green-800';
      case 'SELL': return 'bg-red-100 text-red-800';
      case 'HOLD': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const filters = ['Hold Period', 'Owner Type', 'Units', 'Vintage', 'Markets', 'Motivation Score'];

  return (
    <div className="min-h-screen bg-gray-50">
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
                <h1 className="text-2xl font-bold text-gray-900">Active Owners</h1>
                <p className="text-sm text-gray-500 mt-0.5">Ownership intelligence</p>
              </div>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">10 outputs</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <OutputSection
          title="Activity Dashboard"
          description="P-04, P-05, R-09 + Municipal Deeds signals"
          outputIds={dashboardOutputs}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Tracked Owners', value: '~850', delta: '+12 this month', color: 'text-blue-600' },
              { label: 'Avg Motivation Score', value: '48/100', delta: '↑ 3pts MoM', color: 'text-amber-600' },
              { label: 'Recent Transactions', value: '23', delta: 'Last 90 days', color: 'text-green-600' },
              { label: 'Deed Signals', value: '7', delta: 'Active alerts', color: 'text-red-600' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] text-gray-400 mt-1">{stat.delta}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Dashboard Outputs ({dashboardOutputs.length} outputs)</p>
            <div className="flex flex-wrap gap-2">
              {dashboardOutputs.map(id => (
                <OutputCard key={id} outputId={id} compact />
              ))}
            </div>
          </div>
        </OutputSection>

        <OutputSection
          title="Owner Database Table"
          description="P-04, R-07, R-09 with BUY/HOLD/SELL signal column"
          outputIds={tableOutputs}
        >
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Owner</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Properties</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Units</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Avg Hold</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Signal</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Motivation</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Land Bank</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Markets</th>
                </tr>
              </thead>
              <tbody>
                {mockOwners.map((owner, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setExpandedOwner(expandedOwner === owner.name ? null : owner.name)}
                    className="border-t border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{owner.name}</td>
                    <td className="px-4 py-3 text-gray-600">{owner.properties}</td>
                    <td className="px-4 py-3 text-gray-600">{owner.units.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{owner.avgHold} yrs</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${signalColor(owner.signal)}`}>{owner.signal}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${owner.motivation >= 70 ? 'text-red-600' : owner.motivation >= 50 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {owner.motivation}/100
                      </span>
                    </td>
                    <td className="px-4 py-3">{owner.hasLandBank ? '✅' : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{owner.markets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OutputSection>

        <OutputSection
          title="Owner Detail Profile"
          description="Expandable view with portfolio map, timeline, AI assessment + DC-06, DC-09"
          outputIds={profileOutputs}
        >
          {mockOwners.slice(0, 2).map((owner, idx) => (
            <div key={idx} className="mb-4">
              <button
                onClick={() => setExpandedOwner(expandedOwner === owner.name ? null : owner.name)}
                className="w-full text-left bg-gray-50 rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-sm">
                      {owner.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{owner.name}</p>
                      <p className="text-xs text-gray-500">{owner.properties} properties · {owner.units.toLocaleString()} units · {owner.avgHold}yr avg hold</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${signalColor(owner.signal)}`}>{owner.signal}</span>
                </div>
              </button>
              {expandedOwner === owner.name && (
                <div className="mt-2 rounded-xl border border-gray-200 bg-white p-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg border border-dashed border-gray-200 h-48 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl mb-1">🗺️</div>
                        <p className="text-xs text-gray-400">Portfolio Map (Mapbox)</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg border border-dashed border-gray-200 h-48 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl mb-1">📅</div>
                        <p className="text-xs text-gray-400">Acquisition Timeline</p>
                      </div>
                    </div>
                    <div className="bg-violet-50 rounded-lg border border-violet-200 h-48 flex items-center justify-center p-4">
                      <div className="text-center">
                        <div className="text-2xl mb-1">🤖</div>
                        <p className="text-xs text-violet-600 font-medium">AI Assessment</p>
                        <p className="text-[10px] text-violet-500 mt-1">Powered by P-04, R-09, DC-06, DC-09</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profileOutputs.map(id => (
                      <OutputCard key={id} outputId={id} compact />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </OutputSection>

        <OutputSection
          title="Acquisition Target Generator"
          description="Filtered search with P-01, P-04, P-05, R-09, S-01"
          outputIds={targetOutputs}
        >
          <div className="flex flex-wrap gap-2 mb-6">
            {filters.map(f => (
              <div key={f} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-600">
                <span>{f}</span>
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            ))}
            <button className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Generate Targets
            </button>
          </div>
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 h-40 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-500 font-medium">Apply filters to generate acquisition targets</p>
              <p className="text-xs text-gray-400 mt-1">Results will show owners matching your criteria with motivation scores</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4 mt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Generator Outputs ({targetOutputs.length} outputs)</p>
            <div className="flex flex-wrap gap-2">
              {targetOutputs.map(id => (
                <OutputCard key={id} outputId={id} compact />
              ))}
            </div>
          </div>
        </OutputSection>
      </div>
    </div>
  );
};

export default ActiveOwnersPage;
