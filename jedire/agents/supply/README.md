# Supply Agent - Real Estate Inventory Intelligence

## Overview

The Supply Agent is an autonomous AI agent that continuously monitors and analyzes real estate inventory levels across target markets. It provides actionable intelligence on supply trends, absorption rates, and market tightness.

## Features

- **Data Collection**: Automated scraping from Zillow, Redfin, and MLS sources
- **Trend Analysis**: Historical inventory tracking and trend identification
- **Absorption Rates**: Days on market and inventory turnover calculations
- **Supply Scoring**: 0-100 score indicating market tightness (0=oversupplied, 100=severe shortage)
- **AI Analysis**: Claude-powered insights and market commentary
- **Real-time Publishing**: Kafka producer for streaming insights
- **Persistent Storage**: PostgreSQL database for historical metrics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPPLY AGENT                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Zillow    │  │   Redfin    │  │     MLS     │        │
│  │  Collector  │  │  Collector  │  │  Collector  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │
│         └────────────────┴────────────────┘                │
│                          ↓                                  │
│              ┌──────────────────────┐                      │
│              │   Data Normalizer    │                      │
│              └──────────┬───────────┘                      │
│                         ↓                                   │
│              ┌──────────────────────┐                      │
│              │   Trend Analyzer     │                      │
│              │   - Inventory levels │                      │
│              │   - Absorption rate  │                      │
│              │   - Days on market   │                      │
│              └──────────┬───────────┘                      │
│                         ↓                                   │
│              ┌──────────────────────┐                      │
│              │   Supply Scorer      │                      │
│              │   (0-100 algorithm)  │                      │
│              └──────────┬───────────┘                      │
│                         ↓                                   │
│              ┌──────────────────────┐                      │
│              │   Claude AI          │                      │
│              │   (Insights)         │                      │
│              └──────────┬───────────┘                      │
│                         ↓                                   │
│         ┌───────────────┴───────────────┐                 │
│         ↓                               ↓                  │
│  ┌─────────────┐              ┌─────────────┐            │
│  │   Kafka     │              │  PostgreSQL │            │
│  │  Publisher  │              │   Writer    │            │
│  └─────────────┘              └─────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Installation

```bash
cd /home/leon/clawd/jedire/agents/supply
pip install -r requirements.txt
```

## Configuration

Create `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/jedire

# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_TOPIC=supply-insights

# AI
ANTHROPIC_API_KEY=your_key_here

# Data Sources
ZILLOW_API_KEY=your_key
REDFIN_API_KEY=your_key
```

## Usage

### Run Agent Continuously

```bash
python -m src.main
```

### Single Analysis Run

```bash
python -m src.main --once --market "Austin, TX"
```

### Test Components

```bash
pytest tests/
```

## Supply Score Algorithm

The supply score (0-100) is calculated using:

```
Score = w1 * inventory_factor + 
        w2 * absorption_factor + 
        w3 * dom_factor + 
        w4 * trend_factor

Where:
- inventory_factor: Months of supply (normalized, inverted)
- absorption_factor: Rate of inventory turnover
- dom_factor: Days on market (normalized, inverted)
- trend_factor: 3-month inventory trend
- w1, w2, w3, w4: Weights (configurable)

High scores (80-100): Severe shortage, hot market
Mid scores (40-60): Balanced market
Low scores (0-20): Oversupply, cold market
```

## Output Format

### Kafka Message:

```json
{
  "agent": "supply",
  "timestamp": "2026-01-31T19:30:00Z",
  "market": "Austin, TX",
  "metrics": {
    "total_inventory": 2543,
    "months_of_supply": 1.8,
    "absorption_rate": 0.55,
    "median_dom": 12,
    "new_listings_30d": 847,
    "pending_sales": 1401
  },
  "trends": {
    "inventory_change_30d": -15.2,
    "inventory_change_90d": -28.7,
    "absorption_change": 0.12
  },
  "score": 87,
  "interpretation": "severe_shortage",
  "ai_insights": "Austin market showing extreme supply constraints...",
  "recommendations": ["Act quickly on new listings", "Consider off-market deals"]
}
```

## Database Schema

```sql
CREATE TABLE supply_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL,
    market VARCHAR(255) NOT NULL,
    total_inventory INTEGER,
    months_of_supply DECIMAL(4,2),
    absorption_rate DECIMAL(4,3),
    median_dom INTEGER,
    new_listings_30d INTEGER,
    pending_sales INTEGER,
    inventory_change_30d DECIMAL(5,2),
    inventory_change_90d DECIMAL(5,2),
    supply_score INTEGER,
    interpretation VARCHAR(50),
    ai_insights TEXT,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_supply_market_time ON supply_metrics(market, timestamp DESC);
```

## Development

### Adding New Data Sources

1. Create collector in `src/collectors/`
2. Implement `BaseCollector` interface
3. Add to `CollectorManager` in `main.py`
4. Update configuration

### Tuning Score Algorithm

Edit `src/scorers/supply_scorer.py`:
- Adjust weights
- Add new factors
- Modify normalization

## Monitoring

- Logs: `logs/supply_agent.log`
- Metrics: Published to Kafka `agent-metrics` topic
- Health: `/health` endpoint (if API enabled)

## License

Proprietary - JediRe Platform

## Contact

Leon D - Owner/Developer
