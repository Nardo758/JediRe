# Digital Traffic Events API Documentation

Part of Week 1 (Events Infrastructure) of the 8-week traffic engine roadmap.

## Overview

The Digital Traffic Events API enables tracking of user engagement with properties and calculates digital traffic scores (0-100) to identify trending properties and institutional interest patterns.

## Base URL

```
/api/events
```

## Endpoints

### 1. Track Single Event

**POST** `/api/events/track`

Track a single user engagement event with a property.

**Request Body:**

```json
{
  "property_id": "uuid",
  "event_type": "detail_view",
  "metadata": {
    "source": "map_view",
    "zoom_level": 12
  }
}
```

**Event Types:**
- `search_impression` - Property appeared in search results
- `map_click` - User clicked property marker on map
- `detail_view` - User viewed full property details
- `analysis_run` - User ran analysis on property
- `saved` - User saved/bookmarked property
- `shared` - User shared property link

**Auto-Captured Fields:**
- `user_id` - From authentication token
- `timestamp` - Server time
- `session_id` - From session or X-Session-ID header
- `referrer` - From HTTP referrer header

**Response:**

```json
{
  "success": true,
  "event_id": 12345,
  "property_id": "uuid",
  "event_type": "detail_view",
  "timestamp": "2025-02-18T10:30:00Z"
}
```

---

### 2. Track Batch Events

**POST** `/api/events/track-batch`

Track multiple events in bulk for better performance.

**Request Body:**

```json
{
  "events": [
    {
      "property_id": "uuid-1",
      "event_type": "search_impression"
    },
    {
      "property_id": "uuid-2",
      "event_type": "map_click",
      "metadata": { "source": "search_results" }
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "events_tracked": 2,
  "message": "Successfully tracked 2 events"
}
```

---

### 3. Get Daily Aggregations

**GET** `/api/events/daily/:propertyId`

Retrieve daily engagement metrics for a property.

**Query Parameters:**
- `days` (optional) - Number of days to retrieve (default: 30)

**Response:**

```json
{
  "property_id": "uuid",
  "period_days": 30,
  "daily_stats": [
    {
      "date": "2025-02-18",
      "views": 45,
      "saves": 8,
      "shares": 3,
      "analysis_runs": 2,
      "unique_users": 12,
      "trend": "up",
      "created_at": "2025-02-18T00:00:00Z"
    }
  ],
  "total_records": 30
}
```

**Trend Values:**
- `up` - Total engagement increased >10% from previous day
- `down` - Total engagement decreased >10% from previous day
- `flat` - Engagement within 10% of previous day

---

### 4. Get Digital Traffic Score

**GET** `/api/events/score/:propertyId`

Get comprehensive digital traffic score for a property (cached 1 hour).

**Response:**

```json
{
  "property_id": "uuid",
  "score": 78,
  "breakdown": {
    "weekly_views": 145,
    "weekly_saves": 23,
    "trending_velocity": 45.5,
    "unique_users_7d": 18
  },
  "trending": true,
  "institutional_interest": true,
  "calculated_at": "2025-02-18T10:00:00Z"
}
```

**Score Breakdown (0-100):**
- **Views (40 points):** Weekly views normalized
- **Engagement (30 points):** Saves (weighted 2x) + shares
- **Analysis Runs (20 points):** Deep engagement indicator
- **Velocity (10 points):** Week-over-week growth bonus

**Institutional Interest Detection:**
- 5+ unique users viewing in last 7 days
- OR 3+ analysis runs from different users

---

### 5. Get Trending Properties

**GET** `/api/events/trending`

Get top trending properties ranked by velocity (week-over-week growth).

**Query Parameters:**
- `submarket` (optional) - Filter by submarket
- `property_type` (optional) - Filter by property type
- `limit` (optional) - Number of results (default: 10)

**Response:**

```json
{
  "trending_properties": [
    {
      "property_id": "uuid",
      "score": 85,
      "velocity": 65.5,
      "growth_percentage": 65.5,
      "weekly_views": 230,
      "weekly_saves": 45,
      "unique_users": 28,
      "institutional_interest": true,
      "property": {
        "address": "123 Main St",
        "city": "Atlanta",
        "state": "GA",
        "type": "multifamily"
      },
      "calculated_at": "2025-02-18T10:00:00Z"
    }
  ],
  "count": 10,
  "filters": {
    "submarket": null,
    "property_type": "multifamily"
  }
}
```

