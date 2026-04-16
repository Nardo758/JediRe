import React from "react";
import { ArrowUpRight } from "lucide-react";

export function AttributionWaterfall() {
  return (
    <div className="bg-[#0B0E1A] text-[#E2E8F0] font-sans p-5 rounded-md border border-[#1E2538] w-full max-w-2xl flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[#E2E8F0] mb-1">Rent Growth — Attribution Breakdown Y2</h2>
        <div className="flex items-center gap-2 text-xs font-mono text-[#6B7A8D]">
          <span>Tampa — Westshore Submarket</span>
          <span className="text-[#1E2538]">|</span>
          <span className="text-[#0891B2]">T+18mo</span>
        </div>
      </div>

      {/* Waterfall Chart */}
      <div className="flex flex-col text-xs font-mono">
        
        {/* Row 1: Baseline */}
        <div className="flex items-center group hover:bg-[#131929] transition-colors py-1.5 px-2 -mx-2 rounded">
          <div className="w-48 shrink-0 flex items-center text-[#A0ABBE]">
            Baseline Trend
          </div>
          <div className="flex-1 h-5 relative flex items-center">
            {/* Start at 0, width ~ 32% (representing 3.2 out of 5.8) */}
            <div className="absolute left-0 h-3 bg-[#1E2538] rounded-sm" style={{ width: "55%" }}></div>
          </div>
          <div className="w-16 shrink-0 text-right text-[#A0ABBE]">3.2%</div>
        </div>

        {/* Row 2: MSA Event */}
        <div className="flex items-center group hover:bg-[#131929] transition-colors py-1.5 px-2 -mx-2 rounded cursor-pointer relative">
          <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#0891B2] rounded-full"></div>
          <div className="w-48 shrink-0 flex items-center gap-1.5 pl-2 text-[#E2E8F0]">
            + Amazon HQ2
            <ArrowUpRight className="w-3 h-3 text-[#6B7A8D] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex-1 h-5 relative flex items-center">
            {/* Start at 55%, width ~ 24% (1.4pp) */}
            <div className="absolute left-[55%] h-3 bg-[#0891B2] rounded-sm" style={{ width: "24%" }}></div>
            {/* connector line */}
            <div className="absolute left-[55%] -top-1.5 w-px h-2 bg-[#1E2538]"></div>
          </div>
          <div className="w-16 shrink-0 text-right text-[#0891B2]">+1.4pp</div>
        </div>

        {/* Row 3: Submarket Event */}
        <div className="flex items-center group hover:bg-[#131929] transition-colors py-1.5 px-2 -mx-2 rounded cursor-pointer relative">
          <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#0891B2]/50 rounded-full"></div>
          <div className="w-48 shrink-0 flex items-center gap-1.5 pl-2 text-[#E2E8F0]">
            + BRT Phase 2
            <ArrowUpRight className="w-3 h-3 text-[#6B7A8D] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex-1 h-5 relative flex items-center">
            {/* Start at 79%, width ~ 9% (0.5pp) */}
            <div className="absolute left-[79%] h-3 bg-[#0891B2]/60 rounded-sm" style={{ width: "9%" }}></div>
            {/* connector line */}
            <div className="absolute left-[79%] -top-1.5 w-px h-2 bg-[#1E2538]"></div>
          </div>
          <div className="w-16 shrink-0 text-right text-[#0891B2]/80">+0.5pp</div>
        </div>

        {/* Row 4: Secular */}
        <div className="flex items-center group hover:bg-[#131929] transition-colors py-1.5 px-2 -mx-2 rounded">
          <div className="w-48 shrink-0 flex items-center text-[#A0ABBE]">
            + Secular Migration
          </div>
          <div className="flex-1 h-5 relative flex items-center">
            {/* Start at 88%, width ~ 7% (0.4pp) */}
            <div className="absolute left-[88%] h-3 bg-[#2D3748] rounded-sm" style={{ width: "7%" }}></div>
            {/* connector line */}
            <div className="absolute left-[88%] -top-1.5 w-px h-2 bg-[#1E2538]"></div>
          </div>
          <div className="w-16 shrink-0 text-right text-[#A0ABBE]">+0.4pp</div>
        </div>

        {/* Row 5: Residual */}
        <div className="flex items-center group hover:bg-[#131929] transition-colors py-1.5 px-2 -mx-2 rounded">
          <div className="w-48 shrink-0 flex items-center text-[#6B7A8D]">
            + Unexplained Residual
          </div>
          <div className="flex-1 h-5 relative flex items-center">
            {/* Start at 95%, width ~ 5% (0.3pp) */}
            <div className="absolute left-[95%] h-3 bg-[#1E2538] rounded-sm" style={{ width: "5%" }}></div>
            {/* connector line */}
            <div className="absolute left-[95%] -top-1.5 w-px h-2 bg-[#1E2538]"></div>
          </div>
          <div className="w-16 shrink-0 text-right text-[#6B7A8D]">+0.3pp</div>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-[#1E2538] my-2"></div>

        {/* Row 6: Total */}
        <div className="flex items-center bg-[#131929] py-2 px-2 -mx-2 rounded border border-[#1E2538]">
          <div className="w-48 shrink-0 flex items-center text-[#E2E8F0] font-semibold">
            = Observed Rent Growth
          </div>
          <div className="flex-1 h-5 relative flex items-center">
            <div className="absolute left-0 h-4 bg-[#E2E8F0]/10 border border-[#E2E8F0]/20 rounded-sm w-full"></div>
            <div className="absolute right-0 h-4 w-px bg-[#E2E8F0]/50"></div>
          </div>
          <div className="w-16 shrink-0 text-right text-[#E2E8F0] font-bold text-sm">5.8%</div>
        </div>

      </div>
    </div>
  );
}
