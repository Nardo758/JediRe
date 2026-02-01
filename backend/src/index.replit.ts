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

dotenv.config();

const app = express();
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

// Get user alerts
app.get('/api/v1/alerts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const result = await pool.query(
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
      const user = await pool.query(
        'SELECT id, email, full_name, role, subscription_tier FROM users WHERE email = $1',
        [email]
      );
      
      if (user.rows.length > 0) {
        res.json({
          success: true,
          user: user.rows[0],
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
