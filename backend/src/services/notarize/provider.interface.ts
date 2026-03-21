export interface NotarizeSessionRequest {
  dealId: string;
  documents: Array<{
    id: string;
    name: string;
    url?: string;
  }>;
  signers: Array<{
    name: string;
    email: string;
    phone?: string;
    role?: string;
  }>;
  scheduledAt?: string;
  callbackUrl: string;
  metadata?: Record<string, any>;
}

export interface NotarizeSessionResponse {
  providerSessionId: string;
  status: string;
  sessionUrl?: string;
  signers: Array<{
    providerSignerId: string;
    name: string;
    email: string;
    status: string;
  }>;
}

export interface NotarizeSessionStatus {
  providerSessionId: string;
  status: string;
  signers: Array<{
    providerSignerId: string;
    name: string;
    email: string;
    status: string;
    kbaVerified: boolean;
    idVerified: boolean;
    signedAt?: string;
  }>;
  notary?: {
    name: string;
    commission: string;
    state: string;
  };
  recordingUrl?: string;
  completedAt?: string;
}

export interface NotarizeCertificate {
  certificateUrl: string;
  documentUrls: string[];
}

export interface NotarizeProvider {
  readonly name: string;

  createSession(request: NotarizeSessionRequest): Promise<NotarizeSessionResponse>;
  getSessionStatus(providerSessionId: string): Promise<NotarizeSessionStatus>;
  cancelSession(providerSessionId: string, reason?: string): Promise<void>;
  downloadCertificate(providerSessionId: string): Promise<NotarizeCertificate>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
