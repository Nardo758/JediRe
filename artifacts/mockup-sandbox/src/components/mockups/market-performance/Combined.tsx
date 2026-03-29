import { useState } from "react";

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF",blue:"#4A9EFF",teal:"#14B8A6" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

const PROPERTY = {
  market: "Tampa MSA", submarket: "Westshore",
  currentOccupancy: 93.5, avgEffectiveRent: 1_842,
  walkScore: 62, transitScore: 44, bikeScore: 51,
  marketHistory: [
    { year: 2021, vacancy: 5.2, rentGrowth: 12.8, avgRent: 1_580, absorption: 14_200, newSupply: 820, pipelinePct: 2.9, popGrowth: 2.8, hhIncome: 68_400, empGrowth: 5.1, walkScore: 58, transitScore: 40, bikeScore: 48, demandScore: 92 },
    { year: 2022, vacancy: 6.8, rentGrowth: 10.3, avgRent: 1_742, absorption: 12_800, newSupply: 1_180, pipelinePct: 4.0, popGrowth: 2.4, hhIncome: 71_200, empGrowth: 4.2, walkScore: 59, transitScore: 41, bikeScore: 49, demandScore: 90 },
    { year: 2023, vacancy: 8.1, rentGrowth: 3.2, avgRent: 1_798, absorption: 10_400, newSupply: 1_640, pipelinePct: 5.4, popGrowth: 2.2, hhIncome: 73_800, empGrowth: 3.6, walkScore: 60, transitScore: 42, bikeScore: 50, demandScore: 88 },
    { year: 2024, vacancy: 8.8, rentGrowth: 1.3, avgRent: 1_822, absorption: 9_800, newSupply: 1_920, pipelinePct: 6.0, popGrowth: 2.0, hhIncome: 75_900, empGrowth: 3.0, walkScore: 61, transitScore: 43, bikeScore: 50, demandScore: 86 },
    { year: 2025, vacancy: 8.5, rentGrowth: 1.1, avgRent: 1_842, absorption: 11_658, newSupply: 1_240, pipelinePct: 4.2, popGrowth: 2.1, hhIncome: 78_200, empGrowth: 3.2, walkScore: 62, transitScore: 44, bikeScore: 51, demandScore: 88 },
  ],
  marketForecast: [
    { year: 2026, vacancy: 8.0, rentGrowth: 2.8, avgRent: 1_894, absorption: 12_400, newSupply: 1_380, pipelinePct: 3.9, popGrowth: 2.0, hhIncome: 80_200, empGrowth: 3.0, walkScore: 63, transitScore: 45, bikeScore: 52, demandScore: 89, conf: 0.88 },
    { year: 2027, vacancy: 7.4, rentGrowth: 3.2, avgRent: 1_954, absorption: 13_200, newSupply: 860, pipelinePct: 2.4, popGrowth: 1.9, hhIncome: 82_400, empGrowth: 2.8, walkScore: 64, transitScore: 47, bikeScore: 53, demandScore: 90, conf: 0.80 },
    { year: 2028, vacancy: 6.8, rentGrowth: 3.5, avgRent: 2_022, absorption: 14_000, newSupply: 620, pipelinePct: 1.7, popGrowth: 1.8, hhIncome: 84_600, empGrowth: 2.6, walkScore: 65, transitScore: 48, bikeScore: 54, demandScore: 91, conf: 0.72 },
    { year: 2029, vacancy: 6.5, rentGrowth: 3.0, avgRent: 2_083, absorption: 13_600, newSupply: 940, pipelinePct: 2.5, popGrowth: 1.7, hhIncome: 86_800, empGrowth: 2.4, walkScore: 66, transitScore: 49, bikeScore: 55, demandScore: 90, conf: 0.63 },
    { year: 2030, vacancy: 7.0, rentGrowth: 2.4, avgRent: 2_133, absorption: 12_800, newSupply: 1_100, pipelinePct: 2.8, popGrowth: 1.6, hhIncome: 89_000, empGrowth: 2.2, walkScore: 67, transitScore: 50, bikeScore: 56, demandScore: 89, conf: 0.55 },
  ],
};

