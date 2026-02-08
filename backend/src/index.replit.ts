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
import { generateAccessToken } from './auth/jwt';

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

const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:5000', /\.replit\.dev$/, /\.replit\.app$/],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// Health Check Endpoint (lightweight - no DB query)
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/full', async (req, res) => {
  try {
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
    console.log('Login attempt:', { email, hasPassword: !!password, bodyKeys: Object.keys(req.body || {}) });
    
    // For demo: accept demo credentials
    if (email === 'demo@jedire.com' && password === 'demo123') {
      const result = await pool.query(
        'SELECT id, email, full_name, role, subscription_tier, enabled_modules FROM users WHERE email = $1',
        [email]
      );
      console.log('Demo user query result rows:', result.rows.length);
      
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
        const token = generateAccessToken({
          userId: dbUser.id,
          email: dbUser.email,
          role: dbUser.role || 'user'
        });
        console.log('Demo login successful, token generated');
        res.json({
          success: true,
          user,
          token
        });
        return;
      }
    }
    
    console.log('Login failed: credentials did not match or user not found');
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

// Get current user profile
app.get('/api/v1/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const result = await pool.query(
      'SELECT id, email, full_name, role, subscription_tier, enabled_modules FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const dbUser = result.rows[0];
    res.json({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.full_name || 'User',
      role: dbUser.role || 'user',
      subscription: {
        plan: dbUser.subscription_tier || 'free',
        modules: dbUser.enabled_modules || ['supply']
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ============================================
// Deals CRUD Endpoints
// ============================================

// List all deals for the authenticated user
app.get('/api/v1/deals', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const result = await client.query(`
      SELECT 
        d.*,
        ST_AsGeoJSON(d.boundary)::json as boundary_geojson,
        (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount",
        (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.status != 'done')::int as "pendingTasks",
        CASE 
          WHEN d.boundary IS NOT NULL THEN 
            ST_Area(d.boundary::geography) / 4046.86
          ELSE 0
        END as acres
      FROM deals d
      WHERE d.user_id = $1 AND d.archived_at IS NULL
      ORDER BY d.created_at DESC
    `, [req.user!.userId]);

    res.json({
      success: true,
      deals: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        projectType: row.project_type,
        projectIntent: row.project_intent,
        tier: row.tier || 'basic',
        status: row.status,
        budget: parseFloat(row.budget) || 0,
        boundary: row.boundary_geojson,
        targetUnits: row.target_units,
        timelineStart: row.timeline_start,
        timelineEnd: row.timeline_end,
        acres: parseFloat(row.acres) || 0,
        propertyCount: row.propertyCount || 0,
        pendingTasks: row.pendingTasks || 0,
        dealCategory: row.deal_category,
        developmentType: row.development_type,
        address: row.address,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    });
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deals' });
  }
});

// Get a single deal
app.get('/api/v1/deals/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const result = await client.query(`
      SELECT 
        d.*,
        ST_AsGeoJSON(d.boundary)::json as boundary_geojson,
        (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount",
        (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.status != 'done')::int as "pendingTasks",
        (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id)::int as "taskCount",
        (SELECT dp2.stage FROM deal_pipeline dp2 WHERE dp2.deal_id = d.id ORDER BY dp2.entered_at DESC LIMIT 1) as "pipelineStage",
        (SELECT EXTRACT(DAY FROM NOW() - dp2.entered_at)::int FROM deal_pipeline dp2 WHERE dp2.deal_id = d.id ORDER BY dp2.entered_at DESC LIMIT 1) as "daysInStage",
        CASE 
          WHEN d.boundary IS NOT NULL THEN 
            ST_Area(d.boundary::geography) / 4046.86
          ELSE 0
        END as acres
      FROM deals d
      WHERE d.id = $1 AND d.user_id = $2 AND d.archived_at IS NULL
    `, [req.params.id, req.user!.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      deal: {
        id: row.id,
        name: row.name,
        projectType: row.project_type || 'multifamily',
        projectIntent: row.project_intent,
        tier: row.tier || 'basic',
        status: row.status,
        budget: parseFloat(row.budget) || 0,
        boundary: row.boundary_geojson,
        targetUnits: row.target_units,
        timelineStart: row.timeline_start,
        timelineEnd: row.timeline_end,
        acres: parseFloat(row.acres) || 0,
        propertyCount: row.propertyCount || 0,
        pendingTasks: row.pendingTasks || 0,
        taskCount: row.taskCount || 0,
        pipelineStage: row.pipelineStage || null,
        daysInStage: row.daysInStage || 0,
        dealCategory: row.deal_category,
        developmentType: row.development_type,
        address: row.address,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    });
  } catch (error) {
    console.error('Error fetching deal:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deal' });
  }
});

// Create a new deal
app.post('/api/v1/deals', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const {
      name, boundary, projectType, projectIntent, targetUnits,
      budget, timelineStart, timelineEnd, tier,
      deal_category, development_type, address, description
    } = req.body;

    if (!name || !boundary) {
      return res.status(400).json({ success: false, error: 'Name and boundary are required' });
    }

    const userTier = tier || 'basic';
    const result = await client.query(`
      INSERT INTO deals (
        user_id, name, boundary, project_type, project_intent,
        target_units, budget, timeline_start, timeline_end, tier, status,
        deal_category, development_type, address, description
      )
      VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13, $14)
      RETURNING *
    `, [
      req.user!.userId,
      name,
      JSON.stringify(boundary),
      projectType || 'multifamily',
      projectIntent || null,
      targetUnits || null,
      budget || null,
      timelineStart || null,
      timelineEnd || null,
      userTier,
      deal_category || 'pipeline',
      development_type || 'new',
      address || null,
      description || null,
    ]);

    const row = result.rows[0];
    res.status(201).json({
      success: true,
      deal: {
        id: row.id,
        name: row.name,
        projectType: row.project_type,
        tier: row.tier || 'basic',
        status: row.status,
        budget: parseFloat(row.budget) || 0,
        acres: 0,
        propertyCount: 0,
        pendingTasks: 0,
        dealCategory: row.deal_category,
        developmentType: row.development_type,
        address: row.address,
        createdAt: row.created_at,
      }
    });
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ success: false, error: 'Failed to create deal' });
  }
});

// Update a deal
app.patch('/api/v1/deals/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;
    const updates = req.body;

    const dealCheck = await client.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [dealId, req.user!.userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const allowedFields: Record<string, string> = {
      name: 'name', projectType: 'project_type', projectIntent: 'project_intent',
      targetUnits: 'target_units', budget: 'budget', status: 'status',
      timelineStart: 'timeline_start', timelineEnd: 'timeline_end',
      description: 'description', address: 'address',
    };

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, dbCol] of Object.entries(allowedFields)) {
      if (updates[key] !== undefined) {
        setClauses.push(`${dbCol} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    }

    values.push(dealId);
    const result = await client.query(
      `UPDATE deals SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ success: true, deal: result.rows[0] });
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ success: false, error: 'Failed to update deal' });
  }
});

// Delete (archive) a deal
app.delete('/api/v1/deals/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;
    const result = await client.query(
      'UPDATE deals SET archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2 AND archived_at IS NULL RETURNING id',
      [dealId, req.user!.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    res.json({ success: true, message: 'Deal archived' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ success: false, error: 'Failed to delete deal' });
  }
});

// Get deal modules
app.get('/api/v1/deals/:id/modules', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;

    const dealCheck = await client.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const result = await client.query(
      'SELECT * FROM deal_modules WHERE deal_id = $1',
      [dealId]
    );

    const modules = result.rows.length > 0 ? result.rows : [
      { module_name: 'map', enabled: true, config: {} },
      { module_name: 'properties', enabled: true, config: {} },
      { module_name: 'strategy', enabled: true, config: {} },
      { module_name: 'pipeline', enabled: true, config: {} },
      { module_name: 'market', enabled: false, config: {} },
      { module_name: 'reports', enabled: false, config: {} },
      { module_name: 'team', enabled: false, config: {} },
    ];

    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('Error fetching deal modules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch modules' });
  }
});

// Get deal activity feed
app.get('/api/v1/deals/:id/activity', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
      const result = await client.query(
        `SELECT id, deal_id, user_id, action_type, entity_type, entity_id, description, metadata, created_at
         FROM deal_activity
         WHERE deal_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [dealId, limit]
      );

      const activities = result.rows.map((row: any) => ({
        id: row.id,
        dealId: row.deal_id,
        userId: row.user_id,
        activityType: row.action_type || 'note_added',
        description: row.description || '',
        metadata: row.metadata || {},
        createdAt: row.created_at,
      }));

      res.json({ success: true, data: activities, count: activities.length });
    } catch (dbError: any) {
      if (dbError.code === '42P01' || dbError.code === '22P02') {
        res.json({ success: true, data: [], count: 0 });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Error fetching deal activity:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

// Get deal timeline
app.get('/api/v1/deals/:id/timeline', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;

    try {
      const result = await client.query(
        `SELECT id, deal_id, action_type, description, metadata, created_at
         FROM deal_activity
         WHERE deal_id = $1
         ORDER BY created_at ASC`,
        [dealId]
      );

      const now = new Date();
      const eventsByDate: Record<string, any[]> = {};

      for (const row of result.rows) {
        const dateKey = new Date(row.created_at).toISOString().split('T')[0];
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push({
          id: row.id,
          description: row.description || row.action_type,
          activityType: row.action_type || 'note_added',
          createdAt: row.created_at,
        });
      }

      const timeline = Object.entries(eventsByDate).map(([date, activities]) => ({
        date,
        title: `${activities.length} activit${activities.length === 1 ? 'y' : 'ies'}`,
        type: new Date(date) < now ? 'past' : new Date(date).toDateString() === now.toDateString() ? 'current' : 'future',
        completed: new Date(date) < now,
        activities,
      }));

      res.json({ success: true, data: timeline });
    } catch (dbError: any) {
      if (dbError.code === '42P01' || dbError.code === '22P02') {
        res.json({ success: true, data: [] });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Error fetching deal timeline:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
  }
});

// Get deal key moments
app.get('/api/v1/deals/:id/key-moments', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const client = req.dbClient || pool;
    const dealId = req.params.id;

    try {
      const result = await client.query(
        `SELECT id, deal_id, action_type, description, metadata, created_at
         FROM deal_activity
         WHERE deal_id = $1
           AND action_type IN ('milestone_hit', 'status_change', 'risk_flagged', 'financial_update')
         ORDER BY created_at DESC`,
        [dealId]
      );

      const momentTypeMap: Record<string, string> = {
        milestone_hit: 'milestone',
        status_change: 'decision',
        risk_flagged: 'risk',
        financial_update: 'achievement',
      };
      const importanceMap: Record<string, string> = {
        milestone_hit: 'high',
        status_change: 'medium',
        risk_flagged: 'critical',
        financial_update: 'medium',
      };

      const moments = result.rows.map((row: any) => ({
        id: row.id,
        dealId: row.deal_id,
        title: row.description || row.action_type,
        description: row.description || '',
        momentType: momentTypeMap[row.action_type] || 'milestone',
        date: row.created_at,
        importance: importanceMap[row.action_type] || 'medium',
        metadata: row.metadata || {},
      }));

      res.json({ success: true, data: moments });
    } catch (dbError: any) {
      if (dbError.code === '42P01' || dbError.code === '22P02') {
        res.json({ success: true, data: [] });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Error fetching deal key moments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch key moments' });
  }
});

// ============================================
// Tasks Endpoints
// ============================================

const taskStore: any[] = [
  {
    id: 1, title: 'Review Phase I Environmental Report',
    description: 'Review the Phase I Environmental Site Assessment for potential contamination issues',
    category: 'due_diligence', priority: 'high', status: 'todo', dealId: 1,
    assignedToId: 1, createdById: 1, source: 'manual', tags: ['environmental', 'urgent'],
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 2, title: 'Submit Rent Roll to Lender',
    description: 'Prepare and submit current rent roll to lender for financing review',
    category: 'financing', priority: 'medium', status: 'in_progress', dealId: 1,
    assignedToId: 1, createdById: 1, source: 'email_ai', tags: ['financing', 'documentation'],
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 3, title: 'Schedule Property Tour',
    description: 'Coordinate with broker to schedule property walkthrough',
    category: 'due_diligence', priority: 'medium', status: 'todo', dealId: 1,
    assignedToId: 1, createdById: 1, source: 'manual', tags: ['site-visit'],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];
let nextTaskId = 4;

app.get('/api/v1/tasks', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, dealId, category, priority } = req.query;
    let filtered = [...taskStore];
    if (status) filtered = filtered.filter(t => t.status === status);
    if (dealId) filtered = filtered.filter(t => t.dealId === parseInt(dealId as string));
    if (category) filtered = filtered.filter(t => t.category === category);
    if (priority) filtered = filtered.filter(t => t.priority === priority);

    const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    filtered.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));

    res.json({ success: true, data: filtered, count: filtered.length });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

app.get('/api/v1/tasks/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const byStatus = {
      todo: taskStore.filter(t => t.status === 'todo').length,
      in_progress: taskStore.filter(t => t.status === 'in_progress').length,
      blocked: taskStore.filter(t => t.status === 'blocked').length,
      done: taskStore.filter(t => t.status === 'done').length,
      cancelled: taskStore.filter(t => t.status === 'cancelled').length,
    };
    res.json({
      success: true,
      data: {
        total: taskStore.length,
        byStatus,
        overdue: taskStore.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'done').length,
        dueToday: taskStore.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString()).length,
        dueSoon: taskStore.filter(t => t.dueDate && new Date(t.dueDate) > today && new Date(t.dueDate) < new Date(today.getTime() + 7 * 86400000)).length,
      },
    });
  } catch (error) {
    console.error('Error fetching task stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task stats' });
  }
});

