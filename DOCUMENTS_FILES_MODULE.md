# Unified Documents & Files Module

## 🎯 Overview

The Unified Documents & Files Module replaces separate Documents and Files tabs with an intelligent, context-aware system that adapts based on deal type:

- **Pipeline Deals** (pre-purchase): Focus on acquisition documents, due diligence, financial analysis
- **Portfolio Deals** (post-purchase): Focus on operational documents, leases, compliance, maintenance

## 🏗️ Architecture

### Database Layer

**Primary Tables:**
- `deal_files` - Core file storage with versioning, categorization, and metadata
- `deal_file_access_log` - Audit trail of all file operations
- `deal_storage_analytics` - Pre-computed metrics for dashboard display
- `file_categorization_rules` - ML-style rules for auto-categorization

**Key Features:**
- Soft delete support
- Version control (parent_file_id linking)
- Full-text search on filenames, descriptions, and extracted PDF text
- Hierarchical folder structure
- Tag-based organization
- Status tracking (draft/final/archived/expired)
- Required files flagging for closing/compliance

### Backend Services

**File:** `backend/src/services/documentsFiles.service.ts`

**Core Methods:**
```typescript
uploadFile(options)              // Upload with auto-categorization
getFiles(dealId, filters)        // List with comprehensive filtering
getFileById(fileId)              // Get single file details
updateFile(fileId, updates)      // Update metadata
deleteFile(fileId, userId)       // Soft delete
uploadNewVersion(fileId, file)   // Version control
getVersionHistory(fileId)        // Full version tree
searchFiles(dealId, query)       // Full-text search
getStorageAnalytics(dealId)      // Pre-computed stats
suggestCategory(filename, mime)  // Smart categorization
getMissingFileSuggestions(deal)  // Context-aware suggestions
```

### API Routes

**File:** `backend/src/api/rest/documentsFiles.routes.ts`

**Endpoints:**
```
POST   /api/v1/deals/:dealId/files                Upload files
GET    /api/v1/deals/:dealId/files                List files (with filters)
GET    /api/v1/deals/:dealId/files/:fileId        Get file details
GET    /api/v1/deals/:dealId/files/:fileId/download  Download file
PUT    /api/v1/deals/:dealId/files/:fileId        Update metadata
DELETE /api/v1/deals/:dealId/files/:fileId        Delete file
POST   /api/v1/deals/:dealId/files/:fileId/versions  Upload new version
GET    /api/v1/deals/:dealId/files/:fileId/versions  Version history
GET    /api/v1/deals/:dealId/files/search         Search files
GET    /api/v1/deals/:dealId/files/stats          Storage analytics
GET    /api/v1/deals/:dealId/files/categories     Available categories
```

### Frontend Components

**Main Component:** `frontend/src/components/deal/sections/DocumentsFilesSection.tsx`

**Sub-Components:**
```
DocumentsFiles/
├── FileUpload.tsx              # Drag & drop upload with progress
├── GridView.tsx                # Visual cards with thumbnails
├── ListView.tsx                # Sortable table with bulk actions
├── FolderView.tsx              # Hierarchical folder navigation
├── SearchFilters.tsx           # Full-text search + filters
├── StorageStats.tsx            # Visual analytics dashboard
├── MissingFileSuggestions.tsx  # Context-aware file suggestions
└── utils.ts                    # Helper functions
```

## 🎨 Features

### 1. **Three View Modes**

#### Grid View
- Visual cards with thumbnails for images
- Category badges with color coding
- Quick actions (download, delete)
- Version badges
- Required file indicators
- Tag display

#### List View
- Sortable table (name, size, date, category)
- Bulk selection with "Select All"
- Bulk delete operations
- Version history column
- Compact display for many files

#### Folder View
- Hierarchical folder navigation
- Breadcrumb trail for easy navigation
- Folder-based organization
- Drag & drop support (future enhancement)

### 2. **Smart Upload System**

**Features:**
- Drag & drop zone
- Multiple file upload (up to 10 files, 50 MB each)
- Real-time progress indicators
- Auto-categorization based on filename and MIME type
- Manual category override
- Tag support (comma-separated)
- Description field
- Version detection (auto-detects duplicates)