const PERF_HISTORY = [
  { year: 2018, rent: 1_420, occ: 94.8, concessions: 0.5, rentGrowth: 3.2, noi: 1_980_000, expRatio: 46.1 },
  { year: 2019, rent: 1_488, occ: 95.2, concessions: 0.0, rentGrowth: 4.8, noi: 2_140_000, expRatio: 45.8 },
  { year: 2020, rent: 1_465, occ: 88.6, concessions: 6.2, rentGrowth: -1.5, noi: 1_740_000, expRatio: 51.3 },
  { year: 2021, rent: 1_580, occ: 91.4, concessions: 3.8, rentGrowth: 7.8, noi: 2_020_000, expRatio: 48.9 },
  { year: 2022, rent: 1_742, occ: 93.8, concessions: 1.2, rentGrowth: 10.3, noi: 2_480_000, expRatio: 47.2 },
  { year: 2023, rent: 1_798, occ: 94.1, concessions: 0.8, rentGrowth: 3.2, noi: 2_590_000, expRatio: 47.6 },
  { year: 2024, rent: 1_822, occ: 93.0, concessions: 2.4, rentGrowth: 1.3, noi: 2_620_000, expRatio: 48.0 },
  { year: 2025, rent: 1_842, occ: 93.5, concessions: 2.8, rentGrowth: 1.1, noi: 2_680_000, expRatio: 48.2 },
];

const TRAFFIC_AADT = [
  { year: 2018, aadt: 21_200 }, { year: 2019, aadt: 21_800 }, { year: 2020, aadt: 18_400 },
  { year: 2021, aadt: 20_900 }, { year: 2022, aadt: 22_600 }, { year: 2023, aadt: 23_400 },
  { year: 2024, aadt: 24_100 }, { year: 2025, aadt: 24_500 },
];
const TRAFFIC_PROJECTED = [
  { year: 2026, aadt: 25_200, conf: 0.88 }, { year: 2027, aadt: 26_100, conf: 0.82 },
  { year: 2028, aadt: 27_000, conf: 0.75 }, { year: 2029, aadt: 27_700, conf: 0.68 },
  { year: 2030, aadt: 28_300, conf: 0.62 }, { year: 2031, aadt: 28_800, conf: 0.55 },
  { year: 2032, aadt: 29_200, conf: 0.49 }, { year: 2033, aadt: 29_500, conf: 0.43 },
  { year: 2034, aadt: 29_700, conf: 0.38 }, { year: 2035, aadt: 29_900, conf: 0.34 },
];

function generateForecast() {
  const lastPerf = PERF_HISTORY[PERF_HISTORY.length - 1];
  const forecasts: any[] = [];
  let rent = lastPerf.rent, occ = lastPerf.occ, concessions = lastPerf.concessions, noi = lastPerf.noi, expRatio = lastPerf.expRatio;
  for (let i = 0; i < 10; i++) {
    const conf = TRAFFIC_PROJECTED[i]?.conf || 0.30;
    const trafficGrowth = TRAFFIC_PROJECTED[i] ? (TRAFFIC_PROJECTED[i].aadt - (TRAFFIC_PROJECTED[i-1]?.aadt || 24_500)) / (TRAFFIC_PROJECTED[i-1]?.aadt || 24_500) : 0.02;
    const trafficRentBoost = Math.max(0, 0.008 * (1 - i * 0.08));
    const occDelta = trafficGrowth > 0.02 ? 0.3 : trafficGrowth > 0 ? 0.1 : -0.2;
    occ = Math.min(96.5, Math.max(88, occ + occDelta - (i > 5 ? 0.15 : 0)));
    const projectedHHI = 78_200 * Math.pow(1.025, i);
    const rentToIncome = (rent * 12) / projectedHHI;
    const affordabilityCap = rentToIncome > 0.32 ? -0.015 : rentToIncome > 0.30 ? -0.008 : 0;
    let rentGrowthRate = Math.min(0.042, 0.030 + trafficRentBoost + (-0.002) + affordabilityCap);
    if (i > 4) rentGrowthRate *= (1 - (i - 4) * 0.04);
    rentGrowthRate = Math.max(0.008, rentGrowthRate);
    rent = Math.round(rent * (1 + rentGrowthRate));
    concessions = occ > 94 ? 0.5 : occ > 92 ? 1.8 : occ > 90 ? 3.5 : 5.0;
    if (i > 6) concessions += 0.8;
    expRatio = Math.min(52, expRatio + 0.15 + (i > 5 ? 0.1 : 0));
    const egi = rent * 12 * 248 * (occ / 100) * (1 - concessions / 100);
    noi = Math.round(egi * (1 - expRatio / 100));
    forecasts.push({ year: 2026 + i, rent, occ: parseFloat(occ.toFixed(1)), concessions: parseFloat(concessions.toFixed(1)), rentGrowth: parseFloat((rentGrowthRate * 100).toFixed(1)), noi, expRatio: parseFloat(expRatio.toFixed(1)), confidence: conf });
  }
  return forecasts;
}

const fmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}K` : `$${n}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

const Badge = ({ children, color = T.text.amber }: { children: React.ReactNode; color?: string }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "1px 6px",
    fontSize: 8, fontFamily: T.font.mono, fontWeight: 700, letterSpacing: "0.05em",
    color, background: `${color}15`, border: `1px solid ${color}40`,
    borderRadius: 2, lineHeight: "14px", whiteSpace: "nowrap",
  }}>{children}</span>
);

