import React from 'react';

export function InlineCards() {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e2e8f0] p-6 font-mono text-sm">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Section 1: Header */}
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-4">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold tracking-wider">ATLANTA, GA — MSA OVERVIEW</h1>
            <div className="flex items-center space-x-1 bg-[#111827] px-2 py-1 rounded border border-[#1e293b]">
              <div className="w-2 h-2 rounded-full bg-[#14b8a6] animate-pulse"></div>
              <span className="text-xs text-[#14b8a6] font-bold">LIVE</span>
            </div>
          </div>
          <div className="text-[#94a3b8] text-xs">
            68% Coverage <span className="mx-2 text-[#1e293b]">|</span> 2,847 Properties <span className="mx-2 text-[#1e293b]">|</span> 142K Units
          </div>
        </div>

        {/* Section 2: Strategy Dashboard Banner */}
        <div className="bg-[#111827] border-l-4 border-l-[#14b8a6] border-y border-r border-y-[#1e293b] border-r-[#1e293b] p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-4">
            <div className="text-[#14b8a6]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div>
              <div className="text-xs text-[#94a3b8] mb-1">ACTIVE STRATEGY</div>
              <div className="font-bold text-lg">Core Plus Value-Add</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-xs text-[#94a3b8]">STRATEGY SCORE</div>
              </div>
              <div className="relative w-12 h-12 flex items-center justify-center rounded-full border-2 border-[#14b8a6]">
                <span className="text-xl font-bold text-[#14b8a6]">78</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end">
              <div className="flex items-center space-x-2 bg-[#f59e0b]/10 border border-[#f59e0b]/30 px-2 py-1 rounded mb-1">
                <span className="text-xs font-bold text-[#f59e0b]">⚡ ARBITRAGE DETECTED</span>
              </div>
              <div className="text-xs text-[#f59e0b]">Delta: 22pts vs. Opportunistic</div>
            </div>
            
            <div className="border-l border-[#1e293b] pl-6">
              <div className="text-xs text-[#94a3b8] mb-1">12/14 Gates Passed</div>
              <div className="flex space-x-1">
                {[...Array(12)].map((_, i) => <div key={`pass-${i}`} className="w-1.5 h-1.5 rounded-full bg-[#14b8a6]"></div>)}
                {[...Array(2)].map((_, i) => <div key={`fail-${i}`} className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></div>)}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Vitals Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111827] border border-[#1e293b] p-4 relative">
            <div className="absolute top-2 right-2 text-xs font-bold text-[#14b8a6] bg-[#14b8a6]/10 px-1 rounded">+8pts</div>
            <div className="text-xs text-[#94a3b8] mb-1 uppercase tracking-wider">Population</div>
            <div className="text-2xl font-bold">6.2M <span className="text-sm text-[#14b8a6] ml-2">(+1.8%)</span></div>
          </div>
          <div className="bg-[#111827] border border-[#1e293b] p-4 relative">
            <div className="absolute top-2 right-2 text-xs font-bold text-[#14b8a6] bg-[#14b8a6]/10 px-1 rounded">+12pts</div>
            <div className="text-xs text-[#94a3b8] mb-1 uppercase tracking-wider">Jobs Ratio</div>
            <div className="text-2xl font-bold">1.24 <span className="text-sm text-[#14b8a6] ml-2">(+0.06)</span></div>
          </div>
          <div className="bg-[#111827] border border-[#1e293b] p-4 relative">
            <div className="absolute top-2 right-2 text-xs font-bold text-[#14b8a6] bg-[#14b8a6]/10 px-1 rounded">+6pts</div>
            <div className="text-xs text-[#94a3b8] mb-1 uppercase tracking-wider">Median Income</div>
            <div className="text-2xl font-bold">$72,400 <span className="text-sm text-[#14b8a6] ml-2">(+3.2%)</span></div>
          </div>
          <div className="bg-[#111827] border border-[#1e293b] p-4 relative">
            <div className="absolute top-2 right-2 text-xs font-bold text-[#14b8a6] bg-[#14b8a6]/10 px-1 rounded">+9pts</div>
            <div className="text-xs text-[#94a3b8] mb-1 uppercase tracking-wider">Avg Rent</div>
            <div className="text-2xl font-bold">$1,487 <span className="text-sm text-[#14b8a6] ml-2">(+4.1%)</span></div>
          </div>
          <div className="bg-[#111827] border border-[#1e293b] p-4 relative">
            <div className="absolute top-2 right-2 text-xs font-bold text-[#ef4444] bg-[#ef4444]/10 px-1 rounded">-3pts</div>
            <div className="text-xs text-[#94a3b8] mb-1 uppercase tracking-wider">Occupancy</div>
            <div className="text-2xl font-bold">94.2% <span className="text-sm text-[#ef4444] ml-2">(-0.3%)</span></div>
          </div>
          <div className="bg-[#111827] border border-[#1e293b] p-4 relative">
            <div className="absolute top-2 right-2 text-xs font-bold text-[#94a3b8] bg-[#1e293b] px-1 rounded">comp</div>
            <div className="text-xs text-[#94a3b8] mb-1 uppercase tracking-wider">JEDI Score</div>
            <div className="text-2xl font-bold">78<span className="text-sm text-[#94a3b8]">/100</span></div>
          </div>
        </div>

        {/* Section 4: AI Market Narrative */}
        <div className="bg-[#111827] border-t-2 border-t-[#14b8a6] border-b border-x border-[#1e293b] shadow-md">
          <div className="bg-[#1e293b] px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 12 2.1 7.1"/><path d="m12 12 9.9 4.9"/></svg>
              <span className="text-xs font-bold text-[#e2e8f0]">AI COMMENTARY</span>
            </div>
            <span className="text-[10px] text-[#94a3b8]">Generated just now</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-[#94a3b8] mb-3 uppercase font-bold tracking-wider">Market Narrative</div>
              <div className="space-y-3 text-sm leading-relaxed">
                <p>Atlanta's multifamily market continues to demonstrate resilient fundamentals despite elevated supply pipeline. Demand drivers remain strong with 1.8% population growth and a favorable 1.24 jobs ratio.</p>
                <p>Near-term supply pressure from 18,400 units delivering in H2 2026 warrants selective positioning. Core submarkets with established demand profiles offer the most defensible entry points.</p>
              </div>
            </div>
            <div className="border-l border-[#1e293b] pl-6 flex flex-col justify-between">
              <div>
                <div className="text-xs text-[#94a3b8] mb-3 uppercase font-bold tracking-wider">Investment Thesis</div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="text-[#14b8a6] mr-2">✓</span>
                    <span>Population growth exceeds national avg by 0.9%</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#14b8a6] mr-2">✓</span>
                    <span>Employment diversification reducing concentration risk</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#f59e0b] mr-2">⚠</span>
                    <span className="text-[#e2e8f0]">Near-term supply deliveries may pressure occupancy -80bps</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#ef4444] mr-2">✗</span>
                    <span className="text-[#e2e8f0]">Insurance costs escalating in flood-prone submarkets</span>
                  </li>
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between">
                <span className="text-xs text-[#94a3b8]">Recommendation</span>
                <span className="bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/50 px-3 py-1 rounded text-xs font-bold">SELECTIVE BUY</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: 5-Signal Health Bar */}
        <div className="bg-[#111827] border border-[#1e293b] p-5">
          <div className="text-xs text-[#94a3b8] mb-4 uppercase font-bold tracking-wider">Market Health Signals</div>
          <div className="space-y-5">
            {[
              { label: 'Demand', score: 82, color: 'bg-[#14b8a6]', text: 'Strong population and employment growth driving above-trend absorption' },
              { label: 'Supply', score: 65, color: 'bg-[#f59e0b]', text: '18.4K units in pipeline; absorption runway 14 months' },
              { label: 'Momentum', score: 71, color: 'bg-[#14b8a6]', text: 'Positive rent trajectory +4.1% YoY; stable occupancy trend' },
              { label: 'Dev Capacity', score: 58, color: 'bg-[#f59e0b]', text: 'Zoning capacity constrained in core submarkets' },
              { label: 'Risk', score: 44, color: 'bg-[#ef4444]', text: 'Insurance cost escalation offset by diversified employment base' }
            ].map((signal) => (
              <div key={signal.label} className="flex items-start space-x-4">
                <div className="w-24 shrink-0 text-sm">{signal.label}</div>
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <div className="flex-1 h-1.5 bg-[#1e293b] overflow-hidden rounded">
                      <div className={`h-full ${signal.color}`} style={{ width: `${signal.score}%` }}></div>
                    </div>
                    <div className="w-8 text-right text-sm font-bold">{signal.score}</div>
                  </div>
                  <div className="text-xs text-[#94a3b8]">{signal.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 6: Risk & Opportunity Split */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111827] border border-[#1e293b] border-t-2 border-t-[#ef4444] p-4">
            <div className="flex items-center space-x-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span className="text-xs font-bold tracking-wider uppercase text-[#ef4444]">Risk Watch</span>
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex flex-col">
                <span className="text-[#e2e8f0]">• Construction Pipeline: 18,400 units Q3-Q4 2026 <span className="text-xs text-[#ef4444] font-bold border border-[#ef4444]/30 bg-[#ef4444]/10 px-1 py-0.5 rounded ml-1">HIGH</span></span>
              </li>
              <li className="flex flex-col">
                <span className="text-[#e2e8f0]">• Insurance Escalation: +22% YoY Cobb County <span className="text-xs text-[#f59e0b] font-bold border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-1 py-0.5 rounded ml-1">MEDIUM</span></span>
              </li>
              <li className="flex flex-col">
                <span className="text-[#e2e8f0]">• Interest Rate Sensitivity: 150bps cap rate expansion risk <span className="text-xs text-[#94a3b8] font-bold border border-[#1e293b] bg-[#1e293b]/50 px-1 py-0.5 rounded ml-1">LOW</span></span>
              </li>
            </ul>
          </div>
          
          <div className="bg-[#111827] border border-[#1e293b] border-t-2 border-t-[#14b8a6] p-4">
            <div className="flex items-center space-x-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span className="text-xs font-bold tracking-wider uppercase text-[#14b8a6]">Opportunity Signals</span>
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start">
                <span className="text-[#94a3b8] mr-2">1.</span>
                <span className="text-[#e2e8f0]">Midtown Class B repositioning — 340bps spread to Class A</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#94a3b8] mr-2">2.</span>
                <span className="text-[#e2e8f0]">Alpharetta tech corridor — 12% employment growth</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#94a3b8] mr-2">3.</span>
                <span className="text-[#e2e8f0]">South Fulton emerging submarket — below replacement cost basis</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Section 7: Top Submarkets Table */}
        <div className="bg-[#111827] border border-[#1e293b]">
          <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between bg-[#1e293b]/30">
            <span className="text-xs font-bold tracking-wider uppercase">Top Submarkets & Strategies</span>
            <button className="text-xs text-[#14b8a6] hover:underline">View All →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-[#94a3b8] uppercase bg-[#0f1319] border-b border-[#1e293b]">
                <tr>
                  <th className="px-4 py-3 font-normal">Submarket</th>
                  <th className="px-4 py-3 font-normal">JEDI</th>
                  <th className="px-4 py-3 font-normal">Rent Δ</th>
                  <th className="px-4 py-3 font-normal">Units</th>
                  <th className="px-4 py-3 font-normal">Strategy Score</th>
                  <th className="px-4 py-3 font-normal">Top Strategy</th>
                  <th className="px-4 py-3 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                <tr className="hover:bg-[#1e293b]/30 transition-colors">
                  <td className="px-4 py-3 font-medium">Midtown</td>
                  <td className="px-4 py-3 text-[#14b8a6]">86</td>
                  <td className="px-4 py-3 text-[#14b8a6]">+5.2%</td>
                  <td className="px-4 py-3">24,500</td>
                  <td className="px-4 py-3"><span className="text-[#14b8a6] font-bold">82</span> <span className="text-[#94a3b8] text-xs">/100</span></td>
                  <td className="px-4 py-3 text-[#94a3b8]">Value-Add</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs border border-[#1e293b] bg-[#0f1319] hover:bg-[#1e293b] px-2 py-1 rounded transition-colors">Analyze</button>
                  </td>
                </tr>
                <tr className="hover:bg-[#1e293b]/30 transition-colors">
                  <td className="px-4 py-3 font-medium">Alpharetta</td>
                  <td className="px-4 py-3 text-[#14b8a6]">84</td>
                  <td className="px-4 py-3 text-[#14b8a6]">+4.8%</td>
                  <td className="px-4 py-3">18,200</td>
                  <td className="px-4 py-3"><span className="text-[#14b8a6] font-bold">79</span> <span className="text-[#94a3b8] text-xs">/100</span></td>
                  <td className="px-4 py-3 text-[#94a3b8]">Core Plus</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs border border-[#1e293b] bg-[#0f1319] hover:bg-[#1e293b] px-2 py-1 rounded transition-colors">Analyze</button>
                  </td>
                </tr>
                <tr className="hover:bg-[#1e293b]/30 transition-colors">
                  <td className="px-4 py-3 font-medium">Buckhead</td>
                  <td className="px-4 py-3 text-[#f59e0b]">72</td>
                  <td className="px-4 py-3 text-[#f59e0b]">+2.1%</td>
                  <td className="px-4 py-3">21,800</td>
                  <td className="px-4 py-3"><span className="text-[#f59e0b] font-bold">65</span> <span className="text-[#94a3b8] text-xs">/100</span></td>
                  <td className="px-4 py-3 text-[#94a3b8]">Core</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs border border-[#1e293b] bg-[#0f1319] hover:bg-[#1e293b] px-2 py-1 rounded transition-colors">Analyze</button>
                  </td>
                </tr>
                <tr className="hover:bg-[#1e293b]/30 transition-colors">
                  <td className="px-4 py-3 font-medium">South Fulton</td>
                  <td className="px-4 py-3 text-[#14b8a6]">78</td>
                  <td className="px-4 py-3 text-[#14b8a6]">+6.4%</td>
                  <td className="px-4 py-3">12,400</td>
                  <td className="px-4 py-3"><span className="text-[#14b8a6] font-bold">88</span> <span className="text-[#94a3b8] text-xs">/100</span></td>
                  <td className="px-4 py-3 text-[#94a3b8]">Opportunistic</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs border border-[#1e293b] bg-[#0f1319] hover:bg-[#1e293b] px-2 py-1 rounded transition-colors">Analyze</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
