# Handoff to DeepSeek - Backend API Implementation

**Date:** February 2, 2026  
**Project:** JediRe - Real Estate Intelligence Platform  
**Phase:** Backend API Infrastructure  
**Estimated Time:** 2-3 days

---

## Your Mission

Build the complete backend API infrastructure for JediRe's user preferences and email automation system.

**What's already done (by Claude):**
- ✅ Database schemas (all migrations written)
- ✅ Service layer design (architecture documented)
- ✅ Complete specifications
- ✅ Workflow documentation

**What you need to build:**
- API endpoint routes
- Service implementations
- Database integration
- Authentication middleware
- Error handling
- Testing infrastructure

---

## Repository Context

**Location:** `/home/leon/clawd/jedire/`

**Key directories:**
```
jedire/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   └── routes/        # ← You'll create new files here
│   │   ├── services/          # ← Implement these
│   │   ├── middleware/        # ← Add auth middleware
│   │   ├── database/          # ← Connection already setup
│   │   └── index.ts           # ← Add new routes here
│   └── package.json
├── migrations/                 # ← All schemas are here
│   ├── 015_user_preferences.sql
│   └── 016_collaboration_proposals.sql
└── frontend/
```

---

## Tech Stack

**Backend:**
- Node.js + TypeScript
- Express.js
- PostgreSQL (via `pg` library)
- JWT for authentication

**Already installed:**
```json
{
  "express": "^4.18.0",
  "pg": "^8.11.0",
  "jsonwebtoken": "^9.0.0",
  "bcrypt": "^5.1.0",
  "axios": "^1.6.0"
}
```

---

## Task 1: API Endpoints - User Preferences

### File to create: `backend/src/api/routes/preferences.routes.ts`

**Endpoints:**

```typescript
POST   /api/preferences              # Create/update user preferences
GET    /api/preferences              # Get user preferences
DELETE /api/preferences              # Clear preferences
```

### POST /api/preferences

**Request body:**
```typescript
{
  property_types: string[];           // ['multifamily', 'land', 'ALF']
  min_units?: number;                 // 200
  max_units?: number;                 // null
  min_year_built?: number;            // 1990
  markets?: string[];                 // ['Atlanta', 'Miami']
  states: string[];                   // ['GA', 'FL', 'NC', 'TX']
  cities?: string[];                  // ['Atlanta', 'Charlotte']
  zip_codes?: string[];               // []
  min_price?: number;                 // 5000000
  max_price?: number;                 // 50000000
  min_sqft?: number;
  max_sqft?: number;
  min_cap_rate?: number;
  max_cap_rate?: number;
  min_occupancy?: number;
  conditions?: string[];              // ['excellent', 'good', 'value-add']
  deal_types?: string[];              // ['acquisition', 'joint-venture']
  auto_create_on_match: boolean;      // true
  notify_on_mismatch: boolean;        // false
  confidence_threshold: number;       // 0.80
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    id: "uuid",
    user_id: "uuid",
    property_types: [...],
    // ... all fields
    created_at: "timestamp",
    updated_at: "timestamp"
  }
}
```

**Database:**
- Table: `user_acquisition_preferences`
- Use `INSERT ... ON CONFLICT (user_id) DO UPDATE` for upsert
- Validate required fields: `property_types`, `states`, `auto_create_on_match`

### GET /api/preferences

**Response:**
```typescript
{
  success: true,
  data: {
    // Full preferences object or null if not set
  }
}
```

**Database:**
```sql
SELECT * FROM user_acquisition_preferences 
WHERE user_id = $1 AND is_active = true
LIMIT 1
```

---

## Task 2: API Endpoints - Property Extraction Queue

### File to create: `backend/src/api/routes/extractions.routes.ts`

**Endpoints:**

```typescript
GET    /api/extractions/pending        # Get pending property reviews
POST   /api/extractions/:id/approve    # Approve and create pin
POST   /api/extractions/:id/reject     # Reject property
POST   /api/extractions/:id/skip       # Skip for later
POST   /api/extractions/bulk-approve   # Approve multiple
POST   /api/extractions/bulk-reject    # Reject multiple
```

### GET /api/extractions/pending

**Query params:**
- `status` (optional): 'requires-review' (default), 'all'
- `limit` (optional): number, default 50

