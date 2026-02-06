# Market Analysis API Contract

This document defines the API contract between the frontend UI and backend analysis service.

## Base URL
`http://localhost:8000` (development)
`/api/analysis` (base path for all endpoints)

---

## Endpoints

### 1. Analyze Submarket

**POST** `/api/analysis/submarket`

Analyzes a submarket and returns imbalance verdict, score, and recommendations.

#### Request Body
```json
{
  "submarketName": "Buckhead",
  "population": 50000,
  "existingUnits": 20000
}
```

#### Request Schema
```typescript
{
  submarketName: string;    // Required: Name of the submarket
  population: number;        // Required: Current population (positive integer)
  existingUnits: number;     // Required: Number of existing housing units (positive integer)
}
```

#### Response (200 OK)
```json
{
  "verdict": "STRONG_OPPORTUNITY",
  "score": 87,
  "confidence": "high",
  "keyFactors": [
    {
      "factor": "Population Growth Rate",
      "impact": "positive",
      "description": "15% annual growth significantly exceeds housing supply increase of 3%"
    },
    {
      "factor": "Demand-Supply Ratio",
      "impact": "positive",
      "description": "Only 0.4 units per capita, well below healthy threshold of 0.45"
    }
  ],
  "recommendation": "This submarket presents a STRONG opportunity for development...",
  "submarketName": "Buckhead",
  "analysisDate": "2024-02-04T23:00:00Z"
}
```

#### Response Schema
```typescript
{
  verdict: "STRONG_OPPORTUNITY" | "OPPORTUNITY" | "NEUTRAL" | "CAUTION" | "AVOID";
  score: number;                    // 0-100
  confidence: "high" | "medium" | "low";
  keyFactors: Array<{
    factor: string;                 // Name of the factor
    impact: "positive" | "negative" | "neutral";
    description: string;            // Detailed explanation
  }>;
  recommendation: string;           // Text summary and recommendation
  submarketName: string;            // Echo back the input
  analysisDate: string;             // ISO 8601 timestamp
}
```

#### Error Responses

**400 Bad Request**
```json
{
  "error": "Validation error",
  "message": "Population must be a positive number",
  "code": "INVALID_INPUT"
}
```

**404 Not Found**
```json
{
  "error": "Submarket not found",
  "message": "Unable to find data for submarket 'XYZ'",
  "code": "SUBMARKET_NOT_FOUND"
}
```

**500 Internal Server Error**
```json
{
  "error": "Analysis failed",
  "message": "Internal error during analysis calculation",
  "code": "ANALYSIS_ERROR"
}
```

---

### 2. Get Analysis History (Future)

**GET** `/api/analysis/history?limit=10`

Returns list of recent analyses.

#### Query Parameters
- `limit` (optional): Number of results to return (default: 10, max: 100)

#### Response (200 OK)
```json
[
  {
    "verdict": "STRONG_OPPORTUNITY",
    "score": 87,
    "confidence": "high",
    "submarketName": "Buckhead",
    "analysisDate": "2024-02-04T23:00:00Z"
  }
]
```

---

### 3. Get Analysis by ID (Future)

**GET** `/api/analysis/{id}`

Retrieves a specific analysis by ID.

#### Response (200 OK)
Same structure as POST `/api/analysis/submarket`

---

## Verdict Calculation Logic

The backend should determine verdict based on score:
- **STRONG_OPPORTUNITY**: score >= 80
- **OPPORTUNITY**: score >= 60 && score < 80
- **NEUTRAL**: score >= 40 && score < 60
- **CAUTION**: score >= 25 && score < 40
- **AVOID**: score < 25

## Score Calculation (Suggested)

The score (0-100) should be calculated based on:
1. **Units per capita ratio**: Compare existing units to population
   - Below 0.40: High score (undersupply)
   - 0.40-0.45: Medium score (balanced)
   - Above 0.45: Low score (oversupply)

2. **Growth rate**: Consider population growth trends
3. **Economic indicators**: Job growth, income levels, etc.
4. **Pipeline analysis**: Competing developments

## Confidence Level Logic

- **high**: Strong data quality, clear signals
- **medium**: Some data uncertainty or mixed signals
- **low**: Limited data or conflicting indicators

## Key Factors Guidelines

- Include 3-6 factors
- Mix of positive, negative, and neutral impacts
- Clear, actionable descriptions
- Prioritize most impactful factors first

## Recommendation Text

Should include:
- Clear verdict summary
- Reasoning based on key factors
- Specific actionable advice
- Risk considerations
- Timing recommendations if relevant

---

## Testing

Mock data available in: `jedire/frontend/src/services/mockAnalysisData.ts`

To test frontend without backend:
```typescript
// In analysisApi.ts, temporarily replace:
const { data } = await api.post('/api/analysis/submarket', input);
// With:
import { getRandomMockAnalysis } from './mockAnalysisData';
const data = getRandomMockAnalysis();
```

---

## Notes for Backend Implementation

1. **Authentication**: May need to add JWT token validation (frontend includes auth token in headers)
2. **Rate Limiting**: Consider implementing rate limits per user
3. **Caching**: Cache analysis results for identical inputs to reduce computation
4. **Logging**: Log all analysis requests for audit trail
5. **Data Sources**: Document what data sources feed the analysis (Census, MLS, etc.)
6. **Async Processing**: For complex analyses, consider async processing with webhook/polling

---

## Frontend Integration

The frontend is ready at `/analysis` route:
- Form inputs: submarket name, population, existing units
- Handles loading states
- Displays errors from API
- Color-codes verdicts automatically
- Responsive on mobile and desktop

Frontend expects API at `http://localhost:8000` (configurable via `VITE_API_URL` env var).
