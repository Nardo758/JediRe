import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown, 
  TrendingDown,
  Info,
  Clock,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export function DebtAdvisorTab() {
  const [activeTab, setActiveTab] = useState<'advisor' | 'configure'>('advisor');
  const [expandedPhase, setExpandedPhase] = useState<string | null>('bridge');

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e2e8f0] font-sans p-4 space-y-6">
      <style>{`
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-sans { font-family: 'IBM Plex Sans', sans-serif; }
      `}</style>
      
      {/* 1. TAB TOGGLE ROW */}
      <div className="flex justify-between items-center border-b border-[#1e1e24] pb-2">
        <div className="flex space-x-6 text-sm font-medium tracking-wide">
          <button 
            onClick={() => setActiveTab('advisor')}
            className={`pb-2 -mb-[9px] uppercase ${activeTab === 'advisor' ? 'text-[#00e5a0] border-b-2 border-[#00e5a0]' : 'text-[#64748b] hover:text-[#e2e8f0]'}`}
          >
            [ Advisor ]
          </button>
          <button 
            onClick={() => setActiveTab('configure')}
            className={`pb-2 -mb-[9px] uppercase ${activeTab === 'configure' ? 'text-[#00e5a0] border-b-2 border-[#00e5a0]' : 'text-[#64748b] hover:text-[#e2e8f0]'}`}
          >
            [ Configure ]
          </button>
        </div>
        <div className="flex items-center text-[#64748b] text-xs font-mono">
          <Clock className="w-3 h-3 mr-2" />
          LAST COMPUTED: 10:42 AM EST
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          
          {/* 2. RECOMMENDATION HEADER */}
          <div className="bg-[#111114] border border-[#1e1e24] border-l-4 border-l-[#00e5a0] p-4 rounded-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <span className="bg-[#f59e0b]/20 text-[#f59e0b] text-[10px] font-bold px-2 py-0.5 rounded-sm border border-[#f59e0b]/30">
                    RECOMMENDED
                  </span>
                  <h2 className="text-xl font-bold tracking-tight text-white">Bridge-to-Perm + Fannie DUS Refi</h2>
                </div>
                <p className="text-[#64748b] text-sm max-w-3xl leading-relaxed">
                  MF Value-Add needs flexibility during reno (bridge), then long-term fixed at stabilization (agency). Rate environment: SOFR dropping 60bps over 12mo — floating bridge wins.
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 mb-5 text-sm">
              <span className="text-[#e2e8f0]">Total at close:</span>
              <span className="font-mono text-[#00e5a0] bg-[#00e5a0]/10 px-2 py-0.5 rounded-sm">$28.5M bridge</span>
              <span className="text-[#64748b]">&middot;</span>
              <span className="font-mono text-[#e2e8f0]">$320K origination + fees</span>
            </div>

            <div className="flex space-x-3">
              <button className="bg-[#00e5a0] text-[#0a0a0c] hover:bg-[#00e5a0]/90 px-4 py-1.5 text-sm font-bold rounded-sm transition-colors">
                Accept and Populate Configure
              </button>
              <button className="border border-[#00e5a0] text-[#00e5a0] hover:bg-[#00e5a0]/10 px-4 py-1.5 text-sm font-medium rounded-sm transition-colors">
                Modify
              </button>
              <button className="border border-[#a855f7] text-[#a855f7] hover:bg-[#a855f7]/10 px-4 py-1.5 text-sm font-medium rounded-sm transition-colors">
                Run Alt: Debt Fund
              </button>
            </div>
          </div>

          {/* 3. DEBT PLAN TIMELINE */}
          <div className="bg-[#111114] border border-[#1e1e24] p-4 rounded-sm">
            <h3 className="text-[#64748b] text-xs font-bold tracking-widest mb-4">DEBT PLAN TIMELINE</h3>
            
            <div className="relative pt-6 pb-2">
              {/* Axis */}
              <div className="absolute top-0 left-0 w-full flex justify-between text-[10px] text-[#64748b] font-mono border-b border-[#1e1e24] pb-1">
                <span>M0</span>
                <span>M6</span>
                <span>M12</span>
                <span>M18</span>
                <span>M24</span>
                <span>M30</span>
                <span>M36</span>
              </div>
              
              {/* Timeline Tracks */}
              <div className="relative h-20 mt-4">
                {/* Track 1: Bridge */}
                <div 
                  onClick={() => setExpandedPhase(expandedPhase === 'bridge' ? null : 'bridge')}
                  className="absolute top-0 left-0 w-[66.6%] h-8 bg-[#f97316]/20 border border-[#f97316] rounded-sm flex items-center px-3 cursor-pointer hover:bg-[#f97316]/30 transition-colors group"
                >
                  <div className="flex items-center space-x-2 w-full">
                    <span className="text-[#f97316] font-bold text-xs">BRIDGE</span>
                    <span className="text-[#f97316]/60">&middot;</span>
                    <span className="font-mono text-[#e2e8f0] text-xs">$28.5M</span>
                    <span className="text-[#f97316]/60">&middot;</span>
                    <span className="font-mono text-[#e2e8f0] text-xs">SOFR+275</span>
                    <span className="text-[#f97316]/60">&middot;</span>
                    <span className="font-mono text-[#e2e8f0] text-xs">3yr+1+1</span>
                    <span className="text-[#f97316]/60">&middot;</span>
                    <span className="text-[#e2e8f0] text-xs">IO</span>
                    <span className="text-[#f97316]/60">&middot;</span>
                    <span className="font-mono text-[#e2e8f0] text-xs">70% LTC</span>
                  </div>
                </div>

                {/* Track 2: Refi */}
                <div 
                  className="absolute top-10 left-[66.6%] w-[33.4%] h-8 bg-[#00e5a0]/10 border border-[#00e5a0]/50 border-r-transparent border-dashed rounded-l-sm flex items-center px-3"
                >
                  <div className="flex items-center space-x-2 w-full truncate">
                    <span className="text-[#00e5a0] font-bold text-xs">FANNIE DUS REFI</span>
                    <span className="text-[#00e5a0]/60">&middot;</span>
                    <span className="font-mono text-[#e2e8f0] text-xs">$32M</span>
                    <span className="text-[#00e5a0]/60">&middot;</span>
                    <span className="font-mono text-[#e2e8f0] text-xs">10yr</span>
                    <span className="text-[#00e5a0]/60">&middot;</span>
                    <span className="font-mono text-[#e2e8f0] text-xs">5.1% Fixed</span>
                    <span className="text-[#00e5a0]/60">&middot;</span>
                    <span className="font-mono text-[#e2e8f0] text-xs">65% LTV</span>
                  </div>
                </div>
                
                {/* Exit Line */}
                <div className="absolute top-0 bottom-0 right-0 w-px bg-[#64748b] border-r border-dashed border-[#64748b]">
                  <div className="absolute -top-4 right-2 text-[#64748b] text-[10px] font-bold whitespace-nowrap">
                    EXIT &middot; DUS Payoff + YM
                  </div>
                </div>
              </div>
            </div>

            {/* 4. EXPANDED PHASE DETAIL */}
            {expandedPhase === 'bridge' && (
              <div className="mt-4 border border-[#f97316]/30 bg-[#111114] rounded-sm flex flex-col md:flex-row overflow-hidden">
                {/* Left: Detail */}
                <div className="flex-1 p-4 border-r border-[#1e1e24]">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-[#f97316] font-bold text-sm flex items-center">
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Bridge-to-Perm Bridge
                      </h4>
                      <p className="text-[#64748b] text-xs mt-1">Why: Value-Add reno needs IO and flexible prepay</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-[#1e1e24] pb-1">
                        <span className="text-[#64748b]">Sizing</span>
                        <span className="font-mono">$28.5M &middot; LTV 70% &middot; LTC 70%</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e1e24] pb-1">
                        <span className="text-[#64748b]">Metrics</span>
                        <span className="font-mono">DSCR 0.91 (pre-stab) &middot; DY 5.7%</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e1e24] pb-1">
                        <span className="text-[#64748b]">Term</span>
                        <span className="font-mono">3yr + 1+1 &middot; Full IO</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e1e24] pb-1">
                        <span className="text-[#64748b]">Prepay</span>
                        <span className="font-mono">Open (bridge product)</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-[#1e1e24] pb-1">
                        <span className="text-[#64748b]">Pricing</span>
                        <span className="font-mono">Floating &middot; SOFR + 275bps</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e1e24] pb-1">
                        <span className="text-[#64748b]">Rate Cap</span>
                        <span className="font-mono">4.5% strike &middot; $380K &middot; 2yr</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e1e24] pb-1">
                        <span className="text-[#64748b]">Total Fees</span>
                        <span className="font-mono">$949K (Orig 1.5%, Exit 0.5%)</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1e1e24] pb-1">
                        <span className="text-[#64748b]">All-in</span>
                        <span className="font-mono text-[#f59e0b]">~8.25%</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-[#1e1e24]/50 p-2 rounded-sm border border-[#1e1e24] flex items-start space-x-2">
                    <Info className="w-4 h-4 text-[#00e5a0] mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-[#e2e8f0]">
                      <strong className="text-[#00e5a0]">Monitoring:</strong> Refi window trigger at M18 (occ &gt;92% + DSCR &gt;1.35)
                    </span>
                  </div>
                </div>

                {/* Right: Lenders */}
                <div className="w-full md:w-64 bg-[#0a0a0c] p-4 flex flex-col">
                  <h4 className="text-[#64748b] text-[10px] font-bold tracking-widest mb-3">LENDER TARGETS</h4>
                  
                  <div className="space-y-2 flex-1">
                    <div className="bg-[#111114] border border-[#00e5a0]/30 p-2 rounded-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#00e5a0]"></div>
                      <div className="flex justify-between items-center mb-1 pl-2">
                        <span className="font-bold text-xs text-white">Acore Capital</span>
                        <span className="text-[#00e5a0] text-[10px] font-mono">fit 94%</span>
                      </div>
                      <div className="text-[10px] text-[#64748b] font-mono pl-2">
                        6 deals YTD &middot; SOFR+290
                      </div>
                    </div>
                    
                    <div className="bg-[#111114] border border-[#1e1e24] p-2 rounded-sm hover:border-[#64748b] transition-colors cursor-pointer">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-xs text-[#e2e8f0]">Square Mile Cap</span>
                        <span className="text-[#64748b] text-[10px] font-mono">fit 78%</span>
                      </div>
                      <div className="text-[10px] text-[#64748b] font-mono">
                        4 deals &middot; SOFR+325
                      </div>
                    </div>

                    <div className="bg-[#111114] border border-[#1e1e24] p-2 rounded-sm hover:border-[#64748b] transition-colors cursor-pointer">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-xs text-[#e2e8f0]">Bank OZK</span>
                        <span className="text-[#64748b] text-[10px] font-mono">fit 71%</span>
                      </div>
                      <div className="text-[10px] text-[#64748b] font-mono">
                        8 deals &middot; SOFR+275
                      </div>
                      <div className="text-[9px] text-[#ef4444] mt-1">Requires partial recourse</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-[#1e1e24] text-[10px] text-[#64748b] leading-tight">
                    <span className="text-[#00e5a0]">Acore recommended</span> — highest volume, non-recourse, pricing competitive
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. ALTERNATIVE STRUCTURES */}
          <div className="space-y-3">
            <h3 className="text-[#64748b] text-xs font-bold tracking-widest uppercase">Alternative Structures</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Alt 1 */}
              <div className="bg-[#111114] border border-[#1e1e24] p-4 rounded-sm hover:border-[#64748b] transition-colors cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-[#e2e8f0] group-hover:text-white">Zero Rate Risk</h4>
                  <span className="text-[#ef4444] font-mono text-xs bg-[#ef4444]/10 px-1.5 py-0.5 rounded-sm">IRR -0.3%</span>
                </div>
                <div className="font-mono text-xs text-[#64748b] mb-3 space-y-1">
                  <div>3yr fixed 6.5% bridge</div>
                  <div>+40bps expected all-in</div>
                </div>
                <p className="text-xs text-[#e2e8f0] border-t border-[#1e1e24] pt-2">
                  Eliminates rate cap cost $380K, sacrifices expected floating savings.
                </p>
              </div>

              {/* Alt 2 */}
              <div className="bg-[#111114] border border-[#1e1e24] p-4 rounded-sm hover:border-[#64748b] transition-colors cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-[#e2e8f0] group-hover:text-white">Higher Leverage</h4>
                  <span className="text-[#00e5a0] font-mono text-xs bg-[#00e5a0]/10 px-1.5 py-0.5 rounded-sm">IRR +1.1%</span>
                </div>
                <div className="font-mono text-xs text-[#64748b] mb-3 space-y-1">
                  <div>Add 10% mezz at 13% pay+PIK</div>
                  <div>Blended cost +60bps</div>
                </div>
                <p className="text-xs text-[#e2e8f0] border-t border-[#1e1e24] pt-2">
                  Mezz adds execution risk at close. More equity deployed.
                </p>
              </div>

            </div>
          </div>

          {/* 7. MONITORING TRIGGERS */}
          <div className="bg-[#111114] border border-[#1e1e24] p-4 rounded-sm">
            <h3 className="text-[#64748b] text-xs font-bold tracking-widest uppercase mb-4">Monitoring Triggers</h3>
            <div className="space-y-3">
              
              <div className="flex items-start space-x-3 p-3 bg-[#0a0a0c] border border-[#1e1e24] rounded-sm">
                <div className="mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-[#64748b]" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-[#e2e8f0]">M18 Refi Window</span>
                    <span className="text-[#64748b] text-[10px] uppercase font-bold tracking-wide">Not Triggered</span>
                  </div>
                  <p className="text-xs text-[#64748b] mb-1">If occ &gt;92% AND DSCR &gt;1.35 → agency refi eligible</p>
                  <p className="font-mono text-xs text-[#e2e8f0]">Current: occ 89.1%, DSCR 0.91</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-[#ef4444]/5 border border-[#ef4444]/30 rounded-sm">
                <div className="mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-[#ef4444]">Cap Replacement</span>
                    <span className="text-[#ef4444] text-[10px] uppercase font-bold tracking-wide bg-[#ef4444]/10 px-1.5 py-0.5 rounded-sm">Warning</span>
                  </div>
                  <p className="text-xs text-[#e2e8f0]">Rate cap expires M24 — replacement at same strike ~$180K. Budget in reserves.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-[#0a0a0c] border border-[#1e1e24] rounded-sm">
                <div className="mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-[#64748b]" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-[#e2e8f0]">COR-08 Permit Velocity</span>
                    <span className="text-[#00e5a0] text-[10px] uppercase font-bold tracking-wide bg-[#00e5a0]/10 px-1.5 py-0.5 rounded-sm">Active Signal</span>
                  </div>
                  <p className="text-xs text-[#64748b] mb-1">Permit velocity at 42% — if breaks 60%, shorten exit → recommend early refi to long fixed</p>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* 5. MARKET CONTEXT PANEL (Right Rail) */}
        <div className="w-full xl:w-[280px] space-y-4 flex-shrink-0">
          <div className="bg-[#111114] border border-[#1e1e24] rounded-sm flex flex-col h-full sticky top-4">
            <div className="p-4 border-b border-[#1e1e24]">
              <h3 className="text-[#64748b] text-xs font-bold tracking-widest uppercase mb-4">Market Context</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#e2e8f0]">10yr Treasury</span>
                  <div className="flex items-center text-[#00e5a0] font-mono text-sm">
                    4.21% <TrendingDown className="w-3 h-3 ml-1" />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-[#64748b]">
                  <span>Change today</span>
                  <span>-8bps</span>
                </div>

                <div className="h-px bg-[#1e1e24] w-full"></div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#e2e8f0]">SOFR</span>
                  <span className="font-mono text-sm text-white">4.95%</span>
                </div>
                
                {/* Sparkline Mock */}
                <div className="h-10 w-full flex items-end justify-between space-x-1 pt-2">
                  <div className="w-full h-full relative">
                    <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
                      <path d="M0,5 L20,10 L40,12 L60,18 L80,25 L100,28" fill="none" stroke="#00e5a0" strokeWidth="2" />
                      <circle cx="100" cy="28" r="2" fill="#00e5a0" />
                    </svg>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#64748b]">Environment</span>
                  <span className="text-[10px] font-bold tracking-wide text-[#00e5a0] bg-[#00e5a0]/10 px-1.5 py-0.5 rounded-sm uppercase">Dropping</span>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#e2e8f0]">RSS Score</span>
                <span className="font-mono text-sm text-[#00e5a0]">67/100</span>
              </div>
              
              <div className="space-y-2">
                <div className="text-xs text-[#64748b]">Active Signals</div>
                <div className="bg-[#0a0a0c] border border-[#1e1e24] p-2 rounded-sm text-xs">
                  <div className="flex items-center text-[#e2e8f0] mb-1">
                    <TrendingUp className="w-3 h-3 mr-1 text-[#f59e0b]" />
                    <span className="font-mono mr-2">COR-08</span>
                    <span className="truncate">Permit velocity +42%</span>
                  </div>
                  <div className="flex items-center text-[#e2e8f0]">
                    <TrendingUp className="w-3 h-3 mr-1 text-[#00e5a0]" />
                    <span className="font-mono mr-2">COR-01</span>
                    <span className="truncate">Traffic surge active</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#1e1e24]">
                <div className="text-xs text-[#64748b] mb-2 uppercase tracking-widest font-bold">Pricing Window</div>
                <div className="bg-[#00e5a0]/10 border border-[#00e5a0]/30 p-3 rounded-sm">
                  <div className="text-[#00e5a0] text-xs font-bold mb-1 uppercase tracking-wide">Favorable</div>
                  <p className="text-xs text-[#e2e8f0] leading-relaxed">
                    Forward curve supports floating bridge with cap over 3yr fixed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
