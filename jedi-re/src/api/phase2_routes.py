"""
Phase 2 API Routes - Market Intelligence Endpoints
Connects Phase 1 (capacity) with Phase 2 (market) for Phase 3 (optimization)
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

# Import Phase 1 engines (already built)
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from engines.imbalance_detector import ImbalanceDetector
from engines.signal_processing import SignalProcessingEngine
from engines.carrying_capacity import CarryingCapacityEngine

router = APIRouter(prefix="/api/v1", tags=["market-intelligence"])

# ============================================================================
# PYDANTIC MODELS (API Request/Response Schemas)
# ============================================================================

class SubmarketSummary(BaseModel):
    """Summary info for a submarket"""
    submarket_id: int
    name: str
    city: str
    existing_units: Optional[int] = None
    pipeline_units: Optional[int] = None
    avg_rent_2br: Optional[float] = None
    rent_growth_12mo: Optional[float] = None
    market_score: Optional[int] = None
    market_verdict: Optional[str] = None

class SubmarketDetail(BaseModel):
    """Detailed submarket profile"""
    submarket_id: int
    name: str
    city: str
    
    # Inventory
    property_count: Optional[int] = None
    total_units: Optional[int] = None
    avg_year_built: Optional[int] = None
    
    # Pipeline
    under_construction_units: Optional[int] = None
    planned_units: Optional[int] = None
    delivering_12mo: Optional[int] = None
    
    # Rents
    avg_rent_studio: Optional[float] = None
    avg_rent_1br: Optional[float] = None
    avg_rent_2br: Optional[float] = None
    avg_rent_3br: Optional[float] = None
    avg_rent_per_sqft: Optional[float] = None
    
    # Market dynamics
    rent_growth_12mo: Optional[float] = None
    vacancy_rate: Optional[float] = None
    absorption_rate: Optional[float] = None
    
    # Demographics
    population: Optional[int] = None
    median_income: Optional[float] = None
    households: Optional[int] = None

class MarketAnalysis(BaseModel):
    """Full market analysis output (from Imbalance Detector)"""
    submarket_id: int
    submarket_name: str
    analyzed_at: datetime
    
    # Overall verdict
    verdict: str  # STRONG_OPPORTUNITY, MODERATE_OPPORTUNITY, etc.
    score: int  # 0-100
    confidence: float  # 0-1
    
    # Supply metrics
    supply_score: int
    supply_verdict: str
    existing_units: int
    pipeline_units: int
    saturation_level: float
    
    # Demand metrics
    demand_score: int
    demand_verdict: str
    rent_growth_12mo: float
    absorption_rate: Optional[float]
    population_growth: Optional[float]
    
    # Recommendations
    recommendations: List[str]
    risks: List[str]
    opportunities: List[str]

class PropertyListing(BaseModel):
    """Property summary"""
    property_id: int
    name: str
    address: str
    submarket_name: Optional[str] = None
    total_units: Optional[int] = None
    year_built: Optional[int] = None
    avg_rent_2br: Optional[float] = None

class RentHistory(BaseModel):
    """Rent time series for a property"""
    property_id: int
    property_name: str
    unit_type: str
    observations: List[dict]  # [{date, rent, sqft, available}]

class ParcelMarketFit(BaseModel):
    """Market fit analysis for a specific parcel"""
    parcel_id: int
    address: str
    submarket_name: str
    
    # Phase 1: What CAN be built
    max_buildable_units: int
    estimated_far: Optional[float]
    development_potential: str
    
    # Phase 2: What SHOULD be built
    market_verdict: str
    market_score: int
    recommended_unit_mix: dict  # {studio: 0.05, 1br: 0.30, ...}
    target_rents: dict  # {studio: 1650, 1br: 2100, ...}
    estimated_absorption_months: Optional[float]
    
    # Combined recommendation
    recommendation: str
    reasoning: List[str]

# ============================================================================
# DATABASE HELPER
# ============================================================================

def get_db_connection():
    """Get database connection"""
    import os
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        database=os.getenv("DB_NAME", "jedire"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        cursor_factory=RealDictCursor
    )

# ============================================================================
# ENDPOINTS: SUBMARKETS
# ============================================================================

@router.get("/submarkets", response_model=List[SubmarketSummary])
async def list_submarkets(
    city: Optional[str] = None,
    min_score: Optional[int] = Query(None, ge=0, le=100)
):
    """
    List all submarkets with basic stats
    
    Filters:
    - city: Filter by city name
    - min_score: Only show submarkets with market_score >= this value
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT 
            sm.submarket_id,
            sm.name,
            sm.city,
            inv.total_units as existing_units,
            pip.under_construction_units + pip.planned_units as pipeline_units,
            sig.avg_rent_2br,
            sig.rent_growth_12mo,
            sig.market_score,
            sig.market_verdict
        FROM submarkets sm
        LEFT JOIN submarket_inventory inv ON sm.submarket_id = inv.submarket_id
        LEFT JOIN submarket_pipeline pip ON sm.submarket_id = pip.submarket_id
        LEFT JOIN latest_market_signals sig ON sm.submarket_id = sig.submarket_id
        WHERE 1=1
    """
    
    params = []
    if city:
        query += " AND sm.city = %s"
        params.append(city)
    
    if min_score is not None:
        query += " AND sig.market_score >= %s"
        params.append(min_score)
    
    query += " ORDER BY sig.market_score DESC NULLS LAST"
    
    cur.execute(query, params)
    results = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return [SubmarketSummary(**row) for row in results]

@router.get("/submarkets/{submarket_id}", response_model=SubmarketDetail)
async def get_submarket(submarket_id: int):
    """Get detailed information about a specific submarket"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT 
            sm.submarket_id,
            sm.name,
            sm.city,
            inv.property_count,
            inv.total_units,
            inv.avg_year_built,
            pip.under_construction_units,
            pip.planned_units,
            pip.delivering_12mo,
            sig.avg_rent_studio,
            sig.avg_rent_1br,
            sig.avg_rent_2br,
            sig.avg_rent_3br,
            sig.avg_rent_per_sqft,
            sig.rent_growth_12mo,
            sig.vacancy_rate,
            sig.absorption_rate,
            demo.population,
            demo.median_income,
            demo.households
        FROM submarkets sm
        LEFT JOIN submarket_inventory inv ON sm.submarket_id = inv.submarket_id
        LEFT JOIN submarket_pipeline pip ON sm.submarket_id = pip.submarket_id
        LEFT JOIN latest_market_signals sig ON sm.submarket_id = sig.submarket_id
        LEFT JOIN submarket_demographics demo ON sm.submarket_id = demo.submarket_id 
            AND demo.year = EXTRACT(YEAR FROM NOW())
        WHERE sm.submarket_id = %s
    """
    
    cur.execute(query, (submarket_id,))
    result = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=404, detail="Submarket not found")
    
    return SubmarketDetail(**result)

@router.get("/submarkets/{submarket_id}/analysis", response_model=MarketAnalysis)
async def analyze_submarket(
    submarket_id: int,
    weeks_of_data: int = Query(12, ge=4, le=52)
):
    """
    Run full supply-demand analysis on a submarket
    
    Uses Phase 1 engines:
    - Signal Processing Engine (rent trends)
    - Carrying Capacity Engine (saturation)
    - Imbalance Detector (verdict)
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get submarket name
    cur.execute("SELECT name FROM submarkets WHERE submarket_id = %s", (submarket_id,))
    result = cur.fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Submarket not found")
    submarket_name = result['name']
    
    # Get rent data for signal processing
    cur.execute("""
        SELECT 
            observed_at,
            AVG(asking_rent) as avg_rent
        FROM rent_observations ro
        JOIN properties p ON ro.property_id = p.property_id
        WHERE p.submarket_id = %s
        AND ro.unit_type = '2br'
        AND ro.observed_at > NOW() - INTERVAL '%s weeks'
        GROUP BY observed_at
        ORDER BY observed_at
    """, (submarket_id, weeks_of_data))
    
    rent_data = cur.fetchall()
    
    # Get supply data
    cur.execute("""
        SELECT 
            COALESCE(SUM(total_units), 0) as existing_units
        FROM properties
        WHERE submarket_id = %s
    """, (submarket_id,))
    existing_units = cur.fetchone()['existing_units']
    
    cur.execute("""
        SELECT 
            COALESCE(SUM(units), 0) as pipeline_units
        FROM pipeline_projects
        WHERE submarket_id = %s
        AND status IN ('planned', 'under-construction')
    """, (submarket_id,))
    pipeline_units = cur.fetchone()['pipeline_units']
    
    # Get demographic data for demand estimation
    cur.execute("""
        SELECT population, households, median_income
        FROM submarket_demographics
        WHERE submarket_id = %s
        ORDER BY year DESC
        LIMIT 1
    """, (submarket_id,))
    demographics = cur.fetchone()
    
    cur.close()
    conn.close()
    
    # Run Phase 1 engines
    detector = ImbalanceDetector()
    
    # TODO: Pass real data to detector
    # For now, return mock analysis structure
    # (Will be implemented when we have real rent data)
    
    return MarketAnalysis(
        submarket_id=submarket_id,
        submarket_name=submarket_name,
        analyzed_at=datetime.now(),
        verdict="MODERATE_OPPORTUNITY",
        score=66,
        confidence=0.85,
        supply_score=94,
        supply_verdict="CRITICALLY_UNDERSUPPLIED",
        existing_units=existing_units,
        pipeline_units=pipeline_units,
        saturation_level=0.02,
        demand_score=38,
        demand_verdict="WEAK",
        rent_growth_12mo=-1.2,
        absorption_rate=None,
        population_growth=None,
        recommendations=[
            "Market is undersupplied but demand is weak",
            "Consider value-oriented development",
            "Optimize for cost efficiency over luxury finishes"
        ],
        risks=[
            "Rent growth is negative (-1.2% over 12mo)",
            "Weak demand may slow absorption"
        ],
        opportunities=[
            "Very low saturation (2%) indicates supply constraint",
            "Future upside when demand recovers"
        ]
    )

