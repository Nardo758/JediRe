import React, { useState } from 'react';
import { Megaphone, Train, FileText, Building2, CircleDollarSign, BarChart3, ChevronDown, ChevronRight, ArrowRight, Activity, TrendingUp, Clock } from 'lucide-react';

export function F4IntelligenceTab() {
  const [eventsExpanded, setEventsExpanded] = useState(false);

  return (
    <div className="w-full min-h-screen bg-[#0B0E1A] text-[#E2E8F0] p-6 font-sans flex flex-col gap-6 overflow-auto">
      {/* Page header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-[#E2E8F0] tracking-wide">INTELLIGENCE</h1>
          <span className="text-[#6B7A8D]">|</span>
          <span className="text-[#A0ABBE] font-medium">Tampa–St. Pete MSA</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#6B7A8D] font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>Last updated: 1 min ago</span>
        </div>
      </div>

      {/* PRIMARY SECTION: RAW INTELLIGENCE FEED */}
      <section className="flex flex-col gap-4">
        {/* Divider & Filters */}
        <div className="flex items-center w-full">
          <div className="text-[11px] font-mono text-[#E2E8F0] font-bold whitespace-nowrap">RAW INTELLIGENCE FEED</div>
          <div className="flex-1 border-t border-[#1E2538] mx-3"></div>
          <div className="text-[9px] text-[#6B7A8D] mr-4 tracking-wider uppercase">Powered by M06 pipeline</div>
          
          <div className="flex gap-2">
            <button className="border border-[#0891B2] text-[#0891B2] px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 bg-[#0891B2]/10">
              All <ChevronDown className="w-3 h-3" />
            </button>
            {['Employment', 'Development', 'Transaction', 'Regulatory'].map((filter) => (
              <button key={filter} className="border border-[#1E2538] text-[#A0ABBE] hover:text-[#E2E8F0] hover:border-[#6B7A8D] px-2.5 py-0.5 rounded-full text-[11px] transition-colors bg-[#131929]">
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Feed List */}
        <div className="flex flex-col gap-2">
          {/* Item 1 */}
          <div className="bg-[#131929] border border-[#1E2538] p-3 rounded-sm flex flex-col hover:border-[#334155] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#0891B2]/20 flex items-center justify-center shrink-0">
                <Megaphone className="w-3.5 h-3.5 text-[#0891B2]" />
              </div>
              <div className="text-[#6B7A8D] text-xs font-mono shrink-0 w-12">3h ago</div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-bold text-[#E2E8F0] truncate group-hover:text-[#0891B2] transition-colors">Amazon HQ2 Confirmed — 25,000 Jobs by 2027</span>
                <span className="text-[10px] bg-[#0B0E1A] border border-[#1E2538] text-[#6B7A8D] px-1.5 py-0.5 rounded shrink-0">WSJ</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded">
                  <TrendingUp className="w-3 h-3" /> POSITIVE
                </div>
                <div className="border border-[#0891B2] text-[#0891B2] text-[10px] font-mono px-2 py-0.5 rounded bg-[#0891B2]/5 flex items-center gap-1 hover:bg-[#0891B2]/20 transition-colors">
                  CLASSIFIED <ArrowRight className="w-2 h-2" /> EVENT #127
                </div>
              </div>
            </div>
          </div>

          {/* Item 2 - Expanded */}
          <div className="bg-[#131929] border border-[#1E2538] p-3 rounded-sm flex flex-col hover:border-[#334155] transition-colors cursor-pointer group shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#10B981]/20 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-[#10B981]" />
              </div>
              <div className="text-[#6B7A8D] text-xs font-mono shrink-0 w-12">1d</div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-bold text-[#E2E8F0] truncate group-hover:text-[#0891B2] transition-colors">3,200-Unit Westshore Mixed-Use Breaks Ground</span>
                <span className="text-[10px] bg-[#0B0E1A] border border-[#1E2538] text-[#6B7A8D] px-1.5 py-0.5 rounded shrink-0">Tampa Bay Biz Journal</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded">
                  <TrendingUp className="w-3 h-3" /> POSITIVE
                </div>
              </div>
            </div>
            {/* Expanded Content */}
            <div className="mt-3 ml-[68px] mr-[100px] p-3 bg-[#0B0E1A] border border-[#1E2538] rounded text-[12px] text-[#A0ABBE] leading-relaxed relative">
              <div className="absolute -left-2.5 top-3 w-2.5 h-px bg-[#1E2538]"></div>
              <div className="absolute -left-2.5 -top-3 w-px h-6 bg-[#1E2538]"></div>
              Construction officially commenced today on the highly anticipated 3,200-unit Westshore district mega-project. 
              The development will include 1.2M sq ft of Class A office space and is expected to deliver its first residential phases by Q3 2026.
            </div>
          </div>

          {/* Item 3 */}
          <div className="bg-[#131929] border border-[#1E2538] p-3 rounded-sm flex flex-col hover:border-[#334155] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#0891B2]/20 flex items-center justify-center shrink-0">
                <Train className="w-3.5 h-3.5 text-[#0891B2]" />
              </div>
              <div className="text-[#6B7A8D] text-xs font-mono shrink-0 w-12">2d</div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-bold text-[#E2E8F0] truncate group-hover:text-[#0891B2] transition-colors">BRT Phase 2 Environmental Review Approved</span>
                <span className="text-[10px] bg-[#0B0E1A] border border-[#1E2538] text-[#6B7A8D] px-1.5 py-0.5 rounded shrink-0">Tampa Bay Times</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded">
                  <TrendingUp className="w-3 h-3" /> POSITIVE
                </div>
                <div className="border border-[#0891B2] text-[#0891B2] text-[10px] font-mono px-2 py-0.5 rounded bg-[#0891B2]/5 flex items-center gap-1 hover:bg-[#0891B2]/20 transition-colors">
                  CLASSIFIED <ArrowRight className="w-2 h-2" /> EVENT #203
                </div>
              </div>
            </div>
          </div>

          {/* Item 4 */}
          <div className="bg-[#131929] border border-[#1E2538] p-3 rounded-sm flex flex-col hover:border-[#334155] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#6B7A8D]/20 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5 text-[#A0ABBE]" />
              </div>
              <div className="text-[#6B7A8D] text-xs font-mono shrink-0 w-12">3d</div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-bold text-[#E2E8F0] truncate group-hover:text-[#0891B2] transition-colors">FL Legislature Advances Insurance Rate Reform</span>
                <span className="text-[10px] bg-[#0B0E1A] border border-[#1E2538] text-[#6B7A8D] px-1.5 py-0.5 rounded shrink-0">Sun Sentinel</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#A0ABBE] bg-[#6B7A8D]/10 px-2 py-0.5 rounded">
                  NEUTRAL
                </div>
              </div>
            </div>
          </div>

          {/* Item 5 */}
          <div className="bg-[#131929] border border-[#1E2538] p-3 rounded-sm flex flex-col hover:border-[#334155] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#10B981]/20 flex items-center justify-center shrink-0">
                <CircleDollarSign className="w-3.5 h-3.5 text-[#10B981]" />
              </div>
              <div className="text-[#6B7A8D] text-xs font-mono shrink-0 w-12">4d</div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-bold text-[#E2E8F0] truncate group-hover:text-[#0891B2] transition-colors">Blackstone Acquires Westshore Portfolio $340M</span>
                <span className="text-[10px] bg-[#0B0E1A] border border-[#1E2538] text-[#6B7A8D] px-1.5 py-0.5 rounded shrink-0">CoStar</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded">
                  <TrendingUp className="w-3 h-3" /> POSITIVE
                </div>
              </div>
            </div>
          </div>

          {/* Item 6 */}
          <div className="bg-[#131929] border border-[#1E2538] p-3 rounded-sm flex flex-col hover:border-[#334155] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#6B7A8D]/20 flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5 text-[#A0ABBE]" />
              </div>
              <div className="text-[#6B7A8D] text-xs font-mono shrink-0 w-12">5d</div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-bold text-[#E2E8F0] truncate group-hover:text-[#0891B2] transition-colors">Tampa Apartment Vacancy Hits 5-Year Low</span>
                <span className="text-[10px] bg-[#0B0E1A] border border-[#1E2538] text-[#6B7A8D] px-1.5 py-0.5 rounded shrink-0">NMHC</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#A0ABBE] bg-[#6B7A8D]/10 px-2 py-0.5 rounded">
                  NEUTRAL
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* COLLAPSIBLE SUBSECTION: M35 STRUCTURED EVENTS */}
      <section className="flex flex-col">
        {/* Subsection header bar */}
        <div 
          onClick={() => setEventsExpanded(!eventsExpanded)}
          className={`w-full flex items-center justify-between p-3 bg-[#131929] border border-[#1E2538] border-l-[3px] border-l-[#0891B2] rounded-sm cursor-pointer hover:bg-[#1A2235] transition-colors shadow-[0_0_15px_rgba(217,119,6,0.05)] ${eventsExpanded ? 'rounded-b-none border-b-0' : ''}`}
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0891B2]" />
            <h2 className="text-[#0891B2] text-[11px] font-bold tracking-widest uppercase">M35 STRUCTURED EVENTS</h2>
            {eventsExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#0891B2]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#0891B2]" />
            )}
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-[#6B7A8D]">
              <span className="text-[#E2E8F0]">5</span> active <span className="mx-2">|</span> 
              <span className="text-[#E2E8F0]">2</span> transformative <span className="mx-2">|</span> 
              Last classified: 3 min ago
            </div>
            <button className="text-[#0891B2] hover:text-[#22D3EE] transition-colors flex items-center gap-1 bg-transparent border-none">
              Open Full Event Module <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {eventsExpanded && (
          <div className="bg-[#0B0E1A] border border-[#1E2538] border-t-0 border-l-[3px] border-l-[#0891B2] rounded-b-sm p-4 flex flex-col gap-5 shadow-[0_0_15px_rgba(217,119,6,0.03)]">
            
            {/* EventDensityStrip */}
            <div className="w-full h-[80px] bg-[#131929] border border-[#1E2538] relative flex flex-col justify-center px-4 rounded-sm">
              {/* Axis labels */}
              <div className="absolute top-2 w-full pr-8 flex justify-between text-[10px] text-[#6B7A8D] font-mono">
                <span>T-18mo</span>
                <span>T-12mo</span>
                <span>T-6mo</span>
                <span className="text-[#0891B2]">TODAY</span>
                <span>T+6mo</span>
                <span>T+12mo</span>
              </div>
              
              {/* Axis line */}
              <div className="w-full h-px bg-[#1E2538] absolute top-[50%] left-0"></div>
              
              {/* Today Dashed Line */}
              <div className="h-full w-px border-l border-dashed border-[#0891B2] absolute left-[60%] top-0 z-10 opacity-50"></div>
              
              {/* Ticks */}
              <div className="absolute top-[30%] left-[10%] w-0.5 h-6 bg-[#6B7A8D]"></div>
              <div className="absolute top-[20%] left-[12%] w-0.5 h-10 bg-[#0891B2]"></div>
              <div className="absolute top-[35%] left-[15%] w-0.5 h-4 bg-[#D97706]"></div>
              <div className="absolute top-[15%] left-[16%] w-0.5 h-12 bg-[#6B7A8D]"></div>
              
              <div className="absolute top-[25%] left-[30%] w-0.5 h-8 bg-[#0891B2]"></div>
              
              <div className="absolute top-[40%] left-[45%] w-0.5 h-3 bg-[#D97706]"></div>
              
              {/* Hovered Tick */}
              <div className="absolute top-[10%] left-[75%] w-1 h-14 bg-[#0891B2] cursor-pointer group z-20">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#0B0E1A] border border-[#1E2538] px-2 py-1 text-[10px] whitespace-nowrap rounded shadow-lg flex items-center gap-2 opacity-100 transition-opacity">
                  <Megaphone className="w-3 h-3 text-[#0891B2]" />
                  <span className="font-bold text-[#E2E8F0]">Amazon HQ2</span>
                  <span className="text-[#6B7A8D]">|</span>
                  <span className="text-[#6B7A8D]">MSA</span>
                  <span className="text-[#6B7A8D]">|</span>
                  <span className="text-[#0891B2] font-mono">T+8mo</span>
                </div>
              </div>
              
              <div className="absolute top-[30%] left-[85%] w-0.5 h-6 bg-[#6B7A8D]"></div>
            </div>

            {/* Active Event Cards Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Card 1 */}
              <div className="bg-[#131929] border border-[#1E2538] border-l-[3px] border-l-[#0891B2] p-4 flex flex-col gap-3 rounded-sm relative overflow-hidden group hover:border-[#334155] transition-colors cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[#0B0E1A] rounded text-[#0891B2]">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-[13px]">Amazon HQ2</div>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#0B0E1A] text-[#6B7A8D] border border-[#1E2538] rounded-sm">MSA</span>
                    <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#0891B2]/10 text-[#0891B2] border border-[#0891B2]/20 rounded-sm">FIRED</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs mt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#0891B2] animate-pulse"></div>
                    <span className="font-mono text-[#0891B2]">T+8mo</span>
                  </div>
                  <div className="px-1.5 py-0.5 text-[10px] bg-[#E2E8F0]/10 text-[#E2E8F0] rounded-sm font-mono">87% CONF</div>
                </div>
                
                <div className="text-xs text-[#A0ABBE] flex flex-col gap-1 mt-1 border-t border-[#1E2538] pt-3">
                  <div className="flex items-center justify-between">
                    <span>Rent Growth:</span>
                    <span className="font-mono text-[#10B981]">+1.4pp forecast</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tracking:</span>
                    <span className="font-mono text-[#10B981]">AHEAD</span>
                  </div>
                </div>
                
                <div className="mt-2 text-[#0891B2] text-[11px] font-bold tracking-wide flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  VIEW FULL IMPACT <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#131929] border border-[#1E2538] border-l-[3px] border-l-[#0891B2] p-4 flex flex-col gap-3 rounded-sm relative overflow-hidden group hover:border-[#334155] transition-colors cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[#0B0E1A] rounded text-[#0891B2]">
                      <Train className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-[13px]">BRT Phase 2</div>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#0B0E1A] text-[#0891B2] border border-[#1E2538] rounded-sm">Submarket</span>
                    <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20 rounded-sm">PENDING</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs mt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#D97706]"></div>
                    <span className="font-mono text-[#D97706]">T-4mo</span>
                  </div>
                  <div className="px-1.5 py-0.5 text-[10px] bg-[#E2E8F0]/10 text-[#E2E8F0] rounded-sm font-mono">62% CONF</div>
                </div>
                
                <div className="text-xs text-[#A0ABBE] flex flex-col gap-1 mt-1 border-t border-[#1E2538] pt-3">
                  <div className="flex items-center justify-between">
                    <span>Cap Rate:</span>
                    <span className="font-mono text-[#10B981]">-25bps forecast</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tracking:</span>
                    <span className="font-mono text-[#A0ABBE]">ON TARGET</span>
                  </div>
                </div>
                
                <div className="mt-2 text-[#0891B2] text-[11px] font-bold tracking-wide flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  VIEW FULL IMPACT <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-[#131929] border border-[#1E2538] border-l-[3px] border-l-[#6B7A8D] p-4 flex flex-col gap-3 rounded-sm relative overflow-hidden group hover:border-[#334155] transition-colors cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[#0B0E1A] rounded text-[#A0ABBE]">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-[13px]">FL Insurance Rate Cap</div>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#0B0E1A] text-[#A0ABBE] border border-[#1E2538] rounded-sm">State</span>
                    <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#E2E8F0]/10 text-[#E2E8F0] border border-[#E2E8F0]/20 rounded-sm">FIRED</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs mt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#E2E8F0]"></div>
                    <span className="font-mono text-[#E2E8F0]">T+2mo</span>
                  </div>
                  <div className="px-1.5 py-0.5 text-[10px] bg-[#E2E8F0]/10 text-[#E2E8F0] rounded-sm font-mono">95% CONF</div>
                </div>
                
                <div className="text-xs text-[#A0ABBE] flex flex-col gap-1 mt-1 border-t border-[#1E2538] pt-3">
                  <div className="flex items-center justify-between">
                    <span>OpEx:</span>
                    <span className="font-mono text-[#EF4444]">-4.2% forecast</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tracking:</span>
                    <span className="font-mono text-[#10B981]">AHEAD</span>
                  </div>
                </div>
                
                <div className="mt-2 text-[#0891B2] text-[11px] font-bold tracking-wide flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  VIEW FULL IMPACT <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* EventTimelineChart Mini */}
            <div className="w-full h-[160px] bg-[#131929] border border-[#1E2538] rounded-sm p-3 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                  <span className="text-[#A0ABBE] text-xs">Metric:</span>
                  <button className="flex items-center gap-1 text-[13px] font-bold text-[#E2E8F0] hover:text-[#0891B2] transition-colors">
                    Rent Growth (YoY) <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="flex gap-2 ml-4">
                    <button className="text-[#6B7A8D] text-[11px] hover:text-[#A0ABBE]">Cap Rate</button>
                    <button className="text-[#6B7A8D] text-[11px] hover:text-[#A0ABBE]">Absorption</button>
                  </div>
                </div>
                <button className="text-[#0891B2] text-[11px] font-mono border-b border-transparent hover:border-[#0891B2] transition-colors">
                  Toggle events
                </button>
              </div>
              
              {/* Chart Area */}
              <div className="flex-1 w-full mt-2 relative">
                <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1000 100">
                  {/* Grid lines */}
                  <line x1="0" y1="20" x2="1000" y2="20" stroke="#1E2538" strokeWidth="1" />
                  <line x1="0" y1="50" x2="1000" y2="50" stroke="#1E2538" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="0" y1="80" x2="1000" y2="80" stroke="#1E2538" strokeWidth="1" />
                  
                  {/* Forecast Cone */}
                  <polygon points="600,60 1000,20 1000,80" fill="#0891B2" fillOpacity="0.1" />
                  <polyline points="600,60 1000,50" fill="none" stroke="#0891B2" strokeWidth="2" strokeDasharray="4 4" />
                  
                  {/* Historical Line */}
                  <polyline points="0,85 100,82 200,75 300,78 400,65 500,62 600,60" fill="none" stroke="#E2E8F0" strokeWidth="2" />
                  
                  {/* Event Markers */}
                  <line x1="300" y1="0" x2="300" y2="100" stroke="#6B7A8D" strokeWidth="1" />
                  <circle cx="300" cy="78" r="4" fill="#0B0E1A" stroke="#6B7A8D" strokeWidth="2" />
                  
                  <line x1="500" y1="0" x2="500" y2="100" stroke="#0891B2" strokeWidth="1" />
                  <circle cx="500" cy="62" r="4" fill="#0B0E1A" stroke="#0891B2" strokeWidth="2" />
                  
                  <line x1="750" y1="0" x2="750" y2="100" stroke="#0891B2" strokeWidth="1" strokeDasharray="2 2" />
                </svg>
                
                {/* Overlay Labels */}
                <div className="absolute top-0 left-[30%] -translate-x-1/2 bg-[#0B0E1A] px-1 text-[9px] text-[#6B7A8D] font-mono border border-[#1E2538]">T-14mo</div>
                <div className="absolute top-0 left-[50%] -translate-x-1/2 bg-[#0B0E1A] px-1 text-[9px] text-[#0891B2] font-mono border border-[#0891B2]/30">T-4mo</div>
                <div className="absolute top-0 left-[75%] -translate-x-1/2 bg-[#0B0E1A] px-1 text-[9px] text-[#0891B2] font-mono border border-[#0891B2]/30">T+8mo</div>
                
                <div className="absolute bottom-0 left-[60%] -translate-x-1/2 bg-[#131929] px-2 py-0.5 text-[10px] text-[#A0ABBE] font-bold border border-[#1E2538] rounded-t-sm shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">TODAY</div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
