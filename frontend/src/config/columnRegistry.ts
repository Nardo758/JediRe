export interface ColumnDef {
  id: string;
  label: string;
  shortLabel?: string;
  category: ColumnCategory;
  width: number;
  sortable: boolean;
  align: "left" | "center" | "right";
  description?: string;
  catalogMetricId?: string;
  views: ViewId[];
  isDynamic?: boolean;
  unit?: string;
  format?: (value: number | null) => string;
}

export type ViewId = "f4_dashboard" | "f4_browse" | "f4_submarkets" | "f4_properties" | "f4_compare" | "msa_compare";

export type ColumnCategory =
  | "identity"
  | "score"
  | "rent"
  | "occupancy"
  | "supply"
  | "demand"
  | "financial"
  | "demographic"
  | "traffic"
  | "competition"
  | "risk"
  | "cycle"
  | "traffic_physical"
  | "traffic_digital"
  | "traffic_composite"
  | "macro"
  | "sfr"
  | "market";

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  identity: { label: "IDENTITY", color: "#8E99A4" },
  score: { label: "SCORES", color: "#FFD166" },
  rent: { label: "RENT", color: "#00D26A" },
  occupancy: { label: "OCCUPANCY", color: "#00BCD4" },
  supply: { label: "SUPPLY", color: "#FF8C42" },
  demand: { label: "DEMAND", color: "#7C4DFF" },
  financial: { label: "FINANCIAL", color: "#F5A623" },
  demographic: { label: "DEMOGRAPHIC", color: "#14B8A6" },
  traffic: { label: "TRAFFIC", color: "#2196F3" },
  traffic_physical: { label: "TRAFFIC PHYSICAL", color: "#2196F3" },
  traffic_digital: { label: "TRAFFIC DIGITAL", color: "#42A5F5" },
  traffic_composite: { label: "TRAFFIC COMPOSITE", color: "#1E88E5" },
  market: { label: "MARKET", color: "#AB47BC" },
  risk: { label: "RISK", color: "#EF5350" },
  sfr: { label: "SFR", color: "#26A69A" },
  macro: { label: "MACRO", color: "#78909C" },
  competition: { label: "COMPETITION", color: "#E91E63" },
  cycle: { label: "CYCLE", color: "#AB47BC" },
};

const DASH_BROWSE: ViewId[] = ["f4_dashboard", "f4_browse"];
const SUB: ViewId[] = ["f4_submarkets"];
const PROP: ViewId[] = ["f4_properties"];
const ALL_VIEWS: ViewId[] = ["f4_dashboard", "f4_browse", "f4_submarkets", "f4_properties", "f4_compare"];
const MSA_CMP: ViewId[] = ["msa_compare"];

