"""
Supply Agent - Main Entry Point
Orchestrates data collection, analysis, scoring, and publishing
"""
import asyncio
import time
import sys
from pathlib import Path
from datetime import datetime
from typing import List
from loguru import logger

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings
from src.models import SupplyAnalysis, AgentMetrics, MarketData
from src.collectors import ZillowCollector, RedfinCollector
from src.analyzers.trend_analyzer import TrendAnalyzer
from src.scorers.supply_scorer import SupplyScorer
from src.analyzers.ai_insights import AIInsightsGenerator
from src.publishers.kafka_publisher import KafkaPublisher
from src.publishers.database_writer import DatabaseWriter


class SupplyAgent:
    """
    Main Supply Agent orchestrator
    
    Coordinates all components to analyze real estate supply across markets
    """
    
    def __init__(self):
        self.name = "SupplyAgent"
        self.start_time = time.time()
        
        # Initialize components
        self.zillow = ZillowCollector()
        self.redfin = RedfinCollector()
        self.analyzer = TrendAnalyzer()
        self.scorer = SupplyScorer()
        self.ai_generator = AIInsightsGenerator()
        self.kafka = KafkaPublisher()
        self.database = DatabaseWriter()
        
        # Metrics
        self.runs_completed = 0
        self.markets_analyzed = 0
        self.successful_analyses = 0
        self.failed_analyses = 0
        
        self._setup_logging()
    
    def _setup_logging(self):
        """Configure logging"""
        # Remove default handler
        logger.remove()
        
        # Console handler
        logger.add(
            sys.stdout,
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> | <level>{message}</level>",
            level=settings.log_level,
            colorize=True
        )
        
        # File handler
        log_dir = settings.log_dir
        log_dir.mkdir(exist_ok=True, parents=True)
        
        logger.add(
            settings.log_file,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} | {message}",
            level="DEBUG",
            rotation=settings.log_max_bytes,
            retention=settings.log_backup_count,
            compression="zip"
        )
        
        logger.info(f"Supply Agent initialized - logging to {settings.log_file}")
    
    async def start(self):
        """Start the agent"""
        logger.info("=" * 80)
        logger.info("SUPPLY AGENT STARTING")
        logger.info("=" * 80)
        logger.info(f"Markets: {settings.markets_list}")
        logger.info(f"Run interval: {settings.agent_run_interval_minutes} minutes")
        logger.info(f"Kafka enabled: {settings.enable_kafka}")
        logger.info(f"Database enabled: {settings.enable_database}")
        logger.info(f"AI insights enabled: {settings.enable_ai_insights}")
        logger.info("=" * 80)
        
        # Connect to external services
        await self._connect_services()
        
        # Start main loop
        try:
            await self._run_loop()
        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
        finally:
            await self._shutdown()
    
    async def _connect_services(self):
        """Connect to Kafka and Database"""
        logger.info("Connecting to external services...")
        
        if settings.enable_kafka:
            self.kafka.connect()
        
        if settings.enable_database:
            await self.database.connect()
        
        logger.success("Service connections established")
    
    async def _run_loop(self):
        """Main agent loop"""
        while True:
            try:
                await self._run_analysis_cycle()
                
                # Wait for next run
                logger.info(f"Sleeping for {settings.agent_run_interval_minutes} minutes...")
                await asyncio.sleep(settings.agent_run_interval_minutes * 60)
                
            except Exception as e:
                logger.error(f"Error in main loop: {e}", exc_info=True)
                await asyncio.sleep(60)  # Wait 1 minute before retry
    
    async def _run_analysis_cycle(self):
        """Run one complete analysis cycle for all markets"""
        cycle_start = time.time()
        
        logger.info("=" * 80)
        logger.info(f"STARTING ANALYSIS CYCLE - {datetime.utcnow().isoformat()}")
        logger.info("=" * 80)
        
        for market in settings.markets_list:
            try:
                await self._analyze_market(market)
                self.successful_analyses += 1
            except Exception as e:
                logger.error(f"Failed to analyze {market}: {e}", exc_info=True)
                self.failed_analyses += 1
        
        # Publish agent metrics
        await self._publish_metrics()
        
        cycle_time = int((time.time() - cycle_start) * 1000)
        self.runs_completed += 1
        
        logger.info("=" * 80)
        logger.success(
            f"CYCLE COMPLETE - Analyzed {len(settings.markets_list)} markets "
            f"in {cycle_time}ms"
        )
        logger.info("=" * 80)
    
    async def _analyze_market(self, market: str):
        """
        Analyze a single market
        
        Full pipeline:
        1. Collect data from sources
        2. Analyze trends
        3. Calculate score
        4. Generate AI insights
        5. Publish to Kafka
        6. Write to database
        """
        start_time = time.time()
        
        logger.info(f"\n{'=' * 60}")
        logger.info(f"ANALYZING: {market}")
        logger.info(f"{'=' * 60}")
        
        # Step 1: Collect data
        logger.info("Step 1: Collecting data...")
        zillow_result = await self.zillow.collect_safe(market)
        redfin_result = await self.redfin.collect_safe(market)
        
        # Gather successful results
        market_data: List[MarketData] = []
        data_sources = []
        
        if zillow_result.success and zillow_result.market_data:
            market_data.append(zillow_result.market_data)
            data_sources.append("zillow")
        
        if redfin_result.success and redfin_result.market_data:
            market_data.append(redfin_result.market_data)
            data_sources.append("redfin")
        
        if not market_data:
            raise Exception("No data collected from any source")
        
        logger.success(f"Collected data from {len(data_sources)} sources: {', '.join(data_sources)}")
        
        # Step 2: Get historical data
        logger.info("Step 2: Fetching historical data...")
        historical = await self.database.get_historical_metrics(market, days_back=90)
        logger.info(f"Found {len(historical)} historical data points")
        
        # Step 3: Analyze trends
        logger.info("Step 3: Analyzing trends...")
        metrics, trends = await self.analyzer.analyze(market, market_data, historical)
        
        # Step 4: Calculate score
        logger.info("Step 4: Calculating supply score...")
        score = await self.scorer.calculate_score(metrics, trends)
        
        # Step 5: Generate AI insights
        logger.info("Step 5: Generating AI insights...")
        ai_insights = await self.ai_generator.generate_insights(
            market, metrics, trends, score
        )
        
        # Step 6: Build final analysis
        processing_time = int((time.time() - start_time) * 1000)
        
        analysis = SupplyAnalysis(
            market=market,
            metrics=metrics,
            trends=trends,
            score=score,
            ai_insights=ai_insights,
            data_sources=data_sources,
            data_quality="high" if len(data_sources) >= 2 else "medium",
            processing_time_ms=processing_time
        )
        
        # Step 7: Publish to Kafka
        logger.info("Step 6: Publishing to Kafka...")
        await self.kafka.publish_analysis(analysis)
        
        # Step 8: Write to database
        logger.info("Step 7: Writing to database...")
        await self.database.write_analysis(analysis)
        
        self.markets_analyzed += 1
        
        logger.success(f"\n✓ {market} analysis complete in {processing_time}ms")
        logger.info(f"  Score: {score.overall_score}/100 ({score.interpretation.value})")
        logger.info(f"  Inventory: {metrics.total_inventory:,} listings")
        logger.info(f"  Months of Supply: {metrics.months_of_supply}")
        logger.info(f"  Absorption Rate: {metrics.absorption_rate:.1%}")
        logger.info(f"{'=' * 60}\n")
    
    async def _publish_metrics(self):
        """Publish agent performance metrics"""
        uptime = int(time.time() - self.start_time)
        
        metrics = AgentMetrics(
            markets_analyzed=self.markets_analyzed,
            successful_analyses=self.successful_analyses,
            failed_analyses=self.failed_analyses,
            average_processing_time_ms=0.0,  # Would calculate from tracking
            api_calls_made=(self.zillow.call_count + self.redfin.call_count),
            scraping_attempts=0,
            data_quality_score=0.95,  # Would calculate from actual data quality
            claude_calls=self.ai_generator.call_count,
            claude_tokens_used=self.ai_generator.total_tokens,
            memory_usage_mb=0.0,  # Would get from psutil
            cpu_usage_percent=0.0,
            uptime_seconds=uptime,
            error_count=self.failed_analyses
        )
        
        await self.kafka.publish_metrics(metrics)
    
    async def _shutdown(self):
        """Graceful shutdown"""
        logger.info("Shutting down Supply Agent...")
        
        # Close collectors
        await self.zillow.close()
        await self.redfin.close()
        
        # Flush and close publishers
        self.kafka.flush()
        self.kafka.close()
        
        await self.database.close()
        
        # Log final stats
        logger.info("\nFinal Statistics:")
        logger.info(f"  Runs completed: {self.runs_completed}")
        logger.info(f"  Markets analyzed: {self.markets_analyzed}")
        logger.info(f"  Successful: {self.successful_analyses}")
        logger.info(f"  Failed: {self.failed_analyses}")
        logger.info(f"  Uptime: {int(time.time() - self.start_time)} seconds")
        
        logger.info("\nCollector Stats:")
        logger.info(f"  Zillow: {self.zillow.get_stats()}")
        logger.info(f"  Redfin: {self.redfin.get_stats()}")
        
        logger.info("\nPublisher Stats:")
        logger.info(f"  Kafka: {self.kafka.get_stats()}")
        logger.info(f"  Database: {self.database.get_stats()}")
        
        logger.info("\nAI Stats:")
        logger.info(f"  {self.ai_generator.get_stats()}")
        
        logger.success("Supply Agent shutdown complete")


async def main():
    """Entry point"""
    agent = SupplyAgent()
    await agent.start()


if __name__ == "__main__":
    asyncio.run(main())
