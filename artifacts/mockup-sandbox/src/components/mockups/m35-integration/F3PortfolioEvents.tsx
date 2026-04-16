import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight,
  Filter, 
  AlertCircle, 
  Calendar, 
  TrendingUp,
  Activity,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  Train,
  FileText,
  Wind,
  Building,
  GraduationCap,
  Zap
} from 'lucide-react';

const EVENTS = [
  { id: 1, severity: 'red', icon: Megaphone, name: 'Amazon HQ2 Tampa', scope: 'MSA', status: 'FIRED T+8mo', deals: 4, dealsList: ['Tampa Bay Logistics', 'Westshore Office', 'Channel District MF', 'Ybor Mixed-Use'], impact: '+1.4pp avg', forecast: 'AHEAD', forecastStatus: 'good' },
  { id: 2, severity: 'yellow', icon: Train, name: 'BRT Phase 2 Tampa', scope: 'Submarket', status: 'PENDING T-4mo', deals: 2, dealsList: ['Kennedy Blvd MF', 'Downtown Edge'], impact: '+0.8pp', forecast: 'PENDING', forecastStatus: 'neutral' },
  { id: 3, severity: 'yellow', icon: FileText, name: 'FL Insurance Rate Cap', scope: 'State', status: 'T+2mo', deals: 8, dealsList: ['All Florida Assets'], impact: '-4% expense', forecast: 'PENDING', forecastStatus: 'neutral' },
  { id: 4, severity: 'red', icon: Wind, name: 'Hurricane Idalia Recovery', scope: 'MSA', status: 'FIRED T+14mo', deals: 3, dealsList: ['St Pete Coastal', 'Clearwater MF', 'Tampa Port'], impact: '-0.3pp', forecast: 'BEHIND', forecastStatus: 'bad' },
  { id: 5, severity: 'green', icon: Megaphone, name: 'Apple Campus Raleigh', scope: 'MSA', status: 'FIRED T+6mo', deals: 2, dealsList: ['Raleigh Tech Park', 'RTP Housing'], impact: '+1.1pp', forecast: 'AHEAD', forecastStatus: 'good' },
  { id: 6, severity: 'yellow', icon: Building, name: 'Blackstone Market Entry', scope: 'Submarket', status: 'FIRED T-6mo', deals: 1, dealsList: ['South Tampa Industrial'], impact: '+0.4pp', forecast: 'ON PACE', forecastStatus: 'neutral' },
  { id: 7, severity: 'green', icon: GraduationCap, name: 'USF Med School Expansion', scope: 'Submarket', status: 'FIRED T-10mo', deals: 2, dealsList: ['USF Student Housing', 'Medical District Office'], impact: '+0.6pp', forecast: 'ON PACE', forecastStatus: 'neutral' },
  { id: 8, severity: 'yellow', icon: FileText, name: 'Zoning Upzone Vote — Ybor', scope: 'Property', status: 'T+1mo', deals: 1, dealsList: ['Ybor City Tract'], impact: '+0.9pp', forecast: 'PENDING', forecastStatus: 'neutral' },
];

const PIPELINE = [
  { id: 1, name: '3820 W Kennedy Blvd', market: 'Tampa, FL', type: 'MF', status: 'Active', score: 74, irr: '18.2%', events: 3 },
  { id: 2, name: 'Westshore Office', market: 'Tampa, FL', type: 'Office', status: 'LOI', score: 72, irr: '14.8%', events: 1 },
  { id: 3, name: 'Channel District MF', market: 'Tampa, FL', type: 'MF', status: 'Under Contract', score: 76, irr: '19.4%', events: 2 },
  { id: 4, name: 'Raleigh Tech Park', market: 'Raleigh, NC', type: 'Office', status: 'Active', score: 85, irr: '16.2%', events: 2 },
  { id: 5, name: 'Nashville TOD MF', market: 'Nashville, TN', type: 'MF', status: 'Screening', score: 78, irr: '17.1%', events: 0 },
  { id: 6, name: 'Atlanta Logistics Hub', market: 'Atlanta, GA', type: 'Industrial', status: 'Screening', score: 81, irr: '15.5%', events: 0 },
];

