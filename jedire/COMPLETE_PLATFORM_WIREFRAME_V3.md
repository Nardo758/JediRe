# JEDI RE - Complete Platform Wireframe v3.0

**Version:** 3.0 - With Technical Implementation Specifications  
**Created:** 2026-02-07  
**Updated:** 2026-02-07 (Added: Real-time, API, Performance, Security, Billing)  
**Status:** Complete Design + Technical Specification

---

## Updates in v3.0

**Added Sections:**
11. [Real-Time Architecture](#real-time-architecture) - WebSocket implementation
12. [API Standards](#api-standards) - OpenAPI/Swagger specifications
13. [Map Performance](#map-performance) - Clustering and optimization
14. [Security Layer](#security-layer) - Auth, encryption, validation
15. [Billing Integration](#billing-integration) - Stripe implementation
16. [Error Handling](#error-handling) - Standardized error responses

---

*[Sections 1-10 remain unchanged from v2.0 - see COMPLETE_PLATFORM_WIREFRAME.md]*

---

## 11. Real-Time Architecture

### WebSocket Implementation

**Technology:** Socket.io (or Django Channels for Python backend)

**Server Configuration:**
```javascript
// WebSocket Server Setup
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const user = await verifyJWT(token);
  if (user) {
    socket.user = user;
    next();
  } else {
    next(new Error('Authentication failed'));
  }
});
```

---

### Event Types

**Connection Events:**
```typescript
// Client → Server
'connect' - User connects
'disconnect' - User disconnects
'join_room' - Join a collaboration room
'leave_room' - Leave a room

// Server → Client
'connected' - Connection acknowledged
'user_joined' - Another user joined room
'user_left' - User left room
'presence_update' - Active users list updated
```

**Collaboration Events:**
```typescript
// Map Collaboration
'map:cursor_move' - User cursor position
'map:draw_start' - Drawing initiated
'map:draw_update' - Drawing in progress
'map:draw_complete' - Drawing finished
'map:annotation_added' - New annotation
'map:annotation_updated' - Annotation changed
'map:annotation_deleted' - Annotation removed

// Comments & Communication
'comment:added' - New comment on deal/property
'comment:updated' - Comment edited
'comment:deleted' - Comment removed
'mention:received' - User was @mentioned
'chat:message' - Team chat message

// Deal Updates
'deal:created' - New deal created
'deal:updated' - Deal data changed
'deal:stage_changed' - Pipeline stage moved
'deal:analysis_complete' - JEDI Score ready
'deal:team_updated' - Team member added/removed

// Notifications
'notification:new' - New notification
'notification:read' - Notification marked read
'alert:triggered' - System alert (rent growth, new supply, etc.)
```

---

### Room Structure

**Room Naming Convention:**
```typescript
// Format: {type}:{id}
'deal:uuid-1234' - Collaboration on specific deal
'property:uuid-5678' - Collaboration on property
'market:atlanta-ga' - Market discussion
'user:uuid-9012' - User's personal notifications
'global:announcements' - Platform-wide updates
```

**Room Management:**
```typescript
// Server-side room logic
socket.on('join_room', async ({ roomId, roomType }) => {
  // Verify user has access to this room
  const hasAccess = await checkRoomAccess(socket.user.id, roomId, roomType);
  
  if (hasAccess) {
    socket.join(roomId);
    
    // Track active users
    await redis.sadd(`room:${roomId}:users`, socket.user.id);
    
    // Notify others
    socket.to(roomId).emit('user_joined', {
      userId: socket.user.id,
      userName: socket.user.name,
      avatar: socket.user.avatar
    });
    
    // Send current room state
    const activeUsers = await redis.smembers(`room:${roomId}:users`);
    socket.emit('room_state', { activeUsers });
  }
});
```

---

### Presence Tracking

**Active Users Display:**
```
┌────────────────────────────────────┐
│ Deal: Buckhead Mixed-Use      [X] │
├────────────────────────────────────┤
│ 👤 Active Now (3)                  │
│                                    │
│ 🟢 Leon D (you)                   │
│ 🟢 John Smith (viewing map)       │
│ 🟢 Sarah J (editing financials)   │
│                                    │
│ 💬 Team members can see your       │
│    cursor and edits in real-time  │
└────────────────────────────────────┘
```

**Implementation:**
```typescript
// Track user activity
socket.on('user_activity', ({ activity, location }) => {
  socket.to(currentRoom).emit('presence_update', {
    userId: socket.user.id,
    activity, // 'viewing_map', 'editing_financials', 'idle'
    location, // module/page user is on
    timestamp: Date.now()
  });
});

// Cursor tracking (throttled to 60fps)
let lastCursorEmit = 0;
socket.on('map:cursor_move', ({ x, y }) => {
  const now = Date.now();
  if (now - lastCursorEmit > 16) { // ~60fps
    socket.to(currentRoom).emit('map:cursor_move', {
      userId: socket.user.id,
      userName: socket.user.name,
      x, y,
      color: socket.user.cursorColor
    });
    lastCursorEmit = now;
  }
});
```

---

### Reconnection Logic

**Client-Side Reconnection:**
```typescript
// Frontend reconnection handling
const socket = io(WEBSOCKET_URL, {
  auth: { token: getAuthToken() },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

socket.on('connect', () => {
  console.log('WebSocket connected');
  
  // Rejoin rooms
  currentRooms.forEach(roomId => {
    socket.emit('join_room', { roomId });
  });
  
  // Fetch missed events while offline
  socket.emit('sync_events', {
    since: lastEventTimestamp
  });
});

socket.on('disconnect', (reason) => {
  console.log('WebSocket disconnected:', reason);
  
  // Show offline indicator
  showOfflineNotification();
  
  // Auto-reconnect (handled by socket.io)
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  
  // Fallback to polling
  if (error.message === 'websocket error') {
    socket.io.opts.transports = ['polling'];
  }
});
```

---

### Scaling Considerations

**Redis Pub/Sub for Multi-Server:**
```typescript
// When running multiple WebSocket servers
const redis = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

const pubClient = redis.createClient();
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

// Now events are broadcast across all servers
io.to('deal:uuid-1234').emit('deal:updated', data);
```

**Load Balancing:**
```nginx
# Nginx configuration for Socket.io
upstream socketio_backend {
  ip_hash; # Sticky sessions
  server 127.0.0.1:3001;
  server 127.0.0.1:3002;
  server 127.0.0.1:3003;
}

server {
  location /socket.io/ {
    proxy_pass http://socketio_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

---

## 12. API Standards

### OpenAPI/Swagger Specification

**API Documentation Location:** `/api/docs` (Swagger UI)

**Example Endpoint Specification:**
```yaml
openapi: 3.0.0
info:
  title: JEDI RE API
  version: 1.0.0
  description: Real Estate Intelligence Platform API
  
servers:
  - url: https://api.jedire.com/v1
    description: Production
  - url: http://localhost:3000/api/v1
    description: Development

security:
  - BearerAuth: []

paths:
  /deals:
    get:
      summary: List all deals
      tags: [Deals]
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: stage
          in: query
          schema:
            type: string
            enum: [prospecting, loi, under_contract, due_diligence, closed, dead]
        - name: category
          in: query
          schema:
            type: string
            enum: [portfolio, pipeline]
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Deal'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimited'
          
    post:
      summary: Create new deal
      tags: [Deals]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateDealRequest'
      responses:
        '201':
          description: Deal created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Deal'
        '400':
          $ref: '#/components/responses/BadRequest'
        '403':
          $ref: '#/components/responses/Forbidden'
          
  /deals/{dealId}:
    get:
      summary: Get deal by ID
      tags: [Deals]
      parameters:
        - name: dealId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Deal'
        '404':
          $ref: '#/components/responses/NotFound'
          
  /deals/{dealId}/analysis/trigger:
    post:
      summary: Trigger JEDI Score analysis
      tags: [Analysis]
      parameters:
        - name: dealId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '202':
          description: Analysis started
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                    example: "Analysis started. Results will be available shortly."
                  jobId:
                    type: string
                    format: uuid
        '404':
          $ref: '#/components/responses/NotFound'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      
  schemas:
    Deal:
      type: object
      required: [id, name, user_id, deal_category, development_type]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
          example: "Buckhead Mixed-Use Development"
        address:
          type: string
          example: "3350 Peachtree Rd NE, Atlanta, GA 30326"
        deal_category:
          type: string
          enum: [portfolio, pipeline]
        development_type:
          type: string
          enum: [new, existing]
        deal_stage:
          type: string
          enum: [prospecting, loi, under_contract, due_diligence, closed, dead]
        boundary:
          $ref: '#/components/schemas/GeoJSON'
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
          
    CreateDealRequest:
      type: object
      required: [name, boundary, deal_category, development_type, address]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 255
        address:
          type: string
        deal_category:
          type: string
          enum: [portfolio, pipeline]
        development_type:
          type: string
          enum: [new, existing]
        boundary:
          $ref: '#/components/schemas/GeoJSON'
        description:
          type: string
        tier:
          type: string
          enum: [basic, pro, enterprise]
          
    GeoJSON:
      type: object
      required: [type, coordinates]
      properties:
        type:
          type: string
          enum: [Point, Polygon, MultiPolygon]
        coordinates:
          type: array
          
    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        pages:
          type: integer
        has_next:
          type: boolean
        has_prev:
          type: boolean
          
    Error:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        details:
          type: object
        timestamp:
          type: string
          format: date-time
          
  responses:
    BadRequest:
      description: Bad request - invalid input
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: "VALIDATION_ERROR"
            message: "Invalid boundary geometry"
            details:
              field: "boundary"
              issue: "Coordinates array is empty"
            timestamp: "2026-02-07T16:00:00Z"
            
    Unauthorized:
      description: Unauthorized - invalid or missing token
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: "UNAUTHORIZED"
            message: "Invalid or expired authentication token"
            
    Forbidden:
      description: Forbidden - insufficient permissions
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: "DEAL_LIMIT_REACHED"
            message: "You've reached the maximum of 5 deals for basic tier"
            details:
              currentTier: "basic"
              maxDeals: 5
              upgradeUrl: "/settings/billing"
              
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: "NOT_FOUND"
            message: "Deal not found"
            
    RateLimited:
      description: Too many requests
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: "RATE_LIMIT_EXCEEDED"
            message: "Too many requests. Please try again in 60 seconds."
            details:
              retryAfter: 60
```

---

### Pagination Standards

**All list endpoints must support:**
```typescript
// Query parameters
?page=1          // Page number (1-indexed)
?limit=20        // Items per page (default: 20, max: 100)
?sort=created_at // Sort field
?order=desc      // Sort order (asc/desc)

// Response format
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8,
    "has_next": true,
    "has_prev": false
  },
  "links": {
    "first": "/api/v1/deals?page=1",
    "last": "/api/v1/deals?page=8",
    "next": "/api/v1/deals?page=2",
    "prev": null
  }
}
```

---

### Rate Limiting

**Implementation:**
```typescript
// Rate limit middleware
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 900 // seconds
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false
});

// Apply to all API routes
app.use('/api/', apiLimiter);

// Stricter limit for expensive operations
const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 analysis requests per hour
  message: {
    error: 'ANALYSIS_LIMIT_EXCEEDED',
    message: 'Analysis quota exceeded. Upgrade your plan for more capacity.',
    upgradeUrl: '/settings/billing'
  }
});

