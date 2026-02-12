"""
Development Capacity Analyzer Engine for JEDI RE
Calculates maximum buildable units and development potential based on zoning rules
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import math

from ..services.zoning_rules_service import get_zoning_service, ZoningRule


class DevelopmentPotential(Enum):
    """Development potential classification"""
    VERY_HIGH = "VERY_HIGH"  # > 100 units possible
    HIGH = "HIGH"            # 50-100 units possible
    MODERATE = "MODERATE"    # 20-50 units possible
    LOW = "LOW"              # 5-20 units possible
    VERY_LOW = "VERY_LOW"    # < 5 units possible
    NOT_VIABLE = "NOT_VIABLE"  # No development possible


@dataclass
class DevelopmentCapacityResult:
    """Result of development capacity analysis"""
    # Parcel information
    parcel_id: int
    current_zoning: str
    lot_size_sqft: float
    current_units: int
    
    # Zoning analysis
    zoning_rule: Optional[ZoningRule] = None
    
    # Capacity calculations
    maximum_buildable_units: Optional[int] = None
    development_potential: Optional[DevelopmentPotential] = None
    estimated_far: Optional[float] = None
    max_height_feet: Optional[float] = None
    
    # Constraints
    constraints: List[str] = None
    
    # Supply forecast
    supply_forecast: Dict[str, Any] = None
    
    # Analysis metadata
    analysis_timestamp: str = None
    confidence_score: float = 0.0
    
    def __post_init__(self):
        if self.constraints is None:
            self.constraints = []
        if self.supply_forecast is None:
            self.supply_forecast = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response"""
        result = asdict(self)
        
        # Handle enums
        if self.development_potential:
            result['development_potential'] = self.development_potential.value
        
        # Remove zoning_rule object (too large for API)
        if 'zoning_rule' in result:
            del result['zoning_rule']
        
        return result


