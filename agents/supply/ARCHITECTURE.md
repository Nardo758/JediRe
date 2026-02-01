# Supply Agent Architecture

## Overview

The Supply Agent is an autonomous AI-powered system that continuously monitors real estate inventory across multiple markets, analyzes trends, generates actionable insights, and publishes results to downstream consumers.

## System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         SUPPLY AGENT                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    ORCHESTRATOR (main.py)                     │ │
│  │  - Schedules analysis cycles                                 │ │
│  │  - Coordinates all components                                │ │
│  │  - Manages lifecycle                                          │ │
│  └────────────────┬─────────────────────────────────────────────┘ │
│                   │                                                │
│  ┌────────────────▼───────────────────────────────────┐           │
│  │          DATA COLLECTION LAYER                     │           │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │           │
│  │  │   Zillow    │  │   Redfin    │  │    MLS    │ │           │
│  │  │  Collector  │  │  Collector  │  │ Collector │ │           │
│  │  └─────────────┘  └─────────────┘  └───────────┘ │           │
│  │         │                │               │        │           │
│  │         └────────────────┴───────────────┘        │           │
│  │                          │                        │           │
│  │                   ┌──────▼──────┐                 │           │
│  │                   │ Deduplication│                │           │
│  │                   │ & Validation │                │           │
│  │                   └──────┬──────┘                 │           │
│  └──────────────────────────┼────────────────────────┘           │
│                              │                                    │
│  ┌──────────────────────────▼────────────────────────┐           │
│  │          ANALYSIS LAYER                           │           │
│  │  ┌───────────────────────────────────────────┐    │           │
│  │  │         Trend Analyzer                    │    │           │
│  │  │  - Inventory metrics                      │    │           │
│  │  │  - Absorption rates                       │    │           │
│  │  │  - Days on market                         │    │           │
│  │  │  - Historical comparisons                 │    │           │
│  │  └────────────────────┬──────────────────────┘    │           │
│  │                       │                            │           │
│  │  ┌────────────────────▼──────────────────────┐    │           │
│  │  │         Supply Scorer                     │    │           │
│  │  │  - Weighted algorithm (0-100)            │    │           │
│  │  │  - Market interpretation                  │    │           │
│  │  │  - Confidence calculation                 │    │           │
│  │  └────────────────────┬──────────────────────┘    │           │
│  │                       │                            │           │
│  │  ┌────────────────────▼──────────────────────┐    │           │
│  │  │      AI Insights Generator (Claude)       │    │           │
│  │  │  - Market summary                         │    │           │
│  │  │  - Key findings                           │    │           │
│  │  │  - Recommendations                        │    │           │
│  │  │  - Risks & opportunities                  │    │           │
│  │  └────────────────────┬──────────────────────┘    │           │
│  └────────────────────────┼───────────────────────────┘           │
│                           │                                        │
│  ┌────────────────────────▼───────────────────────────┐           │
│  │          PUBLISHING LAYER                          │           │
│  │  ┌──────────────┐        ┌──────────────────────┐ │           │
│  │  │    Kafka     │        │    PostgreSQL        │ │           │
│  │  │  Publisher   │        │  Database Writer     │ │           │
│  │  │              │        │                      │ │           │
│  │  │ Topics:      │        │ Table:               │ │           │
│  │  │ - insights   │        │ - supply_metrics     │ │           │
│  │  │ - metrics    │        │                      │ │           │
│  │  └──────────────┘        └──────────────────────┘ │           │
│  └────────────────────────────────────────────────────┘           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

         │                                          │
         ▼                                          ▼
┌────────────────────┐                  ┌──────────────────────┐
│   Downstream       │                  │   Historical Data    │
│   Consumers        │                  │   Storage & Query    │
│                    │                  │                      │
│ - Web Dashboard    │                  │ - Trend Analysis     │
│ - Mobile App       │                  │ - Historical Reports │
│ - Alert System     │                  │ - ML Training Data   │
│ - Other Agents     │                  │ - API Queries        │
└────────────────────┘                  └──────────────────────┘
```

## Component Details

### 1. Data Collection Layer

#### Collectors
- **Base Collector**: Abstract interface defining collection contract
- **Zillow Collector**: Real-time inventory from Zillow API/scraping
- **Redfin Collector**: Market data from Redfin API
- **MLS Collector**: (Future) Direct MLS feed integration

#### Responsibilities
- Fetch active, pending, and sold listings
- Handle rate limiting and retries
- Normalize data across sources
- Deduplicate listings
- Assess data quality
- Generate mock data when APIs unavailable (development)

#### Error Handling
- Graceful degradation (continues with available data)
- Exponential backoff for retries
- Detailed error logging
- Fallback to mock data for testing

### 2. Analysis Layer

#### Trend Analyzer
Processes raw market data to calculate key metrics:

**Core Metrics:**
- Total inventory (active listings)
- Months of supply (inventory / avg monthly sales)
- Absorption rate (sales / (sales + inventory))
- Median days on market
- New listings count
- Pending sales

**Trend Analysis:**
- 30-day inventory change (%)
- 90-day inventory change (%)
- Absorption rate change
- Days on market trend
- New listings trend (up/down/stable)

**Data Sources:**
- Current market data from collectors
- Historical data from database (90 days)

#### Supply Scorer

Calculates 0-100 supply score using weighted algorithm:

```
Score = w1×inventory + w2×absorption + w3×dom + w4×trend

