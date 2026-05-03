import { apiClient } from './api.client';
import { logSwallowedError } from '../utils/swallowedError';

const BASE = '/api/v1/opus';

export interface OpusConversation {
  id: number;
  deal_id: string;
  user_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: OpusMessage[];
}

export interface OpusMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: any;
  created_at: string;
}

export interface ProformaVersion {
  id: number;
  deal_id: string;
  conversation_id: number | null;
  version_name: string;
  version_number: number;
  proforma_data: ProformaData;
  assumptions: any;
  comparable_sources: any[];
  created_at: string;
  updated_at: string;
}

export interface ProformaData {
  name: string;
  holdPeriod: number;
  acquisition: {
    purchasePrice: number;
    pricePerUnit: number;
    closingCosts: number;
    renovationBudget: number;
    totalBasis: number;
  };
  financing: {
    loanAmount: number;
    ltv: number;
    interestRate: number;
    termYears: number;
    amortizationYears: number;
    annualDebtService: number;
  };
  operations: {
    grossRent: number;
    vacancy: number;
    otherIncome: number;
    effectiveGrossIncome: number;
    operatingExpenses: number;
    expenseRatio: number;
    noi: number;
  };
  returns: {
    cashOnCash: number;
    irr: number;
    equityMultiple: number;
    dscr: number;
    capRateEntry: number;
    capRateExit: number;
  };
  yearlyProjection?: {
    year: number;
    revenue: number;
    expenses: number;
    noi: number;
    debtService: number;
    cashFlow: number;
  }[];
}

