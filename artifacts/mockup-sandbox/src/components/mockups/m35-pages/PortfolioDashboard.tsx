import React from 'react';
import { Plus, Download, Filter, ChevronDown, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const EventRow = ({ status, emoji, title, scope, timing, statusText, impact, deals, colorClass, borderClass }) => (
  <div className={`bg-[#131929] border border-[#1E2538] rounded flex flex-col overflow-hidden`}>
    <div className="flex items-center justify-between p-3 border-l-4" style={{ borderLeftColor: borderClass }}>
      <div className="flex items-center gap-3 flex-1">
        <span className="text-lg" title={status}>{emoji}</span>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#E2E8F0]">{title}</span>
            <span className="text-xs px-1.5 py-0.5 bg-[#1E2538] text-[#A0ABBE] rounded uppercase">{scope}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#A0ABBE] mt-1">
            <span className="font-mono">{timing}</span>
            <span>•</span>
            <span className={colorClass}>{statusText} {impact && <span className="font-mono ml-1">{impact}</span>}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-[#6B7A8D]">EXPOSURE</div>
          <div className="text-sm font-mono text-[#E2E8F0]">{deals}</div>
        </div>
        <button className="text-sm text-[#0891B2] hover:text-cyan-300 bg-[#1E2538] px-3 py-1.5 rounded transition-colors">
          View
        </button>
      </div>
    </div>
    <div className="bg-[#0B0E1A] h-1.5 w-full flex">
      {/* Fake impact bar */}
      <div className="bg-[#10B981] h-full" style={{ width: '40%' }}></div>
      <div className="bg-[#0891B2] h-full" style={{ width: '20%' }}></div>
      <div className="bg-[#EF4444] h-full" style={{ width: '15%' }}></div>
    </div>
  </div>
);

export default function PortfolioDashboard() {
  return (
    <div className="min-h-screen bg-[#0B0E1A] text-[#E2E8F0] font-sans p-6 overflow-auto">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-end border-b border-[#1E2538] pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#E2E8F0]">PORTFOLIO EVENT INTELLIGENCE</h1>
            <div className="flex gap-4 text-sm text-[#A0ABBE] mt-1">
              <span>12 tracked properties</span>
              <span className="text-[#1E2538]">|</span>
              <span>5 active MSAs</span>
              <span className="text-[#1E2538]">|</span>
              <span>Last updated: 2 min ago</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="bg-[#0891B2] hover:bg-cyan-600 text-white px-4 py-1.5 rounded text-sm flex items-center gap-2 transition-colors font-medium">
              <Plus size={16} /> Add Event
            </button>
            <button className="bg-[#131929] border border-[#1E2538] hover:bg-[#1E2538] text-[#E2E8F0] px-4 py-1.5 rounded text-sm flex items-center gap-2 transition-colors">
              <Download size={16} /> Export PDF
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#131929] border border-[#1E2538] p-4 rounded flex flex-col">
            <span className="text-xs font-semibold text-[#6B7A8D] tracking-wider mb-2">ACTIVE EVENTS</span>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-mono font-light text-[#E2E8F0]">23</span>
              <span className="text-sm font-mono text-[#10B981] mb-1">+4 this week</span>
            </div>
          </div>
          <div className="bg-[#131929] border border-[#1E2538] p-4 rounded flex flex-col">
            <span className="text-xs font-semibold text-[#6B7A8D] tracking-wider mb-2">DIVERGENCE ALERTS</span>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-mono font-light text-[#E2E8F0]">3</span>
              <span className="text-sm font-mono text-[#EF4444] mb-1">2 critical</span>
            </div>
          </div>
          <div className="bg-[#131929] border border-[#1E2538] p-4 rounded flex flex-col">
            <span className="text-xs font-semibold text-[#6B7A8D] tracking-wider mb-2">MATURING THIS QUARTER</span>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-mono font-light text-[#E2E8F0]">7</span>
              <span className="text-sm text-[#A0ABBE] mb-1">events (T-0 to T+3mo)</span>
            </div>
          </div>
          <div className="bg-[#131929] border border-[#1E2538] p-4 rounded flex flex-col">
            <span className="text-xs font-semibold text-[#6B7A8D] tracking-wider mb-2">PORTFOLIO IRR UPLIFT FROM EVENTS</span>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-mono font-light text-[#10B981]">+1.8<span className="text-xl">pp</span></span>
              <span className="text-sm text-[#A0ABBE] mb-1">avg</span>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex gap-6">
          
          {/* Left Column (65%) */}
          <div className="w-[65%] space-y-6">
            
            {/* Event Feed */}
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-[#A0ABBE] tracking-wider">ACTIVE EVENTS — BY SEVERITY</h2>
                <div className="flex gap-2">
                  <button className="bg-[#131929] border border-[#1E2538] text-[#A0ABBE] px-3 py-1 text-xs rounded flex items-center gap-1">
                    All Categories <ChevronDown size={14} />
                  </button>
                  <button className="bg-[#131929] border border-[#1E2538] text-[#A0ABBE] px-3 py-1 text-xs rounded flex items-center gap-1">
                    All Scopes <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <EventRow status="ALERT" emoji="🔴" title="📣 Amazon HQ2 Tampa" scope="MSA" timing="T+8mo" statusText="AHEAD" impact="+0.8pp" deals="4 deals" colorClass="text-[#10B981]" borderClass="#EF4444" />
                <EventRow status="WARN" emoji="🟡" title="🚆 BRT Phase 2 Tampa" scope="Submarket" timing="T-4mo" statusText="PENDING" impact="+0.5pp projected" deals="2 deals" colorClass="text-[#D97706]" borderClass="#D97706" />
                <EventRow status="WARN" emoji="🟡" title="📜 FL Insurance Rate Cap" scope="State" timing="T+2mo materializes" statusText="" impact="-4% expense" deals="8 deals" colorClass="text-[#A0ABBE]" borderClass="#D97706" />
                <EventRow status="OK" emoji="🟢" title="🏢 Blackstone Market Entry" scope="Submarket" timing="T-6mo fired" statusText="ON PACE" impact="" deals="2 deals" colorClass="text-[#10B981]" borderClass="#10B981" />
                <EventRow status="ALERT" emoji="🔴" title="🌀 Hurricane Idalia Recovery" scope="MSA" timing="T+14mo" statusText="BEHIND" impact="forecast -0.4pp" deals="3 deals" colorClass="text-[#EF4444]" borderClass="#EF4444" />
                <EventRow status="OK" emoji="🟢" title="📣 Amazon Warehouse (Brandon)" scope="Submarket" timing="T-2mo fired" statusText="AHEAD" impact="" deals="1 deal" colorClass="text-[#10B981]" borderClass="#10B981" />
                <EventRow status="WARN" emoji="🟡" title="📜 Zoning Upzone Vote (Ybor)" scope="Property" timing="T+1mo pending" statusText="high conf" impact="82%" deals="1 deal" colorClass="text-[#0891B2]" borderClass="#D97706" />
                <EventRow status="OK" emoji="🟢" title="📣 USF Med School Expansion" scope="Submarket" timing="T-10mo fired" statusText="ON PACE" impact="" deals="2 deals" colorClass="text-[#10B981]" borderClass="#10B981" />
              </div>
            </div>

            {/* Forecast Divergence Alerts */}
            <div className="bg-[#131929] border border-[#1E2538] rounded p-5 mt-6">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-bold text-[#A0ABBE] tracking-wider">FORECAST DIVERGENCE ALERTS</h2>
                <span className="bg-[#EF4444] bg-opacity-20 text-[#EF4444] border border-[#EF4444] border-opacity-50 text-xs px-2 py-0.5 rounded font-mono">3 active</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: "Tampa Job Growth", delta: "-1.2pp", dir: "below consensus" },
                  { title: "Insurance Costs", delta: "+8.5%", dir: "above proforma" },
                  { title: "Absorption Rate", delta: "-120bps", dir: "slowing faster" }
                ].map((alert, i) => (
                  <div key={i} className="bg-[#0B0E1A] border border-[#1E2538] border-l-2 border-l-[#EF4444] p-3 rounded flex flex-col">
                    <span className="font-medium text-[#E2E8F0] text-sm mb-1">{alert.title}</span>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-mono text-[#EF4444]">{alert.delta}</span>
                      <span className="text-xs text-[#6B7A8D]">{alert.dir}</span>
                    </div>
                    <button className="text-xs text-[#0891B2] hover:text-cyan-300 text-left mt-auto">Update playbook confidence?</button>
                  </div>
                ))}
              </div>
            </div>
            
          </div>

          {/* Right Column (35%) */}
          <div className="w-[35%] flex flex-col space-y-6">
            
            {/* Upcoming Materializations */}
            <div className="bg-[#131929] border border-[#1E2538] rounded flex flex-col">
              <div className="p-4 border-b border-[#1E2538]">
                <h2 className="text-sm font-bold text-[#A0ABBE] tracking-wider">MATERIALIZING NEXT 90 DAYS</h2>
              </div>
              <div className="p-4 relative">
                <div className="absolute left-6 top-4 bottom-4 w-px bg-[#1E2538]"></div>
                <div className="space-y-6 relative">
                  
                  <div className="flex gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#D97706] mt-1.5 relative z-10 ring-4 ring-[#131929]"></div>
                    <div>
                      <div className="text-xs font-mono text-[#D97706] mb-1">Apr 2026</div>
                      <div className="text-sm text-[#E2E8F0]">FL Insurance Rate Cap materializes <span className="text-[#6B7A8D]">(State)</span></div>
                      <div className="text-xs font-mono text-[#A0ABBE] mt-1">8 deals affected</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0891B2] mt-1.5 relative z-10 ring-4 ring-[#131929]"></div>
                    <div>
                      <div className="text-xs font-mono text-[#0891B2] mb-1">May 2026</div>
                      <div className="text-sm text-[#E2E8F0]">Zoning Upzone Vote (Ybor) <span className="text-[#6B7A8D]">(Property)</span></div>
                      <div className="text-xs font-mono text-[#A0ABBE] mt-1">1 deal</div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#A0ABBE] mt-1.5 relative z-10 ring-4 ring-[#131929]"></div>
                    <div>
                      <div className="text-xs font-mono text-[#A0ABBE] mb-1">Jun 2026</div>
                      <div className="text-sm text-[#E2E8F0]">BRT Phase 2 groundbreaking <span className="text-[#6B7A8D]">(Submarket)</span></div>
                      <div className="text-xs font-mono text-[#A0ABBE] mt-1">2 deals</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Heatmap */}
            <div className="bg-[#131929] border border-[#1E2538] rounded flex flex-col flex-1">
              <div className="p-4 border-b border-[#1E2538] flex justify-between items-center">
                <h2 className="text-sm font-bold text-[#A0ABBE] tracking-wider">PORTFOLIO EVENT HEATMAP</h2>
              </div>
              <div className="p-4 flex-1">
                <div className="grid grid-cols-6 gap-1 h-full">
                  <div className="col-span-2"></div>
                  <div className="text-[10px] text-[#6B7A8D] text-center rotate-[-45deg] origin-bottom-left whitespace-nowrap">EMPL</div>
                  <div className="text-[10px] text-[#6B7A8D] text-center rotate-[-45deg] origin-bottom-left whitespace-nowrap">INFR</div>
                  <div className="text-[10px] text-[#6B7A8D] text-center rotate-[-45deg] origin-bottom-left whitespace-nowrap">REG</div>
                  <div className="text-[10px] text-[#6B7A8D] text-center rotate-[-45deg] origin-bottom-left whitespace-nowrap">MACR</div>
                  
                  {['Tampa', 'Orlando', 'Atlanta', 'Charlotte'].map((msa, i) => (
                    <React.Fragment key={msa}>
                      <div className="col-span-2 text-xs text-[#A0ABBE] flex items-center">{msa}</div>
                      {[...Array(4)].map((_, j) => {
                        // Generate pseudo-random opacities
                        const op = [0.1, 0.4, 0.8, 0.2, 0.6, 0.1, 0.9, 0.3, 0.2, 0.5, 0.1, 0.7, 0.4, 0.2, 0.1, 0.6][i*4+j];
                        return (
                          <div key={j} className="aspect-square rounded-sm" style={{ backgroundColor: `rgba(8, 145, 178, ${op})` }}></div>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-[#131929] border border-[#1E2538] rounded flex flex-col">
              <div className="p-4 border-b border-[#1E2538]">
                <h2 className="text-sm font-bold text-[#A0ABBE] tracking-wider">QUICK STATS</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-xs text-[#6B7A8D] mb-1">Top event by IRR impact</div>
                  <div className="text-sm text-[#E2E8F0] flex justify-between">
                    <span>Amazon HQ2</span>
                    <span className="font-mono text-[#10B981]">+1.4pp avg</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#6B7A8D] mb-1">Most exposed deal</div>
                  <div className="text-sm text-[#E2E8F0] flex justify-between">
                    <span>3820 W Kennedy Blvd</span>
                    <span className="font-mono text-[#A0ABBE]">3 active</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#6B7A8D] mb-1">Playbook hit rate (30d)</div>
                  <div className="text-sm text-[#E2E8F0] flex justify-between">
                    <span>Model confidence</span>
                    <span className="font-mono text-[#0891B2]">73%</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
