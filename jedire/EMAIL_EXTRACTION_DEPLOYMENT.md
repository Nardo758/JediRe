# Email Extraction Deployment Checklist

## Pre-Deployment Verification

### 1. Database Schema
- [ ] `property_extraction_queue` table exists
- [ ] `news_items` table exists
- [ ] `emails` table has `raw_data` JSONB column
- [ ] `user_acquisition_preferences` table exists
- [ ] `user_email_accounts` table exists

```bash
# Verify tables
psql -d jedire -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('property_extraction_queue', 'news_items', 'emails', 'user_acquisition_preferences', 'user_email_accounts');"
```

### 2. Environment Variables
- [ ] `MAPBOX_TOKEN` set (for geocoding)
- [ ] `GOOGLE_CLIENT_ID` set (Gmail OAuth)
- [ ] `GOOGLE_CLIENT_SECRET` set (Gmail OAuth)
- [ ] `GOOGLE_GMAIL_CALLBACK_URL` set (OAuth redirect)
- [ ] LLM service configured (Claude/GPT)

```bash
# Check .env
grep -E "MAPBOX_TOKEN|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOOGLE_GMAIL_CALLBACK_URL" .env
```

### 3. Dependencies
- [ ] All npm packages installed
- [ ] LLM service is running
- [ ] Mapbox geocoding API accessible
- [ ] Gmail API credentials valid

```bash
cd backend
npm install
npm run build
```

### 4. Code Files Present
- [ ] `backend/src/services/email-classification.service.ts`
- [ ] `backend/src/services/email-news-extraction.service.ts`
- [ ] `backend/src/api/rest/email-extractions.routes.ts`
- [ ] `frontend/src/components/outlook/ExtractionBadges.tsx`
- [ ] Updated `gmail-sync.service.ts`
- [ ] Updated `EmailInbox.tsx`

---

## Deployment Steps

### Backend Deployment

#### 1. Build and Test
```bash
cd /home/leon/clawd/jedire/backend

# Install dependencies
npm install

# Run TypeScript build
npm run build

# Run tests (if configured)
npm test email-extraction.test.ts
```

#### 2. Database Migrations
```bash
# If migrations needed
npm run migrate

# Verify tables
psql -d jedire -c "\dt *extraction*"
psql -d jedire -c "\dt news_items"
```

#### 3. Restart Backend
```bash
# PM2
pm2 restart jedire-backend

# Or systemd
sudo systemctl restart jedire-backend

# Or Docker
docker-compose restart backend
```

#### 4. Verify API Routes
```bash
# Check routes are registered
curl http://localhost:5000/api/v1/email-extractions/stats/summary \
  -H "Authorization: Bearer $TOKEN"
```

---

### Frontend Deployment

#### 1. Build Frontend
```bash
cd /home/leon/clawd/jedire/frontend

# Install dependencies
npm install

# Build production bundle
npm run build
```

#### 2. Deploy Build
```bash
# Copy to nginx/web server
cp -r build/* /var/www/jedire/

# Or deploy to cloud
# (S3, Cloudflare Pages, Vercel, etc.)
```

#### 3. Clear Browser Cache
```bash
# Force users to reload
# Bump version in package.json or index.html
```

---

## Post-Deployment Testing

### 1. Gmail Connection Test
```bash
# Test OAuth flow
1. Go to Settings → Email Accounts
2. Click "Connect Gmail"
3. Verify OAuth redirect works
4. Verify account appears in list
```

### 2. Email Sync Test
```bash
# Manual sync test
curl -X POST http://localhost:5000/api/v1/gmail/sync/$ACCOUNT_ID \
  -H "Authorization: Bearer $TOKEN"

# Check sync logs
psql -d jedire -c "SELECT * FROM email_sync_logs ORDER BY sync_started_at DESC LIMIT 5;"
```

### 3. Classification Test
```bash
# Test with sample email
curl -X POST http://localhost:5000/api/v1/test/classify-email \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Off-Market: 200-Unit Multifamily - Austin, TX",
    "body": "200-unit apartment complex, $25M, 6.5% cap rate",
    "from": "broker@cbre.com"
  }'
```

### 4. Property Extraction Test
```bash
# Send test email to connected Gmail
# Wait for sync (or trigger manual sync)
# Check extraction queue

curl http://localhost:5000/api/v1/email-extractions/list/properties \
  -H "Authorization: Bearer $TOKEN"
```

### 5. News Extraction Test
```bash
# Test news extraction
# (similar to property test)

curl http://localhost:5000/api/v1/email-extractions/list/news \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Frontend UI Test
```
1. Open Inbox
2. Verify badges appear on emails
3. Click "Approve" on extraction
4. Verify pin created
5. Click "View on Map"
6. Verify pin appears on map
```

---

## Monitoring

### Key Metrics to Watch

#### 1. Extraction Success Rate
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM property_extraction_queue
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

#### 2. Extraction Confidence
```sql
SELECT 
  ROUND(AVG(extraction_confidence), 2) as avg_confidence,
  MIN(extraction_confidence) as min_confidence,
  MAX(extraction_confidence) as max_confidence
