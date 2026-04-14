import React, { useState } from 'react';
import { Megaphone, Train, ScrollText, TrendingUp, AlertTriangle, ArrowRight, Activity, Building, DollarSign } from 'lucide-react';

export default function CapsuleIntelligenceTab() {
  const [activeMetric, setActiveMetric] = useState('Rent Growth');

  return (
    <div className="w-full min-h-screen bg-[#0B0E1A] text-[#E2E8F0] p-4 font-mono flex flex-col gap-6 selection:bg-[#0891B2] selection:text-white">
      
      {/* SECTION 1 — EVENTS AFFECTING THIS DEAL */}
      <section className="flex flex-col gap-4">
        {/* Header Row */}
        <div className="flex items-center justify-between border-b border-[#1E2538] pb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-[#0891B2] text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2">
              <Activity size={14} />
              Events Affecting This Deal
            </h2>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#EF4444]/10 text-[#EF4444] text-[10px] rounded border border-[#EF4444]/30">
              HIGH <AlertTriangle size={10} />
            </div>
          </div>
          <div className="text-[#6B7A8D] text-xs">
            42% of projected IRR from events
          </div>
        </div>

        {/* EventTimelineChart */}
        <div className="bg-[#131929] border border-[#1E2538] rounded p-4 flex flex-col gap-4">
          {/* Metric Tabs */}
          <div className="flex items-center gap-4 text-xs">
            {['Rent Growth', 'Cap Rate', 'Absorption', 'Permits'].map((metric) => (
              <button
                key={metric}
                onClick={() => setActiveMetric(metric)}
                className={`flex items-center gap-1.5 pb-1 border-b-2 transition-colors ${
                  activeMetric === metric 
                    ? 'border-[#0891B2] text-[#E2E8F0]' 
                    : 'border-transparent text-[#6B7A8D] hover:text-[#A0ABBE]'
                }`}
              >
                {metric}
                {activeMetric === metric && <span className="text-[#0891B2]">●</span>}
              </button>
            ))}
          </div>

          {/* SVG Chart Area */}
          <div className="relative h-[180px] w-full border-t border-b border-[#1E2538] mt-2">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-2 text-[10px] text-[#6B7A8D]">
              <span>+6%</span>
              <span>+3%</span>
              <span>0%</span>
              <span>-3%</span>
            </div>

            {/* X-axis labels */}
            <div className="absolute bottom-[-20px] w-full flex justify-between px-8 text-[10px] text-[#6B7A8D]">
              <span>T-18</span>
              <span>T-12</span>
              <span>T-6</span>
              <span>TODAY</span>
              <span>T+6</span>
              <span>T+12</span>
              <span>T+18</span>
            </div>

            {/* Chart SVG */}
            <svg className="w-full h-full ml-8" viewBox="0 0 800 180" preserveAspectRatio="none">
              {/* Grid Lines */}
              <line x1="0" y1="45" x2="800" y2="45" stroke="#1E2538" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="90" x2="800" y2="90" stroke="#1E2538" strokeWidth="1" />
              <line x1="0" y1="135" x2="800" y2="135" stroke="#1E2538" strokeWidth="1" strokeDasharray="4 4" />

              {/* Shading for fired event */}
              <rect x="250" y="0" width="100" height="180" fill="#0891B2" fillOpacity="0.05" />

              {/* Historical Solid Line */}
              <path d="M 0 120 Q 100 110, 200 95 T 350 80 T 450 60" fill="none" stroke="#0891B2" strokeWidth="2" />
              
              {/* Forecast Cone */}
              <path d="M 450 60 L 800 20 L 800 100 Z" fill="#0891B2" fillOpacity="0.1" />
              <path d="M 450 60 Q 600 45, 800 35" fill="none" stroke="#0891B2" strokeWidth="2" strokeDasharray="4 4" />

              {/* Vertical Markers */}
              
              {/* T-8: Amazon HQ2 */}
              <g transform="translate(250, 0)">
                <line x1="0" y1="20" x2="0" y2="180" stroke="#6B7A8D" strokeWidth="1" />
                <circle cx="0" cy="88" r="4" fill="#0B0E1A" stroke="#6B7A8D" strokeWidth="2" />
                <foreignObject x="-12" y="0" width="24" height="24">
                  <div className="flex items-center justify-center bg-[#131929] rounded-full border border-[#6B7A8D] w-6 h-6 text-[10px]">
                    📣
                  </div>
                </foreignObject>
                <text x="5" y="15" fill="#6B7A8D" fontSize="10" className="font-mono">T-8</text>
              </g>

              {/* T-4: BRT Phase 2 */}
              <g transform="translate(350, 0)">
                <line x1="0" y1="20" x2="0" y2="180" stroke="#0891B2" strokeWidth="1" strokeDasharray="2 2" />
                <circle cx="0" cy="80" r="4" fill="#0891B2" />
                <foreignObject x="-12" y="0" width="24" height="24">
                  <div className="flex items-center justify-center bg-[#131929] rounded-full border border-[#0891B2] w-6 h-6 text-[10px]">
                    🚆
                  </div>
                </foreignObject>
                <text x="5" y="15" fill="#0891B2" fontSize="10" className="font-mono">T-4</text>
              </g>

              {/* T+2: FL Insurance */}
              <g transform="translate(500, 0)">
                <line x1="0" y1="20" x2="0" y2="180" stroke="#6B7A8D" strokeWidth="1" strokeDasharray="2 2" />
                <circle cx="0" cy="55" r="4" fill="#0B0E1A" stroke="#6B7A8D" strokeWidth="2" />
                <foreignObject x="-12" y="0" width="24" height="24">
                  <div className="flex items-center justify-center bg-[#131929] rounded-full border border-[#6B7A8D] w-6 h-6 text-[10px]">
                    📜
                  </div>
                </foreignObject>
                <text x="5" y="15" fill="#6B7A8D" fontSize="10" className="font-mono">T+2</text>
              </g>
            </svg>
          </div>
        </div>

        {/* Event Cards */}
        <div className="flex flex-col gap-2 mt-4">
          
          {/* Card 1 */}
          <div className="bg-[#131929] border-l-2 border-l-[#0891B2] border border-[#1E2538] rounded-r p-3 flex flex-col gap-2 hover:bg-[#1E2538]/50 transition-colors cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-[#1E2538] text-[#A0ABBE] text-[10px] rounded">MSA</span>
                <span className="text-[#E2E8F0] text-sm font-semibold">Amazon HQ2 Tampa</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-[#10B981]/10 text-[#10B981] text-[10px] rounded border border-[#10B981]/30">FIRED T+8MO</span>
                <span className="text-[#6B7A8D] text-[10px]">AHEAD</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4 text-[#A0ABBE]">
                <span>Proximity: <strong className="text-[#E2E8F0]">0.74</strong> (2.1mi from site)</span>
                <span className="text-[#1E2538]">|</span>
                <span>IRR impact: <strong className="text-[#10B981]">+1.8pp</strong> by Y2</span>
                <span className="text-[#1E2538]">|</span>
                <span>Rent Growth: <strong className="text-[#10B981]">+1.4pp</strong> projected at T+12</span>
              </div>
              <div className="text-[#0891B2] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                View Full Impact <ArrowRight size={12} />
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#131929] border-l-2 border-l-[#6B7A8D] border border-[#1E2538] rounded-r p-3 flex flex-col gap-2 hover:bg-[#1E2538]/50 transition-colors cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-[#1E2538] text-[#A0ABBE] text-[10px] rounded">Submarket</span>
                <span className="text-[#E2E8F0] text-sm font-semibold">Tampa BRT Phase 2</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-[#D97706]/10 text-[#D97706] text-[10px] rounded border border-[#D97706]/30">PENDING T-4MO</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4 text-[#A0ABBE]">
                <span>Proximity: <strong className="text-[#E2E8F0]">0.94</strong> (very close)</span>
                <span className="text-[#1E2538]">|</span>
                <span>Projected rent premium: <strong className="text-[#10B981]">+$85/unit</strong> by Y2 via transit proximity</span>
              </div>
              <div className="text-[#0891B2] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                View Full Impact <ArrowRight size={12} />
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#131929] border-l-2 border-l-[#6B7A8D] border border-[#1E2538] rounded-r p-3 flex flex-col gap-2 hover:bg-[#1E2538]/50 transition-colors cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-[#1E2538] text-[#A0ABBE] text-[10px] rounded">State</span>
                <span className="text-[#E2E8F0] text-sm font-semibold">FL Insurance Rate Cap</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-[#D97706]/10 text-[#D97706] text-[10px] rounded border border-[#D97706]/30">PENDING T+2MO</span>
                <span className="text-[#6B7A8D] text-[10px]">85% CONFIDENCE</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4 text-[#A0ABBE]">
                <span>Insurance expense: <strong className="text-[#10B981]">-4%</strong> vs baseline by Y1</span>
              </div>
              <div className="text-[#0891B2] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                View Full Impact <ArrowRight size={12} />
              </div>
            </div>
          </div>

        </div>

        {/* Dependency summary row */}
        <div className="flex items-center gap-3 mt-2 text-[10px]">
          <div className="px-2 py-1 bg-[#131929] border border-[#1E2538] rounded-full text-[#A0ABBE]">
            3 events drive 42% of IRR uplift
          </div>
          <div className="px-2 py-1 bg-[#131929] border border-[#1E2538] rounded-full text-[#A0ABBE]">
            1 fired <span className="text-[#1E2538] mx-1">|</span> 2 pending
          </div>
          <div className="px-2 py-1 bg-[#131929] border border-[#1E2538] rounded-full text-[#A0ABBE]">
            Highest: <span className="text-[#E2E8F0]">Amazon HQ2</span> (+1.4pp rent)
          </div>
        </div>

      </section>

      {/* SECTION 2 — RAW INTELLIGENCE FEED */}
      <section className="flex flex-col gap-4 mt-6">
        {/* Divider / Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center">
            <div className="text-[#6B7A8D] text-[10px] whitespace-nowrap mr-2 tracking-widest uppercase">── Deal & Market Intelligence ────</div>
            <div className="h-px bg-[#1E2538] w-full"></div>
            <div className="text-[#0891B2] text-[10px] whitespace-nowrap ml-2 tracking-widest uppercase bg-[#0891B2]/10 px-1.5 py-0.5 rounded">M06 Pipeline</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-[10px]">
          {['All', 'Macro', 'Local', 'Rates', 'Regulatory'].map((filter, i) => (
            <button key={filter} className={`px-2 py-1 rounded border ${i === 0 ? 'bg-[#1E2538] text-[#E2E8F0] border-[#1E2538]' : 'bg-transparent text-[#6B7A8D] border-[#1E2538] hover:text-[#A0ABBE]'}`}>
              {filter}
            </button>
          ))}
        </div>

        {/* Feed Rows */}
        <div className="flex flex-col gap-1 border border-[#1E2538] rounded bg-[#131929] overflow-hidden">
          
          <div className="flex items-center justify-between p-2.5 hover:bg-[#1E2538]/50 border-b border-[#1E2538] group cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-sm">📣</span>
              <span className="text-[#E2E8F0] text-sm">Amazon HQ2 Confirmed — 25,000 Jobs</span>
              <span className="text-[#6B7A8D] text-xs">WSJ</span>
              <span className="text-[#6B7A8D] text-xs">3h</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#10B981] text-[10px] border border-[#10B981]/30 bg-[#10B981]/10 px-1 rounded">POSITIVE</span>
              <span className="text-[#0891B2] text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                → EVENT #127
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 hover:bg-[#1E2538]/50 border-b border-[#1E2538] cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-sm">📊</span>
              <span className="text-[#E2E8F0] text-sm">10Y Treasury: 4.82% <span className="text-[#EF4444]">↑0.06bps</span></span>
              <span className="text-[#6B7A8D] text-xs">Bloomberg</span>
              <span className="text-[#6B7A8D] text-xs">12h</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#A0ABBE] text-[10px] border border-[#6B7A8D]/30 bg-[#1E2538] px-1 rounded">NEUTRAL</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 hover:bg-[#1E2538]/50 border-b border-[#1E2538] cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-sm">🏗️</span>
              <span className="text-[#E2E8F0] text-sm">Westshore Supply Pipeline: 1,200 New Units by Q4</span>
              <span className="text-[#6B7A8D] text-xs">CoStar</span>
              <span className="text-[#6B7A8D] text-xs">2d</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#A0ABBE] text-[10px] border border-[#6B7A8D]/30 bg-[#1E2538] px-1 rounded">NEUTRAL</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 hover:bg-[#1E2538]/50 border-b border-[#1E2538] group cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-sm">📜</span>
              <span className="text-[#E2E8F0] text-sm">FL Insurance Reform Advances in Senate</span>
              <span className="text-[#6B7A8D] text-xs">Sun Sentinel</span>
              <span className="text-[#6B7A8D] text-xs">3d</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#10B981] text-[10px] border border-[#10B981]/30 bg-[#10B981]/10 px-1 rounded">POSITIVE</span>
              <span className="text-[#0891B2] text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                → EVENT #203
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 hover:bg-[#1E2538]/50 cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-sm">💰</span>
              <span className="text-[#E2E8F0] text-sm">SOFR: 5.31% | Agency Spreads +12bps</span>
              <span className="text-[#6B7A8D] text-xs">Trepp</span>
              <span className="text-[#6B7A8D] text-xs">4d</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#A0ABBE] text-[10px] border border-[#6B7A8D]/30 bg-[#1E2538] px-1 rounded">NEUTRAL</span>
            </div>
          </div>

        </div>
      </section>
      
    </div>
  );
}