export const COLUMN_REGISTRY: ColumnDef[] = [
  { id: "rank", label: "#", category: "identity", width: 28, sortable: true, align: "center", views: DASH_BROWSE },
  { id: "starred", label: "★", category: "identity", width: 20, sortable: false, align: "center", views: DASH_BROWSE },
  { id: "msa", label: "MSA", category: "identity", width: 120, sortable: true, align: "left", views: [...DASH_BROWSE, ...SUB, ...PROP] },
  { id: "name", label: "NAME", category: "identity", width: 120, sortable: true, align: "left", views: [...SUB, ...PROP] },
  { id: "submarket", label: "SUBMARKET", category: "identity", width: 100, sortable: true, align: "left", views: PROP },
  { id: "owner", label: "OWNER", category: "identity", width: 80, sortable: true, align: "left", views: PROP },
  { id: "vintage", label: "VINTAGE", category: "identity", width: 50, sortable: true, align: "center", views: PROP },
  { id: "props", label: "PROPS", category: "identity", width: 48, sortable: true, align: "center", description: "Property count", views: [...DASH_BROWSE, ...SUB] },
  { id: "units", label: "UNITS", category: "identity", width: 44, sortable: true, align: "center", description: "Total unit count", views: [...DASH_BROWSE, ...SUB, ...PROP] },

  { id: "jedi", label: "JEDI", category: "score", width: 44, sortable: true, align: "center", description: "JEDI composite score (0-100)", views: [...DASH_BROWSE, ...SUB, ...PROP] },
  { id: "d30", label: "Δ30", category: "score", width: 32, sortable: true, align: "center", description: "30-day JEDI score change", views: DASH_BROWSE },
  { id: "trend", label: "TREND", category: "score", width: 50, sortable: false, align: "center", description: "JEDI score sparkline", views: DASH_BROWSE },
  { id: "opp", label: "OPP", shortLabel: "OPP", category: "score", width: 40, sortable: true, align: "center", description: "Opportunity score", views: SUB },

  { id: "rent", label: "RENT", category: "rent", width: 56, sortable: true, align: "center", description: "Average asking rent", catalogMetricId: "F_RENT_GROWTH", views: [...DASH_BROWSE, ...SUB, ...PROP] },
  { id: "rentD", label: "RENT Δ", category: "rent", width: 44, sortable: true, align: "center", description: "Rent change YoY", views: [...DASH_BROWSE, ...SUB] },

  { id: "vac", label: "VAC", category: "occupancy", width: 40, sortable: true, align: "center", description: "Vacancy rate", views: [...DASH_BROWSE, ...SUB] },
  { id: "occ", label: "OCC", category: "occupancy", width: 40, sortable: true, align: "center", description: "Occupancy rate", catalogMetricId: "M_VACANCY", views: PROP },
  { id: "absorb", label: "ABSORB", category: "occupancy", width: 50, sortable: true, align: "center", description: "Net absorption (units)", catalogMetricId: "M_ABSORPTION", views: DASH_BROWSE },

  { id: "pipeline", label: "PIPELN", category: "supply", width: 50, sortable: true, align: "center", description: "Supply pipeline % of stock", catalogMetricId: "S_PIPELINE_UNITS", views: DASH_BROWSE },

  { id: "cap", label: "CAP", category: "financial", width: 40, sortable: true, align: "center", description: "Cap rate %", catalogMetricId: "F_CAP_RATE", views: [...DASH_BROWSE, ...SUB] },
  { id: "capRate", label: "CAP", category: "financial", width: 40, sortable: true, align: "center", description: "Cap rate %", views: PROP },
  { id: "costs", label: "COSTS", category: "financial", width: 52, sortable: true, align: "center", description: "Operating costs per unit", views: DASH_BROWSE },
  { id: "dApt", label: "$/APT", category: "financial", width: 40, sortable: true, align: "center", description: "Demand per apartment ratio", views: DASH_BROWSE },

  { id: "popD", label: "POP Δ", category: "demographic", width: 44, sortable: true, align: "center", description: "Population growth %", catalogMetricId: "E_POPULATION_GROWTH", views: DASH_BROWSE },
  { id: "medInc", label: "MED INC", category: "demographic", width: 56, sortable: true, align: "center", description: "Median household income", views: DASH_BROWSE },

  { id: "cycle", label: "CYCLE", category: "cycle", width: 76, sortable: true, align: "center", description: "Market cycle position", views: DASH_BROWSE },

  // ── MSA Compare tab metrics (rows in the comparison matrix) ──────────────
  // Demand
  { id: "D-01 Jobs/Apt",    label: "Jobs/Apt",      shortLabel: "D-01", category: "demand", width: 80, sortable: false, align: "center", description: "Jobs per apartment unit — measures labor-market depth relative to supply", views: MSA_CMP },
  { id: "D-02 New Jobs/Unit", label: "New Jobs/Unit", shortLabel: "D-02", category: "demand", width: 80, sortable: false, align: "center", description: "New job creation per new unit added — demand absorption proxy", views: MSA_CMP },
  { id: "D-03 Migration",   label: "Migration",     shortLabel: "D-03", category: "demand", width: 80, sortable: false, align: "center", description: "Net in-migration (000s persons) — population-driven demand signal", views: MSA_CMP },
  { id: "D-09 Momentum",    label: "Momentum",      shortLabel: "D-09", category: "demand", width: 80, sortable: false, align: "center", description: "Demand momentum composite score (0–100)", views: MSA_CMP },
  { id: "D-10 Gravity",     label: "Gravity",       shortLabel: "D-10", category: "demand", width: 80, sortable: false, align: "center", description: "Gravitational pull from employment nodes (0–100)", views: MSA_CMP },
  { id: "D-11 Rent-Mort",   label: "Rent–Mort Δ",   shortLabel: "D-11", category: "demand", width: 80, sortable: false, align: "center", description: "Rent vs. mortgage cost gap — renting advantage (negative = rent cheaper)", views: MSA_CMP },
  // Supply
  { id: "S-04 Absorption",  label: "Absorption",    shortLabel: "S-04", category: "supply", width: 80, sortable: false, align: "center", description: "Months to absorb current pipeline", views: MSA_CMP },
  { id: "S-05 Clusters",    label: "Supply Clusters", shortLabel: "S-05", category: "supply", width: 80, sortable: false, align: "center", description: "Number of concentrated delivery zones — dispersion risk", views: MSA_CMP },
  { id: "S-06 Permit Mom",  label: "Permit Mom",    shortLabel: "S-06", category: "supply", width: 80, sortable: false, align: "center", description: "Permit momentum YoY % change — leading supply indicator", views: MSA_CMP },
  { id: "S-08 Saturation",  label: "Saturation",    shortLabel: "S-08", category: "supply", width: 80, sortable: false, align: "center", description: "Pipeline as % of total stock — saturation pressure", views: MSA_CMP },
  // Momentum (Rent)
  { id: "M-01 Avg Rent",    label: "Avg Rent",      shortLabel: "M-01", category: "rent", width: 80, sortable: false, align: "center", description: "Average market asking rent", views: MSA_CMP },
  { id: "M-02 Rent Accel",  label: "Rent Accel",    shortLabel: "M-02", category: "rent", width: 80, sortable: false, align: "center", description: "Month-over-month rent acceleration", views: MSA_CMP },
  { id: "M-05 Rent vs Wage", label: "Rent vs Wage", shortLabel: "M-05", category: "rent", width: 80, sortable: false, align: "center", description: "Rent growth relative to wage growth — affordability pressure", views: MSA_CMP },
  { id: "M-06 Occupancy",   label: "Occupancy",     shortLabel: "M-06", category: "occupancy", width: 80, sortable: false, align: "center", description: "Physical occupancy rate", views: MSA_CMP },
  // Dev Capacity
  { id: "DC-01 Capacity",   label: "Dev Capacity",  shortLabel: "DC-01", category: "market", width: 80, sortable: false, align: "center", description: "Remaining developable land capacity as % of current stock", views: MSA_CMP },
  { id: "DC-02 Buildout",   label: "Buildout Yrs",  shortLabel: "DC-02", category: "market", width: 80, sortable: false, align: "center", description: "Estimated years to buildout at current absorption pace", views: MSA_CMP },
  { id: "DC-03 Constraint", label: "Constraint",    shortLabel: "DC-03", category: "market", width: 80, sortable: false, align: "center", description: "Supply constraint score — higher = harder to build (0–100)", views: MSA_CMP },
  { id: "DC-04 Overhang",   label: "Supply Overhang", shortLabel: "DC-04", category: "market", width: 80, sortable: false, align: "center", description: "Excess pipeline above historical absorption capacity", views: MSA_CMP },
  { id: "DC-07 Pricing Power", label: "Pricing Power", shortLabel: "DC-07", category: "market", width: 80, sortable: false, align: "center", description: "Landlord pricing power index (0–100)", views: MSA_CMP },
  { id: "DC-08 Supply Wave", label: "Supply Wave",  shortLabel: "DC-08", category: "market", width: 80, sortable: false, align: "center", description: "Current phase of supply wave cycle", views: MSA_CMP },
  { id: "DC-11 Adj Rent",   label: "Adj Rent",      shortLabel: "DC-11", category: "market", width: 80, sortable: false, align: "center", description: "Rent adjusted for concessions and effective lease-up", views: MSA_CMP },
  // Traffic
  { id: "T-02 Physical avg", label: "Physical Traffic", shortLabel: "T-02", category: "traffic_physical", width: 80, sortable: false, align: "center", description: "Average physical traffic score across submarkets", views: MSA_CMP },
  { id: "T-03 Digital avg", label: "Digital Traffic", shortLabel: "T-03", category: "traffic_digital", width: 80, sortable: false, align: "center", description: "Average digital engagement score across submarkets", views: MSA_CMP },
  // Risk
  { id: "R-01 Affordability", label: "Affordability", shortLabel: "R-01", category: "risk", width: 80, sortable: false, align: "center", description: "Rent-to-income ratio — higher = more stressed renters", views: MSA_CMP },
  { id: "R-03 Concession Drag", label: "Concession Drag", shortLabel: "R-03", category: "risk", width: 80, sortable: false, align: "center", description: "Concession drag on effective rent — leakage from face rent", views: MSA_CMP },
];

