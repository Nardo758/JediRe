# Documents & Files Module - Testing Guide

## Quick Start

### 1. Run Database Migration

```bash
cd /home/leon/clawd/jedire/backend

# Apply migration
psql $DATABASE_URL -f migrations/019_unified_documents_files.sql

# Verify tables created
psql $DATABASE_URL -c "\dt deal_*"
```

### 2. Start Backend

```bash
cd /home/leon/clawd/jedire/backend
npm install
npm run dev
```

### 3. Start Frontend

```bash
cd /home/leon/clawd/jedire/frontend
npm install
npm run dev
```

### 4. Access the Module

1. Navigate to: `http://localhost:3000`
2. Login with your credentials
3. Go to any deal page
4. Scroll to "Documents & Files" section

## Test Scenarios

### Scenario 1: Basic Upload

**Steps:**
1. Click "⬆ Upload Files" button
2. Drag 2-3 files (PDF, image, Excel) into the drop zone
3. Observe auto-categorization suggestions
4. Click "Upload" button
5. Wait for progress completion

**Expected:**
- Files appear in Grid view
- Categories auto-assigned based on filenames
- Progress bars show 100%
- Success notification displayed
- Storage stats updated

### Scenario 2: Version Control

**Steps:**
1. Upload a file named "appraisal.pdf"
2. Note the version badge (should be blank or v1)
3. Upload another file with the same name "appraisal.pdf"
4. Check the version history

**Expected:**
- Second upload creates v2
- Old version still accessible
- Version history shows both versions
- Latest version marked clearly
- Download links work for both versions

### Scenario 3: Search & Filter

**Steps:**
1. Upload files with different categories
2. Type "appraisal" in search box
3. Select "Financial Analysis" category filter
4. Clear search and select "Draft" status

**Expected:**
- Search narrows results instantly
- Category filter shows only matching files
- Status filter works independently
- Combined filters work together
- Count updates accurately

### Scenario 4: View Modes

**Steps:**
1. Switch to List view
2. Sort by name, size, date
3. Select multiple files
4. Switch to Folder view
5. Navigate folder hierarchy
6. Switch back to Grid view

**Expected:**
- All views show same data
- Sorting works correctly
- Bulk selection persists in List view
- Folder navigation works
- Breadcrumbs update
- No data loss between switches

### Scenario 5: Context-Aware Suggestions

**Test with Pipeline Deal (UNDERWRITING stage):**
1. Create/open a Pipeline deal in UNDERWRITING stage
2. Open Documents & Files section
3. Check "Suggested Documents" banner

**Expected:**
- Shows: Appraisal Report, Rent Roll, T-12, etc.
- Click "Upload" opens upload dialog
- Banner disappears when files uploaded

**Test with Portfolio Deal:**
1. Create/open a Portfolio deal
2. Open Documents & Files section
3. Check suggestions

**Expected:**
- Shows: Current P&L, Leases, Insurance, etc.
- Context different from Pipeline
- Relevant to asset management

### Scenario 6: Storage Analytics

**Steps:**
1. Upload multiple files (vary sizes)
2. Check storage stats cards
3. Upload more files
4. Refresh analytics

**Expected:**
- Total files count increments
- Storage used bar fills proportionally
- Recent activity shows correct counts
- Category breakdown accurate
- All metrics update in real-time

### Scenario 7: File Operations

**Steps:**
1. Download a file
2. Delete a file (verify confirmation)
3. Update file metadata (category, tags, description)
4. Check access log (backend)

**Expected:**
- Download triggers browser download
- Delete requires confirmation
- Metadata updates instantly
- File disappears from list after delete
- Access log records all actions

### Scenario 8: Error Handling

**Test File Too Large:**
1. Try uploading a file > 50 MB

**Expected:**
- Error message: "File too large. Maximum size: 50 MB"
- File rejected
- Other files in batch still upload

**Test Invalid File Type:**
1. Try uploading a .exe or .dmg file

**Expected:**
- Error message: "File type not allowed"
- File rejected

**Test Storage Limit:**
1. Upload files until total > 5 GB

**Expected:**
- Error message: "Deal storage limit exceeded"
- Upload fails
- Existing files unchanged

## API Testing

### Upload File

```bash
curl -X POST http://localhost:3000/api/v1/deals/{dealId}/files \
  -H "Authorization: Bearer {token}" \
  -F "files=@test.pdf" \
  -F "category=financial-analysis" \
  -F "tags=[\"important\",\"2024\"]" \
  -F "description=Test upload"
```

### List Files

```bash
curl http://localhost:3000/api/v1/deals/{dealId}/files \
  -H "Authorization: Bearer {token}"
```

### Search Files

