"""
Zillow data collector
Collects real estate listings from Zillow API and web scraping
"""
import asyncio
import aiohttp
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from loguru import logger

from .base import BaseCollector, CollectorError
from ..models import MarketData
from config.settings import settings


class ZillowCollector(BaseCollector):
    """Collect inventory data from Zillow"""
    
    def __init__(self):
        super().__init__("zillow")
        self.api_key = settings.zillow_api_key
        self.base_url = "https://api.bridgedataoutput.com/api/v2/zillow"
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self.session
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def collect(self, market: str) -> MarketData:
        """
        Collect Zillow data for a market
        
        Args:
            market: Market name (e.g., "Austin, TX")
            
        Returns:
            MarketData with listings and statistics
        """
        try:
            # Parse market into city and state
            city, state = self._parse_market(market)
            
            # Collect data in parallel
            active_task = self._get_active_listings(city, state)
            pending_task = self._get_pending_listings(city, state)
            sold_task = self._get_sold_listings(city, state)
            
            active, pending, sold = await asyncio.gather(
                active_task, pending_task, sold_task,
                return_exceptions=True
            )
            
            # Handle any errors
            active = active if not isinstance(active, Exception) else []
            pending = pending if not isinstance(pending, Exception) else []
            sold = sold if not isinstance(sold, Exception) else []
            
            # Calculate statistics
            total_active = len(active)
            total_pending = len(pending)
            total_sold_30d = len(sold)
            
            # Calculate median prices
            median_list_price = self._calculate_median_price(active, 'list_price')
            median_sold_price = self._calculate_median_price(sold, 'sold_price')
            
            # Assess data quality
            completeness = self._assess_completeness(active, pending, sold)
            
            return MarketData(
                source=self.name,
                market=market,
                active_listings=active,
                pending_listings=pending,
                sold_listings=sold,
                total_active=total_active,
                total_pending=total_pending,
                total_sold_30d=total_sold_30d,
                median_list_price=median_list_price,
                median_sold_price=median_sold_price,
                completeness=completeness,
                is_stale=False
            )
            
        except Exception as e:
            raise CollectorError(f"Zillow collection failed: {str(e)}")
    
    async def _get_active_listings(self, city: str, state: str) -> List[Dict[str, Any]]:
        """Get active listings for a market"""
        if not self.api_key:
            logger.warning("Zillow API key not configured, using mock data")
            return self._generate_mock_active_listings(city, state)
        
        try:
            session = await self._get_session()
            
            params = {
                "city": city,
                "state": state,
                "status": "for_sale",
                "limit": 1000
            }
            
            async with session.get(f"{self.base_url}/listings", params=params) as response:
                response.raise_for_status()
                data = await response.json()
                
                return self._normalize_listings(data.get('listings', []))
                
        except Exception as e:
            logger.warning(f"Zillow API failed, using mock data: {e}")
            return self._generate_mock_active_listings(city, state)
    
    async def _get_pending_listings(self, city: str, state: str) -> List[Dict[str, Any]]:
        """Get pending listings"""
        if not self.api_key:
            return self._generate_mock_pending_listings(city, state)
        
        try:
            session = await self._get_session()
            
            params = {
                "city": city,
                "state": state,
                "status": "pending",
                "limit": 1000
            }
            
            async with session.get(f"{self.base_url}/listings", params=params) as response:
                response.raise_for_status()
                data = await response.json()
                
                return self._normalize_listings(data.get('listings', []))
                
        except Exception as e:
            logger.warning(f"Zillow pending listings failed: {e}")
            return self._generate_mock_pending_listings(city, state)
    
    async def _get_sold_listings(self, city: str, state: str) -> List[Dict[str, Any]]:
        """Get sold listings (last 30 days)"""
        if not self.api_key:
            return self._generate_mock_sold_listings(city, state)
        
        try:
            session = await self._get_session()
            
            thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
            
            params = {
                "city": city,
                "state": state,
                "status": "sold",
                "sold_after": thirty_days_ago,
                "limit": 1000
            }
            
            async with session.get(f"{self.base_url}/listings", params=params) as response:
                response.raise_for_status()
                data = await response.json()
                
                return self._normalize_listings(data.get('listings', []))
                
        except Exception as e:
            logger.warning(f"Zillow sold listings failed: {e}")
            return self._generate_mock_sold_listings(city, state)
    
    def _normalize_listings(self, listings: List[Dict]) -> List[Dict[str, Any]]:
        """Normalize Zillow listing data to standard format"""
        normalized = []
        
        for listing in listings:
            try:
                normalized.append({
                    'id': listing.get('zpid'),
                    'address': listing.get('address'),
                    'city': listing.get('city'),
                    'state': listing.get('state'),
                    'zip': listing.get('zipcode'),
                    'list_price': listing.get('price'),
                    'sold_price': listing.get('soldPrice'),
                    'beds': listing.get('bedrooms'),
                    'baths': listing.get('bathrooms'),
                    'sqft': listing.get('livingArea'),
                    'lot_size': listing.get('lotSize'),
                    'property_type': listing.get('homeType'),
                    'year_built': listing.get('yearBuilt'),
                    'days_on_market': listing.get('daysOnZillow'),
                    'list_date': listing.get('datePosted'),
                    'status': listing.get('homeStatus'),
                    'lat': listing.get('latitude'),
                    'lng': listing.get('longitude'),
                    'source': 'zillow'
                })
            except Exception as e:
                logger.debug(f"Failed to normalize listing: {e}")
                continue
        
        return normalized
    
    def _parse_market(self, market: str) -> tuple[str, str]:
        """Parse market string into city and state"""
        parts = market.strip().split(',')
        if len(parts) != 2:
            raise ValueError(f"Invalid market format: {market}. Expected 'City, ST'")
        
        city = parts[0].strip()
        state = parts[1].strip()
        
        return city, state
    
    def _calculate_median_price(self, listings: List[Dict], price_field: str) -> Optional[float]:
        """Calculate median price from listings"""
        prices = [
            listing[price_field] 
            for listing in listings 
            if listing.get(price_field) is not None
        ]
        
        if not prices:
            return None
        
        prices.sort()
        n = len(prices)
        
        if n % 2 == 0:
            return (prices[n//2 - 1] + prices[n//2]) / 2
        else:
            return prices[n//2]
    
    def _assess_completeness(self, active: List, pending: List, sold: List) -> float:
        """Assess data completeness (0-1)"""
        total_listings = len(active) + len(pending) + len(sold)
        
        if total_listings == 0:
            return 0.0
        
        # Check for required fields
        required_fields = ['id', 'list_price', 'beds', 'baths', 'sqft', 'days_on_market']
        complete_count = 0
        
        for listing in active + pending + sold:
            if all(listing.get(field) is not None for field in required_fields):
                complete_count += 1
        
        return complete_count / total_listings if total_listings > 0 else 0.0
    
    # Mock data generators (for testing without API keys)
    def _generate_mock_active_listings(self, city: str, state: str) -> List[Dict[str, Any]]:
        """Generate mock active listings for testing"""
        import random
        
        count = random.randint(800, 1200)
        listings = []
        
        for i in range(count):
            listings.append({
                'id': f"zpid_{i}",
                'address': f"{i} Main St",
                'city': city,
                'state': state,
                'zip': '78701',
                'list_price': random.randint(200000, 800000),
                'beds': random.randint(2, 5),
                'baths': random.randint(1, 3),
                'sqft': random.randint(1000, 3000),
                'lot_size': random.randint(5000, 10000),
                'property_type': random.choice(['single_family', 'condo', 'townhouse']),
                'year_built': random.randint(1970, 2023),
                'days_on_market': random.randint(1, 90),
                'list_date': (datetime.utcnow() - timedelta(days=random.randint(1, 90))).isoformat(),
                'status': 'for_sale',
                'lat': 30.267 + random.uniform(-0.1, 0.1),
                'lng': -97.743 + random.uniform(-0.1, 0.1),
                'source': 'zillow_mock'
            })
        
        return listings
    
    def _generate_mock_pending_listings(self, city: str, state: str) -> List[Dict[str, Any]]:
        """Generate mock pending listings"""
        import random
        count = random.randint(400, 700)
        # Similar to active but with pending status
        listings = self._generate_mock_active_listings(city, state)[:count]
        for listing in listings:
            listing['status'] = 'pending'
        return listings
    
    def _generate_mock_sold_listings(self, city: str, state: str) -> List[Dict[str, Any]]:
        """Generate mock sold listings"""
        import random
        count = random.randint(600, 900)
        listings = self._generate_mock_active_listings(city, state)[:count]
        for listing in listings:
            listing['status'] = 'sold'
            listing['sold_price'] = listing['list_price'] * random.uniform(0.95, 1.05)
        return listings
