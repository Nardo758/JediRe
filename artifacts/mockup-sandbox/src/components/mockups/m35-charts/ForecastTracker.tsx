import React from "react";
import { Badge } from "@/components/ui/badge";

export function ForecastTracker() {
  return (
    <div className="bg-[#0B0E1A] text-[#E2E8F0] font-sans p-4 rounded-md border border-[#1E2538] w-full max-w-3xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold tracking-tight text-[#E2E8F0]">Amazon HQ2 — Tampa MSA</h2>
            <Badge variant="outline" className="bg-[#6B7280]/20 text-[#6B7280] border-[#6B7280]/30 text-[10px] h-5 rounded-sm px-1.5 uppercase font-mono">
              MSA SCOPE
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-[#A0ABBE]">Rent Growth (YoY)</span>
            <span className="text-sm font-mono text-[#E2E8F0] font-medium">+2.1%</span>
            <span className="text-xs font-mono text-[#6B7A8D]">vs med +1.3%</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className="bg-[#10B981]/20 text-[#10B981] border-none text-[10px] h-5 rounded-sm px-1.5 font-mono tracking-wider font-semibold">
            AHEAD OF PLAYBOOK
          </Badge>
          <span className="text-[10px] font-mono text-[#0891B2] bg-[#0891B2]/10 px-1.5 py-0.5 rounded-sm">T+8 MO</span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative bg-[#131929] border border-[#1E2538] rounded p-4 h-64 mt-1">
        {/* Y-axis labels */}
        <div className="absolute left-2 top-4 bottom-8 flex flex-col justify-between text-[10px] font-mono text-[#6B7A8D] z-10">
          <span>4.0%</span>
          <span>3.0%</span>
          <span>2.0%</span>
          <span>1.0%</span>
          <span>0.0%</span>
        </div>

        {/* SVG Chart */}
        <div className="w-full h-full pl-8 pb-4 relative">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
            {/* Grid lines */}
            <g className="stroke-[#1E2538] stroke-[0.5] opacity-50">
              <line x1="0" y1="0" x2="100" y2="0" />
              <line x1="0" y1="25" x2="100" y2="25" />
              <line x1="0" y1="50" x2="100" y2="50" />
              <line x1="0" y1="75" x2="100" y2="75" />
              <line x1="0" y1="100" x2="100" y2="100" />
              
              <line x1="0" y1="0" x2="0" y2="100" />
              <line x1="25" y1="0" x2="25" y2="100" />
              <line x1="50" y1="0" x2="50" y2="100" />
              <line x1="75" y1="0" x2="75" y2="100" />
              <line x1="100" y1="0" x2="100" y2="100" />
            </g>

            {/* Forecast Cone (High, Median, Low) */}
            <path d="M 0,75 Q 30,50 100,20" fill="none" className="stroke-[#6B7A8D] stroke-[0.5] stroke-dasharray-2 opacity-50" />
            <path d="M 0,75 Q 30,60 100,45" fill="none" className="stroke-[#0891B2] stroke-[1] stroke-dasharray-2" />
            <path d="M 0,75 Q 30,70 100,80" fill="none" className="stroke-[#6B7A8D] stroke-[0.5] stroke-dasharray-2 opacity-50" />

            {/* Cone Fill */}
            <path d="M 0,75 Q 30,50 100,20 L 100,80 Q 30,70 0,75 Z" fill="#0891B2" opacity="0.05" />

            {/* Actual Data Line */}
            <path d="M 0,75 L 8,72 L 16,65 L 24,55" fill="none" className="stroke-[#E2E8F0] stroke-[1.5]" />
            
            {/* Actual Data Points */}
            <circle cx="0" cy="75" r="1.5" className="fill-[#131929] stroke-[#E2E8F0] stroke-[1]" />
            <circle cx="8" cy="72" r="1.5" className="fill-[#131929] stroke-[#E2E8F0] stroke-[1]" />
            <circle cx="16" cy="65" r="1.5" className="fill-[#131929] stroke-[#E2E8F0] stroke-[1]" />
            <circle cx="24" cy="55" r="2" className="fill-[#10B981] stroke-[#131929] stroke-[0.5]" />

            {/* T+9 Hover Indicator Line */}
            <line x1="25" y1="0" x2="25" y2="100" className="stroke-[#E2E8F0] stroke-[0.5] stroke-dasharray-2 opacity-30" />
          </svg>

          {/* X-axis labels */}
          <div className="absolute left-8 right-0 -bottom-5 flex justify-between text-[9px] font-mono text-[#6B7A8D]">
            <span>T+0</span>
            <span>T+3</span>
            <span>T+6</span>
            <span className="text-[#E2E8F0]">T+9</span>
            <span>T+12</span>
            <span>T+18</span>
            <span>T+24</span>
            <span>T+36</span>
          </div>

          {/* Static Tooltip at T+9 */}
          <div className="absolute left-[26%] top-[20%] bg-[#0B0E1A] border border-[#1E2538] rounded shadow-lg p-2 z-20 w-max pointer-events-none">
            <div className="flex flex-col gap-1 text-[10px] font-mono">
              <div className="flex justify-between gap-4 text-[#A0ABBE]">
                <span>Actual</span>
                <span className="text-[#E2E8F0]">+2.3%</span>
              </div>
              <div className="flex justify-between gap-4 text-[#A0ABBE]">
                <span>Forecast Median</span>
                <span className="text-[#0891B2]">+1.5%</span>
              </div>
              <div className="w-full h-px bg-[#1E2538] my-0.5"></div>
              <div className="flex justify-between gap-4 font-semibold">
                <span className="text-[#A0ABBE]">Delta</span>
                <span className="text-[#10B981]">+0.8pp</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="flex items-center gap-2 mt-1">
        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>
        <span className="text-[11px] text-[#A0ABBE]">Upgrades Tampa submarket playbook confidence <span className="text-[#10B981] font-mono">+4%</span></span>
      </div>
    </div>
  );
}
