# Email Extractions API

## Overview

API endpoints for viewing and managing property/news extractions from emails.

Base URL: `/api/v1/email-extractions`

## Authentication

All endpoints require Bearer token authentication:
```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### Get Email Extractions

Get all extractions (property + news) for a specific email.

**Endpoint:** `GET /api/v1/email-extractions/:emailId`

**Parameters:**
- `emailId` (path) - Email ID

**Response:**
```json
{
  "success": true,
  "data": {
    "emailId": "uuid",
    "classification": {
      "classification": "property",
      "confidence": 0.85,
      "reasons": ["Property listing detected"],
      "containsProperty": true,
      "containsNews": false
    },
    "propertyExtractions": [
      {
        "id": "uuid",
        "email_id": "uuid",
        "extracted_data": {
          "address": "123 Main St",
          "city": "Atlanta",
          "state": "GA",
          "price": 25000000,
          "propertyType": "multifamily",
          "units": 200
        },
        "status": "requires-review",
        "preference_match_score": 0.78,
        "created_at": "2025-02-02T10:00:00Z",
        "pin_id": null
      }
    ],
    "newsExtraction": null
  }
}
```

---

### List Property Extractions

List all property extractions for the current user.

**Endpoint:** `GET /api/v1/email-extractions/list/properties`

**Query Parameters:**
- `status` (optional) - Filter by status: `pending`, `auto-created`, `requires-review`, `rejected`
- `limit` (optional, default: 50) - Number of results
- `offset` (optional, default: 0) - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "extractions": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "email_id": "uuid",
        "email_subject": "Off-Market Deal: 200-Unit Property",
        "email_from": "broker@cbre.com",
        "email_received_at": "2025-02-02T09:00:00Z",
        "extracted_data": { /* property details */ },
        "extraction_confidence": 0.85,
        "preference_match_score": 0.78,
        "status": "requires-review",
        "created_pin_id": null,
        "created_at": "2025-02-02T10:00:00Z"
      }
    ],
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

---

### List News Extractions

List all news items extracted from emails.

**Endpoint:** `GET /api/v1/email-extractions/list/news`

**Query Parameters:**
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "newsItems": [
      {
        "id": "uuid",
        "title": "Amazon Announces 5,000-Job Expansion",
        "summary": "Amazon will invest $500M...",
        "category": "employment",
        "impact_score": 85,
        "sentiment_score": 0.8,
        "published_date": "2025-02-02T08:00:00Z",
        "market_name": "Atlanta Metro",
        "market_city": "Atlanta",
        "market_state": "GA"
      }
    ],
    "total": 12,
    "limit": 50,
    "offset": 0
  }
}
```

---

### Approve Property Extraction

Approve a property extraction and create a map pin.

**Endpoint:** `POST /api/v1/email-extractions/properties/:extractionId/approve`

**Parameters:**
- `extractionId` (path) - Extraction ID

**Response:**
```json
{
  "success": true,
  "data": {
    "pinId": "uuid",
    "message": "Property pin created successfully"
  }
}
```

**Errors:**
- `404` - Extraction not found
- `400` - Failed to geocode address / create pin

---

### Reject Property Extraction

Reject a property extraction (not interested).

**Endpoint:** `POST /api/v1/email-extractions/properties/:extractionId/reject`

**Parameters:**
- `extractionId` (path) - Extraction ID

**Body:**
```json
{
  "reason": "Not interested in this deal"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Extraction rejected"
}
```

---

### Delete Property Extraction

Delete a property extraction (false positive).

**Endpoint:** `DELETE /api/v1/email-extractions/properties/:extractionId`

**Parameters:**
- `extractionId` (path) - Extraction ID

**Response:**
```json
{
  "success": true,
  "message": "Extraction deleted"
}
```

---

### Delete News Extraction

Delete a news extraction (false positive).

**Endpoint:** `DELETE /api/v1/email-extractions/news/:newsItemId`

**Parameters:**
- `newsItemId` (path) - News item ID

**Response:**
```json
{
  "success": true,
  "message": "News item deleted"
}
```

**Errors:**
- `404` - News item not found or not owned by user

---

### Get Extraction Statistics

Get extraction statistics for the current user.

**Endpoint:** `GET /api/v1/email-extractions/stats/summary`

**Response:**
```json
{
  "success": true,
  "data": {
    "properties": {
      "total": 127,
      "auto_created": 45,
      "pending_review": 12,
      "rejected": 8,
      "avg_match_score": 0.72
    },
    "news": {
      "total": 34
    },
    "recentActivity": [
      {
        "date": "2025-02-02",
        "count": 8
      },
      {
        "date": "2025-02-01",
        "count": 12
      }
    ]
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (not owner of resource)
- `404` - Not found
- `400` - Bad request (invalid input)
- `500` - Internal server error

---

## Workflow Examples

### Review Pending Extractions

1. Get pending extractions:
```bash
GET /api/v1/email-extractions/list/properties?status=requires-review
```

2. Review each extraction:
```bash
GET /api/v1/email-extractions/:emailId
```

3. Approve or reject:
```bash
# Approve
POST /api/v1/email-extractions/properties/:extractionId/approve

# Or reject
POST /api/v1/email-extractions/properties/:extractionId/reject
```

### View Extraction in Inbox

1. Load inbox with emails
2. For each email, check extractions:
```bash
GET /api/v1/email-extractions/:emailId
```
3. Display badges based on response
4. Provide approve/reject buttons for `requires-review` status

---

## Rate Limits

- Standard: 100 requests/minute per user
- Bulk operations: 10 requests/minute

---

## Changelog

**v1.0.0** (2025-02-02)
- Initial release
- Property extraction endpoints
- News extraction endpoints
- Statistics endpoint

---

## Support

For questions or issues, contact the JEDI RE development team.
