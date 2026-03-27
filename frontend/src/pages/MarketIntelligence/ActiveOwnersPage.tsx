import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BT } from '@/components/deal/bloomberg-ui';
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

  const signalStyle = (signal: string): { background: string; color: string } => {
    switch (signal) {
      case 'BUY': return { background: `${BT.text.green}22`, color: BT.text.green };
      case 'SELL': return { background: `${BT.text.red}22`, color: BT.text.red };
      case 'SELL?': return { background: `${BT.text.amber}22`, color: BT.text.amber };
      case 'HOLD': return { background: `${BT.text.cyan}22`, color: BT.text.secondary };
      default: return { background: `${BT.text.cyan}22`, color: BT.text.secondary };
    }
  };

  return (
    <div className="min-h-screen" style={{ background: BT.bg.panel }}>
      <div style={{ background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/terminal', { state: { fkey: 'F4' } })} className="p-2 transition-colors" style={{ borderRadius: 0 }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: BT.text.primary }}>Active Owners</h1>
                <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>Across 6 markets | 4,280 properties | 892,400 units | 2,840 unique owners</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} className="px-3 py-1.5 text-sm" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, color: BT.text.primary, background: BT.bg.panel }}>
              <option>All Markets</option>
              <option>Atlanta</option>
              <option>Charlotte</option>
              <option>Nashville</option>
              <option>Tampa</option>
              <option>Raleigh</option>
              <option>Dallas</option>
            </select>
            <select value={ownerTypeFilter} onChange={(e) => setOwnerTypeFilter(e.target.value)} className="px-3 py-1.5 text-sm" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, color: BT.text.primary, background: BT.bg.panel }}>
              <option>All Types</option>
              <option>REIT</option>
              <option>PE</option>
              <option>Regional</option>
              <option>Estate</option>
              <option>National</option>
            </select>
            <select value={holdPeriodFilter} onChange={(e) => setHoldPeriodFilter(e.target.value)} className="px-3 py-1.5 text-sm" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, color: BT.text.primary, background: BT.bg.panel }}>
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
              className="px-3 py-1.5 text-sm w-48"
              style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, color: BT.text.primary, background: BT.bg.panel }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="overflow-hidden" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>Activity Dashboard</h3>
            <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>Sources: P-04, P-05, R-09</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0" style={{ borderColor: BT.border.subtle }}>
            <div className="p-6" style={{ borderRight: `1px solid ${BT.border.subtle}` }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📤</span>
                <h4 className="font-semibold" style={{ color: BT.text.primary }}>SELLER SIGNALS</h4>
              </div>
              <p className="text-3xl font-bold mb-1" style={{ color: BT.text.red }}>428</p>
              <p className="text-sm mb-3" style={{ color: BT.text.secondary }}>properties likely motivated, 82,400 units</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-[10px] font-mono px-1.5 py-0.5" style={{ color: BT.text.muted, background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>P-04</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5" style={{ color: BT.text.muted, background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>P-05</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5" style={{ color: BT.text.muted, background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>R-09</span>
              </div>
              <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: `${BT.text.red}22`, border: `1px solid ${BT.text.red}44`, color: BT.text.red, borderRadius: 0 }}>View Seller Target List</button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📥</span>
                <h4 className="font-semibold" style={{ color: BT.text.primary }}>BUYER SIGNALS</h4>
              </div>
              <p className="text-3xl font-bold mb-1" style={{ color: BT.text.green }}>86</p>
              <p className="text-sm mb-1" style={{ color: BT.text.secondary }}>entities active (12mo), 124 txns, 28,400 units traded</p>
              <p className="text-sm mb-3" style={{ color: BT.text.secondary }}>Top: <span className="font-semibold" style={{ color: BT.text.primary }}>Cortland</span> (4 deals, 1,800u)</p>
              <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: `${BT.text.green}22`, border: `1px solid ${BT.text.green}44`, color: BT.text.green, borderRadius: 0 }}>View Buyer Activity Log</button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>Owner Database</h3>
            <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>Signal: BUY = acquired in 12mo | HOLD = no txn {'<'}5yr | SELL? = {'>'}6yr + debt maturity | SELL = {'>'}8yr / estate / listed</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: BT.bg.panel }}>
                  <th className="px-4 py-3 text-left font-semibold text-xs" style={{ color: BT.text.secondary }}>Owner</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs" style={{ color: BT.text.secondary }}>Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs" style={{ color: BT.text.secondary }}>Markets</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs" style={{ color: BT.text.secondary }}>Props</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs" style={{ color: BT.text.secondary }}>Units</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs" style={{ color: BT.text.secondary }}>Hold</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs" style={{ color: BT.text.secondary }}>Signal</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="inline-block animate-spin h-6 w-6 mb-2" style={{ borderRadius: '50%', borderBottom: `2px solid ${BT.text.cyan}` }}></div>
                      <p className="text-sm" style={{ color: BT.text.secondary }}>Loading owners...</p>
                    </td>
                  </tr>
                ) : owners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center" style={{ color: BT.text.secondary }}>
                      No owners found
                    </td>
                  </tr>
                ) : owners.map((owner, idx) => (
                  <React.Fragment key={idx}>
                    <tr
                      onClick={() => setExpandedOwner(expandedOwner === owner.name ? null : owner.name)}
                      className="cursor-pointer transition-colors"
                      style={{ borderTop: `1px solid ${BT.border.subtle}` }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: BT.text.primary }}>{owner.name}</td>
                      <td className="px-4 py-3" style={{ color: BT.text.secondary }}>{owner.type}</td>
                      <td className="px-4 py-3" style={{ color: BT.text.secondary }}>{owner.marketsStr}</td>
                      <td className="px-4 py-3" style={{ color: BT.text.secondary }}>{owner.props}</td>
                      <td className="px-4 py-3" style={{ color: BT.text.secondary }}>{owner.units.toLocaleString()}</td>
                      <td className="px-4 py-3" style={{ color: BT.text.secondary }}>{owner.hold}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs font-bold" style={{ ...signalStyle(owner.signal), borderRadius: 0 }}>{owner.signal}</span>
                      </td>
                    </tr>
                    {expandedOwner === owner.name && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="p-6 space-y-6" style={{ background: BT.bg.panel, borderTop: `1px solid ${BT.border.subtle}` }}>
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-lg font-bold" style={{ color: BT.text.primary }}>{owner.name.toUpperCase()}</h4>
                                <p className="text-sm" style={{ color: BT.text.secondary }}>{owner.type} | {owner.marketsStr} markets | {owner.units.toLocaleString()} units</p>
                              </div>
                              <span className="px-3 py-1 text-sm font-bold" style={{ ...signalStyle(owner.signal), borderRadius: 0 }}>{owner.signal}</span>
                            </div>

                            <div className="h-40 flex items-center justify-center" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px dashed ${BT.border.subtle}` }}>
                              <div className="text-center">
                                <div className="text-2xl mb-1">🗺️</div>
                                <p className="text-xs" style={{ color: BT.text.muted }}>Portfolio Map — {owner.props} properties</p>
                              </div>
                            </div>

                            <div>
                              <h5 className="text-sm font-bold mb-2" style={{ color: BT.text.primary }}>PROPERTY LIST</h5>
                              {portfolioLoading ? (
                                <div className="text-center py-8">
                                  <div className="inline-block animate-spin h-6 w-6 mb-2" style={{ borderRadius: '50%', borderBottom: `2px solid ${BT.text.cyan}` }}></div>
                                  <p className="text-sm" style={{ color: BT.text.secondary }}>Loading portfolio...</p>
                                </div>
                              ) : portfolioProperties.length === 0 ? (
                                <p className="text-sm py-4" style={{ color: BT.text.secondary }}>No properties found</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr style={{ background: BT.bg.panel }}>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.secondary }}>Property</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.secondary }}>Market</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.secondary }}>Units</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.secondary }}>Purchased</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.secondary }}>Hold</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.secondary }}>Price</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.secondary }}>$/Unit</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.secondary }}>Signal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {portfolioProperties.map((prop, pIdx) => (
                                      <tr key={pIdx} style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                                        <td className="px-3 py-2 font-medium" style={{ color: BT.text.primary }}>{prop.name}</td>
                                        <td className="px-3 py-2" style={{ color: BT.text.secondary }}>{prop.market}</td>
                                        <td className="px-3 py-2" style={{ color: BT.text.secondary }}>{prop.units}</td>
                                        <td className="px-3 py-2" style={{ color: BT.text.secondary }}>{prop.purchased}</td>
                                        <td className="px-3 py-2" style={{ color: BT.text.secondary }}>{prop.hold}</td>
                                        <td className="px-3 py-2" style={{ color: BT.text.secondary }}>{prop.price}</td>
                                        <td className="px-3 py-2" style={{ color: BT.text.secondary }}>{prop.perUnit}</td>
                                        <td className="px-3 py-2">
                                          <span className="px-1.5 py-0.5 text-[10px] font-bold" style={{ ...signalStyle(prop.signal), borderRadius: 0 }}>{prop.signal}</span>
                                        </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <div>
                              <h5 className="text-sm font-bold mb-2" style={{ color: BT.text.primary }}>★ DEVELOPER LAND POSITIONS (DC-09)</h5>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr style={{ background: `${BT.text.purple}22` }}>
                                      <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.purple }}>Parcel</th>
                                      <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.purple }}>Acres</th>
                                      <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.purple }}>Capacity</th>
                                      <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.purple }}>DC-06 Probability</th>
                                      <th className="px-3 py-2 text-left font-semibold" style={{ color: BT.text.purple }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {greystoneLandPositions.map((land, lIdx) => (
                                      <tr key={lIdx} style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                                        <td className="px-3 py-2 font-medium" style={{ color: BT.text.primary }}>{land.parcel}</td>
                                        <td className="px-3 py-2" style={{ color: BT.text.secondary }}>{land.acres}</td>
                                        <td className="px-3 py-2" style={{ color: BT.text.secondary }}>{land.capacity}</td>
                                        <td className="px-3 py-2 font-bold" style={{ color: BT.text.purple }}>{land.dcProbability}</td>
                                        <td className="px-3 py-2">
                                          <span className="text-[10px] font-medium px-2 py-0.5" style={{ color: BT.text.purple, background: `${BT.text.purple}22`, borderRadius: 0 }}>{land.status}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div>
                              <h5 className="text-sm font-bold mb-3" style={{ color: BT.text.primary }}>ACQUISITION TIMELINE</h5>
                              <div className="relative h-12 overflow-hidden" style={{ background: BT.bg.panel, borderRadius: 0 }}>
                                <div className="absolute inset-0 flex items-center px-4">
                                  <div className="w-full h-0.5 relative" style={{ background: BT.border.subtle }}>
                                    {[
                                      { year: 2017, pos: '5%' },
                                      { year: 2018, pos: '18%' },
                                      { year: 2019, pos: '35%' },
                                      { year: 2020, pos: '50%' },
                                      { year: 2021, pos: '65%' },
                                    ].map((dot, dIdx) => (
                                      <div key={dIdx} className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: dot.pos }}>
                                        <div className="w-3 h-3" style={{ background: BT.text.cyan, borderRadius: '50%', border: `2px solid ${BT.bg.panel}` }}></div>
                                        <span className="text-[9px] mt-1" style={{ color: BT.text.secondary }}>{dot.year}</span>
                                      </div>
                                    ))}
                                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px]" style={{ color: BT.text.muted }}>2025</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="p-4" style={{ background: `${BT.text.purple}22`, border: `1px solid ${BT.text.purple}44`, borderRadius: 0 }}>
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-lg">🤖</span>
                                <h5 className="font-semibold" style={{ color: BT.text.primary }}>AI ASSESSMENT</h5>
                              </div>
                              <div className="text-sm space-y-2" style={{ color: BT.text.primary }}>
                                <p>{owner.name} is showing <span className="font-bold">{owner.signal === 'SELL' || owner.signal === 'SELL?' ? 'exit signals' : owner.signal === 'BUY' ? 'expansion activity' : 'stable holding patterns'}</span>.
                                With {owner.props} properties and {owner.units.toLocaleString()} units across {owner.marketsStr} markets, their average hold period of {owner.hold} suggests {
                                  owner.signal === 'SELL' ? 'strong exit pressure from long hold periods' :
                                  owner.signal === 'SELL?' ? 'potential exit pressure approaching typical hold thresholds' :
                                  owner.signal === 'BUY' ? 'active acquisition mode with recent purchases' :
                                  'stable portfolio management with moderate hold periods'
                                }.</p>
                                <p className="font-bold" style={{ color: BT.text.purple }}>
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
                              <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}>Contact Owner</button>
                              <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, borderRadius: 0 }}>Add to Pipeline</button>
                              <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, borderRadius: 0 }}>Export Profile</button>
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

        <div className="overflow-hidden" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>Acquisition Target Generator</h3>
            <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>Filter and generate motivated seller lists</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: BT.text.secondary }}>Hold Period</label>
                <select className="w-full px-3 py-2 text-sm" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, color: BT.text.primary, background: BT.bg.panel }}>
                  <option>&gt;7 years</option>
                  <option>&gt;5 years</option>
                  <option>&gt;10 years</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: BT.text.secondary }}>Owner Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {['REIT', 'PE', 'Regional', 'Estate'].map(t => (
                    <label key={t} className="flex items-center gap-1 text-xs" style={{ color: BT.text.secondary }}>
                      <input type="checkbox" defaultChecked style={{ borderColor: BT.border.subtle, borderRadius: 0 }} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: BT.text.secondary }}>Unit Count</label>
                <select className="w-full px-3 py-2 text-sm" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, color: BT.text.primary, background: BT.bg.panel }}>
                  <option>100-400</option>
                  <option>50-100</option>
                  <option>400+</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: BT.text.secondary }}>Vintage</label>
                <select className="w-full px-3 py-2 text-sm" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, color: BT.text.primary, background: BT.bg.panel }}>
                  <option>1980-2000</option>
                  <option>1970-1990</option>
                  <option>2000-2010</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: BT.text.secondary }}>Markets</label>
                <div className="flex flex-wrap gap-1.5">
                  {['ATL', 'CLT', 'NSH', 'TPA', 'RAL', 'DAL'].map(t => (
                    <label key={t} className="flex items-center gap-1 text-xs" style={{ color: BT.text.secondary }}>
                      <input type="checkbox" defaultChecked style={{ borderColor: BT.border.subtle, borderRadius: 0 }} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: BT.text.secondary }}>Motivation</label>
                <select className="w-full px-3 py-2 text-sm" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, color: BT.text.primary, background: BT.bg.panel }}>
                  <option>&gt;65</option>
                  <option>&gt;50</option>
                  <option>&gt;75</option>
                </select>
              </div>
            </div>

            <button className="px-6 py-2.5 text-sm font-medium transition-colors mb-6" style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}>Generate Target List</button>

            <div className="p-5" style={{ background: `${BT.text.green}22`, border: `1px solid ${BT.text.green}44`, borderRadius: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-lg font-bold" style={{ color: BT.text.primary }}>87 properties | 18,200 units</p>
                  <p className="text-sm" style={{ color: BT.text.secondary }}>Est. market value: $3.1B</p>
                </div>
                <span className="text-2xl">🎯</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, borderRadius: 0 }}>View Full List</button>
                <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, borderRadius: 0 }}>Export for Outreach</button>
                <button className="px-4 py-2 text-sm font-medium transition-colors" style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}>Add All to Pipeline Intake</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveOwnersPage;