app.use('/api/v1/deals/:id/analysis', analysisLimiter);
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1675789200
Retry-After: 900 (when rate limited)
```

---

## 13. Map Performance

### Clustering Strategy

**Problem:** Rendering 1000+ properties causes browser slowdown/crashes.

**Solution:** Use Mapbox Supercluster for marker clustering.

**Implementation:**
```typescript
import Supercluster from 'supercluster';

// Initialize clustering
const cluster = new Supercluster({
  radius: 60, // Cluster radius in pixels
  maxZoom: 16, // Max zoom before showing individual points
  minZoom: 0,
  minPoints: 3 // Min points to form a cluster
});

// Load properties into clusterer
const points = properties.map(property => ({
  type: 'Feature',
  properties: {
    id: property.id,
    name: property.address,
    rent: property.rent,
    cluster: false
  },
  geometry: {
    type: 'Point',
    coordinates: [property.lng, property.lat]
  }
}));

cluster.load(points);

// Get clusters for current viewport
function getClustersInView(bounds, zoom) {
  return cluster.getClusters(
    [bounds.west, bounds.south, bounds.east, bounds.north],
    Math.floor(zoom)
  );
}

// On map move/zoom
map.on('moveend', () => {
  const bounds = map.getBounds();
  const zoom = map.getZoom();
  const clusters = getClustersInView(bounds, zoom);
  
  updateMapMarkers(clusters);
});
```

**Cluster Display:**
```
Zoom Level 10:
  🔵 (245) → Cluster with 245 properties

