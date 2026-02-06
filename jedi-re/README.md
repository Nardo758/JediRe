# JEDI RE - Intelligence Compression Framework
**Phase 1: Supply-Demand Imbalance Detection**

## What This Is

A real estate intelligence system that **synthesizes** data instead of overwhelming you with it. Built on interdisciplinary methods from signal processing, ecology, game theory, and epidemiology.

### Core Principle
> Users don't need more data. They need to know how much to trust the data they have.

---

## What I Built (Phase 1)

### ✅ Method Engine #1: Signal Processing
**File:** `src/signal_processing.py`

Cleans noise from rent data using:
- **Kalman filtering** - Extracts true market signal from noisy transactions
- **Fourier transforms** - Decomposes rent into trend + seasonal components
- **Confidence scoring** - Tells you how much to trust the signal

**Output:** Clean rent trend + confidence interval

### ✅ Method Engine #2: Carrying Capacity
**File:** `src/carrying_capacity.py`

Calculates sustainable supply levels using ecological principles:
- **Demand capacity** - Max units a submarket can support
- **Saturation analysis** - Supply vs demand balance
- **Equilibrium timeline** - Quarters until market balances

**Output:** UNDERSUPPLIED / BALANCED / OVERSUPPLIED verdict + confidence

### ✅ Synthesized Signal: Supply-Demand Imbalance Detector
**File:** `src/imbalance_detector.py`

Combines both engines into actionable verdicts:
- **STRONG_OPPORTUNITY** - Buy signal
- **MODERATE_OPPORTUNITY** - Solid fundamentals
- **NEUTRAL** - Market is balanced
- **CAUTION** - Underwrite conservatively
- **AVOID** - Pass on new investments

**Output:** One clear verdict + detailed breakdown

---

## Project Structure

```
jedi-re/
├── src/
│   ├── signal_processing.py      # Method Engine #1 (DONE)
│   ├── carrying_capacity.py      # Method Engine #2 (DONE)
│   ├── imbalance_detector.py     # Synthesized Signal (DONE)
│   └── database_schema.sql       # PostgreSQL schema (DONE)
├── tests/                         # Unit tests (TODO)
├── docs/                          # Documentation (TODO)
├── data/                          # Sample data (TODO)
├── requirements.txt               # Python dependencies
└── README.md                      # This file
```

---

## Quick Start

### 1. Install Dependencies

```bash
# Install Python packages
pip install -r requirements.txt

# Or with conda
conda install numpy scipy
```

### 2. Test the Imbalance Detector

```bash
cd jedi-re
python3 src/imbalance_detector.py
```

You should see output like:

```
======================================================================
SUPPLY-DEMAND IMBALANCE ANALYSIS
======================================================================

SUBMARKET: Buckhead, Atlanta
VERDICT: CAUTION
COMPOSITE SCORE: 38/100 (±22 pts)

──────────────────────────────────────────────────────────────────────

DEMAND SIGNAL: MODERATE ●●●○○
  Score: 56/100
  Demand is moderate with rent growth at +2.8% annually and strong 
  search interest (+15% YoY) supported by net in-migration of 580 
  people/year.

SUPPLY SIGNAL: OVERSUPPLIED ●●●●○
  Saturation: 113.5%
  Buckhead, Atlanta is oversupplied with 113.5% saturation (+13.5%). 
  Excess supply will take ~23 quarters to absorb. Exercise caution 
  with new investments.

──────────────────────────────────────────────────────────────────────

RECOMMENDATION:
  Exercise caution in Buckhead, Atlanta. Supply is oversupplied with 
  moderate demand. Expect 23 quarters until equilibrium. Underwrite 
  conservatively.

KEY FACTORS:
  ✓ Population influx: +580 net migration
  ✓ Rising interest: search volume +15%

RISKS:
  ⚠ Oversupply: 3,260 units in pipeline
  ⚠ Long absorption: 23 quarters to equilibrium

======================================================================
```

### 3. Use the Engines Programmatically