**Supported File Types:**
- Documents: PDF, DOC, DOCX, TXT
- Spreadsheets: XLS, XLSX, CSV
- Presentations: PPT, PPTX
- Images: JPG, PNG, GIF, WEBP, HEIC
- Archives: ZIP

### 3. **Version Control**

- Automatic duplicate detection
- Version tree linking (parent_file_id)
- Version history viewer
- "Replace or Save as v2" options
- Version notes support
- Rollback capability

### 4. **Smart Categorization**

**Pipeline Categories:**
- acquisition
- financial-analysis
- due-diligence
- property-info
- correspondence
- financing
- legal-preliminary

**Portfolio Categories:**
- legal
- financial
- leasing
- operations
- property-media
- marketing
- compliance
- maintenance
- tenant-files

**Shared Categories:**
- contracts
- reports
- presentations
- photos
- other

**Auto-Categorization Rules:**
Regex-based pattern matching on:
- Filename patterns (e.g., "appraisal", "rent roll", "T-12")
- MIME types
- Deal stage context
- Confidence scoring (0.00-1.00)

### 5. **Context-Aware Suggestions**

**Pipeline (UNDERWRITING stage):**
- Appraisal Report
- Rent Roll (T-12)
- Operating Statements
- Property Inspection Report
- Environmental Phase I

**Pipeline (UNDER_CONTRACT stage):**
- Purchase & Sale Agreement
- Title Commitment
- Property Survey
- Loan Term Sheet

**Portfolio:**
- Current Month P&L
- Active Lease Agreements
- Insurance Certificates
- Recent Inspection Reports

### 6. **Storage Analytics**

Real-time metrics:
- Total files count
- Storage used (with progress bar)
- Files with versions
- Required files count
- Recent activity (7 days, 30 days)
- Files by category breakdown
- Size by category breakdown
- Most active uploader
- Expired files count

### 7. **Search & Filtering**

**Full-Text Search:**
- Filename matching
- Description search
- Extracted PDF text search (future)

**Filters:**
- Category dropdown (context-aware)
- Status filter (draft, final, archived, expired)
- Date range picker
- Tag selection
- Folder path filtering
- "Latest versions only" toggle

### 8. **Access Control & Audit**

**Access Log Tracking:**
- Viewed
- Downloaded
- Shared
- Deleted
- Uploaded
- Edited

**Audit Fields:**
- IP address
- User agent
- Timestamp
- User ID

## 🚀 Usage

### Basic Upload

```typescript
// 1. User drags files to drop zone or clicks browse
// 2. System auto-categorizes based on rules
// 3. User can override category and add tags/description
// 4. Files upload with progress indicators
// 5. Success notification with file count
```

### Version Control

```typescript
// 1. User uploads file with same name as existing
// 2. System detects duplicate and creates v2
// 3. Old version marked as not latest
// 4. Version history accessible via UI
// 5. Download any version from history
```

### Search & Filter

```typescript
// 1. User types in search box
// 2. System searches filename + description + extracted text
// 3. User applies category/status filters
// 4. Results update in real-time
// 5. Filtered count displayed
```

### Folder Organization

```typescript
// 1. User switches to Folder view
// 2. Breadcrumb shows current path
// 3. Click folder to navigate
// 4. Click breadcrumb to go back
// 5. Files shown in current folder only
```

## 📊 Database Schema Summary

```sql
deal_files (
  id, deal_id, filename, original_filename, file_path, file_size,
  mime_type, file_extension, category, folder_path, tags[],
  version, parent_file_id, is_latest_version, version_notes,
  status, is_required, expiration_date, description,
  auto_category_confidence, extracted_text, thumbnail_path,
  uploaded_by, shared_with[], is_public,
  created_at, updated_at, deleted_at
)

deal_file_access_log (
  id, file_id, user_id, action, ip_address, user_agent, accessed_at
)

deal_storage_analytics (
  id, deal_id, total_files, total_size_bytes,
  files_by_category, size_by_category,
  total_versions, files_with_versions,
  files_uploaded_last_7d, files_uploaded_last_30d,
  most_active_uploader_id, required_files_count,
  missing_required_files[], expired_files_count, computed_at
)

file_categorization_rules (
  id, filename_pattern, mime_type_pattern, suggested_category,
  confidence_threshold, deal_stage[], deal_category[],
  description, is_active, priority, created_at, updated_at
)
```

