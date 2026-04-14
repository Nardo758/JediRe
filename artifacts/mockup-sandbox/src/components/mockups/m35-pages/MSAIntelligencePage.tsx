import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ArrowRight, Activity, Zap, ShieldAlert, BarChart3, Target } from "lucide-react";

export function MSAIntelligencePage() {
  return (
    <div className="min-h-screen font-sans bg-[#0B0E1A] text-[#E2E8F0] p-6 max-w-[1400px] mx-auto overflow-y-auto">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 pb-4 border-b border-[#1E2538]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#E2E8F0] uppercase mb-1">
            TAMPA – ST. PETE MSA
          </h1>
          <div className="text-sm font-medium text-[#A0ABBE] uppercase tracking-wider flex items-center gap-3">
            <span>FL</span>
            <span className="w-1 h-1 rounded-full bg-[#6B7A8D]"></span>
            <span>Metro Population: 3.2M</span>
            <span className="w-1 h-1 rounded-full bg-[#6B7A8D]"></span>
            <span>Tier: Major</span>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-6 font-mono text-sm bg-[#131929] px-4 py-2 rounded-md border border-[#1E2538]">
          <div className="flex flex-col">
            <span className="text-[#6B7A8D] text-xs">JEDI Score</span>
            <span className="text-xl font-bold text-[#E2E8F0]">78</span>
          </div>
          <div className="w-px h-8 bg-[#1E2538]"></div>
          <div className="flex flex-col">
            <span className="text-[#6B7A8D] text-xs">Event Sensitivity</span>
            <span className="text-xl font-bold text-[#EF4444]">HIGH</span>
          </div>
          <div className="w-px h-8 bg-[#1E2538]"></div>
          <div className="flex flex-col">
            <span className="text-[#6B7A8D] text-xs">Active Events</span>
            <span className="text-xl font-bold text-[#0891B2]">5</span>
          </div>
        </div>
      </header>

      {/* Active Events Banner */}
      <div className="bg-[#131929] border border-[#1E2538] border-l-[3px] border-l-[#0891B2] rounded-md p-4 mb-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex flex-col lg:flex-row xl:items-center gap-4">
          <span className="font-bold text-sm tracking-wide text-[#E2E8F0] whitespace-nowrap">
            5 ACTIVE EVENTS AFFECTING THIS MSA
          </span>
          <div className="hidden lg:block w-px h-5 bg-[#1E2538]"></div>
          <div className="flex flex-wrap gap-4 text-sm font-mono items-center">
            <div className="flex items-center gap-2">
              <span>📣</span>
              <span className="text-[#E2E8F0]">Amazon HQ2 Tampa</span>
              <span className="text-[#6B7A8D]">(fired, T+8mo)</span>
              <Badge variant="outline" className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 rounded-sm px-1.5 py-0">AHEAD</Badge>
            </div>
            <span className="text-[#6B7A8D]">|</span>
            <div className="flex items-center gap-2">
              <span>🌀</span>
              <span className="text-[#E2E8F0]">Hurricane Idalia Recovery</span>
              <span className="text-[#6B7A8D]">(MSA, T+14mo)</span>
            </div>
            <span className="text-[#6B7A8D]">|</span>
            <div className="flex items-center gap-2">
              <span>📜</span>
              <span className="text-[#E2E8F0]">FL Insurance Rate Reform</span>
              <span className="text-[#6B7A8D]">(state, pending)</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" className="text-[#0891B2] hover:text-[#0891B2] hover:bg-[#0891B2]/10 h-8 whitespace-nowrap">
          View All Events <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Primary Chart Section */}
      <div className="bg-[#131929] border border-[#1E2538] rounded-md p-4 mb-2">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-[#E2E8F0]">MSA Trajectory Overlay</h2>
            <div className="flex gap-2">
              <Select defaultValue="rent">
                <SelectTrigger className="w-[180px] h-8 bg-[#0B0E1A] border-[#1E2538] font-mono text-xs">
                  <SelectValue placeholder="Metric" />
                </SelectTrigger>
                <SelectContent className="bg-[#131929] border-[#1E2538] text-[#E2E8F0]">
                  <SelectItem value="rent">Rent Growth (YoY)</SelectItem>
                  <SelectItem value="cap">Cap Rate</SelectItem>
                  <SelectItem value="permit">Permit Velocity</SelectItem>
                  <SelectItem value="trans">Transaction Volume</SelectItem>
                  <SelectItem value="mig">Migration Index</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex bg-[#0B0E1A] border border-[#1E2538] rounded-md overflow-hidden">
                <button className="px-3 py-1 text-xs font-mono text-[#A0ABBE] hover:bg-[#1E2538] border-r border-[#1E2538]">Cap Rate</button>
                <button className="px-3 py-1 text-xs font-mono text-[#A0ABBE] hover:bg-[#1E2538] border-r border-[#1E2538]">Permit Velocity</button>
                <button className="px-3 py-1 text-xs font-mono text-[#A0ABBE] hover:bg-[#1E2538] border-r border-[#1E2538]">Transaction Volume</button>
                <button className="px-3 py-1 text-xs font-mono text-[#A0ABBE] hover:bg-[#1E2538]">Migration Index</button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-[#0891B2]"></span>
              <span className="text-[#A0ABBE]">Submarket</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-[#6B7A8D]"></span>
              <span className="text-[#A0ABBE]">MSA Scope</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-[#D97706]"></span>
              <span className="text-[#A0ABBE]">Property</span>
            </div>
          </div>
        </div>

        {/* The Chart (SVG Mock) */}
        <div className="relative w-full h-[300px] border border-[#1E2538] bg-[#0B0E1A] rounded overflow-hidden">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between opacity-10 pointer-events-none">
            <div className="w-full h-px bg-[#A0ABBE]"></div>
            <div className="w-full h-px bg-[#A0ABBE]"></div>
            <div className="w-full h-px bg-[#A0ABBE]"></div>
            <div className="w-full h-px bg-[#A0ABBE]"></div>
            <div className="w-full h-px bg-[#A0ABBE]"></div>
          </div>
          
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
            {/* Impact bands */}
            <rect x="330" y="0" width="170" height="300" fill="#0891B2" fillOpacity="0.05" />
            <rect x="670" y="0" width="170" height="300" fill="#0891B2" fillOpacity="0.05" />

            {/* Historic Line */}
            <path d="M 0,200 C 50,190 100,210 150,180 C 200,150 250,160 300,140 C 350,120 400,130 450,100 L 500,120" 
                  fill="none" stroke="#E2E8F0" strokeWidth="2" />
            
            {/* Forecast Cone */}
            <path d="M 500,120 C 600,80 700,70 1000,50 L 1000,150 C 700,150 600,160 500,120 Z" 
                  fill="#0891B2" fillOpacity="0.1" />
            
            {/* Forecast Line */}
            <path d="M 500,120 C 600,110 700,100 1000,90" 
                  fill="none" stroke="#0891B2" strokeWidth="2" strokeDasharray="4 4" />

            {/* Event Markers */}
            {/* T-8 Amazon */}
            <line x1="330" y1="0" x2="330" y2="300" stroke="#0891B2" strokeWidth="1.5" />
            <text x="335" y="20" fill="#0891B2" fontSize="12" fontFamily="monospace">📣 Amazon HQ2</text>
            
            {/* T-6 BRT */}
            <line x1="375" y1="0" x2="375" y2="300" stroke="#0891B2" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="380" y="40" fill="#0891B2" fontSize="12" fontFamily="monospace">🚆 BRT Phase 2</text>
            
            {/* T-2 Hurricane */}
            <line x1="460" y1="0" x2="460" y2="300" stroke="#6B7A8D" strokeWidth="1.5" />
            <text x="465" y="60" fill="#6B7A8D" fontSize="12" fontFamily="monospace">🌀 Hurricane Idalia</text>
            
            {/* TODAY T-0 */}
            <line x1="500" y1="0" x2="500" y2="300" stroke="#E2E8F0" strokeWidth="2" />
            <rect x="475" y="275" width="50" height="20" fill="#E2E8F0" rx="2" />
            <text x="500" y="289" fill="#0B0E1A" fontSize="10" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">TODAY</text>
            
            {/* T+4 Apple */}
            <line x1="670" y1="0" x2="670" y2="300" stroke="#6B7A8D" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="675" y="20" fill="#6B7A8D" fontSize="12" fontFamily="monospace">📣 Apple Campus</text>

          </svg>

          {/* Y Axis labels */}
          <div className="absolute left-2 top-0 bottom-0 py-2 flex flex-col justify-between font-mono text-[10px] text-[#A0ABBE]">
            <span>+6%</span>
            <span>+4%</span>
            <span>+2%</span>
            <span>0%</span>
            <span>-2%</span>
          </div>
        </div>

        {/* X Axis Labels */}
        <div className="flex justify-between px-4 mt-2 font-mono text-[10px] text-[#6B7A8D]">
          <span>T-24m</span>
          <span>T-18m</span>
          <span>T-12m</span>
          <span>T-6m</span>
          <span className="text-[#E2E8F0] font-bold">T-0</span>
          <span>T+6m</span>
          <span>T+12m</span>
          <span>T+18m</span>
          <span>T+24m</span>
        </div>
      </div>

      {/* Event Density Strip */}
      <div className="w-full h-12 bg-[#0B0E1A] border-x border-b border-[#1E2538] rounded-b-md mb-6 relative overflow-hidden flex items-end px-4">
        {/* Mocking random density ticks */}
        <div className="absolute bottom-0 w-full h-full flex items-end gap-[4px] px-1 opacity-80">
          {[...Array(60)].map((_, i) => {
            const h = Math.random() * 80 + 10;
            const isFired = i < 30; // Past
            let color = '#1E2538';
            if (i === 20 || i === 22 || i === 28) color = '#0891B2';
            if (i === 15 || i === 40) color = '#6B7A8D';
            if (i === 45) color = '#D97706';
            if (h > 60 && color === '#1E2538') color = '#2E3851';
            return (
              <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, backgroundColor: color }}></div>
            );
          })}
        </div>
        <div className="absolute inset-0 pointer-events-none border-t border-[#1E2538]/50"></div>
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#E2E8F0]/20 z-10"></div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Active Event Cards */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-[#A0ABBE] uppercase tracking-wider mb-2">Active Event Profiles</h3>
          
          {/* Card 1 */}
          <Card className="bg-[#131929] border-[#1E2538] border-l-[3px] border-l-[#0891B2] rounded-md flex flex-col">
            <div className="p-4 flex-1">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-[#0891B2]/10 flex items-center justify-center text-xl">
                    📣
                  </div>
                  <div>
                    <h4 className="text-[#E2E8F0] font-semibold flex items-center gap-2">
                      Amazon HQ2 Tampa
                      <Badge variant="outline" className="bg-[#0891B2]/10 text-[#0891B2] border-[#0891B2]/20 text-[10px] h-5 rounded-sm">SUBMARKET</Badge>
                    </h4>
                    <div className="text-xs font-mono text-[#6B7A8D] mt-1">FIRED • T+8mo</div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 font-mono">AHEAD</Badge>
              </div>
              <div className="bg-[#0B0E1A] border border-[#1E2538] rounded p-3 text-sm font-mono flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#A0ABBE]">Rent Growth:</span>
                  <span className="text-[#E2E8F0]">+1.4pp by T+12 <span className="text-[#10B981]">(AHEAD)</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#A0ABBE]">Absorption:</span>
                  <span className="text-[#E2E8F0]">+18% by T+12 <span className="text-[#A0ABBE]">(ON PACE)</span></span>
                </div>
              </div>
            </div>
            <div className="border-t border-[#1E2538] px-4 py-2 flex justify-end">
              <button className="text-xs text-[#0891B2] hover:text-[#0891B2]/80 font-medium flex items-center gap-1">
                View Details <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </Card>

          {/* Card 2 */}
          <Card className="bg-[#131929] border-[#1E2538] border-l-[3px] border-l-[#6B7A8D] rounded-md flex flex-col">
            <div className="p-4 flex-1">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-[#6B7A8D]/10 flex items-center justify-center text-xl">
                    🌀
                  </div>
                  <div>
                    <h4 className="text-[#E2E8F0] font-semibold flex items-center gap-2">
                      Hurricane Idalia Recovery
                      <Badge variant="outline" className="bg-[#6B7A8D]/10 text-[#A0ABBE] border-[#6B7A8D]/20 text-[10px] h-5 rounded-sm">MSA SCOPE</Badge>
                    </h4>
                    <div className="text-xs font-mono text-[#6B7A8D] mt-1">FIRED • T+14mo</div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-[#A0ABBE]/10 text-[#A0ABBE] border-[#A0ABBE]/20 font-mono">ON PACE</Badge>
              </div>
              <div className="bg-[#0B0E1A] border border-[#1E2538] rounded p-3 text-sm font-mono flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#A0ABBE]">Rent Growth:</span>
                  <span className="text-[#E2E8F0]">+0.8pp by T+12 <span className="text-[#A0ABBE]">(ON PACE)</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#A0ABBE]">Permit Velocity:</span>
                  <span className="text-[#E2E8F0]">-12% by T+12 <span className="text-[#EF4444]">(LAGGING)</span></span>
                </div>
              </div>
            </div>
            <div className="border-t border-[#1E2538] px-4 py-2 flex justify-end">
              <button className="text-xs text-[#0891B2] hover:text-[#0891B2]/80 font-medium flex items-center gap-1">
                View Details <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </Card>

          {/* Card 3 */}
          <Card className="bg-[#131929] border-[#1E2538] border-l-[3px] border-l-[#0891B2] rounded-md flex flex-col opacity-80">
            <div className="p-4 flex-1">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-[#0891B2]/10 flex items-center justify-center text-xl">
                    🚆
                  </div>
                  <div>
                    <h4 className="text-[#E2E8F0] font-semibold flex items-center gap-2">
                      BRT Phase 2 Extension
                      <Badge variant="outline" className="bg-[#0891B2]/10 text-[#0891B2] border-[#0891B2]/20 text-[10px] h-5 rounded-sm">SUBMARKET</Badge>
                    </h4>
                    <div className="text-xs font-mono text-[#6B7A8D] mt-1">PENDING • T-6mo</div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20 font-mono">FORECAST</Badge>
              </div>
              <div className="bg-[#0B0E1A] border border-[#1E2538] rounded p-3 text-sm font-mono flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#A0ABBE]">Rent Growth:</span>
                  <span className="text-[#E2E8F0]">+1.2pp by T+24 <span className="text-[#D97706]">(PROJ)</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#A0ABBE]">Cap Rate:</span>
                  <span className="text-[#E2E8F0]">-0.15pp by T+24 <span className="text-[#D97706]">(PROJ)</span></span>
                </div>
              </div>
            </div>
            <div className="border-t border-[#1E2538] px-4 py-2 flex justify-end">
              <button className="text-xs text-[#0891B2] hover:text-[#0891B2]/80 font-medium flex items-center gap-1">
                View Details <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </Card>
          
          {/* Card 4 */}
          <Card className="bg-[#131929] border-[#1E2538] border-l-[3px] border-l-[#6B7A8D] rounded-md flex flex-col opacity-80">
            <div className="p-4 flex-1">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-[#6B7A8D]/10 flex items-center justify-center text-xl">
                    📜
                  </div>
                  <div>
                    <h4 className="text-[#E2E8F0] font-semibold flex items-center gap-2">
                      FL Insurance Rate Reform
                      <Badge variant="outline" className="bg-[#6B7A8D]/10 text-[#A0ABBE] border-[#6B7A8D]/20 text-[10px] h-5 rounded-sm">STATE</Badge>
                    </h4>
                    <div className="text-xs font-mono text-[#6B7A8D] mt-1">PENDING • T-2mo</div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20 font-mono">FORECAST</Badge>
              </div>
              <div className="bg-[#0B0E1A] border border-[#1E2538] rounded p-3 text-sm font-mono flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#A0ABBE]">Cap Rate:</span>
                  <span className="text-[#E2E8F0]">-0.25pp by T+12 <span className="text-[#D97706]">(PROJ)</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#A0ABBE]">Transaction Vol:</span>
                  <span className="text-[#E2E8F0]">+22% by T+12 <span className="text-[#D97706]">(PROJ)</span></span>
                </div>
              </div>
            </div>
            <div className="border-t border-[#1E2538] px-4 py-2 flex justify-end">
              <button className="text-xs text-[#0891B2] hover:text-[#0891B2]/80 font-medium flex items-center gap-1">
                View Details <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </Card>
        </div>

        {/* Right Column: Playbooks & Summary */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Active Playbook Forecasts */}
          <div>
            <h3 className="text-sm font-semibold text-[#A0ABBE] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Active Playbook Forecasts
            </h3>
            <div className="flex flex-col gap-3">
              {/* Mini Card 1 */}
              <div className="bg-[#131929] border border-[#1E2538] rounded-md p-3 relative overflow-hidden">
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <div>
                    <div className="text-xs font-semibold text-[#E2E8F0] truncate max-w-[180px]">Amazon HQ2 x Rent Growth</div>
                    <div className="text-[10px] font-mono text-[#6B7A8D] uppercase">Submarket Impact</div>
                  </div>
                  <Badge variant="outline" className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 text-[10px] py-0 px-1.5 h-4">AHEAD</Badge>
                </div>
                <div className="h-[60px] w-full relative">
                  <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 200 60">
                    <path d="M0,40 C50,40 100,30 150,15 L200,10" fill="none" stroke="#0891B2" strokeWidth="1.5" />
                    <path d="M0,40 C50,40 100,30 150,20 L200,25" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                    <path d="M0,40 C50,40 100,30 150,10 L200,0" fill="none" stroke="#1E2538" strokeWidth="1" strokeDasharray="2 2" />
                    {/* Cone shadow */}
                    <path d="M100,30 L200,0 L200,25 Z" fill="#0891B2" fillOpacity="0.1" />
                    <line x1="100" y1="0" x2="100" y2="60" stroke="#1E2538" strokeWidth="1" />
                  </svg>
                </div>
              </div>

              {/* Mini Card 2 */}
              <div className="bg-[#131929] border border-[#1E2538] rounded-md p-3 relative overflow-hidden">
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <div>
                    <div className="text-xs font-semibold text-[#E2E8F0] truncate max-w-[180px]">Hurricane x Absorption</div>
                    <div className="text-[10px] font-mono text-[#6B7A8D] uppercase">MSA Impact</div>
                  </div>
                  <Badge variant="outline" className="bg-[#A0ABBE]/10 text-[#A0ABBE] border-[#A0ABBE]/20 text-[10px] py-0 px-1.5 h-4">ON PACE</Badge>
                </div>
                <div className="h-[60px] w-full relative">
                  <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 200 60">
                    <path d="M0,30 C50,20 100,10 150,30 L200,40" fill="none" stroke="#6B7A8D" strokeWidth="1.5" />
                    <path d="M0,30 C50,20 100,10 150,35 L200,45" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="100" y1="0" x2="100" y2="60" stroke="#1E2538" strokeWidth="1" />
                  </svg>
                </div>
              </div>

              {/* Mini Card 3 */}
              <div className="bg-[#131929] border border-[#1E2538] rounded-md p-3 relative overflow-hidden">
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <div>
                    <div className="text-xs font-semibold text-[#E2E8F0] truncate max-w-[180px]">Rate Reform x Cap Rate</div>
                    <div className="text-[10px] font-mono text-[#6B7A8D] uppercase">State Impact</div>
                  </div>
                  <Badge variant="outline" className="bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20 text-[10px] py-0 px-1.5 h-4">PROJ</Badge>
                </div>
                <div className="h-[60px] w-full relative">
                  <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 200 60">
                    <path d="M0,50 C50,50 100,50 150,40 L200,20" fill="none" stroke="#0891B2" strokeWidth="1.5" strokeDasharray="2 2" />
                    <path d="M0,50 C50,50 100,50 150,45 L200,30" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="100" y1="0" x2="100" y2="60" stroke="#1E2538" strokeWidth="1" />
                    <path d="M100,50 L200,20 L200,30 Z" fill="#0891B2" fillOpacity="0.1" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Event Impact Summary */}
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-[#A0ABBE] uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Event Impact Summary
            </h3>
            <div className="bg-[#131929] border border-[#1E2538] rounded-md overflow-hidden">
              <Table className="font-mono text-sm">
                <TableHeader className="bg-[#0B0E1A] border-b border-[#1E2538]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[#A0ABBE] font-semibold h-10">Metric</TableHead>
                    <TableHead className="text-[#A0ABBE] font-semibold h-10 text-right">Baseline</TableHead>
                    <TableHead className="text-[#0891B2] font-semibold h-10 text-right">Evt Uplift</TableHead>
                    <TableHead className="text-[#E2E8F0] font-semibold h-10 text-right">Fcst Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-b border-[#1E2538] hover:bg-[#1E2538]/50">
                    <TableCell className="font-sans font-medium text-[#E2E8F0]">Rent Growth</TableCell>
                    <TableCell className="text-right text-[#6B7A8D]">2.8%</TableCell>
                    <TableCell className="text-right text-[#0891B2]">+2.1pp</TableCell>
                    <TableCell className="text-right font-bold text-[#E2E8F0]">4.9%</TableCell>
                  </TableRow>
                  <TableRow className="border-b border-[#1E2538] hover:bg-[#1E2538]/50">
                    <TableCell className="font-sans font-medium text-[#E2E8F0]">Absorption</TableCell>
                    <TableCell className="text-right text-[#6B7A8D]">14%</TableCell>
                    <TableCell className="text-right text-[#0891B2]">+18%</TableCell>
                    <TableCell className="text-right font-bold text-[#E2E8F0]">32%</TableCell>
                  </TableRow>
                  <TableRow className="border-b border-[#1E2538] hover:bg-[#1E2538]/50">
                    <TableCell className="font-sans font-medium text-[#E2E8F0]">Cap Rate</TableCell>
                    <TableCell className="text-right text-[#6B7A8D]">5.2%</TableCell>
                    <TableCell className="text-right text-[#10B981]">-0.3pp</TableCell>
                    <TableCell className="text-right font-bold text-[#E2E8F0]">4.9%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-4 p-4 bg-[#0891B2]/10 border border-[#0891B2]/20 rounded-md flex gap-3">
              <Target className="w-5 h-5 text-[#0891B2] shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-semibold text-[#E2E8F0]">Strategic Conclusion:</span>
                <span className="text-[#A0ABBE] ml-1">Event velocity strongly supports short-term development pipelines in the submarket. The compounding effect of HQ2 and pending infrastructure heavily biases yield toward Class A multi-family.</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
