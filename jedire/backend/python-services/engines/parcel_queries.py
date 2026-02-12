#!/usr/bin/env python3
"""
Parcel data query functions for feeding analysis engines
Works with both database and direct GeoJSON files
"""
import json
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass
import psycopg2


@dataclass
class ParcelData:
    """Single parcel data"""
    apn: str
    address: str
    neighborhood: str
    zoning: str
    lot_size_sqft: float
    current_units: int
    land_value: float
    total_value: float
    coordinates: tuple  # (lat, lon)


@dataclass
class NeighborhoodStats:
    """Aggregated neighborhood/submarket statistics"""
    name: str
    total_parcels: int
    total_units: int
    total_land_value: float
    total_property_value: float
    avg_lot_size: float
    zoning_mix: Dict[str, int]  # zoning_code: count
    developable_parcels: int  # Parcels with development potential


class ParcelDataSource:
    """Data source for parcel queries - supports both database and GeoJSON"""
    
    def __init__(self, db_url: Optional[str] = None, geojson_path: Optional[str] = None):
        self.db_url = db_url
        self.geojson_path = geojson_path or "../gis-data/fulton_parcels_sample.geojson"
        self._geojson_cache = None
    
    def _load_geojson(self) -> List[dict]:
        """Load and cache GeoJSON data"""
        if self._geojson_cache is None:
            geojson_file = Path(__file__).parent.parent / self.geojson_path
            with open(geojson_file, 'r') as f:
                data = json.load(f)
                self._geojson_cache = data['features']
        return self._geojson_cache
    
    def _parse_parcel_from_geojson(self, feature: dict) -> ParcelData:
        """Parse a GeoJSON feature into ParcelData"""
        props = feature['properties']
        geom = feature.get('geometry', {})
        
        # Extract coordinates
        coords = geom.get('coordinates', [])
        if coords and len(coords) > 0 and geom.get('type') == 'Polygon':
            lat, lon = coords[0][0][1], coords[0][0][0]
        else:
            lat, lon = 0, 0
        
        return ParcelData(
            apn=props.get('PARCELID', ''),
            address=props.get('SITEADDRESS', '').strip(),
            neighborhood=props.get('NEIGHBORHOOD', ''),
            zoning=props.get('ZONING1', '') or props.get('ZONING2', ''),
            lot_size_sqft=float(props.get('SHAPE.AREA', 0)),
            current_units=int(props.get('LIVUNITS', 0) or 0),
            land_value=float(props.get('LNDVALUE', 0) or 0),
            total_value=float(props.get('CNTASSDVAL', 0) or 0),
            coordinates=(lat, lon)
        )
    
    def get_parcels_by_neighborhood(self, neighborhood: str) -> List[ParcelData]:
        """Get all parcels for a specific neighborhood"""
        if self.db_url:
            return self._get_from_database(neighborhood)
        else:
            return self._get_from_geojson(neighborhood)
    
    def _get_from_geojson(self, neighborhood: str) -> List[ParcelData]:
        """Get parcels from GeoJSON file"""
        features = self._load_geojson()
        parcels = []
        
        for feature in features:
            props = feature['properties']
            nh = props.get('NEIGHBORHOOD', '') or ''
            if nh.lower() == neighborhood.lower():
                parcels.append(self._parse_parcel_from_geojson(feature))
        
        return parcels
    
    def _get_from_database(self, neighborhood: str) -> List[ParcelData]:
        """Get parcels from database"""
        conn = psycopg2.connect(self.db_url)
        parcels = []
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT apn, address, neighborhood, current_zoning, lot_size_sqft,
                           current_units, land_value, total_appraised_value,
                           coordinates_lat, coordinates_lon
                    FROM parcels
                    WHERE neighborhood ILIKE %s
                """, (neighborhood,))
                
                for row in cur.fetchall():
                    parcels.append(ParcelData(
                        apn=row[0],
                        address=row[1],
                        neighborhood=row[2],
                        zoning=row[3],
                        lot_size_sqft=row[4],
                        current_units=row[5],
                        land_value=row[6],
                        total_value=row[7],
                        coordinates=(row[8], row[9])
                    ))
        finally:
            conn.close()
        
        return parcels
    
    def get_neighborhood_stats(self, neighborhood: str) -> NeighborhoodStats:
        """Get aggregated statistics for a neighborhood"""
        parcels = self.get_parcels_by_neighborhood(neighborhood)
        
        if not parcels:
            return None
        
        # Calculate statistics
        total_units = sum(p.current_units for p in parcels)
        total_land_value = sum(p.land_value for p in parcels)
        total_value = sum(p.total_value for p in parcels)
        avg_lot_size = sum(p.lot_size_sqft for p in parcels) / len(parcels)
        
        # Zoning mix
        zoning_mix = {}
        for p in parcels:
            if p.zoning:
                zoning_mix[p.zoning] = zoning_mix.get(p.zoning, 0) + 1
        
        # Count developable parcels (simple heuristic: large lots with low utilization)
        developable = sum(
            1 for p in parcels 
            if p.lot_size_sqft > 5000 and p.current_units < 2
        )
        
        return NeighborhoodStats(
            name=neighborhood,
            total_parcels=len(parcels),
            total_units=total_units,
            total_land_value=total_land_value,
            total_property_value=total_value,
            avg_lot_size=avg_lot_size,
            zoning_mix=zoning_mix,
            developable_parcels=developable
        )
    
    def list_neighborhoods(self) -> List[str]:
        """List all available neighborhoods"""
        if self.db_url:
            conn = psycopg2.connect(self.db_url)
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT DISTINCT neighborhood 
                        FROM parcels 
                        WHERE neighborhood IS NOT NULL 
                        ORDER BY neighborhood
                    """)
                    return [row[0] for row in cur.fetchall()]
            finally:
                conn.close()
        else:
            features = self._load_geojson()
            neighborhoods = set()
            for feature in features:
                nh = feature['properties'].get('NEIGHBORHOOD')
                if nh:
                    neighborhoods.add(nh)
            return sorted(neighborhoods)


