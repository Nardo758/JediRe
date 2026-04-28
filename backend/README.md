# JediRe Backend API

**Lightweight real estate intelligence platform MVP backend**

Built following the LIGHTWEIGHT_ARCHITECTURE.md principles.

## 🏗️ Architecture

- **Framework**: Node.js + Express + TypeScript
- **GraphQL**: Apollo Server
- **WebSocket**: Socket.io (real-time collaboration)
- **Database**: PostgreSQL + PostGIS (geospatial queries)
- **Authentication**: JWT + OAuth 2.0 (Google)
- **Caching**: Redis
- **Deployment**: Docker + Docker Compose

## 📦 Features

### ✅ Core API
- REST API endpoints for properties, zoning, markets
- GraphQL API for complex queries
- WebSocket server for real-time updates
- JWT authentication with refresh tokens
- Google OAuth integration
- Rate limiting & security middleware

### ✅ Zoning Module
- Address geocoding (Google Maps + Mapbox fallback)
- Point-in-polygon zoning lookup (PostGIS)
- Zoning rules database
- Development potential analysis

### ✅ Collaboration
- Real-time multi-user sessions
- Property pins and annotations
- Comments with @mentions
- Cursor tracking
- Typing indicators

### ✅ Agent Orchestration
- Task queue system
- Zoning Agent (development feasibility)
- Supply Agent (market inventory)
- Cash Flow Agent (investment analysis)
- Automatic retry with exponential backoff

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ with PostGIS
- Redis
- API Keys (Google Maps, Mapbox, Claude)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
```

### Docker Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## 📚 API Documentation

### REST Endpoints

**Authentication:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user
- `GET /api/v1/auth/google` - Google OAuth login

**Properties:**
- `GET /api/v1/properties` - List properties
- `GET /api/v1/properties/:id` - Get property details
- `POST /api/v1/properties` - Create property
- `PUT /api/v1/properties/:id` - Update property
- `DELETE /api/v1/properties/:id` - Delete property

**Zoning:**
- `POST /api/v1/zoning/lookup` - Lookup zoning for address
- `GET /api/v1/zoning/districts/:municipality/:state` - List districts
- `GET /api/v1/zoning/rules/:districtId` - Get district rules
- `POST /api/v1/zoning/analyze` - Analyze development potential

**Market:**
- `GET /api/v1/market/inventory/:city/:state` - Get market inventory
- `GET /api/v1/market/trends/:city/:state` - Get market trends

**Agents:**
- `POST /api/v1/agents/tasks` - Submit agent task
- `GET /api/v1/agents/tasks/:taskId` - Get task status
- `GET /api/v1/agents/tasks` - List user tasks

### GraphQL

GraphQL Playground: http://localhost:4000/graphql

**Example Query:**
```graphql
query {
  properties(filters: { city: "Miami", stateCode: "FL" }) {
    id
    addressLine1
    city
    lotSizeSqft
    zoningDistrict {
      districtCode
      districtName
      rules {
        maxDensityUnitsPerAcre
        maxHeightFt
      }
    }
  }
}
```

### WebSocket

Connect: `ws://localhost:4000`

**Authentication:**
```javascript
const socket = io('http://localhost:4000', {
  auth: { token: 'your-jwt-token' }
});
```

**Events:**
- `session:join` - Join collaboration session
- `cursor:move` - Update cursor position
- `pin:create` - Create property pin
- `comment:create` - Add comment
- `typing:start` / `typing:stop` - Typing indicators

## 🗄️ Database Schema

See `src/database/schema.sql` for complete schema.

**Key tables:**
- `users` - User accounts
- `properties` - Property records
- `zoning_district_boundaries` - Zoning districts (with PostGIS geometry)
- `zoning_rules` - Zoning regulations
- `property_analyses` - Agent analysis results
- `collaboration_sessions` - Real-time collaboration
- `agent_tasks` - Task queue

## 🔧 Configuration

### Environment Variables

See `.env.example` for all configuration options.

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT signing
- `GOOGLE_MAPS_API_KEY` - For geocoding
- `MAPBOX_ACCESS_TOKEN` - Fallback geocoding

**Optional:**
- `CLAUDE_API_KEY` - For AI analysis
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth
- `REDIS_URL` - Redis caching
- `CORS_ORIGIN` - Frontend URL

## 🧪 Testing

The backend uses [Vitest](https://vitest.dev/) (configured in `backend/vitest.config.ts`).
Tests are discovered under `src/**/*.test.ts` and `src/**/__tests__/**/*.test.ts`.

```bash
# From backend/
npm test               # one-shot run, exits 0 in a clean dev env
npm run test:watch     # watch mode
npx vitest run path/to/file.test.ts   # run a single file
```

`npm test` is expected to pass with 0 failures and ~27 skipped tests. Skipped tests
fall into two buckets — see the `TODO` comment at the top of each skipped suite/test
for the specific re-enable steps:

- **Heavyweight integration suites** that need fixtures or a seeded test DB before they
  can run locally:
  - `src/services/document-extraction/tests/integration.alta-porter.test.ts` — needs
    Alta Porter T12/rent-roll/tax-bill fixture files plus a `TEST_DATABASE_URL` with
    the deal id seeded.
  - `src/tests/neighboringProperty.test.ts` — needs `property_records` rows with the
    legacy `parcel_geometry` column populated and PostGIS available.
  - `src/api/rest/__tests__/competition.routes.test.ts` and `qwen.routes.test.ts` —
    need the `supertest` dev dep installed and (for competition) a seeded test deal.
- **Stale single-test assertions** kept in otherwise-passing files
  (`asset-map-intelligence.test.ts`, `email-extraction.test.ts`,
  `multifamily-traffic-prediction.test.ts`) where the implementation drifted from the
  original expectation. The TODO above each `test.skip` calls out whether to re-tune
  the test or fix the underlying service.

When adding new tests, prefer pure-unit tests with mocked dependencies (see
`src/services/__tests__/proforma-seeder.parity.test.ts` for a good template) over
live-DB integration tests, so they run without external setup.

```bash
# Lint code
npm run lint
```

## 📊 Performance

- Rate limiting: 100 requests per 15 minutes per IP
- Connection pooling: 2-10 PostgreSQL connections
- Redis caching for frequently accessed data
- Spatial indexes for fast geospatial queries

## 🔒 Security

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Helmet.js security headers
- CORS protection
- SQL injection prevention (parameterized queries)
- Rate limiting
- Input validation with Joi

## 🚢 Deployment

### Production Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Configure production database
- [ ] Set up Redis for production
- [ ] Enable HTTPS
- [ ] Configure proper CORS origins
- [ ] Set up monitoring (Sentry, Datadog)
- [ ] Configure backups
- [ ] Set up CI/CD pipeline

### Docker Production

```bash
# Build production image
docker build -t jedire-api:latest .

# Run with docker-compose
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

This is an MVP. Contributions welcome!

## 📧 Support

For issues and questions, please open a GitHub issue.

---

**Last Updated:** 2026-01-31  
**Version:** 1.0.0-MVP  
**Status:** Production Ready ✅
