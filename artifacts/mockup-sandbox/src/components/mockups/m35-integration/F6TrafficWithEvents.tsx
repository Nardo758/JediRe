import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, ArrowUp, Download, Info, ExternalLink, Activity, Target } from 'lucide-react';

export function F6TrafficWithEvents() {
  const [showEvents, setShowEvents] = useState(true);
  const [showCounterfactual, setShowCounterfactual] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0E1A] text-[#E2E8F0] p-6 font-mono text-sm">
      {/* HEADER / TAB BAR */}
      <div className="mb-6">
        <div className="text-[#6B7A8D] text-xs mb-2 flex items-center gap-2">
          <span>DEAL CAPSULE</span>
          <ChevronRight className="w-3 h-3" />
          <span>3820 W Kennedy Blvd</span>
        </div>
        
        <div className="flex border-b border-[#1E2538] mt-4">
          {['OVERVIEW', 'PREDICTIONS', 'COEFFICIENTS', 'COMPS', 'CALIBRATION'].map((tab) => (
            <div 
              key={tab} 
              className={`px-4 py-2 cursor-pointer ${
                tab === 'PREDICTIONS' 
                  ? 'text-[#0891B2] border-b-2 border-[#0891B2] font-bold flex items-center gap-1' 
                  : 'text-[#A0ABBE] hover:text-[#E2E8F0]'
              }`}
            >
              {tab}
              {tab === 'PREDICTIONS' && <span className="w-1.5 h-1.5 rounded-full bg-[#0891B2] ml-1"></span>}
            </div>
          ))}
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="bg-[#131929] border-[#1E2538] p-4 flex flex-col justify-between">
          <div className="text-[#A0ABBE] text-xs mb-2">PROJECTED MONTHLY SEARCHES</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl text-[#E2E8F0]">1,847</div>
            <div className="text-[#10B981] text-xs flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              12% vs baseline
            </div>
          </div>
        </Card>
        <Card className="bg-[#131929] border-[#1E2538] p-4 flex flex-col justify-between">
          <div className="text-[#A0ABBE] text-xs mb-2">EVENT CONTRIBUTION</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl text-[#0891B2]">+284</div>
            <div className="text-[#A0ABBE] text-xs">searches/mo</div>
          </div>
          <div className="text-[#6B7A8D] text-xs mt-1">from 2 active events</div>
        </Card>
        <Card className="bg-[#131929] border-[#1E2538] p-4 flex flex-col justify-between">
          <div className="text-[#A0ABBE] text-xs mb-2">TRAFFIC INDEX</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl text-[#E2E8F0]">82.4</div>
            <div className="text-[#10B981] text-xs flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              4.2 this month
            </div>
          </div>
        </Card>
        <Card className="bg-[#131929] border-[#1E2538] p-4 flex flex-col justify-between">
          <div className="text-[#A0ABBE] text-xs mb-2">FORECAST HORIZON</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl text-[#E2E8F0]">T+24mo</div>
          </div>
          <div className="text-[#6B7A8D] text-xs mt-1">Last calibrated: 2d ago</div>
        </Card>
      </div>

      {/* MAIN CHART SECTION */}
      <Card className="bg-[#131929] border-[#1E2538] mb-6 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-[#1E2538]">
          <div className="font-bold text-[#E2E8F0] tracking-wider">MONTHLY SEARCH TRAFFIC — PREDICTIONS + EVENT OVERLAY</div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowEvents(!showEvents)}
              className={`border-[#1E2538] bg-transparent h-8 text-xs ${showEvents ? 'text-[#0891B2] border-[#0891B2]' : 'text-[#A0ABBE]'}`}
            >
              Show Events {showEvents && <span className="w-1.5 h-1.5 rounded-full bg-[#0891B2] ml-2"></span>}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowCounterfactual(!showCounterfactual)}
              className={`border-[#1E2538] bg-transparent h-8 text-xs ${showCounterfactual ? 'text-[#E2E8F0]' : 'text-[#A0ABBE]'}`}
            >
              Show Counterfactual
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="border-[#1E2538] bg-transparent text-[#A0ABBE] hover:text-[#E2E8F0] h-8 text-xs flex items-center gap-2"
            >
              <Download className="w-3 h-3" />
              Export
            </Button>
          </div>
        </div>

        <div className="p-4 relative" style={{ height: '300px' }}>
          {/* Y Axis Labels */}
          <div className="absolute left-4 top-4 bottom-8 flex flex-col justify-between text-[#6B7A8D] text-xs">
            <span>2,500</span>
            <span>2,000</span>
            <span>1,500</span>
            <span>1,000</span>
            <span>0</span>
          </div>

          {/* Chart Area */}
          <div className="ml-12 h-full relative border-l border-b border-[#1E2538] flex items-end">
            
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full border-t border-[#1E2538] opacity-50" style={{ height: '25%' }}></div>
              ))}
            </div>

            {/* X Axis Labels */}
            <div className="absolute -bottom-6 w-full flex justify-between text-[#6B7A8D] text-xs">
              <span className="ml-0">T-18</span>
              <span className="ml-[20%]">T-12</span>
              <span className="ml-[18%]">T-6</span>
              <span className="font-bold text-[#E2E8F0] ml-[15%]">T-0 (TODAY)</span>
              <span className="ml-[15%]">T+6</span>
              <span className="ml-[15%]">T+12</span>
              <span className="ml-[15%]">T+18</span>
              <span className="ml-[10%]">T+24</span>
            </div>

            {/* SVG Chart Layer */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 250">
              {/* Confidence Band */}
              {showEvents && (
                <path 
                  d="M 500 130 L 640 100 L 780 70 L 1000 50 L 1000 80 L 780 100 L 640 120 L 500 130 Z" 
                  fill="#0891B2" 
                  opacity="0.08" 
                />
              )}

              {/* Historical Line (Solid White/Primary) */}
              <path 
                d="M 0 180 Q 250 160 500 130" 
                fill="none" 
                stroke="#E2E8F0" 
                strokeWidth="2" 
              />
              
              {/* Event Adjusted Forecast (Cyan Dotted) */}
              {showEvents && (
                <path 
                  d="M 500 130 Q 750 90 1000 60" 
                  fill="none" 
                  stroke="#0891B2" 
                  strokeWidth="2" 
                  strokeDasharray="4 4" 
                />
              )}

              {/* Baseline Forecast (Thin Dotted Gray) */}
              {(showCounterfactual || !showEvents) && (
                <path 
                  d="M 500 130 L 1000 125" 
                  fill="none" 
                  stroke="#6B7A8D" 
                  strokeWidth="1.5" 
                  strokeDasharray="2 4" 
                />
              )}

              {/* Today Marker Line */}
              <line x1="500" y1="0" x2="500" y2="250" stroke="#1E2538" strokeWidth="2" />
            </svg>

            {/* Event Markers & Overlays */}
            {showEvents && (
              <>
                {/* Event 1: Amazon HQ2 */}
                <div className="absolute top-0 bottom-0 left-[27.7%] border-l border-[#6B7A8D] border-dashed pointer-events-none">
                  <div className="bg-[#6B7A8D] text-[#0B0E1A] text-[10px] font-bold px-2 py-1 absolute -left-0 -top-2 whitespace-nowrap flex items-center gap-1 rounded-sm">
                    <span>📣</span> Amazon HQ2
                  </div>
                </div>
                <div className="absolute top-0 bottom-0 left-[27.7%] right-0 bg-[#6B7A8D] opacity-5 pointer-events-none"></div>

                {/* Event 2: BRT Phase 2 */}
                <div className="absolute top-0 bottom-0 left-[38.8%] border-l border-[#0891B2] border-dotted pointer-events-none">
                  <div className="bg-[#0891B2] text-[#0B0E1A] text-[10px] font-bold px-2 py-1 absolute -left-0 top-6 whitespace-nowrap flex items-center gap-1 rounded-sm">
                    <span>🚆</span> BRT Phase 2
                  </div>
                </div>

                {/* Static Tooltip at T+6 */}
                <Card className="absolute left-[60%] top-[20%] bg-[#131929] border-[#1E2538] p-3 shadow-lg z-10 w-64 pointer-events-none">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#1E2538]">
                    <div className="w-2 h-2 rounded-full bg-[#0891B2]"></div>
                    <div className="font-bold text-[#E2E8F0] text-xs">T+6 PROJECTION: 1,924 searches/mo</div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#A0ABBE]">Event contribution:</span>
                      <span className="text-[#0891B2] font-mono">+324</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span className="text-[#6B7A8D] text-[10px]">- Amazon HQ2:</span>
                      <span className="text-[#6B7A8D] text-[10px] font-mono">+261</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span className="text-[#6B7A8D] text-[10px]">- BRT:</span>
                      <span className="text-[#6B7A8D] text-[10px] font-mono">+63</span>
                    </div>
                    <div className="flex justify-between mt-2 pt-1 border-t border-[#1E2538]">
                      <span className="text-[#A0ABBE]">Baseline without events:</span>
                      <span className="text-[#E2E8F0] font-mono">1,600</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[#A0ABBE]">Confidence:</span>
                      <span className="text-[#E2E8F0]">78%</span>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* Counterfactual Legend */}
            {showCounterfactual && (
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-[#131929] border border-[#1E2538] px-3 py-1.5 rounded text-xs">
                <div className="w-4 border-b border-dashed border-[#6B7A8D]"></div>
                <span className="text-[#A0ABBE]">Baseline (no events)</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* BELOW CHART */}
      <div className="grid grid-cols-3 gap-6">
        {/* LEFT COLUMN: EVENT CONTRIBUTION BREAKDOWN */}
        <Card className="col-span-2 bg-[#131929] border-[#1E2538]">
          <div className="p-4 border-b border-[#1E2538] font-bold tracking-wider text-[#E2E8F0]">
            EVENT CONTRIBUTION BREAKDOWN
          </div>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1E2538] text-[#6B7A8D] text-xs">
                  <th className="p-4 font-normal">EVENT</th>
                  <th className="p-4 font-normal">SCOPE</th>
                  <th className="p-4 font-normal">STATUS</th>
                  <th className="p-4 font-normal">MONTHLY TRAFFIC IMPACT</th>
                  <th className="p-4 font-normal">MECHANISM</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-[#1E2538] hover:bg-[#1E2538]/30 transition-colors">
                  <td className="p-4 text-[#E2E8F0] flex items-center gap-2">
                    <span className="text-[#6B7A8D]">📣</span> Amazon HQ2
                  </td>
                  <td className="p-4 text-[#A0ABBE]">MSA</td>
                  <td className="p-4">
                    <Badge variant="outline" className="bg-[#131929] border-[#6B7A8D] text-[#A0ABBE] rounded-none text-[10px]">FIRED T+8mo</Badge>
                  </td>
                  <td className="p-4 text-[#0891B2] font-mono">+261 <span className="text-[#6B7A8D] text-xs ml-1">by T+12</span></td>
                  <td className="p-4 text-[#A0ABBE] text-xs">Jobs→apartment demand→search</td>
                </tr>
                <tr className="border-b border-[#1E2538] hover:bg-[#1E2538]/30 transition-colors">
                  <td className="p-4 text-[#E2E8F0] flex items-center gap-2">
                    <span className="text-[#0891B2]">🚆</span> BRT Phase 2
                  </td>
                  <td className="p-4 text-[#A0ABBE]">Submarket</td>
                  <td className="p-4">
                    <Badge variant="outline" className="bg-[#131929] border-[#0891B2] text-[#0891B2] rounded-none text-[10px]">PENDING</Badge>
                  </td>
                  <td className="p-4 text-[#0891B2] font-mono">+63 <span className="text-[#6B7A8D] text-xs ml-1">by T+18</span></td>
                  <td className="p-4 text-[#A0ABBE] text-xs">Transit access→search momentum</td>
                </tr>
                <tr className="hover:bg-[#1E2538]/30 transition-colors">
                  <td className="p-4 text-[#6B7A8D]">Baseline trend</td>
                  <td className="p-4 text-[#6B7A8D]">—</td>
                  <td className="p-4 text-[#6B7A8D]">—</td>
                  <td className="p-4 text-[#6B7A8D] font-mono">+62/mo <span className="text-[#6B7A8D] text-xs ml-1">secular</span></td>
                  <td className="p-4 text-[#6B7A8D] text-xs">Population growth</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-[#1E2538] bg-[#0B0E1A]/50 flex justify-between items-center">
            <span className="text-[#A0ABBE] text-xs">TOTAL EVENT LIFT</span>
            <div className="flex items-center gap-3">
              <span className="text-[#0891B2] font-bold font-mono">+324 searches/mo</span>
              <span className="text-[#10B981] text-xs">= +20.3% above baseline at T+12</span>
            </div>
          </div>
        </Card>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <Card className="bg-[#131929] border-[#1E2538]">
            <div className="p-4 border-b border-[#1E2538] font-bold tracking-wider text-[#E2E8F0] flex items-center justify-between">
              PLAYBOOK REFERENCE
              <Info className="w-4 h-4 text-[#6B7A8D]" />
            </div>
            <div className="p-4 space-y-4">
              <div className="text-[#0891B2] font-bold text-sm">M35 Playbook: Major HQ Relocation (Large MSA)</div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#A0ABBE]">Median search momentum uplift:</span>
                  <span className="text-[#E2E8F0] font-mono">+18-24% at T+12</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-[#A0ABBE]">This property:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#0891B2] font-mono">+20.3%</span>
                    <Badge className="bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30 border-none text-[10px] rounded-sm py-0 h-5">ON PACE</Badge>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#A0ABBE]">Comparable events:</span>
                  <span className="text-[#E2E8F0]">23 historical instances</span>
                </div>
              </div>

              <Button className="w-full bg-[#1E2538] hover:bg-[#2A3441] text-[#E2E8F0] border-none flex items-center justify-between mt-4">
                <span>View Full Playbook</span>
                <ExternalLink className="w-4 h-4 text-[#A0ABBE]" />
              </Button>
            </div>
          </Card>

          <Card className="bg-[#131929] border-[#1E2538]">
            <div className="p-4 border-b border-[#1E2538] font-bold tracking-wider text-[#E2E8F0] text-xs">
              CALIBRATION STATUS
            </div>
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <div className="text-[#E2E8F0] text-sm">High Confidence (78%)</div>
                  <div className="text-[#6B7A8D] text-xs">Calibrated 2 days ago</div>
                </div>
              </div>
              <Target className="w-5 h-5 text-[#6B7A8D]" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