class DevelopmentCapacityAnalyzer:
    """
    Analyzes development capacity based on zoning rules and parcel characteristics
    """
    
    def __init__(self, zoning_service=None):
        """
        Initialize the analyzer
        
        Args:
            zoning_service: ZoningRulesService instance (uses singleton if None)
        """
        self.zoning_service = zoning_service or get_zoning_service()
        
        # Development potential thresholds (units)
        self.potential_thresholds = {
            DevelopmentPotential.VERY_HIGH: 100,
            DevelopmentPotential.HIGH: 50,
            DevelopmentPotential.MODERATE: 20,
            DevelopmentPotential.LOW: 5,
            DevelopmentPotential.VERY_LOW: 1,
            DevelopmentPotential.NOT_VIABLE: 0
        }
        
        # Average unit sizes by zone type (sqft)
        self.avg_unit_sizes = {
            "single-family": 2000,
            "multi-family": 800,
            "mixed-use": 700,
            "residential": 1000  # default
        }
    
    def analyze_parcel(
        self,
        parcel_id: int,
        current_zoning: str,
        lot_size_sqft: float,
        current_units: int = 0,
        location: Optional[str] = None,
        submarket_id: Optional[int] = None
    ) -> DevelopmentCapacityResult:
        """
        Analyze development capacity for a parcel
        
        Args:
            parcel_id: Unique identifier for the parcel
            current_zoning: Current zoning code (e.g., "MR-4A")
            lot_size_sqft: Lot size in square feet
            current_units: Current number of units (0 for vacant)
            location: Optional location description
            submarket_id: Optional submarket ID for forecasting
            
        Returns:
            DevelopmentCapacityResult with analysis
        """
        # Get zoning rules
        zoning_rule = self.zoning_service.get_rules_by_zone(current_zoning)
        
        if not zoning_rule:
            # Zoning code not found
            return DevelopmentCapacityResult(
                parcel_id=parcel_id,
                current_zoning=current_zoning,
                lot_size_sqft=lot_size_sqft,
                current_units=current_units,
                maximum_buildable_units=0,
                development_potential=DevelopmentPotential.NOT_VIABLE,
                constraints=["Zoning code not found in database"],
                confidence_score=0.0
            )
        
        # Calculate maximum buildable units
        max_units = self._calculate_max_units(zoning_rule, lot_size_sqft)
        
        # Calculate development potential
        development_potential = self._assess_development_potential(max_units)
        
        # Calculate estimated FAR utilization
        estimated_far = self._calculate_estimated_far(zoning_rule, max_units, lot_size_sqft)
        
        # Get constraints
        constraints = self._get_development_constraints(zoning_rule)
        
        # Generate supply forecast
        supply_forecast = self._generate_supply_forecast(
            max_units, current_units, submarket_id, location
        )
        
        # Calculate confidence score
        confidence_score = self._calculate_confidence_score(zoning_rule, lot_size_sqft)
        
        return DevelopmentCapacityResult(
            parcel_id=parcel_id,
            current_zoning=current_zoning,
            lot_size_sqft=lot_size_sqft,
            current_units=current_units,
            zoning_rule=zoning_rule,
            maximum_buildable_units=max_units,
            development_potential=development_potential,
            estimated_far=estimated_far,
            max_height_feet=zoning_rule.maximum_height_feet,
            constraints=constraints,
            supply_forecast=supply_forecast,
            confidence_score=confidence_score
        )
    
    def _calculate_max_units(self, zoning_rule: ZoningRule, lot_size_sqft: float) -> int:
        """Calculate maximum buildable units based on zoning rules"""
        # Convert lot size to acres
        lot_size_acres = lot_size_sqft / 43560
        
        # Special handling for mixed-use zones (MRC-1, MRC-2, MRC-3)
        if zoning_rule.zone_type == "mixed-use" and zoning_rule.maximum_far_residential:
            # For mixed-use zones, use residential FAR for unit calculations
            # Assume 70% of FAR is allocated to residential (typical for mixed-use)
            residential_far = zoning_rule.maximum_far_residential
            
            # Get average unit size for mixed-use (typically smaller units)
            avg_unit_size = self.avg_unit_sizes.get("mixed-use", 700)
            
            max_by_far = math.floor((lot_size_sqft * residential_far) / avg_unit_size)
            
            # For mixed-use, also consider combined FAR with allocation
            if zoning_rule.maximum_far_combined:
                # Assume 60-70% of combined FAR is residential
                residential_portion = 0.65  # 65% residential allocation
                max_by_combined_far = math.floor(
                    (lot_size_sqft * zoning_rule.maximum_far_combined * residential_portion) / avg_unit_size
                )
                # Use the more restrictive of residential FAR or allocated combined FAR
                max_by_far = min(max_by_far, max_by_combined_far)
            
            return max_by_far
        
        # Method 1: Density-based calculation
        if zoning_rule.maximum_density_units_per_acre:
            max_by_density = math.floor(lot_size_acres * zoning_rule.maximum_density_units_per_acre)
        else:
            max_by_density = None
        
        # Method 2: FAR-based calculation
        if zoning_rule.maximum_far:
            # Get average unit size for this zone type
            avg_unit_size = self.avg_unit_sizes.get(
                zoning_rule.zone_type, 
                self.avg_unit_sizes["residential"]
            )
            
            max_by_far = math.floor((lot_size_sqft * zoning_rule.maximum_far) / avg_unit_size)
        else:
            max_by_far = None
        
        # Method 3: Minimum lot size constraint
        if zoning_rule.minimum_lot_size_sqft:
            max_by_lot_size = math.floor(lot_size_sqft / zoning_rule.minimum_lot_size_sqft)
        else:
            max_by_lot_size = None
        
        # Combine all methods - take the most restrictive
        possible_values = []
        if max_by_density is not None:
            possible_values.append(max_by_density)
        if max_by_far is not None:
            possible_values.append(max_by_far)
        
        # For single-family zones, minimum lot size is usually the limiting factor
        if zoning_rule.zone_type == "single-family" and max_by_lot_size is not None:
            return max_by_lot_size
        
        # For multi-family and mixed-use zones:
        # - Use FAR or density as primary constraint (they're about buildable space/units)
        # - Minimum lot size is typically for subdivision control, not unit density
        # - Only use lot size if there's no FAR or density specified
        if possible_values:
            return min(possible_values)
        elif max_by_lot_size is not None:
            # Fallback to lot size only if no other constraints exist
            return max_by_lot_size
        
        return 0
    
    def _calculate_estimated_far(self, zoning_rule: ZoningRule, max_units: int, lot_size_sqft: float) -> Optional[float]:
        """Calculate estimated FAR utilization based on max units"""
        if max_units == 0 or lot_size_sqft == 0:
            return None
        
        # Get average unit size
        avg_unit_size = self.avg_unit_sizes.get(
            zoning_rule.zone_type,
            self.avg_unit_sizes["residential"]
        )
        
        # Calculate FAR
        total_built_area = max_units * avg_unit_size
        estimated_far = total_built_area / lot_size_sqft
        
        # For mixed-use zones, show both residential and total FAR if available
        if zoning_rule.zone_type == "mixed-use" and zoning_rule.maximum_far_residential:
            # Return residential FAR utilization
            return round(estimated_far, 3)
        
        return round(estimated_far, 3)
    
    def _assess_development_potential(self, max_units: int) -> DevelopmentPotential:
        """Assess development potential based on maximum units"""
        if max_units <= 0:
            return DevelopmentPotential.NOT_VIABLE
        
        for potential, threshold in self.potential_thresholds.items():
            if max_units > threshold:
                return potential
        
        return DevelopmentPotential.VERY_LOW
    
    def _get_development_constraints(self, zoning_rule: ZoningRule) -> List[str]:
        """Extract development constraints from zoning rules"""
        constraints = []
        
        # Height constraints
        if zoning_rule.maximum_height_feet:
            constraints.append(f"{zoning_rule.maximum_height_feet}ft height limit")
        
        # Setback constraints
        if zoning_rule.front_setback_feet:
            constraints.append(f"{zoning_rule.front_setback_feet}ft front setback")
        if zoning_rule.rear_setback_feet:
            constraints.append(f"{zoning_rule.rear_setback_feet}ft rear setback")
        if zoning_rule.side_setback_feet:
            constraints.append(f"{zoning_rule.side_setback_feet}ft side setback")
        
        # Parking requirements
        if zoning_rule.parking_required_per_unit:
            constraints.append(f"{zoning_rule.parking_required_per_unit} parking spaces per unit")
        
        # Lot coverage
        if zoning_rule.maximum_lot_coverage:
            constraints.append(f"{zoning_rule.maximum_lot_coverage*100:.0f}% maximum lot coverage")
        
        # Add notes as constraints
        for note in zoning_rule.notes:
            if isinstance(note, str) and len(note) < 100:  # Avoid long notes
                if "height plane" in note.lower():
                    constraints.append("Transitional height plane")
                elif "zero-lot-line" in note.lower():
                    constraints.append("Zero-lot-line allowed")
                elif "frontage" in note.lower():
                    constraints.append("Minimum frontage requirement")
        
        return constraints
    
    def _generate_supply_forecast(
        self, 
        max_units: int, 
        current_units: int,
        submarket_id: Optional[int] = None,
        location: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate supply forecast for the development"""
        if max_units <= current_units:
            return {
                "timeframe_months": 0,
                "projected_new_units": 0,
                "impact_on_submarket": "No new supply",
                "development_likelihood": "LOW"
            }
        
        new_units = max_units - current_units
        
        # Estimate development timeframe based on unit count
        if new_units < 10:
            timeframe = 12  # months
            likelihood = "MODERATE"
        elif new_units < 50:
            timeframe = 18
            likelihood = "HIGH"
        else:
            timeframe = 24
            likelihood = "MODERATE"  # Larger projects have more risk
        
        # Estimate submarket impact
        impact = self._estimate_submarket_impact(new_units, submarket_id)
        
        return {
            "timeframe_months": timeframe,
            "projected_new_units": new_units,
            "impact_on_submarket": impact,
            "development_likelihood": likelihood,
            "estimated_completion_months": timeframe
        }
    
    def _estimate_submarket_impact(self, new_units: int, submarket_id: Optional[int] = None) -> str:
        """Estimate impact on submarket supply"""
        if new_units == 0:
            return "No impact"
        
        # These are rough estimates - in production would query database
        if new_units < 20:
            return "Minimal supply increase (<1%)"
        elif new_units < 100:
            return f"Moderate supply increase ({new_units//10}% range)"
        else:
            return f"Significant supply increase ({new_units//50}% range)"
    
    def _calculate_confidence_score(self, zoning_rule: ZoningRule, lot_size_sqft: float) -> float:
        """Calculate confidence score for the analysis (0-1)"""
        score = 0.0
        
        # Base confidence for having zoning rules
        score += 0.3
        
        # Confidence based on data completeness
        if zoning_rule.zone_type == "mixed-use":
            # For mixed-use zones, check for residential FAR
            if zoning_rule.maximum_far_residential:
                score += 0.3
            if zoning_rule.maximum_far_combined:
                score += 0.1
        else:
            # For other zones, use standard fields
            if zoning_rule.maximum_density_units_per_acre:
                score += 0.2
            if zoning_rule.maximum_far:
                score += 0.2
        
        if zoning_rule.minimum_lot_size_sqft:
            score += 0.1
        
        # Confidence based on lot size validity
        if lot_size_sqft > 0:
            score += 0.1
        if lot_size_sqft > 1000:  # Reasonable minimum
            score += 0.1
        
        return min(score, 1.0)
    
    def analyze_submarket_pipeline(
        self, 
        submarket_id: int,
        parcels: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze development pipeline for an entire submarket
        
        Args:
            submarket_id: Submarket ID
            parcels: List of parcel dictionaries with zoning info
            
        Returns:
            Pipeline analysis summary
        """
        total_potential_units = 0
        viable_parcels = 0
        potential_by_zone = {}
        
        for parcel in parcels:
            result = self.analyze_parcel(
                parcel_id=parcel.get("id", 0),
                current_zoning=parcel.get("zoning_code", ""),
                lot_size_sqft=parcel.get("lot_size_sqft", 0),
                current_units=parcel.get("current_units", 0),
                submarket_id=submarket_id
            )
            
            if result.maximum_buildable_units > result.current_units:
                total_potential_units += (result.maximum_buildable_units - result.current_units)
                viable_parcels += 1
                
                # Track by zoning code
                zone = result.current_zoning
                if zone not in potential_by_zone:
                    potential_by_zone[zone] = 0
                potential_by_zone[zone] += (result.maximum_buildable_units - result.current_units)
        
        # Calculate pipeline impact
        if total_potential_units > 0:
            if total_potential_units < 100:
                impact = "MINIMAL"
            elif total_potential_units < 500:
                impact = "MODERATE"
            else:
                impact = "SIGNIFICANT"
        else:
            impact = "NONE"
        
        return {
            "submarket_id": submarket_id,
            "total_potential_new_units": total_potential_units,
            "viable_parcels_count": viable_parcels,
            "total_parcels_analyzed": len(parcels),
            "pipeline_impact": impact,
            "potential_by_zoning": potential_by_zone,
            "estimated_timeframe_months": 24 if total_potential_units > 0 else 0,
            "recommendation": self._generate_pipeline_recommendation(total_potential_units, viable_parcels)
        }
    
    def _generate_pipeline_recommendation(self, total_units: int, viable_parcels: int) -> str:
        """Generate recommendation based on pipeline analysis"""
        if total_units == 0:
            return "No significant development pipeline identified"
        
        if total_units < 50:
            return "Limited development pipeline - monitor for small-scale opportunities"
        elif total_units < 200:
            return "Moderate development pipeline - consider targeted investments"
        elif total_units < 500:
            return "Substantial development pipeline - evaluate market absorption capacity"
        else:
            return "Large development pipeline - assess potential oversupply risks"