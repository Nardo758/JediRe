/**
 * AI Preferences API Routes
 * Handles user AI model preferences CRUD operations
 * 
 * Location: backend/src/api/rest/ai-preferences.routes.ts
 * Register in: backend/src/api/rest/index.ts
 */

import { Router, Request, Response } from 'express';
import { 
  getUserAIPreferences, 
  updateUserAIPreferences, 
  getAvailableModels,
  isValidModel 
} from '../../utils/ai-model.utils';

const router = Router();

/**
 * GET /api/v1/ai-preferences
 * Get current user's AI preferences
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const preferences = await getUserAIPreferences(userId);
    
    if (!preferences) {
      // Return defaults if no preferences set
      return res.json({
        defaultModel: 'claude-sonnet-4-20250514',
        riskAnalysisModel: 'claude-sonnet-4-20250514',
        strategyModel: 'claude-sonnet-4-20250514',
        chatModel: 'claude-sonnet-4-20250514',
        enableStreaming: true,
        enableThinking: false,
        maxTokens: 4096,
        temperature: 0.7,
        isDefault: true,
      });
    }

    res.json({ ...preferences, isDefault: false });
  } catch (error) {
    console.error('Error fetching AI preferences:', error);
    res.status(500).json({ error: 'Failed to fetch AI preferences' });
  }
});

/**
 * PUT /api/v1/ai-preferences
 * Update current user's AI preferences
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      defaultModel,
      riskAnalysisModel,
      strategyModel,
      chatModel,
      enableStreaming,
      enableThinking,
      maxTokens,
      temperature,
    } = req.body;

    // Validate model IDs if provided
    const modelsToValidate = [defaultModel, riskAnalysisModel, strategyModel, chatModel].filter(Boolean);
    for (const modelId of modelsToValidate) {
      if (!isValidModel(modelId)) {
        return res.status(400).json({ error: `Invalid model ID: ${modelId}` });
      }
    }

    // Validate numeric fields
    if (maxTokens !== undefined && (maxTokens < 100 || maxTokens > 16000)) {
      return res.status(400).json({ error: 'maxTokens must be between 100 and 16000' });
    }
    if (temperature !== undefined && (temperature < 0 || temperature > 1)) {
      return res.status(400).json({ error: 'temperature must be between 0 and 1' });
    }

    const success = await updateUserAIPreferences(userId, {
      defaultModel,
      riskAnalysisModel,
      strategyModel,
      chatModel,
      enableStreaming,
      enableThinking,
      maxTokens,
      temperature,
    });

    if (!success) {
      return res.status(500).json({ error: 'Failed to update preferences' });
    }

    // Return updated preferences
    const updated = await getUserAIPreferences(userId);
    res.json({ ...updated, isDefault: false });
  } catch (error) {
    console.error('Error updating AI preferences:', error);
    res.status(500).json({ error: 'Failed to update AI preferences' });
  }
});

/**
 * GET /api/v1/ai-preferences/models
 * Get list of available AI models
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await getAvailableModels();
    res.json({ models });
  } catch (error) {
    console.error('Error fetching available models:', error);
    res.status(500).json({ error: 'Failed to fetch available models' });
  }
});

/**
 * POST /api/v1/ai-preferences/reset
 * Reset user's AI preferences to defaults
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const success = await updateUserAIPreferences(userId, {
      defaultModel: 'claude-sonnet-4-20250514',
      riskAnalysisModel: 'claude-sonnet-4-20250514',
      strategyModel: 'claude-sonnet-4-20250514',
      chatModel: 'claude-sonnet-4-20250514',
      enableStreaming: true,
      enableThinking: false,
      maxTokens: 4096,
      temperature: 0.7,
    });

    if (!success) {
      return res.status(500).json({ error: 'Failed to reset preferences' });
    }

    res.json({ message: 'Preferences reset to defaults' });
  } catch (error) {
    console.error('Error resetting AI preferences:', error);
    res.status(500).json({ error: 'Failed to reset AI preferences' });
  }
});

export default router;
