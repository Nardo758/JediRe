# Deployment Checklist - Financial Model Implementation

**Branch:** `financial-model-full-implementation`  
**Target:** Production deployment  
**Estimated Time:** 2-3 hours

---

## Pre-Deployment

### Code Review
- [ ] All phases complete (0-8)
- [ ] Branch up to date with main
- [ ] No merge conflicts
- [ ] TypeScript compiles without errors
- [ ] No console errors in dev mode
- [ ] All tests passing (when run)

### Environment Setup
- [ ] Claude API key configured (`ANTHROPIC_API_KEY`)
- [ ] Database connection string updated
- [ ] Environment variables set (production)
- [ ] SSL certificates valid
- [ ] CDN configured (if using)

### Database

#### Backup
```bash
# Create backup before migration
pg_dump -h $DB_HOST -U $DB_USER -d jedire_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
wc -l backup_*.sql
```

#### Migrations
```bash
# Run migrations (in order)
psql -h $DB_HOST -U $DB_USER -d jedire_prod < backend/src/database/migrations/090_financial_models.sql
psql -h $DB_HOST -U $DB_USER -d jedire_prod < backend/src/database/migrations/091_model_computation_cache.sql
psql -h $DB_HOST -U $DB_USER -d jedire_prod < backend/src/database/migrations/092_assumption_history.sql
psql -h $DB_HOST -U $DB_USER -d jedire_prod < backend/src/database/migrations/093_financial_models_backward_compat.sql

# Verify tables created
psql -h $DB_HOST -U $DB_USER -d jedire_prod -c "\dt financial*"
psql -h $DB_HOST -U $DB_USER -d jedire_prod -c "\dt model_computation_cache"
psql -h $DB_HOST -U $DB_USER -d jedire_prod -c "\dt assumption_history"
```

#### Schema Validation
- [ ] `financial_models` table exists with all columns
- [ ] `model_computation_cache` table exists
- [ ] `assumption_history` table exists
- [ ] Indexes created correctly
- [ ] Foreign keys working
- [ ] Check constraints valid

---

## Deployment Steps

### 1. Backend Deployment

```bash
cd ~/jedire-repo
git checkout financial-model-full-implementation
git pull origin financial-model-full-implementation

# Install dependencies
cd backend
npm install

# Build
npm run build

# Run tests (optional but recommended)
npm test

# Start/restart service
pm2 restart jedire-backend
# OR
npm run start:prod
```

#### Verify Backend
- [ ] Server starts without errors
- [ ] Health check endpoint responds: `GET /api/health`
- [ ] Financial models endpoints accessible:
  - `GET /api/v1/financial-models` (should return empty array or existing models)
  - `POST /api/v1/financial-models` (test with dummy data)
- [ ] No errors in logs: `pm2 logs jedire-backend`

### 2. Frontend Deployment

```bash
cd ~/jedire-repo/frontend
npm install

# Build
npm run build

# Deploy to static server
rsync -avz dist/ user@server:/var/www/jedire/
# OR copy to S3/CDN
aws s3 sync dist/ s3://jedire-frontend/
```

#### Verify Frontend
- [ ] Build completed without errors
- [ ] Bundle size reasonable (<2MB total)
- [ ] Assets uploaded to CDN
- [ ] No 404s for static assets
- [ ] Console has no errors

### 3. Smoke Tests

#### Backend API Tests
```bash
# Test endpoints with curl or Postman

# 1. List models
curl -X GET https://api.jedire.com/api/v1/financial-models \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Create test deal
curl -X POST https://api.jedire.com/api/v1/deals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Deal", "address": "123 Test St"}'

# 3. Compute financial model
DEAL_ID="<from step 2>"
curl -X POST https://api.jedire.com/api/v1/financial-models/$DEAL_ID/compute-claude \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"forceRecompute": true}'

# 4. Fetch output
curl -X GET https://api.jedire.com/api/v1/financial-models/$DEAL_ID/claude-output \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Validate
curl -X POST https://api.jedire.com/api/v1/financial-models/$DEAL_ID/validate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Frontend UI Tests
- [ ] Navigate to `/deals` - loads without errors
- [ ] Create new deal - form works
- [ ] Open deal detail - data displays
- [ ] Navigate to financial model viewer - `/deals/:id/financial-model`
- [ ] Click "Compute Model" - triggers API call
- [ ] All 6 tabs render:
  - [ ] Summary tab shows metrics
  - [ ] Projections tab shows table
  - [ ] Debt tab shows structure
  - [ ] Waterfall tab shows tiers
  - [ ] Sensitivity tab shows heat map
  - [ ] Assumptions tab allows editing
- [ ] Edit assumption - saves successfully
- [ ] Recompute button - invalidates cache

---

## Post-Deployment

### Monitoring

#### Check Logs
```bash
# Backend logs
pm2 logs jedire-backend --lines 100

