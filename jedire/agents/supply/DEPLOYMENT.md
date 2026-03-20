# Supply Agent Deployment Guide

## Prerequisites

### System Requirements
- Python 3.11+
- PostgreSQL 15+ (with PostGIS for future geospatial features)
- Apache Kafka 3.0+
- 2GB RAM minimum (4GB recommended)
- 10GB disk space

### API Keys Required
- Anthropic API key (Claude)
- Zillow API key (optional, will use mock data if not provided)
- Redfin API key (optional, will use mock data if not provided)

## Quick Start (Docker)

The fastest way to get started is using Docker Compose:

```bash
# 1. Clone and navigate
cd /home/leon/clawd/jedire/agents/supply

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start all services
docker-compose up -d

# 4. View logs
docker-compose logs -f supply-agent

# 5. Stop services
docker-compose down
```

This will start:
- PostgreSQL database
- Apache Kafka + Zookeeper
- Supply Agent

## Manual Installation

### 1. Install Python Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 2. Set Up PostgreSQL

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE jedire;
CREATE USER jedire WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE jedire TO jedire;
\q
```

### 3. Set Up Kafka

```bash
# Download Kafka
wget https://downloads.apache.org/kafka/3.6.0/kafka_2.13-3.6.0.tgz
tar -xzf kafka_2.13-3.6.0.tgz
cd kafka_2.13-3.6.0

# Start Zookeeper
bin/zookeeper-server-start.sh config/zookeeper.properties &

# Start Kafka
bin/kafka-server-start.sh config/server.properties &

# Create topics
bin/kafka-topics.sh --create --topic supply-insights --bootstrap-server localhost:9092
bin/kafka-topics.sh --create --topic agent-metrics --bootstrap-server localhost:9092
```

### 4. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit configuration
nano .env
```

Required settings:
```bash
DATABASE_URL=postgresql://jedire:password@localhost:5432/jedire
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
ANTHROPIC_API_KEY=sk-ant-xxxxx
MARKETS=Austin TX,Miami FL,Tampa FL
```

### 5. Run the Agent

```bash
# Using the startup script
./run.sh

# Or manually
python -m src.main
```

## Production Deployment

### Using Systemd (Linux)

Create service file: `/etc/systemd/system/supply-agent.service`

```ini
[Unit]
Description=JediRe Supply Agent
After=network.target postgresql.service kafka.service

[Service]
Type=simple
User=jedire
WorkingDirectory=/opt/jedire/agents/supply
Environment="PATH=/opt/jedire/agents/supply/venv/bin"
ExecStart=/opt/jedire/agents/supply/venv/bin/python -m src.main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable supply-agent
sudo systemctl start supply-agent
sudo systemctl status supply-agent
```

### Using Docker in Production

```bash
# Build image
docker build -t jedire/supply-agent:latest .

# Run with custom network
docker run -d \
  --name supply-agent \
  --network jedire-net \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  jedire/supply-agent:latest
```

### Using Kubernetes

Create deployment:

```yaml
# supply-agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: supply-agent
  namespace: jedire
spec:
  replicas: 1
  selector:
    matchLabels:
      app: supply-agent
  template:
    metadata:
      labels:
        app: supply-agent
    spec:
      containers:
      - name: supply-agent
        image: jedire/supply-agent:latest
        envFrom:
        - secretRef:
            name: supply-agent-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        persistentVolumeClaim:
          claimName: supply-agent-logs
```

Apply:
```bash
kubectl apply -f supply-agent-deployment.yaml
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `KAFKA_BOOTSTRAP_SERVERS` | Yes | `localhost:9092` | Kafka broker addresses |
| `ANTHROPIC_API_KEY` | Yes | - | Claude API key |
| `MARKETS` | Yes | - | Comma-separated list of markets |
| `AGENT_RUN_INTERVAL_MINUTES` | No | `60` | How often to run analysis |
| `ENABLE_AI_INSIGHTS` | No | `true` | Generate AI insights |
| `ENABLE_KAFKA` | No | `true` | Publish to Kafka |
| `ENABLE_DATABASE` | No | `true` | Write to database |
| `LOG_LEVEL` | No | `INFO` | Logging level |

### Scoring Weights

Adjust the scoring algorithm weights (must sum to 1.0):

```bash
SCORE_WEIGHT_INVENTORY=0.35
SCORE_WEIGHT_ABSORPTION=0.30
SCORE_WEIGHT_DOM=0.20
SCORE_WEIGHT_TREND=0.15
```

## Monitoring

### Logs

Logs are written to:
- Console (stdout)
- File: `logs/supply_agent.log`

View real-time logs:
```bash
tail -f logs/supply_agent.log
```

### Metrics

Agent metrics are published to Kafka topic `agent-metrics`:

```json
{
  "agent": "supply",
  "timestamp": "2026-01-31T20:00:00Z",
  "markets_analyzed": 5,
  "successful_analyses": 5,
  "failed_analyses": 0,
  "api_calls_made": 10,
  "claude_calls": 5,
  "claude_tokens_used": 12500
}
```

### Health Checks

Check agent health:

```bash
# Docker
docker exec supply-agent python -c "import sys; sys.exit(0)"

