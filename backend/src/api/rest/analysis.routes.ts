/**
 * Market Analysis API Endpoints
 * 
 * REST endpoints for JEDI RE Phase 1 engines:
 * - Signal Processing (demand signals from rent trends)
 * - Carrying Capacity (supply-demand balance)
 * - Imbalance Detection (synthesized market verdicts)
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const router = Router();

// Python environment configuration
const PYTHON_CMD = process.env.PYTHON_PATH || '/home/leon/clawd/jedi-re/venv/bin/python3';
const ENGINES_DIR = '/home/leon/clawd/jedire/backend/python-services/engines';

/**
 * POST /api/v1/analysis/demand-signal
 * Analyze rent trends using Kalman filter, FFT, and signal processing
 * 
 * Body: {
 *   rent_timeseries: number[],  // Rent values (weekly or monthly)
 *   sampling_rate?: number      // Data points per year (default: 52 for weekly)
 * }
 */
router.post('/demand-signal', async (req: Request, res: Response) => {
  try {
    const { rent_timeseries, sampling_rate = 52 } = req.body;
    
    // Validate input
    if (!rent_timeseries || !Array.isArray(rent_timeseries) || rent_timeseries.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'rent_timeseries must be an array with at least 2 values',
      });
    }
    
    logger.info(`Analyzing demand signal with ${rent_timeseries.length} data points`);
    
    // Prepare input
    const input = JSON.stringify({ rent_timeseries, sampling_rate });
    
    // Call Python engine
    const cmd = `cd ${ENGINES_DIR} && echo '${input}' | ${PYTHON_CMD} demand_signal_wrapper.py`;
    const { stdout, stderr } = await execPromise(cmd);
    
    if (stderr) {
      logger.warn(`Python stderr: ${stderr}`);
    }
    
    // Parse output
    const result = JSON.parse(stdout);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Demand signal analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/analysis/carrying-capacity
 * Calculate supply-demand balance using ecological carrying capacity framework
 * 
 * Body: {
 *   name: string,                    // Submarket name
 *   population: number,              // Current population
 *   population_growth_rate: number,  // Annual rate (e.g., 0.012 = 1.2%)
 *   net_migration_annual: number,    // Net people moving in per year
 *   employment: number,              // Total employment
 *   employment_growth_rate: number,  // Annual rate
 *   median_income: number,           // Median income
 *   existing_units: number,          // Existing rental units
 *   pipeline_units: number,          // Units under construction
 *   future_permitted_units: number   // Permitted but not started
 * }
 */
router.post('/carrying-capacity', async (req: Request, res: Response) => {
  try {
    const submarketData = req.body;
    
    // Validate required fields
    const requiredFields = ['name', 'population', 'existing_units'];
    for (const field of requiredFields) {
      if (!(field in submarketData)) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`,
        });
      }
    }
    
    logger.info(`Analyzing carrying capacity for: ${submarketData.name}`);
    
    // Prepare input
    const input = JSON.stringify(submarketData);
    
    // Call Python engine
    const cmd = `cd ${ENGINES_DIR} && echo '${input}' | ${PYTHON_CMD} carrying_capacity_wrapper.py`;
    const { stdout, stderr } = await execPromise(cmd);
    
    if (stderr) {
      logger.warn(`Python stderr: ${stderr}`);
    }
    
    // Parse output
    const result = JSON.parse(stdout);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Carrying capacity analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/analysis/imbalance
 * Synthesize demand signals + supply analysis into actionable market verdict
 * 
 * Body: {
 *   // Submarket data (same as carrying-capacity)
 *   name: string,
 *   population: number,
 *   population_growth_rate?: number,
 *   net_migration_annual?: number,
 *   employment?: number,
 *   employment_growth_rate?: number,
 *   median_income?: number,
 *   existing_units: number,
 *   pipeline_units?: number,
 *   future_permitted_units?: number,
 *   
 *   // Demand signal data (two modes)
 *   use_costar_data?: boolean,      // If true, use 26-year CoStar timeseries (no rent_timeseries needed)
 *   rent_timeseries?: number[],     // Required if use_costar_data=false: Rent values (weekly/monthly)
 *   search_trend_change?: number    // YoY search interest change (optional)
 * }
 */
router.post('/imbalance', async (req: Request, res: Response) => {
  try {
    const inputData = req.body;
    
    // Validate required fields
    const requiredFields = ['name', 'population', 'existing_units'];
    for (const field of requiredFields) {
      if (!(field in inputData)) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`,
        });
      }
    }
    
    // Conditional validation: rent_timeseries required only if NOT using CoStar data
    const useCostarData = inputData.use_costar_data === true;
    
    if (!useCostarData) {
      if (!inputData.rent_timeseries) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: rent_timeseries (or set use_costar_data=true)',
        });
      }
      
      if (!Array.isArray(inputData.rent_timeseries) || inputData.rent_timeseries.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'rent_timeseries must be an array with at least 2 values',
        });
      }
    }
    
    logger.info(`Analyzing market imbalance for: ${inputData.name}`);
    
    // Prepare input
    const input = JSON.stringify(inputData);
    
    // Call Python engine
    const cmd = `cd ${ENGINES_DIR} && echo '${input}' | ${PYTHON_CMD} imbalance_wrapper.py`;
    const { stdout, stderr } = await execPromise(cmd);
    
    if (stderr) {
      logger.warn(`Python stderr: ${stderr}`);
    }
    
    // Parse output
    const result = JSON.parse(stdout);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Imbalance analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/analysis/market-signal
 * Get market demand signal from real CoStar historical timeseries data
 * Uses 26 years of Atlanta market rent data with signal processing
 * 
 * Body (optional): {
 *   use_full_history?: boolean  // If true, use 26-year history; if false, use 6-year complete dataset (default)
 * }
 * 
 * Returns: {
 *   success: true,
 *   market: "Atlanta",
 *   signal: {
 *     rent_growth_rate: number,      // Annualized rate (e.g., 0.0609 = 6.09%)
 *     confidence: number,            // 0-1 confidence score
 *     seasonal_component: number,    // Current seasonal adjustment
 *     trend_component: number,       // Current trend value
 *     noise_level: number,           // Historical volatility
 *     data_points: number,           // Number of months
 *     time_span_years: number,       // Years of data
 *     current_rent: number,          // Latest rent value
 *     processed_at: string           // ISO timestamp
 *   },
 *   metadata: {
 *     data_source: string,
 *     dataset_used: string,
 *     time_span_years: number,
 *     data_points: number,
 *     date_range: { start: string, end: string }
 *   }
 * }
 */
