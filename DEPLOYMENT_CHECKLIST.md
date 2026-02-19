# 🚀 Deployment Checklist

## Pre-Deployment (Do This First!)

### 1. Environment Variables ✅
- [ ] Copy `.env.example` to `.env` in backend
- [ ] Copy `.env.example` to `.env` in frontend
- [ ] Set `DATABASE_URL` (PostgreSQL connection string)
- [ ] Set `REDIS_URL` (Redis connection string)
- [ ] Generate secure random strings for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Set `FRONTEND_URL` to your production frontend URL
- [ ] Configure external API keys (Google Maps, Mapbox, etc.)
- [ ] Choose and configure LLM provider (Claude/OpenAI)

**Generate secure secrets:**
```bash
# Generate JWT secrets (use these in your .env)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Database Setup ✅
- [ ] Create production PostgreSQL database
- [ ] Run initial migrations: `npm run migrate`
- [ ] Verify database schema is correct
- [ ] Test database connection: `curl https://your-api.com/health/db`

### 3. Build Verification ✅
- [ ] Run `npm run build` - verify no TypeScript errors
- [ ] Run `npm run deploy:check` - verify build succeeds
- [ ] Test backend build: `cd backend && npm run build`
- [ ] Test frontend build: `cd frontend && npm run build`

### 4. Security Checklist ✅
- [ ] Change all default secrets/passwords
- [ ] Verify JWT secrets are different from examples
- [ ] Set `NODE_ENV=production` in backend
- [ ] Enable HTTPS/SSL in production
- [ ] Configure CORS to only allow your frontend domain
- [ ] Review rate limiting settings

### 5. External Services ✅
- [ ] Set up PostgreSQL database (Railway, Supabase, or similar)
- [ ] Set up Redis instance (Railway, Upstash, or similar)
- [ ] Obtain API keys for external services
- [ ] Configure OAuth callback URLs in Google Console
- [ ] Test email sync (if using Gmail integration)

## Deployment Steps

### Option A: Railway Deployment (Recommended)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create New Project:**
   ```bash
   railway init
   ```

3. **Add PostgreSQL:**
   ```bash
   railway add --plugin postgresql
   ```

4. **Add Redis:**
   ```bash
   railway add --plugin redis
   ```

5. **Set Environment Variables:**
   ```bash
   # Copy from your .env file
   railway variables set JWT_SECRET="your-secret-here"
   railway variables set JWT_REFRESH_SECRET="your-refresh-secret"
   # ... add all other variables from .env.example
   ```

6. **Deploy Backend:**
   ```bash
   cd backend
   railway up
   ```

7. **Deploy Frontend:**
   ```bash
   cd ../frontend
   railway up
   ```

8. **Run Migrations:**
   ```bash
   railway run npm run migrate
   ```

### Option B: Docker Deployment

1. **Build Docker Image:**
   ```bash
   docker build -t jedire-backend:latest -f backend/Dockerfile .
   docker build -t jedire-frontend:latest -f frontend/Dockerfile .
   ```

2. **Run Containers:**
   ```bash
   docker-compose up -d
   ```

3. **Run Migrations:**
   ```bash
   docker exec jedire-backend npm run migrate
   ```

### Option C: Manual/VPS Deployment

1. **Install Dependencies:**
   ```bash
   npm run install:all
   ```

2. **Build Project:**
   ```bash
   npm run build
   ```

3. **Set Up Environment:**
   ```bash
   # Copy .env files to production server
   # Set NODE_ENV=production
   ```

4. **Run Migrations:**
   ```bash
   npm run migrate
   ```

5. **Start Backend:**
   ```bash
   npm run start:prod
   ```

6. **Serve Frontend:**
   ```bash
   # Use nginx or similar to serve frontend/dist/
   ```

## Post-Deployment Verification

### 1. Health Checks ✅
- [ ] Test basic health: `curl https://your-api.com/health`
- [ ] Test database health: `curl https://your-api.com/health/db`
- [ ] Test readiness: `curl https://your-api.com/health/ready`
- [ ] Verify all checks return `200 OK`

### 2. API Testing ✅
- [ ] Test authentication endpoints
- [ ] Test deal creation
- [ ] Test file upload
- [ ] Test WebSocket connections
- [ ] Verify CORS is working from frontend

### 3. Frontend Testing ✅
- [ ] Load the frontend in browser
- [ ] Test login/authentication
- [ ] Test map rendering
- [ ] Test deal creation flow
- [ ] Check browser console for errors

### 4. Monitoring Setup ✅
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Configure health check alerts
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Monitor database connections
- [ ] Monitor API response times

### 5. Performance ✅
- [ ] Test API response times (should be < 500ms)
- [ ] Verify frontend loads quickly (< 3 seconds)
- [ ] Check database query performance
- [ ] Verify WebSocket latency is acceptable
- [ ] Monitor memory usage

## Rollback Procedure

If something goes wrong:

1. **Identify the Issue:**
   - Check logs: `railway logs` or `docker logs`
   - Check health endpoints
   - Review error tracking

2. **Rollback Steps:**
   ```bash
   # Railway
   railway rollback
   
   # Docker
   docker-compose down
   docker-compose up -d --build
   
   # Manual
   # Revert to previous commit
   git revert HEAD
   npm run build
   npm run start:prod
   ```

3. **Database Rollback:**
   - Create database backup before migration
   - Restore from backup if needed:
     ```bash
     pg_restore -d jedire backup.dump
     ```

## Common Issues

### Issue: Database Connection Fails
**Solution:** Verify `DATABASE_URL` is correct and database is accessible

### Issue: JWT Authentication Fails
**Solution:** Ensure `JWT_SECRET` is set and consistent across deployments

### Issue: CORS Errors
**Solution:** Set `CORS_ORIGIN` to your frontend URL

### Issue: WebSocket Connection Fails
**Solution:** Ensure WebSocket endpoint is accessible and not blocked by firewall

### Issue: Migration Fails
**Solution:** Check migration logs, fix SQL errors, run again (migrations are idempotent)

## Maintenance

### Regular Tasks:
- **Daily:** Check health endpoints and error logs
- **Weekly:** Review database performance and query logs
- **Monthly:** Update dependencies and security patches
- **Quarterly:** Review and optimize database indexes

### Backup Schedule:
- Database: Daily automated backups
- Uploads/Files: Daily sync to cloud storage
- Configuration: Version controlled in Git

---

## Need Help?

Check these resources:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [Health Endpoints](#health-endpoints) - Monitoring documentation