Zoom Level 14:
  🔵 (58)  → Cluster with 58 properties
  🔵 (42)  → Cluster with 42 properties
  🏢       → Individual property

Zoom Level 17:
  🏢 🏢 🏢  → All individual properties visible
```

---

### Viewport-Based Loading

**Only load what's visible:**
```typescript
// Backend endpoint with bbox parameter
GET /api/v1/properties?bbox=-84.5,33.6,-84.2,33.9&zoom=12

// Database query with PostGIS
SELECT id, address, location, rent
FROM properties
WHERE ST_Intersects(
  location,
  ST_MakeEnvelope($1, $2, $3, $4, 4326)
)
AND (
  -- Load all properties at high zoom
  $5 >= 15
  -- Sample 50% at medium zoom
  OR ($5 >= 12 AND random() > 0.5)
  -- Sample 10% at low zoom
  OR random() > 0.9
)
LIMIT 1000;
```

---

### Layer Caching

**Cache rendered layers in browser:**
```typescript
// Cache Mapbox tile layers
const cachedLayers = new Map();

function addLayer(layerId, source, paint) {
  if (cachedLayers.has(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', 'visible');
  } else {
    map.addLayer({
      id: layerId,
      type: 'circle',
      source: source,
      paint: paint
    });
    cachedLayers.set(layerId, true);
  }
}

// Hide instead of remove (faster to re-show)
function hideLayer(layerId) {
  map.setLayoutProperty(layerId, 'visibility', 'none');
}
```

---

### Deal Boundary Simplification

**Simplify complex polygons at low zoom:**
```sql
-- Use ST_Simplify for performance
SELECT 
  id,
  name,
  CASE 
    WHEN $zoom >= 14 THEN ST_AsGeoJSON(boundary)
    WHEN $zoom >= 10 THEN ST_AsGeoJSON(ST_Simplify(boundary, 0.001))
    ELSE ST_AsGeoJSON(ST_Simplify(boundary, 0.01))
  END as boundary
FROM deals
WHERE ST_Intersects(boundary, $viewport);
```

---

### Performance Budget

**Target Metrics:**
- **Initial map load:** < 2 seconds
- **Marker clustering:** < 100ms
- **Layer toggle:** < 50ms
- **Pan/zoom response:** < 16ms (60fps)
- **Property popup:** < 100ms

**Monitoring:**
```typescript
// Performance tracking
performance.mark('map-load-start');
// ... load map ...
performance.mark('map-load-end');
performance.measure('map-load', 'map-load-start', 'map-load-end');

const loadTime = performance.getEntriesByName('map-load')[0].duration;
if (loadTime > 2000) {
  console.warn('Map load exceeded budget:', loadTime);
  analytics.track('map_slow_load', { duration: loadTime });
}
```

---

## 14. Security Layer

### Authentication Flow

**JWT Token Structure:**
```json
{
  "sub": "user-uuid-1234",
  "email": "leon@example.com",
  "role": "investor",
  "org_id": "org-uuid-5678",
  "tier": "pro",
  "iat": 1675789200,
  "exp": 1675875600
}
```

**Token Management:**
```typescript
// Generate JWT
const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      org_id: user.organization_id,
      tier: user.subscription_tier
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: 'jedire.com',
      audience: 'jedire-api'
    }
  );
}

