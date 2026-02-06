import { api } from './api.client';

export interface Email {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  receivedAt: Date;
  parsed: boolean;
  entities?: {
    properties?: string[];
    addresses?: string[];
    prices?: string[];
    contacts?: string[];
  };
}

export interface EmailFilter {
  unread?: boolean;
  hasProperties?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export class EmailService {
  // Connect email account (OAuth)
  static async connectGmail(): Promise<string> {
    const response = await api.apiClient.get('/api/v1/email/connect/gmail');
    return response.data.authUrl;
  }

  static async connectOutlook(): Promise<string> {
    const response = await api.apiClient.get('/api/v1/email/connect/outlook');
    return response.data.authUrl;
  }

  // Handle OAuth callback
  static async handleCallback(provider: 'gmail' | 'outlook', code: string): Promise<void> {
    await api.apiClient.post(`/api/v1/email/callback/${provider}`, { code });
  }

  // Fetch emails
  static async fetchEmails(filters?: EmailFilter): Promise<Email[]> {
    const response = await api.apiClient.get('/api/v1/email', { params: filters });
    return response.data.map((email: any) => ({
      ...email,
      receivedAt: new Date(email.receivedAt),
    }));
  }

  // Get single email
  static async getEmail(id: string): Promise<Email> {
    const response = await api.apiClient.get(`/api/v1/email/${id}`);
    return {
      ...response.data,
      receivedAt: new Date(response.data.receivedAt),
    };
  }

  // Parse email for properties
  static async parseEmail(id: string): Promise<void> {
    await api.apiClient.post(`/api/v1/email/${id}/parse`);
  }

  // Link email to deal
  static async linkToDeal(emailId: string, dealId: string, confidence: number = 1.0): Promise<void> {
    await api.apiClient.post(`/api/v1/email/${emailId}/link`, {
      dealId,
      confidence,
    });
  }

  // Get emails linked to a deal
  static async getDealEmails(dealId: string): Promise<Email[]> {
    const response = await api.apiClient.get(`/api/v1/deals/${dealId}/emails`);
    return response.data.map((email: any) => ({
      ...email,
      receivedAt: new Date(email.receivedAt),
    }));
  }

  // AI-powered email extraction
  static async extractEntities(emailId: string): Promise<any> {
    const response = await api.apiClient.post(`/api/v1/email/${emailId}/extract`);
    return response.data;
  }

  // Compose and send email
  static async sendEmail(to: string, subject: string, body: string, dealId?: string): Promise<void> {
    await api.apiClient.post('/api/v1/email/send', {
      to,
      subject,
      body,
      dealId,
    });
  }

  // Get email templates
  static async getTemplates(): Promise<any[]> {
    const response = await api.apiClient.get('/api/v1/email/templates');
    return response.data;
  }

  // Apply template
  static applyTemplate(template: any, variables: Record<string, string>): string {
    let body = template.body;
    Object.entries(variables).forEach(([key, value]) => {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return body;
  }

  // Check connection status
  static async getConnectionStatus(): Promise<{
    gmail: boolean;
    outlook: boolean;
    lastSync?: Date;
  }> {
    const response = await api.apiClient.get('/api/v1/email/status');
    return {
      ...response.data,
      lastSync: response.data.lastSync ? new Date(response.data.lastSync) : undefined,
    };
  }

  // Sync emails
  static async syncEmails(): Promise<{ synced: number; parsed: number }> {
    const response = await api.apiClient.post('/api/v1/email/sync');
    return response.data;
  }

  // Disconnect email account
  static async disconnect(provider: 'gmail' | 'outlook'): Promise<void> {
    await api.apiClient.delete(`/api/v1/email/disconnect/${provider}`);
  }
}
