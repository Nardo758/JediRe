# Kafka Setup Guide - JEDI RE Platform

Quick guide to setting up and running the Kafka event bus for local development and production.

---

## Local Development Setup

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- PostgreSQL running (for event logging)

### Step 1: Start Kafka Infrastructure

```bash
# Navigate to project root
cd /path/to/jedire

# Start Kafka + Zookeeper
docker-compose -f docker-compose.kafka.yml up -d

# Verify services are running
docker ps | grep kafka
docker ps | grep zookeeper
```

Expected output:
```
jedire-kafka        Up 30 seconds
jedire-zookeeper    Up 35 seconds
```

### Step 2: Verify Topics Created

```bash
# List all topics
docker exec jedire-kafka kafka-topics --list --bootstrap-server localhost:9092
```

Expected output:
```
news.events.extracted
signals.demand.updated
signals.supply.updated
signals.risk.updated
scores.jedi.updated
proforma.assumptions.updated
strategy.rankings.updated
alerts.user.generated
dlq.failed.events
```

### Step 3: Run Database Migration

```bash
# Apply event bus migration
cd backend
psql -h localhost -U postgres -d jedire -f ../migrations/031_event_bus.sql
```

Verify tables created:
```sql
\dt kafka_*
\dt event_*
```

### Step 4: Install Dependencies

```bash
# Backend dependencies (includes kafkajs)
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### Step 5: Start Backend with Consumers

```bash
cd backend
npm run dev
```

Expected console output:
```
[Consumers Init] Initializing Kafka consumers...
[Kafka Producer] Kafka producer connected successfully
[Demand Consumer] Demand consumer registered and running
[JEDI Consumer] JEDI score consumer registered and running
[Alert Consumer] Alert consumers registered and running
[Consumers Init] All Kafka consumers initialized and running
```

### Step 6: Start Frontend

```bash
cd frontend
npm run dev
```

Access the platform at `http://localhost:3000`

---

## Testing the Event Bus

### Test 1: Publish a News Event

```bash
curl -X POST http://localhost:4000/api/v1/news/extract \
  -H "Content-Type: application/json" \
  -d '{
    "emailId": "test_email_001",
    "headline": "Amazon announces 4,500 new jobs in Austin",
    "source": "Austin Business Journal",
    "eventType": "employment",
    "magnitude": 4500,
    "tradeAreaId": "ta_austin_downtown"
  }'
```

### Test 2: View Event Log

```bash
# Get recent events
curl http://localhost:4000/api/v1/events/log?limit=10

# Filter by topic
curl http://localhost:4000/api/v1/events/log?topic=news.events.extracted

# Filter by deal
curl http://localhost:4000/api/v1/events/log?dealId=deal_001
```

### Test 3: Check Consumer Health

```bash
curl http://localhost:4000/api/v1/events/status
```

Expected response:
```json
{
  "producer": {
    "healthy": true
  },
  "consumers": [
    {
      "id": "demand-calculation-group:demand-calculator",
      "groupId": "demand-calculation-group",
      "isRunning": true,
      "health": [...]
    }
  ],
  "retry": {
    "pending": 0,
    "processing": 0,
    "recentSuccesses": 10,
    "recentFailures": 0
  }
}
```

### Test 4: Trace Event Cascade

```bash
# Get event ID from log, then trace it
curl http://localhost:4000/api/v1/events/trace/evt_001
```

---

## Production Deployment

### Docker Compose Production Configuration

Create `docker-compose.prod.kafka.yml`:

```yaml
version: '3.8'

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    volumes:
      - zookeeper_data:/var/lib/zookeeper/data
      - zookeeper_log:/var/lib/zookeeper/log
    restart: unless-stopped

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 3
      KAFKA_NUM_PARTITIONS: 9
      KAFKA_LOG_RETENTION_HOURS: 168
      KAFKA_LOG_SEGMENT_BYTES: 1073741824
      KAFKA_MIN_INSYNC_REPLICAS: 2
    volumes:
      - kafka_data:/var/lib/kafka/data
    restart: unless-stopped
```

### Environment Variables

Create `.env.production`:

```bash
# Kafka Configuration
KAFKA_BROKER=kafka:9092

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=jedire
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Application
NODE_ENV=production
PORT=4000
```

### Deploying to Production

```bash
# Build and start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.kafka.yml up -d

# Apply migrations
docker exec jedire-api npm run migrate

# Verify all services are healthy
docker ps
curl http://localhost:4000/api/v1/events/status
```

---

## Monitoring & Maintenance

### View Kafka Logs

```bash
# Kafka broker logs
docker logs jedire-kafka -f

# Zookeeper logs
docker logs jedire-zookeeper -f
```

### Check Topic Details

```bash
# Describe topic
docker exec jedire-kafka kafka-topics \
  --describe \
  --topic news.events.extracted \
  --bootstrap-server localhost:9092

# Check consumer lag
docker exec jedire-kafka kafka-consumer-groups \
  --describe \
  --group demand-calculation-group \
  --bootstrap-server localhost:9092
```

