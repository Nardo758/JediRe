import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { TerminalChrome } from "../components/terminal/TerminalChrome";
import { useTheme } from "../contexts/ThemeContext";
import { apiClient } from "../services/api.client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function classFromCode(code?: string | null): string {
  if (!code) return "B";
  const c = code.toUpperCase();
  if (["C5", "C6", "A"].includes(c)) return "A";
  if (["C4", "B"].includes(c)) return "B";
  if (["C3", "C"].includes(c)) return "C";
  return c;
}

function pcFmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function pcFmtCapRate(v: number | null): string {
  return v != null ? `${(Number(v) * 100).toFixed(2)}%` : '—';
}
function pcComputeOutlierIds(comps: any[]): Set<string> {
  const rates = comps
    .map(c => (c.implied_cap_rate != null ? Number(c.implied_cap_rate) : null))
    .filter((r): r is number => r != null && !isNaN(r));
  if (rates.length < 4) return new Set();
  const sorted = [...rates].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return new Set();
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return new Set(
    comps
      .filter(c => c.implied_cap_rate != null && (Number(c.implied_cap_rate) < lo || Number(c.implied_cap_rate) > hi))
      .map(c => String(c.id))
  );
}

function mapRealProperty(real: any, navName?: string) {
  if (!real) return null;
  const className = real.building_class || classFromCode(real.class_code);
  const units = real.units || null;
  const lastSale = Array.isArray(real.sales) && real.sales.length > 0 ? real.sales[0] : null;
  // Identity fields (id/name/address/city/state/zip/county/submarket/owner/lat/lng) intentionally
  // use null (not "—" or "Unnamed Property") so the merge logic can leave them empty rather
  // than overlaying mock defaults. Nav state is consulted only when DB-derived name is empty.
  return {
    id: real.id || real.parcel_id || null,
    parcelId: real.parcel_id || null,
    name: real.subdivision || real.address || navName || null,
    address: real.address || null,
    city: real.city || null,
    state: real.state || null,
    zip: real.zip_code || null,
    county: real.county || null,
    submarket: real.submarket_name || null,
    units,
    yearBuilt: real.year_built || null,
    stories: real.stories || null,
    buildingSF: real.building_sqft || null,
    lotSizeAc: real.land_acres || null,
    lotSizeSF: real.parcel_area_sqft || null,
    avgUnitSF: units && real.building_sqft ? Math.round(real.building_sqft / units) : null,
    class: className,
    type: real.property_type || "Multifamily",
    owner: real.owner_name || null,
    justValue2025: real.appraised_value || null,
    assessedValue2025: real.assessed_value || null,
    estimatedRent: real.estimated_rent || null,
    pricePerUnit: real.price_per_unit || null,
    lat: real.lat || null,
    lng: real.lng || null,
    lastSalePrice: lastSale?.sale_price || null,
    acquisitionDate: lastSale?.sale_date || null,
    holdPeriod: real.hold_period || null,
    sellerMotivationScore: real.seller_motivation_score || null,
  };
}

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117",topBar:"#050810",photo:"#080B12",chart:"#0B0F18" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",amberBright:"#FFD166",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF",blue:"#4A9EFF",teal:"#14B8A6" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace",display:"'IBM Plex Mono',monospace",label:"'IBM Plex Sans',sans-serif" },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes glow{0%,100%{box-shadow:0 0 4px #00D26A44}50%{box-shadow:0 0 10px #00D26A66}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
@keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes scanline{0%{top:-100%}100%{top:100%}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes sweepIn{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes drawLine{from{stroke-dashoffset:2000}to{stroke-dashoffset:0}}
*{scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17;box-sizing:border-box}
*::-webkit-scrollbar{width:5px;height:5px}
*::-webkit-scrollbar-track{background:#0A0E17}
*::-webkit-scrollbar-thumb{background:#2A3348;border-radius:2px}
`;

// ─── MOCK PROPERTY DATA ──────────────────────────────────────
const PROPERTY = {
  id: "P-TPA-00247",
  name: "Westshore Commons",
  address: "4201 W Boy Scout Blvd",
  city: "Tampa",
  state: "FL",
  zip: "33607",
  county: "Hillsborough",
  market: "Tampa MSA",
  submarket: "Westshore",
  type: "MULTIFAMILY",
  subtype: "Garden Style",
  class: "B+",
  yearBuilt: 2004,
  yearRenovated: 2019,
  units: 248,
  stories: 3,
  lotSizeSF: 287_540,
  lotSizeAc: 6.6,
  buildingSF: 224_640,
  avgUnitSF: 906,
  parking: { total: 372, ratio: 1.5, type: "Surface + Covered" },
  amenities: ["Pool","Fitness","Dog Park","Business Center","Package Lockers","EV Charging"],
  owner: "Westshore Holdings LLC",
  ownerType: "LLC / Entity",
  acquisitionDate: "2019-03-15",
  acquisitionPrice: 32_200_000,
  lastSalePrice: 32_200_000,
  justValue2025: 38_800_000,
  assessedValue2025: 35_100_000,
  taxableValue2025: 35_100_000,
  millageRate: 21.4536,
  annualTax2025: 753_000,
  homesteadExempt: false,
  assessmentCap: "10% Non-Homestead",
  currentOccupancy: 93.5,
  avgEffectiveRent: 1_842,
  avgMarketRent: 1_908,
  rentPerSF: 2.03,
  concessions: "1 mo free on 14-mo lease",
  noiTrailing12: 2_680_000,
  capRateImplied: 6.92,
  expenseRatio: 48.2,
  submarketVacancy: 8.5,
  submarketRentGrowth: 3.0,
  submarketAbsorption: 11_658,
  walkScore: 62,
  transitScore: 44,
  bikeScore: 51,
  zoning: "PD-C",
  zoningDesc: "Planned Development – Commercial",
  maxDensity: "18 DU/ac",
  maxHeight: "65 ft",
  far: 2.0,
  zoningSource: "Municode §27-156",
  inPipeline: false,
  dealId: null,
  photos: [
    { id: 1, label: "Exterior", aspect: "16:9", color: "#1a2744" },
    { id: 2, label: "Pool Area", aspect: "16:9", color: "#1a3a2a" },
    { id: 3, label: "Fitness Center", aspect: "16:9", color: "#2a1a3a" },
    { id: 4, label: "Unit Interior", aspect: "16:9", color: "#3a2a1a" },
    { id: 5, label: "Kitchen", aspect: "16:9", color: "#1a3a3a" },
    { id: 6, label: "Aerial View", aspect: "16:9", color: "#2a2a1a" },
    { id: 7, label: "Lobby", aspect: "16:9", color: "#1a2a3a" },
    { id: 8, label: "Parking", aspect: "16:9", color: "#2a1a2a" },
  ],
  // Unit Mix
  unitMix: [
    { type: "Studio", units: 24, sf: 520, rent: 1_385, pct: 9.7 },
    { type: "1BR/1BA", units: 96, sf: 748, rent: 1_695, pct: 38.7 },
    { type: "2BR/2BA", units: 88, sf: 1_048, rent: 2_025, pct: 35.5 },
    { type: "3BR/2BA", units: 40, sf: 1_320, rent: 2_410, pct: 16.1 },
  ],
  concessionValue: 7.1, // % of GPR
  monthlyTraffic: 24_500,
  // Market position at 3 geographic levels
  marketPosition: {
    tradeArea: { rent: 1_872, vacancy: 7.8, concessions: 5.2, traffic: 22_100, rentGrowth: 3.4 },
    submarket:  { rent: 1_908, vacancy: 8.5, concessions: 6.8, traffic: 19_800, rentGrowth: 3.0 },
    msa:        { rent: 1_762, vacancy: 7.2, concessions: 5.9, traffic: 18_400, rentGrowth: 2.6 },
  },
  // 10-Year Market Data — 5yr history + 5yr forecast
  marketHistory: [
    { year: 2021, vacancy: 5.2, rentGrowth: 12.8, avgRent: 1_580, absorption: 14_200, inventory: 28_400, newSupply: 820, pipelinePct: 2.9, popGrowth: 2.8, hhIncome: 68_400, renterPct: 55.2, empGrowth: 5.1, walkScore: 58, transitScore: 40, bikeScore: 48, demandScore: 92 },
    { year: 2022, vacancy: 6.8, rentGrowth: 10.3, avgRent: 1_742, absorption: 12_800, inventory: 29_220, newSupply: 1_180, pipelinePct: 4.0, popGrowth: 2.4, hhIncome: 71_200, renterPct: 56.1, empGrowth: 4.2, walkScore: 59, transitScore: 41, bikeScore: 49, demandScore: 90 },
    { year: 2023, vacancy: 8.1, rentGrowth: 3.2, avgRent: 1_798, absorption: 10_400, inventory: 30_400, newSupply: 1_640, pipelinePct: 5.4, popGrowth: 2.2, hhIncome: 73_800, renterPct: 56.8, empGrowth: 3.6, walkScore: 60, transitScore: 42, bikeScore: 50, demandScore: 88 },
    { year: 2024, vacancy: 8.8, rentGrowth: 1.3, avgRent: 1_822, absorption: 9_800, inventory: 32_040, newSupply: 1_920, pipelinePct: 6.0, popGrowth: 2.0, hhIncome: 75_900, renterPct: 57.4, empGrowth: 3.0, walkScore: 61, transitScore: 43, bikeScore: 50, demandScore: 86 },
    { year: 2025, vacancy: 8.5, rentGrowth: 1.1, avgRent: 1_842, absorption: 11_658, inventory: 33_960, newSupply: 1_240, pipelinePct: 4.2, popGrowth: 2.1, hhIncome: 78_200, renterPct: 58.0, empGrowth: 3.2, walkScore: 62, transitScore: 44, bikeScore: 51, demandScore: 88 },
  ],
  marketForecast: [
    { year: 2026, vacancy: 8.0, rentGrowth: 2.8, avgRent: 1_894, absorption: 12_400, inventory: 35_200, newSupply: 1_380, pipelinePct: 3.9, popGrowth: 2.0, hhIncome: 80_200, renterPct: 58.4, empGrowth: 3.0, walkScore: 63, transitScore: 45, bikeScore: 52, demandScore: 89, conf: 0.88 },
    { year: 2027, vacancy: 7.4, rentGrowth: 3.2, avgRent: 1_954, absorption: 13_200, inventory: 36_580, newSupply: 860, pipelinePct: 2.4, popGrowth: 1.9, hhIncome: 82_400, renterPct: 58.8, empGrowth: 2.8, walkScore: 64, transitScore: 47, bikeScore: 53, demandScore: 90, conf: 0.80 },
    { year: 2028, vacancy: 6.8, rentGrowth: 3.5, avgRent: 2_022, absorption: 14_000, inventory: 37_440, newSupply: 620, pipelinePct: 1.7, popGrowth: 1.8, hhIncome: 84_600, renterPct: 59.1, empGrowth: 2.6, walkScore: 65, transitScore: 48, bikeScore: 54, demandScore: 91, conf: 0.72 },
    { year: 2029, vacancy: 6.5, rentGrowth: 3.0, avgRent: 2_083, absorption: 13_600, inventory: 38_060, newSupply: 940, pipelinePct: 2.5, popGrowth: 1.7, hhIncome: 86_800, renterPct: 59.4, empGrowth: 2.4, walkScore: 66, transitScore: 49, bikeScore: 55, demandScore: 90, conf: 0.63 },
    { year: 2030, vacancy: 7.0, rentGrowth: 2.4, avgRent: 2_133, absorption: 12_800, inventory: 39_000, newSupply: 1_100, pipelinePct: 2.8, popGrowth: 1.6, hhIncome: 89_000, renterPct: 59.6, empGrowth: 2.2, walkScore: 67, transitScore: 50, bikeScore: 56, demandScore: 89, conf: 0.55 },
  ],
  incomeExpense: [
    { year: 2021, gpr: 4_702_080, vacLoss: 404_379, egi: 4_297_701, opex: 2_101_975, noi: 2_020_000, expRatio: 48.9 },
    { year: 2022, gpr: 5_186_112, vacLoss: 321_539, egi: 4_864_573, opex: 2_296_153, noi: 2_480_000, expRatio: 47.2 },
    { year: 2023, gpr: 5_352_672, vacLoss: 315_808, egi: 5_036_864, opex: 2_397_542, noi: 2_590_000, expRatio: 47.6 },
    { year: 2024, gpr: 5_424_096, vacLoss: 379_687, egi: 5_044_409, opex: 2_421_316, noi: 2_620_000, expRatio: 48.0 },
    { year: 2025, gpr: 5_483_616, vacLoss: 356_435, egi: 5_127_181, opex: 2_471_293, noi: 2_680_000, expRatio: 48.2 },
  ],
  rentComps: [
    { name: "Bay Club at Westshore", units: 312, rent: 1_955, dist: "0.4 mi", class: "A-", occ: 94.1, yearBuilt: 2008, stories: 4, concessions: 4.2, monthlyTraffic: 26_200,
      unitMix: [{ type: "Studio", units: 28, sf: 510, rent: 1_440 }, { type: "1BR/1BA", units: 124, sf: 730, rent: 1_795 }, { type: "2BR/2BA", units: 112, sf: 1_060, rent: 2_140 }, { type: "3BR/2BA", units: 48, sf: 1_340, rent: 2_580 }] },
    { name: "ARIUM Westshore", units: 280, rent: 1_878, dist: "0.6 mi", class: "B+", occ: 92.8, yearBuilt: 2006, stories: 3, concessions: 6.5, monthlyTraffic: 21_800,
      unitMix: [{ type: "Studio", units: 20, sf: 495, rent: 1_350 }, { type: "1BR/1BA", units: 112, sf: 740, rent: 1_720 }, { type: "2BR/2BA", units: 100, sf: 1_020, rent: 2_060 }, { type: "3BR/2BA", units: 48, sf: 1_290, rent: 2_440 }] },
    { name: "Camden Westchase", units: 340, rent: 1_812, dist: "1.1 mi", class: "B", occ: 95.2, yearBuilt: 2001, stories: 3, concessions: 2.8, monthlyTraffic: 18_400,
      unitMix: [{ type: "Studio", units: 0, sf: 0, rent: 0 }, { type: "1BR/1BA", units: 136, sf: 720, rent: 1_610 }, { type: "2BR/2BA", units: 136, sf: 1_000, rent: 1_945 }, { type: "3BR/2BA", units: 68, sf: 1_280, rent: 2_280 }] },
    { name: "Cortland Bayport", units: 196, rent: 1_924, dist: "1.3 mi", class: "A-", occ: 91.6, yearBuilt: 2016, stories: 4, concessions: 8.1, monthlyTraffic: 15_600,
      unitMix: [{ type: "Studio", units: 18, sf: 530, rent: 1_410 }, { type: "1BR/1BA", units: 78, sf: 760, rent: 1_780 }, { type: "2BR/2BA", units: 72, sf: 1_080, rent: 2_110 }, { type: "3BR/2BA", units: 28, sf: 1_350, rent: 2_520 }] },
    { name: "Modera Westshore", units: 264, rent: 2_108, dist: "0.8 mi", class: "A", occ: 89.3, yearBuilt: 2021, stories: 5, concessions: 9.4, monthlyTraffic: 28_100,
      unitMix: [{ type: "Studio", units: 36, sf: 545, rent: 1_590 }, { type: "1BR/1BA", units: 108, sf: 780, rent: 1_960 }, { type: "2BR/2BA", units: 84, sf: 1_100, rent: 2_320 }, { type: "3BR/2BA", units: 36, sf: 1_380, rent: 2_710 }] },
  ],
  saleComps: [
    { name: "Villas at Gateway", units: 220, ppu: 168_000, capRate: 5.8, date: "2025-11", dist: "1.2 mi" },
    { name: "Palms at Gandy", units: 186, ppu: 152_000, capRate: 6.1, date: "2025-08", dist: "2.1 mi" },
    { name: "Reserve at Westshore", units: 304, ppu: 178_000, capRate: 5.5, date: "2025-06", dist: "0.3 mi" },
  ],
  ownershipHistory: [
    { date: "2019-03", buyer: "Westshore Holdings LLC", price: 32_200_000, ppu: 129_839 },
    { date: "2014-07", buyer: "SE Multifamily Fund II", price: 24_800_000, ppu: 100_000 },
    { date: "2004-01", buyer: "Original Developer LLC", price: 18_600_000, ppu: 75_000 },
  ],
  taxHistory: [
    { year: 2025, justValue: 38_800_000, assessed: 35_100_000, tax: 753_000, saleDate: null },
    { year: 2024, justValue: 36_200_000, assessed: 33_800_000, tax: 725_000, saleDate: null },
    { year: 2023, justValue: 34_500_000, assessed: 32_200_000, tax: 691_000, saleDate: null },
    { year: 2022, justValue: 31_800_000, assessed: 30_600_000, tax: 656_000, saleDate: null },
    { year: 2021, justValue: 28_400_000, assessed: 27_300_000, tax: 586_000, saleDate: null },
    { year: 2019, justValue: 26_100_000, assessed: 25_800_000, tax: 554_000, saleDate: "2019-03-15" },
    { year: 2014, justValue: 20_200_000, assessed: 19_800_000, tax: 425_000, saleDate: "2014-07-22" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// M07 TRAFFIC ENGINE — HISTORICAL & PROJECTED DATA
// FDOT AADT + Layer 2 Temporal + Layer 3 Digital
// ═══════════════════════════════════════════════════════════════
const TRAFFIC_DATA = {
  stationId: "FDOT-0934",
  stationDist: "0.3 mi",
  roadName: "W Boy Scout Blvd",
  roadClass: "Urban Arterial",
  frontageType: "Corner lot (2 roads)",
  // Layer 1: FDOT AADT historical (annual)
  aadtHistory: [
    { year: 2018, aadt: 21_200 },
    { year: 2019, aadt: 21_800 },
    { year: 2020, aadt: 18_400 }, // COVID dip
    { year: 2021, aadt: 20_900 },
    { year: 2022, aadt: 22_600 },
    { year: 2023, aadt: 23_400 },
    { year: 2024, aadt: 24_100 },
    { year: 2025, aadt: 24_500 },
  ],
  // Effective ADT after M07 adjustments
  effectiveAdtHistory: [
    { year: 2018, adt: 19_776 },
    { year: 2019, adt: 20_336 },
    { year: 2020, adt: 17_164 },
    { year: 2021, adt: 19_496 },
    { year: 2022, adt: 21_082 },
    { year: 2023, adt: 21_829 },
    { year: 2024, adt: 22_481 },
    { year: 2025, adt: 22_918 },
  ],
  // Layer 1 adjustment factors applied
  adjustments: {
    distanceDecay: 0.955, // 0.3mi → 1 - (0.3 × 0.15) = 0.955
    roadClassWeight: 0.70, // Urban arterial
    frontageFactor: 1.40, // Corner lot
    combinedMultiplier: 0.934, // 0.955 × 0.70 × 1.40
  },
  // Layer 2: Hourly distribution (K-factors from FDOT continuous station)
  hourlyDistribution: [
    { hour: "6a", pct: 4.2, vol: 1_030 },
    { hour: "7a", pct: 6.1, vol: 1_495 },
    { hour: "8a", pct: 7.8, vol: 1_912 },
    { hour: "9a", pct: 5.9, vol: 1_446 },
    { hour: "10a", pct: 5.2, vol: 1_275 },
    { hour: "11a", pct: 5.8, vol: 1_422 },
    { hour: "12p", pct: 6.5, vol: 1_594 },
    { hour: "1p", pct: 6.2, vol: 1_520 },
    { hour: "2p", pct: 6.0, vol: 1_471 },
    { hour: "3p", pct: 7.2, vol: 1_765 },
    { hour: "4p", pct: 8.1, vol: 1_986 },
    { hour: "5p", pct: 8.8, vol: 2_157 },
    { hour: "6p", pct: 6.8, vol: 1_667 },
    { hour: "7p", pct: 5.1, vol: 1_250 },
    { hour: "8p", pct: 4.1, vol: 1_005 },
    { hour: "9p", pct: 3.2, vol: 785 },
    { hour: "10p", pct: 2.5, vol: 613 },
    { hour: "11p", pct: 1.8, vol: 441 },
  ],
  // Layer 2: Seasonal factors (SE Florida)
  seasonalFactors: [
    { month: "Jan", factor: 1.12 }, { month: "Feb", factor: 1.15 },
    { month: "Mar", factor: 1.18 }, { month: "Apr", factor: 1.08 },
    { month: "May", factor: 1.02 }, { month: "Jun", factor: 0.94 },
    { month: "Jul", factor: 0.92 }, { month: "Aug", factor: 0.91 },
    { month: "Sep", factor: 0.93 }, { month: "Oct", factor: 0.97 },
    { month: "Nov", factor: 1.04 }, { month: "Dec", factor: 1.08 },
  ],
  // Layer 3: Digital signals (SpyFu / Google search momentum)
  digitalSignals: {
    searchMomentumQoQ: 0.18, // +18% QoQ
    searchVolumeMonthly: 4_200,
    topKeywords: ["apartments westshore tampa", "westshore rentals", "boy scout blvd apartments"],
    competitorShareOfVoice: 0.14, // 14% of submarket digital
    trend: "RISING",
  },
  // T-outputs (computed)
  outputs: {
    t01_weeklyWalkIns: 16.7,
    t02_physicalScore: 76,
    t03_digitalScore: 68,
    t04_quadrant: "VALIDATED_WINNER", // High physical + Rising digital
    t05_trafficToLease: 0.23, // 23% of walk-ins convert to lease
    t06_captureRate: 0.038, // 3.8% of effective ADT is seeker traffic
    t07_trajectory: 0.191, // +19.1% trajectory signal
    t07_pattern: "DEMAND_SURGE",
    t10_confidence: 0.82, // 82% validation confidence
  },
  // Projected AADT (T-07 trajectory forward)
  aadtProjected: [
    { year: 2026, aadt: 25_200, conf: 0.88 },
    { year: 2027, aadt: 26_100, conf: 0.82 },
    { year: 2028, aadt: 27_000, conf: 0.75 },
    { year: 2029, aadt: 27_700, conf: 0.68 },
    { year: 2030, aadt: 28_300, conf: 0.62 },
    { year: 2031, aadt: 28_800, conf: 0.55 },
    { year: 2032, aadt: 29_200, conf: 0.49 },
    { year: 2033, aadt: 29_500, conf: 0.43 },
    { year: 2034, aadt: 29_700, conf: 0.38 },
    { year: 2035, aadt: 29_900, conf: 0.34 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// HISTORICAL PERFORMANCE DATA
// Rents, Occupancy, Concessions, Rent Growth, NOI
// ═══════════════════════════════════════════════════════════════
const PERFORMANCE_HISTORY = [
  { year: 2018, rent: 1_420, occ: 94.8, concessions: 0.5, rentGrowth: 3.2, noi: 1_980_000, rentPerSF: 1.57, expRatio: 46.1 },
  { year: 2019, rent: 1_488, occ: 95.2, concessions: 0.0, rentGrowth: 4.8, noi: 2_140_000, rentPerSF: 1.64, expRatio: 45.8 },
  { year: 2020, rent: 1_465, occ: 88.6, concessions: 6.2, rentGrowth: -1.5, noi: 1_740_000, rentPerSF: 1.62, expRatio: 51.3 },
  { year: 2021, rent: 1_580, occ: 91.4, concessions: 3.8, rentGrowth: 7.8, noi: 2_020_000, rentPerSF: 1.74, expRatio: 48.9 },
  { year: 2022, rent: 1_742, occ: 93.8, concessions: 1.2, rentGrowth: 10.3, noi: 2_480_000, rentPerSF: 1.92, expRatio: 47.2 },
  { year: 2023, rent: 1_798, occ: 94.1, concessions: 0.8, rentGrowth: 3.2, noi: 2_590_000, rentPerSF: 1.98, expRatio: 47.6 },
  { year: 2024, rent: 1_822, occ: 93.0, concessions: 2.4, rentGrowth: 1.3, noi: 2_620_000, rentPerSF: 2.01, expRatio: 48.0 },
  { year: 2025, rent: 1_842, occ: 93.5, concessions: 2.8, rentGrowth: 1.1, noi: 2_680_000, rentPerSF: 2.03, expRatio: 48.2 },
];

// ═══════════════════════════════════════════════════════════════
// CORRELATION ENGINE — 10-YEAR FORECAST
// Uses COR-01 through COR-13 lead/lag relationships
// Traffic surge → occupancy (2-4mo) → rent growth (3-6mo) → NOI
// ═══════════════════════════════════════════════════════════════
function generateForecast(history, trafficProjected) {
  const lastPerf = history[history.length - 1];
  const forecasts = [];

  // Correlation-derived growth rates per year
  // COR-01: Traffic surge +19.1% → rent growth acceleration 3-6mo (r=0.65)
  // COR-04: Wage growth 3.2% → rent ceiling ~4% sustainable
  // COR-05: Traffic surge → vacancy drop 2-4mo (r=-0.60)
  // COR-06: Pipeline 4.2% < 8% threshold → minimal supply drag
  // COR-13: Rent-to-income at ~28% → runway to 30% before ceiling
  
  const baseRentGrowth = 0.030; // 3.0% submarket baseline
  const trafficBoost = 0.008; // COR-01: traffic surge adds ~80bps
  const wageConstraint = 0.042; // COR-04: wage ceiling ~4.2%
  const supplyDrag = -0.002; // COR-06: 4.2% pipeline minimal drag
  
  let rent = lastPerf.rent;
  let occ = lastPerf.occ;
  let concessions = lastPerf.concessions;
  let noi = lastPerf.noi;
  let expRatio = lastPerf.expRatio;
  let rentPerSF = lastPerf.rentPerSF;

  for (let i = 0; i < 10; i++) {
    const yr = 2026 + i;
    const trafficGrowth = trafficProjected[i] ? 
      (trafficProjected[i].aadt - (trafficProjected[i-1]?.aadt || TRAFFIC_DATA.aadtHistory[TRAFFIC_DATA.aadtHistory.length-1].aadt)) / 
      (trafficProjected[i-1]?.aadt || TRAFFIC_DATA.aadtHistory[TRAFFIC_DATA.aadtHistory.length-1].aadt) : 0.02;
    
    const conf = trafficProjected[i]?.conf || 0.30;
    
    // COR-01: Traffic surge → rent growth (lead 3-6mo)
    // Decaying boost as traffic growth normalizes
    const trafficRentBoost = Math.max(0, trafficBoost * (1 - i * 0.08));
    
    // COR-05: Traffic growth → occupancy improvement (lead 2-4mo)  
    const occDelta = trafficGrowth > 0.02 ? 0.3 : trafficGrowth > 0 ? 0.1 : -0.2;
    occ = Math.min(96.5, Math.max(88, occ + occDelta - (i > 5 ? 0.15 : 0)));
    
    // COR-13: Rent-to-income ceiling (assumes $78,200 HHI growing 2.5%/yr)
    const projectedHHI = 78_200 * Math.pow(1.025, i);
    const rentToIncome = (rent * 12) / projectedHHI;
    const affordabilityCap = rentToIncome > 0.32 ? -0.015 : rentToIncome > 0.30 ? -0.008 : 0;
    
    // Composite rent growth (capped by wage growth + affordability)
    let rentGrowthRate = Math.min(
      wageConstraint,
      baseRentGrowth + trafficRentBoost + supplyDrag + affordabilityCap
    );
    
    // Add mean reversion pressure after year 5
    if (i > 4) rentGrowthRate *= (1 - (i - 4) * 0.04);
    rentGrowthRate = Math.max(0.008, rentGrowthRate); // Floor at 0.8%
    
    rent = Math.round(rent * (1 + rentGrowthRate));
    rentPerSF = parseFloat((rent / 906).toFixed(2));
    
    // Concessions: inversely related to occupancy (COR-05 downstream)
    concessions = occ > 94 ? 0.5 : occ > 92 ? 1.8 : occ > 90 ? 3.5 : 5.0;
    concessions += i > 6 ? 0.8 : 0; // Slight increase in late years
    
    // Expense ratio: slow drift upward (insurance, property tax pressure in FL)
    expRatio = Math.min(52, expRatio + 0.15 + (i > 5 ? 0.1 : 0));
    
    // NOI: derived from rent × units × occupancy × (1 - expense ratio)
    const egi = rent * 12 * 248 * (occ / 100) * (1 - concessions / 100);
    noi = Math.round(egi * (1 - expRatio / 100));

    forecasts.push({
      year: yr,
      rent: Math.round(rent),
      occ: parseFloat(occ.toFixed(1)),
      concessions: parseFloat(concessions.toFixed(1)),
      rentGrowth: parseFloat((rentGrowthRate * 100).toFixed(1)),
      noi,
      rentPerSF,
      expRatio: parseFloat(expRatio.toFixed(1)),
      confidence: conf,
      rentToIncome: parseFloat((rentToIncome * 100).toFixed(1)),
      trafficAadt: trafficProjected[i]?.aadt || 0,
    });
  }
  return forecasts;
}

// ═══════════════════════════════════════════════════════════════
// GEO-LEVEL DATA — TRADE AREA · SUBMARKET · MSA
// Derived from CoStar · FRED · BLS · Census ACS
// ═══════════════════════════════════════════════════════════════
const GEO_BASE = [
  { year: 2018, avgRent: 1285, rentGrowth: 3.8, occupancy: 94.4, concessions: 1.2, rentPerSF: 1.74, capRate: 5.8, absorptionPerMonth: 980, jobsPerUnit: 1.42, medianIncome: 58200, population: 412000, popGrowth: 2.1 },
  { year: 2019, avgRent: 1354, rentGrowth: 5.4, occupancy: 95.0, concessions: 0.8, rentPerSF: 1.83, capRate: 5.6, absorptionPerMonth: 1120, jobsPerUnit: 1.48, medianIncome: 60100, population: 420600, popGrowth: 2.1 },
  { year: 2020, avgRent: 1343, rentGrowth: -0.8, occupancy: 90.8, concessions: 5.8, rentPerSF: 1.82, capRate: 6.2, absorptionPerMonth: 640, jobsPerUnit: 1.32, medianIncome: 59800, population: 425200, popGrowth: 1.1 },
  { year: 2021, avgRent: 1515, rentGrowth: 12.8, occupancy: 94.8, concessions: 2.4, rentPerSF: 2.05, capRate: 5.1, absorptionPerMonth: 1183, jobsPerUnit: 1.51, medianIncome: 63400, population: 437000, popGrowth: 2.8 },
  { year: 2022, avgRent: 1671, rentGrowth: 10.3, occupancy: 93.2, concessions: 1.6, rentPerSF: 2.26, capRate: 4.8, absorptionPerMonth: 1067, jobsPerUnit: 1.56, medianIncome: 66200, population: 447500, popGrowth: 2.4 },
  { year: 2023, avgRent: 1724, rentGrowth: 3.2, occupancy: 91.9, concessions: 2.2, rentPerSF: 2.33, capRate: 5.4, absorptionPerMonth: 867, jobsPerUnit: 1.52, medianIncome: 68800, population: 457300, popGrowth: 2.2 },
  { year: 2024, avgRent: 1746, rentGrowth: 1.3, occupancy: 91.2, concessions: 3.0, rentPerSF: 2.36, capRate: 5.6, absorptionPerMonth: 817, jobsPerUnit: 1.48, medianIncome: 70900, population: 466400, popGrowth: 2.0 },
  { year: 2025, avgRent: 1765, rentGrowth: 1.1, occupancy: 91.5, concessions: 2.8, rentPerSF: 2.39, capRate: 5.5, absorptionPerMonth: 972, jobsPerUnit: 1.50, medianIncome: 73200, population: 476200, popGrowth: 2.1 },
];

const GEO_FORECAST_BASE = [
  { year: 2026, avgRent: 1814, rentGrowth: 2.8, occupancy: 92.0, concessions: 2.2, rentPerSF: 2.46, capRate: 5.3, absorptionPerMonth: 1033, jobsPerUnit: 1.52, medianIncome: 75400, population: 485800, popGrowth: 2.0, conf: 0.88 },
  { year: 2027, avgRent: 1872, rentGrowth: 3.2, occupancy: 92.6, concessions: 1.8, rentPerSF: 2.54, capRate: 5.1, absorptionPerMonth: 1100, jobsPerUnit: 1.55, medianIncome: 77800, population: 495100, popGrowth: 1.9, conf: 0.80 },
  { year: 2028, avgRent: 1938, rentGrowth: 3.5, occupancy: 93.2, concessions: 1.4, rentPerSF: 2.63, capRate: 5.0, absorptionPerMonth: 1167, jobsPerUnit: 1.57, medianIncome: 80200, population: 504200, popGrowth: 1.8, conf: 0.72 },
  { year: 2029, avgRent: 1996, rentGrowth: 3.0, occupancy: 93.5, concessions: 1.2, rentPerSF: 2.71, capRate: 5.1, absorptionPerMonth: 1133, jobsPerUnit: 1.56, medianIncome: 82400, population: 513000, popGrowth: 1.7, conf: 0.63 },
  { year: 2030, avgRent: 2044, rentGrowth: 2.4, occupancy: 93.0, concessions: 1.6, rentPerSF: 2.77, capRate: 5.2, absorptionPerMonth: 1067, jobsPerUnit: 1.54, medianIncome: 84800, population: 521600, popGrowth: 1.7, conf: 0.55 },
  { year: 2031, avgRent: 2089, rentGrowth: 2.2, occupancy: 92.8, concessions: 1.8, rentPerSF: 2.83, capRate: 5.3, absorptionPerMonth: 1033, jobsPerUnit: 1.53, medianIncome: 87000, population: 529800, popGrowth: 1.6, conf: 0.48 },
  { year: 2032, avgRent: 2131, rentGrowth: 2.0, occupancy: 92.9, concessions: 1.6, rentPerSF: 2.89, capRate: 5.3, absorptionPerMonth: 1050, jobsPerUnit: 1.53, medianIncome: 89200, population: 537800, popGrowth: 1.5, conf: 0.42 },
  { year: 2033, avgRent: 2180, rentGrowth: 2.3, occupancy: 93.2, concessions: 1.4, rentPerSF: 2.96, capRate: 5.2, absorptionPerMonth: 1083, jobsPerUnit: 1.55, medianIncome: 91600, population: 545600, popGrowth: 1.5, conf: 0.37 },
  { year: 2034, avgRent: 2226, rentGrowth: 2.1, occupancy: 93.1, concessions: 1.5, rentPerSF: 3.02, capRate: 5.2, absorptionPerMonth: 1067, jobsPerUnit: 1.54, medianIncome: 93800, population: 553200, popGrowth: 1.4, conf: 0.33 },
  { year: 2035, avgRent: 2268, rentGrowth: 1.9, occupancy: 93.0, concessions: 1.6, rentPerSF: 3.08, capRate: 5.3, absorptionPerMonth: 1050, jobsPerUnit: 1.53, medianIncome: 96200, population: 560600, popGrowth: 1.3, conf: 0.30 },
];

function deriveGeoLevel(base, o) {
  return base.map(d => ({
    ...d,
    avgRent: Math.round(d.avgRent + (o.rentOff || 0)),
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
const GEO_TRADE_AREA = deriveGeoLevel(ALL_GEO_BASE, { rentOff: 85, occOff: 0.7, rgOff: 0.4, concOff: -0.3, rsfOff: 0.08, capOff: -0.2, absScale: 0.35, jpuOff: 0.12, incOff: 4200, popScale: 0.22, pgOff: 0.3 });
const GEO_SUBMARKET = ALL_GEO_BASE;
const GEO_MSA = deriveGeoLevel(ALL_GEO_BASE, { rentOff: -120, occOff: 1.3, rgOff: -0.6, concOff: 0.4, rsfOff: -0.12, capOff: 0.3, absScale: 3.8, jpuOff: -0.08, incOff: -8400, popScale: 7.2, pgOff: -0.4 });

function pearsonR(xs, ys) {
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

const MP_METRIC_FAMILIES = [
  { family: "rent", label: "RENT", propKey: "rent", geoKey: "avgRent", color: "#00D26A" },
  { family: "occ", label: "OCCUPANCY", propKey: "occ", geoKey: "occupancy", color: "#00BCD4" },
  { family: "rentGrowth", label: "RENT GROWTH", propKey: "rentGrowth", geoKey: "rentGrowth", color: "#A78BFA" },
  { family: "concessions", label: "CONCESSIONS", propKey: "concessions", geoKey: "concessions", color: "#FF8C42" },
  { family: "rentPerSF", label: "RENT/SF", propKey: "rentPerSF", geoKey: "rentPerSF", color: "#7FD4A0" },
  { family: "traffic", label: "TRAFFIC", propKey: "monthlyTraffic", geoKey: "", color: "#4A9EFF" },
  { family: "capRate", label: "CAP RATE", propKey: "", geoKey: "capRate", color: "#F5A623" },
  { family: "absorption", label: "ABSRP/MO", propKey: "", geoKey: "absorptionPerMonth", color: "#14B8A6" },
  { family: "jobsPerUnit", label: "JOBS/UNIT", propKey: "", geoKey: "jobsPerUnit", color: "#4A9EFF" },
  { family: "medianIncome", label: "MED. INCOME", propKey: "", geoKey: "medianIncome", color: "#A78BFA" },
  { family: "population", label: "POPULATION", propKey: "", geoKey: "population", color: "#A0D47F" },
  { family: "popGrowth", label: "POP GROWTH", propKey: "", geoKey: "popGrowth", color: "#14B8A6" },
];

// ─── UTILITY ─────────────────────────────────────────────────
const fmt = (n) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}K` : `$${n}`;
const fmtFull = (n) => `$${n.toLocaleString()}`;
const pct = (n) => `${n.toFixed(1)}%`;
const kFmt = (n) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(1)}k` : `${n}`;

// ─── SHARED COMPONENTS ───────────────────────────────────────
const Badge = ({ children, color = T.text.amber, bg, border: bdr }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "1px 6px",
    fontSize: 8, fontFamily: T.font.mono, fontWeight: 700, letterSpacing: "0.05em",
    color, background: bg || `${color}15`, border: `1px solid ${bdr || `${color}40`}`,
    borderRadius: 2, lineHeight: "14px", whiteSpace: "nowrap",
  }}>{children}</span>
);

const SectionHeader = ({ title, subtitle, icon, borderColor = T.text.amber, action }) => (
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

const DataRow = ({ label, value, sub, color, mono = true }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "4px 10px", borderBottom: `1px solid ${T.border.subtle}08`,
  }}>
    <span style={{ fontSize: 9, fontFamily: T.font.label, color: T.text.secondary }}>{label}</span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
      <span style={{ fontSize: 10, fontFamily: mono ? T.font.mono : T.font.label, fontWeight: 600, color: color || T.text.primary }}>{value}</span>
      {sub && <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>{sub}</span>}
    </div>
  </div>
);

const MiniSparkline = ({ data, color = T.text.green, width = 60, height = 16 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.2} />
    </svg>
  );
};

const MiniBar = ({ value, max, color = T.text.cyan, width = 60 }) => (
  <div style={{ width, height: 6, background: `${color}15`, borderRadius: 1 }}>
    <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: color, borderRadius: 1 }} />
  </div>
);


const ScoreRing = ({ score, size = 72, strokeWidth = 5 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? T.text.green : score >= 65 ? T.text.amber : score >= 50 ? T.text.orange : T.text.red;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={`${color}15`} strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size > 50 ? 18 : 11, fontFamily: T.font.mono, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: size > 50 ? 6 : 5, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.1em" }}>JEDI</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SVG CHART COMPONENTS — Bloomberg Terminal style
// ═══════════════════════════════════════════════════════════════
const ChartContainer = ({ title, subtitle, width = "100%", height = 200, children, borderColor = T.text.cyan, action }) => (
  <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
    <SectionHeader title={title} subtitle={subtitle} borderColor={borderColor} action={action} />
    <div style={{ padding: "8px 4px 4px", height, position: "relative" }}>
      {children}
    </div>
  </div>
);

// Multi-series line chart with optional confidence bands
function LineChart({ data, series, width: containerWidth, height: containerHeight, showGrid = true, showDots = true, forecastStartIdx = null }) {
  const pad = { top: 10, right: 12, bottom: 28, left: 48 };
  const w = (containerWidth || 500) - pad.left - pad.right;
  const h = (containerHeight || 180) - pad.top - pad.bottom;
  
  // Get all values for y-axis range
  const allVals = series.flatMap(s => data.map(d => d[s.key]).filter(v => v != null));
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const yRange = yMax - yMin || 1;
  const yPad = yRange * 0.08;

  const x = (i) => pad.left + (i / (data.length - 1)) * w;
  const y = (v) => pad.top + h - ((v - (yMin - yPad)) / (yRange + yPad * 2)) * h;

  const gridLines = 5;
  const yTicks = Array.from({ length: gridLines }, (_, i) => yMin - yPad + (yRange + yPad * 2) * (i / (gridLines - 1)));

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${(containerWidth || 500)} ${(containerHeight || 180)}`} style={{ overflow: "visible" }}>
      {/* Grid */}
      {showGrid && yTicks.map((tick, i) => (
        <g key={i}>
          <line x1={pad.left} y1={y(tick)} x2={pad.left + w} y2={y(tick)} stroke={T.border.subtle} strokeWidth={0.5} strokeDasharray="2,3" />
          <text x={pad.left - 4} y={y(tick) + 3} fill={T.text.muted} fontSize={7} fontFamily={T.font.mono} textAnchor="end">
            {tick >= 1000 ? `${(tick/1000).toFixed(tick >= 10000 ? 0 : 1)}k` : tick.toFixed(tick < 10 ? 1 : 0)}
          </text>
        </g>
      ))}

      {/* Forecast zone shading */}
      {forecastStartIdx != null && (
        <rect x={x(forecastStartIdx)} y={pad.top} width={w - (x(forecastStartIdx) - pad.left)} height={h} fill={T.text.cyan} opacity={0.03} />
      )}
      {forecastStartIdx != null && (
        <line x1={x(forecastStartIdx)} y1={pad.top} x2={x(forecastStartIdx)} y2={pad.top + h} stroke={T.text.cyan} strokeWidth={1} strokeDasharray="4,3" opacity={0.4} />
      )}

      {/* Series lines */}
      {series.map((s, si) => {
        const pts = data.map((d, i) => d[s.key] != null ? { x: x(i), y: y(d[s.key]), i } : null).filter(Boolean);
        if (pts.length < 2) return null;
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        
        return (
          <g key={si}>
            {/* Confidence band for forecasted data */}
            {s.confBand && forecastStartIdx != null && (() => {
              const fcPts = pts.filter(p => p.i >= forecastStartIdx);
              if (fcPts.length < 2) return null;
              const upper = fcPts.map(p => {
                const conf = data[p.i]?.confidence || 0.5;
                const val = data[p.i][s.key];
                return { x: p.x, y: y(val * (1 + (1 - conf) * 0.06)) };
              });
              const lower = fcPts.map(p => {
                const conf = data[p.i]?.confidence || 0.5;
                const val = data[p.i][s.key];
                return { x: p.x, y: y(val * (1 - (1 - conf) * 0.06)) };
              });
              const bandPath = `M${upper.map(p => `${p.x},${p.y}`).join(' L')} L${lower.reverse().map(p => `${p.x},${p.y}`).join(' L')} Z`;
              return <path d={bandPath} fill={s.color} opacity={0.08} />;
            })()}
            <path d={pathD} fill="none" stroke={s.color} strokeWidth={1.5} 
              strokeDasharray={s.dashed ? "4,3" : "none"} opacity={s.opacity || 1} />
            {showDots && pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2} fill={s.color} opacity={p.i >= (forecastStartIdx || Infinity) ? 0.5 : 0.9} />
            ))}
          </g>
        );
      })}

      {/* X-axis labels */}
      {data.map((d, i) => {
        const showLabel = data.length <= 10 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1;
        return showLabel ? (
          <text key={i} x={x(i)} y={pad.top + h + 14} fill={i >= (forecastStartIdx || Infinity) ? T.text.cyan : T.text.muted} 
            fontSize={7} fontFamily={T.font.mono} textAnchor="middle">
            {d.label || d.year}
          </text>
        ) : null;
      })}

      {/* Forecast label */}
      {forecastStartIdx != null && (
        <text x={x(forecastStartIdx) + 4} y={pad.top + 8} fill={T.text.cyan} fontSize={7} fontFamily={T.font.mono} opacity={0.6}>
          FORECAST →
        </text>
      )}
    </svg>
  );
}

