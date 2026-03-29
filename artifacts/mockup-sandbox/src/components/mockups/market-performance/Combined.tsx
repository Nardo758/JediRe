import { useState } from "react";

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF",blue:"#4A9EFF",teal:"#14B8A6" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

const SUBMARKET_HISTORY = [
  { year: 2021, vacancy: 5.2, rentGrowth: 12.8, avgRent: 1_580, absorption: 14_200, newSupply: 820, pipelinePct: 2.9, popGrowth: 2.8, hhIncome: 68_400, empGrowth: 5.1, demandScore: 92 },
  { year: 2022, vacancy: 6.8, rentGrowth: 10.3, avgRent: 1_742, absorption: 12_800, newSupply: 1_180, pipelinePct: 4.0, popGrowth: 2.4, hhIncome: 71_200, empGrowth: 4.2, demandScore: 90 },
  { year: 2023, vacancy: 8.1, rentGrowth: 3.2, avgRent: 1_798, absorption: 10_400, newSupply: 1_640, pipelinePct: 5.4, popGrowth: 2.2, hhIncome: 73_800, empGrowth: 3.6, demandScore: 88 },
  { year: 2024, vacancy: 8.8, rentGrowth: 1.3, avgRent: 1_822, absorption: 9_800, newSupply: 1_920, pipelinePct: 6.0, popGrowth: 2.0, hhIncome: 75_900, empGrowth: 3.0, demandScore: 86 },
  { year: 2025, vacancy: 8.5, rentGrowth: 1.1, avgRent: 1_842, absorption: 11_658, newSupply: 1_240, pipelinePct: 4.2, popGrowth: 2.1, hhIncome: 78_200, empGrowth: 3.2, demandScore: 88 },
];
const SUBMARKET_FORECAST = [
  { year: 2026, vacancy: 8.0, rentGrowth: 2.8, avgRent: 1_894, absorption: 12_400, newSupply: 1_380, pipelinePct: 3.9, popGrowth: 2.0, hhIncome: 80_200, empGrowth: 3.0, demandScore: 89, conf: 0.88 },
  { year: 2027, vacancy: 7.4, rentGrowth: 3.2, avgRent: 1_954, absorption: 13_200, newSupply: 860, pipelinePct: 2.4, popGrowth: 1.9, hhIncome: 82_400, empGrowth: 2.8, demandScore: 90, conf: 0.80 },
  { year: 2028, vacancy: 6.8, rentGrowth: 3.5, avgRent: 2_022, absorption: 14_000, newSupply: 620, pipelinePct: 1.7, popGrowth: 1.8, hhIncome: 84_600, empGrowth: 2.6, demandScore: 91, conf: 0.72 },
  { year: 2029, vacancy: 6.5, rentGrowth: 3.0, avgRent: 2_083, absorption: 13_600, newSupply: 940, pipelinePct: 2.5, popGrowth: 1.7, hhIncome: 86_800, empGrowth: 2.4, demandScore: 90, conf: 0.63 },
  { year: 2030, vacancy: 7.0, rentGrowth: 2.4, avgRent: 2_133, absorption: 12_800, newSupply: 1_100, pipelinePct: 2.8, popGrowth: 1.6, hhIncome: 89_000, empGrowth: 2.2, demandScore: 89, conf: 0.55 },
];

function deriveGeoLevel(base: any[], vacOff: number, rentOff: number, absScale: number, supplyScale: number, empOff: number, incomeOff: number, dmdOff: number) {
  return base.map(d => ({
    ...d,
    vacancy: parseFloat((d.vacancy + vacOff).toFixed(1)),
    rentGrowth: parseFloat((d.rentGrowth + rentOff).toFixed(1)),
    avgRent: Math.round(d.avgRent * (1 + rentOff * 0.02)),
    absorption: Math.round(d.absorption * absScale),
    newSupply: Math.round(d.newSupply * supplyScale),
    empGrowth: parseFloat((d.empGrowth + empOff).toFixed(1)),
    hhIncome: Math.round(d.hhIncome + incomeOff),
    demandScore: Math.min(100, Math.max(50, d.demandScore + dmdOff)),
  }));
}

