import { useState, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — ENTITLEMENT COMPARISON & DEVELOPMENT ENVELOPE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
// Core computation: finds the BINDING constraint across all zoning parameters
// to produce the accurate maximum development envelope. Supports 4 development
// paths (By-Right, Overlay/Bonus, Variance, Rezone) and ranks all municipal
// zoning codes by risk-adjusted value uplift.
//
// Tab structure (revised per Feb 26 debugging plan):
//   Tab 1: Property Boundary & Zoning (merged)
//   Tab 2: Dev Capacity Builder (with Path Selection) ← THIS ENGINE
//   Tab 3: Regulatory Risk
//   Tab 4: Zoning Comparator (Next-Best Code + Pathway + Precedent)
//   Tab 5: Time-to-Shovel
// ═══════════════════════════════════════════════════════════════════════════════

// ─── COLOR TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg:         "#0a0f1a",
  bgCard:     "#0f1729",
  bgCardAlt:  "#111d33",
  bgHover:    "#162040",
  border:     "#1e2d4a",
  borderLit:  "#2a4070",
  text:       "#e2e8f0",
  textMuted:  "#64748b",
  textDim:    "#475569",
  accent:     "#3b82f6",
  accentDim:  "#1e40af",
  green:      "#22c55e",
  greenDim:   "#166534",
  amber:      "#f59e0b",
  amberDim:   "#92400e",
  red:        "#ef4444",
  redDim:     "#991b1b",
  cyan:       "#06b6d4",
  purple:     "#a78bfa",
};

// ─── FONTS ───────────────────────────────────────────────────────────────────
const FONT = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  body: "'IBM Plex Sans', -apple-system, sans-serif",
};

// ─── MOCK DATA — PARCEL & ZONING ─────────────────────────────────────────────
const MOCK_PARCEL = {
  parcel_id: "14-0049-LL-034-6",
  address: "847 Peachtree St NE, Atlanta, GA",
  lot_size_sf: 98010,        // 2.25 acres
  lot_size_acres: 2.25,
  frontage_ft: 320,
  depth_ft: 306,
  is_corner: true,
  existing_units: 0,         // vacant for ground-up; change for existing/redev
  existing_building_sf: 0,
  shape_type: "rectangular",
};

const MOCK_CURRENT_ZONING = {
  code: "MRC-3",
  full_name: "Mixed Residential Commercial - 3",
  municipality: "City of Atlanta",
  municode_url: "https://library.municode.com/ga/atlanta/codes/code_of_ordinances?nodeId=PTIIICOO(), §16-18A.007",
  last_amended: "2023-08-14",
  max_density_units_per_acre: 109,
  max_height_ft: 225,
  max_height_stories: 20,
  max_far: 3.2,
  lot_coverage_pct: 0.85,
  open_space_pct: 0.15,
  setbacks: { front_ft: 0, side_ft: 10, rear_ft: 20 },
  parking: { per_unit: 1.0, guest_per_unit: 0.25, reduction_transit: 0.20 },
  permitted_uses: ["multifamily", "mixed-use", "hotel", "retail", "office"],
  conditional_uses: ["drive-thru (CUP)"],
  prohibited_uses: ["nightclub", "industrial", "self-storage"],
  overlay_districts: ["Beltline Overlay District"],
  overlay_bonuses: {
    beltline: { density_bonus_pct: 0.15, parking_reduction_pct: 0.10, requires: "Affordable set-aside (10% at 80% AMI)" },
  },
};

// ─── ALL MUNICIPAL ZONING CODES (for Next-Best ranking) ──────────────────────
const MUNICIPAL_CODES = [
  { code: "MRC-1", density: 36, height: 52, far: 1.0, coverage: 0.60, parking: 1.25, category: "mixed-residential" },
  { code: "MRC-2", density: 73, height: 150, far: 2.4, coverage: 0.75, parking: 1.0, category: "mixed-residential" },
  { code: "MRC-3", density: 109, height: 225, far: 3.2, coverage: 0.85, parking: 1.0, category: "mixed-residential" },
  { code: "MRC-4", density: 185, height: 300, far: 4.8, coverage: 0.90, parking: 0.75, category: "mixed-residential" },
  { code: "MR-1", density: 24, height: 35, far: 0.696, coverage: 0.50, parking: 1.5, category: "residential" },
  { code: "MR-2", density: 36, height: 52, far: 1.0, coverage: 0.55, parking: 1.25, category: "residential" },
  { code: "MR-3", density: 48, height: 65, far: 1.5, coverage: 0.60, parking: 1.0, category: "residential" },
  { code: "MR-4A", density: 60, height: 75, far: 1.8, coverage: 0.65, parking: 1.0, category: "residential" },
  { code: "MR-5A", density: 96, height: 150, far: 2.8, coverage: 0.80, parking: 0.85, category: "residential" },
  { code: "C-1", density: 48, height: 75, far: 2.0, coverage: 0.80, parking: 1.0, category: "commercial" },
  { code: "C-2", density: 73, height: 150, far: 3.0, coverage: 0.85, parking: 0.85, category: "commercial" },
  { code: "C-3", density: 109, height: 225, far: 4.0, coverage: 0.90, parking: 0.75, category: "commercial" },
  { code: "C-4", density: 185, height: 400, far: 6.0, coverage: 0.95, parking: 0.60, category: "commercial" },
  { code: "SPI-1", density: 150, height: 300, far: 5.0, coverage: 0.90, parking: 0.50, category: "special" },
  { code: "SPI-12", density: 200, height: 300, far: 4.5, coverage: 0.85, parking: 0.60, category: "special" },
  { code: "SPI-17", density: 109, height: 150, far: 3.0, coverage: 0.80, parking: 0.85, category: "special" },
  { code: "MU-60", density: 218, height: 350, far: 5.5, coverage: 0.90, parking: 0.50, category: "mixed-use" },
  { code: "I-1", density: 0, height: 60, far: 1.5, coverage: 0.75, parking: 0.50, category: "industrial" },
  { code: "I-2", density: 0, height: 75, far: 2.0, coverage: 0.80, parking: 0.50, category: "industrial" },
];

