import { useState } from "react";

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF",blue:"#4A9EFF",teal:"#14B8A6" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

const PROPERTY_DATA = [
  { year: 2018, rent: 1420, occ: 94.8, rentGrowth: 3.2, concessions: 0.5, rentPerSF: 1.82, monthlyTraffic: 21200 },
  { year: 2019, rent: 1488, occ: 95.2, rentGrowth: 4.8, concessions: 0.0, rentPerSF: 1.91, monthlyTraffic: 21800 },
  { year: 2020, rent: 1465, occ: 88.6, rentGrowth: -1.5, concessions: 6.2, rentPerSF: 1.88, monthlyTraffic: 18400 },
  { year: 2021, rent: 1580, occ: 91.4, rentGrowth: 7.8, concessions: 3.8, rentPerSF: 2.03, monthlyTraffic: 20900 },
  { year: 2022, rent: 1742, occ: 93.8, rentGrowth: 10.3, concessions: 1.2, rentPerSF: 2.23, monthlyTraffic: 22600 },
  { year: 2023, rent: 1798, occ: 94.1, rentGrowth: 3.2, concessions: 0.8, rentPerSF: 2.31, monthlyTraffic: 23400 },
  { year: 2024, rent: 1822, occ: 93.0, rentGrowth: 1.3, concessions: 2.4, rentPerSF: 2.34, monthlyTraffic: 24100 },
  { year: 2025, rent: 1842, occ: 93.5, rentGrowth: 1.1, concessions: 2.8, rentPerSF: 2.36, monthlyTraffic: 24500 },
];

const GEO_BASE = [
  { year: 2018, rentGrowth: 3.8, occupancy: 94.4, concessions: 1.2, rentPerSF: 1.74, capRate: 5.8, absorptionPerMonth: 980, jobsPerUnit: 1.42, medianIncome: 58200, population: 412000, popGrowth: 2.1 },
  { year: 2019, rentGrowth: 5.4, occupancy: 95.0, concessions: 0.8, rentPerSF: 1.83, capRate: 5.6, absorptionPerMonth: 1120, jobsPerUnit: 1.48, medianIncome: 60100, population: 420600, popGrowth: 2.1 },
  { year: 2020, rentGrowth: -0.8, occupancy: 90.8, concessions: 5.8, rentPerSF: 1.82, capRate: 6.2, absorptionPerMonth: 640, jobsPerUnit: 1.32, medianIncome: 59800, population: 425200, popGrowth: 1.1 },
  { year: 2021, rentGrowth: 12.8, occupancy: 94.8, concessions: 2.4, rentPerSF: 2.05, capRate: 5.1, absorptionPerMonth: 1183, jobsPerUnit: 1.51, medianIncome: 63400, population: 437000, popGrowth: 2.8 },
  { year: 2022, rentGrowth: 10.3, occupancy: 93.2, concessions: 1.6, rentPerSF: 2.26, capRate: 4.8, absorptionPerMonth: 1067, jobsPerUnit: 1.56, medianIncome: 66200, population: 447500, popGrowth: 2.4 },
  { year: 2023, rentGrowth: 3.2, occupancy: 91.9, concessions: 2.2, rentPerSF: 2.33, capRate: 5.4, absorptionPerMonth: 867, jobsPerUnit: 1.52, medianIncome: 68800, population: 457300, popGrowth: 2.2 },
  { year: 2024, rentGrowth: 1.3, occupancy: 91.2, concessions: 3.0, rentPerSF: 2.36, capRate: 5.6, absorptionPerMonth: 817, jobsPerUnit: 1.48, medianIncome: 70900, population: 466400, popGrowth: 2.0 },
  { year: 2025, rentGrowth: 1.1, occupancy: 91.5, concessions: 2.8, rentPerSF: 2.39, capRate: 5.5, absorptionPerMonth: 972, jobsPerUnit: 1.50, medianIncome: 73200, population: 476200, popGrowth: 2.1 },
];

const GEO_FORECAST_BASE = [
  { year: 2026, rentGrowth: 2.8, occupancy: 92.0, concessions: 2.2, rentPerSF: 2.46, capRate: 5.3, absorptionPerMonth: 1033, jobsPerUnit: 1.52, medianIncome: 75400, population: 485800, popGrowth: 2.0, conf: 0.88 },
  { year: 2027, rentGrowth: 3.2, occupancy: 92.6, concessions: 1.8, rentPerSF: 2.54, capRate: 5.1, absorptionPerMonth: 1100, jobsPerUnit: 1.55, medianIncome: 77800, population: 495100, popGrowth: 1.9, conf: 0.80 },
  { year: 2028, rentGrowth: 3.5, occupancy: 93.2, concessions: 1.4, rentPerSF: 2.63, capRate: 5.0, absorptionPerMonth: 1167, jobsPerUnit: 1.57, medianIncome: 80200, population: 504200, popGrowth: 1.8, conf: 0.72 },
  { year: 2029, rentGrowth: 3.0, occupancy: 93.5, concessions: 1.2, rentPerSF: 2.71, capRate: 5.1, absorptionPerMonth: 1133, jobsPerUnit: 1.56, medianIncome: 82400, population: 513000, popGrowth: 1.7, conf: 0.63 },
  { year: 2030, rentGrowth: 2.4, occupancy: 93.0, concessions: 1.6, rentPerSF: 2.77, capRate: 5.2, absorptionPerMonth: 1067, jobsPerUnit: 1.54, medianIncome: 84800, population: 521600, popGrowth: 1.7, conf: 0.55 },
  { year: 2031, rentGrowth: 2.2, occupancy: 92.8, concessions: 1.8, rentPerSF: 2.83, capRate: 5.3, absorptionPerMonth: 1033, jobsPerUnit: 1.53, medianIncome: 87000, population: 529800, popGrowth: 1.6, conf: 0.48 },
  { year: 2032, rentGrowth: 2.0, occupancy: 92.9, concessions: 1.6, rentPerSF: 2.89, capRate: 5.3, absorptionPerMonth: 1050, jobsPerUnit: 1.53, medianIncome: 89200, population: 537800, popGrowth: 1.5, conf: 0.42 },
  { year: 2033, rentGrowth: 2.3, occupancy: 93.2, concessions: 1.4, rentPerSF: 2.96, capRate: 5.2, absorptionPerMonth: 1083, jobsPerUnit: 1.55, medianIncome: 91600, population: 545600, popGrowth: 1.5, conf: 0.37 },
  { year: 2034, rentGrowth: 2.1, occupancy: 93.1, concessions: 1.5, rentPerSF: 3.02, capRate: 5.2, absorptionPerMonth: 1067, jobsPerUnit: 1.54, medianIncome: 93800, population: 553200, popGrowth: 1.4, conf: 0.33 },
  { year: 2035, rentGrowth: 1.9, occupancy: 93.0, concessions: 1.6, rentPerSF: 3.08, capRate: 5.3, absorptionPerMonth: 1050, jobsPerUnit: 1.53, medianIncome: 96200, population: 560600, popGrowth: 1.3, conf: 0.30 },
];

