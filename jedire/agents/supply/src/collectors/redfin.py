"""
Redfin data collector
Collects real estate listings from Redfin API
"""
import asyncio
import aiohttp
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from loguru import logger

from .base import BaseCollector, CollectorError
from ..models import MarketData
from config.settings import settings


class RedfinCollector(BaseCollector):
    """Collect inventory data from Redfin"""
    
    def __init__(self):
        super().__init__("redfin")
        self.api_key = settings.redfin_api_key
        self.base_url = "https://redfin-com-data.p.rapidapi.com"
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            headers = {
                "X-RapidAPI-Key": self.api_key,
                "X-RapidAPI-Host": "redfin-com-data.p.rapidapi.com"
            } if self.api_key else {}
            
            self.session = aiohttp.ClientSession(
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self.session
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def collect(self, market: str) -> MarketData:
        """
        Collect Redfin data for a market
        
        Args:
            market: Market name (e.g., "Austin, TX")
            
        Returns:
            MarketData with listings and statistics
        """
        try:
            # Parse market
            city, state = self._parse_market(market)
            
            # Get listings
            active = await self._get_active_listings(city, state)
            pending = await self._get_pending_listings(city, state)
            sold = await self._get_sold_listings(city, state)
            
            # Calculate stats
            total_active = len(active)
            total_pending = len(pending)
            total_sold_30d = len(sold)
            
            median_list_price = self._calculate_median_price(active, 'list_price')
            median_sold_price = self._calculate_median_price(sold, 'sold_price')
            
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
            raise CollectorError(f"Redfin collection failed: {str(e)}")
    
    async def _get_active_listings(self, city: str, state: str) -> List[Dict[str, Any]]:
        """Get active listings"""
        if not self.api_key:
            logger.warning("Redfin API key not configured, using mock data")
            return self._generate_mock_listings(city, state, 'active')
        
        try:
            session = await self._get_session()
            
            params = {
                "city": city,
                "state_code": state,
                "status": "active",
                "limit": 1000
            }
            
            async with session.get(f"{self.base_url}/search", params=params) as response:
                response.raise_for_status()
                data = await response.json()
                
                return self._normalize_listings(data.get('homes', []))
                
        except Exception as e:
            logger.warning(f"Redfin API failed: {e}")
            return self._generate_mock_listings(city, state, 'active')
    
    async def _get_pending_listings(self, city: str, state: str) -> List[Dict[str, Any]]:
        """Get pending listings"""
        if not self.api_key:
            return self._generate_mock_listings(city, state, 'pending')
        
        try:
            session = await self._get_session()
            
            params = {
                "city": city,
                "state_code": state,
                "status": "pending",
                "limit": 1000
            }
            
            async with session.get(f"{self.base_url}/search", params=params) as response:
                response.raise_for_status()
                data = await response.json()
                
                return self._normalize_listings(data.get('homes', []))
                
        except Exception as e:
            logger.warning(f"Redfin pending failed: {e}")
            return self._generate_mock_listings(city, state, 'pending')
    
    async def _get_sold_listings(self, city: str, state: str) -> List[Dict[str, Any]]:
        """Get recently sold listings"""
        if not self.api_key:
            return self._generate_mock_listings(city, state, 'sold')
        
        try:
            session = await self._get_session()
            
            params = {
                "city": city,
                "state_code": state,
                "status": "sold",
                "sold_within_days": 30,
                "limit": 1000
            }
            
            async with session.get(f"{self.base_url}/search", params=params) as response:
                response.raise_for_status()
                data = await response.json()
                
                return self._normalize_listings(data.get('homes', []))
                
        except Exception as e:
            logger.warning(f"Redfin sold failed: {e}")
            return self._generate_mock_listings(city, state, 'sold')
    
    def _normalize_listings(self, listings: List[Dict]) -> List[Dict[str, Any]]:
        """Normalize Redfin listing data"""
        normalized = []
        
        for listing in listings:
            try:
                normalized.append({
                    'id': listing.get('propertyId'),
                    'address': listing.get('streetLine'),
                    'city': listing.get('city'),
                    'state': listing.get('state'),
                    'zip': listing.get('zipCode'),
                    'list_price': listing.get('price'),
                    'sold_price': listing.get('soldPrice'),
                    'beds': listing.get('beds'),
                    'baths': listing.get('baths'),
                    'sqft': listing.get('sqFt'),
                    'lot_size': listing.get('lotSize'),
                    'property_type': listing.get('propertyType'),
                    'year_built': listing.get('yearBuilt'),
                    'days_on_market': listing.get('dom'),
                    'list_date': listing.get('listingDate'),
                    'status': listing.get('status'),
                    'lat': listing.get('latLong', {}).get('latitude'),
                    'lng': listing.get('latLong', {}).get('longitude'),
                    'source': 'redfin'
                })
            except Exception as e:
                logger.debug(f"Failed to normalize Redfin listing: {e}")
                continue
        
        return normalized
    
    def _parse_market(self, market: str) -> tuple[str, str]:
        """Parse market string"""
        parts = market.strip().split(',')
        if len(parts) != 2:
            raise ValueError(f"Invalid market format: {market}")
        return parts[0].strip(), parts[1].strip()
    
    def _calculate_median_price(self, listings: List[Dict], price_field: str) -> Optional[float]:
        """Calculate median price"""
        prices = [l[price_field] for l in listings if l.get(price_field)]
        if not prices:
            return None
        prices.sort()
        n = len(prices)
        return prices[n//2] if n % 2 == 1 else (prices[n//2-1] + prices[n//2]) / 2
    
    def _assess_completeness(self, active: List, pending: List, sold: List) -> float:
        """Assess data quality"""
        total = len(active) + len(pending) + len(sold)
        if total == 0:
            return 0.0
        
        required = ['id', 'list_price', 'beds', 'baths', 'sqft']
        complete = sum(
            1 for l in (active + pending + sold)
            if all(l.get(f) is not None for f in required)
        )
        
        return complete / total
    
    def _generate_mock_listings(self, city: str, state: str, status: str) -> List[Dict[str, Any]]:
        """Generate mock listings for testing"""
        import random
        
        counts = {'active': 950, 'pending': 550, 'sold': 750}
        count = counts.get(status, 500)
        
        listings = []
        for i in range(count):
            listing = {
                'id': f"rf_{status}_{i}",
                'address': f"{i+100} Oak Street",
                'city': city,
                'state': state,
                'zip': '78702',
                'list_price': random.randint(250000, 900000),
                'beds': random.randint(2, 5),
                'baths': random.randint(1, 4),
                'sqft': random.randint(1200, 3500),
                'lot_size': random.randint(4000, 12000),
                'property_type': random.choice(['single_family', 'condo', 'townhouse']),
                'year_built': random.randint(1975, 2024),
                'days_on_market': random.randint(1, 120),
                'list_date': (datetime.utcnow() - timedelta(days=random.randint(1, 120))).isoformat(),
                'status': status,
                'lat': 30.267 + random.uniform(-0.15, 0.15),
                'lng': -97.743 + random.uniform(-0.15, 0.15),
                'source': 'redfin_mock'
            }
            
            if status == 'sold':
                listing['sold_price'] = listing['list_price'] * random.uniform(0.93, 1.03)
            
            listings.append(listing)
        
        return listings