### Database Queries

```sql
-- Recent events
SELECT event_id, topic, event_type, published_at
FROM kafka_events_log
ORDER BY published_at DESC
LIMIT 10;

-- Processing success rate (last hour)
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(duration_ms), 2) as avg_duration_ms
FROM event_processing_status
WHERE completed_at > NOW() - INTERVAL '1 hour'
GROUP BY status;

-- Consumer health
SELECT 
  consumer_group,
  consumer_name,
  topic,
  lag,
  last_heartbeat
FROM consumer_health_status
ORDER BY lag DESC;

-- Failed events
SELECT *
FROM event_processing_status
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Kafka UI (Optional)

Access Kafka UI at `http://localhost:8080` (if enabled in docker-compose):

```bash
# Enable Kafka UI
docker-compose -f docker-compose.kafka.yml --profile tools up -d
```

---

## Troubleshooting

### Kafka Won't Start

**Problem:** Kafka container exits immediately

**Solution:**
1. Check Zookeeper is running: `docker ps | grep zookeeper`
2. Check logs: `docker logs jedire-kafka`
3. Ensure ports 9092 and 2181 are not in use: `lsof -i :9092`, `lsof -i :2181`
4. Remove volumes and restart: `docker-compose down -v && docker-compose up -d`

### Topics Not Creating

**Problem:** Topic initialization fails

**Solution:**
1. Manually create topics:
```bash
docker exec jedire-kafka kafka-topics \
  --create \
  --topic news.events.extracted \
  --partitions 3 \
  --replication-factor 1 \
  --bootstrap-server localhost:9092
```

2. Verify topic exists: `kafka-topics --list --bootstrap-server localhost:9092`

### Consumer Not Consuming

**Problem:** Events published but not consumed

**Solution:**
1. Check consumer is running: `curl http://localhost:4000/api/v1/events/status`
2. Check consumer logs for errors
3. Verify consumer group exists:
```bash
docker exec jedire-kafka kafka-consumer-groups \
  --list \
  --bootstrap-server localhost:9092
```
4. Reset consumer offset (if needed):
```bash
docker exec jedire-kafka kafka-consumer-groups \
  --reset-offsets \
  --to-earliest \
  --group demand-calculation-group \
  --topic news.events.extracted \
  --execute \
  --bootstrap-server localhost:9092
```

### High Lag

**Problem:** Consumer lag increasing

**Solution:**
1. Check consumer health: Query `consumer_health_status` table
2. Optimize consumer handler (add indexes, cache results)
3. Scale consumers horizontally (increase instances)
4. Increase partition count (requires topic recreation)

---

## Useful Commands

```bash
# Stop all Kafka services
docker-compose -f docker-compose.kafka.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.kafka.yml down -v

# Restart Kafka
docker restart jedire-kafka

# View Kafka configuration
docker exec jedire-kafka kafka-configs \
  --describe \
  --entity-type brokers \
  --entity-name 1 \
  --bootstrap-server localhost:9092

# Consume messages from topic (for debugging)
docker exec jedire-kafka kafka-console-consumer \
  --topic news.events.extracted \
  --from-beginning \
  --bootstrap-server localhost:9092

# Produce test message
docker exec -it jedire-kafka kafka-console-producer \
  --topic news.events.extracted \
  --bootstrap-server localhost:9092
```

---

## Performance Tuning

### Producer Configuration

```typescript
const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000,
  maxInFlightRequests: 5,
  idempotent: true,
  compression: 1, // GZIP
});
```

### Consumer Configuration

```typescript
const consumer = kafka.consumer({
  groupId: 'my-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxWaitTimeInMs: 5000,
  maxBytesPerPartition: 1048576, // 1MB
});
```

### Kafka Broker Settings

```yaml
environment:
  KAFKA_NUM_PARTITIONS: 9                    # More parallelism
  KAFKA_LOG_RETENTION_HOURS: 168             # 7 days
  KAFKA_LOG_SEGMENT_BYTES: 1073741824        # 1GB segments
  KAFKA_COMPRESSION_TYPE: gzip               # Compress messages
  KAFKA_MESSAGE_MAX_BYTES: 10485760          # 10MB max message
```

---

## Next Steps

1. **Add Monitoring:** Integrate Prometheus + Grafana for metrics
2. **Set Up Alerting:** Alert on high consumer lag or failures
3. **Multi-Broker Setup:** Scale Kafka to 3 brokers for production
4. **Schema Registry:** Add Confluent Schema Registry for schema versioning
5. **Kafka Connect:** Integrate with external systems (S3, Elasticsearch)

---

## References

- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [KafkaJS Documentation](https://kafka.js.org/)
- [Confluent Docker Images](https://docs.confluent.io/platform/current/installation/docker/image-reference.html)
- Event Bus Architecture: `docs/EVENT_BUS_ARCHITECTURE.md`

---

**Last Updated:** February 11, 2026
