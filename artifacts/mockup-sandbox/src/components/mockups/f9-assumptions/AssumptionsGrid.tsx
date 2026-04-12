import React, { useState } from "react";
import { Lock, Edit2, Download, AlertTriangle } from "lucide-react";

export function AssumptionsGrid() {
  const [activeTab, setActiveTab] = useState("10 YR");
  const [hoveredCell, setHoveredCell] = useState<{row: string, col: number} | null>(null);

  const years = Array.from({ length: 10 }, (_, i) => i + 1);

  const renderCell = (
    value: string, 
    type: "normal" | "ai" | "override" | "m07" | "locked" | "flagged" | "computed" = "normal",
    tooltip?: string
  ) => {
    let className = "relative px-2 py-1 text-right text-[10px] font-mono tabular-nums border-r border-[#1e1e1e] group ";
    let content = value;
    let icon = null;

    switch (type) {
      case "ai":
        className += "text-cyan-400 ";
        icon = <sup className="absolute top-[2px] right-[2px] text-[6px] text-cyan-500">AI</sup>;
        break;
      case "override":
        className += "text-blue-400 bg-[#1e293b]/30 ";
        icon = <Edit2 className="absolute top-[2px] left-[2px] w-2 h-2 text-blue-500 opacity-0 group-hover:opacity-100" />;
        break;
      case "m07":
        className += "text-purple-400 ";
        icon = <sup className="absolute top-[2px] right-[2px] text-[6px] text-purple-500">M07</sup>;
        break;
      case "locked":
        className += "text-slate-500 bg-[#0f0f0f] ";
        icon = <Lock className="absolute top-[2px] left-[2px] w-2 h-2 text-slate-600" />;
        break;
      case "flagged":
        className += "text-amber-500 bg-amber-900/20 ";
        icon = <AlertTriangle className="absolute top-[2px] left-[2px] w-2 h-2 text-amber-500" />;
        break;
      case "computed":
        className += "text-slate-300 font-bold ";
        break;
      default:
        className += "text-slate-300 hover:border hover:border-blue-500/50 hover:bg-[#1e1e1e] cursor-text ";
    }

    return (
      <td className={className} title={tooltip}>
        {icon}
        {content}
      </td>
    );
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[600px] bg-[#0a0a0a] text-slate-300 font-sans text-xs border border-[#1e1e1e]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111111] border-b border-[#1e1e1e] sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-100 tracking-wider">F9 ASSUMPTIONS</span>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1e1e1e] rounded text-[11px]">
            <span className="text-slate-400">Sentosa Apartments</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">304 Units</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Atlanta, GA</span>
          </div>
        </div>

        <div className="flex bg-[#1e1e1e] p-0.5 rounded">
          {["5 YR", "7 YR", "10 YR"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-[10px] font-bold rounded-sm ${
                activeTab === tab
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab} {activeTab === tab && "✓"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3 py-1 text-[10px] font-bold bg-purple-900/40 text-purple-400 border border-purple-500/30 rounded hover:bg-purple-900/60 transition-colors">
            APPLY TRAFFIC [M07]
          </button>
          <button className="px-3 py-1 text-[10px] font-bold bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-900/60 transition-colors">
            RECALCULATE
          </button>
          <button className="p-1 text-slate-400 hover:text-slate-200 bg-[#1e1e1e] rounded">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto bg-[#0a0a0a]">
        <table className="w-full border-collapse" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
          <thead className="sticky top-0 z-10 bg-[#111111]">
            <tr className="border-b border-[#1e1e1e]">
              <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[240px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">
                ASSUMPTION
              </th>
              {years.map((year) => (
                <th key={year} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px] border-r border-[#1e1e1e]">
                  YEAR {year}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">
                CAGR / TOTAL
              </th>
            </tr>
          </thead>
          
          <tbody>
            {/* Section 1 */}
            <tr className="bg-[#1e1e1e]/50 border-y border-[#1e1e1e]">
              <td colSpan={12} className="px-3 py-1 text-[11px] font-bold text-[#e2e8f0] sticky left-0">1. UNIT ECONOMICS</td>
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-slate-600" /> Total Units
              </td>
              {years.map(y => renderCell("304", "locked"))}
              {renderCell("-", "locked")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Avg Unit SF
              </td>
              {years.map(y => renderCell("875", "locked"))}
              {renderCell("-", "locked")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Avg Rent / Unit
              </td>
              {["$2,001", "$2,061", "$2,123", "$2,186", "$2,252", "$2,319", "$2,389", "$2,461", "$2,534", "$2,610"].map((v, i) => 
                renderCell(v, i === 2 ? "override" : "ai")
              )}
              {renderCell("3.0%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Market Rent Growth %
              </td>
              {["3.0%", "3.0%", "3.1%", "3.1%", "3.2%", "3.2%", "3.1%", "3.0%", "3.0%", "2.9%"].map(v => renderCell(v, "ai"))}
              {renderCell("3.0%", "computed")}
            </tr>

            {/* Section 2 */}
            <tr className="bg-[#1e1e1e]/50 border-y border-[#1e1e1e]">
              <td colSpan={12} className="px-3 py-1 text-[11px] font-bold text-[#e2e8f0] sticky left-0">2. REVENUE ASSUMPTIONS</td>
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Vacancy Rate %
              </td>
              {["17.4%", "15.8%", "14.2%", "13.5%", "13.0%", "12.8%", "12.5%", "12.3%", "12.0%", "11.8%"].map((v, i) => 
                renderCell(v, i === 0 ? "flagged" : "normal", i === 0 ? "Broker: 17.4% | Platform: 14.8%" : undefined)
              )}
              {renderCell("13.5%", "computed")}
            </tr>
            <tr className="bg-[#1a0a2e]/50 border-b border-purple-900/30 hover:bg-[#1a0a2e] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e] border-r border-purple-900/30 z-10 flex items-center gap-1">
                <span className="text-[9px] border border-purple-500/50 rounded px-1 text-purple-500">M07</span> Implied Vacancy
              </td>
              {["15.1%", "14.6%", "14.0%", "13.5%", "13.2%", "12.9%", "12.6%", "12.4%", "12.1%", "11.9%"].map(v => renderCell(v, "m07"))}
              {renderCell("13.2%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Loss to Lease %
              </td>
              {years.map(y => renderCell("2.2%"))}
              {renderCell("2.2%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Concessions %
              </td>
              {["0.9%", "0.8%", "0.6%", "0.5%", "0.4%", "0.3%", "0.3%", "0.3%", "0.2%", "0.2%"].map(v => renderCell(v))}
              {renderCell("0.4%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Other Income / Unit
              </td>
              {["$65", "$67", "$69", "$71", "$73", "$75", "$77", "$80", "$82", "$85"].map(v => renderCell(v))}
              {renderCell("2.8%", "computed")}
            </tr>

            {/* Section 3 */}
            <tr className="bg-[#1e1e1e]/50 border-y border-[#1e1e1e]">
              <td colSpan={12} className="px-3 py-1 text-[11px] font-bold text-[#e2e8f0] sticky left-0">3. OPEX ASSUMPTIONS</td>
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                OpEx Growth Rate %
              </td>
              {["2.5%", "2.5%", "2.6%", "2.7%", "2.7%", "2.8%", "2.8%", "2.9%", "3.0%", "3.0%"].map(v => renderCell(v))}
              {renderCell("2.7%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Management Fee %
              </td>
              {years.map(y => renderCell("3.2%"))}
              {renderCell("3.2%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-slate-600" /> Real Estate Tax Growth
              </td>
              {years.map(y => renderCell("4.0%", "locked"))}
              {renderCell("4.0%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Insurance Growth
              </td>
              {years.map(y => renderCell("3.5%"))}
              {renderCell("3.5%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-slate-600" /> Repl. Reserves / Unit
              </td>
              {years.map(y => renderCell("$250", "locked"))}
              {renderCell("$250", "computed")}
            </tr>

            {/* Section 4 */}
            <tr className="bg-[#1e1e1e]/50 border-y border-[#1e1e1e]">
              <td colSpan={12} className="px-3 py-1 text-[11px] font-bold text-[#e2e8f0] sticky left-0">4. FINANCING</td>
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Loan Amount
              </td>
              {renderCell("$42,500,000")}
              {years.slice(1).map(y => renderCell("-"))}
              {renderCell("-", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Interest Rate
              </td>
              {years.map((y, i) => renderCell("6.75%", i < 3 ? "normal" : "computed"))}
              {renderCell("6.75%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                LTC
              </td>
              {renderCell("65.0%")}
              {years.slice(1).map(y => renderCell("-"))}
              {renderCell("-", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                DSCR
              </td>
              {["1.42×", "1.55×", "1.68×", "1.72×", "1.76×", "1.81×", "1.85×", "1.90×", "1.94×", "1.99×"].map(v => renderCell(v, "computed"))}
              {renderCell("1.76×", "computed")}
            </tr>

            {/* Section 5 */}
            <tr className="bg-[#1e1e1e]/50 border-y border-[#1e1e1e]">
              <td colSpan={12} className="px-3 py-1 text-[11px] font-bold text-[#e2e8f0] sticky left-0">5. DISPOSITION</td>
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Exit Cap Rate
              </td>
              {["5.50%", "5.50%", "5.50%", "5.50%", "5.50%", "5.75%", "5.75%", "5.75%", "5.75%", "6.00%"].map((v, i) => 
                renderCell(v, i >= 5 ? "ai" : "normal", "Platform suggests 5.75% for Yr 7+ based on market cycle")
              )}
              {renderCell("-", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
                Disposition Costs %
              </td>
              {years.map(y => renderCell("2.0%"))}
              {renderCell("2.0%", "computed")}
            </tr>

            {/* Section 6 */}
            <tr className="bg-[#1e1e1e]/50 border-y border-[#1e1e1e]">
              <td colSpan={12} className="px-3 py-1 text-[11px] font-bold text-[#e2e8f0] sticky left-0">6. RETURNS SUMMARY</td>
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 bg-[#0a0a0a] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-slate-600" /> NOI
              </td>
              {["$3.73M", "$3.88M", "$4.01M", "$4.15M", "$4.28M", "$4.43M", "$4.57M", "$4.72M", "$4.87M", "$5.02M"].map(v => renderCell(v, "locked"))}
              {renderCell("3.4%", "computed")}
            </tr>
            <tr className="border-b border-[#1e1e1e]/50 bg-[#0a0a0a] h-[22px]">
              <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-slate-600" /> Projected Value
              </td>
              {["$67.9M", "$70.5M", "$72.9M", "$75.5M", "$77.8M", "$77.0M", "$79.5M", "$82.1M", "$84.7M", "$83.7M"].map(v => renderCell(v, "locked"))}
              {renderCell("2.4%", "computed")}
            </tr>

            {/* Section 7 - M07 Signals */}
            <tr className="bg-[#1a0a2e] border-y border-purple-900/50 mt-4">
              <td colSpan={12} className="px-3 py-1 text-[11px] font-bold text-purple-300 sticky left-0">7. M07 TRAFFIC SIGNALS</td>
            </tr>
            <tr className="border-b border-purple-900/30 bg-[#1a0a2e]/50 h-[22px]">
              <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e]/90 border-r border-purple-900/50 z-10">
                M07: Walk-ins/Week
              </td>
              {["1,847", "1,920", "1,998", "2,081", "2,168", "-", "-", "-", "-", "-"].map((v, i) => renderCell(v, i < 5 ? "m07" : "locked"))}
              {renderCell("4.1%", "computed")}
            </tr>
            <tr className="border-b border-purple-900/30 bg-[#1a0a2e]/50 h-[22px]">
              <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e]/90 border-r border-purple-900/50 z-10">
                M07: Lease Conv. Rate
              </td>
              {["18.3%", "18.8%", "19.2%", "19.5%", "19.8%", "-", "-", "-", "-", "-"].map((v, i) => renderCell(v, i < 5 ? "m07" : "locked"))}
              {renderCell("-", "computed")}
            </tr>
            <tr className="border-b border-purple-900/30 bg-[#1a0a2e]/50 h-[22px]">
              <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e]/90 border-r border-purple-900/50 z-10">
                M07: Occupancy Implied
              </td>
              {["82.6%", "84.2%", "85.8%", "86.5%", "87.0%", "-", "-", "-", "-", "-"].map((v, i) => renderCell(v, i < 5 ? "m07" : "locked"))}
              {renderCell("-", "computed")}
            </tr>
            <tr className="border-b border-purple-900/30 bg-[#1a0a2e]/50 h-[22px]">
              <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e]/90 border-r border-purple-900/50 z-10">
                M07: Rent Support Score
              </td>
              <td colSpan={11} className="px-2 py-1 text-left">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-900/40 text-amber-400 border border-amber-500/30 rounded inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> HIDDEN GEM
                </span>
                <span className="ml-4 text-[10px] text-purple-400">Confidence: HIGH (85%)</span>
              </td>
            </tr>

          </tbody>
        </table>
      </div>

      {/* Bottom Summary Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-t border-[#1e1e1e] sticky bottom-0 z-20">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold tracking-wider">IRR LEVERED</span>
            <span className="text-sm font-mono text-green-400">18.7%</span>
          </div>
          <div className="w-px h-8 bg-[#1e1e1e]"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold tracking-wider">EQUITY MULTIPLE</span>
            <span className="text-sm font-mono text-slate-200">2.34×</span>
          </div>
          <div className="w-px h-8 bg-[#1e1e1e]"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold tracking-wider">STABILIZED VALUE</span>
            <span className="text-sm font-mono text-slate-200">$67.9M</span>
          </div>
        </div>
        
        <div className="text-[10px] text-slate-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500/50 block"></span>
          MODEL SYNCED
        </div>
      </div>
    </div>
  );
}