// Verify JWT middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header'
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token'
    });
  }
}
```

---

### OAuth2 Integration

**Google OAuth Flow:**
```typescript
// Initiate OAuth
GET /api/v1/auth/google
→ Redirect to Google consent screen

// Callback
GET /api/v1/auth/google/callback?code=xyz
→ Exchange code for tokens
→ Create/update user
→ Return JWT

// Implementation
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.get('/auth/google', (req, res) => {
  const url = client.generateAuthUrl({
    scope: ['email', 'profile'],
    access_type: 'offline'
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  
  const payload = ticket.getPayload();
  
  // Create or update user
  const user = await findOrCreateUser({
    email: payload.email,
    first_name: payload.given_name,
    last_name: payload.family_name,
    auth_provider: 'google',
    auth_provider_id: payload.sub,
    email_verified: payload.email_verified
  });
  
  // Generate JWT
  const jwt = generateToken(user);
  
  // Redirect to frontend with token
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwt}`);
});
```

---

### Role-Based Access Control (RBAC)

**Permission Matrix:**
```typescript
const permissions = {
  investor: {
    deals: ['read', 'create', 'update_own', 'delete_own'],
    properties: ['read', 'create', 'update_own'],
    modules: ['use_free', 'purchase'],
    team: ['invite']
  },
  analyst: {
    deals: ['read', 'create', 'update_own', 'delete_own'],
    properties: ['read', 'create', 'update_all'],
    modules: ['use_free', 'use_premium'],
    analysis: ['run_jedi_score'],
    team: ['read']
  },
  developer: {
    deals: ['read', 'create', 'update_own', 'delete_own'],
    properties: ['read', 'create', 'update_own'],
    modules: ['use_free', 'use_premium'],
    development: ['access_dev_modules'],
    team: ['invite']
  },
  admin: {
    deals: ['read', 'create', 'update_all', 'delete_all'],
    properties: ['read', 'create', 'update_all', 'delete_all'],
    modules: ['use_all', 'manage_org_modules'],
    team: ['read', 'invite', 'remove', 'change_roles'],
    billing: ['manage']
  }
};

// Middleware
function requirePermission(resource, action) {
  return (req, res, next) => {
    const userPermissions = permissions[req.user.role][resource] || [];
    
    if (userPermissions.includes(action) || userPermissions.includes('*')) {
      next();
    } else {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Insufficient permissions. Required: ${resource}:${action}`
      });
    }
  };
}