const SectionHeader = ({ title, subtitle, icon, borderColor = T.text.amber, action }: any) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "6px 10px", background: T.bg.header,
    borderBottom: `1px solid ${T.border.subtle}`, borderLeft: `2px solid ${borderColor}`,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span style={{ fontSize: 10, color: borderColor }}>{icon}</span>}
      <span style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.white, letterSpacing: "0.05em" }}>{title}</span>
      {subtitle && <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{subtitle}</span>}
    </div>
    {action && action}
  </div>
);

const PatternBadge = ({ pattern }: { pattern: string }) => {
  const cfg: Record<string, { color: string; icon: string }> = {
    DEMAND_SURGE: { color: T.text.green, icon: "▲" },
    STABLE: { color: T.text.cyan, icon: "═" },
    DECLINING: { color: T.text.red, icon: "▼" },
  };
  const c = cfg[pattern] || cfg.STABLE;
  return <Badge color={c.color}>{c.icon} {pattern.replace("_", " ")}</Badge>;
};

export function Combined() {
  const p = PROPERTY;
  const perf = PERF_HISTORY;
  const forecast = generateForecast();
  const td = { aadtHistory: TRAFFIC_AADT, aadtProjected: TRAFFIC_PROJECTED, outputs: { t07_pattern: "DEMAND_SURGE" } };

  const SERIES_CONFIG = [
    { key: "traffic", label: "TRAFFIC (AADT)", color: T.text.blue, cor: "ANCHOR", thick: true, group: "perf" },
    { key: "rent", label: "EFF. RENT", color: T.text.green, cor: "COR-01 r=0.65", group: "perf" },
    { key: "occ", label: "OCCUPANCY", color: T.text.cyan, cor: "COR-05 r=-0.60", group: "perf" },
    { key: "noi", label: "NOI", color: T.text.amber, cor: "COR-01 × COR-05", group: "perf" },
    { key: "concessions", label: "CONCESSIONS", color: T.text.red, cor: "inverse occ", group: "perf" },
    { key: "rentGrowthCum", label: "CUM. RENT GROWTH", color: T.text.purple, cor: "COR-04 capped", group: "perf" },
    { key: "vacancy", label: "VACANCY RATE", color: "#FF6B6B", cor: "submarket", group: "mkt" },
    { key: "mktRentGrowth", label: "MKT RENT GRWTH", color: "#66D9A0", cor: "submarket", group: "mkt" },
    { key: "empGrowth", label: "EMPLOYMENT", color: T.text.teal, cor: "BLS", group: "mkt" },
    { key: "demandScore", label: "DEMAND SCORE", color: "#7DD3FC", cor: "composite", group: "mkt" },
  ] as const;

  type SeriesKey = typeof SERIES_CONFIG[number]["key"];
  const [activeSeries, setActiveSeries] = useState<Record<string, boolean>>({
    traffic: true, rent: true, occ: true, noi: true, concessions: true, rentGrowthCum: true,
    vacancy: false, mktRentGrowth: false, empGrowth: false, demandScore: false,
  });
  const toggleSeries = (key: string) => setActiveSeries(prev => ({ ...prev, [key]: !prev[key] }));

  const trafficAll = [...td.aadtHistory, ...td.aadtProjected.map(p => ({ year: p.year, aadt: p.aadt }))];
  const perfAll = [...perf, ...forecast];
  const baseTraffic = trafficAll[0].aadt;
  const baseRent = perfAll[0].rent;
  const baseOcc = perfAll[0].occ;
  const baseNoi = perfAll[0].noi;
  const baseConc = Math.max(perfAll[0].concessions, 0.1);

  const mktAll = [...p.marketHistory, ...p.marketForecast];
  const mktByYear: Record<number, any> = {};
  mktAll.forEach(d => { mktByYear[d.year] = d; });
  const baseVacancy = mktAll[0].vacancy;
  const baseMktRentGrowth = Math.max(mktAll[0].rentGrowth, 0.1);
  const baseEmpGrowth = mktAll[0].empGrowth;
  const baseDemandScore = mktAll[0].demandScore;
  const mktForecastIdx = p.marketHistory.length;

  const indexedData = trafficAll.map((t, i) => {
    const pf = perfAll[i];
    if (!pf) return null;
    const cumRentGrowth = ((pf.rent / baseRent) - 1) * 100;
    const mkt = mktByYear[t.year];
    return {
      year: t.year,
      traffic: (t.aadt / baseTraffic) * 100,
      rent: (pf.rent / baseRent) * 100,
      occ: (pf.occ / baseOcc) * 100,
      noi: (pf.noi / baseNoi) * 100,
      concessions: (pf.concessions / baseConc) * 100,
      rentGrowthCum: 100 + cumRentGrowth,
      vacancy: mkt ? (mkt.vacancy / baseVacancy) * 100 : null,
      mktRentGrowth: mkt ? (mkt.rentGrowth / baseMktRentGrowth) * 100 : null,
      empGrowth: mkt ? (mkt.empGrowth / baseEmpGrowth) * 100 : null,
      demandScore: mkt ? (mkt.demandScore / baseDemandScore) * 100 : null,
      confidence: td.aadtProjected.find(p => p.year === t.year)?.conf,
      isForecast: t.year > 2025,
      rawTraffic: t.aadt, rawRent: pf.rent, rawOcc: pf.occ, rawNoi: pf.noi,
      rawConc: pf.concessions, rawRentGrowth: pf.rentGrowth, rawExpRatio: pf.expRatio,
      rawVacancy: mkt?.vacancy, rawMktRentGrowth: mkt?.rentGrowth, rawEmpGrowth: mkt?.empGrowth,
      rawDemandScore: mkt?.demandScore, rawAbsorption: mkt?.absorption, rawNewSupply: mkt?.newSupply,
      rawPipelinePct: mkt?.pipelinePct, rawPopGrowth: mkt?.popGrowth, rawHhIncome: mkt?.hhIncome,
      rawAvgRent: mkt?.avgRent,
    };
  }).filter(Boolean) as any[];

  const forecastIdx = indexedData.findIndex((d: any) => d.isForecast);
  const activeSerisList = SERIES_CONFIG.filter(s => activeSeries[s.key]);
  const fullW = 1340;

  const IndexedChart = () => {
    const pad = { top: 16, right: 16, bottom: 32, left: 52 };
    const w = fullW - pad.left - pad.right;
    const h = 380 - pad.top - pad.bottom;
    const activeWithData = activeSerisList.filter(s =>
      indexedData.some((d: any) => d[s.key] != null)
    );
    const allVals = activeWithData.flatMap(s => indexedData.map((d: any) => d[s.key]).filter((v: any) => v != null));
    if (allVals.length === 0) return <svg width="100%" height="100%" />;
    const yMin = Math.min(...allVals, 100) - 3;
    const yMax = Math.max(...allVals, 100) + 3;
    const yRange = yMax - yMin || 1;
    const xPos = (i: number) => pad.left + (i / (indexedData.length - 1)) * w;
    const yPos = (v: number) => pad.top + h - ((v - yMin) / yRange) * h;
    const gridCount = 7;
    const yTicks = Array.from({ length: gridCount }, (_, i) => yMin + yRange * (i / (gridCount - 1)));

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${fullW} 380`} style={{ overflow: "visible" }}>
        {yTicks.map((tick, i) => (
          <g key={`g${i}`}>
            <line x1={pad.left} y1={yPos(tick)} x2={pad.left + w} y2={yPos(tick)}
              stroke={tick === 100 ? T.text.muted : T.border.subtle}
              strokeWidth={tick === 100 ? 0.8 : 0.4}
              strokeDasharray={tick === 100 ? "none" : "2,4"}
              opacity={tick === 100 ? 0.5 : 1} />
            <text x={pad.left - 5} y={yPos(tick) + 3} fill={tick === 100 ? T.text.secondary : T.text.muted}
              fontSize={7} fontFamily={T.font.mono} textAnchor="end" fontWeight={tick === 100 ? 600 : 400}>
              {tick.toFixed(0)}
            </text>
          </g>
        ))}
        <text x={pad.left - 5} y={yPos(100) - 6} fill={T.text.secondary} fontSize={6} fontFamily={T.font.mono} textAnchor="end" opacity={0.7}>BASE</text>
        {forecastIdx >= 0 && (
          <>
            <rect x={xPos(forecastIdx)} y={pad.top} width={w - (xPos(forecastIdx) - pad.left)} height={h} fill={T.text.cyan} opacity={0.025} />
            <line x1={xPos(forecastIdx)} y1={pad.top} x2={xPos(forecastIdx)} y2={pad.top + h} stroke={T.text.cyan} strokeWidth={1} strokeDasharray="4,3" opacity={0.35} />
            <text x={xPos(forecastIdx) + 5} y={pad.top + 10} fill={T.text.cyan} fontSize={7} fontFamily={T.font.mono} opacity={0.5}>FORECAST →</text>
            <text x={xPos(forecastIdx) - 5} y={pad.top + 10} fill={T.text.green} fontSize={7} fontFamily={T.font.mono} opacity={0.5} textAnchor="end">← ACTUAL</text>
          </>
        )}
        {activeWithData.map((s) => {
          const pts = indexedData
            .map((d: any, i: number) => d[s.key] != null ? { x: xPos(i), y: yPos(d[s.key]), i, val: d[s.key] } : null)
            .filter(Boolean) as any[];
          if (pts.length < 2) return null;
          const pathD = pts.map((pt: any, i: number) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
          const fcPts = pts.filter((pt: any) => pt.i >= forecastIdx && forecastIdx >= 0);
          let bandPath: string | null = null;
          if (fcPts.length >= 2 && s.key !== "concessions") {
            const spread = s.thick ? 0.04 : 0.05;
            const upper = fcPts.map((pt: any) => ({ x: pt.x, y: yPos(pt.val * (1 + (1 - (indexedData[pt.i]?.confidence || 0.5)) * spread)) }));
            const lower = fcPts.map((pt: any) => ({ x: pt.x, y: yPos(pt.val * (1 - (1 - (indexedData[pt.i]?.confidence || 0.5)) * spread)) }));
            bandPath = `M${upper.map((pt: any) => `${pt.x},${pt.y}`).join(' L')} L${[...lower].reverse().map((pt: any) => `${pt.x},${pt.y}`).join(' L')} Z`;
          }
          const isMkt = s.group === "mkt";
          return (
            <g key={s.key}>
              {bandPath && <path d={bandPath} fill={s.color} opacity={0.06} />}
              <path d={pathD} fill="none" stroke={s.color}
                strokeWidth={s.thick ? 2.5 : 1.5}
                strokeDasharray={isMkt ? "6,3" : "none"}
                opacity={isMkt ? 0.7 : 0.85} />
              {pts.filter((_: any, i: number) => i < forecastIdx || forecastIdx < 0).map((pt: any, i: number) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={isMkt ? 1.5 : 2} fill={s.color} opacity={0.7} />
              ))}
              {pts.length > 0 && (
                <text x={pts[pts.length - 1].x + 4} y={pts[pts.length - 1].y + 3} fill={s.color} fontSize={7} fontFamily={T.font.mono} fontWeight={600}>
                  {pts[pts.length - 1].val.toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
        {indexedData.map((d: any, i: number) => (
          <text key={i} x={xPos(i)} y={pad.top + h + 16} fill={d.isForecast ? T.text.cyan : T.text.muted}
            fontSize={7} fontFamily={T.font.mono} textAnchor="middle" fontWeight={d.year === 2025 ? 700 : 400}>
            {d.year}
          </text>
        ))}
      </svg>
    );
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.bg.terminal, color: T.text.primary,
      fontFamily: T.font.mono, padding: 0,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap');
        *{scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17;box-sizing:border-box}
        *::-webkit-scrollbar{width:5px;height:5px}
        *::-webkit-scrollbar-track{background:#0A0E17}
        *::-webkit-scrollbar-thumb{background:#2A3348;border-radius:2px}
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
        {/* ━━━ TAB HEADER ━━━ */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
          <span style={{ fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.08em" }}>F6</span>
          <span style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: T.text.white, letterSpacing: "0.06em" }}>MARKET & PERFORMANCE</span>
          <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>Westshore Commons · Tampa MSA</span>
          <div style={{ flex: 1 }} />
          <PatternBadge pattern="DEMAND_SURGE" />
        </div>

        {/* ━━━ BADGES ━━━ */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
          <Badge color={T.text.green}>ACTUAL 2018–2025</Badge>
          <Badge color={T.text.cyan}>FORECAST 2026–2035</Badge>
          <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>
            Indexed to 100 @ base year · Correlation Engine · Property + Submarket metrics
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>Sources: CoStar · FRED · BLS · Census ACS · FDOT</span>
        </div>

        {/* ━━━ UNIFIED INDEXED CHART ━━━ */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PERFORMANCE + MARKET — INDEXED" subtitle="Base 100 · Click legend to toggle · Dashed = submarket" icon="◈" borderColor={T.text.amber}
            action={<span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>M07 Traffic Engine × Correlation Engine × Submarket Fundamentals</span>} />

          {/* Toggleable Legend — two rows: Property perf + Submarket */}
          <div style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.08em", width: 70 }}>PROPERTY</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {SERIES_CONFIG.filter(s => s.group === "perf").map(s => (
                  <div key={s.key} onClick={() => toggleSeries(s.key)} style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                    background: activeSeries[s.key] ? `${s.color}15` : T.bg.input,
                    border: `1px solid ${activeSeries[s.key] ? `${s.color}50` : T.border.subtle}`,
                    borderRadius: 2, cursor: "pointer", transition: "all 0.15s",
                    opacity: activeSeries[s.key] ? 1 : 0.4,
                  }}>
                    <div style={{ width: s.key === "traffic" ? 14 : 10, height: s.key === "traffic" ? 3 : 2, background: s.color, borderRadius: 1 }} />
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, fontWeight: 600, color: activeSeries[s.key] ? s.color : T.text.muted, letterSpacing: "0.03em" }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted }}>{s.cor}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.08em", width: 70 }}>SUBMARKET</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {SERIES_CONFIG.filter(s => s.group === "mkt").map(s => (
                  <div key={s.key} onClick={() => toggleSeries(s.key)} style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                    background: activeSeries[s.key] ? `${s.color}15` : T.bg.input,
                    border: `1px solid ${activeSeries[s.key] ? `${s.color}50` : T.border.subtle}`,
                    borderRadius: 2, cursor: "pointer", transition: "all 0.15s",
                    opacity: activeSeries[s.key] ? 1 : 0.4,
                  }}>
                    <div style={{ width: 10, height: 0, borderTop: `2px dashed ${s.color}`, borderRadius: 0 }} />
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, fontWeight: 600, color: activeSeries[s.key] ? s.color : T.text.muted, letterSpacing: "0.03em" }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted }}>{s.cor}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div style={{ height: 380, padding: "0 4px" }}>
            <IndexedChart />
          </div>

          {/* Current values strip */}
          <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${T.border.subtle}`, flexWrap: "wrap" }}>
            {SERIES_CONFIG.filter(s => activeSeries[s.key]).map((s, i, arr) => {
              const last = indexedData[indexedData.length - 1];
              const first = indexedData.find((d: any) => d[s.key] != null);
              if (!first || last[s.key] == null) return null;
              const delta = ((last[s.key] / first[s.key]) - 1) * 100;
              let rawNow = "";
              if (s.key === "traffic") rawNow = `${(last.rawTraffic/1000).toFixed(1)}k vpd`;
              else if (s.key === "rent") rawNow = `$${last.rawRent.toLocaleString()}`;
              else if (s.key === "occ") rawNow = `${last.rawOcc.toFixed(1)}%`;
              else if (s.key === "noi") rawNow = fmt(last.rawNoi);
              else if (s.key === "concessions") rawNow = `${last.rawConc.toFixed(1)}%`;
              else if (s.key === "rentGrowthCum") rawNow = `+${((last.rawRent / baseRent - 1) * 100).toFixed(0)}%`;
              else if (s.key === "vacancy") rawNow = last.rawVacancy != null ? `${last.rawVacancy.toFixed(1)}%` : "—";
              else if (s.key === "mktRentGrowth") rawNow = last.rawMktRentGrowth != null ? `${last.rawMktRentGrowth.toFixed(1)}%` : "—";
              else if (s.key === "empGrowth") rawNow = last.rawEmpGrowth != null ? `${last.rawEmpGrowth.toFixed(1)}%` : "—";
              else if (s.key === "demandScore") rawNow = last.rawDemandScore != null ? `${last.rawDemandScore}` : "—";
              return (
                <div key={s.key} style={{
                  flex: "1 1 0", minWidth: 100, padding: "5px 8px", textAlign: "center",
                  borderRight: i < arr.length - 1 ? `1px solid ${T.border.subtle}` : "none",
                  background: `${s.color}04`,
                }}>
                  <div style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.08em" }}>{s.label}</div>
                  <div style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: s.color }}>{rawNow}</div>
                  <div style={{ fontSize: 7, fontFamily: T.font.mono, color: delta >= 0 ? T.text.green : T.text.red }}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% from base
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ━━━ CORRELATION INSIGHT CARDS ━━━ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { title: "TRAFFIC → RENT", cor: "COR-01", r: "0.65", lead: "3-6mo", color: T.text.green,
              insight: `Traffic +${((indexedData[indexedData.length-1].traffic / 100 - 1) * 100).toFixed(0)}% from base drives rent +${((indexedData[indexedData.length-1].rent / 100 - 1) * 100).toFixed(0)}%. Surge Index pattern confirms demand acceleration.` },
            { title: "TRAFFIC → VACANCY", cor: "COR-05", r: "-0.60", lead: "2-4mo", color: T.text.cyan,
              insight: `Occupancy tracks traffic with 2-4mo lag. Current ${pct(p.currentOccupancy)} with rising traffic → forecast tightening to ${pct(forecast[2]?.occ || 94)}.` },
            { title: "WAGE → RENT CEILING", cor: "COR-04", r: "0.72", lead: "concurrent", color: T.text.amber,
              insight: `Rent-to-income at ~${((p.avgEffectiveRent * 12 / 78200) * 100).toFixed(0)}%. Wage growth 2.5%/yr caps sustainable rent growth at ~4.2%. Affordability wall at 30%.` },
          ].map((c, i) => (
            <div key={i} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderBottom: `1px solid ${T.border.subtle}`, borderLeft: `2px solid ${c.color}` }}>
                <span style={{ fontSize: 9, fontFamily: T.font.mono, fontWeight: 700, color: c.color, letterSpacing: "0.03em" }}>{c.title}</span>
                <div style={{ flex: 1 }} />
                <Badge color={c.color}>{c.cor} r={c.r}</Badge>
              </div>
              <div style={{ padding: "6px 8px" }}>
                <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.secondary, lineHeight: 1.5 }}>{c.insight}</div>
                <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, marginTop: 3 }}>Lead time: {c.lead}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ━━━ UNIFIED DATA TABLE ━━━ */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="COMBINED MARKET & PERFORMANCE TABLE" subtitle="Property + Submarket · All Years" icon="≡" borderColor={T.text.amber}
            action={<span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>COR-01 · COR-04 · COR-05 · COR-13 · CoStar · BLS</span>} />
          <div style={{ fontSize: 8, fontFamily: T.font.mono, overflowX: "auto" }}>
            {/* Column groups header */}
            <div style={{ display: "grid", gridTemplateColumns: "36px 290px 310px", borderBottom: `1px solid ${T.border.medium}`, minWidth: 680 }}>
              <div style={{ padding: "3px 6px" }} />
              <div style={{ padding: "3px 6px", textAlign: "center", borderLeft: `1px solid ${T.border.medium}`, borderRight: `1px solid ${T.border.medium}` }}>
                <span style={{ fontSize: 7, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.1em" }}>PROPERTY PERFORMANCE</span>
              </div>
              <div style={{ padding: "3px 6px", textAlign: "center" }}>
                <span style={{ fontSize: 7, fontFamily: T.font.mono, fontWeight: 700, color: T.text.cyan, letterSpacing: "0.1em" }}>SUBMARKET FUNDAMENTALS</span>
              </div>
            </div>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "36px 48px 50px 36px 40px 36px 52px 36px 38px 40px 48px 48px 38px 48px 38px", padding: "4px 6px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, minWidth: 680 }}>
              {["YEAR","TRAFFIC","RENT","OCC","GRWTH","CONC","NOI","CONF","VAC","M.GRWTH","SUPPLY","ABSRP","EMP%","INCOME","DMD"].map((h, hi) => (
                <span key={h} style={{
                  color: hi <= 7 ? T.text.muted : T.text.cyan,
                  fontWeight: 600, letterSpacing: "0.04em",
                  borderLeft: hi === 8 ? `1px solid ${T.border.medium}` : "none",
                  paddingLeft: hi === 8 ? 4 : 0,
                }}>{h}</span>
              ))}
            </div>
            {indexedData.map((d: any, i: number) => {
              const rToI = ((d.rawRent * 12) / (78_200 * Math.pow(1.025, Math.max(0, d.year - 2025))) * 100);
              const hasMkt = d.rawVacancy != null;
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "36px 48px 50px 36px 40px 36px 52px 36px 38px 40px 48px 48px 38px 48px 38px",
                  padding: "3px 6px", minWidth: 680,
                  borderBottom: `1px solid ${T.border.subtle}08`,
                  background: d.isForecast ? `${T.text.cyan}04` : (i % 2 === 0 ? T.bg.panel : T.bg.panelAlt),
                }}>
                  <span style={{ color: d.isForecast ? T.text.cyan : T.text.primary, fontWeight: 600 }}>{d.year}</span>
                  <span style={{ color: T.text.blue }}>{(d.rawTraffic/1000).toFixed(1)}k</span>
                  <span style={{ color: T.text.green, fontWeight: 600 }}>${d.rawRent.toLocaleString()}</span>
                  <span style={{ color: d.rawOcc >= 93 ? T.text.green : d.rawOcc >= 90 ? T.text.amber : T.text.red }}>{d.rawOcc.toFixed(1)}</span>
                  <span style={{ color: d.rawRentGrowth >= 3 ? T.text.green : d.rawRentGrowth >= 0 ? T.text.amber : T.text.red }}>
                    {d.rawRentGrowth >= 0 ? "+" : ""}{d.rawRentGrowth.toFixed(1)}
                  </span>
                  <span style={{ color: d.rawConc > 3 ? T.text.red : d.rawConc > 1 ? T.text.amber : T.text.green }}>
                    {d.rawConc.toFixed(1)}%
                  </span>
                  <span style={{ color: T.text.primary }}>{fmt(d.rawNoi)}</span>
                  <span style={{ color: d.isForecast ? ((d.confidence || 0) > 0.6 ? T.text.green : (d.confidence || 0) > 0.4 ? T.text.amber : T.text.red) : T.text.green }}>
                    {d.isForecast ? `${((d.confidence || 0) * 100).toFixed(0)}%` : "ACT"}
                  </span>
                  {/* Submarket columns */}
                  <span style={{ color: hasMkt ? (d.rawVacancy < 7 ? T.text.green : d.rawVacancy < 9 ? T.text.amber : T.text.red) : T.text.muted, borderLeft: `1px solid ${T.border.medium}`, paddingLeft: 4 }}>
                    {hasMkt ? pct(d.rawVacancy) : "—"}
                  </span>
                  <span style={{ color: hasMkt ? (d.rawMktRentGrowth >= 3 ? T.text.green : d.rawMktRentGrowth >= 0 ? T.text.amber : T.text.red) : T.text.muted }}>
                    {hasMkt ? `${d.rawMktRentGrowth >= 0 ? "+" : ""}${pct(d.rawMktRentGrowth)}` : "—"}
                  </span>
                  <span style={{ color: hasMkt ? (d.rawNewSupply > 1500 ? T.text.red : d.rawNewSupply > 1000 ? T.text.orange : T.text.green) : T.text.muted }}>
                    {hasMkt ? d.rawNewSupply.toLocaleString() : "—"}
                  </span>
                  <span style={{ color: hasMkt ? T.text.cyan : T.text.muted }}>
                    {hasMkt ? `${(d.rawAbsorption/1000).toFixed(1)}k` : "—"}
                  </span>
                  <span style={{ color: hasMkt ? (d.rawEmpGrowth >= 3 ? T.text.green : T.text.amber) : T.text.muted }}>
                    {hasMkt ? pct(d.rawEmpGrowth) : "—"}
                  </span>
                  <span style={{ color: hasMkt ? T.text.secondary : T.text.muted }}>
                    {hasMkt ? `$${(d.rawHhIncome/1000).toFixed(0)}K` : "—"}
                  </span>
                  <span style={{ color: hasMkt ? (d.rawDemandScore >= 88 ? T.text.green : d.rawDemandScore >= 80 ? T.text.amber : T.text.red) : T.text.muted }}>
                    {hasMkt ? d.rawDemandScore : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Combined footer narrative */}
          <div style={{ padding: "6px 8px", background: T.bg.panelAlt, borderTop: `1px solid ${T.border.subtle}` }}>
            <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, lineHeight: 1.6 }}>
              <span style={{ color: T.text.blue }}>■</span> TRAFFIC is the anchor signal ·
              <span style={{ color: T.text.green }}> COR-01</span> Traffic→Rent (lead 3-6mo) ·
              <span style={{ color: T.text.cyan }}> COR-05</span> Traffic→Vacancy (lead 2-4mo) ·
              <span style={{ color: T.text.amber }}> COR-04</span> Wage→Rent Cap ·
              <span style={{ color: T.text.red }}> COR-13</span> Affordability Ceiling (30%) ·
              Confidence bands widen with forecast horizon
              <br />
              <span style={{ color: T.text.amber }}>SUPPLY OUTLOOK:</span> Pipeline peaks at {Math.max(...mktAll.map(d => d.newSupply)).toLocaleString()} units ({mktAll.find(d => d.newSupply === Math.max(...mktAll.map(m => m.newSupply)))?.year}),
              {mktAll[mktAll.length-1].newSupply < mktAll[mktForecastIdx-1].newSupply ?
                <span style={{ color: T.text.green }}> declining to {mktAll[mktAll.length-1].newSupply.toLocaleString()} by {mktAll[mktAll.length-1].year}</span> :
                <span style={{ color: T.text.red }}> remaining elevated</span>
              }.
              Absorption {mktAll[mktForecastIdx + 2]?.absorption > mktAll[mktForecastIdx-1].absorption ?
                <span style={{ color: T.text.green }}>strengthening</span> :
                <span style={{ color: T.text.red }}>softening</span>
              }.
              Net: <span style={{ color: T.text.green }}>FAVORABLE — supply retreating as demand recovers</span>
              <br />
              <span style={{ color: T.text.muted }}>— = Submarket data unavailable for early property-only years (2018–2020)</span>
            </div>
          </div>
        </div>

        {/* Location scores */}
        <div style={{ display: "flex", gap: 12, padding: "0 4px" }}>
          {[
            { label: "Walk Score", color: T.text.green, value: p.walkScore },
            { label: "Transit Score", color: T.text.cyan, value: p.transitScore },
            { label: "Bike Score", color: T.text.purple, value: p.bikeScore },
          ].map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 2, background: l.color, borderRadius: 1 }} />
              <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>{l.label}: {l.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}