```python
from signal_processing import SignalProcessor
from carrying_capacity import CarryingCapacityEngine, SubmarketData
from imbalance_detector import ImbalanceDetector

# Your rent data (weekly or monthly)
rent_timeseries = [2000, 2010, 2005, 2015, ...]  # Your actual data

# Submarket fundamentals
submarket = SubmarketData(
    name="Your Submarket",
    population=50_000,
    population_growth_rate=0.015,  # 1.5% annual
    net_migration_annual=750,
    employment=40_000,
    employment_growth_rate=0.02,   # 2% annual
    median_income=85_000,
    existing_units=12_000,
    pipeline_units=1_500,
    future_permitted_units=300
)

# Analyze
detector = ImbalanceDetector()
result = detector.analyze_imbalance(
    submarket,
    rent_timeseries,
    search_trend_change=0.12  # 12% increase in search volume
)

# Access results
print(f"Verdict: {result.verdict.value}")
print(f"Score: {result.composite_score}/100")
print(f"Confidence: {result.confidence:.0%}")
print(f"Recommendation: {result.recommendation}")
```

---

## Database Setup

### PostgreSQL + TimescaleDB

```bash
# Install PostgreSQL (if not installed)
sudo apt install postgresql postgresql-contrib

# Install TimescaleDB extension
sudo apt install timescaledb-postgresql

# Create database
sudo -u postgres psql
CREATE DATABASE jedire;
\c jedire

# Run schema
\i src/database_schema.sql
```

---

## What's Next (Phase 2-4)

### Phase 2: Competitive Intelligence (Months 4-6)
- [ ] Method Engine #3: Game Theory (concession wars, pricing strategy)
- [ ] Method Engine #4: Network Science (deal flow, super-connectors)
- [ ] Synthesized Signal: Position Signal (ADVANTAGED/NEUTRAL/DISADVANTAGED)

### Phase 3: Predictive Intelligence (Months 7-9)
- [ ] Method Engine #5: Contagion Model (trend propagation, R₀ calculation)
- [ ] Method Engine #6: Monte Carlo (probabilistic modeling, tail risks)
- [ ] Synthesized Signal: Momentum Signal (ACCELERATING/STABLE/DECELERATING)

### Phase 4: Full JEDI Score (Months 10-12)
- [ ] Method Engine #7: Behavioral Economics (bias detection)
- [ ] Method Engine #8: Capital Flow (institutional capital tracking)
- [ ] Unified JEDI Score (0-100 composite)
- [ ] Progressive disclosure UI (4 levels: Traffic Light → Signals → Methodology → Raw Data)

---

## Architecture Philosophy

### Invisible Intelligence
Users interact with **simple verdicts**, not complex dashboards. The interdisciplinary methods run in the background, producing **fewer, better signals** with **confidence scores**.

### Progressive Disclosure
- **Level 1:** Traffic Light (🟢 🟡 🔴) - 2 second decision
- **Level 2:** 5 Master Signals + Score - 30 second understanding
- **Level 3:** Method Engine Details - Power users
- **Level 4:** Raw Data Access - Quants

### Synthesis Over Accumulation
Every new feature must **compress intelligence**, not add cognitive load.

---

## Testing

Run individual engines:

```bash
# Test signal processing
python3 src/signal_processing.py

# Test carrying capacity
python3 src/carrying_capacity.py

# Test imbalance detector (combines both)
python3 src/imbalance_detector.py
```

---

## Contributing

This is Phase 1. Focus areas:
1. **Data integration** - Connect to real rent scrapers, census API, DOT traffic
2. **UI prototype** - Build the progressive disclosure interface
3. **Backtesting** - Validate signals against historical deals
4. **Method refinement** - Tune weights, thresholds, confidence calculations

---

## Contact

Leon D - Real Estate + Tech
- Telegram: @MikieLikie01
- Focus: Multifamily (Southeast US, Texas)

---

## License

Proprietary. JEDI RE Intelligence Compression Framework.