## 🔧 Configuration

### Environment Variables

```bash
UPLOAD_PATH=./uploads              # Base upload directory
MAX_FILE_SIZE=52428800             # 50 MB
MAX_TOTAL_STORAGE_PER_DEAL=5368709120  # 5 GB
```

### File Storage Structure

```
uploads/
└── deals/
    └── {dealId}/
        ├── abc123def456.pdf
        ├── 789xyz012mno.jpg
        └── ...
```

## 🧪 Testing

### Manual Testing

1. **Upload Test:**
   ```bash
   # Upload a mix of files (PDF, images, Excel)
   # Verify auto-categorization
   # Check progress indicators
   ```

2. **Version Test:**
   ```bash
   # Upload same filename twice
   # Verify v2 creation
   # Check version history
   ```

3. **Search Test:**
   ```bash
   # Upload files with different names
   # Search by partial filename
   # Verify results
   ```

4. **View Mode Test:**
   ```bash
   # Switch between Grid/List/Folder
   # Verify display consistency
   # Check responsive layout
   ```

### API Testing

```bash
# Upload file
curl -X POST http://localhost:3000/api/v1/deals/{dealId}/files \
  -H "Authorization: Bearer {token}" \
  -F "files=@test.pdf" \
  -F "category=financial-analysis"

# List files
curl http://localhost:3000/api/v1/deals/{dealId}/files?category=acquisition

# Get stats
curl http://localhost:3000/api/v1/deals/{dealId}/files/stats

# Download file
curl http://localhost:3000/api/v1/deals/{dealId}/files/{fileId}/download -O

# Delete file
curl -X DELETE http://localhost:3000/api/v1/deals/{dealId}/files/{fileId}
```

## 🎯 Success Criteria

✅ **Completed:**
- [x] Database migration created
- [x] Backend service with 8 endpoints
- [x] Smart categorization with regex rules
- [x] Frontend components (Grid/List/Folder views)
- [x] Drag & drop upload with progress
- [x] Version control support
- [x] Storage analytics dashboard
- [x] Context-aware file suggestions
- [x] Full-text search
- [x] Integration with DealPage
- [x] Comprehensive documentation

## 📝 Future Enhancements

### Phase 2 (Short-term)
- [ ] PDF text extraction for searchable content
- [ ] Thumbnail generation for images
- [ ] Drag & drop file organization between folders
- [ ] Bulk move operations
- [ ] Export folder as ZIP
- [ ] File sharing via email
- [ ] Permission management (view/edit/download)

### Phase 3 (Medium-term)
- [ ] OCR for scanned documents
- [ ] AI-powered document summarization
- [ ] Duplicate detection (hash-based)
- [ ] Smart file recommendations based on deal stage
- [ ] Integration with email attachments
- [ ] Document comparison tool
- [ ] Annotation support for PDFs

### Phase 4 (Long-term)
- [ ] Real-time collaboration on documents
- [ ] E-signature integration
- [ ] Document approval workflows
- [ ] Compliance tracking and alerts
- [ ] Integration with DocuSign/Adobe Sign
- [ ] Advanced analytics and insights
- [ ] Machine learning for smarter categorization

## 🐛 Known Issues

None at initial release.

## 📚 Related Documentation

- [Architecture Review](./JEDI_RE_ARCHITECTURAL_REVIEW.md)
- [API Reference](./API_REFERENCE.md)
- [Database Schema](./JEDI_DATA_SCHEMA.md)
- [File Upload System](./FILE_UPLOAD_SYSTEM_DOCS.md)

## 👥 Contributors

- AI Agent - Complete module development
- Date: 2025-02-12

## 📄 License

Proprietary - JEDI RE Platform
