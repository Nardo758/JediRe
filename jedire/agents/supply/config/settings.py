"""
Supply Agent Configuration
Loads settings from environment variables using Pydantic
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from pathlib import Path


class Settings(BaseSettings):
    """Supply Agent configuration settings"""
    
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False
    )
    
    # Database
    database_url: str
    database_pool_size: int = 5
    database_max_overflow: int = 10
    
    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic_supply_insights: str = "supply-insights"
    kafka_topic_agent_metrics: str = "agent-metrics"
    kafka_client_id: str = "supply-agent"
    kafka_compression_type: str = "gzip"
    
    # AI
    anthropic_api_key: str
    claude_model: str = "claude-3-5-sonnet-20241022"
    claude_max_tokens: int = 4096
    
    # Data Sources
    zillow_api_key: str = ""
    redfin_api_key: str = ""
    mls_api_key: str = ""
    mls_api_url: str = ""
    
    # Agent Configuration
    agent_run_interval_minutes: int = 60
    markets: str = "Austin TX,Miami FL,Tampa FL"
    enable_web_scraping: bool = True
    enable_ai_insights: bool = True
    
    # Scoring Weights
    score_weight_inventory: float = 0.35
    score_weight_absorption: float = 0.30
    score_weight_dom: float = 0.20
    score_weight_trend: float = 0.15
    
    # Logging
    log_level: str = "INFO"
    log_file: str = "logs/supply_agent.log"
    log_max_bytes: int = 10485760
    log_backup_count: int = 5
    
    # Feature Flags
    enable_kafka: bool = True
    enable_database: bool = True
    enable_caching: bool = True
    cache_ttl_seconds: int = 3600
    
    # Rate Limiting
    api_rate_limit_per_minute: int = 60
    scraping_delay_seconds: int = 2
    max_retries: int = 3
    retry_backoff_factor: float = 2.0
    
    # Health Check
    health_check_port: int = 8080
    enable_metrics_endpoint: bool = True
    
    @property
    def markets_list(self) -> List[str]:
        """Parse markets string into list"""
        return [m.strip() for m in self.markets.split(',')]
    
    @property
    def score_weights(self) -> dict:
        """Get all scoring weights as dict"""
        return {
            'inventory': self.score_weight_inventory,
            'absorption': self.score_weight_absorption,
            'dom': self.score_weight_dom,
            'trend': self.score_weight_trend
        }
    
    def validate_weights(self) -> bool:
        """Ensure scoring weights sum to 1.0"""
        total = sum(self.score_weights.values())
        return abs(total - 1.0) < 0.01  # Allow small floating point error
    
    @property
    def log_dir(self) -> Path:
        """Get log directory path"""
        return Path(self.log_file).parent


# Global settings instance
settings = Settings()

# Validate on load
if not settings.validate_weights():
    raise ValueError(
        f"Scoring weights must sum to 1.0, got {sum(settings.score_weights.values())}"
    )
