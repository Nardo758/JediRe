"""
Zoning Rules Service for JEDI RE
Loads and caches Atlanta zoning rules from JSON files
"""

import json
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from functools import lru_cache


@dataclass
class ZoningRule:
    """Represents zoning rules for a specific zoning code"""
    zoning_code: str
    description: str
    zone_type: str  # 'single-family', 'multi-family', 'mixed-use', etc.
    
    # Lot requirements
    minimum_lot_size_sqft: Optional[float] = None
    minimum_lot_size_acres: Optional[float] = None
    
    # Density controls
    maximum_density_units_per_acre: Optional[float] = None
    maximum_far: Optional[float] = None  # Floor Area Ratio
    
    # Mixed-use FAR controls (for MRC zones)
    maximum_far_residential: Optional[float] = None
    maximum_far_nonresidential: Optional[float] = None
    maximum_far_combined: Optional[float] = None
    maximum_far_with_bonuses: Optional[float] = None
    
    # Height limits
    maximum_height_feet: Optional[float] = None
    maximum_height_stories: Optional[float] = None
    
    # Setback requirements
    front_setback_feet: Optional[float] = None
    rear_setback_feet: Optional[float] = None
    side_setback_feet: Optional[float] = None
    
    # Parking requirements
    parking_required_per_unit: Optional[float] = None
    
    # Lot coverage
    maximum_lot_coverage: Optional[float] = None
    
    # Additional notes and constraints
    notes: List[str] = None
    constraints: List[str] = None
    
    def __post_init__(self):
        if self.notes is None:
            self.notes = []
        if self.constraints is None:
            self.constraints = []
        
        # Convert FAR if it's a string
        if isinstance(self.maximum_far, str):
            try:
                # Handle "Varies by sector" or similar
                if "Varies" in self.maximum_far:
                    # Extract numeric range if present
                    import re
                    numbers = re.findall(r'\d+\.?\d*', self.maximum_far)
                    if numbers:
                        self.maximum_far = float(numbers[-1])  # Use highest value
                    else:
                        self.maximum_far = None
                else:
                    self.maximum_far = float(self.maximum_far)
            except (ValueError, TypeError):
                self.maximum_far = None
        
        # Convert mixed-use FAR fields if they're strings
        for field in ['maximum_far_residential', 'maximum_far_nonresidential', 
                     'maximum_far_combined', 'maximum_far_with_bonuses']:
            value = getattr(self, field)
            if isinstance(value, str):
                try:
                    setattr(self, field, float(value))
                except (ValueError, TypeError):
                    setattr(self, field, None)