# ============================================================================
# ENDPOINTS: PROPERTIES
# ============================================================================

@router.get("/properties", response_model=List[PropertyListing])
async def list_properties(
    submarket_id: Optional[int] = None,
    min_units: Optional[int] = None,
    max_units: Optional[int] = None,
    limit: int = Query(100, le=1000)
):
    """List properties with filters"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT 
            p.property_id,
            p.name,
            p.address,
            sm.name as submarket_name,
            p.total_units,
            p.year_built,
            AVG(ro.asking_rent) FILTER (WHERE ro.unit_type = '2br') as avg_rent_2br
        FROM properties p
        LEFT JOIN submarkets sm ON p.submarket_id = sm.submarket_id
        LEFT JOIN rent_observations ro ON p.property_id = ro.property_id
            AND ro.observed_at > NOW() - INTERVAL '30 days'
        WHERE 1=1
    """
    
    params = []
    if submarket_id:
        query += " AND p.submarket_id = %s"
        params.append(submarket_id)
    
    if min_units:
        query += " AND p.total_units >= %s"
        params.append(min_units)
    
    if max_units:
        query += " AND p.total_units <= %s"
        params.append(max_units)
    
    query += """
        GROUP BY p.property_id, p.name, p.address, sm.name, p.total_units, p.year_built
        ORDER BY p.property_id
        LIMIT %s
    """
    params.append(limit)
    
    cur.execute(query, params)
    results = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return [PropertyListing(**row) for row in results]