FROM property_extraction_queue
WHERE created_at > NOW() - INTERVAL '7 days';
```

#### 3. Preference Match Scores
```sql
SELECT 
  ROUND(AVG(preference_match_score), 2) as avg_match_score,
  COUNT(*) FILTER (WHERE preference_match_score >= 0.8) as high_matches,
  COUNT(*) FILTER (WHERE preference_match_score < 0.5) as low_matches
FROM property_extraction_queue
WHERE created_at > NOW() - INTERVAL '7 days';
```

#### 4. Sync Performance
```sql
SELECT 
  sync_status,
  COUNT(*) as count,
  ROUND(AVG(messages_fetched), 0) as avg_fetched,
  ROUND(AVG(messages_stored), 0) as avg_stored
FROM email_sync_logs
WHERE sync_started_at > NOW() - INTERVAL '7 days'
GROUP BY sync_status;
```

#### 5. Error Logs
```bash
# Backend logs
tail -f /var/log/jedire-backend.log | grep -i "extraction\|error"

# PM2 logs
pm2 logs jedire-backend --lines 100 | grep -i extraction
```

---

## Troubleshooting

### Issue: No extractions appearing

**Check:**
1. Gmail sync is running: `SELECT * FROM email_sync_logs ORDER BY sync_started_at DESC LIMIT 1;`
2. LLM service is up: `curl http://localhost:11434/api/generate` (if Ollama)
3. Backend logs for errors: `pm2 logs jedire-backend`
4. User has preferences set: `SELECT * FROM user_acquisition_preferences WHERE user_id = 'XXX';`

**Fix:**
- Restart LLM service
- Manually trigger sync
- Check LLM API keys/credentials

---

### Issue: All extractions failing

**Check:**
1. LLM service response format
2. Network connectivity to LLM API
3. Rate limits on LLM API
4. Geocoding service (Mapbox)

**Fix:**
- Verify LLM prompts in `email-property-automation.service.ts`
- Check Mapbox token is valid
- Review extraction confidence thresholds

---

### Issue: False positives

**Check:**
1. Keyword patterns in `email-classification.service.ts`
2. Confidence thresholds
3. User preferences are correct

**Fix:**
- Adjust keyword patterns
- Raise confidence threshold
- Update user preferences
- Add sender filters (future)

---

### Issue: Geocoding failures

**Check:**
1. Mapbox token: `echo $MAPBOX_TOKEN`
2. Address format in extractions
3. Mapbox API quota

**Fix:**
- Verify Mapbox token is valid
- Check address extraction format
- Upgrade Mapbox plan if quota exceeded

---

## Rollback Plan

If critical issues arise:

### 1. Disable Auto-Extraction
```sql
-- Stop automatic extraction during sync
UPDATE user_acquisition_preferences
SET auto_create_on_match = false;
```

### 2. Revert Gmail Sync Service
```bash
git revert <commit-hash>
npm run build
pm2 restart jedire-backend
```

### 3. Restore Previous Build
```bash
# Restore last known good backend
cp -r /backup/jedire-backend-YYYY-MM-DD/* /home/leon/clawd/jedire/backend/
pm2 restart jedire-backend

# Restore last known good frontend
cp -r /backup/jedire-frontend-YYYY-MM-DD/* /var/www/jedire/
```

---

## Success Criteria

- [ ] Gmail sync continues to work normally
- [ ] Property emails are classified correctly (>85% accuracy)
- [ ] News emails are classified correctly (>80% accuracy)
- [ ] High-confidence properties auto-create pins (>80% match)
- [ ] Medium-confidence properties go to review queue
- [ ] Low-confidence properties are filtered out
- [ ] Inbox UI shows badges correctly
- [ ] Approve/reject actions work
- [ ] Map pins are created with correct data
- [ ] No performance degradation in sync speed
- [ ] No database errors or crashes
- [ ] User can disable auto-extraction if desired

---

## Training & Documentation

### User Training
- [ ] Share user guide: `docs/user-guide/EMAIL_EXTRACTION_USER_GUIDE.md`
- [ ] Create video walkthrough
- [ ] Update in-app help tooltips
- [ ] Send announcement email to users

### Developer Onboarding
- [ ] Share architecture doc: `EMAIL_EXTRACTION_INTEGRATION.md`
- [ ] Share API reference: `docs/api/EMAIL_EXTRACTIONS_API.md`
- [ ] Review code with team
- [ ] Add to internal wiki

---

## Next Steps (Future Enhancements)

After successful deployment:
1. Monitor for 1 week, collect feedback
2. Implement sender whitelist/blocklist
3. Add attachment parsing (OM PDFs)
4. Improve ML model with user feedback
5. Add bulk approve/reject
6. Support Outlook/Microsoft 365

---

**Deployment Date:** _______________

**Deployed By:** _______________

**Status:** _______________

**Notes:**
_______________________________________________
_______________________________________________
_______________________________________________
