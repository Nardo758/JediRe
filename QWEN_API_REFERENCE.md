# Qwen AI API Reference

Complete API reference for all Qwen AI endpoints in JEDI RE.

---

## Base URL

```
http://localhost:4000/api/v1/ai
```

---

## Authentication

All endpoints require valid JWT token in `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### 1. GET /status

Check if AI service is available.

**Request:**
```http
GET /api/v1/ai/status
```

**Response:**
```json
{
  "enabled": true,
  "message": "Qwen AI service is available",
  "model": "Qwen/Qwen3.5-397B-A17B:novita"
}
```

---

### 2. POST /image-to-terrain

Convert site photo to 3D terrain data.

**Request:**
```http
POST /api/v1/ai/image-to-terrain
Content-Type: multipart/form-data

image: <file> OR imageUrl: <string>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "elevationMap": [[0, 5, 10, ...], ...],
    "slope": 15.5,
    "soilType": "clay",
    "topographyFeatures": ["hill", "irregular"],
    "gradingRequirements": {
      "cutFill": 1500,
      "estimatedCost": 45000
    },
    "confidence": 0.85
  }
}
```

---

### 3. POST /analyze-compliance

Analyze 3D design for zoning compliance.

**Request:**
```http
POST /api/v1/ai/analyze-compliance
Content-Type: application/json

{
  "design3D": {
    "totalUnits": 287,
    "stories": 8,
    "farUtilized": 4.2,
    "parkingSpaces": 315
  },
  "renderUrl": "https://example.com/render.png"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "violations": [
      {
        "type": "setback",
        "description": "North setback appears 5ft short",
        "severity": "warning",
        "recommendation": "Verify survey and adjust if needed"
      }
    ],
    "compliant": true,
    "confidence": 0.87,
    "reasoning": "Minor setback issue detected but not critical"
  }
}
```

---

### 4. POST /analyze-aerial

Analyze satellite imagery for site context.

**Request:**
```http
POST /api/v1/ai/analyze-aerial
Content-Type: application/json

{
  "coords": { "lat": 33.7490, "lng": -84.3880 },
  "satelliteUrl": "https://example.com/satellite.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "adjacentParcels": [
      {
        "parcelId": "est-123",
        "address": "127 Main St",
        "estimatedValue": 380000,
        "acquisitionPotential": 75
      }
    ],
    "infrastructure": {
      "utilities": ["water", "sewer", "electric"],
      "access": ["Main St (2-lane)", "alley access"]
    },
    "marketContext": {
      "submarket": "Midtown",
      "competitiveProjects": 3
    },
    "confidence": 0.78
  }
}
```

---

### 5. POST /owner-disposition

Predict owner's likelihood of selling.

**Request:**
```http
POST /api/v1/ai/owner-disposition
Content-Type: application/json

{
  "ownerProfile": {
    "id": "owner-456",
    "name": "Smith Family Trust",
    "properties": 8,
    "avgHoldPeriod": 12,
    "acquisitionHistory": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 72,
    "factors": {
      "holdPeriod": 80,
      "marketTiming": 65,
      "financialNeed": 60,
      "portfolioStrategy": 85
    },
    "estimatedPrice": 4200000,
    "timeframe": "3-6 months",
    "negotiationLeverage": "high",
    "confidence": 0.81,
    "reasoning": "Long hold period + trust structure suggests estate liquidation likely"
  }
}
```

---

### 6. POST /auto-tag-photos

Auto-tag construction photos to 3D locations.

**Request:**
```http
POST /api/v1/ai/auto-tag-photos
Content-Type: multipart/form-data

photos: <file[]> (max 10 files)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "photoId": "photo-1708552800-0",
      "tags": ["foundation", "excavation", "south-wing"],
      "location3D": {
        "x": 0,
        "y": 0,
        "z": 0,
        "section": "south-wing"
      },
      "confidence": 0.89
    }
  ]
}
```

---

### 7. POST /estimate-progress

Estimate construction progress from photos.

**Request:**
```http
POST /api/v1/ai/estimate-progress
Content-Type: multipart/form-data

photos: <file[]> (max 5 files)
section: "floor-3"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "section": "floor-3",
    "percentComplete": 65,
    "itemsCompleted": ["framing", "rough-in MEP", "windows"],
    "itemsRemaining": ["drywall", "finishes", "punch-list"],
    "estimatedDaysToCompletion": 45,
    "confidence": 0.82,
    "reasoning": "Framing complete, MEP rough-in visible, drywall not started"
  }
}
```

---

### 8. POST /negotiation-strategy

Generate land assemblage negotiation strategy.

**Request:**
```http
POST /api/v1/ai/negotiation-strategy
Content-Type: application/json

{
  "neighbors": [
    {
      "parcelId": "123",
      "address": "127 Main St",
      "owner": { ... },
      "assessedValue": 3800000,
      "zoning": "RM-4",
      "distanceFromSite": 0
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "approach": "sequential",
    "prioritizedTargets": [
      {
        "parcelId": "123",
        "priority": 1,
        "approachStrategy": "Direct offer emphasizing portfolio streamlining",
        "offerRange": {
          "low": 3500000,
          "mid": 3800000,
          "high": 4200000
        }
      }
    ],
    "timeline": "6-9 months",
    "risks": ["Competing developers", "Price escalation"],
    "successProbability": 0.75,
    "reasoning": "Prioritized by longest shared boundary and owner disposition"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error",
  "message": "coords and satelliteUrl are required"
}
```

### 503 Service Unavailable
```json
{
  "error": "AI service not available",
  "message": "Qwen AI is not configured. Please set HF_TOKEN environment variable."
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to analyze terrain",
  "message": "Qwen API request failed: timeout"
}
```

---

## Rate Limits

- **Default:** 100 requests per hour per user
- **Image endpoints:** 20 requests per hour (higher latency)
- **429 Response:** `{ "error": "Rate limit exceeded", "retryAfter": 3600 }`

---

## File Upload Limits

- **Max file size:** 10MB per file
- **Supported formats:** jpg, png, gif, webp
- **Max files per request:** Varies by endpoint (5-10)

---

## Best Practices

1. **Check status first:** Call `/status` before using AI features
2. **Handle failures gracefully:** Implement fallbacks for all AI calls
3. **Optimize images:** Resize to 1280x1280 max before upload
4. **Cache results:** Cache identical requests for 24 hours
5. **Debounce calls:** Avoid rapid-fire requests (500ms debounce)

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Check AI status
const status = await fetch('/api/v1/ai/status');
const { enabled } = await status.json();

// Auto-tag photos
const formData = new FormData();
formData.append('photos', photoFile);

const response = await fetch('/api/v1/ai/auto-tag-photos', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const { data } = await response.json();
```

### cURL

```bash
# Check status
curl http://localhost:4000/api/v1/ai/status

# Upload image for terrain analysis
curl -X POST http://localhost:4000/api/v1/ai/image-to-terrain \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@site-photo.jpg"
```

---

**Last Updated:** 2025-02-21
