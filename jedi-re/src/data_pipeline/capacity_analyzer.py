"""
Capacity analysis for parcels
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)


class CapacityAnalyzer:
    """Analyze development capacity for parcels"""
    
    def __init__(self):
        # Zoning rules database (simplified for now)
        self.zoning_rules = self._load_zoning_rules()
        self.analysis_version = "1.0.0"
    
    def _load_zoning_rules(self) -> Dict[str, Dict[str, Any]]:
        """Load zoning rules (simplified for Phase 1A)"""
        # TODO: Load from actual zoning database or API
        return {
            # Residential zoning codes for Atlanta
            "R-1": {"units_per_acre": 2, "far": 0.5, "height_ft": 35, "stories": 2},
            "R-2": {"units_per_acre": 4, "far": 0.6, "height_ft": 35, "stories": 2},
            "R-3": {"units_per_acre": 8, "far": 0.8, "height_ft": 35, "stories": 2},
            "R-4": {"units_per_acre": 12, "far": 1.0, "height_ft": 40, "stories": 3},
            "R-4A": {"units_per_acre": 16, "far": 1.2, "height_ft": 45, "stories": 3},
            "R-4B": {"units_per_acre": 20, "far": 1.5, "height_ft": 50, "stories": 4},
            "R-5": {"units_per_acre": 30, "far": 2.0, "height_ft": 60, "stories": 5},
            
            # Mixed-use zoning
            "MRC-1": {"units_per_acre": 40, "far": 2.5, "height_ft": 75, "stories": 6},
            "MRC-2": {"units_per_acre": 60, "far": 3.0, "height_ft": 100, "stories": 8},
            "MRC-3": {"units_per_acre": 80, "far": 4.0, "height_ft": 150, "stories": 12},
            "MRC-4": {"units_per_acre": 100, "far": 5.0, "height_ft": 200, "stories": 16},
            
            # Commercial zoning
            "C-1": {"units_per_acre": 0, "far": 1.0, "height_ft": 45, "stories": 3},
            "C-2": {"units_per_acre": 0, "far": 2.0, "height_ft": 60, "stories": 5},
            "C-3": {"units_per_acre": 0, "far": 3.0, "height_ft": 90, "stories": 8},
            
            # Industrial
            "I-1": {"units_per_acre": 0, "far": 1.0, "height_ft": 45, "stories": 3},
            "I-2": {"units_per_acre": 0, "far": 2.0, "height_ft": 60, "stories": 5},
        }
    
    def analyze_parcel(self, parcel: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze development capacity for a single parcel
        
        Args:
            parcel: Parcel record from database
            
        Returns:
            Dictionary with capacity analysis results
        """
        try:
            parcel_id = parcel.get("parcel_id")
            zoning_code = parcel.get("current_zoning")
            lot_size_sqft = parcel.get("lot_size_sqft")
            current_units = parcel.get("current_units", 0)
            
            logger.debug(f"Analyzing parcel {parcel_id}: zoning={zoning_code}, lot_size={lot_size_sqft}")
            
            # Initialize result
            result = {
                "parcel_id": parcel_id,
                "analysis_date": datetime.now().isoformat(),
                "analysis_version": self.analysis_version,
                "zoning_code": zoning_code,
                "lot_size_sqft": lot_size_sqft,
                "current_units": current_units,
            }
            
            # Check if we have required data
            if not zoning_code or not lot_size_sqft:
                result.update({
                    "maximum_buildable_units": 0,
                    "development_potential": "UNKNOWN",
                    "confidence_score": 0.0,
                    "limiting_factors": ["Missing zoning or lot size data"],
                    "notes": "Insufficient data for analysis"
                })
                return result
            
            # Get zoning rules
            zoning_rule = self.zoning_rules.get(zoning_code.upper())
            
            if not zoning_rule:
                # Try to find similar zoning code
                zoning_rule = self._find_similar_zoning(zoning_code)
                result["zoning_notes"] = f"Using estimated rules for {zoning_code}"
            
            if not zoning_rule:
                result.update({
                    "maximum_buildable_units": 0,
                    "development_potential": "UNKNOWN",
                    "confidence_score": 0.1,
                    "limiting_factors": [f"Unknown zoning code: {zoning_code}"],
                    "notes": "Zoning code not in rules database"
                })
                return result
            
            # Calculate capacity
            capacity_result = self._calculate_capacity(
                lot_size_sqft, zoning_rule, current_units
            )
            
            result.update(capacity_result)
            
            # Add additional metrics
            result.update(self._calculate_additional_metrics(
                lot_size_sqft, zoning_rule, capacity_result["maximum_buildable_units"]
            ))
            
            # Determine development potential
            result["development_potential"] = self._determine_potential(
                capacity_result["maximum_buildable_units"],
                current_units,
                result["confidence_score"]
            )
            
            logger.debug(f"Parcel {parcel_id} analysis complete: {result['maximum_buildable_units']} units")
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing parcel {parcel.get('parcel_id')}: {e}")
            return {
                "parcel_id": parcel.get("parcel_id"),
                "analysis_date": datetime.now().isoformat(),
                "analysis_version": self.analysis_version,
                "maximum_buildable_units": 0,
                "development_potential": "ERROR",
                "confidence_score": 0.0,
                "limiting_factors": [f"Analysis error: {str(e)}"],
                "notes": "Analysis failed due to error"
            }
    
    def _find_similar_zoning(self, zoning_code: str) -> Optional[Dict[str, Any]]:
        """Find similar zoning code in rules database"""
        # Simple pattern matching for common zoning prefixes
        code_upper = zoning_code.upper()
        
        # Check for residential zoning
        if code_upper.startswith("R-"):
            # Try to extract number
            try:
                num_part = code_upper.split("-")[1]
                if num_part.isdigit():
                    num = int(num_part)
                    # Find closest residential zoning
                    for code in ["R-5", "R-4B", "R-4A", "R-4", "R-3", "R-2", "R-1"]:
                        if code in self.zoning_rules:
                            return self.zoning_rules[code]
            except:
                pass
        
        # Check for mixed-use
        if "MRC" in code_upper or "MIXED" in code_upper:
            return self.zoning_rules.get("MRC-2", self.zoning_rules.get("MRC-1"))
        
        # Check for commercial
        if code_upper.startswith("C-"):
            return self.zoning_rules.get("C-2", self.zoning_rules.get("C-1"))
        
        return None
    
    def _calculate_capacity(self, lot_size_sqft: float, 
                          zoning_rule: Dict[str, Any], 
                          current_units: int) -> Dict[str, Any]:
        """Calculate development capacity based on zoning rules"""
        
        # Convert lot size to acres
        lot_size_acres = lot_size_sqft / 43560
        
        # Calculate maximum units by density
        units_by_density = int(lot_size_acres * zoning_rule["units_per_acre"])
        
        # Calculate maximum units by FAR (assuming average unit size of 1000 sqft)
        avg_unit_size_sqft = 1000
        max_building_sqft = lot_size_sqft * zoning_rule["far"]
        units_by_far = int(max_building_sqft / avg_unit_size_sqft)
        
        # Take the minimum of the two calculations
        max_units = min(units_by_density, units_by_far)
        
        # Apply height/story limits
        max_units_by_height = self._apply_height_limits(
            max_units, zoning_rule["stories"], avg_unit_size_sqft, lot_size_sqft
        )
        
        # Final maximum is the minimum of all constraints
        final_max_units = min(max_units, max_units_by_height)
        
        # Calculate net new units
        net_new_units = max(0, final_max_units - current_units)
        
        # Determine confidence score
        confidence = self._calculate_confidence(
            zoning_rule, lot_size_sqft, final_max_units
        )
        
        # Identify limiting factors
        limiting_factors = []
        if units_by_density < units_by_far:
            limiting_factors.append("Density limit")
        if max_units_by_height < max_units:
            limiting_factors.append("Height limit")
        if final_max_units == 0:
            limiting_factors.append("No development allowed by zoning")
        
        return {
            "maximum_buildable_units": final_max_units,
            "net_new_units": net_new_units,
            "confidence_score": confidence,
            "limiting_factors": limiting_factors,
            "calculation_metrics": {
                "lot_size_acres": round(lot_size_acres, 3),
                "units_by_density": units_by_density,
                "units_by_far": units_by_far,
                "max_units_by_height": max_units_by_height,
                "zoning_units_per_acre": zoning_rule["units_per_acre"],
                "zoning_far": zoning_rule["far"],
                "zoning_height_ft": zoning_rule["height_ft"],
                "zoning_stories": zoning_rule["stories"]
            }
        }
    
    def _apply_height_limits(self, max_units: int, max_stories: int, 
                           avg_unit_size_sqft: float, lot_size_sqft: float) -> int:
        """Apply height and story limits to unit count"""
        # Assume units are distributed across floors
        # Simple calculation: units per floor * number of stories
        
        # Estimate footprint (assume 80% lot coverage)
        footprint_sqft = lot_size_sqft * 0.8
        
        # Units per floor based on footprint and average unit size
        units_per_floor = int(footprint_sqft / avg_unit_size_sqft)
        
        # Total units limited by stories
        return units_per_floor * max_stories
    
    def _calculate_confidence(self, zoning_rule: Dict[str, Any], 
                            lot_size_sqft: float, max_units: int) -> float:
        """Calculate confidence score for analysis (0.0 to 1.0)"""
        confidence = 0.7  # Base confidence
        
        # Adjust based on data quality
        if lot_size_sqft and lot_size_sqft > 0:
            confidence += 0.1
        
        # Adjust based on zoning rule specificity
        if zoning_rule.get("units_per_acre", 0) > 0:
            confidence += 0.1
        
        if zoning_rule.get("far", 0) > 0:
            confidence += 0.1
        
        # Cap at 1.0
        return min(confidence, 1.0)
    
    def _calculate_additional_metrics(self, lot_size_sqft: float, 
                                    zoning_rule: Dict[str, Any], 
                                    max_units: int) -> Dict[str, Any]:
        """Calculate additional financial and physical metrics"""
        
        # Estimate buildable square footage
        buildable_sqft = lot_size_sqft * zoning_rule.get("far", 1.0)
        
        # Estimate construction cost ($200/sqft for multifamily in Atlanta)
        construction_cost_per_sqft = 200
        estimated_construction_cost = buildable_sqft * construction_cost_per_sqft
        
        # Estimate land value (simplified: $50/sqft for developable land)
        land_value_per_sqft = 50
        estimated_land_value = lot_size_sqft * land_value_per_sqft
        
        # Identify opportunities
        opportunities = []
        if zoning_rule.get("units_per_acre", 0) >= 30:
            opportunities.append("High-density zoning")
        if zoning_rule.get("far", 0) >= 3.0:
            opportunities.append("High FAR allowance")
        if zoning_rule.get("height_ft", 0) >= 100:
            opportunities.append("Tall building potential")
        
        return {
            "buildable_sqft": round(buildable_sqft, 2),
            "estimated_construction_cost": round(estimated_construction_cost, 2),
            "estimated_land_value": round(estimated_land_value, 2),
            "opportunities": opportunities
        }
    
    def _determine_potential(self, max_units: int, current_units: int, 
                           confidence: float) -> str:
        """Determine development potential category"""
        
        net_new = max_units - current_units
        
        if net_new <= 0:
            return "NO_POTENTIAL"
        
        # Adjust thresholds based on confidence
        confidence_factor = max(0.5, confidence)
        
        if net_new >= 100 * confidence_factor:
            return "VERY_HIGH"
        elif net_new >= 50 * confidence_factor:
            return "HIGH"
        elif net_new >= 20 * confidence_factor:
            return "MEDIUM"
        elif net_new >= 5 * confidence_factor:
            return "LOW"
        else:
            return "MINIMAL"
    
    def batch_analyze(self, parcels: list) -> Dict[str, Any]:
        """
        Analyze multiple parcels in batch
        
        Args:
            parcels: List of parcel records
            
        Returns:
            Dictionary with batch analysis results
        """
        results = {
            "total_parcels": len(parcels),
            "analyzed_parcels": 0,
            "results": [],
            "summary": {
                "total_units_potential": 0,
                "high_potential_count": 0,
                "medium_potential_count": 0,
                "low_potential_count": 0,
                "no_potential_count": 0
            }
        }
        
        for parcel in parcels:
            analysis = self.analyze_parcel(parcel)
            results["results"].append(analysis)
            results["analyzed_parcels"] += 1
            
            # Update summary
            potential = analysis.get("development_potential", "UNKNOWN")
            max_units = analysis.get("maximum_buildable_units", 0)
            
            results["summary"]["total_units_potential"] += max_units
            
            if potential in ["VERY_HIGH", "HIGH"]:
                results["summary"]["high_potential_count"] += 1
            elif potential == "MEDIUM":
                results["summary"]["medium_potential_count"] += 1
            elif potential == "LOW":
                results["summary"]["low_potential_count"] += 1
            elif potential in ["NO_POTENTIAL", "UNKNOWN", "ERROR"]:
                results["summary"]["no_potential_count"] += 1
        
        return results