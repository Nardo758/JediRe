/**
 * createMeteringAdapter — Provider-agnostic metering adapter factory.
 *
 * Returns the right adapter (MeteringAdapter for Claude, DeepSeekMeteringAdapter
 * for DeepSeek) based on the model name. Both adapters implement the same
 * createMessage interface so AgentRuntime works unchanged.
 *
 * Also exports the shared MessageParams/MeteredMessage types so AgentRuntime
 * doesn't depend on Anthropic types directly.
 */

import Anthropic from '@anthropic-ai/sdk';
import { MeteringAdapter } from './MeteringAdapter';
import { DeepSeekMeteringAdapter } from './DeepSeekMeteringAdapter';
import { detectProvider } from './types';
import type { MeteringMetadata } from './types';

// ── Shared interface for both adapters ──────────────────────────

export interface AdapterMessageParams {
  model: string;
  system: string;
  messages: unknown[];
  tools?: unknown[];
  max_tokens: number;
  metadata: MeteringMetadata;
}

export interface AdapterMessageResponse {
  id: string;
  model: string;
  content: unknown[];
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
}

// ── DeepSeek → Adapter adaptor ──────────────────────────────────

/**
 * Wrap DeepSeekMeteringAdapter's response into the common
 * AdapterMessageResponse format (mimics Anthropic content blocks).
 */
function adaptDeepSeekResponse(resp: Awaited<ReturnType<DeepSeekMeteringAdapter['createMessage']>>): AdapterMessageResponse {
  return {
    id: resp.id,
    model: resp.model,
    content: [
      {
        type: 'text',
        text: resp.text,
      },
    ],
    stop_reason: resp.finish_reason,
    usage: {
      input_tokens: resp.usage.prompt_tokens,
      output_tokens: resp.usage.completion_tokens,
      cost_usd: resp.usage.cost_usd,
    },
  };
}

/**
 * Build DeepSeek-compatible messages from the generic message list.
 * DeepSeek uses OpenAI-style format: system as separate message + role field.
 */
function adaptMessagesToDeepSeek(
  messages: unknown[],
  systemPrompt: string
): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages as Array<{ role: string; content: string | unknown[] }>) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      // Tool call blocks — DeepSeek expects text-only in assistant messages
      result.push({ role: msg.role, content: JSON.stringify(msg.content) });
    } else if (msg.role === 'user' && Array.isArray(msg.content)) {
      // Tool results
      result.push({ role: msg.role, content: JSON.stringify(msg.content) });
    } else {
      result.push({ role: msg.role, content: String(msg.content ?? '') });
    }
  }
  return result;
}

// ── Provider-aware factory ──────────────────────────────────────

export function createMeteringAdapter(modelName: string) {
  const provider = detectProvider(modelName);

  if (provider === 'deepseek') {
    const adapter = new DeepSeekMeteringAdapter();
    return {
      createMessage: async (params: AdapterMessageParams): Promise<AdapterMessageResponse> => {
        const dsMessages = adaptMessagesToDeepSeek(params.messages, params.system);
        const resp = await adapter.createMessage({
          model: modelName,
          messages: dsMessages,
          max_tokens: params.max_tokens,
          metadata: params.metadata,
        });
        return adaptDeepSeekResponse(resp);
      },
    };
  }

  // Default: Anthropic MeteringAdapter
  const adapter = new MeteringAdapter();
  return {
    createMessage: async (params: AdapterMessageParams): Promise<AdapterMessageResponse> => {
      const resp = await adapter.createMessage({
        model: params.model,
        system: params.system,
        messages: params.messages as Anthropic.MessageParam[],
        tools: params.tools as Anthropic.Tool[],
        max_tokens: params.max_tokens,
        metadata: params.metadata,
      });
      return {
        id: resp.id,
        model: resp.model,
        content: resp.content,
        stop_reason: resp.stop_reason,
        usage: {
          input_tokens: resp.usage.input_tokens,
          output_tokens: resp.usage.output_tokens,
          cost_usd: resp.usage.cost_usd,
        },
      };
    },
  };
}