// Usage
app.delete('/api/v1/deals/:id', 
  authenticateJWT,
  requirePermission('deals', 'delete_own'),
  async (req, res) => {
    // Delete deal logic
  }
);
```

---

### Data Encryption

**At Rest (Database):**
```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive fields
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  phone VARCHAR(20),
  ssn_encrypted BYTEA, -- Encrypted with pgcrypto
  bank_account_encrypted BYTEA
);

-- Insert encrypted data
INSERT INTO users (email, ssn_encrypted)
VALUES (
  'user@example.com',
  pgp_sym_encrypt('123-45-6789', 'encryption-key')
);

-- Query encrypted data
SELECT 
  email,
  pgp_sym_decrypt(ssn_encrypted, 'encryption-key') as ssn
FROM users
WHERE id = $1;
```

**In Transit (HTTPS):**
```nginx
# Force HTTPS
server {
  listen 80;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  
  # HSTS
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

---

### Input Validation

**Backend Validation (NestJS):**
```typescript
import { IsString, IsNotEmpty, IsEmail, MinLength, MaxLength, IsEnum } from 'class-validator';

export class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsEnum(['portfolio', 'pipeline'])
  deal_category: string;

  @IsEnum(['new', 'existing'])
  development_type: string;

  @IsObject()
  @ValidateNested()
  boundary: GeoJSONDto;
}

// Automatic validation in controller
@Post('/deals')
@UsePipes(new ValidationPipe({ 
  whitelist: true, // Strip unknown properties
  forbidNonWhitelisted: true, // Throw error on unknown properties
  transform: true // Auto-transform to DTO type
}))
async createDeal(@Body() dto: CreateDealDto) {
  return this.dealsService.create(dto);
}
```

**Frontend Validation (React Hook Form + Zod):**
```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const createDealSchema = z.object({
  name: z.string()
    .min(1, 'Deal name is required')
    .max(255, 'Deal name too long'),
  address: z.string().min(1, 'Address is required'),
  deal_category: z.enum(['portfolio', 'pipeline']),
  development_type: z.enum(['new', 'existing']),
  boundary: z.object({
    type: z.enum(['Point', 'Polygon']),
    coordinates: z.array(z.any())
  })
});

type CreateDealForm = z.infer<typeof createDealSchema>;

function CreateDealForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateDealForm>({
    resolver: zodResolver(createDealSchema)
  });

  const onSubmit = async (data: CreateDealForm) => {
    await api.deals.create(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      {/* ... */}
    </form>
  );
}
```

---

### XSS Protection

**Sanitize User Input:**
```typescript
import DOMPurify from 'dompurify';

// Sanitize HTML before rendering
function SafeHTML({ content }) {
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href']
  });
  
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// Backend: Strip HTML from text fields
function sanitizeInput(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}
```

**Content Security Policy (CSP):**
```typescript
// Express middleware
const helmet = require('helmet');

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
    imgSrc: ["'self'", "data:", "https:", "https://api.mapbox.com"],
    connectSrc: ["'self'", "https://api.mapbox.com", "wss://"],
    fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"]
  }
}));
```

---

### SQL Injection Prevention

**Use Parameterized Queries (PostgreSQL):**
```typescript
// ❌ NEVER do this (vulnerable to SQL injection)
const query = `SELECT * FROM deals WHERE name = '${userInput}'`;

// ✅ ALWAYS use parameterized queries
const query = 'SELECT * FROM deals WHERE name = $1';
const result = await db.query(query, [userInput]);

// ✅ With multiple parameters
const query = `
  SELECT * FROM deals 
  WHERE user_id = $1 
  AND deal_stage = $2 
  AND created_at > $3
`;
const result = await db.query(query, [userId, stage, date]);
```

---

### CSRF Protection

**Express CSRF Middleware:**
```typescript
const csrf = require('csurf');

// CSRF protection
const csrfProtection = csrf({ cookie: true });

app.use(csrfProtection);

// Generate token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Require token on state-changing operations
app.post('/api/deals', csrfProtection, async (req, res) => {
  // Token automatically verified by middleware
});
```

**Frontend:**
```typescript
// Fetch CSRF token on app load
const { csrfToken } = await fetch('/api/csrf-token').then(r => r.json());

// Include in POST/PUT/DELETE requests
fetch('/api/deals', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});
```

---

### GDPR Compliance

**Data Export (Right to Access):**
```typescript
// Endpoint: GET /api/v1/user/data-export
async function exportUserData(userId: string) {
  const data = {
    user: await db.query('SELECT * FROM users WHERE id = $1', [userId]),
    deals: await db.query('SELECT * FROM deals WHERE user_id = $1', [userId]),
    properties: await db.query('SELECT * FROM properties WHERE user_id = $1', [userId]),
    activity: await db.query('SELECT * FROM activity_logs WHERE user_id = $1', [userId])
  };
  
  return {
    requested_at: new Date().toISOString(),
    data: data
  };
}
```

**Data Deletion (Right to be Forgotten):**
```sql
-- Soft delete with 30-day grace period
UPDATE users 
SET deleted_at = NOW(),
    email = 'deleted_' || id || '@deleted.com',
    phone = NULL,
    first_name = 'Deleted',
    last_name = 'User'
WHERE id = $1;

-- Hard delete after 30 days (cron job)
DELETE FROM users WHERE deleted_at < NOW() - INTERVAL '30 days';
```

**Audit Logging:**
```typescript
// Log all data access
async function logAccess(userId, resource, action, metadata) {
  await db.query(`
    INSERT INTO audit_logs (user_id, resource, action, metadata, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [userId, resource, action, metadata, req.ip, req.headers['user-agent']]);
}

