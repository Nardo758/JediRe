/**
 * Microsoft Graph API Service
 * Handles Outlook email, calendar, and contacts integration
 */

import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// Microsoft Graph API Base URL
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Type definitions
interface MicrosoftAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

interface Email {
  id: string;
  subject: string;
  from: {
    name: string;
    address: string;
  };
  receivedDateTime: string;
  bodyPreview: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  hasAttachments: boolean;
  isRead: boolean;
  categories: string[];
}

interface EmailFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyType?: 'text' | 'html';
  attachments?: Array<{
    name: string;
    contentBytes: string; // Base64 encoded
    contentType: string;
  }>;
}

interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
    status: {
      response: string;
    };
  }>;
  body?: {
    contentType: string;
    content: string;
  };
}

/**
 * Microsoft Graph API Client
 */
export class MicrosoftGraphService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Make authenticated request to Microsoft Graph API
   */
  private async graphRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T> {
    try {
      const response = await axios({
        method,
        url: `${GRAPH_API_BASE}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data,
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        logger.error('Microsoft Graph API error:', axiosError.response?.data);
        
        if (axiosError.response?.status === 401) {
          throw new AppError(401, 'Microsoft access token expired. Please reconnect your account.');
        }
        
        throw new AppError(
          axiosError.response?.status || 500,
          `Microsoft Graph API error: ${axiosError.message}`
        );
      }
      throw error;
    }
  }

  // ======================
  // EMAIL METHODS
  // ======================

  /**
   * Get inbox messages
   */
  async getInbox(params?: {
    top?: number;
    skip?: number;
    search?: string;
    filter?: string;
  }): Promise<{ value: Email[]; '@odata.nextLink'?: string }> {
    let endpoint = '/me/mailFolders/inbox/messages';
    const queryParams: string[] = [];

    if (params?.top) queryParams.push(`$top=${params.top}`);
    if (params?.skip) queryParams.push(`$skip=${params.skip}`);
    if (params?.search) queryParams.push(`$search="${params.search}"`);
    if (params?.filter) queryParams.push(`$filter=${params.filter}`);
    
    // Always select specific fields and order by date
    queryParams.push('$select=id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,isRead,categories');
    queryParams.push('$orderby=receivedDateTime DESC');

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    return this.graphRequest<{ value: Email[]; '@odata.nextLink'?: string }>('GET', endpoint);
  }

  /**
   * Get specific email by ID
   */
  async getEmail(emailId: string): Promise<Email> {
    return this.graphRequest<Email>('GET', `/me/messages/${emailId}`);
  }

  /**
   * Get email folders
   */
  async getFolders(): Promise<{ value: EmailFolder[] }> {
    return this.graphRequest<{ value: EmailFolder[] }>('GET', '/me/mailFolders');
  }

  /**
   * Get messages from specific folder
   */
  async getMessagesFromFolder(
    folderId: string,
    params?: { top?: number; skip?: number }
  ): Promise<{ value: Email[] }> {
    let endpoint = `/me/mailFolders/${folderId}/messages`;
    const queryParams: string[] = [];

    if (params?.top) queryParams.push(`$top=${params.top}`);
    if (params?.skip) queryParams.push(`$skip=${params.skip}`);
    queryParams.push('$orderby=receivedDateTime DESC');

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    return this.graphRequest<{ value: Email[] }>('GET', endpoint);
  }

  /**
   * Send email
   */
  async sendEmail(params: SendEmailParams): Promise<void> {
    const message = {
      message: {
        subject: params.subject,
        body: {
          contentType: params.bodyType || 'html',
          content: params.body,
        },
        toRecipients: params.to.map(email => ({
          emailAddress: { address: email },
        })),
        ccRecipients: params.cc?.map(email => ({
          emailAddress: { address: email },
        })),
        bccRecipients: params.bcc?.map(email => ({
          emailAddress: { address: email },
        })),
        attachments: params.attachments?.map(att => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.name,
          contentBytes: att.contentBytes,
          contentType: att.contentType,
        })),
      },
      saveToSentItems: true,
    };

    await this.graphRequest('POST', '/me/sendMail', message);
    logger.info('Email sent successfully');
  }

  /**
   * Reply to email
   */
  async replyToEmail(
    emailId: string,
    replyBody: string,
    replyAll: boolean = false
  ): Promise<void> {
    const endpoint = replyAll
      ? `/me/messages/${emailId}/replyAll`
      : `/me/messages/${emailId}/reply`;

    await this.graphRequest('POST', endpoint, {
      comment: replyBody,
    });

    logger.info(`Reply sent to email ${emailId}`);
  }

  /**
   * Mark email as read/unread
   */
  async markAsRead(emailId: string, isRead: boolean = true): Promise<void> {
    await this.graphRequest('PATCH', `/me/messages/${emailId}`, {
      isRead,
    });
  }

  /**
   * Move email to folder
   */
  async moveEmail(emailId: string, destinationFolderId: string): Promise<Email> {
    return this.graphRequest<Email>('POST', `/me/messages/${emailId}/move`, {
      destinationId: destinationFolderId,
    });
  }

  /**
   * Delete email
   */
  async deleteEmail(emailId: string): Promise<void> {
    await this.graphRequest('DELETE', `/me/messages/${emailId}`);
    logger.info(`Email ${emailId} deleted`);
  }

  /**
   * Search emails
   */
  async searchEmails(query: string, top: number = 20): Promise<{ value: Email[] }> {
    return this.graphRequest<{ value: Email[] }>(
      'GET',
      `/me/messages?$search="${query}"&$top=${top}&$orderby=receivedDateTime DESC`
    );
  }

  // ======================
  // CALENDAR METHODS
  // ======================

  /**
   * Get calendar events
   */
  async getCalendarEvents(params?: {
    startDateTime?: string; // ISO 8601
    endDateTime?: string;
    top?: number;
  }): Promise<{ value: CalendarEvent[] }> {
    let endpoint = '/me/calendar/events';
    const queryParams: string[] = [];

    if (params?.startDateTime && params?.endDateTime) {
      queryParams.push(`$filter=start/dateTime ge '${params.startDateTime}' and end/dateTime le '${params.endDateTime}'`);
    }
    if (params?.top) queryParams.push(`$top=${params.top}`);
    queryParams.push('$orderby=start/dateTime ASC');

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    return this.graphRequest<{ value: CalendarEvent[] }>('GET', endpoint);
  }

  /**
   * Create calendar event
   */
  async createCalendarEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.graphRequest<CalendarEvent>('POST', '/me/calendar/events', event);
  }

  // ======================
  // USER PROFILE
  // ======================

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<{
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
  }> {
    return this.graphRequest('GET', '/me');
  }
}

/**
 * OAuth Token Management
 */
export class MicrosoftAuthService {
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID || '';
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    this.redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:4000/api/v1/auth/microsoft/callback';

    if (!this.clientId || !this.clientSecret) {
      logger.warn('Microsoft Graph API credentials not configured');
    }
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const scopes = [
      'User.Read',
      'Mail.ReadWrite',
      'Mail.Send',
      'Calendars.ReadWrite',
      'Contacts.Read',
      'offline_access',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes,
      response_mode: 'query',
      ...(state && { state }),
    });

    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getTokenFromCode(code: string): Promise<MicrosoftAuthTokens> {
    try {
      const response = await axios.post(
        `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: Date.now() + response.data.expires_in * 1000,
      };
    } catch (error) {
      logger.error('Error exchanging code for token:', error);
      throw new AppError(500, 'Failed to authenticate with Microsoft');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<MicrosoftAuthTokens> {
    try {
      const response = await axios.post(
        `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: Date.now() + response.data.expires_in * 1000,
      };
    } catch (error) {
      logger.error('Error refreshing token:', error);
      throw new AppError(500, 'Failed to refresh Microsoft token');
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}