const TRADE_AREA_ALL = deriveGeoLevel(
  [...SUBMARKET_HISTORY, ...SUBMARKET_FORECAST],
  -0.7, 0.4, 0.85, 0.6, 0.2, 2_400, 2
);
const SUBMARKET_ALL = [...SUBMARKET_HISTORY, ...SUBMARKET_FORECAST];
const MSA_ALL = deriveGeoLevel(
  [...SUBMARKET_HISTORY, ...SUBMARKET_FORECAST],
  -1.3, -0.4, 2.8, 3.2, -0.3, -4_800, -2
);

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

type GeoGroup = "perf" | "trade" | "sub" | "msa";
interface SeriesDef {
  key: string; label: string; color: string; cor: string; group: GeoGroup;
  thick?: boolean; dashArray?: string;
}

const SERIES_CONFIG: SeriesDef[] = [
  { key: "traffic", label: "TRAFFIC", color: T.text.blue, cor: "ANCHOR", group: "perf", thick: true },
  { key: "rent", label: "EFF. RENT", color: T.text.green, cor: "COR-01", group: "perf" },
  { key: "occ", label: "OCCUPANCY", color: T.text.cyan, cor: "COR-05", group: "perf" },
  { key: "noi", label: "NOI", color: T.text.amber, cor: "COR-01×05", group: "perf" },
  { key: "concessions", label: "CONCESSIONS", color: T.text.red, cor: "inv occ", group: "perf" },
  { key: "rentGrowthCum", label: "CUM. RENT GRWTH", color: T.text.purple, cor: "COR-04", group: "perf" },
  { key: "taVacancy", label: "VACANCY", color: "#FF9F7F", cor: "3mi ring", group: "trade", dashArray: "3,2" },
  { key: "taRentGrowth", label: "RENT GRWTH", color: "#7FD4A0", cor: "3mi ring", group: "trade", dashArray: "3,2" },
  { key: "taEmpGrowth", label: "EMPLOYMENT", color: "#7FC4D4", cor: "BLS local", group: "trade", dashArray: "3,2" },
  { key: "subVacancy", label: "VACANCY", color: "#FF6B6B", cor: "Westshore", group: "sub", dashArray: "6,3" },
  { key: "subRentGrowth", label: "RENT GRWTH", color: "#66D9A0", cor: "Westshore", group: "sub", dashArray: "6,3" },
  { key: "subEmpGrowth", label: "EMPLOYMENT", color: T.text.teal, cor: "BLS sub", group: "sub", dashArray: "6,3" },
  { key: "msaVacancy", label: "VACANCY", color: "#D4A07F", cor: "Tampa MSA", group: "msa", dashArray: "8,4,2,4" },
  { key: "msaRentGrowth", label: "RENT GRWTH", color: "#A0D47F", cor: "Tampa MSA", group: "msa", dashArray: "8,4,2,4" },
  { key: "msaEmpGrowth", label: "EMPLOYMENT", color: "#7FA0D4", cor: "BLS MSA", group: "msa", dashArray: "8,4,2,4" },
];

const GEO_GROUPS: { key: GeoGroup; label: string; color: string; lineStyle: string }[] = [
  { key: "perf", label: "PROPERTY", color: T.text.amber, lineStyle: "solid" },
  { key: "trade", label: "TRADE AREA (3mi)", color: "#FF9F7F", lineStyle: "dotted" },
  { key: "sub", label: "SUBMARKET", color: "#FF6B6B", lineStyle: "dashed" },
  { key: "msa", label: "MSA", color: "#D4A07F", lineStyle: "dash-dot" },
];