// Example
await logAccess(userId, 'deal', 'view', { deal_id: dealId });
```

---

## 15. Billing Integration

### Stripe Implementation

**Subscription Creation:**
```typescript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create customer
async function createStripeCustomer(user) {
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.first_name} ${user.last_name}`,
    metadata: {
      user_id: user.id,
      org_id: user.organization_id
    }
  });
  
  // Save customer ID
  await db.query(
    'UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2',
    [customer.id, user.organization_id]
  );
  
  return customer;
}

// Create subscription
async function createSubscription(customerId, priceId, modules) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [
      { price: priceId }, // Base plan
      ...modules.map(module => ({ 
        price: module.stripe_price_id,
        quantity: 1
      }))
    ],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
    trial_period_days: 14
  });
  
  return subscription;
}
```

---

### Checkout Flow

**Frontend:**
```tsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.VITE_STRIPE_PUBLIC_KEY);

function CheckoutForm({ modules, tier }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Create subscription on backend
    const { clientSecret, subscriptionId } = await api.billing.createSubscription({
      modules: modules.map(m => m.id),
      tier
    });
    
    // Confirm payment
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
        billing_details: {
          name: user.name,
          email: user.email
        }
      }
    });
    
    if (error) {
      setError(error.message);
    } else if (paymentIntent.status === 'succeeded') {
      // Subscription active
      toast.success('Subscription activated!');
      router.push('/dashboard');
    }
    
    setLoading(false);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button disabled={!stripe || loading}>
        {loading ? 'Processing...' : 'Subscribe'}
      </button>
    </form>
  );
}

function CheckoutPage() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
}
```

---

### Webhook Handling

