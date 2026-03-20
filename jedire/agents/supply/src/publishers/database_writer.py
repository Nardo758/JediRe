"""
Database Writer
Stores supply metrics in PostgreSQL database
"""
import asyncpg
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from loguru import logger

from ..models import SupplyAnalysis
from config.settings import settings


class DatabaseWriter:
    """Write supply analysis results to PostgreSQL"""
    
    def __init__(self):
        self.name = "DatabaseWriter"
        self.pool: Optional[asyncpg.Pool] = None
        self.enabled = settings.enable_database
        self.database_url = settings.database_url
        self.write_count = 0
        self.error_count = 0
    
    async def connect(self):
        """Initialize database connection pool"""
        if not self.enabled:
            logger.info("Database writing disabled")
            return
        
        try:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=settings.database_pool_size,
                max_size=settings.database_pool_size + settings.database_max_overflow,
                command_timeout=30
            )
            logger.success(f"Connected to database")
            
            # Ensure table exists
            await self._create_table()
            
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            self.enabled = False
    
    async def _create_table(self):
        """Create supply_metrics table if it doesn't exist"""
        create_sql = """
        CREATE TABLE IF NOT EXISTS supply_metrics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            timestamp TIMESTAMP NOT NULL,
            market VARCHAR(255) NOT NULL,
            
            -- Core metrics
            total_inventory INTEGER,
            months_of_supply DECIMAL(6,2),
            absorption_rate DECIMAL(6,4),
            median_dom INTEGER,
            new_listings_30d INTEGER,
            pending_sales INTEGER,
            closed_sales_30d INTEGER,
            price_reductions INTEGER,
            
            -- Trends
            inventory_change_30d DECIMAL(6,2),
            inventory_change_90d DECIMAL(6,2),
            absorption_change DECIMAL(6,4),
            dom_change_30d DECIMAL(6,2),
            new_listings_trend VARCHAR(20),
            
            -- Score
            supply_score INTEGER,
            score_inventory_component DECIMAL(6,2),
            score_absorption_component DECIMAL(6,2),
            score_dom_component DECIMAL(6,2),
            score_trend_component DECIMAL(6,2),
            interpretation VARCHAR(50),
            confidence DECIMAL(4,3),
            
            -- AI insights
            ai_summary TEXT,
            ai_key_findings JSONB,
            ai_recommendations JSONB,
            ai_risks JSONB,
            ai_opportunities JSONB,
            
            -- Metadata
            data_sources JSONB,
            data_quality VARCHAR(50),
            processing_time_ms INTEGER,
            raw_data JSONB,
            
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_supply_market_time 
            ON supply_metrics(market, timestamp DESC);
        
        CREATE INDEX IF NOT EXISTS idx_supply_score 
            ON supply_metrics(supply_score DESC);
        
        CREATE INDEX IF NOT EXISTS idx_supply_created 
            ON supply_metrics(created_at DESC);
        """
        
        async with self.pool.acquire() as conn:
            await conn.execute(create_sql)
            logger.success("Supply metrics table ready")
    
    async def write_analysis(self, analysis: SupplyAnalysis) -> bool:
        """
        Write supply analysis to database
        
        Args:
            analysis: SupplyAnalysis object
            
        Returns:
            True if written successfully
        """
        if not self.enabled or self.pool is None:
            logger.warning("Database disabled, skipping write")
            return False
        
        try:
            insert_sql = """
            INSERT INTO supply_metrics (
                timestamp, market,
                total_inventory, months_of_supply, absorption_rate, median_dom,
                new_listings_30d, pending_sales, closed_sales_30d, price_reductions,
                inventory_change_30d, inventory_change_90d, absorption_change,
                dom_change_30d, new_listings_trend,
                supply_score, score_inventory_component, score_absorption_component,
                score_dom_component, score_trend_component, interpretation, confidence,
                ai_summary, ai_key_findings, ai_recommendations, ai_risks, ai_opportunities,
                data_sources, data_quality, processing_time_ms, raw_data
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
            )
            """
            
            # Prepare data
            ai = analysis.ai_insights
            
            async with self.pool.acquire() as conn:
                await conn.execute(
                    insert_sql,
                    analysis.timestamp,
                    analysis.market,
                    # Metrics
                    analysis.metrics.total_inventory,
                    analysis.metrics.months_of_supply,
                    analysis.metrics.absorption_rate,
                    analysis.metrics.median_dom,
                    analysis.metrics.new_listings_30d,
                    analysis.metrics.pending_sales,
                    analysis.metrics.closed_sales_30d,
                    analysis.metrics.price_reductions,
                    # Trends
                    analysis.trends.inventory_change_30d,
                    analysis.trends.inventory_change_90d,
                    analysis.trends.absorption_change,
                    analysis.trends.dom_change_30d,
                    analysis.trends.new_listings_trend,
                    # Score
                    analysis.score.overall_score,
                    analysis.score.inventory_component,
                    analysis.score.absorption_component,
                    analysis.score.dom_component,
                    analysis.score.trend_component,
                    analysis.score.interpretation.value,
                    analysis.score.confidence,
                    # AI
                    ai.summary if ai else None,
                    ai.key_findings if ai else None,
                    ai.recommendations if ai else None,
                    ai.risks if ai else None,
                    ai.opportunities if ai else None,
                    # Metadata
                    analysis.data_sources,
                    analysis.data_quality,
                    analysis.processing_time_ms,
                    analysis.model_dump(mode='json')
                )
            
            self.write_count += 1
            
            logger.success(f"Wrote analysis for {analysis.market} to database")
            
            return True
            
        except Exception as e:
            self.error_count += 1
            logger.error(f"Database write failed: {e}")
            return False
    
    async def get_historical_metrics(
        self,
        market: str,
        days_back: int = 90
    ) -> List[Dict[str, Any]]:
        """
        Retrieve historical metrics for a market
        
        Args:
            market: Market identifier
            days_back: Number of days of history to retrieve
            
        Returns:
            List of historical metric dictionaries
        """
        if not self.enabled or self.pool is None:
            return []
        
        try:
            cutoff = datetime.utcnow() - timedelta(days=days_back)
            
            query = """
            SELECT 
                timestamp,
                total_inventory,
                months_of_supply,
                absorption_rate,
                median_dom,
                new_listings_30d,
                supply_score
            FROM supply_metrics
            WHERE market = $1 AND timestamp >= $2
            ORDER BY timestamp DESC
            """
            
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, market, cutoff)
                
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Failed to retrieve historical metrics: {e}")
            return []
    
    async def close(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
    
    def get_stats(self) -> dict:
        """Get writer statistics"""
        return {
            "enabled": self.enabled,
            "writes": self.write_count,
            "errors": self.error_count,
            "success_rate": (
                (self.write_count / (self.write_count + self.error_count))
                if (self.write_count + self.error_count) > 0
                else 1.0
            )
        }