export const DEFAULT_COLUMNS: Record<ViewId, string[]> = {
  f4_dashboard: ["rank", "starred", "msa", "props", "units", "jedi", "d30", "trend", "rent", "rentD", "vac", "absorb", "pipeline", "costs", "dApt", "popD", "medInc", "cap", "cycle"],
  f4_browse: ["rank", "starred", "msa", "props", "units", "jedi", "d30", "trend", "rent", "rentD", "vac", "absorb", "pipeline", "costs", "dApt", "popD", "medInc", "cap", "cycle"],
  f4_submarkets: ["name", "msa", "jedi", "rent", "rentD", "vac", "props", "units", "opp", "cap"],
  f4_properties: ["name", "submarket", "msa", "jedi", "units", "rent", "occ", "capRate", "vintage", "owner"],
  f4_compare: [],
  msa_compare: [
    "D-01 Jobs/Apt", "D-02 New Jobs/Unit", "D-03 Migration", "D-09 Momentum", "D-10 Gravity", "D-11 Rent-Mort",
    "S-04 Absorption", "S-05 Clusters", "S-06 Permit Mom", "S-08 Saturation",
    "M-01 Avg Rent", "M-02 Rent Accel", "M-05 Rent vs Wage", "M-06 Occupancy",
    "DC-01 Capacity", "DC-02 Buildout", "DC-03 Constraint", "DC-04 Overhang", "DC-07 Pricing Power", "DC-08 Supply Wave", "DC-11 Adj Rent",
    "T-02 Physical avg", "T-03 Digital avg",
    "R-01 Affordability", "R-03 Concession Drag",
  ],
};