def demo():
    """Demo the parcel query functions"""
    print("="*60)
    print("PARCEL DATA QUERY DEMO")
    print("="*60)
    
    # Create data source (using GeoJSON)
    source = ParcelDataSource()
    
    # List neighborhoods
    print("\nAvailable neighborhoods:")
    neighborhoods = source.list_neighborhoods()
    for i, nh in enumerate(neighborhoods[:10], 1):
        print(f"  {i}. {nh}")
    if len(neighborhoods) > 10:
        print(f"  ... and {len(neighborhoods) - 10} more")
    
    # Get stats for a specific neighborhood
    if neighborhoods:
        neighborhood = neighborhoods[0]
        print(f"\n{'='*60}")
        print(f"NEIGHBORHOOD STATS: {neighborhood}")
        print(f"{'='*60}")
        
        stats = source.get_neighborhood_stats(neighborhood)
        
        if stats:
            print(f"\nParcels: {stats.total_parcels:,}")
            print(f"Current Units: {stats.total_units:,}")
            print(f"Total Land Value: ${stats.total_land_value:,.0f}")
            print(f"Total Property Value: ${stats.total_property_value:,.0f}")
            print(f"Avg Lot Size: {stats.avg_lot_size:,.0f} sqft")
            print(f"Developable Parcels: {stats.developable_parcels}")
            
            print(f"\nZoning Mix:")
            for zoning, count in sorted(stats.zoning_mix.items(), key=lambda x: x[1], reverse=True)[:5]:
                pct = (count / stats.total_parcels) * 100
                print(f"  {zoning or 'Unknown':15} {count:3} parcels ({pct:.1f}%)")
        else:
            print("No data found")


if __name__ == '__main__':
    demo()