class ZoningRulesService:
    """Service for loading and querying zoning rules"""
    
    def __init__(self, zoning_rules_dir: str = None):
        """
        Initialize the zoning rules service
        
        Args:
            zoning_rules_dir: Directory containing zoning JSON files
        """
        if zoning_rules_dir is None:
            # Default to the zoning-rules directory in the project root
            current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            zoning_rules_dir = os.path.join(current_dir, "zoning-rules")
        
        self.zoning_rules_dir = zoning_rules_dir
        self._rules_cache = {}
        self._load_all_rules()
    
    def _load_all_rules(self):
        """Load all zoning rules from JSON files"""
        # Load single-family zoning
        sf_path = os.path.join(self.zoning_rules_dir, "atlanta_zoning_verified.json")
        if os.path.exists(sf_path):
            with open(sf_path, 'r') as f:
                sf_data = json.load(f)
                # Try both "zones" and "zoning_rules" keys for compatibility
                zones_data = sf_data.get("zones", sf_data.get("zoning_rules", []))
                for rule_data in zones_data:
                    rule = self._parse_rule_data(rule_data)
                    self._rules_cache[rule.zoning_code] = rule
        
        # Load multi-family zoning
        mf_path = os.path.join(self.zoning_rules_dir, "atlanta_mf_zoning_verified.json")
        if os.path.exists(mf_path):
            with open(mf_path, 'r') as f:
                mf_data = json.load(f)
                for rule_data in mf_data.get("zones", []):
                    rule = self._parse_rule_data(rule_data)
                    self._rules_cache[rule.zoning_code] = rule
    
    def _parse_rule_data(self, rule_data: Dict) -> ZoningRule:
        """Parse raw JSON data into a ZoningRule object"""
        # Handle notes field which can be string or list
        notes = rule_data.get("notes", [])
        if isinstance(notes, str):
            notes = [notes]
        
        # Extract constraints from notes
        constraints = []
        if "Transitional height plane" in str(notes):
            constraints.append("Transitional height plane")
        if "zero-lot-line" in str(notes):
            constraints.append("Zero-lot-line allowed")
        
        return ZoningRule(
            zoning_code=rule_data.get("zoning_code", ""),
            description=rule_data.get("description", ""),
            zone_type=rule_data.get("zone_type", "residential"),
            minimum_lot_size_sqft=rule_data.get("minimum_lot_size_sqft"),
            minimum_lot_size_acres=rule_data.get("minimum_lot_size_acres"),
            maximum_density_units_per_acre=rule_data.get("maximum_density_units_per_acre"),
            maximum_far=rule_data.get("maximum_far"),
            maximum_far_residential=rule_data.get("maximum_far_residential"),
            maximum_far_nonresidential=rule_data.get("maximum_far_nonresidential"),
            maximum_far_combined=rule_data.get("maximum_far_combined"),
            maximum_far_with_bonuses=rule_data.get("maximum_far_with_bonuses"),
            maximum_height_feet=rule_data.get("maximum_height_feet"),
            maximum_height_stories=rule_data.get("maximum_height_stories"),
            front_setback_feet=rule_data.get("front_setback_feet"),
            rear_setback_feet=rule_data.get("rear_setback_feet"),
            side_setback_feet=rule_data.get("side_setback_feet"),
            parking_required_per_unit=rule_data.get("parking_required_per_unit"),
            maximum_lot_coverage=rule_data.get("maximum_lot_coverage"),
            notes=notes,
            constraints=constraints
        )
    
    @lru_cache(maxsize=128)
    def get_rules_by_zone(self, zoning_code: str) -> Optional[ZoningRule]:
        """
        Get zoning rules for a specific zoning code
        
        Args:
            zoning_code: The zoning code (e.g., "MR-4A", "R-1")
            
        Returns:
            ZoningRule object or None if not found
        """
        # Try exact match first
        if zoning_code in self._rules_cache:
            return self._rules_cache[zoning_code]
        
        # Try case-insensitive match
        zoning_code_lower = zoning_code.lower()
        for code, rule in self._rules_cache.items():
            if code.lower() == zoning_code_lower:
                return rule
        
        # Try partial match (e.g., "MR-4" for "MR-4A")
        for code, rule in self._rules_cache.items():
            if zoning_code in code or code in zoning_code:
                return rule
        
        return None
    
    def get_all_zoning_codes(self) -> List[str]:
        """Get list of all available zoning codes"""
        return list(self._rules_cache.keys())
    
    def get_zoning_codes_by_type(self, zone_type: str) -> List[str]:
        """Get zoning codes filtered by zone type"""
        return [
            code for code, rule in self._rules_cache.items()
            if rule.zone_type == zone_type
        ]
    
    def calculate_max_units(self, zoning_code: str, lot_size_sqft: float) -> Optional[int]:
        """
        Calculate maximum buildable units based on zoning rules
        
        Args:
            zoning_code: Zoning code
            lot_size_sqft: Lot size in square feet
            
        Returns:
            Maximum number of units or None if cannot be calculated
        """
        rule = self.get_rules_by_zone(zoning_code)
        if not rule:
            return None
        
        # Convert lot size to acres
        lot_size_acres = lot_size_sqft / 43560
        
        # Calculate based on density (units per acre)
        if rule.maximum_density_units_per_acre:
            max_by_density = int(lot_size_acres * rule.maximum_density_units_per_acre)
        else:
            max_by_density = None
        
        # Calculate based on FAR (assuming average unit size)
        if rule.maximum_far:
            # Assume average unit size of 800 sqft for multifamily, 2000 sqft for single-family
            if rule.zone_type == "single-family":
                avg_unit_size = 2000
            else:
                avg_unit_size = 800
            
            max_by_far = int((lot_size_sqft * rule.maximum_far) / avg_unit_size)
        else:
            max_by_far = None
        
        # Return the more restrictive limit
        if max_by_density is None:
            return max_by_far
        elif max_by_far is None:
            return max_by_density
        else:
            return min(max_by_density, max_by_far)
    
    def get_development_constraints(self, zoning_code: str) -> List[str]:
        """
        Get development constraints for a zoning code
        
        Args:
            zoning_code: Zoning code
            
        Returns:
            List of constraint descriptions
        """
        rule = self.get_rules_by_zone(zoning_code)
        if not rule:
            return ["Zoning code not found"]
        
        constraints = []
        
        # Add setback constraints
        if rule.front_setback_feet:
            constraints.append(f"{rule.front_setback_feet}ft front setback")
        if rule.rear_setback_feet:
            constraints.append(f"{rule.rear_setback_feet}ft rear setback")
        if rule.side_setback_feet:
            constraints.append(f"{rule.side_setback_feet}ft side setback")
        
        # Add height constraints
        if rule.maximum_height_feet:
            constraints.append(f"{rule.maximum_height_feet}ft height limit")
        
        # Add lot coverage constraints
        if rule.maximum_lot_coverage:
            constraints.append(f"{rule.maximum_lot_coverage*100:.0f}% maximum lot coverage")
        
        # Add custom constraints from notes
        constraints.extend(rule.constraints)
        
        return constraints


# Singleton instance for easy import
_zoning_service = None

def get_zoning_service() -> ZoningRulesService:
    """Get singleton instance of ZoningRulesService"""
    global _zoning_service
    if _zoning_service is None:
        _zoning_service = ZoningRulesService()
    return _zoning_service