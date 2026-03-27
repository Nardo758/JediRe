import React from 'react';
import { ArrowUpRight, ArrowDownRight, ChevronLeft, Zap, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const MetricCard = ({ name, value, change, id, weight, status }) => {
  const isPositive = change?.startsWith('+');
  
  let bgClass = "bg-[#1a2332]";
  let borderClass = "border-[#1e293b]";
  
  if (status === 'pass') {
    bgClass = "bg-[#1a2332]";
    borderClass = "border-[#22c55e]/30";
  } else if (status === 'fail') {
    bgClass = "bg-[#1a2332]";
    borderClass = "border-[#ef4444]/30";
  }

  return (
    <div className={`${bgClass} border ${borderClass} p-3 flex flex-col justify-between relative overflow-hidden group hover:border-[#14b8a6] transition-colors`}>
      {status === 'pass' && <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-[#22c55e]/10 to-transparent pointer-events-none" />}
      {status === 'fail' && <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-[#ef4444]/10 to-transparent pointer-events-none" />}
      
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] uppercase text-[#94a3b8] font-sans tracking-wider leading-tight max-w-[70%]">
          {name}
        </span>
        <span className="px-1.5 py-0.5 bg-[#111827] border border-[#1e293b] text-[9px] text-[#e2e8f0] font-mono rounded-sm">
          {id}
        </span>
      </div>
      
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-xl text-[#e2e8f0] font-mono font-medium tracking-tight">
          {value}
        </span>
        {change && (
          <span className={`text-xs font-mono flex items-center ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {change.replace('+', '').replace('-', '')}
          </span>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-[#1e293b] flex items-center justify-between">
        <span className="text-[9px] text-[#94a3b8] font-sans">Weight: {weight}%</span>
        <div className="w-16 h-1 bg-[#111827] rounded-full overflow-hidden">
          <div className="h-full bg-[#14b8a6]" style={{ width: `${weight}%` }} />
        </div>
      </div>
    </div>
  );
};

export function MetricsEnhanced() {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e2e8f0] font-sans selection:bg-[#14b8a6] selection:text-white pb-10">
      {/* HEADER */}
      <header className="bg-[#111827] border-b border-[#1e293b] px-4 py-2 sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#14b8a6] rounded-sm"></div>
          <span className="text-[11px] font-mono tracking-widest text-[#e2e8f0] uppercase">
            Strategy Metrics Integration — MSA → Submarket → Property Drill-down
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-[#94a3b8]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-pulse"></span>
            SYSTEM NORMAL
          </span>
          <span>|</span>
          <span>10:42:15 UTC</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        
        {/* SECTION 1: MSA LEVEL CARD */}
        <section className="bg-[#111827] border border-[#1e293b] rounded-sm flex flex-col">
          <div className="border-b border-[#1e293b] px-4 py-3 flex justify-between items-center bg-[#1a2332]">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium tracking-wide uppercase">MSA: Atlanta, GA</h2>
              <span className="px-2 py-0.5 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 rounded text-[10px] font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full"></span> LIVE
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#94a3b8] uppercase font-sans">JEDI Score</span>
                <span className="px-2 py-1 bg-[#14b8a6]/10 text-[#14b8a6] border border-[#14b8a6]/30 text-xs font-mono font-bold rounded-sm">
                  78/100
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[#1e293b]">
            {/* Left: Metrics Grid */}
            <div className="w-full md:w-[65%] p-4">
              <div className="mb-3 flex justify-between items-center">
                <h3 className="text-xs text-[#94a3b8] font-mono uppercase tracking-wider">Strategy Signals</h3>
                <span className="text-[10px] text-[#94a3b8] font-sans">Showing 16 weighted metrics</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Row 1 */}
                <MetricCard name="Population Growth" value="+1.8%" change="+0.2%" id="D-12" weight={15} status="pass" />
                <MetricCard name="Employment Growth" value="+2.4%" change="+0.4%" id="D-01" weight={10} status="pass" />
                <MetricCard name="Job-Housing Ratio" value="1.24" change="-0.02" id="D-03" weight={5} status="neutral" />
                <MetricCard name="Median Income" value="$72.4K" change="+3.2%" id="D-05" weight={5} status="pass" />
                
                {/* Row 2 */}
                <MetricCard name="Avg Rent" value="$1,487" change="+1.2%" id="LIVE" weight={10} status="neutral" />
                <MetricCard name="Rent Growth" value="+4.1%" change="-0.5%" id="M-01" weight={15} status="pass" />
                <MetricCard name="Occupancy" value="94.2%" change="+0.1%" id="S-03" weight={10} status="pass" />
                <MetricCard name="Absorption Rate" value="88%" change="-2%" id="S-05" weight={5} status="fail" />

                {/* Row 3 */}
                <MetricCard name="Pipeline Units" value="18,400" change="+12%" id="S-01" weight={5} status="fail" />
                <MetricCard name="Permit Momentum" value="-12%" change="-5%" id="S-06" weight={5} status="pass" />
                <MetricCard name="Cap Rate" value="5.2%" change="+0.1%" id="M-04" weight={5} status="neutral" />
                <MetricCard name="NOI Growth" value="+3.8%" change="-0.2%" id="M-03" weight={5} status="pass" />

                {/* Row 4 */}
                <MetricCard name="Traffic Index" value="74" change="+1.5%" id="T-01" weight={2} status="pass" />
                <MetricCard name="Traffic Growth" value="+6.2%" change="+1.1%" id="T-03" weight={1} status="pass" />
                <MetricCard name="Walk Score" value="62" change="+0%" id="P-05" weight={1} status="neutral" />
                <MetricCard name="Dev Capacity" value="0.34" change="-0.01" id="DC-01" weight={1} status="neutral" />
              </div>
            </div>

            {/* Right: Commentary Side Panel */}
            <div className="w-full md:w-[35%] p-4 bg-[#111827] flex flex-col gap-5">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs text-[#94a3b8] font-mono uppercase tracking-wider">Market Narrative</h3>
                  <div className="px-2 py-0.5 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30 rounded flex items-center gap-1 text-[10px] font-mono">
                    <Zap className="w-3 h-3" />
                    Delta: 22pts
                  </div>
                </div>
                <div className="text-sm text-[#e2e8f0] font-sans leading-relaxed space-y-3 opacity-90">
                  <p>
                    Atlanta continues to exhibit strong demand fundamentals, driven by sustained in-migration and employment growth (+2.4% YoY) outpacing the national average. Despite a heavy supply pipeline (18,400 units), absorption remains resilient in core submarkets.
                  </p>
                  <p>
                    The Strategy Builder flags a <strong>22pt arbitrage opportunity</strong> in Class B value-add assets where current rent growth (+4.1%) is artificially suppressed by temporary leasing friction.
                  </p>
                </div>
              </div>

              <div className="border-t border-[#1e293b] pt-4">
                <h3 className="text-xs text-[#94a3b8] font-mono uppercase tracking-wider mb-3">Investment Thesis</h3>
                <ul className="space-y-2 text-xs font-sans">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
                    <span><strong className="text-white">Demographic tailwinds:</strong> Outsized population growth drives core demand.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" />
                    <span><strong className="text-white">Supply pockets:</strong> New deliveries concentrated in urban core, depressing Class A rent growth temporarily.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
                    <span><strong className="text-white">Value-add spread:</strong> Wide gap between Class A and B rents provides renovation runway.</span>
                  </li>
                </ul>
              </div>
              
              <div className="mt-auto pt-4">
                <div className="bg-[#1a2332] border border-[#1e293b] p-3 rounded flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-[#94a3b8] uppercase font-sans mb-1">Active Strategy</div>
                    <div className="text-sm font-medium text-[#14b8a6]">Core Plus Value-Add</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-mono text-white">78<span className="text-sm text-[#94a3b8]">/100</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: SUBMARKET LEVEL CARD */}
        <section className="bg-[#111827] border border-[#1e293b] rounded-sm flex flex-col relative before:absolute before:-top-6 before:left-12 before:h-6 before:w-px before:bg-[#1e293b]">
          <div className="border-b border-[#1e293b] px-4 py-3 flex justify-between items-center bg-[#1a2332]">
            <div className="flex items-center gap-3">
              <button className="text-[#94a3b8] hover:text-white transition-colors flex items-center gap-1 text-[10px] uppercase tracking-wider font-sans bg-[#111827] px-2 py-1 rounded border border-[#1e293b]">
                <ChevronLeft className="w-3 h-3" /> Back to MSA
              </button>
              <h2 className="text-sm font-medium tracking-wide uppercase ml-2 text-[#e2e8f0]">Submarket: Midtown Atlanta</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#94a3b8] uppercase font-sans">JEDI Score</span>
                <span className="px-2 py-1 bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/50 text-xs font-mono font-bold rounded-sm shadow-[0_0_10px_rgba(20,184,166,0.2)]">
                  87/100
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[#1e293b]">
            {/* Left: Metrics & Table */}
            <div className="w-full md:w-[65%] p-4 flex flex-col gap-6">
              <div>
                <div className="mb-3 flex justify-between items-center">
                  <h3 className="text-xs text-[#94a3b8] font-mono uppercase tracking-wider">Submarket Signals</h3>
                  <span className="text-[10px] text-[#94a3b8] font-sans">Midtown Specific Data</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard name="Submarket Rent" value="$1,820" change="+1.8%" id="S-R" weight={20} status="pass" />
                  <MetricCard name="Rent Growth" value="+5.2%" change="+1.1%" id="S-RG" weight={25} status="pass" />
                  <MetricCard name="Occupancy" value="96.1%" change="+1.9%" id="S-O" weight={15} status="pass" />
                  <MetricCard name="Total Units" value="12,400" change="" id="S-U" weight={0} status="neutral" />
                  
                  <MetricCard name="Traffic Growth" value="+8.4%" change="+2.2%" id="S-TG" weight={10} status="pass" />
                  <MetricCard name="Class A Mix" value="62%" change="" id="S-CA" weight={5} status="neutral" />
                  <MetricCard name="Pipeline Units" value="2,100" change="-5%" id="S-P" weight={15} status="fail" />
                  <MetricCard name="Absorption Rate" value="94%" change="+6%" id="S-AR" weight={10} status="pass" />
                </div>
              </div>

              <div>
                <h3 className="text-xs text-[#94a3b8] font-mono uppercase tracking-wider mb-3">Peer Comparison</h3>
                <div className="border border-[#1e293b] rounded-sm overflow-hidden bg-[#1a2332]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#111827] border-b border-[#1e293b] text-[#94a3b8]">
                      <tr>
                        <th className="px-3 py-2 font-normal uppercase tracking-wider">Metric</th>
                        <th className="px-3 py-2 font-normal uppercase tracking-wider text-[#e2e8f0]">Midtown</th>
                        <th className="px-3 py-2 font-normal uppercase tracking-wider">Buckhead</th>
                        <th className="px-3 py-2 font-normal uppercase tracking-wider">Decatur</th>
                        <th className="px-3 py-2 font-normal uppercase tracking-wider border-l border-[#1e293b]">MSA Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]">
                      <tr className="hover:bg-[#111827]/50 transition-colors">
                        <td className="px-3 py-2 text-[#94a3b8] font-sans">Rent Growth</td>
                        <td className="px-3 py-2 text-[#14b8a6] font-bold">+5.2%</td>
                        <td className="px-3 py-2 text-[#e2e8f0]">+4.1%</td>
                        <td className="px-3 py-2 text-[#e2e8f0]">+3.8%</td>
                        <td className="px-3 py-2 text-[#94a3b8] border-l border-[#1e293b]">+4.1%</td>
                      </tr>
                      <tr className="hover:bg-[#111827]/50 transition-colors">
                        <td className="px-3 py-2 text-[#94a3b8] font-sans">Occupancy</td>
                        <td className="px-3 py-2 text-[#14b8a6] font-bold">96.1%</td>
                        <td className="px-3 py-2 text-[#e2e8f0]">95.3%</td>
                        <td className="px-3 py-2 text-[#e2e8f0]">94.8%</td>
                        <td className="px-3 py-2 text-[#94a3b8] border-l border-[#1e293b]">94.2%</td>
                      </tr>
                      <tr className="hover:bg-[#111827]/50 transition-colors">
                        <td className="px-3 py-2 text-[#94a3b8] font-sans">Traffic Idx</td>
                        <td className="px-3 py-2 text-[#14b8a6] font-bold">82</td>
                        <td className="px-3 py-2 text-[#e2e8f0]">71</td>
                        <td className="px-3 py-2 text-[#e2e8f0]">68</td>
                        <td className="px-3 py-2 text-[#94a3b8] border-l border-[#1e293b]">74</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Submarket Commentary */}
            <div className="w-full md:w-[35%] p-4 bg-[#111827] flex flex-col gap-4">
               <div>
                <h3 className="text-xs text-[#94a3b8] font-mono uppercase tracking-wider mb-3">Submarket Narrative</h3>
                <p className="text-sm text-[#e2e8f0] font-sans leading-relaxed opacity-90">
                  Midtown is outperforming the broader MSA across key strategy metrics. Exceptional rent growth (+5.2%) and high occupancy (96.1%) indicate strong tenant retention and pricing power. The submarket represents a prime target for the Core Plus Value-Add strategy.
                </p>
              </div>

              <div className="bg-[#1a2332] border border-[#14b8a6]/30 p-4 rounded-sm relative overflow-hidden mt-2">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#14b8a6]/20 to-transparent pointer-events-none" />
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] uppercase text-[#14b8a6] font-bold tracking-wider">Top 3 Opportunity</span>
                  <Zap className="w-4 h-4 text-[#14b8a6]" />
                </div>
                <div className="text-2xl font-mono text-white mb-1">91<span className="text-base text-[#94a3b8]">/100</span></div>
                <div className="text-xs font-sans text-[#e2e8f0]">Class B repositioning — 340bps spread</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: PROPERTY LEVEL CARD */}
        <section className="bg-[#111827] border border-[#14b8a6]/40 rounded-sm flex flex-col relative before:absolute before:-top-6 before:left-12 before:h-6 before:w-px before:bg-[#1e293b] shadow-[0_0_15px_rgba(20,184,166,0.05)]">
          <div className="border-b border-[#1e293b] px-4 py-3 flex justify-between items-center bg-[#1a2332]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <button className="text-[#94a3b8] hover:text-white transition-colors flex items-center gap-1 text-[10px] uppercase tracking-wider font-sans bg-[#111827] px-2 py-1 rounded border border-[#1e293b]">
                  <ChevronLeft className="w-3 h-3" /> Back to Submarket
                </button>
                <h2 className="text-sm font-medium tracking-wide uppercase ml-2 text-white">Property: Midtown Place Apartments</h2>
              </div>
              <div className="text-[10px] text-[#94a3b8] font-mono ml-[120px]">
                245 Units | Built 2018 | Class A
              </div>
            </div>
          </div>

          <div className="p-4 flex flex-col gap-6">
            {/* Top row - Vitals */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#1a2332] border border-[#1e293b] p-3 flex flex-col items-center justify-center">
                <span className="text-[10px] text-[#94a3b8] uppercase font-sans mb-1">Current Rent</span>
                <span className="text-lg font-mono text-white">$1,920<span className="text-xs text-[#94a3b8]">/mo</span></span>
              </div>
              <div className="bg-[#1a2332] border border-[#1e293b] p-3 flex flex-col items-center justify-center">
                <span className="text-[10px] text-[#94a3b8] uppercase font-sans mb-1">Occupancy</span>
                <span className="text-lg font-mono text-white">97.2%</span>
              </div>
              <div className="bg-[#1a2332] border border-[#1e293b] p-3 flex flex-col items-center justify-center">
                <span className="text-[10px] text-[#94a3b8] uppercase font-sans mb-1">Cap Rate</span>
                <span className="text-lg font-mono text-white">4.8%</span>
              </div>
              <div className="bg-[#1a2332] border border-[#1e293b] p-3 flex flex-col items-center justify-center">
                <span className="text-[10px] text-[#94a3b8] uppercase font-sans mb-1">NOI</span>
                <span className="text-lg font-mono text-white">$4.2M</span>
              </div>
              <div className="bg-[#111827] border border-[#22c55e]/30 p-3 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[#22c55e]/5 animate-pulse"></div>
                <span className="text-[10px] text-[#22c55e] uppercase font-bold mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full"></span> Data Feed
                </span>
                <span className="text-sm font-mono text-[#22c55e]">LIVE</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              {/* Strategy Gates */}
              <div className="w-full md:w-[65%]">
                <div className="mb-3 flex justify-between items-center">
                  <h3 className="text-xs text-[#94a3b8] font-mono uppercase tracking-wider">Strategy Gate Results</h3>
                  <span className="text-[10px] font-sans px-2 py-1 bg-[#1a2332] rounded border border-[#1e293b] text-[#e2e8f0]">
                    <strong className="text-[#22c55e]">12/14</strong> Gates Passed | <strong className="text-[#f59e0b]">2</strong> Soft Fails (-8pts)
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="bg-[#1a2332] border border-[#22c55e]/30 p-2.5 flex items-center justify-between rounded-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                      <span className="text-xs font-sans text-[#e2e8f0]">Unit Count ≥ 100</span>
                    </div>
                    <span className="text-xs font-mono text-[#94a3b8]">245 <span className="text-[#22c55e] font-bold">PASS</span></span>
                  </div>
                  
                  <div className="bg-[#1a2332] border border-[#22c55e]/30 p-2.5 flex items-center justify-between rounded-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                      <span className="text-xs font-sans text-[#e2e8f0]">Year Built ≥ 2010</span>
                    </div>
                    <span className="text-xs font-mono text-[#94a3b8]">2018 <span className="text-[#22c55e] font-bold">PASS</span></span>
                  </div>

                  <div className="bg-[#1a2332] border border-[#22c55e]/30 p-2.5 flex items-center justify-between rounded-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                      <span className="text-xs font-sans text-[#e2e8f0]">Occupancy ≥ 93%</span>
                    </div>
                    <span className="text-xs font-mono text-[#94a3b8]">97.2% <span className="text-[#22c55e] font-bold">PASS</span></span>
                  </div>

                  <div className="bg-[#1a2332] border border-[#22c55e]/30 p-2.5 flex items-center justify-between rounded-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                      <span className="text-xs font-sans text-[#e2e8f0]">Rent Growth ≥ 3%</span>
                    </div>
                    <span className="text-xs font-mono text-[#94a3b8]">+5.8% <span className="text-[#22c55e] font-bold">PASS</span></span>
                  </div>

                  <div className="bg-[#1a2332] border border-[#ef4444]/30 p-2.5 flex items-center justify-between rounded-sm relative overflow-hidden">
                     <div className="absolute inset-y-0 left-0 w-1 bg-[#ef4444]"></div>
                    <div className="flex items-center gap-2 pl-2">
                      <XCircle className="w-4 h-4 text-[#ef4444]" />
                      <span className="text-xs font-sans text-[#e2e8f0]">Cap Rate ≥ 5.5%</span>
                    </div>
                    <span className="text-xs font-mono text-[#94a3b8]">4.8% <span className="text-[#ef4444] font-bold">FAIL</span></span>
                  </div>

                  <div className="bg-[#1a2332] border border-[#f59e0b]/30 p-2.5 flex items-center justify-between rounded-sm relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#f59e0b]"></div>
                    <div className="flex items-center gap-2 pl-2">
                      <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                      <span className="text-xs font-sans text-[#e2e8f0]">Traffic Score ≥ 70</span>
                    </div>
                    <span className="text-xs font-mono text-[#94a3b8]">68 <span className="text-[#f59e0b] font-bold">SOFT (-5)</span></span>
                  </div>
                </div>
              </div>

              {/* Final Score & Commentary */}
              <div className="w-full md:w-[35%] flex flex-col gap-4">
                <div className="bg-[#1a2332] border border-[#1e293b] p-4 rounded-sm flex items-center gap-4">
                   <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-[#1e293b]"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <path
                          className="text-[#14b8a6]"
                          strokeDasharray="86, 100"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-mono font-bold text-white leading-none">86</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs text-[#94a3b8] font-mono uppercase tracking-wider mb-2">Strategy Score</h3>
                      <div className="inline-block px-3 py-1 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30 text-xs font-bold font-sans uppercase rounded tracking-wide">
                        Acquire
                      </div>
                    </div>
                </div>

                <div className="bg-[#1a2332] border border-[#1e293b] p-3 rounded-sm">
                  <h3 className="text-[10px] text-[#94a3b8] font-mono uppercase tracking-wider mb-2">Signal Breakdown</h3>
                  <div className="flex w-full h-2 rounded-full overflow-hidden">
                    <div className="bg-[#14b8a6]" style={{ width: '28%' }} title="Demand +24"></div>
                    <div className="bg-[#3b82f6]" style={{ width: '18%' }} title="Supply +16"></div>
                    <div className="bg-[#8b5cf6]" style={{ width: '21%' }} title="Momentum +18"></div>
                    <div className="bg-[#f59e0b]" style={{ width: '23%' }} title="Position +20"></div>
                    <div className="bg-[#ef4444]" style={{ width: '10%' }} title="Risk +8"></div>
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-[#94a3b8] mt-1 uppercase">
                    <span>Dem +24</span>
                    <span>Sup +16</span>
                    <span>Mom +18</span>
                    <span>Pos +20</span>
                    <span>Rsk +8</span>
                  </div>
                </div>

                <div className="text-xs text-[#e2e8f0] font-sans leading-relaxed opacity-90 border-l-2 border-[#14b8a6] pl-3">
                  This property represents a strong acquisition candidate within the Midtown submarket. Above-market occupancy and rent growth, combined with a 2018 vintage, align well with the Core Plus Value-Add strategy. Minor traffic score softness (-5pt penalty) is offset by strong demand fundamentals.
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0a0e17] border-t border-[#1e293b] px-4 py-2 z-50 text-[10px] font-mono text-[#94a3b8] flex justify-between items-center">
        <div className="flex items-center gap-4">
          <span className="text-[#e2e8f0]">Strategy: <strong className="text-[#14b8a6] font-normal">Core Plus Value-Add</strong></span>
          <span className="w-px h-3 bg-[#1e293b]"></span>
          <span>Weighted Signals: <span className="text-[#e2e8f0]">D:30% S:25% M:20% P:15% R:10%</span></span>
          <span className="w-px h-3 bg-[#1e293b]"></span>
          <span>Gates: <span className="text-[#e2e8f0]">14 defined</span></span>
        </div>
        <div>
          Last Refreshed: <span className="text-[#e2e8f0]">2 hrs ago</span>
        </div>
      </footer>
    </div>
  );
}

export default MetricsEnhanced;