// ─── PRECEDENT DATA (Tab 4 feed) ────────────────────────────────────────────
const PRECEDENT_DATA = [
  { from: "MRC-3", to: "MRC-4", distance_mi: 0.8, year: 2023, approved: true, conditions: "10% affordable, design review", timeline_months: 11 },
  { from: "MRC-2", to: "MRC-3", distance_mi: 1.2, year: 2022, approved: true, conditions: "Streetscape improvements", timeline_months: 8 },
  { from: "C-2", to: "MRC-4", distance_mi: 1.5, year: 2024, approved: true, conditions: "15% affordable, public plaza", timeline_months: 14 },
  { from: "MRC-3", to: "SPI-1", distance_mi: 0.6, year: 2023, approved: false, conditions: "Denied — community opposition", timeline_months: 16 },
  { from: "MR-3", to: "MRC-3", distance_mi: 2.0, year: 2024, approved: true, conditions: "Traffic study required", timeline_months: 10 },
];

const COMP_PLAN_CONSISTENT = true; // does comp plan designate this corridor for high-density?

// ═══════════════════════════════════════════════════════════════════════════════
// CORE ENGINE: DEVELOPMENT ENVELOPE CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
// The key insight: max_units = MIN(density_cap, far_cap, height_cap, coverage_cap)
// Whichever is smallest is the BINDING CONSTRAINT — the one that limits the project.
// Parking then applies as a cost/space modifier, not a unit cap (unless structured
// parking per unit exceeds available footprint area).

function calculateBuildableArea(parcel, zoning) {
  // Step 1: Deduct setbacks from gross lot area
  const { front_ft, side_ft, rear_ft } = zoning.setbacks;
  const frontage = parcel.frontage_ft;
  const depth = parcel.depth_ft;

  // For rectangular lots: buildable = (frontage - 2*side) × (depth - front - rear)
  // For corner lots: front setback applies to both street-facing sides
  let buildable_width, buildable_depth;
  if (parcel.is_corner) {
    buildable_width = frontage - front_ft - side_ft; // front + one side
    buildable_depth = depth - front_ft - rear_ft;     // front on 2nd street + rear
  } else {
    buildable_width = frontage - (2 * side_ft);
    buildable_depth = depth - front_ft - rear_ft;
  }

  const buildable_sf = Math.max(0, buildable_width * buildable_depth);
  const gross_lot_sf = parcel.lot_size_sf;

  return {
    gross_lot_sf,
    buildable_sf,
    buildable_width,
    buildable_depth,
    setback_loss_sf: gross_lot_sf - buildable_sf,
    setback_loss_pct: ((gross_lot_sf - buildable_sf) / gross_lot_sf * 100).toFixed(1),
  };
}

