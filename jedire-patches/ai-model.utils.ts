/**
 * AI Model Utilities
 * Centralized model selection and configuration for JediRe AI features
 * 
 * Location: backend/src/utils/ai-model.utils.ts
 */

import { query } from '../db';

export interface AIModelConfig {
  modelId: string;
  displayName: string;
  provider: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsThinking: boolean;
}

export interface UserAIPreferences {
  defaultModel: string;
  riskAnalysisModel: string;
  strategyModel: string;
  chatModel: string;
  enableStreaming: boolean;
  enableThinking: boolean;
  maxTokens: number;
  temperature: number;
}

// Default model when no user preference exists
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// Model configurations (fallback if DB unavailable)
const MODEL_CONFIGS: Record<string, AIModelConfig> = {
  'claude-opus-4-20250514': {
    modelId: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    provider: 'anthropic',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsThinking: true,
  },
  'claude-sonnet-4-20250514': {
    modelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    provider: 'anthropic',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsThinking: false,
  },
  'claude-3-5-sonnet-20241022': {
    modelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsThinking: false,
  },
  'claude-3-5-haiku-20241022': {
    modelId: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsThinking: false,
  },
};

/**
 * Get user's preferred AI model for a specific use case
 */
export async function getUserAIModel(
  userId: string | undefined,
  useCase: 'default' | 'risk' | 'strategy' | 'chat' = 'default'
): Promise<string> {
  if (!userId) {
    return DEFAULT_MODEL;
  }

  try {
    const result = await query(
      `SELECT 
        default_model,
        risk_analysis_model,
        strategy_model,
        chat_model
       FROM user_ai_preferences 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return DEFAULT_MODEL;
    }

    const prefs = result.rows[0];
    
    switch (useCase) {
      case 'risk':
        return prefs.risk_analysis_model || prefs.default_model || DEFAULT_MODEL;
      case 'strategy':
        return prefs.strategy_model || prefs.default_model || DEFAULT_MODEL;
      case 'chat':
        return prefs.chat_model || prefs.default_model || DEFAULT_MODEL;
      default:
        return prefs.default_model || DEFAULT_MODEL;
    }
  } catch (error) {
    console.error('Error fetching user AI model preference:', error);
    return DEFAULT_MODEL;
  }
}

/**
 * Get full user AI preferences
 */
export async function getUserAIPreferences(userId: string): Promise<UserAIPreferences | null> {
  try {
    const result = await query(
      `SELECT 
        default_model,
        risk_analysis_model,
        strategy_model,
        chat_model,
        enable_streaming,
        enable_thinking,
        max_tokens,
        temperature
       FROM user_ai_preferences 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      defaultModel: row.default_model || DEFAULT_MODEL,
      riskAnalysisModel: row.risk_analysis_model || row.default_model || DEFAULT_MODEL,
      strategyModel: row.strategy_model || row.default_model || DEFAULT_MODEL,
      chatModel: row.chat_model || row.default_model || DEFAULT_MODEL,
      enableStreaming: row.enable_streaming ?? true,
      enableThinking: row.enable_thinking ?? false,
      maxTokens: row.max_tokens || 4096,
      temperature: parseFloat(row.temperature) || 0.7,
    };
  } catch (error) {
    console.error('Error fetching user AI preferences:', error);
    return null;
  }
}

/**
 * Update user AI preferences (upsert)
 */
export async function updateUserAIPreferences(
  userId: string,
  preferences: Partial<UserAIPreferences>
): Promise<boolean> {
  try {
    const updates: string[] = [];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (preferences.defaultModel !== undefined) {
      updates.push(`default_model = $${paramIndex++}`);
      values.push(preferences.defaultModel);
    }
    if (preferences.riskAnalysisModel !== undefined) {
      updates.push(`risk_analysis_model = $${paramIndex++}`);
      values.push(preferences.riskAnalysisModel);
    }
    if (preferences.strategyModel !== undefined) {
      updates.push(`strategy_model = $${paramIndex++}`);
      values.push(preferences.strategyModel);
    }
    if (preferences.chatModel !== undefined) {
      updates.push(`chat_model = $${paramIndex++}`);
      values.push(preferences.chatModel);
    }
    if (preferences.enableStreaming !== undefined) {
      updates.push(`enable_streaming = $${paramIndex++}`);
      values.push(preferences.enableStreaming);
    }
    if (preferences.enableThinking !== undefined) {
      updates.push(`enable_thinking = $${paramIndex++}`);
      values.push(preferences.enableThinking);
    }
    if (preferences.maxTokens !== undefined) {
      updates.push(`max_tokens = $${paramIndex++}`);
      values.push(preferences.maxTokens);
    }
    if (preferences.temperature !== undefined) {
      updates.push(`temperature = $${paramIndex++}`);
      values.push(preferences.temperature);
    }

    if (updates.length === 0) {
      return false;
    }

    await query(
      `INSERT INTO user_ai_preferences (user_id, ${updates.map(u => u.split(' = ')[0]).join(', ')})
       VALUES ($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}`,
      values
    );

    return true;
  } catch (error) {
    console.error('Error updating user AI preferences:', error);
    return false;
  }
}

/**
 * Get available AI models
 */
export async function getAvailableModels(): Promise<AIModelConfig[]> {
  try {
    const result = await query(
      `SELECT id, display_name, provider, max_tokens, supports_streaming, supports_thinking
       FROM ai_models 
       WHERE is_active = true 
       ORDER BY sort_order`
    );

    return result.rows.map(row => ({
      modelId: row.id,
      displayName: row.display_name,
      provider: row.provider,
      maxTokens: row.max_tokens,
      supportsStreaming: row.supports_streaming,
      supportsThinking: row.supports_thinking,
    }));
  } catch (error) {
    console.error('Error fetching available models:', error);
    // Return fallback models
    return Object.values(MODEL_CONFIGS);
  }
}

/**
 * Get model configuration
 */
export function getModelConfig(modelId: string): AIModelConfig {
  return MODEL_CONFIGS[modelId] || MODEL_CONFIGS[DEFAULT_MODEL];
}

/**
 * Validate model ID
 */
export function isValidModel(modelId: string): boolean {
  return modelId in MODEL_CONFIGS;
}