---

### 6. Run Daily Aggregation

**POST** `/api/events/aggregate-daily`

Aggregate yesterday's events into daily engagement table (cron job endpoint).

**Request Body (optional):**

```json
{
  "date": "2025-02-17"
}
```

If no date provided, defaults to yesterday.

**Response:**

```json
{
  "success": true,
  "date": "2025-02-17",
  "properties_updated": 247,
  "message": "Daily aggregation completed for 2025-02-17"
}
```

**Recommended Schedule:** Run daily at 00:30 UTC via cron

---

## Database Schema

### property_events

Raw event tracking table.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| property_id | UUID | Property identifier |
| user_id | UUID | User identifier |
| event_type | VARCHAR(50) | Event type (see list above) |
| timestamp | TIMESTAMP | Event timestamp |
| metadata | JSONB | Additional context data |
| session_id | VARCHAR(100) | Session identifier |
| referrer | VARCHAR(500) | HTTP referrer |

### property_engagement_daily

Daily aggregation table.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| property_id | UUID | Property identifier |
| date | DATE | Aggregation date |
| views | INT | Total views |
| saves | INT | Total saves |
| shares | INT | Total shares |
| analysis_runs | INT | Total analysis runs |
| unique_users | INT | Unique user count |
| created_at | TIMESTAMP | Record creation time |

**Unique constraint:** (property_id, date)

### digital_traffic_scores

Calculated traffic scores.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| property_id | UUID | Property identifier |
| calculated_at | TIMESTAMP | Calculation timestamp |
| score | INT | Traffic score (0-100) |
| weekly_views | INT | Views in last 7 days |
| weekly_saves | INT | Saves in last 7 days |
| trending_velocity | DECIMAL(5,2) | Week-over-week growth % |
| institutional_interest_flag | BOOLEAN | Institutional interest detected |
| unique_users_7d | INT | Unique users in last 7 days |
| created_at | TIMESTAMP | Record creation time |

---

## Integration Examples

### Frontend Integration

```typescript
// Track property view
async function trackPropertyView(propertyId: string) {
  await fetch('/api/events/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_id: propertyId,
      event_type: 'detail_view',
      metadata: { source: 'property_card' }
    })
  });
}

// Get property score
async function getPropertyScore(propertyId: string) {
  const response = await fetch(`/api/events/score/${propertyId}`);
  const data = await response.json();
  return data.score;
}

// Get trending properties
async function getTrendingProperties() {
  const response = await fetch('/api/events/trending?limit=10');
  const data = await response.json();
  return data.trending_properties;
}
```

### Cron Job Setup

Add to your cron scheduler:

```bash
# Run daily aggregation at 00:30 UTC
30 0 * * * curl -X POST http://localhost:3000/api/events/aggregate-daily
```

Or use Node.js cron:

```typescript
import cron from 'node-cron';

// Run daily at 00:30 UTC
cron.schedule('30 0 * * *', async () => {
  console.log('Running daily event aggregation...');
  const response = await fetch('http://localhost:3000/api/events/aggregate-daily', {
    method: 'POST'
  });
  const result = await response.json();
  console.log(`Aggregation complete: ${result.properties_updated} properties updated`);
});
```

---

## Error Responses

All endpoints return standard error format:

```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

**HTTP Status Codes:**
- `400` - Bad request (missing/invalid parameters)
- `404` - Resource not found
- `500` - Server error

---

## Next Steps

### Week 2-3: Advanced Features
- Velocity clustering (hot/warm/cold zones)
- User cohort analysis
- Traffic heatmaps
- Predictive scoring

### Week 4-5: Real-time Streaming
- WebSocket event streams
- Live traffic dashboards
- Instant notifications

### Week 6-8: ML Integration
- Anomaly detection
- Churn prediction
- Lead scoring models

---

## Support

For issues or questions:
- Check database migration: `jedire/backend/migrations/032_digital_traffic_events.sql`
- Review service logic: `jedire/backend/src/services/digitalTrafficService.ts`
- Contact: dev@jedire.com
