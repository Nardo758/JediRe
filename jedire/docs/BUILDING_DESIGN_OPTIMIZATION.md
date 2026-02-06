# Building Design Optimization Engine
**Integration with 3D Models & Cost Analysis**

Created: 2026-02-03
Status: Planning Phase

---

## Concept Overview

**Goal:** Minimize construction costs while maximizing building efficiency and unit count, guided by zoning constraints and geometric principles.

**Integration Point:** After zoning analysis determines what's *allowed*, this engine determines what's *optimal*.

---

## Design Optimization Rules

### 1. Vertical Cost Rules
**Principle:** Lower you go vertically, the lower the cost per unit

#### Cost Factors by Height:
```python
# Cost multipliers by floor level
COST_MULTIPLIERS = {
    'subterranean': {
        'basement_1': 1.8,  # 80% more expensive (excavation, waterproofing)
        'basement_2': 2.2,  # Even more expensive
        'basement_3': 2.5   # Extremely expensive
    },
    'ground_level': 1.0,  # Baseline cost
    'floors_1_3': 1.0,    # Standard construction
    'floors_4_8': 1.15,   # Steel frame required
    'floors_9_15': 1.35,  # High-rise construction (elevators, pumps)
    'floors_16_25': 1.55, # Super structure required
    'floors_26+': 1.85    # Tower construction (wind loads, premium materials)
}

# Parking strategy cost impacts
PARKING_STRATEGIES = {
    'no_parking': -0.15,              # 15% cost savings (transit-oriented)
    'surface_parking': 0.0,           # Baseline (cheapest)
    'structured_above_ground': +0.12, # 12% cost increase (typical strategy)
    'underground_garage': +0.35       # 35% cost increase (AVOID - rarely used)
}
```

**Optimization Strategy:**
- Maximize low-rise floors (1-8) when zoning allows
- Avoid underground parking unless absolutely necessary
- Use surface parking or structured above-ground when feasible
- Trade height for footprint coverage when lot size permits

---

### 2. Geometric Efficiency Rules
**Principle:** Rectangular lots enable double-loaded corridors (maximum efficiency)

#### Efficiency Metrics:

**A. Lot Shape Efficiency Score**
```python
def calculate_lot_efficiency(lot_dimensions):
    """
    Rectangle = best (1.0 score)
    Square = good (0.95 score)  
    L-shape = moderate (0.80 score)
    Irregular = poor (0.60 score)
    """
    
    # Ideal ratios for double-loaded corridors
    IDEAL_RATIOS = {
        'narrow': (2.0, 3.5),   # 2:1 to 3.5:1 width:depth
        'optimal': (2.5, 3.0),  # Sweet spot
    }
    
    # Calculate aspect ratio
    width = min(lot_dimensions)
    depth = max(lot_dimensions)
    aspect_ratio = depth / width
    
    # Score based on how close to optimal
    if 2.0 <= aspect_ratio <= 3.5:
        efficiency = 1.0
    else:
        # Penalty for deviation
        efficiency = 0.7 + (0.3 * (1 - abs(aspect_ratio - 2.75) / 2.75))
    
    return efficiency
```

**B. Double-Loaded Corridor Optimization**
```python
# Optimal corridor dimensions
CORRIDOR_SPECS = {
    'width': 6.0,  # 6 feet (minimum code)
    'optimal_building_depth': 60,  # 60 feet (allows 25ft units on each side + corridor)
    'minimum_building_depth': 50,  # 50 feet (tight but workable)
    'maximum_building_depth': 70   # 70 feet (starts losing efficiency)
}

# Unit efficiency by layout type
LAYOUT_EFFICIENCY = {
    'double_loaded_corridor': {
        'usable_sqft_ratio': 0.85,  # 85% of building is leasable
        'units_per_floor': lambda width: width / 25,  # ~25ft per unit
        'ideal_for': 'rectangular lots'
    },
    'single_loaded_corridor': {
        'usable_sqft_ratio': 0.75,  # 75% leasable (more circulation)
        'units_per_floor': lambda width: width / 30,
        'ideal_for': 'narrow or irregular lots'
    },
    'point_tower': {
        'usable_sqft_ratio': 0.80,  # 80% leasable
        'units_per_floor': lambda width: 4 to 8,  # Fixed count per floor
        'ideal_for': 'square lots or high-rises'
    }
}
```

