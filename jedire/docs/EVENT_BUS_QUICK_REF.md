# Event Bus Quick Reference - JEDI RE

Fast reference for common event bus operations.

---

## Publishing Events

```typescript
import { kafkaProducer } from '@/services/kafka/kafka-producer.service';
import { KAFKA_TOPICS, DemandSignalMessage } from '@/services/kafka/event-schemas';

// Publish single event
const demandSignal: DemandSignalMessage = {
  eventId: uuidv4(),
  eventType: 'demand_calculated',
  timestamp: new Date().toISOString(),
  signalId: 'demand_001',
  tradeAreaId: 'ta_austin',
  housingUnitsNeeded: 1800,
  absorptionRateMonthly: 150,
  quarterlyPhasing: { '2026-Q2': 300, '2026-Q3': 600 },
  confidenceScore: 85,
  triggeringEventId: 'evt_news_001',
  calculationMethod: 'employment:tech_jobs',
};

await kafkaProducer.publish(
  KAFKA_TOPICS.DEMAND_SIGNALS,
  demandSignal,
  {
    key: demandSignal.tradeAreaId,
    publishedBy: 'demand-service',
  }
);

// Publish batch
await kafkaProducer.publishBatch(
  KAFKA_TOPICS.DEMAND_SIGNALS,
  [signal1, signal2, signal3],
  {
    publishedBy: 'demand-service',
    getKey: (event) => event.tradeAreaId,
  }
);
```

---

## Creating Consumers

```typescript
import { consumerManager, MessageHandler } from '@/services/kafka/kafka-consumer-manager.service';
import { DemandSignalMessage, KAFKA_TOPICS } from '@/services/kafka/event-schemas';

const myHandler: MessageHandler<DemandSignalMessage> = async (event, metadata) => {
  console.log('Received demand signal:', event);
  
  // Process event
  await processData(event);
  
  // Publish downstream event if needed
  await kafkaProducer.publish(KAFKA_TOPICS.JEDI_SCORES, ...);
};

export async function registerMyConsumer(): Promise<void> {
  await consumerManager.registerConsumer({
    groupId: 'my-consumer-group',
    name: 'my-consumer',
    topics: [KAFKA_TOPICS.DEMAND_SIGNALS],
    handler: myHandler,
    fromBeginning: false,
    autoCommit: true,
    maxRetries: 3,
  });
}
```

---

## API Calls

```bash
# Get event log
curl "http://localhost:4000/api/v1/events/log?limit=10"

# Filter events by topic
curl "http://localhost:4000/api/v1/events/log?topic=news.events.extracted"

# Get consumer status
curl "http://localhost:4000/api/v1/events/status"

# Trace event cascade
curl "http://localhost:4000/api/v1/events/trace/evt_001"

# Replay failed event
curl -X POST "http://localhost:4000/api/v1/events/replay/evt_failed_001"

# Get analytics
curl "http://localhost:4000/api/v1/events/analytics?period=24h"
```

---

## Database Queries

```sql
-- Recent events
SELECT event_id, topic, event_type, published_at
FROM kafka_events_log
ORDER BY published_at DESC LIMIT 10;

-- Event cascade
SELECT * FROM event_cascade_trace
WHERE root_event_id = 'evt_001'
ORDER BY depth;

-- Processing status
SELECT consumer_group, consumer_name, status, COUNT(*)
FROM event_processing_status
WHERE completed_at > NOW() - INTERVAL '1 hour'
GROUP BY consumer_group, consumer_name, status;

-- Failed events
SELECT * FROM event_processing_status
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Consumer health
SELECT * FROM consumer_health_status
WHERE lag > 100 OR last_heartbeat < NOW() - INTERVAL '2 minutes';
```

---

## Docker Commands

```bash
# Start Kafka
docker-compose -f docker-compose.kafka.yml up -d

# Stop Kafka
docker-compose -f docker-compose.kafka.yml down

# View logs
docker logs jedire-kafka -f

# List topics
docker exec jedire-kafka kafka-topics --list --bootstrap-server localhost:9092

# Describe topic
docker exec jedire-kafka kafka-topics \
  --describe --topic news.events.extracted \
  --bootstrap-server localhost:9092

# Check consumer lag
docker exec jedire-kafka kafka-consumer-groups \
  --describe --group demand-calculation-group \
  --bootstrap-server localhost:9092

# Consume messages (debugging)
docker exec jedire-kafka kafka-console-consumer \
  --topic news.events.extracted --from-beginning \
  --bootstrap-server localhost:9092
```

---

## Common Topics

| Topic | Publisher | Consumer | Use Case |
|-------|-----------|----------|----------|
| `news.events.extracted` | News Agent | Demand, Supply | Raw news events |
| `signals.demand.updated` | Demand Agent | JEDI, Pro Forma, Risk | Housing demand |
| `signals.supply.updated` | Supply Agent | JEDI, Pro Forma, Risk | Construction pipeline |
| `signals.risk.updated` | Risk Agent | JEDI, Alert | Risk scores |
| `scores.jedi.updated` | JEDI Agent | Pro Forma, Alert | JEDI scores |
| `proforma.assumptions.updated` | Pro Forma Agent | Strategy, Alert | Financial assumptions |
| `alerts.user.generated` | Alert Agent | Notification Service | User alerts |

---

## Event Schema Templates

### News Event
```typescript
{
  eventId: uuid(),
  eventType: 'employment',
  timestamp: new Date().toISOString(),
  tradeAreaIds: ['ta_001'],
  submarketIds: ['sm_001'],
  msaIds: ['msa_001'],
  magnitude: 4500,
  magnitudeUnit: 'jobs',
  confidence: 85,
  source: 'Company press release',
  title: 'Amazon announces 4,500 jobs',
  summary: '...',
  announcedDate: '2026-02-01',
  entities: { companies: ['Amazon'] },
  extractedBy: 'news-agent'
}
```

### Demand Signal
```typescript
{
  eventId: uuid(),
  eventType: 'demand_calculated',
  timestamp: new Date().toISOString(),
  signalId: 'demand_001',
  tradeAreaId: 'ta_001',
  housingUnitsNeeded: 1800,
  absorptionRateMonthly: 150,
  quarterlyPhasing: { '2026-Q2': 300, '2026-Q3': 600 },
  confidenceScore: 85,
  triggeringEventId: 'evt_news_001',
  calculationMethod: 'employment:tech_jobs'
}
```

---

## Troubleshooting Checklist

- [ ] Kafka is running: `docker ps | grep kafka`
- [ ] Topics exist: `kafka-topics --list`
- [ ] Producer healthy: `kafkaProducer.healthCheck()`
- [ ] Consumers running: `GET /api/v1/events/status`
- [ ] No lag: Check `consumer_health_status`
- [ ] No failed events: Check `event_processing_status WHERE status = 'failed'`
- [ ] Database migration applied: Check `kafka_events_log` table exists

---

## Frontend Usage

```tsx
import { EventLog, EventCascadeViewer } from '@/components/events';

// Event log for deal
<EventLog dealId="deal_001" autoRefresh={true} />

// Event cascade viewer
<EventCascadeViewer eventId="evt_001" onClose={() => setShow(false)} />
```

---

**Full Documentation:** `docs/EVENT_BUS_ARCHITECTURE.md`  
**Setup Guide:** `docs/KAFKA_SETUP_GUIDE.md`
