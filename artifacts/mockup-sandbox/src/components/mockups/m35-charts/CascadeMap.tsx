import React, { useState } from 'react';
import { 
  Info, 
  MapPin, 
  X, 
  TrendingUp, 
  Navigation,
  ArrowRight,
  Filter
} from 'lucide-react';

export default function CascadeMap() {
  const [activeSubmarket, setActiveSubmarket] = useState<string | null>(null);

  const submarkets = [
    { id: 'westshore', name: 'Westshore', score: '98/100', rent: '+8.4%', abs: '+120 bps', impact: 'High' },
    { id: 'downtown', name: 'Downtown', score: '76/100', rent: '+5.2%', abs: '+80 bps', impact: 'Medium' },
    { id: 'ybor', name: 'Ybor City', score: '45/100', rent: '+2.1%', abs: '+30 bps', impact: 'Med-Low' },
    { id: 'brandon', name: 'Brandon', score: '12/100', rent: '+0.5%', abs: '+5 bps', impact: 'Low' }
  ];

  return (
    <div className="w-full h-screen bg-[#0B0E1A] text-[#E2E8F0] font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none p-4 border-b border-[#1E2538] bg-[#0B0E1A]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-[#E2E8F0]">Amazon HQ2 — Tampa MSA | Geographic Impact Cascade</h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-[#0891B2]/20 text-[#0891B2] border border-[#0891B2]/30 rounded uppercase tracking-wider">MSA SCOPE</span>
          </div>
        </div>
        <p className="text-sm text-[#A0ABBE] flex items-center gap-2">
          <Info className="w-4 h-4 text-[#6B7A8D]" />
          Impact attenuates with distance from event epicenter | Half-life: 3.0mi
        </p>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        
        {/* Map Area */}
        <div className="flex-1 relative bg-[#0B0E1A]">
          <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />
              </pattern>
              
              <radialGradient id="impact-glow" cx="30%" cy="40%" r="60%" fx="30%" fy="40%">
                <stop offset="0%" stopColor="#D97706" stopOpacity="0.35" />
                <stop offset="25%" stopColor="#D97706" stopOpacity="0.15" />
                <stop offset="50%" stopColor="#0891B2" stopOpacity="0.10" />
                <stop offset="80%" stopColor="#0891B2" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#0B0E1A" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Background Grid */}
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Abstract City Blocks */}
            <g fill="#131929" stroke="#1E2538" strokeWidth="1">
              <rect x="50" y="100" width="80" height="60" rx="2" />
              <rect x="150" y="80" width="120" height="40" rx="2" />
              <rect x="80" y="180" width="100" height="90" rx="2" />
              <rect x="200" y="150" width="60" height="120" rx="2" />
              <rect x="280" y="90" width="90" height="70" rx="2" />
              <rect x="350" y="200" width="140" height="80" rx="2" />
              <rect x="250" y="300" width="110" height="60" rx="2" />
              <rect x="100" y="320" width="120" height="100" rx="2" />
              <rect x="420" y="100" width="80" height="70" rx="2" />
              <rect x="520" y="130" width="100" height="110" rx="2" />
              <rect x="650" y="180" width="90" height="60" rx="2" />
              <rect x="550" y="280" width="130" height="90" rx="2" />
              <rect x="380" y="320" width="150" height="70" rx="2" />
              <rect x="450" y="420" width="120" height="100" rx="2" />
              <rect x="280" y="400" width="140" height="80" rx="2" />
              <rect x="620" y="410" width="90" height="110" rx="2" />
              <rect x="120" y="450" width="100" height="70" rx="2" />
            </g>

            {/* Impact Gradient */}
            <circle cx="240" cy="240" r="450" fill="url(#impact-glow)" style={{ pointerEvents: 'none' }} />

            {/* Distance Rings */}
            <g fill="none" stroke="#6B7A8D" strokeWidth="1" strokeDasharray="4 8" opacity="0.3">
              <circle cx="240" cy="240" r="100" />
              <circle cx="240" cy="240" r="250" />
              <circle cx="240" cy="240" r="400" />
            </g>

            {/* Submarket Boundaries */}
            <g className="cursor-pointer">
              {/* Westshore */}
              <polygon 
                points="180,120 320,130 350,280 200,320 150,220" 
                fill={activeSubmarket === 'westshore' || !activeSubmarket ? '#0891B2' : 'transparent'} 
                fillOpacity={activeSubmarket === 'westshore' ? '0.2' : '0.05'} 
                stroke="#0891B2" 
                strokeWidth={activeSubmarket === 'westshore' ? '2' : '1'}
                strokeDasharray="4 2"
                onClick={() => setActiveSubmarket(activeSubmarket === 'westshore' ? null : 'westshore')}
              />
              <text x="250" y="190" fill="#0891B2" fontSize="12" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>WESTSHORE</text>

              {/* Downtown */}
              <polygon 
                points="340,150 480,140 520,260 400,310 320,250" 
                fill={activeSubmarket === 'downtown' || !activeSubmarket ? '#0891B2' : 'transparent'} 
                fillOpacity={activeSubmarket === 'downtown' ? '0.2' : '0.05'} 
                stroke="#0891B2" 
                strokeWidth={activeSubmarket === 'downtown' ? '2' : '1'}
                strokeDasharray="4 2"
                onClick={() => setActiveSubmarket(activeSubmarket === 'downtown' ? null : 'downtown')}
              />
              <text x="420" y="210" fill="#0891B2" fontSize="12" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>DOWNTOWN</text>

              {/* Ybor City */}
              <polygon 
                points="500,160 680,180 640,320 540,300 480,230" 
                fill={activeSubmarket === 'ybor' || !activeSubmarket ? '#0891B2' : 'transparent'} 
                fillOpacity={activeSubmarket === 'ybor' ? '0.2' : '0.05'} 
                stroke="#0891B2" 
                strokeWidth={activeSubmarket === 'ybor' ? '2' : '1'}
                strokeDasharray="4 2"
                onClick={() => setActiveSubmarket(activeSubmarket === 'ybor' ? null : 'ybor')}
              />
              <text x="580" y="230" fill="#0891B2" fontSize="12" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>YBOR CITY</text>

              {/* Brandon */}
              <polygon 
                points="550,330 750,310 780,480 600,520 510,400" 
                fill={activeSubmarket === 'brandon' || !activeSubmarket ? '#0891B2' : 'transparent'} 
                fillOpacity={activeSubmarket === 'brandon' ? '0.2' : '0.05'} 
                stroke="#0891B2" 
                strokeWidth={activeSubmarket === 'brandon' ? '2' : '1'}
                strokeDasharray="4 2"
                onClick={() => setActiveSubmarket(activeSubmarket === 'brandon' ? null : 'brandon')}
              />
              <text x="650" y="410" fill="#0891B2" fontSize="12" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>BRANDON</text>
            </g>

            {/* Epicenter */}
            <g transform="translate(240, 240)">
              <circle r="8" fill="#D97706" className="animate-pulse" />
              <circle r="4" fill="#0B0E1A" />
              <path d="M 0 -15 L 4 -4 L 15 -4 L 6 3 L 9 14 L 0 7 L -9 14 L -6 3 L -15 -4 L -4 -4 Z" fill="#D97706" transform="translate(0, -20)" />
              <rect x="15" y="-35" width="140" height="24" rx="4" fill="#131929" stroke="#D97706" strokeWidth="1" />
              <text x="25" y="-18" fill="#E2E8F0" fontSize="12" fontWeight="bold">📣 Amazon HQ2 Site</text>
            </g>

            {/* Deal Pins */}
            <g>
              {/* Deal #1274 */}
              <g transform="translate(270, 210)" className="cursor-pointer group">
                <circle r="14" fill="#D97706" fillOpacity="0.8" stroke="#0B0E1A" strokeWidth="2" />
                <rect x="18" y="-12" width="130" height="24" rx="4" fill="#131929" stroke="#1E2538" strokeWidth="1" opacity="0" className="group-hover:opacity-100 transition-opacity duration-200" />
                <text x="26" y="4" fill="#E2E8F0" fontSize="11" opacity="0" className="group-hover:opacity-100 transition-opacity duration-200">Deal #1274 <tspan fill="#10B981">IRR +2.1pp</tspan></text>
              </g>

              {/* Deal #1203 */}
              <g transform="translate(190, 260)" className="cursor-pointer group">
                <circle r="10" fill="#D97706" fillOpacity="0.8" stroke="#0B0E1A" strokeWidth="2" />
                <rect x="-140" y="-12" width="130" height="24" rx="4" fill="#131929" stroke="#1E2538" strokeWidth="1" opacity="0" className="group-hover:opacity-100 transition-opacity duration-200" />
                <text x="-132" y="4" fill="#E2E8F0" fontSize="11" opacity="0" className="group-hover:opacity-100 transition-opacity duration-200">Deal #1203 <tspan fill="#10B981">IRR +1.4pp</tspan></text>
              </g>

              {/* Deal #0987 */}
              <g transform="translate(300, 290)" className="cursor-pointer group">
                <circle r="10" fill="#D97706" fillOpacity="0.8" stroke="#0B0E1A" strokeWidth="2" />
                <rect x="14" y="-12" width="130" height="24" rx="4" fill="#131929" stroke="#1E2538" strokeWidth="1" opacity="0" className="group-hover:opacity-100 transition-opacity duration-200" />
                <text x="22" y="4" fill="#E2E8F0" fontSize="11" opacity="0" className="group-hover:opacity-100 transition-opacity duration-200">Deal #0987 <tspan fill="#10B981">IRR +1.1pp</tspan></text>
              </g>

              {/* Deal #1156 */}
              <g transform="translate(460, 200)" className="cursor-pointer group">
                <circle r="6" fill="#D97706" fillOpacity="0.8" stroke="#0B0E1A" strokeWidth="2" />
                <rect x="10" y="-12" width="130" height="24" rx="4" fill="#131929" stroke="#1E2538" strokeWidth="1" opacity="0" className="group-hover:opacity-100 transition-opacity duration-200" />
                <text x="18" y="4" fill="#E2E8F0" fontSize="11" opacity="0" className="group-hover:opacity-100 transition-opacity duration-200">Deal #1156 <tspan fill="#10B981">IRR +0.6pp</tspan></text>
              </g>
            </g>

          </svg>

          {/* Map Controls & Overlays */}
          <div className="absolute bottom-6 left-6 bg-[#131929]/80 backdrop-blur-sm border border-[#1E2538] rounded-md p-3">
            <div className="flex items-center gap-2 text-xs text-[#A0ABBE] mb-1">
              <MapPin className="w-3 h-3" /> Epicenter Distance
            </div>
            <div className="flex items-center justify-between text-xs text-[#E2E8F0] w-48 mb-1">
              <span>0</span>
              <span>3mi</span>
              <span>6mi</span>
            </div>
            <div className="relative h-1 bg-[#1E2538] rounded-full overflow-hidden w-48">
              <div className="absolute left-0 top-0 h-full w-[25%] bg-[#D97706]" />
              <div className="absolute left-[25%] top-0 h-full w-[37.5%] bg-gradient-to-r from-[#D97706] to-[#0891B2]" />
              <div className="absolute left-[62.5%] top-0 h-full w-[37.5%] bg-[#0891B2] opacity-50" />
            </div>
          </div>

          <div className="absolute top-6 right-6 bg-[#131929]/80 backdrop-blur-sm border border-[#1E2538] rounded-md p-2 flex flex-col items-center justify-center shadow-lg">
            <Navigation className="w-5 h-5 text-[#6B7A8D] mb-0.5" />
            <span className="text-[10px] font-bold text-[#E2E8F0]">N</span>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[380px] bg-[#131929] border-l border-[#1E2538] flex flex-col overflow-y-auto">
          
          {activeSubmarket ? (
            <div className="p-4 border-b border-[#1E2538] bg-[#0891B2]/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#0891B2]">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Showing: {submarkets.find(s => s.id === activeSubmarket)?.name}</span>
              </div>
              <button 
                onClick={() => setActiveSubmarket(null)}
                className="p-1 hover:bg-[#1E2538] rounded text-[#A0ABBE] hover:text-[#E2E8F0] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-4 border-b border-[#1E2538] flex items-center gap-2 text-sm text-[#A0ABBE]">
              <Filter className="w-4 h-4" />
              Click any submarket to filter
            </div>
          )}

          <div className="p-5 flex-1">
            <h2 className="text-sm font-bold text-[#E2E8F0] mb-4 uppercase tracking-wider">Submarket Impact Hierarchy</h2>
            
            <div className="space-y-2 mb-8">
              {submarkets.map((sm, i) => (
                <div 
                  key={sm.id}
                  onClick={() => setActiveSubmarket(activeSubmarket === sm.id ? null : sm.id)}
                  className={`
                    p-3 rounded-md border cursor-pointer transition-all duration-200
                    ${activeSubmarket === sm.id 
                      ? 'bg-[#0891B2]/10 border-[#0891B2] shadow-[0_0_15px_rgba(8,145,178,0.1)]' 
                      : activeSubmarket 
                        ? 'bg-[#0B0E1A] border-[#1E2538] opacity-40' 
                        : 'bg-[#0B0E1A] border-[#1E2538] hover:border-[#6B7A8D]'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[#E2E8F0]">{sm.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold
                      ${sm.impact === 'High' ? 'bg-[#D97706]/20 text-[#D97706]' : 
                        sm.impact === 'Medium' ? 'bg-[#0891B2]/20 text-[#0891B2]' :
                        'bg-[#1E2538] text-[#A0ABBE]'}
                    `}>{sm.impact}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div>
                      <div className="text-[10px] text-[#6B7A8D] uppercase mb-1">Proximity</div>
                      <div className="text-sm text-[#E2E8F0] font-mono">{sm.score}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#6B7A8D] uppercase mb-1">Rent Δ</div>
                      <div className="text-sm text-[#10B981] font-mono flex items-center">
                        <TrendingUp className="w-3 h-3 mr-1" /> {sm.rent}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#6B7A8D] uppercase mb-1">Absorp Δ</div>
                      <div className="text-sm text-[#10B981] font-mono">{sm.abs}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="text-sm font-bold text-[#E2E8F0] mb-4 uppercase tracking-wider">Heat Intensity Legend</h2>
            <div className="bg-[#0B0E1A] border border-[#1E2538] rounded-md p-4">
              <div className="h-3 w-full rounded-sm bg-gradient-to-r from-[#131929] via-[#0891B2] to-[#D97706] mb-2" />
              <div className="flex justify-between text-xs text-[#A0ABBE] font-mono">
                <span>Baseline</span>
                <span>Moderate</span>
                <span className="text-[#D97706]">Peak Impact</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#E2E8F0]">Core (0-1mi)</span>
                  <span className="text-[#D97706] font-mono text-xs">Major Shift</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#E2E8F0]">Primary (1-3mi)</span>
                  <span className="text-[#0891B2] font-mono text-xs">Material Shift</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#E2E8F0]">Secondary (3-6mi)</span>
                  <span className="text-[#6B7A8D] font-mono text-xs">Measurable</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#E2E8F0]">Fringe (6mi+)</span>
                  <span className="text-[#1E2538] font-mono text-xs">Negligible</span>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-[#D97706]/10 border border-[#D97706]/20 rounded-md">
              <h3 className="text-sm font-semibold text-[#D97706] mb-2">Deal Intelligence</h3>
              <p className="text-xs text-[#E2E8F0] leading-relaxed mb-3">
                The Amazon HQ2 announcement creates a 3.0mi half-life cascade effect. Deal #1274 is positioned inside the core impact zone, boosting its projected IRR by 2.1pp.
              </p>
              <button className="text-xs font-semibold text-[#D97706] flex items-center gap-1 hover:text-[#F59E0B] transition-colors">
                View Full Impact Analysis <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
