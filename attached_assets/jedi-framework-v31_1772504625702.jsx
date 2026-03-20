import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — Financial Module Framework v3.1
// Additions: Projections Tab + Excel Export
// ═══════════════════════════════════════════════════════════════════════════════

const FRAMEWORK = {

  // ─────────────────────────────────────────────────────────────
  // PROJECTIONS TAB — The "Property CF" sheet equivalent
  // This is the Creekside "Operating Calculations" + "Property CF"
  // merged into one comprehensive view
  // ─────────────────────────────────────────────────────────────
  projectionsTab: {
    key: "projections",
    label: "Projections",
    icon: "⋮≡",
    source: "ENGINE",
    position: "Tab 3 — after Pro Forma (summary) and before Assumptions",
    
    purpose: `The Pro Forma tab shows a SUMMARY (GPR → Vacancy → EGR → OpEx → NOI → DS → CF).
The Projections tab shows the FULL OPERATING STATEMENT — every line item, every period.
Think of Pro Forma as the executive summary, Projections as the institutional detail sheet.
This mirrors how the Creekside model had both a Summary Page AND an Operating Calculations sheet.`,

    timelineSelector: {
      options: [3, 5, 7, 10],
      default: "Uses holdYears from assumptions",
      behavior: "Selecting a different timeline does NOT change the hold period assumption. It shows projected performance BEYOND the hold for scenario planning. The exit year is visually marked.",
      note: "Common institutional practice: model 7-year hold but show 10 years of projections to evaluate refinance vs sell decisions at different exit points.",
    },

    viewModes: {
      annual: {
        default: true,
        description: "Year 1 through Year N columns. Primary view for most analysis.",
      },
      monthly: {
        description: "Month 1-12 for Year 1, expandable for other years. Shows occupancy ramp, seasonal patterns, IO-to-amort transition.",
        useCase: "Due diligence, lender presentations, granular cash flow timing",
        note: "Creekside had 144 monthly columns. We do this with expandable year sections to keep the UI manageable.",
      },
    },

    sections: [
      {
        name: "Revenue",
        lineItems: [
          { label: "Gross Potential Rent", formula: "marketRentPerUnit × units × 12 × cumulativeGrowth", source: "ENGINE", isSummary: false },
          { label: "Loss-to-Lease", formula: "GPR × lossToLeasePct (if rent roll loaded)", source: "ENGINE", phase: 2 },
          { label: "Vacancy Loss", formula: "GPR × vacancyRate[year]", source: "ENGINE", isSummary: false },
          { label: "Concessions", formula: "GPR × concessionsPct", source: "ENGINE", isSummary: false },
          { label: "Bad Debt", formula: "GPR × badDebtPct", source: "ENGINE", isSummary: false },
          { label: "Non-Revenue Units", formula: "units × nonRevPct × marketRent (if applicable)", source: "ENGINE", phase: 2 },
          { label: "BASE RENTAL REVENUE", formula: "GPR + losses", source: "ENGINE", isSubtotal: true },
          { label: "—", spacer: true },
          { label: "Ancillary: Parking/Garage", formula: "parkingIncome × growth", source: "ENGINE", phase: 2, category: "ancillary" },
          { label: "Ancillary: Utility Reimb (RUBS)", formula: "rubsPerUnit × units × 12 × growth", source: "ENGINE", phase: 2, category: "ancillary" },
          { label: "Ancillary: Valet Trash", formula: "trashPerUnit × units × 12 × growth", source: "ENGINE", phase: 2, category: "ancillary" },
          { label: "Ancillary: Cable/Internet", formula: "cablePerUnit × units × 12 × growth", source: "ENGINE", phase: 2, category: "ancillary" },
          { label: "Ancillary: Washer/Dryer", formula: "wdPerUnit × units × 12 × growth", source: "ENGINE", phase: 2, category: "ancillary" },
          { label: "Ancillary: Renters Insurance", formula: "riPerUnit × units × 12 × growth", source: "ENGINE", phase: 2, category: "ancillary" },
          { label: "Ancillary: Other", formula: "otherIncPerUnit × units × 12 × growth", source: "ENGINE", category: "ancillary" },
          { label: "TOTAL OTHER INCOME", formula: "Sum of ancillary items", source: "ENGINE", isSubtotal: true },
          { label: "—", spacer: true },
          { label: "EFFECTIVE GROSS REVENUE", formula: "Base Rental + Other Income", source: "ENGINE", isTotal: true, highlight: true },
        ],
        note: "Phase 1: Uses aggregate otherIncomePerUnit. Phase 2: Breaks into 13 Creekside-style ancillary line items.",
      },
      {
        name: "Expenses",
        lineItems: [
          { label: "Repair & Maintenance", source: "ENGINE", phase: 2, category: "controllable" },
          { label: "Contract Services", source: "ENGINE", phase: 2, category: "controllable" },
          { label: "Landscaping/Grounds", source: "ENGINE", phase: 2, category: "controllable" },
          { label: "Personnel", source: "ENGINE", phase: 2, category: "controllable" },
          { label: "Marketing/Advertising", source: "ENGINE", phase: 2, category: "controllable" },
          { label: "Administrative", source: "ENGINE", phase: 2, category: "controllable" },
          { label: "Turnover/Make-Ready", source: "ENGINE", phase: 2, category: "controllable" },
          { label: "CONTROLLABLE EXPENSES", isSubtotal: true, phase: 2 },
          { label: "—", spacer: true },
          { label: "Water & Sewer", source: "ENGINE", phase: 2, category: "nonControllable" },
          { label: "Electric", source: "ENGINE", phase: 2, category: "nonControllable" },
          { label: "Gas/Fuel", source: "ENGINE", phase: 2, category: "nonControllable" },
          { label: "Insurance", source: "ENGINE", phase: 2, category: "nonControllable" },
          { label: "Property Tax", source: "ENGINE", phase: 2, category: "nonControllable" },
          { label: "Management Fee", formula: "EGR × mgmtFeePct", source: "ENGINE", category: "nonControllable" },
          { label: "NON-CONTROLLABLE EXPENSES", isSubtotal: true, phase: 2 },
          { label: "—", spacer: true },
          { label: "TOTAL OPERATING EXPENSES", formula: "Sum all categories (or expensePerUnit × units in Phase 1)", source: "ENGINE", isTotal: true },
        ],
        note: "Phase 1: Single line 'Operating Expenses' = expensePerUnit × units × growth. Phase 2: Full category breakdown matching Creekside's T-12 structure.",
      },
      {
        name: "Net Operating Income",
        lineItems: [
          { label: "NET OPERATING INCOME", formula: "EGR − Total OpEx", source: "ENGINE", isTotal: true, highlight: true, colorClass: "noi" },
          { label: "Replacement Reserves", formula: "units × reservePerUnit", source: "ENGINE" },
          { label: "NOI AFTER RESERVES", formula: "NOI − Reserves", source: "ENGINE", isSubtotal: true },
        ],
      },
      {
        name: "Debt Service",
        lineItems: [
          { label: "Interest Expense", formula: "Monthly rate calc (IO or amortizing)", source: "ENGINE" },
          { label: "Principal Amortization", formula: "P&I payment − interest (0 during IO)", source: "ENGINE" },
          { label: "TOTAL DEBT SERVICE", formula: "Interest + Principal", source: "ENGINE", isTotal: true },
        ],
        note: "Shows IO vs amortizing transition. During IO period, Principal = 0. After IO, shows actual principal paydown.",
      },
      {
        name: "Cash Flow",
        lineItems: [
          { label: "CASH FLOW BEFORE DISTRIBUTIONS", formula: "NOI after reserves − Debt Service", source: "ENGINE", isTotal: true, highlight: true, colorClass: "cf" },
          { label: "Partnership/Fund Expenses", formula: "Asset mgmt fee + fund admin", source: "ENGINE", phase: 2 },
          { label: "LP Distributions (Preferred)", formula: "From waterfall engine", source: "ENGINE", phase: 2 },
          { label: "GP Promote", formula: "From waterfall engine", source: "ENGINE", phase: 2 },
          { label: "NET CASH FLOW TO PARTNERS", formula: "CF − fund expenses", source: "ENGINE", isTotal: true },
        ],
      },
      {
        name: "Operating Metrics",
        lineItems: [
          { label: "DSCR", formula: "NOI after reserves ÷ |Debt Service|", source: "ENGINE" },
          { label: "Cash-on-Cash Return", formula: "Net CF ÷ Total Equity", source: "ENGINE" },
          { label: "Debt Yield", formula: "NOI ÷ Loan Balance", source: "ENGINE" },
          { label: "Yield on Cost", formula: "NOI ÷ Total Basis", source: "ENGINE" },
          { label: "Occupancy", formula: "1 − vacancyRate[year]", source: "ENGINE" },
          { label: "Expense Ratio", formula: "OpEx ÷ EGR", source: "ENGINE" },
          { label: "NOI Margin", formula: "NOI ÷ EGR", source: "ENGINE" },
          { label: "Revenue per Unit", formula: "EGR ÷ units", source: "ENGINE" },
          { label: "Expense per Unit", formula: "OpEx ÷ units", source: "ENGINE" },
        ],
        note: "Metrics section appears at the bottom of the projections table. Color-coded: green > threshold, amber = borderline, red < threshold.",
      },
      {
        name: "Exit / Disposition (Final Year Column)",
        lineItems: [
          { label: "Exit NOI (Forward 12-mo)", formula: "Year N NOI", source: "ENGINE" },
          { label: "Exit Cap Rate", source: "INPUT" },
          { label: "Gross Sale Price", formula: "Exit NOI ÷ Exit Cap", source: "ENGINE" },
          { label: "Selling Costs", formula: "Gross Sale × sellingCostsPct", source: "ENGINE" },
          { label: "Loan Payoff", formula: "Remaining balance at exit month", source: "ENGINE" },
          { label: "NET DISPOSITION PROCEEDS", formula: "Sale − Costs − Debt", source: "ENGINE", isTotal: true, highlight: true },
          { label: "—", spacer: true },
          { label: "Total Equity Invested", source: "ENGINE" },
          { label: "Total Distributions + Proceeds", formula: "Cumulative CF + Net Proceeds", source: "ENGINE" },
          { label: "Net Profit", formula: "Distributions − Equity", source: "ENGINE" },
          { label: "IRR", formula: "Newton-Raphson on full CF vector", source: "ENGINE", highlight: true },
          { label: "Equity Multiple", formula: "Total Dist ÷ Equity", source: "ENGINE", highlight: true },
        ],
        note: "This section only appears in the exit year column. Shows the full disposition waterfall.",
      },
    ],

    uiFeatures: {
      timelineToggle: "Pill selector: 3yr | 5yr | 7yr | 10yr — adjusts number of columns. Exit year highlighted.",
      viewModeToggle: "Annual | Monthly toggle in top right. Monthly expands Year 1 to 12 columns.",
      stickyRowLabels: "First column (line item labels) is sticky on horizontal scroll",
      stickyHeader: "Year headers are sticky on vertical scroll",
      sectionCollapse: "Revenue / Expenses / NOI / Debt / CF / Metrics sections are collapsible",
      rowHighlighting: "Subtotals in light gray background. Totals in darker background. NOI and CF in brand colors.",
      exitColumn: "Exit year column has special styling — amber border, includes disposition analysis below regular projections",
      tooltips: "Hover any cell to see: formula used, inputs, growth rate applied",
      phaseIndicator: "Phase 2 line items shown as grayed-out placeholder rows with 'Coming Soon' label (so users see the roadmap)",
    },
  },

  // ─────────────────────────────────────────────────────────────
  // EXCEL EXPORT — Institutional-grade downloadable workbook
  // ─────────────────────────────────────────────────────────────
  excelExport: {
    trigger: "Download button in top bar + button on Projections tab header",
    
    architecture: {
      description: `When user clicks "Export to Excel", the app serializes the active version's 
      assumptions + computed outputs into a JSON payload, sends it to the container's Python 
      backend (openpyxl), which generates a formatted .xlsx file with proper Excel formulas, 
      color coding, and multiple sheets. File is downloaded to user's browser.`,
      
      flow: [
        "1. User clicks 'Download Excel' button",
        "2. React serializes: version.assumptions + version.computed → JSON",
        "3. JSON posted to /api/export/excel (or generated client-side via SheetJS)",
        "4. Python/openpyxl builds multi-sheet workbook with formulas",
        "5. File served for download",
      ],
      
      clientSideAlternative: `For the artifact/prototype, we use SheetJS (xlsx library) which is 
      available in the React environment. This generates the Excel client-side without needing 
      a backend. Production version would use openpyxl for formula support.`,
    },

    sheets: [
      {
        name: "Summary",
        description: "Executive dashboard — mirrors the Overview tab",
        content: [
          "Property header (name, address, units, vintage)",
          "Key metrics block: IRR, EM, CoC, Y1 NOI, DSCR, YOC, Exit Value",
          "Sources & Uses table",
          "Disposition analysis",
          "Returns summary",
        ],
        formatting: "Blue headers, black formulas, blue inputs per IB convention",
      },
      {
        name: "Assumptions",
        description: "All model inputs — blue text for editable cells",
        content: [
          "Property assumptions",
          "Acquisition assumptions",
          "Revenue assumptions (rent/unit, growth rates, vacancy ramp)",
          "Expense assumptions",
          "Debt terms (active loan + comparison loans)",
          "Disposition assumptions",
          "Waterfall terms",
        ],
        formatting: "Blue text = hardcoded inputs. Yellow background = key assumptions. This is the 'Input' sheet equivalent from Creekside.",
        critical: "ALL formulas in other sheets reference cells HERE. Changing an assumption recalculates the entire workbook.",
      },
      {
        name: "Pro Forma",
        description: "Full operating projections — the main analytical sheet",
        content: [
          "Mirrors the Projections tab exactly",
          "All revenue line items with per-year columns",
          "All expense line items",
          "NOI calculation",
          "Debt service with IO/amort transition",
          "Cash flow to equity",
          "Operating metrics (DSCR, CoC, DY, YOC, Occ, Expense Ratio)",
        ],
        formatting: "Black text = ALL formulas referencing Assumptions sheet. Subtotal rows in bold. NOI in blue. CF in green.",
        columns: "A = Line Item | B = Year 0 (Close) | C = Year 1 | D = Year 2 | ... | N = Year {holdYears}",
        formulas: {
          example_GPR: "=Assumptions!$B$12 * Assumptions!$B$5 * 12 * (1+Assumptions!$B$15)^(C$1-1)",
          example_vacancy: "=C5 * INDEX(Assumptions!$B$18:$B$28, C$1)",
          example_NOI: "=C12 + C20",
          example_DSCR: "=C24 / ABS(C22)",
          note: "ALL values are Excel formulas, not hardcoded. User can change Assumptions sheet and entire Pro Forma recalculates.",
        },
      },
      {
        name: "Debt Schedule",
        description: "Loan comparison + active loan amortization schedule",
        content: [
          "Loan comparison matrix (3+ loans side-by-side)",
          "Active loan: Monthly amortization schedule",
          "Interest vs principal split per period",
          "Running balance",
          "IO-to-amort transition highlighted",
          "Extension test metrics (if applicable)",
        ],
        formatting: "Monthly rows within annual groupings. IO period in light blue background. Amort period in white.",
      },
      {
        name: "Sensitivity",
        description: "Two-way data tables — Excel native data tables preferred",
        content: [
          "Table 1: IRR by Exit Cap Rate × Rent Growth",
          "Table 2: EM by Exit Cap Rate × Hold Period",
          "Base case cell highlighted",
          "Color-coded heat map via conditional formatting",
        ],
        formatting: "Excel conditional formatting for heatmap (green > 20% IRR, yellow 12-20%, red < 12%)",
      },
      {
        name: "Waterfall",
        description: "LP/GP distribution schedule",
        content: [
          "Equity contributions by class",
          "Preferred return calculation",
          "Return of capital",
          "Profit split by promote tier",
          "Total distributions to LP and GP",
          "LP IRR and EM",
        ],
        formatting: "LP sections in blue, GP sections in amber. Formulas reference Pro Forma CF outputs.",
      },
      {
        name: "Rent Comps",
        description: "Comparable properties (if data loaded)",
        content: [
          "Property name, year built, units, distance",
          "Rent per SF by unit type",
          "Subject property position vs market average",
          "Variance analysis",
        ],
        formatting: "Standard table. Subject property row highlighted.",
        phase: 2,
      },
    ],

    colorCoding: {
      blueText: "Hardcoded inputs (things users change for scenarios)",
      blackText: "ALL formulas and calculations",
      greenText: "Links pulling from other sheets within the workbook",
      yellowBackground: "Key assumptions needing attention",
      grayBackground: "Subtotal rows",
      darkGrayBackground: "Grand total rows",
    },

    numberFormatting: {
      currency: "$#,##0 — always specify units in headers",
      percentages: "0.0% — one decimal default",
      multiples: "0.00x — two decimals for EM, DSCR",
      negatives: "Parentheses: ($1,234) not -$1,234",
      years: "Text format: '2026' not 2,026",
    },

    downloadOptions: {
      singleVersion: "Download active version as .xlsx",
      allVersions: "Download all versions — each version gets its own set of sheets (Summary_v1, ProForma_v1, Summary_v2, ProForma_v2, ...)",
      comparisonSheet: "If 2+ versions selected on Compare tab, add a Comparison sheet showing side-by-side metrics + assumption diffs",
    },
  },

  // ─────────────────────────────────────────────────────────────
  // UPDATED TAB ORDER (9 tabs now)
  // ─────────────────────────────────────────────────────────────
  updatedTabs: [
    { key: "overview",     label: "Overview",       icon: "⊞",  source: "ENGINE + AI",  description: "Executive summary: KPIs, S&U, Disposition, AI insights" },
    { key: "proforma",     label: "Pro Forma",      icon: "≡",  source: "ENGINE",        description: "Summary operating statement (GPR → NOI → CF). Quick view." },
    { key: "projections",  label: "Projections",    icon: "⋮≡", source: "ENGINE",        description: "FULL operating statement with timeline selector (3/5/7/10yr), monthly toggle, all line items. The institutional detail sheet.", isNew: true },
    { key: "assumptions",  label: "Assumptions",    icon: "⊕",  source: "INPUT",         description: "Every model input with source badges. Full audit trail." },
    { key: "debt",         label: "Debt",           icon: "⊙",  source: "ENGINE",        description: "Multi-loan comparison. Click to select, model recalculates." },
    { key: "waterfall",    label: "Waterfall",      icon: "◈",  source: "ENGINE",        description: "LP/GP equity distribution. Pref + promote + coinvest." },
    { key: "sensitivity",  label: "Sensitivity",    icon: "∿",  source: "ENGINE",        description: "Heat map tables. Every cell = full model run." },
    { key: "decision",     label: "Decision",       icon: "✓",  source: "AI",            description: "AI rationale, risks, actions. From original design." },
    { key: "compare",      label: "Compare",        icon: "⇔",  source: "ENGINE + AI",   description: "Side-by-side versions with assumption diffs.", cls: "cmp" },
  ],

  // ─────────────────────────────────────────────────────────────
  // PRO FORMA vs PROJECTIONS — Why both?
  // ─────────────────────────────────────────────────────────────
  proFormaVsProjections: {
    proForma: {
      purpose: "Quick summary for deal screening and high-level review",
      lineItems: "~12 rows: GPR, Vacancy, Concessions, Bad Debt, Other Income, EGR, OpEx, NOI, Reserves, Debt Service, CF, DSCR",
      timeline: "Fixed to holdYears. No timeline selector.",
      viewMode: "Annual only",
      audience: "Investor reviewing multiple deals quickly",
      analogy: "Creekside's 'Summary Page' sheet",
    },
    projections: {
      purpose: "Full institutional operating statement for underwriting and due diligence",
      lineItems: "40-60+ rows across 7 sections (Revenue detail, Expense detail, NOI, Debt, CF, Metrics, Exit)",
      timeline: "User-selectable: 3/5/7/10 years. Exit year visually marked.",
      viewMode: "Annual (default) + Monthly toggle (expands Year 1 to 12 columns)",
      audience: "Underwriter, lender, LP doing due diligence",
      analogy: "Creekside's 'Operating Calculations' + 'Property CF' sheets combined",
      excelExport: "This is the primary sheet exported to Excel",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL FRAMEWORK (interactive)
// ═══════════════════════════════════════════════════════════════════════════════

export default function FrameworkV31() {
  const [activeSection, setActiveSection] = useState("projections");
  const [timelineYrs, setTimelineYrs] = useState(7);
  const [viewMode, setViewMode] = useState("annual");

  const sections = [
    { key: "projections", label: "Projections Tab (NEW)", icon: "⋮≡", accent: "#3b82f6" },
    { key: "provspr", label: "Pro Forma vs Projections", icon: "⇔", accent: "#8b5cf6" },
    { key: "excel", label: "Excel Export", icon: "↓", accent: "#059669" },
    { key: "tabs", label: "Updated Tab Order (9)", icon: "≡", accent: "#f59e0b" },
  ];

  // Mock projection data for visual
  const mockYears = Array.from({ length: timelineYrs }, (_, i) => i + 1);
  const exitYear = 7; // from default assumptions

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", fontFamily: "'DM Sans', sans-serif", color: "#c3c9d4", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0b0f; }
        .timeline-btn { padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1.5px solid #1e2028; background: transparent; color: #6b7280; cursor: pointer; font-family: 'JetBrains Mono'; transition: all .12s; }
        .timeline-btn.active { border-color: #3b82f6; color: #3b82f6; background: rgba(59,130,246,.08); }
        .timeline-btn:hover:not(.active) { border-color: #3c4254; color: #9ba3b0; }
        .mode-btn { padding: 3px 10px; border-radius: 3px; font-size: 10px; font-weight: 600; border: 1px solid #1e2028; background: transparent; color: #6b7280; cursor: pointer; font-family: 'DM Sans'; transition: all .12s; }
        .mode-btn.active { border-color: #f59e0b; color: #f59e0b; background: rgba(245,158,11,.08); }
        .proj-row { display: flex; border-bottom: 1px solid #141720; }
        .proj-row:hover { background: rgba(255,255,255,.02); }
        .proj-row.subtotal { background: rgba(255,255,255,.03); }
        .proj-row.subtotal .proj-label { font-weight: 700; color: #c3c9d4; }
        .proj-row.total { background: rgba(59,130,246,.06); border-top: 1.5px solid #1e2028; }
        .proj-row.total .proj-label { font-weight: 700; color: #eef0f5; font-size: 12px; }
        .proj-row.total .proj-val { font-weight: 700; color: #eef0f5; }
        .proj-row.noi { background: rgba(37,99,235,.08); }
        .proj-row.noi .proj-label, .proj-row.noi .proj-val { color: #60a5fa; font-weight: 700; }
        .proj-row.cf { background: rgba(5,150,105,.06); }
        .proj-row.cf .proj-label, .proj-row.cf .proj-val { color: #34d399; font-weight: 700; }
        .proj-row.spacer { height: 8px; border-bottom: none; }
        .proj-row.section-header { background: #111318; border-bottom: 1px solid #1e2028; padding: 6px 0; }
        .proj-row.section-header .proj-label { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #6b7280; font-family: 'JetBrains Mono'; }
        .proj-label { width: 220px; min-width: 220px; padding: 5px 12px; font-size: 11px; color: #9ba3b0; position: sticky; left: 0; background: inherit; z-index: 1; }
        .proj-val { flex: 1; min-width: 90px; padding: 5px 10px; text-align: right; font-size: 11px; font-family: 'JetBrains Mono'; font-weight: 500; color: #9ba3b0; }
        .proj-val.exit-yr { background: rgba(245,158,11,.06); border-left: 1.5px solid #f59e0b44; border-right: 1.5px solid #f59e0b44; }
        .proj-val.neg { color: #f87171; }
        .proj-header { display: flex; border-bottom: 1.5px solid #1e2028; position: sticky; top: 0; z-index: 2; background: #0e1017; }
        .proj-header .proj-label { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #3c4254; font-family: 'JetBrains Mono'; }
        .proj-header .proj-val { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #6b7280; font-family: 'JetBrains Mono'; }
        .sheet-tab { padding: 6px 14px; font-size: 10px; font-weight: 600; border: 1px solid; border-radius: 4px 4px 0 0; cursor: default; font-family: 'JetBrains Mono'; }
        .phase2 { opacity: .4; font-style: italic; }
        .phase2::after { content: ' (Phase 2)'; font-size: 9px; color: #6b7280; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #1a1d26", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne", fontWeight: 800, fontSize: 11, color: "#000" }}>J</div>
        <div>
          <div style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#eef0f5" }}>
            JEDI <span style={{ color: "#f59e0b" }}>RE</span>
            <span style={{ color: "#3c4254", fontFamily: "DM Sans", fontSize: 11, fontWeight: 400, marginLeft: 8 }}>Framework v3.1 — Projections + Excel Export</span>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <span style={{ padding: "3px 8px", borderRadius: 3, fontSize: 9, fontWeight: 600, fontFamily: "JetBrains Mono", background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.3)", color: "#60a5fa" }}>9 TABS</span>
          <span style={{ padding: "3px 8px", borderRadius: 3, fontSize: 9, fontWeight: 600, fontFamily: "JetBrains Mono", background: "rgba(5,150,105,.1)", border: "1px solid rgba(5,150,105,.3)", color: "#34d399" }}>EXCEL EXPORT</span>
          <span style={{ padding: "3px 8px", borderRadius: 3, fontSize: 9, fontWeight: 600, fontFamily: "JetBrains Mono", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", color: "#f59e0b" }}>WAITING ON #3</span>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 210, borderRight: "1px solid #1a1d26", padding: "10px 0", flexShrink: 0 }}>
          <div style={{ padding: "4px 14px", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#3c4254", fontFamily: "JetBrains Mono", marginBottom: 4 }}>NEW ADDITIONS</div>
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)} style={{
              display: "flex", alignItems: "center", gap: 7, width: "100%",
              padding: "8px 14px", border: "none", cursor: "pointer",
              background: activeSection === s.key ? `${s.accent}10` : "transparent",
              borderLeft: activeSection === s.key ? `2px solid ${s.accent}` : "2px solid transparent",
              color: activeSection === s.key ? s.accent : "#6b7280",
              fontFamily: "DM Sans", fontSize: 11.5, fontWeight: activeSection === s.key ? 600 : 400,
              transition: "all .12s", textAlign: "left",
            }}>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 11 }}>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>

          {activeSection === "projections" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <h2 style={{ fontFamily: "Syne", fontSize: 17, color: "#eef0f5", marginBottom: 2 }}>Projections Tab — Full Operating Statement</h2>
                  <p style={{ fontSize: 11, color: "#6b7280" }}>Institutional-grade detail sheet. Every line item, every period. Timeline-selectable. Excel-exportable.</p>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "#3c4254", fontFamily: "JetBrains Mono" }}>TIMELINE:</span>
                  {[3, 5, 7, 10].map(yr => (
                    <button key={yr} className={`timeline-btn ${timelineYrs === yr ? "active" : ""}`} onClick={() => setTimelineYrs(yr)}>
                      {yr}yr
                    </button>
                  ))}
                  <div style={{ width: 1, height: 16, background: "#1e2028", margin: "0 4px" }}/>
                  <button className={`mode-btn ${viewMode === "annual" ? "active" : ""}`} onClick={() => setViewMode("annual")}>Annual</button>
                  <button className={`mode-btn ${viewMode === "monthly" ? "active" : ""}`} onClick={() => setViewMode("monthly")}>Monthly</button>
                </div>
              </div>

              {/* Mock projections table */}
              <div style={{ background: "#0e1017", border: "1px solid #1e2028", borderRadius: 8, overflow: "auto", maxHeight: 520 }}>
                {/* Header */}
                <div className="proj-header">
                  <div className="proj-label">Line Item</div>
                  {mockYears.map(y => (
                    <div key={y} className={`proj-val${y === exitYear ? " exit-yr" : ""}`}>
                      Year {y}{y === exitYear ? " 🚪" : ""}
                    </div>
                  ))}
                </div>

                {/* Revenue Section */}
                <div className="proj-row section-header"><div className="proj-label">REVENUE</div></div>
                {[
                  { label: "Gross Potential Rent", vals: mockYears.map(y => `$${(4.61 * Math.pow(1.035, y-1)).toFixed(2)}M`) },
                  { label: "Vacancy Loss", vals: mockYears.map(y => `($${(0.28 - y * 0.02).toFixed(2)}M)`), neg: true },
                  { label: "Concessions", vals: mockYears.map(() => "($92K)"), neg: true },
                  { label: "Bad Debt", vals: mockYears.map(() => "($115K)"), neg: true },
                  { label: "Ancillary: Parking/Garage", vals: mockYears.map(() => "$47K"), phase2: true },
                  { label: "Ancillary: RUBS", vals: mockYears.map(() => "$129K"), phase2: true },
                  { label: "Ancillary: Valet Trash", vals: mockYears.map(() => "$62K"), phase2: true },
                  { label: "Other Income (aggregate)", vals: mockYears.map(y => `$${(248 * Math.pow(1.03, y-1)).toFixed(0)}K`) },
                ].map((row, i) => (
                  <div key={i} className={`proj-row${row.phase2 ? " phase2" : ""}`}>
                    <div className={`proj-label${row.phase2 ? " phase2" : ""}`}>{row.label}</div>
                    {row.vals.map((v, j) => <div key={j} className={`proj-val${mockYears[j] === exitYear ? " exit-yr" : ""}${row.neg ? " neg" : ""}`}>{v}</div>)}
                  </div>
                ))}
                <div className="proj-row total">
                  <div className="proj-label">EFFECTIVE GROSS REVENUE</div>
                  {mockYears.map((y, i) => <div key={i} className={`proj-val${y === exitYear ? " exit-yr" : ""}`}>${(4.37 * Math.pow(1.04, y-1)).toFixed(2)}M</div>)}
                </div>

                <div className="proj-row spacer"/>

                {/* Expenses Section */}
                <div className="proj-row section-header"><div className="proj-label">OPERATING EXPENSES</div></div>
                {[
                  { label: "Repair & Maintenance", phase2: true },
                  { label: "Personnel", phase2: true },
                  { label: "Insurance", phase2: true },
                  { label: "Property Tax", phase2: true },
                  { label: "Management Fee" },
                  { label: "Total Operating Expenses" },
                ].map((row, i) => (
                  <div key={i} className={`proj-row${row.phase2 ? "" : i === 5 ? " total" : ""}`}>
                    <div className={`proj-label${row.phase2 ? " phase2" : ""}`}>{row.label}</div>
                    {mockYears.map((y, j) => <div key={j} className={`proj-val${y === exitYear ? " exit-yr" : ""} neg`}>
                      {row.phase2 ? "—" : `($${(2.02 * Math.pow(1.03, y-1)).toFixed(2)}M)`}
                    </div>)}
                  </div>
                ))}

                <div className="proj-row spacer"/>

                {/* NOI */}
                <div className="proj-row noi total">
                  <div className="proj-label">NET OPERATING INCOME</div>
                  {mockYears.map((y, i) => <div key={i} className={`proj-val${y === exitYear ? " exit-yr" : ""}`}>${(2.35 * Math.pow(1.05, y-1)).toFixed(2)}M</div>)}
                </div>
                <div className="proj-row">
                  <div className="proj-label">Replacement Reserves</div>
                  {mockYears.map((y, i) => <div key={i} className={`proj-val${y === exitYear ? " exit-yr" : ""} neg`}>($54K)</div>)}
                </div>

                <div className="proj-row spacer"/>

                {/* Debt Service */}
                <div className="proj-row section-header"><div className="proj-label">DEBT SERVICE</div></div>
                <div className="proj-row">
                  <div className="proj-label">Interest Expense</div>
                  {mockYears.map((y, i) => <div key={i} className={`proj-val${y === exitYear ? " exit-yr" : ""} neg`}>($1.90M)</div>)}
                </div>
                <div className="proj-row">
                  <div className="proj-label">Principal Amortization</div>
                  {mockYears.map((y, i) => <div key={i} className={`proj-val${y === exitYear ? " exit-yr" : ""}`}>{y <= 3.5 ? "$0" : "($145K)"}</div>)}
                </div>
                <div className="proj-row total">
                  <div className="proj-label">Total Debt Service</div>
                  {mockYears.map((y, i) => <div key={i} className={`proj-val${y === exitYear ? " exit-yr" : ""} neg`}>{y <= 3.5 ? "($1.90M)" : "($2.05M)"}</div>)}
                </div>

                <div className="proj-row spacer"/>

                {/* Cash Flow */}
                <div className="proj-row cf total">
                  <div className="proj-label">CASH FLOW TO EQUITY</div>
                  {mockYears.map((y, i) => <div key={i} className={`proj-val${y === exitYear ? " exit-yr" : ""}`}>${(0.45 + (y-1) * 0.12).toFixed(2)}M</div>)}
                </div>

                <div className="proj-row spacer"/>

                {/* Metrics */}
                <div className="proj-row section-header"><div className="proj-label">OPERATING METRICS</div></div>
                {[
                  { label: "DSCR", vals: mockYears.map(y => `${(1.21 + y * 0.08).toFixed(2)}x`) },
                  { label: "Cash-on-Cash", vals: mockYears.map(y => `${(1.8 + y * 1.2).toFixed(1)}%`) },
                  { label: "Debt Yield", vals: mockYears.map(y => `${(6.4 + y * 0.4).toFixed(1)}%`) },
                  { label: "Occupancy", vals: mockYears.map(y => `${Math.min(95, 90 + y * 1.5).toFixed(0)}%`) },
                  { label: "Expense Ratio", vals: mockYears.map(() => "46.3%") },
                ].map((row, i) => (
                  <div key={i} className="proj-row">
                    <div className="proj-label">{row.label}</div>
                    {row.vals.map((v, j) => <div key={j} className={`proj-val${mockYears[j] === exitYear ? " exit-yr" : ""}`}>{v}</div>)}
                  </div>
                ))}

                {/* Exit section only in exit year */}
                {timelineYrs >= exitYear && (
                  <>
                    <div className="proj-row spacer"/>
                    <div className="proj-row section-header"><div className="proj-label">DISPOSITION (YEAR {exitYear})</div></div>
                    {["Gross Sale Price → $50.2M", "Selling Costs → ($1.26M)", "Loan Payoff → ($35.1M)", "NET PROCEEDS → $13.84M", "—", "IRR → 35.9%", "Equity Multiple → 8.58x"].map((item, i) => (
                      <div key={i} className={`proj-row${item === "—" ? " spacer" : item.includes("IRR") || item.includes("Equity") || item.includes("NET") ? " total" : ""}`}>
                        {item !== "—" && <>
                          <div className="proj-label" style={{ fontWeight: item.includes("NET") || item.includes("IRR") || item.includes("Equity") ? 700 : 400, color: item.includes("NET") ? "#34d399" : item.includes("IRR") ? "#60a5fa" : "#9ba3b0" }}>
                            {item.split(" → ")[0]}
                          </div>
                          {mockYears.map((y, j) => <div key={j} className={`proj-val${y === exitYear ? " exit-yr" : ""}`} style={{ color: y === exitYear ? "#eef0f5" : "transparent" }}>
                            {y === exitYear ? item.split(" → ")[1] : ""}
                          </div>)}
                        </>}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Download button */}
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <div style={{ fontSize: 10, color: "#3c4254" }}>
                  <span style={{ color: "#f59e0b" }}>🚪</span> = Exit year column · <span style={{ fontStyle: "italic", opacity: .5 }}>Grayed items</span> = Phase 2 line items (visible as roadmap)
                </div>
                <button style={{
                  padding: "7px 16px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                  border: "1.5px solid #059669", background: "rgba(5,150,105,.1)", color: "#34d399",
                  cursor: "pointer", fontFamily: "DM Sans", display: "flex", alignItems: "center", gap: 6,
                }}>
                  ↓ Export to Excel (.xlsx)
                </button>
              </div>
            </div>
          )}

          {activeSection === "provspr" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 17, color: "#eef0f5", marginBottom: 14 }}>Pro Forma vs Projections — Why Both?</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: "JetBrains Mono", background: "#dbeafe", color: "#1d4ed8" }}>TAB 2</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#eef0f5" }}>≡ Pro Forma</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9ba3b0", lineHeight: 1.7 }}>
                    <strong style={{ color: "#eef0f5" }}>Purpose:</strong> Quick summary for deal screening<br/>
                    <strong style={{ color: "#eef0f5" }}>Lines:</strong> ~12 rows (GPR → EGR → NOI → CF)<br/>
                    <strong style={{ color: "#eef0f5" }}>Timeline:</strong> Fixed to hold period<br/>
                    <strong style={{ color: "#eef0f5" }}>View:</strong> Annual only<br/>
                    <strong style={{ color: "#eef0f5" }}>Audience:</strong> Quick review, multiple deals<br/>
                    <strong style={{ color: "#eef0f5" }}>Analogy:</strong> Creekside's "Summary Page"
                  </div>
                </div>
                <div style={{ background: "#111318", border: "1.5px solid #3b82f644", borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: "JetBrains Mono", background: "#dbeafe", color: "#1d4ed8" }}>TAB 3</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#eef0f5" }}>⋮≡ Projections</span>
                    <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 8, fontWeight: 700, background: "#dcfce7", color: "#166534" }}>NEW</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9ba3b0", lineHeight: 1.7 }}>
                    <strong style={{ color: "#eef0f5" }}>Purpose:</strong> Full institutional operating statement<br/>
                    <strong style={{ color: "#eef0f5" }}>Lines:</strong> 40-60+ rows across 7 sections<br/>
                    <strong style={{ color: "#eef0f5" }}>Timeline:</strong> User-selectable (3/5/7/10yr)<br/>
                    <strong style={{ color: "#eef0f5" }}>View:</strong> Annual + Monthly toggle<br/>
                    <strong style={{ color: "#eef0f5" }}>Audience:</strong> Underwriters, lenders, LP diligence<br/>
                    <strong style={{ color: "#eef0f5" }}>Analogy:</strong> Creekside's "Operating Calculations" + "Property CF"<br/>
                    <strong style={{ color: "#eef0f5" }}>Export:</strong> Primary sheet in Excel download
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, padding: 12, background: "#111318", border: "1px solid #f59e0b44", borderRadius: 8, fontSize: 11, color: "#9ba3b0" }}>
                <strong style={{ color: "#f59e0b" }}>Key insight:</strong> The Pro Forma tab is for the person reviewing 10 deals today. The Projections tab is for the deal they're actually underwriting. Same engine, different depth.
              </div>
            </div>
          )}

          {activeSection === "excel" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 17, color: "#eef0f5", marginBottom: 4 }}>Excel Export Architecture</h2>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 16 }}>Institutional-grade .xlsx workbook with formulas, color coding, and multiple sheets</p>

              {/* Sheet tabs visual */}
              <div style={{ display: "flex", gap: 3, marginBottom: 14, flexWrap: "wrap" }}>
                {FRAMEWORK.excelExport.sheets.map(s => (
                  <span key={s.name} className="sheet-tab" style={{
                    borderColor: s.phase === 2 ? "#1e2028" : "#059669",
                    color: s.phase === 2 ? "#3c4254" : "#34d399",
                    background: s.phase === 2 ? "transparent" : "rgba(5,150,105,.06)",
                    opacity: s.phase === 2 ? .5 : 1,
                  }}>
                    {s.name}{s.phase === 2 ? " (P2)" : ""}
                  </span>
                ))}
              </div>

              {/* Sheet details */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {FRAMEWORK.excelExport.sheets.filter(s => s.phase !== 2).map(sheet => (
                  <div key={sheet.name} style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14, borderLeft: "3px solid #059669" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#eef0f5" }}>{sheet.name}</span>
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{sheet.description}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                      {sheet.content.map(c => (
                        <span key={c} style={{ padding: "3px 7px", borderRadius: 3, fontSize: 9.5, background: "#0a0b0f", border: "1px solid #1e2028", color: "#9ba3b0" }}>{c}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}><strong>Format:</strong> {sheet.formatting}</div>
                    {sheet.formulas && (
                      <div style={{ marginTop: 6, padding: 8, background: "#0a0b0f", borderRadius: 4, fontSize: 10, fontFamily: "JetBrains Mono", color: "#6b7280", lineHeight: 1.6 }}>
                        {Object.entries(sheet.formulas).filter(([k]) => k !== "note").map(([k, v]) => (
                          <div key={k}><span style={{ color: "#3c4254" }}>{k}:</span> <span style={{ color: "#60a5fa" }}>{v}</span></div>
                        ))}
                        <div style={{ marginTop: 4, color: "#f59e0b", fontFamily: "DM Sans" }}>{sheet.formulas.note}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Color coding legend */}
              <div style={{ marginTop: 14, background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#eef0f5", marginBottom: 8 }}>IB-Standard Color Coding</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { color: "#0000ff", bg: "transparent", label: "Blue text — Hardcoded inputs" },
                    { color: "#111", bg: "transparent", label: "Black text — ALL formulas" },
                    { color: "#008000", bg: "transparent", label: "Green text — Cross-sheet links" },
                    { color: "#111", bg: "#ffff00", label: "Yellow bg — Key assumptions" },
                    { color: "#111", bg: "#e5e7eb", label: "Gray bg — Subtotal rows" },
                    { color: "#fff", bg: "#374151", label: "Dark bg — Grand total rows" },
                  ].map(c => (
                    <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
                      <div style={{ width: 40, height: 18, borderRadius: 3, background: c.bg || "#fff", border: "1px solid #1e2028", display: "flex", alignItems: "center", justifyContent: "center", color: c.color, fontSize: 8, fontWeight: 700, fontFamily: "JetBrains Mono" }}>Ab1</div>
                      <span style={{ color: "#9ba3b0" }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 14, background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#eef0f5", marginBottom: 8 }}>Download Options</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ padding: "6px 14px", borderRadius: 5, fontSize: 11, fontWeight: 600, border: "1.5px solid #059669", background: "rgba(5,150,105,.1)", color: "#34d399", cursor: "pointer", fontFamily: "DM Sans" }}>↓ Active Version</button>
                  <button style={{ padding: "6px 14px", borderRadius: 5, fontSize: 11, fontWeight: 600, border: "1.5px solid #3b82f6", background: "rgba(59,130,246,.1)", color: "#60a5fa", cursor: "pointer", fontFamily: "DM Sans" }}>↓ All Versions</button>
                  <button style={{ padding: "6px 14px", borderRadius: 5, fontSize: 11, fontWeight: 600, border: "1.5px solid #8b5cf6", background: "rgba(139,92,246,.1)", color: "#a78bfa", cursor: "pointer", fontFamily: "DM Sans" }}>↓ Comparison Report</button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "tabs" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 17, color: "#eef0f5", marginBottom: 14 }}>Updated Tab Order — 9 Tabs</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {FRAMEWORK.updatedTabs.map((tab, i) => (
                  <div key={tab.key} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    background: tab.isNew ? "rgba(59,130,246,.06)" : "#111318",
                    border: `1px solid ${tab.isNew ? "#3b82f644" : "#1e2028"}`,
                    borderRadius: 6,
                  }}>
                    <span style={{ width: 20, textAlign: "center", fontSize: 9, fontWeight: 700, fontFamily: "JetBrains Mono", color: "#3c4254" }}>{i + 1}</span>
                    <span style={{ fontSize: 14, width: 20 }}>{tab.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#eef0f5", width: 100 }}>{tab.label}</span>
                    {tab.isNew && <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 8, fontWeight: 700, background: "#dcfce7", color: "#166534" }}>NEW</span>}
                    <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 8, fontWeight: 600, fontFamily: "JetBrains Mono",
                      background: tab.source.includes("ENGINE") ? "#dbeafe" : tab.source === "AI" ? "#fef3c7" : "#dcfce7",
                      color: tab.source.includes("ENGINE") ? "#1d4ed8" : tab.source === "AI" ? "#92400e" : "#166534",
                    }}>{tab.source}</span>
                    <span style={{ fontSize: 11, color: "#6b7280", flex: 1 }}>{tab.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