function calculateEnvelope(parcel, zoning, overrides = {}) {
  const area = calculateBuildableArea(parcel, zoning);
  const lot_acres = parcel.lot_size_acres;
  const density = overrides.density || zoning.max_density_units_per_acre;
  const height_ft = overrides.height || zoning.max_height_ft;
  const far = overrides.far || zoning.max_far;
  const coverage = overrides.coverage || zoning.lot_coverage_pct;
  const parking_per_unit = overrides.parking || zoning.parking?.per_unit || 1.0;
  const guest_parking = zoning.parking?.guest_per_unit || 0.25;

  // ─── CONSTRAINT 1: Density cap ───
  const density_cap = Math.floor(density * lot_acres);

  // ─── CONSTRAINT 2: FAR cap ───
  // max_gfa = FAR × lot_size_sf. avg_unit_sf assumed 850 for multifamily
  const avg_unit_sf = overrides.avg_unit_sf || 850;
  const common_area_factor = 1.15; // corridors, lobbies, mechanical = 15% of GFA
  const max_gfa = far * parcel.lot_size_sf;
  const rentable_sf = max_gfa / common_area_factor;
  const far_cap = Math.floor(rentable_sf / avg_unit_sf);

  // ─── CONSTRAINT 3: Height cap ───
  // stories = height_ft / floor_height. ground_floor_height = 14ft (retail), upper = 10ft
  const ground_floor_height = 14;
  const upper_floor_height = 10;
  const max_stories = height_ft <= ground_floor_height
    ? 1
    : 1 + Math.floor((height_ft - ground_floor_height) / upper_floor_height);
  // Units per floor = buildable_footprint × coverage / avg_unit_sf / common_area_factor
  const footprint_sf = area.buildable_sf * coverage;
  const units_per_floor = Math.floor(footprint_sf / (avg_unit_sf * common_area_factor));
  // Ground floor often retail/commercial in mixed-use; residential starts floor 2
  const residential_floors = Math.max(1, max_stories - 1); // 1 floor for retail podium
  const height_cap = units_per_floor * residential_floors;

  // ─── CONSTRAINT 4: Lot coverage cap ───
  // Max building footprint = buildable_area × coverage → floors × units_per_floor
  const coverage_cap = units_per_floor * max_stories; // theoretical max if all floors residential

  // ─── BINDING CONSTRAINT ───
  const constraints = [
    { name: "Density", units: density_cap, param: `${density} units/acre`, formula: `${density} × ${lot_acres} acres` },
    { name: "FAR", units: far_cap, param: `FAR ${far}`, formula: `${far} × ${parcel.lot_size_sf.toLocaleString()} SF ÷ ${avg_unit_sf} SF/unit ÷ ${common_area_factor}` },
    { name: "Height", units: height_cap, param: `${height_ft} ft (${max_stories} stories)`, formula: `${units_per_floor} units/floor × ${residential_floors} res. floors` },
    { name: "Coverage", units: coverage_cap, param: `${(coverage * 100).toFixed(0)}% coverage`, formula: `${units_per_floor} units/floor × ${max_stories} total stories` },
  ];

  constraints.sort((a, b) => a.units - b.units);
  const binding = constraints[0];
  const max_units = binding.units;

  // ─── PARKING ANALYSIS ───
  const total_parking_spaces = Math.ceil(max_units * (parking_per_unit + guest_parking));
  const parking_sf_per_space = 350; // structured parking
  const parking_cost_per_space_surface = 5000;
  const parking_cost_per_space_structured = 35000;
  // If parking footprint > available surface area, must go structured
  const surface_parking_sf = total_parking_spaces * parking_sf_per_space;
  const needs_structured = surface_parking_sf > (parcel.lot_size_sf - footprint_sf);
  const parking_cost_per_space = needs_structured ? parking_cost_per_space_structured : parking_cost_per_space_surface;
  const total_parking_cost = total_parking_spaces * parking_cost_per_space;

  // If structured parking, each level holds ~footprint_sf / parking_sf_per_space cars
  const cars_per_parking_level = Math.floor(footprint_sf / parking_sf_per_space);
  const parking_levels_needed = needs_structured ? Math.ceil(total_parking_spaces / cars_per_parking_level) : 0;

  // ─── ESTIMATED VALUES ───
  const est_value_per_unit = 250000; // market assumption, should come from M09
  const est_construction_cost_per_sf = 185; // hard costs
  const total_gfa = max_units * avg_unit_sf * common_area_factor;
  const est_construction_cost = total_gfa * est_construction_cost_per_sf;
  const est_total_value = max_units * est_value_per_unit;

  return {
    max_units,
    binding_constraint: binding.name,
    constraints,
    max_gfa,
    total_gfa_at_max_units: total_gfa,
    max_stories,
    residential_floors,
    units_per_floor,
    footprint_sf,
    buildable_area: area,
    parking: {
      total_spaces: total_parking_spaces,
      per_unit: parking_per_unit,
      guest_per_unit: guest_parking,
      needs_structured,
      parking_levels_needed,
      cost_per_space: parking_cost_per_space,
      total_cost: total_parking_cost,
      pct_of_construction: ((total_parking_cost / est_construction_cost) * 100).toFixed(1),
    },
    financials: {
      est_value_per_unit,
      est_total_value,
      est_construction_cost_per_sf,
      est_construction_cost,
      est_total_development_cost: est_construction_cost + total_parking_cost,
    },
  };
}

