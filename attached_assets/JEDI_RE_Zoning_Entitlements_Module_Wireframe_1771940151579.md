# JEDI RE — ZONING & ENTITLEMENTS MODULE
## Complete Wireframe & Implementation Guide

---

## MODULE IDENTITY

**Module Name:** Zoning & Entitlements Intelligence  
**Agent Owner:** Zoning Agent (specialist under Development Feasibility)  
**Signal Output:** Supply Signal (entitled land = ready supply), Risk Signal (regulatory environment)  
**Deal Capsule Integration:** Section 3 — Regulatory & Land Use  
**Map Layer:** Zoning Districts overlay, Entitlement Status pins, Rezone Opportunity heatmap  

---

## PAGE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ZONING & ENTITLEMENTS MODULE — PAGE STRUCTURE                                          │
│                                                                                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐│
│  │  ZONING    │ │ ENTITLE-   │ │ DEV        │ │ REGULATORY │ │ ZONING     │ │ TIME-TO-   ││
│  │  LOOKUP    │ │ MENT       │ │ CAPACITY   │ │ RISK       │ │ COMPARATOR │ │ SHOVEL     ││
│  │  (Tab 1)   │ │ TRACKER(2) │ │ (Tab 3)    │ │ (Tab 4)    │ │ (Tab 5)    │ │ (Tab 6)    ││
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘│
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         MAIN CONTENT AREA                                           │ │
│  │                                                                                     │ │
│  │   Left Panel (40%)              │        Right Panel / Map (60%)                    │ │
│  │   ─────────────────             │        ───────────────────────                    │ │
│  │   Zoning detail cards,          │        Parcel map with zoning                     │ │
│  │   entitlement timelines,        │        overlays, 3D envelope,                     │ │
│  │   regulatory checklists,        │        district boundaries,                       │ │
│  │   AI interpretation             │        comp parcels highlighted                   │ │
│  │                                 │                                                   │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  BOTTOM DRAWER — AI Chat / Zoning Agent                                             │ │
│  │  "What can I build on this parcel?" / "Compare R-3 vs MRC-3 density"                │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## TAB 1: ZONING LOOKUP

### Purpose
Instant zoning intelligence for any parcel. User clicks a parcel on the map or enters an address — the Zoning Agent returns a complete regulatory profile with AI-interpreted development constraints.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  TAB 1: ZONING LOOKUP                                                                   │
│                                                                                         │
│  ┌─── LEFT PANEL (40%) ────────────────────────┐  ┌─── MAP PANEL (60%) ──────────────┐ │
│  │                                              │  │                                  │ │
│  │  ┌────────────────────────────────────────┐  │  │   ┌──────────────────────────┐   │ │
│  │  │ 🔍 Search: [847 Peachtree St NE, ATL] │  │  │   │                          │   │ │
│  │  │     or click parcel on map →           │  │  │   │    PARCEL MAP VIEW       │   │ │
│  │  └────────────────────────────────────────┘  │  │   │                          │   │ │
│  │                                              │  │   │   ┌──────────┐           │   │ │
│  │  ┌────────────────────────────────────────┐  │  │   │   │ SELECTED │           │   │ │
│  │  │  ZONING CLASSIFICATION                 │  │  │   │   │ PARCEL   │           │   │ │
│  │  │  ════════════════════                  │  │  │   │   │ (blue    │           │   │ │
│  │  │                                        │  │  │   │   │  outline)│           │   │ │
│  │  │  District:     MRC-3                   │  │  │   │   └──────────┘           │   │ │
│  │  │  Full Name:    Mixed Residential       │  │  │   │                          │   │ │
│  │  │               Commercial - 3           │  │  │   │   Zoning districts shown │   │ │
│  │  │  Municipality: City of Atlanta         │  │  │   │   as colored overlays:   │   │ │
│  │  │  Last Amended: 2023-08-14              │  │  │   │   🟦 Residential          │   │ │
│  │  │  Zoning Code:  §16-18A.007            │  │  │   │   🟧 Commercial           │   │ │
│  │  │                                        │  │  │   │   🟪 Mixed-Use            │   │ │
│  │  │  [📄 View Full Code]  [🤖 AI Summary]  │  │  │   │   🟩 Industrial           │   │ │
│  │  └────────────────────────────────────────┘  │  │   │   🟥 Special District     │   │ │
│  │                                              │  │   │                          │   │ │
│  │  ┌────────────────────────────────────────┐  │  │   │   Layer toggles:         │   │ │
│  │  │  DEVELOPMENT PARAMETERS                │  │  │   │   ☑ Zoning Districts     │   │ │
│  │  │  ══════════════════════                │  │  │   │   ☑ Parcel Boundaries    │   │ │
│  │  │                                        │  │  │   │   ☐ Flood Zones          │   │ │
│  │  │  Max Density:       109 units/acre     │  │  │   │   ☐ Historic Districts   │   │ │
│  │  │  Max Height:        225 ft (≈20 flrs)  │  │  │   │   ☐ Overlay Districts    │   │ │
│  │  │  Max FAR:           3.2                │  │  │   │   ☐ 3D Envelope          │   │ │
│  │  │  Max Lot Coverage:  85%                │  │  │   └──────────────────────────┘   │ │
│  │  │  Min Open Space:    15%                │  │  │                                  │ │
│  │  │                                        │  │  │   ┌──────────────────────────┐   │ │
│  │  │  SETBACKS                              │  │  │   │  3D BUILDABLE ENVELOPE   │   │ │
│  │  │  ┌────────┬────────┬────────┐          │  │  │   │  (toggle on)             │   │ │
│  │  │  │ Front  │ Side   │ Rear   │          │  │  │   │                          │   │ │
│  │  │  │ 0 ft   │ 10 ft  │ 20 ft  │          │  │  │   │   ┌─────────────┐       │   │ │
│  │  │  └────────┴────────┴────────┘          │  │  │   │   │ ╱─────────╲ │ 225ft  │   │ │
│  │  │                                        │  │  │   │   │╱           ╲│ max    │   │ │
│  │  │  PARKING REQUIREMENTS                  │  │  │   │   │             │        │   │ │
│  │  │  Residential: 1.0 space/unit           │  │  │   │   │  BUILDABLE  │        │   │ │
│  │  │  Guest:       0.25 space/unit          │  │  │   │   │   VOLUME    │        │   │ │
│  │  │  Commercial:  3.0 per 1,000 SF         │  │  │   │   │             │        │   │ │
│  │  │  Bicycle:     1 per 4 units            │  │  │   │   │─────────────│        │   │ │
│  │  │                                        │  │  │   │   │  setbacks   │        │   │ │
│  │  │  💡 AI Note: Parking reduction of      │  │  │   │   └─────────────┘        │   │ │
│  │  │  20% available within 0.5mi of         │  │  │   │                          │   │ │
│  │  │  MARTA station (§16-18A.024)           │  │  │   │  [Rotate] [Shadow Study] │   │ │
│  │  └────────────────────────────────────────┘  │  │   └──────────────────────────┘   │ │
│  │                                              │  │                                  │ │
│  │  ┌────────────────────────────────────────┐  │  └──────────────────────────────────┘ │
│  │  │  PERMITTED USES                        │  │                                      │
│  │  │  ═══════════════                       │  │                                      │
│  │  │                                        │  │                                      │
│  │  │  BY-RIGHT ✅                           │  │                                      │
│  │  │  • Multi-family residential            │  │                                      │
│  │  │  • Live-work units                     │  │                                      │
│  │  │  • Retail (ground floor)               │  │                                      │
│  │  │  • Restaurant                          │  │                                      │
│  │  │  • Office                              │  │                                      │
│  │  │  • Hotel/boutique lodging              │  │                                      │
│  │  │                                        │  │                                      │
│  │  │  CONDITIONAL USE (CUP required) ⚠️     │  │                                      │
│  │  │  • Drive-through                       │  │                                      │
│  │  │  • Gas station                         │  │                                      │
│  │  │  • Outdoor entertainment               │  │                                      │
│  │  │                                        │  │                                      │
│  │  │  PROHIBITED ❌                         │  │                                      │
│  │  │  • Self-storage                        │  │                                      │
│  │  │  • Industrial manufacturing            │  │                                      │
│  │  │  • Auto repair/sales                   │  │                                      │
│  │  │                                        │  │                                      │
│  │  │  STRATEGY ALIGNMENT                    │  │                                      │
│  │  │  ┌──────────┬────────────────────────┐ │  │                                      │
│  │  │  │ BTS      │ ✅ By-right, 245 units │ │  │                                      │
│  │  │  │ Flip     │ ✅ Residential OK      │ │  │                                      │
│  │  │  │ Rental   │ ✅ Multi-family OK     │ │  │                                      │
│  │  │  │ STR      │ ⚠️ Check STR overlay   │ │  │                                      │
│  │  │  └──────────┴────────────────────────┘ │  │                                      │
│  │  └────────────────────────────────────────┘  │                                      │
│  │                                              │                                      │
│  │  ┌────────────────────────────────────────┐  │                                      │
│  │  │  BY-RIGHT vs VARIANCE POTENTIAL        │  │                                      │
│  │  │  ═══════════════════════════════       │  │                                      │
│  │  │                                        │  │                                      │
│  │  │  By-Right:   245 units │ ██████████░░ │  │                                      │
│  │  │  Variance:   320 units │ █████████████ │  │                                      │
│  │  │  Delta:      +75 units (+30.6%)        │  │                                      │
│  │  │                                        │  │                                      │
│  │  │  Variance Path: SAP Approval           │  │                                      │
│  │  │  Est. Timeline: 6-9 months             │  │                                      │
│  │  │  Est. Cost:     $85,000-$120,000       │  │                                      │
│  │  │  Success Rate:  72% (local historical) │  │                                      │
│  │  │                                        │  │                                      │
│  │  │  💡 AI Recommendation:                 │  │                                      │
│  │  │  "Variance pursuit justified. 75       │  │                                      │
│  │  │  additional units at $280k/unit =      │  │                                      │
│  │  │  $21M incremental value vs $120k       │  │                                      │
│  │  │  entitlement cost. ROI: 175x."         │  │                                      │
│  │  │                                        │  │                                      │
│  │  │  [📎 Attach to Deal Capsule]           │  │                                      │
│  │  │  [📊 Run Dev Feasibility with 320u]    │  │                                      │
│  │  └────────────────────────────────────────┘  │                                      │
│  └──────────────────────────────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## TAB 2: ENTITLEMENT TRACKER

