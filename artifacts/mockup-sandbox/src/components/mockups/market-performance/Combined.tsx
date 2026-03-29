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

function MiniLineChart({ data, series, width: cw, height: ch, forecastStartIdx }: any) {
  const pad = { top: 10, right: 12, bottom: 28, left: 48 };
  const w = (cw || 500) - pad.left - pad.right;
  const h = (ch || 180) - pad.top - pad.bottom;
  const allVals = series.flatMap((s: any) => data.map((d: any) => d[s.key]).filter((v: any) => v != null));
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const yRange = yMax - yMin || 1;
  const yPad = yRange * 0.08;
  const x = (i: number) => pad.left + (i / (data.length - 1)) * w;
  const y = (v: number) => pad.top + h - ((v - (yMin - yPad)) / (yRange + yPad * 2)) * h;
  const gridLines = 5;
  const yTicks = Array.from({ length: gridLines }, (_, i) => yMin - yPad + (yRange + yPad * 2) * (i / (gridLines - 1)));

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${cw || 500} ${ch || 180}`} style={{ overflow: "visible" }}>
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line x1={pad.left} y1={y(tick)} x2={pad.left + w} y2={y(tick)} stroke={T.border.subtle} strokeWidth={0.5} strokeDasharray="2,3" />
          <text x={pad.left - 4} y={y(tick) + 3} fill={T.text.muted} fontSize={7} fontFamily={T.font.mono} textAnchor="end">
            {tick >= 1000 ? `${(tick/1000).toFixed(tick >= 10000 ? 0 : 1)}k` : tick.toFixed(tick < 10 ? 1 : 0)}
          </text>
        </g>
      ))}
      {forecastStartIdx != null && (
        <>
          <rect x={x(forecastStartIdx)} y={pad.top} width={w - (x(forecastStartIdx) - pad.left)} height={h} fill={T.text.cyan} opacity={0.03} />
          <line x1={x(forecastStartIdx)} y1={pad.top} x2={x(forecastStartIdx)} y2={pad.top + h} stroke={T.text.cyan} strokeWidth={1} strokeDasharray="4,3" opacity={0.4} />
        </>
      )}
      {series.map((s: any, si: number) => {
        const pts = data.map((d: any, i: number) => d[s.key] != null ? { x: x(i), y: y(d[s.key]), i } : null).filter(Boolean) as any[];
        if (pts.length < 2) return null;
        const pathD = pts.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        return (
          <g key={si}>
            {s.confBand && forecastStartIdx != null && (() => {
              const fcPts = pts.filter((p: any) => p.i >= forecastStartIdx);
              if (fcPts.length < 2) return null;
              const upper = fcPts.map((p: any) => ({ x: p.x, y: y(data[p.i][s.key] * (1 + (1 - (data[p.i]?.confidence || 0.5)) * 0.06)) }));
              const lower = fcPts.map((p: any) => ({ x: p.x, y: y(data[p.i][s.key] * (1 - (1 - (data[p.i]?.confidence || 0.5)) * 0.06)) }));
              const bandPath = `M${upper.map((p: any) => `${p.x},${p.y}`).join(' L')} L${[...lower].reverse().map((p: any) => `${p.x},${p.y}`).join(' L')} Z`;
              return <path d={bandPath} fill={s.color} opacity={0.08} />;
            })()}
            <path d={pathD} fill="none" stroke={s.color} strokeWidth={1.5} opacity={1} />
            {pts.map((p: any, i: number) => (
              <circle key={i} cx={p.x} cy={p.y} r={2} fill={s.color} opacity={p.i >= (forecastStartIdx || Infinity) ? 0.5 : 0.9} />
            ))}
          </g>
        );
      })}
      {data.map((d: any, i: number) => {
        const showLabel = data.length <= 10 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1;
        return showLabel ? (
          <text key={i} x={x(i)} y={pad.top + h + 14} fill={i >= (forecastStartIdx || Infinity) ? T.text.cyan : T.text.muted}
            fontSize={7} fontFamily={T.font.mono} textAnchor="middle">
            {d.year}
          </text>
        ) : null;
      })}
    </svg>
  );
}

const ChartBox = ({ title, subtitle, height = 190, borderColor = T.text.cyan, action, children }: any) => (
  <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
    <SectionHeader title={title} subtitle={subtitle} borderColor={borderColor} action={action} />
    <div style={{ padding: "8px 4px 4px", height, position: "relative" }}>{children}</div>
  </div>
);

export function Combined() {
  const p = PROPERTY;
  const perf = PERF_HISTORY;
  const forecast = generateForecast();
  const td = { aadtHistory: TRAFFIC_AADT, aadtProjected: TRAFFIC_PROJECTED, outputs: { t07_pattern: "DEMAND_SURGE" } };

  const [activeSeries, setActiveSeries] = useState({ traffic: true, rent: true, occ: true, noi: true, concessions: true, rentGrowthCum: true });
  const toggleSeries = (key: string) => setActiveSeries(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));

  const trafficAll = [...td.aadtHistory, ...td.aadtProjected.map(p => ({ year: p.year, aadt: p.aadt }))];
  const perfAll = [...perf, ...forecast];
  const baseTraffic = trafficAll[0].aadt;
  const baseRent = perfAll[0].rent;
  const baseOcc = perfAll[0].occ;
  const baseNoi = perfAll[0].noi;
  const baseConc = Math.max(perfAll[0].concessions, 0.1);

  const indexedData = trafficAll.map((t, i) => {
    const pf = perfAll[i];
    if (!pf) return null;
    const cumRentGrowth = ((pf.rent / baseRent) - 1) * 100;
    return {
      year: t.year,
      traffic: (t.aadt / baseTraffic) * 100,
      rent: (pf.rent / baseRent) * 100,
      occ: (pf.occ / baseOcc) * 100,
      noi: (pf.noi / baseNoi) * 100,
      concessions: (pf.concessions / baseConc) * 100,
      rentGrowthCum: 100 + cumRentGrowth,
      confidence: td.aadtProjected.find(p => p.year === t.year)?.conf,
      isForecast: t.year > 2025,
      rawTraffic: t.aadt, rawRent: pf.rent, rawOcc: pf.occ, rawNoi: pf.noi, rawConc: pf.concessions, rawRentGrowth: pf.rentGrowth, rawExpRatio: pf.expRatio,
    };
  }).filter(Boolean) as any[];

  const forecastIdx = indexedData.findIndex((d: any) => d.isForecast);

  const SERIES_CONFIG = [
    { key: "traffic", label: "TRAFFIC (AADT)", color: T.text.blue, cor: "ANCHOR", thick: true },
    { key: "rent", label: "EFF. RENT", color: T.text.green, cor: "COR-01 r=0.65" },
    { key: "occ", label: "OCCUPANCY", color: T.text.cyan, cor: "COR-05 r=-0.60" },
    { key: "noi", label: "NOI", color: T.text.amber, cor: "COR-01 × COR-05" },
    { key: "concessions", label: "CONCESSIONS", color: T.text.red, cor: "inverse occ" },
    { key: "rentGrowthCum", label: "CUM. RENT GROWTH", color: T.text.purple, cor: "COR-04 capped" },
  ];
  const activeSerisList = SERIES_CONFIG.filter(s => (activeSeries as any)[s.key]);

  const fullW = 1340;
  const chartWidth = 640;

  const IndexedChart = () => {
    const pad = { top: 16, right: 16, bottom: 32, left: 52 };
    const w = fullW - pad.left - pad.right;
    const h = 340 - pad.top - pad.bottom;
    const allVals = activeSerisList.flatMap(s => indexedData.map((d: any) => d[s.key]).filter((v: any) => v != null));
    const yMin = Math.min(...allVals, 100) - 3;
    const yMax = Math.max(...allVals, 100) + 3;
    const yRange = yMax - yMin || 1;
    const xPos = (i: number) => pad.left + (i / (indexedData.length - 1)) * w;
    const yPos = (v: number) => pad.top + h - ((v - yMin) / yRange) * h;
    const gridCount = 7;
    const yTicks = Array.from({ length: gridCount }, (_, i) => yMin + yRange * (i / (gridCount - 1)));

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${fullW} 340`} style={{ overflow: "visible" }}>
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
        {activeSerisList.map((s) => {
          const pts = indexedData.map((d: any, i: number) => ({ x: xPos(i), y: yPos(d[s.key]), i, val: d[s.key] }));
          const pathD = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
          const fcPts = pts.filter(pt => pt.i >= forecastIdx && forecastIdx >= 0);
          let bandPath: string | null = null;
          if (fcPts.length >= 2 && s.key !== "concessions") {
            const spread = s.thick ? 0.04 : 0.05;
            const upper = fcPts.map(pt => ({ x: pt.x, y: yPos(pt.val * (1 + (1 - (indexedData[pt.i]?.confidence || 0.5)) * spread)) }));
            const lower = fcPts.map(pt => ({ x: pt.x, y: yPos(pt.val * (1 - (1 - (indexedData[pt.i]?.confidence || 0.5)) * spread)) }));
            bandPath = `M${upper.map(pt => `${pt.x},${pt.y}`).join(' L')} L${[...lower].reverse().map(pt => `${pt.x},${pt.y}`).join(' L')} Z`;
          }
          return (
            <g key={s.key}>
              {bandPath && <path d={bandPath} fill={s.color} opacity={0.06} />}
              <path d={pathD} fill="none" stroke={s.color} strokeWidth={s.thick ? 2.5 : 1.5} opacity={0.85} />
              {pts.filter((_, i) => i < forecastIdx || forecastIdx < 0).map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={2} fill={s.color} opacity={0.7} />
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

  const mktAll = [...p.marketHistory, ...p.marketForecast];
  const mktForecastIdx = p.marketHistory.length;

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

        {/* ━━━ SECTION 1: PERFORMANCE — INDEXED CHART ━━━ */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
          <Badge color={T.text.green}>ACTUAL 2018–2025</Badge>
          <Badge color={T.text.cyan}>FORECAST 2026–2035</Badge>
          <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>
            Indexed to 100 @ 2018 · Correlation Engine · All metrics relative to Traffic
          </span>
        </div>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PERFORMANCE vs TRAFFIC — INDEXED" subtitle="Base 100 = 2018 · Click legend to toggle" icon="◈" borderColor={T.text.amber}
            action={<span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>M07 Traffic Engine × Correlation Engine</span>} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}` }}>
            {SERIES_CONFIG.map(s => (
              <div key={s.key} onClick={() => toggleSeries(s.key)} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                background: (activeSeries as any)[s.key] ? `${s.color}15` : T.bg.input,
                border: `1px solid ${(activeSeries as any)[s.key] ? `${s.color}50` : T.border.subtle}`,
                borderRadius: 2, cursor: "pointer", transition: "all 0.15s",
                opacity: (activeSeries as any)[s.key] ? 1 : 0.4,
              }}>
                <div style={{ width: s.key === "traffic" ? 14 : 10, height: s.key === "traffic" ? 3 : 2, background: s.color, borderRadius: 1 }} />
                <span style={{ fontSize: 8, fontFamily: T.font.mono, fontWeight: 600, color: (activeSeries as any)[s.key] ? s.color : T.text.muted, letterSpacing: "0.03em" }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted }}>{s.cor}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 340, padding: "0 4px" }}>
            <IndexedChart />
          </div>
          <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${T.border.subtle}` }}>
            {SERIES_CONFIG.filter(s => (activeSeries as any)[s.key]).map((s, i) => {
              const last = indexedData[indexedData.length - 1];
              const base = indexedData[0];
              const delta = ((last[s.key] / base[s.key]) - 1) * 100;
              const rawNow = s.key === "traffic" ? `${(last.rawTraffic/1000).toFixed(1)}k vpd` :
                s.key === "rent" ? `$${last.rawRent.toLocaleString()}` :
                s.key === "occ" ? `${last.rawOcc.toFixed(1)}%` :
                s.key === "noi" ? fmt(last.rawNoi) :
                s.key === "concessions" ? `${last.rawConc.toFixed(1)}%` :
                `+${((last.rawRent / baseRent - 1) * 100).toFixed(0)}%`;
              return (
                <div key={s.key} style={{
                  flex: 1, padding: "5px 8px", textAlign: "center",
                  borderRight: i < activeSerisList.length - 1 ? `1px solid ${T.border.subtle}` : "none",
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

        {/* ━━━ DIVIDER ━━━ */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <div style={{ flex: 1, height: 1, background: T.border.medium }} />
          <span style={{ fontSize: 9, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.1em" }}>SUBMARKET FUNDAMENTALS</span>
          <div style={{ flex: 1, height: 1, background: T.border.medium }} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
          <Badge color={T.text.green}>ACTUAL 2021–2025</Badge>
          <Badge color={T.text.cyan}>FORECAST 2026–2030</Badge>
          <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>
            {p.submarket} Submarket · {p.market} · Sources: CoStar · FRED · BLS · Census ACS
          </span>
        </div>

        {/* ━━━ SECTION 2: MARKET CHARTS (2-col grid) ━━━ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ChartBox title="VACANCY RATE" subtitle={`${p.submarket} Submarket`} height={178} borderColor={T.text.red}
            action={<span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{pct(mktAll[0].vacancy)} → {pct(mktAll[mktAll.length-1].vacancy)}</span>}>
            <MiniLineChart data={mktAll.map(d => ({ year: d.year, vacancy: d.vacancy, confidence: (d as any).conf }))}
              series={[{ key: "vacancy", color: T.text.red, confBand: true }]} width={chartWidth} height={178} forecastStartIdx={mktForecastIdx} />
          </ChartBox>
          <ChartBox title="RENT GROWTH YoY" subtitle="% · Submarket Avg" height={178} borderColor={T.text.green}
            action={<span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{pct(mktAll[0].rentGrowth)} → {pct(mktAll[mktAll.length-1].rentGrowth)}</span>}>
            <MiniLineChart data={mktAll.map(d => ({ year: d.year, rentGrowth: d.rentGrowth, confidence: (d as any).conf }))}
              series={[{ key: "rentGrowth", color: T.text.green, confBand: true }]} width={chartWidth} height={178} forecastStartIdx={mktForecastIdx} />
          </ChartBox>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ChartBox title="NEW SUPPLY DELIVERIES" subtitle="Units / Year" height={178} borderColor={T.text.orange}
            action={<Badge color={mktAll[mktAll.length-1].newSupply < mktAll[mktForecastIdx-1].newSupply ? T.text.green : T.text.red}>
              {mktAll[mktAll.length-1].newSupply < mktAll[mktForecastIdx-1].newSupply ? "DECLINING" : "RISING"}
            </Badge>}>
            <MiniLineChart data={mktAll.map(d => ({ year: d.year, newSupply: d.newSupply, confidence: (d as any).conf }))}
              series={[{ key: "newSupply", color: T.text.orange, confBand: true }]} width={chartWidth} height={178} forecastStartIdx={mktForecastIdx} />
          </ChartBox>
          <ChartBox title="ABSORPTION" subtitle="Units absorbed / Year" height={178} borderColor={T.text.cyan}
            action={<span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{mktAll[0].absorption.toLocaleString()} → {mktAll[mktAll.length-1].absorption.toLocaleString()}</span>}>
            <MiniLineChart data={mktAll.map(d => ({ year: d.year, absorption: d.absorption / 1000, confidence: (d as any).conf }))}
              series={[{ key: "absorption", color: T.text.cyan, confBand: true }]} width={chartWidth} height={178} forecastStartIdx={mktForecastIdx} />
          </ChartBox>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ChartBox title="EMPLOYMENT GROWTH" subtitle="% YoY · BLS" height={178} borderColor={T.text.green}
            action={<span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{pct(mktAll[0].empGrowth)} → {pct(mktAll[mktAll.length-1].empGrowth)}</span>}>
            <MiniLineChart data={mktAll.map(d => ({ year: d.year, empGrowth: d.empGrowth, confidence: (d as any).conf }))}
              series={[{ key: "empGrowth", color: T.text.green, confBand: true }]} width={chartWidth} height={178} forecastStartIdx={mktForecastIdx} />
          </ChartBox>
          <ChartBox title="DEMAND SCORE" subtitle="Composite 0–100" height={178} borderColor={T.text.green}
            action={<span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{mktAll[0].demandScore} → {mktAll[mktAll.length-1].demandScore}</span>}>
            <MiniLineChart data={mktAll.map(d => ({ year: d.year, demandScore: d.demandScore, confidence: (d as any).conf }))}
              series={[{ key: "demandScore", color: T.text.green, confBand: true }]} width={chartWidth} height={178} forecastStartIdx={mktForecastIdx} />
          </ChartBox>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ChartBox title="POPULATION GROWTH (3mi)" subtitle="% YoY" height={178} borderColor={T.text.purple}
            action={<span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{pct(mktAll[0].popGrowth)} → {pct(mktAll[mktAll.length-1].popGrowth)}</span>}>
            <MiniLineChart data={mktAll.map(d => ({ year: d.year, popGrowth: d.popGrowth, confidence: (d as any).conf }))}
              series={[{ key: "popGrowth", color: T.text.purple, confBand: true }]} width={chartWidth} height={178} forecastStartIdx={mktForecastIdx} />
          </ChartBox>
          <ChartBox title="MEDIAN HH INCOME" subtitle="$ · Census ACS" height={178} borderColor={T.text.amber}
            action={<span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>${(mktAll[0].hhIncome/1000).toFixed(1)}K → ${(mktAll[mktAll.length-1].hhIncome/1000).toFixed(1)}K</span>}>
            <MiniLineChart data={mktAll.map(d => ({ year: d.year, hhIncome: d.hhIncome / 1000, confidence: (d as any).conf }))}
              series={[{ key: "hhIncome", color: T.text.amber, confBand: true }]} width={chartWidth} height={178} forecastStartIdx={mktForecastIdx} />
          </ChartBox>
        </div>

        {/* ━━━ PERFORMANCE TABLE ━━━ */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PERFORMANCE TABLE" subtitle="Historical + Forecast · Raw Values" icon="≡" borderColor={T.text.amber}
            action={<span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>COR-01 · COR-04 · COR-05 · COR-06 · COR-13</span>} />
          <div style={{ fontSize: 8, fontFamily: T.font.mono, overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "36px 48px 50px 36px 40px 36px 52px 36px 36px", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, minWidth: 440 }}>
              {["YEAR","TRAFFIC","RENT","OCC","GRWTH","CONC","NOI","CONF","R/I"].map(h => (
                <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
              ))}
            </div>
            {indexedData.map((d: any, i: number) => {
              const rToI = ((d.rawRent * 12) / (78_200 * Math.pow(1.025, Math.max(0, d.year - 2025))) * 100);
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "36px 48px 50px 36px 40px 36px 52px 36px 36px",
                  padding: "3px 8px", minWidth: 440,
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
                  <span style={{ color: rToI > 32 ? T.text.red : rToI > 30 ? T.text.amber : T.text.green }}>
                    {rToI.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "5px 8px", background: T.bg.panelAlt, borderTop: `1px solid ${T.border.subtle}` }}>
            <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, lineHeight: 1.5 }}>
              <span style={{ color: T.text.blue }}>■</span> TRAFFIC is the anchor signal ·
              <span style={{ color: T.text.green }}> COR-01</span> Traffic→Rent (lead 3-6mo) ·
              <span style={{ color: T.text.cyan }}> COR-05</span> Traffic→Vacancy (lead 2-4mo) ·
              <span style={{ color: T.text.amber }}> COR-04</span> Wage→Rent Cap ·
              <span style={{ color: T.text.red }}> COR-13</span> Affordability Ceiling (30%) ·
              Confidence bands widen with forecast horizon
            </div>
          </div>
        </div>

        {/* ━━━ MARKET DATA TABLE ━━━ */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="MARKET DATA TABLE" subtitle={`${p.submarket} · 10-Year View`} icon="≡" borderColor={T.text.amber} />
          <div style={{ fontSize: 8, fontFamily: T.font.mono, overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "36px 38px 40px 52px 48px 48px 38px 38px 48px 42px 38px", padding: "4px 6px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, minWidth: 520 }}>
              {["YEAR","VAC","GRWTH","RENT","SUPPLY","ABSRP","P/S%","EMP%","INCOME","POP%","DMD"].map(h => (
                <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.04em" }}>{h}</span>
              ))}
            </div>
            {mktAll.map((d, i) => {
              const isFc = i >= mktForecastIdx;
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "36px 38px 40px 52px 48px 48px 38px 38px 48px 42px 38px",
                  padding: "3px 6px", minWidth: 520,
                  borderBottom: `1px solid ${T.border.subtle}08`,
                  background: isFc ? `${T.text.cyan}04` : (i % 2 === 0 ? T.bg.panel : T.bg.panelAlt),
                }}>
                  <span style={{ color: isFc ? T.text.cyan : T.text.primary, fontWeight: 600 }}>{d.year}</span>
                  <span style={{ color: d.vacancy < 7 ? T.text.green : d.vacancy < 9 ? T.text.amber : T.text.red }}>{pct(d.vacancy)}</span>
                  <span style={{ color: d.rentGrowth >= 3 ? T.text.green : d.rentGrowth >= 0 ? T.text.amber : T.text.red }}>
                    {d.rentGrowth >= 0 ? "+" : ""}{pct(d.rentGrowth)}
                  </span>
                  <span style={{ color: T.text.primary }}>${d.avgRent.toLocaleString()}</span>
                  <span style={{ color: d.newSupply > 1500 ? T.text.red : d.newSupply > 1000 ? T.text.orange : T.text.green }}>{d.newSupply.toLocaleString()}</span>
                  <span style={{ color: T.text.cyan }}>{(d.absorption/1000).toFixed(1)}k</span>
                  <span style={{ color: d.pipelinePct < 5 ? T.text.green : T.text.red }}>{pct(d.pipelinePct)}</span>
                  <span style={{ color: d.empGrowth >= 3 ? T.text.green : T.text.amber }}>{pct(d.empGrowth)}</span>
                  <span style={{ color: T.text.secondary }}>${(d.hhIncome/1000).toFixed(0)}K</span>
                  <span style={{ color: d.popGrowth >= 2 ? T.text.green : T.text.amber }}>{pct(d.popGrowth)}</span>
                  <span style={{ color: d.demandScore >= 88 ? T.text.green : d.demandScore >= 80 ? T.text.amber : T.text.red }}>{d.demandScore}</span>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "6px 8px", background: T.bg.panelAlt, borderTop: `1px solid ${T.border.subtle}` }}>
            <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, lineHeight: 1.5 }}>
              {(() => {
                const curr = mktAll[mktForecastIdx - 1];
                const fc3 = mktAll[mktForecastIdx + 2];
                const supplyDeclining = fc3 && fc3.newSupply < curr.newSupply;
                const absRising = fc3 && fc3.absorption > curr.absorption;
                return (<>
                  <span style={{ color: T.text.amber }}>SUPPLY OUTLOOK:</span> Pipeline peaks at {Math.max(...mktAll.map(d => d.newSupply)).toLocaleString()} units ({mktAll.find(d => d.newSupply === Math.max(...mktAll.map(m => m.newSupply)))?.year}),
                  {supplyDeclining ? <span style={{ color: T.text.green }}> declining to {fc3.newSupply.toLocaleString()} by {fc3.year}</span> : <span style={{ color: T.text.red }}> remaining elevated</span>}.
                  Absorption {absRising ? <span style={{ color: T.text.green }}>strengthening</span> : <span style={{ color: T.text.red }}>softening</span>}.
                  Net: {supplyDeclining && absRising ? <span style={{ color: T.text.green }}>FAVORABLE — supply retreating as demand recovers</span> :
                    supplyDeclining ? <span style={{ color: T.text.amber }}>IMPROVING — supply declining</span> :
                    <span style={{ color: T.text.red }}>WATCH — supply pressure persists</span>}
                </>);
              })()}
            </div>
          </div>
        </div>

        {/* Location scores legend */}
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