function deriveGeo(base: any[], o: { occOff: number; rgOff: number; concOff: number; rsfOff: number; capOff: number; absScale: number; jpuOff: number; incOff: number; popScale: number; pgOff: number }) {
  return base.map(d => ({
    ...d,
    occupancy: parseFloat((d.occupancy + o.occOff).toFixed(1)),
    rentGrowth: parseFloat((d.rentGrowth + o.rgOff).toFixed(1)),
    concessions: parseFloat(Math.max(0, d.concessions + o.concOff).toFixed(1)),
    rentPerSF: parseFloat((d.rentPerSF + o.rsfOff).toFixed(2)),
    capRate: parseFloat((d.capRate + o.capOff).toFixed(1)),
    absorptionPerMonth: Math.round(d.absorptionPerMonth * o.absScale),
    jobsPerUnit: parseFloat((d.jobsPerUnit + o.jpuOff).toFixed(2)),
    medianIncome: Math.round(d.medianIncome + o.incOff),
    population: Math.round(d.population * o.popScale),
    popGrowth: parseFloat((d.popGrowth + o.pgOff).toFixed(1)),
  }));
}

const ALL_GEO_BASE = [...GEO_BASE, ...GEO_FORECAST_BASE];
const TRADE_AREA = deriveGeo(ALL_GEO_BASE, { occOff: 0.7, rgOff: 0.4, concOff: -0.3, rsfOff: 0.08, capOff: -0.2, absScale: 0.35, jpuOff: 0.12, incOff: 4200, popScale: 0.22, pgOff: 0.3 });
const SUBMARKET = ALL_GEO_BASE;
const MSA = deriveGeo(ALL_GEO_BASE, { occOff: 1.3, rgOff: -0.6, concOff: 0.4, rsfOff: -0.12, capOff: 0.3, absScale: 3.8, jpuOff: -0.08, incOff: -8400, popScale: 7.2, pgOff: -0.4 });

function generatePropertyForecast() {
  const last = PROPERTY_DATA[PROPERTY_DATA.length - 1];
  const forecasts: any[] = [];
  let { rent, occ, concessions, rentPerSF, monthlyTraffic } = last;
  for (let i = 0; i < 10; i++) {
    const conf = GEO_FORECAST_BASE[i]?.conf || 0.30;
    const trafficGrowth = 0.028 - i * 0.002;
    monthlyTraffic = Math.round(monthlyTraffic * (1 + Math.max(0.005, trafficGrowth)));
    const occDelta = trafficGrowth > 0.02 ? 0.3 : trafficGrowth > 0 ? 0.1 : -0.2;
    occ = Math.min(96.5, Math.max(88, occ + occDelta - (i > 5 ? 0.15 : 0)));
    let rentGrowthRate = Math.max(0.008, 0.030 - i * 0.002);
    rent = Math.round(rent * (1 + rentGrowthRate));
    const rentGrowth = parseFloat((rentGrowthRate * 100).toFixed(1));
    rentPerSF = parseFloat((rent / 780).toFixed(2));
    concessions = occ > 94 ? 0.5 : occ > 92 ? 1.8 : occ > 90 ? 3.5 : 5.0;
    if (i > 6) concessions += 0.8;
    forecasts.push({ year: 2026 + i, rent, occ: parseFloat(occ.toFixed(1)), rentGrowth, concessions: parseFloat(concessions.toFixed(1)), rentPerSF, monthlyTraffic, conf });
  }
  return forecasts;
}

const PROP_ALL = [...PROPERTY_DATA, ...generatePropertyForecast()];

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

interface CorrelationResult { metricA: string; metricB: string; r: number; strength: string; narrative: string }

