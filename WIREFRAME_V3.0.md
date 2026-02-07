# JEDI RE - Platform Wireframe v3.0

**Complete Platform Specification**  
**Version:** 3.0  
**Date:** 2026-02-07  
**Status:** Master Specification Document

---

## 🎯 Executive Summary

**What's New in v3.0:**

This version integrates four major architectural advances:

1. **Intelligence Layers** (Platform-Level Services)
   - Market Data Layer: Macro intelligence that auto-links to deals by geography
   - Assets Owned Layer: Portfolio management that feeds comparison data back to platform

2. **Intelligence Compression Framework** (8 Invisible Engines)
   - Method engines process raw data into 5 Master Signals
   - JEDI Score synthesizes everything into one actionable number
   - Progressive disclosure: Traffic light → Signals → Engines → Raw data

3. **Module Marketplace** (30 Purchasable Modules)
   - Users buy/install modules per deal
   - Custom strategy builder (unlimited strategies)
   - Bundle pricing for different investor profiles

4. **Central Map Canvas** (Unified Interface)
   - Horizontal bar controls map layers (Search, War Maps, custom maps)
   - Vertical sidebar controls data overlays (Intelligence Layers, Assets, Pipeline)
   - Map always visible except in Grid View silos

**The Big Picture:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  PLATFORM INTELLIGENCE (Always Running)                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  📊 Market Data Layer (Macro Intelligence)                           │
│  └─ CoStar data, market trends, submarket analytics                 │
│                                                                       │
│  🏢 Assets Owned Layer (Portfolio Intelligence)                      │
│  └─ Your properties, lease data, performance metrics                │
│                                                                       │
│  🧠 METHOD ENGINES (8 Invisible Processors)                         │
│  ├─ Signal Processing → Filters noise from market data              │
│  ├─ Contagion Model → Tracks trend spread between submarkets        │
│  ├─ Carrying Capacity → Calculates sustainable supply levels        │
│  ├─ Capital Flow → Models capital movement patterns                 │
│  ├─ Game Theory → Simulates competitive responses                   │
│  ├─ Behavioral → Detects cognitive biases                           │
│  ├─ Network → Maps relationships and influence                      │
│  └─ Monte Carlo → Runs probabilistic scenarios                      │
│                                                                       │
│  📈 SYNTHESIS LAYER (5 Master Signals)                              │
│  ├─ Demand Signal (STRONG/MODERATE/WEAK)                           │
│  ├─ Supply Signal (UNDERSUPPLIED/BALANCED/OVERSUPPLIED)            │
│  ├─ Momentum Signal (ACCELERATING/STABLE/DECELERATING)             │
│  ├─ Position Signal (ADVANTAGED/NEUTRAL/DISADVANTAGED)             │
│  └─ Risk Signal (LOW/MODERATE/HIGH)                                │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
                         ↓ Auto-feeds intelligence
┌──────────────────────────────────────────────────────────────────────┐
│  USER INTERFACE (What Users See & Control)                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  🗺️ CENTRAL MAP CANVAS                                              │
│  └─ Horizontal bar (map layers) + Vertical sidebar (data overlays)  │
│                                                                       │
│  📁 DEAL PAGES (Per-Deal Intelligence)                              │
│  ├─ Overview, Strategy Arbitrage, Financial Modeling, etc.          │
│  └─ Modules consume Intelligence Layer + Method Engine outputs      │
│                                                                       │
│  🛒 MODULE MARKETPLACE                                               │
│  └─ 30 purchasable modules, custom strategies, bundle pricing       │
│                                                                       │
│  🎯 JEDI SCORE (Layer 4 - Decision Interface)                       │
│  └─ Single composite number: All intelligence → One action          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

