import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Settings, Info } from 'lucide-react';

const ResponseChart = ({ title, stat1, stat2, lines, yLabel }) => (
  <div className="bg-[#131929] border border-[#1E2538] rounded p-4 flex flex-col">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h3 className="text-sm font-medium text-[#E2E8F0]">{title}</h3>
        <div className="text-xs font-mono text-[#A0ABBE] mt-1">{stat1}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono text-[#0891B2]">{stat2}</div>
      </div>
    </div>
    
    <div className="flex-1 relative mt-2 min-h-[140px]">
      <svg width="100%" height="100%" viewBox="0 0 400 140" preserveAspectRatio="none">
        {/* Grid lines */}
        <line x1="0" y1="20" x2="400" y2="20" stroke="#1E2538" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1="70" x2="400" y2="70" stroke="#1E2538" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1="120" x2="400" y2="120" stroke="#1E2538" strokeWidth="1" strokeDasharray="4 4" />
        
        {/* T=0 Vertical Line */}
        <line x1="120" y1="0" x2="120" y2="140" stroke="#6B7A8D" strokeWidth="1" />
        <text x="120" y="10" fill="#6B7A8D" fontSize="10" fontFamily="monospace" textAnchor="middle">T+0</text>

        {/* X Axis Labels */}
        <text x="0" y="135" fill="#6B7A8D" fontSize="10" fontFamily="monospace">T-12</text>
        <text x="200" y="135" fill="#6B7A8D" fontSize="10" fontFamily="monospace" textAnchor="middle">T+12</text>
        <text x="290" y="135" fill="#6B7A8D" fontSize="10" fontFamily="monospace" textAnchor="middle">T+24</text>
        <text x="400" y="135" fill="#6B7A8D" fontSize="10" fontFamily="monospace" textAnchor="end">T+36</text>

        {/* Confidence Band (Shaded area) */}
        <path d={lines.band} fill="rgba(8, 145, 178, 0.1)" />
        
        {/* p25 and p75 lines */}
        <path d={lines.p75} fill="none" stroke="#A0ABBE" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        <path d={lines.p25} fill="none" stroke="#A0ABBE" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        
        {/* Median Line */}
        <path d={lines.median} fill="none" stroke="#0891B2" strokeWidth="2" />
      </svg>
      <div className="absolute top-0 -left-2 text-[9px] text-[#6B7A8D] rotate-[-90deg] origin-top-left">{yLabel}</div>
    </div>
  </div>
);

export default function PlaybookLibrary() {
  const [adminMode, setAdminMode] = useState(true);
  
  // SVG path data for mock charts
  const rentGrowthLines = {
    median: "M0,90 C60,90 100,85 120,80 C160,60 200,40 290,30 C340,25 400,25 400,25",
    p75: "M0,80 C60,80 100,70 120,60 C160,30 200,10 290,10 C340,10 400,10 400,10",
    p25: "M0,100 C60,100 100,100 120,100 C160,90 200,70 290,50 C340,40 400,40 400,40",
    band: "M0,80 C60,80 100,70 120,60 C160,30 200,10 290,10 C340,10 400,10 400,10 L400,40 C340,40 290,50 200,70 C160,90 120,100 100,100 C60,100 0,100 0,100 Z"
  };

  const absorptionLines = {
    median: "M0,70 C80,70 110,60 120,40 C140,20 180,30 290,35 C350,35 400,35 400,35",
    p75: "M0,60 C80,60 110,40 120,20 C140,0 180,10 290,15 C350,15 400,15 400,15",
    p25: "M0,80 C80,80 110,80 120,60 C140,40 180,50 290,55 C350,55 400,55 400,55",
    band: "M0,60 C80,60 110,40 120,20 C140,0 180,10 290,15 C350,15 400,15 400,15 L400,55 C350,55 290,55 180,50 C140,40 120,60 110,80 C80,80 0,80 0,80 Z"
  };

  const capRateLines = {
    median: "M0,50 C80,50 110,55 120,60 C160,80 200,90 290,90 C350,90 400,85 400,85",
    p75: "M0,40 C80,40 110,45 120,50 C160,70 200,80 290,80 C350,80 400,75 400,75",
    p25: "M0,60 C80,60 110,65 120,70 C160,90 200,100 290,100 C350,100 400,95 400,95",
    band: "M0,40 C80,40 110,45 120,50 C160,70 200,80 290,80 C350,80 400,75 400,75 L400,95 C350,100 290,100 200,100 C160,90 120,70 110,65 C80,60 0,60 0,60 Z"
  };

  const searchMomentumLines = {
    median: "M0,100 C100,100 115,20 120,10 C125,20 150,90 200,95 C290,100 400,100 400,100",
    p75: "M0,90 C100,90 110,10 120,0 C130,10 150,80 200,85 C290,90 400,90 400,90",
    p25: "M0,110 C100,110 115,30 120,20 C125,30 150,100 200,105 C290,110 400,110 400,110",
    band: "M0,90 C100,90 110,10 120,0 C130,10 150,80 200,85 C290,90 400,90 400,90 L400,110 C290,110 200,105 150,100 C125,30 115,30 100,110 C0,110 0,110 0,110 Z"
  };

  return (
    <div className="min-h-screen bg-[#0B0E1A] text-[#E2E8F0] font-sans overflow-hidden flex flex-col max-w-[1400px] mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-end border-b border-[#1E2538] p-6 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#E2E8F0]">EVENT PLAYBOOK LIBRARY</h1>
          <div className="flex gap-4 text-sm text-[#A0ABBE] mt-1">
            <span>42 subtypes</span>
            <span className="text-[#1E2538]">|</span>
            <span>Last updated: Apr 2026</span>
            <span className="text-[#1E2538]">|</span>
            <span>Powered by 847 historical events</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-[#A0ABBE]">Admin Access</span>
          <button 
            onClick={() => setAdminMode(!adminMode)}
            className={`w-10 h-5 rounded-full relative transition-colors ${adminMode ? 'bg-[#0891B2]' : 'bg-[#1E2538]'}`}
          >
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${adminMode ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel: Subtype Index */}
        <div className="w-[350px] flex-shrink-0 border-r border-[#1E2538] bg-[#0B0E1A] flex flex-col">
          <div className="p-4 border-b border-[#1E2538]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A8D]" size={16} />
              <input 
                type="text" 
                placeholder="Search subtypes..." 
                className="w-full bg-[#131929] border border-[#1E2538] rounded py-2 pl-9 pr-3 text-sm text-[#E2E8F0] focus:outline-none focus:border-[#0891B2] placeholder-[#6B7A8D]"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Expanded Accordion */}
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[#E2E8F0] mb-2 cursor-pointer">
                <ChevronDown size={16} className="text-[#6B7A8D]" />
                📣 EMPLOYMENT <span className="text-xs font-mono font-normal text-[#6B7A8D] ml-1">(8 subtypes)</span>
              </div>
              <div className="space-y-1 ml-6 border-l border-[#1E2538]">
                <div className="flex items-center justify-between text-sm py-1.5 px-3 bg-[#131929] border-l-2 border-[#0891B2] -ml-[1px]">
                  <span className="text-[#E2E8F0]">Major HQ Relocation (2000+ jobs)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5 px-3 text-[#A0ABBE] hover:text-[#E2E8F0] cursor-pointer">
                  <span>Mid-Market Employer (500-2k)</span>
                </div>
                <div className="flex items-center justify-between text-sm py-1.5 px-3 text-[#A0ABBE] hover:text-[#E2E8F0] cursor-pointer">
                  <span>Large Plant / Distribution</span>
                </div>
              </div>
            </div>

            {/* Collapsed Accordions */}
            {[
              { icon: "►", label: "INFRASTRUCTURE", count: 6 },
              { icon: "►", label: "REGULATORY / POLICY", count: 7 },
              { icon: "►", label: "MARKET STRUCTURE", count: 5 },
              { icon: "►", label: "MACRO / DEMOGRAPHIC", count: 4 },
              { icon: "►", label: "DISASTER / DISRUPTION", count: 3 },
              { icon: "►", label: "TECHNOLOGY / INDUSTRY", count: 9 }
            ].map((cat, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-bold text-[#A0ABBE] hover:text-[#E2E8F0] cursor-pointer">
                <ChevronRight size={16} className="text-[#6B7A8D]" />
                {cat.label} <span className="text-xs font-mono font-normal text-[#6B7A8D] ml-1">({cat.count} subtypes)</span>
              </div>
            ))}
          </div>
          
          <div className="p-4 border-t border-[#1E2538] bg-[#131929] m-4 rounded">
            <div className="flex items-center gap-2 text-sm text-[#D97706] font-medium">
              <span className="bg-[#D97706] bg-opacity-20 px-1.5 rounded text-xs">⚠</span>
              2 regime-shift alerts
            </div>
            <p className="text-xs text-[#A0ABBE] mt-1">Review needed for 'Remote Work Impact' curves</p>
          </div>
        </div>

        {/* Right Panel: Detail View */}
        <div className="flex-1 flex flex-col bg-[#0B0E1A] overflow-y-auto">
          
          <div className="p-6 pb-0">
            <h2 className="text-2xl font-bold text-[#E2E8F0] mb-6">Major HQ Relocation (2000+ jobs)</h2>
            
            {/* Tabs */}
            <div className="flex gap-6 border-b border-[#1E2538]">
              <button className="text-sm font-bold tracking-wider text-[#0891B2] border-b-2 border-[#0891B2] pb-3 flex items-center gap-2">
                RESPONSE CURVES <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>
              </button>
              <button className="text-sm font-bold tracking-wider text-[#6B7A8D] hover:text-[#A0ABBE] pb-3">BACKTEST</button>
              <button className="text-sm font-bold tracking-wider text-[#6B7A8D] hover:text-[#A0ABBE] pb-3">WATCHLIST</button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Controls & Summary */}
            <div className="flex justify-between items-end">
              <div className="flex gap-6">
                <div>
                  <div className="text-xs text-[#6B7A8D] mb-1.5 uppercase font-semibold">Stratification</div>
                  <div className="flex bg-[#131929] rounded p-1 border border-[#1E2538]">
                    <button className="px-3 py-1 text-xs font-medium bg-[#1E2538] text-[#E2E8F0] rounded shadow-sm flex items-center gap-1.5">
                      Large MSA (&gt;2M) <div className="w-1.5 h-1.5 rounded-full bg-[#0891B2]"></div>
                    </button>
                    <button className="px-3 py-1 text-xs font-medium text-[#A0ABBE] hover:text-[#E2E8F0]">Mid MSA (500K-2M)</button>
                    <button className="px-3 py-1 text-xs font-medium text-[#A0ABBE] hover:text-[#E2E8F0]">Small MSA (&lt;500K)</button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#6B7A8D] mb-1.5 uppercase font-semibold">Regime</div>
                  <div className="flex bg-[#131929] rounded p-1 border border-[#1E2538]">
                    <button className="px-3 py-1 text-xs font-medium bg-[#1E2538] text-[#E2E8F0] rounded shadow-sm flex items-center gap-1.5">
                      Post-2020 <div className="w-1.5 h-1.5 rounded-full bg-[#0891B2]"></div>
                    </button>
                    <button className="px-3 py-1 text-xs font-medium text-[#A0ABBE] hover:text-[#E2E8F0]">Pre-2020</button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 items-center bg-[#131929] border border-[#1E2538] rounded px-4 py-2">
                <div className="text-center px-2">
                  <div className="text-xl font-mono text-[#E2E8F0]">23</div>
                  <div className="text-[10px] text-[#6B7A8D] uppercase">Events</div>
                </div>
                <div className="w-px h-8 bg-[#1E2538]"></div>
                <div className="text-center px-2">
                  <div className="text-xl font-mono text-[#10B981]">91%</div>
                  <div className="text-[10px] text-[#6B7A8D] uppercase">Conf</div>
                </div>
                <div className="w-px h-8 bg-[#1E2538]"></div>
                <div className="text-center px-2">
                  <div className="text-xl font-mono text-[#E2E8F0]">12</div>
                  <div className="text-[10px] text-[#6B7A8D] uppercase">In Stratum</div>
                </div>
                <div className="w-px h-8 bg-[#1E2538]"></div>
                <div className="text-center px-2">
                  <div className="text-xl font-mono text-[#0891B2]">79%</div>
                  <div className="text-[10px] text-[#6B7A8D] uppercase">Hit Rate</div>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-2 gap-4">
              <ResponseChart 
                title="Rent Growth" 
                stat1="median +2.3pp at T+12" 
                stat2="+3.1pp at T+24"
                lines={rentGrowthLines}
                yLabel="percentage points"
              />
              <ResponseChart 
                title="Absorption Rate" 
                stat1="median +22% at T+6" 
                stat2="holding at T+24"
                lines={absorptionLines}
                yLabel="% change"
              />
              <ResponseChart 
                title="Cap Rate" 
                stat1="median -0.4pp at T+12" 
                stat2="compression"
                lines={capRateLines}
                yLabel="percentage points"
              />
              <ResponseChart 
                title="Search Momentum" 
                stat1="big spike at T+0" 
                stat2="normalizes by T+6"
                lines={searchMomentumLines}
                yLabel="index (100=base)"
              />
            </div>

            {/* Admin Section */}
            {adminMode && (
              <div className="mt-8 border-t border-[#1E2538] pt-6">
                <h3 className="text-sm font-bold text-[#A0ABBE] tracking-wider mb-4 flex items-center gap-2">
                  <Settings size={16} /> METRIC WATCHLIST CONFIG
                </h3>
                <div className="bg-[#131929] border border-[#1E2538] rounded overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#0B0E1A] border-b border-[#1E2538]">
                      <tr>
                        <th className="px-4 py-2 font-medium text-[#6B7A8D]">METRIC NAME</th>
                        <th className="px-4 py-2 font-medium text-[#6B7A8D]">CURRENT WEIGHT</th>
                        <th className="px-4 py-2 font-medium text-[#6B7A8D]">DEFAULT WINDOW</th>
                        <th className="px-4 py-2 font-medium text-[#6B7A8D] text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E2538]">
                      {['Rent Growth', 'Absorption Rate', 'Cap Rate', 'Search Momentum'].map((m, i) => (
                        <tr key={i} className="hover:bg-[#1E2538] transition-colors">
                          <td className="px-4 py-3 text-[#E2E8F0]">{m}</td>
                          <td className="px-4 py-3">
                            <input type="text" defaultValue={i === 0 ? "1.5" : "1.0"} className="bg-[#0B0E1A] border border-[#1E2538] rounded px-2 py-1 w-16 font-mono text-center focus:border-[#0891B2] outline-none" />
                          </td>
                          <td className="px-4 py-3">
                            <select className="bg-[#0B0E1A] border border-[#1E2538] rounded px-2 py-1 focus:border-[#0891B2] outline-none text-[#A0ABBE]">
                              <option>T-12 to T+36</option>
                              <option>T-6 to T+24</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button className="text-[#EF4444] hover:text-red-400 text-xs">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-[#1E2538] bg-[#0B0E1A]">
                    <button className="text-sm text-[#0891B2] hover:text-cyan-300 font-medium flex items-center gap-1">
                      + Add Metric
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