export function Combined() {
  const perf = PERF_HISTORY;
  const forecast = generateForecast();

  const defaults: Record<string, boolean> = {};
  SERIES_CONFIG.forEach(s => {
    defaults[s.key] = s.group === "perf";
  });
  const [activeSeries, setActiveSeries] = useState<Record<string, boolean>>(defaults);
  const toggleSeries = (key: string) => setActiveSeries(prev => ({ ...prev, [key]: !prev[key] }));

  const trafficAll = [...TRAFFIC_AADT, ...TRAFFIC_PROJECTED.map(p => ({ year: p.year, aadt: p.aadt }))];
  const perfAll = [...perf, ...forecast];
  const baseTraffic = trafficAll[0].aadt;
  const baseRent = perfAll[0].rent;
  const baseOcc = perfAll[0].occ;
  const baseNoi = perfAll[0].noi;
  const baseConc = Math.max(perfAll[0].concessions, 0.1);

  const taByYear: Record<number, any> = {};
  TRADE_AREA_ALL.forEach(d => { taByYear[d.year] = d; });
  const subByYear: Record<number, any> = {};
  SUBMARKET_ALL.forEach(d => { subByYear[d.year] = d; });
  const msaByYear: Record<number, any> = {};
  MSA_ALL.forEach(d => { msaByYear[d.year] = d; });

  const baseTaVac = TRADE_AREA_ALL[0].vacancy;
  const baseTaRG = Math.max(TRADE_AREA_ALL[0].rentGrowth, 0.1);
  const baseTaEmp = TRADE_AREA_ALL[0].empGrowth;
  const baseSubVac = SUBMARKET_ALL[0].vacancy;
  const baseSubRG = Math.max(SUBMARKET_ALL[0].rentGrowth, 0.1);
  const baseSubEmp = SUBMARKET_ALL[0].empGrowth;
  const baseMsaVac = MSA_ALL[0].vacancy;
  const baseMsaRG = Math.max(Math.abs(MSA_ALL[0].rentGrowth), 0.1);
  const baseMsaEmp = MSA_ALL[0].empGrowth;

  const indexedData = trafficAll.map((t, i) => {
    const pf = perfAll[i];
    if (!pf) return null;
    const cumRentGrowth = ((pf.rent / baseRent) - 1) * 100;
    const ta = taByYear[t.year];
    const sub = subByYear[t.year];
    const msa = msaByYear[t.year];
    return {
      year: t.year,
      traffic: (t.aadt / baseTraffic) * 100,
      rent: (pf.rent / baseRent) * 100,
      occ: (pf.occ / baseOcc) * 100,
      noi: (pf.noi / baseNoi) * 100,
      concessions: (pf.concessions / baseConc) * 100,
      rentGrowthCum: 100 + cumRentGrowth,
      taVacancy: ta ? (ta.vacancy / baseTaVac) * 100 : null,
      taRentGrowth: ta ? (ta.rentGrowth / baseTaRG) * 100 : null,
      taEmpGrowth: ta ? (ta.empGrowth / baseTaEmp) * 100 : null,
      subVacancy: sub ? (sub.vacancy / baseSubVac) * 100 : null,
      subRentGrowth: sub ? (sub.rentGrowth / baseSubRG) * 100 : null,
      subEmpGrowth: sub ? (sub.empGrowth / baseSubEmp) * 100 : null,
      msaVacancy: msa ? (msa.vacancy / baseMsaVac) * 100 : null,
      msaRentGrowth: msa ? (msa.rentGrowth / baseMsaRG) * 100 : null,
      msaEmpGrowth: msa ? (msa.empGrowth / baseMsaEmp) * 100 : null,
      confidence: TRAFFIC_PROJECTED.find(p => p.year === t.year)?.conf,
      isForecast: t.year > 2025,
      rawTraffic: t.aadt, rawRent: pf.rent, rawOcc: pf.occ, rawNoi: pf.noi,
      rawConc: pf.concessions, rawRentGrowth: pf.rentGrowth, rawExpRatio: pf.expRatio,
      ta, sub, msa,
    };
  }).filter(Boolean) as any[];

  const forecastIdx = indexedData.findIndex((d: any) => d.isForecast);
  const activeSerisList = SERIES_CONFIG.filter(s => activeSeries[s.key]);
  const fullW = 1340;

  const IndexedChart = () => {
    const pad = { top: 16, right: 16, bottom: 32, left: 52 };
    const w = fullW - pad.left - pad.right;
    const h = 400 - pad.top - pad.bottom;
    const activeWithData = activeSerisList.filter(s => indexedData.some((d: any) => d[s.key] != null));
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
      <svg width="100%" height="100%" viewBox={`0 0 ${fullW} 400`} style={{ overflow: "visible" }}>
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
          if (fcPts.length >= 2 && s.key !== "concessions" && s.group === "perf") {
            const spread = s.thick ? 0.04 : 0.05;
            const upper = fcPts.map((pt: any) => ({ x: pt.x, y: yPos(pt.val * (1 + (1 - (indexedData[pt.i]?.confidence || 0.5)) * spread)) }));
            const lower = fcPts.map((pt: any) => ({ x: pt.x, y: yPos(pt.val * (1 - (1 - (indexedData[pt.i]?.confidence || 0.5)) * spread)) }));
            bandPath = `M${upper.map((pt: any) => `${pt.x},${pt.y}`).join(' L')} L${[...lower].reverse().map((pt: any) => `${pt.x},${pt.y}`).join(' L')} Z`;
          }
          const isMkt = s.group !== "perf";
          return (
            <g key={s.key}>
              {bandPath && <path d={bandPath} fill={s.color} opacity={0.06} />}
              <path d={pathD} fill="none" stroke={s.color}
                strokeWidth={s.thick ? 2.5 : isMkt ? 1.2 : 1.5}
                strokeDasharray={s.dashArray || "none"}
                opacity={isMkt ? 0.75 : 0.85} />
              {pts.filter((_: any, pi: number) => pi < (forecastIdx >= 0 ? pts.findIndex((p: any) => p.i >= forecastIdx) : pts.length)).map((pt: any, pi: number) => (
                <circle key={pi} cx={pt.x} cy={pt.y} r={isMkt ? 1.5 : 2} fill={s.color} opacity={0.7} />
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

  const lineStylePreview = (dashArray?: string, color?: string) => {
    if (!dashArray) return <div style={{ width: 14, height: 3, background: color, borderRadius: 1 }} />;
    return (
      <svg width={14} height={6} style={{ display: "block" }}>
        <line x1={0} y1={3} x2={14} y2={3} stroke={color} strokeWidth={2} strokeDasharray={dashArray} />
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
            Indexed to 100 @ base year · Property + Trade Area + Submarket + MSA
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>CoStar · FRED · BLS · Census ACS · FDOT</span>
        </div>

        {/* ━━━ UNIFIED CHART ━━━ */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PERFORMANCE + MARKET — INDEXED" subtitle="Base 100 · Click to toggle · Line style = geographic scope" icon="◈" borderColor={T.text.amber}
            action={<span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>M07 Engine × Correlation Engine × 3-Tier Market</span>} />

          {/* Legend rows by geo level */}
          <div style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}` }}>
            {GEO_GROUPS.map(g => {
              const groupSeries = SERIES_CONFIG.filter(s => s.group === g.key);
              return (
                <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: g.key !== "msa" ? 4 : 0 }}>
                  <span style={{ fontSize: 7, fontFamily: T.font.mono, color: g.color, letterSpacing: "0.06em", width: 100, fontWeight: 700 }}>{g.label}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {groupSeries.map(s => (
                      <div key={s.key} onClick={() => toggleSeries(s.key)} style={{
                        display: "flex", alignItems: "center", gap: 3, padding: "2px 6px",
                        background: activeSeries[s.key] ? `${s.color}15` : T.bg.input,
                        border: `1px solid ${activeSeries[s.key] ? `${s.color}50` : T.border.subtle}`,
                        borderRadius: 2, cursor: "pointer", transition: "all 0.15s",
                        opacity: activeSeries[s.key] ? 1 : 0.35,
                      }}>
                        {lineStylePreview(s.dashArray, s.color)}
                        <span style={{ fontSize: 7, fontFamily: T.font.mono, fontWeight: 600, color: activeSeries[s.key] ? s.color : T.text.muted, letterSpacing: "0.03em" }}>
                          {s.label}
                        </span>
                        <span style={{ fontSize: 5, fontFamily: T.font.mono, color: T.text.muted }}>{s.cor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div style={{ height: 400, padding: "0 4px" }}>
            <IndexedChart />
          </div>

          {/* Values strip — show active series current values */}
          <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${T.border.subtle}`, flexWrap: "wrap" }}>
            {SERIES_CONFIG.filter(s => activeSeries[s.key]).map((s, i, arr) => {
              const last = indexedData[indexedData.length - 1];
              const first = indexedData.find((d: any) => d[s.key] != null);
              if (!first || last[s.key] == null) return null;
              const delta = ((last[s.key] / first[s.key]) - 1) * 100;
              let rawNow = "";
              if (s.key === "traffic") rawNow = `${(last.rawTraffic/1000).toFixed(1)}k`;
              else if (s.key === "rent") rawNow = `$${last.rawRent.toLocaleString()}`;
              else if (s.key === "occ") rawNow = `${last.rawOcc.toFixed(1)}%`;
              else if (s.key === "noi") rawNow = fmt(last.rawNoi);
              else if (s.key === "concessions") rawNow = `${last.rawConc.toFixed(1)}%`;
              else if (s.key === "rentGrowthCum") rawNow = `+${((last.rawRent / baseRent - 1) * 100).toFixed(0)}%`;
              else {
                const geo = s.group === "trade" ? last.ta : s.group === "sub" ? last.sub : last.msa;
                if (!geo) rawNow = "—";
                else if (s.key.includes("Vacancy")) rawNow = `${geo.vacancy.toFixed(1)}%`;
                else if (s.key.includes("RentGrowth")) rawNow = `${geo.rentGrowth >= 0 ? "+" : ""}${geo.rentGrowth.toFixed(1)}%`;
                else if (s.key.includes("EmpGrowth")) rawNow = `${geo.empGrowth.toFixed(1)}%`;
              }
              const geoLabel = s.group === "trade" ? "TA" : s.group === "sub" ? "SUB" : s.group === "msa" ? "MSA" : "";
              return (
                <div key={s.key} style={{
                  flex: "1 1 0", minWidth: 90, padding: "4px 6px", textAlign: "center",
                  borderRight: i < arr.length - 1 ? `1px solid ${T.border.subtle}` : "none",
                  background: `${s.color}04`,
                }}>
                  <div style={{ fontSize: 5, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.08em" }}>
                    {geoLabel ? `${geoLabel} ` : ""}{s.label}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: s.color }}>{rawNow}</div>
                  <div style={{ fontSize: 6, fontFamily: T.font.mono, color: delta >= 0 ? T.text.green : T.text.red }}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
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
              insight: `Traffic +${((indexedData[indexedData.length-1].traffic / 100 - 1) * 100).toFixed(0)}% from base drives rent +${((indexedData[indexedData.length-1].rent / 100 - 1) * 100).toFixed(0)}%. Trade area outperforms submarket by +${(TRADE_AREA_ALL[TRADE_AREA_ALL.length-1].rentGrowth - SUBMARKET_ALL[SUBMARKET_ALL.length-1].rentGrowth).toFixed(1)}pp.` },
            { title: "TRAFFIC → VACANCY", cor: "COR-05", r: "-0.60", lead: "2-4mo", color: T.text.cyan,
              insight: `Vacancy: TA ${TRADE_AREA_ALL[TRADE_AREA_ALL.length-1].vacancy.toFixed(1)}% < Sub ${SUBMARKET_ALL[SUBMARKET_ALL.length-1].vacancy.toFixed(1)}% < MSA ${MSA_ALL[MSA_ALL.length-1].vacancy.toFixed(1)}%. Tightening across all geo levels confirms demand.` },
            { title: "WAGE → RENT CEILING", cor: "COR-04", r: "0.72", lead: "concurrent", color: T.text.amber,
              insight: `R-to-I at ~${((1_842 * 12 / 78200) * 100).toFixed(0)}%. MSA income $${(MSA_ALL[MSA_ALL.length-1].hhIncome/1000).toFixed(0)}K vs TA $${(TRADE_AREA_ALL[TRADE_AREA_ALL.length-1].hhIncome/1000).toFixed(0)}K — local affluence supports premium.` },
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
          <SectionHeader title="COMBINED DATA TABLE" subtitle="Property + Trade Area + Submarket + MSA" icon="≡" borderColor={T.text.amber}
            action={<span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>COR-01 · COR-04 · COR-05 · COR-13</span>} />
          <div style={{ fontSize: 7, fontFamily: T.font.mono, overflowX: "auto" }}>
            {/* Group headers */}
            <div style={{ display: "grid", gridTemplateColumns: "32px 240px 1fr 1fr 1fr", borderBottom: `1px solid ${T.border.medium}`, minWidth: 900 }}>
              <div />
              <div style={{ padding: "3px 4px", textAlign: "center", borderLeft: `1px solid ${T.border.medium}`, borderRight: `1px solid ${T.border.medium}` }}>
                <span style={{ fontWeight: 700, color: T.text.amber, letterSpacing: "0.1em", fontSize: 7 }}>PROPERTY</span>
              </div>
              <div style={{ padding: "3px 4px", textAlign: "center", borderRight: `1px solid ${T.border.medium}` }}>
                <span style={{ fontWeight: 700, color: "#FF9F7F", letterSpacing: "0.1em", fontSize: 7 }}>TRADE AREA (3mi)</span>
              </div>
              <div style={{ padding: "3px 4px", textAlign: "center", borderRight: `1px solid ${T.border.medium}` }}>
                <span style={{ fontWeight: 700, color: "#FF6B6B", letterSpacing: "0.1em", fontSize: 7 }}>SUBMARKET</span>
              </div>
              <div style={{ padding: "3px 4px", textAlign: "center" }}>
                <span style={{ fontWeight: 700, color: "#D4A07F", letterSpacing: "0.1em", fontSize: 7 }}>TAMPA MSA</span>
              </div>
            </div>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "32px 40px 44px 32px 34px 32px 44px 32px 32px 34px 40px 32px 34px 40px 32px 34px 40px", padding: "3px 4px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, minWidth: 900 }}>
              {["YR","TRAFF","RENT","OCC","GRWTH","CONC","NOI","CF",
                "VAC","GRWTH","ABSRP",
                "VAC","GRWTH","ABSRP",
                "VAC","GRWTH","ABSRP"].map((h, hi) => {
                let color = T.text.muted;
                let bl = "none";
                if (hi === 8) { color = "#FF9F7F"; bl = `1px solid ${T.border.medium}`; }
                else if (hi >= 9 && hi <= 10) color = "#FF9F7F";
                else if (hi === 11) { color = "#FF6B6B"; bl = `1px solid ${T.border.medium}`; }
                else if (hi >= 12 && hi <= 13) color = "#FF6B6B";
                else if (hi === 14) { color = "#D4A07F"; bl = `1px solid ${T.border.medium}`; }
                else if (hi >= 15) color = "#D4A07F";
                return <span key={`${h}${hi}`} style={{ color, fontWeight: 600, letterSpacing: "0.03em", borderLeft: bl, paddingLeft: bl !== "none" ? 3 : 0 }}>{h}</span>;
              })}
            </div>
            {/* Data rows */}
            {indexedData.map((d: any, i: number) => {
              const ta = d.ta;
              const sub = d.sub;
              const msa = d.msa;
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "32px 40px 44px 32px 34px 32px 44px 32px 32px 34px 40px 32px 34px 40px 32px 34px 40px",
                  padding: "2px 4px", minWidth: 900,
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
                    {d.rawConc.toFixed(1)}
                  </span>
                  <span style={{ color: T.text.primary }}>{fmt(d.rawNoi)}</span>
                  <span style={{ color: d.isForecast ? ((d.confidence || 0) > 0.6 ? T.text.green : (d.confidence || 0) > 0.4 ? T.text.amber : T.text.red) : T.text.green }}>
                    {d.isForecast ? `${((d.confidence || 0) * 100).toFixed(0)}%` : "ACT"}
                  </span>
                  {/* Trade Area */}
                  <span style={{ color: ta ? (ta.vacancy < 7 ? T.text.green : ta.vacancy < 9 ? T.text.amber : T.text.red) : T.text.muted, borderLeft: `1px solid ${T.border.medium}`, paddingLeft: 3 }}>
                    {ta ? ta.vacancy.toFixed(1) : "—"}
                  </span>
                  <span style={{ color: ta ? (ta.rentGrowth >= 3 ? T.text.green : ta.rentGrowth >= 0 ? T.text.amber : T.text.red) : T.text.muted }}>
                    {ta ? `${ta.rentGrowth >= 0 ? "+" : ""}${ta.rentGrowth.toFixed(1)}` : "—"}
                  </span>
                  <span style={{ color: ta ? T.text.cyan : T.text.muted }}>
                    {ta ? `${(ta.absorption/1000).toFixed(1)}k` : "—"}
                  </span>
                  {/* Submarket */}
                  <span style={{ color: sub ? (sub.vacancy < 7 ? T.text.green : sub.vacancy < 9 ? T.text.amber : sub.vacancy >= 9 ? T.text.red : T.text.muted) : T.text.muted, borderLeft: `1px solid ${T.border.medium}`, paddingLeft: 3 }}>
                    {sub ? sub.vacancy.toFixed(1) : "—"}
                  </span>
                  <span style={{ color: sub ? (sub.rentGrowth >= 3 ? T.text.green : sub.rentGrowth >= 0 ? T.text.amber : T.text.red) : T.text.muted }}>
                    {sub ? `${sub.rentGrowth >= 0 ? "+" : ""}${sub.rentGrowth.toFixed(1)}` : "—"}
                  </span>
                  <span style={{ color: sub ? T.text.cyan : T.text.muted }}>
                    {sub ? `${(sub.absorption/1000).toFixed(1)}k` : "—"}
                  </span>
                  {/* MSA */}
                  <span style={{ color: msa ? (msa.vacancy < 7 ? T.text.green : msa.vacancy < 9 ? T.text.amber : T.text.red) : T.text.muted, borderLeft: `1px solid ${T.border.medium}`, paddingLeft: 3 }}>
                    {msa ? msa.vacancy.toFixed(1) : "—"}
                  </span>
                  <span style={{ color: msa ? (msa.rentGrowth >= 3 ? T.text.green : msa.rentGrowth >= 0 ? T.text.amber : T.text.red) : T.text.muted }}>
                    {msa ? `${msa.rentGrowth >= 0 ? "+" : ""}${msa.rentGrowth.toFixed(1)}` : "—"}
                  </span>
                  <span style={{ color: msa ? T.text.cyan : T.text.muted }}>
                    {msa ? `${(msa.absorption/1000).toFixed(1)}k` : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer narrative */}
          <div style={{ padding: "6px 8px", background: T.bg.panelAlt, borderTop: `1px solid ${T.border.subtle}` }}>
            <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, lineHeight: 1.6 }}>
              <span style={{ color: T.text.amber }}>GEO SUMMARY:</span>{" "}
              Trade area vacancy {TRADE_AREA_ALL[TRADE_AREA_ALL.length-1].vacancy.toFixed(1)}% &lt; Submarket {SUBMARKET_ALL[SUBMARKET_ALL.length-1].vacancy.toFixed(1)}% &lt; MSA {MSA_ALL[MSA_ALL.length-1].vacancy.toFixed(1)}% —{" "}
              <span style={{ color: T.text.green }}>property positioned in tightest micro-market</span>.{" "}
              TA rent growth +{TRADE_AREA_ALL[TRADE_AREA_ALL.length-1].rentGrowth.toFixed(1)}% outpaces MSA +{MSA_ALL[MSA_ALL.length-1].rentGrowth.toFixed(1)}%.{" "}
              Absorption strongest at MSA level ({(MSA_ALL[MSA_ALL.length-1].absorption/1000).toFixed(1)}k) reflecting metro-wide demand.
              <br />
              <span style={{ color: T.text.blue }}>■</span> Solid = property ·{" "}
              <svg width={14} height={6} style={{ display: "inline-block", verticalAlign: "middle" }}><line x1={0} y1={3} x2={14} y2={3} stroke="#FF9F7F" strokeWidth={2} strokeDasharray="3,2" /></svg> Dotted = trade area ·{" "}
              <svg width={14} height={6} style={{ display: "inline-block", verticalAlign: "middle" }}><line x1={0} y1={3} x2={14} y2={3} stroke="#FF6B6B" strokeWidth={2} strokeDasharray="6,3" /></svg> Dashed = submarket ·{" "}
              <svg width={14} height={6} style={{ display: "inline-block", verticalAlign: "middle" }}><line x1={0} y1={3} x2={14} y2={3} stroke="#D4A07F" strokeWidth={2} strokeDasharray="8,4,2,4" /></svg> Dash-dot = MSA ·{" "}
              — = data unavailable
            </div>
          </div>
        </div>

        {/* Location scores */}
        <div style={{ display: "flex", gap: 12, padding: "0 4px" }}>
          {[
            { label: "Walk Score", color: T.text.green, value: 62 },
            { label: "Transit Score", color: T.text.cyan, value: 44 },
            { label: "Bike Score", color: T.text.purple, value: 51 },
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