**Response:**
```typescript
{
  success: true,
  data: [
    {
      id: "uuid",
      email_subject: "Great deal in Atlanta",
      email_from: "broker@email.com",
      extracted_data: {
        address: "1234 Peachtree St",
        city: "Atlanta",
        state: "GA",
        propertyType: "multifamily",
        units: 250,
        price: 12000000,
        // ...
      },
      extraction_confidence: 0.92,
      preference_match_score: 0.85,
      preference_match_reasons: [
        { criterion: "property_type", matched: true, weight: 15, details: "..." },
        // ...
      ],
      created_at: "timestamp"
    },
    // ...
  ],
  count: 5
}
```

**Database:**
```sql
SELECT * FROM property_extraction_queue
WHERE user_id = $1 AND status = 'requires-review'
ORDER BY created_at DESC
LIMIT $2
```

### POST /api/extractions/:id/approve

**Request body:**
```typescript
{
  map_id: "uuid",                    // Which map to add to
  pipeline_stage_id?: "uuid",        // Optional: specific stage, default to first
  notes?: string                     // Optional notes
}
```

**Logic:**
1. Get extraction from queue
2. Geocode address (using Mapbox)
3. Create pin on map
4. Create deal silo
5. Update extraction status to 'auto-created'
6. Return created pin

**Response:**
```typescript
{
  success: true,
  data: {
    pin_id: "uuid",
    map_id: "uuid",
    message: "Property added to map"
  }
}
```

**Use existing service:** 
- `processQueuedExtraction()` from `email-property-automation.service.ts`

### POST /api/extractions/:id/reject

**Request body:**
```typescript
{
  reason?: string  // Optional: "Not in my market", "Price too high", etc.
}
```

**Logic:**
1. Update status to 'rejected'
2. Store rejection reason

**Database:**
```sql
UPDATE property_extraction_queue
SET status = 'rejected',
    reviewed_by = $1,
    reviewed_at = now(),
    decision_reason = $2
WHERE id = $3 AND user_id = $1
```

---

## Task 3: API Endpoints - Collaboration Proposals

### File to create: `backend/src/api/routes/proposals.routes.ts`

**Endpoints:**

```typescript
POST   /api/proposals                      # Create proposal
GET    /api/proposals/pending              # Get proposals for review (owner)
GET    /api/proposals/my                   # Get my submitted proposals
POST   /api/proposals/:id/accept           # Accept proposal
POST   /api/proposals/:id/reject           # Reject proposal
POST   /api/proposals/:id/comment          # Add comment
GET    /api/proposals/:id/comments         # Get comments
```

### POST /api/proposals

**Request body:**
```typescript
{
  map_id: "uuid",
  proposal_title?: string,
  proposal_description?: string,
  changes: [
    {
      type: "add_pin",
      data: { 
        property_name: "...",
        address: "...",
        coordinates: { lat: number, lng: number },
        // ... pin data
      }
    },
    {
      type: "update_pin",
      pin_id: "uuid",
      changes: { pipeline_stage_id: "uuid", asking_price: number }
    },
    {
      type: "delete_pin",
      pin_id: "uuid"
    }
  ]
}
```

**Logic:**
1. Verify user has access to map (collaborator)
2. Insert proposal with status 'pending'
3. Trigger notification to map owner

**Database:**
```sql
INSERT INTO map_change_proposals (
  map_id,
  proposed_by,
  proposal_title,
  proposal_description,
  changes,
  status
) VALUES ($1, $2, $3, $4, $5, 'pending')
RETURNING id
```

### POST /api/proposals/:id/accept

**Logic:**
1. Verify user is map owner
2. Update proposal status to 'accepted'
3. Call `apply_proposal_changes(proposal_id)` function
4. Notify proposer

**Database:**
```sql
UPDATE map_change_proposals
SET status = 'accepted',
    reviewed_by = $1,
    reviewed_at = now()
WHERE id = $2

SELECT apply_proposal_changes($2)
```

---

## Task 4: API Endpoints - Maps & Pins

### File to create: `backend/src/api/routes/maps.routes.ts`

**Endpoints:**

```typescript
GET    /api/maps                    # List user's maps
POST   /api/maps                    # Create new map
GET    /api/maps/:id                # Get map details
PUT    /api/maps/:id                # Update map
DELETE /api/maps/:id                # Delete map
GET    /api/maps/:id/pins           # Get all pins for map
POST   /api/maps/:id/pins           # Create pin manually
PUT    /api/maps/:id/pins/:pin_id   # Update pin
DELETE /api/maps/:id/pins/:pin_id   # Delete pin
```

