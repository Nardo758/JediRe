# ⚡ Quick Deployment Checklist

**Use this for rapid execution. See DEPLOYMENT-READY.md for full details.**

---

## 🔍 PRE-FLIGHT (5 min)

```bash
cd ~/jedire-repo
git checkout financial-model-full-implementation
git status  # Should be clean
git log --oneline | head -5  # Should show 3af3fa77 at top
```

- [ ] Branch: `financial-model-full-implementation`
- [ ] Working tree: Clean
- [ ] Latest commit: `3af3fa77`
- [ ] ANTHROPIC_API_KEY set: `echo $ANTHROPIC_API_KEY`
- [ ] DATABASE_URL set: `echo $DATABASE_URL`

---

## 💾 BACKUP (2 min)

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p ~/backups
pg_dump $DATABASE_URL > ~/backups/jedire_pre_financial_model_${TIMESTAMP}.sql
ls -lh ~/backups/jedire_pre_financial_model_${TIMESTAMP}.sql
```

- [ ] Backup created
- [ ] File size > 0
- [ ] Location noted: `_____________`

---

## 🗄️ MIGRATIONS (3 min)

```bash
cd ~/jedire-repo/backend/src/database/migrations
psql $DATABASE_URL < 090_financial_models.sql
psql $DATABASE_URL < 091_model_computation_cache.sql
psql $DATABASE_URL < 092_assumption_history.sql
psql $DATABASE_URL < 093_financial_models_backward_compat.sql

# Verify
psql $DATABASE_URL -c "\dt financial_models"
psql $DATABASE_URL -c "\dt model_computation_cache"
psql $DATABASE_URL -c "\dt assumption_history"
```

- [ ] Migration 090 ✅
- [ ] Migration 091 ✅
- [ ] Migration 092 ✅
- [ ] Migration 093 ✅
- [ ] All tables exist ✅
- [ ] No errors in output ✅

---

## 🔀 MERGE (5 min)

```bash
cd ~/jedire-repo
git checkout master
git pull origin master
git merge financial-model-full-implementation --no-ff -m "feat: Financial Model Implementation (Phases 0-11)"
git log --oneline -1  # Should show merge commit
git push origin master
```

- [ ] Switched to master
- [ ] Merged successfully
- [ ] No conflicts
- [ ] Pushed to origin

---

## 🖥️ BACKEND DEPLOY (5 min)

```bash
cd ~/jedire-repo/backend
npm install
npm run build
pm2 restart jedire-backend
pm2 logs jedire-backend --lines 20

# Test
curl http://localhost:3000/api/health
```

- [ ] Dependencies installed
- [ ] Build successful
- [ ] Service restarted
- [ ] Health check passes ✅

---

## 🌐 FRONTEND DEPLOY (5 min)

```bash
cd ~/jedire-repo/frontend
npm install
npm run build
ls -lh dist/

# Deploy (choose one):
# rsync -avz dist/ /var/www/jedire/
# aws s3 sync dist/ s3://jedire-frontend/ --delete
```

- [ ] Build successful
- [ ] Assets deployed
- [ ] Site accessible

---

## 🧪 SMOKE TESTS (10 min)

### API Test
```bash
API_BASE="http://localhost:3000"
TOKEN="YOUR_TOKEN"
DEAL_ID="existing-deal-id"

# Test compute endpoint
curl -X POST "$API_BASE/api/v1/financial-models/$DEAL_ID/compute-claude" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"forceRecompute": true}'
```

- [ ] API returns 200 ✅
- [ ] Model computed successfully ✅
- [ ] Response time < 7s ✅

### UI Test
1. [ ] Navigate to `/deals`
2. [ ] Open any deal
3. [ ] Click "Financial Model" tab
4. [ ] Click "Compute Model"
5. [ ] All 6 tabs display correctly
6. [ ] Edit an assumption → saves successfully

---

## 📊 POST-DEPLOY (5 min)

```bash
# Check logs
pm2 logs jedire-backend --lines 50 | grep -i error

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM financial_models"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM model_computation_cache"

# Check cache
psql $DATABASE_URL -c "SELECT assumptions_hash, hit_count FROM model_computation_cache ORDER BY cached_at DESC LIMIT 5"
```

- [ ] No errors in logs
- [ ] Database records created
- [ ] Cache working
- [ ] Memory usage normal

---

## 🔄 ROLLBACK (If Needed)

### Quick Rollback
```bash
cd ~/jedire-repo
git checkout master
git reset --hard HEAD~1
cd backend && npm install && npm run build && pm2 restart jedire-backend
cd ../frontend && npm install && npm run build
# Deploy frontend
```

### Full Rollback (with DB)
```bash
pm2 stop jedire-backend
psql $DATABASE_URL < ~/backups/jedire_pre_financial_model_TIMESTAMP.sql
cd ~/jedire-repo && git reset --hard <COMMIT_BEFORE_MERGE>
# Rebuild and redeploy
```

---

## ✅ COMPLETION

**Deployment Time:** _______ minutes  
**Issues Encountered:** _______  
**Status:** ✅ Success / ⚠️ Partial / ❌ Rolled Back  

**Deployed By:** _______  
**Date:** _______  
**Notes:** _______

---

## 📞 Emergency Contacts

- Slack: #jedire-deployments
- Email: dev@jedire.com
- On-Call: [Phone]

---

**TOTAL TIME: ~40 minutes (normal deployment)**

See DEPLOYMENT-READY.md for detailed explanations, troubleshooting, and full documentation.
