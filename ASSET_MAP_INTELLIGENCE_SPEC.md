# Asset Map Intelligence System - Technical Specification

**Version:** 1.0  
**Date:** February 12, 2026  
**Status:** Design Phase - Pending Approval

---

## 🎯 Executive Summary

This spec defines the **Asset Map Intelligence System** - a spatial analysis tool that auto-links news events and enables location-based notes for individual real estate assets. The system transforms the Map View module into an intelligence hub showing relevant market activity, user observations, and spatial context around each property.

---

## 📐 System Architecture

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/TypeScript)               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Map View     │◄───┤ News         │◄───┤ Notes        │  │
│  │ Module       │    │ Intelligence │    │ Module       │  │
│  │              │    │              │    │              │  │
│  │ - Mapbox GL  │    │ - Event Feed │    │ - Note Feed  │  │
│  │ - Layers     │    │ - Filters    │    │ - Categories │  │
│  │ - Controls   │    │              │    │              │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                    │          │
└─────────┼───────────────────┼────────────────────┼──────────┘
          │                   │                    │
          ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js/Express)             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Asset News   │    │ Asset Notes  │    │ Spatial      │  │
│  │ Service      │    │ Service      │    │ Query Engine │  │
│  │              │    │              │    │              │  │
│  │ - Auto-link  │    │ - CRUD ops   │    │ - PostGIS    │  │
│  │ - Impact     │    │ - Permissions│    │ - Radius     │  │
│  │ - Filters    │    │ - Categories │    │ - Contains   │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                    │          │
└─────────┼───────────────────┼────────────────────┼──────────┘
          │                   │                    │
          ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (PostgreSQL + PostGIS)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  news_events    asset_news_links    asset_notes             │
│  (existing)     (new)               (new)                    │
│                                                               │
│  deals          note_categories     asset_note_permissions   │
│  (existing)     (new)               (new)                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### **New Tables (5 total)**

#### **1. asset_news_links**
Auto-links and manual associations between assets and news events.

```sql
CREATE TABLE asset_news_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  news_event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  
  -- Link metadata
  link_type VARCHAR(10) NOT NULL CHECK (link_type IN ('auto', 'manual', 'dismissed')),
  distance_miles DECIMAL(6,2), -- Distance from asset (for auto-links)
  impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 10),
  
  -- User notes on this link
  user_notes TEXT,
  
  -- Tracking
  linked_by UUID REFERENCES users(id),
  linked_at TIMESTAMP DEFAULT NOW(),
  dismissed_by UUID REFERENCES users(id),
  dismissed_at TIMESTAMP,
  
  -- Prevent duplicates
  UNIQUE(asset_id, news_event_id),
  
  -- Indexes
  INDEX idx_asset_news_asset (asset_id),
  INDEX idx_asset_news_event (news_event_id),
  INDEX idx_asset_news_type (link_type),
  INDEX idx_asset_news_score (impact_score DESC)
);
```

---

#### **2. asset_notes**
Location-based and general notes for assets.

```sql
CREATE TABLE asset_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Note type
  note_type VARCHAR(20) NOT NULL CHECK (note_type IN ('location', 'general', 'annotation')),
  
  -- Content
  title VARCHAR(255),
  content TEXT NOT NULL,
  category_id UUID REFERENCES note_categories(id),
  
  -- Spatial data (for location and annotation types)
  location GEOGRAPHY(POINT, 4326), -- Lat/lng for location notes
  geometry GEOGRAPHY(GEOMETRY, 4326), -- Polygon/line for annotations
  
  -- Attachments (max 50 MB total)
  attachments JSONB DEFAULT '[]', -- [{type: 'photo', url: '...', name: '...', size: bytes}]
  total_attachment_size_bytes INTEGER DEFAULT 0,
  
  -- Threading
  reply_count INTEGER DEFAULT 0,
  last_reply_at TIMESTAMP,
  
  -- Metadata
  author_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Visibility
  is_private BOOLEAN DEFAULT false,
  
  -- Indexes
  INDEX idx_asset_notes_asset (asset_id),
  INDEX idx_asset_notes_author (author_id),
  INDEX idx_asset_notes_category (category_id),
  INDEX idx_asset_notes_created (created_at DESC),
  
  -- Spatial index
  INDEX idx_asset_notes_location USING GIST (location),
  INDEX idx_asset_notes_geometry USING GIST (geometry)
);
```

