# JEDI RE - API Reference

**Version:** 1.0.0  
**Base URL:** `https://api.jedire.com` or `http://localhost:3000`  
**Last Updated:** 2026-02-05

---

## 📡 Overview

JEDI RE provides a RESTful API for real estate market analysis powered by advanced signal processing and machine learning engines.

**Key Features:**
- 3 analysis engines (Signal Processing, Carrying Capacity, Imbalance Detector)
- Real-time + historical data (26 years)
- JWT authentication
- Rate limiting (100 req/min)
- JSON responses

---

## 🔐 Authentication

Most endpoints require authentication via JWT tokens.

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh-token-here",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Using Tokens

Include in request headers:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📊 Core Endpoints

### Health Check

```http
GET /health
```

Check API health and uptime.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T15:30:00Z",
  "uptime": 3600.5,
  "environment": "production"
}
```

**Status Codes:**
- `200` - Healthy
- `503` - Service unavailable

---

### API Version

```http
GET /api/v1
```

Get API version information.

**Response:**
```json
{
  "version": "v1",
  "engines": ["signal_processing", "carrying_capacity", "imbalance_detector"],
  "data_sources": ["costar", "apartmentiq", "census"]
}
```

---

## 🏗️ Capacity Analysis

### Analyze Development Capacity

```http
POST /api/v1/pipeline/analyze
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "parcel_id": "FULTON-12345",
  "current_zoning": "MRC-2",
  "lot_size_sqft": 87120,
  "current_units": 0
}
```

**Parameters:**
- `parcel_id` (string) - Unique parcel identifier
- `current_zoning` (string) - Zoning code (e.g., MRC-2, R-4)
- `lot_size_sqft` (number) - Lot size in square feet
- `current_units` (number) - Existing unit count

**Response:**
```json
{
  "parcel_id": "FULTON-12345",
  "potential_units": 120,
  "current_units": 0,
  "additional_capacity": 120,
  "development_cost": 52270000,
  "cost_per_unit": 435583,
  "development_potential": "VERY_HIGH",
  "confidence": 0.99,
  "zoning_details": {
    "code": "MRC-2",
    "max_density": 60,
    "height_limit_ft": 150
  },
  "analyzed_at": "2026-02-05T15:30:00Z"
}
```

**Development Potential Values:**
- `VERY_HIGH` - Excellent opportunity (>100 units)
- `HIGH` - Strong opportunity (50-100 units)
- `MEDIUM` - Moderate opportunity (20-50 units)
- `LOW` - Limited opportunity (10-20 units)
- `VERY_LOW` - Minimal opportunity (<10 units)

**Status Codes:**
- `200` - Success
- `400` - Invalid request
- `401` - Unauthorized
- `422` - Validation error

---

## 📈 Signal Processing

### Analyze Market Signal

```http
POST /api/v1/analysis/market-signal
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "submarket_id": "atlanta-ga-midtown"
}
```

**Parameters:**
- `submarket_id` (string) - Submarket identifier

**Response:**
```json
{
  "rent_growth_rate": 0.0609,
  "confidence": 0.925,
  "current_rent": 1982,
  "trend_component": 1975.32,
  "seasonal_component": 6.68,
  "noise_level": 12.5,
  "data_points": 312,
  "time_span_years": 6.0,
  "processed_at": "2026-02-05T15:30:00Z"
}
```

**Fields:**
- `rent_growth_rate` - Annualized growth rate (e.g., 0.0609 = 6.09%)
- `confidence` - Signal quality (0-1)
- `current_rent` - Latest average rent ($)
- `trend_component` - Underlying trend value
- `seasonal_component` - Current seasonal adjustment
- `noise_level` - Historical volatility ($)

---

## ⚖️ Imbalance Detection

### Detect Market Imbalance

```http
POST /api/v1/analysis/imbalance
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "submarket_id": "atlanta-ga-midtown"
}
```

**Response:**
```json
{
  "imbalance_score": 73,
  "verdict": "STRONG_OPPORTUNITY",
  "vacancy_signal": 20.3,
  "concession_signal": 17.0,
  "opportunity_signal": 18.0,
  "rent_growth_signal": 15.2,
  "recommended_action": "High negotiation potential - expect significant concessions",
  "key_drivers": [
    "High vacancy (20.3%)",
    "Widespread concessions (68.0%)",
    "Strong opportunity score (7.2/10)"
  ],
  "confidence": 0.92,
  "analyzed_at": "2026-02-05T15:30:00Z"
}
```

**Verdict Values:**
- `STRONG_OPPORTUNITY` - Score 70-100 (buyer's market)
- `MODERATE_OPPORTUNITY` - Score 50-69 (slight buyer advantage)
- `BALANCED` - Score 30-49 (normal conditions)
- `TIGHT_MARKET` - Score 0-29 (seller's market)

---

## 🗺️ Submarkets

### List Submarkets

```http
GET /api/v1/submarkets?city=Atlanta&state=GA
Authorization: Bearer TOKEN
```

**Parameters:**
- `city` (string, optional) - Filter by city
- `state` (string, optional) - Filter by state

**Response:**
```json
{
  "submarkets": [
    {
      "id": "atlanta-ga-midtown",
      "name": "Midtown",
      "city": "Atlanta",
      "state": "GA",
      "center_lat": 33.7844,
      "center_lng": -84.3858,
      "properties_count": 45,
      "total_units": 12543,
      "avg_rent": 1982,
      "vacancy_rate": 0.203
    }
  ],
  "total": 10
}
```

---

### Get Submarket Details

```http
GET /api/v1/submarkets/{submarket_id}
Authorization: Bearer TOKEN
```

**Response:**
```json
{
  "id": "atlanta-ga-midtown",
  "name": "Midtown",
  "city": "Atlanta",
  "state": "GA",
  "center_lat": 33.7844,
  "center_lng": -84.3858,
  "zip_codes": ["30308", "30309"],
  "market_stats": {
    "total_units": 12543,
    "avg_rent": 1982,
    "vacancy_rate": 0.203,
    "avg_rent_growth_3yr": 0.045
  },
  "demographics": {
    "population": 25000,
    "median_age": 32,
    "median_income": 85000,
    "college_educated_pct": 0.78
  }
}
```

---

## 🔔 Alerts

### Create Alert

```http
POST /api/v1/alerts
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "submarket_id": "atlanta-ga-midtown",
  "alert_type": "imbalance_change",
  "threshold_value": 70,
  "condition": "above",
  "delivery_method": "email",
  "delivery_address": "user@example.com"
}
```

**Alert Types:**
- `imbalance_change` - Market opportunity score
- `rent_spike` - Rent increases
- `vacancy_high` - High vacancy (opportunity)
- `vacancy_low` - Low vacancy (tight market)
- `opportunity_score` - ApartmentIQ opportunity
- `pipeline_delivery` - New supply delivered

**Response:**
```json
{
  "id": "alert-123",
  "alert_type": "imbalance_change",
  "threshold_value": 70,
  "condition": "above",
  "is_active": true,
  "created_at": "2026-02-05T15:30:00Z"
}
```

---

### List User Alerts

```http
GET /api/v1/alerts
Authorization: Bearer TOKEN
```

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert-123",
      "submarket_id": "atlanta-ga-midtown",
      "alert_type": "imbalance_change",
      "threshold_value": 70,
      "condition": "above",
      "last_triggered": "2026-02-04T10:30:00Z",
      "trigger_count": 3,
      "is_active": true
    }
  ],
  "total": 5
}
```

