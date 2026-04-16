import React, { useState } from 'react';

export function SidePanel() {
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="flex h-screen w-full bg-[#0a0e17] text-[#e2e8f0] font-mono overflow-hidden">
      {/* Left Side — Main Content */}
      <div className={`flex flex-col p-4 transition-all duration-300 ${panelOpen ? 'w-[70%]' : 'w-full'} overflow-y-auto`}>
        
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6 border-b border-[#1e293b] pb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-wider text-white">ATLANTA, GA — MSA OVERVIEW</h1>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-green-500 text-xs font-bold uppercase">Live</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
            <div className="flex flex-col items-end">
              <div className="flex justify-between w-48 mb-1">
                <span>Coverage</span>
                <span className="text-[#e2e8f0]">68%</span>
              </div>
              <div className="w-48 h-1.5 bg-[#111827] overflow-hidden">
                <div className="h-full bg-[#14b8a6] w-[68%]"></div>
              </div>
            </div>
            <div className="border-l border-[#1e293b] pl-4">
              <span className="text-[#e2e8f0] font-bold">2,847</span> Properties
            </div>
            <div className="border-l border-[#1e293b] pl-4">
              <span className="text-[#e2e8f0] font-bold">142K</span> Units
            </div>
          </div>
        </div>

        {/* Vitals Grid */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Population', value: '6.2M', change: '+1.8% YoY', changeColor: 'text-green-400', signal: 'D-12', score: 82 },
            { label: 'Jobs Ratio', value: '1.24', change: '+0.06', changeColor: 'text-green-400', signal: 'D-01', score: 85 },
            { label: 'Median Income', value: '$72,400', change: '+3.2%', changeColor: 'text-green-400', signal: 'D-05', score: 79 },
            { label: 'Avg Rent', value: '$1,487', change: '+4.1%', changeColor: 'text-green-400', signal: 'LIVE', signalColor: 'bg-green-500 text-black', score: 75 },
            { label: 'Occupancy', value: '94.2%', change: '-0.3%', changeColor: 'text-[#ef4444]', signal: 'S-03', score: 62 },
            { label: 'JEDI Score', value: '78/100', isBar: true, signal: 'JEDI', score: 78 }
          ].map((v, i) => (
            <div key={i} className="bg-[#111827] border border-[#1e293b] p-3 relative flex flex-col justify-between group hover:border-[#14b8a6] transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-[#94a3b8] uppercase">{v.label}</span>
                <span className={`text-[9px] px-1 font-bold ${v.signalColor || 'bg-[#1e293b] text-[#94a3b8]'}`}>
                  {v.signal}
                </span>
              </div>
              
              <div className="flex flex-col">
                <div className="text-lg font-bold text-white">{v.value}</div>
                {v.isBar ? (
                  <div className="w-full h-1 mt-1.5 bg-[#1e293b]">
                    <div className="h-full bg-[#14b8a6]" style={{ width: '78%' }}></div>
                  </div>
                ) : (
                  <div className={`text-xs ${v.changeColor}`}>{v.change}</div>
                )}
              </div>

              {/* Strategy Badge */}
              <div className={`absolute -top-2 -right-2 px-1.5 py-0.5 text-[9px] font-bold border border-[#0a0e17] 
                ${v.score >= 80 ? 'bg-[#14b8a6] text-black' : 'bg-[#f59e0b] text-black'}`}>
                S:{v.score}
              </div>
            </div>
          ))}
        </div>

        {/* 5-Signal Health Bar */}
        <div className="bg-[#111827] border border-[#1e293b] p-4 mb-6">
          <div className="text-xs font-bold text-[#94a3b8] mb-3 uppercase tracking-wider">Market Signals Health</div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Demand', score: 82, color: 'bg-[#14b8a6]' },
              { label: 'Supply', score: 65, color: 'bg-[#f59e0b]' },
              { label: 'Momentum', score: 71, color: 'bg-[#14b8a6]' },
              { label: 'Dev Cap', score: 58, color: 'bg-[#f59e0b]' },
              { label: 'Risk', score: 44, color: 'bg-[#ef4444]' }
            ].map((s, i) => (
              <div key={i} className="flex flex-col">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#e2e8f0]">{s.label}</span>
                  <span className="text-[#94a3b8]">{s.score}</span>
                </div>
                <div className="h-1.5 bg-[#0a0e17] w-full">
                  <div className={`h-full ${s.color}`} style={{ width: `${s.score}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy Match Section */}
        <div className="bg-[#111827] border border-[#f59e0b] p-4 mb-6 relative shadow-[0_0_15px_rgba(245,158,11,0.1)]">
          <div className="absolute top-0 right-0 bg-[#f59e0b] text-black text-xs font-bold px-2 py-1">
            ⚡ ARBITRAGE DETECTED — Delta: 22pts
          </div>
          
          <div className="flex justify-between items-center">
            <div className="w-1/3">
              <div className="text-xs text-[#94a3b8] uppercase mb-1">Active Strategy</div>
              <div className="text-lg font-bold text-white mb-2">Core Plus Value-Add</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-black text-[#14b8a6]">78<span className="text-sm text-[#94a3b8] font-normal">/100</span></div>
                <div className="text-xs px-2 py-0.5 bg-[#14b8a6] bg-opacity-20 text-[#14b8a6] border border-[#14b8a6]">HIGH MATCH</div>
              </div>
            </div>

            <div className="w-1/3 px-4 border-x border-[#1e293b]">
              <div className="text-xs text-[#94a3b8] uppercase mb-2">Signal Contributions</div>
              <div className="flex h-8 w-full bg-[#0a0e17] gap-[1px]">
                <div className="bg-[#14b8a6] h-full" style={{ width: '40%' }} title="Demand: +40"></div>
                <div className="bg-[#14b8a6] h-full opacity-60" style={{ width: '30%' }} title="Momentum: +30"></div>
                <div className="bg-[#f59e0b] h-full" style={{ width: '20%' }} title="Supply: +20"></div>
                <div className="bg-[#ef4444] h-full" style={{ width: '10%' }} title="Risk: -10"></div>
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-[#94a3b8]">
                <span>Positive</span>
                <span>Negative</span>
              </div>
            </div>

            <div className="w-1/3 pl-4">
              <div className="text-xs text-[#94a3b8] uppercase mb-2">Gate Results</div>
              <div className="text-sm font-bold text-white mb-2">12/14 Gates Passed</div>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className={`h-2 w-2 rounded-full ${i < 12 ? 'bg-[#14b8a6]' : 'bg-[#ef4444]'}`}></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Submarkets Table */}
        <div className="bg-[#111827] border border-[#1e293b] flex-1 min-h-[250px] flex flex-col">
          <div className="p-3 border-b border-[#1e293b] flex justify-between items-center">
            <h3 className="text-sm font-bold text-[#e2e8f0] uppercase">Top Submarkets</h3>
            <span className="text-xs text-[#14b8a6] cursor-pointer hover:underline">View All →</span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-[#94a3b8] uppercase bg-[#0a0e17] sticky top-0">
                <tr>
                  <th className="p-3 font-normal">Submarket</th>
                  <th className="p-3 font-normal">JEDI</th>
                  <th className="p-3 font-normal">Rent Growth</th>
                  <th className="p-3 font-normal">Units</th>
                  <th className="p-3 font-normal border-l border-[#1e293b] text-[#f59e0b]">Strategy Score</th>
                  <th className="p-3 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {[
                  { name: 'Midtown', jedi: 87, rent: '+5.2%', units: '12K', score: 91 },
                  { name: 'Buckhead', jedi: 82, rent: '+4.1%', units: '8K', score: 85 },
                  { name: 'Alpharetta', jedi: 79, rent: '+3.8%', units: '6.5K', score: 82 },
                  { name: 'Sandy Springs', jedi: 76, rent: '+3.1%', units: '5.2K', score: 78 },
                  { name: 'Decatur', jedi: 74, rent: '+2.9%', units: '4.8K', score: 71 },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-[#1e293b] transition-colors cursor-pointer group">
                    <td className="p-3 font-bold text-[#e2e8f0]">{row.name}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={row.jedi >= 80 ? 'text-[#14b8a6]' : 'text-[#e2e8f0]'}>{row.jedi}</span>
                        <div className="w-12 h-1 bg-[#0a0e17]">
                          <div className="h-full bg-[#14b8a6]" style={{ width: `${row.jedi}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-green-400">{row.rent}</td>
                    <td className="p-3 text-[#94a3b8]">{row.units}</td>
                    <td className="p-3 border-l border-[#1e293b] font-bold text-[#f59e0b]">S:{row.score}</td>
                    <td className="p-3 text-right text-[#94a3b8] group-hover:text-[#14b8a6]">View →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Right Side — Commentary Panel */}
      <div 
        className={`bg-[#111827] border-l-2 border-[#14b8a6] transition-all duration-300 flex flex-col
          ${panelOpen ? 'w-[30%] opacity-100' : 'w-0 opacity-0'} 
          overflow-y-auto`}
      >
        <div className="p-4 border-b border-[#1e293b] flex justify-between items-center sticky top-0 bg-[#111827] z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#14b8a6]"></div>
            <h2 className="font-bold text-white tracking-widest uppercase">AI Insights</h2>
          </div>
          <button 
            onClick={() => setPanelOpen(false)}
            className="text-[#94a3b8] hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          
          {/* Market Narrative */}
          <div className="border-t border-[#14b8a6] pt-3">
            <h3 className="text-xs font-bold text-[#94a3b8] uppercase mb-3">Market Narrative</h3>
            <p className="text-sm leading-relaxed text-[#e2e8f0] mb-3">
              Atlanta's multifamily market continues to demonstrate resilient fundamentals despite an elevated supply pipeline. Demand drivers remain strong with 1.8% population growth and a favorable 1.24 jobs ratio, supporting above-trend absorption across the metro.
            </p>
            <p className="text-sm leading-relaxed text-[#e2e8f0]">
              The core-plus value-add strategy screens exceptionally well here (S:78), leveraging structural rent growth in secondary nodes while avoiding the heavy supply concentration in prime urban core submarkets.
            </p>
          </div>

          {/* Investment Thesis */}
          <div className="bg-[#0a0e17] p-4 border border-[#1e293b]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-[#94a3b8] uppercase">Investment Thesis</h3>
              <span className="text-[10px] font-bold px-2 py-1 bg-[#14b8a6] text-black">SELECTIVE BUY</span>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2 items-start">
                <span className="text-green-500 mt-0.5">✓</span>
                <span className="text-[#e2e8f0]">Population growth consistently exceeds national avg</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-green-500 mt-0.5">✓</span>
                <span className="text-[#e2e8f0]">Employment diversification reducing concentration risk</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-[#f59e0b] mt-0.5">⚠</span>
                <span className="text-[#e2e8f0]">Near-term supply deliveries may pressure occupancy</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-[#ef4444] mt-0.5">✗</span>
                <span className="text-[#e2e8f0]">Rising insurance costs in flood-prone submarkets</span>
              </li>
            </ul>
          </div>

          {/* Risk Watch */}
          <div className="border-l-2 border-[#ef4444] pl-3 py-1">
            <h3 className="text-xs font-bold text-[#ef4444] uppercase mb-2">Risk Watch</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-white">Construction Pipeline</span>
                  <span className="text-[9px] px-1 border border-[#ef4444] text-[#ef4444]">HIGH</span>
                </div>
                <p className="text-xs text-[#94a3b8]">18,400 units delivering Q3-Q4 2026. Primarily impacting Class A lease-ups in urban core.</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-white">Insurance Cost Escalation</span>
                  <span className="text-[9px] px-1 border border-[#f59e0b] text-[#f59e0b]">MEDIUM</span>
                </div>
                <p className="text-xs text-[#94a3b8]">+22% YoY in Cobb County. Requires underwriting adjustment for 2024-2025.</p>
              </div>
            </div>
          </div>

          {/* Opportunity Signals */}
          <div className="border-l-2 border-[#14b8a6] pl-3 py-1 mt-2">
            <h3 className="text-xs font-bold text-[#14b8a6] uppercase mb-2">Opportunity Signals</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-[#e2e8f0]">
              <li className="pl-1">
                <span className="font-bold">Midtown Class B repositioning</span> — 340bps spread to Class A rents.
              </li>
              <li className="pl-1">
                <span className="font-bold">Alpharetta tech corridor</span> — 12% employment growth outpacing supply.
              </li>
              <li className="pl-1">
                <span className="font-bold">South Fulton emerging submarket</span> — trading below replacement cost basis.
              </li>
            </ol>
          </div>

        </div>
      </div>
      
      {/* Toggle Button (when panel is closed) */}
      {!panelOpen && (
        <button 
          onClick={() => setPanelOpen(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#111827] border border-[#14b8a6] border-r-0 p-2 text-[#14b8a6] hover:bg-[#1e293b]"
          title="Open AI Commentary"
        >
          ←
        </button>
      )}
    </div>
  );
}