### GET /api/maps

**Response:**
```typescript
{
  success: true,
  data: [
    {
      id: "uuid",
      name: "Leon's Deals",
      map_type: "acquisition",
      owner_id: "uuid",
      collaborators_count: 2,
      pins_count: 15,
      created_at: "timestamp",
      updated_at: "timestamp"
    },
    // ...
  ]
}
```

### GET /api/maps/:id/pins

**Query params:**
- `pipeline_stage_id` (optional): filter by stage
- `property_type` (optional): filter by type

**Response:**
```typescript
{
  success: true,
  data: [
    {
      id: "uuid",
      map_id: "uuid",
      pin_type: "property",
      property_name: "1234 Peachtree St",
      address: "Atlanta, GA 30309",
      coordinates: { lat: 33.779, lng: -84.3847 },
      pipeline_stage_id: "uuid",
      pipeline_stage_name: "Lead",
      property_data: { /* extracted data */ },
      created_at: "timestamp",
      updated_at: "timestamp"
    },
    // ...
  ]
}
```

---

## Task 5: API Endpoints - Notifications

### File to create: `backend/src/api/routes/notifications.routes.ts`

**Endpoints:**

```typescript
GET    /api/notifications           # Get user notifications
POST   /api/notifications/:id/read  # Mark as read
POST   /api/notifications/read-all  # Mark all as read
```

### GET /api/notifications

**Query params:**
- `unread_only` (optional): boolean, default false
- `limit` (optional): number, default 50

**Response:**
```typescript
{
  success: true,
  data: [
    {
      id: "uuid",
      user_id: "uuid",
      type: "property_auto_created",
      title: "Property auto-added",
      message: "1234 Peachtree St has been added to Leon's Deals",
      data: { pin_id: "uuid", map_id: "uuid" },
      is_read: false,
      created_at: "timestamp"
    },
    // ...
  ],
  unread_count: 5
}
```

---

## Task 6: Service Implementations

### File to implement: `backend/src/services/preference-matching.service.ts`

**Already designed, you need to implement:**

This file exists with full TypeScript signatures. Implement the actual logic:

1. `getUserPreferences(userId)` - Query database
2. `matchPropertyToPreferences(property, preferences)` - Implement matching algorithm
3. `queuePropertyExtraction(...)` - Insert to queue
4. `getPendingReviews(userId)` - Query pending
5. `reviewPropertyExtraction(...)` - Update status

**Reference:** The matching algorithm is documented in the service file comments.

### File to implement: `backend/src/services/email-property-automation.service.ts`

**Already designed, implement:**

1. `processEmailForProperty(email, userId)` - Full workflow
2. `createPropertyPin(...)` - Create pin + deal silo
3. `processQueuedExtraction(...)` - Manual approval handler

---

## Task 7: Authentication Middleware

### File to create: `backend/src/middleware/auth.middleware.ts`

**Required middleware:**

```typescript
export const requireAuth = async (req, res, next) => {
  // Extract JWT from Authorization header
  // Verify token
  // Set req.user = decoded user
  // Set PostgreSQL session variable: SET app.user_id = '...'
  // next()
}

export const requireMapOwner = async (req, res, next) => {
  // Check if req.user is owner of map in req.params.id
  // next() or 403
}

export const requireMapAccess = async (req, res, next) => {
  // Check if req.user is owner OR collaborator of map
  // next() or 403
}
```

**Apply to routes:**
- All `/api/preferences/*` → requireAuth
- All `/api/extractions/*` → requireAuth
- All `/api/maps/*` → requireAuth
- `/api/maps/:id/*` (write ops) → requireMapAccess

---

## Task 8: Error Handling

### File to create: `backend/src/middleware/error.middleware.ts`

**Global error handler:**

```typescript
export const errorHandler = (err, req, res, next) => {
  logger.error('API Error:', err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.details
    });
  }
  
  // Default 500
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};
```

**Use in index.ts:**
```typescript
app.use(errorHandler);
```

---

## Task 9: Database Connection

### Update: `backend/src/database/connection.ts`

