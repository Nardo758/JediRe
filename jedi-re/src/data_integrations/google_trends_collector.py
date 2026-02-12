#!/usr/bin/env python3
"""
Google Trends Collector for JEDI RE MVP

This module collects search volume data for submarket keywords
(e.g., "apartments buckhead atlanta") using the pytrends library.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import pandas as pd

# Try to import pytrends, but handle if not installed
try:
    from pytrends.request import TrendReq
    PYTRE_AVAILABLE = True
except ImportError:
    PYTRE_AVAILABLE = False
    logging.warning("pytrends not available. Install with: pip install pytrends")

# Database imports
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False
    logging.warning("psycopg2 not available. Install with: pip install psycopg2-binary")


class GoogleTrendsCollector:
    """Collects Google Trends data for real estate submarkets."""
    
    def __init__(self, db_config: Optional[Dict] = None):
        """
        Initialize the Google Trends collector.
        
        Args:
            db_config: Database configuration dictionary with keys:
                host, port, database, user, password
        """
        self.db_config = db_config or {
            'host': 'localhost',
            'port': 5432,
            'database': 'jedire',
            'user': 'jedire_user',
            'password': 'jedire_password'
        }
        
        if PYTRE_AVAILABLE:
            self.pytrends = TrendReq(hl='en-US', tz=360)
        else:
            self.pytrends = None
            
        self.logger = logging.getLogger(__name__)
        
    def get_db_connection(self):
        """Get a database connection."""
        if not DB_AVAILABLE:
            raise ImportError("psycopg2 not installed")
        
        return psycopg2.connect(
            host=self.db_config['host'],
            port=self.db_config['port'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )
    
    def create_search_trends_table(self):
        """Create the search_trends table if it doesn't exist."""
        if not DB_AVAILABLE:
            self.logger.error("Cannot create table: psycopg2 not installed")
            return False
            
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'search_trends'
                );
            """)
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                self.logger.info("Creating search_trends table")
                cursor.execute("""
                    CREATE TABLE search_trends (
                        id SERIAL PRIMARY KEY,
                        submarket_id INTEGER REFERENCES submarkets(id),
                        timestamp TIMESTAMPTZ NOT NULL,
                        keyword VARCHAR(255),
                        search_volume INTEGER,
                        interest_score INTEGER,
                        source VARCHAR(50) DEFAULT 'Google_Trends',
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                    
                    CREATE INDEX idx_search_submarket 
                    ON search_trends(submarket_id, timestamp DESC);
                """)
                conn.commit()
                self.logger.info("Created search_trends table")
            else:
                self.logger.info("search_trends table already exists")
                
            cursor.close()
            conn.close()
            return True
            
        except Exception as e:
            self.logger.error(f"Error creating search_trends table: {e}")
            return False
    
    def generate_keywords(self, submarket_name: str, city: str, state: str) -> List[str]:
        """
        Generate search keywords for a submarket.
        
        Args:
            submarket_name: Name of the submarket (e.g., "Buckhead")
            city: City name (e.g., "Atlanta")
            state: State abbreviation (e.g., "GA")
            
        Returns:
            List of search keywords
        """
        base_keywords = [
            f"apartments {submarket_name.lower()} {city.lower()}",
            f"{submarket_name.lower()} apartments {city.lower()}",
            f"rent {submarket_name.lower()} {city.lower()}",
            f"{submarket_name.lower()} {city.lower()} rental",
            f"{city.lower()} {submarket_name.lower()} apartments for rent"
        ]
        
        # Add state-specific variations
        state_keywords = [
            f"{submarket_name.lower()} {city.lower()} {state.lower()} apartments",
            f"apartments in {submarket_name.lower()} {city.lower()} {state.lower()}"
        ]
        
        return base_keywords + state_keywords
    
    def fetch_trends_data(self, keywords: List[str], timeframe: str = 'today 3-m') -> Optional[pd.DataFrame]:
        """
        Fetch Google Trends data for given keywords.
        
        Args:
            keywords: List of search keywords
            timeframe: Timeframe for trends data (default: last 3 months)
            
        Returns:
            DataFrame with trends data or None if failed
        """
        if not PYTRE_AVAILABLE or self.pytrends is None:
            self.logger.error("pytrends not available")
            return None
            
        try:
            # Build payload
            self.pytrends.build_payload(
                kw_list=keywords,
                timeframe=timeframe,
                geo='US',
                gprop=''
            )
            
            # Get interest over time
            trends_data = self.pytrends.interest_over_time()
            
            if trends_data.empty:
                self.logger.warning(f"No trends data for keywords: {keywords}")
                return None
                
            # Remove 'isPartial' column if present
            if 'isPartial' in trends_data.columns:
                trends_data = trends_data.drop(columns=['isPartial'])
                
            return trends_data
            
        except Exception as e:
            self.logger.error(f"Error fetching trends data: {e}")
            return None
    
    def store_trends_data(self, submarket_id: int, trends_data: pd.DataFrame, keyword: str):
        """
        Store trends data in the database.
        
        Args:
            submarket_id: ID of the submarket
            trends_data: DataFrame with trends data
            keyword: The keyword that was searched
        """
        if not DB_AVAILABLE:
            self.logger.error("Cannot store data: psycopg2 not installed")
            return
            
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Get the column name for this keyword (Google Trends uses the exact keyword)
            data_column = keyword
            
            for timestamp, row in trends_data.iterrows():
                if data_column in row:
                    search_volume = int(row[data_column])
                    
                    # Only store if we have data
                    if search_volume > 0:
                        cursor.execute("""
                            INSERT INTO search_trends 
                            (submarket_id, timestamp, keyword, search_volume, interest_score)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (submarket_id, timestamp, keyword) 
                            DO UPDATE SET 
                                search_volume = EXCLUDED.search_volume,
                                interest_score = EXCLUDED.interest_score,
                                created_at = NOW()
                        """, (
                            submarket_id,
                            timestamp.to_pydatetime(),
                            keyword,
                            search_volume,
                            search_volume  # Using search_volume as interest_score for now
                        ))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            self.logger.info(f"Stored trends data for submarket {submarket_id}, keyword: {keyword}")
            
        except Exception as e:
            self.logger.error(f"Error storing trends data: {e}")
    
    def collect_for_submarket(self, submarket_id: int, submarket_name: str, 
                             city: str, state: str) -> bool:
        """
        Collect Google Trends data for a specific submarket.
        
        Args:
            submarket_id: Database ID of the submarket
            submarket_name: Name of the submarket
            city: City name
            state: State abbreviation
            
        Returns:
            True if successful, False otherwise
        """
        self.logger.info(f"Collecting Google Trends data for {submarket_name}, {city}, {state}")
        
        # Generate keywords
        keywords = self.generate_keywords(submarket_name, city, state)
        self.logger.info(f"Generated keywords: {keywords}")
        
        # Try each keyword
        success_count = 0
        for keyword in keywords:
            try:
                # Fetch trends data
                trends_data = self.fetch_trends_data([keyword])
                
                if trends_data is not None and not trends_data.empty:
                    # Store the data
                    self.store_trends_data(submarket_id, trends_data, keyword)
                    success_count += 1
                    self.logger.info(f"Successfully collected data for keyword: {keyword}")
                else:
                    self.logger.warning(f"No data for keyword: {keyword}")
                    
            except Exception as e:
                self.logger.error(f"Error processing keyword {keyword}: {e}")
                continue
        
        self.logger.info(f"Completed collection for {submarket_name}. Success: {success_count}/{len(keywords)}")
        return success_count > 0
    
    def run_collection(self):
        """Run collection for all submarkets in the database."""
        if not DB_AVAILABLE:
            self.logger.error("Cannot run collection: psycopg2 not installed")
            return False
            
        try:
            # Ensure table exists
            self.create_search_trends_table()
            
            # Get all submarkets
            conn = self.get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("SELECT id, name, city, state FROM submarkets")
            submarkets = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            self.logger.info(f"Found {len(submarkets)} submarkets to process")
            
            # Collect data for each submarket
            results = []
            for submarket in submarkets:
                success = self.collect_for_submarket(
                    submarket['id'],
                    submarket['name'],
                    submarket['city'],
                    submarket['state']
                )
                results.append({
                    'submarket': submarket['name'],
                    'success': success
                })
            
            # Log summary
            successful = sum(1 for r in results if r['success'])
            self.logger.info(f"Collection complete. Successful: {successful}/{len(results)}")
            
            return successful > 0
            
        except Exception as e:
            self.logger.error(f"Error running collection: {e}")
            return False


def main():
    """Main function for testing."""
    import sys
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    collector = GoogleTrendsCollector()
    
    # Test with Buckhead, Atlanta
    print("Testing Google Trends collector with Buckhead, Atlanta...")
    
    # First, ensure table exists
    if collector.create_search_trends_table():
        print("✓ Table created/verified")
    else:
        print("✗ Failed to create/verify table")
        sys.exit(1)
    
    # Test collection (you would need actual submarket ID from database)
    # For testing, we'll just show the keywords that would be generated
    keywords = collector.generate_keywords("Buckhead", "Atlanta", "GA")
    print(f"Generated keywords: {keywords}")
    
    if PYTRE_AVAILABLE:
        print("✓ pytrends is available")
        
        # Try to fetch data for one keyword
        test_keyword = ["apartments buckhead atlanta"]
        trends_data = collector.fetch_trends_data(test_keyword, timeframe='today 1-m')
        
        if trends_data is not None:
            print(f"✓ Successfully fetched trends data")
            print(f"Data shape: {trends_data.shape}")
            print(f"Sample data:\n{trends_data.head()}")
        else:
            print("✗ Failed to fetch trends data")
    else:
        print("✗ pytrends not installed. Install with: pip install pytrends")
    
    print("\nGoogle Trends collector is ready for integration.")


if __name__ == "__main__":
    main()