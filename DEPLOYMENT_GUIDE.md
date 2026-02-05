# JEDI RE - Deployment Guide

**Version:** 1.0  
**Last Updated:** 2026-02-05  
**Status:** Production-ready

---

## 🎯 Overview

This guide covers deploying JEDI RE to production environments. We support:
- Replit (recommended for quick start)
- Docker / Docker Compose
- Kubernetes (for scale)
- Traditional VPS/server

---

## 🚀 Quick Deploy (Replit)

**Best for:** MVP, staging, small-scale production

### 1. Import from GitHub

```bash
1. Go to replit.com
2. Create Repl → Import from GitHub
3. Enter: https://github.com/Nardo758/JediRe
4. Language: Node.js
5. Click "Import"
```

### 2. Run Setup

```bash
bash replit-deploy.sh
```

This automatically:
- Installs Node.js dependencies
- Installs Python dependencies
- Verifies TypeScript compilation
- Tests Python analyzer

### 3. Configure Secrets

Click 🔒 Secrets tab and add:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host/db
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=different-secret-key
CORS_ORIGIN=https://your-domain.com
APARTMENTIQ_API_URL=https://apartmentiq.replit.app
```

### 4. Deploy

Click green "Run" button or:

```bash
cd backend && npm run build && npm start
```

**Your API is now live!**

Public URL: `https://jedire.your-username.repl.co`

---

## 🐳 Docker Deployment

**Best for:** Production, self-hosted, containerized environments

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

### 1. Clone Repository

```bash
git clone https://github.com/Nardo758/JediRe.git
cd JediRe
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Required variables:

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:postgres@db:5432/jedire
JWT_SECRET=generate-long-random-string
JWT_REFRESH_SECRET=another-random-string
CORS_ORIGIN=https://yourdomain.com
```

### 3. Build and Run

```bash
docker-compose up -d
```

This starts:
- Backend API (port 3000)
- PostgreSQL database (port 5432)
- TimescaleDB extension

### 4. Run Migrations

```bash
docker-compose exec backend npm run migrate
```

### 5. Health Check

```bash
curl http://localhost:3000/health
```

### 6. Production Deployment

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f backend
```

---

## ☸️ Kubernetes Deployment

**Best for:** Large-scale production, high availability

### Prerequisites

- Kubernetes cluster (GKE, EKS, AKS, or self-hosted)
- kubectl configured
- Helm 3.0+

### 1. Create Namespace

```bash
kubectl create namespace jedire
```

### 2. Configure Secrets

```bash
kubectl create secret generic jedire-secrets \
  --from-literal=DATABASE_URL=postgresql://... \
  --from-literal=JWT_SECRET=... \
  --from-literal=JWT_REFRESH_SECRET=... \
  -n jedire
```

### 3. Deploy Database

```bash
helm install postgresql bitnami/postgresql \
  --namespace jedire \
  --set auth.database=jedire \
  --set primary.persistence.size=50Gi
```

### 4. Deploy Application

```bash
# Apply manifests
kubectl apply -f k8s/deployment.yaml -n jedire
kubectl apply -f k8s/service.yaml -n jedire
kubectl apply -f k8s/ingress.yaml -n jedire
```

### 5. Run Migrations

```bash
kubectl exec -it deployment/jedire-backend -n jedire -- npm run migrate
```

### 6. Scale

```bash
# Scale to 3 replicas
kubectl scale deployment jedire-backend --replicas=3 -n jedire

# Enable autoscaling
kubectl autoscale deployment jedire-backend \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n jedire
```

---

## 🖥️ Traditional Server (VPS)

**Best for:** Full control, custom infrastructure

### Prerequisites

- Ubuntu 20.04+ or similar
- Node.js 18+
- Python 3.11+
- PostgreSQL 14+

### 1. Install Dependencies

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python
sudo apt-get install -y python3.11 python3.11-venv python3-pip

# PostgreSQL + PostGIS
sudo apt-get install -y postgresql postgresql-contrib postgis

# Build tools
sudo apt-get install -y build-essential git
```

### 2. Create Database

```bash
sudo -u postgres psql
CREATE DATABASE jedire;
CREATE USER jedire WITH ENCRYPTED PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE jedire TO jedire;
\q
```

### 3. Clone and Setup

```bash
cd /var/www
sudo git clone https://github.com/Nardo758/JediRe.git jedire
cd jedire
sudo chown -R $USER:$USER .

# Backend
cd backend
npm install
npm run build

# Python services
cd python-services
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
cp .env.example .env
nano .env
```

### 5. Setup Systemd Service

```bash
sudo nano /etc/systemd/system/jedire.service
```

```ini
[Unit]
Description=JEDI RE API
After=network.target postgresql.service

[Service]
Type=simple
User=jedire
WorkingDirectory=/var/www/jedire/backend
Environment="NODE_ENV=production"
EnvironmentFile=/var/www/jedire/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable jedire
sudo systemctl start jedire
sudo systemctl status jedire
```

### 6. Setup Nginx Reverse Proxy

```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/jedire
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/jedire /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Setup SSL (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## 🔄 Deployment Automation

### Using Deploy Script

```bash
# Deploy to staging
bash scripts/deploy.sh staging

# Deploy to production (with confirmation)
bash scripts/deploy.sh production
```

Script automatically:
- Runs tests
- Builds application
- Runs database migrations
- Creates backup (production)
- Deploys code
- Runs health checks
- Tags deployment

### CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to production
        run: bash scripts/deploy.sh production
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

---

## 📊 Post-Deployment

### 1. Run Health Checks

```bash
bash scripts/check-system-health.sh production
```

### 2. Monitor Logs

```bash
# Replit
View in console

# Docker
docker-compose logs -f backend

# Systemd
sudo journalctl -u jedire -f
```

### 3. Setup Monitoring

**Recommended tools:**
- Uptime monitoring: UptimeRobot (free)
- Error tracking: Sentry
- Performance: New Relic / Datadog
- Logs: Papertrail / Loggly

### 4. Setup Backups

```bash
# Add to cron (daily at 2 AM)
crontab -e
0 2 * * * /var/www/jedire/scripts/backup.sh production
```

### 5. Setup Alerts

Configure alerts for:
- API downtime
- High error rates
- Database connection failures
- Disk space low (>80%)

---

## 🆘 Rollback

If deployment fails:

```bash
bash scripts/rollback.sh

# Or rollback to specific tag
bash scripts/rollback.sh deploy-20260205-143000
```

---

## 📈 Scaling

### Horizontal Scaling

**Replit:**
- Upgrade to Hacker plan for better performance
- Use Always On for 24/7 uptime

**Docker:**
```bash
docker-compose up -d --scale backend=3
```

**Kubernetes:**
```bash
kubectl scale deployment jedire-backend --replicas=5 -n jedire
```

### Database Scaling

**Read replicas:**
- Add PostgreSQL read replicas for heavy read workloads

**Connection pooling:**
- Use PgBouncer for connection management

**Caching:**
- Redis for session storage and API caching

---

## 🔐 Security Checklist

- [ ] Environment variables in secrets (not code)
- [ ] HTTPS enabled (SSL certificate)
- [ ] CORS properly configured
- [ ] Database credentials rotated
- [ ] JWT secrets strong and unique
- [ ] Rate limiting enabled
- [ ] API keys for external services secure
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] Regular backups automated
- [ ] Monitoring and alerts set up

---

## 📞 Support

**Issues:** https://github.com/Nardo758/JediRe/issues  
**Documentation:** /docs  
**Health Status:** https://api.jedire.com/health

---

**Last Updated:** 2026-02-05  
**Version:** 1.0