app.post('/api/v1/tasks', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, category, priority = 'medium', status = 'todo', dealId, dueDate, source = 'manual', tags = [] } = req.body;
    if (!title || !category) {
      return res.status(400).json({ success: false, error: 'Title and category are required' });
    }
    const newTask = {
      id: nextTaskId++, title, description, category, priority, status,
      dealId: dealId ? parseInt(dealId) : undefined,
      assignedToId: req.user!.userId, createdById: req.user!.userId,
      dueDate, source, tags,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    taskStore.push(newTask);
    res.status(201).json({ success: true, data: newTask });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

app.patch('/api/v1/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idx = taskStore.findIndex(t => t.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ success: false, error: 'Task not found' });
    const updates = req.body;
    if (updates.status === 'done' && taskStore[idx].status !== 'done') {
      updates.completedAt = new Date().toISOString();
    }
    taskStore[idx] = { ...taskStore[idx], ...updates, updatedAt: new Date().toISOString() };
    res.json({ success: true, data: taskStore[idx] });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

app.delete('/api/v1/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idx = taskStore.findIndex(t => t.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ success: false, error: 'Task not found' });
    taskStore.splice(idx, 1);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

// ============================================
// Inbox / Email Endpoints
// ============================================

app.get('/api/v1/inbox', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread_only === 'true';
    const search = req.query.search as string;

    let whereConditions = ['e.user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (unreadOnly) {
      whereConditions.push('e.is_read = FALSE');
    }
    if (search) {
      whereConditions.push(`(e.subject ILIKE $${paramIndex} OR e.from_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT e.*, d.name as deal_name,
        (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) as attachment_count
       FROM emails e
       LEFT JOIN deals d ON e.deal_id = d.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY e.received_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    if (error.code === '42P01') {
      res.json({ success: true, data: [] });
    } else {
      console.error('Error fetching inbox:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch emails' });
    }
  }
});

app.get('/api/v1/inbox/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const result = await pool.query(
      `SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE NOT is_read)::int as unread,
        COUNT(*) FILTER (WHERE is_flagged)::int as flagged,
        COUNT(*) FILTER (WHERE deal_id IS NOT NULL)::int as deal_related,
        COUNT(*) FILTER (WHERE has_attachments)::int as with_attachments
       FROM emails WHERE user_id = $1 AND NOT is_archived`,
      [userId]
    );
    res.json({ success: true, data: result.rows[0] || { total: 0, unread: 0, flagged: 0, deal_related: 0, with_attachments: 0 } });
  } catch (error: any) {
    if (error.code === '42P01') {
      res.json({ success: true, data: { total: 0, unread: 0, flagged: 0, deal_related: 0, with_attachments: 0 } });
    } else {
      console.error('Error fetching inbox stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
  }
});

app.get('/api/v1/inbox/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const emailId = parseInt(req.params.id);
    const result = await pool.query(
      `SELECT e.*, d.name as deal_name FROM emails e LEFT JOIN deals d ON e.deal_id = d.id WHERE e.id = $1 AND e.user_id = $2`,
      [emailId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    const attachments = await pool.query('SELECT * FROM email_attachments WHERE email_id = $1', [emailId]);
    const email = { ...result.rows[0], attachments: attachments.rows };
    res.json({ success: true, data: email });
  } catch (error: any) {
    console.error('Error fetching email:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch email' });
  }
});

app.patch('/api/v1/inbox/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const emailId = parseInt(req.params.id);
    const updates = req.body;
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['is_read', 'is_flagged', 'is_archived', 'deal_id'].includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    params.push(emailId, userId);
    await pool.query(
      `UPDATE emails SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      params
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating email:', error);
    res.status(500).json({ success: false, error: 'Failed to update email' });
  }
});

// ============================================
// News Intelligence Endpoints
// ============================================
import newsRouter from './api/rest/news.routes';
app.use('/api/v1/news', newsRouter);

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
// Lease Analysis Endpoint
// ============================================

app.get('/api/v1/deals/:id/lease-analysis', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const dealId = req.params.id;
    const client = req.dbClient || pool;

    const dealCheck = await client.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const result = await client.query(`
      SELECT 
        p.*,
        p.lease_expiration_date,
        p.current_lease_amount,
        p.lease_start_date,
        p.renewal_status
      FROM properties p
      JOIN deals d ON d.id = $1
      WHERE ST_Contains(d.boundary, ST_Point(p.lng, p.lat))
    `, [dealId]);

    const properties = result.rows;
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const expiringNext30 = properties.filter((p: any) =>
      p.lease_expiration_date &&
      new Date(p.lease_expiration_date) <= next30Days &&
      new Date(p.lease_expiration_date) >= now
    ).length;

    const expiringNext90 = properties.filter((p: any) =>
      p.lease_expiration_date &&
      new Date(p.lease_expiration_date) <= next90Days &&
      new Date(p.lease_expiration_date) >= now
    ).length;

    const totalUnits = properties.length;
    const rolloverRiskScore = totalUnits > 0 ? Math.round((expiringNext90 / totalUnits) * 100) : 0;

    const belowMarketUnits = properties.filter((p: any) =>
      p.current_lease_amount && p.rent && p.current_lease_amount < p.rent
    );

    const totalRentGap = belowMarketUnits.reduce((sum: number, p: any) =>
      sum + (p.rent - p.current_lease_amount), 0
    );

    const annualOpportunity = totalRentGap * 12;

    const timeline: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      const monthKey = monthStart.toISOString().slice(0, 7);

      timeline[monthKey] = properties.filter((p: any) => {
        if (!p.lease_expiration_date) return false;
        const expDate = new Date(p.lease_expiration_date);
        return expDate >= monthStart && expDate <= monthEnd;
      }).length;
    }

    res.json({
      success: true,
      data: {
        totalUnits,
        expiringNext30,
        expiringNext90,
        rolloverRiskScore,
        rolloverRiskLevel: rolloverRiskScore > 40 ? 'high' : rolloverRiskScore > 20 ? 'medium' : 'low',
        rentGapOpportunity: {
          unitsBelow: belowMarketUnits.length,
          monthlyGap: Math.round(totalRentGap),
          annualUpside: Math.round(annualOpportunity)
        },
        expirationTimeline: timeline
      }
    });
  } catch (error) {
    console.error('Lease analysis error:', error);
    res.status(500).json({ success: false, error: 'Lease analysis failed' });
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
  const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
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
