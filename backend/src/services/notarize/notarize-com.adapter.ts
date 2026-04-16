import type {
  NotarizeProvider,
  NotarizeSessionRequest,
  NotarizeSessionResponse,
  NotarizeSessionStatus,
  NotarizeCertificate,
} from './provider.interface';
import crypto from 'crypto';

const NOTARIZE_API_BASE = process.env.NOTARIZE_API_URL || 'https://api.notarize.com/v1';

export class NotarizeComAdapter implements NotarizeProvider {
  readonly name = 'notarize';
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    this.apiKey = process.env.NOTARIZE_API_KEY || '';
    this.webhookSecret = process.env.NOTARIZE_WEBHOOK_SECRET || '';
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    if (!this.apiKey) {
      throw new Error('NOTARIZE_API_KEY not configured');
    }

    const url = `${NOTARIZE_API_BASE}${path}`;
    const options: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error');
      throw new Error(`Notarize.com API error ${res.status}: ${errorBody}`);
    }

    return res.json();
  }

  async createSession(request: NotarizeSessionRequest): Promise<NotarizeSessionResponse> {
    const payload = {
      documents: request.documents.map(d => ({
        name: d.name,
        external_id: d.id,
        url: d.url,
      })),
      participants: request.signers.map(s => ({
        full_name: s.name,
        email: s.email,
        phone: s.phone,
        role: s.role || 'signer',
      })),
      webhook_url: request.callbackUrl,
      scheduled_at: request.scheduledAt,
      metadata: {
        deal_id: request.dealId,
        ...request.metadata,
      },
    };

    const data = await this.request('POST', '/sessions', payload);

    return {
      providerSessionId: data.id || data.session_id,
      status: data.status || 'created',
      sessionUrl: data.session_url,
      signers: (data.participants || []).map((p: any) => ({
        providerSignerId: p.id || p.participant_id,
        name: p.full_name || p.name,
        email: p.email,
        status: p.status || 'pending',
      })),
    };
  }

  async getSessionStatus(providerSessionId: string): Promise<NotarizeSessionStatus> {
    const data = await this.request('GET', `/sessions/${providerSessionId}`);

    return {
      providerSessionId: data.id || providerSessionId,
      status: data.status,
      signers: (data.participants || []).map((p: any) => ({
        providerSignerId: p.id || p.participant_id,
        name: p.full_name || p.name,
        email: p.email,
        status: p.status,
        kbaVerified: p.kba_verified || false,
        idVerified: p.id_verified || false,
        signedAt: p.signed_at,
      })),
      notary: data.notary ? {
        name: data.notary.full_name || data.notary.name,
        commission: data.notary.commission_number || data.notary.commission,
        state: data.notary.state,
      } : undefined,
      recordingUrl: data.recording_url,
      completedAt: data.completed_at,
    };
  }

  async cancelSession(providerSessionId: string, reason?: string): Promise<void> {
    await this.request('POST', `/sessions/${providerSessionId}/cancel`, {
      reason: reason || 'Cancelled by deal team',
    });
  }

  async downloadCertificate(providerSessionId: string): Promise<NotarizeCertificate> {
    const data = await this.request('GET', `/sessions/${providerSessionId}/certificate`);

    return {
      certificateUrl: data.certificate_url || data.url,
      documentUrls: data.document_urls || data.documents?.map((d: any) => d.url) || [],
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  }
}