@router.get("/properties/{property_id}/rent-history", response_model=RentHistory)
async def get_rent_history(
    property_id: int,
    unit_type: str = Query("2br", regex="^(studio|1br|2br|3br|4br)$"),
    months: int = Query(12, ge=1, le=60)
):
    """Get rent time series for a property"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get property name
    cur.execute("SELECT name FROM properties WHERE property_id = %s", (property_id,))
    result = cur.fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Property not found")
    property_name = result['name']
    
    # Get rent observations
    cur.execute("""
        SELECT 
            observed_at as date,
            asking_rent as rent,
            sqft,
            available_units as available
        FROM rent_observations
        WHERE property_id = %s
        AND unit_type = %s
        AND observed_at > NOW() - INTERVAL '%s months'
        ORDER BY observed_at
    """, (property_id, unit_type, months))
    
    observations = [dict(row) for row in cur.fetchall()]
    
    cur.close()
    conn.close()
    
    return RentHistory(
        property_id=property_id,
        property_name=property_name,
        unit_type=unit_type,
        observations=observations
    )

# ============================================================================
# ENDPOINTS: PARCEL + MARKET INTEGRATION
# ============================================================================

@router.post("/parcels/{parcel_id}/market-fit", response_model=ParcelMarketFit)
async def analyze_parcel_market_fit(parcel_id: int):
    """
    Analyze market fit for a specific parcel
    
    Combines:
    - Phase 1: Development capacity (what CAN be built)
    - Phase 2: Market intelligence (what SHOULD be built)
    
    Returns optimization recommendations for Phase 3
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get parcel info + capacity analysis
    cur.execute("""
        SELECT 
            p.parcel_id,
            p.address,
            p.current_zoning,
            p.lot_size_sqft,
            sm.name as submarket_name,
            sm.submarket_id,
            dc.maximum_buildable_units,
            dc.estimated_far,
            dc.development_potential
        FROM parcels p
        LEFT JOIN submarkets sm ON ST_Contains(sm.boundary, p.coordinates)
        LEFT JOIN development_capacity dc ON p.parcel_id = dc.parcel_id
        WHERE p.parcel_id = %s
    """, (parcel_id,))
    
    parcel = cur.fetchone()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    
    # Get market signals for this submarket
    if parcel['submarket_id']:
        cur.execute("""
            SELECT 
                market_verdict,
                market_score,
                avg_rent_studio,
                avg_rent_1br,
                avg_rent_2br,
                avg_rent_3br,
                absorption_rate
            FROM latest_market_signals
            WHERE submarket_id = %s
        """, (parcel['submarket_id'],))
        market = cur.fetchone()
    else:
        market = None
    
    cur.close()
    conn.close()
    
    # Build recommendation
    if not market:
        recommendation = "Market data not available for this location"
        reasoning = ["No submarket match found", "Manual market analysis required"]
        unit_mix = {}
        target_rents = {}
        absorption_months = None
        market_verdict = "UNKNOWN"
        market_score = 0
    else:
        # TODO: Call Phase 3 optimizer here
        # For now, return simplified recommendation
        
        market_verdict = market['market_verdict'] or "UNKNOWN"
        market_score = market['market_score'] or 0
        
        # Simple unit mix recommendation (will be optimized in Phase 3)
        unit_mix = {
            "studio": 0.05,
            "1br": 0.30,
            "2br": 0.55,
            "3br": 0.10
        }
        
        target_rents = {
            "studio": market.get('avg_rent_studio'),
            "1br": market.get('avg_rent_1br'),
            "2br": market.get('avg_rent_2br'),
            "3br": market.get('avg_rent_3br')
        }
        
        absorption_months = None
        if market.get('absorption_rate') and parcel['maximum_buildable_units']:
            absorption_months = parcel['maximum_buildable_units'] / market['absorption_rate']
        
        if market_verdict == "STRONG_OPPORTUNITY":
            recommendation = "Strong market - build to maximum capacity with premium finishes"
            reasoning = [
                f"Market score: {market_score}/100 (strong)",
                f"Can build {parcel['maximum_buildable_units']} units",
                "High demand supports aggressive development"
            ]
        elif market_verdict in ["MODERATE_OPPORTUNITY", "NEUTRAL"]:
            recommendation = "Moderate market - optimize for cost efficiency"
            reasoning = [
                f"Market score: {market_score}/100 (moderate)",
                f"Can build {parcel['maximum_buildable_units']} units",
                "Focus on value engineering and absorption velocity"
            ]
        else:
            recommendation = "Weak market - consider holding or alternative uses"
            reasoning = [
                f"Market score: {market_score}/100 (weak)",
                "Development may face headwinds",
                "Wait for market improvement or explore mixed-use"
            ]
    
    return ParcelMarketFit(
        parcel_id=parcel['parcel_id'],
        address=parcel['address'] or "Address unknown",
        submarket_name=parcel['submarket_name'] or "Unknown submarket",
        max_buildable_units=parcel['maximum_buildable_units'] or 0,
        estimated_far=parcel['estimated_far'],
        development_potential=parcel['development_potential'] or "UNKNOWN",
        market_verdict=market_verdict,
        market_score=market_score,
        recommended_unit_mix=unit_mix,
        target_rents=target_rents,
        estimated_absorption_months=absorption_months,
        recommendation=recommendation,
        reasoning=reasoning
    )

# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