export const opusProformaService = {
  async getConversations(dealId: string): Promise<OpusConversation[]> {
    const { data } = await apiClient.get(`${BASE}/conversations`, { params: { dealId } });
    return data;
  },

  async createConversation(dealId: string, title?: string): Promise<OpusConversation> {
    const { data } = await apiClient.post(`${BASE}/conversations`, { dealId, title });
    return data;
  },

  async getConversation(id: number): Promise<OpusConversation> {
    const { data } = await apiClient.get(`${BASE}/conversations/${id}`);
    return data;
  },

  async deleteConversation(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/conversations/${id}`);
  },

  async streamMessage(
    conversationId: number,
    content: string,
    dealId: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const response = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, dealId }),
    });

    if (!response.ok) {
      onError?.('Failed to send message');
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.('No response stream');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.done) {
              onDone();
              return;
            }
            if (parsed.content) {
              onChunk(parsed.content);
            }
            if (parsed.error) {
              onError?.(parsed.error);
              return;
            }
          } catch (e) { logSwallowedError('services/opusProforma.service', e); }
        }
      }
    }
    onDone();
  },

  async getProformaVersions(dealId: string): Promise<ProformaVersion[]> {
    const { data } = await apiClient.get(`${BASE}/proforma-versions`, { params: { dealId } });
    return data;
  },

  async getProformaVersion(id: number): Promise<ProformaVersion> {
    const { data } = await apiClient.get(`${BASE}/proforma-versions/${id}`);
    return data;
  },

  async saveProformaVersion(
    dealId: string,
    versionName: string,
    proformaData: any,
    conversationId?: number,
    assumptions?: any
  ): Promise<ProformaVersion> {
    const { data } = await apiClient.post(`${BASE}/proforma-versions`, {
      dealId,
      conversationId,
      versionName,
      proformaData,
      assumptions,
    });
    return data;
  },

  async deleteProformaVersion(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/proforma-versions/${id}`);
  },

  parseProformaFromResponse(text: string): ProformaData | null {
    const match = text.match(/```proforma\n([\s\S]*?)```/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  },

  // ──────────────────────────────────────────────────────────────────────
  // Custom Tabs (Task #451) — Opus-generated F9 sub-tabs
  // ──────────────────────────────────────────────────────────────────────

  async listCustomTabs(dealId: string): Promise<CustomTabRow[]> {
    const { data } = await apiClient.get(`${BASE}/deals/${dealId}/custom-tabs`);
    return data?.tabs ?? [];
  },

  async createCustomTab(
    dealId: string,
    payload: CustomTabPayload,
    extras: { generationPrompt?: string; conversationId?: number } = {},
  ): Promise<{ ok: true; tab: CustomTabRow } | { ok: false; issues: any[]; unknownFields?: string[] }> {
    try {
      const { data } = await apiClient.post(`${BASE}/deals/${dealId}/custom-tabs`, {
        payload,
        ...extras,
      });
      return { ok: true, tab: data.tab };
    } catch (err: any) {
      if (err?.response?.status === 422) {
        return { ok: false, issues: err.response.data?.issues ?? [], unknownFields: err.response.data?.unknownFields };
      }
      throw err;
    }
  },

  async renameCustomTab(dealId: string, tabId: string, title: string): Promise<CustomTabRow | null> {
    try {
      const { data } = await apiClient.patch(`${BASE}/deals/${dealId}/custom-tabs/${tabId}`, { title });
      return data.tab ?? null;
    } catch {
      return null;
    }
  },

  async replaceCustomTab(
    dealId: string,
    tabId: string,
    payload: CustomTabPayload,
  ): Promise<{ ok: true; tab: CustomTabRow } | { ok: false; issues: any[] }> {
    try {
      const { data } = await apiClient.patch(`${BASE}/deals/${dealId}/custom-tabs/${tabId}`, { payload });
      return { ok: true, tab: data.tab };
    } catch (err: any) {
      if (err?.response?.status === 422) {
        return { ok: false, issues: err.response.data?.issues ?? [] };
      }
      throw err;
    }
  },

  async refreshCustomTab(dealId: string, tabId: string, conversationId?: number): Promise<CustomTabRow | null> {
    try {
      const { data } = await apiClient.post(`${BASE}/deals/${dealId}/custom-tabs/${tabId}/refresh`, { conversationId });
      return data.tab ?? null;
    } catch {
      return null;
    }
  },

  async deleteCustomTab(dealId: string, tabId: string): Promise<boolean> {
    try {
      await apiClient.delete(`${BASE}/deals/${dealId}/custom-tabs/${tabId}`);
      return true;
    } catch {
      return false;
    }
  },

  parseCustomTabsFromResponse(text: string): CustomTabPayload[] {
    const out: CustomTabPayload[] = [];
    const re = /```customtab\n([\s\S]*?)```/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      try { out.push(JSON.parse(m[1])); } catch (err) { logSwallowedError('services/opusProforma.service', err); }
    }
    return out;
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Custom-tab content schema — frontend mirror of the backend types
// (kept narrow on purpose; the backend is the source of truth for
// validation, this is just for the renderer.)
// ──────────────────────────────────────────────────────────────────────────

export type CustomTabFormat = 'currency' | 'percent' | 'multiple' | 'number' | 'ratio';

export type CustomTabBlock =
  | { type: 'markdown'; text: string }
  | { type: 'kpi_tile'; label: string; ref: string; format?: CustomTabFormat; compareRef?: string; sublabel?: string }
  | { type: 'table'; columns: Array<{ header: string; ref: string; format?: CustomTabFormat }>; rowSourceRef: string; limit?: number; caption?: string }
  | { type: 'ratio_bar'; label: string; numeratorRef: string; denominatorRef: string; benchmark?: number; format?: 'percent' | 'ratio' }
  | { type: 'line_chart'; seriesRef: string; xLabel?: string; yLabel?: string; format?: CustomTabFormat; compareSeriesRef?: string };

export interface CustomTabPayload {
  tabId: string;
  title: string;
  description?: string;
  blocks: CustomTabBlock[];
  generationPrompt?: string;
  modelVersion?: string;
}

export interface CustomTabRow {
  id: number;
  deal_id: string;
  user_id: string;
  tab_id: string;
  title: string;
  description: string | null;
  payload: CustomTabPayload;
  generation_prompt: string | null;
  model_version: string | null;
  created_at: string;
  updated_at: string;
}