```bash
curl "http://localhost:3000/api/v1/deals/{dealId}/files/search?q=appraisal" \
  -H "Authorization: Bearer {token}"
```

### Get Storage Stats

```bash
curl http://localhost:3000/api/v1/deals/{dealId}/files/stats \
  -H "Authorization: Bearer {token}"
```

### Download File

```bash
curl http://localhost:3000/api/v1/deals/{dealId}/files/{fileId}/download \
  -H "Authorization: Bearer {token}" \
  -O
```

### Delete File

```bash
curl -X DELETE http://localhost:3000/api/v1/deals/{dealId}/files/{fileId} \
  -H "Authorization: Bearer {token}"
```

### Upload New Version

```bash
curl -X POST http://localhost:3000/api/v1/deals/{dealId}/files/{fileId}/versions \
  -H "Authorization: Bearer {token}" \
  -F "file=@test_v2.pdf" \
  -F "versionNotes=Updated with corrections"
```

### Get Version History

```bash
curl http://localhost:3000/api/v1/deals/{dealId}/files/{fileId}/versions \
  -H "Authorization: Bearer {token}"
```

## Performance Testing

### Load Test: Upload Multiple Files

```bash
# Upload 50 files simultaneously
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/v1/deals/{dealId}/files \
    -H "Authorization: Bearer {token}" \
    -F "files=@test${i}.pdf" \
    &
done
wait
```

### Load Test: Search Performance

```bash
# Search 1000 times
for i in {1..1000}; do
  curl "http://localhost:3000/api/v1/deals/{dealId}/files/search?q=test" \
    -H "Authorization: Bearer {token}" \
    -s -o /dev/null -w "%{time_total}\n"
done | awk '{sum+=$1} END {print "Average:", sum/NR, "seconds"}'
```

## Database Verification

### Check Files Table

```sql
SELECT 
  id, 
  original_filename, 
  category, 
  version, 
  file_size,
  created_at
FROM deal_files
WHERE deal_id = '{dealId}'
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### Check Storage Analytics

```sql
SELECT 
  total_files,
  total_size_bytes,
  files_by_category,
  size_by_category,
  computed_at
FROM deal_storage_analytics
WHERE deal_id = '{dealId}';
```

### Check Access Log

```sql
SELECT 
  user_id,
  action,
  accessed_at
FROM deal_file_access_log
WHERE file_id = '{fileId}'
ORDER BY accessed_at DESC
LIMIT 20;
```

### Check Categorization Rules

```sql
SELECT 
  filename_pattern,
  suggested_category,
  deal_category,
  priority
FROM file_categorization_rules
WHERE is_active = true
ORDER BY priority DESC;
```

## Browser Testing

### Chrome
- ✅ Drag & drop works
- ✅ File selection works
- ✅ Progress bars animate
- ✅ Grid layout renders correctly
- ✅ Responsive design works

### Firefox
- ✅ All features work
- ✅ File downloads work
- ✅ UI renders correctly

### Safari
- ✅ Upload works (may need permissions)
- ✅ Drag & drop works
- ✅ HEIC images supported

### Mobile (Responsive)
- ✅ Touch-friendly upload button
- ✅ Grid adapts to small screens
- ✅ List view scrolls horizontally
- ✅ Folder view navigable on mobile

## Troubleshooting

### Issue: Files not uploading

**Check:**
1. Backend server running?
2. Correct API endpoint?
3. Authentication token valid?
4. File size < 50 MB?
5. File type allowed?
6. Disk space available?

### Issue: Categories not auto-detecting

**Check:**
1. Categorization rules seeded?
2. Filename matches pattern?
3. MIME type correct?
4. Deal category set (pipeline/portfolio)?

### Issue: Storage stats not updating

**Check:**
1. Trigger function created?
2. Analytics table has data?
3. Cache cleared?
4. Refresh API call made?

### Issue: Search not finding files

**Check:**
1. File actually exists?
2. Filename matches search query?
3. Full-text index created?
4. Deleted files excluded?

## Success Metrics

✅ **Module is working if:**
- Files upload successfully
- Auto-categorization assigns categories
- All three view modes display files
- Search returns correct results
- Version control creates v2 on duplicate
- Storage analytics display accurately
- Download triggers file download
- Delete removes files (soft delete)
- Context-aware suggestions appear
- No console errors

## Next Steps

After testing:
1. Create production backup
2. Run migration on production DB
3. Deploy backend updates
4. Deploy frontend updates
5. Monitor error logs
6. Collect user feedback
7. Plan Phase 2 enhancements

## Support

For issues or questions:
- Check DOCUMENTS_FILES_MODULE.md
- Review API_REFERENCE.md
- Check backend logs: `backend/logs/`
- Check browser console for frontend errors
