/**
 * JediRe Backend API - Main Entry Point
 * Lightweight architecture with Express, GraphQL, and WebSocket support
 */

import express, { Application } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { connectDatabase } from './database/connection';
import { typeDefs, resolvers } from './api/graphql';
import { setupRESTRoutes } from './api/rest';
import { setupWebSocket } from './api/websocket';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

class JediReServer {
  private app: Application;
  private httpServer: http.Server;
  private io: SocketIOServer;
  private apolloServer: ApolloServer;

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.WS_CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
      },
      pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000'),
      pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '20000'),
    });

    this.apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => ({
        user: req.user,
        req,
      }),
      introspection: NODE_ENV === 'development',
      formatError: (error) => {
        logger.error('GraphQL Error:', error);
        return error;
      },
    });
  }

  private async setupMiddleware(): Promise<void> {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    this.app.use(rateLimiter);

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });
  }

  private async setupRoutes(): Promise<void> {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
      });
    });

    // API version info
    this.app.get('/', (req, res) => {
      res.json({
        name: 'JediRe API',
        version: process.env.API_VERSION || 'v1',
        description: 'Lightweight real estate intelligence platform',
        endpoints: {
          rest: '/api/v1',
          graphql: '/graphql',
          websocket: 'ws://localhost:' + PORT,
        },
      });
    });

    // Setup REST API routes
    setupRESTRoutes(this.app);

    // Setup Apollo GraphQL
    await this.apolloServer.start();
    this.apolloServer.applyMiddleware({
      app: this.app,
      path: '/graphql',
      cors: false, // Already handled by Express CORS
    });

    // Setup WebSocket handlers
    setupWebSocket(this.io);

    // Error handling (must be last)
    this.app.use(errorHandler);
  }

  private async connectDatabase(): Promise<void> {
    try {
      await connectDatabase();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.warn('Database connection failed - running without database:', {
        error: (error as Error).message,
        note: 'Some features requiring database will not be available'
      });
      // Don't throw - allow server to start without database in development
      if (NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.connectDatabase();

      // Setup middleware
      await this.setupMiddleware();

      // Setup routes
      await this.setupRoutes();

      // Start server
      this.httpServer.listen(PORT, () => {
        logger.info(`🚀 JediRe API Server running on port ${PORT}`);
        logger.info(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
        logger.info(`🔌 WebSocket server: ws://localhost:${PORT}`);
        logger.info(`🏠 REST API: http://localhost:${PORT}/api/v1`);
        logger.info(`⚙️  Environment: ${NODE_ENV}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');

    // Close WebSocket connections
    this.io.close();

    // Stop Apollo Server
    await this.apolloServer.stop();

    // Close HTTP server
    this.httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }
}

// Start the server
const server = new JediReServer();
server.start().catch((error) => {
  logger.error('Fatal error during startup:', error);
  process.exit(1);
});

export default server;
