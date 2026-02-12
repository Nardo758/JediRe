"""
JEDI RE - FastAPI Server
Minimal working API for proof of concept
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Any
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from signal_processing import SignalProcessor
from carrying_capacity import CarryingCapacityEngine, SubmarketData
from imbalance_detector import ImbalanceDetector

# Import development capacity API
from .development_capacity import router as development_router

app = FastAPI(title="JEDI RE API", version="1.0.0")

# Include development capacity routes
app.include_router(development_router)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection (use environment variables or defaults)
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5433')),
    'database': os.getenv('DB_NAME', 'jedire'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'jedire123')
}

# Initialize engines
signal_processor = SignalProcessor()
capacity_engine = CarryingCapacityEngine()
imbalance_detector = ImbalanceDetector()


def get_db():
    """Get database connection"""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "JEDI RE API",
        "version": "1.0.0",
        "endpoints": {
            "submarkets": "/api/v1/submarkets",
            "analysis": "/api/v1/submarkets/{id}/analysis",
            "ui": "/ui"
        }
    }


@app.get("/api/v1/submarkets")
async def list_submarkets():
    """List all submarkets"""
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT id, name, city, state, population, 
                   population_growth_rate, employment, median_income
            FROM submarkets
            ORDER BY state, city, name
        """)
        submarkets = cur.fetchall()
        return {"success": True, "data": submarkets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.get("/api/v1/submarkets/{submarket_id}")
async def get_submarket(submarket_id: int):
    """Get submarket details"""
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT * FROM submarkets WHERE id = %s
        """, (submarket_id,))
        submarket = cur.fetchone()
        
        if not submarket:
            raise HTTPException(status_code=404, detail="Submarket not found")
        
        return {"success": True, "data": submarket}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.get("/api/v1/submarkets/{submarket_id}/rents")
async def get_submarket_rents(submarket_id: int):
    """Get rent timeseries data for charts"""
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Get property in submarket
        cur.execute("""
            SELECT id FROM properties 
            WHERE submarket_id = %s
            LIMIT 1
        """, (submarket_id,))
        property_data = cur.fetchone()
        
        if not property_data:
            raise HTTPException(status_code=404, detail="No properties found")
        
        # Get rent timeseries
        cur.execute("""
            SELECT 
                timestamp,
                weighted_avg,
                one_bed_avg,
                two_bed_avg,
                occupancy_pct,
                concession_weeks
            FROM rents_timeseries
            WHERE property_id = %s
            ORDER BY timestamp ASC
        """, (property_data['id'],))
        
        rents = cur.fetchall()
        
        return {
            "success": True,
            "data": [
                {
                    "date": r['timestamp'].strftime('%Y-%m-%d'),
                    "weighted_avg": float(r['weighted_avg']) if r['weighted_avg'] else None,
                    "one_bed": float(r['one_bed_avg']) if r['one_bed_avg'] else None,
                    "two_bed": float(r['two_bed_avg']) if r['two_bed_avg'] else None,
                    "occupancy": float(r['occupancy_pct']) if r['occupancy_pct'] else None,
                    "concessions": r['concession_weeks']
                }
                for r in rents
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.get("/api/v1/submarkets/{submarket_id}/analysis")
async def get_submarket_analysis(submarket_id: int):
    """Run full analysis on a submarket"""
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Get submarket data
        cur.execute("SELECT * FROM submarkets WHERE id = %s", (submarket_id,))
        submarket = cur.fetchone()
        
        if not submarket:
            raise HTTPException(status_code=404, detail="Submarket not found")
        
        # Get properties in submarket
        cur.execute("""
            SELECT id, name, total_units 
            FROM properties 
            WHERE submarket_id = %s
            LIMIT 1
        """, (submarket_id,))
        property_data = cur.fetchone()
        
        if not property_data:
            raise HTTPException(status_code=404, detail="No properties found in submarket")
        
        # Get rent timeseries
        cur.execute("""
            SELECT weighted_avg, timestamp
            FROM rents_timeseries
            WHERE property_id = %s
            ORDER BY timestamp ASC
        """, (property_data['id'],))
        rents = cur.fetchall()
        
        if len(rents) < 4:
            raise HTTPException(status_code=400, detail="Not enough rent data for analysis")
        
        # Get supply pipeline
        cur.execute("""
            SELECT COALESCE(SUM(units), 0) as pipeline_units
            FROM supply_pipeline
            WHERE submarket_id = %s
            AND status IN ('Under Construction', 'Permitted')
        """, (submarket_id,))
        pipeline = cur.fetchone()
        
        # Prepare data for analysis
        rent_timeseries = [float(r['weighted_avg']) for r in rents if r['weighted_avg']]
        
        submarket_data = SubmarketData(
            name=submarket['name'],
            population=submarket['population'] or 0,
            population_growth_rate=float(submarket['population_growth_rate'] or 0),
            net_migration_annual=int(submarket['population'] * float(submarket['population_growth_rate'] or 0)),
            employment=submarket['employment'] or 0,
            employment_growth_rate=float(submarket.get('employment_growth_rate') or 0),
            median_income=float(submarket['median_income'] or 0),
            existing_units=property_data['total_units'],
            pipeline_units=pipeline['pipeline_units'] or 0,
            future_permitted_units=0
        )
        
        # Run analysis
        result = imbalance_detector.analyze_imbalance(
            submarket_data,
            rent_timeseries,
            search_trend_change=None  # Would come from Google Trends
        )
        
        # Format response
        return {
            "success": True,
            "data": {
                "submarket": {
                    "id": submarket_id,
                    "name": submarket['name'],
                    "city": submarket['city'],
                    "state": submarket['state']
                },
                "verdict": result.verdict.value,
                "composite_score": result.composite_score,
                "confidence": float(result.confidence),
                "demand_signal": {
                    "strength": result.demand_signal.strength.value,
                    "score": result.demand_signal.score,
                    "rent_growth_rate": float(result.demand_signal.rent_growth_rate),
                    "confidence": float(result.demand_signal.confidence),
                    "summary": result.demand_signal.summary
                },
                "supply_signal": {
                    "verdict": result.supply_signal.verdict.value,
                    "saturation_pct": float(result.supply_signal.saturation_pct),
                    "demand_capacity": result.supply_signal.demand_units,
                    "total_supply": result.supply_signal.total_supply,
                    "equilibrium_quarters": result.supply_signal.equilibrium_quarters,
                    "summary": result.supply_signal.summary
                },
                "recommendation": result.recommendation,
                "key_factors": result.key_factors,
                "risks": result.risks
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


# Serve static files (UI)
if os.path.exists("src/web"):
    app.mount("/ui", StaticFiles(directory="src/web", html=True), name="ui")
    
    @app.get("/ui")
    async def serve_ui():
        return FileResponse("src/web/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
