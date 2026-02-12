"""
Development Capacity API Endpoints for JEDI RE
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engines.development_capacity_analyzer import DevelopmentCapacityAnalyzer, DevelopmentCapacityResult
from services.zoning_rules_service import get_zoning_service

router = APIRouter(prefix="/api/v1/development", tags=["development"])

# Database configuration (same as main.py)
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5433')),
    'database': os.getenv('DB_NAME', 'jedire'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'jedire123')
}


def get_db():
    """Get database connection"""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)


def get_analyzer():
    """Get development capacity analyzer instance"""
    return DevelopmentCapacityAnalyzer()


@router.get("/zoning-codes")
async def list_zoning_codes(
    zone_type: Optional[str] = Query(None, description="Filter by zone type"),
    city: str = Query("Atlanta", description="City name"),
    state: str = Query("GA", description="State code")
):
    """
    List available zoning codes
    """
    zoning_service = get_zoning_service()
    
    if zone_type:
        codes = zoning_service.get_zoning_codes_by_type(zone_type)
    else:
        codes = zoning_service.get_all_zoning_codes()
    
    return {
        "success": True,
        "data": {
            "city": city,
            "state": state,
            "zoning_codes": codes,
            "count": len(codes)
        }
    }


@router.get("/zoning-rules/{zoning_code}")
async def get_zoning_rules(
    zoning_code: str,
    city: str = Query("Atlanta", description="City name"),
    state: str = Query("GA", description="State code")
):
    """
    Get zoning rules for a specific zoning code
    """
    zoning_service = get_zoning_service()
    rules = zoning_service.get_rules_by_zone(zoning_code)
    
    if not rules:
        raise HTTPException(
            status_code=404,
            detail=f"Zoning code '{zoning_code}' not found for {city}, {state}"
        )
    
    # Convert to dict for response
    rules_dict = {
        "zoning_code": rules.zoning_code,
        "description": rules.description,
        "zone_type": rules.zone_type,
        "minimum_lot_size_sqft": rules.minimum_lot_size_sqft,
        "minimum_lot_size_acres": rules.minimum_lot_size_acres,
        "maximum_density_units_per_acre": rules.maximum_density_units_per_acre,
        "maximum_far": rules.maximum_far,
        "maximum_height_feet": rules.maximum_height_feet,
        "maximum_height_stories": rules.maximum_height_stories,
        "front_setback_feet": rules.front_setback_feet,
        "rear_setback_feet": rules.rear_setback_feet,
        "side_setback_feet": rules.side_setback_feet,
        "parking_required_per_unit": rules.parking_required_per_unit,
        "maximum_lot_coverage": rules.maximum_lot_coverage,
        "notes": rules.notes,
        "constraints": rules.constraints
    }
    
    return {
        "success": True,
        "data": rules_dict
    }


@router.post("/parcels/analyze")
async def analyze_parcel_development_capacity(
    parcel_data: Dict[str, Any]
):
    """
    Analyze development capacity for a parcel
    
    Request body should include:
    - parcel_id (optional): Unique identifier
    - current_zoning: Zoning code (e.g., "MR-4A")
    - lot_size_sqft: Lot size in square feet
    - current_units: Current number of units (default: 0)
    - location: Optional location description
    - submarket_id: Optional submarket ID
    """
    required_fields = ["current_zoning", "lot_size_sqft"]
    for field in required_fields:
        if field not in parcel_data:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required field: {field}"
            )
    
    analyzer = get_analyzer()
    
    try:
        result = analyzer.analyze_parcel(
            parcel_id=parcel_data.get("parcel_id", 0),
            current_zoning=parcel_data["current_zoning"],
            lot_size_sqft=float(parcel_data["lot_size_sqft"]),
            current_units=parcel_data.get("current_units", 0),
            location=parcel_data.get("location"),
            submarket_id=parcel_data.get("submarket_id")
        )
        
        return {
            "success": True,
            "data": result.to_dict()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/parcels/{parcel_id}/development-capacity")
async def get_parcel_development_capacity(
    parcel_id: int,
    recalculate: bool = Query(False, description="Recalculate even if cached")
):
    """
    Get development capacity analysis for a specific parcel
    
    First checks if analysis exists in database, otherwise calculates it.
    """
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Get parcel information from database
        cur.execute("""
            SELECT 
                p.id, p.name, p.submarket_id, p.total_units as current_units,
                p.zoning_code, p.lot_size_sqft,
                s.name as submarket_name, s.city, s.state
            FROM properties p
            LEFT JOIN submarkets s ON s.id = p.submarket_id
            WHERE p.id = %s
        """, (parcel_id,))
        
        parcel = cur.fetchone()
        
        if not parcel:
            raise HTTPException(status_code=404, detail="Parcel not found")
        
        # Check for existing analysis
        if not recalculate:
            cur.execute("""
                SELECT * FROM development_capacity_analysis
                WHERE property_id = %s
                ORDER BY analyzed_at DESC
                LIMIT 1
            """, (parcel_id,))
            
            existing_analysis = cur.fetchone()
            
            if existing_analysis:
                return {
                    "success": True,
                    "data": {
                        "parcel": dict(parcel),
                        "analysis": existing_analysis,
                        "source": "cached"
                    }
                }
        
        # Calculate new analysis
        analyzer = get_analyzer()
        
        result = analyzer.analyze_parcel(
            parcel_id=parcel_id,
            current_zoning=parcel.get("zoning_code", ""),
            lot_size_sqft=float(parcel.get("lot_size_sqft", 0)),
            current_units=parcel.get("current_units", 0),
            submarket_id=parcel.get("submarket_id")
        )
        
        # Store analysis in database
        cur.execute("""
            INSERT INTO development_capacity_analysis (
                property_id, submarket_id, zoning_code, lot_size_sqft,
                current_units, maximum_buildable_units, development_potential,
                estimated_far, max_height_feet, constraints, supply_forecast,
                confidence_score, analysis_method, analysis_version
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """, (
            parcel_id,
            parcel.get("submarket_id"),
            result.current_zoning,
            result.lot_size_sqft,
            result.current_units,
            result.maximum_buildable_units,
            result.development_potential.value if result.development_potential else None,
            result.estimated_far,
            result.max_height_feet,
            psycopg2.extras.Json(result.constraints),
            psycopg2.extras.Json(result.supply_forecast),
            result.confidence_score,
            'zoning_rules',
            '1.0'
        ))
        
        conn.commit()
        
        return {
            "success": True,
            "data": {
                "parcel": dict(parcel),
                "analysis": result.to_dict(),
                "source": "calculated"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.get("/submarkets/{submarket_id}/development-pipeline")
async def get_submarket_development_pipeline(
    submarket_id: int,
    include_parcels: bool = Query(False, description="Include individual parcel analysis")
):
    """
    Get development pipeline analysis for a submarket
    
    Analyzes all parcels in the submarket to estimate total development potential.
    """
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Get submarket information
        cur.execute("""
            SELECT * FROM submarkets WHERE id = %s
        """, (submarket_id,))
        
        submarket = cur.fetchone()
        
        if not submarket:
            raise HTTPException(status_code=404, detail="Submarket not found")
        
        # Get parcels in submarket
        cur.execute("""
            SELECT 
                id, name, zoning_code, lot_size_sqft, 
                total_units as current_units,
                development_capacity
            FROM properties 
            WHERE submarket_id = %s
            AND zoning_code IS NOT NULL
            AND lot_size_sqft IS NOT NULL
        """, (submarket_id,))
        
        parcels = cur.fetchall()
        
        if not parcels:
            return {
                "success": True,
                "data": {
                    "submarket": dict(submarket),
                    "message": "No parcels with zoning data found",
                    "total_potential_new_units": 0,
                    "parcels_analyzed": 0
                }
            }
        
        # Analyze each parcel
        analyzer = get_analyzer()
        parcel_analyses = []
        total_potential = 0
        
        for parcel in parcels:
            result = analyzer.analyze_parcel(
                parcel_id=parcel['id'],
                current_zoning=parcel['zoning_code'],
                lot_size_sqft=float(parcel['lot_size_sqft']),
                current_units=parcel['current_units'],
                submarket_id=submarket_id
            )
            
            new_units = result.maximum_buildable_units - result.current_units
            if new_units > 0:
                total_potential += new_units
            
            if include_parcels:
                parcel_analyses.append({
                    "parcel_id": parcel['id'],
                    "parcel_name": parcel['name'],
                    "analysis": result.to_dict()
                })
        
        # Get pipeline summary from view
        cur.execute("""
            SELECT * FROM submarket_development_pipeline
            WHERE submarket_id = %s
        """, (submarket_id,))
        
        pipeline_summary = cur.fetchone()
        
        response_data = {
            "submarket": dict(submarket),
            "pipeline_summary": dict(pipeline_summary) if pipeline_summary else {},
            "total_potential_new_units": total_potential,
            "parcels_analyzed": len(parcels),
            "parcels_with_development_potential": len([p for p in parcel_analyses if p["analysis"]["maximum_buildable_units"] > p["analysis"]["current_units"]])
        }
        
        if include_parcels:
            response_data["parcel_analyses"] = parcel_analyses
        
        return {
            "success": True,
            "data": response_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.post("/submarkets/{submarket_id}/analyze-pipeline")
async def analyze_submarket_pipeline(
    submarket_id: int,
    parcel_data: List[Dict[str, Any]]
):
    """
    Analyze development pipeline for a submarket with custom parcel data
    
    Useful for analyzing parcels not yet in the database.
    """
    analyzer = get_analyzer()
    
    try:
        result = analyzer.analyze_submarket_pipeline(submarket_id, parcel_data)
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/calculate-max-units")
async def calculate_max_units(
    zoning_code: str,
    lot_size_sqft: float,
    current_units: int = Query(0, description="Current number of units")
):
    """
    Quick calculation of maximum buildable units
    
    Simple endpoint for quick calculations without full analysis.
    """
    zoning_service = get_zoning_service()
    
    max_units = zoning_service.calculate_max_units(zoning_code, lot_size_sqft)
    
    if max_units is None:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot calculate max units for zoning code: {zoning_code}"
        )
    
    return {
        "success": True,
        "data": {
            "zoning_code": zoning_code,
            "lot_size_sqft": lot_size_sqft,
            "current_units": current_units,
            "maximum_buildable_units": max_units,
            "potential_new_units": max(0, max_units - current_units)
        }
    }