**C. Efficiency Calculation**
```python
def calculate_building_efficiency(lot_shape, building_design):
    """
    Returns efficiency score 0.0-1.0 and recommendations
    """
    
    # Base efficiency from lot shape
    shape_efficiency = calculate_lot_efficiency(lot_shape)
    
    # Corridor type efficiency
    if building_design['corridor_type'] == 'double_loaded':
        corridor_efficiency = 0.85
    elif building_design['corridor_type'] == 'single_loaded':
        corridor_efficiency = 0.75
    else:  # Point tower
        corridor_efficiency = 0.80
    
    # Building depth optimization
    if 50 <= building_design['depth'] <= 70:
        depth_efficiency = 1.0
    else:
        depth_efficiency = 0.85
    
    # Combined efficiency
    total_efficiency = (shape_efficiency * 0.4 + 
                       corridor_efficiency * 0.4 + 
                       depth_efficiency * 0.2)
    
    return {
        'efficiency_score': total_efficiency,
        'usable_sqft_ratio': corridor_efficiency,
        'shape_rating': shape_efficiency,
        'recommendations': generate_recommendations(lot_shape, building_design)
    }
```

---

### 3. Property Expansion Strategy
**Principle:** Making the property bigger = more units, better efficiency

#### Expansion Opportunities:

**A. Adjacent Parcel Acquisition**
```python
def identify_expansion_opportunities(target_parcel, submarket):
    """
    Find adjacent parcels that could be acquired to expand development site
    """
    
    opportunities = []
    
    # Find parcels sharing a property line
    adjacent_parcels = find_adjacent_parcels(target_parcel)
    
    for parcel in adjacent_parcels:
        # Calculate combined development potential
        combined_analysis = analyze_combined_parcels(
            [target_parcel, parcel]
        )
        
        # Calculate uplift from assemblage
        individual_units = target_parcel.max_units + parcel.max_units
        combined_units = combined_analysis.max_units
        assemblage_bonus = combined_units - individual_units
        
        opportunity = {
            'adjacent_parcel_id': parcel.id,
            'address': parcel.address,
            'current_use': parcel.current_use,
            'lot_size': parcel.lot_size_sqft,
            'individual_potential': individual_units,
            'combined_potential': combined_units,
            'assemblage_bonus': assemblage_bonus,
            'bonus_percentage': assemblage_bonus / individual_units * 100,
            'acquisition_feasibility': score_acquisition_feasibility(parcel),
            'estimated_cost': estimate_land_cost(parcel)
        }
        
        opportunities.append(opportunity)
    
    return sorted(opportunities, key=lambda x: x['assemblage_bonus'], reverse=True)
```

**Example Assemblage Scenario:**
```
TARGET PARCEL:
- 15,000 sqft, MR-4A
- Max buildable: 60 units alone

ADJACENT PARCEL:
- 12,000 sqft, MR-4A  
- Max buildable: 48 units alone

COMBINED (27,000 sqft):
- Max buildable: 130 units (assemblage bonus: 22 units!)
- Why bonus? Larger footprint enables:
  * Better building geometry
  * More efficient floor plates
  * Reduced per-unit parking requirements
  * Amortized infrastructure costs

STRATEGY: Acquire adjacent parcel for $3M to unlock 22 extra units
Revenue impact: +$6.6M annual income ($300k/unit × 22 units × $2,500/mo rent)
```

**B. Lot Coverage Optimization**
```python
COVERAGE_STRATEGIES = {
    'maximize_footprint': {
        'strategy': 'Use full allowable lot coverage',
        'typical_coverage': 0.85,  # 85% of lot area
        'benefit': 'More units per floor, lower per-unit cost',
        'constraint': 'Must meet setback requirements'
    },
    'tower_on_podium': {
        'strategy': 'Maximize podium, stack tower above',
        'typical_coverage': 0.90,  # Podium covers 90%
        'benefit': 'Parking + retail on podium, residential tower above',
        'constraint': 'Requires larger lots (>0.5 acres)'
    },
    'efficient_setback_use': {
        'strategy': 'Minimize wasted setback space',
        'typical_coverage': 0.80,
        'benefit': 'Rectangular building maximizes usable area',
        'constraint': 'Works best on rectangular lots'
    }
}
```