export function F3PortfolioEvents() {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [eventsExpanded, setEventsExpanded] = useState(false);

  return (
    <div className="min-h-screen font-mono p-4" style={{ backgroundColor: '#0B0E1A', color: '#E2E8F0' }}>
      {/* HEADER */}
      <div className="mb-6 border-b pb-4" style={{ borderColor: '#1E2538' }}>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wider mb-1" style={{ color: '#E2E8F0' }}>
              F3 PORTFOLIO
            </h1>
            <p className="text-sm" style={{ color: '#A0ABBE' }}>
              12 assets | 5 MSAs | $890M AUM
            </p>
          </div>
          <div className="flex gap-4 text-xs font-semibold tracking-widest">
            <button className="pb-1 border-b-2" style={{ borderColor: '#0891B2', color: '#0891B2' }}>
              PIPELINE ●
            </button>
            <button className="pb-1 border-b-2 border-transparent hover:border-gray-600" style={{ color: '#A0ABBE' }}>
              ANALYTICS
            </button>
            <button className="pb-1 border-b-2 border-transparent hover:border-gray-600" style={{ color: '#A0ABBE' }}>
              REPORTS
            </button>
            <button className="pb-1 border-b-2 border-transparent hover:border-gray-600" style={{ color: '#A0ABBE' }}>
              EVENTS
            </button>
          </div>
        </div>
      </div>

      {/* PRIMARY SECTION: PORTFOLIO PIPELINE TABLE */}
      <div className="rounded border mb-6 overflow-hidden" style={{ backgroundColor: '#131929', borderColor: '#1E2538' }}>
        <div className="p-3 border-b flex justify-between items-center bg-opacity-50" style={{ borderColor: '#1E2538', backgroundColor: '#0B0E1A' }}>
          <h2 className="text-sm font-bold tracking-wider">PORTFOLIO PIPELINE</h2>
        </div>
        <table className="w-full text-sm text-left">
          <thead style={{ backgroundColor: '#0B0E1A', color: '#6B7A8D' }}>
            <tr>
              <th className="p-3 font-normal">DEAL NAME</th>
              <th className="p-3 font-normal">MARKET</th>
              <th className="p-3 font-normal">TYPE</th>
              <th className="p-3 font-normal">STATUS</th>
              <th className="p-3 font-normal">JEDI SCORE</th>
              <th className="p-3 font-normal">IRR TARGET</th>
              <th className="p-3 font-normal">EVENT STATUS</th>
            </tr>
          </thead>
          <tbody>
            {PIPELINE.map(deal => (
              <tr key={deal.id} className="border-b border-t-0" style={{ borderColor: '#1E2538' }}>
                <td className="p-3 font-medium text-white">{deal.name}</td>
                <td className="p-3" style={{ color: '#A0ABBE' }}>{deal.market}</td>
                <td className="p-3">{deal.type}</td>
                <td className="p-3">
                  <span className="px-2 py-1 text-xs rounded bg-opacity-20 border" style={{ 
                    backgroundColor: '#1E2538',
                    borderColor: '#1E2538',
                    color: '#A0ABBE'
                  }}>
                    {deal.status}
                  </span>
                </td>
                <td className="p-3">{deal.score}</td>
                <td className="p-3 font-medium text-green-400">{deal.irr}</td>
                <td className="p-3">
                  {deal.events > 0 ? (
                    <button 
                      onClick={() => setEventsExpanded(true)}
                      className="px-2 py-1 text-xs rounded border flex items-center gap-1 font-bold hover:bg-opacity-80 transition-colors" 
                      style={{ 
                        backgroundColor: '#131929',
                        borderColor: '#0891B2',
                        color: '#0891B2'
                      }}
                    >
                      <Zap size={12} fill="#0891B2" /> {deal.events} event{deal.events > 1 ? 's' : ''} &uarr;
                    </button>
                  ) : (
                    <span style={{ color: '#6B7A8D' }}>— no events</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* COLLAPSIBLE SUBSECTION: M35 EVENT TRACKER */}
      <div className="rounded overflow-hidden mb-6" style={{ backgroundColor: '#131929', borderLeft: '4px solid #0891B2', borderTop: '1px solid #1E2538', borderRight: '1px solid #1E2538', borderBottom: '1px solid #1E2538' }}>
        {/* Header Bar */}
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-opacity-80 transition-colors h-12"
          onClick={() => setEventsExpanded(!eventsExpanded)}
          style={{ backgroundColor: '#131929' }}
        >
          <div className="flex items-center gap-2">
            {eventsExpanded ? <ChevronDown size={16} color="#0891B2" /> : <ChevronRight size={16} color="#0891B2" />}
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#0891B2' }}>
              M35 PORTFOLIO EVENT TRACKER
            </span>
          </div>

          <div className="flex gap-3 text-xs">
            <span className="px-2 py-1 rounded bg-opacity-20 border" style={{ backgroundColor: '#1E2538', borderColor: '#1E2538', color: '#E2E8F0' }}>
              <span className="font-bold text-white">23</span> active events
            </span>
            <span className="px-2 py-1 rounded bg-opacity-20 border flex items-center gap-1" style={{ backgroundColor: '#EF444420', borderColor: '#EF444440', color: '#EF4444' }}>
              <AlertCircle size={12} /> <span className="font-bold">3</span> divergence alerts
            </span>
            <span className="px-2 py-1 rounded bg-opacity-20 border flex items-center gap-1" style={{ backgroundColor: '#10B98120', borderColor: '#10B98140', color: '#10B981' }}>
              <TrendingUp size={12} /> <span className="font-bold">+1.4pp</span> avg IRR uplift
            </span>
          </div>

          <div className="text-xs flex items-center gap-1 hover:underline" style={{ color: '#0891B2' }}>
            View Event Feed <ArrowRight size={12} />
          </div>
        </div>

        {/* Expanded Content */}
        {eventsExpanded && (
          <div className="p-4 border-t" style={{ borderColor: '#1E2538', backgroundColor: '#0B0E1A' }}>
            
            {/* MAIN TABLE */}
            <div className="rounded border mb-6 overflow-hidden" style={{ backgroundColor: '#131929', borderColor: '#1E2538' }}>
              <div className="p-3 border-b flex justify-between items-center bg-opacity-50" style={{ borderColor: '#1E2538', backgroundColor: '#0B0E1A' }}>
                <h2 className="text-sm font-bold tracking-wider">EVENTS AFFECTING PORTFOLIO ASSETS</h2>
                <div className="flex gap-3 text-xs" style={{ color: '#A0ABBE' }}>
                  <span className="flex items-center gap-1 cursor-pointer hover:text-white">Sort: By Severity <ChevronDown size={12}/></span>
                  <span className="flex items-center gap-1 cursor-pointer hover:text-white">By Deal</span>
                  <span className="flex items-center gap-1 cursor-pointer hover:text-white">By MSA</span>
                  <span className="flex items-center gap-1 cursor-pointer hover:text-white ml-2 pl-3 border-l" style={{ borderColor: '#1E2538' }}>
                    <Filter size={12}/> All Categories <ChevronDown size={12}/>
                  </span>
                </div>
              </div>

              <table className="w-full text-sm text-left">
                <thead style={{ backgroundColor: '#0B0E1A', color: '#6B7A8D' }}>
                  <tr>
                    <th className="p-3 font-normal">SEVERITY</th>
                    <th className="p-3 font-normal">EVENT</th>
                    <th className="p-3 font-normal">SCOPE</th>
                    <th className="p-3 font-normal">STATUS</th>
                    <th className="p-3 font-normal">DEALS AFFECTED</th>
                    <th className="p-3 font-normal">IRR IMPACT</th>
                    <th className="p-3 font-normal">FORECAST</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map((event, idx) => (
                    <React.Fragment key={event.id}>
                      <tr 
                        className="border-b border-t-0 hover:bg-opacity-50 cursor-pointer transition-colors" 
                        style={{ 
                          borderColor: '#1E2538',
                          backgroundColor: expandedRow === event.id ? '#1E2538' : 'transparent'
                        }}
                        onClick={() => setExpandedRow(expandedRow === event.id ? null : event.id)}
                      >
                        <td className="p-3">
                          <div className="w-3 h-3 rounded-full" style={{ 
                            backgroundColor: event.severity === 'red' ? '#EF4444' : event.severity === 'yellow' ? '#D97706' : '#10B981',
                            boxShadow: `0 0 8px ${event.severity === 'red' ? '#EF4444' : event.severity === 'yellow' ? '#D97706' : '#10B981'}40`
                          }} />
                        </td>
                        <td className="p-3 flex items-center gap-2 font-medium">
                          <event.icon size={14} style={{ color: '#A0ABBE' }} />
                          {event.name}
                        </td>
                        <td className="p-3" style={{ color: '#A0ABBE' }}>{event.scope}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 text-xs rounded bg-opacity-20 border" style={{ 
                            backgroundColor: '#1E2538',
                            borderColor: '#1E2538'
                          }}>
                            {event.status}
                          </span>
                        </td>
                        <td className="p-3">{event.deals} deals</td>
                        <td className="p-3 font-medium" style={{ 
                          color: event.impact.includes('+') ? '#10B981' : event.impact.includes('-') ? '#EF4444' : '#E2E8F0' 
                        }}>
                          {event.impact}
                        </td>
                        <td className="p-3 flex items-center gap-1 text-xs font-bold">
                          {event.forecast} 
                          {event.forecastStatus === 'good' && <CheckCircle2 size={14} style={{ color: '#10B981' }} />}
                          {event.forecastStatus === 'bad' && <AlertTriangle size={14} style={{ color: '#EF4444' }} />}
                        </td>
                      </tr>
                      {expandedRow === event.id && (
                        <tr style={{ backgroundColor: '#0B0E1A' }}>
                          <td colSpan={7} className="p-4 border-b" style={{ borderColor: '#1E2538' }}>
                            <div className="flex items-center gap-3">
                              <span className="text-xs uppercase" style={{ color: '#6B7A8D' }}>Affected Assets:</span>
                              <div className="flex gap-2 flex-wrap">
                                {event.dealsList.map(deal => (
                                  <span key={deal} className="text-xs px-3 py-1 rounded-full border cursor-pointer hover:bg-opacity-80 transition-colors" 
                                    style={{ borderColor: '#1E2538', backgroundColor: '#131929', color: '#0891B2' }}>
                                    {deal}
                                  </span>
                                ))}
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

            {/* BOTTOM ROW */}
            <div className="grid grid-cols-2 gap-6">
              {/* LEFT: UPCOMING MATERIALIZATIONS */}
              <div className="rounded border p-4" style={{ backgroundColor: '#131929', borderColor: '#1E2538' }}>
                <h3 className="text-sm font-bold tracking-wider mb-4 border-b pb-2" style={{ borderColor: '#1E2538' }}>
                  UPCOMING MATERIALIZATIONS
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-3 relative">
                    <div className="w-1 bg-gray-700 absolute left-1.5 top-5 bottom-[-20px]" style={{ backgroundColor: '#1E2538' }}></div>
                    <div className="w-4 h-4 rounded-full border-2 bg-black z-10 mt-0.5" style={{ borderColor: '#0891B2', backgroundColor: '#0B0E1A' }}></div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: '#E2E8F0' }}>Apr 28, 2026</div>
                      <div className="text-sm" style={{ color: '#A0ABBE' }}>FL Insurance Rate Cap materializes</div>
                      <div className="text-xs mt-1" style={{ color: '#6B7A8D' }}>8 deals, avg -4% expense</div>
                    </div>
                  </div>
                  <div className="flex gap-3 relative">
                    <div className="w-1 bg-gray-700 absolute left-1.5 top-5 bottom-[-20px]" style={{ backgroundColor: '#1E2538' }}></div>
                    <div className="w-4 h-4 rounded-full border-2 bg-black z-10 mt-0.5" style={{ borderColor: '#D97706', backgroundColor: '#0B0E1A' }}></div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: '#E2E8F0' }}>May 15, 2026</div>
                      <div className="text-sm" style={{ color: '#A0ABBE' }}>Zoning Upzone Vote (Ybor)</div>
                      <div className="text-xs mt-1" style={{ color: '#6B7A8D' }}>1 deal, <span style={{ color: '#10B981' }}>+0.9pp IRR</span> if passes</div>
                    </div>
                  </div>
                  <div className="flex gap-3 relative">
                    <div className="w-4 h-4 rounded-full border-2 bg-black z-10 mt-0.5" style={{ borderColor: '#10B981', backgroundColor: '#0B0E1A' }}></div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: '#E2E8F0' }}>Jun 3, 2026</div>
                      <div className="text-sm" style={{ color: '#A0ABBE' }}>BRT Phase 2 Groundbreaking</div>
                      <div className="text-xs mt-1" style={{ color: '#6B7A8D' }}>2 deals, <span style={{ color: '#10B981' }}>+$85/unit rent premium</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: MOST EXPOSED DEAL */}
              <div className="rounded border p-4 flex flex-col justify-between" style={{ backgroundColor: '#131929', borderColor: '#1E2538' }}>
                <div>
                  <div className="flex justify-between items-start mb-4 border-b pb-2" style={{ borderColor: '#1E2538' }}>
                    <h3 className="text-sm font-bold tracking-wider" style={{ color: '#A0ABBE' }}>MOST EXPOSED DEAL</h3>
                    <span className="text-xs px-2 py-1 rounded bg-red-900/20 font-bold" style={{ color: '#EF4444', border: '1px solid #EF444440' }}>
                      HIGH SENSITIVITY
                    </span>
                  </div>
                  
                  <h4 className="text-xl font-bold mb-4" style={{ color: '#E2E8F0' }}>3820 W Kennedy Blvd, Tampa</h4>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-xs uppercase mb-1" style={{ color: '#6B7A8D' }}>Active Events</div>
                      <div className="font-bold">3 Tracking</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase mb-1" style={{ color: '#6B7A8D' }}>Event Sensitivity</div>
                      <div className="font-bold" style={{ color: '#EF4444' }}>42% of IRR</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs uppercase mb-1" style={{ color: '#6B7A8D' }}>Top Event</div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Amazon HQ2</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/20" style={{ color: '#10B981', border: '1px solid #10B98140' }}>+1.4pp, AHEAD</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs uppercase mb-1" style={{ color: '#6B7A8D' }}>Concentration Risk</div>
                      <div className="flex items-center gap-2 font-medium" style={{ color: '#D97706' }}>
                        <AlertTriangle size={14} /> YES — single event &gt; 30%
                      </div>
                    </div>
                  </div>
                </div>
                
                <button className="w-full py-2.5 rounded text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity" 
                  style={{ backgroundColor: '#0891B2', color: '#FFFFFF' }}>
                  View Deal Capsule <ArrowRight size={16} />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default F3PortfolioEvents;