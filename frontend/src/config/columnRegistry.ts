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
}

export type ViewId = "f4_dashboard" | "f4_browse" | "f4_submarkets" | "f4_properties" | "f4_compare";

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
  | "cycle";

export const CATEGORY_META: Record<ColumnCategory, { label: string; color: string }> = {
  identity: { label: "IDENTITY", color: "#8E99A4" },
  score: { label: "SCORES", color: "#FFD166" },
  rent: { label: "RENT", color: "#00D26A" },
  occupancy: { label: "OCCUPANCY", color: "#00BCD4" },
  supply: { label: "SUPPLY", color: "#FF8C42" },
  demand: { label: "DEMAND", color: "#7C4DFF" },
  financial: { label: "FINANCIAL", color: "#F5A623" },
  demographic: { label: "DEMOGRAPHIC", color: "#14B8A6" },
  traffic: { label: "TRAFFIC", color: "#2196F3" },
  competition: { label: "COMPETITION", color: "#E91E63" },
  risk: { label: "RISK", color: "#FF5252" },
  cycle: { label: "CYCLE", color: "#AB47BC" },
};

const DASH_BROWSE: ViewId[] = ["f4_dashboard", "f4_browse"];
const SUB: ViewId[] = ["f4_submarkets"];
const PROP: ViewId[] = ["f4_properties"];

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
];

export const DEFAULT_COLUMNS: Record<ViewId, string[]> = {
  f4_dashboard: ["rank", "starred", "msa", "props", "units", "jedi", "d30", "trend", "rent", "rentD", "vac", "absorb", "pipeline", "costs", "dApt", "popD", "medInc", "cap", "cycle"],
  f4_browse: ["rank", "starred", "msa", "props", "units", "jedi", "d30", "trend", "rent", "rentD", "vac", "absorb", "pipeline", "costs", "dApt", "popD", "medInc", "cap", "cycle"],
  f4_submarkets: ["name", "msa", "jedi", "rent", "rentD", "vac", "props", "units", "opp", "cap"],
  f4_properties: ["name", "submarket", "msa", "jedi", "units", "rent", "occ", "capRate", "vintage", "owner"],
  f4_compare: [],
};

export function getColumnsForView(viewId: ViewId): ColumnDef[] {
  return COLUMN_REGISTRY.filter(col => col.views.includes(viewId));
}

export function getColumnById(id: string): ColumnDef | undefined {
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
