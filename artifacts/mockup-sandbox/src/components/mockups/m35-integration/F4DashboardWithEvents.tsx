import React, { useState } from "react";
import { Search, Plus, Download, ChevronRight, Zap, AlertTriangle, AlertCircle, ArrowUpRight, ArrowRight, ArrowDownRight, Info, CheckCircle2 } from "lucide-react";

export function F4DashboardWithEvents() {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0B0E1A] text-[#E2E8F0] font-sans flex flex-col">
      {/* PAGE HEADER */}
      <header className="flex flex-col border-b border-[#1E2538] bg-[#0B0E1A] px-6 pt-4 pb-0 z-10 sticky top-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#E2E8F0]">F4 MARKETS</h1>
            <span className="text-[#6B7A8D]">/</span>
            <span className="text-[#A0ABBE] font-medium tracking-wide">DASHBOARD</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0ABBE]" />
              <input 
                type="text" 
                placeholder="Search markets..." 
                className="bg-[#131929] border border-[#1E2538] rounded pl-9 pr-4 py-1.5 text-sm text-[#E2E8F0] placeholder:text-[#6B7A8D] focus:outline-none focus:border-[#0891B2] w-64"
              />
            </div>
            <button className="flex items-center gap-2 bg-[#131929] hover:bg-[#1E2538] border border-[#1E2538] rounded px-3 py-1.5 text-sm font-medium transition-colors text-[#E2E8F0]">
              <Plus className="w-4 h-4 text-[#0891B2]" /> Add Market
            </button>
            <button className="flex items-center gap-2 bg-[#131929] hover:bg-[#1E2538] border border-[#1E2538] rounded px-3 py-1.5 text-sm font-medium transition-colors text-[#E2E8F0]">
              <Download className="w-4 h-4 text-[#A0ABBE]" /> Export
            </button>
          </div>
        </div>
        
        {/* Tab bar */}
        <div className="flex gap-6 mt-2">
          {["DASHBOARD ●", "BROWSE", "SUBMARKETS", "PROPERTIES", "COMPARE"].map((tab, i) => (
            <button 
              key={tab} 
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                i === 0 
                  ? "border-[#0891B2] text-[#E2E8F0]" 
                  : "border-transparent text-[#6B7A8D] hover:text-[#A0ABBE]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {/* CROSS-MARKET EVENT INTELLIGENCE STRIP */}
        <div className="bg-[#131929] border border-[#D97706]/30 rounded-lg overflow-hidden flex flex-col md:flex-row items-center p-3 gap-4 shadow-[0_0_15px_rgba(217,119,6,0.05)]">
          <div className="flex items-center gap-2 text-[#D97706] whitespace-nowrap font-bold text-xs shrink-0 pl-2">
            <Zap className="w-4 h-4 fill-current" />
            7 TRANSFORMATIVE EVENTS ACROSS TRACKED MARKETS THIS MONTH
          </div>
          
          <div className="flex-1 flex flex-wrap items-center gap-2 overflow-hidden px-2">
            <button className="flex items-center gap-1.5 bg-[#0891B2]/10 border border-[#0891B2]/30 text-[#0891B2] px-3 py-1 rounded-full text-xs font-medium hover:bg-[#0891B2]/20 transition-colors whitespace-nowrap">
              <span>📣</span> Amazon HQ2 — Tampa MSA <span className="text-[#10B981]">↑IRR</span>
            </button>
            <div className="flex items-center gap-1.5 bg-[#1E2538]/50 border border-[#1E2538] text-[#A0ABBE] px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-default">
              <span>🌀</span> Hurricane Idalia — Tampa MSA <span className="text-[#EF4444]">↓Risk</span>
            </div>
            <button className="flex items-center gap-1.5 bg-[#0891B2]/10 border border-[#0891B2]/30 text-[#0891B2] px-3 py-1 rounded-full text-xs font-medium hover:bg-[#0891B2]/20 transition-colors whitespace-nowrap">
              <span>📣</span> Apple Campus — Raleigh MSA <span className="text-[#10B981]">↑IRR</span>
            </button>
            <button className="text-[#6B7A8D] text-xs font-medium hover:text-[#E2E8F0] whitespace-nowrap ml-1 flex items-center">
              +4 more <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
          
          <div className="flex items-center gap-4 shrink-0 pr-2 border-l border-[#1E2538] pl-4">
            <div className="text-xs font-medium text-[#A0ABBE]">
              Avg portfolio IRR uplift from events: <span className="text-[#10B981]">+1.4pp</span>
            </div>
            <button className="text-xs font-medium text-[#0891B2] hover:text-[#E2E8F0] flex items-center transition-colors">
              View Event Feed <ChevronRight className="w-3 h-3 ml-1" />
            </button>
          </div>
        </div>

        {/* KPI CARDS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#131929] border border-[#1E2538] rounded-lg p-4">
            <div className="text-xs font-medium text-[#6B7A8D] mb-1 tracking-wider">TRACKED MARKETS</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#E2E8F0]">6</span>
              <span className="text-xs font-medium text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">+1 this month</span>
            </div>
          </div>
          <div className="bg-[#131929] border border-[#1E2538] rounded-lg p-4">
            <div className="text-xs font-medium text-[#6B7A8D] mb-1 tracking-wider">ACTIVE ALERTS</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#E2E8F0]">14</span>
              <span className="text-xs font-medium text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> 3 critical
              </span>
            </div>
          </div>
          <div className="bg-[#131929] border border-[#1E2538] rounded-lg p-4">
            <div className="text-xs font-medium text-[#6B7A8D] mb-1 tracking-wider">AVG JEDI SCORE</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#E2E8F0]">78.4</span>
              <span className="text-xs font-medium text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">▲2.1 vs last month</span>
            </div>
          </div>
          <div className="bg-[#131929] border border-[#1E2538] rounded-lg p-4">
            <div className="text-xs font-medium text-[#6B7A8D] mb-1 tracking-wider">EVENT SENSITIVITY</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#D97706]">HIGH</span>
              <span className="text-xs font-medium text-[#A0ABBE]">3 of 6 markets</span>
            </div>
          </div>
        </div>

        {/* MARKETS TABLE */}
        <div className="bg-[#131929] border border-[#1E2538] rounded-lg overflow-hidden relative">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[#1E2538]/50 text-[#A0ABBE] border-b border-[#1E2538]">
                  <th className="px-4 py-3 font-medium text-xs tracking-wider">MARKET</th>
                  <th className="px-4 py-3 font-medium text-xs tracking-wider">JEDI SCORE</th>
                  <th className="px-4 py-3 font-medium text-xs tracking-wider">RENT GROWTH</th>
                  <th className="px-4 py-3 font-medium text-xs tracking-wider">PIPELINE</th>
                  <th className="px-4 py-3 font-medium text-xs tracking-wider">CONSTRAINT</th>
                  <th className="px-4 py-3 font-medium text-xs tracking-wider">EVENT STATUS</th>
                  <th className="px-4 py-3 font-medium text-xs tracking-wider text-right">TREND</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2538]">
                {/* 1. Atlanta, GA */}
                <tr className="hover:bg-[#1E2538]/30 transition-colors group cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#E2E8F0]">Atlanta, GA</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E2538] text-[#A0ABBE]">T1</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[#10B981] font-semibold">87</span>
                  </td>
                  <td className="px-4 py-3 text-[#10B981] font-medium">+4.2%</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#E2E8F0]">15.8%</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#A0ABBE]">58</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 px-2.5 py-0.5 rounded text-xs font-medium">
                      2 events <span className="opacity-50">—</span> AHEAD <CheckCircle2 className="w-3 h-3 ml-0.5" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-end gap-0.5 h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 bg-[#10B981] h-[30%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#10B981] h-[40%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#10B981] h-[60%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#10B981] h-[80%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#10B981] h-[100%] rounded-sm"></div>
                      <ArrowUpRight className="w-3 h-3 text-[#10B981] ml-1 mb-0.5" />
                    </div>
                  </td>
                </tr>

                {/* 2. Charlotte, NC */}
                <tr className="hover:bg-[#1E2538]/30 transition-colors group cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#E2E8F0]">Charlotte, NC</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E2538] text-[#A0ABBE]">T2</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[#10B981] font-semibold">82</span>
                  </td>
                  <td className="px-4 py-3 text-[#10B981] font-medium">+3.5%</td>
                  <td className="px-4 py-3 text-[#E2E8F0]">12.4%</td>
                  <td className="px-4 py-3 text-[#A0ABBE]">68</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 bg-[#A0ABBE]/10 text-[#A0ABBE] border border-[#A0ABBE]/30 px-2.5 py-0.5 rounded text-xs font-medium">
                      1 event <span className="opacity-50">—</span> ON PACE
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-end gap-0.5 h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 bg-[#A0ABBE] h-[60%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[50%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[55%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[60%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[60%] rounded-sm"></div>
                      <ArrowRight className="w-3 h-3 text-[#A0ABBE] ml-1 mb-0.5" />
                    </div>
                  </td>
                </tr>

                {/* 3. Raleigh, NC */}
                <tr className="hover:bg-[#1E2538]/30 transition-colors group cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#E2E8F0]">Raleigh, NC</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E2538] text-[#A0ABBE]">T2</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[#10B981] font-semibold">85</span>
                  </td>
                  <td className="px-4 py-3 text-[#10B981] font-medium">+3.9%</td>
                  <td className="px-4 py-3 text-[#E2E8F0]">11.8%</td>
                  <td className="px-4 py-3 text-[#A0ABBE]">72</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 px-2.5 py-0.5 rounded text-xs font-medium">
                      3 events <span className="opacity-50">—</span> 1 AHEAD
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-end gap-0.5 h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 bg-[#10B981] h-[40%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#10B981] h-[50%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#10B981] h-[70%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#10B981] h-[80%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#10B981] h-[90%] rounded-sm"></div>
                      <ArrowUpRight className="w-3 h-3 text-[#10B981] ml-1 mb-0.5" />
                    </div>
                  </td>
                </tr>

                {/* 4. Tampa, FL */}
                <tr 
                  className="hover:bg-[#D97706]/10 transition-colors group cursor-pointer relative"
                  onMouseEnter={() => setHoveredRow('tampa')}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#E2E8F0]">Tampa, FL</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E2538] text-[#A0ABBE]">T2</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[#D97706] font-semibold">74</span>
                  </td>
                  <td className="px-4 py-3 text-[#10B981] font-medium">+3.1%</td>
                  <td className="px-4 py-3 text-[#E2E8F0]">10.2%</td>
                  <td className="px-4 py-3 text-[#A0ABBE]">74</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/30 px-2.5 py-0.5 rounded text-xs font-medium">
                      5 events <span className="opacity-50">—</span> 1 BEHIND <AlertTriangle className="w-3 h-3 ml-0.5" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-end gap-0.5 h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 bg-[#A0ABBE] h-[60%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[65%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[60%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[55%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[55%] rounded-sm"></div>
                      <ArrowRight className="w-3 h-3 text-[#A0ABBE] ml-1 mb-0.5" />
                    </div>
                  </td>
                  
                  {hoveredRow === 'tampa' && (
                    <td colSpan={0} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[400px]">
                      <div className="bg-[#1E2538] border border-[#D97706]/50 shadow-xl rounded p-3 flex gap-3 text-sm animate-in fade-in zoom-in-95 duration-100 pointer-events-none">
                        <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-[#E2E8F0] mb-1">1 event behind forecast</div>
                          <div className="text-[#A0ABBE]">Hurricane Idalia recovery -0.4pp vs playbook</div>
                        </div>
                      </div>
                    </td>
                  )}
                </tr>

                {/* 5. Nashville, TN */}
                <tr className="hover:bg-[#1E2538]/30 transition-colors group cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#E2E8F0]">Nashville, TN</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E2538] text-[#A0ABBE]">T2</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[#10B981] font-semibold">78</span>
                  </td>
                  <td className="px-4 py-3 text-[#10B981] font-medium">+2.8%</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#E2E8F0]">18.2%</span>
                      <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#A0ABBE]">42</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 bg-[#1E2538]/50 text-[#A0ABBE] border border-[#1E2538] px-2.5 py-0.5 rounded text-xs font-medium">
                      0 events
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-end gap-0.5 h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 bg-[#A0ABBE] h-[70%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[65%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[60%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[60%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#A0ABBE] h-[60%] rounded-sm"></div>
                      <ArrowRight className="w-3 h-3 text-[#A0ABBE] ml-1 mb-0.5" />
                    </div>
                  </td>
                </tr>

                {/* 6. Dallas, TX */}
                <tr className="hover:bg-[#1E2538]/30 transition-colors group cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#E2E8F0]">Dallas, TX</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E2538] text-[#A0ABBE]">T1</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[#D97706] font-semibold">71</span>
                  </td>
                  <td className="px-4 py-3 text-[#10B981] font-medium">+2.4%</td>
                  <td className="px-4 py-3 text-[#E2E8F0]">14.2%</td>
                  <td className="px-4 py-3 text-[#A0ABBE]">51</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 bg-[#A0ABBE]/10 text-[#A0ABBE] border border-[#A0ABBE]/30 px-2.5 py-0.5 rounded text-xs font-medium">
                      1 event <span className="opacity-50">—</span> ON PACE
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-end gap-0.5 h-4 opacity-70 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 bg-[#EF4444] h-[80%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#EF4444] h-[75%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#EF4444] h-[60%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#EF4444] h-[50%] rounded-sm"></div>
                      <div className="w-1.5 bg-[#EF4444] h-[40%] rounded-sm"></div>
                      <ArrowDownRight className="w-3 h-3 text-[#EF4444] ml-1 mb-0.5" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          {/* MARKET MOVERS */}
          <div className="bg-[#131929] border border-[#1E2538] rounded-lg p-4">
            <h3 className="text-[#E2E8F0] font-semibold mb-4 text-sm flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#0891B2] rounded-sm"></span>
              MARKET MOVERS
            </h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-[#6B7A8D] border-b border-[#1E2538]">
                <tr>
                  <th className="font-medium text-left pb-2">MARKET</th>
                  <th className="font-medium text-right pb-2">SCORE</th>
                  <th className="font-medium text-right pb-2">CHANGE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2538]/50">
                <tr>
                  <td className="py-2.5 font-medium text-[#E2E8F0]">Atlanta, GA</td>
                  <td className="py-2.5 text-right font-mono text-[#E2E8F0]">87</td>
                  <td className="py-2.5 text-right text-[#10B981] font-medium">+4.2</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-[#E2E8F0]">Raleigh, NC</td>
                  <td className="py-2.5 text-right font-mono text-[#E2E8F0]">85</td>
                  <td className="py-2.5 text-right text-[#10B981] font-medium">+3.1</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-[#E2E8F0]">Austin, TX</td>
                  <td className="py-2.5 text-right font-mono text-[#E2E8F0]">80</td>
                  <td className="py-2.5 text-right text-[#10B981] font-medium">+2.5</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* UPCOMING EVENT MATERIALIZATIONS */}
          <div className="bg-[#131929] border border-[#1E2538] rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[#E2E8F0] font-semibold text-sm flex items-center gap-2">
                <span className="w-1.5 h-4 bg-[#D97706] rounded-sm"></span>
                UPCOMING EVENT MATERIALIZATIONS
              </h3>
              <button className="text-xs text-[#0891B2] hover:text-[#E2E8F0] transition-colors">View All</button>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 p-3 rounded bg-[#1E2538]/30 hover:bg-[#1E2538]/50 transition-colors border border-transparent hover:border-[#1E2538] cursor-pointer">
                <div className="bg-[#0891B2]/10 text-[#0891B2] px-2 py-1 rounded flex flex-col items-center justify-center shrink-0 w-12 text-xs font-bold leading-tight border border-[#0891B2]/20">
                  <span>OCT</span>
                  <span>14</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#E2E8F0] text-sm truncate">Amazon HQ2 Phase 2 Groundbreaking</div>
                  <div className="text-xs text-[#A0ABBE] mt-0.5 flex items-center gap-1.5">
                    <span className="bg-[#1E2538] px-1.5 py-0.5 rounded text-[10px]">Tampa MSA</span>
                    <span>•</span>
                    <span className="text-[#10B981]">Affects 4 tracking deals</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded bg-[#1E2538]/30 hover:bg-[#1E2538]/50 transition-colors border border-transparent hover:border-[#1E2538] cursor-pointer">
                <div className="bg-[#EF4444]/10 text-[#EF4444] px-2 py-1 rounded flex flex-col items-center justify-center shrink-0 w-12 text-xs font-bold leading-tight border border-[#EF4444]/20">
                  <span>OCT</span>
                  <span>22</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#E2E8F0] text-sm truncate">Local Property Tax Reassessment Publish</div>
                  <div className="text-xs text-[#A0ABBE] mt-0.5 flex items-center gap-1.5">
                    <span className="bg-[#1E2538] px-1.5 py-0.5 rounded text-[10px]">Dallas TX</span>
                    <span>•</span>
                    <span className="text-[#EF4444]">Potential risk across 12 deals</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded bg-[#1E2538]/30 hover:bg-[#1E2538]/50 transition-colors border border-transparent hover:border-[#1E2538] cursor-pointer">
                <div className="bg-[#A0ABBE]/10 text-[#A0ABBE] px-2 py-1 rounded flex flex-col items-center justify-center shrink-0 w-12 text-xs font-bold leading-tight border border-[#A0ABBE]/20">
                  <span>NOV</span>
                  <span>05</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#E2E8F0] text-sm truncate">Regional Transit Expansion Vote</div>
                  <div className="text-xs text-[#A0ABBE] mt-0.5 flex items-center gap-1.5">
                    <span className="bg-[#1E2538] px-1.5 py-0.5 rounded text-[10px]">Charlotte NC</span>
                    <span>•</span>
                    <span className="text-[#A0ABBE]">Pending decision</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
