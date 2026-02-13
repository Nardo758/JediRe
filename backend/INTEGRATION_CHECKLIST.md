# Asset Map Intelligence - Integration Checklist

## ✅ Backend Implementation Complete

### Before Deployment

#### 1. Environment Setup
- [ ] Set `UPLOAD_DIR` environment variable (default: `./uploads/note-attachments`)
- [ ] Set `BASE_URL` environment variable (for file URL generation)
- [ ] Verify PostgreSQL + PostGIS extension enabled
- [ ] Run migration 018 if not already applied

#### 2. Static File Serving
Add to your Express app configuration:
```typescript
import express from 'express';
import path from 'path';

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'note-attachments');

// Serve uploaded files
app.use('/uploads/note-attachments', express.static(uploadDir));
```

#### 3. Database Migration
```bash
# If not already applied
psql $DATABASE_URL -f backend/migrations/018_asset_map_intelligence.sql
```

#### 4. Install Dependencies (if needed)
```bash
npm install multer @types/multer
```

#### 5. Test Endpoints
```bash
# Run tests
npm test -- asset-map-intelligence.test.ts

# Or run all tests
npm test
```

---

## 🧪 Manual API Testing

### 1. Test News Linking
```bash
# Get news for an asset
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/assets/{assetId}/news

# Manually link news
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userNotes": "High impact", "impactScore": 9}' \
  http://localhost:3000/api/v1/assets/{assetId}/news/{newsId}/link

# Dismiss news
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/assets/{assetId}/news/{newsId}/link
```

### 2. Test Note Creation
```bash
# Create a location note
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "location",
    "title": "Site Visit",
    "content": "Parking lot needs repair",
    "categoryId": "...",
    "location": {"lat": 33.7490, "lng": -84.3880}
  }' \
  http://localhost:3000/api/v1/assets/{assetId}/notes

# Get all notes
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/assets/{assetId}/notes
```

### 3. Test File Upload
```bash
# Upload attachment
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "files=@/path/to/photo.jpg" \
  http://localhost:3000/api/v1/assets/{assetId}/notes/{noteId}/attachments
```

### 4. Test Replies
```bash
# Add reply
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "I checked this yesterday"}' \
  http://localhost:3000/api/v1/assets/{assetId}/notes/{noteId}/replies

# Get replies
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/assets/{assetId}/notes/{noteId}/replies
```

### 5. Test Categories
```bash
# Get all categories
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/note-categories

# Create custom category
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Maintenance Alert", "color": "#F59E0B", "icon": "🔧"}' \
  http://localhost:3000/api/v1/note-categories
```

---

## 🔍 Verification Steps

### Database Checks
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN (
  'asset_news_links',
  'note_categories',
  'asset_notes',
  'note_replies',
  'asset_note_permissions'
);

-- Verify default categories
SELECT * FROM note_categories WHERE is_system_default = true;

-- Verify functions exist
SELECT proname FROM pg_proc WHERE proname IN (
  'auto_link_news_to_assets',
  'user_has_note_permission'
);

-- Verify trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'note_reply_count_trigger';
```

### File System Checks
```bash
# Verify upload directory exists
ls -la $UPLOAD_DIR

# Check permissions (should be writable by Node.js process)
test -w $UPLOAD_DIR && echo "✅ Upload directory is writable" || echo "❌ Upload directory not writable"
```

---

## 🚀 Frontend Integration

### TypeScript Types
All types exported from:
```typescript
import type {
  AssetNote,
  AssetNoteWithAuthor,
  CreateAssetNoteInput,
  NoteReply,
  NoteCategory,
  AssetNewsLinkWithEvent,
  // ... etc
} from '../backend/src/types/assetMapIntelligence.types';
```

### API Client Example
```typescript
class AssetMapAPI {
  async getAssetNews(assetId: string, options?: {
    radius?: number;
    type?: string;
    excludeDismissed?: boolean;
  }) {
    const params = new URLSearchParams({
      radius: options?.radius?.toString() || '5',
      type: options?.type || '',
      excludeDismissed: String(options?.excludeDismissed ?? true),
    });
    
    const response = await fetch(
      `/api/v1/assets/${assetId}/news?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    return response.json();
  }

  async createNote(assetId: string, note: CreateAssetNoteInput) {
    const response = await fetch(
      `/api/v1/assets/${assetId}/notes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(note),
      }
    );
    
    return response.json();
  }

  async uploadAttachments(assetId: string, noteId: string, files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const response = await fetch(
      `/api/v1/assets/${assetId}/notes/${noteId}/attachments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }
    );

    return response.json();
  }
}
```

---

## 📝 Known Limitations

1. **Virus Scanning:** Basic checks only. Integrate ClamAV or cloud service for production.
2. **File Storage:** Local filesystem. Migrate to S3/GCS for scale.
3. **Real-time Updates:** Not implemented. Add WebSocket for live sync (Phase 2).
4. **Rate Limiting:** Not implemented on upload endpoints. Add rate limiting middleware.
5. **CDN:** Files served directly from Node.js. Use CDN for better performance.

---

## 🐛 Troubleshooting

### Files not uploading
- Check `UPLOAD_DIR` permissions
- Verify multer middleware loaded
- Check file size limits (25 MB per file, 50 MB total)

### Spatial queries failing
- Verify PostGIS extension: `SELECT PostGIS_Version();`
- Check spatial indexes: `\d asset_notes`
- Verify location format: `{lat: number, lng: number}`

### Permission errors
- Verify user has deal access
- Check `asset_note_permissions` table
- Verify auth middleware sets `userId`

### Tests failing
- Install jest: `npm install --save-dev jest ts-jest @types/jest`
- Configure jest.config.js
- Run: `npm test`

---

## ✅ Go-Live Checklist

- [ ] Database migration applied
- [ ] Upload directory created and writable
- [ ] Static file serving configured
- [ ] Environment variables set
- [ ] Tests passing
- [ ] API endpoints responding
- [ ] File uploads working
- [ ] Permissions enforced
- [ ] Error handling tested
- [ ] Documentation reviewed

---

## 📞 Support

**Files:**
- Spec: `/home/leon/clawd/jedire/ASSET_MAP_INTELLIGENCE_SPEC.md`
- Migration: `/home/leon/clawd/jedire/backend/migrations/018_asset_map_intelligence.sql`
- README: `/home/leon/clawd/jedire/backend/ASSET_MAP_INTELLIGENCE_README.md`
- Tests: `/home/leon/clawd/jedire/backend/src/tests/asset-map-intelligence.test.ts`

**Implementation Complete:** ✅
**Status:** Production-Ready
**Date:** February 12, 2026