// ─── PATH SCENARIOS ──────────────────────────────────────────────────────────
function generatePathScenarios(parcel, currentZoning) {
  // Path A: By-Right
  const byRight = calculateEnvelope(parcel, currentZoning);

  // Path B: Overlay/Density Bonus (Beltline)
  const overlayDensity = currentZoning.max_density_units_per_acre * (1 + (currentZoning.overlay_bonuses?.beltline?.density_bonus_pct || 0));
  const overlayParking = currentZoning.parking.per_unit * (1 - (currentZoning.overlay_bonuses?.beltline?.parking_reduction_pct || 0));
  const overlayBonus = calculateEnvelope(parcel, {
    ...currentZoning,
    max_density_units_per_acre: overlayDensity,
    parking: { ...currentZoning.parking, per_unit: overlayParking },
  });

  // Path C: Variance/SAP (Special Administrative Permit — typically +20-30%)
  const varianceDensity = currentZoning.max_density_units_per_acre * 1.25;
  const varianceHeight = currentZoning.max_height_ft * 1.10;
  const variance = calculateEnvelope(parcel, {
    ...currentZoning,
    max_density_units_per_acre: varianceDensity,
    max_height_ft: varianceHeight,
  });

  // Path D: Rezone to next-best code
  const rankedCodes = rankZoningCodes(parcel, currentZoning);
  const bestTarget = rankedCodes[0];
  const rezoneMock = MUNICIPAL_CODES.find(c => c.code === bestTarget?.code);
  const rezone = rezoneMock
    ? calculateEnvelope(parcel, {
        ...currentZoning,
        code: rezoneMock.code,
        max_density_units_per_acre: rezoneMock.density,
        max_height_ft: rezoneMock.height,
        max_far: rezoneMock.far,
        lot_coverage_pct: rezoneMock.coverage,
        parking: { ...currentZoning.parking, per_unit: rezoneMock.parking },
      })
    : null;

  return {
    paths: [
      {
        id: "by_right",
        label: "By-Right",
        sublabel: `Under current ${currentZoning.code}`,
        envelope: byRight,
        timeline_months: { min: 3, median: 6, max: 9 },
        approval_probability: 0.95,
        additional_cost: 0,
        risk_level: "low",
        color: T.green,
      },
      {
        id: "overlay_bonus",
        label: "Overlay Bonus",
        sublabel: `${currentZoning.code} + Beltline Overlay`,
        envelope: overlayBonus,
        timeline_months: { min: 4, median: 8, max: 12 },
        approval_probability: 0.85,
        additional_cost: 0, // affordable set-aside is a revenue impact, not a cost
        risk_level: "low-medium",
        requirements: currentZoning.overlay_bonuses?.beltline?.requires || "N/A",
        color: T.cyan,
      },
      {
        id: "variance",
        label: "SAP / Variance",
        sublabel: `${currentZoning.code} + 25% density bonus`,
        envelope: variance,
        timeline_months: { min: 6, median: 10, max: 16 },
        approval_probability: 0.70,
        additional_cost: 75000,
        risk_level: "medium",
        color: T.amber,
      },
      ...(rezone ? [{
        id: "rezone",
        label: `Rezone → ${bestTarget.code}`,
        sublabel: `${bestTarget.code} — Net EV: $${(bestTarget.net_expected_value / 1e6).toFixed(1)}M`,
        envelope: rezone,
        timeline_months: { min: 8, median: 14, max: 22 },
        approval_probability: bestTarget.probability,
        additional_cost: 350000,
        risk_level: "high",
        color: T.purple,
      }] : []),
    ],
    ranked_codes: rankZoningCodes(parcel, currentZoning),
  };
}

// ─── NEXT-BEST ZONING CODE RANKING ──────────────────────────────────────────
function rankZoningCodes(parcel, currentZoning) {
  const currentEnvelope = calculateEnvelope(parcel, currentZoning);
  const currentUnits = currentEnvelope.max_units;
  const est_value_per_unit = 250000;

  return MUNICIPAL_CODES
    .filter(c => c.code !== currentZoning.code && c.density > 0) // exclude current + industrial
    .map(code => {
      const envelope = calculateEnvelope(parcel, {
        ...currentZoning,
        code: code.code,
        max_density_units_per_acre: code.density,
        max_height_ft: code.height,
        max_far: code.far,
        lot_coverage_pct: code.coverage,
        parking: { ...currentZoning.parking, per_unit: code.parking },
      });

      const density_uplift = envelope.max_units - currentUnits;
      const value_creation = density_uplift * est_value_per_unit;

      // Probability from precedent data
      const relevantPrecedents = PRECEDENT_DATA.filter(p => p.to === code.code || p.to?.split("-")[0] === code.code.split("-")[0]);
      const base_rate = relevantPrecedents.length > 0
        ? relevantPrecedents.filter(p => p.approved).length / relevantPrecedents.length
        : 0.40; // default assumption

      const comp_plan_factor = COMP_PLAN_CONSISTENT ? 1.15 : 0.85;
      const category_match = code.category === currentZoning.code?.includes("MRC") ? "mixed-residential" : code.category;
      const category_factor = category_match === "mixed-residential" ? 1.05 : 0.95; // staying in same category = easier
      const probability = Math.min(0.95, Math.max(0.15, base_rate * comp_plan_factor * category_factor));

      const rezone_cost = 350000; // fees + attorney + land planner + traffic study
      const net_expected_value = (value_creation * probability) - rezone_cost;

      return {
        code: code.code,
        category: code.category,
        max_units: envelope.max_units,
        density_uplift,
        value_creation,
        probability: Math.round(probability * 100) / 100,
        net_expected_value,
        binding_constraint: envelope.binding_constraint,
        parking_cost: envelope.parking.total_cost,
        needs_structured: envelope.parking.needs_structured,
      };
    })
    .filter(c => c.density_uplift > 0) // only show codes that add units
    .sort((a, b) => b.net_expected_value - a.net_expected_value);
}


// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const s = {
  page: {
    background: T.bg,
    color: T.text,
    fontFamily: FONT.body,
    minHeight: "100vh",
    padding: "20px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    borderBottom: `1px solid ${T.border}`,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: FONT.mono,
    letterSpacing: "-0.02em",
    color: T.text,
  },
  subtitle: {
    fontSize: 11,
    color: T.textMuted,
    fontFamily: FONT.mono,
    marginTop: 4,
  },
  badge: (color) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: FONT.mono,
    letterSpacing: "0.05em",
    background: color + "15",
    color: color,
    border: `1px solid ${color}30`,
  }),
  card: {
    background: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: 700,
    fontFamily: FONT.mono,
    letterSpacing: "0.08em",
    color: T.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  metric: {
    fontSize: 28,
    fontWeight: 800,
    fontFamily: FONT.mono,
    color: T.text,
    lineHeight: 1,
  },
  metricSub: {
    fontSize: 11,
    color: T.textMuted,
    fontFamily: FONT.mono,
    marginTop: 4,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    fontFamily: FONT.mono,
  },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: T.textMuted,
    borderBottom: `1px solid ${T.border}`,
    textTransform: "uppercase",
  },
  td: (highlight = false) => ({
    padding: "8px 10px",
    borderBottom: `1px solid ${T.border}10`,
    color: highlight ? T.accent : T.text,
    fontWeight: highlight ? 700 : 400,
  }),
  tab: (active) => ({
    padding: "8px 16px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: FONT.mono,
    cursor: "pointer",
    background: active ? T.accentDim + "40" : "transparent",
    color: active ? T.accent : T.textMuted,
    border: active ? `1px solid ${T.accent}40` : `1px solid transparent`,
    transition: "all 0.15s ease",
  }),
  pathCard: (selected, color) => ({
    background: selected ? color + "08" : T.bgCard,
    border: `1px solid ${selected ? color + "60" : T.border}`,
    borderRadius: 8,
    padding: 16,
    cursor: "pointer",
    transition: "all 0.15s ease",
    flex: 1,
    minWidth: 200,
  }),
  constraintBar: (pct, isBinding) => ({
    height: 6,
    borderRadius: 3,
    background: isBinding ? T.red : T.accent + "30",
    width: `${Math.min(100, pct)}%`,
    transition: "width 0.4s ease",
  }),
  constraintBarBg: {
    height: 6,
    borderRadius: 3,
    background: T.border + "40",
    width: "100%",
    marginTop: 4,
  },
  bindingTag: {
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 800,
    fontFamily: FONT.mono,
    background: T.red + "20",
    color: T.red,
    letterSpacing: "0.06em",
  },
  deltaPositive: { color: T.green, fontWeight: 700 },
  deltaNegative: { color: T.red, fontWeight: 700 },
  deltaNeutral: { color: T.textMuted },
};