### Purpose
Pipeline view of all entitlements across the user's portfolio and pipeline deals. Tracks every entitlement from application through approval — tied to Deal Capsule stages.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  TAB 2: ENTITLEMENT TRACKER                                                             │
│                                                                                         │
│  ┌─── FILTER BAR ──────────────────────────────────────────────────────────────────────┐│
│  │ Market: [All ▾]  Status: [All ▾]  Type: [All ▾]  Deal: [All ▾]  Sort: [Due Date ▾] ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── KANBAN VIEW ─────────────────────────────────────────────────────────────────────┐│
│  │                                                                                     ││
│  │  PRE-APP          SUBMITTED        UNDER REVIEW      HEARING          APPROVED      ││
│  │  ═══════          ═════════        ════════════      ═══════          ════════       ││
│  │                                                                                     ││
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      ││
│  │  │847       │    │220       │    │1500      │    │400       │    │950       │      ││
│  │  │Peachtree │    │Ponce     │    │Northside │    │Memorial  │    │Marietta  │      ││
│  │  │──────────│    │──────────│    │──────────│    │──────────│    │──────────│      ││
│  │  │Rezone    │    │Variance  │    │CUP       │    │SAP       │    │Rezone    │      ││
│  │  │MRC-3→MRC│    │Height +  │    │Drive-thru│    │Density   │    │C-2→MU-3 │      ││
│  │  │-4       │    │25ft      │    │addition  │    │Bonus     │    │          │      ││
│  │  │──────────│    │──────────│    │──────────│    │──────────│    │──────────│      ││
│  │  │Due: 45d  │    │Due: 12d  │    │Due: 30d  │    │Mar 15    │    │✅ 2/10   │      ││
│  │  │Risk: Low │    │Risk: Med │    │Risk: Low │    │Risk: High│    │          │      ││
│  │  │🔗 Deal #│    │🔗 Deal #│    │🔗 Deal #│    │🔗 Deal #│    │🔗 Deal # │      ││
│  │  │  047     │    │  051     │    │  039     │    │  044     │    │  032     │      ││
│  │  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘      ││
│  │                                                                                     ││
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐                                      ││
│  │  │600       │    │3200      │    │780       │                                      ││
│  │  │Piedmont  │    │Buford    │    │Spring    │                                      ││
│  │  │──────────│    │──────────│    │──────────│                                      ││
│  │  │Site Plan │    │Annexation│    │Lot Split │                                      ││
│  │  │Review    │    │+ Rezone  │    │+ Replat  │                                      ││
│  │  │──────────│    │──────────│    │──────────│                                      ││
│  │  │Due: 60d  │    │Due: 90d  │    │Due: 22d  │                                      ││
│  │  │Risk: Low │    │Risk: High│    │Risk: Low │                                      ││
│  │  └──────────┘    └──────────┘    └──────────┘                                      ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── EXPANDED ENTITLEMENT DETAIL (click any card) ────────────────────────────────────┐│
│  │                                                                                     ││
│  │  847 Peachtree — Rezone MRC-3 → MRC-4                                               ││
│  │  ═══════════════════════════════════════                                             ││
│  │                                                                                     ││
│  │  TIMELINE                                                                           ││
│  │  ──────────────────────────────────────────────────────────────────────────          ││
│  │  ●──────────●──────────●──────────○──────────○──────────○──────────○                ││
│  │  Pre-App    NPU        Zoning     BZA        City       Final      Record           ││
│  │  Meeting    Review     Review     Hearing    Council    Approval                    ││
│  │  ✅ 1/15    ✅ 1/28    🔄 NOW     ⏳ 3/15    ⏳ 4/10    ⏳ 4/25    ⏳ 5/01          ││
│  │                                                                                     ││
│  │  DOCUMENTS                           CONTACTS                                       ││
│  │  ───────────                         ────────                                       ││
│  │  📄 Application (filed 1/10)         👤 Zoning Attorney: Smith & Assoc              ││
│  │  📄 Site Plan (rev 3)                👤 City Planner: J. Rodriguez                  ││
│  │  📄 Traffic Study                    👤 NPU Chair: M. Thompson                      ││
│  │  📄 Community Impact Letter          👤 Council Rep: A. Dickens (D3)                ││
│  │  📄 NPU Meeting Minutes                                                             ││
│  │                                                                                     ││
│  │  AI RISK ASSESSMENT                                                                 ││
│  │  ──────────────────                                                                 ││
│  │  Entitlement Risk Score: 34/100 (LOW) 🟢                                            ││
│  │                                                                                     ││
│  │  ✅ NPU support letter obtained                                                     ││
│  │  ✅ Traffic study shows no material impact                                           ││
│  │  ✅ Consistent with city comprehensive plan                                         ││
│  │  ⚠️ Adjacent parcel owner filed objection — monitor                                 ││
│  │  ✅ Council member informally supportive                                             ││
│  │                                                                                     ││
│  │  News Intelligence: 2 related articles detected                                     ││
│  │  • "Midtown density debate heats up" — AJC (2/18)                                   ││
│  │  • "Atlanta planning commission approves new density guidelines" (2/5)               ││
│  │                                                                                     ││
│  │  [📎 Open Deal Capsule #047]  [📊 Financial Impact Analysis]  [📧 Share Update]     ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## TAB 3: DEVELOPMENT CAPACITY ANALYSIS

### Purpose
Answers the fundamental question: "What's the MAXIMUM I can build here?" Shows by-right capacity, variance/rezone upside, and the financial delta between them. Feeds directly into the Development Feasibility module and Strategy Arbitrage engine.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  TAB 3: DEVELOPMENT CAPACITY                                                            │
│                                                                                         │
│  ┌─── PARCEL SELECTOR ─────────────────────────────────────────────────────────────────┐│
│  │  Parcel: 847 Peachtree NE  │  Lot: 2.25 acres (98,010 SF)  │  Current: MRC-3       ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── CAPACITY COMPARISON MATRIX ──────────────────────────────────────────────────────┐│
│  │                                                                                     ││
│  │              CURRENT ZONING        VARIANCE PATH       REZONE PATH                  ││
│  │              (MRC-3, by-right)     (MRC-3 + SAP)       (→ MRC-4)                    ││
│  │  ──────────  ──────────────────    ───────────────     ─────────────                 ││
│  │  Max Units        245                  320                 480                       ││
│  │  Max Height       225 ft               225 ft              300 ft                    ││
│  │  Max FAR          3.2                  3.2                 4.8                       ││
│  │  Max GFA          313,632 SF           313,632 SF          470,448 SF               ││
│  │  Parking Req      245 + 61 guest       320 + 80 guest      384 + 96 guest*          ││
│  │  Open Space       14,702 SF            14,702 SF           14,702 SF                ││
│  │  ──────────  ──────────────────    ───────────────     ─────────────                 ││
│  │  Timeline         0 months             6-9 months          12-18 months             ││
│  │  Cost             $0                   $85-120k            $200-350k                 ││
│  │  Risk             None                 Low-Med             Medium                    ││
│  │  Success %        100%                 72%                 58%                       ││
│  │  ──────────  ──────────────────    ───────────────     ─────────────                 ││
│  │  Est. Value       $68.6M               $89.6M              $134.4M                  ││
│  │  (at $280k/u)                                                                       ││
│  │  ──────────  ──────────────────    ───────────────     ─────────────                 ││
│  │  Delta vs         baseline             +$21.0M             +$65.8M                  ││
│  │  By-Right                              (+30.6%)            (+95.9%)                  ││
│  │                                                                                     ││
│  │  * Parking reduction of 20% applied (MARTA proximity)                               ││
│  │                                                                                     ││
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐   ││
│  │  │  AI RECOMMENDATION                                                          │   ││
│  │  │                                                                              │   ││
│  │  │  🤖 "Pursue Variance (SAP) path first. Low cost ($120k) for high return     │   ││
│  │  │  ($21M). If denied, rezone application can reference the SAP attempt as      │   ││
│  │  │  evidence of community engagement. Sequencing: SAP first → Rezone if         │   ││
│  │  │  needed reduces total entitlement risk by 40%."                              │   ││
│  │  │                                                                              │   ││
│  │  │  Confidence: 87%  │  Based on: 23 comparable rezones (2022-2025, Midtown)    │   ││
│  │  └──────────────────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── STRATEGY ARBITRAGE IMPACT ───────────────────────────────────────────────────────┐│
│  │                                                                                     ││
│  │  How does zoning capacity affect each strategy?                                     ││
│  │                                                                                     ││
│  │  BUILD-TO-SELL                                                                      ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐        ││
│  │  │ By-Right (245u): IRR 18.2%  │  Variance (320u): IRR 22.7%  │          │        ││
│  │  │ Rezone (480u):   IRR 26.1%  │  🏆 Best strategy for rezone path       │        ││
│  │  └─────────────────────────────────────────────────────────────────────────┘        ││
│  │                                                                                     ││
│  │  RENTAL (Hold)                                                                      ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐        ││
│  │  │ By-Right (245u): Cap Rate 5.1%  │  Variance (320u): Cap Rate 5.4%  │  │        ││
│  │  │ Rezone (480u):   Cap Rate 5.8%  │  🏆 Best long-term yield             │        ││
│  │  └─────────────────────────────────────────────────────────────────────────┘        ││
│  │                                                                                     ││
│  │  FLIP (not applicable — ground-up development site)                                 ││
│  │  STR  (not applicable — zoning district restricts STR licensing)                    ││
│  │                                                                                     ││
│  │  [📊 Full Strategy Arbitrage Report]  [📎 Attach to Deal Capsule]                   ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## TAB 4: REGULATORY RISK INTELLIGENCE

### Purpose
Aggregates all regulatory risk factors — zoning changes, moratoriums, rent control, STR restrictions, impact fees, inclusionary housing requirements — into a single risk dashboard. Feeds the Risk Signal in the JEDI Score.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  TAB 4: REGULATORY RISK INTELLIGENCE                                                    │
│                                                                                         │
│  ┌─── MARKET SELECTOR ─────────────────────────────────────────────────────────────────┐│
│  │  Market: [Atlanta Metro ▾]  │  Jurisdiction: [City of Atlanta ▾]  │  [+ Add Market] ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── REGULATORY RISK DASHBOARD ───────────────────────────────────────────────────────┐│
│  │                                                                                     ││
│  │  JURISDICTION RISK SCORE: 42/100 (MODERATE) 🟡                                      ││
│  │                                                                                     ││
│  │  ┌──────────────────────────────────────────────────────────────────────┐            ││
│  │  │                                                                      │            ││
│  │  │  RISK CATEGORY          SCORE    TREND     IMPACT ON STRATEGY        │            ││
│  │  │  ──────────────────     ─────    ─────     ──────────────────        │            ││
│  │  │  Zoning Stability       28 🟢    →         Low rezone rejection      │            ││
│  │  │  Permit Timeline        55 🟡    ↑         Avg 14mo for MF permits   │            ││
│  │  │  Impact Fees            62 🟠    ↑↑        $8,200/unit (up 22% YoY)  │            ││
│  │  │  Inclusionary Req       35 🟢    →         15% AMI units required    │            ││
│  │  │  Rent Control Risk      15 🟢    →         No state preemption risk  │            ││
│  │  │  STR Regulation         72 🟠    ↑         License cap in 5 wards    │            ││
│  │  │  Environmental          44 🟡    →         Standard NEPA + Phase I   │            ││
│  │  │  Historic Preservation  38 🟢    →         Not in historic district  │            ││
│  │  │                                                                      │            ││
│  │  └──────────────────────────────────────────────────────────────────────┘            ││
│  │                                                                                     ││
│  │  ┌─── ACTIVE REGULATORY ALERTS ─────────────────────────────────────────┐           ││
│  │  │                                                                      │           ││
│  │  │  🔴 URGENT                                                           │           ││
│  │  │  City Council Vote 3/5: Proposed STR moratorium in Midtown/VaHi     │           ││
│  │  │  Impact: Would block all new STR licenses for 12 months             │           ││
│  │  │  Probability: 65%  │  Source: News Agent + Council agenda            │           ││
│  │  │  Affected Deals: #044, #051                                          │           ││
│  │  │                                                                      │           ││
│  │  │  🟡 WATCH                                                            │           ││
│  │  │  Planning Commission reviewing density bonus update (Q2 2026)       │           ││
│  │  │  Impact: Could increase by-right density 15% in transit corridors   │           ││
│  │  │  Probability: 40%  │  Source: News Agent + Planning docs             │           ││
│  │  │  Affected Deals: #047, #032                                          │           ││
│  │  │                                                                      │           ││
│  │  │  🟡 WATCH                                                            │           ││
│  │  │  Impact fee increase proposed for 2027 budget cycle                  │           ││
│  │  │  Impact: Est. +$2,400/unit for MF development                       │           ││
│  │  │  Probability: 55%  │  Source: Budget committee minutes               │           ││
│  │  │  Affected Deals: All pipeline                                        │           ││
│  │  │                                                                      │           ││
│  │  │  🟢 OPPORTUNITY                                                      │           ││
│  │  │  Affordable housing density bonus expansion under review             │           ││
│  │  │  Impact: 20% density bonus for 10% AMI units (currently 15%)        │           ││
│  │  │  Probability: 70%  │  Source: Housing authority + News Agent          │           ││
│  │  │                                                                      │           ││
│  │  └──────────────────────────────────────────────────────────────────────┘           ││
│  │                                                                                     ││
│  │  ┌─── STRATEGY-SPECIFIC REGULATORY MATRIX ──────────────────────────────┐           ││
│  │  │                                                                      │           ││
│  │  │  How does this jurisdiction's regulatory environment affect each      │           ││
│  │  │  investment strategy?                                                │           ││
│  │  │                                                                      │           ││
│  │  │  BTS     🟢 Favorable — streamlined site plan review for >200 units  │           ││
│  │  │  Flip    🟢 Favorable — fast permit turnaround for SFR renovations   │           ││
│  │  │  Rental  🟡 Moderate  — inclusionary req adds $1.2M to 245-unit dev  │           ││
│  │  │  STR     🟠 Elevated  — pending moratorium + license caps            │           ││
│  │  │                                                                      │           ││
│  │  └──────────────────────────────────────────────────────────────────────┘           ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## TAB 5: ZONING COMPARATOR

### Purpose
Side-by-side comparison of zoning districts, parcels, or jurisdictions. Essential for investors evaluating multiple sites or considering where to deploy capital based on regulatory favorability.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  TAB 5: ZONING COMPARATOR                                                               │
│                                                                                         │
│  ┌─── COMPARISON MODE ─────────────────────────────────────────────────────────────────┐│
│  │  Mode: (●) District vs District  ( ) Parcel vs Parcel  ( ) Jurisdiction vs Juris.   ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── SIDE-BY-SIDE COMPARISON ─────────────────────────────────────────────────────────┐│
│  │                                                                                     ││
│  │  DISTRICT A: MRC-3               │  DISTRICT B: MRC-4              │  DELTA         ││
│  │  (Mixed Res Commercial 3)        │  (Mixed Res Commercial 4)      │                 ││
│  │  ════════════════════════         │  ════════════════════════      │  ═══════        ││
│  │                                   │                                │                 ││
│  │  Max Density:  109 units/acre     │  Max Density:  185 units/acre  │  +69.7%        ││
│  │  Max Height:   225 ft             │  Max Height:   300 ft          │  +75 ft        ││
│  │  Max FAR:      3.2                │  Max FAR:      4.8             │  +50.0%        ││
│  │  Lot Coverage: 85%                │  Lot Coverage: 90%             │  +5.0%         ││
│  │  Open Space:   15%                │  Open Space:   10%             │  -5.0%         ││
│  │                                   │                                │                 ││
│  │  SETBACKS                         │  SETBACKS                      │                 ││
│  │  Front: 0 ft                      │  Front: 0 ft                   │  —             ││
│  │  Side:  10 ft                     │  Side:  5 ft                   │  -5 ft         ││
│  │  Rear:  20 ft                     │  Rear:  10 ft                  │  -10 ft        ││
│  │                                   │                                │                 ││
│  │  PARKING                          │  PARKING                       │                 ││
│  │  1.0/unit + 0.25 guest            │  0.75/unit + 0.20 guest        │  -25%          ││
│  │                                   │                                │                 ││
│  │  PERMITTED USES (differences)     │  PERMITTED USES (differences)  │                 ││
│  │  Hotel: By-right                  │  Hotel: By-right               │  Same          ││
│  │  Drive-thru: CUP                  │  Drive-thru: Prohibited        │  Stricter      ││
│  │  Nightclub: Prohibited            │  Nightclub: CUP                │  More flex     ││
│  │                                   │                                │                 ││
│  │  ──────────────────────────────────────────────────────────────────────────          ││
│  │                                                                                     ││
│  │  ON A 2.25-ACRE SITE:                                                               ││
│  │                                   │                                │                 ││
│  │  Max Units:    245                │  Max Units:    416              │  +171 units    ││
│  │  Est. Value:   $68.6M             │  Est. Value:   $116.5M         │  +$47.9M       ││
│  │  Parking Req:  306 spaces         │  Parking Req:  395 spaces      │  +89 spaces    ││
│  │  Parking Cost: $9.2M              │  Parking Cost: $11.9M          │  +$2.7M        ││
│  │  Net Delta:                       │                                │  +$45.2M       ││
│  │                                                                                     ││
│  │  💡 AI: "MRC-4 delivers 70% more units but only 29% more parking cost.              ││
│  │  The density premium justifies the rezone effort for sites > 1 acre."               ││
│  │                                                                                     ││
│  │  [📊 Export Comparison]  [📎 Attach to Deal]  [🗺️ Show Both on Map]                 ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## TAB 6: TIME-TO-SHOVEL INTELLIGENCE

### Purpose
The killer feature: scrapes municipal permit and planning databases for **actual historical processing times** by entitlement type, jurisdiction, and project scale — then assembles a predictive Gantt timeline from today → shovel in the ground → certificate of occupancy. This drives the entire deal's financial model: carrying costs, interest accrual, opportunity cost, and investor timeline expectations.

### Data Collection Engine

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  MUNICIPAL TIMELINE INTELLIGENCE ENGINE                                                  │
│                                                                                         │
│  HOW IT WORKS:                                                                          │
│  ═════════════                                                                          │
│                                                                                         │
│  1. SCRAPE — Zoning Agent crawls municipal planning/permit portals for:                  │
│     • Every rezone application filed in last 5 years → filed date, decision date         │
│     • Every variance/CUP application → filed date, hearing date, decision date           │
│     • Every site plan review → submission date, revision cycles, approval date           │
│     • Every building permit → application date, plan review cycles, issue date           │
│     • Every certificate of occupancy → applied date, inspection cycles, issue date       │
│                                                                                         │
│  2. CLASSIFY — Each record tagged by:                                                    │
│     • Entitlement type (rezone, variance, CUP, site plan, building permit, CO)           │
│     • Project scale (units: <10, 10-50, 50-200, 200+)                                   │
│     • Zoning district (from → to, for rezones)                                           │
│     • Jurisdiction + department                                                          │
│     • Outcome (approved, denied, withdrawn, modified)                                    │
│     • Complexity flags (EIS required, historic review, community opposition)              │
│                                                                                         │
│  3. COMPUTE — Statistical model generates:                                               │
│     • Median processing time per step (P50)                                              │
│     • Optimistic estimate (P25)                                                          │
│     • Conservative estimate (P75)                                                        │
│     • Worst-case (P90)                                                                   │
│     • Rejection/revision cycle probability + added time                                  │
│     • Seasonal patterns (holiday slowdowns, fiscal year-end rushes)                       │
│                                                                                         │
│  4. PREDICT — For a specific deal, chain all required steps into a Gantt:                │
│     • Pre-application → Entitlement(s) → Site Plan → Building Permit → CO                │
│     • Parallel paths identified (e.g., site plan during rezone review)                   │
│     • Critical path highlighted                                                          │
│     • Monte Carlo simulation for confidence intervals                                    │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  DATA SOURCES FOR TIMELINE INTELLIGENCE                                             │ │
│  │                                                                                     │ │
│  │  SOURCE                    SCRAPE METHOD          FIELDS EXTRACTED                  │ │
│  │  ────────────────────────  ────────────────────   ──────────────────────────────    │ │
│  │  City Planning Portal      Selenium + BeautifulSoup  Application #, dates,          │ │
│  │  (e.g., Atlanta ePlans)                              status, project type           │ │
│  │  Building Permit Portal    API / Scrape            Permit #, filed, issued,         │ │
│  │  (e.g., Accela, Amanda)                            review cycles, inspector         │ │
│  │  Council/BZA Agendas       RSS / Scrape            Hearing dates, outcomes,         │ │
│  │                                                    continuation count               │ │
│  │  CoStar (planned)          API                     Development pipeline +           │ │
│  │                                                    completion timelines             │ │
│  │  User Reports              Platform UI             Actual experienced times          │ │
│  │  (crowdsourced accuracy)                           (confirms/corrects model)         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Tab 6 Wireframe — Deal Timeline Builder

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  TAB 6: TIME-TO-SHOVEL                                                                   │
│                                                                                         │
│  ┌─── DEAL SELECTOR ───────────────────────────────────────────────────────────────────┐│
│  │  Deal: [847 Peachtree – MF Development ▾]  │  Scenario: [Variance Path (320u) ▾]   ││
│  │  Jurisdiction: City of Atlanta              │  Project Scale: 200+ units             ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── MUNICIPAL BENCHMARKS (scraped data) ─────────────────────────────────────────────┐│
│  │                                                                                     ││
│  │  CITY OF ATLANTA — HISTORICAL PROCESSING TIMES                                      ││
│  │  Based on 847 applications scraped (2021-2025) for projects 200+ units              ││
│  │  Last updated: Feb 22, 2026                                                         ││
│  │                                                                                     ││
│  │  STEP                    P25         MEDIAN      P75         P90        n=           ││
│  │                         (Fast)     (Expected)  (Typical)   (Worst)                   ││
│  │  ─────────────────────  ─────────  ──────────  ──────────  ─────────  ────          ││
│  │  Pre-Application Mtg    2 wks       4 wks       6 wks       8 wks     124           ││
│  │  Rezone Application     4.5 mo      6.2 mo      8.1 mo      11 mo     89            ││
│  │  SAP / Variance         3.8 mo      5.4 mo      7.2 mo      9.5 mo    67            ││
│  │  CUP Application        2.1 mo      3.5 mo      4.8 mo      6.2 mo    142           ││
│  │  Site Plan Review       2.8 mo      4.1 mo      5.6 mo      7.8 mo    203           ││
│  │  ├─ Revision Cycle      3 wks       5 wks       7 wks       10 wks    avg 1.8x      ││
│  │  ├─ Avg # Revisions     1           2           3           4+                       ││
│  │  Building Permit        3.2 mo      4.8 mo      6.5 mo      9.1 mo    178           ││
│  │  ├─ Plan Review         2.1 mo      3.2 mo      4.4 mo      6.0 mo                  ││
│  │  ├─ Revisions           1.1 mo      1.6 mo      2.1 mo      3.1 mo    avg 1.4x      ││
│  │  Foundation Inspect.    1 wk        2 wks       3 wks       4 wks     312           ││
│  │  Certificate of Occ.   2 wks       4 wks       6 wks       10 wks    156           ││
│  │  ─────────────────────  ─────────  ──────────  ──────────  ─────────                ││
│  │  TOTAL (sequential)     17.5 mo     24.2 mo     31.8 mo     42.1 mo                 ││
│  │                                                                                     ││
│  │  💡 AI Insight: "Atlanta's rezone approvals have slowed 18% since Q3 2025           ││
│  │  due to new community engagement requirements. Factor +1.2 months vs                ││
│  │  historical median. Site plan reviews trending faster (-0.5mo) due to               ││
│  │  new ePlans digital submission system launched Nov 2025."                            ││
│  │                                                                                     ││
│  │  [📊 See Raw Data]  [📈 Trend Analysis]  [🔄 Refresh from Source]                   ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── DEAL GANTT TIMELINE ─────────────────────────────────────────────────────────────┐│
│  │                                                                                     ││
│  │  SCENARIO: Variance Path (320 units) — Expected Case (P50)                          ││
│  │  Start: Today (Feb 23, 2026)  →  Shovel: Mar 2028  →  CO: Jun 2030                 ││
│  │                                                                                     ││
│  │  2026                          2027                          2028                    ││
│  │  M  A  M  J  J  A  S  O  N  D  J  F  M  A  M  J  J  A  S  O  N  D  J  F  M        ││
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │        ││
│  │  ├──┤                                                                               ││
│  │  Pre-App (4 wks)                                                                    ││
│  │     ├─────────────────────┤                                                         ││
│  │     SAP Variance (5.4 mo)                                                           ││
│  │                    ├──────────────────┤                                              ││
│  │                    Site Plan (4.1 mo) ← can start during SAP                        ││
│  │                                       ├────────────────────┤                        ││
│  │                                       Building Permit (4.8 mo)                      ││
│  │                                                            ├┤                       ││
│  │                                                            Foundation Insp.         ││
│  │                                                             ├─                      ││
│  │                                                             🔨 SHOVEL IN GROUND     ││
│  │                                                                                     ││
│  │  ══════════════════════════════════════════════════════════════                      ││
│  │  ▓▓▓▓ CRITICAL PATH              ░░░░ PARALLEL ACTIVITY                             ││
│  │  ──── FLOAT / SLACK              ★ MILESTONE                                        ││
│  │                                                                                     ││
│  │  KEY MILESTONES:                                                                    ││
│  │  ★ Feb 23, 2026  — Deal Start (today)                                               ││
│  │  ★ Mar 23, 2026  — Pre-App Meeting                                                  ││
│  │  ★ Sep 05, 2026  — SAP Approval (expected)                                          ││
│  │  ★ Nov 15, 2026  — Site Plan Approval (expected, parallel track)                    ││
│  │  ★ Mar 01, 2028  — Building Permit Issued                                           ││
│  │  ★ Mar 15, 2028  — 🔨 SHOVEL IN GROUND                                              ││
│  │  ★ Jun 15, 2030  — CO (assumes 27-mo construction for 320 units)                    ││
│  │                                                                                     ││
│  │  CONFIDENCE BAND (Monte Carlo, 1000 simulations):                                   ││
│  │  ┌──────────────────────────────────────────────────────────┐                       ││
│  │  │  Shovel Date        Probability                          │                       ││
│  │  │  ─────────────────  ───────────                          │                       ││
│  │  │  Before Dec 2027    18% (optimistic)                     │                       ││
│  │  │  Jan - Mar 2028     47% (expected)                       │                       ││
│  │  │  Apr - Jun 2028     24% (likely delay)                   │                       ││
│  │  │  After Jul 2028     11% (worst case)                     │                       ││
│  │  └──────────────────────────────────────────────────────────┘                       ││
│  │                                                                                     ││
│  │  [Toggle: P25 | ●P50 | P75 | P90]  [📎 Attach to Deal Capsule]                     ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── FINANCIAL IMPACT OF TIMELINE ────────────────────────────────────────────────────┐│
│  │                                                                                     ││
│  │  CARRYING COST ANALYSIS — Time = Money                                              ││
│  │  ═══════════════════════════════════                                                 ││
│  │                                                                                     ││
│  │  Land Basis:           $12.5M                                                       ││
│  │  Acquisition Loan:     $9.375M (75% LTV, 7.2% rate)                                 ││
│  │                                                                                     ││
│  │                        EXPECTED (P50)    DELAYED (P75)    WORST (P90)                ││
│  │  ──────────────────    ──────────────    ─────────────    ───────────                ││
│  │  Months to Shovel:     24.2 mo           31.8 mo          42.1 mo                   ││
│  │  Interest Carry:       $1,350,000        $1,773,000       $2,348,000                 ││
│  │  Property Tax:         $504,000          $662,000         $877,000                   ││
│  │  Insurance:            $72,600           $95,400          $126,300                   ││
│  │  Entitlement Costs:    $120,000          $155,000         $210,000                   ││
│  │  Soft Costs (arch/eng):$680,000          $680,000         $680,000                   ││
│  │  ──────────────────    ──────────────    ─────────────    ───────────                ││
│  │  TOTAL PRE-CONST:      $2,726,600        $3,365,400       $4,241,300                 ││
│  │  Per Unit:             $8,521            $10,517          $13,254                    ││
│  │                                                                                     ││
│  │  DELAY COST:           baseline          +$638,800        +$1,514,700               ││
│  │                                          (+23.4%)         (+55.5%)                   ││
│  │                                                                                     ││
│  │  IMPACT ON RETURNS:                                                                 ││
│  │  ┌────────────────────────────────────────────────────────────────┐                 ││
│  │  │  Metric           Expected    Delayed     Worst     Delta     │                 ││
│  │  │  ────────────     ────────    ────────    ─────     ─────     │                 ││
│  │  │  Project IRR      22.7%       20.1%       17.3%     -5.4%     │                 ││
│  │  │  Equity Multiple  2.14x       1.98x       1.82x     -0.32x    │                 ││
│  │  │  Dev Margin       28.4%       25.8%       22.1%     -6.3%     │                 ││
│  │  │  Cash-on-Cash     18.9%       16.5%       13.8%     -5.1%     │                 ││
│  │  └────────────────────────────────────────────────────────────────┘                 ││
│  │                                                                                     ││
│  │  💡 AI: "Every month of entitlement delay costs $55,800 in carry alone.             ││
│  │  Hiring expedited plan review service ($15k) could save 6 weeks on site plan,       ││
│  │  netting $69,300. Recommend parallel-tracking site plan during SAP review            ││
│  │  to compress 3.2 months from critical path."                                        ││
│  │                                                                                     ││
│  │  [📊 Export Timeline + Financials]  [📎 Sync to Deal Capsule]                       ││
│  │  [🔄 Update with Actual Dates]  [📧 Send Timeline to Investors]                     ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── JURISDICTION COMPARISON (Timeline Edition) ──────────────────────────────────────┐│
│  │                                                                                     ││
│  │  How fast can you break ground in different markets?                                 ││
│  │  (200+ unit multifamily, rezone required)                                            ││
│  │                                                                                     ││
│  │  JURISDICTION          MEDIAN TTS*    RANK    TREND     CARRY COST DELTA            ││
│  │  ────────────────────  ────────────   ────    ─────     ────────────────             ││
│  │  Nashville, TN         16.8 mo        #1      →         -$413,000 vs ATL            ││
│  │  Charlotte, NC         18.4 mo        #2      ↓         -$324,000 vs ATL            ││
│  │  Tampa, FL             20.1 mo        #3      →         -$229,000 vs ATL            ││
│  │  Atlanta, GA           24.2 mo        #4      ↑         baseline                    ││
│  │  Austin, TX            26.5 mo        #5      ↑         +$128,000 vs ATL            ││
│  │  Miami, FL             31.4 mo        #6      ↑↑        +$401,000 vs ATL            ││
│  │                                                                                     ││
│  │  * TTS = Time to Shovel (total pre-construction entitlement timeline)                ││
│  │                                                                                     ││
│  │  💡 AI: "Nashville's 7.4-month advantage over Atlanta saves $413k in carry          ││
│  │  on a $12.5M land basis. But Atlanta's density premium (109 vs 80 units/acre)        ││
│  │  yields $14.2M more in project value. Net advantage: Atlanta by $13.8M              ││
│  │  despite slower entitlements."                                                       ││
│  │                                                                                     ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ┌─── DEAL LENGTH MAPPER (Full Lifecycle) ─────────────────────────────────────────────┐│
│  │                                                                                     ││
│  │  COMPLETE DEAL TIMELINE: Acquisition → Stabilization                                ││
│  │  ═══════════════════════════════════════════════                                     ││
│  │                                                                                     ││
│  │  PHASE              DURATION    CUMULATIVE    CAPITAL DEPLOYED    STATUS             ││
│  │  ────────────────   ─────────   ──────────    ────────────────    ──────             ││
│  │  Due Diligence      45 days     1.5 mo        $150k (deposits)   ✅ Complete         ││
│  │  Closing            30 days     2.5 mo        $12.5M (land)      ✅ Complete         ││
│  │  Pre-Application    4 wks       3.5 mo        $12.6M             🔄 In Progress     ││
│  │  Entitlement(s)     5.4 mo      8.9 mo        $12.8M             ⏳ Upcoming        ││
│  │  Site Plan Review   4.1 mo      10.5 mo*      $13.2M             ⏳ (parallel)      ││
│  │  Building Permit    4.8 mo      15.7 mo       $13.9M             ⏳ Upcoming        ││
│  │  Construction       27 mo       42.7 mo       $52.4M (full)      ⏳ Upcoming        ││
│  │  Lease-Up           6 mo        48.7 mo       $52.4M             ⏳ Upcoming        ││
│  │  Stabilization      3 mo        51.7 mo       $52.4M             ⏳ Upcoming        ││
│  │  ────────────────   ─────────   ──────────    ────────────────                       ││
│  │  TOTAL DEAL LENGTH: 51.7 months (4 years, 3.7 months)                               ││
│  │  * Parallel tracking saves 2.5 months on critical path                              ││
│  │                                                                                     ││
│  │  CAPITAL DEPLOYMENT CURVE:                                                          ││
│  │  ┌─────────────────────────────────────────────────────────────┐                    ││
│  │  │  $52M ─                                          ┌────────│                    ││
│  │  │       │                                    ┌─────┘        │                    ││
│  │  │       │                              ┌─────┘              │                    ││
│  │  │       │                        ┌─────┘   Construction     │                    ││
│  │  │       │                  ┌─────┘                          │                    ││
│  │  │  $13M ─────────────────┘  ← Shovel                       │                    ││
│  │  │  $12M ─────────────────── Pre-Construction ───────        │                    ││
│  │  │       │                                                   │                    ││
│  │  │   $0  ├────┼────┼────┼────┼────┼────┼────┼────┼────┼─────│                    ││
│  │  │       0    6    12   18   24   30   36   42   48   52    │                    ││
│  │  │                         Months                            │                    ││
│  │  └─────────────────────────────────────────────────────────────┘                    ││
│  │                                                                                     ││
│  │  INVESTOR REPORTING:                                                                ││
│  │  ┌──────────────────────────────────────────────────────────────┐                   ││
│  │  │  Capital Call Schedule (derived from timeline):              │                   ││
│  │  │                                                              │                   ││
│  │  │  Call #1  Closing        Mar 2026     $3,125,000  (equity)   │                   ││
│  │  │  Call #2  Entitlement    Sep 2026     $500,000               │                   ││
│  │  │  Call #3  Pre-Const      Mar 2028     $2,800,000             │                   ││
│  │  │  Call #4  Construction   Sep 2028     $4,200,000             │                   ││
│  │  │  Call #5  Construction   Mar 2029     $4,200,000             │                   ││
│  │  │  Call #6  Final          Sep 2029     $1,675,000             │                   ││
│  │  │  ─────────────────────────────────────────────────          │                   ││
│  │  │  Total Equity:                        $16,500,000            │                   ││
│  │  └──────────────────────────────────────────────────────────────┘                   ││
│  │                                                                                     ││
│  │  [📊 Export Full Timeline]  [📄 Generate Investor Memo]                              ││
│  │  [📎 Sync All to Deal Capsule]  [🔄 Update Actuals vs Projected]                    ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## AI CHAT / ZONING AGENT INTERFACE

### Bottom Drawer — Natural Language Zoning Queries

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ZONING AGENT CHAT (Bottom Drawer — expand/collapse)                                    │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │  🤖 Zoning Agent                                                         [↕ ✕]    ││
│  │  ─────────────────────────────────────────────────────────────────────────────────  ││
│  │                                                                                     ││
│  │  USER: What can I build on the corner of Peachtree and 10th?                        ││
│  │                                                                                     ││
│  │  🤖: That parcel (14-0049-LL-034-6) is zoned MRC-3 in the City of Atlanta.         ││
│  │  Here's the quick breakdown:                                                        ││
│  │                                                                                     ││
│  │  By-right you can build up to 245 residential units at 225 ft max height.           ││
│  │  The parcel is 2.25 acres with 0 ft front setback, so the buildable                ││
│  │  footprint is generous.                                                             ││
│  │                                                                                     ││
│  │  Key opportunities I see:                                                           ││
│  │  1. SAP variance could push you to 320 units (+30%)                                 ││
│  │  2. MARTA proximity gives 20% parking reduction                                     ││
│  │  3. Affordable housing density bonus could add another 15% if you                   ││
│  │     include 10% AMI units                                                           ││
│  │                                                                                     ││
│  │  Want me to run a full development feasibility at 320 units, or                     ││
│  │  compare the financial outcomes across all three scenarios?                          ││
│  │                                                                                     ││
│  │  [📊 Run Dev Feasibility]  [🔍 Deep Dive Zoning Code]  [🗺️ Show on Map]            ││
│  │                                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────────────────────  ││
│  │  SUGGESTED QUERIES:                                                                 ││
│  │  "Calculate parking for 320 units mixed-use"                                        ││
│  │  "What density bonus programs apply here?"                                          ││
│  │  "Show me all MRC-3 parcels over 1 acre in Midtown"                                 ││
│  │  "Compare zoning between Atlanta and Decatur for this project type"                 ││
│  │  "How long does a rezone take in Atlanta for 200+ unit projects?"                   ││
│  │  "What's my total time to shovel if I pursue the SAP variance?"                     ││
│  │  "Show me which markets have the fastest entitlement timelines"                     ││
│  │  "What's the carrying cost difference between P50 and P75 scenarios?"               ││
│  │  ─────────────────────────────────────────────────────────────────────────────────  ││
│  │                                                                                     ││
│  │  [Type your question...                                           ] [Send]          ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## MAP LAYER INTEGRATION

### How Zoning Module Controls the Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  MAP LAYER CONFIGURATION — Zoning & Entitlements Module                                 │
│                                                                                         │
│  LAYER NAME                TYPE         SOURCE              DEFAULT    Z-INDEX          │
│  ──────────────────────    ──────────   ──────────────────  ─────────  ───────          │
│  Zoning Districts          Boundary     Municipal GIS       ON         10               │
│  Parcel Boundaries         Boundary     County Assessor     ON         11               │
│  Overlay Districts         Boundary     Municipal GIS       OFF        12               │
│  Historic Districts        Boundary     SHPO / Local        OFF        13               │
│  Flood Zones               Boundary     FEMA / NFIP         OFF        14               │
│  Entitlement Status Pins   Pin          Deal Capsule DB     ON         20               │
│  Rezone Opportunity Heat   Heatmap      Zoning Agent AI     OFF        5                │
│  Development Capacity      Bubble       Dev Capacity Calc   OFF        15               │
│  3D Buildable Envelope     3D Extrude   Zoning Parameters   OFF        30               │
│  Setback Lines             Line         Zoning Code         OFF        25               │
│                                                                                         │
│  ENTITLEMENT STATUS PIN COLORS:                                                         │
│  🔵 Pre-Application                                                                    │
│  🟡 Submitted / Under Review                                                           │
│  🟠 Hearing Scheduled                                                                  │
│  🟢 Approved                                                                           │
│  🔴 Denied / Withdrawn                                                                 │
│                                                                                         │
│  MAP INTERACTIONS:                                                                      │
│  • Click parcel → Opens Zoning Lookup (Tab 1) in left panel                             │
│  • Hover parcel → Tooltip: District, density, height, permitted uses                    │
│  • Click entitlement pin → Opens Entitlement Detail card                                │
│  • Right-click parcel → "Compare Zoning", "Run Dev Capacity", "Add to Deal"             │
│  • Draw polygon → "Find all parcels matching criteria in this area"                     │
│  • 3D mode toggle → Extrude selected parcel to max buildable volume                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## DATA MODEL

### Zoning & Entitlements Data Entities

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DATA MODEL — Zoning & Entitlements                                                     │
│                                                                                         │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐                   │
│  │ ZoningDistrict              │      │ Parcel                      │                   │
│  │ ─────────────────────────── │      │ ─────────────────────────── │                   │
│  │ id: UUID                    │◄────►│ id: UUID                    │                   │
│  │ code: string (MRC-3)       │      │ parcel_number: string       │                   │
│  │ name: string               │      │ address: string             │                   │
│  │ municipality_id: FK        │      │ zoning_district_id: FK      │                   │
│  │ max_density: float         │      │ lot_area_sf: float          │                   │
│  │ max_height_ft: float       │      │ lot_area_acres: float       │                   │
│  │ max_far: float             │      │ geometry: PostGIS           │                   │
│  │ max_lot_coverage: float    │      │ overlay_districts: string[] │                   │
│  │ min_open_space: float      │      │ flood_zone: string          │                   │
│  │ setback_front_ft: float    │      │ historic_district: boolean  │                   │
│  │ setback_side_ft: float     │      │ last_assessed: date         │                   │
│  │ setback_rear_ft: float     │      │ assessed_value: decimal     │                   │
│  │ parking_residential: float │      └─────────────────────────────┘                   │
│  │ parking_commercial: float  │                    │                                    │
│  │ parking_guest: float       │                    │                                    │
│  │ permitted_uses: jsonb      │                    ▼                                    │
│  │ conditional_uses: jsonb    │      ┌─────────────────────────────┐                   │
│  │ prohibited_uses: jsonb     │      │ DevelopmentCapacity         │                   │
│  │ code_reference: string     │      │ ─────────────────────────── │                   │
│  │ last_amended: date         │      │ id: UUID                    │                   │
│  │ geometry: PostGIS          │      │ parcel_id: FK               │                   │
│  └─────────────────────────────┘      │ scenario: enum              │                   │
│                                       │   (by_right|variance|rezone)│                   │
│  ┌─────────────────────────────┐      │ max_units: int              │                   │
│  │ Entitlement                 │      │ max_gfa_sf: float           │                   │
│  │ ─────────────────────────── │      │ parking_required: int       │                   │
│  │ id: UUID                    │      │ est_value: decimal          │                   │
│  │ parcel_id: FK               │      │ est_timeline_months: int    │                   │
│  │ deal_capsule_id: FK         │      │ est_cost: decimal           │                   │
│  │ type: enum                  │      │ success_probability: float  │                   │
│  │   (rezone|variance|cup|     │      │ ai_recommendation: text     │                   │
│  │    site_plan|lot_split|     │      │ calculated_at: timestamp    │                   │
│  │    annexation|subdivision)  │      └─────────────────────────────┘                   │
│  │ status: enum                │                                                        │
│  │   (pre_app|submitted|       │      ┌─────────────────────────────┐                   │
│  │    under_review|hearing|    │      │ RegulatoryAlert             │                   │
│  │    approved|denied|         │      │ ─────────────────────────── │                   │
│  │    withdrawn)               │      │ id: UUID                    │                   │
│  │ current_zoning: string      │      │ jurisdiction_id: FK         │                   │
│  │ proposed_zoning: string     │      │ category: enum              │                   │
│  │ filed_date: date            │      │ severity: enum (red|yellow  │                   │
│  │ hearing_date: date          │      │   |green)                   │                   │
│  │ decision_date: date         │      │ title: string               │                   │
│  │ risk_score: int (0-100)     │      │ description: text           │                   │
│  │ timeline_milestones: jsonb  │      │ impact_description: text    │                   │
│  │ documents: jsonb            │      │ probability: float          │                   │
│  │ contacts: jsonb             │      │ source: string              │                   │
│  │ ai_risk_assessment: text    │      │ affected_deals: UUID[]      │                   │
│  │ news_intelligence: jsonb    │      │ affected_strategies: enum[] │                   │
│  │ created_at: timestamp       │      │ detected_at: timestamp      │                   │
│  │ updated_at: timestamp       │      │ expires_at: timestamp       │                   │
│  └─────────────────────────────┘      └─────────────────────────────┘                   │
│                                                                                         │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐                   │
│  │ MunicipalBenchmark          │      │ DealTimeline                │                   │
│  │ ─────────────────────────── │      │ ─────────────────────────── │                   │
│  │ id: UUID                    │      │ id: UUID                    │                   │
│  │ jurisdiction_id: FK         │      │ deal_capsule_id: FK         │                   │
│  │ step_type: enum             │      │ scenario: enum              │                   │
│  │   (pre_app|rezone|variance| │      │   (by_right|variance|rezone)│                   │
│  │    cup|site_plan|bldg_perm| │      │ start_date: date            │                   │
│  │    foundation|co)           │      │ shovel_date_p25: date       │                   │
│  │ project_scale: enum         │      │ shovel_date_p50: date       │                   │
│  │   (small|medium|large|xl)   │      │ shovel_date_p75: date       │                   │
│  │ from_zoning: string (null)  │      │ shovel_date_p90: date       │                   │
│  │ to_zoning: string (null)    │      │ co_date_p50: date           │                   │
│  │ p25_days: int               │      │ total_months_p50: float     │                   │
│  │ p50_days: int               │      │ phases: jsonb               │                   │
│  │ p75_days: int               │      │   [{step, duration_days,    │                   │
│  │ p90_days: int               │      │     start, end, parallel,   │                   │
│  │ sample_size: int            │      │     critical_path, status}] │                   │
│  │ avg_revision_cycles: float  │      │ carry_cost_p50: decimal     │                   │
│  │ approval_rate: float        │      │ carry_cost_p75: decimal     │                   │
│  │ trend_direction: enum       │      │ carry_cost_p90: decimal     │                   │
│  │   (faster|stable|slower)    │      │ capital_call_schedule: jsonb │                   │
│  │ trend_delta_pct: float      │      │ irr_impact_by_scenario:jsonb│                   │
│  │ seasonal_factors: jsonb     │      │ monte_carlo_results: jsonb  │                   │
│  │ last_scraped: timestamp     │      │ last_calculated: timestamp  │                   │
│  │ source_url: string          │      │ actual_vs_projected: jsonb  │                   │
│  │ confidence: float           │      │   [{step, projected_date,   │                   │
│  └─────────────────────────────┘      │     actual_date, delta}]    │                   │
│                                       └─────────────────────────────┘                   │
│                                                                                         │
│  RELATIONSHIPS:                                                                         │
│  • Parcel ←→ ZoningDistrict (many-to-one, parcels belong to districts)                  │
│  • Parcel ←→ DevelopmentCapacity (one-to-many, multiple scenarios per parcel)            │
│  • Parcel ←→ Entitlement (one-to-many, multiple entitlements per parcel)                 │
│  • Entitlement ←→ DealCapsule (many-to-one, entitlements belong to deals)               │
│  • RegulatoryAlert ←→ DealCapsule (many-to-many, alerts affect multiple deals)          │
│  • RegulatoryAlert ←→ NewsIntelligence (many-to-many, alerts sourced from news)         │
│  • MunicipalBenchmark ←→ Jurisdiction (many-to-one, benchmarks per jurisdiction)        │
│  • DealTimeline ←→ DealCapsule (one-to-one, each deal has one active timeline)          │
│  • DealTimeline ←→ MunicipalBenchmark (many-to-many, timeline uses benchmarks)          │
│  • DealTimeline ←→ Entitlement (one-to-many, timeline tracks entitlement progress)      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## CROSS-MODULE DATA FLOWS

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ZONING MODULE — DATA FLOW DIAGRAM                                                      │
│                                                                                         │
│                    INPUTS TO ZONING MODULE                                               │
│                    ══════════════════════                                                │
│                                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │ Municipal     │   │ County       │   │ News         │   │ Deal         │             │
│  │ GIS / Zoning │   │ Assessor     │   │ Intelligence │   │ Capsule      │             │
│  │ Codes        │   │ (parcels)    │   │ Agent        │   │ (pipeline)   │             │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘             │
│         │                  │                   │                  │                      │
│  ┌──────────────┐   ┌──────────────┐                                                    │
│  │ Municipal     │   │ User         │                                                    │
│  │ Permit Portal │   │ Timeline     │                                                    │
│  │ (scraped     │   │ Reports      │                                                    │
│  │  timelines)  │   │ (crowdsource)│                                                    │
│  └──────┬───────┘   └──────┬───────┘                                                    │
│         │                  │                                                             │
│         ▼                  ▼                   ▼                  ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐                 │
│  │                    ZONING & ENTITLEMENTS MODULE                      │                 │
│  │                                                                     │                 │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐│                 │
│  │  │ Zoning    │  │Entitlement│  │  Dev      │  │Regulatory │  │Time-to- ││                 │
│  │  │ Lookup    │  │ Tracker   │  │ Capacity  │  │ Risk      │  │Shovel   ││                 │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────┬────┘│                 │
│  │        │              │              │              │              │     │                 │
│  └────────┼──────────────┼──────────────┼──────────────┼──────────────┼─────┘                 │
│           │              │              │              │              │                       │
│           ▼              ▼              ▼              ▼              ▼                       │
│                                                                                         │
│                    OUTPUTS FROM ZONING MODULE                                            │
│                    ═════════════════════════                                             │
│                                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │ Strategy     │   │ Development  │   │ Deal Capsule │   │ JEDI Score   │             │
│  │ Arbitrage    │   │ Feasibility  │   │ Section 3:   │   │ Risk Signal  │             │
│  │ Engine       │   │ Module       │   │ Regulatory   │   │ Supply Signal│             │
│  │              │   │              │   │              │   │              │             │
│  │ "STR blocked │   │ "Max 320u at │   │ All zoning + │   │ Risk: 34    │             │
│  │  by zoning → │   │  FAR 3.2 →   │   │ entitlement  │   │ Supply: +320│             │
│  │  skip STR    │   │  run proforma│   │ data flows   │   │ units in 9mo│             │
│  │  strategy"   │   │  at 320u"    │   │ into deal"   │   │              │             │
│  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘             │
│                                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                                 │
│  │ Financial    │   │ Investor     │   │ Portfolio    │                                 │
│  │ Module       │   │ Reporting    │   │ Manager      │                                 │
│  │              │   │              │   │              │                                 │
│  │ "24.2mo pre- │   │ "Capital     │   │ "3 deals in  │                                 │
│  │  const carry │   │  call sched: │   │  entitlement │                                 │
│  │  = $2.7M →   │   │  6 calls,    │   │  phase, avg  │                                 │
│  │  adjust IRR" │   │  $16.5M eq"  │   │  14mo to     │                                 │
│  │              │   │              │   │  shovel"     │                                 │
│  └──────────────┘   └──────────────┘   └──────────────┘                                 │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## DATA SOURCES & INTEGRATION

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DATA SOURCES — Zoning & Entitlements                                                   │
│                                                                                         │
│  SOURCE                    DATA PROVIDED                  INTEGRATION    COST            │
│  ────────────────────────  ────────────────────────────   ───────────    ──────          │
│  Municode.com              Zoning code text, amendments   API / Scrape   $0-$200/mo     │
│  Municipal GIS Portals     District boundaries, parcels   GeoJSON/WFS    Free           │
│  County Tax Assessor       Parcel data, ownership,        API / Scrape   Free-$50/mo    │
│                            lot sizes, assessed values                                    │
│  FEMA NFIP                 Flood zone boundaries          GeoJSON        Free           │
│  State Historic Pres.      Historic district boundaries   Shapefile      Free           │
│  City Planning Dept        Permit data, hearing           API / Scrape   Free           │
│                            schedules, staff reports                                      │
│  City Permit Portal        Historical permit processing   Selenium +     Free           │
│  (Accela/Amanda/ePlans)    times, plan review cycles,     BeautifulSoup                 │
│                            revision counts, outcomes                                     │
│  Council/BZA Agendas       Hearing dates, continuations,  RSS / Scrape   Free           │
│                            decision outcomes, vote records                                │
│  News Intelligence Agent   Regulatory change detection    Internal       —              │
│  CoStar (planned)          Zoning + development pipeline  API            $2,500/mo      │
│  User Input                Manual entitlement updates,    Platform UI    —              │
│                            document uploads, contacts                                    │
│  User Timeline Reports     Actual experienced processing  Platform UI    —              │
│  (Crowdsourced)            times (validates/corrects      (data flywheel)                │
│                            scraped benchmarks)                                            │
│                                                                                         │
│  PRIORITY BUILD ORDER:                                                                  │
│  Phase 1: Municipal GIS + Municode + User Input (MVP — $0/mo data cost)                 │
│  Phase 2: + County Assessor + FEMA + News Agent (adds automation)                       │
│  Phase 3: + CoStar API + Planning Dept integration (full intelligence)                  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## COMPONENT ARCHITECTURE

```typescript
// Zoning & Entitlements Module — Component Tree

ZoningEntitlementsModule/
├── ZoningModulePage.tsx              // Tab container + layout
├── tabs/
│   ├── ZoningLookup/
│   │   ├── ZoningLookupTab.tsx       // Main tab view
│   │   ├── ParcelSearch.tsx          // Address search + map click handler
│   │   ├── ZoningClassificationCard.tsx
│   │   ├── DevelopmentParametersCard.tsx
│   │   ├── SetbacksDisplay.tsx
│   │   ├── ParkingRequirementsCard.tsx
│   │   ├── PermittedUsesCard.tsx
│   │   ├── StrategyAlignmentBadges.tsx
│   │   └── ByRightVsVarianceCard.tsx
│   │
│   ├── EntitlementTracker/
│   │   ├── EntitlementTrackerTab.tsx  // Kanban + detail view
│   │   ├── EntitlementKanban.tsx
│   │   ├── EntitlementCard.tsx
│   │   ├── EntitlementDetailDrawer.tsx
│   │   ├── EntitlementTimeline.tsx
│   │   ├── EntitlementDocuments.tsx
│   │   ├── EntitlementContacts.tsx
│   │   └── AIRiskAssessment.tsx
│   │
│   ├── DevelopmentCapacity/
│   │   ├── DevelopmentCapacityTab.tsx
│   │   ├── CapacityComparisonMatrix.tsx
│   │   ├── StrategyArbitrageImpact.tsx
│   │   └── AIRecommendationCard.tsx
│   │
│   ├── RegulatoryRisk/
│   │   ├── RegulatoryRiskTab.tsx
│   │   ├── JurisdictionRiskScore.tsx
│   │   ├── RiskCategoryTable.tsx
│   │   ├── RegulatoryAlertsFeed.tsx
│   │   └── StrategyRegulatoryMatrix.tsx
│   │
│   └── ZoningComparator/
│       ├── ZoningComparatorTab.tsx
│       ├── ComparisonModeSelector.tsx
│       ├── SideBySideComparison.tsx
│       └── ComparisonDeltaColumn.tsx
│
│   └── TimeToShovel/
│       ├── TimeToShovelTab.tsx           // Main tab orchestrator
│       ├── MunicipalBenchmarks/
│       │   ├── BenchmarkTable.tsx        // Scraped processing times (P25-P90)
│       │   ├── BenchmarkTrendBadge.tsx   // ↑↓→ trend indicators
│       │   ├── BenchmarkSourceInfo.tsx   // Data freshness + source links
│       │   └── BenchmarkRefreshButton.tsx
│       ├── GanttTimeline/
│       │   ├── DealGanttChart.tsx        // Full Gantt with critical path
│       │   ├── GanttPhaseBar.tsx         // Individual phase bar component
│       │   ├── GanttMilestoneMarker.tsx  // ★ milestone diamonds
│       │   ├── GanttConfidenceBand.tsx   // P25-P90 shaded range
│       │   ├── GanttParallelTrackLine.tsx
│       │   └── ScenarioToggle.tsx        // P25 | P50 | P75 | P90 switcher
│       ├── FinancialImpact/
│       │   ├── CarryingCostAnalysis.tsx  // Interest + tax + insurance
│       │   ├── DelayScenarioTable.tsx    // Expected vs Delayed vs Worst
│       │   ├── ReturnImpactMatrix.tsx    // IRR, equity multiple, margin
│       │   └── CapitalCallSchedule.tsx   // Derived from timeline phases
│       ├── JurisdictionRace/
│       │   ├── JurisdictionTimelineComparison.tsx  // Market-to-market TTS
│       │   └── CarryCostDeltaColumn.tsx
│       └── DealLengthMapper/
│           ├── FullLifecycleTimeline.tsx  // Acquisition → Stabilization
│           ├── CapitalDeploymentCurve.tsx // Area chart of $ over time
│           └── InvestorScheduleCard.tsx   // Capital call table
│
├── map-layers/
│   ├── ZoningDistrictsLayer.tsx      // Mapbox boundary fill
│   ├── ParcelBoundariesLayer.tsx
│   ├── OverlayDistrictsLayer.tsx
│   ├── EntitlementStatusPins.tsx     // Color-coded pins
│   ├── RezoneHeatmapLayer.tsx
│   ├── BuildableEnvelope3D.tsx       // Mapbox 3D extrusion
│   └── SetbackLinesLayer.tsx
│
├── chat/
│   └── ZoningAgentChat.tsx           // Bottom drawer chat
│
├── hooks/
│   ├── useZoningLookup.ts            // React Query: fetch zoning for parcel
│   ├── useEntitlements.ts            // React Query: entitlement CRUD
│   ├── useDevelopmentCapacity.ts     // React Query: capacity calculations
│   ├── useRegulatoryAlerts.ts        // React Query: alerts feed
│   ├── useZoningComparison.ts        // Comparison logic
│   ├── useMunicipalBenchmarks.ts     // React Query: scraped timeline data
│   ├── useDealTimeline.ts            // React Query: Gantt + Monte Carlo
│   ├── useCarryingCosts.ts           // Derived: financial impact of timeline
│   └── useTimelineComparison.ts      // Cross-jurisdiction TTS comparison
│
├── store/
│   └── zoningStore.ts                // Zustand: selected parcel, active tab,
│                                     // comparison state, layer toggles
│
└── types/
    └── zoning.types.ts               // All TypeScript interfaces
```

---

## ZUSTAND STORE SHAPE

```typescript
interface ZoningModuleState {
  // Active tab
  activeTab: 'lookup' | 'tracker' | 'capacity' | 'risk' | 'comparator' | 'timeline';
  
  // Selected parcel
  selectedParcel: Parcel | null;
  selectedZoning: ZoningDistrict | null;
  
  // Entitlement tracker
  entitlements: Entitlement[];
  entitlementFilter: {
    market: string | null;
    status: EntitlementStatus | null;
    type: EntitlementType | null;
    dealId: string | null;
  };
  
  // Development capacity
  capacityScenarios: DevelopmentCapacity[];
  
  // Regulatory risk
  selectedJurisdiction: string | null;
  regulatoryAlerts: RegulatoryAlert[];
  
  // Comparator
  comparisonMode: 'district' | 'parcel' | 'jurisdiction';
  comparisonA: ZoningDistrict | Parcel | null;
  comparisonB: ZoningDistrict | Parcel | null;
  
  // Time-to-Shovel
  selectedDealForTimeline: string | null;
  timelineScenario: 'by_right' | 'variance' | 'rezone';
  timelineConfidenceLevel: 'p25' | 'p50' | 'p75' | 'p90';
  municipalBenchmarks: MunicipalBenchmark[];
  dealTimeline: DealTimeline | null;
  timelineComparisonMarkets: string[];
  
  // Map layers
  layerVisibility: Record<string, boolean>;
  
  // Actions
  selectParcel: (parcel: Parcel) => void;
  setActiveTab: (tab: string) => void;
  toggleLayer: (layerId: string) => void;
  setComparisonItems: (a: any, b: any) => void;
  setTimelineScenario: (scenario: string) => void;
  setConfidenceLevel: (level: string) => void;
  refreshBenchmarks: (jurisdictionId: string) => void;
  updateActualDate: (step: string, actualDate: Date) => void;
}
```

---

## DEAL CAPSULE INTEGRATION

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  DEAL CAPSULE — Section 3: Regulatory & Land Use                                        │
│  (Auto-populated from Zoning Module)                                                    │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐│
│  │  3.1  ZONING CLASSIFICATION                                                        ││
│  │       District: MRC-3 │ Municipality: City of Atlanta                               ││
│  │       By-right capacity: 245 units │ Max height: 225 ft                             ││
│  │       [Auto-synced from Zoning Lookup]                                              ││
│  │                                                                                     ││
│  │  3.2  ENTITLEMENT STATUS                                                            ││
│  │       Active: Rezone MRC-3 → MRC-4 │ Status: Under Review                          ││
│  │       Filed: 1/10/2026 │ Next Milestone: BZA Hearing 3/15                           ││
│  │       Risk Score: 34/100 (Low) │ Est. Completion: 5/01/2026                         ││
│  │       [Auto-synced from Entitlement Tracker]                                        ││
│  │                                                                                     ││
│  │  3.3  DEVELOPMENT CAPACITY SUMMARY                                                  ││
│  │       Scenario selected: Variance (320 units)                                       ││
│  │       Value at variance: $89.6M │ Delta vs by-right: +$21M                          ││
│  │       [Auto-synced from Development Capacity]                                       ││
│  │                                                                                     ││
│  │  3.4  REGULATORY RISK FLAGS                                                         ││
│  │       🟡 STR moratorium vote pending (3/5) — affects STR strategy                   ││
│  │       🟢 Density bonus expansion under review — potential upside                    ││
│  │       [Auto-synced from Regulatory Risk Intelligence]                               ││
│  │                                                                                     ││
│  │  3.5  STRATEGY IMPACT                                                               ││
│  │       BTS: ✅ Favored │ Flip: ✅ OK │ Rental: 🟡 Inclusionary │ STR: 🟠 At Risk    ││
│  │       [Auto-synced from Strategy-Regulatory Matrix]                                 ││
│  │                                                                                     ││
│  │  3.6  TIME-TO-SHOVEL & DEAL LENGTH                                                  ││
│  │       Shovel Date (P50): Mar 15, 2028 │ CO Date: Jun 15, 2030                       ││
│  │       Total Deal Length: 51.7 months │ Pre-Construction: 24.2 months                ││
│  │       Carrying Cost (P50): $2,726,600 │ Per Unit: $8,521                             ││
│  │       Delay Risk: +$638,800 at P75 scenario (+23.4%)                                ││
│  │       Confidence: 47% probability shovel Jan-Mar 2028                               ││
│  │       Capital Call Schedule: 6 calls, $16.5M total equity                           ││
│  │       [Auto-synced from Time-to-Shovel Intelligence]                                ││
│  │       [🔄 Actuals vs Projected tracking active]                                     ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                         │
│  ZERO RE-ENTRY: All data flows automatically from Zoning Module → Deal Capsule.         │
│  User can override any field with manual input (flagged as "user override").             │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## USER FLOWS

### Flow 1: "What Can I Build Here?" (Discovery)
```
User clicks parcel on map
  → Zoning Lookup auto-populates (Tab 1)
  → User sees classification, parameters, permitted uses
  → User clicks "Run Dev Capacity"
  → Development Capacity tab opens (Tab 3) with 3 scenarios
  → User selects preferred scenario
  → User clicks "Attach to Deal Capsule"
  → Deal Capsule Section 3 auto-populated
```

### Flow 2: Entitlement Monitoring (Active Deal)
```
User has active rezone application
  → Entitlement Tracker (Tab 2) shows Kanban status
  → News Agent detects council agenda item → RegulatoryAlert created
  → Alert appears in Tab 4 with severity + affected deals
  → Notification pushed to user
  → User clicks alert → sees impact on strategy + financial model
  → User updates Deal Capsule with new timeline
```

### Flow 3: Market Comparison (Capital Deployment)
```
User evaluating Atlanta vs Nashville for next development
  → Zoning Comparator (Tab 5) → Jurisdiction mode
  → Side-by-side: density allowances, permit timelines, impact fees
  → Regulatory Risk (Tab 4) for each market
  → AI recommends: "Atlanta MRC-4 density premium justifies higher land
    cost. Nashville permit timeline 40% faster but impact fees 2x."
  → User creates new Deal Capsule in selected market
```

### Flow 4: "How Long Until I Break Ground?" (Timeline Intelligence)
```
User has active deal with selected entitlement scenario
  → Time-to-Shovel tab (Tab 6) auto-pulls municipal benchmarks
  → Zoning Agent scrapes City of Atlanta ePlans for comparable projects
  → 847 historical applications matched → P25/P50/P75/P90 computed
  → AI identifies parallel-track opportunity (site plan during SAP)
  → Gantt chart generated: today → shovel = 24.2 months (P50)
  → Financial Impact panel shows: $2.7M carry cost, IRR drop per month delay
  → User toggles P75 scenario → sees $639k additional risk
  → User clicks "Sync to Deal Capsule" → Section 3.6 auto-populated
  → User clicks "Generate Investor Memo" → capital call schedule exported
  → Over time: user reports actual dates → model improves (data flywheel)
```

### Flow 5: "Where Should I Develop Next?" (Jurisdiction Race)
```
User comparing markets for capital deployment
  → Time-to-Shovel tab (Tab 6) → Jurisdiction Comparison
  → Platform shows median TTS for 6 target markets
  → Nashville: 16.8mo vs Atlanta: 24.2mo = 7.4 month advantage
  → But carrying cost delta ($413k) < density value premium ($14.2M)
  → AI synthesizes: "Atlanta wins despite slower entitlements"
  → User launches new deal in Atlanta with realistic timeline expectations
```

---

## BUILD PRIORITY

```
┌────────────────────────────────────────────────────────────────┐
│  MVP (Phase 1)                                                 │
│  • Tab 1: Zoning Lookup (address → zoning parameters)          │
│  • Parcel map with zoning district overlay                     │
│  • Permitted uses display                                      │
│  • Basic by-right capacity calculation                         │
│  • Data: Municipal GIS + Municode (free)                       │
│  • Est: 3-4 weeks                                              │
│                                                                │
│  Phase 2                                                       │
│  • Tab 2: Entitlement Tracker (Kanban)                         │
│  • Tab 3: Development Capacity (3-scenario comparison)         │
│  • Deal Capsule integration (auto-sync Section 3)              │
│  • Strategy Arbitrage connection                               │
│  • Municipal permit portal scraper (first 3 markets)           │
│  • Est: 4-5 weeks                                              │
│                                                                │
│  Phase 3                                                       │
│  • Tab 6: Time-to-Shovel Intelligence (core)                   │
│    - Municipal benchmark table (P25-P90)                       │
│    - Gantt timeline builder with critical path                 │
│    - Monte Carlo confidence bands                              │
│    - Carrying cost financial impact panel                      │
│  • Tab 4: Regulatory Risk Intelligence                         │
│  • Deal Capsule Section 3.6 auto-sync                          │
│  • Est: 5-6 weeks                                              │
│                                                                │
│  Phase 4                                                       │
│  • Tab 5: Zoning Comparator                                    │
│  • Tab 6 advanced: Jurisdiction TTS comparison                 │
│  • Tab 6 advanced: Full Deal Length Mapper + capital curve      │
│  • Tab 6 advanced: Investor memo / capital call export          │
│  • News Agent integration for regulatory alerts                │
│  • 3D Buildable Envelope visualization                         │
│  • AI Zoning Agent chat                                        │
│  • Crowdsourced timeline accuracy (data flywheel)              │
│  • Expand scraper to 10+ markets                               │
│  • Est: 5-6 weeks                                              │
└────────────────────────────────────────────────────────────────┘
```