---

#### **3. note_replies**
Comments/replies on notes for team collaboration.

```sql
CREATE TABLE note_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES asset_notes(id) ON DELETE CASCADE,
  
  -- Content (max 5,000 characters)
  content TEXT NOT NULL CHECK (LENGTH(content) <= 5000),
  
  -- Author
  author_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Edited tracking
  is_edited BOOLEAN DEFAULT false,
  
  -- Indexes
  INDEX idx_note_replies_note (note_id),
  INDEX idx_note_replies_author (author_id),
  INDEX idx_note_replies_created (created_at DESC)
);

-- Trigger to update reply_count on parent note
CREATE OR REPLACE FUNCTION update_note_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE asset_notes 
    SET reply_count = reply_count + 1,
        last_reply_at = NEW.created_at
    WHERE id = NEW.note_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE asset_notes 
    SET reply_count = GREATEST(reply_count - 1, 0),
        last_reply_at = (
          SELECT MAX(created_at) 
          FROM note_replies 
          WHERE note_id = OLD.note_id
        )
    WHERE id = OLD.note_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_reply_count_trigger
AFTER INSERT OR DELETE ON note_replies
FOR EACH ROW EXECUTE FUNCTION update_note_reply_count();
```

---

#### **4. note_categories**
User-defined categories for organizing notes.

```sql
CREATE TABLE note_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ownership
  user_id UUID REFERENCES users(id), -- NULL = system default
  organization_id UUID REFERENCES organizations(id), -- NULL = personal
  
  -- Category details
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6B7280', -- Hex color
  icon VARCHAR(50) DEFAULT '📝', -- Emoji or icon name
  
  -- System defaults
  is_system_default BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate names per user/org
  UNIQUE(user_id, organization_id, name),
  
  -- Indexes
  INDEX idx_note_categories_user (user_id),
  INDEX idx_note_categories_org (organization_id)
);

-- Seed default categories
INSERT INTO note_categories (name, color, icon, is_system_default, display_order) VALUES
  ('Observation', '#3B82F6', '👁️', true, 1),
  ('Issue', '#EF4444', '⚠️', true, 2),
  ('Opportunity', '#10B981', '💡', true, 3);
```

---

#### **5. asset_note_permissions**
Controls who can view/edit notes on an asset.

```sql
CREATE TABLE asset_note_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Permission level
  permission VARCHAR(20) NOT NULL CHECK (permission IN ('view', 'edit', 'admin')),
  
  -- Granted by deal thread creator
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(asset_id, user_id),
  
  -- Indexes
  INDEX idx_asset_note_perms_asset (asset_id),
  INDEX idx_asset_note_perms_user (user_id)
);
```

---

### **Schema Updates to Existing Tables**

#### **news_events** (existing - add fields if missing)
```sql
ALTER TABLE news_events ADD COLUMN IF NOT EXISTS 
  impact_radius_miles DECIMAL(6,2) DEFAULT 5.0;

-- Ensure spatial columns exist
ALTER TABLE news_events ADD COLUMN IF NOT EXISTS 
  location GEOGRAPHY(POINT, 4326);
```

---

## 🔌 API Endpoints

### **Asset News Links**

#### **GET /api/assets/:assetId/news**
Get all news events linked to an asset (auto + manual).

**Query Parameters:**
- `radius` (optional): Override default 5mi radius (1, 3, 5, 10)
- `type` (optional): Filter by event type (employment, development, etc.)
- `includeLink` (optional): Include link_type info (default: true)
- `excludeDismissed` (optional): Hide dismissed news (default: true)

**Response:**
```json
{
  "assetId": "uuid",
  "newsEvents": [
    {
      "id": "uuid",
      "title": "Amazon Opens Distribution Center",
      "date": "2026-02-08",
      "type": "employment",
      "location": {"lat": 33.8, "lng": -84.4},
      "distanceMiles": 1.2,
      "impactScore": 8,
      "linkType": "auto",
      "userNotes": "Watch for rent pressure",
      "linkedAt": "2026-02-08T10:00:00Z"
    }
  ],
  "total": 12,
  "autoLinked": 10,
  "manualLinked": 2,
  "dismissed": 3
}
```

---

#### **POST /api/assets/:assetId/news/:newsId/link**
Manually link a news event to an asset.

**Request Body:**
```json
{
  "userNotes": "This will impact our leasing strategy",
  "impactScore": 7
}
```