const dynamicColumnCache = new Map<string, ColumnDef>();

const UNIT_FORMATS: Record<string, (v: number | null) => string> = {
  '%': (v) => v != null ? `${v.toFixed(1)}%` : '—',
  '$': (v) => v != null ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
  '$/sqft': (v) => v != null ? `$${v.toFixed(2)}` : '—',
  'bps': (v) => v != null ? `${v.toFixed(0)}bp` : '—',
  'units': (v) => v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—',
  'months': (v) => v != null ? `${v.toFixed(1)}mo` : '—',
  'index': (v) => v != null ? v.toFixed(1) : '—',
  'ratio': (v) => v != null ? v.toFixed(2) : '—',
  'score': (v) => v != null ? v.toFixed(1) : '—',
  'permits': (v) => v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—',
  'jobs': (v) => v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—',
  'people': (v) => v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—',
  'rank': (v) => v != null ? `#${v.toFixed(0)}` : '—',
};

export interface CatalogMetric {
  id: string;
  dbMetricId: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  investmentSignal?: string;
  higherIsBetter?: boolean;
  source?: string;
  updateFrequency?: string;
  pointCount: number;
  geoCount: number;
  earliest: string;
  latest: string;
}

export interface DynamicColumnDef extends ColumnDef {
  isDynamic: true;
  catalogMetricId: string;
  dbMetricId: string;
  metricUnit: string;
  metricSource?: string;
  metricFrequency?: string;
  higherIsBetter?: boolean;
  aggregation: 'latest' | 'yoy' | '3mo_avg';
  geoScope: 'auto' | 'msa' | 'submarket' | 'property';
  displayFormat: 'auto' | 'pct' | 'dollar' | 'decimals';
}

export function buildDynamicColumn(metric: CatalogMetric): DynamicColumnDef {
  const colId = `metric:${metric.id}`;
  if (dynamicColumnCache.has(colId)) return dynamicColumnCache.get(colId)! as DynamicColumnDef;

  const cat = (CATEGORY_META[metric.category] ? metric.category : 'market') as ColumnCategory;
  const format = UNIT_FORMATS[metric.unit] || ((v: number | null) => v != null ? v.toFixed(2) : '—');

  const col: DynamicColumnDef = {
    id: colId,
    label: metric.name.length > 12 ? metric.name.substring(0, 10) + '…' : metric.name,
    shortLabel: metric.id,
    category: cat,
    width: 64,
    sortable: true,
    align: "center",
    description: metric.description,
    catalogMetricId: metric.id,
    dbMetricId: metric.dbMetricId,
    views: ALL_VIEWS,
    isDynamic: true,
    unit: metric.unit,
    metricUnit: metric.unit,
    metricSource: metric.source,
    metricFrequency: metric.updateFrequency,
    higherIsBetter: metric.higherIsBetter,
    aggregation: 'latest',
    geoScope: 'auto',
    displayFormat: 'auto',
    format,
  };

  dynamicColumnCache.set(colId, col);
  return col;
}

export function isDynamicColumn(colId: string): boolean {
  return colId.startsWith("metric:");
}

export function extractMetricId(colId: string): string | null {
  if (!colId.startsWith("metric:")) return null;
  return colId.substring(7);
}

export function getColumnsForView(viewId: ViewId): ColumnDef[] {
  return COLUMN_REGISTRY.filter(col => col.views.includes(viewId));
}

export function getColumnById(id: string): ColumnDef | undefined {
  if (id.startsWith("metric:")) {
    return dynamicColumnCache.get(id);
  }
  return COLUMN_REGISTRY.find(col => col.id === id);
}

export function getColumnsByCategory(viewId: ViewId): Record<string, ColumnDef[]> {
  const cols = getColumnsForView(viewId);
  const grouped: Record<string, ColumnDef[]> = {};
  for (const col of cols) {
    if (!grouped[col.category]) grouped[col.category] = [];
    grouped[col.category].push(col);
  }
  return grouped;
}

export function formatMetricValue(value: number | null, unit?: string): string {
  if (value == null) return '—';
  const formatter = unit ? UNIT_FORMATS[unit] : null;
  if (formatter) return formatter(value);
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(2);
}