# Look for:
# - Startup messages
# - API requests
# - Claude API calls
# - Database queries
# - Errors/warnings
```

#### Database Health
```sql
-- Check for new records
SELECT COUNT(*) FROM financial_models;
SELECT COUNT(*) FROM model_computation_cache;
SELECT COUNT(*) FROM assumption_history;

-- Check recent activity
SELECT * FROM financial_models ORDER BY created_at DESC LIMIT 10;
SELECT * FROM assumption_history ORDER BY changed_at DESC LIMIT 20;

-- Cache hit rate
SELECT 
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry
FROM model_computation_cache;
```

#### Performance Metrics
- [ ] API response times < 200ms (cached)
- [ ] Claude compute time < 5s
- [ ] Frontend load time < 2s
- [ ] No memory leaks (check PM2)
- [ ] Database queries optimized (no N+1)

### User Communication

#### Announcement
```
🎉 New Feature: AI-Powered Financial Modeling

We've launched Claude-powered financial modeling! You can now:
- Generate complete pro formas in seconds
- See 10-year projections automatically
- Track assumption sources (broker/platform/user)
- Validate models with built-in checks

Try it: Open any deal → Click "Financial Model" → Hit "Compute"

Questions? Check the docs or reach out to support.
```

#### Training Materials
- [ ] Create video walkthrough (5-10 min)
- [ ] Update help docs
- [ ] Add tooltips to UI
- [ ] Schedule team training session

---

## Rollback Plan

If critical issues arise:

### Quick Rollback (< 5 minutes)
```bash
# 1. Deploy previous version
git checkout main
pm2 restart jedire-backend

# 2. Revert frontend
aws s3 sync s3://jedire-frontend-backup/ s3://jedire-frontend/
# OR
rsync -avz /var/www/jedire-backup/ /var/www/jedire/
```

### Full Rollback (if DB corrupted)
```bash
# 1. Stop services
pm2 stop jedire-backend

# 2. Restore database
psql -h $DB_HOST -U $DB_USER -d jedire_prod < backup_YYYYMMDD_HHMMSS.sql

# 3. Drop new tables (if needed)
psql -h $DB_HOST -U $DB_USER -d jedire_prod -c "
  DROP TABLE assumption_history CASCADE;
  DROP TABLE model_computation_cache CASCADE;
  ALTER TABLE financial_models DROP COLUMN IF EXISTS claude_output;
  ALTER TABLE financial_models DROP COLUMN IF EXISTS validation;
"

# 4. Deploy previous version
git checkout main
npm run build
pm2 restart jedire-backend
```

---

## Success Criteria

### Technical
- [x] All migrations run successfully
- [ ] No errors in production logs
- [ ] API endpoints respond correctly
- [ ] Frontend loads without console errors
- [ ] Tests pass (when run)
- [ ] Cache working (hit rate > 50% after 24h)
- [ ] Performance metrics met

### Business
- [ ] At least 1 model computed successfully
- [ ] Users can view all 6 tabs
- [ ] Assumptions can be edited
- [ ] Validation works correctly
- [ ] No data loss or corruption
- [ ] Support tickets < 5 in first week

---

## Troubleshooting

### Common Issues

#### "Claude API timeout"
```bash
# Check API key
echo $ANTHROPIC_API_KEY

# Check network
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"

# Increase timeout in claude-compute.service.ts
```

#### "Database connection failed"
```bash
# Verify connection string
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='jedire_prod'"
```

#### "Cache not working"
```sql
-- Check cache entries
SELECT * FROM model_computation_cache WHERE expires_at > NOW();

-- Clear expired entries
DELETE FROM model_computation_cache WHERE expires_at < NOW();
```

#### "Frontend 404 errors"
- Check CDN invalidation
- Verify asset paths in build
- Check nginx/apache config
- Clear browser cache

---

## Contact

**On-Call:** Development team  
**Slack:** #jedire-support  
**Email:** dev@jedire.com  

**Emergency Rollback:** Follow rollback plan above, notify team immediately

---

## Checklist Summary

- [ ] Pre-deployment checks complete
- [ ] Database backed up
- [ ] Migrations run successfully
- [ ] Backend deployed and verified
- [ ] Frontend deployed and verified
- [ ] Smoke tests passed
- [ ] Monitoring active
- [ ] User communication sent
- [ ] Rollback plan ready
- [ ] Success criteria met

**Deployment Status:** ⏳ Pending / ✅ Complete / ❌ Rolled Back

**Notes:**
_[Add deployment notes here]_

---

**Good luck! 🚀**