**Response:**
```json
{
  "success": true,
  "link": {
    "id": "uuid",
    "linkType": "manual",
    "linkedAt": "2026-02-12T18:53:00Z"
  }
}
```

---

#### **DELETE /api/assets/:assetId/news/:newsId/link**
Dismiss an auto-linked news event.

**Response:**
```json
{
  "success": true,
  "linkType": "dismissed"
}
```

---

### **Asset Notes**

#### **GET /api/assets/:assetId/notes**
Get all notes for an asset.

**Query Parameters:**
- `type` (optional): Filter by note_type (location, general, annotation)
- `category` (optional): Filter by category_id
- `author` (optional): Filter by author_id

**Response:**
```json
{
  "notes": [
    {
      "id": "uuid",
      "type": "location",
      "title": "Site Visit - Parking Lot",
      "content": "Needs resurfacing. Est $15K",
      "category": {
        "id": "uuid",
        "name": "Issue",
        "color": "#EF4444",
        "icon": "⚠️"
      },
      "location": {"lat": 33.8, "lng": -84.4},
      "attachments": [
        {"type": "photo", "url": "...", "name": "parking.jpg"}
      ],
      "author": {
        "id": "uuid",
        "name": "Leon D",
        "avatar": "..."
      },
      "createdAt": "2026-02-10T14:30:00Z",
      "updatedAt": "2026-02-10T14:30:00Z"
    }
  ],
  "total": 8
}
```

---

#### **POST /api/assets/:assetId/notes**
Create a new note.

**Request Body:**
```json
{
  "type": "location",
  "title": "Great Street View",
  "content": "High visibility from main intersection",
  "categoryId": "uuid",
  "location": {"lat": 33.8, "lng": -84.4},
  "attachments": []
}
```

**Response:**
```json
{
  "success": true,
  "note": {
    "id": "uuid",
    "type": "location",
    "title": "Great Street View",
    "createdAt": "2026-02-12T18:53:00Z"
  }
}
```

---

#### **PATCH /api/assets/:assetId/notes/:noteId**
Update an existing note.

**Request Body:**
```json
{
  "content": "Updated observation text",
  "categoryId": "new-uuid"
}
```

---

#### **DELETE /api/assets/:assetId/notes/:noteId**
Delete a note (only author or admin).

---

### **Note Replies**

#### **GET /api/assets/:assetId/notes/:noteId/replies**
Get all replies/comments on a note.

**Response:**
```json
{
  "replies": [
    {
      "id": "uuid",
      "content": "I checked this yesterday, contractor quoted $12K",
      "author": {
        "id": "uuid",
        "name": "Jeremy Myers",
        "avatar": "..."
      },
      "createdAt": "2026-02-11T10:30:00Z",
      "isEdited": false
    }
  ],
  "total": 3
}
```

---

#### **POST /api/assets/:assetId/notes/:noteId/replies**
Add a reply to a note.

**Request Body:**
```json
{
  "content": "Good catch! Let's schedule this for Q2."
}
```

**Response:**
```json
{
  "success": true,
  "reply": {
    "id": "uuid",
    "content": "Good catch! Let's schedule this for Q2.",
    "createdAt": "2026-02-12T19:13:00Z"
  }
}
```

---

#### **PATCH /api/assets/:assetId/notes/:noteId/replies/:replyId**
Edit a reply (author only).

**Request Body:**
```json
{
  "content": "Updated comment text"
}
```

---

#### **DELETE /api/assets/:assetId/notes/:noteId/replies/:replyId**
Delete a reply (author or admin).

---

### **Note Categories**

