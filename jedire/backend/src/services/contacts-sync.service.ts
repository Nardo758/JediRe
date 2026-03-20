import { MicrosoftGraphService, MicrosoftAuthService } from './microsoft-graph.service';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface UnifiedContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  source: 'microsoft' | 'google';
}

const authService = new MicrosoftAuthService();

async function getMicrosoftGraphService(userId: string): Promise<MicrosoftGraphService> {
  const result = await query(
    'SELECT access_token, refresh_token, token_expires_at FROM microsoft_accounts WHERE user_id = $1 AND is_active = true',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Microsoft account not connected');
  }

  const account = result.rows[0];
  const now = Date.now();
  const expiresAt = new Date(account.token_expires_at).getTime();

  if (expiresAt - now < 5 * 60 * 1000) {
    const tokens = await authService.refreshAccessToken(account.refresh_token);
    await query(
      'UPDATE microsoft_accounts SET access_token = $1, refresh_token = $2, token_expires_at = $3 WHERE user_id = $4',
      [tokens.accessToken, tokens.refreshToken, new Date(tokens.expiresAt), userId]
    );
    return new MicrosoftGraphService(tokens.accessToken);
  }

  return new MicrosoftGraphService(account.access_token);
}

export async function fetchMicrosoftContacts(userId: string): Promise<UnifiedContact[]> {
  const graphService = await getMicrosoftGraphService(userId);

  const response = await graphService.getContacts(250);

  const contacts: UnifiedContact[] = [];

  for (const contact of response.value || []) {
    const primaryEmail = contact.emailAddresses?.[0]?.address;
    if (!primaryEmail) continue;

    const phone = contact.mobilePhone || contact.businessPhones?.[0] || undefined;

    contacts.push({
      id: `ms-${contact.id}`,
      name: contact.displayName || primaryEmail,
      email: primaryEmail,
      phone,
      company: contact.companyName || undefined,
      title: contact.jobTitle || undefined,
      source: 'microsoft',
    });
  }

  return contacts;
}

export async function fetchMicrosoftPeople(userId: string): Promise<UnifiedContact[]> {
  const graphService = await getMicrosoftGraphService(userId);

  const response = await graphService.getPeople(100);

  const contacts: UnifiedContact[] = [];
  const seenEmails = new Set<string>();

  for (const person of response.value || []) {
    const primaryEmail = person.emailAddresses?.[0]?.address;
    if (!primaryEmail || seenEmails.has(primaryEmail.toLowerCase())) continue;
    seenEmails.add(primaryEmail.toLowerCase());

    contacts.push({
      id: `ms-people-${person.id}`,
      name: person.displayName || primaryEmail,
      email: primaryEmail,
      phone: person.phones?.[0]?.number || undefined,
      company: person.companyName || undefined,
      title: person.jobTitle || undefined,
      source: 'microsoft',
    });
  }

  return contacts;
}

async function getGoogleOAuth2Client(userId: string): Promise<OAuth2Client> {
  const result = await query(
    'SELECT access_token, refresh_token, token_expires_at FROM user_email_accounts WHERE user_id = $1 AND provider = $2',
    [userId, 'google']
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'Google account not connected');
  }

  const account = result.rows[0];
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new AppError(500, 'Google OAuth not configured');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  const now = Date.now();
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;

  if (expiresAt - now < 5 * 60 * 1000 && account.refresh_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token) {
        await query(
          'UPDATE user_email_accounts SET access_token = $1, token_expires_at = $2 WHERE user_id = $3 AND provider = $4',
          [credentials.access_token, new Date(credentials.expiry_date || Date.now() + 3600000), userId, 'google']
        );
        oauth2Client.setCredentials(credentials);
      }
    } catch (error) {
      logger.error('Failed to refresh Google token for contacts:', error);
      throw new AppError(401, 'Google token expired. Please reconnect your account.');
    }
  }

  return oauth2Client;
}

export async function fetchGoogleContacts(userId: string): Promise<UnifiedContact[]> {
  const oauth2Client = await getGoogleOAuth2Client(userId);

  const people = google.people({ version: 'v1', auth: oauth2Client });

  const response = await people.people.connections.list({
    resourceName: 'people/me',
    pageSize: 250,
    personFields: 'names,emailAddresses,phoneNumbers,organizations',
    sortOrder: 'FIRST_NAME_ASCENDING',
  });

  const contacts: UnifiedContact[] = [];

  for (const person of response.data.connections || []) {
    const primaryEmail = person.emailAddresses?.[0]?.value;
    if (!primaryEmail) continue;

    const name = person.names?.[0]?.displayName || primaryEmail;
    const phone = person.phoneNumbers?.[0]?.value || undefined;
    const org = person.organizations?.[0];

    contacts.push({
      id: `goog-${person.resourceName}`,
      name,
      email: primaryEmail,
      phone,
      company: org?.name || undefined,
      title: org?.title || undefined,
      source: 'google',
    });
  }

  return contacts;
}

export async function getConnectionStatus(userId: string): Promise<{
  microsoft: { connected: boolean; email?: string; displayName?: string };
  google: { connected: boolean; email?: string };
}> {
  const [msResult, googleResult] = await Promise.all([
    query(
      'SELECT email, display_name FROM microsoft_accounts WHERE user_id = $1 AND is_active = true',
      [userId]
    ),
    query(
      'SELECT email_address FROM user_email_accounts WHERE user_id = $1 AND provider = $2',
      [userId, 'google']
    ),
  ]);

  return {
    microsoft: {
      connected: msResult.rows.length > 0,
      email: msResult.rows[0]?.email,
      displayName: msResult.rows[0]?.display_name,
    },
    google: {
      connected: googleResult.rows.length > 0,
      email: googleResult.rows[0]?.email_address,
    },
  };
}
