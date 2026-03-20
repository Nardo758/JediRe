"""
Supply Agent Settings - Replit Edition (Simplified)
No Kafka, direct database writes
"""
import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

load_dotenv()

# ============================================
# Database Settings (Replit PostgreSQL)
# ============================================
DATABASE_URL = os.getenv("DATABASE_URL", "")
ENABLE_DATABASE = bool(DATABASE_URL)

# ============================================
# Agent Settings
# ============================================
AGENT_NAME = "supply_agent_replit"
AGENT_RUN_INTERVAL_MINUTES = int(os.getenv("AGENT_RUN_INTERVAL_MINUTES", "60"))

# Markets to analyze (start small)
MARKETS_LIST: List[str] = os.getenv(
    "MARKETS", 
    "Austin, TX;Denver, CO;Phoenix, AZ"
).split(";")

# ============================================
# External APIs (optional)
# ============================================
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
ENABLE_AI_INSIGHTS = bool(CLAUDE_API_KEY)

# ============================================
# Data Collection Settings
# ============================================
ENABLE_ZILLOW = os.getenv("ENABLE_ZILLOW", "true").lower() == "true"
ENABLE_REDFIN = os.getenv("ENABLE_REDFIN", "true").lower() == "true"

# Mock data if no real APIs available
USE_MOCK_DATA = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

# ============================================
# Logging
# ============================================
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_DIR = Path("logs")
LOG_FILE = LOG_DIR / "supply_agent.log"
LOG_MAX_BYTES = 10 * 1024 * 1024  # 10MB
LOG_BACKUP_COUNT = 3

# ============================================
# Publishing (Disabled - Direct DB only)
# ============================================
ENABLE_KAFKA = False

# ============================================
# Validation
# ============================================
def validate_settings():
    """Validate required settings"""
    if not DATABASE_URL:
        print("⚠️  WARNING: DATABASE_URL not set. Add PostgreSQL in Replit!")
        print("   Agent will run but data won't be saved.")
    
    if not CLAUDE_API_KEY:
        print("⚠️  INFO: CLAUDE_API_KEY not set. AI insights disabled.")
        print("   Get a free key at https://console.anthropic.com")
    
    if USE_MOCK_DATA:
        print("ℹ️  INFO: Using mock data (no real API calls)")
    
    return True

class Settings:
    """Settings container"""
    # Database
    database_url = DATABASE_URL
    enable_database = ENABLE_DATABASE
    
    # Agent
    agent_name = AGENT_NAME
    agent_run_interval_minutes = AGENT_RUN_INTERVAL_MINUTES
    markets_list = MARKETS_LIST
    
    # APIs
    claude_api_key = CLAUDE_API_KEY
    enable_ai_insights = ENABLE_AI_INSIGHTS
    
    # Data collection
    enable_zillow = ENABLE_ZILLOW
    enable_redfin = ENABLE_REDFIN
    use_mock_data = USE_MOCK_DATA
    
    # Logging
    log_level = LOG_LEVEL
    log_dir = LOG_DIR
    log_file = LOG_FILE
    log_max_bytes = LOG_MAX_BYTES
    log_backup_count = LOG_BACKUP_COUNT
    
    # Publishing
    enable_kafka = ENABLE_KAFKA

settings = Settings()

if __name__ == "__main__":
    validate_settings()
