import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — Financial Module Combined Framework
// Merging: Original UI (module awareness, decision intelligence, scenario triplets)
//        + Engine V2 (real computation, waterfall, sensitivity, assumptions audit)
// ═══════════════════════════════════════════════════════════════════════════════

const FRAMEWORK = {
  title: "JEDI RE Financial Module — Combined Architecture",
  version: "3.0",
  principle: "Claude controls ASSUMPTIONS → Engine COMPUTES outputs → AI generates QUALITATIVE intelligence (decisions, risks, actions)",

  // ─────────────────────────────────────────────────────────────
  // SECTION 1: THREE-LAYER ARCHITECTURE
  // ─────────────────────────────────────────────────────────────
  architecture: {
    layer1_assumptions: {
      name: "Assumption Layer (INPUT)",
      owner: "User + Claude AI",
      description: "All editable inputs that drive the model. Claude can modify these via model_update/model_create commands.",
      categories: {
        property: ["name", "city", "state", "vintage", "units", "rsf"],
        acquisition: ["purchasePrice", "closingCosts", "capexPerUnit", "rateCap", "operatingReserve", "interestReserve"],
        revenue: [
          "marketRentPerUnit (monthly)",
          "rentGrowth[] (per-year array)",
          "vacancyRate[] (per-year array, supports occupancy ramp)",
          "concessionsPct",
          "badDebtPct",
          "otherIncomePerUnit (annual)",
          "otherIncomeGrowth",
          "ancillaryIncome[] (array of {name, amountPerUnit, growth})",
        ],
        expenses: [
          "expensePerUnit (annual total)",
          "expenseGrowth",
          "replacementReserves",
          "// FUTURE: expense line items (R&M, personnel, taxes, insurance, etc.)",
        ],
        debt: [
          "loans[] (array of loan options, each with: name, ltv, rate, ioYears, amortYears, origFeePct, type)",
          "activeLoanIdx",
          "// FUTURE: floating rate with SOFR forward curve (like Creekside's Chatham import)",
        ],
        disposition: ["holdYears", "exitCapRate", "sellingCostsPct"],
        waterfall: [
          "lpPrefReturn",
          "gpCoinvest",
          "promote[] (array of hurdles with lpShare/gpShare)",
          "// FUTURE: multi-class LP (like Creekside's Class A-1, A-2, A-3)",
        ],
      },
    },

    layer2_engine: {
      name: "Computation Engine (COMPUTED)",
      owner: "JavaScript engine — deterministic, auditable",
      description: "Takes assumptions, outputs all financial metrics. No AI involvement. Same math every time.",
      outputs: {
        yearlyProjections: "Array of year objects: GPR → vacancy → concessions → bad debt → other income → EGR → OpEx → NOI → reserves → debt service → CF to equity → DSCR → CoC",
        sourcesAndUses: "Sources (loan + equity) and Uses (purchase + capex + financing costs + reserves)",
        disposition: "Exit NOI → gross sale → selling costs → loan payoff → net proceeds",
        returnMetrics: "IRR (Newton-Raphson), equity multiple, avg cash-on-cash, yield on cost, DSCR",
        waterfall: "LP pref → return of capital → promote split → LP/GP totals → LP IRR",
        sensitivity: "2D grids where every cell is a full model run (exit cap × rent growth, exit cap × hold period)",
      },
    },

    layer3_intelligence: {
      name: "AI Intelligence Layer (AI-GENERATED)",
      owner: "Claude AI — qualitative analysis on top of computed outputs",
      description: "Decision rationale, risk flags, action items, module status awareness. This is what the original design had that pure computation can't provide.",
      outputs: {
        decision: {
          winner: "Recommended loan/strategy with conviction level",
          rationale: "Array of specific reasons backed by computed metrics",
          risks: "Array of risk flags with specific thresholds",
          actions: "Array of next steps with timelines",
        },
        scenarioTriplet: {
          description: "Base/Best/Worst scenarios — Claude adjusts assumptions for each, engine computes all three",
          base: "Current assumptions as entered",
          best: "Claude generates optimistic assumptions (tighter vacancy, higher rent growth, lower exit cap)",
          worst: "Claude generates pessimistic assumptions (wider vacancy, lower rent growth, higher exit cap)",
        },
        moduleInsights: "AI-generated observations about what intelligence feeds are connected and what signals they provide",
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // SECTION 2: MODULE STATUS SYSTEM (from original design)
  // ─────────────────────────────────────────────────────────────
  moduleSystem: {
    description: "Shows which JEDI RE modules are feeding data into the financial model. Critical for user trust — they need to know what's real vs mock.",
    modules: [
      {
        id: "strategy",
        label: "Strategy",
        icon: "⊕",
        description: "Strategy Arbitrage Engine",
        fields: ["BTS/Flip/Rental/STR scores", "Arbitrage flag", "Recommended strategy"],
        feedsInto: "Informs which proforma template to use (rental vs BTS vs flip). Adjusts hold period, exit assumptions, revenue model.",
        statuses: ["live", "mock", "none"],
      },
      {
        id: "traffic",
        label: "Traffic",
        icon: "↗",
        description: "Traffic Fusion Engine v2",
        fields: ["AADT Florida DOT", "Digital traffic SpyFu", "Weekly walk-in forecast"],
        feedsInto: "Traffic-derived revenue adjustments. Replaces hardcoded assumptions with intelligence-derived inputs.",
        statuses: ["live", "mock", "none"],
      },
      {
        id: "proforma",
        label: "Pro Forma",
        icon: "$",
        description: "Pro Forma Computation Engine",
        fields: ["N-year projections", "Rent roll + occupancy ramp", "Expense assumptions", "Debt service"],
        feedsInto: "Core financial projections. The engine itself.",
        statuses: ["live", "mock", "none"],
      },
      {
        id: "debt",
        label: "Debt",
        icon: "○",
        description: "Capital Structure Engine",
        fields: ["Multi-loan comparison", "DSCR & IO analysis", "Amortization schedules", "Waterfall distributions"],
        feedsInto: "Debt service, leverage, equity required, returns.",
        statuses: ["live", "mock", "none"],
      },
    ],
    uiElements: {
      pills: "Row of clickable pills showing each module with status badge (● Live, ◐ Mock, ○ Not Connected)",
      counter: "'3/4 modules feeding the model' with Refresh button",
      drawer: "Expandable panel showing all 4 modules in a grid with description, data fields, and status",
    },
  },

  // ─────────────────────────────────────────────────────────────
  // SECTION 3: TAB STRUCTURE (COMBINED)
  // ─────────────────────────────────────────────────────────────
  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: "⊞",
      source: "BOTH",
      description: "Executive summary combining computed metrics + AI scenario triplets",
      sections: [
        {
          name: "KPI Header",
          source: "ENGINE",
          content: "IRR, EM, CoC, Y1 NOI, DSCR, YOC, Exit Value — all engine-computed with source badges",
        },
        {
          name: "Scenario Comparison Table",
          source: "AI + ENGINE",
          content: "Base / Best / Worst side-by-side. Claude sets assumptions for each scenario, engine computes all metrics.",
          note: "KEY DESIGN DECISION: Each scenario is a full assumption set, not just adjusted outputs. User can inspect what assumptions differ.",
        },
        {
          name: "Sources & Uses",
          source: "ENGINE",
          content: "Computed from purchase price, capex, closing costs, loan amount, equity",
        },
        {
          name: "Disposition Analysis",
          source: "ENGINE",
          content: "Exit NOI → cap rate → gross sale → costs → loan payoff → net proceeds",
        },
        {
          name: "AI Intelligence Callout",
          source: "AI",
          content: "IRR spread analysis, DSCR commentary, suggested next actions",
        },
      ],
    },
    {
      key: "proforma",
      label: "Pro Forma",
      icon: "≡",
      source: "ENGINE",
      description: "Full N-year projection table with every line item",
      sections: [
        { name: "KPI Strip", content: "IRR, EM, Y1 NOI, Exit Value — quick reference" },
        { name: "Projection Table", content: "GPR → Vacancy → Concessions → Bad Debt → Other Income → EGR → OpEx → NOI → Reserves → Debt Service → CF → DSCR → CoC" },
        { name: "Source Badge", content: "'ENGINE-COMPUTED' badge — user knows these are real calculations, not AI estimates" },
      ],
    },
    {
      key: "projections",
      label: "Projections",
      icon: "▦",
      source: "ENGINE",
      description: "Full multi-year projection model — the institutional-grade output. Configurable 3/5/7/10 year timelines with Excel export.",
      isNew: true,
      sections: [
        {
          name: "Timeline Selector",
          content: "Toggle bar: 3yr | 5yr | 7yr | 10yr — engine recalculates entire projection to selected horizon. Default matches holdYears from assumptions.",
          designNote: "Changing projection timeline does NOT change the hold period assumption for IRR calculation — it extends visibility. Hold period stays as set in assumptions. User sees 'Hold ends Year X' marker in the table.",
        },
        {
          name: "Projection Header",
          content: "Property name, units, address, projection period label, active loan, export button",
        },
        {
          name: "Revenue Section",
          source: "ENGINE",
          content: [
            "Gross Potential Rent (units × rent/unit × 12 × growth)",
            "Less: Vacancy/Loss (GPR × vacancy rate per year)",
            "Less: Concessions (GPR × concessions%)",
            "Less: Bad Debt (GPR × bad debt%)",
            "Plus: Other Income (units × other income/unit × growth)",
            "═══ EFFECTIVE GROSS REVENUE",
          ].join("\n"),
          note: "Each line shows the assumption that drives it (e.g., '6% → 5% → 5% → 4%' for vacancy). Phase 2 adds 13 ancillary income line items and floor plan rent roll.",
        },
        {
          name: "Expense Section",
          source: "ENGINE",
          content: [
            "Total Operating Expenses (units × OpEx/unit × growth)",
            "═══ NET OPERATING INCOME",
            "Less: Replacement Reserves (units × reserves/unit)",
            "═══ NOI AFTER RESERVES",
          ].join("\n"),
          note: "Phase 1 uses aggregate OpEx/unit. Phase 2 breaks into Creekside-style categories: R&M, Contract Services, Landscaping, Personnel, Marketing, Admin, Turnover, Utilities (W&S, Electric), Insurance, Property Tax, Other.",
        },
        {
          name: "Debt Service Section",
          source: "ENGINE",
          content: [
            "Gross Debt Service (IO payments during IO period, amortizing payments after)",
            "═══ CASH FLOW TO EQUITY (levered)",
          ].join("\n"),
          note: "Monthly granularity internal — shows annual totals. IO/amortizing transition year shows blended amount. Phase 2 adds floating rate with SOFR forward curve.",
        },
        {
          name: "Returns & Metrics Row",
          source: "ENGINE",
          content: [
            "DSCR (NOI after reserves ÷ |debt service|)",
            "Cash-on-Cash (CF to equity ÷ total equity)",
            "Debt Yield (NOI ÷ loan amount)",
            "Cumulative CF to Equity",
          ].join("\n"),
        },
        {
          name: "Disposition Row (at hold year)",
          source: "ENGINE",
          content: [
            "Exit NOI → Gross Sale (÷ exit cap) → Selling Costs → Loan Payoff → Net Proceeds",
            "Total Cash Flow (operating CF + net proceeds)",
            "IRR / Equity Multiple / Total Return",
          ].join("\n"),
          note: "Shows as a highlighted row at the hold year with the reversion analysis. If projection extends beyond hold (e.g., 10yr projection on 7yr hold), years after exit are grayed with 'POST-EXIT' label.",
        },
        {
          name: "Excel Export Button",
          source: "PLATFORM",
          content: "Downloads full projection as institutional-grade .xlsx with multiple sheets, formulas (not hardcoded values), proper formatting, and color coding.",
          exportSheets: [
            "Summary — KPIs, S&U, disposition, returns",
            "Projections — Full N-year P&L with formulas linking to assumptions",
            "Assumptions — All inputs with blue text (editable) vs black text (formula)",
            "Debt Schedule — Monthly/annual debt service, amortization, balance",
            "Sensitivity — IRR × exit cap × rent growth data tables",
            "Waterfall — LP/GP distribution breakdown",
          ],
          excelStandards: [
            "Blue text = hardcoded inputs user can change",
            "Black text = formulas",
            "Green text = cross-sheet references",
            "Yellow highlight = key assumptions",
            "Parentheses for negatives, not minus signs",
            "Currency: $#,##0 with units in headers",
            "Percentages: 0.0% format",
            "All formulas use cell references, not hardcoded Python-calculated values",
            "Uses openpyxl + LibreOffice recalc for formula verification",
          ],
        },
      ],
      whyThisIsDistinctFromProForma: "Pro Forma tab is the COMPACT view — KPI strip + summary table, optimized for quick scanning in the model builder UI. Projections tab is the FULL EXPORT view — institutional-grade detail matching what an LP, lender, or investment committee would expect. It's the spreadsheet-equivalent view with the export button that sends it to Excel.",
    },
    {
      key: "assumptions",
      label: "Assumptions",
      icon: "⊕",
      source: "INPUT",
      description: "Full transparency into every model input, organized by category",
      isNew: true,
      sections: [
        { name: "Property Card", content: "Name, units, vintage, location" },
        { name: "Acquisition Card", content: "Purchase price, price/unit, CapEx/unit, closing costs, reserves" },
        { name: "Revenue Card", content: "Market rent/unit, annual GPR, rent growth array, vacancy array, concessions, bad debt, other income" },
        { name: "Expenses Card", content: "OpEx/unit, total OpEx, growth rate, expense ratio, replacement reserves" },
        { name: "Active Debt Card", content: "Selected lender, LTV, rate, IO, amortization, loan amount" },
        { name: "Disposition Card", content: "Hold period, exit cap, selling costs, waterfall terms" },
      ],
      designNote: "Every value shows INPUT or ENGINE-COMPUTED badge. Users can audit exactly what drives the model. Tell JEDI to change any value.",
    },
    {
      key: "debt",
      label: "Debt",
      icon: "⊙",
      source: "ENGINE",
      description: "Multi-loan comparison with instant model recalculation on selection",
      sections: [
        { name: "Loan Cards (clickable)", content: "3+ loan options as cards. Click to select — entire model recalculates." },
        { name: "Debt Metrics Strip", content: "Loan amount, equity required, leverage ratio, Y1 DSCR — updates per loan" },
        { name: "AI Debt Analysis", content: "JEDI's commentary on loan selection — which wins and why" },
      ],
    },
    {
      key: "waterfall",
      label: "Waterfall",
      icon: "◈",
      source: "ENGINE",
      description: "LP/GP equity distribution computed from waterfall structure",
      isNew: true,
      sections: [
        { name: "Visual Split Bar", content: "Proportional LP (blue) / GP (amber) bar" },
        { name: "LP Returns Card", content: "LP equity, preferred return, total to LP, LP IRR" },
        { name: "GP Returns Card", content: "GP coinvest, promote, total to GP, total profit" },
      ],
      futureEnhancements: [
        "Multi-class LP (A-1, A-2, A-3 like Creekside's 'The Calvin' overlay)",
        "Catch-up provisions",
        "Fund-of-fund arbitrage modeling",
      ],
    },
    {
      key: "sensitivity",
      label: "Sensitivity",
      icon: "∿",
      source: "ENGINE",
      description: "Heat map tables where every cell is a REAL full model run",
      sections: [
        { name: "IRR Grid", content: "Exit Cap Rate (rows) × Rent Growth (columns) — color-coded heat map" },
        { name: "EM Grid", content: "Exit Cap Rate (rows) × Hold Period (columns) — color-coded heat map" },
        { name: "Base Case Indicator", content: "Current assumptions highlighted with ● marker and outline" },
      ],
      designNote: "Unlike the original which approximated: ai = baseIRR + (0.055-cap)*200 + (rg-.04)*150, every cell runs the full computation engine. This is the Creekside approach — real data tables.",
    },
    {
      key: "decision",
      label: "Decision",
      icon: "✓",
      source: "AI",
      description: "AI-generated qualitative analysis — the intelligence layer on top of computation",
      fromOriginal: true,
      sections: [
        { name: "Recommendation Banner", content: "Recommended loan/strategy + conviction level (High/Moderate/Low)" },
        { name: "Decision Rationale", content: "Array of specific reasons — MUST reference computed metrics, not vague statements" },
        { name: "Risk Flags", content: "Specific risks with thresholds (e.g., 'DSCR at 2.92x in worst case')" },
        { name: "Action Items", content: "Concrete next steps with timelines" },
      ],
      generationNote: "Decision content is generated by Claude when user asks 'give me your analysis' or on version creation. NOT pre-populated with hardcoded text.",
    },
    {
      key: "compare",
      label: "Compare Versions",
      icon: "⇔",
      source: "ENGINE + AI",
      description: "Side-by-side version comparison with computed deltas and assumption diff highlighting",
      cls: "cmp",
      sections: [
        { name: "Version Selector", content: "Toggle buttons for each version — select 2+ to compare" },
        { name: "Returns Section", content: "All computed metrics side-by-side with best/worst highlighting and % delta from base" },
        { name: "Assumptions Diff", content: "Shows which assumptions DIFFER between versions — highlighted in amber. This is the key insight: what INPUT changes drove the OUTPUT differences." },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // SECTION 4: VERSION SYSTEM
  // ─────────────────────────────────────────────────────────────
  versionSystem: {
    description: "Each version is a complete assumption set + computed outputs + optional AI decision",
    structure: {
      id: "Unique ID",
      name: "User-visible name (e.g., 'Bear Case — 7% Exit Cap')",
      color: "Color from palette for visual identification",
      assumptions: "Complete assumption object (all inputs)",
      computed: "Engine output: rows[], metrics{}, disposition{}, waterfall{}, equity, loanAmt, etc.",
      decision: "Optional AI-generated decision object (rationale, risks, actions)",
      scenarios: "Optional Base/Best/Worst triplet — each is a sub-assumption set with computed outputs",
      createdAt: "Timestamp",
    },
    creation: {
      manual: "User clicks 'Save Version' — snapshots current assumptions + computed outputs",
      aiGenerated: "Claude outputs model_create with assumption changes — engine computes, version appears in version bar + Compare tab",
      loanSwitch: "Clicking a different loan on Debt tab recalculates in-place (same version, different loan)",
    },
    comparison: "Compare tab shows side-by-side computed metrics with assumption diffs highlighted",
  },

  // ─────────────────────────────────────────────────────────────
  // SECTION 5: AI INTERACTION MODEL
  // ─────────────────────────────────────────────────────────────
  aiInteraction: {
    systemPrompt: {
      principle: "Claude knows all current assumptions and computed outputs. It modifies ASSUMPTIONS ONLY — never outputs pre-calculated metrics.",
      includes: [
        "Active version name, property, key metrics (from engine)",
        "All assumption keys with current values",
        "Saved versions with their metrics (from engine)",
        "Instructions for model_update and model_create commands",
      ],
    },
    commands: {
      model_update: {
        description: "Modify assumptions on the ACTIVE version",
        format: '```model_update\n{ "changes": { "exitCapRate": 0.06, "holdYears": 5 } }\n```',
        effect: "Engine recalculates active version in place",
      },
      model_create: {
        description: "Create a NEW version with different assumptions",
        format: '```model_create\n{ "name": "Bear Case", "changes": { "exitCapRate": 0.07, "rentGrowth": [0.02, ...] } }\n```',
        effect: "New version created from active + changes. Engine computes. Version bar updates. Auto-navigate to Compare.",
      },
    },
    chips: {
      description: "Status chips shown below AI messages to confirm what happened",
      types: [
        { type: "upd", color: "green", example: "✓ Model updated" },
        { type: "new", color: "purple", example: '⊕ "Bear Case" — IRR 22.4% | EM 5.20x' },
        { type: "calc", color: "blue", example: "Recalculated: IRR 22.4% | DSCR 3.15x" },
      ],
    },
    quickPrompts: [
      "Build a bull case",
      "Stress: 7% exit cap",
      "Model 2% rent growth",
      "Bridge loan alternative",
      "5-year hold scenario",
      "Which loan wins?",
      "Give me your decision analysis",
      "Compare all versions",
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SECTION 6: LAYOUT
  // ─────────────────────────────────────────────────────────────
  layout: {
    chatPanel: {
      width: "370px",
      position: "left",
      background: "dark (#0a0b0f)",
      sections: ["Brand header", "Context bar (property · version · IRR · version count)", "Message feed", "Quick prompts", "Input area"],
    },
    modelPanel: {
      position: "right (flex: 1)",
      background: "light (#f0f2f5)",
      sections: [
        "Top bar: JEDI RE logo + breadcrumb + Save Version + Compare All buttons",
        "Hero banner: 'FINANCIAL MODULE — COMPUTATION ENGINE' with subtitle and version count",
        "Module pills: Strategy | Traffic | Pro Forma | Debt with status badges + counter + Refresh",
        "Module drawer: Expandable 4-card grid showing data pipeline details",
        "Version bar: Colored version tabs + '+ Ask JEDI' button + version count",
        "Tab bar: Overview | Pro Forma | Projections | Assumptions | Debt | Waterfall | Sensitivity | Decision | Compare",
        "Content area: Active tab content (scrollable)",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // SECTION 7: DESIGN DECISIONS TO FINALIZE
  // ─────────────────────────────────────────────────────────────
  openQuestions: [
    {
      question: "Scenario Triplet: Should Base/Best/Worst be 3 separate assumption sets within each version, or 3 separate versions?",
      recommendation: "3 sub-assumption sets within a version. Cleaner — one version = one thesis, with upside/downside bands. Creating versions is for fundamentally different strategies.",
      impact: "Affects Overview tab layout and how Claude generates scenarios",
    },
    {
      question: "Decision Tab: Auto-generate on version creation, or only when user asks?",
      recommendation: "Auto-generate a basic decision on version creation (3-4 bullet rationale). User can ask JEDI for deeper analysis.",
      impact: "Affects system prompt and AI call flow",
    },
    {
      question: "Module pills: Should clicking a pill do anything beyond expanding the drawer?",
      recommendation: "Clicking toggles the drawer AND highlights that module's contribution in the active tab. Future: clicking could open that module's full page.",
      impact: "UX complexity vs clarity tradeoff",
    },
    {
      question: "Expense line items: Single expensePerUnit or Creekside-style category breakdown?",
      recommendation: "Start with expensePerUnit (MVP). Add category breakdown as Phase 2 — requires significant UI work but matches institutional models.",
      impact: "Accuracy vs shipping speed",
    },
    {
      question: "Projections timeline: Should changing from 7yr to 10yr also change the hold period assumption?",
      recommendation: "No — projection timeline is VISIBILITY, hold period is an ASSUMPTION. User might want a 7-year hold but see what years 8-10 look like if they decide to extend. Show a 'HOLD ENDS HERE' marker at the hold year, and gray out post-exit years.",
      impact: "Affects how IRR is calculated (always tied to holdYears, not projection length) and how the disposition row appears in the table.",
    },
    {
      question: "Excel export: Client-side (SheetJS) or server-side (openpyxl)?",
      recommendation: "Phase 1: SheetJS in-browser for instant download. Phase 2: openpyxl backend with template system for institutional-grade models with DATA TABLE sensitivity, named ranges, and conditional formatting that SheetJS can't do well.",
      impact: "Phase 1 ships faster but the Excel quality won't match Creekside-grade. Phase 2 matches but requires backend endpoint.",
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // SECTION 8: EXCEL EXPORT ARCHITECTURE
  // ─────────────────────────────────────────────────────────────
  excelExport: {
    description: "Institutional-grade Excel export that matches what LPs, lenders, and investment committees expect. NOT a data dump — a working financial model with formulas.",
    trigger: "Export button on Projections tab + 'Download Excel' in top bar",
    technology: "openpyxl (Python) via backend API endpoint. Uses Excel formulas, not hardcoded values. LibreOffice recalc for verification.",
    
    sheets: [
      {
        name: "Summary",
        content: [
          "Property overview (name, units, RSF, vintage, address)",
          "Key metrics: IRR, EM, CoC, DSCR, YOC, Exit Value",
          "Sources & Uses table (loan + equity = total sources; purchase + capex + costs = total uses)",
          "Disposition analysis (exit NOI → cap rate → gross sale → loan payoff → net proceeds)",
          "Returns summary (equity, total distributions, net profit, IRR, EM)",
        ],
        formatting: "Executive dashboard layout. Blue text for inputs, black for formulas. Bold section headers.",
      },
      {
        name: "Assumptions",
        content: [
          "ALL model inputs organized by category (Property, Acquisition, Revenue, Expenses, Debt, Disposition, Waterfall)",
          "Each input cell is blue text — user can change it and all formulas recalculate",
          "Named ranges for every assumption (e.g., 'PurchasePrice', 'ExitCapRate', 'RentGrowthY1')",
          "Year-by-year arrays displayed horizontally (rent growth, vacancy rate per year)",
        ],
        formatting: "Blue text = editable inputs. Yellow highlight = key assumptions. Comment cells explaining each input.",
        keyPrinciple: "This sheet is the ONLY place values are hardcoded. Every other sheet uses =Assumptions!B5 style references.",
      },
      {
        name: "Projections",
        content: [
          "Full N-year P&L (3/5/7/10 year based on user selection)",
          "Revenue: GPR → Vacancy → Concessions → Bad Debt → Other Income → EGR",
          "Expenses: Total OpEx → NOI → Reserves → NOI After Reserves",
          "Debt Service: IO/amortizing calculation → CF to Equity",
          "Metrics: DSCR, CoC, Debt Yield, Cumulative CF per year",
          "Hold year row highlighted with disposition analysis",
        ],
        formatting: "Every cell is a formula referencing Assumptions sheet. Total rows bold with borders. NOI in blue, CF in green.",
        formulas: [
          "GPR: =Assumptions!Units * Assumptions!RentPerUnit * 12 * PRODUCT(1+RentGrowth array)",
          "Vacancy: =-GPR * INDEX(VacancyRateArray, year)",
          "NOI: =EGR + OpEx (formulas, not Python-computed values)",
          "Debt Service: =IF(year*12 <= IOMonths, LoanAmt*Rate/12*12, PMT(Rate/12, AmortMonths, LoanAmt)*12)",
          "DSCR: =NOI_After_Reserves / ABS(DebtService)",
        ],
      },
      {
        name: "Debt Schedule",
        content: [
          "Loan terms summary (amount, rate, IO, amortization, origination)",
          "Monthly debt service schedule (month, beginning balance, payment, principal, interest, ending balance)",
          "Annual rollup (matching Projections sheet)",
          "Remaining balance at exit month",
          "Multi-loan comparison table (if multiple loans defined)",
        ],
        formatting: "IO months in light blue background. Amortizing months in white. Annual summary rows in bold.",
      },
      {
        name: "Sensitivity",
        content: [
          "IRR data table: Exit Cap Rate (rows) × Rent Growth (columns)",
          "EM data table: Exit Cap Rate (rows) × Hold Period (columns)",
          "Excel DATA TABLE function (not hardcoded results) — recalculates when assumptions change",
          "Base case highlighted with border",
          "Conditional formatting: green > 20% IRR, blue > 12%, yellow > 8%, red < 8%",
        ],
        formatting: "Heat map conditional formatting. Base case with thick border.",
      },
      {
        name: "Waterfall",
        content: [
          "Capital contributions by class (LP equity, GP coinvest)",
          "Preferred return calculation (LP equity × pref rate × years)",
          "Return of capital",
          "Promote calculation (above-pref profits × promote rate)",
          "Total distributions to LP and GP",
          "LP IRR, LP EM",
        ],
        formatting: "LP sections in blue, GP sections in amber. Total row with double border.",
      },
    ],

    versionExport: {
      description: "When exporting from Compare tab, include all selected versions as separate sheet groups",
      structure: "Summary_v1, Projections_v1, Summary_v2, Projections_v2, ... plus a 'Version Comparison' summary sheet",
    },

    creeksideAlignment: {
      description: "The export should feel familiar to anyone who's worked with institutional proformas like the Creekside model",
      matchedPatterns: [
        "Assumptions on separate sheet with blue text inputs",
        "Projections using cell references to assumptions (not hardcoded)",
        "Color coding: blue=input, black=formula, green=cross-sheet link",
        "Parentheses for negatives",
        "Currency formatting with units in headers",
        "Named ranges for key assumptions",
        "Sensitivity using Excel DATA TABLE",
        "Separate debt schedule sheet",
      ],
      notMatched: [
        "VBA macros (target IRR solver, scenario generators) — our AI replaces this",
        "91K formula complexity — our engine is streamlined but expandable",
        "Multiple overlay sheets — our version system handles this",
        "Chatham SOFR import sheet — Phase 2",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // SECTION 9: CREEKSIDE PARITY CHECKLIST
  // ─────────────────────────────────────────────────────────────
  creeksideParity: {
    achieved: [
      "✅ Revenue cascade: GPR → vacancy → concessions → bad debt → other income → EGR",
      "✅ Expense engine with growth rate",
      "✅ Debt service with IO/amortization transitions",
      "✅ Monthly granularity within annual periods (for partial IO years)",
      "✅ Remaining loan balance at exit (proper amortization math)",
      "✅ Disposition: Exit NOI ÷ cap → gross sale → costs → loan payoff → net proceeds",
      "✅ IRR via Newton-Raphson iterative solver",
      "✅ Equity multiple and cash-on-cash",
      "✅ DSCR per year",
      "✅ Multi-loan comparison with instant recalculation",
      "✅ Sensitivity: real model runs per cell (not approximations)",
      "✅ Waterfall: LP pref + GP promote",
      "✅ Sources & Uses reconciliation",
      "✅ Configurable projection timeline (3/5/7/10 year)",
      "✅ Excel export with formulas (not hardcoded values)",
      "✅ Institutional color coding (blue=input, black=formula)",
      "✅ Multi-sheet workbook (Summary, Assumptions, Projections, Debt, Sensitivity, Waterfall)",
    ],
    notYet: [
      "❌ 9 floor plan rent roll (currently uses weighted avg rent/unit)",
      "❌ 13 ancillary income line items (currently uses aggregate otherIncomePerUnit)",
      "❌ Expense category breakdown (R&M, personnel, taxes, insurance — currently aggregate)",
      "❌ Floating rate with SOFR forward curve (Chatham import equivalent)",
      "❌ Refinance module with toggle",
      "❌ Multi-class LP waterfall (A-1/A-2/A-3)",
      "❌ Fund-of-fund returns modeling",
      "❌ Renovation premium module (premium vs classic unit tracking)",
      "❌ T-12 financials import and variance analysis",
      "❌ Insurance estimator",
      "❌ Extension tests (cash trap, DSC, DY, LTV)",
      "❌ Preferred equity module",
      "❌ Monthly cash flow granularity (currently annual output, monthly internal)",
    ],
    phase2Priority: [
      "1. Expense line items (biggest accuracy gap)",
      "2. Floor plan rent roll (enables unit-level analysis)",
      "3. Ancillary income detail (13 line items)",
      "4. Floating rate + SOFR curve",
      "5. Multi-class waterfall",
      "6. T-12 import + variance",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL FRAMEWORK MAP
// ═══════════════════════════════════════════════════════════════════════════════

export default function FrameworkMap() {
  const [activeSection, setActiveSection] = useState("architecture");

  const sections = [
    { key: "architecture", label: "Three-Layer Architecture", icon: "◆" },
    { key: "tabs", label: "Tab Structure (9 tabs)", icon: "≡" },
    { key: "projections", label: "Projections Deep-Dive", icon: "▦" },
    { key: "excel", label: "Excel Export Architecture", icon: "⬇" },
    { key: "modules", label: "Module Status System", icon: "⊕" },
    { key: "versions", label: "Version System", icon: "◎" },
    { key: "ai", label: "AI Interaction Model", icon: "⚡" },
    { key: "layout", label: "Layout Structure", icon: "⊞" },
    { key: "parity", label: "Creekside Parity", icon: "✓" },
    { key: "questions", label: "Open Questions", icon: "?" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0b0f",
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      color: "#c3c9d4",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0b0f; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "20px 28px",
        borderBottom: "1px solid #1a1d26",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{
          width: 32, height: 32,
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Syne", fontWeight: 800, fontSize: 13, color: "#000",
        }}>J</div>
        <div>
          <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#eef0f5" }}>
            JEDI <span style={{ color: "#f59e0b" }}>RE</span>
            <span style={{ color: "#3c4254", fontFamily: "DM Sans", fontSize: 12, fontWeight: 400, marginLeft: 10 }}>
              Financial Module — Combined Framework v3.0
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#3c4254", marginTop: 2 }}>
            Merging original UI (modules, decisions, scenarios) + computation engine (real IRR, waterfall, sensitivity)
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <div style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 10,
            background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", color: "#f59e0b",
            fontFamily: "JetBrains Mono", fontWeight: 600,
          }}>FRAMEWORK — NOT CODE</div>
          <div style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 10,
            background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.3)", color: "#60a5fa",
            fontFamily: "JetBrains Mono", fontWeight: 600,
          }}>8 TABS · 3 LAYERS · 4 MODULES · XLSX EXPORT</div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{
          width: 220, borderRight: "1px solid #1a1d26",
          padding: "12px 0", flexShrink: 0,
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          <div style={{
            padding: "6px 16px", fontSize: 9, fontWeight: 700,
            letterSpacing: ".12em", textTransform: "uppercase",
            color: "#3c4254", fontFamily: "JetBrains Mono",
          }}>FRAMEWORK SECTIONS</div>
          {sections.map(s => (
            <button key={s.key}
              onClick={() => setActiveSection(s.key)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 16px", border: "none", cursor: "pointer",
                background: activeSection === s.key ? "rgba(245,158,11,.08)" : "transparent",
                borderLeft: activeSection === s.key ? "2px solid #f59e0b" : "2px solid transparent",
                color: activeSection === s.key ? "#f59e0b" : "#6b7280",
                fontFamily: "DM Sans", fontSize: 12, fontWeight: activeSection === s.key ? 600 : 400,
                transition: "all .12s", textAlign: "left",
              }}>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 11 }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 28px" }}>

          {activeSection === "architecture" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>Three-Layer Architecture</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Claude controls assumptions → Engine computes outputs → AI generates qualitative intelligence</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                {/* Layer 1 */}
                <div style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, fontFamily: "JetBrains Mono", background: "#dcfce7", color: "#166534" }}>INPUT</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#eef0f5" }}>Assumption Layer</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>Owned by User + Claude AI</div>
                  {["Property & Location", "Acquisition (price, CapEx)", "Revenue (rents, vacancy, growth)", "Expenses (OpEx, reserves)", "Debt (loan options)", "Disposition (exit, hold)", "Waterfall (pref, promote)"].map(item => (
                    <div key={item} style={{ padding: "4px 0", fontSize: 11, color: "#9ba3b0", borderBottom: "1px solid #1a1d26" }}>
                      <span style={{ color: "#22c55e", marginRight: 6 }}>→</span>{item}
                    </div>
                  ))}
                </div>

                {/* Layer 2 */}
                <div style={{ background: "#111318", border: "1.5px solid #2563eb44", borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, fontFamily: "JetBrains Mono", background: "#dbeafe", color: "#1d4ed8" }}>ENGINE</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#eef0f5" }}>Computation Engine</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>JavaScript · Deterministic · Auditable</div>
                  {["Year-by-year projections", "Sources & Uses", "Disposition analysis", "IRR (Newton-Raphson)", "Equity multiple, CoC, YOC", "DSCR per year", "Waterfall LP/GP split", "Sensitivity grids (full runs)"].map(item => (
                    <div key={item} style={{ padding: "4px 0", fontSize: 11, color: "#9ba3b0", borderBottom: "1px solid #1a1d26" }}>
                      <span style={{ color: "#3b82f6", marginRight: 6 }}>◆</span>{item}
                    </div>
                  ))}
                </div>

                {/* Layer 3 */}
                <div style={{ background: "#111318", border: "1.5px solid #f59e0b44", borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, fontFamily: "JetBrains Mono", background: "#fef3c7", color: "#92400e" }}>AI</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#eef0f5" }}>Intelligence Layer</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>Claude AI · Qualitative analysis</div>
                  {["Decision rationale", "Risk flags with thresholds", "Action items + timelines", "Scenario generation (B/B/W)", "Module status awareness", "Loan recommendation", "Conviction scoring", "Cross-version insights"].map(item => (
                    <div key={item} style={{ padding: "4px 0", fontSize: 11, color: "#9ba3b0", borderBottom: "1px solid #1a1d26" }}>
                      <span style={{ color: "#f59e0b", marginRight: 6 }}>⚡</span>{item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Flow arrow */}
              <div style={{
                margin: "16px 0", padding: "10px 16px",
                background: "linear-gradient(90deg, #dcfce722, #dbeafe22, #fef3c722)",
                border: "1px solid #1e2028", borderRadius: 6,
                fontSize: 12, color: "#9ba3b0", textAlign: "center",
                fontFamily: "JetBrains Mono",
              }}>
                <span style={{ color: "#22c55e" }}>ASSUMPTIONS</span>
                {" → "}
                <span style={{ color: "#3b82f6" }}>ENGINE COMPUTES</span>
                {" → "}
                <span style={{ color: "#f59e0b" }}>AI INTERPRETS</span>
                {" → "}
                <span style={{ color: "#eef0f5" }}>USER SEES RESULTS + CAN MODIFY → LOOP</span>
              </div>
            </div>
          )}

          {activeSection === "tabs" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>Tab Structure — 9 Tabs</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Combined from original (6 tabs) + engine additions (Assumptions, Waterfall, Projections)</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {FRAMEWORK.tabs.map(tab => (
                  <div key={tab.key} style={{
                    background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14,
                    borderLeft: `3px solid ${tab.source === "ENGINE" ? "#3b82f6" : tab.source === "AI" ? "#f59e0b" : tab.source === "INPUT" ? "#22c55e" : "#8b5cf6"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>{tab.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#eef0f5" }}>{tab.label}</span>
                      {tab.isNew && <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, background: "#dcfce7", color: "#166534" }}>NEW</span>}
                      {tab.fromOriginal && <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, background: "#fef3c7", color: "#92400e" }}>FROM ORIGINAL</span>}
                      <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 600, fontFamily: "JetBrains Mono",
                        background: tab.source === "ENGINE" ? "#dbeafe" : tab.source === "AI" ? "#fef3c7" : tab.source === "INPUT" ? "#dcfce7" : "#ede9fe",
                        color: tab.source === "ENGINE" ? "#1d4ed8" : tab.source === "AI" ? "#92400e" : tab.source === "INPUT" ? "#166534" : "#6d28d9",
                      }}>{tab.source}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#9ba3b0", marginBottom: 8 }}>{tab.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {tab.sections.map(s => (
                        <span key={s.name} style={{
                          padding: "3px 8px", borderRadius: 4, fontSize: 10,
                          background: "#0a0b0f", border: "1px solid #1e2028", color: "#6b7280",
                        }}>{s.name}{s.source ? ` [${s.source}]` : ""}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "projections" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>Projections — Deep Dive</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>The institutional-grade output tab. Configurable timeline + Excel export. This is what LPs and lenders see.</p>

              {/* Why separate from Pro Forma */}
              <div style={{ background: "#111318", border: "1.5px solid #f59e0b44", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>Why Projections ≠ Pro Forma Tab?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 11, color: "#9ba3b0" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#eef0f5", marginBottom: 4 }}>Pro Forma Tab (compact)</div>
                    <div>• Quick-scan summary for model builder UI</div>
                    <div>• Fixed to holdYears from assumptions</div>
                    <div>• KPI strip + simplified table</div>
                    <div>• Optimized for in-app viewing</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#eef0f5", marginBottom: 4 }}>Projections Tab (full export)</div>
                    <div>• Institutional-grade detail</div>
                    <div>• User-selectable timeline (3/5/7/10yr)</div>
                    <div>• Complete revenue/expense/debt breakdown</div>
                    <div>• Disposition row at hold year</div>
                    <div>• Excel export button → working .xlsx model</div>
                    <div>• What you'd send to an IC or LP</div>
                  </div>
                </div>
              </div>

              {/* Timeline Selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#3c4254", marginBottom: 8, fontFamily: "JetBrains Mono" }}>TIMELINE SELECTOR</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {[3, 5, 7, 10].map(yr => (
                    <div key={yr} style={{
                      padding: "6px 14px", borderRadius: 5, fontSize: 12, fontWeight: 600,
                      background: yr === 7 ? "#2563eb" : "#111318",
                      color: yr === 7 ? "#fff" : "#6b7280",
                      border: yr === 7 ? "1px solid #2563eb" : "1px solid #1e2028",
                      cursor: "pointer",
                    }}>{yr}-Year</div>
                  ))}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <div style={{ padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: "#22c55e22", border: "1px solid #22c55e44", color: "#22c55e", cursor: "pointer" }}>⬇ Download Excel</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#3c4254" }}>Projection timeline extends visibility. Hold period ({'{'}holdYears{'}'} yr) stays fixed for IRR. Years beyond hold marked "POST-EXIT".</div>
              </div>

              {/* Projection Table Mock */}
              <div style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", background: "#0e1017", borderBottom: "1px solid #1e2028", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#eef0f5" }}>7-Year Operating Projection</span>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#dbeafe", color: "#1d4ed8", fontFamily: "JetBrains Mono", fontWeight: 600 }}>ENGINE-COMPUTED</span>
                </div>

                {/* Revenue Section */}
                <div style={{ padding: "6px 14px", background: "#0a0b0f", borderBottom: "1px solid #1a1d26" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#4a8cf0", fontFamily: "JetBrains Mono", letterSpacing: ".08em" }}>REVENUE</span>
                </div>
                {[
                  { label: "Gross Potential Rent", driver: "units × rent/unit × 12 × growth", values: ["$4.61M", "$4.75M", "$4.89M", "$5.04M", "$5.19M", "$5.34M", "$5.50M"] },
                  { label: "Less: Vacancy / Loss", driver: "GPR × vacancy%", values: ["($277K)", "($237K)", "($245K)", "($201K)", "($208K)", "($214K)", "($220K)"], neg: true },
                  { label: "Less: Concessions", driver: "GPR × 2.0%", values: ["($92K)", "($95K)", "($98K)", "($101K)", "($104K)", "($107K)", "($110K)"], neg: true },
                  { label: "Less: Bad Debt", driver: "GPR × 2.5%", values: ["($115K)", "($119K)", "($122K)", "($126K)", "($130K)", "($134K)", "($138K)"], neg: true },
                  { label: "Plus: Other Income", driver: "units × $1,150/yr × growth", values: ["$248K", "$256K", "$264K", "$271K", "$280K", "$288K", "$297K"] },
                  { label: "EFFECTIVE GROSS REVENUE", total: true, values: ["$4.37M", "$4.55M", "$4.69M", "$4.88M", "$5.03M", "$5.17M", "$5.33M"] },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
                    padding: row.total ? "6px 14px" : "4px 14px",
                    borderBottom: "1px solid #1a1d26",
                    background: row.total ? "#111822" : "transparent",
                    fontSize: 10,
                  }}>
                    <span style={{ color: row.total ? "#eef0f5" : "#6b7280", fontWeight: row.total ? 700 : 400, display: "flex", flexDirection: "column" }}>
                      {row.label}
                      {row.driver && <span style={{ fontSize: 8, color: "#3c4254", fontFamily: "JetBrains Mono" }}>{row.driver}</span>}
                    </span>
                    {row.values.map((v, j) => (
                      <span key={j} style={{
                        textAlign: "right",
                        fontFamily: "JetBrains Mono",
                        fontWeight: row.total ? 600 : 400,
                        color: row.neg ? "#dc2626" : row.total ? "#eef0f5" : "#9ba3b0",
                        fontSize: 10,
                      }}>{v}</span>
                    ))}
                  </div>
                ))}

                {/* Expense Section */}
                <div style={{ padding: "6px 14px", background: "#0a0b0f", borderBottom: "1px solid #1a1d26" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", fontFamily: "JetBrains Mono", letterSpacing: ".08em" }}>EXPENSES</span>
                </div>
                {[
                  { label: "Operating Expenses", driver: "units × $9,374/yr × 3% growth", values: ["($2.02M)", "($2.09M)", "($2.15M)", "($2.21M)", "($2.28M)", "($2.35M)", "($2.42M)"], neg: true },
                  { label: "NET OPERATING INCOME", total: true, noi: true, values: ["$2.35M", "$2.47M", "$2.54M", "$2.67M", "$2.75M", "$2.83M", "$2.91M"] },
                  { label: "Replacement Reserves", driver: "units × $250/yr", values: ["($54K)", "($54K)", "($54K)", "($54K)", "($54K)", "($54K)", "($54K)"], neg: true },
                  { label: "NOI AFTER RESERVES", total: true, values: ["$2.30M", "$2.41M", "$2.49M", "$2.61M", "$2.69M", "$2.77M", "$2.85M"] },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
                    padding: row.total ? "6px 14px" : "4px 14px",
                    borderBottom: "1px solid #1a1d26",
                    background: row.total ? "#111822" : "transparent",
                    fontSize: 10,
                  }}>
                    <span style={{ color: row.noi ? "#4a8cf0" : row.total ? "#eef0f5" : "#6b7280", fontWeight: row.total ? 700 : 400, display: "flex", flexDirection: "column" }}>
                      {row.label}
                      {row.driver && <span style={{ fontSize: 8, color: "#3c4254", fontFamily: "JetBrains Mono" }}>{row.driver}</span>}
                    </span>
                    {row.values.map((v, j) => (
                      <span key={j} style={{
                        textAlign: "right", fontFamily: "JetBrains Mono",
                        fontWeight: row.total ? 600 : 400,
                        color: row.neg ? "#dc2626" : row.noi ? "#4a8cf0" : row.total ? "#eef0f5" : "#9ba3b0",
                      }}>{v}</span>
                    ))}
                  </div>
                ))}

                {/* Debt + CF Section */}
                <div style={{ padding: "6px 14px", background: "#0a0b0f", borderBottom: "1px solid #1a1d26" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", fontFamily: "JetBrains Mono", letterSpacing: ".08em" }}>DEBT SERVICE & RETURNS</span>
                </div>
                {[
                  { label: "Debt Service", driver: "IO → amortizing at Yr 3.5", values: ["($1.90M)", "($1.90M)", "($1.90M)", "($1.95M)", "($1.95M)", "($1.95M)", "($1.95M)"], neg: true },
                  { label: "CASH FLOW TO EQUITY", total: true, pos: true, values: ["$395K", "$513K", "$590K", "$664K", "$744K", "$820K", "$901K"] },
                  { label: "DSCR", metric: true, values: ["1.21x", "1.27x", "1.31x", "1.34x", "1.38x", "1.42x", "1.46x"] },
                  { label: "Cash-on-Cash", metric: true, values: ["1.8%", "2.4%", "2.7%", "3.1%", "3.4%", "3.8%", "4.1%"] },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
                    padding: row.total ? "6px 14px" : "4px 14px",
                    borderBottom: "1px solid #1a1d26",
                    background: row.total ? "#0d1a12" : "transparent",
                    fontSize: 10,
                  }}>
                    <span style={{ color: row.pos ? "#22c55e" : row.total ? "#eef0f5" : row.metric ? "#9ba3b0" : "#6b7280", fontWeight: row.total ? 700 : 400, display: "flex", flexDirection: "column" }}>
                      {row.label}
                      {row.driver && <span style={{ fontSize: 8, color: "#3c4254", fontFamily: "JetBrains Mono" }}>{row.driver}</span>}
                    </span>
                    {row.values.map((v, j) => (
                      <span key={j} style={{
                        textAlign: "right", fontFamily: "JetBrains Mono",
                        fontWeight: row.total ? 600 : 400,
                        color: row.neg ? "#dc2626" : row.pos ? "#22c55e" : row.metric ? "#6b7280" : "#9ba3b0",
                      }}>{v}</span>
                    ))}
                  </div>
                ))}

                {/* Disposition Row */}
                <div style={{ padding: "8px 14px", background: "linear-gradient(90deg, #1e293b, #111822)", borderTop: "2px solid #2563eb" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#2563eb", fontFamily: "JetBrains Mono", letterSpacing: ".08em", marginBottom: 6 }}>DISPOSITION — YEAR 7 EXIT</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, fontSize: 10 }}>
                    <div><span style={{ color: "#6b7280" }}>Exit NOI</span><div style={{ color: "#eef0f5", fontFamily: "JetBrains Mono", fontWeight: 600 }}>$2.91M</div></div>
                    <div><span style={{ color: "#6b7280" }}>Gross Sale @ 5.5% cap</span><div style={{ color: "#eef0f5", fontFamily: "JetBrains Mono", fontWeight: 600 }}>$52.93M</div></div>
                    <div><span style={{ color: "#6b7280" }}>Net Proceeds</span><div style={{ color: "#22c55e", fontFamily: "JetBrains Mono", fontWeight: 600 }}>$15.42M</div></div>
                    <div><span style={{ color: "#6b7280" }}>IRR / EM</span><div style={{ color: "#22c55e", fontFamily: "JetBrains Mono", fontWeight: 700 }}>21.8% / 1.98x</div></div>
                  </div>
                </div>
              </div>

              {/* Phase 2 expansion */}
              <div style={{ marginTop: 14, background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>Phase 2 Expansion: Line Item Detail</div>
                <div style={{ fontSize: 11, color: "#9ba3b0", lineHeight: 1.6 }}>
                  <strong style={{ color: "#eef0f5" }}>Revenue:</strong> 9 floor plan rent roll + 13 ancillary income items (garage, storage, RUBS, cable, valet trash, etc.)<br/>
                  <strong style={{ color: "#eef0f5" }}>Expenses:</strong> 16 categories (R&M, Contract Services, Landscaping, Personnel, Marketing, Admin, Turnover, Water/Sewer, Electric, Insurance, Property Tax, Other)<br/>
                  <strong style={{ color: "#eef0f5" }}>Debt:</strong> Floating rate with SOFR forward curve, refinance toggle, extension tests<br/>
                  <strong style={{ color: "#eef0f5" }}>Monthly:</strong> 144-month granularity matching Creekside's Property CF sheet
                </div>
              </div>
            </div>
          )}

          {activeSection === "excel" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>Excel Export Architecture</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Working financial model with formulas, not a data dump. What LPs and lenders expect.</p>

              {/* Export trigger */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <div style={{ padding: "8px 14px", borderRadius: 6, background: "#22c55e22", border: "1px solid #22c55e44", color: "#22c55e", fontSize: 12, fontWeight: 600 }}>⬇ Download Excel</div>
                <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: "#6b7280" }}>Available on: Projections tab (primary), Top bar (always visible), Compare tab (multi-version export)</div>
              </div>

              {/* 6 Sheets */}
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#3c4254", marginBottom: 8, fontFamily: "JetBrains Mono" }}>WORKBOOK STRUCTURE — 6 SHEETS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {FRAMEWORK.excelExport.sheets.map((sheet, i) => (
                  <div key={i} style={{
                    background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 12,
                    borderLeft: `3px solid ${["#2563eb", "#22c55e", "#3b82f6", "#6b7280", "#f59e0b", "#8b5cf6"][i]}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#eef0f5" }}>Sheet {i + 1}: {sheet.name}</span>
                      {sheet.keyPrinciple && <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, background: "#fef3c7", color: "#92400e" }}>KEY</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {sheet.content.map((item, j) => (
                        <div key={j} style={{ fontSize: 10.5, color: "#9ba3b0", padding: "2px 0" }}>
                          <span style={{ color: "#3c4254", marginRight: 4 }}>•</span>{item}
                        </div>
                      ))}
                    </div>
                    {sheet.keyPrinciple && (
                      <div style={{ marginTop: 6, padding: "4px 8px", background: "#fef3c722", borderRadius: 4, fontSize: 10, color: "#f59e0b" }}>
                        ⚡ {sheet.keyPrinciple}
                      </div>
                    )}
                    {sheet.formulas && (
                      <div style={{ marginTop: 6, padding: 8, background: "#0a0b0f", borderRadius: 4 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "#3c4254", marginBottom: 4 }}>EXAMPLE FORMULAS:</div>
                        {sheet.formulas.map((f, fi) => (
                          <div key={fi} style={{ fontSize: 9.5, color: "#6b7280", fontFamily: "JetBrains Mono", padding: "1px 0" }}>{f}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Color coding */}
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#3c4254", marginBottom: 8, fontFamily: "JetBrains Mono" }}>INSTITUTIONAL COLOR CODING STANDARD</div>
              <div style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { color: "#3b82f6", label: "Blue text", meaning: "Hardcoded inputs — user can change" },
                    { color: "#111827", label: "Black text", meaning: "Formulas & calculations" },
                    { color: "#22c55e", label: "Green text", meaning: "Cross-sheet references" },
                    { color: "#dc2626", label: "Red text", meaning: "External links (if any)" },
                    { color: "#eab308", label: "Yellow fill", meaning: "Key assumptions needing attention" },
                    { color: "#6b7280", label: "Parentheses", meaning: "Negative values — never minus signs" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 3, background: item.color === "#eab308" ? "#fef9c3" : item.color === "#111827" ? "#1e293b" : `${item.color}22`, border: `1px solid ${item.color}66`, flexShrink: 0 }}/>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#eef0f5" }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>{item.meaning}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical implementation */}
              <div style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#eef0f5", marginBottom: 8 }}>Technical Implementation</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 11, color: "#9ba3b0" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#eef0f5", marginBottom: 4 }}>In-App (React Artifact)</div>
                    <div>• SheetJS (xlsx library) for client-side generation</div>
                    <div>• Builds workbook from engine computed data</div>
                    <div>• Formulas as strings in cells</div>
                    <div>• Instant download, no server needed</div>
                    <div>• Good for quick exports</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#eef0f5", marginBottom: 4 }}>Backend (Full Platform)</div>
                    <div>• openpyxl (Python) for institutional-grade models</div>
                    <div>• Named ranges, conditional formatting</div>
                    <div>• DATA TABLE function for sensitivity</div>
                    <div>• LibreOffice recalc for formula verification</div>
                    <div>• Template-based (pre-built .xlsx templates)</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: "6px 10px", background: "#0a0b0f", borderRadius: 4, fontSize: 10, color: "#6b7280" }}>
                  <strong style={{ color: "#f59e0b" }}>Phase 1:</strong> SheetJS client-side export (immediate). <strong style={{ color: "#f59e0b" }}>Phase 2:</strong> openpyxl backend with templates matching Creekside-style institutional formatting.
                </div>
              </div>
            </div>
          )}

          {activeSection === "modules" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>Module Status System</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>From original design — shows which intelligence modules feed into the financial model</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {FRAMEWORK.moduleSystem.modules.map(mod => (
                  <div key={mod.id} style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>{mod.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#eef0f5" }}>{mod.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#9ba3b0", marginBottom: 8 }}>{mod.description}</div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>
                      <strong style={{ color: "#9ba3b0" }}>Fields:</strong> {mod.fields.join(" · ")}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8 }}>
                      <strong style={{ color: "#9ba3b0" }}>Feeds into:</strong> {mod.feedsInto}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {mod.statuses.map(s => (
                        <span key={s} style={{
                          padding: "2px 8px", borderRadius: 99, fontSize: 9, fontWeight: 600,
                          background: s === "live" ? "#dcfce7" : s === "mock" ? "#fef3c7" : "#1e2028",
                          color: s === "live" ? "#166534" : s === "mock" ? "#92400e" : "#6b7280",
                        }}>{s === "live" ? "● Live" : s === "mock" ? "◐ Mock" : "○ None"}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 14, padding: 12,
                background: "#111318", border: "1px solid #1e2028", borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#eef0f5", marginBottom: 6 }}>UI Elements</div>
                <div style={{ fontSize: 11, color: "#9ba3b0" }}>
                  <strong>Pills row:</strong> Clickable module pills with status badges · <strong>Counter:</strong> "3/4 modules feeding the model" · <strong>Drawer:</strong> Expandable grid showing pipeline details · <strong>Refresh button:</strong> Re-checks module connections
                </div>
              </div>
            </div>
          )}

          {activeSection === "versions" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>Version System</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Each version = complete assumption set + engine-computed outputs + optional AI decision</p>

              <div style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#eef0f5", marginBottom: 10 }}>Version Object Structure</div>
                <pre style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#9ba3b0", lineHeight: 1.6 }}>{`{
  id: "abc1234",
  name: "Bear Case — 7% Exit Cap",
  color: "#8b5cf6",
  assumptions: { ...all inputs... },     // ← Claude modifies this
  computed: {                              // ← Engine produces this
    rows: [...yearly projections...],
    metrics: { irr, em, coc, noi, dscr, yoc, exitValue },
    disposition: { exitNOI, grossSale, ... },
    waterfall: { lpTotal, gpTotal, lpIRR, ... },
    equity, loanAmt, totalUses, capex
  },
  decision: {                              // ← AI generates this
    winner: "Freddie Mac 7-Yr",
    conviction: "High",
    rationale: [...], risks: [...], actions: [...]
  },
  scenarios: {                             // ← AI sets assumptions, engine computes
    base: { assumptions, computed },
    best: { assumptions, computed },
    worst: { assumptions, computed }
  },
  createdAt: "2026-03-02T..."
}`}</pre>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ background: "#111318", border: "1px solid #22c55e44", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", marginBottom: 6 }}>Manual Save</div>
                  <div style={{ fontSize: 11, color: "#9ba3b0" }}>User clicks "Save Version" → snapshots current assumptions + computed outputs with custom name</div>
                </div>
                <div style={{ background: "#111318", border: "1px solid #f59e0b44", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>AI-Generated</div>
                  <div style={{ fontSize: 11, color: "#9ba3b0" }}>Claude outputs model_create → engine computes → new version in bar + Compare auto-navigates</div>
                </div>
                <div style={{ background: "#111318", border: "1px solid #3b82f644", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", marginBottom: 6 }}>Loan Switch</div>
                  <div style={{ fontSize: 11, color: "#9ba3b0" }}>Clicking different loan on Debt tab recalculates in-place (same version, different debt)</div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "ai" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>AI Interaction Model</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Claude modifies assumptions — NEVER outputs pre-calculated metrics</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "#111318", border: "1px solid #22c55e44", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", marginBottom: 8 }}>model_update</div>
                  <div style={{ fontSize: 11, color: "#9ba3b0", marginBottom: 8 }}>Modifies the ACTIVE version's assumptions</div>
                  <pre style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#6b7280", background: "#0a0b0f", padding: 8, borderRadius: 4, lineHeight: 1.5 }}>{`\`\`\`model_update
{
  "changes": {
    "exitCapRate": 0.06,
    "holdYears": 5
  }
}
\`\`\``}</pre>
                </div>
                <div style={{ background: "#111318", border: "1px solid #8b5cf644", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6", marginBottom: 8 }}>model_create</div>
                  <div style={{ fontSize: 11, color: "#9ba3b0", marginBottom: 8 }}>Creates a NEW version with different assumptions</div>
                  <pre style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#6b7280", background: "#0a0b0f", padding: 8, borderRadius: 4, lineHeight: 1.5 }}>{`\`\`\`model_create
{
  "name": "Bear Case — 7% Cap",
  "changes": {
    "exitCapRate": 0.07,
    "rentGrowth": [0.02, 0.02, ...],
    "vacancyRate": [0.08, 0.07, ...]
  }
}
\`\`\``}</pre>
                </div>
              </div>

              <div style={{ marginTop: 14, background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#eef0f5", marginBottom: 8 }}>Status Chips (below AI messages)</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: "JetBrains Mono", background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)", color: "#4ade80" }}>✓ Model updated</span>
                  <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: "JetBrains Mono", background: "rgba(139,92,246,.1)", border: "1px solid rgba(139,92,246,.3)", color: "#a78bfa" }}>⊕ "Bear Case" — IRR 22.4% | EM 5.20x</span>
                  <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: "JetBrains Mono", background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.25)", color: "#60a5fa" }}>Recalculated: IRR 22.4%</span>
                </div>
              </div>

              <div style={{ marginTop: 14, background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#eef0f5", marginBottom: 8 }}>Quick Prompts</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {FRAMEWORK.aiInteraction.quickPrompts.map(p => (
                    <span key={p} style={{
                      padding: "4px 9px", borderRadius: 4, fontSize: 10,
                      border: "1px solid #1e2028", background: "#0a0b0f", color: "#6b7280",
                    }}>{p}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === "layout" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>Layout Structure</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Two-panel layout: dark chat (left) + light model (right)</p>

              <div style={{ display: "flex", gap: 14, height: 500 }}>
                {/* Chat mock */}
                <div style={{
                  width: 200, background: "#0e1017", border: "1px solid #1e2028", borderRadius: 8,
                  display: "flex", flexDirection: "column", fontSize: 9, color: "#6b7280",
                }}>
                  <div style={{ padding: 10, borderBottom: "1px solid #1a1d26", fontWeight: 700, color: "#f59e0b" }}>JEDI RE · Chat Panel</div>
                  <div style={{ padding: 8, borderBottom: "1px solid #1a1d26", fontSize: 8, fontFamily: "JetBrains Mono" }}>Context: Property · Version · IRR</div>
                  <div style={{ flex: 1, padding: 8 }}>Message Feed (scrollable)</div>
                  <div style={{ padding: 8, borderTop: "1px solid #1a1d26" }}>Quick Prompts</div>
                  <div style={{ padding: 8, borderTop: "1px solid #1a1d26" }}>Input + Send</div>
                </div>

                {/* Model mock */}
                <div style={{
                  flex: 1, background: "#16181f", border: "1px solid #1e2028", borderRadius: 8,
                  display: "flex", flexDirection: "column", fontSize: 9, color: "#6b7280",
                }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #1a1d26", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, color: "#eef0f5" }}>JEDI RE · Property / Financial Model</span>
                    <span>Save Version · Compare All</span>
                  </div>
                  <div style={{ padding: 8, borderBottom: "1px solid #1a1d26", background: "#111318" }}>
                    <span style={{ color: "#4a8cf0", fontFamily: "JetBrains Mono", fontSize: 8, fontWeight: 700, letterSpacing: ".1em" }}>FINANCIAL MODULE — COMPUTATION ENGINE</span>
                    <div style={{ color: "#eef0f5", fontSize: 11, fontWeight: 700, marginTop: 2 }}>Assumptions → Engine → Outputs</div>
                  </div>
                  <div style={{ padding: 6, borderBottom: "1px solid #1a1d26", display: "flex", gap: 4 }}>
                    {["Strategy ◐", "Traffic ○", "Pro Forma ●", "Debt ●"].map(m => (
                      <span key={m} style={{ padding: "2px 6px", borderRadius: 10, fontSize: 8, border: "1px solid #1e2028" }}>{m}</span>
                    ))}
                    <span style={{ marginLeft: "auto", fontSize: 8 }}>3/4 modules · ↻ Refresh</span>
                  </div>
                  <div style={{ padding: 6, borderBottom: "1px solid #1a1d26", fontSize: 8, color: "#3c4254" }}>
                    Module Drawer (expandable) — 4-card pipeline grid
                  </div>
                  <div style={{ padding: 6, borderBottom: "1px solid #1a1d26", display: "flex", gap: 4 }}>
                    {["● Base Case", "● Bear Case", "+ Ask JEDI"].map(v => (
                      <span key={v} style={{ padding: "2px 6px", borderRadius: 4, fontSize: 8, border: "1px solid #1e2028" }}>{v}</span>
                    ))}
                  </div>
                  <div style={{ padding: 6, borderBottom: "1px solid #1a1d26", display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {FRAMEWORK.tabs.map(t => (
                      <span key={t.key} style={{
                        padding: "3px 6px", fontSize: 8, fontWeight: 600,
                        borderBottom: t.key === "overview" ? "2px solid #eef0f5" : "2px solid transparent",
                        color: t.key === "overview" ? "#eef0f5" : "#6b7280",
                      }}>{t.icon} {t.label}</span>
                    ))}
                  </div>
                  <div style={{ flex: 1, padding: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#3c4254" }}>
                    Active Tab Content (scrollable)
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "parity" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>Creekside Proforma Parity</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>What the engine matches from the 91K-formula institutional model vs what's deferred</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "#111318", border: "1px solid #22c55e44", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", marginBottom: 10 }}>✅ Achieved (Phase 1)</div>
                  {FRAMEWORK.creeksideParity.achieved.map(item => (
                    <div key={item} style={{ padding: "4px 0", fontSize: 11, color: "#9ba3b0", borderBottom: "1px solid #1a1d26" }}>{item}</div>
                  ))}
                </div>
                <div style={{ background: "#111318", border: "1px solid #dc262644", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 10 }}>❌ Not Yet (Phase 2+)</div>
                  {FRAMEWORK.creeksideParity.notYet.map(item => (
                    <div key={item} style={{ padding: "4px 0", fontSize: 11, color: "#9ba3b0", borderBottom: "1px solid #1a1d26" }}>{item}</div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 14, background: "#111318", border: "1px solid #f59e0b44", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 10 }}>Phase 2 Priority Order</div>
                {FRAMEWORK.creeksideParity.phase2Priority.map(item => (
                  <div key={item} style={{ padding: "4px 0", fontSize: 11, color: "#9ba3b0", borderBottom: "1px solid #1a1d26" }}>{item}</div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "questions" && (
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, color: "#eef0f5", marginBottom: 4 }}>Open Questions</h2>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Decisions needed before finalizing code</p>

              {FRAMEWORK.openQuestions.map((q, i) => (
                <div key={i} style={{
                  background: "#111318", border: "1px solid #1e2028", borderRadius: 8, padding: 14,
                  marginBottom: 12, borderLeft: "3px solid #f59e0b",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#eef0f5", marginBottom: 6 }}>Q{i + 1}: {q.question}</div>
                  <div style={{ fontSize: 11, color: "#22c55e", marginBottom: 4 }}>
                    <strong>Recommendation:</strong> {q.recommendation}
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>
                    <strong>Impact:</strong> {q.impact}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