function computeCorrelations(): CorrelationResult[] {
  const histProp = PROP_ALL.filter(p => p.year <= 2025);
  const histSub = SUBMARKET.filter(d => d.year <= 2025);
  const histTA = TRADE_AREA.filter(d => d.year <= 2025);

  const pairs: { a: string; b: string; xs: number[]; ys: number[]; narrative: (r: number) => string }[] = [
    { a: "TRAFFIC", b: "RENT", xs: histProp.map(p => p.monthlyTraffic), ys: histProp.map(p => p.rent),
      narrative: (r) => r > 0.7 ? "Strong traffic→rent link: footfall drives pricing power" : "Moderate traffic impact on rents" },
    { a: "TRAFFIC", b: "OCCUPANCY", xs: histProp.map(p => p.monthlyTraffic), ys: histProp.map(p => p.occ),
      narrative: (r) => r > 0.7 ? "Traffic strongly predicts occupancy gains" : "Traffic has moderate occupancy impact" },
    { a: "SUB OCC", b: "PROP OCC", xs: histSub.map(d => d.occupancy), ys: histProp.map(p => p.occ),
      narrative: (r) => r > 0.7 ? "Property tracks submarket occupancy closely" : "Property occupancy diverges from submarket" },
    { a: "TA INCOME", b: "RENT", xs: histTA.map(d => d.medianIncome), ys: histProp.map(p => p.rent),
      narrative: (r) => r > 0.8 ? "Income growth in trade area supports rent increases" : "Rent partially decoupled from local income" },
    { a: "SUB ABSRP", b: "PROP OCC", xs: histSub.map(d => d.absorptionPerMonth), ys: histProp.map(p => p.occ),
      narrative: (r) => r > 0.6 ? "Submarket absorption drives property occupancy" : "Property occupancy less tied to absorption" },
    { a: "POP GROWTH", b: "RENT GRWTH", xs: histSub.map(d => d.popGrowth), ys: histProp.map(p => p.rentGrowth),
      narrative: (r) => r > 0.5 ? "Population growth fueling rent growth" : "Rent growth driven by factors beyond population" },
    { a: "JOBS/UNIT", b: "OCCUPANCY", xs: histSub.map(d => d.jobsPerUnit), ys: histProp.map(p => p.occ),
      narrative: (r) => r > 0.6 ? "Employment density supports occupancy" : "Occupancy less dependent on job density" },
    { a: "CAP RATE", b: "RENT GRWTH", xs: histSub.map(d => d.capRate), ys: histProp.map(p => p.rentGrowth),
      narrative: (r) => r < -0.4 ? "Cap rate compression signals rent acceleration" : "Cap rates weakly tied to rent growth" },
  ];

  return pairs.map(p => {
    const r = pearson(p.xs, p.ys);
    const absR = Math.abs(r);
    const strength = absR >= 0.8 ? "VERY STRONG" : absR >= 0.6 ? "STRONG" : absR >= 0.4 ? "MODERATE" : "WEAK";
    return { metricA: p.a, metricB: p.b, r: parseFloat(r.toFixed(2)), strength, narrative: p.narrative(r) };
  }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

const CORRELATIONS = computeCorrelations();

interface FiveYearOutlook {
  metric: string;
  current: string;
  yr1: string; yr3: string; yr5: string;
  delta5yr: string;
  direction: "up" | "down" | "flat";
  signal: string;
  narrative: string;
}

function compute5YearOutlook(): FiveYearOutlook[] {
  const now = PROP_ALL.find(p => p.year === 2025)!;
  const yr1 = PROP_ALL.find(p => p.year === 2026)!;
  const yr3 = PROP_ALL.find(p => p.year === 2028)!;
  const yr5 = PROP_ALL.find(p => p.year === 2030)!;

  const sub1 = SUBMARKET.find(d => d.year === 2026)!;
  const sub3 = SUBMARKET.find(d => d.year === 2028)!;
  const sub5 = SUBMARKET.find(d => d.year === 2030)!;
  const subNow = SUBMARKET.find(d => d.year === 2025)!;

  const rentDelta = ((yr5.rent - now.rent) / now.rent * 100);
  const occDelta = yr5.occ - now.occ;
  const subRentGrowthAvg = ((sub1.rentGrowth + sub3.rentGrowth + sub5.rentGrowth) / 3);

  const trafficCorr = CORRELATIONS.find(c => c.metricA === "TRAFFIC" && c.metricB === "RENT");
  const incomeCorr = CORRELATIONS.find(c => c.metricA === "TA INCOME" && c.metricB === "RENT");

  return [
    {
      metric: "RENT",
      current: `$${now.rent.toLocaleString()}`,
      yr1: `$${yr1.rent.toLocaleString()}`,
      yr3: `$${yr3.rent.toLocaleString()}`,
      yr5: `$${yr5.rent.toLocaleString()}`,
      delta5yr: `+${rentDelta.toFixed(1)}%`,
      direction: rentDelta > 2 ? "up" : rentDelta < -1 ? "down" : "flat",
      signal: trafficCorr && trafficCorr.r > 0.7
        ? `Traffic correlation r=${trafficCorr.r} reinforces upward trajectory`
        : `Moderate traffic support`,
      narrative: `Rent projected to grow ${rentDelta.toFixed(1)}% over 5 years ($${now.rent.toLocaleString()} → $${yr5.rent.toLocaleString()}). ${incomeCorr && incomeCorr.r > 0.7 ? `Strong income correlation (r=${incomeCorr.r}) supports sustainability.` : "Monitor income-to-rent ratio for affordability ceiling."} Submarket avg rent growth ${subRentGrowthAvg.toFixed(1)}% provides tailwind.`,
    },
    {
      metric: "OCCUPANCY",
      current: `${now.occ.toFixed(1)}%`,
      yr1: `${yr1.occ.toFixed(1)}%`,
      yr3: `${yr3.occ.toFixed(1)}%`,
      yr5: `${yr5.occ.toFixed(1)}%`,
      delta5yr: `${occDelta > 0 ? "+" : ""}${occDelta.toFixed(1)}pp`,
      direction: occDelta > 0.5 ? "up" : occDelta < -0.5 ? "down" : "flat",
      signal: `Submarket occ forecast: ${subNow.occupancy.toFixed(1)}% → ${sub5.occupancy.toFixed(1)}% (+${(sub5.occupancy - subNow.occupancy).toFixed(1)}pp)`,
      narrative: `Property occupancy expected ${occDelta > 0 ? "to improve" : "stable"} at ${yr5.occ.toFixed(1)}% by 2030 (${occDelta > 0 ? "+" : ""}${occDelta.toFixed(1)}pp). ${yr5.occ > sub5.occupancy ? `Outperforming submarket by ${(yr5.occ - sub5.occupancy).toFixed(1)}pp — competitive advantage intact.` : `Tracking submarket trend — aligned with market recovery.`} Absorption trend ${sub5.absorptionPerMonth > subNow.absorptionPerMonth ? "strengthening" : "moderating"} at ${sub5.absorptionPerMonth.toLocaleString()}/mo.`,
    },
    {
      metric: "RENT GROWTH",
      current: `${now.rentGrowth.toFixed(1)}%`,
      yr1: `${yr1.rentGrowth.toFixed(1)}%`,
      yr3: `${yr3.rentGrowth.toFixed(1)}%`,
      yr5: `${yr5.rentGrowth.toFixed(1)}%`,
      delta5yr: yr5.rentGrowth > now.rentGrowth ? `+${(yr5.rentGrowth - now.rentGrowth).toFixed(1)}pp` : `${(yr5.rentGrowth - now.rentGrowth).toFixed(1)}pp`,
      direction: yr5.rentGrowth > now.rentGrowth ? "up" : yr5.rentGrowth < now.rentGrowth - 1 ? "down" : "flat",
      signal: `Pop growth (${subNow.popGrowth.toFixed(1)}% → ${sub5.popGrowth.toFixed(1)}%) ${sub5.popGrowth > 1.5 ? "sustains demand" : "slowing — headwind"}`,
      narrative: `Rent growth accelerating from ${now.rentGrowth.toFixed(1)}% to ${yr3.rentGrowth.toFixed(1)}% by 2028, then moderating to ${yr5.rentGrowth.toFixed(1)}% by 2030. ${sub5.capRate < subNow.capRate ? `Cap rate compression (${subNow.capRate.toFixed(1)}% → ${sub5.capRate.toFixed(1)}%) signals investor confidence.` : `Cap rates stable — market equilibrium.`} Concessions forecast to ${yr5.concessions < now.concessions ? `decline to ${yr5.concessions.toFixed(1)}% — pricing power improving` : `hold at ${yr5.concessions.toFixed(1)}%`}.`,
    },
  ];
}

const FIVE_YEAR_OUTLOOK = compute5YearOutlook();

const pct = (n: number) => `${n.toFixed(1)}%`;
const kFmt = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(1)}k` : `${n}`;

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

type GeoGroup = "prop" | "trade" | "sub" | "msa";

interface SeriesDef {
  key: string; label: string; color: string; group: GeoGroup;
  thick?: boolean; dashArray?: string;
}

const PROP_SERIES: SeriesDef[] = [
  { key: "pRent", label: "RENT", color: T.text.green, group: "prop" },
  { key: "pOcc", label: "OCCUPANCY", color: T.text.cyan, group: "prop" },
  { key: "pGrowth", label: "RENT GROWTH", color: T.text.purple, group: "prop" },
  { key: "pConc", label: "CONCESSIONS", color: T.text.orange, group: "prop" },
  { key: "pRentSF", label: "RENT/SF", color: "#7FD4A0", group: "prop" },
  { key: "pTraffic", label: "MO. TRAFFIC", color: T.text.blue, group: "prop", thick: true },
];

const GEO_METRICS: { key: string; label: string; color: string }[] = [
  { key: "RentGrowth", label: "RENT GRWTH", color: T.text.green },
  { key: "Occupancy", label: "OCCUPANCY", color: T.text.cyan },
  { key: "Concessions", label: "CONCESSIONS", color: T.text.orange },
  { key: "RentPerSF", label: "RENT/SF", color: "#7FD4A0" },
  { key: "CapRate", label: "CAP RATE", color: T.text.amber },
  { key: "Absorption", label: "ABSRP/MO", color: T.text.teal },
  { key: "JobsPerUnit", label: "JOBS/UNIT", color: T.text.blue },
  { key: "MedianIncome", label: "MED. INCOME", color: T.text.purple },
  { key: "Population", label: "POPULATION", color: "#A0D47F" },
  { key: "PopGrowth", label: "POP GROWTH", color: "#14B8A6" },
];

function buildGeoSeries(prefix: string, group: GeoGroup, dashArray: string): SeriesDef[] {
  return GEO_METRICS.map(m => ({
    key: `${prefix}${m.key}`,
    label: m.label,
    color: m.color,
    group,
    dashArray,
  }));
}

const ALL_SERIES: SeriesDef[] = [
  ...PROP_SERIES,
  ...buildGeoSeries("ta", "trade", "3,2"),
  ...buildGeoSeries("sub", "sub", "6,3"),
  ...buildGeoSeries("msa", "msa", "8,4,2,4"),
];

const GEO_GROUPS: { key: GeoGroup; label: string; color: string }[] = [
  { key: "prop", label: "PROPERTY", color: T.text.amber },
  { key: "trade", label: "TRADE AREA (3mi)", color: "#FF9F7F" },
  { key: "sub", label: "SUBMARKET", color: "#FF6B6B" },
  { key: "msa", label: "TAMPA MSA", color: "#D4A07F" },
];

export function Combined() {
  const defaults: Record<string, boolean> = {};
  ALL_SERIES.forEach(s => { defaults[s.key] = s.group === "prop"; });
  const [activeSeries, setActiveSeries] = useState<Record<string, boolean>>(defaults);
  const toggleSeries = (key: string) => setActiveSeries(prev => ({ ...prev, [key]: !prev[key] }));

  const taByYear: Record<number, any> = {};
  TRADE_AREA.forEach(d => { taByYear[d.year] = d; });
  const subByYear: Record<number, any> = {};
  SUBMARKET.forEach(d => { subByYear[d.year] = d; });
  const msaByYear: Record<number, any> = {};
  MSA.forEach(d => { msaByYear[d.year] = d; });

  const base = PROP_ALL[0];
  const baseTa = taByYear[PROP_ALL[0].year];
  const baseSub = subByYear[PROP_ALL[0].year];
  const baseMsa = msaByYear[PROP_ALL[0].year];

  const safeDiv = (a: number, b: number) => b !== 0 ? (a / b) * 100 : 100;

  const indexedData = PROP_ALL.map((p) => {
    const ta = taByYear[p.year];
    const sub = subByYear[p.year];
    const msa = msaByYear[p.year];
    return {
      year: p.year,
      isForecast: p.year > 2025,
      confidence: (p as any).conf,
      pRent: safeDiv(p.rent, base.rent),
      pOcc: safeDiv(p.occ, base.occ),
      pGrowth: safeDiv(p.rentGrowth, Math.max(Math.abs(base.rentGrowth), 0.1)),
      pConc: safeDiv(p.concessions, Math.max(base.concessions, 0.1)),
      pRentSF: safeDiv(p.rentPerSF, base.rentPerSF),
      pTraffic: safeDiv(p.monthlyTraffic, base.monthlyTraffic),
      taRentGrowth: ta && baseTa ? safeDiv(ta.rentGrowth, Math.max(Math.abs(baseTa.rentGrowth), 0.1)) : null,
      taOccupancy: ta && baseTa ? safeDiv(ta.occupancy, baseTa.occupancy) : null,
      taConcessions: ta && baseTa ? safeDiv(ta.concessions, Math.max(baseTa.concessions, 0.1)) : null,
      taRentPerSF: ta && baseTa ? safeDiv(ta.rentPerSF, baseTa.rentPerSF) : null,
      taCapRate: ta && baseTa ? safeDiv(ta.capRate, baseTa.capRate) : null,
      taAbsorption: ta && baseTa ? safeDiv(ta.absorptionPerMonth, baseTa.absorptionPerMonth) : null,
      taJobsPerUnit: ta && baseTa ? safeDiv(ta.jobsPerUnit, baseTa.jobsPerUnit) : null,
      taMedianIncome: ta && baseTa ? safeDiv(ta.medianIncome, baseTa.medianIncome) : null,
      taPopulation: ta && baseTa ? safeDiv(ta.population, baseTa.population) : null,
      taPopGrowth: ta && baseTa ? safeDiv(ta.popGrowth, Math.max(baseTa.popGrowth, 0.1)) : null,
      subRentGrowth: sub && baseSub ? safeDiv(sub.rentGrowth, Math.max(Math.abs(baseSub.rentGrowth), 0.1)) : null,
      subOccupancy: sub && baseSub ? safeDiv(sub.occupancy, baseSub.occupancy) : null,
      subConcessions: sub && baseSub ? safeDiv(sub.concessions, Math.max(baseSub.concessions, 0.1)) : null,
      subRentPerSF: sub && baseSub ? safeDiv(sub.rentPerSF, baseSub.rentPerSF) : null,
      subCapRate: sub && baseSub ? safeDiv(sub.capRate, baseSub.capRate) : null,
      subAbsorption: sub && baseSub ? safeDiv(sub.absorptionPerMonth, baseSub.absorptionPerMonth) : null,
      subJobsPerUnit: sub && baseSub ? safeDiv(sub.jobsPerUnit, baseSub.jobsPerUnit) : null,
      subMedianIncome: sub && baseSub ? safeDiv(sub.medianIncome, baseSub.medianIncome) : null,
      subPopulation: sub && baseSub ? safeDiv(sub.population, baseSub.population) : null,
      subPopGrowth: sub && baseSub ? safeDiv(sub.popGrowth, Math.max(baseSub.popGrowth, 0.1)) : null,
      msaRentGrowth: msa && baseMsa ? safeDiv(msa.rentGrowth, Math.max(Math.abs(baseMsa.rentGrowth), 0.1)) : null,
      msaOccupancy: msa && baseMsa ? safeDiv(msa.occupancy, baseMsa.occupancy) : null,
      msaConcessions: msa && baseMsa ? safeDiv(msa.concessions, Math.max(baseMsa.concessions, 0.1)) : null,
      msaRentPerSF: msa && baseMsa ? safeDiv(msa.rentPerSF, baseMsa.rentPerSF) : null,
      msaCapRate: msa && baseMsa ? safeDiv(msa.capRate, baseMsa.capRate) : null,
      msaAbsorption: msa && baseMsa ? safeDiv(msa.absorptionPerMonth, baseMsa.absorptionPerMonth) : null,
      msaJobsPerUnit: msa && baseMsa ? safeDiv(msa.jobsPerUnit, baseMsa.jobsPerUnit) : null,
      msaMedianIncome: msa && baseMsa ? safeDiv(msa.medianIncome, baseMsa.medianIncome) : null,
      msaPopulation: msa && baseMsa ? safeDiv(msa.population, baseMsa.population) : null,
      msaPopGrowth: msa && baseMsa ? safeDiv(msa.popGrowth, Math.max(baseMsa.popGrowth, 0.1)) : null,
      raw: { prop: p, ta, sub, msa },
    };
  });

  const forecastIdx = indexedData.findIndex(d => d.isForecast);
  const fullW = 1340;
  const activeSerisList = ALL_SERIES.filter(s => activeSeries[s.key]);

  const topCorrelations = CORRELATIONS.filter(c => Math.abs(c.r) >= 0.5).slice(0, 5);

  const IndexedChart = () => {
    const pad = { top: 16, right: 16, bottom: 32, left: 52 };
    const w = fullW - pad.left - pad.right;
    const h = 420 - pad.top - pad.bottom;
    const activeWithData = activeSerisList.filter(s => indexedData.some(d => (d as any)[s.key] != null));
    const allVals = activeWithData.flatMap(s => indexedData.map(d => (d as any)[s.key]).filter((v: any) => v != null));
    if (allVals.length === 0) return <svg width="100%" height="100%" />;
    const yMin = Math.min(...allVals, 100) - 3;
    const yMax = Math.max(...allVals, 100) + 3;
    const yRange = yMax - yMin || 1;
    const xPos = (i: number) => pad.left + (i / (indexedData.length - 1)) * w;
    const yPos = (v: number) => pad.top + h - ((v - yMin) / yRange) * h;
    const gridCount = 7;
    const yTicks = Array.from({ length: gridCount }, (_, i) => yMin + yRange * (i / (gridCount - 1)));

    const corrAnnotations: { x: number; y: number; label: string; color: string }[] = [];
    if (topCorrelations.length > 0) {
      const anno1 = topCorrelations[0];
      corrAnnotations.push({ x: xPos(4), y: yPos(yMin + yRange * 0.85), label: `r=${anno1.r} ${anno1.metricA}↔${anno1.metricB}`, color: Math.abs(anno1.r) >= 0.8 ? T.text.green : T.text.amber });
      if (topCorrelations.length > 1) {
        const anno2 = topCorrelations[1];
        corrAnnotations.push({ x: xPos(5), y: yPos(yMin + yRange * 0.78), label: `r=${anno2.r} ${anno2.metricA}↔${anno2.metricB}`, color: Math.abs(anno2.r) >= 0.8 ? T.text.green : T.text.amber });
      }
    }

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${fullW} 420`} style={{ overflow: "visible" }}>
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
            .map((d, i) => (d as any)[s.key] != null ? { x: xPos(i), y: yPos((d as any)[s.key]), i, val: (d as any)[s.key] } : null)
            .filter(Boolean) as any[];
          if (pts.length < 2) return null;
          const pathD = pts.map((pt: any, i: number) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
          const isMkt = s.group !== "prop";
          return (
            <g key={s.key}>
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
        {corrAnnotations.map((a, i) => (
          <g key={`corr-${i}`}>
            <rect x={a.x - 2} y={a.y - 8} width={a.label.length * 5 + 10} height={14} rx={2} fill={`${a.color}18`} stroke={`${a.color}50`} strokeWidth={0.5} />
            <text x={a.x + 3} y={a.y + 2} fill={a.color} fontSize={7} fontFamily={T.font.mono} fontWeight={600}>{a.label}</text>
          </g>
        ))}
        {indexedData.map((d, i) => (
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

  const propCols = [
    { key: "rent", label: "RENT", fmt: (v: number) => `$${v.toLocaleString()}` },
    { key: "occ", label: "OCC", fmt: pct },
    { key: "rentGrowth", label: "GRWTH", fmt: pct, color: true },
    { key: "concessions", label: "CONC", fmt: pct },
    { key: "rentPerSF", label: "$/SF", fmt: (v: number) => `$${v.toFixed(2)}` },
    { key: "monthlyTraffic", label: "TRAFFIC", fmt: kFmt },
  ];

  const geoCols = [
    { key: "rentGrowth", label: "GRWTH", fmt: pct, color: true },
    { key: "occupancy", label: "OCC", fmt: pct },
    { key: "concessions", label: "CONC", fmt: pct },
    { key: "rentPerSF", label: "$/SF", fmt: (v: number) => `$${v.toFixed(2)}` },
    { key: "capRate", label: "CAP", fmt: pct },
    { key: "absorptionPerMonth", label: "ABSRP", fmt: kFmt },
    { key: "jobsPerUnit", label: "J/U", fmt: (v: number) => v.toFixed(2) },
    { key: "medianIncome", label: "MED INC", fmt: (v: number) => `$${kFmt(v)}` },
    { key: "population", label: "POP", fmt: kFmt },
    { key: "popGrowth", label: "POP%", fmt: pct },
  ];

  const geoLabels = [
    { label: "TRADE AREA (3mi)", dataKey: "ta", color: "#FF9F7F" },
    { label: "SUBMARKET", dataKey: "sub", color: "#FF6B6B" },
    { label: "TAMPA MSA", dataKey: "msa", color: "#D4A07F" },
  ];

  const cellStyle = (isForecast: boolean, isHeader = false): React.CSSProperties => ({
    padding: "3px 6px",
    fontSize: 9,
    fontFamily: T.font.mono,
    textAlign: "right" as const,
    borderRight: `1px solid ${T.border.subtle}`,
    borderBottom: `1px solid ${T.border.subtle}`,
    color: isForecast ? T.text.cyan : T.text.primary,
    background: isHeader ? T.bg.header : "transparent",
    whiteSpace: "nowrap",
    fontWeight: isHeader ? 700 : 400,
  });

  const growthColor = (v: number) => v > 0 ? T.text.green : v < 0 ? T.text.red : T.text.secondary;
  const corrColor = (r: number) => Math.abs(r) >= 0.8 ? T.text.green : Math.abs(r) >= 0.6 ? T.text.amber : Math.abs(r) >= 0.4 ? T.text.orange : T.text.muted;

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
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
          <span style={{ fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.08em" }}>F6</span>
          <span style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: T.text.white, letterSpacing: "0.06em" }}>MARKET & PERFORMANCE</span>
          <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>Westshore Commons · Tampa MSA</span>
          <div style={{ flex: 1 }} />
          <PatternBadge pattern="DEMAND_SURGE" />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
          <Badge color={T.text.green}>ACTUAL 2018–2025</Badge>
          <Badge color={T.text.cyan}>FORECAST 2026–2035</Badge>
          <Badge color={T.text.purple}>CORRELATION ENGINE</Badge>
          <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>
            Indexed to 100 @ 2018 · Property + Trade Area + Submarket + MSA
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>CoStar · FRED · BLS · Census ACS · FDOT</span>
        </div>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PERFORMANCE + MARKET — INDEXED" subtitle="Base 100 · Click to toggle · Correlation annotations on chart" icon="◈" borderColor={T.text.amber}
            action={<span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>M07 Engine × Correlation Engine × 3-Tier Market</span>} />

          <div style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}` }}>
            {GEO_GROUPS.map(g => {
              const groupSeries = ALL_SERIES.filter(s => s.group === g.key);
              return (
                <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: g.key !== "msa" ? 4 : 0 }}>
                  <span style={{ fontSize: 7, fontFamily: T.font.mono, color: g.color, letterSpacing: "0.06em", width: 110, fontWeight: 700 }}>{g.label}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {groupSeries.map(s => (
                      <div key={s.key} onClick={() => toggleSeries(s.key)} style={{
                        display: "flex", alignItems: "center", gap: 3, padding: "2px 5px",
                        background: activeSeries[s.key] ? `${s.color}15` : T.bg.input,
                        border: `1px solid ${activeSeries[s.key] ? `${s.color}50` : T.border.subtle}`,
                        borderRadius: 2, cursor: "pointer", transition: "all 0.15s",
                        opacity: activeSeries[s.key] ? 1 : 0.35,
                      }}>
                        {lineStylePreview(s.dashArray, s.color)}
                        <span style={{ fontSize: 6.5, fontFamily: T.font.mono, fontWeight: 600, color: activeSeries[s.key] ? s.color : T.text.muted, letterSpacing: "0.03em" }}>
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ height: 420, padding: "0 4px" }}>
            <IndexedChart />
          </div>
        </div>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="5-YEAR OUTLOOK — CORRELATION-DRIVEN FORECAST" subtitle="Rents · Occupancy · Rent Growth · 2025→2030" icon="⚡" borderColor={T.text.purple} />

          {FIVE_YEAR_OUTLOOK.map((outlook, oi) => {
            const dirColor = outlook.direction === "up" ? T.text.green : outlook.direction === "down" ? T.text.red : T.text.amber;
            const dirIcon = outlook.direction === "up" ? "▲" : outlook.direction === "down" ? "▼" : "═";
            return (
              <div key={oi} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                <div style={{ display: "flex", alignItems: "stretch" }}>
                  <div style={{ flex: "0 0 180px", padding: "10px 12px", borderRight: `1px solid ${T.border.subtle}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, color: dirColor }}>{dirIcon}</span>
                      <span style={{ fontSize: 11, fontFamily: T.font.mono, fontWeight: 800, color: T.text.white, letterSpacing: "0.05em" }}>{outlook.metric}</span>
                    </div>
                    <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.muted }}>5yr delta</div>
                    <div style={{ fontSize: 14, fontFamily: T.font.mono, fontWeight: 800, color: dirColor }}>{outlook.delta5yr}</div>
                  </div>

                  <div style={{ flex: "0 0 320px", display: "flex", alignItems: "center", padding: "10px 0", borderRight: `1px solid ${T.border.subtle}` }}>
                    {[
                      { label: "NOW", value: outlook.current, year: "2025", color: T.text.amber },
                      { label: "YR 1", value: outlook.yr1, year: "2026", color: T.text.primary },
                      { label: "YR 3", value: outlook.yr3, year: "2028", color: T.text.cyan },
                      { label: "YR 5", value: outlook.yr5, year: "2030", color: dirColor },
                    ].map((step, si) => (
                      <div key={si} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                        <div style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted, marginBottom: 2 }}>{step.label}</div>
                        <div style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: step.color }}>{step.value}</div>
                        <div style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted, marginTop: 1 }}>{step.year}</div>
                        {si < 3 && <span style={{ position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: T.text.muted }}>→</span>}
                      </div>
                    ))}
                  </div>

                  <div style={{ flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <Badge color={dirColor}>{outlook.direction === "up" ? "BULLISH" : outlook.direction === "down" ? "BEARISH" : "NEUTRAL"}</Badge>
                      <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.purple }}>{outlook.signal}</span>
                    </div>
                    <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.secondary, lineHeight: 1.5 }}>
                      {outlook.narrative}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ padding: "6px 12px", background: T.bg.panelAlt, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, fontWeight: 700 }}>CORRELATIONS USED:</span>
            {topCorrelations.slice(0, 6).map((c, i) => (
              <span key={i} style={{ fontSize: 7, fontFamily: T.font.mono, color: corrColor(c.r) }}>
                {c.metricA}↔{c.metricB} r={c.r > 0 ? "+" : ""}{c.r.toFixed(2)}
              </span>
            ))}
          </div>
        </div>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="COMBINED DATA TABLE" subtitle="Property + Trade Area + Submarket + MSA" icon="≡" borderColor={T.text.amber} />
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...cellStyle(false, true), position: "sticky", left: 0, zIndex: 3, background: T.bg.header, textAlign: "center", minWidth: 42 }}>YR</th>
                  <th colSpan={propCols.length} style={{ ...cellStyle(false, true), textAlign: "center", color: T.text.amber, borderBottom: `2px solid ${T.text.amber}` }}>PROPERTY</th>
                  {geoLabels.map(g => (
                    <th key={g.dataKey} colSpan={geoCols.length} style={{ ...cellStyle(false, true), textAlign: "center", color: g.color, borderBottom: `2px solid ${g.color}` }}>{g.label}</th>
                  ))}
                </tr>
                <tr>
                  {propCols.map(c => (
                    <th key={`ph-${c.key}`} style={{ ...cellStyle(false, true), fontSize: 7, color: T.text.secondary, textAlign: "center", minWidth: 52 }}>{c.label}</th>
                  ))}
                  {geoLabels.map(g => geoCols.map(c => (
                    <th key={`${g.dataKey}-${c.key}`} style={{ ...cellStyle(false, true), fontSize: 7, color: T.text.secondary, textAlign: "center", minWidth: 52 }}>{c.label}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {PROP_ALL.map((p, ri) => {
                  const isFc = p.year > 2025;
                  const ta = taByYear[p.year];
                  const sub = subByYear[p.year];
                  const msa = msaByYear[p.year];
                  const conf = (p as any).conf;
                  return (
                    <tr key={p.year} style={{ background: ri % 2 === 0 ? "transparent" : `${T.bg.panelAlt}` }}>
                      <td style={{ ...cellStyle(isFc), position: "sticky", left: 0, zIndex: 2, background: ri % 2 === 0 ? T.bg.panel : T.bg.panelAlt, fontWeight: 700, textAlign: "center", color: isFc ? T.text.cyan : T.text.amber }}>
                        {p.year}
                        {isFc && conf && <span style={{ fontSize: 6, color: T.text.muted, marginLeft: 2 }}>{Math.round(conf * 100)}%</span>}
                      </td>
                      {propCols.map(c => {
                        const val = (p as any)[c.key];
                        const display = val != null ? c.fmt(val) : "—";
                        return (
                          <td key={`p-${c.key}`} style={{ ...cellStyle(isFc), color: c.color && val != null ? growthColor(val) : isFc ? T.text.cyan : T.text.primary }}>
                            {display}
                          </td>
                        );
                      })}
                      {[{ data: ta }, { data: sub }, { data: msa }].map((geo, gi) => (
                        geoCols.map(c => {
                          const val = geo.data ? (geo.data as any)[c.key] : null;
                          const display = val != null ? c.fmt(val) : "—";
                          return (
                            <td key={`g${gi}-${c.key}`} style={{ ...cellStyle(isFc), color: c.color && val != null ? growthColor(val) : isFc ? T.text.cyan : T.text.primary }}>
                              {display}
                            </td>
                          );
                        })
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { title: "CROSS-GEO OCCUPANCY", color: T.text.cyan, lines: [
              `Property ${pct(PROP_ALL[7].occ)} vs TA ${pct(TRADE_AREA[7].occupancy)} vs Sub ${pct(SUBMARKET[7].occupancy)} vs MSA ${pct(MSA[7].occupancy)}`,
              PROP_ALL[7].occ > SUBMARKET[7].occupancy ? "Property outperforming submarket occupancy" : "Property below submarket occupancy",
            ]},
            { title: "INCOME vs RENT BURDEN", color: T.text.purple, lines: [
              `TA median $${kFmt(TRADE_AREA[7].medianIncome)} · Sub $${kFmt(SUBMARKET[7].medianIncome)} · MSA $${kFmt(MSA[7].medianIncome)}`,
              `Rent-to-income: ${((PROP_ALL[7].rent * 12 / TRADE_AREA[7].medianIncome) * 100).toFixed(1)}% (TA) — ${((PROP_ALL[7].rent * 12 / TRADE_AREA[7].medianIncome) * 100) < 30 ? "affordable" : "stretching"}`,
            ]},
            { title: "JOBS & DEMAND", color: T.text.blue, lines: [
              `Jobs/unit: TA ${TRADE_AREA[7].jobsPerUnit.toFixed(2)} · Sub ${SUBMARKET[7].jobsPerUnit.toFixed(2)} · MSA ${MSA[7].jobsPerUnit.toFixed(2)}`,
              `Pop growth: TA ${pct(TRADE_AREA[7].popGrowth)} · Sub ${pct(SUBMARKET[7].popGrowth)} · MSA ${pct(MSA[7].popGrowth)}`,
            ]},
          ].map((card, ci) => (
            <div key={ci} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2, borderLeft: `2px solid ${card.color}` }}>
              <div style={{ padding: "5px 8px", borderBottom: `1px solid ${T.border.subtle}` }}>
                <span style={{ fontSize: 8, fontFamily: T.font.mono, fontWeight: 700, color: card.color, letterSpacing: "0.06em" }}>{card.title}</span>
              </div>
              <div style={{ padding: "6px 8px" }}>
                {card.lines.map((line, li) => (
                  <div key={li} style={{ fontSize: 8, fontFamily: T.font.mono, color: li === 0 ? T.text.secondary : T.text.green, marginBottom: 2 }}>{line}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "6px 10px", background: T.bg.panelAlt, borderRadius: 2, border: `1px solid ${T.border.subtle}` }}>
          <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.secondary, marginBottom: 4 }}>
            <span style={{ color: T.text.amber, fontWeight: 700 }}>GEO SUMMARY:</span>{" "}
            Property occ {pct(PROP_ALL[7].occ)} vs TA {pct(TRADE_AREA[7].occupancy)} vs Sub {pct(SUBMARKET[7].occupancy)} vs MSA {pct(MSA[7].occupancy)} —{" "}
            <span style={{ color: T.text.green, fontWeight: 600 }}>property occupancy leads submarket</span>.{" "}
            TA rent growth +{pct(TRADE_AREA[7].rentGrowth)} outpaces MSA.{" "}
            Cap rates: TA {pct(TRADE_AREA[7].capRate)} vs Sub {pct(SUBMARKET[7].capRate)} vs MSA {pct(MSA[7].capRate)}.
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>
            <span>■ Solid = property</span>
            <span style={{ letterSpacing: 2 }}>■■■ Dotted = trade area</span>
            <span>— — Dashed = submarket</span>
            <span>—·— Dash-dot = MSA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Combined;