**Listen for Stripe events:**
```typescript
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle event
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
    }
    
    res.json({ received: true });
  }
);

async function handleSubscriptionCreated(subscription) {
  const customerId = subscription.customer;
  
  // Get organization from customer ID
  const org = await db.query(
    'SELECT id FROM organizations WHERE stripe_customer_id = $1',
    [customerId]
  );
  
  if (!org.rows[0]) return;
  
  // Update organization
  await db.query(`
    UPDATE organizations 
    SET 
      stripe_subscription_id = $1,
      subscription_tier = $2,
      subscription_expires_at = $3
    WHERE id = $4
  `, [
    subscription.id,
    subscription.metadata.tier || 'pro',
    new Date(subscription.current_period_end * 1000),
    org.rows[0].id
  ]);
  
  // Enable purchased modules
  const modules = subscription.items.data
    .filter(item => item.price.metadata.module_id)
    .map(item => item.price.metadata.module_id);
    
  await db.query(`
    UPDATE organizations 
    SET enabled_modules = $1
    WHERE id = $2
  `, [modules, org.rows[0].id]);
}

async function handlePaymentFailed(invoice) {
  // Notify user
  const org = await getOrgFromStripeCustomer(invoice.customer);
  await sendEmail({
    to: org.owner_email,
    subject: 'Payment Failed - Action Required',
    template: 'payment_failed',
    data: {
      amount: invoice.amount_due / 100,
      next_attempt: invoice.next_payment_attempt
    }
  });
  
  // Downgrade if multiple failures
  if (invoice.attempt_count >= 3) {
    await db.query(`
      UPDATE organizations
      SET subscription_tier = 'free'
      WHERE id = $1
    `, [org.id]);
  }
}
```

---

### Usage-Based Billing

**Track module usage:**
```typescript
// Track analysis runs
async function trackUsage(orgId, module, quantity = 1) {
  await stripe.subscriptionItems.createUsageRecord(
    subscriptionItemId,
    {
      quantity: quantity,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment'
    }
  );
  
  // Also log in database
  await db.query(`
    INSERT INTO usage_logs (org_id, module, quantity, tracked_at)
    VALUES ($1, $2, $3, NOW())
  `, [orgId, module, quantity]);
}

// Example: Track JEDI Score analysis
await trackUsage(user.organization_id, 'jedi_score_analysis', 1);
```

**Display usage:**
```tsx
function BillingUsage() {
  const [usage, setUsage] = useState(null);
  
  useEffect(() => {
    fetch('/api/v1/billing/usage').then(r => r.json()).then(setUsage);
  }, []);
  
  return (
    <div>
      <h3>Current Billing Period</h3>
      <p>JEDI Score Analyses: {usage.jedi_score} / {usage.jedi_score_limit}</p>
      <Progress value={usage.jedi_score} max={usage.jedi_score_limit} />
      
      {usage.jedi_score >= usage.jedi_score_limit * 0.8 && (
        <Alert>
          You've used 80% of your analysis quota. 
          <Link to="/upgrade">Upgrade for unlimited analyses</Link>
        </Alert>
      )}
    </div>
  );
}
```

---

## 16. Error Handling

### Standardized Error Responses

**Error Format:**
```typescript
interface APIError {
  error: string;           // Error code (UPPERCASE_SNAKE_CASE)
  message: string;         // Human-readable message
  details?: object;        // Additional context
  timestamp: string;       // ISO 8601 timestamp
  path?: string;           // Request path
  requestId?: string;      // For tracking/support
}

// Example error responses
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "fields": {
      "name": "Deal name is required",
      "boundary": "Invalid GeoJSON coordinates"
    }
  },
  "timestamp": "2026-02-07T16:30:00Z",
  "path": "/api/v1/deals",
  "requestId": "req_abc123"
}

{
  "error": "DEAL_LIMIT_REACHED",
  "message": "You've reached the maximum of 5 deals for basic tier",
  "details": {
    "currentTier": "basic",
    "currentDeals": 5,
    "maxDeals": 5,
    "upgradeUrl": "/settings/billing"
  },
  "timestamp": "2026-02-07T16:30:00Z"
}

{
  "error": "ANALYSIS_IN_PROGRESS",
  "message": "JEDI Score analysis is already running for this deal",
  "details": {
    "jobId": "job_xyz789",
    "startedAt": "2026-02-07T16:28:00Z",
    "estimatedCompletion": "2026-02-07T16:30:00Z"
  },
  "timestamp": "2026-02-07T16:30:00Z"
}
```

---

### Global Error Handler (Backend)

