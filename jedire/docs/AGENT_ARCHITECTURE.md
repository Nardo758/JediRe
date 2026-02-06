# JEDI RE - Agent Architecture
**Modular Intelligence: Specialized Agents → Orchestrator**

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                             │
│                                                                 │
│  • Receives analysis request (submarket_id)                    │
│  • Coordinates all agents                                      │
│  • Synthesizes results into unified verdict                    │
│  • Returns composite intelligence                              │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Coordinates
             │
    ┌────────┴────────┬────────────┬────────────┬───────────────┐
    │                 │            │            │               │
    ▼                 ▼            ▼            ▼               ▼
┌─────────┐    ┌──────────┐  ┌─────────┐  ┌─────────┐   ┌──────────┐
│ Demand  │    │  Supply  │  │ Dev Cap │  │Position │   │   Risk   │
│ Agent   │    │  Agent   │  │ Agent   │  │ Agent   │   │  Agent   │
└─────────┘    └──────────┘  └─────────┘  └─────────┘   └──────────┘
     │              │             │             │              │
     │              │             │             │              │
     ▼              ▼             ▼             ▼              ▼
┌─────────┐    ┌──────────┐  ┌─────────┐  ┌─────────┐   ┌──────────┐
│ Signal  │    │ Carrying │  │ Parcel  │  │  Game   │   │  Monte   │
│Process  │    │ Capacity │  │Analysis │  │ Theory  │   │  Carlo   │
│Engine   │    │ Engine   │  │ Zoning  │  │ Network │   │Behavior  │
└─────────┘    └──────────┘  └─────────┘  └─────────┘   └──────────┘
```

---

## Agent Responsibilities

### 🎯 Orchestrator
**Role:** Coordinator and synthesizer

```python
class AnalysisOrchestrator:
    def analyze_submarket(self, submarket_id):
        """Coordinate all agents and synthesize results"""
        
        # 1. Gather base data
        submarket = db.get_submarket(submarket_id)
        
        # 2. Invoke agents in parallel (where possible)
        demand_result = DemandAgent.analyze(submarket_id)
        
        # Development Capacity feeds into Supply
        dev_capacity = DevelopmentCapacityAgent.analyze(submarket_id)
        supply_result = SupplyAgent.analyze(submarket_id, dev_capacity)
        
        # Position and Risk can run in parallel
        position_result = PositionAgent.analyze(submarket_id)
        risk_result = RiskAgent.analyze(submarket_id)
        
        # 3. Synthesize into unified verdict
        composite_score = self.calculate_composite(
            demand_result,
            supply_result,
            position_result,
            risk_result
        )
        
        verdict = self.determine_verdict(composite_score)
        
        return {
            'verdict': verdict,
            'score': composite_score,
            'demand': demand_result,
            'supply': supply_result,  # Now includes dev capacity
            'position': position_result,
            'risk': risk_result
        }
