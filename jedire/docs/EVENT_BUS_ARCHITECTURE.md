# Event Bus Architecture - JEDI RE Platform

## Overview

The JEDI RE platform uses Apache Kafka as a central event bus to enable real-time, agent-to-agent communication. A single news event (e.g., Amazon announces 4,500 jobs) cascades through multiple agents, triggering coordinated updates across demand, supply, risk, JEDI scores, pro forma assumptions, and user alerts.

**Version:** 1.0.0  
**Date:** February 11, 2026  
**Phase:** 3, Component 3

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Kafka Event Bus                                 │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ news.events  │  │ signals.*    │  │ scores.*     │  │ alerts.*    │ │
│  │ .extracted   │  │ .demand      │  │ .jedi        │  │ .user       │ │
│  │              │  │ .supply      │  │ .updated     │  │ .generated  │ │
│  │              │  │ .risk        │  │              │  │             │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
        ↑                   ↑                   ↑                  ↑
        │                   │                   │                  │
        │                   │                   │                  │
   ┌────┴────┐         ┌────┴────┐         ┌───┴────┐        ┌───┴────┐
   │  News   │         │ Demand  │         │  JEDI  │        │ Alert  │
   │  Agent  │         │  Agent  │         │  Agent │        │ Agent  │
   │         │         │         │         │        │        │        │
   │ Publishes        │ Publishes        │ Publishes      │ Publishes
   │ Subscribes       │ Subscribes       │ Subscribes     │ Subscribes
   └─────────┘         └─────────┘         └────────┘        └────────┘
```

---

## Event Flow Example

### Scenario: Amazon Announces 4,500 New Jobs

```
1. News Agent extracts event from email
   ↓ publishes to: news.events.extracted
   {
     eventId: "evt_001",
     eventType: "employment",
     magnitude: 4500,
     confidence: 85,
     tradeAreaIds: ["ta_austin_downtown"],
     ...
   }

2. Demand Agent (consumer) receives event
   - Filters: employment events only
   - Calculates: 4,500 × 0.40 = 1,800 housing units needed
   ↓ publishes to: signals.demand.updated
   {
     eventId: "evt_002",
     triggeringEventId: "evt_001",
     housingUnitsNeeded: 1800,
     quarterlyPhasing: { "2026-Q2": 300, "2026-Q3": 600, ... },
     ...
   }

3. Supply Agent (consumer) receives demand signal
   - Checks existing pipeline: 1,200 units under construction
   - Gap analysis: 600-unit shortage
   ↓ publishes to: signals.supply.updated
   {
     eventId: "evt_003",
     triggeringEventId: "evt_002",
     pipelineUnits: 1200,
     shortfall: 600,
     ...
   }

4. Risk Scoring Agent (consumer) receives demand + supply signals
   - Calculates concentration risk (single employer)
   - Demand risk score: 65 (moderate)
   ↓ publishes to: signals.risk.updated
   {
     eventId: "evt_004",
     triggeringEventIds: ["evt_002", "evt_003"],
     overallRiskScore: 65,
     riskFactors: [...],
     ...
   }

5. JEDI Score Agent (consumer) receives all signals
   - Recalculates score: 68 → 74 (+6 points)
   ↓ publishes to: scores.jedi.updated
   {
     eventId: "evt_005",
     jediScore: 74,
     previousScore: 68,
     scoreDelta: +6,
     ...
   }

6. Pro Forma Agent (consumer) receives JEDI update
   - Adjusts rent growth: +1.2%
   - Adjusts vacancy: -0.8%
   ↓ publishes to: proforma.assumptions.updated
   {
     eventId: "evt_006",
     adjustments: [
       { metric: "rent_growth", oldValue: 3.5, newValue: 4.7, ... }
     ],
     ...
   }

7. Alert Agent (consumer) receives JEDI update
   - Detects: score change > 5 points
   ↓ publishes to: alerts.user.generated
   {
     eventId: "evt_007",
     severity: "info",
     title: "JEDI Score Increased",
     message: "Amazon announcement increased your JEDI Score by 6 points",
     ...
   }

8. Notification Service (consumer) receives alert
   - Sends email/push notification to user
   ✓ User receives: "Amazon campus announcement increased your JEDI Score by 6 points"