```typescript
// Express error handler middleware
app.use((err, req, res, next) => {
  // Log error
  console.error('[ERROR]', {
    error: err,
    path: req.path,
    method: req.method,
    user: req.user?.id,
    timestamp: new Date().toISOString()
  });
  
  // Generate request ID
  const requestId = req.headers['x-request-id'] || generateId();
  
  // Determine status code
  let statusCode = err.statusCode || err.status || 500;
  
  // Map common errors
  if (err.name === 'ValidationError') statusCode = 400;
  if (err.name === 'UnauthorizedError') statusCode = 401;
  if (err.name === 'ForbiddenError') statusCode = 403;
  if (err.name === 'NotFoundError') statusCode = 404;
  
  // Build error response
  const errorResponse: APIError = {
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: statusCode === 500 
      ? 'An unexpected error occurred. Please try again later.'
      : err.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId
  };
  
  // Add details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = {
      stack: err.stack,
      raw: err
    };
  } else if (err.details) {
    errorResponse.details = err.details;
  }
  
  res.status(statusCode).json(errorResponse);
});
```

---

### Frontend Error Handling

**API Client with Error Handling:**
```typescript
class APIClient {
  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
          ...options.headers
        }
      });
      
      // Success
      if (response.ok) {
        return await response.json();
      }
      
      // Parse error
      const error = await response.json();
      
      // Handle specific errors
      if (error.error === 'UNAUTHORIZED') {
        // Clear token, redirect to login
        clearAuth();
        window.location.href = '/login';
        throw new Error('Session expired');
      }
      
      if (error.error === 'DEAL_LIMIT_REACHED') {
        // Show upgrade modal
        showUpgradeModal(error.details);
        throw new Error(error.message);
      }
      
      if (error.error === 'RATE_LIMIT_EXCEEDED') {
        const retryAfter = error.details?.retryAfter || 60;
        toast.error(`Too many requests. Try again in ${retryAfter} seconds.`);
        throw new Error(error.message);
      }
      
      // Generic error
      throw new Error(error.message || 'Request failed');
      
    } catch (err) {
      // Network error
      if (err instanceof TypeError) {
        toast.error('Network error. Please check your connection.');
        throw new Error('Network error');
      }
      
      throw err;
    }
  }
}
```

**React Error Boundary:**
```tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log to error tracking service
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Send to Sentry/LogRocket/etc
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error, { extra: errorInfo });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-page">
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
```

---

### Retry Logic

**Exponential Backoff:**
```typescript
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      
      // Don't retry on 4xx errors (except 429)
      if (err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
      
      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, i), 10000); // Cap at 10s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

---

## Summary

### What Was Added in v3.0

✅ **Real-Time Architecture** (Section 11)
- WebSocket implementation with Socket.io
- Event types for collaboration, updates, notifications
- Room structure and management
- Presence tracking
- Reconnection logic
- Scaling with Redis pub/sub

✅ **API Standards** (Section 12)
- Complete OpenAPI/Swagger specification
- Pagination standards
- Rate limiting implementation
- Error response formats
- Authentication headers

✅ **Map Performance** (Section 13)
- Clustering strategy with Supercluster
- Viewport-based loading
- Layer caching
- Boundary simplification
- Performance budget and monitoring

✅ **Security Layer** (Section 14)
- JWT authentication flow
- OAuth2 integration (Google)
- Role-based access control (RBAC)
- Data encryption (at rest and in transit)
- Input validation (frontend + backend)
- XSS, CSRF, SQL injection prevention
- GDPR compliance (data export, deletion, audit logs)

✅ **Billing Integration** (Section 15)
- Stripe subscription creation
- Checkout flow with React
- Webhook handling
- Usage-based billing
- Module purchase tracking

✅ **Error Handling** (Section 16)
- Standardized error responses
- Global error handler
- Frontend error boundary
- Retry logic with exponential backoff

---

### Implementation Priority

**Phase 0 (1-2 weeks):**
1. Add OpenAPI/Swagger documentation
2. Implement WebSocket server (Socket.io)
3. Add Redis for caching + pub/sub
4. Implement frontend clustering (Supercluster)
5. Add Stripe billing integration

**Then proceed with Phase 1-3 as planned in original wireframe.**

---

**Status: ✅ Complete Technical Specification**

**Total Document:** Sections 1-16 covering UX + Technical Implementation

**Ready for development with all critical gaps addressed!** 🚀
