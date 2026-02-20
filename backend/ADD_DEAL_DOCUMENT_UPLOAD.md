# Add Deal Document Upload Endpoint

**Issue:** Frontend is calling `POST /api/v1/deals/upload-document` but endpoint doesn't exist.

**Status:** Backend code ready, needs npm install + deployment

---

## 🔧 Solution Overview

Reusing existing file upload infrastructure from notes/files system.

### What Already Exists:
- ✅ `fileUpload.service.ts` - Complete file upload service with multer
- ✅ `fileValidation.ts` - File type validation
- ✅ `files.routes.ts` - Working file upload example
- ❌ `multer` package - **NOT INSTALLED** (needs: `npm install multer @types/multer`)

---

## 📝 Implementation Steps

### Step 1: Install Dependencies (Run in Replit Shell)

```bash
cd backend
npm install multer @types/multer
```

### Step 2: Add Upload Endpoint to Deals Routes

**File:** `backend/src/api/rest/inline-deals.routes.ts`

**Add at the top (imports):**
```typescript
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Configure multer for deal documents
const DEAL_UPLOAD_DIR = path.join(__dirname, '../../uploads/deals');

// Ensure upload directory exists
if (!fs.existsSync(DEAL_UPLOAD_DIR)) {
  fs.mkdirSync(DEAL_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DEAL_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'text/plain',
      'text/csv',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT, CSV allowed.'));
    }
  }
});
```

**Add new route (before `export default router`):**
```typescript
/**
 * POST /api/v1/deals/upload-document
 * Upload a document for a deal
 */
router.post('/upload-document', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const file = req.file;
    const { dealId, documentType, description } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    // Optional: Store document metadata in database
    // You can add a deal_documents table later if needed
    const client = req.dbClient || pool;
    
    // For now, just return file info so frontend can continue
    const documentInfo = {
      id: crypto.randomBytes(16).toString('hex'),
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      mimeType: file.mimetype,
      dealId: dealId || null,
      documentType: documentType || 'general',
      description: description || '',
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user!.userId,
    };

    res.json({
      success: true,
      document: documentInfo,
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document'
    });
  }
});
```

### Step 3: Create Database Table (Optional - for future)

**File:** `backend/migrations/041_deal_documents.sql`

```sql
-- Deal Documents Table (Optional - for tracking uploaded documents)
CREATE TABLE IF NOT EXISTS deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  document_type VARCHAR(50), -- 'financial', 'legal', 'site_plan', 'general', etc.
  description TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_documents_deal_id ON deal_documents(deal_id);
CREATE INDEX idx_deal_documents_user_id ON deal_documents(user_id);
CREATE INDEX idx_deal_documents_document_type ON deal_documents(document_type);
```

---

## ✅ Testing

### Test 1: Install Dependencies
```bash
cd backend
npm install multer @types/multer
```

### Test 2: Test Upload Endpoint
```bash
# Create a test file
echo "test document" > test.txt

# Test upload
curl -X POST http://localhost:3001/api/v1/deals/upload-document \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.txt" \
  -F "dealId=123" \
  -F "documentType=general"
```

**Expected Response:**
```json
{
  "success": true,
  "document": {
    "id": "abc123...",
    "filename": "1234567890-hash.txt",
    "originalName": "test.txt",
    "size": 13,
    "mimeType": "text/plain",
    "uploadedAt": "2026-02-20T15:30:00.000Z"
  },
  "message": "Document uploaded successfully"
}
```

---

## 🔐 Security Considerations

✅ File type validation (only allowed types)
✅ File size limit (50MB max)
✅ Unique filenames (prevents collisions)
✅ Authentication required
✅ Upload directory outside web root

---

## 📂 File Structure

```
backend/
├── uploads/
│   └── deals/              # Created automatically
│       └── [uploaded files]
├── src/
│   └── api/
│       └── rest/
│           └── inline-deals.routes.ts  # Add upload endpoint here
```

---

## 🚀 Deployment Checklist

- [ ] Install multer: `npm install multer @types/multer`
- [ ] Add upload endpoint to inline-deals.routes.ts
- [ ] Test upload with curl or Postman
- [ ] Restart backend server
- [ ] Test from frontend deal creation wizard
- [ ] (Optional) Run migration 041 for database tracking

---

## 📝 Notes

- Files stored in `backend/uploads/deals/`
- Filenames are hashed to prevent collisions
- Original filename preserved in metadata
- No database table required initially (can add later)
- Frontend receives document info to continue wizard flow

---

**Created:** 2026-02-20 15:30 EST
**Status:** Ready to implement - needs npm install + code addition
