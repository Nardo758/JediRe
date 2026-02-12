/**
 * Python Pipeline Service
 * 
 * Wrapper for calling Python data pipeline scripts from Node.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { logger } from '../utils/logger';

const execPromise = promisify(exec);

const PYTHON_DIR = path.join(__dirname, '../../python-services');
const VENV_PYTHON = '/home/leon/clawd/jedi-re/venv/bin/python3';
const PYTHON_CMD = process.env.PYTHON_PATH || VENV_PYTHON;

export interface ParcelAnalysisResult {
  parcelId: string;
  address: string;
  currentUse: string;
  zoningCode: string;
  landArea: number;
  maxUnits: number;
  developmentPotential: {
    vacant: boolean;
    underbuilt: boolean;
    redevelopmentScore: number;
    estimatedUnits: number;
  };
  capacityMetrics: {
    far: number;
    heightLimit: number;
    density: number;
  };
}

export interface BatchLoadResult {
  success: boolean;
  parcelsProcessed: number;
  parcelsLoaded: number;
  errors: string[];
  duration: number;
}

export class PythonPipelineService {
  /**
   * Analyze a single parcel for development capacity
   */
  static async analyzeParcel(parcelId: string): Promise<ParcelAnalysisResult> {
    try {
      const cmd = `cd ${PYTHON_DIR} && ${PYTHON_CMD} load_parcels.py analyze --parcel-ids ${parcelId}`;
      logger.info(`Executing: ${cmd}`);
      
      const { stdout, stderr } = await execPromise(cmd);
      
      if (stderr) {
        logger.warn(`Python stderr: ${stderr}`);
      }
      
      const result = JSON.parse(stdout);
      return result;
    } catch (error) {
      logger.error(`Failed to analyze parcel ${parcelId}:`, error);
      throw new Error(`Parcel analysis failed: ${error.message}`);
    }
  }

  /**
   * Load parcel data from GIS files
   */
  static async loadParcels(
    pattern: string = 'fulton_parcels_complete.geojson',
    limit?: number
  ): Promise<BatchLoadResult> {
    try {
      const limitArg = limit ? `--limit ${limit}` : '';
      const cmd = `cd ${PYTHON_DIR} && ${PYTHON_CMD} load_parcels.py pipeline --pattern "${pattern}" ${limitArg}`;
      
      logger.info(`Loading parcels: ${cmd}`);
      
      const startTime = Date.now();
      const { stdout, stderr } = await execPromise(cmd, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      });
      const duration = Date.now() - startTime;
      
      if (stderr) {
        logger.warn(`Python stderr: ${stderr}`);
      }
      
      // Parse result from stdout
      const lines = stdout.split('\n');
      const summaryLine = lines.find(l => l.includes('parcels processed'));
      
      return {
        success: true,
        parcelsProcessed: extractNumber(summaryLine, 'processed') || 0,
        parcelsLoaded: extractNumber(summaryLine, 'loaded') || 0,
        errors: stderr ? [stderr] : [],
        duration,
      };
    } catch (error) {
      logger.error('Failed to load parcels:', error);
      throw new Error(`Parcel loading failed: ${error.message}`);
    }
  }

  /**
   * Load mock data for testing
   */
  static async loadMockData(types: string[] = ['all']): Promise<BatchLoadResult> {
    try {
      const typeArg = types.join(',');
      const cmd = `cd ${PYTHON_DIR} && ${PYTHON_CMD} load_mock_data.py --types ${typeArg}`;
      
      logger.info(`Loading mock data: ${cmd}`);
      
      const startTime = Date.now();
      const { stdout, stderr } = await execPromise(cmd);
      const duration = Date.now() - startTime;
      
      if (stderr) {
        logger.warn(`Python stderr: ${stderr}`);
      }
      
      return {
        success: true,
        parcelsProcessed: 0,
        parcelsLoaded: extractNumber(stdout, 'loaded') || 0,
        errors: stderr ? [stderr] : [],
        duration,
      };
    } catch (error) {
      logger.error('Failed to load mock data:', error);
      throw new Error(`Mock data loading failed: ${error.message}`);
    }
  }

  /**
   * Get pipeline status and statistics
   */
  static async getStatus(): Promise<any> {
    try {
      const cmd = `cd ${PYTHON_DIR} && ${PYTHON_CMD} -c "from data_pipeline.database import db_manager; print('Python pipeline OK')"`;
      const { stdout } = await execPromise(cmd);
      
      return {
        status: 'operational',
        pythonAvailable: stdout.includes('OK'),
        pipelineDir: PYTHON_DIR,
      };
    } catch (error) {
      return {
        status: 'error',
        pythonAvailable: false,
        error: error.message,
      };
    }
  }
}

/**
 * Helper: Extract number from text
 */
function extractNumber(text: string | undefined, keyword: string): number | null {
  if (!text) return null;
  
  const regex = new RegExp(`(\\d+)\\s*${keyword}`, 'i');
  const match = text.match(regex);
  return match ? parseInt(match[1], 10) : null;
}
