# WebSocket System - Setup Checklist

Quick reference for deploying the real-time WebSocket system.

---

## ✅ Pre-Deployment Checklist

### Database Setup

- [ ] Run migrations to create tables:
  - [ ] `asset_notes`
  - [ ] `note_replies`
  - [ ] `note_categories`
  - [ ] `asset_note_permissions`
  - [ ] `asset_news_links`

- [ ] Seed default categories:
  ```sql
  INSERT INTO note_categories (name, color, icon, is_system_default, display_order) VALUES
    ('Observation', '#3B82F6', '👁️', true, 1),
    ('Issue', '#EF4444', '⚠️', true, 2),
    ('Opportunity', '#10B981', '💡', true, 3);
  ```

- [ ] Verify indexes exist on:
  - [ ] `asset_notes.asset_id`
  - [ ] `asset_notes.author_id`
  - [ ] `note_replies.note_id`
  - [ ] `asset_note_permissions.asset_id`
  - [ ] `asset_note_permissions.user_id`

### Backend Configuration

- [ ] Environment variables set in `.env`:
  ```env
  WS_CORS_ORIGIN=http://localhost:3000
  WS_PING_INTERVAL=25000
  WS_PING_TIMEOUT=20000
  CORS_ORIGIN=http://localhost:3000
  ```

- [ ] Dependencies installed:
  ```bash
  cd backend
  npm install
  # socket.io should already be installed (v4.6.1)
  ```

- [ ] Files exist:
  - [ ] `backend/src/services/websocket.service.ts`
  - [ ] `backend/src/api/websocket/handlers/assetMap.handler.ts`
  - [ ] `backend/src/api/rest/asset-map-intelligence.routes.ts`
  - [ ] `backend/src/api/websocket/index.ts` (updated)
  - [ ] `backend/src/api/rest/index.ts` (updated)

- [ ] TypeScript compiles without errors:
  ```bash
  npm run build
  ```

### Frontend Configuration

- [ ] Environment variables set in `.env`:
  ```env
  VITE_WS_URL=http://localhost:4000
  ```

- [ ] Dependencies installed:
  ```bash
  cd frontend
  npm install socket.io-client
  ```

- [ ] Files exist:
  - [ ] `frontend/src/services/websocket.client.ts`
  - [ ] `frontend/src/hooks/useAssetUpdates.ts`
  - [ ] `frontend/src/hooks/index.ts` (updated)
  - [ ] `frontend/src/utils/assetMapToasts.ts`

- [ ] TypeScript compiles without errors:
  ```bash
  npm run build
  ```

### Testing

- [ ] Backend starts successfully:
  ```bash
  npm run dev
  # Look for: "🔌 WebSocket server: ws://localhost:4000"
  ```

- [ ] Frontend starts successfully:
  ```bash
  npm run dev
  # Should connect to backend without errors
  ```

- [ ] Health check passes:
  ```bash
  curl http://localhost:4000/health
  # Should return: {"status":"healthy"}
  ```

- [ ] Socket.io endpoint accessible:
  ```bash
  curl http://localhost:4000/socket.io/
  # Should return Socket.io client JavaScript
  ```

---

## 🚀 Deployment Steps

### 1. Backend Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd backend
npm install

# 3. Build TypeScript
npm run build

# 4. Run migrations
npm run migrate

# 5. Restart server
pm2 restart jedire-backend
# or
systemctl restart jedire-backend
```

### 2. Frontend Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd frontend
npm install

# 3. Build production bundle
npm run build

# 4. Deploy to hosting
# (Vercel, Netlify, or your hosting provider)
```

### 3. Verify Deployment

- [ ] Backend health check: `https://api.jedire.com/health`
- [ ] WebSocket connection: Open browser DevTools, check for connection success
- [ ] Create test note, verify real-time sync
- [ ] Check logs for errors:
  ```bash
  pm2 logs jedire-backend | grep WebSocket
  ```

---

## 🔒 Security Checklist

- [ ] JWT authentication enabled
- [ ] CORS configured for production domain
- [ ] Rate limiting enabled (if applicable)
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (input sanitization)
- [ ] HTTPS enforced in production
- [ ] Environment variables secured (not in git)

