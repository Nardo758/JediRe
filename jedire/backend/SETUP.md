# JediRe Backend Setup Guide

## 🎯 Quick Setup (5 minutes)

### Option 1: Docker (Recommended)

```bash
# 1. Clone and navigate
cd /home/leon/clawd/jedire/backend

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your API keys
nano .env

# 4. Start all services
docker-compose up -d

# 5. Check health
curl http://localhost:4000/health
```

Done! API is running at http://localhost:4000

### Option 2: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Setup database
# Make sure PostgreSQL is running with PostGIS extension
createdb jedire
psql jedire < src/database/schema.sql

# 3. Setup Redis
# Make sure Redis is running on port 6379

# 4. Copy and configure .env
cp .env.example .env
nano .env

# 5. Start development server
npm run dev
```

## 🔑 Required API Keys

Get these before starting:

### Google Maps API Key
1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable: Geocoding API, Maps JavaScript API
4. Create credentials → API Key
5. Add to `.env` as `GOOGLE_MAPS_API_KEY`

### Mapbox Access Token
1. Go to https://account.mapbox.com
2. Create account (free tier is fine)
3. Get access token from dashboard
4. Add to `.env` as `MAPBOX_ACCESS_TOKEN`

### Claude API Key (Optional - for AI analysis)
1. Go to https://console.anthropic.com
2. Create account
3. Generate API key
4. Add to `.env` as `CLAUDE_API_KEY`

### Google OAuth (Optional - for social login)
1. Google Cloud Console → Credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:4000/api/v1/auth/google/callback`
4. Add to `.env`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

## 📝 Environment Configuration

Minimal `.env` file:

```env
# Server
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://postgres:changeme@localhost:5432/jedire

# JWT (generate a strong secret)
JWT_SECRET=your-super-secret-key-change-this-to-something-random

# APIs (required)
GOOGLE_MAPS_API_KEY=your-google-maps-key
MAPBOX_ACCESS_TOKEN=your-mapbox-token

# Frontend
CORS_ORIGIN=http://localhost:3000
```

## 🗄️ Database Setup

### Using Docker
Database is automatically created and initialized by docker-compose.

### Manual Setup

```bash
# 1. Create database
createdb jedire

# 2. Enable PostGIS extension
psql jedire -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 3. Run schema
psql jedire < src/database/schema.sql

# 4. Verify
psql jedire -c "SELECT COUNT(*) FROM users;"
```

## 🧪 Testing the API

### Health Check
```bash
curl http://localhost:4000/health
```

### Register User
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Get JWT Token
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Test Authenticated Endpoint
```bash
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### GraphQL Playground
Open in browser: http://localhost:4000/graphql

## 🔍 Common Issues

### "Database connection failed"
- Check PostgreSQL is running: `docker-compose ps postgres`
- Verify connection string in `.env`
- Test connection: `psql $DATABASE_URL`

### "PostGIS extension not found"
- Run: `psql jedire -c "CREATE EXTENSION postgis;"`
- Or restart docker-compose: `docker-compose down && docker-compose up -d`

### "Google Maps API error"
- Verify API key is correct
- Check API is enabled in Google Cloud Console
- Check billing is enabled (required for Geocoding API)

### "Port 4000 already in use"
- Change PORT in `.env`
- Or kill existing process: `lsof -ti:4000 | xargs kill -9`

## 🚀 Next Steps

1. **Add Zoning Data**
   - Get zoning shapefiles from city open data portals
   - Import into `zoning_district_boundaries` table
   - See `LIGHTWEIGHT_ARCHITECTURE.md` for data sources

2. **Configure Frontend**
   - Update frontend to use `http://localhost:4000`
   - Set up WebSocket connection
   - Configure OAuth callback URL

3. **Production Deployment**
   - See `README.md` deployment section
   - Set up HTTPS
   - Configure proper database backups
   - Set up monitoring

## 📚 Resources

- [Main README](./README.md) - Full API documentation
- [Architecture Doc](../LIGHTWEIGHT_ARCHITECTURE.md) - System design
- [GraphQL Playground](http://localhost:4000/graphql) - Interactive API explorer
- [pgAdmin](http://localhost:5050) - Database management (if enabled)

## 🆘 Support

If you encounter issues:
1. Check logs: `docker-compose logs -f api`
2. Verify all services are running: `docker-compose ps`
3. Review environment variables: `cat .env`
4. Test database connection: `psql $DATABASE_URL -c "SELECT 1"`

---

**Setup time: ~5 minutes** ⚡  
**Dependencies: Docker OR Node.js + PostgreSQL + Redis**