```

**Total cascade time:** < 5 seconds  
**Events generated:** 7  
**Agents involved:** 6

---

## Kafka Topics

### Topic Naming Convention

`{domain}.{resource}.{action}`

### Topic List

| Topic | Published By | Consumed By | Purpose |
|-------|--------------|-------------|---------|
| `news.events.extracted` | News Agent | Demand Agent, Supply Agent | Raw news events extracted from emails |
| `signals.demand.updated` | Demand Agent | JEDI Agent, Pro Forma Agent, Risk Agent | Housing demand projections |
| `signals.supply.updated` | Supply Agent | JEDI Agent, Pro Forma Agent, Risk Agent | Construction pipeline updates |
| `signals.momentum.updated` | Market Intelligence | JEDI Agent, Risk Agent | Market momentum indicators |
| `signals.position.updated` | Market Intelligence | JEDI Agent, Risk Agent | Competitive position metrics |
| `signals.risk.updated` | Risk Scoring Service | JEDI Agent, Alert Agent | Risk scores and factors |
| `scores.jedi.updated` | JEDI Score Service | Pro Forma Agent, Alert Agent, Strategy Agent | JEDI score recalculations |
| `proforma.assumptions.updated` | Pro Forma Service | Strategy Agent, Alert Agent | Financial assumption adjustments |
| `strategy.rankings.updated` | Strategy Arbitrage | Alert Agent | Strategy recommendations |
| `alerts.user.generated` | Any Agent | Notification Service | User-facing alerts |
| `dlq.failed.events` | Consumer Manager | Retry Handler | Dead letter queue for failed events |

### Partitioning Strategy

- **Key:** `tradeAreaId` or `dealId` (ensures related events go to same partition)
- **Partitions:** 3 per topic (scalable to 9 for high traffic)
- **Replication Factor:** 1 (local dev), 3 (production)

---

## Event Schemas

All events extend `BaseEvent`:

```typescript
interface BaseEvent {
  eventId: string;          // UUID
  eventType: string;        // Specific event classification
  timestamp: string;        // ISO 8601 timestamp
  version?: string;         // Schema version
  metadata?: Record<string, any>;
}
```

### Key Event Schemas

#### NewsEventMessage
```typescript
{
  eventId: "uuid",
  eventType: "employment" | "university" | "military" | ...,
  tradeAreaIds: ["ta_001", "ta_002"],
  submarketIds: ["sm_001"],
  msaIds: ["msa_001"],
  magnitude: 4500,          // Jobs, units, sq ft, etc.
  magnitudeUnit: "jobs",
  confidence: 85,           // 0-100
  source: "Amazon press release",
  ...
}
```

#### DemandSignalMessage
```typescript
{
  eventId: "uuid",
  signalId: "demand_001",
  tradeAreaId: "ta_austin_downtown",
  housingUnitsNeeded: 1800,
  absorptionRateMonthly: 150,
  quarterlyPhasing: {
    "2026-Q2": 300,
    "2026-Q3": 600,
    ...
  },
  confidenceScore: 80,
  triggeringEventId: "evt_001",
  ...
}
```

Full schema definitions: `/backend/src/services/kafka/event-schemas.ts`

---

## Consumer Groups

| Group ID | Consumer Name | Topics | Purpose |
|----------|---------------|--------|---------|
| `demand-calculation-group` | `demand-calculator` | `news.events.extracted` | Calculate housing demand from employment/university/military events |
| `supply-tracking-group` | `supply-tracker` | `news.events.extracted` | Track construction pipeline from permit/construction events |
| `jedi-score-group` | `jedi-score-calculator` | `signals.demand.updated`, `signals.supply.updated`, `signals.risk.updated` | Recalculate JEDI scores |
| `proforma-adjustment-group` | `proforma-adjuster` | `signals.demand.updated`, `signals.supply.updated` | Adjust pro forma assumptions |
| `alert-jedi-group` | `jedi-score-monitor` | `scores.jedi.updated` | Monitor JEDI scores for thresholds |
| `alert-risk-group` | `risk-score-monitor` | `signals.risk.updated` | Monitor risk scores for thresholds |

### Consumer Configuration

```typescript
{
  groupId: 'demand-calculation-group',
  name: 'demand-calculator',
  topics: ['news.events.extracted'],
  handler: demandCalculatorHandler,
  fromBeginning: false,
  autoCommit: true,
  maxRetries: 3,
}
```

---

## Error Handling & Resilience

### Retry Strategy

1. **Exponential Backoff**
   - Initial delay: 1 second
   - Backoff multiplier: 2x
   - Max delay: 5 minutes
   - Max retries: 3

2. **Retry Queue**
   - Failed events stored in `event_processing_status` table
   - Status: `retrying`, `next_retry_at` timestamp
   - Retry processor runs every 10 seconds

3. **Dead Letter Queue (DLQ)**
   - Events exceeding max retries → `dlq.failed.events` topic
   - Manual inspection and replay via API

### Circuit Breaker

- Consumer health monitoring (heartbeat every 60 seconds)
- Consumer lag threshold: 1000 messages
- Auto-pause consumer if lag exceeds threshold

### Database Audit Trail

All events logged to `kafka_events_log`:
- Full payload
- Kafka metadata (topic, partition, offset)
- Geographic context
- Processing status

---

## Database Schema

### kafka_events_log
Audit trail of all published events.

```sql
CREATE TABLE kafka_events_log (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  topic VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  trade_area_ids TEXT[],
  submarket_ids TEXT[],
  msa_ids TEXT[],
  deal_id UUID REFERENCES deals(id),
  published_by VARCHAR(100) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  partition INTEGER,
  offset BIGINT,
  magnitude NUMERIC(10, 2),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### event_processing_status
Track processing status by consumer.

```sql
CREATE TABLE event_processing_status (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL,
  consumer_group VARCHAR(255) NOT NULL,
  consumer_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('processing', 'success', 'failed', 'retrying')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  result JSONB
);
```

### event_cascade_trace
Track cascading event propagation.

```sql
CREATE TABLE event_cascade_trace (
  id BIGSERIAL PRIMARY KEY,
  root_event_id UUID NOT NULL,
  event_id UUID NOT NULL,
  parent_event_id UUID,
  depth INTEGER NOT NULL DEFAULT 0,
  cascade_path UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Full schema: `/migrations/031_event_bus.sql`

---

## API Endpoints

### GET /api/v1/events/log
Get event processing log with filters.

**Query Parameters:**
- `topic`: Filter by topic
- `eventType`: Filter by event type
- `dealId`: Filter by deal
- `tradeAreaId`: Filter by trade area
- `startDate`, `endDate`: Date range
- `limit`, `offset`: Pagination

**Response:**
```json
{
  "events": [...],
  "pagination": {
    "total": 1523,
    "limit": 100,
    "offset": 0
  }
}
```

### GET /api/v1/events/status
Get consumer health status.

**Response:**
```json
{
  "producer": {
    "healthy": true
  },
  "consumers": [
    {
      "id": "demand-calculation-group:demand-calculator",
      "groupId": "demand-calculation-group",
      "name": "demand-calculator",
      "topics": ["news.events.extracted"],
      "isRunning": true,
      "health": [...]
    }
  ],
  "retry": {
    "pending": 5,
    "processing": 2,
    "recentSuccesses": 1523,
    "recentFailures": 12
  }
}
```

### POST /api/v1/events/replay/:eventId
Replay a failed event.

**Response:**
```json
{
  "success": true,
  "message": "Event retry scheduled",
  "eventId": "evt_failed_001"
}
```

### GET /api/v1/events/trace/:eventId
Get full cascade trace for an event.

**Response:**
```json
{
  "rootEventId": "evt_001",
  "rootEvent": {...},
  "cascade": [
    {
      "eventId": "evt_002",
      "topic": "signals.demand.updated",
      "depth": 1,
      "children": [...]
    }
  ],
  "totalEvents": 7
}
```

### GET /api/v1/events/analytics
Get event analytics and statistics.

**Query Parameters:**
- `period`: `1h`, `24h`, `7d`, `30d`

---

## Frontend Components

### EventCascadeViewer
Visual flow diagram showing event propagation.

**Features:**
- Tree visualization of event cascade
- Click nodes to see details
- Color-coded by topic
- Status indicators (success/failed/retrying)
- Real-time updates

**Usage:**
```tsx
import { EventCascadeViewer } from '@/components/events';

<EventCascadeViewer eventId="evt_001" />
```

### EventLog
Table of recent platform events.

**Features:**
- Filter by topic, event type, publisher
- Search by event ID or deal ID
- Pagination
- Auto-refresh option
- Click to view cascade
- Retry failed events

**Usage:**
```tsx
import { EventLog } from '@/components/events';

<EventLog dealId="deal_001" autoRefresh={true} />
```

---

## Development Guide

### Adding a New Event Type

1. **Define Schema** (`event-schemas.ts`):
```typescript
export interface MyNewEventMessage extends BaseEvent {
  eventType: 'my_new_event';
  myField: string;
  ...
}
```

2. **Add Topic** (if new domain):
```typescript
export const KAFKA_TOPICS = {
  ...
  MY_NEW_TOPIC: 'domain.resource.action',
} as const;
```

3. **Publish Event**:
```typescript
import { kafkaProducer } from '@/services/kafka/kafka-producer.service';

await kafkaProducer.publish(
  KAFKA_TOPICS.MY_NEW_TOPIC,
  myEvent,
  {
    key: myEvent.dealId,
    publishedBy: 'my-service',
  }
);
```

4. **Create Consumer** (`consumers/my-consumer.ts`):
```typescript
const myHandler: MessageHandler<MyNewEventMessage> = async (event, metadata) => {
  // Process event
  console.log('Received:', event);
};

export async function registerMyConsumer(): Promise<void> {
  await consumerManager.registerConsumer({
    groupId: 'my-group',
    name: 'my-consumer',
    topics: [KAFKA_TOPICS.MY_NEW_TOPIC],
    handler: myHandler,
  });
}
```

5. **Register Consumer** (`consumers/index.ts`):
```typescript
await registerMyConsumer();
```

---

## Monitoring & Observability

### Key Metrics

1. **Event Throughput**
   - Events published per second (by topic)
   - Events consumed per second (by consumer)

2. **Consumer Lag**
   - Messages behind latest offset
   - Alert if lag > 1000

3. **Processing Success Rate**
   - Success vs. failed events (last hour)
   - Avg processing time

4. **Cascade Depth**
   - Avg cascade depth (how many levels)
   - Max cascade depth observed

### Health Checks

- **Producer:** `kafkaProducer.healthCheck()`
- **Consumers:** `consumerManager.getConsumerStatus()`
- **Retry Queue:** `retryHandler.getRetryStatistics()`

### Logging

All services log to console with structured logging:
```
[Kafka Producer] Published event to news.events.extracted { eventId: 'evt_001', partition: 2, offset: 1234 }
[Demand Consumer] Processing news event for demand calculation { eventId: 'evt_001', eventType: 'employment' }
[JEDI Consumer] JEDI score recalculated { dealId: 'deal_001', previousScore: 68, newScore: 74 }
```

---

## Production Deployment

### Kafka Configuration

```yaml
# docker-compose.kafka.yml
services:
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 3
      KAFKA_NUM_PARTITIONS: 9
      KAFKA_LOG_RETENTION_HOURS: 168
```

### Environment Variables

```bash
KAFKA_BROKER=kafka:9092
```

### Starting Services

```bash
# Start Kafka + Zookeeper
docker-compose -f docker-compose.kafka.yml up -d

# Start backend with consumers
npm run start
```

### Graceful Shutdown

Consumers and producers handle `SIGTERM` and `SIGINT`:
- Finish processing current messages
- Commit offsets
- Disconnect cleanly

---

## Troubleshooting

### Consumer Not Consuming

1. Check consumer status: `GET /api/v1/events/status`
2. Check consumer logs for errors
3. Verify topic exists: `docker exec jedire-kafka kafka-topics --list --bootstrap-server localhost:9092`
4. Check consumer lag: Query `consumer_health_status` table

### Events Not Publishing

1. Check producer health: `await kafkaProducer.healthCheck()`
2. Verify Kafka is running: `docker ps | grep kafka`
3. Check `kafka_events_log` table for recent events
4. Inspect error logs

### High Consumer Lag

1. Increase consumer instances (scale horizontally)
2. Optimize handler performance
3. Increase partition count (requires topic recreation)

### Failed Events in DLQ

1. Query DLQ: `SELECT * FROM kafka_events_log WHERE topic = 'dlq.failed.events'`
2. Inspect error: Check `event_processing_status` for error messages
3. Fix root cause
4. Replay: `POST /api/v1/events/replay/:eventId`

---

## Next Steps

### Phase 3 Enhancements

1. **Source Credibility Integration** (Component 4)
   - Add credibility scores to news events
   - Filter low-credibility events before cascade

2. **Advanced Analytics Dashboard**
   - Real-time event throughput charts
   - Cascade success rate metrics
   - Consumer performance heatmap

3. **Event Replay UI**
   - Frontend interface for DLQ management
   - Bulk replay functionality

4. **Multi-Tenancy**
   - User-specific event filtering
   - Per-user alert preferences

---

## References

- Event schemas: `/backend/src/services/kafka/event-schemas.ts`
- Kafka producer: `/backend/src/services/kafka/kafka-producer.service.ts`
- Consumer manager: `/backend/src/services/kafka/kafka-consumer-manager.service.ts`
- Database migrations: `/migrations/031_event_bus.sql`
- API routes: `/backend/src/api/rest/events.routes.ts`
- Frontend components: `/frontend/src/components/events/`

---

**Document Version:** 1.0.0  
**Last Updated:** February 11, 2026  
**Maintained By:** JEDI RE Engineering Team