---

## 📊 Monitoring Setup

### Backend Metrics

Add to monitoring dashboard:

- [ ] WebSocket connection count
- [ ] Active asset rooms
- [ ] Message throughput (messages/second)
- [ ] Error rate
- [ ] Average latency

### Logging

Ensure logs capture:

- [ ] Connection events
- [ ] Authentication failures
- [ ] Broadcast events
- [ ] Error messages

### Alerts

Set up alerts for:

- [ ] WebSocket connection failures > 5%
- [ ] Error rate > 1%
- [ ] Latency > 500ms
- [ ] Memory usage > 80%

---

## 🧪 Post-Deployment Testing

### Smoke Tests

- [ ] Open app, verify connection indicator shows green
- [ ] Create note, verify it appears in database
- [ ] Open two browser windows, verify real-time sync
- [ ] Check logs for errors
- [ ] Verify active connection count increases

### Load Testing (Optional)

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run load-test.yml

# Expected: 100 concurrent connections with < 100ms latency
```

---

## 🔄 Rollback Plan

If deployment fails:

### Quick Rollback

```bash
# 1. Revert backend to previous version
git checkout <previous-commit>
npm install
npm run build
pm2 restart jedire-backend

# 2. Revert frontend
git checkout <previous-commit>
npm run build
# Redeploy
```

### Database Rollback

```sql
-- Drop new tables if needed
DROP TABLE IF EXISTS note_replies CASCADE;
DROP TABLE IF EXISTS asset_notes CASCADE;
DROP TABLE IF EXISTS note_categories CASCADE;
DROP TABLE IF EXISTS asset_note_permissions CASCADE;
DROP TABLE IF EXISTS asset_news_links CASCADE;

-- Restore from backup if needed
pg_restore -d jedire backup.sql
```

---

## 📝 Production Configuration

### Backend `.env` (Production)

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:pass@db.jedire.com:5432/jedire
WS_CORS_ORIGIN=https://app.jedire.com
WS_PING_INTERVAL=25000
WS_PING_TIMEOUT=20000
JWT_SECRET=<secure-secret>
```

### Frontend `.env` (Production)

```env
VITE_API_URL=https://api.jedire.com
VITE_WS_URL=https://api.jedire.com
```

### Nginx Configuration (If applicable)

```nginx
# WebSocket proxy
location /socket.io/ {
  proxy_pass http://localhost:4000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

---

## 🎯 Success Criteria

After deployment, verify:

- [ ] ✅ No errors in logs
- [ ] ✅ WebSocket connections established
- [ ] ✅ Real-time sync working
- [ ] ✅ Permissions enforced
- [ ] ✅ Performance acceptable (< 100ms latency)
- [ ] ✅ No memory leaks (monitor for 24h)
- [ ] ✅ Auto-reconnect working

---

## 📞 Troubleshooting

### Issue: WebSocket won't connect

**Check:**
1. Backend running and accessible
2. Firewall allows WebSocket traffic
3. CORS configured correctly
4. JWT token valid

### Issue: Events not syncing

**Check:**
1. User has permission to asset
2. Note is not private
3. WebSocket connection active
4. No JavaScript errors in console

### Issue: High memory usage

**Check:**
1. Connections being properly closed
2. No memory leaks in handlers
3. Consider connection limits
4. Review logs for stuck connections

---

## 📚 Documentation Links

- [Setup Guide](./ASSET_MAP_WEBSOCKET_GUIDE.md)
- [Testing Guide](./WEBSOCKET_TESTING_GUIDE.md)
- [Implementation Summary](./WEBSOCKET_IMPLEMENTATION_SUMMARY.md)

---

## ✅ Final Checklist

Before marking deployment complete:

- [ ] All pre-deployment checks passed
- [ ] Deployment steps completed
- [ ] Post-deployment tests passed
- [ ] Monitoring configured
- [ ] Team notified of new feature
- [ ] Documentation updated
- [ ] Rollback plan documented

---

**Status: Ready to Deploy** 🚀