**Ensure connection pooling:**

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const query = async (text: string, params?: any[]) => {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
};
```

---

## Task 10: Testing

### Create test files:

```
backend/src/api/routes/__tests__/
├── preferences.routes.test.ts
├── extractions.routes.test.ts
├── proposals.routes.test.ts
└── maps.routes.test.ts
```

**Test framework:** Jest (already in package.json)

**What to test:**
- Each endpoint with valid input
- Each endpoint with invalid input
- Authentication failures
- Database errors
- Edge cases (empty results, null values)

**Example test:**
```typescript
describe('POST /api/preferences', () => {
  it('should create user preferences', async () => {
    const response = await request(app)
      .post('/api/preferences')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        property_types: ['multifamily'],
        states: ['GA'],
        auto_create_on_match: true,
        confidence_threshold: 0.80
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
  });
});
```

---

## Task 11: Integration with Main App

### Update: `backend/src/index.ts`

**Add your new routes:**

```typescript
import preferencesRoutes from './api/routes/preferences.routes';
import extractionsRoutes from './api/routes/extractions.routes';
import proposalsRoutes from './api/routes/proposals.routes';
import mapsRoutes from './api/routes/maps.routes';
import notificationsRoutes from './api/routes/notifications.routes';

app.use('/api/preferences', preferencesRoutes);
app.use('/api/extractions', extractionsRoutes);
app.use('/api/proposals', proposalsRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/notifications', notificationsRoutes);
```

---

## Environment Variables Needed

### `.env` file:

```
DATABASE_URL=postgresql://user:pass@host:5432/jedire
JWT_SECRET=your-secret-key
MAPBOX_TOKEN=your-mapbox-token
ANTHROPIC_API_KEY=your-claude-key
PORT=4000
```

---

## Database Migrations

**Run these before testing:**

```bash
cd /home/leon/clawd/jedire
psql $DATABASE_URL -f migrations/015_user_preferences.sql
psql $DATABASE_URL -f migrations/016_collaboration_proposals.sql
```

Or use migration runner if you have one.

---

## Success Criteria

### You're done when:

- ✅ All 12+ API endpoints working
- ✅ Services implemented with matching logic
- ✅ Authentication middleware applied
- ✅ Error handling consistent
- ✅ Tests written and passing
- ✅ API documentation (can use Swagger/OpenAPI)
- ✅ Postman collection (optional but helpful)

---

## Testing Your Work

### Manual testing with curl:

```bash
# Create preferences
curl -X POST http://localhost:4000/api/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "property_types": ["multifamily"],
    "states": ["GA", "FL"],
    "min_units": 200,
    "auto_create_on_match": true,
    "confidence_threshold": 0.80
  }'

# Get pending extractions
curl http://localhost:4000/api/extractions/pending \
  -H "Authorization: Bearer $TOKEN"

# Approve extraction
curl -X POST http://localhost:4000/api/extractions/{id}/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "map_id": "uuid" }'
```

---

## Documentation to Reference

**In this repo:**
- `/migrations/015_user_preferences.sql` - Full schema
- `/migrations/016_collaboration_proposals.sql` - Collaboration schema
- `/backend/src/services/preference-matching.service.ts` - Service design
- `/AI_WORKFLOW_STRATEGY.md` - Overall strategy
- `/WORKFLOW_AUTO_CREATE.md` - Full workflow example

---

## Questions/Blockers

**If you encounter issues:**

1. Check migration files for exact table/column names
2. Review service design files for function signatures
3. Existing database connection code in `backend/src/database/`
4. Logger is available: `import { logger } from '../utils/logger'`

---

## When Complete

**Commit your work:**
```bash
git add backend/src/api/routes/
git add backend/src/services/
git add backend/src/middleware/
git commit -m "[DeepSeek] Implement backend API infrastructure

- Created 5 route files (preferences, extractions, proposals, maps, notifications)
- Implemented service layer (preference matching, email automation)
- Added authentication middleware
- Error handling
- Testing infrastructure

All endpoints functional and tested."

git push origin master
```

**Update Leon and Claude:**
- List what you built
- Any design decisions you made
- Any blockers encountered
- Ready for frontend integration

---

## Time Estimate

- **Day 1:** Routes + basic endpoints (6-8 hours)
- **Day 2:** Service implementations + auth (6-8 hours)
- **Day 3:** Testing + polish (4-6 hours)

**Total:** 2-3 days

---

**Good luck! Build something awesome.** 🚀

**Questions?** Tag Leon or Claude in your commit messages if you need clarification.
