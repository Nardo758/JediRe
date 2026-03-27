export function MetricsEnhanced() {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e2e8f0] font-mono text-[13px]">
      {/* HEADER */}
      <div className="bg-[#111827] border-b border-[#1e293b] px-4 py-2 flex justify-between items-center">
        <span className="text-[#94a3b8] text-[11px] uppercase tracking-widest">Strategy Metrics Integration — MSA → Submarket → Property Drill-Down</span>
        <span className="text-[10px] text-[#94a3b8]">Strategy: <span className="text-[#14b8a6]">Core Plus Value-Add</span> | D:30% S:25% M:20% P:15% R:10%</span>
      </div>

      {/* ======= MSA LEVEL ======= */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[15px] font-bold">MSA: ATLANTA, GA</span>
          <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse inline-block"></span> LIVE</span>
          <span className="ml-auto px-2 py-0.5 bg-[#14b8a6]/20 text-[#14b8a6] text-[11px] rounded">JEDI 78</span>
          <span className="px-2 py-0.5 bg-[#f59e0b]/20 text-[#f59e0b] text-[11px] rounded">⚡ Arbitrage Δ22</span>
          <span className="px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] text-[11px] rounded">Score: 78/100</span>
        </div>

        <div className="flex gap-4">
          {/* LEFT: Charts + Grid */}
          <div className="flex-1">
            {/* Historical Charts Row */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              <ChartCard title="Rent Growth" value="+4.1%" trend="up" data={[2.1, 2.8, 3.2, 3.5, 3.1, 3.8, 4.1]} color="#14b8a6" />
              <ChartCard title="Occupancy" value="94.2%" trend="down" data={[95.8, 95.4, 95.1, 94.8, 94.6, 94.4, 94.2]} color="#f59e0b" />
              <ChartCard title="Population Growth" value="+1.8%" trend="up" data={[1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8]} color="#22c55e" />
              <ChartCard title="Traffic Index" value="74" trend="up" data={[58, 62, 65, 68, 70, 72, 74]} color="#14b8a6" />
            </div>

            {/* Compact Data Table Grid — MSA Metrics */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden">
              <div className="bg-[#0f1729] px-3 py-1.5 border-b border-[#1e293b] flex justify-between items-center">
                <span className="text-[11px] uppercase text-[#94a3b8] tracking-wider">Strategy Signal Metrics</span>
                <span className="text-[10px] text-[#94a3b8]">16 metrics across tracked signals</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase text-[#94a3b8] border-b border-[#1e293b]">
                    <th className="text-left px-3 py-1.5 font-normal">Signal</th>
                    <th className="text-left px-3 py-1.5 font-normal">Metric</th>
                    <th className="text-right px-3 py-1.5 font-normal">Value</th>
                    <th className="text-right px-3 py-1.5 font-normal">Δ YoY</th>
                    <th className="text-right px-3 py-1.5 font-normal">Weight</th>
                    <th className="text-right px-3 py-1.5 font-normal">Pts</th>
                    <th className="text-center px-3 py-1.5 font-normal">Gate</th>
                    <th className="text-right px-3 py-1.5 font-normal">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  <MetricRow sig="D-12" name="Population Growth" val="6.2M" chg="+1.8%" w="8%" pts="+8" gate="pass" spark={[1.2,1.3,1.5,1.6,1.7,1.8]} />
                  <MetricRow sig="D-01" name="Employment Growth" val="+2.4%" chg="+0.3%" w="12%" pts="+12" gate="pass" spark={[1.8,1.9,2.0,2.1,2.2,2.4]} />
                  <MetricRow sig="D-03" name="Job-Housing Ratio" val="1.24" chg="+0.06" w="6%" pts="+6" gate="pass" spark={[1.12,1.14,1.16,1.18,1.20,1.24]} />
                  <MetricRow sig="D-05" name="Median Income" val="$72.4K" chg="+3.2%" w="5%" pts="+5" gate="pass" spark={[64,66,68,69,71,72]} />
                  <MetricRow sig="M-01" name="Rent Growth" val="+4.1%" chg="+0.9%" w="10%" pts="+9" gate="pass" live spark={[2.1,2.8,3.2,3.5,3.8,4.1]} />
                  <MetricRow sig="S-03" name="Occupancy Rate" val="94.2%" chg="-0.3%" w="8%" pts="+6" gate="pass" spark={[95.8,95.4,95.1,94.8,94.4,94.2]} neg />
                  <MetricRow sig="S-05" name="Absorption Rate" val="88%" chg="+2.1%" w="7%" pts="+7" gate="pass" spark={[82,84,85,86,87,88]} />
                  <MetricRow sig="S-01" name="Pipeline Units" val="18,400" chg="+22%" w="6%" pts="-3" gate="soft-fail" spark={[12000,13500,14800,16200,17100,18400]} neg />
                  <MetricRow sig="S-06" name="Permit Momentum" val="-12%" chg="-8%" w="4%" pts="+4" gate="pass" spark={[-2,-4,-6,-8,-10,-12]} />
                  <MetricRow sig="M-04" name="Cap Rate" val="5.2%" chg="-0.3%" w="5%" pts="+5" gate="pass" spark={[5.8,5.6,5.5,5.4,5.3,5.2]} />
                  <MetricRow sig="M-03" name="NOI Growth" val="+3.8%" chg="+0.4%" w="6%" pts="+6" gate="pass" spark={[2.8,3.0,3.2,3.4,3.6,3.8]} />
                  <MetricRow sig="T-01" name="Traffic Index" val="74" chg="+6.2%" w="5%" pts="+4" gate="pass" spark={[58,62,65,68,72,74]} />
                  <MetricRow sig="T-03" name="Traffic Growth" val="+6.2%" chg="+1.1%" w="4%" pts="+4" gate="pass" spark={[3.8,4.2,4.8,5.1,5.6,6.2]} />
                  <MetricRow sig="P-05" name="Walk Score" val="62" chg="+3" w="3%" pts="+2" gate="soft-fail" spark={[55,56,58,59,60,62]} />
                  <MetricRow sig="DC-01" name="Dev Capacity Ratio" val="0.34" chg="-0.02" w="3%" pts="+3" gate="pass" spark={[0.40,0.38,0.37,0.36,0.35,0.34]} />
                  <MetricRow sig="DC-05" name="Zoning Utilization" val="78%" chg="+2%" w="3%" pts="+3" gate="pass" spark={[72,73,74,75,76,78]} last />
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-[#0f1729] border-t border-[#1e293b] flex justify-between text-[10px] text-[#94a3b8]">
                <span>14/16 Gates Passed | 2 Soft Fails (-8pts)</span>
                <span>Total Strategy Contribution: <span className="text-[#14b8a6]">+78pts</span></span>
              </div>
            </div>
          </div>

          {/* RIGHT: Commentary Side Panel */}
          <div className="w-[300px] flex-shrink-0 border-l-2 border-[#14b8a6]/40 pl-4 space-y-3">
            <div>
              <div className="text-[10px] uppercase text-[#14b8a6] tracking-wider mb-1 border-b border-[#14b8a6]/30 pb-1">Market Narrative</div>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed mb-2">
                Atlanta's multifamily market continues to demonstrate resilient fundamentals despite elevated supply pipeline. Demand drivers remain strong with 1.8% population growth and a favorable 1.24 jobs ratio, supporting above-trend absorption.
              </p>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                Near-term supply pressure from 18,400 units delivering in H2 2026 warrants selective positioning in core submarkets with established demand profiles.
              </p>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#14b8a6] tracking-wider mb-1 border-b border-[#14b8a6]/30 pb-1">Investment Thesis</div>
              <div className="space-y-1 text-[11px]">
                <div className="flex gap-2"><span className="text-[#22c55e]">✓</span><span className="text-[#94a3b8]">Population growth exceeds national avg</span></div>
                <div className="flex gap-2"><span className="text-[#22c55e]">✓</span><span className="text-[#94a3b8]">Employment diversification reducing risk</span></div>
                <div className="flex gap-2"><span className="text-[#f59e0b]">⚠</span><span className="text-[#94a3b8]">Supply deliveries may pressure occupancy</span></div>
                <div className="flex gap-2"><span className="text-[#ef4444]">✗</span><span className="text-[#94a3b8]">Insurance costs escalating in Cobb County</span></div>
              </div>
              <div className="mt-2 px-2 py-1 bg-[#14b8a6]/10 border border-[#14b8a6]/30 text-[#14b8a6] text-[11px] text-center rounded">SELECTIVE BUY</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1e293b] mx-4"></div>

      {/* ======= SUBMARKET LEVEL ======= */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[#94a3b8] text-[11px] cursor-pointer hover:text-[#14b8a6]">← Back to MSA</span>
          <span className="text-[15px] font-bold">SUBMARKET: MIDTOWN ATLANTA</span>
          <span className="ml-auto px-2 py-0.5 bg-[#14b8a6]/20 text-[#14b8a6] text-[11px] rounded">JEDI 87</span>
          <span className="px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] text-[11px] rounded">Score: 91/100</span>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            {/* Historical Charts Row */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              <ChartCard title="Rent Growth" value="+5.2%" trend="up" data={[3.1, 3.8, 4.2, 4.5, 4.8, 5.0, 5.2]} color="#22c55e" />
              <ChartCard title="Occupancy" value="96.1%" trend="up" data={[94.2, 94.8, 95.1, 95.4, 95.7, 95.9, 96.1]} color="#22c55e" />
              <ChartCard title="Traffic Growth" value="+8.4%" trend="up" data={[4.2, 5.1, 5.8, 6.5, 7.2, 7.8, 8.4]} color="#14b8a6" />
              <ChartCard title="Absorption" value="94%" trend="up" data={[84, 86, 88, 90, 91, 93, 94]} color="#14b8a6" />
            </div>

            {/* Submarket Metrics Table */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden mb-3">
              <div className="bg-[#0f1729] px-3 py-1.5 border-b border-[#1e293b]">
                <span className="text-[11px] uppercase text-[#94a3b8] tracking-wider">Submarket Strategy Metrics</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase text-[#94a3b8] border-b border-[#1e293b]">
                    <th className="text-left px-3 py-1.5 font-normal">Signal</th>
                    <th className="text-left px-3 py-1.5 font-normal">Metric</th>
                    <th className="text-right px-3 py-1.5 font-normal">Value</th>
                    <th className="text-right px-3 py-1.5 font-normal">Δ YoY</th>
                    <th className="text-right px-3 py-1.5 font-normal">Weight</th>
                    <th className="text-right px-3 py-1.5 font-normal">Pts</th>
                    <th className="text-center px-3 py-1.5 font-normal">Gate</th>
                    <th className="text-right px-3 py-1.5 font-normal">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  <MetricRow sig="M-01" name="Submarket Rent" val="$1,820" chg="+5.2%" w="10%" pts="+10" gate="pass" spark={[1580,1620,1680,1720,1760,1820]} />
                  <MetricRow sig="S-03" name="Occupancy" val="96.1%" chg="+0.4%" w="8%" pts="+8" gate="pass" spark={[94.2,94.8,95.1,95.4,95.9,96.1]} />
                  <MetricRow sig="S-01" name="Pipeline Units" val="2,100" chg="+8%" w="6%" pts="+5" gate="pass" spark={[1200,1400,1600,1800,1950,2100]} />
                  <MetricRow sig="S-05" name="Absorption Rate" val="94%" chg="+3%" w="7%" pts="+7" gate="pass" spark={[84,86,88,90,93,94]} />
                  <MetricRow sig="T-01" name="Traffic Growth" val="+8.4%" chg="+1.8%" w="5%" pts="+5" gate="pass" spark={[4.2,5.1,5.8,6.5,7.8,8.4]} />
                  <MetricRow sig="P-02" name="Class A Mix" val="62%" chg="+2%" w="4%" pts="+4" gate="pass" spark={[55,56,58,59,61,62]} />
                  <MetricRow sig="D-12" name="Pop Growth" val="+2.1%" chg="+0.3%" w="8%" pts="+8" gate="pass" spark={[1.4,1.5,1.7,1.8,1.9,2.1]} />
                  <MetricRow sig="DC-01" name="Dev Capacity" val="0.28" chg="-0.04" w="3%" pts="+3" gate="pass" spark={[0.38,0.36,0.34,0.32,0.30,0.28]} last />
                </tbody>
              </table>
            </div>

            {/* Peer Comparison Table */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden">
              <div className="bg-[#0f1729] px-3 py-1.5 border-b border-[#1e293b]">
                <span className="text-[11px] uppercase text-[#94a3b8] tracking-wider">Peer Comparison</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase text-[#94a3b8] border-b border-[#1e293b]">
                    <th className="text-left px-3 py-1.5 font-normal">Submarket</th>
                    <th className="text-right px-3 py-1.5 font-normal">JEDI</th>
                    <th className="text-right px-3 py-1.5 font-normal">Rent</th>
                    <th className="text-right px-3 py-1.5 font-normal">Rent Δ</th>
                    <th className="text-right px-3 py-1.5 font-normal">Occ</th>
                    <th className="text-right px-3 py-1.5 font-normal">Units</th>
                    <th className="text-right px-3 py-1.5 font-normal">Traffic</th>
                    <th className="text-right px-3 py-1.5 font-normal">Score</th>
                    <th className="text-right px-3 py-1.5 font-normal">Cycle</th>
                  </tr>
                </thead>
                <tbody>
                  <PeerRow name="Midtown" jedi={87} rent="$1,820" rentD="+5.2%" occ="96.1%" units="12.4K" traffic={82} score={91} cycle="EXPANSION" highlight />
                  <PeerRow name="Buckhead" jedi={82} rent="$1,883" rentD="+4.1%" occ="95.3%" units="11.2K" traffic={71} score={85} cycle="EXPANSION" />
                  <PeerRow name="Sandy Springs" jedi={81} rent="$1,920" rentD="+3.4%" occ="94.8%" units="12.6K" traffic={68} score={79} cycle="EXPANSION" />
                  <PeerRow name="Decatur" jedi={78} rent="$1,650" rentD="+3.8%" occ="94.1%" units="8.8K" traffic={64} score={74} cycle="LATE EXP" />
                  <PeerRow name="Alpharetta" jedi={76} rent="$1,720" rentD="+4.4%" occ="93.6%" units="9.2K" traffic={59} score={72} cycle="EXPANSION" last />
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Commentary */}
          <div className="w-[300px] flex-shrink-0 border-l-2 border-[#14b8a6]/40 pl-4 space-y-3">
            <div>
              <div className="text-[10px] uppercase text-[#14b8a6] tracking-wider mb-1 border-b border-[#14b8a6]/30 pb-1">Submarket Narrative</div>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                Midtown ranks as the top-performing submarket in the Atlanta MSA with a 91 strategy score. Class B repositioning offers a 340bps spread to Class A rents, making it the primary opportunity within the Core Plus Value-Add strategy.
              </p>
            </div>
            <div className="px-2 py-1.5 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded">
              <div className="text-[10px] text-[#22c55e] uppercase mb-0.5">Top Opportunity</div>
              <div className="text-[11px] text-[#e2e8f0]">Class B repositioning — 340bps spread to Class A</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1e293b] mx-4"></div>

      {/* ======= PROPERTY LEVEL ======= */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[#94a3b8] text-[11px] cursor-pointer hover:text-[#14b8a6]">← Back to Submarket</span>
          <span className="text-[15px] font-bold">PROPERTY: MIDTOWN PLACE APARTMENTS</span>
          <span className="text-[11px] text-[#94a3b8]">245 Units | Built 2018 | Class A</span>
          <span className="ml-auto px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] text-[11px] rounded">Score: 86/100</span>
          <span className="px-2 py-0.5 bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-[11px] rounded">ACQUIRE</span>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            {/* Property Charts */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              <ChartCard title="Rent/Unit" value="$1,920" trend="up" data={[1620,1680,1740,1800,1860,1900,1920]} color="#22c55e" />
              <ChartCard title="Occupancy" value="97.2%" trend="up" data={[94.1,94.8,95.4,96.0,96.5,96.9,97.2]} color="#22c55e" />
              <ChartCard title="NOI" value="$4.2M" trend="up" data={[3.2,3.4,3.6,3.8,3.9,4.1,4.2]} color="#14b8a6" />
              <ChartCard title="Cap Rate" value="4.8%" trend="down" data={[5.6,5.4,5.2,5.1,5.0,4.9,4.8]} color="#14b8a6" />
            </div>

            {/* Property Gate Results Table */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden mb-3">
              <div className="bg-[#0f1729] px-3 py-1.5 border-b border-[#1e293b] flex justify-between">
                <span className="text-[11px] uppercase text-[#94a3b8] tracking-wider">Strategy Gate Results</span>
                <span className="text-[10px] text-[#94a3b8]">12/14 Passed | 2 Soft Fails (-8pts)</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase text-[#94a3b8] border-b border-[#1e293b]">
                    <th className="text-center px-3 py-1.5 font-normal w-8">Status</th>
                    <th className="text-left px-3 py-1.5 font-normal">Gate</th>
                    <th className="text-left px-3 py-1.5 font-normal">Requirement</th>
                    <th className="text-right px-3 py-1.5 font-normal">Actual</th>
                    <th className="text-right px-3 py-1.5 font-normal">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  <GateRow status="pass" gate="Unit Count" req="≥ 100" actual="245" impact="—" />
                  <GateRow status="pass" gate="Year Built" req="≥ 2010" actual="2018" impact="—" />
                  <GateRow status="pass" gate="Occupancy" req="≥ 93%" actual="97.2%" impact="—" />
                  <GateRow status="pass" gate="Rent Growth" req="≥ 3%" actual="+5.8%" impact="—" />
                  <GateRow status="pass" gate="Cap Rate" req="≤ 6.0%" actual="4.8%" impact="—" />
                  <GateRow status="pass" gate="NOI Growth" req="≥ 2%" actual="+3.8%" impact="—" />
                  <GateRow status="pass" gate="Class" req="A or B" actual="A" impact="—" />
                  <GateRow status="pass" gate="Absorption" req="≥ 85%" actual="94%" impact="—" />
                  <GateRow status="pass" gate="Pipeline Ratio" req="≤ 15%" actual="8.2%" impact="—" />
                  <GateRow status="pass" gate="Employment" req="≥ 1.5%" actual="+2.4%" impact="—" />
                  <GateRow status="soft-fail" gate="Traffic Score" req="≥ 70" actual="68" impact="-5pts" />
                  <GateRow status="soft-fail" gate="Walk Score" req="≥ 65" actual="62" impact="-3pts" last />
                </tbody>
              </table>
            </div>

            {/* Signal Contribution Breakdown */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden">
              <div className="bg-[#0f1729] px-3 py-1.5 border-b border-[#1e293b]">
                <span className="text-[11px] uppercase text-[#94a3b8] tracking-wider">Signal Contribution Breakdown</span>
              </div>
              <div className="p-3 grid grid-cols-5 gap-2">
                <SignalBar label="Demand" pts={24} max={30} color="#14b8a6" />
                <SignalBar label="Supply" pts={16} max={25} color="#22c55e" />
                <SignalBar label="Momentum" pts={18} max={20} color="#14b8a6" />
                <SignalBar label="Position" pts={20} max={15} color="#f59e0b" />
                <SignalBar label="Risk" pts={8} max={10} color="#94a3b8" />
              </div>
              <div className="px-3 pb-2 text-center text-[11px] text-[#94a3b8]">
                Total: <span className="text-[#14b8a6] font-bold">86/100</span> after gate penalties (-8pts)
              </div>
            </div>
          </div>

          {/* RIGHT: Property Commentary */}
          <div className="w-[300px] flex-shrink-0 border-l-2 border-[#14b8a6]/40 pl-4 space-y-3">
            <div>
              <div className="text-[10px] uppercase text-[#14b8a6] tracking-wider mb-1 border-b border-[#14b8a6]/30 pb-1">Property Analysis</div>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                Strong acquisition candidate within Midtown submarket. Above-market occupancy (97.2%) and rent growth (+5.8%) with a 2018 vintage align well with Core Plus Value-Add strategy. Minor traffic score softness (-5pt penalty) offset by strong demand fundamentals.
              </p>
            </div>
            <div className="px-2 py-1.5 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded text-center">
              <div className="text-[10px] text-[#22c55e] uppercase">Recommended Action</div>
              <div className="text-[14px] font-bold text-[#22c55e]">ACQUIRE</div>
            </div>
            <div className="text-[10px] text-[#94a3b8]">
              <div className="flex justify-between py-0.5"><span>Est. IRR</span><span className="text-[#22c55e]">14.2%</span></div>
              <div className="flex justify-between py-0.5"><span>Cash-on-Cash</span><span className="text-[#22c55e]">8.4%</span></div>
              <div className="flex justify-between py-0.5"><span>DSCR</span><span className="text-[#e2e8f0]">1.32x</span></div>
              <div className="flex justify-between py-0.5"><span>Entry Basis</span><span className="text-[#e2e8f0]">$185K/unit</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-[#111827] border-t border-[#1e293b] px-4 py-2 flex justify-between text-[10px] text-[#94a3b8]">
        <span>Strategy: <span className="text-[#14b8a6]">Core Plus Value-Add</span> | Weighted: D:30% S:25% M:20% P:15% R:10% | Gates: 14 defined</span>
        <span>Last Refreshed: 2 hrs ago</span>
      </div>
    </div>
  );
}

function ChartCard({ title, value, trend, data, color }: { title: string; value: string; trend: string; data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 32;
  const w = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded p-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] uppercase text-[#94a3b8]">{title}</span>
        <span className="text-[12px] font-bold" style={{ color }}>{value}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
        <polyline fill={`${color}15`} stroke="none" points={`0,${h} ${points} ${w},${h}`} />
      </svg>
    </div>
  );
}

function MetricRow({ sig, name, val, chg, w, pts, gate, spark, neg, live, last }: any) {
  const isNeg = neg || chg?.startsWith('-');
  const min = Math.min(...(spark || []));
  const max = Math.max(...(spark || []));
  const range = max - min || 1;
  const sparkH = 14;
  const sparkW = 50;
  const points = (spark || []).map((v: number, i: number) => `${(i / ((spark || []).length - 1)) * sparkW},${sparkH - ((v - min) / range) * sparkH}`).join(' ');
  const sparkColor = isNeg ? '#f59e0b' : '#14b8a6';

  return (
    <tr className={`border-b ${last ? 'border-transparent' : 'border-[#1e293b]/50'} hover:bg-[#1a2332]`}>
      <td className="px-3 py-1.5">
        <span className="px-1 py-0.5 bg-[#0f1729] border border-[#1e293b] text-[9px] text-[#94a3b8] rounded-sm">{sig}</span>
      </td>
      <td className="px-3 py-1.5 text-[#e2e8f0]">
        {name}
        {live && <span className="ml-1.5 px-1 py-0 bg-[#22c55e]/20 text-[#22c55e] text-[8px] rounded">LIVE</span>}
      </td>
      <td className="px-3 py-1.5 text-right font-bold text-[#e2e8f0]">{val}</td>
      <td className={`px-3 py-1.5 text-right ${isNeg ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
        {chg}
      </td>
      <td className="px-3 py-1.5 text-right text-[#94a3b8]">{w}</td>
      <td className={`px-3 py-1.5 text-right font-bold ${pts?.startsWith('-') ? 'text-[#ef4444]' : 'text-[#14b8a6]'}`}>{pts}</td>
      <td className="px-3 py-1.5 text-center">
        {gate === 'pass' && <span className="text-[#22c55e] text-[11px]">✓</span>}
        {gate === 'soft-fail' && <span className="text-[#f59e0b] text-[11px]">⚠</span>}
        {gate === 'fail' && <span className="text-[#ef4444] text-[11px]">✗</span>}
      </td>
      <td className="px-3 py-1.5 text-right">
        <svg viewBox={`0 0 ${sparkW} ${sparkH}`} className="w-12 h-3.5 inline-block" preserveAspectRatio="none">
          <polyline fill="none" stroke={sparkColor} strokeWidth="1.2" points={points} />
        </svg>
      </td>
    </tr>
  );
}

function PeerRow({ name, jedi, rent, rentD, occ, units, traffic, score, cycle, highlight, last }: any) {
  const cycleColor = cycle === 'EXPANSION' ? 'text-[#22c55e] bg-[#22c55e]/10' : cycle === 'PEAK' ? 'text-[#f59e0b] bg-[#f59e0b]/10' : 'text-[#f59e0b] bg-[#f59e0b]/10';

  return (
    <tr className={`border-b ${last ? 'border-transparent' : 'border-[#1e293b]/50'} ${highlight ? 'bg-[#14b8a6]/5' : ''} hover:bg-[#1a2332]`}>
      <td className={`px-3 py-1.5 ${highlight ? 'text-[#14b8a6] font-bold' : 'text-[#e2e8f0]'}`}>{name}</td>
      <td className="px-3 py-1.5 text-right text-[#f59e0b] font-bold">{jedi}</td>
      <td className="px-3 py-1.5 text-right text-[#e2e8f0]">{rent}</td>
      <td className="px-3 py-1.5 text-right text-[#22c55e]">{rentD}</td>
      <td className="px-3 py-1.5 text-right text-[#e2e8f0]">{occ}</td>
      <td className="px-3 py-1.5 text-right text-[#e2e8f0]">{units}</td>
      <td className="px-3 py-1.5 text-right text-[#14b8a6]">{traffic}</td>
      <td className="px-3 py-1.5 text-right text-[#14b8a6] font-bold">{score}</td>
      <td className="px-3 py-1.5 text-right"><span className={`px-1.5 py-0.5 text-[9px] uppercase rounded ${cycleColor}`}>{cycle}</span></td>
    </tr>
  );
}

function GateRow({ status, gate, req, actual, impact, last }: any) {
  return (
    <tr className={`border-b ${last ? 'border-transparent' : 'border-[#1e293b]/50'} hover:bg-[#1a2332]`}>
      <td className="px-3 py-1.5 text-center">
        {status === 'pass' && <span className="text-[#22c55e]">✓</span>}
        {status === 'soft-fail' && <span className="text-[#f59e0b]">⚠</span>}
        {status === 'fail' && <span className="text-[#ef4444]">✗</span>}
      </td>
      <td className="px-3 py-1.5 text-[#e2e8f0]">{gate}</td>
      <td className="px-3 py-1.5 text-[#94a3b8]">{req}</td>
      <td className={`px-3 py-1.5 text-right font-bold ${status === 'pass' ? 'text-[#22c55e]' : status === 'soft-fail' ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>{actual}</td>
      <td className={`px-3 py-1.5 text-right ${impact === '—' ? 'text-[#94a3b8]' : 'text-[#ef4444]'}`}>{impact}</td>
    </tr>
  );
}

function SignalBar({ label, pts, max, color }: { label: string; pts: number; max: number; color: string }) {
  const pct = Math.min((pts / 30) * 100, 100);
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase text-[#94a3b8] mb-1">{label}</div>
      <div className="h-16 bg-[#0a0e17] rounded relative flex items-end justify-center overflow-hidden">
        <div className="w-full rounded-t" style={{ height: `${pct}%`, backgroundColor: `${color}40`, borderTop: `2px solid ${color}` }}></div>
      </div>
      <div className="text-[12px] font-bold mt-1" style={{ color }}>+{pts}</div>
      <div className="text-[9px] text-[#94a3b8]">/{max}</div>
    </div>
  );
}
