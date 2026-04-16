import React from 'react';
import { ChevronDown, Check } from 'lucide-react';

export function EventDetailPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans w-full max-w-[1400px] mx-auto p-6 overflow-y-auto">
      {/* Breadcrumb */}
      <div className="text-muted text-sm mb-4 font-mono tracking-wide uppercase">
        Events / Amazon HQ2 — Tampa
      </div>

      {/* Page Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-3 uppercase tracking-tight">AMAZON HQ2 — TAMPA MSA</h1>
        
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="bg-[#131929] border border-[#1E2538] text-foreground text-xs font-semibold px-2 py-1 uppercase rounded-sm flex items-center gap-1">
            📣 EMPLOYMENT
          </span>
          <span className="bg-[#131929] border border-[#1E2538] text-muted text-xs font-semibold px-2 py-1 uppercase rounded-sm">
            MSA SCOPE
          </span>
          <span className="bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] text-xs font-semibold px-2 py-1 uppercase rounded-sm">
            FIRED
          </span>
          <span className="bg-[#0891B2]/20 border border-[#0891B2]/50 text-[#0891B2] text-xs font-semibold px-2 py-1 uppercase rounded-sm">
            T+8 MONTHS
          </span>
        </div>

        <div className="text-muted text-sm font-mono bg-[#131929] p-3 border border-[#1E2538] rounded flex items-center divide-x divide-[#1E2538]">
          <span className="px-3 first:pl-0">Announced: <span className="text-foreground">Mar 2024</span></span>
          <span className="px-3">Magnitude: <span className="text-foreground">25,000 Jobs</span></span>
          <span className="px-3">Confidence: <span className="text-foreground">87%</span></span>
          <span className="px-3 last:pr-0">MSA: <span className="text-foreground">Tampa-St. Pete</span></span>
        </div>
      </header>

      {/* Event Sensitivity Banner */}
      <div className="bg-[#131929] border border-[#1E2538] rounded-md mb-8 flex divide-x divide-[#1E2538]">
        <div className="flex-1 p-4">
          <div className="text-muted text-xs font-semibold uppercase mb-1">Event Sensitivity</div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#EF4444] text-white text-xs font-bold px-1.5 py-0.5 rounded-sm">HIGH</span>
          </div>
          <div className="text-sm text-foreground">42% of projected IRR uplift from this event</div>
        </div>
        <div className="flex-1 p-4">
          <div className="text-muted text-xs font-semibold uppercase mb-1">Proximity Score</div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-foreground font-mono text-lg font-medium">0.74</span>
          </div>
          <div className="text-sm text-foreground">Property at 2.1mi from epicenter</div>
        </div>
        <div className="flex-1 p-4">
          <div className="text-muted text-xs font-semibold uppercase mb-1">Forecast Status</div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#10B981] font-mono text-lg font-medium tracking-tight">AHEAD</span>
          </div>
          <div className="text-sm text-foreground">+0.8pp above playbook median at T+8</div>
        </div>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-[#1E2538] mb-6">
        {['FORECAST', 'MULTI-METRIC', 'PLAYBOOK', 'GEOGRAPHY', 'TIMELINE'].map((tab, idx) => (
          <button 
            key={tab}
            className={`px-6 py-3 text-sm font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              idx === 0 
                ? 'border-[#0891B2] text-[#0891B2]' 
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab} {idx === 0 && '●'}
          </button>
        ))}
      </div>

      {/* FORECAST Tab Content */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Rent Growth (YoY) — Primary Metric <span className="text-muted font-normal">| Tampa Westshore Submarket</span></h2>
        
        <div className="flex items-center gap-2 mb-6">
          <button className="bg-[#0891B2]/20 border border-[#0891B2]/50 text-[#0891B2] text-sm font-medium px-3 py-1.5 rounded flex items-center gap-1">
            Rent Growth <ChevronDown className="w-4 h-4" />
          </button>
          {['Absorption', 'Cap Rate', 'Permits', 'Search Momentum'].map(metric => (
            <button key={metric} className="bg-[#131929] border border-[#1E2538] text-secondary hover:text-foreground text-sm font-medium px-3 py-1.5 rounded transition-colors">
              {metric}
            </button>
          ))}
        </div>

        {/* Main forecast chart */}
        <div className="bg-[#131929] border border-[#1E2538] rounded-md p-4 mb-6 relative h-[320px] flex flex-col">
          <div className="absolute top-4 right-4 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-bold px-2 py-1 uppercase rounded">
            AHEAD
          </div>
          
          <div className="flex-1 relative mt-8 mb-6 ml-10">
            {/* Y-axis labels */}
            <div className="absolute -left-10 top-0 bottom-0 flex flex-col justify-between text-xs text-muted font-mono h-full py-0">
              <span>+4.0%</span>
              <span>+2.0%</span>
              <span>0.0%</span>
            </div>
            
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="w-full border-t border-[#1E2538]"></div>
              <div className="w-full border-t border-[#1E2538]"></div>
              <div className="w-full border-t border-[#1E2538]"></div>
            </div>

            {/* SVG Chart */}
            <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Shaded area */}
              <path d="M0,80 L20,70 L40,55 L60,35 L80,20 L100,10 L100,90 L80,85 L60,80 L40,75 L20,75 L0,80 Z" fill="#0891B2" fillOpacity="0.08" />
              
              {/* High bound */}
              <path d="M0,80 L20,70 L40,55 L60,35 L80,20 L100,10" fill="none" stroke="#0891B2" strokeWidth="1" strokeDasharray="2,2" />
              
              {/* Median */}
              <path d="M0,80 L20,75 L40,65 L60,50 L80,40 L100,30" fill="none" stroke="#A0ABBE" strokeWidth="1" strokeDasharray="2,2" />
              
              {/* Low bound */}
              <path d="M0,80 L20,75 L40,75 L60,80 L80,85 L100,90" fill="none" stroke="#0891B2" strokeWidth="1" strokeDasharray="2,2" />

              {/* Actual data line */}
              <path d="M0,80 L5,77 L10,72 L15,68 L20,62 L22,60" fill="none" stroke="#10B981" strokeWidth="2" />
              
              {/* Current position marker */}
              <circle cx="22" cy="60" r="3" fill="#10B981" />
              <line x1="22" y1="60" x2="22" y2="100" stroke="#10B981" strokeWidth="1" strokeDasharray="2,2" />
            </svg>

            {/* Tooltip */}
            <div className="absolute top-[35%] left-[23%] bg-[#0B0E1A] border border-[#1E2538] shadow-lg rounded p-2 text-xs z-10 w-48">
              <div className="font-mono flex justify-between mb-1"><span className="text-muted">Actual:</span> <span className="text-[#10B981]">+2.1%</span></div>
              <div className="font-mono flex justify-between mb-1"><span className="text-muted">Forecast:</span> <span className="text-foreground">+1.3%</span></div>
              <div className="font-mono flex justify-between border-t border-[#1E2538] pt-1 mt-1"><span className="text-muted">Delta:</span> <span className="text-[#10B981]">+0.8pp</span></div>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between text-xs text-muted font-mono ml-10 relative">
            <span>T+0</span>
            <span className="absolute left-[16.6%]">T+6</span>
            <span className="absolute left-[33.3%]">T+12</span>
            <span className="absolute left-[50%]">T+18</span>
            <span className="absolute left-[66.6%]">T+24</span>
            <span className="absolute right-0">T+36</span>
          </div>
        </div>

        {/* Window summary table */}
        <div className="bg-[#131929] border border-[#1E2538] rounded-md overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-muted bg-[#0B0E1A] border-b border-[#1E2538]">
              <tr>
                <th className="px-4 py-3 font-semibold">Window</th>
                <th className="px-4 py-3 font-semibold">Forecast</th>
                <th className="px-4 py-3 font-semibold">Actual</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2538] font-mono">
              <tr className="hover:bg-[#1E2538]/50 transition-colors">
                <td className="px-4 py-3 font-sans"><span className="text-muted mr-2">T+0 to T+3:</span> Immediate</td>
                <td className="px-4 py-3 text-secondary">+0.4%</td>
                <td className="px-4 py-3 text-foreground">+0.6%</td>
                <td className="px-4 py-3 text-[#10B981] flex items-center gap-1 font-sans font-semibold text-xs"><Check className="w-3 h-3"/> AHEAD</td>
              </tr>
              <tr className="hover:bg-[#1E2538]/50 transition-colors bg-[#1E2538]/20">
                <td className="px-4 py-3 font-sans"><span className="text-muted mr-2">T+3 to T+12:</span> Short-term</td>
                <td className="px-4 py-3 text-secondary">+1.3%</td>
                <td className="px-4 py-3 text-[#10B981] font-semibold">+2.1% <span className="text-muted font-normal text-xs ml-1">(current)</span></td>
                <td className="px-4 py-3 text-[#10B981] flex items-center gap-1 font-sans font-semibold text-xs"><Check className="w-3 h-3"/> AHEAD</td>
              </tr>
              <tr className="hover:bg-[#1E2538]/50 transition-colors">
                <td className="px-4 py-3 font-sans"><span className="text-muted mr-2">T+12 to T+24:</span> Medium-term</td>
                <td className="px-4 py-3 text-secondary">+2.8%</td>
                <td className="px-4 py-3 text-muted">—</td>
                <td className="px-4 py-3 text-muted font-sans font-medium text-xs">PENDING</td>
              </tr>
              <tr className="hover:bg-[#1E2538]/50 transition-colors">
                <td className="px-4 py-3 font-sans"><span className="text-muted mr-2">T+24 to T+60:</span> Long-term</td>
                <td className="px-4 py-3 text-secondary">+3.9%</td>
                <td className="px-4 py-3 text-muted">—</td>
                <td className="px-4 py-3 text-muted font-sans font-medium text-xs">PENDING</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Related Events */}
      <div>
        <h3 className="text-sm font-semibold text-secondary mb-3">Other events affecting Tampa Westshore:</h3>
        <div className="space-y-2">
          <div className="bg-[#131929] border border-[#1E2538] rounded p-3 flex items-center justify-between hover:bg-[#1E2538]/50 transition-colors cursor-pointer text-sm">
            <div className="flex items-center gap-3">
              <span className="text-lg">🚆</span>
              <span className="font-semibold text-foreground">BRT Phase 2</span>
              <span className="text-xs text-muted border border-[#1E2538] px-1.5 py-0.5 rounded">Submarket</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="text-secondary">T-4mo pending</span>
              <span className="text-[#10B981]">+0.5pp projected</span>
            </div>
          </div>
          
          <div className="bg-[#131929] border border-[#1E2538] rounded p-3 flex items-center justify-between hover:bg-[#1E2538]/50 transition-colors cursor-pointer text-sm">
            <div className="flex items-center gap-3">
              <span className="text-lg">📜</span>
              <span className="font-semibold text-foreground">FL Insurance Rate Cap</span>
              <span className="text-xs text-muted border border-[#1E2538] px-1.5 py-0.5 rounded">State</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="text-secondary">T+2mo</span>
              <span className="text-[#10B981]">-4% expense</span>
            </div>
          </div>
          
          <div className="bg-[#131929] border border-[#1E2538] rounded p-3 flex items-center justify-between hover:bg-[#1E2538]/50 transition-colors cursor-pointer text-sm">
            <div className="flex items-center gap-3">
              <span className="text-lg">🏢</span>
              <span className="font-semibold text-foreground">New Supply Wave</span>
              <span className="text-xs text-muted border border-[#1E2538] px-1.5 py-0.5 rounded">Submarket</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="text-secondary">T-6mo fired</span>
              <span className="text-[#EF4444]">-0.3pp</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