function ConstraintWaterfall({ constraints, maxPossible }) {
  return (
    <div style={{ ...s.card, padding: 20 }}>
      <div style={s.cardLabel}>CONSTRAINT WATERFALL — BINDING ANALYSIS</div>
      <div style={{ fontSize: 11, color: T.textDim, marginBottom: 16, fontFamily: FONT.mono }}>
        Max units = MIN(density, FAR, height, coverage). The lowest is the binding constraint.
      </div>
      {constraints.map((c, i) => {
        const pct = maxPossible > 0 ? (c.units / maxPossible) * 100 : 0;
        const isBinding = i === 0;
        return (
          <div key={c.name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT.mono, color: isBinding ? T.red : T.text }}>
                  {c.name}
                </span>
                {isBinding && <span style={s.bindingTag}>BINDING</span>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT.mono, color: isBinding ? T.red : T.accent }}>
                {c.units.toLocaleString()} units
              </span>
            </div>
            <div style={{ fontSize: 10, color: T.textDim, fontFamily: FONT.mono, marginBottom: 4 }}>
              {c.param} → {c.formula}
            </div>
            <div style={s.constraintBarBg}>
              <div style={s.constraintBar(pct, isBinding)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PathComparisonCards({ paths, selectedPath, onSelectPath }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      {paths.map(path => {
        const sel = selectedPath === path.id;
        return (
          <div
            key={path.id}
            style={s.pathCard(sel, path.color)}
            onClick={() => onSelectPath(path.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT.mono, color: sel ? path.color : T.text }}>
                  {path.label}
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT.mono, marginTop: 2 }}>
                  {path.sublabel}
                </div>
              </div>
              <span style={s.badge(path.color)}>{path.risk_level.toUpperCase()}</span>
            </div>
            <div style={s.metric}>{path.envelope.max_units.toLocaleString()}</div>
            <div style={s.metricSub}>units — bound by {path.envelope.binding_constraint}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: T.textDim, fontFamily: FONT.mono }}>TIMELINE</div>
                <div style={{ fontSize: 11, fontFamily: FONT.mono, color: T.text }}>
                  {path.timeline_months.min}–{path.timeline_months.max} mo
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textDim, fontFamily: FONT.mono }}>PROBABILITY</div>
                <div style={{ fontSize: 11, fontFamily: FONT.mono, color: T.text }}>
                  {(path.approval_probability * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textDim, fontFamily: FONT.mono }}>EST. VALUE</div>
                <div style={{ fontSize: 11, fontFamily: FONT.mono, color: T.green }}>
                  ${(path.envelope.financials.est_total_value / 1e6).toFixed(1)}M
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textDim, fontFamily: FONT.mono }}>PARKING</div>
                <div style={{ fontSize: 11, fontFamily: FONT.mono, color: path.envelope.parking.needs_structured ? T.amber : T.text }}>
                  {path.envelope.parking.total_spaces} sp. {path.envelope.parking.needs_structured ? "(struct.)" : "(surf.)"}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EnvelopeDetail({ envelope, label }) {
  const { buildable_area: area, parking, financials } = envelope;
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label} — DEVELOPMENT ENVELOPE</div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Parameter</th>
            <th style={s.th}>Value</th>
            <th style={s.th}>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={s.td()}>Gross Lot Area</td>
            <td style={s.td(true)}>{area.gross_lot_sf.toLocaleString()} SF ({(area.gross_lot_sf / 43560).toFixed(2)} ac)</td>
            <td style={s.td()}>County GIS / PostGIS</td>
          </tr>
          <tr>
            <td style={s.td()}>Setback Deduction</td>
            <td style={s.td()}>{area.setback_loss_sf.toLocaleString()} SF ({area.setback_loss_pct}%)</td>
            <td style={s.td()}>Zoning Code setbacks</td>
          </tr>
          <tr>
            <td style={s.td()}>Buildable Area</td>
            <td style={s.td(true)}>{area.buildable_sf.toLocaleString()} SF</td>
            <td style={s.td()}>Gross - setbacks</td>
          </tr>
          <tr>
            <td style={s.td()}>Building Footprint</td>
            <td style={s.td()}>{Math.round(envelope.footprint_sf).toLocaleString()} SF</td>
            <td style={s.td()}>Buildable × coverage %</td>
          </tr>
          <tr>
            <td style={s.td()}>Max Units</td>
            <td style={s.td(true)}>{envelope.max_units.toLocaleString()}</td>
            <td style={s.td()}>Binding: {envelope.binding_constraint}</td>
          </tr>
          <tr>
            <td style={s.td()}>Max Stories</td>
            <td style={s.td()}>{envelope.max_stories} ({envelope.residential_floors} residential)</td>
            <td style={s.td()}>Height ÷ floor height</td>
          </tr>
          <tr>
            <td style={s.td()}>Units/Floor</td>
            <td style={s.td()}>{envelope.units_per_floor}</td>
            <td style={s.td()}>Footprint ÷ unit size</td>
          </tr>
          <tr>
            <td style={s.td()}>Max GFA</td>
            <td style={s.td()}>{Math.round(envelope.max_gfa).toLocaleString()} SF</td>
            <td style={s.td()}>FAR × lot area</td>
          </tr>
          <tr style={{ background: T.bgCardAlt }}>
            <td style={s.td()}>Parking Required</td>
            <td style={s.td(true)}>
              {parking.total_spaces} spaces
              {parking.needs_structured && <span style={{ ...s.badge(T.amber), marginLeft: 6 }}>STRUCTURED</span>}
            </td>
            <td style={s.td()}>{parking.per_unit}/unit + {parking.guest_per_unit} guest</td>
          </tr>
          {parking.needs_structured && (
            <tr style={{ background: T.bgCardAlt }}>
              <td style={s.td()}>Parking Levels</td>
              <td style={s.td()}>{parking.parking_levels_needed} levels</td>
              <td style={s.td()}>Spaces ÷ cars/level</td>
            </tr>
          )}
          <tr style={{ background: T.bgCardAlt }}>
            <td style={s.td()}>Parking Cost</td>
            <td style={s.td(true)}>${(parking.total_cost / 1e6).toFixed(1)}M ({parking.pct_of_construction}% of construction)</td>
            <td style={s.td()}>${parking.cost_per_space.toLocaleString()}/space</td>
          </tr>
          <tr style={{ borderTop: `2px solid ${T.border}` }}>
            <td style={s.td()}>Est. Construction</td>
            <td style={s.td()}>${(financials.est_construction_cost / 1e6).toFixed(1)}M</td>
            <td style={s.td()}>${financials.est_construction_cost_per_sf}/SF hard cost</td>
          </tr>
          <tr>
            <td style={s.td()}>Est. Total Dev Cost</td>
            <td style={s.td(true)}>${(financials.est_total_development_cost / 1e6).toFixed(1)}M</td>
            <td style={s.td()}>Construction + Parking</td>
          </tr>
          <tr>
            <td style={s.td()}>Est. Total Value</td>
            <td style={{ ...s.td(true), color: T.green }}>${(financials.est_total_value / 1e6).toFixed(1)}M</td>
            <td style={s.td()}>${financials.est_value_per_unit.toLocaleString()}/unit</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NextBestCodeRanking({ rankedCodes, currentZoning }) {
  const topCodes = rankedCodes.slice(0, 8);
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>NEXT-BEST ZONING CODES — RANKED BY RISK-ADJUSTED VALUE</div>
      <div style={{ fontSize: 11, color: T.textDim, fontFamily: FONT.mono, marginBottom: 12 }}>
        All {MUNICIPAL_CODES.filter(c => c.density > 0).length} residential zoning codes in {currentZoning.municipality} analyzed.
        Ranked by: (density uplift × $250K/unit) × approval probability − $350K rezone cost.
      </div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>#</th>
            <th style={s.th}>Code</th>
            <th style={s.th}>Max Units</th>
            <th style={s.th}>Uplift</th>
            <th style={s.th}>Value Created</th>
            <th style={s.th}>P(Approve)</th>
            <th style={s.th}>Net EV</th>
            <th style={s.th}>Binding</th>
            <th style={s.th}>Parking $</th>
          </tr>
        </thead>
        <tbody>
          {topCodes.map((c, i) => (
            <tr key={c.code} style={{ background: i === 0 ? T.accent + "08" : "transparent" }}>
              <td style={s.td(i === 0)}>{i + 1}</td>
              <td style={s.td(i === 0)}>{c.code}</td>
              <td style={s.td()}>{c.max_units.toLocaleString()}</td>
              <td style={{ ...s.td(), ...s.deltaPositive }}>+{c.density_uplift.toLocaleString()}</td>
              <td style={{ ...s.td(), color: T.green }}>${(c.value_creation / 1e6).toFixed(1)}M</td>
              <td style={s.td()}>{(c.probability * 100).toFixed(0)}%</td>
              <td style={{ ...s.td(true), color: c.net_expected_value > 0 ? T.green : T.red }}>
                ${(c.net_expected_value / 1e6).toFixed(1)}M
              </td>
              <td style={s.td()}>{c.binding_constraint}</td>
              <td style={s.td()}>
                ${(c.parking_cost / 1e6).toFixed(1)}M
                {c.needs_structured && <span style={{ color: T.amber, fontSize: 9 }}> (S)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PathComparisonTable({ paths }) {
  const byRight = paths.find(p => p.id === "by_right");
  if (!byRight) return null;
  const base = byRight.envelope.max_units;

  return (
    <div style={s.card}>
      <div style={s.cardLabel}>SIDE-BY-SIDE PATH COMPARISON</div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Metric</th>
            {paths.map(p => (
              <th key={p.id} style={{ ...s.th, color: p.color }}>{p.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { label: "Max Units", fn: p => p.envelope.max_units.toLocaleString() },
            { label: "Units vs By-Right", fn: p => {
              const d = p.envelope.max_units - base;
              return d === 0 ? "—" : `+${d.toLocaleString()} (${((d / base) * 100).toFixed(0)}%)`;
            }},
            { label: "Binding Constraint", fn: p => p.envelope.binding_constraint },
            { label: "Max Stories", fn: p => p.envelope.max_stories.toString() },
            { label: "GFA", fn: p => `${Math.round(p.envelope.max_gfa).toLocaleString()} SF` },
            { label: "Parking Spaces", fn: p => p.envelope.parking.total_spaces.toLocaleString() },
            { label: "Parking Type", fn: p => p.envelope.parking.needs_structured ? "Structured" : "Surface" },
            { label: "Parking Cost", fn: p => `$${(p.envelope.parking.total_cost / 1e6).toFixed(1)}M` },
            { label: "Parking % of Cost", fn: p => `${p.envelope.parking.pct_of_construction}%` },
            { label: "Total Dev Cost", fn: p => `$${(p.envelope.financials.est_total_development_cost / 1e6).toFixed(1)}M` },
            { label: "Est. Value", fn: p => `$${(p.envelope.financials.est_total_value / 1e6).toFixed(1)}M` },
            { label: "Timeline", fn: p => `${p.timeline_months.min}–${p.timeline_months.max} mo` },
            { label: "Approval Prob.", fn: p => `${(p.approval_probability * 100).toFixed(0)}%` },
            { label: "Add'l Cost", fn: p => p.additional_cost > 0 ? `$${(p.additional_cost / 1e3).toFixed(0)}K` : "—" },
          ].map(row => (
            <tr key={row.label}>
              <td style={s.td()}>{row.label}</td>
              {paths.map(p => (
                <td key={p.id} style={s.td()}>{row.fn(p)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EntitlementComparisonEngine() {
  const [activeTab, setActiveTab] = useState("envelope");
  const [selectedPath, setSelectedPath] = useState("by_right");

  const scenarios = useMemo(
    () => generatePathScenarios(MOCK_PARCEL, MOCK_CURRENT_ZONING),
    []
  );

  const currentPath = scenarios.paths.find(p => p.id === selectedPath);
  const byRightEnvelope = scenarios.paths.find(p => p.id === "by_right")?.envelope;
  const maxUnitsAcrossAll = Math.max(...scenarios.paths.map(p => p.envelope.max_units));

  const tabs = [
    { id: "envelope", label: "Envelope Analysis" },
    { id: "comparison", label: "Path Comparison" },
    { id: "ranking", label: "Next-Best Code" },
  ];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>DEVELOPMENT ENVELOPE ENGINE</div>
          <div style={s.subtitle}>
            {MOCK_PARCEL.address} — {MOCK_CURRENT_ZONING.code} ({MOCK_CURRENT_ZONING.full_name})
          </div>
          <div style={{ fontSize: 10, color: T.textDim, fontFamily: FONT.mono, marginTop: 2 }}>
            Parcel: {MOCK_PARCEL.parcel_id} — {MOCK_PARCEL.lot_size_acres} ac ({MOCK_PARCEL.lot_size_sf.toLocaleString()} SF)
            {MOCK_PARCEL.is_corner ? " — Corner lot" : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <a
            href={MOCK_CURRENT_ZONING.municode_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: T.accent, fontFamily: FONT.mono, textDecoration: "none" }}
          >
            View Zoning Code →
          </a>
          <div style={{ fontSize: 10, color: T.textDim, fontFamily: FONT.mono, marginTop: 2 }}>
            {MOCK_CURRENT_ZONING.municipality} — Last amended {MOCK_CURRENT_ZONING.last_amended}
          </div>
        </div>
      </div>

      {/* Path Selection Cards */}
      <div style={{ marginBottom: 4 }}>
        <div style={s.cardLabel}>SELECT DEVELOPMENT PATH</div>
        <div style={{ fontSize: 10, color: T.textDim, fontFamily: FONT.mono, marginBottom: 10 }}>
          Path selection cascades to unit mix, construction costs, timeline, ProForma, and JEDI Score.
        </div>
      </div>
      <PathComparisonCards
        paths={scenarios.paths}
        selectedPath={selectedPath}
        onSelectPath={setSelectedPath}
      />

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {tabs.map(t => (
          <div key={t.id} style={s.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "envelope" && currentPath && (
        <div>
          <ConstraintWaterfall
            constraints={currentPath.envelope.constraints}
            maxPossible={maxUnitsAcrossAll}
          />
          <EnvelopeDetail
            envelope={currentPath.envelope}
            label={currentPath.label}
          />

          {/* AI Insight */}
          <div style={{ ...s.card, borderLeft: `3px solid ${T.accent}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, fontFamily: FONT.mono, color: T.accent, marginBottom: 6 }}>
              AI ANALYSIS
            </div>
            <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7 }}>
              {currentPath.id === "by_right" && byRightEnvelope && (
                <>
                  Under current {MOCK_CURRENT_ZONING.code} zoning, {byRightEnvelope.binding_constraint.toLowerCase()} is
                  the binding constraint at {byRightEnvelope.max_units} units.
                  {byRightEnvelope.parking.needs_structured
                    ? ` Structured parking adds ${byRightEnvelope.parking.pct_of_construction}% to construction cost ($${(byRightEnvelope.parking.total_cost / 1e6).toFixed(1)}M). This is typical for ${MOCK_CURRENT_ZONING.code} — budget accordingly.`
                    : " Surface parking is viable at this density — significant cost advantage."}
                  {" "}The next constraint up ({currentPath.envelope.constraints[1]?.name}) allows{" "}
                  {currentPath.envelope.constraints[1]?.units.toLocaleString()} units — a{" "}
                  {((currentPath.envelope.constraints[1]?.units - byRightEnvelope.max_units) / byRightEnvelope.max_units * 100).toFixed(0)}% headroom
                  gap that tells you {byRightEnvelope.binding_constraint.toLowerCase()} is worth trying to negotiate if the delta justifies it.
                </>
              )}
              {currentPath.id === "overlay_bonus" && (
                <>
                  Beltline Overlay adds {((MOCK_CURRENT_ZONING.overlay_bonuses?.beltline?.density_bonus_pct || 0) * 100).toFixed(0)}% density
                  and {((MOCK_CURRENT_ZONING.overlay_bonuses?.beltline?.parking_reduction_pct || 0) * 100).toFixed(0)}% parking reduction.
                  Requirement: {MOCK_CURRENT_ZONING.overlay_bonuses?.beltline?.requires || "None"}.
                  The reduced parking ratio shifts the binding constraint — check if this opens up a different path.
                </>
              )}
              {currentPath.id === "variance" && (
                <>
                  SAP/Variance path models a 25% density bonus and 10% height increase. Approval probability ~70%.
                  Timeline adds 4–7 months. Key question: does the {currentPath.envelope.max_units - byRightEnvelope?.max_units} additional units
                  justify the delay and approval risk?
                  At ${((currentPath.envelope.max_units - (byRightEnvelope?.max_units || 0)) * 250000 / 1e6).toFixed(1)}M in additional value, this is a {
                    (currentPath.envelope.max_units - (byRightEnvelope?.max_units || 0)) * 250000 > 5000000 ? "clear yes" : "marginal call"
                  }.
                </>
              )}
              {currentPath.id === "rezone" && (
                <>
                  Rezone to {currentPath.label.replace("Rezone → ", "")} is the highest risk-adjusted path.
                  {scenarios.ranked_codes[0] && (
                    <> Net expected value: ${(scenarios.ranked_codes[0].net_expected_value / 1e6).toFixed(1)}M
                    after {(scenarios.ranked_codes[0].probability * 100).toFixed(0)}% probability adjustment and $350K rezone cost.
                    Precedent analysis shows {PRECEDENT_DATA.filter(p => p.approved).length} of {PRECEDENT_DATA.length} nearby
                    rezonings approved in the last 3 years. Comp plan is {COMP_PLAN_CONSISTENT ? "consistent" : "inconsistent"} with
                    this target — {COMP_PLAN_CONSISTENT ? "strongest factor in your favor" : "major headwind"}.</>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "comparison" && (
        <PathComparisonTable paths={scenarios.paths} />
      )}

      {activeTab === "ranking" && (
        <NextBestCodeRanking
          rankedCodes={scenarios.ranked_codes}
          currentZoning={MOCK_CURRENT_ZONING}
        />
      )}

      {/* Footer — Source Attribution */}
      <div style={{ marginTop: 20, padding: 12, borderTop: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, fontFamily: FONT.mono }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>DATA SOURCES & ACCURACY NOTES</div>
        <div>Parcel boundary: County GIS via PostGIS (ST_Area on projected SRID 2240, not WGS84). Zoning parameters: Municode + Zoning Agent verification.</div>
        <div style={{ marginTop: 4 }}>Setback deduction uses rectangular approximation — irregular parcels need manual adjustment. Corner lots apply front setback to both street-facing sides.</div>
        <div style={{ marginTop: 4 }}>Envelope calc: max_units = MIN(density_cap, far_cap, height_cap, coverage_cap). Avg unit 850 SF with 15% common area factor. Ground floor assumed 14ft (retail podium), upper floors 10ft.</div>
        <div style={{ marginTop: 4 }}>Parking: surface at $5K/space, structured at $35K/space. Structured triggers when surface parking SF exceeds remaining lot area.</div>
        <div style={{ marginTop: 4 }}>Rezoning probability: base_rate from precedent data × comp plan factor (±15%) × council factor (±10%). Minimum 15%, maximum 95%.</div>
      </div>
    </div>
  );
}