### Part 1: Platform Intelligence (Foundation)
1. [Intelligence Layers](#1-intelligence-layers)
2. [Method Engines (Layer 2)](#2-method-engines-layer-2)
3. [Synthesis Layer (5 Master Signals)](#3-synthesis-layer-5-master-signals)
4. [JEDI Score (Decision Interface)](#4-jedi-score-decision-interface)

### Part 2: User Interface (What Users See)
5. [Main Layout Structure](#5-main-layout-structure)
6. [Horizontal Bar - Map Layers](#6-horizontal-bar---map-layers)
7. [Vertical Sidebar - Data Navigation](#7-vertical-sidebar---data-navigation)
8. [Central Map Canvas](#8-central-map-canvas)
9. [Grid View Silos](#9-grid-view-silos)

### Part 3: Module System
10. [Module Marketplace](#10-module-marketplace)
11. [Per-Deal Module Activation](#11-per-deal-module-activation)
12. [Custom Strategy Builder](#12-custom-strategy-builder)

### Part 4: Deal Pages & Workflows
13. [Individual Deal Pages](#13-individual-deal-pages)
14. [User Flows](#14-user-flows)
15. [Data Flow Architecture](#15-data-flow-architecture)

### Part 5: Implementation
16. [Progressive Disclosure Model](#16-progressive-disclosure-model)
17. [Technical Architecture](#17-technical-architecture)
18. [Implementation Roadmap](#18-implementation-roadmap)

---

# PART 1: PLATFORM INTELLIGENCE (FOUNDATION)

## 1. Intelligence Layers

**Concept:** Two persistent platform-level services that run continuously, feeding intelligence to deals and modules.

### 1.1 Market Data Layer

**Purpose:** Macro intelligence that auto-links to deals by geography

**Data Sources:**
- CoStar (rent comps, cap rates, transactions)
- ApartmentIQ (real-time property data, search trends)
- Census data (demographics, migration)
- Building permits (supply pipeline)
- News sentiment (market momentum)
- Traffic patterns (location quality)

**Key Features:**
- **Geographic Auto-Linking:** When you create a deal with boundary → platform automatically finds relevant submarket data
- **Submarket Analytics:** Every geographic area has computed metrics (rent trends, supply/demand, momentum)
- **Historical Tracking:** Time-series data for trend analysis
- **Confidence Scoring:** Every metric has confidence interval (e.g., "Rent: $1,800 ±$120")

**How It Feeds Modules:**
- Strategy Arbitrage pulls comp data for financial modeling
- Comp Analysis uses Market Data for regional comparisons
- Market Snapshot module visualizes submarket metrics
- JEDI Score uses Market Data for Demand/Supply/Momentum signals

**Location in UI:**
- Vertical sidebar: "📊 Market Data"
- Clicking opens Market Data dashboard (platform-wide view)
- Shows all submarkets you're tracking
- Click submarket → Deep dive (trends, news, transactions)

---

### 1.2 Assets Owned Layer

**Purpose:** Portfolio management + data contribution back to platform

**Data Sources:**
- Your properties (address, units, class, financials)
- Lease intelligence (expirations, renewal rates, concessions)
- Actual performance (NOI, occupancy, CapEx)
- Tenant data (demographics, payment history)

**Key Features:**
- **Portfolio Benchmarking:** Compare your properties vs market averages
- **Acquisition Criteria:** Your portfolio informs what to buy next (e.g., if you own 5 Class A properties in Buckhead, system learns your preferences)
- **Data Contribution:** Your anonymized portfolio data enriches Market Data Layer (network effect - more users = better intelligence)
- **Comp Analysis:** Your properties can be comps for your own deals

**How It Feeds Modules:**
- Strategy Arbitrage uses your portfolio performance as assumptions baseline
- Financial Modeling pulls your actual expense ratios
- Comp Analysis includes your properties as comps
- Returns Calculator uses your historical returns for validation

**Location in UI:**
- Vertical sidebar: "🏢 Assets Owned"
- Two views: Map View (markers on map) + Grid View (detailed portfolio management)
- Grid View has full lease intelligence, budget vs actual, investor reporting

**Data Flow (Two-Way):**

```
┌─────────────────────────────────────────────────────────────┐
│  Market Data Layer (Platform Intelligence)                  │
│  ├─ Rent comps from CoStar + ApartmentIQ                   │
│  ├─ Market trends                                           │
│  └─ Anonymized portfolio data from all users               │
└─────────────────────────────────────────────────────────────┘
         ↓ Feeds intelligence                  ↑ Contributes data
┌─────────────────────────────────────────────────────────────┐
│  Assets Owned Layer (Your Portfolio)                        │
│  ├─ Your actual performance data                           │
│  ├─ Benchmarks vs market                                   │
│  └─ Acquisition criteria learning                          │
└─────────────────────────────────────────────────────────────┘
         ↓ Informs deal evaluation
┌─────────────────────────────────────────────────────────────┐
│  Deal (Pipeline Item)                                       │
│  ├─ Inherits Market Data by geography                      │
│  ├─ Compared to your Assets Owned                          │
│  └─ Strategy Arbitrage uses both layers                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Method Engines (Layer 2)

**Philosophy:** Users don't need more data. They need to know how much to trust the data they have.

**Design Principle:** These engines are **INVISIBLE to users**. They run continuously, processing raw data from Intelligence Layers into synthesized signals.

### 2.1 Eight Engines

#### Engine 1: Signal Processing
**What It Does:** Filters noise from market data using Kalman filtering and Fourier transforms

**Methods:**
- Fourier transforms → Decompose price signals into cyclical components (seasonal, annual, business cycle)
- Kalman filtering → Extract true market signal from noisy transaction data
- Band-pass filtering → Ignore daily noise, capture quarterly trends

**Output:** Clean signal, cyclical decomposition

**Example:** Rent increase at one property = noise. Correlated increases across 10 properties with similar traffic patterns = signal.

---

#### Engine 2: Contagion Model
**What It Does:** Tracks how market trends spread between submarkets using epidemiological models

**Methods:**
- **R₀ calculation:** "Trend virality" - how many adjacent properties see rent increases after one raises rents?
- Infection spread → Gentrification propagation
- Herd immunity → Market saturation threshold
- Contact tracing → Investment flow tracking

**Output:** Spread velocity, R₀ calculation

**Example:** Model how a Whole Foods opening "infects" adjacent submarkets. Calculate R₀ of rent increases spreading through Midtown Atlanta.

---

#### Engine 3: Carrying Capacity
**What It Does:** Calculates sustainable supply levels using ecological frameworks

**Methods:**
- **Carrying capacity:** Maximum sustainable units per submarket given demand drivers
- **Biodiversity index:** Tenant mix diversity as resilience indicator
- **Succession stages:** Neighborhood lifecycle (pioneer → growth → mature → decline)

**Output:** Saturation %, equilibrium timeline

**Example:** Calculate "Market Health Index" using diversity metrics. A submarket with only Class A properties and only young professionals is less resilient than mixed housing stock.

---

#### Engine 4: Capital Flow
**What It Does:** Models capital movement using fluid dynamics principles

**Methods:**
- Pressure gradients → Yield differentials between markets
- Viscosity → Transaction friction
- Flow modeling → Where capital moves next

**Output:** Flow direction, pressure gradients

**Example:** Predict where institutional capital will flow next based on "pressure differentials" between Atlanta, Austin, and Miami.

---

#### Engine 5: Game Theory
**What It Does:** Simulates competitive responses and optimal strategies

**Methods:**
- **Nash equilibrium:** Optimal pricing given competitor behavior
- **Prisoner's dilemma:** Concession wars between competing properties
- Auction theory → Bid strategy optimization
- Information asymmetry → OM analysis (broker vs buyer information gap)

**Output:** Strategic position, Nash equilibrium

**Example:** Model the "Concession Spiral" - when one property offers 6 weeks free, what's the Nash equilibrium response? Help users understand when to match concessions vs. hold firm.

---

#### Engine 6: Behavioral
**What It Does:** Detects cognitive biases in user analysis

**Methods:**
- **Anchoring:** Sellers anchored to peak prices
- **Loss aversion:** Holding too long
- **Recency bias:** Overweighting recent transactions
- **Confirmation bias:** Selective data interpretation

**Output:** Bias flags, correction suggestions

**Example:** Build "bias alerts" that flag when analysis might be compromised. "Warning: You've viewed 8 properties in Buckhead this week. Confirmation bias risk - consider expanding search."

---

#### Engine 7: Network
**What It Does:** Maps relationships and influence using graph theory

**Methods:**
- **Nodes:** Properties, owners, brokers, lenders
- **Edges:** Transactions, relationships, capital flows
- Centrality metrics → Key players
- Community detection → Investment clusters

**Output:** Key players, network centrality

**Example:** Identify "super-connectors" with early deal flow access. Detect quiet accumulation patterns (same buyer acquiring multiple parcels through different LLCs).

---

#### Engine 8: Monte Carlo
**What It Does:** Runs probabilistic scenarios for outcome modeling

**Methods:**
- Probability distributions vs point estimates
- Tail risk modeling
- Survival analysis for hold periods
- Confidence intervals

**Output:** Confidence ranges, tail risks

**Example:** Instead of "IRR = 15%", show "IRR distribution: 80% confidence between 12-18%". Model tail risks explicitly.

---

### 2.2 How Engines Work Together

**Example: Analyzing a Buckhead Development Deal**

1. **Signal Processing** cleans rent data from Market Data Layer → "True rent trend: +4.2% annually"
2. **Contagion Model** calculates R₀ for Buckhead gentrification → "R₀ = 1.8 (accelerating)"
3. **Carrying Capacity** assesses supply → "78% of sustainable capacity, 2 years to equilibrium"
4. **Capital Flow** models institutional interest → "High pressure (cap rates 150bps below target)"
5. **Game Theory** analyzes competitor responses → "3 competing projects, Nash eq: differentiate"
6. **Behavioral** flags user assumptions → "Warning: Anchored to 2022 peak rents"
7. **Network** identifies key players → "Broker X closed 4 deals here, early access likely"
8. **Monte Carlo** generates scenarios → "IRR: 12-18% (80% confidence), 5% tail risk of <8%"

**All 8 outputs feed into...**

---

## 3. Synthesis Layer (5 Master Signals)

**Purpose:** Compress 8 engine outputs into 5 actionable signals that answer: "What should I do?"

### Signal 1: DEMAND SIGNAL

**Powered by:** Signal Processing + Search Trends

**Raw inputs:** Traffic, search volume, lease velocity, migration

**Processing:** 
- Kalman filtering removes noise
- Trend decomposition separates seasonal vs structural
- Search trends validate demand signals

**Output:** 
```
DEMAND: STRONG
Confidence: ±12%
Trend: Accelerating (+6% QoQ)
Drivers: Tech job growth, migration from CA
```

**Visual (User sees):**
```
Demand  ████████░░ 82/100
```

---

### Signal 2: SUPPLY SIGNAL

**Powered by:** Carrying Capacity + Contagion Model

**Raw inputs:** Inventory, pipeline, permits, absorption

**Processing:**
- Ecological capacity modeling calculates sustainable supply
- Saturation analysis shows timeline to equilibrium
- Contagion model tracks how new supply spreads

**Output:**
```
SUPPLY: UNDERSUPPLIED
Saturation: 68% of capacity
Timeline to Equilibrium: 18 months
Pipeline Risk: LOW (only 2 projects)
```

**Visual (User sees):**
```
Supply  ██████████ 92/100 (Undersupplied = Good)
```

---

### Signal 3: MOMENTUM SIGNAL

**Powered by:** Contagion + Capital Flow

**Raw inputs:** Transaction velocity, capital sources, trend spread

**Processing:**
- Epidemiological R₀ calculation measures trend virality
- Flow modeling shows capital movement patterns
- Contagion map visualizes spread

**Output:**
```
MOMENTUM: ACCELERATING
R₀: 1.8 (each deal triggers 1.8 more)
Capital Flow: INBOUND (+$450M this quarter)
Contagion Map: Spreading from Midtown → Buckhead
```

**Visual (User sees):**
```
Momentum  ███████░░░ 75/100
```

---

### Signal 4: POSITION SIGNAL

**Powered by:** Game Theory + Network Science

**Raw inputs:** Competitor actions, market share, relationship data

**Processing:**
- Nash equilibrium analysis determines optimal strategy
- Centrality metrics identify your network strength
- Competitive positioning relative to others

**Output:**
```
POSITION: ADVANTAGED
Network Strength: HIGH (3 key brokers)
Competitive Edge: First-mover in submarket
Strategic Recommendation: Differentiate product
```

**Visual (User sees):**
```
Position  █████████░ 88/100
```

---

### Signal 5: RISK SIGNAL

**Powered by:** Monte Carlo + Behavioral

**Raw inputs:** Volatility, scenario outcomes, user assumptions

**Processing:**
- Probabilistic modeling generates confidence ranges
- Bias detection flags cognitive errors
- Tail risk analysis

**Output:**
```
RISK: MODERATE
Key Risks:
• Rent growth assumption optimistic (bias detected)
• Interest rate sensitivity: HIGH
• Exit cap rate: 50bps expansion risk

Confidence: 80% probability of 12-18% IRR
Tail Risk: 5% probability of <8% IRR
```

**Visual (User sees):**
```
Risk  ████░░░░░░ 42/100 (Lower = Less Risky)
```

---

## 4. JEDI Score (Decision Interface)

**Purpose:** For users who want maximum simplicity, all 5 signals roll into a single composite score.

**Philosophy:** The score IS the synthesis - all interdisciplinary methods are baked in, but invisible.

### 4.1 Score Calculation

**Weighted Algorithm:**
```
JEDI Score = (
  Demand × 0.25 +
  Supply × 0.25 +
  Momentum × 0.20 +
  Position × 0.15 +
  (100 - Risk) × 0.15
)
```

**Example:**
- Demand: 82/100 × 0.25 = 20.5
- Supply: 92/100 × 0.25 = 23.0
- Momentum: 75/100 × 0.20 = 15.0
- Position: 88/100 × 0.15 = 13.2
- Risk: 42/100 → (100-42) × 0.15 = 8.7

**JEDI Score = 80.4 → Display as 80**

---

### 4.2 Verdict System

| Score Range | Verdict | Color | Action |
|-------------|---------|-------|--------|
| 85-100 | STRONG OPPORTUNITY | 🟢 Green | Buy aggressively |
| 70-84 | OPPORTUNITY | 🟢 Light Green | Strong candidate |
| 55-69 | NEUTRAL | 🟡 Yellow | Investigate further |
| 40-54 | CAUTION | 🟠 Orange | Proceed carefully |
| 0-39 | AVOID | 🔴 Red | Pass |

---

### 4.3 Display UI

**Level 1 (Traffic Light - 2 Second Decision):**
```
┌────────────────────┐
│   🟢 78           │
│                    │
│   STRONG           │
│   OPPORTUNITY      │
└────────────────────┘
```

**Level 2 (Full Card - 30 Second Understanding):**
```
┌─────────────────────────────────────────┐
│      JEDI SCORE™                        │
│                                         │
│            78                           │
│                                         │
│   VERDICT: STRONG OPPORTUNITY           │
│   Confidence: ±8 points                 │
│                                         │
│   Demand   ████████░░ 82                │
│   Supply   ██████████ 92                │
│   Momentum ███████░░░ 75                │
│   Position █████████░ 88                │
│   Risk     ████░░░░░░ 42                │
│                                         │
│   [View Details →]                      │
└─────────────────────────────────────────┘
```

**Level 3 (Engine Details - Power Users):**
Click "View Details" → Shows:
- Which engines powered each signal
- Raw data sources
- Methodology explanations
- Confidence intervals
- Bias alerts

**Level 4 (Raw Data - Quants):**
- Export all data to CSV
- API access to engine outputs
- Run custom analyses

---

# PART 2: USER INTERFACE (WHAT USERS SEE)

## 5. Main Layout Structure

**Layout Principle:** Central Map Canvas with dual control systems

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HORIZONTAL BAR (Map Layers & Search)                                        │
│  [🔍 Search] [🗺️ War Maps] [📍 Custom 1] [📍 Custom 2]... [➕ Map] [➕ Deal]│
├────────────┬─────────────────────────────────────────────────────────────────┤
│  VERTICAL  │                                                                  │
│  SIDEBAR   │                                                                  │
│            │                                                                  │
│ 📊 Dashboard│               CENTRAL MAP CANVAS                               │
│ 📊 Market  │               (Always Visible)                                  │
│    Data    │                                                                  │
│ 🏢 Assets  │               - Mapbox base layer                               │
│    Owned   │               - Intelligence Layer overlays                     │
│ 📁 Pipeline│               - Property markers                                │
│ 📧 Email   │               - Deal boundaries                                 │
│ 📈 Reports │               - Custom map layers                               │
│ 👥 Team    │               - Annotations & notes                             │
│ 🏗️ Arch    │                                                                  │
│ ⚙️ Settings│                                                                  │
│   └ Module │                                                                  │
│     Market │                                                                  │
│            │                                                                  │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

---

## 6. Horizontal Bar - Map Layers

### 6.1 Google Search Bar

**Position:** Left-most, full-width input

**Placeholder:** "Search for addresses, apartments, locations..."

**Features:**
- Autocomplete with suggestions
- Search types:
  - Address: "123 Peachtree St, Atlanta, GA"
  - Keyword: "apartments", "luxury condos", "vacant land"
  - POI: "Whole Foods", "Emory University"
- Results appear in side panel (doesn't leave app)
- Click result → Add pin to map → Option to save to deal

**Use Case:** 
- Broker emails about property → Search address → Verify location → Add to custom map
- Research competitors → Search "Class A Buckhead" → See all results on map

---

### 6.2 War Maps Button

**Icon:** 🗺️  
**Position:** After search bar  
**Behavior:** Toggle master layer

**When Active:**
- All custom maps visible simultaneously
- Layer controls panel opens (right side)
- Can adjust opacity, z-order, visibility per layer
- Drag to reorder layers

**Layer Controls Panel:**
```
┌─────────────────────────────────┐
│ 🗺️ War Maps Active             │
│ ─────────────────────────────── │
│ ☑️ Midtown Research             │  [👁️] [⚙️] [↕️]
│    Opacity: ████░░ 60%          │
│                                 │
│ ☑️ Competitor Analysis          │  [👁️] [⚙️] [↕️]
│    Opacity: ███████ 80%         │
│                                 │
│ ☐ Broker Recommendations        │  [👁️] [⚙️] [↕️]
│    (Hidden)                     │
│ ─────────────────────────────── │
│ Blend Mode: [Normal ▼]          │
│                                 │
│ [Hide All] [Show All]           │
└─────────────────────────────────┘
```

---

### 6.3 Custom Map Buttons

**Each custom map = Toggle button**

**Example:** `[📍 Midtown Research]`

**States:**
- **Active** (blue): Layer visible on map
- **Inactive** (gray): Layer hidden
- **Hover:** Preview tooltip

**Right-click Menu:**
- Rename
- Duplicate
- Share link (view-only or edit)
- Export (PDF, PNG, GeoJSON)
- Delete

---

### 6.4 Create New Map

**Button:** `[➕ Create Map]`

**Modal:**
```
┌──────────────────────────────────────┐
│  Create New Map                      │
├──────────────────────────────────────┤
│  Map Name: [_________________]       │
│                                      │
│  Purpose (optional):                 │
│  [____________________________]      │
│                                      │
│  Share with team: ☐                  │
│                                      │
│  [Cancel]  [Create Map]              │
└──────────────────────────────────────┘
```

**After creation:**
- New button appears in horizontal bar
- Map active by default
- Ready for drawing, annotations, pins

---

### 6.5 Create Deal

**Button:** `[➕ Create Deal]` (top right)

**Opens:** Enhanced Create Deal Flow (see Section 14.1)

---

## 7. Vertical Sidebar - Data Navigation

**Purpose:** Controls which DATA OVERLAYS appear on the central map

### 7.1 Sidebar Structure

```
┌────────────────────────────┐
│  📊 Dashboard              │ ← Overview (default home)
├────────────────────────────┤
│  INTELLIGENCE LAYERS       │
├────────────────────────────┤
│  📊 Market Data            │ ← Platform-level intelligence
│  🏢 Assets Owned           │ ← Your portfolio
├────────────────────────────┤
│  DEAL MANAGEMENT           │
├────────────────────────────┤
│  📁 Pipeline               │ ← All deals (Map + Grid views)
├────────────────────────────┤
│  TOOLS                     │
├────────────────────────────┤
│  📧 Email                  │ ← Communication hub
│  📈 Reports                │ ← Analytics & exports
│  👥 Team                   │ ← Collaboration
│  🏗️ Architecture           │ ← Dev overlay (toggle)
├────────────────────────────┤
│  ⚙️ Settings               │
│    └ 🛒 Module Marketplace │ ← Purchase modules here
└────────────────────────────┘
```

---

### 7.2 Dashboard

**Purpose:** Overview of everything

**Sections:**
1. **Portfolio KPIs** (from Assets Owned Layer)
   - Total units, occupancy, NOI
2. **Market Intelligence** (from Market Data Layer)
   - Top opportunities (highest JEDI Scores)
   - Market momentum indicators
3. **Active Deals** (from Pipeline)
   - Deal pipeline stages
4. **Alerts & Tasks**
   - Upcoming lease expirations
   - Deal tasks due
5. **Activity Feed**
   - Recent actions across platform

---

### 7.3 Market Data (Intelligence Layer)

**Purpose:** Platform-wide market intelligence dashboard

**View:**
```
┌──────────────────────────────────────────────────────────┐
│  📊 Market Data Intelligence                             │
├──────────────────────────────────────────────────────────┤
│  Tracked Submarkets                                      │
│                                                          │
│  Buckhead, Atlanta                                       │
│  Rent Trend: +4.2% YoY  Supply: 68% capacity  ⭐ 85    │
│  [View Details]                                          │
│  ───────────────────────────────────────────────────    │
│  Midtown, Atlanta                                        │
│  Rent Trend: +6.1% YoY  Supply: 92% capacity  ⚠️ 72    │
│  [View Details]                                          │
│  ───────────────────────────────────────────────────────│
│                                                          │
│  [+ Add Submarket]                                       │
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Auto-tracks submarkets where you have deals or assets
- Click "View Details" → Deep dive (trends, news, transactions, JEDI Score for generic deal)
- Can manually add submarkets to track

---

### 7.4 Assets Owned (Intelligence Layer)

**Purpose:** Portfolio management + comp contribution

**Two View Modes:**

**Map View (Default):**
- Your properties appear as markers on central map
- Color-coded by class (A/B/C)
- Click marker → Property detail card
- Toggle layers: Occupancy heatmap, Lease expiration urgency

**Grid View:**
- Click "Switch to Grid View" button
- Full-page property management interface
- Lease intelligence (all upcoming expirations)
- Budget vs Actual dashboard
- Investor reporting tools
- Disposition analysis

**Property Detail Card (Map View):**
```
┌──────────────────────────────────────┐
│  Midtown Towers                      │
│  📍 123 Peachtree St, Atlanta, GA    │
├──────────────────────────────────────┤
│  Class: A+ | Units: 250              │
│  Occupancy: 94% | Avg Rent: $2,100   │
│                                      │
│  Lease Intelligence:                 │
│  • 12 expirations next 60 days       │
│  • Renewal rate: 68% (market: 72%)   │
│                                      │
│  Performance:                        │
│  • NOI: $4.2M (Budget: $4.0M) +5%    │
│  • Rent growth: +3.8% YoY            │
│                                      │
│  [View Full Details] [Edit]          │
└──────────────────────────────────────┘
```

---

### 7.5 Pipeline

**Purpose:** All deals (prospecting + owned)

**Two View Modes:**

**Map View (Default):**
- Deal boundaries/pins on central map
- Color-coded by stage (Lead → LOI → DD → Closed)
- Click boundary → Deal summary card

**Grid View:**
- Full-page deal management (Kanban board)
- 6 stages: Lead, Qualified, LOI, Due Diligence, Contract, Closed
- Drag-and-drop to move deals through pipeline
- Filters: Stage, Tier, Strategy, Deal Team

---

## 8. Central Map Canvas

**Purpose:** The persistent visual foundation where everything layers

### 8.1 Base Layer

**Map Provider:** Mapbox

**Styles:**
- Streets (default)
- Satellite
- Dark mode
- Light mode

**User Control:** Toggle in bottom-right corner

---

### 8.2 Layer Stack (Bottom to Top)

1. **Base Map** (Mapbox)
2. **Intelligence Layer Overlays:**
   - Market Data heatmaps (rent trends, supply, momentum)
   - Assets Owned markers
3. **Sidebar Data:**
   - Pipeline deal boundaries
   - Property markers
4. **Custom Maps:**
   - User-created layers (drawings, annotations, pins)
5. **War Maps** (when active)
6. **Popups & Tooltips** (top layer)

---

### 8.3 Interaction Patterns

**Click Property Marker:**
- Popup with property summary
- Quick actions: View details, Add to deal, Compare

**Click Deal Boundary:**
- Deal summary card
- JEDI Score preview
- Quick actions: Open deal, Run analysis, Edit

**Draw on Custom Map:**
- Polygon tool (boundaries)
- Circle tool (radius)
- Line/Arrow tool (notes)
- Pin tool (location markers)
- Text tool (annotations)

**Right-click:**
- "What's here?" (address lookup)
- "Add to deal"
- "Search nearby"
- "Measure distance"

---

## 9. Grid View Silos

**Purpose:** Deep work interfaces for Assets Owned and Pipeline

**Trigger:** Click "Switch to Grid View" button in respective section

**Behavior:**
- Map hidden
- Full-page grid interface
- "Back to Map" button in header

### 9.1 Assets Owned Grid View

**Layout:** Table + detail panels

**Features:**
- Sortable columns (occupancy, NOI, rent growth)
- Filters (class, location, lease expirations)
- Bulk actions (export, email reports)
- Lease intelligence dashboard
- Budget vs Actual view
- Investor reporting tools

---

### 9.2 Pipeline Grid View

**Layout:** Kanban board

**Stages:**
1. Lead
2. Qualified
3. LOI Submitted
4. Due Diligence
5. Under Contract
6. Closed

**Features:**
- Drag-and-drop between stages
- Deal cards show: Name, Location, JEDI Score, Stage, Deal Team
- Filters: Tier, Strategy, Date range
- Quick actions: Run analysis, View details, Archive

---

# PART 3: MODULE SYSTEM

## 10. Module Marketplace

**Location:** Settings → Module Marketplace

**Purpose:** Users purchase and install modules to extend platform functionality

### 10.1 Marketplace UI

```
┌──────────────────────────────────────────────────────────────────────┐
│  🛒 Module Marketplace                    [My Modules] [Purchase History] │
├──────────────────────────────────────────────────────────────────────┤
│  [Search modules...]  [All Categories ▼]  [Free ▼]  [Sort: Popular ▼] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  FEATURED MODULES                                                     │
│  ───────────────────────────────────────                             │
│                                                                       │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐ │
│  │ 🎯 Strategy         │  │ 💰 Financial        │  │ 🏗️ Develop.  │ │
│  │    Arbitrage        │  │    Modeling         │  │    Budget    │ │
│  │                     │  │                     │  │              │ │
│  │ Analyze 4 strategies│  │ Pro forma builder   │  │ Line-item    │ │
│  │ simultaneously      │  │ with scenarios      │  │ construction │ │
│  │                     │  │                     │  │ budget       │ │
│  │ ⭐ 4.9 (234 reviews)│  │ ⭐ 4.7 (189)        │  │ ⭐ 4.6 (142) │ │
│  │                     │  │                     │  │              │ │
│  │ FREE               │  │ $29/mo              │  │ $49/mo       │ │
│  │ [✓ Installed]      │  │ [Add to Plan]       │  │ [Try Free]   │ │
│  └─────────────────────┘  └─────────────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 10.2 Module Categories (30 Total Modules)

#### Free Modules (Core Features - 3)
1. **Overview** - Deal summary dashboard
2. **Activity Feed** - Timeline of all actions
3. **Strategy Arbitrage** - JEDI RE signature feature (powered by Intelligence Compression)

#### Financial & Analysis (6 modules)
4. **Financial Modeling** - $29/mo - Pro forma builder
5. **Returns Calculator** - $19/mo - IRR, equity multiple, waterfall
6. **Comp Analysis** - $24/mo - Comparable sales/rents (uses Market Data Layer)
7. **Debt Analyzer** - $19/mo - Loan scenarios, refinancing
8. **Valuation** - $24/mo - DCF, direct cap, sales comp

#### Development (5 modules)
9. **Zoning Analysis** - $34/mo - Code compliance checker
10. **Development Budget** - $49/mo - Line-item construction budget
11. **Timeline** - $29/mo - Critical path scheduling
12. **Entitlements** - $39/mo - Permit tracking, approval workflows
13. **Supply Pipeline** - $24/mo - Track competing projects

#### Due Diligence (4 modules)
14. **DD Checklist** - $19/mo - Task management, document tracking
15. **Risk Analysis** - $34/mo - Risk register, mitigation plans
16. **Insurance** - $19/mo - Coverage requirements
17. **Environmental** - $24/mo - Phase I/II tracking

#### Market Intelligence (4 modules)
18. **Market Snapshot** - $29/mo - Submarket deep dive (uses Market Data Layer)
19. **Traffic Analysis** - $34/mo - Location scoring, drive-time maps
20. **News & Sentiment** - $24/mo - Automated news aggregation
21. **OM Analyzer** - $39/mo - Parse offering memorandums

#### Collaboration (5 modules)
22. **Tasks** - $14/mo - Deal-specific task management
23. **Notes** - $9/mo - Shared notes, voice memos
24. **Documents** - $19/mo - Document library, version control
25. **Deal Deck** - $29/mo - Presentation builder
26. **Communication Log** - $14/mo - Email/call tracking

#### Portfolio Management (3 modules)
27. **Budget vs Actual** - $34/mo - Variance analysis (uses Assets Owned Layer)
28. **Investor Reporting** - $49/mo - Automated K-1 prep, distributions
29. **Disposition Analysis** - $34/mo - Exit strategy modeling
30. **Deal Team** - FREE - Assign roles, permissions

---

### 10.3 Bundle Pricing

**Flipper Bundle** - $79/mo (save 25%)
- Strategy Arbitrage, Financial Modeling, Returns Calculator, Comp Analysis, DD Checklist, Risk Analysis

**Developer Bundle** - $149/mo (save 30%)
- All Flipper modules + Zoning, Dev Budget, Timeline, Entitlements, Supply Pipeline, Environmental

**Portfolio Manager Bundle** - $199/mo (save 40%)
- All 27 premium modules (everything except 3 core free modules)

---

### 10.4 Module Detail Page

**Example: Strategy Arbitrage Module**

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Marketplace                                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🎯 Strategy Arbitrage                          [✓ Installed]    │
│                                                                   │
│  Analyze 4 investment strategies simultaneously with JEDI's      │
│  interdisciplinary intelligence compression framework.           │
│                                                                   │
│  FREE (Core Feature)                                             │
│                                                                   │
│  ⭐⭐⭐⭐⭐ 4.9/5 (234 reviews)                                    │
│                                                                   │
│  [Screenshots carousel]                                          │
│                                                                   │
│  FEATURES                                                        │
│  ✓ Analyzes 4 strategies: Buy & Hold, Value-Add, BRRRR, Flip   │
│  ✓ Powered by 8 method engines (Signal Processing, Contagion,   │
│     Carrying Capacity, Capital Flow, Game Theory, Behavioral,    │
│     Network, Monte Carlo)                                        │
│  ✓ 5 Master Signals: Demand, Supply, Momentum, Position, Risk   │
│  ✓ JEDI Score with confidence intervals                         │
│  ✓ Progressive disclosure (traffic light → full analysis)       │
│  ✓ Auto-pulls data from Market Data + Assets Owned layers       │
│                                                                   │
│  POWERED BY                                                      │
│  • Market Data Layer (rent comps, cap rates)                    │
│  • Assets Owned Layer (portfolio benchmarks)                    │
│  • Intelligence Compression Framework                            │
│                                                                   │
│  WHAT USERS SAY                                                  │
│  "Changed how I evaluate deals. Went from 2 hours of analysis   │
│   to 5 minutes with higher confidence." - John D.               │
│                                                                   │
│  [View All Reviews]                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. Per-Deal Module Activation

**Concept:** Users decide which modules to enable for each deal

### 11.1 Create Deal Module Selection

**During Enhanced Create Deal flow (Tab 5: Settings):**

```
┌──────────────────────────────────────────┐
│  Select Modules for This Deal            │
├──────────────────────────────────────────┤
│                                          │
│  INSTALLED MODULES                       │
│                                          │
│  ☑️ Overview (Core - always active)      │
│  ☑️ Strategy Arbitrage (Core)            │
│  ☑️ Financial Modeling                   │
│  ☑️ Returns Calculator                   │
│  ☐ Comp Analysis                         │
│  ☐ Development Budget                    │
│  ☐ Zoning Analysis                       │
│  ☐ DD Checklist                          │
│  ...                                     │
│                                          │
│  [Select All] [Select None]             │
│                                          │
│  Need more modules?                      │
│  [Browse Marketplace →]                  │
│                                          │
└──────────────────────────────────────────┘
```

---

### 11.2 Deal Page Module Tabs

**After creating deal, module tabs appear:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Buckhead Tower Development                                       │
│  📍 123 Peachtree St, Atlanta, GA                  JEDI Score: 78 │
├──────────────────────────────────────────────────────────────────┤
│  [Overview] [Strategy ▼] [Properties] [Financial] [Returns]...  │
│                                                     [+ Add Module]│
└──────────────────────────────────────────────────────────────────┘
```

**Module Tab Dropdown (right-click on tab):**
- Configure module
- Pin to first position
- Refresh data
- Disable for this deal
- Remove from deal

---

### 11.3 Module Layout Customization

**Drag-to-Reorder:**
- Click-hold tab → Drag left/right
- Order saved per deal
- Global default order in Settings

**Tab Overflow:**
- If >8 modules, show first 7 + "...More" dropdown
- Click "...More" → See all modules
- Can pin favorites to always show

---

## 12. Custom Strategy Builder

**Location:** Settings → Custom Strategies

**Purpose:** Create unlimited custom investment strategies beyond the 4 defaults

### 12.1 Custom Strategy UI

```
┌──────────────────────────────────────────────────────────────────┐
│  Custom Strategies                          [+ Create Strategy]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  MY STRATEGIES                                                    │
│                                                                   │
│  BRRRR (Buy, Rehab, Rent, Refinance, Repeat)                    │
│  Hold Period: 1-2 years | Refinance after stabilization         │
│  [Edit] [Clone] [Delete]                                         │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  House Hacking                                                    │
│  Hold Period: 1-3 years | Live in one unit, rent others         │
│  [Edit] [Clone] [Delete]                                         │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
│  COMMUNITY STRATEGIES (Browse & Clone)                           │
│                                                                   │
│  Luxury Flip (by DeveloperPro)         ⭐ 4.8 (45 clones)       │
│  High-end renovations, 6-12 month hold                           │
│  [Clone & Customize]                                             │
│  ───────────────────────────────────────────────────────────────│
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

### 12.2 Create Custom Strategy Modal

**Sections:**

**1. Strategy Basics**
- Name: [___________________]
- Description: [______________]
- Hold Period: [1-3 years ▼]
- Exit Strategy: [Refinance ▼]

**2. Revenue Assumptions**
```
┌────────────────────────────────────┐
│  Rent Growth: 3.5% annually        │
│  Other Income: $150/unit/year      │
│  Vacancy: 5%                       │
│  + Add Revenue Line                │
└────────────────────────────────────┘
```

**3. Expense Assumptions**
```
┌────────────────────────────────────┐
│  Taxes: 1.2% of value              │
│  Insurance: 0.4% of value          │
│  Maintenance: $500/unit/year       │
│  CapEx Reserve: $350/unit/year     │
│  + Add Expense Line                │
└────────────────────────────────────┘
```

**4. Financing**
```
┌────────────────────────────────────┐
│  LTV: 75%                          │
│  Rate: 6.5%                        │
│  Amortization: 30 years            │
│  Refinance after stabilization: ☑️  │
│  └─ New LTV: 70%                   │
│      New Rate: 6.0%                │
└────────────────────────────────────┘
```

**5. Value-Add Assumptions**
```
┌────────────────────────────────────┐
│  Rehab Budget: $15,000/unit        │
│  Timeline: 18 months               │
│  Rent Lift: +15%                   │
│  Occupancy improvement: +8%        │
└────────────────────────────────────┘
```

**6. Target Returns**
```
┌────────────────────────────────────┐
│  IRR Target: 18%  (Weight: 40%)    │
│  Equity Multiple: 2.0x (Weight: 30%)│
│  Cash-on-Cash: 12% (Weight: 20%)   │
│  Exit Cap Rate: <6.5% (Weight: 10%)│
└────────────────────────────────────┘
```

**7. AI Scoring Rules**
```
┌────────────────────────────────────┐
│  How should JEDI Score this?       │
│                                    │
│  ☑️ Demand Signal: Weight 25%      │
│  ☑️ Supply Signal: Weight 25%      │
│  ☑️ Momentum Signal: Weight 20%    │
│  ☑️ Position Signal: Weight 15%    │
│  ☑️ Risk Signal: Weight 15%        │
│                                    │
│  Minimum JEDI Score: 70            │
│  (Show warning if below threshold) │
└────────────────────────────────────┘
```

**8. Save Options**
```
┌────────────────────────────────────┐
│  ☐ Share with team                 │
│  ☐ Publish to community (anonymous)│
│                                    │
│  [Save as Draft] [Save & Use]      │
└────────────────────────────────────┘
```

---

### 12.3 Using Custom Strategies

**In Strategy Arbitrage Module:**

Instead of only 4 default strategies:
- Buy & Hold
- Value-Add
- BRRRR
- Flip

Now shows:
- Buy & Hold
- Value-Add
- **BRRRR (Custom)** ← Your custom strategy
- **House Hacking (Custom)** ← Your custom strategy
- Flip

User can select which strategies to compare per deal.

---

# PART 4: DEAL PAGES & WORKFLOWS

## 13. Individual Deal Pages

**Access:** Click deal boundary on map OR click deal card in Pipeline

### 13.1 Deal Page Header

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to Pipeline                                                  │
├──────────────────────────────────────────────────────────────────────┤
│  Buckhead Tower Development                                           │
│  📍 123 Peachtree St, Atlanta, GA                                    │
│  Deal Team: Leon D, Jeremy Myers                                      │
│                                                                       │
│  JEDI Score: 78  STRONG OPPORTUNITY                                  │
│  Stage: Due Diligence | Priority: High | Tier: Enterprise           │
│                                                                       │
│  [Switch to Grid View]  [Edit Deal]  [Archive]  [⋮ More]            │
├──────────────────────────────────────────────────────────────────────┤
│  [Overview] [Strategy▼] [Properties] [Financial] [Pipeline] [AI]... │
│                                                               [+Add]  │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 13.2 Module Tabs (8 Core + User-Added)

#### Tab 1: Overview (Core - Always Active)
**Sections:**
1. Deal Summary
   - Address, size, unit count, asking price
   - Deal team, priority, stage
2. JEDI Score Card (Level 2 display)
   - Score: 78
   - 5 signals with bars
   - Verdict: STRONG OPPORTUNITY
3. Key Metrics
   - Cap rate, IRR, equity multiple
   - NOI, debt service coverage
4. Market Context (from Market Data Layer)
   - Submarket: Buckhead
   - Rent trend: +4.2% YoY
   - Supply: 68% of capacity
5. Recent Activity
   - Timeline of actions on this deal

---

#### Tab 2: Strategy Arbitrage (Core - FREE)
**Powered by:** Intelligence Compression Framework

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  Strategy Arbitrage                      [▶️ Run Analysis]    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  SELECT STRATEGIES TO COMPARE                                │
│  ☑️ Buy & Hold                                               │
│  ☑️ Value-Add                                                │
│  ☑️ BRRRR (Custom)                                           │
│  ☐ Flip                                                      │
│                                                               │
│  [+ Add Custom Strategy]                                     │
│  ───────────────────────────────────────────────────────────│
│                                                               │
│  ANALYSIS RESULTS (Last run: 2 hours ago)                   │
│                                                               │
│  | Strategy    | JEDI Score | IRR  | EM   | Risk | Verdict │
│  |-------------|------------|------|------|------|---------|│
│  | Buy & Hold  | 78         | 14%  | 1.8x | MED  | 🟢 BUY  │
│  | Value-Add   | 82         | 18%  | 2.2x | HIGH | 🟢 BUY  │
│  | BRRRR       | 75         | 16%  | 2.0x | HIGH | 🟢 BUY  │
│                                                               │
│  RECOMMENDATION: Value-Add strategy scores highest           │
│  Confidence: ±8 points                                       │
│                                                               │
│  [View Detailed Comparison →]                                │
│                                                               │
│  ───────────────────────────────────────────────────────────│
│                                                               │
│  5 MASTER SIGNALS (For Value-Add Strategy)                  │
│                                                               │
│  Demand   ████████░░ 82  [View Details →]                   │
│  Supply   ██████████ 92  [View Details →]                   │
│  Momentum ███████░░░ 75  [View Details →]                   │
│  Position █████████░ 88  [View Details →]                   │
│  Risk     ████░░░░░░ 42  [View Details →]                   │
│                                                               │
│  Click "View Details" to see Method Engine breakdown         │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Progressive Disclosure:**
- Click "View Details" on any signal → Shows which engines powered it
- Example: Click "Demand Signal" → Shows Signal Processing output, Search Trends, Kalman filtering results
- Click "View Detailed Comparison" → Side-by-side all strategies with full assumptions

---

#### Tab 3: Properties
**Purpose:** Manage properties within deal boundary

**Features:**
- List of properties (if existing asset deal)
- Add/remove properties
- Search properties in boundary (uses Market Data Layer)
- Property detail cards

---

#### Tab 4: Financial Modeling (Premium Module - $29/mo)
**Purpose:** Pro forma builder

**Features:**
- Revenue & expense assumptions
- Sensitivity analysis
- Scenario modeling
- Waterfall distributions
- Auto-pulls defaults from Assets Owned Layer (your actual expense ratios)

---

#### Tab 5: Returns Calculator (Premium Module - $19/mo)
**Purpose:** Calculate all return metrics

**Outputs:**
- IRR
- Equity multiple
- Cash-on-cash return
- DSCR
- Exit cap rate
- Profit & Loss waterfall

---

#### Tab 6: Pipeline (Core - Always Active)
**Purpose:** Deal progress tracking

**Layout:** Kanban mini-board
- Tasks by stage (DD, Legal, Financing, Closing)
- Drag tasks between stages
- Assign to team members
- Due dates

---

#### Tab 7: AI Agents (Core - Always Active)
**Purpose:** Chat interface with 6 AI specialists

**Agents:**
1. Chief Orchestrator (router)
2. Property Search
3. Strategy Arbitrage
4. Development Feasibility
5. Market Intelligence
6. Deal Tracker
7. Portfolio Manager

**Chat UI:**
```
┌──────────────────────────────────────────────┐
│  Chief Orchestrator                          │
├──────────────────────────────────────────────┤
│  [Chat messages]                             │
│                                              │
│  User: "What's the rent trend in Buckhead?" │
│                                              │
│  Chief: Routing to Market Intelligence...   │
│                                              │
│  Market Intel: Buckhead rents +4.2% YoY...  │
│                                              │
├──────────────────────────────────────────────┤
│  [Type message...]               [Send]      │
└──────────────────────────────────────────────┘
```

---

#### Tab 8+: User-Added Modules
Examples:
- Comp Analysis
- Development Budget
- Zoning Analysis
- DD Checklist
- Risk Analysis
- Market Snapshot
- Documents
- Deal Deck
- etc. (any of the 30 modules)

---

## 14. User Flows

### 14.1 Flow: Create New Deal

**Trigger:** Click `[➕ Create Deal]` in horizontal bar

**Two Paths:**

**Path A: Quick Add (5-step wizard)**
1. **Category:** Portfolio or Pipeline
2. **Type:** New Development or Existing Property
3. **Address:** Enter address → Geocode → Auto-locate
4. **Boundary:** Draw polygon (new dev) OR auto-pin (existing)
5. **Details:** Name, description, tier, strategy, stage

**Path B: Detailed Add (5-tab form)**

**Tab 1: Basic Info**
- Deal Type: Portfolio / Pipeline
- Development Type: New / Existing
- Name: [_________________]
- Address: [______________]
- Strategy: [Buy & Hold ▼] (includes custom strategies)
- Stage: [Lead ▼]
- Priority: [High / Medium / Low]
- Tags: [_____________]
- Notes: [_____________]
- Attachments: [Upload files]

**Tab 2: Asset Details**

*If Existing Asset:*
- Property Type: [Multifamily ▼]
- Year Built: [____]
- Units: [____]
- Sq Ft: [____]
- Current Occupancy: [___%]
- Class: [A / B / C ▼]

*If New Development:*
- Land Size: [____] acres
- Zoning: [___________]
- Proposed Units: [____]
- Proposed Sq Ft: [____]
- Building Type: [Garden / Mid-Rise / High-Rise ▼]
- Stories: [____]

**Tab 3: Financials**
- Asking Price: [$_________]
- Est. Purchase Price: [$_________]
- Target Cap Rate: [__%]
- Target IRR: [__%]
- Target Equity Multiple: [__x]
- Debt Assumptions:
  - LTV: [__%]
  - Rate: [__%]
  - Amortization: [__ years]

**Tab 4: Deal Team**
- Lead: [Leon D ▼]
- Broker: [___________] (+ Add)
- Lender: [___________] (+ Add)
- Equity Partner: [___________] (+ Add)
- Property Manager: [___________] (+ Add)
- Legal: [___________] (+ Add)

**Tab 5: Settings**
- **Module Selection:**
  - ☑️ Overview (always active)
  - ☑️ Strategy Arbitrage
  - ☑️ Financial Modeling
  - ☐ Comp Analysis
  - ☐ Development Budget
  - ... (list all installed modules)
- **AI Auto-Analyze:**
  - ☑️ Run Strategy Arbitrage on save (results ready when you open deal)
- **Notifications:**
  - ☑️ Email me when analysis complete
  - ☑️ Notify team when deal moves stages

**Navigation:**
- [< Previous] [Next >] buttons
- [Save as Draft] [Create Deal] buttons
- Progress bar: ●●●●○ (Tab 4 of 5)

**After Creation:**
- If AI Auto-Analyze enabled → Analysis runs in background
- Deal appears on map (boundary or pin)
- Deal appears in Pipeline
- Notification when analysis complete
- Open deal page → Modules ready

---

### 14.2 Flow: Analyze a Deal

**Trigger:** Open deal → Strategy Arbitrage tab → [▶️ Run Analysis]

**Process:**

**Step 1: Intelligence Gathering (Invisible)**
- Platform queries Market Data Layer for deal's geography
- Retrieves rent comps, cap rates, market trends
- Platform queries Assets Owned Layer for portfolio benchmarks
- Pulls your actual performance data (expense ratios, returns)

**Step 2: Method Engines Processing (Invisible)**
- **Signal Processing:** Cleans rent data, extracts trends
- **Contagion Model:** Calculates R₀ for gentrification spread
- **Carrying Capacity:** Assesses supply saturation
- **Capital Flow:** Models institutional interest
- **Game Theory:** Analyzes competitive responses
- **Behavioral:** Flags user assumption biases
- **Network:** Identifies key market players
- **Monte Carlo:** Generates probability distributions

**Step 3: Synthesis (Invisible)**
- 8 engine outputs → 5 Master Signals
- 5 signals → JEDI Score (weighted composite)
- Confidence intervals calculated
- Verdict assigned (STRONG OPPORTUNITY / OPPORTUNITY / etc.)

**Step 4: Results Display (User Sees)**

**Level 1 (Traffic Light):**
```
🟢 78 - STRONG OPPORTUNITY
```

**Level 2 (5 Signals Card):**
```
JEDI SCORE: 78
VERDICT: STRONG OPPORTUNITY
Confidence: ±8 points

Demand   ████████░░ 82
Supply   ██████████ 92
Momentum ███████░░░ 75
Position █████████░ 88
Risk     ████░░░░░░ 42

[View Details →]
```

**Level 3 (Engine Details - Click "View Details"):**
Shows:
- Which engines powered each signal
- Raw data sources
- Methodology explanations
- Bias alerts (if any)

**Level 4 (Raw Data - Export Button):**
- CSV export of all data
- API access to engine outputs

**Time:** 5-30 seconds (depends on data volume)

**Notification:** Email + in-app notification when complete

---

### 14.3 Flow: Add Properties to Deal

**Trigger:** Deal page → Properties tab → [+ Add Properties]

**Options:**

**Option 1: Search in Boundary**
- Searches Market Data Layer for properties within deal boundary
- Returns list of properties with:
  - Address, units, class, rent
  - Add button (adds to deal's property list)

**Option 2: Import from Assets Owned**
- If deal is in your target neighborhood
- Shows your existing properties nearby
- Can add as comps or as part of portfolio deal

**Option 3: Manual Entry**
- Enter address
- Geocode → Verify location
- Enter property details
- Save to deal

---

### 14.4 Flow: Layer Custom Map on Dashboard

**Trigger:** Dashboard → Want to see "Competitor Analysis" map overlay

**Steps:**
1. Dashboard loads (default view)
2. Click "Competitor Analysis" button in horizontal bar
3. Map overlays competitor markers/annotations
4. Can toggle on/off
5. Can activate War Maps to see all custom maps simultaneously

---

### 14.5 Flow: Collaborate on Custom Map

**Trigger:** Create map for team research

**Steps:**
1. Click [➕ Create Map]
2. Name: "Midtown Research"
3. ☑️ Share with team
4. Create map
5. Draw boundaries, add pins, annotate
6. Team members see map in their horizontal bar
7. Team can add their own annotations
8. Comments appear in activity feed

---

## 15. Data Flow Architecture

**Complete System Flow:**

```
┌────────────────────────────────────────────────────────────────┐
│  EXTERNAL DATA SOURCES                                         │
├────────────────────────────────────────────────────────────────┤
│  • CoStar (rent comps, cap rates, transactions)               │
│  • ApartmentIQ (real-time property data, search trends)       │
│  • Census (demographics, migration)                            │
│  • Building permits (supply pipeline)                          │
│  • News APIs (market sentiment)                                │
│  • Traffic data (location quality)                             │
└────────────────────────────────────────────────────────────────┘
                         ↓ ETL pipelines
┌────────────────────────────────────────────────────────────────┐
│  LAYER 1: DATA COLLECTION (PostgreSQL + PostGIS)              │
├────────────────────────────────────────────────────────────────┤
│  Raw data storage:                                             │
│  • Parcels (171K Fulton County)                               │
│  • Transactions                                                │
│  • Rents                                                       │
│  • Permits                                                     │
│  • Traffic                                                     │
└────────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────────┐
│  INTELLIGENCE LAYERS (Platform Services)                       │
├────────────────────────────────────────────────────────────────┤
│  📊 Market Data Layer                                          │
│  • Aggregates raw data → submarket metrics                    │
│  • Time-series trends                                          │
│  • Auto-links to deals by geography                           │
│                                                                │
│  🏢 Assets Owned Layer                                         │
│  • Your portfolio data                                         │
│  • Benchmarking vs market                                     │
│  • Contributes anonymized data back to Market Data            │
└────────────────────────────────────────────────────────────────┘
                         ↓ Feeds intelligence
┌────────────────────────────────────────────────────────────────┐
│  LAYER 2: METHOD ENGINES (Python Services - Invisible)        │
├────────────────────────────────────────────────────────────────┤
│  🧠 8 Engines process Intelligence Layer data:                │
│  1. Signal Processing → Clean signals                         │
│  2. Contagion Model → Trend spread (R₀)                       │
│  3. Carrying Capacity → Supply saturation                     │
│  4. Capital Flow → Investment patterns                        │
│  5. Game Theory → Competitive responses                       │
│  6. Behavioral → Bias detection                               │
│  7. Network → Relationship mapping                            │
│  8. Monte Carlo → Probability distributions                   │
│                                                                │
│  Cached in Redis for performance                              │
└────────────────────────────────────────────────────────────────┘
                         ↓ Synthesizes outputs
┌────────────────────────────────────────────────────────────────┐
│  LAYER 3: SYNTHESIS (TypeScript Aggregation)                  │
├────────────────────────────────────────────────────────────────┤
│  📈 5 Master Signals:                                         │
│  • Demand Signal                                               │
│  • Supply Signal                                               │
│  • Momentum Signal                                             │
│  • Position Signal                                             │
│  • Risk Signal                                                 │
│                                                                │
│  🎯 JEDI Score: Weighted composite of 5 signals               │
└────────────────────────────────────────────────────────────────┘
                         ↓ Feeds modules
┌────────────────────────────────────────────────────────────────┐
│  MODULES (User-Activated Per Deal)                            │
├────────────────────────────────────────────────────────────────┤
│  • Strategy Arbitrage (uses all 5 signals)                    │
│  • Financial Modeling (uses Market Data + Assets Owned)       │
│  • Comp Analysis (uses Market Data Layer)                     │
│  • Returns Calculator (uses Assets Owned benchmarks)          │
│  • Market Snapshot (visualizes Market Data Layer)             │
│  • Budget vs Actual (uses Assets Owned Layer)                 │
│  • ... (28 other modules)                                     │
└────────────────────────────────────────────────────────────────┘
                         ↓ Displays in
┌────────────────────────────────────────────────────────────────┐
│  LAYER 4: USER INTERFACE (React Components)                   │
├────────────────────────────────────────────────────────────────┤
│  🗺️ Central Map Canvas                                        │
│  • Horizontal bar (map layers)                                │
│  • Vertical sidebar (data overlays)                           │
│  • Map with all layers                                        │
│                                                                │
│  📁 Deal Pages                                                 │
│  • Module tabs                                                 │
│  • JEDI Score cards                                           │
│  • Progressive disclosure (traffic light → full analysis)     │
│                                                                │
│  🛒 Module Marketplace                                         │
│  • Browse, purchase, install modules                          │
└────────────────────────────────────────────────────────────────┘
                         ↑
                    USER ACTIONS
                    (clicks, draws, creates deals)
```

---

# PART 5: IMPLEMENTATION

## 16. Progressive Disclosure Model

**Philosophy:** Start simple, reveal depth on demand

### 16.1 Four Levels

| Level | What User Sees | Time to Understand | Use Case |
|-------|----------------|-------------------|----------|
| **Level 1** | Traffic Light (🟢🟡🔴) | 2 seconds | "Should I look at this?" |
| **Level 2** | 5 Signals + JEDI Score | 30 seconds | "What's driving this?" |
| **Level 3** | Engine Details + Methodology | 5 minutes | "Show me the math" (power users) |
| **Level 4** | Raw Data Access | Unlimited | "Run my own analysis" (quants) |

### 16.2 Implementation Pattern

**Every Intelligence Display:**

**Default View (Level 1):**
```
🟢 78
```

**Click to Expand (Level 2):**
```
JEDI Score: 78
Confidence: ±8

Demand   ██████████ 82
Supply   ██████████ 92
Momentum ███████░░░ 75
Position █████████░ 88
Risk     ████░░░░░░ 42

[View Details →]
```

**Click "View Details" (Level 3):**
```
DEMAND SIGNAL: 82/100 (STRONG)

Powered by:
• Signal Processing Engine
  └─ Kalman filter: +4.2% true rent growth
  └─ Seasonal decomposition: Q1 peak
• Search Trends
  └─ "Buckhead apartments" +28% QoQ

Data Sources:
• Market Data Layer (CoStar + ApartmentIQ)
• 247 comparable transactions (last 12mo)

Confidence: ±12%

[Export Raw Data →]
```

**Click "Export Raw Data" (Level 4):**
- CSV download with all data points
- API endpoint documented
- Python/R code examples

---

## 17. Technical Architecture

### 17.1 Technology Stack

**Frontend:**
- React 18
- TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Mapbox GL JS (maps)
- Recharts (visualizations)
- Zustand (state management)

**Backend:**
- NestJS (TypeScript framework)
- PostgreSQL (database)
- PostGIS (spatial queries)
- Redis (caching engine outputs)
- Python 3.10+ (method engines)

**Python Libraries (Method Engines):**
- NumPy, SciPy (Signal Processing, Monte Carlo)
- NetworkX (Network Science)
- Pandas, GeoPandas (data manipulation)
- scikit-learn (machine learning)
- PyMC (Bayesian modeling)

**Infrastructure:**
- Cloudflare Pages (frontend hosting)
- Supabase (managed PostgreSQL)
- Cloudflare Workers (edge compute)
- Redis Cloud (caching)

---

### 17.2 Database Schema

**Core Tables (Existing):**
- `users` - User accounts
- `deals` - All deals (portfolio + pipeline)
- `properties` - Properties (Assets Owned + deal properties)
- `deal_properties` - Join table (deals ↔ properties)
- `custom_maps` - User-created maps
- `annotations` - Map annotations
- `deal_activity` - Activity log
- `team_members` - Deal team assignments

**New Tables (v3.0):**

**Intelligence Layers:**
- `market_data_submarkets` - Submarket metrics
- `market_data_timeseries` - Historical trends
- `portfolio_benchmarks` - Assets Owned aggregations

**Module System:**
- `modules` - Module catalog (30 modules)
- `user_modules` - Purchased modules per user
- `deal_modules` - Active modules per deal
- `module_configurations` - Module settings per deal

**Custom Strategies:**
- `custom_strategies` - User-created strategies
- `strategy_assumptions` - Revenue/expense assumptions per strategy
- `strategy_community` - Shared strategies

**Method Engines (Cached):**
- `engine_outputs` - Cached engine results
- `signal_history` - 5 Master Signals over time
- `jedi_scores` - Historical JEDI Scores per deal

---

### 17.3 API Architecture

**Base URL:** `https://api.jedire.com/v1`

**Intelligence Layers:**
- `GET /market-data/submarkets` - List tracked submarkets
- `GET /market-data/submarkets/:id` - Submarket details
- `GET /market-data/submarkets/:id/timeseries` - Historical trends
- `GET /portfolio/benchmarks` - Your portfolio benchmarks

**Method Engines:**
- `POST /engines/analyze/:dealId` - Trigger full analysis
- `GET /engines/outputs/:dealId` - Cached engine results
- `GET /signals/:dealId` - 5 Master Signals
- `GET /jedi-score/:dealId` - JEDI Score + verdict

**Modules:**
- `GET /modules` - Module catalog
- `POST /modules/:id/install` - Install module
- `DELETE /modules/:id/uninstall` - Uninstall module
- `POST /deals/:id/modules` - Add module to deal
- `DELETE /deals/:id/modules/:moduleId` - Remove module from deal
- `PATCH /deals/:id/modules/:moduleId/config` - Update module config
- `PUT /deals/:id/modules/reorder` - Reorder module tabs

**Custom Strategies:**
- `GET /strategies` - User's custom strategies
- `POST /strategies` - Create new strategy
- `GET /strategies/:id` - Strategy details
- `PATCH /strategies/:id` - Update strategy
- `DELETE /strategies/:id` - Delete strategy
- `POST /strategies/:id/clone` - Clone strategy
- `GET /strategies/community` - Browse community strategies

**Deals:**
- `POST /deals` - Create deal (Enhanced Create Deal flow)
- `GET /deals/:id` - Deal details + modules
- `POST /deals/:id/analyze` - Run Strategy Arbitrage
- `GET /deals/:id/analysis` - Analysis results

---

### 17.4 WebSocket Architecture

**Real-Time Features:**
- Analysis progress updates ("Signal Processing: 40%...")
- Team collaboration (live annotations on custom maps)
- Activity feed updates
- Notification delivery

**Socket.io Namespaces:**
- `/analysis` - Analysis job progress
- `/maps` - Custom map collaboration
- `/deals/:id` - Deal-specific updates

---

## 18. Implementation Roadmap

### Phase 0: Foundation (Weeks 1-2)
**Goal:** Add missing pieces to existing 60-70% complete codebase

**Tasks:**
1. Database migrations for new tables (Intelligence Layers, Modules, Strategies)
2. Redis setup for engine output caching
3. API endpoint scaffolding (module marketplace, custom strategies)
4. Frontend routing for new pages (Module Marketplace, Custom Strategies)

---

### Phase 1: Intelligence Compression (Weeks 3-6)
**Goal:** Build the 8 Method Engines + 5 Master Signals

**Tasks:**
1. **Core Engines (Week 3-4):**
   - Signal Processing engine (already built: `signal_processing.py`)
   - Carrying Capacity engine (already built: `capacity_analyzer.py`)
   - Contagion Model (new: epidemiological R₀)
   - Validate against historical data

2. **Additional Engines (Week 5):**
   - Capital Flow modeling
   - Game Theory simulator
   - Behavioral bias detector
   - Network Science mapper
   - Monte Carlo scenarios

3. **Synthesis Layer (Week 6):**
   - 5 Master Signals aggregation service
   - JEDI Score composite algorithm
   - Confidence interval calculations
   - Verdict assignment logic

---

### Phase 2: Module Marketplace (Weeks 7-10)
**Goal:** Build marketplace UI + module activation system

**Tasks:**
1. **Marketplace Backend (Week 7):**
   - Module catalog API
   - Install/uninstall endpoints
   - Subscription management (Stripe integration)
   - Usage tracking

2. **Marketplace Frontend (Week 8):**
   - Browse UI (categories, search, filters)
   - Module detail pages
   - Purchase flow
   - Bundle pricing

3. **Per-Deal Module System (Week 9):**
   - Module tab rendering system
   - Drag-to-reorder tabs
   - Module configuration panels
   - Module context menu (pin, refresh, disable)

4. **Custom Strategy Builder (Week 10):**
   - Create/edit strategy UI
   - Assumption inputs (revenue, expenses, financing)
   - AI scoring rules configuration
   - Community sharing

---

### Phase 3: Intelligence Layers UI (Weeks 11-13)
**Goal:** Surface Intelligence Layers in UI

**Tasks:**
1. **Market Data Layer (Week 11):**
   - Sidebar section: "📊 Market Data"
   - Market Data dashboard (tracked submarkets)
   - Submarket detail pages
   - Auto-linking to deals by geography

2. **Assets Owned Layer (Week 12):**
   - Sidebar section: "🏢 Assets Owned"
   - Map View (property markers with detail cards)
   - Grid View (portfolio management interface)
   - Lease intelligence dashboard
   - Budget vs Actual reporting

3. **Data Flow Visualization (Week 13):**
   - Show how Intelligence Layers feed modules
   - "Powered by Market Data" labels in modules
   - Data lineage tooltips
   - Confidence score displays

---

### Phase 4: Progressive Disclosure (Weeks 14-16)
**Goal:** Implement 4-level disclosure model

**Tasks:**
1. **Level 1 & 2 (Week 14):**
   - Traffic light indicator (🟢🟡🔴)
   - JEDI Score card component
   - 5 Signals display with bars
   - Expandable cards

2. **Level 3 (Week 15):**
   - Engine detail modals
   - Methodology explanations
   - Data source lists
   - Bias alerts display

3. **Level 4 (Week 16):**
   - Raw data export buttons
   - CSV generation
   - API documentation pages
   - Code examples (Python, R)

---

### Phase 5: Polish & Launch (Weeks 17-20)
**Goal:** Production-ready MVP

**Tasks:**
1. **Performance (Week 17):**
   - Engine output caching (Redis)
   - Map clustering (large datasets)
   - Lazy loading modules
   - Code splitting

2. **Testing (Week 18):**
   - End-to-end user flows
   - Module activation testing
   - Analysis accuracy validation
   - Load testing

3. **Documentation (Week 19):**
   - User guides for each module
   - Video tutorials
   - API documentation
   - Architecture overview

4. **Launch (Week 20):**
   - Beta testing with 10 users
   - Feedback incorporation
   - Production deployment
   - Marketing launch

---

## 19. Success Metrics

**How We'll Know v3.0 Is Working:**

### User Metrics
- **Time to Decision:** 2 hours → 5 minutes (target: 96% reduction)
- **User Satisfaction:** "Easy to understand" >85%
- **Feature Discovery:** Users find and use >5 modules within first week
- **Module Adoption:** >60% of users purchase at least one premium module

### Technical Metrics
- **Analysis Speed:** JEDI Score generated in <30 seconds
- **Cache Hit Rate:** >80% (engine outputs cached in Redis)
- **Uptime:** 99.5% availability
- **API Response Time:** <200ms for 95% of requests

### Business Metrics
- **Module Revenue:** $50K MRR from premium modules within 3 months
- **Bundle Conversion:** 40% of paid users choose bundles over individual modules
- **Custom Strategy Creation:** >500 custom strategies created in first 6 months
- **Community Sharing:** 20% of custom strategies shared publicly

---

## 20. Design Principles Summary

**Core Philosophies:**

1. **Synthesis Over Accumulation**
   - Method engines produce fewer, better signals
   - Not more data, but higher confidence

2. **Confidence Over Precision**
   - Show ranges + reliability (±8 points)
   - Don't pretend false precision ("IRR: 14.73%")

3. **Progressive Disclosure**
   - Simple first (traffic light)
   - Depth on demand (engine details)
   - 80% of users never go past Level 2

4. **Bias Awareness**
   - Alert users to their own blind spots
   - "Warning: Anchoring detected"
   - Build trust by admitting uncertainty

5. **Action Orientation**
   - Every output answers "what should I do?"
   - Traffic light → BUY / INVESTIGATE / PASS
   - Not just analysis, but decision support

6. **Explainability**
   - "Why this score?" always available
   - One click to see methodology
   - Builds trust through transparency

---

## 21. Key Differentiators

**What Makes JEDI RE v3.0 Unique:**

1. **Intelligence Compression**
   - 8 invisible engines vs. 50 visible dashboards
   - Users see synthesis, not raw data

2. **Interdisciplinary Methods**
   - Borrows from epidemiology, ecology, fluid dynamics, game theory
   - Not just financial models, but market science

3. **Platform Intelligence Layers**
   - Market Data Layer auto-links to deals by geography
   - Assets Owned Layer creates network effect (more users = better data)

4. **Modular Architecture**
   - Users build custom workflows
   - Purchase only what they need
   - Unlimited custom strategies

5. **Progressive Disclosure**
   - Scales from novice (traffic light) to quant (raw data)
   - Same platform serves all skill levels

6. **Confidence-First Design**
   - Every metric has confidence interval
   - Platform tells you when NOT to trust the data
   - Builds long-term trust vs. false confidence

---

## Appendix A: File Structure

```
jedire/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── intelligence/
│   │   │   │   ├── JEDIScoreCard.tsx
│   │   │   │   ├── SignalDisplay.tsx
│   │   │   │   ├── EngineDetail.tsx
│   │   │   │   └── ProgressiveDisclosure.tsx
│   │   │   ├── modules/
│   │   │   │   ├── ModuleMarketplace.tsx
│   │   │   │   ├── ModuleDetailPage.tsx
│   │   │   │   ├── ModuleTabs.tsx
│   │   │   │   └── ModuleConfig.tsx
│   │   │   ├── strategies/
│   │   │   │   ├── CustomStrategyBuilder.tsx
│   │   │   │   ├── StrategyList.tsx
│   │   │   │   └── CommunityStrategies.tsx
│   │   │   ├── map/
│   │   │   │   ├── MapCanvas.tsx
│   │   │   │   ├── HorizontalBar.tsx
│   │   │   │   ├── VerticalSidebar.tsx
│   │   │   │   ├── WarMaps.tsx
│   │   │   │   └── CustomMapControls.tsx
│   │   │   └── deal/
│   │   │       ├── DealPage.tsx
│   │   │       ├── StrategyArbitrage.tsx
│   │   │       ├── CreateDealModal.tsx
│   │   │       └── ModuleTabRenderer.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── MarketDataDashboard.tsx
│   │   │   ├── AssetsOwnedDashboard.tsx
│   │   │   ├── PipelinePage.tsx
│   │   │   └── ModuleMarketplacePage.tsx
│   │   └── stores/
│   │       ├── intelligenceStore.ts
│   │       ├── moduleStore.ts
│   │       ├── strategyStore.ts
│   │       └── dealStore.ts
│   └── ...
├── backend/
│   ├── src/
│   │   ├── intelligence/
│   │   │   ├── market-data.service.ts
│   │   │   ├── assets-owned.service.ts
│   │   │   ├── synthesis.service.ts
│   │   │   └── jedi-score.service.ts
│   │   ├── modules/
│   │   │   ├── modules.service.ts
│   │   │   ├── modules.controller.ts
│   │   │   └── dto/
│   │   ├── strategies/
│   │   │   ├── strategies.service.ts
│   │   │   ├── strategies.controller.ts
│   │   │   └── dto/
│   │   ├── deals/
│   │   │   ├── deals.service.ts
│   │   │   ├── deal-analysis.service.ts
│   │   │   └── dto/
│   │   └── engines/
│   │       ├── engine-orchestrator.service.ts
│   │       └── cache.service.ts
│   ├── python-services/
│   │   ├── signal_processing.py
│   │   ├── contagion_model.py
│   │   ├── carrying_capacity.py
│   │   ├── capital_flow.py
│   │   ├── game_theory.py
│   │   ├── behavioral.py
│   │   ├── network_science.py
│   │   ├── monte_carlo.py
│   │   └── synthesis.py
│   └── ...
├── database/
│   ├── migrations/
│   │   ├── 020_intelligence_layers.sql
│   │   ├── 021_module_marketplace.sql
│   │   ├── 022_custom_strategies.sql
│   │   └── 023_engine_cache.sql
│   └── seeds/
│       └── modules_catalog.sql
└── docs/
    ├── WIREFRAME_V3.0.md (this file)
    ├── INTELLIGENCE_COMPRESSION_FRAMEWORK.md
    ├── MODULE_MARKETPLACE_ARCHITECTURE.md
    └── COMPLETE_PLATFORM_WIREFRAME.md
```

---

## Appendix B: Glossary

**Intelligence Layers:** Platform-level services (Market Data + Assets Owned) that run continuously and feed data to deals and modules.

**Method Engines:** 8 invisible processors (Signal Processing, Contagion, Carrying Capacity, Capital Flow, Game Theory, Behavioral, Network, Monte Carlo) that transform raw data into synthesized signals.

**Master Signals:** 5 synthesized outputs (Demand, Supply, Momentum, Position, Risk) that compress all intelligence into actionable insights.

**JEDI Score:** Single composite number (0-100) that rolls up all 5 Master Signals into one decision metric.

**Progressive Disclosure:** UX pattern that starts simple (traffic light) and reveals depth on demand (engine details, raw data).

**Module:** Purchasable feature that extends deal functionality (e.g., Financial Modeling, Comp Analysis).

**Custom Strategy:** User-created investment strategy with custom assumptions, target returns, and AI scoring rules.

**War Maps:** Master layer that combines all custom maps for simultaneous viewing.

**Grid View:** Detailed management interface for Assets Owned or Pipeline (vs. Map View).

**Synthesis:** The process of compressing multiple data sources into fewer, higher-confidence signals.

---

## Document Control

**Version:** 3.0  
**Date:** 2026-02-07  
**Status:** Master Specification - Implementation Ready  
**Authors:** Leon D, RocketMan  
**Next Review:** After Phase 0 completion (Week 2)  
**Git:** Commit with message: "Wireframe v3.0 - Complete platform specification integrating Intelligence Layers, Module Marketplace, and Compression Framework"

---

## 🎯 TL;DR

**v3.0 in One Sentence:**

JEDI RE is a real estate intelligence platform where **8 invisible method engines** (Signal Processing, Contagion, Carrying Capacity, Capital Flow, Game Theory, Behavioral, Network, Monte Carlo) process **2 platform-level intelligence layers** (Market Data + Assets Owned) into **5 master signals** (Demand, Supply, Momentum, Position, Risk) that feed **30 purchasable modules** displayed on a **central map canvas**, all synthesized into a **single JEDI Score** that tells users in 2 seconds: "Should I buy this deal?"

**The Magic:**

Users see a traffic light. Behind the scenes, 8 interdisciplinary engines borrowed from epidemiology, ecology, fluid dynamics, and game theory are running invisible analyses. The platform compresses overwhelming data into simple, confident actions.

**The Difference:**

Traditional platforms: 50 dashboards → User drowns in data
JEDI RE: 8 engines → 5 signals → 1 score → Simple decision

**Philosophy:**

*"Users don't need more data. They need to know how much to trust the data they have."*

---

**End of Wireframe v3.0** 🚀
