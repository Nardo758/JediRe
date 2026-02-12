"""
Geocoding and Parcel Matching Module
Converts addresses to coordinates and matches to parcels in database
"""

from typing import Optional, Tuple, List, Dict, Any
from dataclasses import dataclass
import logging
import time
from functools import lru_cache

logger = logging.getLogger(__name__)


@dataclass
class GeocodingResult:
    """Result of geocoding operation"""
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    confidence: float = 0.0  # 0-1
    source: Optional[str] = None
    matched_parcel_id: Optional[int] = None
    error: Optional[str] = None


class Geocoder:
    """
    Multi-source geocoding with fallback
    Tries multiple services in order until one succeeds
    """
    
    def __init__(self, cache_size: int = 10000):
        self.cache_size = cache_size
        self.geocode_cache = {}  # Simple dict cache (will upgrade to Redis for production)
        self.rate_limiters = {}  # Track API rate limits
    
    @lru_cache(maxsize=10000)
    def geocode(
        self,
        address: str,
        city: Optional[str] = None,
        state: Optional[str] = None,
        zip_code: Optional[str] = None
    ) -> GeocodingResult:
        """
        Geocode an address to lat/lon coordinates
        
        Args:
            address: Street address
            city: City name
            state: State code (e.g., 'GA')
            zip_code: ZIP code
        
        Returns:
            GeocodingResult with coordinates or error
        """
        # Build full address string
        full_address_parts = [address]
        if city:
            full_address_parts.append(city)
        if state:
            full_address_parts.append(state)
        if zip_code:
            full_address_parts.append(zip_code)
        
        full_address = ", ".join(full_address_parts)
        
        # Check cache first
        cache_key = full_address.lower().strip()
        if cache_key in self.geocode_cache:
            logger.debug(f"Cache hit for: {full_address}")
            return self.geocode_cache[cache_key]
        
        # Try geocoding services in order of preference
        result = None
        
        # 1. Try Nominatim (OpenStreetMap - free, no API key)
        try:
            result = self._geocode_nominatim(full_address)
            if result.latitude and result.longitude:
                logger.info(f"Geocoded via Nominatim: {full_address}")
                self.geocode_cache[cache_key] = result
                return result
        except Exception as e:
            logger.debug(f"Nominatim failed: {e}")
        
        # 2. Try Google Geocoding API (if API key available)
        try:
            result = self._geocode_google(full_address)
            if result and result.latitude and result.longitude:
                logger.info(f"Geocoded via Google: {full_address}")
                self.geocode_cache[cache_key] = result
                return result
        except Exception as e:
            logger.debug(f"Google failed: {e}")
        
        # 3. Try Mapbox (if API key available)
        try:
            result = self._geocode_mapbox(full_address)
            if result and result.latitude and result.longitude:
                logger.info(f"Geocoded via Mapbox: {full_address}")
                self.geocode_cache[cache_key] = result
                return result
        except Exception as e:
            logger.debug(f"Mapbox failed: {e}")
        
        # All services failed
        result = GeocodingResult(
            address=full_address,
            error="All geocoding services failed"
        )
        self.geocode_cache[cache_key] = result
        return result
    
    def _geocode_nominatim(self, address: str) -> GeocodingResult:
        """
        Geocode using Nominatim (OpenStreetMap)
        Free, no API key required, but rate-limited to 1 req/sec
        """
        from geopy.geocoders import Nominatim
        from geopy.exc import GeocoderTimedOut, GeocoderServiceError
        
        # Rate limiting
        self._rate_limit("nominatim", requests_per_second=1)
        
        try:
            geolocator = Nominatim(user_agent="jedire-geocoder")
            location = geolocator.geocode(address, timeout=10)
            
            if location:
                return GeocodingResult(
                    address=address,
                    latitude=location.latitude,
                    longitude=location.longitude,
                    confidence=0.8,  # Nominatim doesn't provide confidence scores
                    source="nominatim"
                )
            else:
                return GeocodingResult(
                    address=address,
                    error="Address not found"
                )
        
        except (GeocoderTimedOut, GeocoderServiceError) as e:
            return GeocodingResult(
                address=address,
                error=f"Nominatim error: {str(e)}"
            )
    
    def _geocode_google(self, address: str) -> Optional[GeocodingResult]:
        """
        Geocode using Google Geocoding API
        Requires API key (set GOOGLE_GEOCODING_API_KEY env var)
        """
        import os
        api_key = os.getenv("GOOGLE_GEOCODING_API_KEY")
        
        if not api_key:
            logger.debug("Google API key not configured")
            return None
        
        try:
            from googlemaps import Client as GoogleMaps
            
            gmaps = GoogleMaps(key=api_key)
            result = gmaps.geocode(address)
            
            if result and len(result) > 0:
                location = result[0]['geometry']['location']
                return GeocodingResult(
                    address=address,
                    latitude=location['lat'],
                    longitude=location['lng'],
                    confidence=0.95,  # Google is typically very accurate
                    source="google"
                )
            
            return None
        
        except Exception as e:
            logger.warning(f"Google geocoding error: {e}")
            return None
    
    def _geocode_mapbox(self, address: str) -> Optional[GeocodingResult]:
        """
        Geocode using Mapbox Geocoding API
        Requires API key (set MAPBOX_ACCESS_TOKEN env var)
        """
        import os
        import requests
        
        api_key = os.getenv("MAPBOX_ACCESS_TOKEN")
        
        if not api_key:
            logger.debug("Mapbox API key not configured")
            return None
        
        try:
            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{address}.json"
            params = {
                "access_token": api_key,
                "limit": 1
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('features'):
                feature = data['features'][0]
                coords = feature['geometry']['coordinates']
                confidence = feature.get('relevance', 0.8)
                
                return GeocodingResult(
                    address=address,
                    latitude=coords[1],  # Mapbox returns [lon, lat]
                    longitude=coords[0],
                    confidence=confidence,
                    source="mapbox"
                )
            
            return None
        
        except Exception as e:
            logger.warning(f"Mapbox geocoding error: {e}")
            return None
    
    def _rate_limit(self, service: str, requests_per_second: float):
        """Simple rate limiting"""
        if service not in self.rate_limiters:
            self.rate_limiters[service] = {'last_request': 0}
        
        limiter = self.rate_limiters[service]
        now = time.time()
        time_since_last = now - limiter['last_request']
        min_interval = 1.0 / requests_per_second
        
        if time_since_last < min_interval:
            sleep_time = min_interval - time_since_last
            time.sleep(sleep_time)
        
        limiter['last_request'] = time.time()


class ParcelMatcher:
    """
    Matches geocoded coordinates to parcels in database
    Uses spatial queries (PostGIS)
    """
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    def find_parcel_by_coordinates(
        self,
        latitude: float,
        longitude: float,
        buffer_meters: int = 50
    ) -> Optional[int]:
        """
        Find parcel containing the given coordinates
        
        Args:
            latitude: Latitude
            longitude: Longitude
            buffer_meters: Search within this radius if exact match fails
        
        Returns:
            parcel_id if found, None otherwise
        """
        cursor = self.db.cursor()
        
        # Try exact containment first
        query = """
            SELECT parcel_id
            FROM parcels
            WHERE ST_Contains(
                coordinates,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            )
            LIMIT 1
        """
        
        cursor.execute(query, (longitude, latitude))
        result = cursor.fetchone()
        
        if result:
            cursor.close()
            return result[0]
        
        # If no exact match, try finding nearest parcel within buffer
        query = """
            SELECT parcel_id,
                   ST_Distance(
                       coordinates::geography,
                       ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                   ) as distance
            FROM parcels
            WHERE ST_DWithin(
                coordinates::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                %s
            )
            ORDER BY distance
            LIMIT 1
        """
        
        cursor.execute(query, (longitude, latitude, longitude, latitude, buffer_meters))
        result = cursor.fetchone()
        
        cursor.close()
        
        if result:
            parcel_id, distance = result
            logger.info(f"Found nearby parcel (distance: {distance:.1f}m)")
            return parcel_id
        
        return None
    
    def find_parcel_by_address(
        self,
        address: str,
        city: Optional[str] = None,
        zip_code: Optional[str] = None
    ) -> Optional[int]:
        """
        Find parcel by address string matching
        Faster than geocoding, but less reliable
        """
        cursor = self.db.cursor()
        
        # Normalize address for fuzzy matching
        normalized_address = address.lower().strip()
        
        query = """
            SELECT parcel_id,
                   similarity(LOWER(address), %s) as score
            FROM parcels
            WHERE 1=1
        """
        
        params = [normalized_address]
        
        if city:
            query += " AND LOWER(city) = %s"
            params.append(city.lower())
        
        if zip_code:
            query += " AND zip_code = %s"
            params.append(zip_code)
        
        query += " ORDER BY score DESC LIMIT 1"
        
        cursor.execute(query, params)
        result = cursor.fetchone()
        
        cursor.close()
        
        if result and result[1] > 0.6:  # Minimum 60% similarity
            logger.info(f"Found parcel by address match (score: {result[1]:.2f})")
            return result[0]
        
        return None


class GeocodingPipeline:
    """
    Complete pipeline: Address → Coordinates → Parcel
    """
    
    def __init__(self, db_connection):
        self.geocoder = Geocoder()
        self.matcher = ParcelMatcher(db_connection)
    
    def geocode_and_match(
        self,
        address: str,
        city: Optional[str] = None,
        state: Optional[str] = None,
        zip_code: Optional[str] = None,
        try_address_match_first: bool = True
    ) -> GeocodingResult:
        """
        Full pipeline: geocode address and match to parcel
        
        Args:
            address: Street address
            city: City name
            state: State code
            zip_code: ZIP code
            try_address_match_first: Try direct address matching before geocoding
        
        Returns:
            GeocodingResult with matched_parcel_id if successful
        """
        result = GeocodingResult(address=address)
        
        # Strategy 1: Try direct address matching (faster, no API calls)
        if try_address_match_first:
            parcel_id = self.matcher.find_parcel_by_address(address, city, zip_code)
            if parcel_id:
                result.matched_parcel_id = parcel_id
                result.confidence = 0.7  # Lower confidence for address-only match
                result.source = "address_match"
                logger.info(f"Matched parcel by address: {address} → {parcel_id}")
                return result
        
        # Strategy 2: Geocode to coordinates, then spatial match
        geocode_result = self.geocoder.geocode(address, city, state, zip_code)
        
        if geocode_result.latitude and geocode_result.longitude:
            result.latitude = geocode_result.latitude
            result.longitude = geocode_result.longitude
            result.source = geocode_result.source
            result.confidence = geocode_result.confidence
            
            # Find parcel at these coordinates
            parcel_id = self.matcher.find_parcel_by_coordinates(
                geocode_result.latitude,
                geocode_result.longitude
            )
            
            if parcel_id:
                result.matched_parcel_id = parcel_id
                logger.info(f"Matched parcel by geocoding: {address} → {parcel_id}")
            else:
                result.error = "Geocoded but no parcel found at location"
                logger.warning(f"Geocoded but no parcel match: {address}")
        else:
            result.error = geocode_result.error or "Geocoding failed"
            logger.warning(f"Failed to geocode: {address}")
        
        return result
    
    def batch_geocode_and_match(
        self,
        addresses: List[Dict[str, str]],
        batch_size: int = 100
    ) -> List[GeocodingResult]:
        """
        Batch process multiple addresses
        
        Args:
            addresses: List of dicts with keys: address, city, state, zip_code
            batch_size: Process this many at a time
        
        Returns:
            List of GeocodingResults
        """
        results = []
        total = len(addresses)
        
        for i in range(0, total, batch_size):
            batch = addresses[i:i+batch_size]
            logger.info(f"Processing batch {i//batch_size + 1} ({i+1}-{min(i+batch_size, total)} of {total})")
            
            for addr_dict in batch:
                result = self.geocode_and_match(
                    address=addr_dict.get('address', ''),
                    city=addr_dict.get('city'),
                    state=addr_dict.get('state'),
                    zip_code=addr_dict.get('zip_code')
                )
                results.append(result)
        
        # Statistics
        matched = sum(1 for r in results if r.matched_parcel_id is not None)
        geocoded = sum(1 for r in results if r.latitude is not None)
        
        logger.info(f"Batch complete: {matched}/{total} matched to parcels, {geocoded}/{total} geocoded")
        
        return results


# Example usage
if __name__ == "__main__":
    import psycopg2
    
    # Test geocoding
    print("Testing geocoder...")
    geocoder = Geocoder()
    
    test_address = "3350 Peachtree Rd NE, Atlanta, GA 30326"
    result = geocoder.geocode(test_address)
    
    if result.latitude and result.longitude:
        print(f"✓ Geocoded: {result.latitude}, {result.longitude} (via {result.source})")
    else:
        print(f"✗ Failed: {result.error}")
    
    # Test parcel matching
    print("\nTesting parcel matcher...")
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="jedire",
            user="postgres",
            password=""
        )
        
        pipeline = GeocodingPipeline(conn)
        result = pipeline.geocode_and_match(test_address)
        
        if result.matched_parcel_id:
            print(f"✓ Matched to parcel: {result.matched_parcel_id}")
        else:
            print(f"✗ No parcel match: {result.error}")
        
        conn.close()
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
