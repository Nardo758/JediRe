/**
 * Agent Settings Routes
 * 
 * Manages user preferences for AI agent configuration including
 * model selection, autonomy levels, and notification preferences.
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { Router, Request, Response } from 'express';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface AgentModelSettings {
  globalModel: string;
  agentOverrides: Record<string, string>;
}

interface WorkforceSettings {
  enabledAgents: string[];
  globalModel: string;
  agentModelOverrides: Record<string, string>;
  globalAutonomy: 'full' | 'supervised' | 'manual';
  agentAutonomyOverrides: Record<string, string>;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  notifyOnInsight: boolean;
  dailyBudgetLimit?: number;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/v1/settings/agents/models
 * Get user's agent model configuration
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default-user';

    const result = await query(
      `SELECT settings_json FROM user_agent_settings 
       WHERE user_id = $1 AND setting_type = 'models'
       ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0) {
      res.json({
        success: true,
        data: result.rows[0].settings_json,
      });
    } else {
      // Return defaults
      res.json({
        success: true,
        data: getDefaultModelSettings(),
      });
    }
  } catch (error) {
    logger.error('Failed to get agent model settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent model settings',
    });
  }
});

/**
 * PUT /api/v1/settings/agents/models
 * Update user's agent model configuration
 */
router.put('/models', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default-user';
    const settings: AgentModelSettings = req.body;

    // Validate settings
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings format',
      });
    }

    // Upsert settings
    await query(
      `INSERT INTO user_agent_settings (user_id, setting_type, settings_json, updated_at)
       VALUES ($1, 'models', $2, NOW())
       ON CONFLICT (user_id, setting_type) 
       DO UPDATE SET settings_json = $2, updated_at = NOW()`,
      [userId, JSON.stringify(settings)]
    );

    logger.info('Agent model settings updated:', { userId });

    res.json({
      success: true,
      message: 'Settings saved successfully',
    });
  } catch (error) {
    logger.error('Failed to save agent model settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save settings',
    });
  }
});

/**
 * GET /api/v1/settings/agents/workforce
 * Get full workforce configuration
 */
router.get('/workforce', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default-user';

    const result = await query(
      `SELECT settings_json FROM user_agent_settings 
       WHERE user_id = $1 AND setting_type = 'workforce'
       ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0) {
      res.json({
        success: true,
        data: result.rows[0].settings_json,
      });
    } else {
      res.json({
        success: true,
        data: getDefaultWorkforceSettings(),
      });
    }
  } catch (error) {
    logger.error('Failed to get workforce settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workforce settings',
    });
  }
});

/**
 * PUT /api/v1/settings/agents/workforce
 * Update full workforce configuration
 */
router.put('/workforce', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default-user';
    const settings: WorkforceSettings = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings format',
      });
    }

    await query(
      `INSERT INTO user_agent_settings (user_id, setting_type, settings_json, updated_at)
       VALUES ($1, 'workforce', $2, NOW())
       ON CONFLICT (user_id, setting_type) 
       DO UPDATE SET settings_json = $2, updated_at = NOW()`,
      [userId, JSON.stringify(settings)]
    );

    logger.info('Workforce settings updated:', { userId });

    res.json({
      success: true,
      message: 'Workforce settings saved successfully',
    });
  } catch (error) {
    logger.error('Failed to save workforce settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save settings',
    });
  }
});

/**
 * GET /api/v1/settings/agents/:agentCode/model
 * Get model for a specific agent
 */
router.get('/:agentCode/model', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default-user';
    const { agentCode } = req.params;

    const result = await query(
      `SELECT settings_json FROM user_agent_settings 
       WHERE user_id = $1 AND setting_type = 'models'`,
      [userId]
    );

    let model = 'claude-3-sonnet'; // Default

    if (result.rows.length > 0) {
      const settings = result.rows[0].settings_json as AgentModelSettings;
      model = settings.agentOverrides?.[agentCode] || settings.globalModel || model;
    }

    res.json({
      success: true,
      agentCode,
      model,
    });
  } catch (error) {
    logger.error('Failed to get agent model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent model',
    });
  }
});

/**
 * PUT /api/v1/settings/agents/:agentCode/model
 * Set model for a specific agent
 */
router.put('/:agentCode/model', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default-user';
    const { agentCode } = req.params;
    const { model } = req.body;

    if (!model || typeof model !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Model is required',
      });
    }

    // Get current settings
    const result = await query(
      `SELECT settings_json FROM user_agent_settings 
       WHERE user_id = $1 AND setting_type = 'models'`,
      [userId]
    );

    let settings: AgentModelSettings = result.rows.length > 0
      ? result.rows[0].settings_json
      : getDefaultModelSettings();

    // Update specific agent override
    settings.agentOverrides = settings.agentOverrides || {};
    settings.agentOverrides[agentCode] = model;

    // Save
    await query(
      `INSERT INTO user_agent_settings (user_id, setting_type, settings_json, updated_at)
       VALUES ($1, 'models', $2, NOW())
       ON CONFLICT (user_id, setting_type) 
       DO UPDATE SET settings_json = $2, updated_at = NOW()`,
      [userId, JSON.stringify(settings)]
    );

    res.json({
      success: true,
      agentCode,
      model,
    });
  } catch (error) {
    logger.error('Failed to set agent model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save agent model',
    });
  }
});

// ============================================================================
// Helpers
// ============================================================================

function getDefaultModelSettings(): AgentModelSettings {
  return {
    globalModel: 'claude-3-sonnet',
    agentOverrides: {
      ORCHESTRATOR: 'claude-3-opus',
      STRATEGY: 'claude-3-opus',
      AN05: 'claude-3-opus', // Legal
      AN12: 'claude-3-opus', // Investment Analyst
      AN15: 'claude-3-opus', // Tax Strategist
    },
  };
}

function getDefaultWorkforceSettings(): WorkforceSettings {
  return {
    enabledAgents: [
      'data-collector', 'zoning-agent', 'market-analyst', 
      'risk-scorer', 'strategy-engine', 'orchestrator',
      'cfo', 'accountant', 'legal-advisor', 'developer', 
      'lender', 'acquisitions', 'asset-manager', 'investment-analyst',
    ],
    globalModel: 'claude-3-sonnet',
    agentModelOverrides: {
      orchestrator: 'claude-3-opus',
      'strategy-engine': 'claude-3-opus',
      'data-collector': 'claude-3-haiku',
      'comp-scraper': 'claude-3-haiku',
    },
    globalAutonomy: 'supervised',
    agentAutonomyOverrides: {},
    notifyOnComplete: true,
    notifyOnError: true,
    notifyOnInsight: true,
  };
}

export default router;
