import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SIGNAL_GROUPS } from './signalGroups';

const ActiveOwnersPage: React.FC = () => {
  const navigate = useNavigate();
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [marketFilter, setMarketFilter] = useState('All Markets');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState('All Types');
  const [holdPeriodFilter, setHoldPeriodFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioProperties, setPortfolioProperties] = useState<any[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  useEffect(() => {
    const fetchOwners = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/markets/atlanta/owners?minProperties=2');
        const data = await res.json();
        setOwners(data.owners || []);
      } catch (err) {
        console.error('Failed to fetch owners:', err);
        setOwners([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOwners();
  }, []);

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!expandedOwner) {
        setPortfolioProperties([]);
        return;
      }
      
      setPortfolioLoading(true);
      try {
        const res = await fetch(`/api/v1/markets/owners/${encodeURIComponent(expandedOwner)}/portfolio`);
        const data = await res.json();
        setPortfolioProperties(data.properties || []);
      } catch (err) {
        console.error('Failed to fetch owner portfolio:', err);
        setPortfolioProperties([]);
      } finally {
        setPortfolioLoading(false);
      }
    };
    fetchPortfolio();
  }, [expandedOwner]);

  const greystoneLandPositions = [
    { parcel: 'Parcel A — Midtown ATL', acres: 4.2, capacity: '380 units', dcProbability: '72%', status: 'Entitled' },
    { parcel: 'Parcel B — SouthEnd CLT', acres: 2.8, capacity: '220 units', dcProbability: '58%', status: 'Pre-zoning' },
  ];

  const signalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'bg-green-100 text-green-800';
      case 'SELL': return 'bg-red-100 text-red-800';
      case 'SELL?': return 'bg-amber-100 text-amber-800';
      case 'HOLD': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/market-intelligence')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Active Owners</h1>
                <p className="text-sm text-gray-500 mt-0.5">Across 6 markets | 4,280 properties | 892,400 units | 2,840 unique owners</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
              <option>All Markets</option>
              <option>Atlanta</option>
              <option>Charlotte</option>
              <option>Nashville</option>
              <option>Tampa</option>
              <option>Raleigh</option>
              <option>Dallas</option>
            </select>
            <select value={ownerTypeFilter} onChange={(e) => setOwnerTypeFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
              <option>All Types</option>
              <option>REIT</option>
              <option>PE</option>
              <option>Regional</option>
              <option>Estate</option>
              <option>National</option>
            </select>
            <select value={holdPeriodFilter} onChange={(e) => setHoldPeriodFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
              <option>All</option>
              <option>&gt;3 years</option>
              <option>&gt;5 years</option>
              <option>&gt;7 years</option>
              <option>&gt;10 years</option>
            </select>
            <input
              type="text"
              placeholder="Search Owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white w-48"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Activity Dashboard</h3>
            <p className="text-sm text-gray-500 mt-0.5">Sources: P-04, P-05, R-09</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📤</span>
                <h4 className="font-semibold text-gray-900">SELLER SIGNALS</h4>
              </div>
              <p className="text-3xl font-bold text-red-600 mb-1">428</p>
              <p className="text-sm text-gray-600 mb-3">properties likely motivated, 82,400 units</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">P-04</span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">P-05</span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">R-09</span>
              </div>
              <button className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">View Seller Target List</button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📥</span>
                <h4 className="font-semibold text-gray-900">BUYER SIGNALS</h4>
              </div>
              <p className="text-3xl font-bold text-green-600 mb-1">86</p>
              <p className="text-sm text-gray-600 mb-1">entities active (12mo), 124 txns, 28,400 units traded</p>
              <p className="text-sm text-gray-500 mb-3">Top: <span className="font-semibold text-gray-700">Cortland</span> (4 deals, 1,800u)</p>
              <button className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">View Buyer Activity Log</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Owner Database</h3>
            <p className="text-sm text-gray-500 mt-0.5">Signal: BUY = acquired in 12mo | HOLD = no txn {'<'}5yr | SELL? = {'>'}6yr + debt maturity | SELL = {'>'}8yr / estate / listed</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Owner</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Markets</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Props</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Units</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Hold</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Signal</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mb-2"></div>
                      <p className="text-sm text-gray-500">Loading owners...</p>
                    </td>
                  </tr>
                ) : owners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No owners found
                    </td>
                  </tr>
                ) : owners.map((owner, idx) => (
                  <React.Fragment key={idx}>
                    <tr
                      onClick={() => setExpandedOwner(expandedOwner === owner.name ? null : owner.name)}
                      className="border-t border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{owner.name}</td>
                      <td className="px-4 py-3 text-gray-600">{owner.type}</td>
                      <td className="px-4 py-3 text-gray-600">{owner.marketsStr}</td>
                      <td className="px-4 py-3 text-gray-600">{owner.props}</td>
                      <td className="px-4 py-3 text-gray-600">{owner.units.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600">{owner.hold}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${signalColor(owner.signal)}`}>{owner.signal}</span>
                      </td>
                    </tr>
                    {expandedOwner === owner.name && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="bg-gray-50 border-t border-gray-200 p-6 space-y-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-lg font-bold text-gray-900">{owner.name.toUpperCase()}</h4>
                                <p className="text-sm text-gray-500">{owner.type} | {owner.marketsStr} markets | {owner.units.toLocaleString()} units</p>
                              </div>
                              <span className={`px-3 py-1 rounded-lg text-sm font-bold ${signalColor(owner.signal)}`}>{owner.signal}</span>
                            </div>

                            <div className="bg-white rounded-xl border border-dashed border-gray-200 h-40 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-2xl mb-1">🗺️</div>
                                <p className="text-xs text-gray-400">Portfolio Map — {owner.props} properties</p>
                              </div>
                            </div>

                            <div>
                              <h5 className="text-sm font-bold text-gray-700 mb-2">PROPERTY LIST</h5>
                              {portfolioLoading ? (
                                <div className="text-center py-8">
                                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mb-2"></div>
                                  <p className="text-sm text-gray-500">Loading portfolio...</p>
                                </div>
                              ) : portfolioProperties.length === 0 ? (
                                <p className="text-sm text-gray-500 py-4">No properties found</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-gray-100">
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Property</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Market</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Units</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Purchased</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Hold</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Price</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">$/Unit</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Signal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {portfolioProperties.map((prop, pIdx) => (
                                      <tr key={pIdx} className="border-t border-gray-100">
                                        <td className="px-3 py-2 font-medium text-gray-900">{prop.name}</td>
                                        <td className="px-3 py-2 text-gray-600">{prop.market}</td>
                                        <td className="px-3 py-2 text-gray-600">{prop.units}</td>
                                        <td className="px-3 py-2 text-gray-600">{prop.purchased}</td>
                                        <td className="px-3 py-2 text-gray-600">{prop.hold}</td>
                                        <td className="px-3 py-2 text-gray-600">{prop.price}</td>
                                        <td className="px-3 py-2 text-gray-600">{prop.perUnit}</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${signalColor(prop.signal)}`}>{prop.signal}</span>
                                        </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <div>
                              <h5 className="text-sm font-bold text-gray-700 mb-2">★ DEVELOPER LAND POSITIONS (DC-09)</h5>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-violet-50">
                                      <th className="px-3 py-2 text-left font-semibold text-violet-700">Parcel</th>
                                      <th className="px-3 py-2 text-left font-semibold text-violet-700">Acres</th>
                                      <th className="px-3 py-2 text-left font-semibold text-violet-700">Capacity</th>
                                      <th className="px-3 py-2 text-left font-semibold text-violet-700">DC-06 Probability</th>
                                      <th className="px-3 py-2 text-left font-semibold text-violet-700">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {greystoneLandPositions.map((land, lIdx) => (
                                      <tr key={lIdx} className="border-t border-violet-100">
                                        <td className="px-3 py-2 font-medium text-gray-900">{land.parcel}</td>
                                        <td className="px-3 py-2 text-gray-600">{land.acres}</td>
                                        <td className="px-3 py-2 text-gray-600">{land.capacity}</td>
                                        <td className="px-3 py-2 font-bold text-violet-700">{land.dcProbability}</td>
                                        <td className="px-3 py-2">
                                          <span className="text-[10px] font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{land.status}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div>
                              <h5 className="text-sm font-bold text-gray-700 mb-3">ACQUISITION TIMELINE</h5>
                              <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                                <div className="absolute inset-0 flex items-center px-4">
                                  <div className="w-full h-0.5 bg-gray-300 relative">
                                    {[
                                      { year: 2017, pos: '5%' },
                                      { year: 2018, pos: '18%' },
                                      { year: 2019, pos: '35%' },
                                      { year: 2020, pos: '50%' },
                                      { year: 2021, pos: '65%' },
                                    ].map((dot, dIdx) => (
                                      <div key={dIdx} className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: dot.pos }}>
                                        <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow"></div>
                                        <span className="text-[9px] text-gray-500 mt-1">{dot.year}</span>
                                      </div>
                                    ))}
                                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">2025</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-lg">🤖</span>
                                <h5 className="font-semibold text-gray-900">AI ASSESSMENT</h5>
                              </div>
                              <div className="text-sm text-gray-700 space-y-2">
                                <p>{owner.name} is showing <span className="font-bold">{owner.signal === 'SELL' || owner.signal === 'SELL?' ? 'exit signals' : owner.signal === 'BUY' ? 'expansion activity' : 'stable holding patterns'}</span>. 
                                With {owner.props} properties and {owner.units.toLocaleString()} units across {owner.marketsStr} markets, their average hold period of {owner.hold} suggests {
                                  owner.signal === 'SELL' ? 'strong exit pressure from long hold periods' :
                                  owner.signal === 'SELL?' ? 'potential exit pressure approaching typical hold thresholds' :
                                  owner.signal === 'BUY' ? 'active acquisition mode with recent purchases' :
                                  'stable portfolio management with moderate hold periods'
                                }.</p>
                                <p className="font-bold text-violet-800">
                                  {owner.signal === 'SELL' || owner.signal === 'SELL?' 
                                    ? `Recommendation: Approach with portfolio offer. Position as clean exit opportunity.`
                                    : owner.signal === 'BUY'
                                    ? `Recommendation: Monitor for partnership opportunities as they continue expansion.`
                                    : `Recommendation: Track for future opportunities as portfolio matures.`
                                  }
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Contact Owner</button>
                              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Add to Pipeline</button>
                              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Export Profile</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Acquisition Target Generator</h3>
            <p className="text-sm text-gray-500 mt-0.5">Filter and generate motivated seller lists</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Hold Period</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                  <option>&gt;7 years</option>
                  <option>&gt;5 years</option>
                  <option>&gt;10 years</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Owner Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {['REIT', 'PE', 'Regional', 'Estate'].map(t => (
                    <label key={t} className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Unit Count</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                  <option>100-400</option>
                  <option>50-100</option>
                  <option>400+</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Vintage</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                  <option>1980-2000</option>
                  <option>1970-1990</option>
                  <option>2000-2010</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Markets</label>
                <div className="flex flex-wrap gap-1.5">
                  {['ATL', 'CLT', 'NSH', 'TPA', 'RAL', 'DAL'].map(t => (
                    <label key={t} className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Motivation</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                  <option>&gt;65</option>
                  <option>&gt;50</option>
                  <option>&gt;75</option>
                </select>
              </div>
            </div>

            <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors mb-6">Generate Target List</button>

            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-lg font-bold text-gray-900">87 properties | 18,200 units</p>
                  <p className="text-sm text-gray-600">Est. market value: $3.1B</p>
                </div>
                <span className="text-2xl">🎯</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">View Full List</button>
                <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Export for Outreach</button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Add All to Pipeline Intake</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveOwnersPage;
