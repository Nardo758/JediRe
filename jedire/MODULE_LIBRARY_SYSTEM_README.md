# Module Library System - Complete Implementation

## Overview
The Module Library System allows users to upload and manage historical data files (Excel, PDF, CSV) that Opus AI will analyze to learn patterns, formulas, and assumptions for generating new pro formas and models.

## What Was Implemented

### ✅ Database Schema (Migration 040)
**File:** `backend/migrations/040_module_libraries.sql`

**Tables Created:**
1. `module_library_files` - Stores uploaded file metadata
2. `opus_learned_patterns` - Patterns extracted by Opus from files
3. `opus_template_structures` - Template structures learned by Opus

**Indexes:**
- User/module lookups
- Category filtering
- Parsing status tracking
- Pattern type searches

### ✅ Backend Service
**File:** `backend/src/services/moduleLibrary.service.ts`

**Features:**
- File upload with validation (Excel, PDF, CSV)
- Automatic file organization by user and module
- Async parsing for Excel files
- Mock pattern detection (ready for Opus integration)
- Learning status aggregation
- File download and deletion

**Key Methods:**
- `uploadFile()` - Upload and store files
- `getFiles()` - List files with category filtering
- `deleteFile()` - Remove files with cleanup
- `getLearningStatus()` - Get AI learning progress
- `parseExcelFileAsync()` - Parse and extract patterns (mocked)

### ✅ Backend API Routes
**File:** `backend/src/api/rest/module-libraries.routes.ts`

**Endpoints:**
```
POST   /api/v1/module-libraries/:module/upload
GET    /api/v1/module-libraries/:module/files
GET    /api/v1/module-libraries/:module/files/:fileId
DELETE /api/v1/module-libraries/:module/files/:fileId
GET    /api/v1/module-libraries/:module/files/:fileId/download
GET    /api/v1/module-libraries/:module/learning-status
POST   /api/v1/module-libraries/:module/analyze
```

**Features:**
- Multer file upload (50 MB max)
- File type validation
- User authentication and authorization
- Error handling and logging

### ✅ Frontend - Main Overview Page
**File:** `frontend/src/pages/settings/ModuleLibrariesPage.tsx`

**Features:**
- Cards for all three modules (Financial, Market, Due Diligence)
- File count and last upload date per module
- Navigation to detail pages
- Information about Opus learning

### ✅ Frontend - Detail Page
**File:** `frontend/src/pages/settings/ModuleLibraryDetailPage.tsx`

**Features:**
- Drag-and-drop file upload
- Category selection for uploads
- File browser with category grouping
- File download and deletion
- Real-time parsing status updates
- Opus learning status dashboard with:
  - Files analyzed progress
  - Patterns detected count
  - Template structures count
  - Pattern details with confidence scores

### ✅ Route Registration
**Files Updated:**
- `backend/src/api/rest/index.ts` - Added module-libraries routes
- `frontend/src/App.tsx` - Added frontend routes
- `frontend/src/pages/SettingsPage.tsx` - Added navigation link

## Setup Instructions

### 1. Database Setup

Run the migration to create required tables:

```bash
# Option 1: Using psql (if available)
cd jedire/backend
psql $DATABASE_URL -f migrations/040_module_libraries.sql

# Option 2: Using the migration script
cd jedire/backend
npx ts-node src/scripts/run-migration.ts 040_module_libraries.sql
```

### 2. Backend Configuration

Ensure your `.env` file has:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/jedire

