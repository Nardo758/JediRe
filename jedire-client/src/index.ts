/**
 * JediRe API Client - Main Entry Point
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

// Export main client
export { JediReClient } from './client';

// Export auth manager
export { AuthManager } from './auth';

// Export all types
export * from './types';

// Default export
import { JediReClient } from './client';
export default JediReClient;