# Kubernetes
kubectl exec -it supply-agent -- python -c "import sys; sys.exit(0)"
```

### Database Queries

Check recent analyses:

```sql
-- Latest analysis per market
SELECT market, timestamp, supply_score, interpretation
FROM supply_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Market trends
SELECT 
    market,
    DATE(timestamp) as date,
    AVG(supply_score) as avg_score,
    AVG(total_inventory) as avg_inventory
FROM supply_metrics
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY market, DATE(timestamp)
ORDER BY market, date;
```

## Troubleshooting

### Agent Won't Start

1. **Check dependencies:**
   ```bash
   pip list | grep -E "anthropic|kafka|asyncpg"
   ```

2. **Verify database connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

3. **Test Kafka connection:**
   ```bash
   kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic supply-insights --from-beginning --max-messages 1
   ```

### No Data Collected

1. **Check API keys:**
   - Agent will use mock data if API keys are missing
   - Verify keys in `.env` file

2. **Check rate limits:**
   - Review logs for rate limit errors
   - Adjust `API_RATE_LIMIT_PER_MINUTE` if needed

### Database Issues

1. **Table not created:**
   ```sql
   -- Manually create if needed
   \i schema.sql  # Would provide this file
   ```

2. **Connection pool exhausted:**
   - Increase `DATABASE_POOL_SIZE`
   - Check for connection leaks in logs

### Kafka Issues

1. **Topic doesn't exist:**
   ```bash
   kafka-topics.sh --create --topic supply-insights --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
   ```

2. **Messages not being consumed:**
   ```bash
   kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic supply-insights --from-beginning
   ```

## Scaling

### Horizontal Scaling

The Supply Agent is stateless and can be scaled horizontally:

```bash
# Docker Compose
docker-compose up -d --scale supply-agent=3

# Kubernetes
kubectl scale deployment supply-agent --replicas=3
```

**Note:** Coordinate multiple instances to avoid duplicate analyses:
- Use different `MARKETS` per instance
- Implement distributed locking (Redis)
- Use Kafka consumer groups

### Vertical Scaling

Increase resources for larger workloads:

```yaml
# Kubernetes
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

## Backup & Recovery

### Database Backups

```bash
# Backup
pg_dump $DATABASE_URL > supply_metrics_backup.sql

# Restore
psql $DATABASE_URL < supply_metrics_backup.sql
```

### Configuration Backups

```bash
# Backup .env and configs
tar -czf supply-agent-config-$(date +%Y%m%d).tar.gz .env config/
```

## Maintenance

### Rotating Logs

Logs automatically rotate at 10MB. Manual rotation:

```bash
logrotate -f /etc/logrotate.d/supply-agent
```

### Database Cleanup

Archive old data:

```sql
-- Archive data older than 1 year
CREATE TABLE supply_metrics_archive AS 
SELECT * FROM supply_metrics 
WHERE timestamp < NOW() - INTERVAL '1 year';

DELETE FROM supply_metrics 
WHERE timestamp < NOW() - INTERVAL '1 year';

VACUUM FULL supply_metrics;
```

## Security

### API Key Management

- Store keys in environment variables, not code
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys regularly

### Network Security

- Restrict database access to agent IP
- Use TLS for Kafka connections
- VPN for production deployments

### Access Control

```sql
-- Limit agent database permissions
REVOKE ALL ON DATABASE jedire FROM jedire;
GRANT CONNECT ON DATABASE jedire TO jedire;
GRANT SELECT, INSERT ON supply_metrics TO jedire;
```

## Support

For issues or questions:
- Check logs: `logs/supply_agent.log`
- Review documentation: `README.md`
- Contact: Leon D (project owner)

---

**Last Updated:** 2026-01-31  
**Version:** 1.0.0