# File Upload Directory (optional, defaults to /tmp/jedire-uploads)
UPLOAD_DIR=/path/to/uploads
```

### 3. Start Backend

```bash
cd jedire/backend
npm install
npm run dev
```

### 4. Start Frontend

```bash
cd jedire/frontend
npm install
npm run dev
```

### 5. Access the System

Navigate to:
- Main page: `/settings/module-libraries`
- Financial module: `/settings/module-libraries/financial`
- Market module: `/settings/module-libraries/market`
- Due Diligence module: `/settings/module-libraries/due_diligence`

## Module Categories

### Financial Module 💰
- Historical Operating Expenses
- Previous Pro Formas
- Construction Cost Data
- Debt Terms & Structures
- Cap Rate History

### Market Module 📊
- Market Reports
- Proprietary Research
- Comp Data
- Market Trends

### Due Diligence Module ✅
- Checklists
- Template Documents
- Previous DD Files

## File Upload Flow

1. User selects a module (Financial, Market, or Due Diligence)
2. User selects a category from predefined list
3. User drags/drops or selects a file (.xlsx, .xls, .pdf, .csv)
4. File uploads to server
5. Backend saves file and creates database record
6. For Excel files, async parsing begins
7. Mock pattern detection extracts insights (to be replaced with Opus API)
8. Patterns stored in `opus_learned_patterns` table
9. Frontend polls for parsing status updates
10. User sees real-time learning status

## Opus Learning (Current: Mocked)

The system currently uses **mock pattern detection** for demonstration:

**Financial Module Patterns:**
- `opex_per_unit` - Operating expenses per unit
- `rent_growth` - Annual rent growth rate
- `cap_rate` - Capitalization rate

**Market Module Patterns:**
- `vacancy_rate` - Market vacancy rate
- `market_rent_growth` - Market rent growth

**To Integrate Real Opus API:**

Update `backend/src/services/moduleLibrary.service.ts`:

```typescript
// Replace mockPatternDetection() with:
private async realOpusAnalysis(file: ModuleLibraryFile): Promise<any[]> {
  const response = await opusApiClient.analyze({
    filePath: file.filePath,
    module: file.moduleName,
    category: file.category,
  });
  
  return response.patterns;
}
```

## API Usage Examples

### Upload File

```javascript
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('category', 'Previous Pro Formas');

const response = await fetch('/api/v1/module-libraries/financial/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const data = await response.json();
// { fileId: 123, status: 'uploaded', fileName: 'proforma.xlsx', parsingStatus: 'pending' }
```

### Get Files

```javascript
const response = await fetch('/api/v1/module-libraries/financial/files?category=Previous%20Pro%20Formas', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const data = await response.json();
// { files: [...], total: 15 }
```

### Get Learning Status

```javascript
const response = await fetch('/api/v1/module-libraries/financial/learning-status', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const data = await response.json();
/* {
  filesAnalyzed: 15,
  totalFiles: 15,
  patterns: [
    {
      id: 1,
      patternType: 'opex_per_unit',
      patternValue: { avg: 5200, min: 4800, max: 5800, unit: '$/unit/year' },
      confidenceScore: 0.75,
      sampleSize: 10
    }
  ],
  templates: [...]
} */
```

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Backend server starts without errors
- [ ] Module Libraries page loads at `/settings/module-libraries`
- [ ] All three module cards display correctly
- [ ] Clicking a module navigates to detail page
- [ ] Category selector populates with correct categories
- [ ] File drag-and-drop works
- [ ] File upload succeeds and shows in list
- [ ] Parsing status updates in real-time
- [ ] Learning status dashboard shows patterns
- [ ] File download works
- [ ] File deletion works
- [ ] Error handling displays appropriate messages

## Future Enhancements

1. **Real Opus Integration**
   - Replace mock pattern detection with Opus API calls
   - Implement template structure extraction
   - Add formula pattern recognition

2. **Advanced Features**
   - Bulk file upload
   - File versioning
   - Pattern comparison between files
   - Export learned patterns
   - Pattern override/adjustment UI

3. **Collaboration**
   - Share libraries with team members
   - Import/export library packages
   - Library templates marketplace

4. **Analytics**
   - Pattern confidence trends over time
   - Most common patterns across users
   - Accuracy tracking when applied to new deals

## Commit Message

```
Add Module Library System for historical data upload and Opus learning

- Database migration with 3 tables (files, patterns, templates)
- Backend service with file upload, parsing, and pattern detection
- REST API with 7 endpoints for file and learning management
- Frontend main page showing all module libraries
- Frontend detail page with upload, browser, and learning status
- Mock Opus learning (ready for real API integration)
- Settings navigation updated with Module Libraries link
```

## Support

For issues or questions:
1. Check backend logs for error details
2. Verify database connection and migration status
3. Ensure upload directory has write permissions
4. Check browser console for frontend errors