Where:
- inventory: Scored based on months of supply (inverted)
- absorption: Scored based on turnover rate
- dom: Scored based on days on market (inverted)
- trend: Scored based on 30/90-day changes

Default weights: [0.35, 0.30, 0.20, 0.15]
```

**Score Interpretation:**
- 90-100: Severe shortage (hot seller's market)
- 75-89: Shortage (seller's market)
- 60-74: Tight (favors sellers)
- 40-59: Balanced
- 25-39: Loose (favors buyers)
- 10-24: Oversupply (buyer's market)
- 0-9: Severe oversupply

**Confidence Score:**
- Based on sample size
- Data completeness
- Trend consistency
- Range: 0.3 - 1.0

#### AI Insights Generator

Uses Claude (Anthropic) to generate:
- Market summary (2-3 sentences)
- Key findings (3-5 data-driven insights)
- Recommendations (3-5 actionable suggestions)
- Risks (1-3 concerns)
- Opportunities (1-3 advantages)

**Prompt Engineering:**
- Structured prompt with all metrics
- Explicit output format requirements
- Focus on actionable intelligence
- Concise, specific responses

**Fallback:**
- Template-based insights if AI unavailable
- Ensures agent continues operation

### 3. Publishing Layer

#### Kafka Publisher

Publishes to two topics:

**supply-insights:**
```json
{
  "agent": "supply",
  "timestamp": "2026-01-31T20:00:00Z",
  "market": "Austin, TX",
  "metrics": { ... },
  "trends": { ... },
  "score": { ... },
  "ai_insights": { ... }
}
```

**agent-metrics:**
```json
{
  "agent": "supply",
  "markets_analyzed": 5,
  "api_calls_made": 10,
  "claude_tokens_used": 12500,
  "uptime_seconds": 3600
}
```

**Features:**
- Compression (gzip)
- Guaranteed delivery (acks=all)
- Ordering preservation
- Automatic retry

#### Database Writer

Writes to PostgreSQL `supply_metrics` table:

**Schema:**
- Core metrics (inventory, absorption, DOM)
- Trends (30d, 90d changes)
- Score components
- AI insights (JSONB)
- Raw data (full analysis JSON)
- Metadata (sources, quality, timing)

**Indexes:**
- `(market, timestamp DESC)` - Time-series queries
- `(supply_score DESC)` - Score-based filtering
- `(created_at DESC)` - Recent data retrieval

**Historical Queries:**
- Agent retrieves last 90 days for trend calculation
- Efficient with timestamp index
- Enables comparative analysis

## Data Flow

### Single Market Analysis Flow

```
1. Trigger (every N minutes)
   ↓
2. Collect Data (parallel)
   - Zillow: fetch active/pending/sold
   - Redfin: fetch active/pending/sold
   ↓
3. Merge & Deduplicate
   - Combine sources
   - Remove duplicates by address
   ↓
4. Retrieve Historical Data
   - Query database for 90 days
   ↓
5. Analyze Trends
   - Calculate current metrics
   - Compare to historical
   ↓
6. Calculate Score
   - Apply weighted algorithm
   - Determine interpretation
   ↓
7. Generate AI Insights
   - Build Claude prompt
   - Parse response
   ↓
8. Publish Results (parallel)
   - Kafka: real-time streaming
   - Database: persistent storage
   ↓
9. Complete (log stats)
```

**Timing:**
- Data collection: 2-5 seconds (per market)
- Analysis: < 1 second
- AI insights: 2-4 seconds
- Publishing: < 1 second
- **Total per market: 5-10 seconds**

### Multi-Market Flow

```
For each market in [Austin, Miami, Tampa, ...]:
    Analyze market (sequential)
    
After all markets:
    Publish agent metrics
    Log cycle summary
    Sleep until next interval