```

---

### 📊 Demand Agent
**Specialization:** Rent trends, migration, search interest

**Method Engines:**
- Signal Processing (Kalman, Fourier)
- Search Trends (Google Trends)
- Migration Analysis

**Inputs:**
- Rent timeseries data
- Search volume trends
- Population/migration stats

**Output:**
```python
{
    'strength': 'STRONG' | 'MODERATE' | 'WEAK',
    'score': 0-100,
    'confidence': 0-1,
    'rent_growth_rate': float,
    'search_trend_change': float,
    'migration_annual': int,
    'summary': str
}
```

---

### 🏗️ Supply Agent
**Specialization:** Short-term + long-term supply analysis

**Method Engines:**
- Carrying Capacity (existing + pipeline)
- **Development Capacity** (receives from Dev Cap Agent)

**Inputs:**
- Existing inventory
- Pipeline (under construction + permitted)
- **Development capacity data** (from Dev Cap Agent)

**Output:**
```python
{
    'short_term': {
        'existing': int,
        'pipeline': int,
        'total': int,
        'timeline': '0-2 years'
    },
    'long_term': {
        'development_capacity': DevCapacityResult,  # From Dev Cap Agent
        'timeline': '2-10 years'
    },
    'saturation_pct': float,
    'supply_timing_risk': {
        'near_term': 'LOW' | 'MODERATE' | 'HIGH',
        'long_term_overhang': 'LOW' | 'MODERATE' | 'HIGH',
        'verdict': str
    },
    'equilibrium_quarters': int,
    'verdict': 'UNDERSUPPLIED' | 'BALANCED' | 'OVERSUPPLIED',
    'summary': str
}
```

---

### 🔨 Development Capacity Agent
**Specialization:** Parcel-level development potential

**Method Engines:**
- Zoning Rules Engine
- Probability Scoring Model
- Assemblage Analyzer

**Inputs:**
- Parcel boundaries (GIS)
- Zoning codes
- Current development
- Building age, ownership, etc.

**Process:**
```python
class DevelopmentCapacityAgent:
    def analyze(self, submarket_id):
        """Analyze all parcels in submarket"""
        
        # 1. Get all parcels
        parcels = db.get_parcels(submarket_id)
        
        # 2. Calculate capacity for each parcel
        results = []
        for parcel in parcels:
            # Calculate theoretical max
            max_units = ZoningRulesEngine.calculate_max_units(parcel)
            
            # Score development probability
            probability = ProbabilityModel.score(parcel)
            
            # Effective capacity
            effective = max_units * probability
            
            results.append({
                'parcel_id': parcel.id,
                'theoretical': max_units,
                'probability': probability,
                'effective': effective,
                'category': self.categorize(parcel, max_units)
            })
        
        # 3. Identify assemblage opportunities
        assemblages = AssemblageAnalyzer.find_opportunities(parcels)
        
        # 4. Aggregate
        return {
            'vacant_developable': {
                'theoretical': sum(p['theoretical'] for p in results if p['category'] == 'vacant'),
                'effective': sum(p['effective'] for p in results if p['category'] == 'vacant'),
                'parcels': [p for p in results if p['category'] == 'vacant']
            },
            'underbuilt_redevelopment': {
                'theoretical': sum(p['theoretical'] for p in results if p['category'] == 'underbuilt'),
                'effective': sum(p['effective'] for p in results if p['category'] == 'underbuilt'),
                'parcels': [p for p in results if p['category'] == 'underbuilt']
            },
            'assemblage_opportunities': assemblages,
            'total_theoretical': sum(p['theoretical'] for p in results),
            'total_effective': sum(p['effective'] for p in results)
        }
```

**Output (feeds into Supply Agent):**
```python
{
    'vacant_developable': {
        'theoretical': 2400,
        'effective': 1920,
        'parcels': [...]
    },
    'underbuilt_redevelopment': {
        'theoretical': 3200,
        'effective': 1280,
        'parcels': [...]
    },
    'assemblage_opportunities': {
        'opportunities': 12,
        'theoretical': 800,
        'effective': 240
    },
    'total_theoretical': 6400,
    'total_effective': 3440,
    'top_opportunities': [
        {
            'parcel_id': '14-25-207-003',
            'address': '234 Peachtree Rd',
            'current_units': 12,
            'max_units': 84,
            'capacity': 72,
            'probability': 0.78,
            'effective_capacity': 56
        },
        # ... top 20
    ]
}
```

---

### 🎮 Position Agent (Phase 2)
**Specialization:** Competitive positioning

**Method Engines:**
- Game Theory (Nash equilibrium)
- Network Science (relationship mapping)

**Inputs:**
- Competitor concessions
- Market share data
- Ownership networks

**Output:**
```python
{
    'position': 'ADVANTAGED' | 'NEUTRAL' | 'DISADVANTAGED',
    'score': 0-100,
    'competitive_pressure': float,
    'concession_equilibrium': float,
    'strategic_recommendations': [str],
    'key_competitors': [...]
}
```

---

### ⚠️ Risk Agent (Phase 2)
**Specialization:** Tail risk and volatility

**Method Engines:**
- Monte Carlo (probabilistic scenarios)
- Behavioral Economics (bias detection)
- Volatility Analysis

**Inputs:**
- Historical volatility
- User assumptions
- Market correlations

**Output:**
```python
{
    'risk_level': 'LOW' | 'MODERATE' | 'HIGH',
    'score': 0-100,
    'tail_risks': [str],
    'volatility_metrics': {...},
    'scenario_analysis': {
        'best_case': {...},
        'base_case': {...},
        'worst_case': {...}
    },
    'bias_alerts': [str]
}
```

---

## Data Flow Example

### Request: Analyze Buckhead, Atlanta

```
1. Orchestrator receives request(submarket_id=1)

