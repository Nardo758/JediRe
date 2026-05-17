/**
 * LLM Service
 * Secure server-side integration with external LLM API
 * API keys never exposed to frontend
 */

import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// Type definitions
interface LLMRequest {
  prompt: string;
  context?: Record<string, any>;
  maxTokens?: number;
  temperature?: number;
  model?: string;  // Optional model override (e.g., 'claude-3-opus', 'gpt-4')
}

interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface LLMProvider {
  name: string;
  apiKey: string;
  endpoint: string;
  model: string;
}

/**
 * Get configured LLM provider from environment
 */
function getLLMProvider(): LLMProvider | null {
  // Check for DeepSeek first — cost-efficient and preferred for lightweight
  // inference tasks like the Neural Network Hub "Ask Network" chat.
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      name: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      endpoint: `${(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    };
  }

  // Check for Claude/Anthropic.
  // Prefer the AI_INTEGRATIONS proxy key/URL (Replit ModelFarm) so that
  // proxy-issued keys don't get sent directly to api.anthropic.com (which
  // returns 404/auth errors).  Falls back to CLAUDE_API_KEY for local dev.
  const anthropicKey =
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (anthropicKey) {
    const baseUrl = (
      process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
    ).replace(/\/$/, '');
    return {
      name: 'anthropic',
      apiKey: anthropicKey,
      endpoint: `${baseUrl}/v1/messages`,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
    };
  }

  // Check for OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      name: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    };
  }

  // Check for OpenRouter (multi-model gateway)
  if (process.env.OPENROUTER_API_KEY) {
    return {
      name: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
    };
  }

  return null;
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(
  provider: LLMProvider,
  request: LLMRequest
): Promise<LLMResponse> {
  try {
    const response = await axios.post(
      provider.endpoint,
      {
        model: provider.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: 60000, // 60 second timeout
      }
    );

    return {
      text: response.data.content[0].text,
      usage: {
        promptTokens: response.data.usage.input_tokens,
        completionTokens: response.data.usage.output_tokens,
        totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens,
      },
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      logger.error('Anthropic API error:', axiosError.response?.data);
      throw new AppError(
        axiosError.response?.status || 500,
        `LLM API error: ${axiosError.message}`
      );
    }
    throw error;
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  provider: LLMProvider,
  request: LLMRequest
): Promise<LLMResponse> {
  try {
    const response = await axios.post(
      provider.endpoint,
      {
        model: provider.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        timeout: 60000,
      }
    );

    return {
      text: response.data.choices[0].message.content,
      usage: {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens,
      },
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      logger.error('OpenAI API error:', axiosError.response?.data);
      throw new AppError(
        axiosError.response?.status || 500,
        `LLM API error: ${axiosError.message}`
      );
    }
    throw error;
  }
}

/**
 * Call OpenRouter API (supports multiple models)
 */
async function callOpenRouter(
  provider: LLMProvider,
  request: LLMRequest
): Promise<LLMResponse> {
  try {
    const response = await axios.post(
      provider.endpoint,
      {
        model: provider.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'https://jedire.com',
          'X-Title': 'JediRe',
        },
        timeout: 60000,
      }
    );

    return {
      text: response.data.choices[0].message.content,
      usage: response.data.usage
        ? {
            promptTokens: response.data.usage.prompt_tokens,
            completionTokens: response.data.usage.completion_tokens,
            totalTokens: response.data.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      logger.error('OpenRouter API error:', axiosError.response?.data);
      throw new AppError(
        axiosError.response?.status || 500,
        `LLM API error: ${axiosError.message}`
      );
    }
    throw error;
  }
}

// Model name to actual API model ID mapping
const MODEL_MAP: Record<string, { provider: string; model: string }> = {
  // Claude models (via Anthropic or OpenRouter)
  // Legacy aliases. Mapped to current bare versioned IDs because the
  // ModelFarm proxy rejects date-suffixed Sonnet/Opus/3.5-Haiku IDs.
  'claude-3-opus':   { provider: 'anthropic', model: 'claude-opus-4-5' },
  'claude-3-sonnet': { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  'claude-3-haiku':  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  // OpenAI models
  'gpt-4': { provider: 'openai', model: 'gpt-4o' },
  'gpt-4-turbo': { provider: 'openai', model: 'gpt-4-turbo' },
  'gpt-3.5-turbo': { provider: 'openai', model: 'gpt-4o-mini' },
  // DeepSeek (cheap; ideal for plumbing/codegen workloads)
  'deepseek-chat':     { provider: 'deepseek', model: 'deepseek-chat' },
  'deepseek-reasoner': { provider: 'deepseek', model: 'deepseek-reasoner' },
  // Other models (via OpenRouter)
  'gemini-pro': { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
  'llama-3-70b': { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct' },
};

/**
 * Main LLM service - routes to appropriate provider
 */
export async function generateCompletion(request: LLMRequest): Promise<LLMResponse> {
  let provider = getLLMProvider();

  if (!provider) {
    throw new AppError(
      503,
      'LLM service not configured. Please set CLAUDE_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY in environment variables.'
    );
  }

  // If a specific model is requested, override the provider model
  if (request.model && MODEL_MAP[request.model]) {
    const modelInfo = MODEL_MAP[request.model];
    provider = {
      ...provider,
      model: modelInfo.model,
      // Only switch provider if we have the necessary API key
      name: getProviderWithKey(modelInfo.provider) || provider.name,
    };
  }

  logger.info(`Calling ${provider.name} LLM API`, {
    model: provider.model,
    requestedModel: request.model,
    promptLength: request.prompt.length,
  });

  // Route to appropriate provider
  switch (provider.name) {
    case 'anthropic':
      return await callAnthropic(provider, request);
    case 'openai':
      return await callOpenAI(provider, request);
    case 'deepseek':
      // DeepSeek uses an OpenAI-compatible chat-completions schema, so the
      // OpenAI caller works as-is (Bearer auth, same response shape).
      return await callOpenAI(provider, request);
    case 'openrouter':
      return await callOpenRouter(provider, request);
    default:
      throw new AppError(500, `Unknown LLM provider: ${provider.name}`);
  }
}

/**
 * Check if we have API key for a specific provider
 */
function getProviderWithKey(preferredProvider: string): string | null {
  if (preferredProvider === 'anthropic' && process.env.CLAUDE_API_KEY) {
    return 'anthropic';
  }
  if (preferredProvider === 'openai' && process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  if (preferredProvider === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
    return 'deepseek';
  }
  // Fall back to OpenRouter for models we don't have direct API access to
  if (process.env.OPENROUTER_API_KEY) {
    return 'openrouter';
  }
  return null;
}

/**
 * Generate property analysis using LLM
 */
export async function analyzeProperty(property: any): Promise<string> {
  const prompt = `Analyze this real estate property and provide investment insights:

Address: ${property.address_line1}, ${property.city}, ${property.state_code} ${property.zip_code}
Property Type: ${property.property_type}
Lot Size: ${property.lot_size_sqft} sq ft
Building Size: ${property.building_sqft} sq ft
Year Built: ${property.year_built}
Zoning: ${property.zoning_code || 'Unknown'}
Current Use: ${property.current_use}

Provide:
1. Development potential
2. Market positioning
3. Investment considerations
4. Risks and opportunities

Keep response concise (under 300 words).`;

  const response = await generateCompletion({
    prompt,
    maxTokens: 500,
    temperature: 0.7,
  });

  return response.text;
}

/**
 * Generate market analysis using LLM
 */
export async function analyzeMarket(marketData: any): Promise<string> {
  const prompt = `Analyze this real estate market data:

Market: ${marketData.city}, ${marketData.state}
Total Properties: ${marketData.propertyCount}
Average Price: $${marketData.averagePrice}
Average Lot Size: ${marketData.avgLotSize} sq ft
Property Types: ${JSON.stringify(marketData.propertyTypes)}

Provide:
1. Market trends
2. Investment opportunities
3. Risk factors
4. Recommendations

Keep response concise (under 300 words).`;

  const response = await generateCompletion({
    prompt,
    maxTokens: 500,
    temperature: 0.7,
  });

  return response.text;
}

/**
 * Check if LLM service is available
 */
export function isLLMAvailable(): boolean {
  return getLLMProvider() !== null;
}

/**
 * Get LLM provider info (without exposing API key)
 */
export function getLLMInfo(): { provider: string; model: string } | null {
  const provider = getLLMProvider();
  if (!provider) return null;

  return {
    provider: provider.name,
    model: provider.model,
  };
}