```

**Scalability:**
- Sequential to avoid API rate limits
- Can parallelize if rate limits allow
- Stateless design enables horizontal scaling

## Configuration

### Tunable Parameters

**Scoring Weights:**
```python
SCORE_WEIGHT_INVENTORY = 0.35  # Most important
SCORE_WEIGHT_ABSORPTION = 0.30
SCORE_WEIGHT_DOM = 0.20
SCORE_WEIGHT_TREND = 0.15
# Must sum to 1.0
```

**Run Schedule:**
```python
AGENT_RUN_INTERVAL_MINUTES = 60  # How often to analyze
```

**Markets:**
```python
MARKETS = "Austin TX,Miami FL,Tampa FL,Orlando FL,Jacksonville FL"
```

**Feature Flags:**
```python
ENABLE_AI_INSIGHTS = true   # Claude integration
ENABLE_KAFKA = true         # Streaming output
ENABLE_DATABASE = true      # Persistent storage
ENABLE_WEB_SCRAPING = true  # Fallback data collection
```

## Performance Characteristics

### Resource Usage

**Memory:**
- Base: ~100 MB
- Per market analysis: +50 MB (peak)
- Typical (5 markets): 250-400 MB

**CPU:**
- Mostly I/O bound (API calls)
- Spikes during analysis: 20-40%
- Average: 5-10%

**Network:**
- API calls: ~100-500 KB per market
- Kafka messages: ~10-50 KB per analysis
- Database writes: ~5-10 KB per analysis

### Throughput

- **Markets per minute**: ~6-10 (sequential)
- **Markets per hour**: 300-600 (with 60min interval)
- **Daily analyses**: 120-288 (5 markets × 24-48 runs)

### Latency

- End-to-end per market: 5-10 seconds
- Data collection: 2-5 seconds (majority)
- Analysis + scoring: < 1 second
- AI insights: 2-4 seconds
- Publishing: < 1 second

## Error Handling & Resilience

### Failure Modes

1. **Data Collection Failure**
   - Continues with available sources
   - Falls back to mock data if all fail
   - Logs errors, doesn't crash

2. **AI Generation Failure**
   - Falls back to template insights
   - Agent continues operation
   - Publishes without AI insights

3. **Kafka Unavailable**
   - Logs warning
   - Continues to database
   - Ensures persistence

4. **Database Unavailable**
   - Continues to Kafka
   - Historical analysis uses empty dataset
   - Basic trends calculated

5. **Rate Limit Hit**
   - Exponential backoff
   - Delays between requests
   - Spreads load over time

### Recovery

- Automatic retry with backoff
- Graceful degradation
- No data loss (database + Kafka)
- Stateless design (easy restart)

## Security Considerations

### API Keys
- Environment variables only
- Never committed to code
- Secrets management in production

### Database Access
- Connection pooling
- Limited permissions (INSERT, SELECT only)
- No user-generated SQL

### Network
- TLS for external APIs
- VPN for production deployment
- Firewall restrictions

### Data Privacy
- No PII collected
- Public market data only
- GDPR-compliant aggregations

## Monitoring & Observability

### Logs

**Levels:**
- DEBUG: Detailed traces
- INFO: Normal operations
- WARNING: Non-critical issues
- ERROR: Failures requiring attention

**Outputs:**
- Console (color-coded)
- File (rotated at 10MB)
- Structured JSON (future)

### Metrics

**Published to Kafka:**
- Analysis counts (success/failure)
- API call statistics
- Processing times
- Resource usage
- Error rates

**Key Indicators:**
- Success rate (target: >95%)
- Average processing time (target: <10s)
- Claude token usage
- Data quality score

### Alerting

**Critical:**
- Agent down for >5 minutes
- Success rate <80%
- Database connection lost

**Warning:**
- API rate limits hit
- Data quality <70%
- Processing time >30s

## Future Enhancements

### Near-term
- [ ] Real-time web scraping (Playwright)
- [ ] More data sources (MLS direct feed)
- [ ] Price trend analysis
- [ ] Competition metrics
- [ ] Mobile notifications

### Medium-term
- [ ] Predictive modeling (future supply)
- [ ] Anomaly detection
- [ ] Market segmentation (by price, type)
- [ ] Sentiment analysis (news integration)
- [ ] Multi-region aggregation

### Long-term
- [ ] Machine learning models
- [ ] Real-time streaming analytics
- [ ] Custom scoring algorithms per user
- [ ] Integration with other agents
- [ ] API for external consumers

## Testing Strategy

### Unit Tests
- Scorer algorithm validation
- Trend calculation accuracy
- Data normalization
- Model validation

### Integration Tests
- End-to-end pipeline
- Database operations
- Kafka publishing
- External API mocking

### Performance Tests
- Load testing (many markets)
- Memory profiling
- Latency benchmarks
- Scalability limits

### Chaos Testing
- API failures
- Database downtime
- Network issues
- Rate limiting

---

**Version:** 1.0.0  
**Last Updated:** 2026-01-31  
**Author:** Leon D
