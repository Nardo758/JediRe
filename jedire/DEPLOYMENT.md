# 🚀 JEDI RE Deployment Guide

Complete guide for deploying JEDI RE to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Deployment Options](#deployment-options)
4. [Database Migrations](#database-migrations)
5. [Monitoring & Logging](#monitoring--logging)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & Services

- **Database:** PostgreSQL 14+ instance
  - Railway PostgreSQL (recommended)
  - Supabase
  - AWS RDS
  - Self-hosted

- **Cache:** Redis instance
  - Railway Redis (recommended)
  - Upstash
  - AWS ElastiCache
  - Self-hosted

- **Deployment Platform:**
  - Railway (recommended - easiest)
  - Docker / Docker Compose
  - Any VPS (DigitalOcean, AWS, etc.)

### Required API Keys

1. **Authentication:**
   - Google OAuth credentials (for login)
   - JWT secrets (generate your own)

2. **Mapping Services (choose one or both):**
   - Mapbox Access Token
   - Google Maps API Key

3. **LLM Provider (choose one):**
   - Anthropic Claude API Key (recommended)
   - OpenAI API Key
   - OpenRouter API Key

4. **Property Data (optional):**
   - Regrid API Key (for property records)

### System Requirements

- Node.js 18+ 
- npm 9+
- PostgreSQL client (for migrations)
- Git

---

## Environment Setup

### Step 1: Generate Secure Secrets

```bash
# Generate two random secrets for JWT
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

Copy these values - you'll need them for your environment configuration.

### Step 2: Backend Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

**Required Variables:**
```env
# Server
NODE_ENV=production
PORT=3000

# Database (from your PostgreSQL provider)
DATABASE_URL=postgresql://user:password@host:port/database

# Redis (from your Redis provider)
REDIS_URL=redis://host:port

# JWT (use the generated secrets from Step 1)
JWT_SECRET=your-generated-secret-here
JWT_REFRESH_SECRET=your-generated-refresh-secret-here

# Frontend URL (your production frontend domain)
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGIN=https://your-frontend-domain.com
```

**External APIs (configure as needed):**
```env
# Mapping (choose one or both)
MAPBOX_ACCESS_TOKEN=pk.ey...
GOOGLE_MAPS_API_KEY=AIza...

# LLM (choose one)
CLAUDE_API_KEY=sk-ant-...
# OR
OPENAI_API_KEY=sk-...

# Google OAuth (for authentication)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Step 3: Frontend Environment Variables

Copy `frontend/.env.example` to `frontend/.env` and configure:

```env
# API Configuration
VITE_API_URL=https://your-backend-domain.com
VITE_WS_URL=wss://your-backend-domain.com

# Environment
VITE_ENVIRONMENT=production

# Mapbox (must match backend token)
VITE_MAPBOX_ACCESS_TOKEN=pk.ey...
```

---

## Deployment Options

### Option A: Railway (Recommended - Easiest)

Railway provides managed PostgreSQL, Redis, and automatic deployments.

#### 1. Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

#### 2. Create New Project

```bash
# In your project root
railway init

# Link to existing project (if already created)
railway link
```

#### 3. Add Services

```bash
# Add PostgreSQL
railway add --plugin postgresql

# Add Redis
railway add --plugin redis
```

Railway will automatically set `DATABASE_URL` and `REDIS_URL` environment variables.

#### 4. Set Environment Variables

```bash
# Set backend variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="your-secret-here"
railway variables set JWT_REFRESH_SECRET="your-refresh-secret"
railway variables set FRONTEND_URL="https://your-frontend.railway.app"
railway variables set CORS_ORIGIN="https://your-frontend.railway.app"

# Add API keys
railway variables set MAPBOX_ACCESS_TOKEN="pk.ey..."
railway variables set CLAUDE_API_KEY="sk-ant-..."

# See all variables
railway variables
```

#### 5. Deploy Backend

```bash
cd backend
railway up

# Or use Git-based deployment
git push railway main
```

Railway will automatically:
- Install dependencies
- Build TypeScript
- Run migrations (via `Procfile` release command)
- Start the server
- Set up health checks

#### 6. Deploy Frontend

```bash
cd ../frontend
railway up
```

Or create a separate Railway service for the frontend.

#### 7. Verify Deployment

```bash
# Check backend health
curl https://your-backend.railway.app/health

# Check frontend
open https://your-frontend.railway.app
```

#### 8. Set Up Custom Domains (Optional)

In Railway dashboard:
- Go to your service settings
- Add custom domain
- Update DNS records as instructed
- Update `FRONTEND_URL` and `CORS_ORIGIN` environment variables

---

### Option B: Docker Deployment

Perfect for VPS, AWS EC2, or any Docker-compatible hosting.

#### 1. Create Environment File

```bash
# Create .env file with all variables
cp backend/.env.example .env
# Edit .env with your values
```

#### 2. Build and Run

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

This starts:
- PostgreSQL database
- Redis cache
- Backend API
- Frontend (Nginx)

#### 3. Run Migrations

```bash
docker exec jedire-backend npm run migrate
```

#### 4. Access Services

- Frontend: http://localhost
- Backend: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

#### 5. Production Configuration

For production, update `docker-compose.yml`:
- Use managed database instead of local PostgreSQL
- Use managed Redis instead of local Redis
- Add SSL/TLS certificates
- Configure firewall rules

---

### Option C: Manual VPS Deployment

For DigitalOcean, AWS EC2, Linode, etc.

#### 1. Provision VPS

- **Minimum specs:** 2 CPU cores, 4GB RAM, 20GB storage
- **OS:** Ubuntu 22.04 LTS (recommended)

#### 2. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL client
sudo apt install -y postgresql-client

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (for frontend)
sudo apt install -y nginx
```

#### 3. Set Up PostgreSQL & Redis

Use managed services (recommended) or install locally:

```bash
# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Redis
sudo apt install -y redis-server
```

#### 4. Clone & Build Project

```bash
# Clone repository
git clone https://github.com/yourusername/jedire.git
cd jedire

# Install dependencies
npm run install:all

# Set up environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your values

# Build project
npm run build
```

#### 5. Run Migrations

```bash
npm run migrate
```

#### 6. Start Backend with PM2

```bash
cd backend
pm2 start dist/index.js --name jedire-backend
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

#### 7. Set Up Nginx for Frontend

```bash
# Copy frontend build to Nginx
sudo cp -r frontend/dist/* /var/www/html/

# Configure Nginx
sudo nano /etc/nginx/sites-available/jedire
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/jedire /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 8. Set Up SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Database Migrations

### Running Migrations

Migrations are automatically run during Railway deployment (via `Procfile`).

For manual deployment:

```bash
npm run migrate
```

The migration script:
- Creates a `schema_migrations` tracking table
- Runs each `.sql` file in `backend/migrations/` in order
- Tracks which migrations have been applied
- **Safe to run multiple times** (idempotent)

### Creating New Migrations

1. Create new SQL file in `backend/migrations/`:
   ```bash
   touch backend/migrations/007_add_new_feature.sql
   ```

2. Write migration SQL:
   ```sql
   -- Description: Add new feature
   
   CREATE TABLE IF NOT EXISTS new_feature (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. Test migration locally:
   ```bash
   npm run migrate
   ```

4. Commit and deploy:
   ```bash
   git add backend/migrations/007_add_new_feature.sql
   git commit -m "Add new feature migration"
   git push
   ```

---

## Monitoring & Logging

### Health Check Endpoints

Monitor your deployment using these endpoints:

1. **Basic Health Check:**
   ```bash
   curl https://your-api.com/health
   ```
   Returns: `{ status: 'ok', timestamp, version, database, uptime }`

2. **Database Health:**
   ```bash
   curl https://your-api.com/health/db
   ```
   Returns: `{ connected: true, latency: 23, timestamp, version }`

3. **Readiness Check:**
   ```bash
   curl https://your-api.com/health/ready
   ```
   Returns: `{ ready: true, checks: { db: true, migrations: true, config: true } }`

4. **Liveness Check:**
   ```bash
   curl https://your-api.com/health/live
   ```
   Returns: `{ alive: true, timestamp, uptime }`

### Set Up Monitoring

#### UptimeRobot (Free)

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Add new monitor
3. Set URL: `https://your-api.com/health`
4. Set interval: 5 minutes
5. Configure alerts (email, Slack, etc.)

#### Railway Monitoring

Railway provides built-in monitoring:
- CPU usage
- Memory usage
- Network traffic
- Deployment logs
- Health check status

Access via Railway dashboard.

### Application Logs

**Railway:**
```bash
railway logs --tail
```

**Docker:**
```bash
docker-compose logs -f backend
```

**PM2:**
```bash
pm2 logs jedire-backend
```

### Error Tracking (Optional)

Set up [Sentry](https://sentry.io) for error tracking:

1. Create Sentry account
2. Get DSN
3. Add to backend `.env`:
   ```env
   SENTRY_DSN=https://...
   ```
4. Install Sentry SDK:
   ```bash
   npm install @sentry/node
   ```

---

## Rollback Procedures

### Railway Rollback

```bash
# View deployments
railway deployments

# Rollback to previous deployment
railway rollback
```

### Docker Rollback

```bash
# Stop current containers
docker-compose down

# Checkout previous version
git checkout <previous-commit>

# Rebuild and start
docker-compose up -d --build
```

### Manual Rollback

```bash
# Revert to previous commit
git revert HEAD

# Or checkout specific commit
git checkout <commit-hash>

# Rebuild
npm run build

# Restart services
pm2 restart jedire-backend
sudo systemctl restart nginx
```

### Database Rollback

**Important:** Always backup before migrations!

```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore if needed
psql $DATABASE_URL < backup_20240218_120000.sql
```

---

## Troubleshooting

### Issue: Database Connection Fails

**Symptoms:** `ECONNREFUSED`, `Connection refused`

**Solutions:**
1. Verify `DATABASE_URL` is correct
2. Check database is running: `pg_isready -d $DATABASE_URL`
3. Verify network connectivity
4. Check firewall rules
5. Ensure database accepts external connections

### Issue: JWT Authentication Fails

**Symptoms:** 401 errors, "Invalid token"

**Solutions:**
1. Ensure `JWT_SECRET` is set and consistent across all instances
2. Verify token hasn't expired
3. Check JWT configuration in auth middleware
4. Clear browser cookies/localStorage

### Issue: CORS Errors

**Symptoms:** "CORS policy blocked", preflight errors

**Solutions:**
1. Set `CORS_ORIGIN` to your frontend URL (exact match)
2. Ensure frontend URL doesn't have trailing slash
3. Check CORS middleware configuration
4. Verify both `http://` and `https://` if switching protocols

### Issue: WebSocket Connection Fails

**Symptoms:** "WebSocket connection failed", polling fallback

**Solutions:**
1. Ensure WebSocket port is accessible
2. Check `WS_CORS_ORIGIN` matches frontend
3. Verify proxy configuration (Nginx, Railway) allows WebSocket upgrade
4. Test with direct connection (bypassing proxy)

### Issue: Migration Fails

**Symptoms:** SQL errors during migration

**Solutions:**
1. Check migration SQL syntax
2. Verify database permissions
3. Check if migration was partially applied
4. Review `schema_migrations` table
5. Migrations are idempotent - safe to rerun

### Issue: High Memory Usage

**Symptoms:** Application crashes, OOM errors

**Solutions:**
1. Check for memory leaks in code
2. Increase container/instance memory
3. Optimize database queries
4. Review WebSocket connections (close unused)
5. Check for circular references in objects

### Issue: Slow API Response

**Symptoms:** Requests timeout, slow loading

**Solutions:**
1. Check database query performance
2. Add database indexes
3. Enable query caching
4. Use connection pooling
5. Check external API latency
6. Monitor database connection pool usage

---

## Security Best Practices

1. **Never commit secrets:** Use `.env` files (gitignored)
2. **Use strong JWT secrets:** 64+ character random strings
3. **Enable HTTPS:** Use SSL certificates in production
4. **Restrict CORS:** Only allow your frontend domain
5. **Update dependencies:** Run `npm audit` regularly
6. **Database backups:** Daily automated backups
7. **Rate limiting:** Already configured in backend
8. **Input validation:** Joi schemas validate all inputs
9. **SQL injection prevention:** Using parameterized queries
10. **XSS protection:** Helmet middleware enabled

---

## Next Steps

After successful deployment:

1. ✅ Set up monitoring and alerts
2. ✅ Configure automated backups
3. ✅ Set up CI/CD pipeline (GitHub Actions)
4. ✅ Add custom domain
5. ✅ Configure SSL certificate
6. ✅ Set up error tracking (Sentry)
7. ✅ Document API endpoints
8. ✅ Create user documentation
9. ✅ Set up staging environment
10. ✅ Plan maintenance schedule

---

## Support & Resources

- **Architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Checklist:** See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **API Docs:** See [API_REFERENCE.md](./API_REFERENCE.md) (if exists)

For issues, check health endpoints first, then review logs.