#### **GET /api/note-categories**
Get all available categories (system + user's custom).

**Response:**
```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Observation",
      "color": "#3B82F6",
      "icon": "👁️",
      "isSystemDefault": true
    },
    {
      "id": "uuid",
      "name": "Tenant Feedback",
      "color": "#8B5CF6",
      "icon": "💬",
      "isSystemDefault": false
    }
  ]
}
```

---

#### **POST /api/note-categories**
Create a custom category.

**Request Body:**
```json
{
  "name": "Maintenance Alert",
  "color": "#F59E0B",
  "icon": "🔧"
}
```

---

### **Note Permissions**

#### **GET /api/assets/:assetId/note-permissions**
Get all users with note access to this asset.

**Response:**
```json
{
  "permissions": [
    {
      "userId": "uuid",
      "userName": "Leon D",
      "permission": "admin",
      "grantedAt": "2026-02-01T00:00:00Z"
    }
  ]
}
```

---

#### **POST /api/assets/:assetId/note-permissions**
Grant note access to a user (deal creator only).

**Request Body:**
```json
{
  "userId": "uuid",
  "permission": "edit"
}
```

---

## 🎨 UI Components & Wireframes

### **Map View Module - Main Layout**

```
┌────────────┬──────────────────────────────────────────────────┐
│            │                                                  │
│  ASSET     │                   MAP VIEW                       │
│  MODULES   │                                                  │
│            │  ┌──────────────────────────────────────────┐   │
│  📍 Map    │  │                                          │   │
│     View   │  │         [Property boundary shown]        │   │
│            │  │                                          │   │
│  📊 Over-  │  │    📰 News pins    📝 Note pins         │   │
│     view   │  │                                          │   │
│            │  │                                          │   │
│  📈 Perf   │  │         🏢 Your Property                 │   │
│     Track  │  │                                          │   │
│            │  │                                          │   │
│  💰 Fin    │  └──────────────────────────────────────────┘   │
│     Anal   │                                                  │
│            │  ┌────────────────────────────────────────┐     │
│  🏢 Asset  │  │ Layers:                                │     │
│     Mgmt   │  │ ☑ Property Boundary                    │     │
│            │  │ ☑ News Events (12)                     │     │
│  📋 Cap    │  │ ☑ My Notes (8)                         │     │
│     Plan   │  │ ☐ Supply Pipeline                      │     │
│            │  │ ☐ Comparables                          │     │
│  📊 Mkt    │  │                                        │     │
│     Anal   │  │ Tools:                                 │     │
│            │  │ [📍 Add Note] [✏️ Draw] [📏 Measure]   │     │
│  🎯 Strat  │  │                                        │     │
│     & Arb  │  │ Filter News:                           │     │
│            │  │ [All] [Employment] [Development]       │     │
│  📄 Docs   │  │ Radius: [○ 1mi] [○ 3mi] [● 5mi]       │     │
│            │  └────────────────────────────────────────┘     │
│  👥 Team   │                                                  │
│            │                                                  │
└────────────┴──────────────────────────────────────────────────┘
```

---

### **News Event Popup**

When user clicks a news pin on map:

```
┌──────────────────────────────────────────┐
│ 📰 Amazon Opens Distribution Center      │
├──────────────────────────────────────────┤
│ 📍 1.2 miles NW                          │
│ 📅 Feb 8, 2026                           │
│ 🏢 Employment                            │
│                                          │
│ Expected Impact: 🔴 HIGH (8/10)         │
│                                          │
│ Estimated +350 units housing demand      │
│ within 3 years. Monitor rent growth      │
│ and absorption rates.                    │
│                                          │
│ 🔗 Linked: Auto                          │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ 💬 Your Note:                        │ │
│ │ ________________________________     │ │
│ │ ________________________________     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [View Full Analysis]  [✕ Dismiss]       │
└──────────────────────────────────────────┘
```

---

### **Note with Replies View**

When user clicks a note that has replies:

```
┌───────────────────────────────────────────┐
│ 📝 Site Visit - Main Entrance             │
│ ⚠️ Issue • Leon D • Feb 10, 2:30 PM      │
├───────────────────────────────────────────┤
│ Cracked sidewalk near entrance.           │
│ Safety concern for tenants.               │
│ Est. $3K to repair.                       │
│                                           │
│ 📎 photo1.jpg (245 KB)                    │
├───────────────────────────────────────────┤
│ 💬 3 Replies                              │
│                                           │
│ ┌─────────────────────────────────────┐   │
│ │ Jeremy Myers • Feb 10, 3:15 PM      │   │
│ │ I checked this yesterday. Contractor│   │
│ │ quoted $12K. Let's get 2 more bids. │   │
│ └─────────────────────────────────────┘   │
│                                           │
│ ┌─────────────────────────────────────┐   │
│ │ Leon D • Feb 11, 9:00 AM            │   │
│ │ Got $10K and $11K quotes. Going     │   │
│ │ with middle option.                 │   │
│ └─────────────────────────────────────┘   │
│                                           │
│ ┌─────────────────────────────────────┐   │
│ │ Add reply...                        │   │
│ │ ________________________________    │   │
│ └─────────────────────────────────────┘   │
│                                           │
│ [Close]                    [💬 Reply]     │
└───────────────────────────────────────────┘
```

---

### **Add Note Modal**

When user clicks map to add a location note:

```
┌───────────────────────────────────────────┐
│ 📝 Add Note at This Location              │
├───────────────────────────────────────────┤
│ Title:                                    │
│ [Site Visit - Main Entrance______]        │
│                                           │
│ Category:                                 │
│ [▼ Issue ▼]                               │
│                                           │
│ Note:                                     │
│ ┌───────────────────────────────────────┐ │
│ │ Cracked sidewalk near entrance.       │ │
│ │ Safety concern for tenants.           │ │
│ │ Est. $3K to repair.                   │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ 📎 Attachments:                           │
│ [Upload Photo] [Upload File]             │
│                                           │
│ ┌─────────────────────────────────────┐   │
│ │ ⚙️ thumbnail.jpg (245 KB)           │   │
│ └─────────────────────────────────────┘   │
│                                           │
│ Visibility:                               │
│ [● Team] [○ Private]                      │
│                                           │
│ [Cancel]              [📍 Save to Map]    │
└───────────────────────────────────────────┘
```

---

### **Layer Toggle Panel**

```
┌──────────────────────────────────────┐
│ 🗺️ Map Layers                        │
├──────────────────────────────────────┤
│                                      │
│ Property:                            │
│ ☑ Boundary                           │
│ ☐ Trade Area (3 mile)                │
│                                      │
│ Intelligence:                        │
│ ☑ News Events            (12) 📰     │
│ ☑ My Notes               (8) 📝      │
│ ☐ Team Notes             (3) 💬      │
│                                      │
│ Market Data:                         │
│ ☐ Supply Pipeline        (4) 🏗️     │
│ ☐ Comparables            (7) 📊      │
│ ☐ Demographics                       │
│                                      │
│ ─────────────────────────────────    │
│                                      │
│ News Filters:                        │
│ [All] [Employment] [Development]     │
│ [Infrastructure] [Transactions]      │
│                                      │
│ Radius:                              │
│ [○ 1mi] [○ 3mi] [● 5mi] [○ 10mi]    │
│                                      │
│ Impact Level:                        │
│ [☑ High] [☑ Med] [☐ Low]             │
│                                      │
└──────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### **Auto-Link News Flow**

```
1. News event created/updated
   │
   ▼
2. Background job triggered
   │
   ▼
3. PostGIS spatial query:
   "Find all assets within event radius"
   │
   ▼
4. For each asset within radius:
   │
   ├─→ Calculate distance
   ├─→ Calculate impact score
   └─→ Create asset_news_links record (type='auto')
   │
   ▼
5. Real-time notification to users
   viewing affected asset maps
```

---

### **Create Note Flow**

```
User clicks map location
   │
   ▼
Modal opens with form
   │
   ▼
User enters:
- Title
- Category
- Content
- Attachments
   │
   ▼
Submit → POST /api/assets/:id/notes
   │
   ├─→ Validate permissions
   ├─→ Save to asset_notes table
   ├─→ Store lat/lng as PostGIS point
   └─→ Upload attachments to S3
   │
   ▼
Return note with ID
   │
   ▼
Frontend:
   ├─→ Add marker to map
   ├─→ Update notes count
   └─→ Refresh Notes module feed
```

---

### **Permission Check Flow**

```
User opens Map View for asset
   │
   ▼
Check asset_note_permissions:
   │
   ├─→ Is user deal creator? → Full access
   │
   ├─→ Has explicit permission? → Use that level
   │
   └─→ No permission? → View-only mode
   │
   ▼
Render UI based on permission:
   │
   ├─→ Admin: Can add/edit/delete all notes
   ├─→ Edit: Can add notes, edit own
   └─→ View: Can see notes, no editing
```

---

## 🔴 Real-Time Sync (WebSocket)

### **Architecture**

Users with access to an asset receive live updates for:
- New notes created
- Notes edited/deleted
- Replies added to notes
- News events linked/dismissed

### **WebSocket Events**

**Client → Server:**
```typescript
// Subscribe to asset updates
{
  event: 'subscribe',
  assetId: 'uuid',
  userId: 'uuid'
}

// Unsubscribe
{
  event: 'unsubscribe',
  assetId: 'uuid'
}
```

**Server → Client:**
```typescript
// New note created
{
  event: 'note:created',
  assetId: 'uuid',
  note: {...}
}

// Note updated
{
  event: 'note:updated',
  assetId: 'uuid',
  noteId: 'uuid',
  changes: {...}
}

// Reply added
{
  event: 'note:reply',
  assetId: 'uuid',
  noteId: 'uuid',
  reply: {...}
}

// News linked
{
  event: 'news:linked',
  assetId: 'uuid',
  newsEvent: {...}
}
```

### **Permission Enforcement**

Before broadcasting updates:
1. Check asset_note_permissions for all subscribed users
2. Only send to users with 'view', 'edit', or 'admin' permission
3. Filter note content based on is_private flag

### **Implementation**

**Backend:**
- Use Socket.io for WebSocket connections
- Rooms: One room per asset ID
- On database change → emit to room
- Permission check before emit

**Frontend:**
- Connect on Map View mount
- Subscribe to current asset
- Update UI on events received
- Show "New note added by [User]" toast

---

## 🔗 Integration Points

### **Existing Systems**

#### **1. News Intelligence Module**
- **Current:** Shows all market news in feed
- **New:** 
  - Add "📍 View on Map" button to each news item
  - Click → Navigate to related asset's Map View
  - Highlight news pin on map

#### **2. Notes Module (in deal)**
- **Current:** General chronological note feed
- **New:**
  - Show note type badge (📍 Location, 📝 General, ✏️ Annotation)
  - Location notes have "View on Map" button
  - Can create notes from either module

#### **3. Financial Analysis Module**
- **New:**
  - Link to news events that influenced assumptions
  - "Impact Assumptions" section with news references
  - Click → See news on map

#### **4. Overview Module**
- **Change:** Remove redundant map section
- **Keep:** Stats, progress, team (data-focused)

---

## 🧪 Testing Strategy

### **Unit Tests**

1. **Spatial Queries**
   - Test radius calculations
   - Test geometry intersections
   - Test distance sorting

2. **Impact Scoring**
   - Test score algorithm
   - Test different event types
   - Test distance weighting

3. **Permissions**
   - Test access control logic
   - Test permission inheritance
   - Test edge cases (deleted users, etc.)

### **Integration Tests**

1. **Auto-Linking**
   - Create news event → verify asset links created
   - Update event location → verify links updated
   - Delete event → verify links cleaned up

2. **Note CRUD**
   - Create/read/update/delete notes
   - Test with attachments
   - Test permission violations

3. **API Endpoints**
   - Test all endpoints
   - Test error cases
   - Test pagination

### **E2E Tests**

1. **User Flows**
   - User views map → sees auto-linked news
   - User adds location note → appears on map
   - User dismisses news → removed from view
   - Team member views notes → sees team notes

---

## 📊 Performance Considerations

### **Database Optimization**

1. **Spatial Indexes**
   - GIST indexes on all geography columns
   - Covers radius queries efficiently

2. **Query Optimization**
   - Use ST_DWithin for radius queries (faster than ST_Distance)
   - Index on link_type for filtering dismissed news
   - Composite indexes on (asset_id, link_type, impact_score)

3. **Caching Strategy**
   - Cache news links per asset (TTL: 5 minutes)
   - Cache note counts (invalidate on create/delete)
   - Cache category list (rarely changes)

### **Frontend Optimization**

1. **Map Performance**
   - Cluster news pins when zoomed out
   - Lazy load note details on click
   - Limit visible notes to viewport

2. **API Calls**
   - Debounce radius slider changes
   - Batch permission checks
   - Prefetch likely selections

---

## 🚀 Implementation Phases

### **Phase 1: Foundation** (5-7 hours)
1. Create 5 database tables + migrations
2. Build API endpoints (CRUD for notes + replies)
3. Add spatial query functions
4. File upload handling (local, 50 MB limit)
5. Unit tests for core logic

### **Phase 2: Map UI** (7-9 hours)
1. Build MapView component with Mapbox
2. Add layer toggles
3. Implement news/note markers
4. Add click handlers + popups
5. Note detail modal with reply thread
6. Reply UI component
7. Drawing tools integration

### **Phase 3: Real-Time Sync** (4-5 hours)
1. Set up Socket.io WebSocket server
2. Implement room-based broadcasting
3. Permission-based event filtering
4. Frontend WebSocket client
5. Live update handlers
6. Toast notifications

### **Phase 4: Integration** (4-6 hours)
1. Connect to News Intelligence
2. Connect to Notes Module
3. Update Overview (remove map)
4. Add permission controls
5. E2E testing

### **Phase 5: Polish** (3-5 hours)
1. Custom categories UI
2. Performance optimization
3. Attachment preview/download
4. Error handling
5. User documentation

**Total Estimate:** 23-32 hours

---

## 📋 Acceptance Criteria

### **Functional Requirements**

✅ **News Auto-Linking**
- [ ] News within 5 miles auto-links to assets
- [ ] Impact score calculated automatically
- [ ] User can adjust radius filter (1/3/5/10 mi)
- [ ] User can manually add/dismiss news

✅ **Location Notes**
- [ ] User can click map to add note
- [ ] Note appears as pin on map
- [ ] Note includes title, content, category, attachments (max 50 MB)
- [ ] Content limited to 5,000 characters
- [ ] User can edit/delete own notes
- [ ] Notes support replies/comments
- [ ] Reply count shown on note
- [ ] Users can view threaded discussions

✅ **Categories**
- [ ] Default categories: Observation, Issue, Opportunity
- [ ] User can create custom categories
- [ ] Categories have color/icon
- [ ] Categories filter notes

✅ **Permissions**
- [ ] Deal creator has full access
- [ ] Creator can invite team members
- [ ] Team members see shared notes
- [ ] Private notes only visible to author

✅ **Integration**
- [ ] News Intelligence links to map view
- [ ] Notes Module shows map link for location notes
- [ ] Overview module has no map (removed)

✅ **Real-Time Collaboration**
- [ ] WebSocket connection established on Map View load
- [ ] New notes appear instantly for all viewers
- [ ] Note edits sync in real-time
- [ ] Replies appear instantly
- [ ] Permission-based broadcasting (view/edit/admin)
- [ ] Toast notifications for updates

### **Non-Functional Requirements**

✅ **Performance**
- [ ] Map loads in <2 seconds
- [ ] Radius query returns in <500ms
- [ ] Supports 100+ news events on map
- [ ] Smooth zooming/panning

✅ **Usability**
- [ ] Mobile responsive
- [ ] Intuitive controls
- [ ] Clear visual hierarchy
- [ ] Helpful tooltips

✅ **Reliability**
- [ ] Handles missing data gracefully
- [ ] No crashes on bad input
- [ ] Background jobs don't block UI
- [ ] Proper error messages

---

## 🔒 Security Considerations

1. **Access Control**
   - Verify user owns asset before showing notes
   - Check permissions on every API call
   - No leakage of private notes

2. **Input Validation**
   - Sanitize all text inputs (XSS prevention)
   - Validate lat/lng ranges (-90 to 90, -180 to 180)
   - Character limit enforcement (5,000 chars)
   - File upload validation:
     - Max 50 MB per note
     - Allowed file types: jpg, png, pdf, doc, docx, xls, xlsx
     - Virus scanning on upload
     - Filename sanitization
   - Prevent SQL injection in spatial queries

3. **Rate Limiting**
   - Limit note creation (10/min per user)
   - Limit reply creation (20/min per user)
   - Limit attachment uploads (50 MB total per note)

---

## 📚 Documentation Deliverables

1. **API Documentation**
   - OpenAPI/Swagger spec
   - Example requests/responses
   - Error codes

2. **User Guide**
   - How to use Map View
   - How to add notes
   - How to manage categories
   - How to share with team

3. **Developer Guide**
   - Database schema
   - Spatial query examples
   - Component architecture

---

## ✅ Next Steps

**After Review & Approval:**

1. Leon reviews this spec
2. Discuss any changes/additions
3. Get final sign-off
4. I begin Phase 1 implementation
5. Daily check-ins on progress

**Decisions Made:**

1. ✅ **Attachment storage:** Local filesystem
2. ✅ **Max attachments:** 50 MB total per note
3. ✅ **Character limit:** 5,000 characters per note
4. ✅ **Note threads:** YES - support comments/replies on notes
5. ✅ **Real-time sync:** YES - WebSocket-based live updates with permission-based access

---

**End of Technical Specification**

---

**Approval:**
- [ ] Approved by: _______________
- [ ] Date: _______________
- [ ] Ready for Implementation: Yes / No