router.post('/market-signal', async (req: Request, res: Response) => {
  try {
    const { use_full_history = false } = req.body;
    
    logger.info(`Analyzing market signal from CoStar timeseries (full_history=${use_full_history})`);
    
    // Prepare input
    const input = JSON.stringify({ use_full_history });
    
    // Call Python wrapper
    const cmd = `cd ${ENGINES_DIR} && echo '${input}' | ${PYTHON_CMD} market_signal_wrapper.py`;
    const { stdout, stderr } = await execPromise(cmd);
    
    if (stderr) {
      logger.warn(`Python stderr: ${stderr}`);
    }
    
    // Parse output
    const result = JSON.parse(stdout);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Market signal analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/analysis/costar/submarkets
 * List all available CoStar submarkets with real market data
 * 
 * Returns: {
 *   success: true,
 *   metadata: {
 *     total_submarkets: number,
 *     total_units: number,
 *     avg_rent: number,
 *     avg_vacancy: number
 *   },
 *   submarkets: Array<{
 *     name: string,
 *     total_units: number,
 *     avg_effective_rent: number,
 *     avg_vacancy_pct: number,
 *     property_count: number,
 *     quality_score: number
 *   }>
 * }
 */
router.get('/costar/submarkets', async (req: Request, res: Response) => {
  try {
    logger.info('Listing CoStar submarkets');
    
    // Call Python wrapper
    const cmd = `cd ${ENGINES_DIR} && ${PYTHON_CMD} costar_list_wrapper.py`;
    const { stdout, stderr } = await execPromise(cmd);
    
    if (stderr && !stderr.includes('✓')) {  // Ignore info messages
      logger.warn(`Python stderr: ${stderr}`);
    }
    
    // Parse output (get only the JSON part)
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Python');
    }
    const result = JSON.parse(jsonMatch[0]);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('CoStar submarkets list failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/analysis/costar/analyze
 * Analyze a specific submarket using REAL CoStar data
 * 
 * Body: {
 *   submarket_name: string  // Name of submarket (e.g., "Central Midtown")
 * }
 * 
 * Returns: {
 *   success: true,
 *   submarket: string,
 *   costar_data: {
 *     total_units: number,
 *     avg_effective_rent: number,
 *     avg_asking_rent: number,
 *     avg_vacancy_pct: number,
 *     property_count: number,
 *     building_class_distribution: object,
 *     quality_score: number
 *   },
 *   analysis: {
 *     demand_units: number,
 *     demand_growth_annual: number,
 *     total_supply: number,
 *     existing_units: number,
 *     pipeline_units: number,
 *     saturation_pct: number,
 *     equilibrium_quarters: number,
 *     verdict: string,
 *     confidence: number,
 *     summary: string
 *   }
 * }
 */
router.post('/costar/analyze', async (req: Request, res: Response) => {
  try {
    const { submarket_name } = req.body;
    
    if (!submarket_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: submarket_name',
      });
    }
    
    logger.info(`Analyzing CoStar submarket: ${submarket_name}`);
    
    // Prepare input
    const input = JSON.stringify({ submarket_name });
    
    // Call Python wrapper
    const cmd = `cd ${ENGINES_DIR} && echo '${input}' | ${PYTHON_CMD} costar_analysis_wrapper.py`;
    const { stdout, stderr } = await execPromise(cmd);
    
    if (stderr && !stderr.includes('✓')) {  // Ignore info messages
      logger.warn(`Python stderr: ${stderr}`);
    }
    
    // Parse output (get only the JSON part)
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Python');
    }
    const result = JSON.parse(jsonMatch[0]);
    
    if (!result.success) {
      return res.status(result.available_submarkets ? 404 : 500).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('CoStar analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