---

### Delete Alert

```http
DELETE /api/v1/alerts/{alert_id}
Authorization: Bearer TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Alert deleted successfully"
}
```

---

## 🔍 Rate Limiting

**Limits:**
- 100 requests per minute (authenticated)
- 20 requests per minute (unauthenticated)

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704214800
```

**429 Response:**
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 45
}
```

---

## ❌ Error Responses

### Standard Error Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation details"
  }
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limit Exceeded
- `500` - Server Error
- `503` - Service Unavailable

---

## 📚 Examples

### Complete Analysis Workflow

```bash
# 1. Login
curl -X POST https://api.jedire.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 2. Get submarkets
curl https://api.jedire.com/api/v1/submarkets?city=Atlanta \
  -H "Authorization: Bearer TOKEN"

# 3. Analyze market signal
curl -X POST https://api.jedire.com/api/v1/analysis/market-signal \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"submarket_id":"atlanta-ga-midtown"}'

# 4. Detect imbalance
curl -X POST https://api.jedire.com/api/v1/analysis/imbalance \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"submarket_id":"atlanta-ga-midtown"}'

# 5. Create alert
curl -X POST https://api.jedire.com/api/v1/alerts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "submarket_id":"atlanta-ga-midtown",
    "alert_type":"imbalance_change",
    "threshold_value":70,
    "condition":"above",
    "delivery_method":"email",
    "delivery_address":"user@example.com"
  }'
```

---

## 🔗 SDKs & Libraries

**JavaScript/TypeScript:**
```javascript
import { JEDIREClient } from '@jedire/client';

const client = new JEDIREClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.jedire.com'
});

const analysis = await client.analyzeImbalance('atlanta-ga-midtown');
console.log(analysis.verdict);  // STRONG_OPPORTUNITY
```

**Python:**
```python
from jedire import JEDIREClient

client = JEDIREClient(api_key='your-api-key')
analysis = client.analyze_imbalance('atlanta-ga-midtown')
print(f"Score: {analysis.imbalance_score}/100")
```

---

## 📞 Support

- **Documentation:** https://docs.jedire.com
- **Issues:** https://github.com/Nardo758/JediRe/issues
- **Status:** https://status.jedire.com
- **Email:** support@jedire.com

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-05
