/**
 * Inbox API Service
 * Frontend client for email management
 */

import { api } from './api.client';

export interface Email {
  id: number;
  subject: string;
  from_name: string;
  from_address: string;
  body_preview: string;
  is_read: boolean;
  is_flagged: boolean;
  has_attachments: boolean;
  deal_id: number | null;
  deal_name?: string;
  received_at: string;
  created_at: string;
  attachment_count?: number;
}

export interface EmailDetail extends Email {
  to_addresses: string[];
  cc_addresses?: string[];
  body_html?: string;
  body_text?: string;
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
}

export interface InboxFilters {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
  deal_id?: number;
  label?: string;
  search?: string;
}

export const inboxService = {
  /**
   * Get emails with optional filters
   */
  async getEmails(filters: InboxFilters = {}) {
    const params = new URLSearchParams();
    
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());
    if (filters.unread_only) params.append('unread_only', 'true');
    if (filters.deal_id) params.append('deal_id', filters.deal_id.toString());
    if (filters.label) params.append('label', filters.label);
    if (filters.search) params.append('search', filters.search);

    const response = await api.get(`/inbox?${params.toString()}`);
    return response.data;
  },

  /**
   * Get inbox statistics
   */
  async getStats(): Promise<{ success: boolean; data: InboxStats }> {
    const response = await api.get('/inbox/stats');
    return response.data;
  },

  /**
   * Get single email with full content
   */
  async getEmail(id: number): Promise<{ success: boolean; data: EmailDetail }> {
    const response = await api.get(`/inbox/${id}`);
    return response.data;
  },

  /**
   * Update email (mark read, flag, link to deal, etc)
   */
  async updateEmail(id: number, updates: {
    is_read?: boolean;
    is_flagged?: boolean;
    deal_id?: number | null;
    is_archived?: boolean;
  }) {
    const response = await api.patch(`/inbox/${id}`, updates);
    return response.data;
  },

  /**
   * Delete email (or move to trash)
   */
  async deleteEmail(id: number, permanent = false) {
    const response = await api.delete(`/inbox/${id}?permanent=${permanent}`);
    return response.data;
  },

  /**
   * Trigger email sync
   */
  async sync() {
    const response = await api.post('/inbox/sync');
    return response.data;
  },

  /**
   * Send a new email
   */
  async compose(data: {
    to: string | string[];
    cc?: string | string[];
    subject: string;
    body: string;
    deal_id?: number;
  }) {
    const response = await api.post('/inbox/compose', data);
    return response.data;
  },

  /**
   * Bulk actions on emails
   */
  async bulkAction(emailIds: number[], action: 'mark_read' | 'mark_unread' | 'flag' | 'unflag' | 'archive' | 'delete') {
    const response = await api.post('/inbox/bulk-action', {
      email_ids: emailIds,
      action,
    });
    return response.data;
  },
};