**C. Air Rights & Easements**
```python
def explore_air_rights(target_parcel, adjacent_parcels):
    """
    Identify opportunities to purchase air rights or easements
    """
    
    opportunities = []
    
    for adjacent in adjacent_parcels:
        # Check if adjacent parcel is underbuilt
        if adjacent.current_far < adjacent.max_far * 0.5:
            # They're not using their development rights
            available_far = adjacent.max_far - adjacent.current_far
            
            opportunity = {
                'type': 'air_rights',
                'parcel': adjacent.id,
                'available_far': available_far,
                'additional_units': calculate_units_from_far(available_far, adjacent.lot_size),
                'typical_cost': adjacent.land_value * 0.3,  # 30% of land value
                'benefit': 'Add units without acquiring full parcel'
            }
            opportunities.append(opportunity)
    
    return opportunities
```

**D. Property Expansion Impact**
```python
def calculate_expansion_impact(current_parcel, expansion_strategy):
    """
    Calculate ROI of property expansion
    """
    
    # Current scenario
    current_units = current_parcel.max_buildable_units
    current_revenue = current_units * avg_rent * 12
    
    # Expanded scenario
    if expansion_strategy['type'] == 'adjacent_acquisition':
        expanded_lot_size = current_parcel.lot_size + expansion_strategy['added_lot_size']
        expanded_units = calculate_max_units(expanded_lot_size, current_parcel.zoning)
        
        # Assemblage bonus (typically 10-20% more units than sum of parts)
        assemblage_bonus = expanded_units * 0.15
        total_units = expanded_units + assemblage_bonus
        
    elif expansion_strategy['type'] == 'air_rights':
        total_units = current_units + expansion_strategy['additional_units']
        
    expanded_revenue = total_units * avg_rent * 12
    
    # Calculate ROI
    expansion_cost = expansion_strategy['acquisition_cost']
    additional_revenue = expanded_revenue - current_revenue
    simple_payback = expansion_cost / additional_revenue
    
    return {
        'current_units': current_units,
        'expanded_units': total_units,
        'additional_units': total_units - current_units,
        'expansion_cost': expansion_cost,
        'additional_annual_revenue': additional_revenue,
        'payback_years': simple_payback,
        'roi': additional_revenue / expansion_cost,
        'recommendation': 'ACQUIRE' if simple_payback < 8 else 'PASS'
    }
```

---

### 4. Cost-Efficiency Optimization Model

**Complete Cost Formula:**
```python
def calculate_development_cost(parcel, design):
    """
    Calculate total development cost considering all factors
    """
    
    # Base construction cost ($/sqft)
    base_cost_per_sqft = 200  # Varies by market
    
    # Vertical cost multiplier
    avg_floor = design['floors'] / 2
    if avg_floor <= 3:
        vertical_multiplier = 1.0
    elif avg_floor <= 8:
        vertical_multiplier = 1.15
    elif avg_floor <= 15:
        vertical_multiplier = 1.35
    else:
        vertical_multiplier = 1.55
    
    # Garage impact
    garage_multiplier = GARAGE_IMPACTS[design['parking_type']]
    
    # Efficiency factor (better efficiency = lower cost per unit)
    efficiency = calculate_building_efficiency(parcel, design)['efficiency_score']
    efficiency_multiplier = 1.0 / efficiency  # Lower efficiency = higher cost
    
    # Calculate total
    total_sqft = design['gross_sqft']
    total_cost = (base_cost_per_sqft * 
                 total_sqft * 
                 vertical_multiplier * 
                 (1 + garage_multiplier) * 
                 efficiency_multiplier)
    
    # Cost per unit
    cost_per_unit = total_cost / design['units']
    
    return {
        'total_cost': total_cost,
        'cost_per_sqft': total_cost / total_sqft,
        'cost_per_unit': cost_per_unit,
        'vertical_multiplier': vertical_multiplier,
        'efficiency_score': efficiency,
        'garage_impact': garage_multiplier
    }
```

---

## Machine Learning vs Rule-Based Approach

### Option A: Rule-Based System (Recommended for Phase 1)
**Pros:**
- Faster to implement (2-3 days)
- Transparent/explainable decisions
- No training data needed
- Guaranteed to follow building codes
- Easy to update rules

**Cons:**
- May miss creative solutions
- Limited to pre-defined patterns
- Can't learn from user preferences