2. Orchestrator calls agents:
   
   ┌──────────────────┐
   │  Demand Agent    │
   │  - Fetch rents   │
   │  - Run Kalman    │
   │  - Calc growth   │
   └────────┬─────────┘
            │
            ▼
   Result: WEAK (38/100, -1.2% growth)

   ┌──────────────────┐
   │  Dev Cap Agent   │
   │  - Load parcels  │
   │  - Calc capacity │
   │  - Score prob    │
   └────────┬─────────┘
            │
            ▼
   Result: 3,440 effective units (6,400 theoretical)
            │
            ▼ Feeds into
   ┌──────────────────┐
   │  Supply Agent    │
   │  - Existing: 775 │
   │  - Pipeline: 0   │
   │  - Capacity: 3440│
   └────────┬─────────┘
            │
            ▼
   Result: CRITICALLY_UNDERSUPPLIED (2% saturation now, 
           but 16,940 total capacity over 10 years)

3. Orchestrator synthesizes:
   - Demand: WEAK (38)
   - Supply: SHORT-TERM CRITICAL, LONG-TERM OVERHANG (68)
   - Composite: 66 (MODERATE_OPPORTUNITY)
   
4. Verdict: "Moderate opportunity. Supply extremely constrained 
   now but massive development capacity exists. Risk of 
   oversupply in 5-7 years if all capacity gets built."
```

---

## Implementation Order

### Phase 1 (Current - Week 1)
- ✅ Demand Agent (done - signal_processing.py)
- ✅ Supply Agent - Short-term only (done - carrying_capacity.py)
- ✅ Basic Orchestrator (done - imbalance_detector.py)

### Phase 1A (This Week - Priority)
- 🔄 **Development Capacity Agent**
  - Parcel database
  - Zoning rules engine
  - Probability model
  - Assemblage analyzer
- 🔄 **Enhanced Supply Agent** (integrate Dev Cap results)
- 🔄 **Enhanced Orchestrator** (supply timing risk logic)

### Phase 2 (Later)
- ⏳ Position Agent (game theory + network)
- ⏳ Risk Agent (Monte Carlo + behavioral)

---

## File Structure

```
jedi-re/
├── src/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── orchestrator.py           ✅ (imbalance_detector.py - rename)
│   │   ├── demand_agent.py           ✅ (signal_processing.py - wrap)
│   │   ├── supply_agent.py           ✅ (carrying_capacity.py - enhance)
│   │   ├── dev_capacity_agent.py     🔄 NEW - Priority
│   │   ├── position_agent.py         ⏳ Phase 2
│   │   └── risk_agent.py             ⏳ Phase 2
│   │
│   ├── engines/
│   │   ├── signal_processing.py      ✅ Done
│   │   ├── carrying_capacity.py      ✅ Done
│   │   ├── zoning_rules.py           🔄 NEW
│   │   ├── probability_model.py      🔄 NEW
│   │   ├── assemblage_analyzer.py    🔄 NEW
│   │   ├── game_theory.py            ⏳ Phase 2
│   │   ├── monte_carlo.py            ⏳ Phase 2
│   │   └── network_science.py        ⏳ Phase 2
│   │
│   └── api/
│       └── main.py                    ✅ Done (add dev cap endpoints)
```

---

## Benefits of Agent Architecture

**1. Modularity**
- Each agent is independent
- Easy to test in isolation
- Can update one without breaking others

**2. Composability**
- Agents can feed into each other
- Dev Cap Agent → Supply Agent → Orchestrator
- Clear data contracts between agents

**3. Scalability**
- Agents can run in parallel (where no dependencies)
- Can distribute to separate services later
- Easy to add new agents (Position, Risk, etc.)

**4. Clarity**
- Each agent has one job
- Clear responsibility boundaries
- Easy to understand and maintain

**5. Progressive Enhancement**
- Start with 2-3 agents (Demand, Supply, basic Orchestrator)
- Add Dev Cap Agent (Phase 1A)
- Add Position + Risk later (Phase 2)
- Platform gets smarter over time

---

## Next Steps

**This Week:**
1. Refactor existing code into agent pattern
2. Build Development Capacity Agent
3. Enhance Supply Agent to consume Dev Cap results
4. Update Orchestrator with supply timing risk logic

**Result:** Full supply intelligence with 10-year forecasting

---

**Created:** 2026-02-03 00:25 EST  
**Architecture Pattern:** Specialized Agents → Orchestrator  
**Current Implementation:** Demand + Supply (short-term) + Basic Orchestrator  
**Next Priority:** Development Capacity Agent
