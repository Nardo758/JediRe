/**
 * JediRe Backend - Replit Entry Point (Simplified)
 * No Redis, No Kafka, No Bull - Direct DB writes
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import path from 'path';
import { requireAuth, AuthenticatedRequest } from './middleware/auth';

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// Health Check Endpoint
// ============================================
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const result = await pool.query('SELECT NOW()');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// API Routes
// ============================================

// Get supply metrics for a market
app.get('/api/v1/supply/:market', async (req, res) => {
  try {
    const { market } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const result = await pool.query(
      `SELECT * FROM supply_metrics 
       WHERE market = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [market, limit]
    );
    
    res.json({
      success: true,
      market,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching supply metrics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all markets with latest metrics
app.get('/api/v1/markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (market) 
        market,
        timestamp,
        total_inventory,
        months_of_supply,
        score,
        interpretation
      FROM supply_metrics
      ORDER BY market, timestamp DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get properties
app.get('/api/v1/properties', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const city = req.query.city as string;
    
    let query = 'SELECT * FROM properties';
    const params: any[] = [];
    
    if (city) {
      query += ' WHERE city ILIKE $1';
      params.push(`%${city}%`);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user alerts (requires authentication)
app.get('/api/v1/alerts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const client = req.dbClient || pool;
    const result = await client.query(
      `SELECT * FROM alerts 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Simple auth endpoint (demo)
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // For demo: check against demo user
    if (email === 'demo@jedire.com' && password === 'demo123') {
      const result = await pool.query(
        'SELECT id, email, full_name, role, subscription_tier, enabled_modules FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length > 0) {
        const dbUser = result.rows[0];
        const user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.full_name || 'Demo User',
          role: dbUser.role || 'user',
          subscription: {
            plan: dbUser.subscription_tier || 'free',
            modules: dbUser.enabled_modules || ['supply']
          }
        };
        res.json({
          success: true,
          user,
          token: 'demo-token-' + Date.now()
        });
        return;
      }
    }
    
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// Zoning & Property Analysis Endpoints
// ============================================

// Geocode an address
app.post('/api/v1/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ success: false, error: 'Address is required' });
    }
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
      { headers: { 'User-Agent': 'JediRE/1.0 (contact@jedire.com)' } }
    );
    
    const data = await response.json() as any[];
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }
    
    const result = data[0];
    const addressParts = result.address || {};
    
    res.json({
      success: true,
      data: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        municipality: addressParts.city || addressParts.town || addressParts.village || addressParts.county,
        state: addressParts.state,
        country: addressParts.country
      }
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ success: false, error: 'Geocoding failed' });
  }
});

// Lookup zoning district for coordinates
app.post('/api/v1/zoning/lookup', async (req, res) => {
  try {
    const { lat, lng, municipality } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'Coordinates are required' });
    }
    
    let sql = `
      SELECT zd.*, zdb.boundary_geojson
      FROM zoning_districts zd
      JOIN zoning_district_boundaries zdb ON zd.id = zdb.district_id
      WHERE $1 >= zdb.min_lat AND $1 <= zdb.max_lat
        AND $2 >= zdb.min_lng AND $2 <= zdb.max_lng
    `;
    const params: (number | string)[] = [lat, lng];
    
    if (municipality) {
      sql += ` AND LOWER(zd.municipality) = LOWER($3)`;
      params.push(municipality);
    }
    
    const result = await pool.query(sql, params);
    
    // Point-in-polygon check
    for (const row of result.rows) {
      try {
        const geojson = JSON.parse(row.boundary_geojson);
        if (geojson.type === 'Polygon') {
          const ring = geojson.coordinates[0];
          let inside = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];
            if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
              inside = !inside;
            }
          }
          if (inside) {
            delete row.boundary_geojson;
            return res.json({ success: true, data: row });
          }
        }
      } catch (e) {
        console.error('Error parsing GeoJSON:', e);
      }
    }
    
    res.status(404).json({ success: false, error: 'No zoning district found for these coordinates' });
  } catch (error) {
    console.error('Zoning lookup error:', error);
    res.status(500).json({ success: false, error: 'Zoning lookup failed' });
  }
});

// Get all zoning districts for a municipality
app.get('/api/v1/zoning/districts/:municipality', async (req, res) => {
  try {
    const { municipality } = req.params;
    const state = req.query.state as string || 'TX';
    
    const result = await pool.query(
      `SELECT id, district_code, district_name, description, permitted_uses, 
              max_building_height_ft, max_units_per_acre, max_far
       FROM zoning_districts 
       WHERE LOWER(municipality) = LOWER($1) AND LOWER(state) = LOWER($2)
       ORDER BY district_code`,
      [municipality, state]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching districts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch districts' });
  }
});

// Analyze a property
app.post('/api/v1/analyze', async (req, res) => {
  try {
    const { address, lat, lng, municipality, state, lot_size_sqft } = req.body;
    
    if (!address || !lat || !lng || !lot_size_sqft) {
      return res.status(400).json({ 
        success: false, 
        error: 'Address, coordinates, and lot size are required' 
      });
    }
    
    // Look up zoning district
    let sql = `
      SELECT zd.*, zdb.boundary_geojson
      FROM zoning_districts zd
      JOIN zoning_district_boundaries zdb ON zd.id = zdb.district_id
      WHERE $1 >= zdb.min_lat AND $1 <= zdb.max_lat
        AND $2 >= zdb.min_lng AND $2 <= zdb.max_lng
    `;
    const params: (number | string)[] = [lat, lng];
    
    if (municipality) {
      sql += ` AND LOWER(zd.municipality) = LOWER($3)`;
      params.push(municipality);
    }
    
    const result = await pool.query(sql, params);
    let district = null;
    
    // Point-in-polygon check
    for (const row of result.rows) {
      try {
        const geojson = JSON.parse(row.boundary_geojson);
        if (geojson.type === 'Polygon') {
          const ring = geojson.coordinates[0];
          let inside = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];
            if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
              inside = !inside;
            }
          }
          if (inside) {
            district = row;
            break;
          }
        }
      } catch (e) {}
    }
    
    if (!district) {
      return res.status(404).json({ success: false, error: 'No zoning district found' });
    }
    
    // Calculate development potential
    const setbacks = {
      front: district.min_front_setback_ft || 25,
      side: district.min_side_setback_ft || 5,
      rear: district.min_rear_setback_ft || 10
    };
    
    const lotSideLength = Math.sqrt(lot_size_sqft);
    const buildableWidth = Math.max(0, lotSideLength - (setbacks.side * 2));
    const buildableDepth = Math.max(0, lotSideLength - setbacks.front - setbacks.rear);
    let maxFootprintSqft = Math.round(buildableWidth * buildableDepth);
    
    let maxUnits = 1;
    if (district.max_units_per_acre && district.max_units_per_acre > 0) {
      maxUnits = Math.floor((lot_size_sqft / 43560) * district.max_units_per_acre);
    } else if (district.min_lot_per_unit_sqft && district.min_lot_per_unit_sqft > 0) {
      maxUnits = Math.floor(lot_size_sqft / district.min_lot_per_unit_sqft);
    }
    maxUnits = Math.max(1, maxUnits);
    
    const maxCoverage = district.max_lot_coverage || 0.45;
    maxFootprintSqft = Math.min(maxFootprintSqft, Math.round(lot_size_sqft * maxCoverage));
    
    const maxStories = district.max_stories || 2;
    const maxGfaSqft = maxFootprintSqft * maxStories;
    
    let parkingRequired = 0;
    if (district.parking_per_unit) {
      parkingRequired = Math.ceil(maxUnits * district.parking_per_unit);
    } else if (district.parking_per_1000_sqft) {
      parkingRequired = Math.ceil((maxGfaSqft / 1000) * district.parking_per_1000_sqft);
    }
    
    // Calculate opportunity score
    let score = 50;
    if (maxUnits >= 4) score += 20;
    else if (maxUnits >= 2) score += 10;
    if (district.max_far && district.max_far >= 1.0) score += 15;
    else if (district.max_far && district.max_far >= 0.5) score += 5;
    if (district.max_building_height_ft && district.max_building_height_ft >= 40) score += 10;
    if (lot_size_sqft >= 10000) score += 10;
    else if (lot_size_sqft >= 7000) score += 5;
    score = Math.min(100, Math.max(0, score));
    
    // Calculate buildable envelope
    const ftToDeg = 0.00000274;
    const halfSide = (lotSideLength / 2) * ftToDeg;
    const setbackDeg = {
      front: setbacks.front * ftToDeg,
      rear: setbacks.rear * ftToDeg,
      side: setbacks.side * ftToDeg
    };
    const buildableEnvelope = {
      type: 'Polygon',
      coordinates: [[
        [lng - halfSide + setbackDeg.side, lat + halfSide - setbackDeg.front],
        [lng + halfSide - setbackDeg.side, lat + halfSide - setbackDeg.front],
        [lng + halfSide - setbackDeg.side, lat - halfSide + setbackDeg.rear],
        [lng - halfSide + setbackDeg.side, lat - halfSide + setbackDeg.rear],
        [lng - halfSide + setbackDeg.side, lat + halfSide - setbackDeg.front]
      ]]
    };
    
    // Generate summary
    const districtName = district.district_name || district.district_code;
    let summary = `This ${lot_size_sqft.toLocaleString()} sq ft property is zoned ${districtName}. `;
    if (maxUnits > 1) {
      summary += `You can build up to ${maxUnits} dwelling units with a maximum of ${maxGfaSqft.toLocaleString()} sq ft gross floor area. `;
    } else {
      summary += `Single-family development is permitted with up to ${maxGfaSqft.toLocaleString()} sq ft of buildable area. `;
    }
    if (parkingRequired > 0) {
      summary += `${parkingRequired} parking spaces are required.`;
    }
    
    const analysis = {
      address,
      coordinates: { lat, lng },
      municipality: municipality || district.municipality,
      state: state || district.state,
      district_code: district.district_code,
      district_name: districtName,
      lot_size_sqft,
      max_units: maxUnits,
      max_height_ft: district.max_building_height_ft || 35,
      max_footprint_sqft: maxFootprintSqft,
      max_gfa_sqft: maxGfaSqft,
      parking_required: parkingRequired,
      setbacks,
      opportunity_score: score,
      buildable_envelope_geojson: buildableEnvelope,
      ai_summary: summary,
      permitted_uses: district.permitted_uses || [],
      conditional_uses: district.conditional_uses || []
    };
    
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ success: false, error: 'Property analysis failed' });
  }
});

// ============================================
// WebSocket Handlers
// ============================================

const activeUsers = new Map<string, any>();

io.on('connection', (socket) => {
  console.log(`WebSocket connected: ${socket.id}`);
  
  socket.on('user:join', (userData) => {
    activeUsers.set(socket.id, {
      ...userData,
      socketId: socket.id,
      connectedAt: new Date()
    });
    
    // Broadcast updated user list
    io.emit('users:update', Array.from(activeUsers.values()));
  });
  
  socket.on('cursor:move', (data) => {
    socket.broadcast.emit('cursor:update', {
      socketId: socket.id,
      ...data
    });
  });
  
  socket.on('property:select', (propertyId) => {
    socket.broadcast.emit('property:selected', {
      socketId: socket.id,
      propertyId
    });
  });
  
  socket.on('disconnect', () => {
    console.log(`WebSocket disconnected: ${socket.id}`);
    activeUsers.delete(socket.id);
    io.emit('users:update', Array.from(activeUsers.values()));
  });
});

// ============================================
// Serve Frontend in Production
// ============================================
if (isProduction) {
  const frontendPath = path.join(__dirname, 'public');
  console.log(`Serving static files from: ${frontendPath}`);
  app.use(express.static(frontendPath));
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/health') && !req.path.startsWith('/socket.io')) {
      const indexPath = path.join(frontendPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('Error serving index.html:', err);
          res.status(404).send('Frontend not found. Please ensure the build completed successfully.');
        }
      });
    } else {
      next();
    }
  });
}

// ============================================
// Microsoft Integration Endpoints
// ============================================

// Microsoft configuration
const microsoftConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:4000/api/v1/microsoft/auth/callback',
  scopes: ['User.Read', 'Mail.Read', 'Mail.Send', 'Calendars.Read', 'Calendars.ReadWrite']
};

// Check Microsoft integration status (requires auth to check user connection)
app.get('/api/v1/microsoft/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  const configured = !!(microsoftConfig.clientId && microsoftConfig.clientSecret);
  let connected = false;
  
  try {
    const client = req.dbClient || pool;
    const result = await client.query(
      'SELECT id FROM microsoft_accounts WHERE user_id = $1 AND is_active = true LIMIT 1',
      [req.user!.userId]
    );
    connected = result.rows.length > 0;
  } catch (error) {
    console.error('Error checking Microsoft connection:', error);
  }
  
  res.json({ configured, connected });
});

// Get Microsoft OAuth authorization URL (requires auth)
app.get('/api/v1/microsoft/auth/url', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!microsoftConfig.clientId) {
    return res.status(500).json({ success: false, error: 'Microsoft not configured' });
  }
  
  const authUrl = `https://login.microsoftonline.com/${microsoftConfig.tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${microsoftConfig.clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(microsoftConfig.redirectUri)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(microsoftConfig.scopes.join(' '))}` +
    `&state=${Date.now()}`;
  
  res.json({ success: true, authUrl });
});

// Microsoft OAuth callback
app.get('/api/v1/microsoft/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  if (error) {
    return res.redirect(`${frontendUrl}/settings?microsoft_error=${error}`);
  }
  
  if (!code) {
    return res.redirect(`${frontendUrl}/settings?microsoft_error=no_code`);
  }
  
  try {
    // Exchange code for tokens
    const axios = require('axios');
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${microsoftConfig.tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: microsoftConfig.clientId,
        client_secret: microsoftConfig.clientSecret,
        code: code as string,
        redirect_uri: microsoftConfig.redirectUri,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    // TODO: Store tokens in database for the user
    console.log('Microsoft OAuth successful');
    res.redirect(`${frontendUrl}/settings?microsoft_connected=true`);
  } catch (error) {
    console.error('Microsoft OAuth error:', error);
    res.redirect(`${frontendUrl}/settings?microsoft_error=token_exchange_failed`);
  }
});

// ============================================
// Error Handler
// ============================================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ============================================
// Start Server
// ============================================
httpServer.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 JediRe Backend (Replit Edition)');
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api/v1`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, pool, io };