**Implementation:**
```python
class DesignOptimizer:
    def optimize_design(self, parcel, zoning_rules, user_goals):
        """
        Rule-based optimization
        1. Generate design variants (3-5 options)
        2. Score each on cost, efficiency, units
        3. Rank by user priorities
        4. Return top 3 recommendations
        """
        
        variants = self.generate_variants(parcel, zoning_rules)
        scored_variants = []
        
        for variant in variants:
            score = self.score_design(
                variant,
                cost_weight=user_goals['minimize_cost'],
                efficiency_weight=user_goals['maximize_efficiency'],
                units_weight=user_goals['maximize_units']
            )
            scored_variants.append((variant, score))
        
        return sorted(scored_variants, key=lambda x: x[1], reverse=True)[:3]
```

---

### Option B: Machine Learning Approach (Phase 2+)
**Pros:**
- Learns from successful projects
- Can discover non-obvious optimizations
- Improves over time
- Handles complex trade-offs

**Cons:**
- Requires training data (100+ building designs)
- 2-3 weeks to implement
- Black box decisions (harder to explain)
- Risk of unrealistic/unbuildable designs

**Training Data Needed:**
```json
{
  "training_examples": [
    {
      "parcel": {
        "lot_size": 43560,
        "dimensions": [200, 218],
        "zoning": "MR-5A"
      },
      "design": {
        "floors": 12,
        "units": 144,
        "gross_sqft": 180000,
        "corridor_type": "double_loaded",
        "parking_type": "above_ground_deck"
      },
      "outcomes": {
        "total_cost": 36000000,
        "cost_per_unit": 250000,
        "efficiency_ratio": 0.85,
        "project_success": true,
        "roi": 0.18
      }
    }
    // ... 100+ more examples
  ]
}
```

**ML Model Architecture:**
```python
# Input features (parcel + zoning constraints)
- Lot dimensions (width, depth, area)
- Zoning code (one-hot encoded)
- Max FAR, height limit, setbacks
- User priorities (cost, efficiency, units)

# Neural network layers
- Input layer: 20 features
- Hidden layers: [128, 64, 32]
- Output layer: Design parameters
  * Optimal floors
  * Building footprint
  * Corridor type
  * Parking strategy
  * Predicted cost & efficiency

# Training objective
Minimize: cost_per_unit
Maximize: efficiency_ratio * units_count
Subject to: zoning constraints
```

---

## Recommended Implementation Plan

### Phase 1: Rule-Based Foundation (Week 3)
**Timeline:** 2-3 days

**Deliverables:**
1. **Cost calculation engine**
   - Vertical cost multipliers
   - Garage cost impacts
   - Base construction costs by market

2. **Geometric efficiency analyzer**
   - Lot shape scoring
   - Corridor type recommendation
   - Building depth optimization

3. **Design optimizer**
   - Generate 3-5 design variants
   - Score by cost/efficiency/units
   - Rank by user priorities

4. **API Integration**
   - `POST /api/v1/parcels/{id}/optimize-design`
   - Input: parcel + zoning + goals
   - Output: Top 3 design recommendations with cost/efficiency breakdown

**Example API Response:**
```json
{
  "parcel_id": 123,
  "zoning": "MR-5A",
  "lot_size": 43560,
  "recommendations": [
    {
      "rank": 1,
      "design_name": "Efficient Mid-Rise with Expansion",
      "strategy": "ACQUIRE ADJACENT PARCEL",
      "current_lot": 43560,
      "expanded_lot": 70000,
      "expansion_cost": 5000000,
      "floors": 8,
      "units": 210,
      "gross_sqft": 262500,
      "corridor_type": "double_loaded",
      "parking_type": "structured_above_ground",
      "total_cost": 58000000,
      "cost_per_unit": 276000,
      "efficiency_score": 0.90,
      "usable_ratio": 0.87,
      "why_recommended": "Acquiring adjacent parcel unlocks 90 additional units with superior efficiency",
      "expansion_details": {
        "adjacent_parcel_id": 124,
        "assemblage_bonus": 25,
        "annual_revenue_increase": 2700000,
        "expansion_payback_years": 1.85
      },
      "trade_offs": "Requires $5M additional land acquisition"
    },
    {
      "rank": 2,
      "design_name": "Efficient Mid-Rise (Current Lot Only)",
      "strategy": "OPTIMIZE CURRENT PARCEL",
      "floors": 8,
      "units": 120,
      "gross_sqft": 150000,
      "corridor_type": "double_loaded",
      "parking_type": "surface",
      "total_cost": 30000000,
      "cost_per_unit": 250000,
      "efficiency_score": 0.88,
      "usable_ratio": 0.85,
      "why_recommended": "Maximizes units on current lot with minimal cost",
      "trade_offs": "Leaves 90 potential units on table (no expansion)"
    },
    {
      "rank": 3,
      "design_name": "High-Density Tower",
      "strategy": "OPTIMIZE CURRENT PARCEL",
      "floors": 15,
      "units": 180,
      "gross_sqft": 225000,
      "corridor_type": "double_loaded",
      "parking_type": "structured_above_ground",
      "total_cost": 54000000,
      "cost_per_unit": 300000,
      "efficiency_score": 0.82,
      "usable_ratio": 0.80,
      "why_recommended": "Maximizes unit count on current lot",
      "trade_offs": "Higher cost per unit due to high-rise construction"
    }
  ],
  "expansion_opportunities": [
    {
      "parcel_id": 124,
      "address": "3402 Peachtree Rd NE",
      "lot_size": 26440,
      "current_use": "surface_parking",
      "acquisition_feasibility": "HIGH",
      "estimated_cost": 5000000,
      "assemblage_bonus_units": 25,
      "payback_years": 1.85,
      "recommendation": "STRONGLY_RECOMMEND"
    }
  ]
}
```

