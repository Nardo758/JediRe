import { apiClient } from './api.client';

export interface Email {
  id: number;
  subject: string;
  from_name: string;
  from_address: string;
  body_preview: string;
  body_text?: string;
  is_read: boolean;
  is_flagged: boolean;
  has_attachments: boolean;
  deal_id: string | null;
  deal_name?: string;
  received_at: string;
  created_at: string;
  attachment_count?: number;
  source_provider?: string;
  external_id?: string;
  has_signal?: boolean;
  to_addresses?: string[];
  cc_addresses?: string[];
}

export interface EmailDetail extends Email {
  body_html?: string;
  attachments?: EmailAttachment[];
  extracted_properties?: any[];
  action_items?: any[];
}

export interface EmailAttachment {
  id: number;
  filename: string;
  content_type: string;
  size_bytes: number;
  download_url?: string;
}

export interface InboxStats {
  total: number;
  unread: number;
  flagged: number;
  deal_related: number;
  with_attachments: number;
  pst_imports: number;
}

export interface InboxFilters {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
  flagged_only?: boolean;
  deal_linked?: boolean;
  deal_id?: number;
  label?: string;
  search?: string;
  source?: 'pst' | 'connected';
}

export interface ConnectedAccount {
  id: string;
  email_address: string;
  provider: string;
  last_sync_at: string | null;
  sync_enabled: boolean;
  created_at: string;
}

export const inboxService = {
  async getEmails(filters: InboxFilters = {}) {
    const params = new URLSearchParams();
    
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());
    if (filters.unread_only) params.append('unread_only', 'true');
    if (filters.flagged_only) params.append('flagged_only', 'true');
    if (filters.deal_id) params.append('deal_id', filters.deal_id.toString());
    if (filters.label) params.append('label', filters.label);
    if (filters.search) params.append('search', filters.search);
    if (filters.source) params.append('source', filters.source);
    if (filters.deal_linked) params.append('deal_linked', 'true');

    const response = await apiClient.get(`/api/v1/inbox?${params.toString()}`);
    return response.data;
  },

  async getStats(): Promise<{ success: boolean; data: InboxStats }> {
    const response = await apiClient.get('/api/v1/inbox/stats');
    return response.data;
  },

  async getPstImports(filters: { limit?: number; offset?: number; search?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());
    if (filters.search) params.append('search', filters.search);
    const response = await apiClient.get(`/api/v1/inbox/pst-imports?${params.toString()}`);
    return response.data;
  },

  async getEmail(id: number): Promise<{ success: boolean; data: EmailDetail }> {
    const response = await apiClient.get(`/api/v1/inbox/${id}`);
    return response.data;
  },

  async updateEmail(id: number, updates: {
    is_read?: boolean;
    is_flagged?: boolean;
    deal_id?: string | null;
    is_archived?: boolean;
  }) {
    const response = await apiClient.patch(`/api/v1/inbox/${id}`, updates);
    return response.data;
  },

  async deleteEmail(id: number, permanent = false) {
    const response = await apiClient.delete(`/api/v1/inbox/${id}?permanent=${permanent}`);
    return response.data;
  },

  async sync() {
    const response = await apiClient.post('/api/v1/inbox/sync');
    return response.data;
  },

  async compose(data: {
    to: string | string[];
    cc?: string | string[];
    subject: string;
    body: string;
    deal_id?: number;
  }) {
    const response = await apiClient.post('/api/v1/inbox/compose', data);
    return response.data;
  },

  async bulkAction(emailIds: number[], action: 'mark_read' | 'mark_unread' | 'flag' | 'unflag' | 'archive' | 'delete') {
    const response = await apiClient.post('/api/v1/inbox/bulk-action', {
      email_ids: emailIds,
      action,
    });
    return response.data;
  },

  async getConnectedAccounts(): Promise<{ success: boolean; data: ConnectedAccount[] }> {
    const response = await apiClient.get('/api/v1/inbox/accounts');
    return response.data;
  },

  async syncAccount(accountId: string): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.post(`/api/v1/inbox/accounts/${accountId}/sync`);
    return response.data;
  },

  async getGmailAuthUrl(): Promise<{ success: boolean; data: { authUrl: string } }> {
    const response = await apiClient.post('/api/v1/gmail/connect');
    return response.data;
  },

  async getMicrosoftAuthUrl(): Promise<{ success: boolean; authUrl: string }> {
    const response = await apiClient.get('/api/v1/microsoft/auth/url');
    return response.data;
  },
};
