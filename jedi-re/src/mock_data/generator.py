"""
Mock Data Generator for Phase 2 Testing
Creates realistic synthetic data for testing market intelligence engines

Use this to validate Phase 2 architecture while waiting for real data sources (CoStar, scrapers)
"""

import random
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import numpy as np


@dataclass
class MockProperty:
    """Mock apartment property"""
    property_id: int
    name: str
    address: str
    city: str
    state: str
    zip_code: str
    latitude: float
    longitude: float
    submarket: str
    total_units: int
    year_built: int
    stories: int
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MockRentObservation:
    """Mock rent observation"""
    property_id: int
    observed_at: datetime
    unit_type: str
    asking_rent: float
    sqft: int
    available_units: int
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['observed_at'] = data['observed_at'].isoformat()
        return data


@dataclass
class MockPipelineProject:
    """Mock pipeline project"""
    project_id: int
    name: str
    address: str
    submarket: str
    units: int
    status: str
    estimated_delivery: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MockDataGenerator:
    """
    Generates realistic mock data for testing
    """
    
    # Atlanta submarkets with characteristics
    SUBMARKETS = {
        "Buckhead": {
            "base_rent_2br": 2850,
            "rent_trend": -0.01,  # -1% monthly (declining)
            "vacancy_rate": 0.08,
            "existing_units": 12500,
            "lat_center": 33.8490,
            "lon_center": -84.3780
        },
        "Midtown": {
            "base_rent_2br": 2650,
            "rent_trend": 0.005,  # +0.5% monthly (growing)
            "vacancy_rate": 0.05,
            "existing_units": 18000,
            "lat_center": 33.7838,
            "lon_center": -84.3830
        },
        "Downtown": {
            "base_rent_2br": 2200,
            "rent_trend": 0.0,  # flat
            "vacancy_rate": 0.12,
            "existing_units": 8500,
            "lat_center": 33.7490,
            "lon_center": -84.3880
        },
        "Brookhaven": {
            "base_rent_2br": 2400,
            "rent_trend": 0.01,  # +1% monthly (strong growth)
            "vacancy_rate": 0.03,
            "existing_units": 6800,
            "lat_center": 33.8659,
            "lon_center": -84.3365
        },
        "Sandy Springs": {
            "base_rent_2br": 2100,
            "rent_trend": 0.002,  # +0.2% monthly (slow growth)
            "vacancy_rate": 0.06,
            "existing_units": 9200,
            "lat_center": 33.9304,
            "lon_center": -84.3733
        }
    }
    
    # Property name templates
    PROPERTY_NAMES = [
        "The {adj} {noun}",
        "{noun} at {submarket}",
        "{adj} {noun} Apartments",
        "The {noun}",
        "{submarket} {noun}"
    ]
    
    ADJECTIVES = [
        "Grand", "Modern", "Urban", "Metropolitan", "Luxury", "Premier",
        "Central", "Downtown", "Uptown", "Park", "Garden", "Tower",
        "Heights", "Plaza", "Village", "Station", "Crossing"
    ]
    
    NOUNS = [
        "Residences", "Apartments", "Lofts", "Flats", "Towers", "Place",
        "House", "Commons", "Square", "Park", "Garden", "Station",
        "Landing", "Pointe", "Ridge", "View", "Walk", "Run"
    ]
    
    def __init__(self, seed: int = 42):
        """Initialize with random seed for reproducibility"""
        random.seed(seed)
        np.random.seed(seed)
        self.property_counter = 1
        self.project_counter = 1
    
    def generate_properties(
        self,
        count: int = 50,
        submarkets: Optional[List[str]] = None
    ) -> List[MockProperty]:
        """
        Generate mock apartment properties
        
        Args:
            count: Number of properties to generate
            submarkets: List of submarkets (uses all if None)
        
        Returns:
            List of MockProperty objects
        """
        if submarkets is None:
            submarkets = list(self.SUBMARKETS.keys())
        
        properties = []
        
        for _ in range(count):
            submarket = random.choice(submarkets)
            submarket_data = self.SUBMARKETS[submarket]
            
            # Generate coordinates near submarket center
            lat = submarket_data["lat_center"] + np.random.normal(0, 0.02)
            lon = submarket_data["lon_center"] + np.random.normal(0, 0.02)
            
            # Generate property details
            property_name = self._generate_property_name(submarket)
            units = random.randint(100, 500)
            year_built = random.randint(1990, 2023)
            stories = random.randint(3, 15)
            
            # Generate address
            street_num = random.randint(100, 9999)
            streets = ["Peachtree", "Piedmont", "Spring", "Marietta", "West Peachtree", 
                      "Juniper", "Courtland", "Highland", "Monroe", "North"]
            street_name = random.choice(streets)
            street_types = ["St", "Rd", "Ave", "Blvd", "Ln", "Dr"]
            address = f"{street_num} {street_name} {random.choice(street_types)}"
            
            zip_codes = {
                "Buckhead": "30326",
                "Midtown": "30308",
                "Downtown": "30303",
                "Brookhaven": "30319",
                "Sandy Springs": "30328"
            }
            
            property = MockProperty(
                property_id=self.property_counter,
                name=property_name,
                address=address,
                city="Atlanta",
                state="GA",
                zip_code=zip_codes.get(submarket, "30303"),
                latitude=round(lat, 6),
                longitude=round(lon, 6),
                submarket=submarket,
                total_units=units,
                year_built=year_built,
                stories=stories
            )
            
            properties.append(property)
            self.property_counter += 1
        
        return properties
    
    def generate_rent_observations(
        self,
        properties: List[MockProperty],
        weeks: int = 52,
        observations_per_week: int = 1
    ) -> List[MockRentObservation]:
        """
        Generate rent time series for properties
        
        Creates realistic rent trends based on submarket characteristics:
        - Buckhead: Declining (-1%/mo)
        - Midtown: Growing (+0.5%/mo)
        - Downtown: Flat
        - Brookhaven: Strong growth (+1%/mo)
        - Sandy Springs: Slow growth (+0.2%/mo)
        
        Args:
            properties: List of properties to generate rents for
            weeks: Number of weeks of history
            observations_per_week: Observations per week per property
        
        Returns:
            List of MockRentObservation objects
        """
        observations = []
        
        # Unit type mix and sizes
        unit_types = {
            "studio": {"size_range": (450, 650), "rent_multiplier": 0.60},
            "1br": {"size_range": (650, 900), "rent_multiplier": 0.75},
            "2br": {"size_range": (900, 1300), "rent_multiplier": 1.0},
            "3br": {"size_range": (1200, 1800), "rent_multiplier": 1.30}
        }
        
        for prop in properties:
            submarket_data = self.SUBMARKETS[prop.submarket]
            base_rent_2br = submarket_data["base_rent_2br"]
            monthly_trend = submarket_data["rent_trend"]
            vacancy_rate = submarket_data["vacancy_rate"]
            
            # Generate time series for each unit type
            for unit_type, specs in unit_types.items():
                # Base rent for this unit type
                base_rent = base_rent_2br * specs["rent_multiplier"]
                
                # Random variation per property (+/- 10%)
                property_factor = random.uniform(0.9, 1.1)
                base_rent *= property_factor
                
                # Generate observations over time
                start_date = datetime.now() - timedelta(weeks=weeks)
                
                for week in range(weeks):
                    for _ in range(observations_per_week):
                        # Date for this observation
                        obs_date = start_date + timedelta(weeks=week)
                        
                        # Apply trend over time (compounding monthly)
                        months_elapsed = week / 4.33
                        trend_multiplier = (1 + monthly_trend) ** months_elapsed
                        
                        # Current rent with trend
                        current_rent = base_rent * trend_multiplier
                        
                        # Add random noise (+/- 3%)
                        noise = random.uniform(0.97, 1.03)
                        asking_rent = round(current_rent * noise, 2)
                        
                        # Random sqft within range
                        sqft = random.randint(*specs["size_range"])
                        
                        # Calculate availability based on vacancy rate
                        units_of_type = prop.total_units // len(unit_types)
                        available = int(units_of_type * vacancy_rate * random.uniform(0.5, 1.5))
                        available = max(0, min(available, units_of_type))
                        
                        obs = MockRentObservation(
                            property_id=prop.property_id,
                            observed_at=obs_date,
                            unit_type=unit_type,
                            asking_rent=asking_rent,
                            sqft=sqft,
                            available_units=available
                        )
                        
                        observations.append(obs)
        
        return observations
    
    def generate_pipeline_projects(
        self,
        count: int = 20,
        submarkets: Optional[List[str]] = None
    ) -> List[MockPipelineProject]:
        """
        Generate mock pipeline projects (under construction / planned)
        
        Args:
            count: Number of projects to generate
            submarkets: List of submarkets (uses all if None)
        
        Returns:
            List of MockPipelineProject objects
        """
        if submarkets is None:
            submarkets = list(self.SUBMARKETS.keys())
        
        projects = []
        
        statuses = [
            ("planned", 0.3),
            ("under-construction", 0.5),
            ("completed", 0.2)
        ]
        
        for _ in range(count):
            submarket = random.choice(submarkets)
            
            # Random delivery date (next 6-36 months)
            months_out = random.randint(6, 36)
            delivery_date = datetime.now() + timedelta(days=months_out * 30)
            
            # Status based on delivery timeline
            if months_out > 24:
                status = "planned"
            elif months_out > 12:
                status = "under-construction"
            else:
                status = random.choices(
                    [s[0] for s in statuses],
                    weights=[s[1] for s in statuses]
                )[0]
            
            # Project details
            project_name = self._generate_property_name(submarket) + " (New Construction)"
            units = random.randint(150, 400)
            
            street_num = random.randint(100, 9999)
            street = random.choice(["Peachtree", "Piedmont", "Spring", "West Peachtree"])
            address = f"{street_num} {street} St NE"
            
            project = MockPipelineProject(
                project_id=self.project_counter,
                name=project_name,
                address=address,
                submarket=submarket,
                units=units,
                status=status,
                estimated_delivery=delivery_date.strftime("%Y-%m-%d")
            )
            
            projects.append(project)
            self.project_counter += 1
        
        return projects
    
    def _generate_property_name(self, submarket: str) -> str:
        """Generate realistic property name"""
        template = random.choice(self.PROPERTY_NAMES)
        
        name = template.format(
            adj=random.choice(self.ADJECTIVES),
            noun=random.choice(self.NOUNS),
            submarket=submarket
        )
        
        return name
    
    def export_to_json(self, output_dir: str = "mock_data"):
        """
        Generate complete dataset and export to JSON files
        
        Creates:
        - properties.json (50 properties)
        - rent_observations.json (52 weeks of data)
        - pipeline_projects.json (20 projects)
        """
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        print("Generating mock data...")
        
        # Generate properties
        print("  - Generating 50 properties...")
        properties = self.generate_properties(count=50)
        
        with open(f"{output_dir}/properties.json", "w") as f:
            json.dump([p.to_dict() for p in properties], f, indent=2)
        
        print(f"    ✓ Saved to {output_dir}/properties.json")
        
        # Generate rent observations
        print("  - Generating 52 weeks of rent data...")
        observations = self.generate_rent_observations(properties, weeks=52)
        
        with open(f"{output_dir}/rent_observations.json", "w") as f:
            json.dump([o.to_dict() for o in observations], f, indent=2)
        
        print(f"    ✓ Saved to {output_dir}/rent_observations.json ({len(observations):,} observations)")
        
        # Generate pipeline projects
        print("  - Generating 20 pipeline projects...")
        projects = self.generate_pipeline_projects(count=20)
        
        with open(f"{output_dir}/pipeline_projects.json", "w") as f:
            json.dump([p.to_dict() for p in projects], f, indent=2)
        
        print(f"    ✓ Saved to {output_dir}/pipeline_projects.json")
        
        # Generate summary stats
        stats = {
            "generated_at": datetime.now().isoformat(),
            "properties": len(properties),
            "rent_observations": len(observations),
            "pipeline_projects": len(projects),
            "submarkets": list(self.SUBMARKETS.keys()),
            "date_range": {
                "start": (datetime.now() - timedelta(weeks=52)).strftime("%Y-%m-%d"),
                "end": datetime.now().strftime("%Y-%m-%d")
            }
        }
        
        with open(f"{output_dir}/summary.json", "w") as f:
            json.dump(stats, f, indent=2)
        
        print(f"\n✓ Mock data generation complete!")
        print(f"  Total files: 4")
        print(f"  Location: {output_dir}/")


# CLI interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate mock data for JEDI RE testing")
    parser.add_argument("--properties", type=int, default=50, help="Number of properties")
    parser.add_argument("--weeks", type=int, default=52, help="Weeks of rent history")
    parser.add_argument("--projects", type=int, default=20, help="Number of pipeline projects")
    parser.add_argument("--output", default="mock_data", help="Output directory")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    
    args = parser.parse_args()
    
    generator = MockDataGenerator(seed=args.seed)
    generator.export_to_json(output_dir=args.output)
