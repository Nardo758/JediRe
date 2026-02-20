# 🚀 Deal Document Upload - Implementation Guide

**Issue:** Frontend calling `POST /api/v1/deals/upload-document` but endpoint missing  
**Status:** ✅ **Code Ready** - Needs deployment in Replit  
**Time to Deploy:** ~5 minutes

---

## 📦 What I've Created

### 1. **Complete Implementation Code**
   - ✅ `backend/src/api/rest/inline-deals-upload-patch.ts` - Ready-to-add code
   - ✅ `backend/migrations/041_deal_documents.sql` - Database table
   - ✅ `backend/ADD_DEAL_DOCUMENT_UPLOAD.md` - Full documentation

### 2. **Endpoints Created**
   - `POST /api/v1/deals/upload-document` - Upload document
   - `GET /api/v1/deals/:dealId/documents` - List documents
   - `DELETE /api/v1/deals/documents/:documentId` - Delete document

### 3. **Features**
   - ✅ File type validation (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT, CSV)
   - ✅ 50MB file size limit
   - ✅ Unique filename generation (no collisions)
   - ✅ Authentication required
   - ✅ Secure file storage
   - ✅ Database tracking (optional)
   - ✅ Automatic cleanup on errors

---

## 🔧 Quick Deploy (2 Steps)

### Step 1: Install Multer (Replit Shell)

```bash
cd backend
npm install multer @types/multer
```

**Expected:** `added 2 packages` in ~10 seconds

---

### Step 2: Add Upload Endpoint

**File to Edit:** `backend/src/api/rest/inline-deals.routes.ts`

**Copy this entire block from:** `backend/src/api/rest/inline-deals-upload-patch.ts`

**Where to paste:**
1. Imports at TOP of file (after existing imports)
2. Routes BEFORE `export default router` (at bottom)

**Quick check after adding:**
```bash
cd backend/src/api/rest
grep -n "upload-document" inline-deals.routes.ts
```
Should show line numbers where routes were added.

---

### Step 3: Run Database Migration (Optional)

```bash
cd backend
# Check if migration script exists
npx tsx src/scripts/run-migrations.ts

# OR run SQL directly in Replit DB Console
\i backend/migrations/041_deal_documents.sql
```

---

### Step 4: Restart Backend

```bash
# Replit will auto-restart, or manually:
cd backend
npm run dev
```

---

## 🧪 Testing

### Test 1: Check Endpoint Exists

```bash
# Should see "upload-document" in route list
curl http://localhost:3001/api/v1/deals/upload-document \
  -X OPTIONS
```

### Test 2: Test Upload

```bash
# Create test file
echo "test document" > /tmp/test.txt

# Upload (replace YOUR_TOKEN with real token)
curl -X POST http://localhost:3001/api/v1/deals/upload-document \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/tmp/test.txt" \
  -F "dealId=test-123" \
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

### Test 3: Frontend Test

1. Navigate to deal creation wizard
2. Upload a document in the appropriate step
3. Check browser network tab for `POST /api/v1/deals/upload-document`
4. Verify response includes document metadata
5. Wizard should continue to next step

---

## 📂 File Storage

**Upload Directory:** `backend/uploads/deals/`

**Created automatically** when first file is uploaded.

**Example file structure:**
```
backend/
└── uploads/
    └── deals/
        ├── 1708456789123-abc123def456.pdf
        ├── 1708456790456-789xyz012abc.docx
        └── 1708456791789-def456ghi789.xlsx
```

**Filename format:** `{timestamp}-{random-hash}.{extension}`

---

## 🔐 Security

✅ **File Type Validation:** Only allowed types (PDF, DOC, images, etc.)  
✅ **Size Limit:** 50MB maximum per file  
✅ **Unique Filenames:** Prevents collisions and overwrites  
✅ **Authentication:** Requires valid JWT token  
✅ **User Isolation:** Each user can only access their own documents  
✅ **Path Safety:** Upload dir is outside web root  
✅ **Error Cleanup:** Failed uploads are automatically deleted

---

## 📊 Database Schema

**Table:** `deal_documents`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| deal_id | UUID | References deals(id) |
| user_id | UUID | User who uploaded |
| filename | VARCHAR | Stored filename (hashed) |
| original_name | VARCHAR | Original filename |
| file_path | TEXT | Full path to file |
| file_size | BIGINT | Size in bytes |
| mime_type | VARCHAR | Content type |
| document_type | VARCHAR | Category (financial, legal, etc.) |
| description | TEXT | User description |
| uploaded_at | TIMESTAMP | Upload time |

---

## 🎯 API Reference

### Upload Document

```http
POST /api/v1/deals/upload-document
Content-Type: multipart/form-data
Authorization: Bearer {token}

file: [binary data]
dealId: "uuid" (optional)
documentType: "financial" | "legal" | "site_plan" | "general" (optional)
description: "string" (optional)
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "filename": "stored-name.pdf",
    "originalName": "user-file.pdf",
    "size": 1234567,
    "mimeType": "application/pdf",
    "dealId": "uuid",
    "documentType": "financial",
    "uploadedAt": "2026-02-20T15:30:00.000Z"
  },
  "message": "Document uploaded successfully"
}
```

### List Documents

```http
GET /api/v1/deals/{dealId}/documents
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "filename": "stored-name.pdf",
      "originalName": "user-file.pdf",
      "fileSize": 1234567,
      "mimeType": "application/pdf",
      "documentType": "financial",
      "description": "Q1 Financial Report",
      "uploadedAt": "2026-02-20T15:30:00.000Z"
    }
  ]
}
```

### Delete Document

```http
DELETE /api/v1/deals/documents/{documentId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

## 🚨 Troubleshooting

### Error: "multer is not a function"
**Fix:** Run `npm install multer @types/multer` in backend directory

### Error: "Cannot find module 'multer'"
**Fix:** Restart backend after npm install

### Error: "ENOENT: no such file or directory"
**Fix:** Upload directory is created automatically, but ensure backend has write permissions

### Error: "Invalid file type"
**Fix:** Check `allowedTypes` array in upload config - add missing MIME types if needed

### Frontend still gets 404
**Fix:** 
1. Verify route was added to inline-deals.routes.ts
2. Check backend logs for errors
3. Restart backend server
4. Clear browser cache

---

## ✅ Deployment Checklist

- [ ] Install multer: `cd backend && npm install multer @types/multer`
- [ ] Add upload code to `inline-deals.routes.ts` (see patch file)
- [ ] Run migration 041 (optional, for DB tracking)
- [ ] Restart backend
- [ ] Test upload with curl
- [ ] Test from frontend deal wizard
- [ ] Verify files appear in `backend/uploads/deals/`
- [ ] Check database has document records (if migration run)
- [ ] Test document listing
- [ ] Test document deletion

---

## 📝 Next Steps After Deployment

1. ✅ Verify frontend can upload documents
2. ✅ Test deal creation wizard completes
3. 🎯 Add document preview/download endpoints (future)
4. 🎯 Add document thumbnail generation (future)
5. 🎯 Add cloud storage support (S3/GCS) (future)

---

**Created:** 2026-02-20 15:35 EST by RocketMan 🚀  
**Status:** Ready to deploy - all code complete!  
**Deploy Time:** ~5 minutes
