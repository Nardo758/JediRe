"""
Supply Agent - Replit Edition (Simplified)
Direct database writes, no Kafka, mock data support
"""
import asyncio
import sys
import random
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import asyncpg
from loguru import logger

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings_replit import settings, validate_settings


class SimpleSupplyAgent:
    """
    Simplified Supply Agent for Replit
    - Generates supply metrics for markets
    - Writes directly to PostgreSQL
    - No external dependencies if using mock data
    """
    
    def __init__(self):
        self.name = "SimpleSupplyAgent"
        self.db_pool = None
        self.runs_completed = 0
        self._setup_logging()
    
    def _setup_logging(self):
        """Configure logging"""
        logger.remove()
        
        # Console
        logger.add(
            sys.stdout,
            format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
            level=settings.log_level,
            colorize=True
        )
        
        # File (if directory exists)
        if settings.log_dir.exists() or self._try_create_log_dir():
            logger.add(
                settings.log_file,
                format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}",
                level="DEBUG",
                rotation=settings.log_max_bytes,
                retention=settings.log_backup_count
            )
    
    def _try_create_log_dir(self) -> bool:
        """Try to create log directory"""
        try:
            settings.log_dir.mkdir(exist_ok=True, parents=True)
            return True
        except:
            return False
    
    async def start(self):
        """Start the agent"""
        logger.info("=" * 60)
        logger.info("🚀 SUPPLY AGENT (Replit Edition)")
        logger.info("=" * 60)
        
        # Validate settings
        validate_settings()
        
        logger.info(f"Markets: {', '.join(settings.markets_list)}")
        logger.info(f"Interval: {settings.agent_run_interval_minutes} minutes")
        logger.info(f"Mock data: {settings.use_mock_data}")
        logger.info(f"Database: {'✓' if settings.enable_database else '✗'}")
        logger.info(f"AI insights: {'✓' if settings.enable_ai_insights else '✗'}")
        logger.info("=" * 60)
        
        # Connect to database
        if settings.enable_database:
            try:
                await self._connect_db()
            except Exception as e:
                logger.error(f"Database connection failed: {e}")
                logger.warning("Continuing without database...")
        
        # Run main loop
        try:
            await self._run_loop()
        except KeyboardInterrupt:
            logger.info("Shutdown signal received")
        finally:
            await self._shutdown()
    
    async def _connect_db(self):
        """Connect to PostgreSQL"""
        logger.info("Connecting to PostgreSQL...")
        self.db_pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=1,
            max_size=5
        )
        logger.success("Database connected")
    
    async def _run_loop(self):
        """Main agent loop"""
        while True:
            try:
                await self._run_analysis_cycle()
                
                logger.info(f"💤 Sleeping for {settings.agent_run_interval_minutes} minutes...")
                await asyncio.sleep(settings.agent_run_interval_minutes * 60)
                
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                await asyncio.sleep(60)
    
    async def _run_analysis_cycle(self):
        """Run one analysis cycle"""
        logger.info("")
        logger.info("📊 STARTING ANALYSIS CYCLE")
        logger.info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("-" * 60)
        
        for market in settings.markets_list:
            try:
                await self._analyze_market(market)
            except Exception as e:
                logger.error(f"Failed to analyze {market}: {e}")
        
        self.runs_completed += 1
        logger.success(f"✓ Cycle complete! (Total runs: {self.runs_completed})")
    
    async def _analyze_market(self, market: str):
        """Analyze a single market"""
        logger.info(f"\n🏙️  Analyzing: {market}")
        
        # Generate metrics (mock or real)
        metrics = await self._collect_metrics(market)
        
        # Calculate score
        score = self._calculate_score(metrics)
        metrics['score'] = score['overall_score']
        metrics['interpretation'] = score['interpretation']
        
        # Generate AI insights (if enabled)
        if settings.enable_ai_insights:
            metrics['ai_insights'] = await self._generate_ai_insights(market, metrics)
        else:
            metrics['ai_insights'] = f"Supply analysis for {market}. Score: {score['overall_score']}/100"
        
        # Save to database
        if self.db_pool:
            await self._save_to_db(market, metrics)
        
        # Log results
        logger.success(f"✓ {market}: Score {metrics['score']:.1f}/100 ({metrics['interpretation']})")
        logger.info(f"  Inventory: {metrics['total_inventory']:,} | MoS: {metrics['months_of_supply']:.1f}")
    
    async def _collect_metrics(self, market: str) -> Dict[str, Any]:
        """Collect market metrics (mock data for now)"""
        
        if settings.use_mock_data:
            # Generate realistic mock data
            base = hash(market + str(datetime.now().date())) % 1000
            
            return {
                'total_inventory': 1500 + base * 10,
                'new_listings': 150 + base % 100,
                'active_listings': 1200 + base * 8,
                'pending_listings': 200 + base % 50,
                'under_contract': 100 + base % 30,
                'months_of_supply': round(2.5 + (base % 30) / 10, 2),
                'absorption_rate': round(0.05 + (base % 20) / 1000, 4),
                'avg_days_on_market': 30 + base % 40,
                'price_reduction_rate': round(0.10 + (base % 15) / 100, 4),
                'data_sources': ['mock_data']
            }
        else:
            # TODO: Implement real data collection from Zillow/Redfin
            logger.warning("Real data collection not implemented yet, using mock data")
            return await self._collect_metrics(market)
    
    def _calculate_score(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate supply score"""
        
        # Simple scoring algorithm
        mos = metrics['months_of_supply']
        
        if mos < 3:
            score = 75 + (3 - mos) * 10
            interp = 'low_supply'
        elif mos < 6:
            score = 50 + (6 - mos) * 8
            interp = 'balanced'
        else:
            score = max(10, 50 - (mos - 6) * 5)
            interp = 'high_supply'
        
        return {
            'overall_score': min(100, max(0, score)),
            'interpretation': interp
        }
    
    async def _generate_ai_insights(self, market: str, metrics: Dict[str, Any]) -> str:
        """Generate AI insights (if Claude API key available)"""
        
        # TODO: Implement Claude API call
        # For now, return a simple summary
        
        return (
            f"{market} shows {metrics['interpretation'].replace('_', ' ')} conditions. "
            f"Current inventory of {metrics['total_inventory']:,} units with "
            f"{metrics['months_of_supply']:.1f} months of supply. "
            f"Market absorption rate is {metrics['absorption_rate']:.2%}."
        )
    
    async def _save_to_db(self, market: str, metrics: Dict[str, Any]):
        """Save metrics to PostgreSQL"""
        
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO supply_metrics (
                        market, timestamp, total_inventory, new_listings,
                        active_listings, pending_listings, under_contract,
                        months_of_supply, absorption_rate, avg_days_on_market,
                        price_reduction_rate, score, interpretation,
                        data_sources, ai_insights, metadata
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                    )
                """,
                    market, datetime.now(),
                    metrics['total_inventory'], metrics['new_listings'],
                    metrics['active_listings'], metrics['pending_listings'],
                    metrics['under_contract'], metrics['months_of_supply'],
                    metrics['absorption_rate'], metrics['avg_days_on_market'],
                    metrics['price_reduction_rate'], metrics['score'],
                    metrics['interpretation'], metrics['data_sources'],
                    metrics.get('ai_insights', ''), {}
                )
            
            logger.debug(f"✓ Saved to database: {market}")
        
        except Exception as e:
            logger.error(f"Database write failed: {e}")
    
    async def _shutdown(self):
        """Graceful shutdown"""
        logger.info("\n👋 Shutting down...")
        
        if self.db_pool:
            await self.db_pool.close()
            logger.info("Database connection closed")
        
        logger.info(f"Total runs completed: {self.runs_completed}")
        logger.success("Shutdown complete")


async def main():
    """Entry point"""
    agent = SimpleSupplyAgent()
    await agent.start()


if __name__ == "__main__":
    asyncio.run(main())
