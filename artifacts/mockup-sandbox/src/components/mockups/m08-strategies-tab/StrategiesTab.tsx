import React from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, Info, ChevronRight, Zap, Target, ArrowRight, CornerDownRight, ArrowUpRight } from 'lucide-react';

export function StrategiesTab() {
  return (
    <div className="min-h-screen p-6 bg-[#0a0a0c] text-[#e2e8f0] font-sans overflow-x-hidden selection:bg-[#00e5a0]/30" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .terminal-panel {
          background-color: #111114;
          border: 1px solid #1e1e24;
          border-radius: 2px;
        }
        .terminal-btn {
          border: 1px solid #1e1e24;
          background-color: transparent;
          color: #e2e8f0;
          transition: all 0.15s;
        }
        .terminal-btn:hover {
          border-color: #00e5a0;
          color: #00e5a0;
          background-color: rgba(0, 229, 160, 0.05);
        }
        .terminal-btn-primary {
          background-color: #00e5a0;
          color: #0a0a0c;
          font-weight: 600;
          border: 1px solid #00e5a0;
        }
        .terminal-btn-primary:hover {
          background-color: #00c78b;
        }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-end border-b border-[#1e1e24] pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">STRATEGY INTELLIGENCE</h1>
            <p className="text-[#64748b] text-sm mt-1">System auto-detection & strategy validation matrix</p>
          </div>
          <button className="terminal-btn-primary px-4 py-2 text-sm rounded-[2px] flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Apply to ProForma
          </button>
        </div>

        {/* 1. DETECTION BANNER */}
        <div className="terminal-panel border-l-4 border-l-[#00e5a0] p-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
            <Target className="w-48 h-48 -mt-8 -mr-8" />
          </div>
          
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-bold text-white tracking-widest">DETECTED · MULTIFAMILY · VALUE-ADD</h2>
                <span className="px-2 py-0.5 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30 text-xs font-bold rounded-[2px]">84% CONFIDENCE</span>
              </div>
              <p className="text-[#64748b] text-sm mb-4">Garden-style · Class B · 2008 Vintage · 186 Units</p>
              
              <div className="flex flex-wrap gap-2">
                <div className="bg-[#0a0a0c] border border-[#1e1e24] px-3 py-1.5 flex items-center gap-2 text-sm">
                  <span className="text-[#64748b]">Loss-to-Lease</span>
                  <span className="font-mono text-[#00e5a0]">12%</span>
                  <span className="text-xs text-[#64748b] ml-1">({'>'}8% thr)</span>
                </div>
                <div className="bg-[#0a0a0c] border border-[#1e1e24] px-3 py-1.5 flex items-center gap-2 text-sm">
                  <span className="text-[#64748b]">PCS Rank</span>
                  <span className="font-mono text-[#e2e8f0]">#28 of 41</span>
                  <span className="text-xs text-[#64748b] ml-1">(btm Q)</span>
                </div>
                <div className="bg-[#0a0a0c] border border-[#1e1e24] px-3 py-1.5 flex items-center gap-2 text-sm">
                  <span className="text-[#64748b]">Ops Score</span>
                  <span className="font-mono text-[#ef4444]">52</span>
                  <span className="text-xs text-[#64748b] ml-1">({'<'}60 thr)</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <button className="terminal-btn px-4 py-2 text-xs font-mono uppercase">Confirm Detection</button>
              <button className="terminal-btn px-4 py-2 text-xs font-mono uppercase">Adjust</button>
              <button className="terminal-btn px-4 py-2 text-xs font-mono uppercase text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/10 hover:border-[#ef4444]">Override</button>
            </div>
          </div>
        </div>

        {/* 2. SUB-STRATEGY COMPARISON */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Col 1 */}
          <div className="terminal-panel border-t-2 border-t-[#f59e0b] relative">
            <div className="absolute top-0 right-0 bg-[#f59e0b] text-[#0a0a0c] text-[10px] font-bold px-2 py-0.5 rounded-bl-[2px]">
              DETECTED ⚡
            </div>
            <div className="p-4 border-b border-[#1e1e24]">
              <h3 className="font-mono font-bold text-[#e2e8f0]">MF VALUE-ADD</h3>
            </div>
            <div className="p-4 flex items-center gap-4 border-b border-[#1e1e24]">
              <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-[#1e1e24]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path className="text-[#00e5a0]" strokeDasharray="81, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                </svg>
                <span className="absolute font-mono text-xl text-[#00e5a0]">81</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full text-sm">
                <div className="flex flex-col"><span className="text-[#64748b] text-xs">IRR</span><span className="font-mono text-[#e2e8f0]">19.3%</span></div>
                <div className="flex flex-col"><span className="text-[#64748b] text-xs">CoC</span><span className="font-mono text-[#e2e8f0]">8.2%</span></div>
                <div className="flex flex-col col-span-2"><span className="text-[#64748b] text-xs">Hold</span><span className="font-mono text-[#e2e8f0]">36mo</span></div>
              </div>
            </div>
            <div className="p-3 bg-[#00e5a0]/5 flex justify-between items-center text-xs">
              <span className="text-[#64748b] uppercase">Gate Status</span>
              <span className="text-[#00e5a0] font-mono flex items-center gap-1"><CheckCircle className="w-3 h-3" /> QUALIFIED</span>
            </div>
          </div>

          {/* Col 2 */}
          <div className="terminal-panel">
            <div className="p-4 border-b border-[#1e1e24]">
              <h3 className="font-mono font-bold text-[#64748b]">MF DEEP VALUE-ADD</h3>
            </div>
            <div className="p-4 flex items-center gap-4 border-b border-[#1e1e24] opacity-70">
              <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-[#1e1e24]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path className="text-[#f59e0b]" strokeDasharray="67, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                </svg>
                <span className="absolute font-mono text-xl text-[#f59e0b]">67</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full text-sm">
                <div className="flex flex-col"><span className="text-[#64748b] text-xs">IRR</span><span className="font-mono text-[#e2e8f0]">22.1%</span></div>
                <div className="flex flex-col"><span className="text-[#64748b] text-xs">CoC</span><span className="font-mono text-[#e2e8f0]">6.8%</span></div>
                <div className="flex flex-col col-span-2"><span className="text-[#64748b] text-xs">Hold</span><span className="font-mono text-[#e2e8f0]">48mo</span></div>
              </div>
            </div>
            <div className="p-3 flex justify-between items-center text-xs opacity-70">
              <span className="text-[#64748b] uppercase">Gate Status</span>
              <span className="text-[#f59e0b] font-mono flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> MARGINAL</span>
            </div>
          </div>

          {/* Col 3 */}
          <div className="terminal-panel">
            <div className="p-4 border-b border-[#1e1e24]">
              <h3 className="font-mono font-bold text-[#64748b]">MF CORE-PLUS</h3>
            </div>
            <div className="p-4 flex items-center gap-4 border-b border-[#1e1e24] opacity-50">
              <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-[#1e1e24]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path className="text-[#ef4444]" strokeDasharray="54, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                </svg>
                <span className="absolute font-mono text-xl text-[#ef4444]">54</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full text-sm">
                <div className="flex flex-col"><span className="text-[#64748b] text-xs">IRR</span><span className="font-mono text-[#e2e8f0]">13.4%</span></div>
                <div className="flex flex-col"><span className="text-[#64748b] text-xs">CoC</span><span className="font-mono text-[#e2e8f0]">9.1%</span></div>
                <div className="flex flex-col col-span-2"><span className="text-[#64748b] text-xs">Hold</span><span className="font-mono text-[#e2e8f0]">60mo</span></div>
              </div>
            </div>
            <div className="p-3 flex justify-between items-center text-xs opacity-50">
              <span className="text-[#64748b] uppercase">Gate Status</span>
              <span className="text-[#ef4444] font-mono flex items-center gap-1"><Info className="w-3 h-3" /> REJECTED</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 3. SIGNAL HEATMAP */}
          <div className="terminal-panel p-4">
            <h3 className="text-sm font-bold text-[#e2e8f0] mb-4 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#64748b]" />
              SIGNAL × STRATEGY MATRIX
            </h3>
            
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e24]">
                    <th className="py-2 text-left font-normal text-[#64748b]">FACTOR</th>
                    <th className="py-2 px-3 text-center font-normal text-[#e2e8f0]">Value-Add</th>
                    <th className="py-2 px-3 text-center font-normal text-[#64748b]">Deep V-A</th>
                    <th className="py-2 px-3 text-center font-normal text-[#64748b]">Core-Plus</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b border-[#1e1e24]/50">
                    <td className="py-2.5 text-[#64748b] font-sans text-xs uppercase">DEMAND</td>
                    <td className="p-1"><div className="bg-[#00e5a0]/20 text-[#00e5a0] text-center py-1 rounded-[2px]">88</div></td>
                    <td className="p-1"><div className="bg-[#00e5a0]/20 text-[#00e5a0] text-center py-1 rounded-[2px]">82</div></td>
                    <td className="p-1"><div className="bg-[#00e5a0]/20 text-[#00e5a0] text-center py-1 rounded-[2px]">86</div></td>
                  </tr>
                  <tr className="border-b border-[#1e1e24]/50">
                    <td className="py-2.5 text-[#64748b] font-sans text-xs uppercase">SUPPLY</td>
                    <td className="p-1"><div className="bg-[#00e5a0]/20 text-[#00e5a0] text-center py-1 rounded-[2px]">81</div></td>
                    <td className="p-1"><div className="bg-[#f59e0b]/20 text-[#f59e0b] text-center py-1 rounded-[2px]">68</div></td>
                    <td className="p-1"><div className="bg-[#ef4444]/20 text-[#ef4444] text-center py-1 rounded-[2px]">44</div></td>
                  </tr>
                  <tr className="border-b border-[#1e1e24]/50">
                    <td className="py-2.5 text-[#64748b] font-sans text-xs uppercase">MOMENTUM</td>
                    <td className="p-1"><div className="bg-[#00e5a0]/20 text-[#00e5a0] text-center py-1 rounded-[2px]">92</div></td>
                    <td className="p-1"><div className="bg-[#00e5a0]/20 text-[#00e5a0] text-center py-1 rounded-[2px]">84</div></td>
                    <td className="p-1"><div className="bg-[#f59e0b]/20 text-[#f59e0b] text-center py-1 rounded-[2px]">51</div></td>
                  </tr>
                  <tr className="border-b border-[#1e1e24]/50">
                    <td className="py-2.5 text-[#64748b] font-sans text-xs uppercase">POSITION</td>
                    <td className="p-1"><div className="bg-[#f59e0b]/20 text-[#f59e0b] text-center py-1 rounded-[2px]">74</div></td>
                    <td className="p-1"><div className="bg-[#f59e0b]/20 text-[#f59e0b] text-center py-1 rounded-[2px]">61</div></td>
                    <td className="p-1"><div className="bg-[#ef4444]/20 text-[#ef4444] text-center py-1 rounded-[2px]">38</div></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 text-[#64748b] font-sans text-xs uppercase">RISK</td>
                    <td className="p-1"><div className="bg-[#00e5a0]/20 text-[#00e5a0] text-center py-1 rounded-[2px]">85</div></td>
                    <td className="p-1"><div className="bg-[#ef4444]/20 text-[#ef4444] text-center py-1 rounded-[2px]">42</div></td>
                    <td className="p-1"><div className="bg-[#00e5a0]/20 text-[#00e5a0] text-center py-1 rounded-[2px]">89</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. PLAN DOCUMENT */}
          <div className="terminal-panel p-4 flex flex-col h-full">
            <h3 className="text-sm font-bold text-[#e2e8f0] mb-4 uppercase tracking-wider">
              EXECUTION PLAN
            </h3>
            
            <div className="flex-1 space-y-2 text-sm font-mono flex flex-col">
              <div className="p-3 border border-[#1e1e24] bg-[#0a0a0c] flex items-start gap-3">
                <span className="text-[#64748b] w-16 shrink-0 mt-0.5">ENTRY</span>
                <div className="text-[#e2e8f0] leading-relaxed">
                  <span className="text-[#00e5a0]">Q2 2026</span> <span className="text-[#64748b]">·</span> Ceiling $42.8M <span className="text-[#64748b]">·</span> Bridge-to-perm 65% LTC
                </div>
              </div>
              
              <div className="p-3 border border-[#1e1e24] bg-[#0a0a0c] flex-1">
                <span className="text-[#64748b] block mb-3">VALUE CREATION</span>
                <div className="space-y-3 pl-4 border-l border-[#1e1e24]">
                  <div className="relative">
                    <div className="absolute w-2 h-2 bg-[#1e1e24] -left-[21px] top-1.5 rounded-full"></div>
                    <span className="text-[#e2e8f0]">M1-M3</span> <span className="text-[#64748b] text-xs font-sans ml-2">Light reno test & ops transition</span>
                  </div>
                  <div className="relative">
                    <div className="absolute w-2 h-2 bg-[#1e1e24] -left-[21px] top-1.5 rounded-full"></div>
                    <span className="text-[#e2e8f0]">M4-M9</span> <span className="text-[#64748b] text-xs font-sans ml-2">Accelerate unit turns (12/mo)</span>
                    <span className="ml-2 px-1.5 py-0.5 bg-[#1e1e24] text-[10px] rounded-[2px]">COR-01 ✓</span>
                  </div>
                  <div className="relative">
                    <div className="absolute w-2 h-2 bg-[#1e1e24] -left-[21px] top-1.5 rounded-full"></div>
                    <span className="text-[#e2e8f0]">M10-24</span> <span className="text-[#64748b] text-xs font-sans ml-2">Stabilize & burn off concessions</span>
                  </div>
                  <div className="relative">
                    <div className="absolute w-2 h-2 bg-[#00e5a0] -left-[21px] top-1.5 rounded-full shadow-[0_0_8px_rgba(0,229,160,0.5)]"></div>
                    <span className="text-[#e2e8f0]">M25-36</span> <span className="text-[#64748b] text-xs font-sans ml-2">Refi or prep for exit</span>
                  </div>
                </div>
              </div>
              
              <div className="p-3 border border-[#1e1e24] bg-[#0a0a0c] flex items-start gap-3">
                <span className="text-[#64748b] w-16 shrink-0 mt-0.5">EXIT</span>
                <div className="text-[#e2e8f0] leading-relaxed">
                  <span className="text-[#f59e0b]">Q4 2028</span> <span className="text-[#64748b]">·</span> Cap 5.25% <span className="text-[#64748b]">·</span> <span className="text-[#00e5a0]">IRR 18.4-21.7%</span>
                  <div className="text-xs font-sans text-[#64748b] mt-1">Buyers: Cortland, Blackstone, Morgan Properties</div>
                </div>
              </div>
              
              <div className="p-3 border border-[#a855f7]/30 bg-[#a855f7]/5 flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-[#a855f7]" />
                  <div className="font-sans text-sm text-[#e2e8f0]">
                    If upzone Ord 27-156 passes (65% prob Q3) → <span className="font-mono text-[#a855f7]">BTS pivot, IRR 26%</span>
                  </div>
                </div>
                <button className="px-3 py-1 bg-[#a855f7] text-white text-xs font-semibold rounded-[2px] hover:bg-[#9333ea] transition-colors">
                  Pivot Now
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. EVIDENCE REPORT */}
        <div className="terminal-panel">
          <div className="p-4 border-b border-[#1e1e24]">
            <h3 className="text-sm font-bold text-[#00e5a0] uppercase tracking-wider flex items-center gap-2">
              <CornerDownRight className="w-4 h-4" />
              WHY THIS STRATEGY WINS
            </h3>
          </div>
          
          <div className="p-6 space-y-8">
            {/* Block A — THESIS */}
            <div className="pl-4 border-l-2 border-[#64748b] italic text-[#e2e8f0] text-sm/relaxed max-w-4xl">
              "Westshore Commons is a value-add winner because in-place rents sit <span className="text-[#00e5a0] font-semibold not-italic">$147/unit below</span> submarket-renovated comps, ops score <span className="text-[#ef4444] font-semibold not-italic">(52)</span> is bottom-quartile, and the submarket's renovated comp set trades at a <span className="text-[#00e5a0] font-semibold not-italic">4.7% cap vs. 6.1%</span> for unrenovated — a 140bps compression the renovation captures."
            </div>

            {/* Block B — METRIC STACK */}
            <div>
              <h4 className="text-xs font-bold text-[#64748b] uppercase mb-3 font-mono">VALUE DELTA STACK</h4>
              <div className="w-full border border-[#1e1e24] overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#0a0a0c] border-b border-[#1e1e24] font-mono text-xs">
                    <tr>
                      <th className="p-3 font-normal text-[#64748b]">METRIC</th>
                      <th className="p-3 font-normal text-[#e2e8f0]">SUBJECT</th>
                      <th className="p-3 font-normal text-[#64748b]">BENCHMARK</th>
                      <th className="p-3 font-normal text-[#e2e8f0]">DELTA</th>
                      <th className="p-3 font-normal text-[#00e5a0]">$ IMPACT</th>
                      <th className="p-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-sm divide-y divide-[#1e1e24]/50">
                    <tr className="hover:bg-[#1e1e24]/30 transition-colors group cursor-pointer">
                      <td className="p-3 font-sans text-[#e2e8f0]">In-place rent</td>
                      <td className="p-3">$1,420</td>
                      <td className="p-3 text-[#64748b]">$1,567</td>
                      <td className="p-3 text-[#ef4444]">-$147</td>
                      <td className="p-3 text-[#00e5a0]">+$328K GPR</td>
                      <td className="p-3 text-[#64748b] group-hover:text-[#e2e8f0]"><ArrowUpRight className="w-3 h-3" /></td>
                    </tr>
                    <tr className="hover:bg-[#1e1e24]/30 transition-colors group cursor-pointer bg-[#0a0a0c]/50">
                      <td className="p-3 font-sans text-[#e2e8f0]">Loss-to-lease</td>
                      <td className="p-3 text-[#ef4444]">9.4%</td>
                      <td className="p-3 text-[#64748b]">3.2%</td>
                      <td className="p-3 text-[#00e5a0]">+6.2pp</td>
                      <td className="p-3 text-[#00e5a0]">$328K capturable</td>
                      <td className="p-3 text-[#64748b] group-hover:text-[#e2e8f0]"><ArrowUpRight className="w-3 h-3" /></td>
                    </tr>
                    <tr className="hover:bg-[#1e1e24]/30 transition-colors group cursor-pointer">
                      <td className="p-3 font-sans text-[#e2e8f0]">Physical occ</td>
                      <td className="p-3 text-[#ef4444]">89.1%</td>
                      <td className="p-3 text-[#64748b]">94.2%</td>
                      <td className="p-3 text-[#ef4444]">-5.1pp</td>
                      <td className="p-3 text-[#00e5a0]">+$210K</td>
                      <td className="p-3 text-[#64748b] group-hover:text-[#e2e8f0]"><ArrowUpRight className="w-3 h-3" /></td>
                    </tr>
                    <tr className="hover:bg-[#1e1e24]/30 transition-colors group cursor-pointer bg-[#0a0a0c]/50">
                      <td className="p-3 font-sans text-[#e2e8f0]">Ops score (PCS)</td>
                      <td className="p-3 text-[#ef4444]">52</td>
                      <td className="p-3 text-[#64748b]">71</td>
                      <td className="p-3 text-[#ef4444]">-19</td>
                      <td className="p-3 text-[#00e5a0]">Mgmt lift +3-6% NOI</td>
                      <td className="p-3 text-[#64748b] group-hover:text-[#e2e8f0]"><ArrowUpRight className="w-3 h-3" /></td>
                    </tr>
                    <tr className="hover:bg-[#1e1e24]/30 transition-colors group cursor-pointer">
                      <td className="p-3 font-sans text-[#e2e8f0]">Cap rate unrenov</td>
                      <td className="p-3 text-[#ef4444]">6.10%</td>
                      <td className="p-3 text-[#64748b]">5.40% (renov)</td>
                      <td className="p-3 text-[#00e5a0]">-70bps</td>
                      <td className="p-3 text-[#00e5a0]">~$4.8M value</td>
                      <td className="p-3 text-[#64748b] group-hover:text-[#e2e8f0]"><ArrowUpRight className="w-3 h-3" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
              {/* Block C — COMP EVIDENCE */}
              <div className="lg:col-span-3 space-y-3">
                <h4 className="text-xs font-bold text-[#64748b] uppercase font-mono">MARKET PRICING EVIDENCE</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-[#1e1e24] bg-[#0a0a0c] p-4 relative h-48">
                    <span className="text-[10px] text-[#64748b] absolute top-2 left-2 uppercase">TRADE-AREA COMPS</span>
                    <div className="absolute inset-x-4 bottom-4 top-8 border-l border-b border-[#1e1e24]">
                      {/* X and Y axis labels */}
                      <span className="absolute -bottom-4 right-0 text-[8px] text-[#64748b]">Vintage</span>
                      <span className="absolute -left-6 top-0 text-[8px] text-[#64748b] -rotate-90">Rent</span>
                      
                      {/* Scatter plot dots */}
                      <div className="absolute w-1.5 h-1.5 rounded-full bg-[#00e5a0] bottom-[40%] left-[30%] opacity-60"></div>
                      <div className="absolute w-1.5 h-1.5 rounded-full bg-[#00e5a0] bottom-[60%] left-[45%] opacity-60"></div>
                      <div className="absolute w-1.5 h-1.5 rounded-full bg-[#00e5a0] bottom-[50%] left-[60%] opacity-60"></div>
                      <div className="absolute w-1.5 h-1.5 rounded-full bg-[#00e5a0] bottom-[75%] left-[80%] opacity-60"></div>
                      
                      {/* Subject dot */}
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-[#ef4444] bottom-[30%] left-[40%] shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10"></div>
                      
                      {/* Benchmark line */}
                      <div className="absolute border-t border-dashed border-[#64748b]/50 w-full bottom-[55%] left-0"></div>
                    </div>
                  </div>
                  
                  <div className="border border-[#1e1e24] bg-[#0a0a0c] p-4 relative h-48">
                    <span className="text-[10px] text-[#64748b] absolute top-2 left-2 uppercase">LIKE-KIND COMPS</span>
                    <div className="absolute inset-x-4 bottom-4 top-8 border-l border-b border-[#1e1e24]">
                      {/* Scatter plot dots */}
                      <div className="absolute w-1.5 h-1.5 rounded-full bg-[#00e5a0] bottom-[30%] left-[20%] opacity-60"></div>
                      <div className="absolute w-1.5 h-1.5 rounded-full bg-[#00e5a0] bottom-[50%] left-[40%] opacity-60"></div>
                      <div className="absolute w-1.5 h-1.5 rounded-full bg-[#00e5a0] bottom-[65%] left-[70%] opacity-60"></div>
                      
                      {/* Subject dot */}
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-[#ef4444] bottom-[25%] left-[35%] shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10"></div>
                      
                      {/* Benchmark line */}
                      <div className="absolute border-t border-dashed border-[#64748b]/50 w-full bottom-[45%] left-0"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Block D — MATH TRAIL */}
              <div className="lg:col-span-2 space-y-3">
                <h4 className="text-xs font-bold text-[#64748b] uppercase font-mono">MATH TRAIL</h4>
                <div className="border border-[#1e1e24] bg-[#0a0a0c] p-4 h-48 font-mono text-[11px] leading-[1.8] overflow-y-auto">
                  <div className="flex justify-between text-[#64748b]"><span>Step 1: Acquisition & Basis</span> <span className="text-[#e2e8f0]">$45,687,000</span></div>
                  <div className="flex justify-between text-[#64748b]"><span>Step 2: Y1 NOI (as acquired)</span> <span className="text-[#e2e8f0]">$1,640,000</span></div>
                  <div className="text-right text-[#64748b] italic mb-1 border-b border-[#1e1e24]/50 pb-1">(3.83% going-in cap)</div>
                  
                  <div className="flex justify-between text-[#64748b]"><span>Step 3: Stabilized NOI Y3</span> <span className="text-[#e2e8f0]">$2,110,000</span></div>
                  <div className="flex justify-between text-[#64748b]"><span>Step 4: Reno capital</span> <span className="text-[#ef4444]">$2,950,000</span></div>
                  <div className="flex justify-between text-[#64748b] mb-1 border-b border-[#1e1e24]/50 pb-1"><span>Step 5: Exit proceeds</span> <span className="text-[#e2e8f0]">$16,709,000</span></div>
                  
                  <div className="flex justify-between text-[#e2e8f0] mt-2 font-bold bg-[#00e5a0]/10 px-2 py-1 rounded-[2px]">
                    <span>Step 6: LP RETURN</span> 
                    <span className="text-[#00e5a0]">IRR 18.4% · EM 1.86x</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