// Bar chart for hourly distribution
function BarChart({ data, valueKey, labelKey, color = T.text.cyan, width: containerWidth, height: containerHeight, highlightMax = true }) {
  const pad = { top: 6, right: 8, bottom: 24, left: 36 };
  const w = (containerWidth || 500) - pad.left - pad.right;
  const h = (containerHeight || 140) - pad.top - pad.bottom;
  const maxVal = Math.max(...data.map(d => d[valueKey]));
  const barW = Math.max(4, (w / data.length) - 2);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${containerWidth || 500} ${containerHeight || 140}`}>
      {data.map((d, i) => {
        const barH = (d[valueKey] / maxVal) * h;
        const xPos = pad.left + (i / data.length) * w + barW * 0.15;
        const isMax = highlightMax && d[valueKey] === maxVal;
        return (
          <g key={i}>
            <rect x={xPos} y={pad.top + h - barH} width={barW * 0.7} height={barH} 
              fill={isMax ? T.text.amber : color} opacity={isMax ? 0.9 : 0.5} rx={1} />
            <text x={xPos + barW * 0.35} y={pad.top + h + 12} fill={T.text.muted} fontSize={6} fontFamily={T.font.mono} textAnchor="middle">
              {d[labelKey]}
            </text>
          </g>
        );
      })}
      {/* Y-axis */}
      {[0, 0.5, 1].map((pct, i) => {
        const val = maxVal * pct;
        const yPos = pad.top + h - (pct * h);
        return (
          <g key={i}>
            <line x1={pad.left} y1={yPos} x2={pad.left + w} y2={yPos} stroke={T.border.subtle} strokeWidth={0.5} strokeDasharray="2,3" />
            <text x={pad.left - 3} y={yPos + 3} fill={T.text.muted} fontSize={6} fontFamily={T.font.mono} textAnchor="end">
              {val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toFixed(0)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── PHOTO GALLERY ───────────────────────────────────────────
const PhotoGallery = ({ photos }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = photos[activeIdx];

  const PhotoPlaceholder = ({ photo, size = "large" }) => {
    const isLarge = size === "large";
    return (
      <div style={{
        width: "100%", height: "100%", background: photo.color,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.08, background: `repeating-linear-gradient(0deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,${T.text.secondary} 19px,${T.text.secondary} 20px)` }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${photo.color}00 0%, ${photo.color} 50%, ${photo.color}aa 100%)` }} />
        <svg width={isLarge ? 120 : 40} height={isLarge ? 80 : 28} viewBox="0 0 120 80" style={{ opacity: 0.3, position: "relative", zIndex: 1 }}>
          <rect x="10" y="20" width="30" height="60" fill={T.text.secondary} />
          <rect x="15" y="25" width="8" height="8" fill={photo.color} />
          <rect x="27" y="25" width="8" height="8" fill={photo.color} />
          <rect x="45" y="10" width="35" height="70" fill={T.text.secondary} />
          <rect x="50" y="15" width="8" height="8" fill={photo.color} />
          <rect x="62" y="15" width="8" height="8" fill={photo.color} />
          <rect x="85" y="30" width="25" height="50" fill={T.text.secondary} />
          <rect x="90" y="35" width="6" height="6" fill={photo.color} />
          <rect x="100" y="35" width="6" height="6" fill={photo.color} />
        </svg>
        {isLarge && (
          <span style={{ fontSize: 10, fontFamily: T.font.mono, color: `${T.text.secondary}80`, marginTop: 8, position: "relative", zIndex: 1 }}>
            {photo.label}
          </span>
        )}
        <div style={{ position: "absolute", top: 4, left: 4, fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, background: "#00000088", padding: "1px 4px", borderRadius: 1, zIndex: 2 }}>
          {String(photos.indexOf(photo) + 1).padStart(2, "0")}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: T.bg.photo, borderRadius: 2, overflow: "hidden", border: `1px solid ${T.border.subtle}` }}>
      <div style={{ width: "100%", height: 200, cursor: "pointer", position: "relative" }}>
        <PhotoPlaceholder photo={active} size="large" />
        <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 4 }}>
          <Badge color={T.text.white} bg="#00000099" border="transparent">{activeIdx + 1} / {photos.length}</Badge>
        </div>
        {activeIdx > 0 && (
          <div onClick={() => setActiveIdx(activeIdx - 1)} style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#000000aa", borderRadius: 2, cursor: "pointer", color: T.text.white, fontSize: 12, fontFamily: T.font.mono }}>‹</div>
        )}
        {activeIdx < photos.length - 1 && (
          <div onClick={() => setActiveIdx(activeIdx + 1)} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#000000aa", borderRadius: 2, cursor: "pointer", color: T.text.white, fontSize: 12, fontFamily: T.font.mono }}>›</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 2, padding: 2, background: T.bg.terminal, overflowX: "auto" }}>
        {photos.map((p, i) => (
          <div key={p.id} onClick={() => setActiveIdx(i)} style={{
            width: 52, height: 36, flexShrink: 0, cursor: "pointer",
            border: i === activeIdx ? `1px solid ${T.text.amber}` : `1px solid ${T.border.subtle}`,
            borderRadius: 1, overflow: "hidden", opacity: i === activeIdx ? 1 : 0.6,
          }}>
            <PhotoPlaceholder photo={p} size="small" />
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// QUADRANT BADGE (T-04 Hidden Gem 2×2)
// ═══════════════════════════════════════════════════════════════
const QuadrantBadge = ({ quadrant }) => {
  const config = {
    HIDDEN_GEM: { label: "HIDDEN GEM", color: T.text.green, icon: "◆", desc: "High physical traffic · Low digital presence" },
    VALIDATED_WINNER: { label: "VALIDATED WINNER", color: T.text.cyan, icon: "★", desc: "High physical · High digital — confirmed demand" },
    HYPE_RISK: { label: "HYPE RISK", color: T.text.orange, icon: "⚠", desc: "Low physical · High digital — unproven buzz" },
    DEAD_WEIGHT: { label: "DEAD WEIGHT", color: T.text.red, icon: "✕", desc: "Low physical · Low digital — structural weakness" },
  }[quadrant] || { label: quadrant, color: T.text.muted, icon: "?", desc: "" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: `${config.color}08`, border: `1px solid ${config.color}30`, borderRadius: 2 }}>
      <span style={{ fontSize: 12, color: config.color }}>{config.icon}</span>
      <div>
        <div style={{ fontSize: 9, fontFamily: T.font.mono, fontWeight: 700, color: config.color, letterSpacing: "0.05em" }}>{config.label}</div>
        <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>{config.desc}</div>
      </div>
    </div>
  );
};

// Pattern badge for T-07 trajectory
const PatternBadge = ({ pattern }) => {
  const config = {
    DEMAND_SURGE: { label: "DEMAND SURGE", color: T.text.green, icon: "🔥" },
    MOMENTUM_CONFIRMED: { label: "MOMENTUM CONFIRMED", color: T.text.blue, icon: "✅" },
    DIGITAL_DIVERGENCE: { label: "DIGITAL DIVERGENCE", color: T.text.orange, icon: "⚠" },
    MARKET_EXHAUSTION: { label: "MARKET EXHAUSTION", color: T.text.red, icon: "🔴" },
    SEASONAL_NOISE: { label: "SEASONAL NOISE", color: T.text.muted, icon: "📊" },
  }[pattern] || { label: pattern, color: T.text.muted, icon: "?" };

  return (
    <Badge color={config.color}>{config.icon} {config.label}</Badge>
  );
};


// Module-level constants — hoisted out of the component so they have a
// stable identity across renders and don't need to appear in hook deps.
const IDENTITY_FIELDS = [
  "id", "parcelId", "name", "address", "city", "state", "zip", "county",
  "submarket", "market", "lat", "lng", "owner",
] as const;

const TABS = [
  { key: "OVERVIEW", label: "OVERVIEW", hotkey: "F1" },
  { key: "FINANCIALS", label: "FINANCIALS", hotkey: "F2" },
  { key: "COMPS", label: "COMPS", hotkey: "F3" },
  { key: "TAX", label: "TAX & TITLE", hotkey: "F4" },
  { key: "ZONING", label: "ZONING", hotkey: "F5" },
  { key: "MARKET_PERF", label: "MARKET & PERFORMANCE", hotkey: "F6" },
  { key: "TRAFFIC", label: "TRAFFIC", hotkey: "F7" },
];

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function PropertyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const toggleTheme = useCallback(() => { const n = theme === "dark" ? "light" : "dark"; setTheme(n); localStorage.setItem("jedi-theme", n); }, [theme, setTheme]);
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [chartWidth, setChartWidth] = useState(460);
  const [realData, setRealData] = useState<any>(null);
  const [loadingReal, setLoadingReal] = useState(false);
  const [realError, setRealError] = useState<string | null>(null);
  const [marketComps, setMarketComps] = useState<any>(null);
  const [marketCompsLoading, setMarketCompsLoading] = useState(false);
  const [saleCompSet, setSaleCompSet] = useState<any>(null);
  const [saleCompSetLoading, setSaleCompSetLoading] = useState(false);
  const [saleCompDeletingId, setSaleCompDeletingId] = useState<string | null>(null);
  const [saleCompAddingId, setSaleCompAddingId] = useState<string | null>(null);
  const [addCompOpen, setAddCompOpen] = useState(false);
  const [addCompPool, setAddCompPool] = useState<any[]>([]);
  const [addCompPoolLoading, setAddCompPoolLoading] = useState(false);
  const [pcImpliedCapData, setPcImpliedCapData] = useState<any>(null);
  const [pcImpliedCapLoading, setPcImpliedCapLoading] = useState(false);
  const [compSortField, setCompSortField] = useState<'date' | 'ppu' | 'cap'>('date');
  const [compVintageBand, setCompVintageBand] = useState<string | null>(null);

  const navState = (location.state || {}) as {
    propertyName?: string;
    msaName?: string;
    submarketName?: string;
  };

  useEffect(() => {
    if (!id || !UUID_RE.test(id)) {
      setRealData(null);
      setRealError(null);
      setLoadingReal(false);
      return;
    }
    let cancelled = false;
    setLoadingReal(true);
    setRealError(null);
    apiClient
      .get(`/api/v1/markets/properties/${id}`)
      .then((res: any) => {
        if (cancelled) return;
        setRealData(res?.data ?? res);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const msg = err?.response?.data?.error || err?.message || "Property not found";
        setRealError(msg);
        setRealData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingReal(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id || !UUID_RE.test(id)) return;
    let cancelled = false;
    setMarketCompsLoading(true);
    apiClient
      .get(`/api/v1/comps/property/${id}/market-comps`)
      .then((res: any) => {
        if (!cancelled) setMarketComps(res?.data ?? res);
      })
      .catch(() => {
        if (!cancelled) setMarketComps(null);
      })
      .finally(() => {
        if (!cancelled) setMarketCompsLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const marketCompsDealId = marketComps?.dealId ?? null;

  const loadSaleCompSet = useCallback((dealId: string) => {
    setSaleCompSetLoading(true);
    apiClient
      .get(`/api/v1/deals/${dealId}/comps`)
      .then((res: any) => {
        const payload = res?.data?.data ?? res?.data;
        setSaleCompSet(payload ?? null);
      })
      .catch(() => setSaleCompSet(null))
      .finally(() => setSaleCompSetLoading(false));
  }, []);

  const handleDeleteSaleComp = useCallback(async (compId: string, address: string, dealId: string) => {
    if (saleCompDeletingId) return;
    if (!window.confirm(`Remove "${address}" from comp set?`)) return;
    setSaleCompDeletingId(compId);
    try {
      const res = await apiClient.delete<{ data?: any }>(`/api/v1/deals/${dealId}/comps/${compId}`);
      const payload = res?.data?.data ?? (res?.data as any);
      if (payload) setSaleCompSet(payload);
      else loadSaleCompSet(dealId);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to remove comp';
      window.alert(`Could not remove comp: ${msg}`);
      loadSaleCompSet(dealId);
    }
    finally { setSaleCompDeletingId(null); }
  }, [saleCompDeletingId, loadSaleCompSet]);

  const loadAddCompPool = useCallback(async (dealId: string, currentComps: any[]) => {
    setAddCompPoolLoading(true);
    try {
      const res = await apiClient.get<{ data?: any }>(`/api/v1/deals/${dealId}/comps/ranked`);
      const data = res?.data?.data ?? res?.data;
      const ranked: any[] = data?.comps ?? data?.members ?? [];
      const existingIds = new Set(currentComps.map((c: any) => String(c.id)));
      setAddCompPool(ranked.filter((c: any) => !existingIds.has(String(c.id))));
    } catch { setAddCompPool([]); }
    finally { setAddCompPoolLoading(false); }
  }, []);

  const handleAddComp = useCallback(async (compId: string, dealId: string) => {
    if (saleCompAddingId) return;
    setSaleCompAddingId(compId);
    try {
      const res = await apiClient.post<{ data?: any }>(`/api/v1/deals/${dealId}/comps/${compId}`, {});
      const payload = res?.data?.data ?? (res?.data as any);
      if (payload) {
        setSaleCompSet(payload);
        const newComps: any[] = payload?.comps ?? payload?.members ?? [];
        const existingIds = new Set(newComps.map((c: any) => String(c.id)));
        setAddCompPool(prev => prev.filter((c: any) => !existingIds.has(String(c.id))));
      } else {
        loadSaleCompSet(dealId);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to add comp';
      window.alert(`Could not add comp: ${msg}`);
    }
    finally { setSaleCompAddingId(null); }
  }, [saleCompAddingId, loadSaleCompSet]);

  useEffect(() => {
    if (!marketCompsDealId) { setSaleCompSet(null); setPcImpliedCapData(null); setAddCompOpen(false); setAddCompPool([]); return; }
    loadSaleCompSet(marketCompsDealId);
    setPcImpliedCapLoading(true);
    apiClient
      .get(`/api/v1/deals/${marketCompsDealId}/implied-cap-rate`)
      .then((res: any) => {
        const d = res?.data?.data ?? res?.data;
        setPcImpliedCapData(d ?? null);
      })
      .catch(() => setPcImpliedCapData(null))
      .finally(() => setPcImpliedCapLoading(false));
  }, [marketCompsDealId, loadSaleCompSet]);

  const mappedReal = useMemo(
    () => mapRealProperty(realData, navState.propertyName),
    [realData, navState.propertyName]
  );
  const isReal = !!mappedReal;

  // Merge: real data overrides mock baseline, but only for fields where real is non-null.
  // PROPERTY mock provides photos/unitMix/walkScore/perf metrics that the rich UI needs.
  // Identity/location fields NEVER fall back to mock — empty real fields stay empty so we
  // don't claim a Tampa address for a Georgia parcel.
  // For UUID routes (whether fetched successfully OR fetch failed), identity is always blanked
  // so a 404 never silently displays the Westshore Commons mock.
  const isUuidRoute = !!(id && UUID_RE.test(id));
  const p = useMemo(() => {
    if (!isUuidRoute) return PROPERTY;
    const merged: any = { ...PROPERTY };
    for (const f of IDENTITY_FIELDS) merged[f] = "";
    if (mappedReal) {
      for (const [k, v] of Object.entries(mappedReal)) {
        if (v !== null && v !== undefined && v !== "") merged[k] = v;
      }
    }
    if (navState.propertyName && !merged.name) merged.name = navState.propertyName;
    if (navState.submarketName && !merged.submarket) merged.submarket = navState.submarketName;
    if (navState.msaName) merged.market = navState.msaName;
    return merged;
  }, [isUuidRoute, mappedReal, navState.propertyName, navState.submarketName, navState.msaName]);

  const td = TRAFFIC_DATA;
  const perf = PERFORMANCE_HISTORY;

  // perf/td.aadtProjected are module-level constants but the linter can't
  // know that — including them is safe (will not cause re-runs).
  const forecast = useMemo(() => generateForecast(perf, td.aadtProjected), [perf, td.aadtProjected]);

  useEffect(() => {
    const handler = (e) => {
      const idx = parseInt(e.key.replace("F", "")) - 1;
      if (idx >= 0 && idx < TABS.length) { e.preventDefault(); setActiveTab(TABS[idx].key); }
      if (e.key === "Escape") setShowCreateDeal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Measure container for responsive charts
  const contentRef = useRef(null);
  useEffect(() => {
    if (!contentRef.current) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width;
      if (w) setChartWidth(Math.floor((w - 24) / 2));
    });
    obs.observe(contentRef.current);
    return () => obs.disconnect();
  }, []);

  // ─── OVERVIEW TAB ────────────────────────────────────────
  const OverviewTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      {/* LEFT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <PhotoGallery photos={p.photos} />
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PROPERTY VITALS" icon="◈" borderColor={T.text.cyan} />
          <DataRow label="Type" value={p.type} sub={`· ${p.subtype}`} />
          <DataRow label="Class" value={p.class} />
          <DataRow label="Units" value={p.units} />
          <DataRow label="Stories" value={p.stories ?? "—"} />
          <DataRow label="Year Built" value={p.yearBuilt} sub={p.yearRenovated ? `· Renov ${p.yearRenovated}` : ""} />
          <DataRow label="Lot Size" value={`${p.lotSizeAc} ac`} sub={`${p.lotSizeSF.toLocaleString()} SF`} />
          <DataRow label="Building SF" value={`${p.buildingSF.toLocaleString()}`} />
          <DataRow label="Avg Unit SF" value={`${p.avgUnitSF}`} sub="SF" />
          <DataRow label="Parking" value={`${p.parking.total} spaces`} sub={`${p.parking.ratio}:1 · ${p.parking.type}`} />
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="AMENITIES" icon="◆" borderColor={T.text.purple} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, padding: "6px 10px" }}>
            {p.amenities.map((a, i) => <Badge key={i} color={T.text.secondary}>{a}</Badge>)}
          </div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="OWNERSHIP" icon="◇" borderColor={T.text.orange} />
          <DataRow label="Current Owner" value={p.owner} mono={false} />
          <DataRow label="Owner Type" value={p.ownerType} />
          <DataRow label="Acquired" value={p.acquisitionDate} sub={fmtFull(p.acquisitionPrice)} />
          <DataRow label="Hold Period" value={`${new Date().getFullYear() - parseInt(p.acquisitionDate)}yr`} color={T.text.amber} />
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PERFORMANCE SNAPSHOT" icon="▲" borderColor={T.text.green}
            action={<span onClick={() => setActiveTab("MARKET_PERF")} style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.green, cursor: "pointer" }}>FULL VIEW →</span>} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {[
              { label: "Occupancy", value: pct(p.currentOccupancy), color: p.currentOccupancy >= 93 ? T.text.green : T.text.amber, spark: perf.map(h => h.occ) },
              { label: "Avg Eff. Rent", value: `$${p.avgEffectiveRent.toLocaleString()}`, sub: "/mo", spark: perf.map(h => h.rent) },
              { label: "Rent/SF", value: `$${p.rentPerSF}`, sub: "/SF/mo" },
              { label: "NOI (T12)", value: fmt(p.noiTrailing12), color: T.text.green, spark: perf.map(h => h.noi) },
              { label: "Implied Cap", value: pct(p.capRateImplied), color: T.text.cyan },
              { label: "Expense Ratio", value: pct(p.expenseRatio), color: p.expenseRatio > 50 ? T.text.red : T.text.amber },
            ].map((m, i) => (
              <div key={i} style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border.subtle}08`, borderRight: i % 2 === 0 ? `1px solid ${T.border.subtle}08` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.08em", marginBottom: 2 }}>{m.label}</div>
                  {m.spark && <MiniSparkline data={m.spark} color={m.color || T.text.green} width={40} height={12} />}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                  <span style={{ fontSize: 14, fontFamily: T.font.mono, fontWeight: 700, color: m.color || T.text.primary }}>{m.value}</span>
                  {m.sub && <span style={{ fontSize: 8, color: T.text.muted }}>{m.sub}</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "4px 10px", background: T.bg.panelAlt }}>
            <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>CONCESSIONS</div>
            <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.amber }}>{p.concessions}</div>
          </div>
        </div>

        {/* Traffic Quick-Read — links to TRAFFIC tab */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="TRAFFIC INTELLIGENCE" subtitle="M07" icon="▣" borderColor={T.text.blue}
            action={<span onClick={() => setActiveTab("TRAFFIC")} style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.blue, cursor: "pointer" }}>DETAIL →</span>} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
            {[
              { label: "T-02 PHYSICAL", value: td.outputs.t02_physicalScore, max: 100 },
              { label: "T-03 DIGITAL", value: td.outputs.t03_digitalScore, max: 100 },
              { label: "T-07 TRAJECTORY", value: `+${(td.outputs.t07_trajectory * 100).toFixed(1)}%`, raw: true },
            ].map((s, i) => (
              <div key={i} style={{ padding: "6px 8px", textAlign: "center", borderRight: i < 2 ? `1px solid ${T.border.subtle}08` : "none" }}>
                <div style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.08em" }}>{s.label}</div>
                {s.raw ? (
                  <div style={{ fontSize: 14, fontFamily: T.font.mono, fontWeight: 700, color: T.text.green }}>{s.value}</div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 2 }}>
                    <ScoreRing score={s.value} size={36} strokeWidth={3} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: "4px 8px" }}>
            <QuadrantBadge quadrant={td.outputs.t04_quadrant} />
          </div>
        </div>

        {/* Market Position — Trade Area / Submarket / MSA */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="MARKET POSITION" subtitle="3-Level Comparison" icon="◉" borderColor={T.text.amber} />
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "76px 1fr 1fr 1fr 1fr", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, fontSize: 7, fontFamily: T.font.mono }}>
            <span style={{ color: T.text.muted, fontWeight: 600 }}>METRIC</span>
            <span style={{ color: T.text.amber, fontWeight: 600, textAlign: "center" }}>SUBJECT</span>
            <span style={{ color: T.text.muted, fontWeight: 600, textAlign: "center" }}>TRADE AREA</span>
            <span style={{ color: T.text.muted, fontWeight: 600, textAlign: "center" }}>SUBMARKET</span>
            <span style={{ color: T.text.muted, fontWeight: 600, textAlign: "center" }}>MSA</span>
          </div>
          {[
            { label: "Eff. Rent", subj: `$${p.avgEffectiveRent}`, ta: `$${p.marketPosition.tradeArea.rent}`, sm: `$${p.marketPosition.submarket.rent}`, msa: `$${p.marketPosition.msa.rent}`, subjVal: p.avgEffectiveRent, taVal: p.marketPosition.tradeArea.rent },
            { label: "Vacancy", subj: pct(100 - p.currentOccupancy), ta: pct(p.marketPosition.tradeArea.vacancy), sm: pct(p.marketPosition.submarket.vacancy), msa: pct(p.marketPosition.msa.vacancy), lower: true, subjVal: 100 - p.currentOccupancy, taVal: p.marketPosition.tradeArea.vacancy },
            { label: "Concessions", subj: pct(p.concessionValue), ta: pct(p.marketPosition.tradeArea.concessions), sm: pct(p.marketPosition.submarket.concessions), msa: pct(p.marketPosition.msa.concessions), lower: true, subjVal: p.concessionValue, taVal: p.marketPosition.tradeArea.concessions },
            { label: "Mo. Traffic", subj: `${(p.monthlyTraffic/1000).toFixed(1)}k`, ta: `${(p.marketPosition.tradeArea.traffic/1000).toFixed(1)}k`, sm: `${(p.marketPosition.submarket.traffic/1000).toFixed(1)}k`, msa: `${(p.marketPosition.msa.traffic/1000).toFixed(1)}k`, higher: true, subjVal: p.monthlyTraffic, taVal: p.marketPosition.tradeArea.traffic },
            { label: "Rent Growth", subj: `+${pct(1.1)}`, ta: `+${pct(p.marketPosition.tradeArea.rentGrowth)}`, sm: `+${pct(p.marketPosition.submarket.rentGrowth)}`, msa: `+${pct(p.marketPosition.msa.rentGrowth)}` },
          ].map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "76px 1fr 1fr 1fr 1fr", padding: "3px 8px", borderBottom: `1px solid ${T.border.subtle}08`, fontSize: 8, fontFamily: T.font.mono }}>
              <span style={{ color: T.text.secondary }}>{row.label}</span>
              <span style={{ color: T.text.amber, fontWeight: 600, textAlign: "center" }}>{row.subj}</span>
              <span style={{ color: T.text.secondary, textAlign: "center" }}>{row.ta}</span>
              <span style={{ color: T.text.secondary, textAlign: "center" }}>{row.sm}</span>
              <span style={{ color: T.text.secondary, textAlign: "center" }}>{row.msa}</span>
            </div>
          ))}
          <div style={{ display: "flex", padding: "6px 10px", gap: 12 }}>
            {[
              { label: "Walk", value: p.walkScore },
              { label: "Transit", value: p.transitScore },
              { label: "Bike", value: p.bikeScore },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, width: 36 }}>{s.label}</span>
                <MiniBar value={s.value} max={100} color={s.value >= 70 ? T.text.green : s.value >= 50 ? T.text.amber : T.text.red} width={40} />
                <span style={{ fontSize: 9, fontFamily: T.font.mono, fontWeight: 600, color: T.text.primary }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Unit Mix */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="UNIT MIX" subtitle={`${p.units} units`} icon="▦" borderColor={T.text.purple}
            action={<span onClick={() => setActiveTab("COMPS")} style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.purple, cursor: "pointer" }}>COMP MIX →</span>} />
          <div style={{ fontSize: 8, fontFamily: T.font.mono }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 36px 36px 50px 36px 38px", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
              {["TYPE","UNITS","%","RENT","SF","$/SF"].map(h => (
                <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
              ))}
            </div>
            {p.unitMix.map((u, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 36px 36px 50px 36px 38px", padding: "4px 8px", borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
                <span style={{ color: T.text.primary, fontWeight: 500 }}>{u.type}</span>
                <span style={{ color: T.text.secondary }}>{u.units}</span>
                <span style={{ color: T.text.muted }}>{pct(u.pct)}</span>
                <span style={{ color: T.text.green, fontWeight: 600 }}>${u.rent.toLocaleString()}</span>
                <span style={{ color: T.text.secondary }}>{u.sf}</span>
                <span style={{ color: T.text.cyan }}>${(u.rent / u.sf).toFixed(2)}</span>
              </div>
            ))}
            {/* Totals row — weighted averages */}
            {(() => {
              const totalUnits = p.unitMix.reduce((s, u) => s + u.units, 0);
              const wavgRent = Math.round(p.unitMix.reduce((s, u) => s + u.rent * u.units, 0) / totalUnits);
              const wavgSF = Math.round(p.unitMix.reduce((s, u) => s + u.sf * u.units, 0) / totalUnits);
              const wavgRentSF = wavgRent / wavgSF;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 36px 36px 50px 36px 38px", padding: "4px 8px", background: `${T.text.amber}08`, borderTop: `1px solid ${T.text.amber}30` }}>
                  <span style={{ color: T.text.amber, fontWeight: 700 }}>TOTAL / WTD AVG</span>
                  <span style={{ color: T.text.amber, fontWeight: 700 }}>{totalUnits}</span>
                  <span style={{ color: T.text.amber }}>100%</span>
                  <span style={{ color: T.text.amber, fontWeight: 700 }}>${wavgRent.toLocaleString()}</span>
                  <span style={{ color: T.text.amber }}>{wavgSF}</span>
                  <span style={{ color: T.text.amber, fontWeight: 700 }}>${wavgRentSF.toFixed(2)}</span>
                </div>
              );
            })()}
          </div>
          {/* Mix bar visualization */}
          <div style={{ display: "flex", height: 6, margin: "0 8px 6px", borderRadius: 1, overflow: "hidden" }}>
            {p.unitMix.map((u, i) => (
              <div key={i} style={{ width: `${u.pct}%`, background: [T.text.purple, T.text.cyan, T.text.green, T.text.amber][i], opacity: 0.7 }} />
            ))}
          </div>
        </div>

        {/* Rent Comps Preview — expanded */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="RENT COMPS" subtitle={`${p.rentComps.length} properties`} icon="≡" borderColor={T.text.cyan}
            action={<span onClick={() => setActiveTab("COMPS")} style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.cyan, cursor: "pointer" }}>VIEW ALL →</span>} />
          <div style={{ fontSize: 8, fontFamily: T.font.mono, overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 36px 50px 36px 36px 38px 36px 42px", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, minWidth: 380 }}>
              {["PROPERTY","UNITS","RENT","OCC","YR","STR","CONC","TRAFFIC"].map(h => (
                <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
              ))}
            </div>
            {/* Subject row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 36px 50px 36px 36px 38px 36px 42px", padding: "4px 8px", borderBottom: `1px solid ${T.text.amber}40`, background: `${T.text.amber}08`, minWidth: 380 }}>
              <span style={{ color: T.text.amber, fontWeight: 700 }}>SUBJECT</span>
              <span style={{ color: T.text.amber }}>{p.units}</span>
              <span style={{ color: T.text.amber, fontWeight: 700 }}>${p.avgEffectiveRent.toLocaleString()}</span>
              <span style={{ color: T.text.amber }}>{pct(p.currentOccupancy)}</span>
              <span style={{ color: T.text.amber }}>{p.yearBuilt}</span>
              <span style={{ color: T.text.amber }}>{p.stories}</span>
              <span style={{ color: T.text.amber }}>{pct(p.concessionValue)}</span>
              <span style={{ color: T.text.amber }}>{(p.monthlyTraffic/1000).toFixed(1)}k</span>
            </div>
            {p.rentComps.map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 36px 50px 36px 36px 38px 36px 42px", padding: "4px 8px", borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt, minWidth: 380 }}>
                <span style={{ color: T.text.primary, fontWeight: 500 }}>{c.name}</span>
                <span style={{ color: T.text.secondary }}>{c.units}</span>
                <span style={{ color: c.rent > p.avgEffectiveRent ? T.text.green : T.text.red, fontWeight: 600 }}>${c.rent.toLocaleString()}</span>
                <span style={{ color: T.text.secondary }}>{pct(c.occ)}</span>
                <span style={{ color: T.text.secondary }}>{c.yearBuilt}</span>
                <span style={{ color: T.text.secondary }}>{c.stories}</span>
                <span style={{ color: c.concessions > p.concessionValue ? T.text.red : T.text.green }}>{pct(c.concessions)}</span>
                <span style={{ color: T.text.secondary }}>{(c.monthlyTraffic/1000).toFixed(1)}k</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── TRAFFIC TAB (NEW — M07) ───────────────────────────────
  const TrafficTab = () => {
    const allAadt = [...td.aadtHistory, ...td.aadtProjected.map(p => ({ year: p.year, aadt: p.aadt }))];
    const allEffective = [
      ...td.effectiveAdtHistory,
      ...td.aadtProjected.map(p => ({ year: p.year, adt: Math.round(p.aadt * td.adjustments.combinedMultiplier) })),
    ];
    const combinedTrafficData = allAadt.map((a, i) => ({
      year: a.year,
      aadt: a.aadt,
      effectiveAdt: allEffective[i]?.adt,
      confidence: td.aadtProjected.find(p => p.year === a.year)?.conf,
    }));

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
        {/* LEFT — AADT History + Forecast */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ChartContainer title="AADT — HISTORICAL & FORECAST" subtitle="M07 Layer 1 · FDOT + T-07 Projection" height={200} borderColor={T.text.blue}>
            <LineChart
              data={combinedTrafficData}
              series={[
                { key: "aadt", color: T.text.blue, confBand: true },
                { key: "effectiveAdt", color: T.text.cyan, dashed: false, opacity: 0.7 },
              ]}
              width={chartWidth}
              height={188}
              forecastStartIdx={td.aadtHistory.length}
            />
          </ChartContainer>

          {/* Legend */}
          <div style={{ display: "flex", gap: 12, padding: "0 4px" }}>
            {[
              { label: "Raw AADT", color: T.text.blue },
              { label: "Effective ADT (adjusted)", color: T.text.cyan },
              { label: "Forecast zone", color: T.text.cyan, dashed: true },
            ].map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 2, background: l.color, opacity: l.dashed ? 0.3 : 0.8, borderRadius: 1 }} />
                <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Layer 1: Adjustment Factors */}
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="LAYER 1: ADJUSTMENT FACTORS" subtitle={`Station ${td.stationId}`} icon="▣" borderColor={T.text.blue} />
            <DataRow label="FDOT Station" value={td.stationId} sub={td.stationDist} />
            <DataRow label="Road" value={td.roadName} sub={td.roadClass} />
            <DataRow label="Distance Decay" value={td.adjustments.distanceDecay.toFixed(3)} sub={`@ ${td.stationDist}`} />
            <DataRow label="Road Class Weight" value={td.adjustments.roadClassWeight.toFixed(2)} sub={td.roadClass} />
            <DataRow label="Frontage Factor" value={td.adjustments.frontageFactor.toFixed(2)} sub={td.frontageType} color={T.text.green} />
            <div style={{ height: 1, background: T.text.amber, margin: "2px 10px" }} />
            <DataRow label="Combined Multiplier" value={td.adjustments.combinedMultiplier.toFixed(3)} color={T.text.amber} />
            <DataRow label="Raw AADT (2025)" value={`${td.aadtHistory[td.aadtHistory.length-1].aadt.toLocaleString()} vpd`} />
            <DataRow label="Effective ADT (2025)" value={`${td.effectiveAdtHistory[td.effectiveAdtHistory.length-1].adt.toLocaleString()} vpd`} color={T.text.cyan} />
          </div>

          {/* Layer 3: Digital Signals */}
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="LAYER 3: DIGITAL SIGNALS" subtitle="SpyFu + Google" icon="◉" borderColor={T.text.purple} />
            <DataRow label="Search Momentum (QoQ)" value={`+${(td.digitalSignals.searchMomentumQoQ * 100).toFixed(0)}%`} color={T.text.green} />
            <DataRow label="Monthly Search Volume" value={td.digitalSignals.searchVolumeMonthly.toLocaleString()} />
            <DataRow label="Share of Voice" value={pct(td.digitalSignals.competitorShareOfVoice * 100)} sub="of submarket" />
            <DataRow label="Trend" value={td.digitalSignals.trend} color={T.text.green} />
            <div style={{ padding: "4px 10px" }}>
              <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, marginBottom: 3 }}>TOP KEYWORDS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {td.digitalSignals.topKeywords.map((kw, i) => <Badge key={i} color={T.text.purple}>{kw}</Badge>)}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Outputs + Hourly + Seasonal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* T-Output Scores */}
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="TRAFFIC ENGINE OUTPUTS" subtitle="T-01 through T-10" icon="▲" borderColor={T.text.green}
              action={<PatternBadge pattern={td.outputs.t07_pattern} />} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
              {[
                { label: "T-01 WALK-INS", value: `${td.outputs.t01_weeklyWalkIns}/wk`, color: T.text.primary },
                { label: "T-02 PHYSICAL", value: td.outputs.t02_physicalScore, isScore: true },
                { label: "T-03 DIGITAL", value: td.outputs.t03_digitalScore, isScore: true },
                { label: "T-05 LEASE CVR", value: pct(td.outputs.t05_trafficToLease * 100), color: T.text.amber },
                { label: "T-06 CAPTURE", value: pct(td.outputs.t06_captureRate * 100), color: T.text.cyan },
                { label: "T-10 CONFIDENCE", value: pct(td.outputs.t10_confidence * 100), color: T.text.green },
              ].map((s, i) => (
                <div key={i} style={{ padding: "6px 8px", textAlign: "center", borderBottom: `1px solid ${T.border.subtle}08`, borderRight: i % 3 !== 2 ? `1px solid ${T.border.subtle}08` : "none" }}>
                  <div style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.08em", marginBottom: 2 }}>{s.label}</div>
                  {s.isScore ? (
                    <div style={{ display: "flex", justifyContent: "center" }}><ScoreRing score={s.value} size={36} strokeWidth={3} /></div>
                  ) : (
                    <div style={{ fontSize: 13, fontFamily: T.font.mono, fontWeight: 700, color: s.color }}>{s.value}</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: "4px 8px" }}>
              <QuadrantBadge quadrant={td.outputs.t04_quadrant} />
            </div>
            <div style={{ padding: "6px 8px", background: `${T.text.green}06`, borderTop: `1px solid ${T.text.green}15` }}>
              <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.green, lineHeight: 1.5 }}>
                T-07 Trajectory: +{(td.outputs.t07_trajectory * 100).toFixed(1)}% → Digital momentum leads. AADT YoY confirms physical trend. COR-01 predicts rent growth acceleration in 2–4 quarters.
              </div>
            </div>
          </div>

          {/* Hourly Distribution */}
          <ChartContainer title="HOURLY TRAFFIC DISTRIBUTION" subtitle="Layer 2 · K-Factors" height={150} borderColor={T.text.teal}>
            <BarChart data={td.hourlyDistribution} valueKey="vol" labelKey="hour" color={T.text.teal} width={chartWidth} height={138} />
          </ChartContainer>

          {/* Seasonal Factors */}
          <ChartContainer title="SEASONAL ADJUSTMENT FACTORS" subtitle="Layer 2 · SE Florida" height={130} borderColor={T.text.orange}>
            <BarChart data={td.seasonalFactors.map(s => ({ ...s, val: s.factor * 100 }))} valueKey="val" labelKey="month" color={T.text.orange} width={chartWidth} height={118} highlightMax />
          </ChartContainer>

          {/* Walk-In Conversion */}
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="WALK-IN CONVERSION CHAIN" subtitle="T-01 → T-05 → T-06" icon="→" borderColor={T.text.amber} />
            <div style={{ display: "flex", alignItems: "center", padding: "8px", gap: 4 }}>
              {[
                { label: "EFF. ADT", value: "22,918", color: T.text.blue },
                { arrow: true },
                { label: "SEEKERS (3.8%)", value: "871/day", color: T.text.cyan },
                { arrow: true },
                { label: "WALK-INS", value: "16.7/wk", color: T.text.green },
                { arrow: true },
                { label: "LEASES (23%)", value: "3.8/wk", color: T.text.amber },
              ].map((s, i) => s.arrow ? (
                <span key={i} style={{ fontSize: 10, color: T.text.muted }}>→</span>
              ) : (
                <div key={i} style={{ flex: 1, textAlign: "center", padding: "4px", background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 2 }}>
                  <div style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: "0.05em" }}>{s.label}</div>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── MARKET & PERFORMANCE TAB — Combined ─────────────────
  const MarketPerformanceTab = () => {
    const perfAll = [...perf, ...forecast];
    const trafficAll = [...td.aadtHistory, ...td.aadtProjected.map(tp => ({ year: tp.year, aadt: tp.aadt }))];
    const propAll = perfAll.map((pf, i) => ({ ...pf, monthlyTraffic: trafficAll[i]?.aadt || 0 }));

    const taByYear = {};
    GEO_TRADE_AREA.forEach(d => { taByYear[d.year] = d; });
    const subByYear = {};
    GEO_SUBMARKET.forEach(d => { subByYear[d.year] = d; });
    const msaByYear = {};
    GEO_MSA.forEach(d => { msaByYear[d.year] = d; });

    const correlations = useMemo(() => {
      const histProp = propAll.filter(pp => pp.year <= 2025);
      const histSub = GEO_SUBMARKET.filter(d => d.year <= 2025);
      const histTA = GEO_TRADE_AREA.filter(d => d.year <= 2025);
      const pairs = [
        { a: "TRAFFIC", b: "RENT", xs: histProp.map(pp => pp.monthlyTraffic), ys: histProp.map(pp => pp.rent), narrative: (r) => r > 0.7 ? "Strong traffic→rent link: footfall drives pricing power" : "Moderate traffic impact on rents" },
        { a: "TRAFFIC", b: "OCCUPANCY", xs: histProp.map(pp => pp.monthlyTraffic), ys: histProp.map(pp => pp.occ), narrative: (r) => r > 0.7 ? "Traffic strongly predicts occupancy gains" : "Traffic has moderate occupancy impact" },
        { a: "SUB OCC", b: "PROP OCC", xs: histSub.map(d => d.occupancy), ys: histProp.map(pp => pp.occ), narrative: (r) => r > 0.7 ? "Property tracks submarket occupancy closely" : "Property occupancy diverges from submarket" },
        { a: "TA INCOME", b: "RENT", xs: histTA.map(d => d.medianIncome), ys: histProp.map(pp => pp.rent), narrative: (r) => r > 0.8 ? "Income growth in trade area supports rent increases" : "Rent partially decoupled from local income" },
        { a: "SUB ABSRP", b: "PROP OCC", xs: histSub.map(d => d.absorptionPerMonth), ys: histProp.map(pp => pp.occ), narrative: (r) => r > 0.6 ? "Submarket absorption drives property occupancy" : "Property occupancy less tied to absorption" },
        { a: "POP GROWTH", b: "RENT GRWTH", xs: histSub.map(d => d.popGrowth), ys: histProp.map(pp => pp.rentGrowth), narrative: (r) => r > 0.5 ? "Population growth fueling rent growth" : "Rent growth driven by factors beyond population" },
        { a: "JOBS/UNIT", b: "OCCUPANCY", xs: histSub.map(d => d.jobsPerUnit), ys: histProp.map(pp => pp.occ), narrative: (r) => r > 0.6 ? "Employment density supports occupancy" : "Occupancy less dependent on job density" },
        { a: "CAP RATE", b: "RENT GRWTH", xs: histSub.map(d => d.capRate), ys: histProp.map(pp => pp.rentGrowth), narrative: (r) => r < -0.4 ? "Cap rate compression signals rent acceleration" : "Cap rates weakly tied to rent growth" },
      ];
      return pairs.map(pr => {
        const r = pearsonR(pr.xs, pr.ys);
        const absR = Math.abs(r);
        const strength = absR >= 0.8 ? "VERY STRONG" : absR >= 0.6 ? "STRONG" : absR >= 0.4 ? "MODERATE" : "WEAK";
        return { metricA: pr.a, metricB: pr.b, r: parseFloat(r.toFixed(2)), strength, narrative: pr.narrative(r) };
      }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
      // propAll is locally derived from module-level constants (perf,
      // forecast, td) plus the deal's static perf history; recomputing
      // correlations on every parent render would be wasteful and the
      // values can never change after mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fiveYearOutlook = useMemo(() => {
      const now = propAll.find(pp => pp.year === 2025);
      const yr1 = propAll.find(pp => pp.year === 2026);
      const yr3 = propAll.find(pp => pp.year === 2028);
      const yr5 = propAll.find(pp => pp.year === 2030);
      const subNow = subByYear[2025];
      const sub5 = subByYear[2030];
      const sub1 = subByYear[2026]; const sub3 = subByYear[2028];
      if (!now || !yr1 || !yr3 || !yr5 || !subNow || !sub5) return [];
      const rentDelta = ((yr5.rent - now.rent) / now.rent * 100);
      const occDelta = yr5.occ - now.occ;
      const subRentGrowthAvg = ((sub1.rentGrowth + sub3.rentGrowth + sub5.rentGrowth) / 3);
      const trafficCorr = correlations.find(c => c.metricA === "TRAFFIC" && c.metricB === "RENT");
      const incomeCorr = correlations.find(c => c.metricA === "TA INCOME" && c.metricB === "RENT");
      return [
        { metric: "RENT", metricFamily: "rent", current: `$${now.rent.toLocaleString()}`, yr1: `$${yr1.rent.toLocaleString()}`, yr3: `$${yr3.rent.toLocaleString()}`, yr5: `$${yr5.rent.toLocaleString()}`,
          delta5yr: `+${rentDelta.toFixed(1)}%`, direction: rentDelta > 2 ? "up" : rentDelta < -1 ? "down" : "flat",
          signal: trafficCorr && trafficCorr.r > 0.7 ? `Traffic correlation r=${trafficCorr.r} reinforces upward trajectory` : `Moderate traffic support`,
          narrative: `Rent projected to grow ${rentDelta.toFixed(1)}% over 5 years ($${now.rent.toLocaleString()} → $${yr5.rent.toLocaleString()}). ${incomeCorr && incomeCorr.r > 0.7 ? `Strong income correlation (r=${incomeCorr.r}) supports sustainability.` : "Monitor income-to-rent ratio for affordability ceiling."} Submarket avg rent growth ${subRentGrowthAvg.toFixed(1)}% provides tailwind.` },
        { metric: "OCCUPANCY", metricFamily: "occ", current: `${now.occ.toFixed(1)}%`, yr1: `${yr1.occ.toFixed(1)}%`, yr3: `${yr3.occ.toFixed(1)}%`, yr5: `${yr5.occ.toFixed(1)}%`,
          delta5yr: `${occDelta > 0 ? "+" : ""}${occDelta.toFixed(1)}pp`, direction: occDelta > 0.5 ? "up" : occDelta < -0.5 ? "down" : "flat",
          signal: `Submarket occ forecast: ${subNow.occupancy.toFixed(1)}% → ${sub5.occupancy.toFixed(1)}% (+${(sub5.occupancy - subNow.occupancy).toFixed(1)}pp)`,
          narrative: `Property occupancy expected ${occDelta > 0 ? "to improve" : "stable"} at ${yr5.occ.toFixed(1)}% by 2030 (${occDelta > 0 ? "+" : ""}${occDelta.toFixed(1)}pp). ${yr5.occ > sub5.occupancy ? `Outperforming submarket by ${(yr5.occ - sub5.occupancy).toFixed(1)}pp — competitive advantage intact.` : `Tracking submarket trend — aligned with market recovery.`} Absorption trend ${sub5.absorptionPerMonth > subNow.absorptionPerMonth ? "strengthening" : "moderating"} at ${sub5.absorptionPerMonth.toLocaleString()}/mo.` },
        { metric: "RENT GROWTH", metricFamily: "rentGrowth", current: `${now.rentGrowth.toFixed(1)}%`, yr1: `${yr1.rentGrowth.toFixed(1)}%`, yr3: `${yr3.rentGrowth.toFixed(1)}%`, yr5: `${yr5.rentGrowth.toFixed(1)}%`,
          delta5yr: yr5.rentGrowth > now.rentGrowth ? `+${(yr5.rentGrowth - now.rentGrowth).toFixed(1)}pp` : `${(yr5.rentGrowth - now.rentGrowth).toFixed(1)}pp`,
          direction: yr5.rentGrowth > now.rentGrowth ? "up" : yr5.rentGrowth < now.rentGrowth - 1 ? "down" : "flat",
          signal: `Pop growth (${subNow.popGrowth.toFixed(1)}% → ${sub5.popGrowth.toFixed(1)}%) ${sub5.popGrowth > 1.5 ? "sustains demand" : "slowing — headwind"}`,
          narrative: `Rent growth accelerating from ${now.rentGrowth.toFixed(1)}% to ${yr3.rentGrowth.toFixed(1)}% by 2028, then moderating to ${yr5.rentGrowth.toFixed(1)}% by 2030. ${sub5.capRate < subNow.capRate ? `Cap rate compression (${subNow.capRate.toFixed(1)}% → ${sub5.capRate.toFixed(1)}%) signals investor confidence.` : `Cap rates stable — market equilibrium.`} Concessions forecast to ${yr5.concessions < now.concessions ? `decline to ${yr5.concessions.toFixed(1)}% — pricing power improving` : `hold at ${yr5.concessions.toFixed(1)}%`}.` },
      ];
      // propAll/subByYear are derived from static module-level data; the
      // outlook only varies with `correlations` once it's been computed.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [correlations]);

    const topCorrelations = correlations.filter(c => Math.abs(c.r) >= 0.5).slice(0, 5);

    const PROP_SERIES = [
      { key: "pRent", label: "RENT", color: T.text.green, group: "prop", family: "rent" },
      { key: "pOcc", label: "OCCUPANCY", color: T.text.cyan, group: "prop", family: "occ" },
      { key: "pGrowth", label: "RENT GROWTH", color: T.text.purple, group: "prop", family: "rentGrowth" },
      { key: "pConc", label: "CONCESSIONS", color: T.text.orange, group: "prop", family: "concessions" },
      { key: "pRentSF", label: "RENT/SF", color: "#7FD4A0", group: "prop", family: "rentPerSF" },
      { key: "pTraffic", label: "MO. TRAFFIC", color: T.text.blue, group: "prop", thick: true, family: "traffic" },
    ];

    const GEO_METRICS_LIST = [
      { key: "AvgRent", label: "AVG RENT", color: "#00D26A", family: "rent" },
      { key: "RentGrowth", label: "RENT GRWTH", color: T.text.green, family: "rentGrowth" },
      { key: "Occupancy", label: "OCCUPANCY", color: T.text.cyan, family: "occ" },
      { key: "Concessions", label: "CONCESSIONS", color: T.text.orange, family: "concessions" },
      { key: "RentPerSF", label: "RENT/SF", color: "#7FD4A0", family: "rentPerSF" },
      { key: "CapRate", label: "CAP RATE", color: T.text.amber, family: "capRate" },
      { key: "Absorption", label: "ABSRP/MO", color: T.text.teal, family: "absorption" },
      { key: "JobsPerUnit", label: "JOBS/UNIT", color: T.text.blue, family: "jobsPerUnit" },
      { key: "MedianIncome", label: "MED. INCOME", color: T.text.purple, family: "medianIncome" },
      { key: "Population", label: "POPULATION", color: "#A0D47F", family: "population" },
      { key: "PopGrowth", label: "POP GROWTH", color: "#14B8A6", family: "popGrowth" },
    ];

    const buildGeoSeries = (prefix, group, dashArray) => GEO_METRICS_LIST.map(m => ({ key: `${prefix}${m.key}`, label: m.label, color: m.color, group, dashArray, family: m.family }));
    const ALL_CHART_SERIES = [...PROP_SERIES, ...buildGeoSeries("ta", "trade", "3,2"), ...buildGeoSeries("sub", "sub", "6,3"), ...buildGeoSeries("msa", "msa", "8,4,2,4")];

    const GEO_GROUP_CFG = [
      { key: "prop", label: "PROPERTY", color: T.text.amber },
      { key: "trade", label: "TRADE AREA (3mi)", color: "#FF9F7F" },
      { key: "sub", label: "SUBMARKET", color: "#FF6B6B" },
      { key: "msa", label: "TAMPA MSA", color: "#D4A07F" },
    ];

    const defaultSeriesState = {};
    ALL_CHART_SERIES.forEach(s => { defaultSeriesState[s.key] = s.group === "prop"; });
    const [activeSeries, setActiveSeries] = useState(defaultSeriesState);
    const [highlightFamily, setHighlightFamily] = useState(null);
    const [tableGroupMode, setTableGroupMode] = useState(null);
    const [visibleCols, setVisibleCols] = useState(() => {
      const d = {};
      MP_METRIC_FAMILIES.forEach(m => { d[m.family] = true; });
      return d;
    });
    const [showColPicker, setShowColPicker] = useState(false);

    const toggleSeries = (key) => setActiveSeries(prev => ({ ...prev, [key]: !prev[key] }));
    const toggleGroupAll = (grp) => {
      setActiveSeries(prev => {
        const next = { ...prev };
        const grpSeries = ALL_CHART_SERIES.filter(s => s.group === grp);
        const allOn = grpSeries.every(s => next[s.key]);
        grpSeries.forEach(s => { next[s.key] = !allOn; });
        return next;
      });
    };

    const handleMetricClick = (family) => {
      setHighlightFamily(prev => prev === family ? null : family);
      setTableGroupMode(null);
    };
    const handleMetricDblClick = (family) => {
      setTableGroupMode(prev => prev === family ? null : family);
      setHighlightFamily(null);
      setActiveSeries(() => {
        const next = {};
        ALL_CHART_SERIES.forEach(s => { next[s.key] = s.family === family; });
        return next;
      });
    };

    const isHi = (family) => highlightFamily === family;

    const baseIdx = {};
    propAll.forEach(d => {
      if (d.year === 2018) {
        baseIdx.rent = d.rent || 1; baseIdx.occ = d.occ || 1; baseIdx.rentGrowth = Math.abs(d.rentGrowth) || 1;
        baseIdx.concessions = Math.max(d.concessions, 0.1); baseIdx.rentPerSF = d.rentPerSF || 1; baseIdx.traffic = d.monthlyTraffic || 1;
      }
    });
    GEO_SUBMARKET.forEach(d => {
      if (d.year === 2018) {
        baseIdx.gAvgRent = d.avgRent || 1; baseIdx.gRentGrowth = Math.abs(d.rentGrowth) || 1; baseIdx.gOccupancy = d.occupancy || 1; baseIdx.gConcessions = Math.max(d.concessions, 0.1);
        baseIdx.gRentPerSF = d.rentPerSF || 1; baseIdx.gCapRate = d.capRate || 1; baseIdx.gAbsorption = d.absorptionPerMonth || 1;
        baseIdx.gJobsPerUnit = d.jobsPerUnit || 1; baseIdx.gMedianIncome = d.medianIncome || 1; baseIdx.gPopulation = d.population || 1; baseIdx.gPopGrowth = Math.abs(d.popGrowth) || 1;
      }
    });

    const getGeoVal = (geo, year, key) => {
      const d = geo.find(g => g.year === year);
      return d ? d[key] : 0;
    };

    const indexedData = propAll.map((pp, i) => {
      const yr = pp.year;
      const ta = taByYear[yr] || {}; const sub = subByYear[yr] || {}; const msa = msaByYear[yr] || {};
      const isForecast = yr > 2025;
      return {
        year: yr, isForecast,
        pRent: (pp.rent / baseIdx.rent) * 100, pOcc: (pp.occ / baseIdx.occ) * 100,
        pGrowth: 100 + ((pp.rent / baseIdx.rent) - 1) * 100, pConc: (pp.concessions / baseIdx.concessions) * 100,
        pRentSF: (pp.rentPerSF / baseIdx.rentPerSF) * 100, pTraffic: (pp.monthlyTraffic / baseIdx.traffic) * 100,
        taAvgRent: ((ta.avgRent || 0) / baseIdx.gAvgRent) * 100, taRentGrowth: ((ta.rentGrowth || 0) / baseIdx.gRentGrowth) * 100, taOccupancy: ((ta.occupancy || 0) / baseIdx.gOccupancy) * 100,
        taConcessions: ((ta.concessions || 0) / baseIdx.gConcessions) * 100, taRentPerSF: ((ta.rentPerSF || 0) / baseIdx.gRentPerSF) * 100,
        taCapRate: ((ta.capRate || 0) / baseIdx.gCapRate) * 100, taAbsorption: ((ta.absorptionPerMonth || 0) / baseIdx.gAbsorption) * 100,
        taJobsPerUnit: ((ta.jobsPerUnit || 0) / baseIdx.gJobsPerUnit) * 100, taMedianIncome: ((ta.medianIncome || 0) / baseIdx.gMedianIncome) * 100,
        taPopulation: ((ta.population || 0) / baseIdx.gPopulation) * 100, taPopGrowth: ((ta.popGrowth || 0) / baseIdx.gPopGrowth) * 100,
        subAvgRent: ((sub.avgRent || 0) / baseIdx.gAvgRent) * 100, subRentGrowth: ((sub.rentGrowth || 0) / baseIdx.gRentGrowth) * 100, subOccupancy: ((sub.occupancy || 0) / baseIdx.gOccupancy) * 100,
        subConcessions: ((sub.concessions || 0) / baseIdx.gConcessions) * 100, subRentPerSF: ((sub.rentPerSF || 0) / baseIdx.gRentPerSF) * 100,
        subCapRate: ((sub.capRate || 0) / baseIdx.gCapRate) * 100, subAbsorption: ((sub.absorptionPerMonth || 0) / baseIdx.gAbsorption) * 100,
        subJobsPerUnit: ((sub.jobsPerUnit || 0) / baseIdx.gJobsPerUnit) * 100, subMedianIncome: ((sub.medianIncome || 0) / baseIdx.gMedianIncome) * 100,
        subPopulation: ((sub.population || 0) / baseIdx.gPopulation) * 100, subPopGrowth: ((sub.popGrowth || 0) / baseIdx.gPopGrowth) * 100,
        msaAvgRent: ((msa.avgRent || 0) / baseIdx.gAvgRent) * 100, msaRentGrowth: ((msa.rentGrowth || 0) / baseIdx.gRentGrowth) * 100, msaOccupancy: ((msa.occupancy || 0) / baseIdx.gOccupancy) * 100,
        msaConcessions: ((msa.concessions || 0) / baseIdx.gConcessions) * 100, msaRentPerSF: ((msa.rentPerSF || 0) / baseIdx.gRentPerSF) * 100,
        msaCapRate: ((msa.capRate || 0) / baseIdx.gCapRate) * 100, msaAbsorption: ((msa.absorptionPerMonth || 0) / baseIdx.gAbsorption) * 100,
        msaJobsPerUnit: ((msa.jobsPerUnit || 0) / baseIdx.gJobsPerUnit) * 100, msaMedianIncome: ((msa.medianIncome || 0) / baseIdx.gMedianIncome) * 100,
        msaPopulation: ((msa.population || 0) / baseIdx.gPopulation) * 100, msaPopGrowth: ((msa.popGrowth || 0) / baseIdx.gPopGrowth) * 100,
        raw: { ...pp, ta, sub, msa },
      };
    });

    const forecastIdx = indexedData.findIndex(d => d.isForecast);
    const activeSeriesList = ALL_CHART_SERIES.filter(s => activeSeries[s.key]);

    const visibleFamilies = MP_METRIC_FAMILIES.filter(m => visibleCols[m.family]);

    const MPChart = () => {
      const fullW = (chartWidth * 2) + 8;
      const pad = { top: 16, right: 16, bottom: 32, left: 52 };
      const w = fullW - pad.left - pad.right;
      const ht = 340 - pad.top - pad.bottom;
      const allVals = activeSeriesList.flatMap(s => indexedData.map(d => d[s.key]).filter(v => v != null && isFinite(v)));
      const yMin = Math.min(...allVals, 100) - 3;
      const yMax = Math.max(...allVals, 100) + 3;
      const yRange = yMax - yMin || 1;
      const xPos = (i) => pad.left + (i / (indexedData.length - 1)) * w;
      const yPos = (v) => pad.top + ht - ((v - yMin) / yRange) * ht;
      const gridCount = 7;
      const yTicks = Array.from({ length: gridCount }, (_, i) => yMin + yRange * (i / (gridCount - 1)));

      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${fullW} 340`} style={{ overflow: "visible" }}>
          {yTicks.map((tick, i) => (
            <g key={`g${i}`}>
              <line x1={pad.left} y1={yPos(tick)} x2={pad.left + w} y2={yPos(tick)}
                stroke={Math.abs(tick - 100) < 0.5 ? T.text.muted : T.border.subtle}
                strokeWidth={Math.abs(tick - 100) < 0.5 ? 0.8 : 0.4}
                strokeDasharray={Math.abs(tick - 100) < 0.5 ? "none" : "2,4"}
                opacity={Math.abs(tick - 100) < 0.5 ? 0.5 : 1} />
              <text x={pad.left - 5} y={yPos(tick) + 3} fill={Math.abs(tick - 100) < 0.5 ? T.text.secondary : T.text.muted}
                fontSize={7} fontFamily={T.font.mono} textAnchor="end" fontWeight={Math.abs(tick - 100) < 0.5 ? 600 : 400}>
                {tick.toFixed(0)}
              </text>
            </g>
          ))}
          <text x={pad.left - 5} y={yPos(100) - 6} fill={T.text.secondary} fontSize={6} fontFamily={T.font.mono} textAnchor="end" opacity={0.7}>BASE</text>
          {forecastIdx >= 0 && (
            <>
              <rect x={xPos(forecastIdx)} y={pad.top} width={w - (xPos(forecastIdx) - pad.left)} height={ht} fill={T.text.cyan} opacity={0.025} />
              <line x1={xPos(forecastIdx)} y1={pad.top} x2={xPos(forecastIdx)} y2={pad.top + ht} stroke={T.text.cyan} strokeWidth={1} strokeDasharray="4,3" opacity={0.35} />
              <text x={xPos(forecastIdx) + 5} y={pad.top + 10} fill={T.text.cyan} fontSize={7} fontFamily={T.font.mono} opacity={0.5}>FORECAST →</text>
              <text x={xPos(forecastIdx) - 5} y={pad.top + 10} fill={T.text.green} fontSize={7} fontFamily={T.font.mono} opacity={0.5} textAnchor="end">← ACTUAL</text>
            </>
          )}
          {activeSeriesList.map((s) => {
            const pts = indexedData.map((d, i) => ({ x: xPos(i), y: yPos(d[s.key]), i, val: d[s.key] })).filter(pt => isFinite(pt.y));
            if (!pts.length) return null;
            const pathD = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
            const dimmed = highlightFamily && s.family !== highlightFamily;
            return (
              <g key={s.key} opacity={dimmed ? 0.15 : 0.85}>
                <path d={pathD} fill="none" stroke={s.color} strokeWidth={s.thick ? 2.5 : 1.5}
                  strokeDasharray={s.dashArray || "none"} />
                {pts.filter((_, i) => i < forecastIdx || forecastIdx < 0).map((pt, pi) => (
                  <circle key={pi} cx={pt.x} cy={pt.y} r={1.8} fill={s.color} opacity={0.7} />
                ))}
                {pts.length > 0 && (
                  <text x={pts[pts.length - 1].x + 4} y={pts[pts.length - 1].y + 3} fill={s.color} fontSize={7} fontFamily={T.font.mono} fontWeight={600}>
                    {pts[pts.length - 1].val.toFixed(0)}
                  </text>
                )}
              </g>
            );
          })}
          {indexedData.map((d, i) => (
            <text key={i} x={xPos(i)} y={pad.top + ht + 16}
              fill={d.isForecast ? T.text.cyan : T.text.muted}
              fontSize={7} fontFamily={T.font.mono} textAnchor="middle" fontWeight={d.year === 2025 ? 700 : 400}>
              {d.year}
            </text>
          ))}
          {indexedData.map((d, i) => (
            <line key={`vl${i}`} x1={xPos(i)} y1={pad.top + ht} x2={xPos(i)} y2={pad.top + ht + 4} stroke={T.text.muted} strokeWidth={0.5} opacity={0.4} />
          ))}
        </svg>
      );
    };

    const fmtRaw = (key, val) => {
      if (key === "rent" || key === "medianIncome") return fmt(val);
      if (key === "occ" || key === "rentGrowth" || key === "concessions" || key === "capRate" || key === "popGrowth") return pct(val);
      if (key === "rentPerSF") return `$${val.toFixed(2)}`;
      if (key === "traffic" || key === "absorption") return kFmt(val);
      if (key === "jobsPerUnit") return val.toFixed(2);
      if (key === "population") return kFmt(val);
      return val;
    };

    const propRawVal = (d, family) => {
      const mf = MP_METRIC_FAMILIES.find(m => m.family === family);
      if (!mf || !mf.propKey) return null;
      return d.raw[mf.propKey];
    };
    const geoRawVal = (geo, d, family) => {
      const mf = MP_METRIC_FAMILIES.find(m => m.family === family);
      if (!mf || !mf.geoKey) return null;
      return d.raw[geo]?.[mf.geoKey];
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0", flexWrap: "wrap" }}>
          <Badge color={T.text.green}>ACTUAL 2018–2025</Badge>
          <Badge color={T.text.cyan}>FORECAST 2026–2035</Badge>
          <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>
            Indexed · 4 Geo Levels · Correlation Engine · Click metric → highlight · Dbl-click → group mode
          </span>
          <div style={{ flex: 1 }} />
          <PatternBadge pattern={td.outputs.t07_pattern} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="MARKET & PERFORMANCE — INDEXED" subtitle="Base 100 = 2018 · Property + Trade Area + Submarket + MSA" icon="◈" borderColor={T.text.amber}
            action={<span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>4 GEO LEVELS × CORRELATION ENGINE</span>} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}` }}>
            {GEO_GROUP_CFG.map(g => (
              <div key={g.key} onClick={() => toggleGroupAll(g.key)} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "2px 8px",
                background: `${g.color}10`, border: `1px solid ${g.color}40`, borderRadius: 2, cursor: "pointer",
              }}>
                <div style={{ width: 12, height: 2, background: g.color,
                  borderBottom: g.key === "trade" ? "1px dotted" : g.key === "sub" ? "1px dashed" : g.key === "msa" ? "1px dotted" : "none" }} />
                <span style={{ fontSize: 7, fontFamily: T.font.mono, fontWeight: 600, color: g.color, letterSpacing: "0.03em" }}>{g.label}</span>
              </div>
            ))}
            <div style={{ flex: 1 }} />
            {highlightFamily && (
              <div onClick={() => { setHighlightFamily(null); setTableGroupMode(null); setActiveSeries(defaultSeriesState); }}
                style={{ padding: "2px 8px", background: `${T.text.red}20`, border: `1px solid ${T.text.red}40`, borderRadius: 2, cursor: "pointer" }}>
                <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.red }}>✕ CLEAR HIGHLIGHT</span>
              </div>
            )}
            {tableGroupMode && (
              <div onClick={() => { setTableGroupMode(null); setActiveSeries(defaultSeriesState); }}
                style={{ padding: "2px 8px", background: `${T.text.red}20`, border: `1px solid ${T.text.red}40`, borderRadius: 2, cursor: "pointer" }}>
                <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.red }}>✕ EXIT GROUP MODE</span>
              </div>
            )}
          </div>
          <div style={{ height: 340, padding: "0 4px" }}>
            <MPChart />
          </div>
        </div>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <div style={{ display: "flex", alignItems: "center", padding: "5px 10px", borderBottom: `1px solid ${T.border.subtle}` }}>
            <span style={{ fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber }}>≡</span>
            <span style={{ fontSize: 9, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary, marginLeft: 6 }}>
              {tableGroupMode ? `GROUP: ${tableGroupMode.toUpperCase()} ACROSS GEO LEVELS` : "DATA TABLE — ALL METRICS × 4 GEO LEVELS"}
            </span>
            <div style={{ flex: 1 }} />
            <div onClick={() => setShowColPicker(!showColPicker)} style={{
              padding: "2px 8px", background: showColPicker ? `${T.text.amber}20` : T.bg.input,
              border: `1px solid ${showColPicker ? T.text.amber : T.border.subtle}`, borderRadius: 2, cursor: "pointer",
            }}>
              <span style={{ fontSize: 7, fontFamily: T.font.mono, color: showColPicker ? T.text.amber : T.text.muted }}>⚙ COLUMNS</span>
            </div>
          </div>
          {showColPicker && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}`, background: T.bg.panelAlt }}>
              {MP_METRIC_FAMILIES.map(m => (
                <div key={m.family} onClick={() => setVisibleCols(prev => ({ ...prev, [m.family]: !prev[m.family] }))} style={{
                  padding: "2px 6px", background: visibleCols[m.family] ? `${m.color}15` : T.bg.input,
                  border: `1px solid ${visibleCols[m.family] ? `${m.color}50` : T.border.subtle}`,
                  borderRadius: 2, cursor: "pointer", opacity: visibleCols[m.family] ? 1 : 0.4,
                }}>
                  <span style={{ fontSize: 7, fontFamily: T.font.mono, fontWeight: 600, color: visibleCols[m.family] ? m.color : T.text.muted }}>{m.label}</span>
                </div>
              ))}
            </div>
          )}
          {(() => {
            const PROP_COLS = [
              { key: "rent", label: "RENT", family: "rent", fm: (v) => `$${v.toLocaleString()}` },
              { key: "occ", label: "OCC", family: "occ", fm: pct },
              { key: "rentGrowth", label: "GRWTH", family: "rentGrowth", fm: pct, growthCol: true },
              { key: "concessions", label: "CONC", family: "concessions", fm: pct },
              { key: "rentPerSF", label: "$/SF", family: "rentPerSF", fm: (v) => `$${v.toFixed(2)}` },
              { key: "monthlyTraffic", label: "TRAFFIC", family: "traffic", fm: kFmt },
            ];
            const GEO_COLS = [
              { key: "avgRent", label: "RENT", family: "rent", fm: (v) => `$${kFmt(v)}` },
              { key: "rentGrowth", label: "GRWTH", family: "rentGrowth", fm: pct, growthCol: true },
              { key: "occupancy", label: "OCC", family: "occ", fm: pct },
              { key: "concessions", label: "CONC", family: "concessions", fm: pct },
              { key: "rentPerSF", label: "$/SF", family: "rentPerSF", fm: (v) => `$${v.toFixed(2)}` },
              { key: "capRate", label: "CAP", family: "capRate", fm: pct },
              { key: "absorptionPerMonth", label: "ABSRP", family: "absorption", fm: kFmt },
              { key: "jobsPerUnit", label: "J/U", family: "jobsPerUnit", fm: (v) => v.toFixed(2) },
              { key: "medianIncome", label: "MED INC", family: "medianIncome", fm: (v) => `$${kFmt(v)}` },
              { key: "population", label: "POP", family: "population", fm: kFmt },
              { key: "popGrowth", label: "POP%", family: "popGrowth", fm: pct },
            ];
            const GEO_LABELS = [
              { label: "TRADE AREA (3mi)", dataKey: "ta", color: "#FF9F7F" },
              { label: "SUBMARKET", dataKey: "sub", color: "#FF6B6B" },
              { label: "TAMPA MSA", dataKey: "msa", color: "#D4A07F" },
            ];
            const filtPropCols = PROP_COLS.filter(c => visibleCols[c.family]);
            const filtGeoCols = GEO_COLS.filter(c => visibleCols[c.family]);
            const growthColor = (v) => v > 0 ? T.text.green : v < 0 ? T.text.red : T.text.secondary;
            const cs = (isFc, isHdr = false, hl = false) => ({
              padding: "3px 6px", fontSize: 8, fontFamily: T.font.mono, textAlign: "right",
              borderRight: `1px solid ${T.border.subtle}`, borderBottom: `1px solid ${T.border.subtle}`,
              color: isFc ? T.text.cyan : T.text.primary,
              background: hl ? `${T.text.amber}12` : isHdr ? T.bg.header : "transparent",
              whiteSpace: "nowrap", fontWeight: isHdr ? 700 : 400,
              boxShadow: hl ? `inset 0 0 0 1px ${T.text.amber}30` : "none",
            });

            if (tableGroupMode) {
              const mf = MP_METRIC_FAMILIES.find(m => m.family === tableGroupMode);
              if (!mf) return null;
              const grpCols = [];
              if (mf.propKey) grpCols.push({ label: "PROPERTY", dataKey: "prop", color: T.text.amber, propKey: mf.propKey });
              if (mf.geoKey) {
                grpCols.push({ label: "TRADE AREA", dataKey: "ta", color: "#FF9F7F", geoKey: mf.geoKey });
                grpCols.push({ label: "SUBMARKET", dataKey: "sub", color: "#FF6B6B", geoKey: mf.geoKey });
                grpCols.push({ label: "TAMPA MSA", dataKey: "msa", color: "#D4A07F", geoKey: mf.geoKey });
              }
              const fmtGrp = GEO_COLS.find(gc => gc.family === mf.family) || PROP_COLS.find(pc => pc.family === mf.family);
              return (
                <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 480 }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 4 }}>
                      <tr>
                        <th style={{ ...cs(false, true), position: "sticky", left: 0, zIndex: 5, background: T.bg.header, textAlign: "center", minWidth: 42 }}>YR</th>
                        {grpCols.map(c => (
                          <th key={c.dataKey} style={{ ...cs(false, true), textAlign: "center", color: c.color, borderBottom: `2px solid ${c.color}`, minWidth: 100, background: T.bg.header }}>{c.label} — {mf.label}</th>
                        ))}
                        <th style={{ ...cs(false, true), textAlign: "center", color: T.text.purple, minWidth: 80, background: T.bg.header }}>DELTA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...indexedData].reverse().map((d, ri) => {
                        const geoMap = { prop: d.raw, ta: d.raw.ta, sub: d.raw.sub, msa: d.raw.msa };
                        const vals = grpCols.map(c => {
                          const src = geoMap[c.dataKey];
                          if (!src) return null;
                          const k = c.propKey || c.geoKey;
                          return src[k] ?? null;
                        });
                        const validVals = vals.filter(v => v != null);
                        const spread = validVals.length >= 2 ? Math.max(...validVals) - Math.min(...validVals) : null;
                        return (
                          <tr key={d.year} style={{ background: ri % 2 === 0 ? "transparent" : T.bg.panelAlt }}>
                            <td style={{ ...cs(d.isForecast), position: "sticky", left: 0, zIndex: 2, background: ri % 2 === 0 ? T.bg.panel : T.bg.panelAlt, fontWeight: 700, textAlign: "center", color: d.isForecast ? T.text.cyan : T.text.amber }}>{d.year}</td>
                            {vals.map((v, vi) => (
                              <td key={vi} style={{ ...cs(d.isForecast), fontSize: 10, fontWeight: 600, textAlign: "center" }}>
                                {v != null && fmtGrp ? fmtGrp.fm(v) : "—"}
                              </td>
                            ))}
                            <td style={{ ...cs(d.isForecast), textAlign: "center", color: T.text.purple, fontSize: 8 }}>
                              {spread != null ? (spread < 10 ? spread.toFixed(1) : kFmt(spread)) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }

            return (
              <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 480 }}>
                <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 4 }}>
                    <tr>
                      <th rowSpan={2} style={{ ...cs(false, true), position: "sticky", left: 0, zIndex: 5, background: T.bg.header, textAlign: "center", minWidth: 42 }}>YR</th>
                      {filtPropCols.length > 0 && <th colSpan={filtPropCols.length} style={{ ...cs(false, true), textAlign: "center", color: T.text.amber, borderBottom: `2px solid ${T.text.amber}`, background: T.bg.header }}>PROPERTY</th>}
                      {GEO_LABELS.map(g => filtGeoCols.length > 0 && (
                        <th key={g.dataKey} colSpan={filtGeoCols.length} style={{ ...cs(false, true), textAlign: "center", color: g.color, borderBottom: `2px solid ${g.color}`, background: T.bg.header }}>{g.label}</th>
                      ))}
                    </tr>
                    <tr>
                      {filtPropCols.map(c => (
                        <th key={`ph-${c.key}`} onClick={() => handleMetricClick(c.family)} onDoubleClick={() => handleMetricDblClick(c.family)}
                          style={{ ...cs(false, true), fontSize: 7, color: isHi(c.family) ? T.text.amber : T.text.secondary, textAlign: "center", minWidth: 52, cursor: "pointer",
                            boxShadow: isHi(c.family) ? `inset 0 0 0 1px ${T.text.amber}30` : "none", background: T.bg.header }}>{c.label}</th>
                      ))}
                      {GEO_LABELS.map(g => filtGeoCols.map(c => (
                        <th key={`${g.dataKey}-${c.key}`} onClick={() => handleMetricClick(c.family)} onDoubleClick={() => handleMetricDblClick(c.family)}
                          style={{ ...cs(false, true), fontSize: 7, color: isHi(c.family) ? T.text.amber : T.text.secondary, textAlign: "center", minWidth: 52, cursor: "pointer",
                            boxShadow: isHi(c.family) ? `inset 0 0 0 1px ${T.text.amber}30` : "none", background: T.bg.header }}>{c.label}</th>
                      )))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...indexedData].reverse().map((d, ri) => {
                      const ta = d.raw.ta; const sub = d.raw.sub; const msa = d.raw.msa;
                      return (
                        <tr key={d.year} style={{ background: ri % 2 === 0 ? "transparent" : T.bg.panelAlt }}>
                          <td style={{ ...cs(d.isForecast), position: "sticky", left: 0, zIndex: 2, background: ri % 2 === 0 ? T.bg.panel : T.bg.panelAlt, fontWeight: 700, textAlign: "center", color: d.isForecast ? T.text.cyan : T.text.amber }}>{d.year}</td>
                          {filtPropCols.map(c => {
                            const val = d.raw[c.key]; const hl = isHi(c.family);
                            return <td key={`p-${c.key}`} style={{ ...cs(d.isForecast, false, hl), color: c.growthCol && val != null ? growthColor(val) : d.isForecast ? T.text.cyan : T.text.primary }}>{val != null ? c.fm(val) : "—"}</td>;
                          })}
                          {[{ data: ta }, { data: sub }, { data: msa }].map((geo, gi) => (
                            filtGeoCols.map(c => {
                              const val = geo.data ? geo.data[c.key] : null; const hl = isHi(c.family);
                              return <td key={`g${gi}-${c.key}`} style={{ ...cs(d.isForecast, false, hl), color: c.growthCol && val != null ? growthColor(val) : d.isForecast ? T.text.cyan : T.text.primary }}>{val != null ? c.fm(val) : "—"}</td>;
                            })
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        </div>

        <div style={{ width: 320, minWidth: 320, display: "flex", flexDirection: "column", gap: 8 }}>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="5-YEAR OUTLOOK" subtitle="2025 → 2030 · Correlation Engine" icon="◎" borderColor={T.text.green} />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {fiveYearOutlook.map((o, oi) => {
              const family = o.metricFamily;
              const hi = isHi(family);
              return (
                <div key={oi} onClick={() => handleMetricClick(family)} onDoubleClick={() => handleMetricDblClick(family)}
                  style={{
                    padding: "6px 8px", borderBottom: `1px solid ${T.border.subtle}`, cursor: "pointer",
                    background: hi ? `${T.text.amber}10` : "transparent", borderLeft: hi ? `3px solid ${T.text.amber}` : "3px solid transparent",
                    transition: "all 0.15s",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                    <span style={{ fontSize: 9, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>{o.metric}</span>
                    <span style={{ fontSize: 7, fontFamily: T.font.mono, color: o.direction === "up" ? T.text.green : o.direction === "down" ? T.text.red : T.text.amber }}>
                      {o.direction === "up" ? "▲" : o.direction === "down" ? "▼" : "►"} {o.delta5yr}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>NOW {o.current}</span>
                    <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.cyan }}>1Y {o.yr1}</span>
                    <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.cyan }}>3Y {o.yr3}</span>
                    <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.cyan, fontWeight: 600 }}>5Y {o.yr5}</span>
                  </div>
                  <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.secondary, lineHeight: 1.5 }}>{o.narrative}</div>
                  <div style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted, marginTop: 2 }}>SIGNAL: {o.signal}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="CORRELATION ENGINE" subtitle={`Top ${topCorrelations.length} Correlations`} icon="⊕" borderColor={T.text.purple} />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {topCorrelations.map((c, ci) => (
              <div key={ci} style={{
                padding: "6px 8px", borderBottom: `1px solid ${T.border.subtle}`,
                background: ci === 0 ? `${T.text.green}06` : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 8, fontFamily: T.font.mono, fontWeight: 700, color: T.text.primary }}>{c.metricA} → {c.metricB}</span>
                  <div style={{ flex: 1 }} />
                  <Badge color={Math.abs(c.r) >= 0.7 ? T.text.green : Math.abs(c.r) >= 0.5 ? T.text.amber : T.text.red}
                    bg={Math.abs(c.r) >= 0.7 ? `${T.text.green}15` : `${T.text.amber}15`}>
                    r={c.r} · {c.strength}
                  </Badge>
                </div>
                <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.secondary, lineHeight: 1.4 }}>{c.narrative}</div>
              </div>
            ))}
          </div>
        </div>

        </div>
        </div>
      </div>
    );
  };

  // ─── FINANCIALS TAB ──────────────────────────────────────
  const FinancialsTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      {/* 5-Year Income & Expense */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader title="INCOME & EXPENSE — 5 YEAR" icon="$" borderColor={T.text.green} />
        <div style={{ fontSize: 8, fontFamily: T.font.mono, overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px repeat(5, 1fr)", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, minWidth: 550 }}>
            <span style={{ color: T.text.muted, fontWeight: 600 }}> </span>
            {p.incomeExpense.map(ie => (
              <span key={ie.year} style={{ color: T.text.muted, fontWeight: 600, textAlign: "right", letterSpacing: "0.05em" }}>{ie.year}</span>
            ))}
          </div>
          {[
            { label: "Gross Potential Rent", key: "gpr", color: T.text.primary },
            { label: "Vacancy Loss", key: "vacLoss", color: T.text.red, neg: true },
            { label: "Effective Gross Income", key: "egi", color: T.text.primary, bold: true },
            { label: "Operating Expenses", key: "opex", color: T.text.red, neg: true },
            { label: "Net Operating Income", key: "noi", color: T.text.green, bold: true },
            { label: "Expense Ratio", key: "expRatio", color: T.text.amber, isPct: true },
          ].map((row, ri) => (
            <div key={ri} style={{
              display: "grid", gridTemplateColumns: "120px repeat(5, 1fr)", padding: "3px 8px", minWidth: 550,
              borderBottom: row.bold ? `1px solid ${T.border.medium}` : `1px solid ${T.border.subtle}08`,
              borderTop: row.label === "Net Operating Income" ? `1px solid ${T.text.amber}40` : "none",
              background: row.bold ? `${T.text.amber}04` : (ri % 2 === 0 ? T.bg.panel : T.bg.panelAlt),
            }}>
              <span style={{ color: row.bold ? T.text.primary : T.text.secondary, fontWeight: row.bold ? 600 : 400 }}>{row.label}</span>
              {p.incomeExpense.map((ie, i) => (
                <span key={i} style={{ color: row.color, fontWeight: row.bold ? 700 : 400, textAlign: "right" }}>
                  {row.isPct ? pct(ie[row.key]) : `${row.neg ? "(" : ""}${fmt(ie[row.key])}${row.neg ? ")" : ""}`}
                </span>
              ))}
            </div>
          ))}
          {/* NOI Growth row */}
          <div style={{ display: "grid", gridTemplateColumns: "120px repeat(5, 1fr)", padding: "3px 8px", minWidth: 550, background: T.bg.panelAlt }}>
            <span style={{ color: T.text.muted }}>NOI Growth YoY</span>
            {p.incomeExpense.map((ie, i) => {
              if (i === 0) return <span key={i} style={{ color: T.text.muted, textAlign: "right" }}>—</span>;
              const growth = ((ie.noi / p.incomeExpense[i-1].noi) - 1) * 100;
              return <span key={i} style={{ color: growth >= 0 ? T.text.green : T.text.red, textAlign: "right" }}>{growth >= 0 ? "+" : ""}{pct(growth)}</span>;
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="VALUATION INDICATORS" icon="◈" borderColor={T.text.amber} />
          <DataRow label="Implied Cap Rate" value={pct(p.capRateImplied)} color={T.text.cyan} />
          <DataRow label="Price / Unit (Last Sale)" value={fmtFull(Math.round(p.lastSalePrice / p.units))} />
          <DataRow label="Price / SF" value={`$${(p.lastSalePrice / p.buildingSF).toFixed(0)}`} />
          <DataRow label="Just Value (2025)" value={fmtFull(p.justValue2025)} color={T.text.amber} />
          <DataRow label="Value / Unit (Appraiser)" value={fmtFull(Math.round(p.justValue2025 / p.units))} />
          <DataRow label="NOI / Unit" value={fmtFull(Math.round(p.noiTrailing12 / p.units))} sub="/yr" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
            <SectionHeader title="RENT ROLL SUMMARY" icon="≡" borderColor={T.text.cyan} />
            <DataRow label="Total Units" value={p.units} />
            <DataRow label="Occupied" value={Math.round(p.units * p.currentOccupancy / 100)} sub={pct(p.currentOccupancy)} color={T.text.green} />
            <DataRow label="Vacant" value={Math.round(p.units * (100 - p.currentOccupancy) / 100)} sub={pct(100 - p.currentOccupancy)} color={T.text.red} />
            <DataRow label="Avg Effective Rent" value={`$${p.avgEffectiveRent.toLocaleString()}`} />
            <DataRow label="Avg Market Rent" value={`$${p.avgMarketRent.toLocaleString()}`} />
            <DataRow label="Loss-to-Lease" value={pct((1 - p.avgEffectiveRent / p.avgMarketRent) * 100)} color={T.text.amber} />
          </div>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2, padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted, marginBottom: 8, letterSpacing: "0.1em" }}>PLATFORM INTELLIGENCE</div>
            <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.amber, lineHeight: 1.6, padding: "0 8px" }}>
              Deeper financial modeling requires a <strong>Deal Capsule</strong>. Create a deal to unlock the 3-Layer ProForma Engine (M09), capital structure analysis (M11), and AI-adjusted assumptions.
            </div>
            <div onClick={() => setShowCreateDeal(true)} style={{
              margin: "10px auto 4px", padding: "6px 16px", background: `${T.text.amber}20`,
              border: `1px solid ${T.text.amber}60`, borderRadius: 2, cursor: "pointer",
              fontSize: 10, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber,
              letterSpacing: "0.05em", display: "inline-block",
            }}>CREATE DEAL →</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── COMPS TAB ───────────────────────────────────────────
  const CompsTab = () => {
    const unitTypes = ["Studio", "1BR/1BA", "2BR/2BA", "3BR/2BA"];

    const safeFloat = (v: any): number => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    const normOcc = (v: any): number => { const n = safeFloat(v); return n > 0 && n <= 1 ? n * 100 : n; };
    const normConc = (v: any): number => { const n = safeFloat(v); return n > 0 && n <= 1 ? n * 100 : n; };
    const normCap = (v: any): number => { const n = safeFloat(v); return n > 1 ? n / 100 : n; };

    const buildRentComps = (): Array<any> => {
      if (!marketComps) return p.rentComps.map((c: any) => ({ ...c, _source: 'mock' }));
      const dealRows = (marketComps.rentComps?.deal || []).map((r: any) => ({
        name: r.property_name || r.address || '—',
        units: r.units || 0,
        rent: Math.round(safeFloat(r.avg_asking_rent)),
        dist: '—',
        class: r.asset_class || '—',
        occ: normOcc(r.occupancy_pct),
        yearBuilt: r.year_built || 0,
        stories: r.stories ?? null,
        concessions: normConc(r.concession_pct),
        monthlyTraffic: 0,
        unitMix: [],
        _source: 'costar',
        _asOf: r.data_as_of || r.snapshot_date,
      }));
      const platformRows = (marketComps.rentComps?.platform || []).map((r: any) => ({
        name: r.property_name || r.address || '—',
        units: r.units || 0,
        rent: Math.round(safeFloat(r.avg_asking_rent)),
        dist: '—',
        class: r.asset_class || '—',
        occ: normOcc(r.occupancy_pct),
        yearBuilt: r.year_built || 0,
        stories: r.stories ?? null,
        concessions: normConc(r.concession_pct),
        monthlyTraffic: 0,
        unitMix: [],
        _source: 'platform',
        _asOf: r.data_as_of || r.snapshot_date,
      }));
      const merged = [...dealRows, ...platformRows];
      return merged.length > 0 ? merged : p.rentComps.map((c: any) => ({ ...c, _source: 'mock' }));
    };

    const realRentComps = buildRentComps();

    const pcComps: any[] = saleCompSet?.comps ?? saleCompSet?.members ?? [];
    const pcCompCount: number = saleCompSet?.comp_count ?? pcComps.length;
    const TIME_BANDS_PC = ['1Y', '2Y', '3Y', '5Y'];
    const pcNow = Date.now();
    const pcInWindow = (c: any, years: number) => {
      if (!c.recording_date) return false;
      return new Date(String(c.recording_date)).getTime() >= pcNow - years * 365.25 * 24 * 60 * 60 * 1000;
    };
    let filteredPcComps = [...pcComps];
    if (compVintageBand) {
      const windowYears = parseInt(compVintageBand);
      filteredPcComps = filteredPcComps.filter((c: any) => pcInWindow(c, windowYears));
    }
    if (compSortField === 'ppu') filteredPcComps.sort((a: any, b: any) => (Number(b.price_per_unit) || 0) - (Number(a.price_per_unit) || 0));
    else if (compSortField === 'cap') filteredPcComps.sort((a: any, b: any) => {
      const aCap = a.implied_cap_rate != null ? Number(a.implied_cap_rate) : 999;
      const bCap = b.implied_cap_rate != null ? Number(b.implied_cap_rate) : 999;
      return aCap - bCap;
    });
    else filteredPcComps.sort((a: any, b: any) => (String(b.recording_date) > String(a.recording_date) ? 1 : -1));
    const pcOutlierIds = pcComputeOutlierIds(filteredPcComps);

    const SrcBadge = ({ src }: { src: string }) => {
      if (src === 'costar') return <span style={{ fontSize: 6, background: '#f97316', color: '#fff', borderRadius: 2, padding: '1px 3px', fontWeight: 700, letterSpacing: '0.04em' }}>CoStar</span>;
      if (src === 'platform') return <span style={{ fontSize: 6, background: '#334155', color: '#94a3b8', borderRadius: 2, padding: '1px 3px', fontWeight: 600 }}>Platform</span>;
      return <span style={{ fontSize: 6, color: T.text.muted }}>—</span>;
    };

    const hasNoDealComps = marketComps && !marketComps.hasDealComps && marketComps.dealId;

    return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      {/* Upload prompt — shown when a deal is linked but no CoStar files have been uploaded */}
      {hasNoDealComps && (
        <div style={{ background: '#451a03', border: '1px solid #f97316', borderRadius: 2, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span style={{ fontSize: 8, fontFamily: T.font.mono, color: '#f97316', fontWeight: 700, letterSpacing: '0.08em' }}>NO COSTAR DATA UPLOADED</span>
            <span style={{ fontSize: 8, fontFamily: T.font.mono, color: '#fdba74', marginLeft: 8 }}>Platform comps shown below — upload a CoStar export to add deal-specific rent &amp; sale comps</span>
          </div>
          {marketComps.dealId && (
            <a href={`/deals/${marketComps.dealId}/detail?tab=documents`} style={{ fontSize: 7, fontFamily: T.font.mono, color: '#f97316', textDecoration: 'none', border: '1px solid #f97316', borderRadius: 2, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>UPLOAD →</a>
          )}
        </div>
      )}
      {/* Rent Comps — Full Width Expanded */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader title="RENT COMPS" subtitle={marketComps ? `M05 · ${marketComps.submarket || 'Submarket'}` : "M05 · Trade Area"} icon="≡" borderColor={T.text.cyan} />
        <div style={{ fontSize: 8, fontFamily: T.font.mono, overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 36px 52px 36px 38px 34px 34px 38px 44px 36px 46px", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, minWidth: 560 }}>
            {["PROPERTY","UNITS","RENT","OCC","CLASS","YR","STR","CONC","TRAFFIC","DIST","SRC"].map(h => (
              <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>
          {/* Subject row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 36px 52px 36px 38px 34px 34px 38px 44px 36px 46px", padding: "4px 8px", borderBottom: `1px solid ${T.text.amber}40`, background: `${T.text.amber}08`, minWidth: 560 }}>
            <span style={{ color: T.text.amber, fontWeight: 700 }}>SUBJECT</span>
            <span style={{ color: T.text.amber }}>{p.units}</span>
            <span style={{ color: T.text.amber, fontWeight: 700 }}>${p.avgEffectiveRent.toLocaleString()}</span>
            <span style={{ color: T.text.amber }}>{pct(p.currentOccupancy)}</span>
            <span style={{ color: T.text.amber }}>{p.class}</span>
            <span style={{ color: T.text.amber }}>{p.yearBuilt}</span>
            <span style={{ color: T.text.amber }}>{p.stories}</span>
            <span style={{ color: T.text.amber }}>{pct(p.concessionValue)}</span>
            <span style={{ color: T.text.amber }}>{(p.monthlyTraffic/1000).toFixed(1)}k</span>
            <span style={{ color: T.text.amber }}>—</span>
            <span style={{ color: T.text.amber }}>—</span>
          </div>
          {realRentComps.map((c: any, i: number) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.1fr 36px 52px 36px 38px 34px 34px 38px 44px 36px 46px", padding: "4px 8px", borderBottom: `1px solid ${T.border.subtle}08`, background: c._source === 'costar' ? `${T.text.orange}06` : (i % 2 === 0 ? T.bg.panel : T.bg.panelAlt), minWidth: 560 }}>
              <span style={{ color: T.text.primary, fontWeight: 500 }}>{c.name}</span>
              <span style={{ color: T.text.secondary }}>{c.units || '—'}</span>
              <span style={{ color: c.rent > p.avgEffectiveRent ? T.text.green : T.text.red, fontWeight: 600 }}>{c.rent ? `$${c.rent.toLocaleString()}` : '—'}</span>
              <span style={{ color: T.text.secondary }}>{c.occ ? pct(c.occ) : '—'}</span>
              <span style={{ color: T.text.secondary }}>{c.class || '—'}</span>
              <span style={{ color: T.text.secondary }}>{c.yearBuilt || '—'}</span>
              <span style={{ color: T.text.secondary }}>{c.stories || '—'}</span>
              <span style={{ color: c.concessions > p.concessionValue ? T.text.red : T.text.green }}>{c.concessions ? pct(c.concessions) : '—'}</span>
              <span style={{ color: T.text.secondary }}>{c.monthlyTraffic ? `${(c.monthlyTraffic/1000).toFixed(1)}k` : '—'}</span>
              <span style={{ color: T.text.muted }}>{c.dist}</span>
              <span><SrcBadge src={c._source} /></span>
            </div>
          ))}
          <div style={{ padding: "6px 8px", background: T.bg.panelAlt, display: "flex", gap: 12 }}>
            <span style={{ color: T.text.muted, fontSize: 7 }}>WTD AVG:</span>
            <span style={{ color: T.text.secondary }}>
              ${Math.round(p.rentComps.reduce((s, c) => s + c.rent * c.units, 0) / p.rentComps.reduce((s, c) => s + c.units, 0)).toLocaleString()}/mo
            </span>
            <span style={{ color: T.text.muted }}>·</span>
            <span style={{ color: T.text.secondary }}>Conc: {pct(p.rentComps.reduce((s, c) => s + c.concessions * c.units, 0) / p.rentComps.reduce((s, c) => s + c.units, 0))}</span>
            <span style={{ color: T.text.muted }}>·</span>
            <span style={{ color: T.text.secondary }}>Traffic: {(p.rentComps.reduce((s, c) => s + c.monthlyTraffic * c.units, 0) / p.rentComps.reduce((s, c) => s + c.units, 0) / 1000).toFixed(1)}k wtd avg</span>
          </div>
        </div>
      </div>

      {/* Unit Mix Comparison */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="UNIT MIX COMPARISON" subtitle="Subject vs Comps · By Unit Type" icon="▦" borderColor={T.text.purple} />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {unitTypes.map((type, ti) => {
              const su = p.unitMix.find(u => u.type === type);
              if (!su || su.units === 0) return null;
              // Get comps that have this unit type
              const compsWithType = p.rentComps.map(c => {
                const cu = c.unitMix.find(u => u.type === type);
                return cu && cu.units > 0 ? { name: c.name, ...cu, concessions: c.concessions } : null;
              }).filter(Boolean);
              // Weighted averages
              const allRows = [{ name: "Subject", ...su, concessions: p.concessionValue }, ...compsWithType];
              const totalUnitsInType = compsWithType.reduce((s, c) => s + c.units, 0) + su.units;
              const avgRent = Math.round(allRows.reduce((s, r) => s + r.rent * r.units, 0) / totalUnitsInType);
              const avgSF = Math.round(allRows.reduce((s, r) => s + r.sf * r.units, 0) / totalUnitsInType);

              const gridCols = "1.2fr 52px 42px 48px 64px";
              return (
                <div key={ti} style={{ borderBottom: ti < unitTypes.length - 1 ? `2px solid ${T.border.medium}` : "none" }}>
                  {/* Type header */}
                  <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "5px 10px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, fontWeight: 700, color: [T.text.purple, T.text.cyan, T.text.green, T.text.amber][ti], letterSpacing: "0.05em" }}>{type}</span>
                    {["RENT","SQFT","$/SF","CONCESSION"].map(h => (
                      <span key={h} style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
                    ))}
                  </div>
                  {/* Subject row */}
                  <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "4px 10px", background: `${T.text.amber}08`, borderBottom: `1px solid ${T.text.amber}20` }}>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.amber, fontWeight: 700 }}>Subject</span>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.amber, fontWeight: 600 }}>${su.rent.toLocaleString()}</span>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.amber }}>{su.sf}</span>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.amber }}>${(su.rent / su.sf).toFixed(2)}</span>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.amber }}>{p.concessions}</span>
                  </div>
                  {/* Comp rows */}
                  {compsWithType.map((c, ci) => (
                    <div key={ci} style={{ display: "grid", gridTemplateColumns: gridCols, padding: "3px 10px", borderBottom: `1px solid ${T.border.subtle}08`, background: ci % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
                      <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.primary }}>{c.name}</span>
                      <span style={{ fontSize: 8, fontFamily: T.font.mono, color: c.rent > su.rent ? T.text.green : T.text.red, fontWeight: 600 }}>${c.rent.toLocaleString()}</span>
                      <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.secondary }}>{c.sf}</span>
                      <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.secondary }}>${(c.rent / c.sf).toFixed(2)}</span>
                      <span style={{ fontSize: 8, fontFamily: T.font.mono, color: c.concessions > p.concessionValue ? T.text.red : T.text.green }}>
                        {c.concessions > 0 ? `${pct(c.concessions)} GPR` : "None"}
                      </span>
                    </div>
                  ))}
                  {/* Average row */}
                  <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "4px 10px", background: T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}` }}>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted, fontWeight: 600 }}>WTD AVG</span>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.secondary, fontWeight: 600 }}>${avgRent.toLocaleString()}</span>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.secondary }}>{avgSF}</span>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.secondary, fontWeight: 600 }}>${(avgRent / avgSF).toFixed(2)}</span>
                    <span style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>—</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      {/* Sale Comp Transactions — M27 (full width) */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader
          title="SALE COMP TRANSACTIONS"
          subtitle={`${filteredPcComps.length}${compVintageBand ? ` of ${pcCompCount}` : ' RECORDS'} · PROPERTY / DATE / PRICE / $/UNIT / NOI/UNIT / CAP RATE / SRC / DIST`}
          icon="◈"
          borderColor={T.text.amber}
        />
        {saleCompSetLoading && (
          <div style={{ padding: 12, color: T.text.muted, fontFamily: T.font.mono, fontSize: 9 }}>LOADING SALE COMPS…</div>
        )}
        {!saleCompSetLoading && pcComps.length === 0 && (
          <div>
            <div style={{ padding: "16px 8px", textAlign: "center", color: T.text.muted, fontFamily: T.font.mono, fontSize: 8 }}>No sale comps available</div>
            {marketCompsDealId && (
              <div style={{ borderTop: `1px solid ${T.border.subtle}` }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', background: T.bg.panel, borderBottom: `1px solid ${T.border.subtle}` }}>
                  <button
                    onClick={() => {
                      const next = !addCompOpen;
                      setAddCompOpen(next);
                      if (next) loadAddCompPool(marketCompsDealId, []);
                    }}
                    style={{ fontFamily: T.font.mono, fontSize: 8, fontWeight: 600, color: addCompOpen ? T.text.green : T.text.muted, background: addCompOpen ? `${T.text.green}15` : 'transparent', border: `1px solid ${addCompOpen ? T.text.green : T.border.subtle}`, borderRadius: 2, padding: '2px 9px', cursor: 'pointer', letterSpacing: 0.5 }}
                  >
                    {addCompOpen ? '✕ CANCEL' : '+ ADD COMP'}
                  </button>
                </div>
                {addCompOpen && (
                  <div style={{ background: T.bg.header }}>
                    <div style={{ padding: '5px 10px', fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: 0.5, borderBottom: `1px solid ${T.border.subtle}` }}>
                      AVAILABLE COMPS FROM CASCADE — click + to add to set
                    </div>
                    {addCompPoolLoading && (
                      <div style={{ padding: '8px 10px', fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>LOADING AVAILABLE COMPS…</div>
                    )}
                    {!addCompPoolLoading && addCompPool.length === 0 && (
                      <div style={{ padding: '8px 10px', fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>No comps found in cascade for this deal.</div>
                    )}
                    {!addCompPoolLoading && addCompPool.length > 0 && (
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {addCompPool.map((c: any, i: number) => {
                          const isAdding = saleCompAddingId === String(c.id);
                          const capRaw = c.implied_cap_rate != null ? Number(c.implied_cap_rate) : null;
                          return (
                            <div key={c.id ?? i} style={{ display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.9fr 0.9fr 0.9fr 0.3fr', padding: '3px 8px', borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt, fontSize: 8, fontFamily: T.font.mono, alignItems: 'center' }}>
                              <span style={{ color: T.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.property_address || '—'}</span>
                              <span style={{ color: T.text.muted }}>{c.recording_date ? String(c.recording_date).slice(0, 10) : '—'}</span>
                              <span style={{ color: T.text.cyan }}>{c.price_per_unit ? pcFmtUsd(Number(c.price_per_unit)) : '—'}</span>
                              <span style={{ color: T.text.amber }}>{capRaw != null ? `${(capRaw * 100).toFixed(2)}%` : '—'}</span>
                              <span style={{ color: T.text.muted }}>{c.distance_miles != null ? `${Number(c.distance_miles).toFixed(2)} mi` : '—'}</span>
                              <button
                                onClick={() => handleAddComp(String(c.id), marketCompsDealId)}
                                disabled={isAdding}
                                title="Add to comp set"
                                style={{ background: 'transparent', border: `1px solid ${T.text.green}`, borderRadius: 2, color: isAdding ? T.text.muted : T.text.green, cursor: isAdding ? 'wait' : 'pointer', fontFamily: T.font.mono, fontSize: 9, fontWeight: 700, padding: '1px 5px', opacity: isAdding ? 0.5 : 1 }}
                              >
                                {isAdding ? '…' : '+'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {!saleCompSetLoading && pcComps.length > 0 && <>
          {/* KPI strip — 6 cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: T.border.subtle, marginBottom: 1 }}>
            <div style={{ background: T.bg.panel, padding: '4px 8px' }}>
              <div style={{ fontSize: 7, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 0.5 }}>COMP COUNT</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text.amber, fontFamily: T.font.mono }}>{pcCompCount}</div>
            </div>
            <div style={{ background: T.bg.panel, padding: '4px 8px' }}>
              <div style={{ fontSize: 7, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 0.5 }}>AVG $/UNIT</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text.green, fontFamily: T.font.mono }}>{saleCompSet?.avg_price_per_unit ? pcFmtUsd(Number(saleCompSet.avg_price_per_unit)) : '—'}</div>
            </div>
            <div style={{ background: T.bg.panel, padding: '4px 8px' }}>
              <div style={{ fontSize: 7, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 0.5 }}>MEDIAN $/UNIT</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text.cyan, fontFamily: T.font.mono }}>{saleCompSet?.median_price_per_unit ? pcFmtUsd(Number(saleCompSet.median_price_per_unit)) : '—'}</div>
            </div>
            <div style={{ background: T.bg.panel, padding: '4px 8px' }}>
              <div style={{ fontSize: 7, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 0.5 }}>COMP MEDIAN CAP</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text.amber, fontFamily: T.font.mono }}>{pcFmtCapRate(saleCompSet?.median_implied_cap_rate ?? null)}</div>
              <div style={{ fontSize: 7, color: T.text.muted, fontFamily: T.font.mono }}>transaction-reported</div>
            </div>
            <div style={{ background: pcImpliedCapData?.implied_cap_rate != null ? '#00D26A08' : T.bg.panel, padding: '4px 8px', borderLeft: `2px solid ${pcImpliedCapData?.implied_cap_rate != null ? '#00D26A55' : T.border.subtle}` }}>
              <div style={{ fontSize: 7, color: pcImpliedCapData?.implied_cap_rate != null ? '#00D26A' : T.text.muted, fontFamily: T.font.mono, letterSpacing: 0.5 }}>PLATFORM IMPLIED CAP</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: pcImpliedCapData?.implied_cap_rate != null ? '#00D26A' : T.text.muted, fontFamily: T.font.mono }}>
                {pcImpliedCapLoading ? '…' : pcFmtCapRate(pcImpliedCapData?.implied_cap_rate ?? null)}
              </div>
              <div style={{ fontSize: 7, color: T.text.muted, fontFamily: T.font.mono }}>
                {pcImpliedCapData?.rent_source === 'market_vitals' ? 'market rent / price' : pcImpliedCapData?.rent_source === 'line_item_benchmarks' ? 'benchmark / price' : pcImpliedCapLoading ? '' : 'unavailable'}
              </div>
            </div>
            <div style={{ background: pcImpliedCapData?.operator_going_in_cap != null ? '#00BCD408' : T.bg.panel, padding: '4px 8px', borderLeft: `2px solid ${pcImpliedCapData?.operator_going_in_cap != null ? '#00BCD455' : T.border.subtle}` }}>
              <div style={{ fontSize: 7, color: pcImpliedCapData?.operator_going_in_cap != null ? T.text.cyan : T.text.muted, fontFamily: T.font.mono, letterSpacing: 0.5 }}>OPERATOR EXIT CAP</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: pcImpliedCapData?.operator_going_in_cap != null ? T.text.cyan : T.text.muted, fontFamily: T.font.mono }}>
                {pcFmtCapRate(pcImpliedCapData?.operator_going_in_cap ?? null)}
              </div>
              {pcImpliedCapData?.delta_bps != null && pcImpliedCapData?.positioning_label != null && (
                <div style={{ fontSize: 7, fontFamily: T.font.mono, color: pcImpliedCapData.positioning_label === 'ALIGNED' ? '#00D26A' : pcImpliedCapData.positioning_label === 'OPERATOR_ABOVE' ? T.text.amber : T.text.red }}>
                  {pcImpliedCapData.delta_bps > 0 ? '+' : ''}{pcImpliedCapData.delta_bps} bps · {pcImpliedCapData.positioning_label}
                </div>
              )}
            </div>
          </div>

          {/* Cap benchmark banner */}
          {!pcImpliedCapLoading && (() => {
            if (pcImpliedCapData?.implied_cap_rate == null) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, borderLeft: `3px solid ${T.text.muted}` }}>
                  <span style={{ fontSize: 10, color: T.text.muted }}>⚠</span>
                  <span style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted }}>PLATFORM IMPLIED CAP UNAVAILABLE — insufficient benchmark data for this market. Comp-reported cap rates above are transaction-sourced only.</span>
                </div>
              );
            }
            const icd = pcImpliedCapData;
            const posColor = icd.positioning_label === 'ALIGNED' ? '#00D26A' : icd.positioning_label === 'OPERATOR_ABOVE' ? T.text.amber : T.text.red;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '5px 10px', background: '#00D26A06', borderBottom: `1px solid #00D26A22`, borderLeft: `3px solid #00D26A55` }}>
                <span style={{ fontFamily: T.font.mono, fontSize: 7, color: '#00D26A', fontWeight: 700, letterSpacing: 0.5 }}>CAP BENCHMARK</span>
                <span style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted }}>
                  COMP REPORTED: <span style={{ color: T.text.amber, fontWeight: 700 }}>{pcFmtCapRate(icd.comp_reported_cap_rate ?? saleCompSet?.median_implied_cap_rate ?? null)}</span>
                </span>
                <span style={{ color: T.border.subtle }}>·</span>
                <span style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted }}>
                  PLATFORM IMPLIED: <span style={{ color: '#00D26A', fontWeight: 700 }}>{pcFmtCapRate(icd.implied_cap_rate)}</span>
                </span>
                {icd.operator_going_in_cap != null && <>
                  <span style={{ color: T.border.subtle }}>·</span>
                  <span style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted }}>
                    OPERATOR EXIT: <span style={{ color: T.text.cyan, fontWeight: 700 }}>{pcFmtCapRate(icd.operator_going_in_cap)}</span>
                  </span>
                  {icd.delta_bps != null && <>
                    <span style={{ color: T.border.subtle }}>·</span>
                    <span style={{ fontFamily: T.font.mono, fontSize: 8, color: posColor, fontWeight: 700 }}>
                      {icd.delta_bps > 0 ? '+' : ''}{icd.delta_bps} BPS vs PLATFORM · {icd.positioning_label}
                    </span>
                  </>}
                </>}
              </div>
            );
          })()}

          {/* Sort + vintage controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: T.bg.panel, borderBottom: `1px solid ${T.border.subtle}`, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 7, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 0.5, marginRight: 2 }}>SORT</span>
            {(['date', 'ppu', 'cap'] as const).map((f) => {
              const labels = { date: 'DATE ↓', ppu: '$/UNIT ↓', cap: 'CAP RATE ↑' };
              const active = compSortField === f;
              return (
                <button key={f} onClick={() => setCompSortField(f)} style={{ fontFamily: T.font.mono, fontSize: 8, fontWeight: active ? 700 : 400, color: active ? T.text.amber : T.text.muted, background: active ? `${T.text.amber}15` : 'transparent', border: `1px solid ${active ? T.text.amber : T.border.subtle}`, borderRadius: 2, padding: '2px 7px', cursor: 'pointer', letterSpacing: 0.5 }}>
                  {labels[f]}
                </button>
              );
            })}
            <span style={{ width: 1, height: 12, background: T.border.subtle, margin: '0 4px' }} />
            <span style={{ fontSize: 7, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 0.5 }}>VINTAGE</span>
            <button onClick={() => setCompVintageBand(null)} style={{ fontFamily: T.font.mono, fontSize: 8, fontWeight: compVintageBand == null ? 700 : 400, color: compVintageBand == null ? T.text.cyan : T.text.muted, background: compVintageBand == null ? `${T.text.cyan}15` : 'transparent', border: `1px solid ${compVintageBand == null ? T.text.cyan : T.border.subtle}`, borderRadius: 2, padding: '2px 7px', cursor: 'pointer', letterSpacing: 0.5 }}>ALL</button>
            {TIME_BANDS_PC.map((vb) => {
              const active = compVintageBand === vb;
              return (
                <button key={vb} onClick={() => setCompVintageBand(active ? null : vb)} style={{ fontFamily: T.font.mono, fontSize: 8, fontWeight: active ? 700 : 400, color: active ? T.text.cyan : T.text.muted, background: active ? `${T.text.cyan}15` : 'transparent', border: `1px solid ${active ? T.text.cyan : T.border.subtle}`, borderRadius: 2, padding: '2px 7px', cursor: 'pointer', letterSpacing: 0.5 }}>
                  {vb}
                </button>
              );
            })}
            {pcOutlierIds.size > 0 && (
              <span style={{ fontFamily: T.font.mono, fontSize: 7, color: T.text.amber }}>
                ⚠ {pcOutlierIds.size} OUTLIER{pcOutlierIds.size > 1 ? 'S' : ''} FLAGGED
              </span>
            )}
            <button
              onClick={() => {
                const next = !addCompOpen;
                setAddCompOpen(next);
                if (next && marketCompsDealId) loadAddCompPool(marketCompsDealId, pcComps);
              }}
              style={{ marginLeft: 'auto', fontFamily: T.font.mono, fontSize: 8, fontWeight: 600, color: addCompOpen ? T.text.green : T.text.muted, background: addCompOpen ? `${T.text.green}15` : 'transparent', border: `1px solid ${addCompOpen ? T.text.green : T.border.subtle}`, borderRadius: 2, padding: '2px 9px', cursor: 'pointer', letterSpacing: 0.5 }}
            >
              {addCompOpen ? '✕ CANCEL' : '+ ADD COMP'}
            </button>
          </div>

          {/* ADD COMP panel */}
          {addCompOpen && marketCompsDealId && (
            <div style={{ borderBottom: `1px solid ${T.border.subtle}`, background: T.bg.header }}>
              <div style={{ padding: '5px 10px', fontSize: 7, fontFamily: T.font.mono, color: T.text.muted, letterSpacing: 0.5, borderBottom: `1px solid ${T.border.subtle}` }}>
                AVAILABLE COMPS FROM CASCADE — click + to add to set
              </div>
              {addCompPoolLoading && (
                <div style={{ padding: '8px 10px', fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>LOADING AVAILABLE COMPS…</div>
              )}
              {!addCompPoolLoading && addCompPool.length === 0 && (
                <div style={{ padding: '8px 10px', fontSize: 8, fontFamily: T.font.mono, color: T.text.muted }}>No additional comps available from cascade.</div>
              )}
              {!addCompPoolLoading && addCompPool.length > 0 && (
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {addCompPool.map((c: any, i: number) => {
                    const isAdding = saleCompAddingId === String(c.id);
                    const capRaw = c.implied_cap_rate != null ? Number(c.implied_cap_rate) : null;
                    return (
                      <div key={c.id ?? i} style={{ display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.9fr 0.9fr 0.9fr 0.3fr', padding: '3px 8px', borderBottom: `1px solid ${T.border.subtle}08`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt, fontSize: 8, fontFamily: T.font.mono, alignItems: 'center' }}>
                        <span style={{ color: T.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.property_address || '—'}</span>
                        <span style={{ color: T.text.muted }}>{c.recording_date ? String(c.recording_date).slice(0, 10) : '—'}</span>
                        <span style={{ color: T.text.cyan }}>{c.price_per_unit ? pcFmtUsd(Number(c.price_per_unit)) : '—'}</span>
                        <span style={{ color: T.text.amber }}>{capRaw != null ? `${(capRaw * 100).toFixed(2)}%` : '—'}</span>
                        <span style={{ color: T.text.muted }}>{c.distance_miles != null ? `${Number(c.distance_miles).toFixed(2)} mi` : '—'}</span>
                        <button
                          onClick={() => handleAddComp(String(c.id), marketCompsDealId)}
                          disabled={isAdding}
                          title="Add to comp set"
                          style={{ background: 'transparent', border: `1px solid ${T.text.green}`, borderRadius: 2, color: isAdding ? T.text.muted : T.text.green, cursor: isAdding ? 'wait' : 'pointer', fontFamily: T.font.mono, fontSize: 9, fontWeight: 700, padding: '1px 5px', opacity: isAdding ? 0.5 : 1 }}
                        >
                          {isAdding ? '…' : '+'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 0.7fr 0.6fr 0.35fr', padding: '4px 8px', background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, fontSize: 7, fontFamily: T.font.mono }}>
            {['PROPERTY', 'DATE', 'PRICE', '$/UNIT', 'NOI/UNIT', 'CAP RATE', 'SRC', 'DIST', ''].map(h => (
              <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {/* Comp rows */}
          {filteredPcComps.map((c: any, i: number) => {
            const srcLabel = c.source
              ? c.source === 'costar_upload'
                ? 'COSTAR'
                : c.source.replace('georgia_county', 'GA-CTY').replace(/_/g, '-').toUpperCase().slice(0, 8)
              : c.buyer_type?.toUpperCase().slice(0, 8) || '—';
            const isOutlier = pcOutlierIds.has(String(c.id));
            const isDeleting = saleCompDeletingId === String(c.id);
            const capRaw = c.implied_cap_rate != null ? Number(c.implied_cap_rate) : null;
            const noiPerUnit = capRaw != null && Number(c.price_per_unit) > 0 ? capRaw * Number(c.price_per_unit) : null;
            const capLabel = capRaw != null ? `${(capRaw * 100).toFixed(2)}%${isOutlier ? ' ⚠' : ''}` : '—';
            const capColor = isOutlier ? T.text.amber : (capRaw != null ? T.text.amber : T.text.muted);
            const distLabel = c.distance_miles != null ? `${Number(c.distance_miles).toFixed(2)} mi` : '—';
            return (
              <div key={c.id ?? i} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 0.7fr 0.6fr 0.35fr', padding: '4px 8px', borderBottom: `1px solid ${T.border.subtle}08`, background: isOutlier ? `${T.text.amber}06` : c.source === 'costar_upload' ? `${T.text.cyan}08` : (i % 2 === 0 ? T.bg.panel : T.bg.panelAlt), fontSize: 8, fontFamily: T.font.mono, alignItems: 'center' }}>
                <span style={{ color: T.text.secondary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.property_address || '—'}</span>
                <span style={{ color: T.text.muted }}>{c.recording_date ? String(c.recording_date).slice(0, 10) : '—'}</span>
                <span style={{ color: T.text.green }}>{c.derived_sale_price ? pcFmtUsd(Number(c.derived_sale_price)) : '—'}</span>
                <span style={{ color: T.text.cyan, fontWeight: 600 }}>{c.price_per_unit ? pcFmtUsd(Number(c.price_per_unit)) : '—'}</span>
                <span style={{ color: T.text.muted }}>{noiPerUnit != null ? pcFmtUsd(noiPerUnit) : '—'}</span>
                <span style={{ color: capColor, fontWeight: isOutlier ? 700 : 400 }}>{capLabel}</span>
                <span style={{ color: T.text.muted }}>{srcLabel}</span>
                <span style={{ color: T.text.muted }}>{distLabel}</span>
                {marketCompsDealId ? (
                  <button
                    onClick={() => handleDeleteSaleComp(String(c.id), c.property_address || 'this comp', marketCompsDealId)}
                    disabled={isDeleting}
                    title="Remove comp"
                    style={{ background: 'transparent', border: 'none', color: isDeleting ? T.text.muted : T.text.red, cursor: isDeleting ? 'wait' : 'pointer', fontFamily: T.font.mono, fontSize: 10, padding: 0, opacity: isDeleting ? 0.4 : 0.55, lineHeight: 1, transition: 'opacity 0.15s', justifySelf: 'center' }}
                    onMouseEnter={(e) => { if (!isDeleting) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                    onMouseLeave={(e) => { if (!isDeleting) (e.currentTarget as HTMLButtonElement).style.opacity = '0.55'; }}
                  >
                    {isDeleting ? '…' : '✕'}
                  </button>
                ) : <span />}
              </div>
            );
          })}
        </>}
      </div>
    </div>
    );
  };

  // ─── TAX TAB ─────────────────────────────────────────────
  const TaxTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader title="CURRENT TAX ASSESSMENT" subtitle="M26 · Hillsborough County" icon="$" borderColor={T.text.orange} />
        <DataRow label="Just (Market) Value" value={fmtFull(p.justValue2025)} />
        <DataRow label="Assessed Value" value={fmtFull(p.assessedValue2025)} />
        <DataRow label="Taxable Value" value={fmtFull(p.taxableValue2025)} color={T.text.amber} />
        <DataRow label="Millage Rate" value={`${p.millageRate}`} sub="mills" />
        <DataRow label="Annual Tax" value={fmtFull(p.annualTax2025)} color={T.text.red} />
        <DataRow label="Tax / Unit" value={fmtFull(Math.round(p.annualTax2025 / p.units))} sub="/yr" />
        <div style={{ height: 1, background: T.border.medium, margin: "2px 10px" }} />
        <DataRow label="Homestead Exempt" value={p.homesteadExempt ? "YES" : "NO"} color={T.text.red} />
        <DataRow label="Assessment Cap" value={p.assessmentCap} color={T.text.amber} />
        <div style={{ padding: "4px 10px", background: `${T.text.red}08`, borderTop: `1px solid ${T.text.red}20` }}>
          <div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.text.red, lineHeight: 1.5 }}>
            ⚠ REASSESSMENT: On sale, assessed resets to just value. Buyer tax: ~{fmtFull(Math.round(p.justValue2025 * p.millageRate / 1000))}/yr (+{pct((p.justValue2025 * p.millageRate / 1000 / p.annualTax2025 - 1) * 100)})
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="TAX HISTORY" subtitle={`${p.taxHistory.length}-Year`} icon="◊" borderColor={T.text.cyan} />
          <div style={{ fontSize: 8, fontFamily: T.font.mono }}>
            <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 70px 56px", padding: "4px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
              {["YEAR","JUST VALUE","ASSESSED","TAX","SALE"].map(h => (
                <span key={h} style={{ color: T.text.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{h}</span>
              ))}
            </div>
            {p.taxHistory.map((t, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 70px 56px", padding: "4px 8px", borderBottom: `1px solid ${T.border.subtle}08`, background: t.saleDate ? `${T.text.green}06` : (i % 2 === 0 ? T.bg.panel : T.bg.panelAlt) }}>
                <span style={{ color: T.text.primary, fontWeight: 600 }}>{t.year}</span>
                <span style={{ color: T.text.secondary }}>{fmt(t.justValue)}</span>
                <span style={{ color: T.text.secondary }}>{fmt(t.assessed)}</span>
                <span style={{ color: T.text.amber }}>{fmt(t.tax)}</span>
                <span style={{ color: t.saleDate ? T.text.green : T.text.muted, fontWeight: t.saleDate ? 600 : 400 }}>
                  {t.saleDate ? t.saleDate.slice(0, 7) : "—"}
                </span>
              </div>
            ))}
          </div>
          {/* Tax bar chart */}
          <div style={{ padding: "8px 8px 6px", borderTop: `1px solid ${T.border.subtle}` }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 50 }}>
              {p.taxHistory.slice().reverse().map((t, i) => {
                const maxTax = Math.max(...p.taxHistory.map(h => h.tax));
                const barH = (t.tax / maxTax) * 38;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 6, fontFamily: T.font.mono, color: T.text.muted }}>{fmt(t.tax)}</span>
                    <div style={{
                      width: "70%", height: barH, borderRadius: "1px 1px 0 0",
                      background: t.saleDate ? T.text.green : T.text.amber,
                      opacity: 0.6 + (i * 0.05),
                    }} />
                    <span style={{ fontSize: 6, color: t.saleDate ? T.text.green : T.text.muted, fontWeight: t.saleDate ? 600 : 400 }}>{t.year}</span>
                    {t.saleDate && <span style={{ fontSize: 5, color: T.text.green }}>SALE</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="OWNERSHIP CHAIN" icon="◇" borderColor={T.text.purple} />
          {p.ownershipHistory.map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: `1px solid ${T.border.subtle}08`, gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? T.text.green : T.text.muted, border: `2px solid ${i === 0 ? T.text.green : T.text.muted}40`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontFamily: T.font.mono, color: i === 0 ? T.text.primary : T.text.secondary, fontWeight: i === 0 ? 600 : 400 }}>{o.buyer}</div>
                <div style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>{o.date} · {fmtFull(o.price)} · ${o.ppu.toLocaleString()}/unit</div>
              </div>
              {i < p.ownershipHistory.length - 1 && (
                <Badge color={T.text.green}>+{pct(((p.ownershipHistory[i].price / p.ownershipHistory[i + 1].price) - 1) * 100)}</Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── ZONING TAB ──────────────────────────────────────────
  const ZoningTab = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8, animation: "fadeIn 0.15s" }}>
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
        <SectionHeader title="ZONING DESIGNATION" subtitle="M02 · Verified" icon="▦" borderColor={T.text.purple} />
        <div style={{ padding: "10px", textAlign: "center", borderBottom: `1px solid ${T.border.subtle}` }}>
          <div style={{ fontSize: 28, fontFamily: T.font.mono, fontWeight: 800, color: T.text.amber }}>{p.zoning}</div>
          <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary }}>{p.zoningDesc}</div>
        </div>
        <DataRow label="Max Density" value={p.maxDensity} color={T.text.cyan} />
        <DataRow label="Max Height" value={p.maxHeight} color={T.text.cyan} />
        <DataRow label="Floor Area Ratio" value={p.far.toFixed(1)} color={T.text.cyan} />
        <DataRow label="Lot Size" value={`${p.lotSizeAc} ac`} />
        <div style={{ height: 1, background: T.border.medium, margin: "2px 10px" }} />
        <DataRow label="Max Units by Density" value={Math.floor(p.lotSizeAc * 18)} sub={`@ ${p.maxDensity}`} color={T.text.green} />
        <DataRow label="Max SF by FAR" value={`${(Math.floor(p.lotSizeSF * p.far)).toLocaleString()} SF`} sub={`@ FAR ${p.far}`} color={T.text.green} />
        <DataRow label="Current Units" value={p.units} />
        <DataRow label="Density Headroom" value={`+${Math.floor(p.lotSizeAc * 18) - p.units} units`} color={T.text.amber} />
        <div style={{ padding: "4px 10px" }}>
          <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>Source: {p.zoningSource} · Tampa, FL</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="SETBACKS & CONSTRAINTS" icon="◫" borderColor={T.text.orange} />
          <DataRow label="Front Setback" value="25 ft" />
          <DataRow label="Side Setback" value="10 ft" />
          <DataRow label="Rear Setback" value="20 ft" />
          <DataRow label="Flood Zone" value="X (Minimal)" color={T.text.green} />
          <DataRow label="Wetlands" value="None identified" color={T.text.green} />
          <DataRow label="Historic Overlay" value="No" color={T.text.green} />
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
          <SectionHeader title="PARKING ANALYSIS" subtitle="Often the binding constraint" icon="P" borderColor={T.text.red} />
          <DataRow label="Required Ratio" value="1.5:1" sub="per unit" />
          <DataRow label="Current Spaces" value={p.parking.total} />
          <DataRow label="Required @ Current" value={Math.ceil(p.units * 1.5)} />
          <DataRow label="Surplus / (Deficit)" value={`${p.parking.total - Math.ceil(p.units * 1.5)}`} color={p.parking.total >= Math.ceil(p.units * 1.5) ? T.text.green : T.text.red} />
          <DataRow label="Max Units by Parking" value={Math.floor(p.parking.total / 1.5)} color={T.text.amber} sub="if parking-constrained" />
        </div>
      </div>
    </div>
  );

  // ─── TAB CONTENT ROUTER ──────────────────────────────────
  const renderTab = () => {
    switch (activeTab) {
      case "OVERVIEW": return <OverviewTab />;
      case "FINANCIALS": return <FinancialsTab />;
      case "COMPS": return <CompsTab />;
      case "TAX": return <TaxTab />;
      case "ZONING": return <ZoningTab />;
      case "MARKET_PERF": return <MarketPerformanceTab />;
      case "TRAFFIC": return <TrafficTab />;
      default: return <OverviewTab />;
    }
  };

  // ─── CREATE DEAL MODAL ───────────────────────────────────
  const CreateDealModal = () => (
    <div onClick={() => setShowCreateDeal(false)} style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "#000000cc",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 420, background: T.bg.panel, border: `1px solid ${T.text.amber}40`,
        borderRadius: 4, overflow: "hidden", animation: "slideUp 0.2s",
      }}>
        <div style={{ padding: "12px 16px", background: T.bg.header, borderBottom: `1px solid ${T.text.amber}40`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: T.text.amber }}>◈</span>
          <span style={{ fontSize: 12, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.05em" }}>CREATE DEAL CAPSULE</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.secondary, lineHeight: 1.6, marginBottom: 12 }}>
            This will promote <span style={{ color: T.text.white, fontWeight: 600 }}>{p.name}</span> into your deal pipeline and create a Deal Capsule with:
          </div>
          {[
            "JEDI Score engine activation (5 master signals)",
            "4-strategy arbitrage analysis (BTS · Flip · Rental · STR)",
            "3-Layer ProForma (Broker → Platform → Your Adjustments)",
            "Capital structure engine & exit timing optimization",
            "Risk assessment & DD checklist generation",
            "AI Intelligence Brief with collision detection",
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 6, padding: "3px 0", alignItems: "flex-start" }}>
              <span style={{ fontSize: 8, color: T.text.green, marginTop: 1 }}>✓</span>
              <span style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.primary }}>{item}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <div style={{
              flex: 1, padding: "8px 0", textAlign: "center", cursor: "pointer",
              background: `${T.text.amber}20`, border: `1px solid ${T.text.amber}60`, borderRadius: 2,
              fontSize: 11, fontFamily: T.font.mono, fontWeight: 700, color: T.text.amber, letterSpacing: "0.05em",
            }}>CREATE DEAL</div>
            <div onClick={() => setShowCreateDeal(false)} style={{
              padding: "8px 16px", textAlign: "center", cursor: "pointer",
              background: T.bg.input, border: `1px solid ${T.border.medium}`, borderRadius: 2,
              fontSize: 11, fontFamily: T.font.mono, fontWeight: 500, color: T.text.secondary,
            }}>CANCEL</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── MAIN RENDER ─────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100vh", background: T.bg.terminal, fontFamily: T.font.mono, color: T.text.primary, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{css}</style>

      {/* ═══ SHARED TERMINAL CHROME (Status Bar + Ticker + Nav) ═══ */}
      <TerminalChrome
        theme={theme as "dark" | "light"}
        onThemeToggle={toggleTheme}
        showNavBar={true}
      />

      {/* ═══ PROPERTY CARD HEADER ═══ */}
      <div style={{
        display: "flex", alignItems: "center", padding: "6px 12px", gap: 10,
        background: T.bg.topBar, borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0,
      }}>
        <span onClick={() => navigate(-1)} style={{ fontSize: 10, color: T.text.muted, cursor: "pointer", fontFamily: T.font.mono }}>‹ BACK</span>
        <div style={{ width: 1, height: 16, background: T.border.medium }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.text.white, fontFamily: T.font.display, letterSpacing: "0.02em" }}>
              {loadingReal ? "Loading…" : p.name}
            </span>
            <Badge color={T.text.cyan}>{p.type}</Badge>
            <Badge color={T.text.purple}>{p.class}</Badge>
            {!p.inPipeline && <Badge color={T.text.muted}>NOT IN PIPELINE</Badge>}
            {isReal ? (
              <Badge color={T.text.green}>LIVE</Badge>
            ) : id && UUID_RE.test(id) && realError ? (
              <Badge color={T.text.red}>NOT FOUND</Badge>
            ) : (
              <Badge color={T.text.amber}>DEMO DATA</Badge>
            )}
          </div>
          <div style={{ fontSize: 9, color: T.text.secondary, fontFamily: T.font.label, marginTop: 1 }}>
            {realError
              ? `Could not load property ${id}: ${realError}`
              : `${p.address || "—"} · ${p.city || "—"}, ${p.state || "—"} ${p.zip || ""} · ${p.county || "—"} County${p.submarket ? ` · ${p.submarket} submarket` : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {[
            { label: "UNITS", value: p.units },
            { label: "BUILT", value: p.yearBuilt },
            { label: "STORIES", value: p.stories ?? "—" },
            { label: "OCC", value: pct(p.currentOccupancy), color: T.text.green },
            { label: "CAP", value: pct(p.capRateImplied), color: T.text.cyan },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 6, color: T.text.muted, letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color || T.text.primary }}>{s.value}</div>
            </div>
          ))}
          <div style={{ width: 1, height: 24, background: T.border.medium }} />
          <ScoreRing score={82} size={40} strokeWidth={3} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div onClick={() => setShowCreateDeal(true)} style={{
            padding: "5px 12px", cursor: "pointer", borderRadius: 2,
            background: `${T.text.amber}20`, border: `1px solid ${T.text.amber}60`,
            fontSize: 9, fontWeight: 700, color: T.text.amber, letterSpacing: "0.05em",
            display: "flex", alignItems: "center", gap: 4,
          }}><span>◈</span> CREATE DEAL</div>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{
        display: "flex", alignItems: "center", padding: "0 12px",
        background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <div key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: "6px 14px", cursor: "pointer", position: "relative",
            borderBottom: activeTab === tab.key ? `2px solid ${tab.key === "TRAFFIC" ? T.text.blue : tab.key === "MARKET_PERF" ? T.text.green : T.text.amber}` : "2px solid transparent",
          }}>
            <span style={{
              fontSize: 9, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? (tab.key === "TRAFFIC" ? T.text.blue : tab.key === "MARKET_PERF" ? T.text.green : T.text.amber) : T.text.secondary,
              letterSpacing: "0.05em", fontFamily: T.font.mono,
            }}>{tab.label}</span>
            <span style={{ fontSize: 7, color: T.text.muted, marginLeft: 4 }}>{tab.hotkey}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>
          ID: {p.id} · Updated 2h ago · Sources: ATTOM · FDOR · Municode · RentCast · FDOT · SpyFu
        </span>
      </div>

      {/* CONTENT AREA */}
      <div ref={contentRef} style={{ flex: 1, overflow: "auto" }}>
        {renderTab()}
      </div>

      {/* BOTTOM STATUS BAR */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "3px 12px", background: T.bg.topBar,
        borderTop: `1px solid ${T.border.subtle}`, flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 8, fontSize: 7, fontFamily: T.font.mono, color: T.text.muted }}>
          <span>PROPERTY DETAILS</span>
          <span>·</span>
          <span>{p.county ? `${p.county} County` : "—"}{p.state ? `, ${p.state}` : ""}</span>
          <span>·</span>
          <span>Parcel: {p.parcelId || p.id || "—"}</span>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 7, fontFamily: T.font.mono }}>
          <span style={{ color: T.text.muted }}>F1–F7 Navigate</span>
          <span style={{ color: T.text.muted }}>·</span>
          <span style={{ color: T.text.muted }}>/  Command</span>
          <span style={{ color: T.text.muted }}>·</span>
          <span style={{ color: T.text.green }}>JEDI RE v2.2</span>
        </div>
      </div>

      {showCreateDeal && <CreateDealModal />}
    </div>
  );
}
