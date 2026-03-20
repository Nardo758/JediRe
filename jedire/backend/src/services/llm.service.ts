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
  // Check for Claude/Anthropic
  if (process.env.CLAUDE_API_KEY) {
    return {
      name: 'anthropic',
      apiKey: process.env.CLAUDE_API_KEY,
      endpoint: 'https://api.anthropic.com/v1/messages',
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
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

/**
 * Main LLM service - routes to appropriate provider
 */
export async function generateCompletion(request: LLMRequest): Promise<LLMResponse> {
  const provider = getLLMProvider();

  if (!provider) {
    throw new AppError(
      503,
      'LLM service not configured. Please set CLAUDE_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY in environment variables.'
    );
  }

  logger.info(`Calling ${provider.name} LLM API`, {
    model: provider.model,
    promptLength: request.prompt.length,
  });

  // Route to appropriate provider
  switch (provider.name) {
    case 'anthropic':
      return await callAnthropic(provider, request);
    case 'openai':
      return await callOpenAI(provider, request);
    case 'openrouter':
      return await callOpenRouter(provider, request);
    default:
      throw new AppError(500, `Unknown LLM provider: ${provider.name}`);
  }
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