---

### Phase 2: ML Enhancement (Month 2-3)
**Timeline:** 2-3 weeks

**Requirements:**
1. Collect training data:
   - Scrape 100+ completed projects
   - Partner with architects for design data
   - Use CoStar for project outcomes

2. Build ML model:
   - TensorFlow/PyTorch implementation
   - Train on cost/efficiency trade-offs
   - Validate on held-out test set

3. Integration:
   - Run ML model alongside rule-based
   - Let users choose "ML-optimized" designs
   - A/B test which performs better

---

## Data Sources for Training

### Architectural Design Patterns:
- **CoStar:** Completed projects (unit count, cost, efficiency)
- **LoopNet:** Building specs, floor plans
- **Building permits:** Construction costs, timelines
- **Architect partnerships:** Actual design files

### Cost Data:
- **RSMeans:** Construction cost database
- **CoStar:** Project budgets
- **Developer surveys:** Actual vs estimated costs

### Success Metrics:
- **Rent achievement:** Projected vs actual rents
- **Absorption rate:** How fast units leased
- **ROI:** Actual return vs pro forma

---

## Integration with Existing Features

### 1. Zoning Analysis → Design Optimization Flow
```
User Input: Parcel + Goal ("maximize units, minimize cost")
    ↓
Zoning Analyzer: "You can build up to 200 units, max 150ft height"
    ↓
Design Optimizer: "Here are 3 optimal designs that achieve that"
    ↓
Cost Analyzer: "Option 1 costs $40M, Option 2 costs $55M"
    ↓
3D Visualizer: "Here's what each option looks like"
```

### 2. Strategic Features Integration
```
Optimal Zoning Recommender: "Rezone to MR-6 for 200 units"
    ↓
Design Optimizer: "Build 8-story, double-loaded, surface parking"
    ↓
Result: 200 units at $250k/unit vs 60 units at $300k/unit
Savings: $10M in construction costs!
```

---

## Next Steps

### Immediate (Week 3):
1. ✅ Complete current development capacity integration
2. ✅ Build strategic features (zoning recommender, parcel picker)
3. 🔄 Implement rule-based design optimizer
4. ⏳ Add cost calculation engine
5. ⏳ Create geometric efficiency analyzer

### Short-term (Month 2):
1. ⏳ Collect building design training data
2. ⏳ Build simple ML model (prototype)
3. ⏳ A/B test rule-based vs ML approaches

### Long-term (Month 3+):
1. ⏳ Full ML model with 1000+ training examples
2. ⏳ 3D visualization integration
3. ⏳ Real-time cost updates from market data

---

**Total Implementation Time:**
- Phase 1 (Rule-based): 2-3 days
- Phase 2 (ML): 2-3 weeks
- Phase 3 (Advanced): 1-2 months

---

## Decision: Rule-Based First or ML First?

### Recommendation: **Start Rule-Based**

**Why:**
1. Faster time to value (2-3 days vs 2-3 weeks)
2. No training data needed yet
3. Transparent decisions (explainable to users)
4. Can layer ML on top later
5. 80% of optimization can be rule-based

**Next Action:**
Build rule-based design optimizer immediately after strategic features complete.

---

Created: 2026-02-03
Status: Planning → Ready for Implementation
Priority: HIGH (core value proposition)
