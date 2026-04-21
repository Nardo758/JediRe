/**
 * Integration Types
 * 
 * Shared types for third-party integrations
 */

export type IntegrationProvider = 
  | 'docusign' 
  | 'notarize' 
  | 'plaid' 
  | 'stripe'
  | 'costar'
  | 'yardi_matrix'
  | 'attom';

export type IntegrationEnvironment = 'sandbox' | 'production';

export interface IntegrationCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accountId?: string;
  baseUrl?: string;
  webhookSecret?: string;
  [key: string]: string | undefined;
}

export interface OrgIntegration {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  environment: IntegrationEnvironment;
  status: 'active' | 'disconnected' | 'error';
  config: Record<string, unknown>;
  lastSyncAt?: Date;
  lastError?: string;
}

// ─── DocuSign Types ───────────────────────────────────────────────────

export interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'voided';
  subject: string;
  documents: { documentId: string; name: string; order: number }[];
  recipients: DocuSignRecipient[];
  sentAt?: Date;
  completedAt?: Date;
}

export interface DocuSignRecipient {
  recipientId: string;
  recipientType: 'signer' | 'cc' | 'in_person_signer';
  routingOrder: number;
  name: string;
  email: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'declined';
  signedAt?: Date;
}

export interface CreateEnvelopeRequest {
  dealId?: string;
  envelopeType: 'psa' | 'loi' | 'loan_docs' | 'side_letter' | 'amendment' | 'other';
  subject: string;
  message?: string;
  documents: { name: string; base64Content: string; fileExtension: string }[];
  signers: { name: string; email: string; routingOrder?: number }[];
  ccRecipients?: { name: string; email: string }[];
}

// ─── Notarize Types ───────────────────────────────────────────────────

export interface NotarizeSession {
  sessionId: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  participantName: string;
  participantEmail: string;
  documentId: string;
  scheduledAt?: Date;
  completedAt?: Date;
  notarizedDocumentUrl?: string;
}

export interface CreateNotarizeSessionRequest {
  dealId?: string;
  participantName: string;
  participantEmail: string;
  documentName: string;
  documentBase64: string;
  notarizationType: 'acknowledgment' | 'jurat' | 'copy_certification';
}

// ─── Plaid Types ──────────────────────────────────────────────────────

export interface PlaidLinkToken {
  linkToken: string;
  expiration: Date;
}

export interface PlaidVerification {
  verificationId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  verificationType: 'identity' | 'kyc' | 'bank_account';
  subjectName: string;
  result?: {
    verified: boolean;
    riskScore?: number;
    flags?: string[];
  };
}

export interface CreatePlaidVerificationRequest {
  dealId?: string;
  subjectType: 'investor' | 'borrower' | 'guarantor' | 'principal';
  subjectName: string;
  subjectEmail: string;
  verificationType: 'identity' | 'kyc' | 'bank_account';
}

// ─── Team Assignment Types ────────────────────────────────────────────

export type DealRole = 'lead' | 'analyst' | 'asset_manager' | 'legal' | 'finance' | 'observer';
export type DealPhase = 'underwriting' | 'due_diligence' | 'closing' | 'operations';

export interface TeamAssignment {
  id: string;
  dealId: string;
  memberId: string;
  memberName?: string;
  memberEmail?: string;
  memberTitle?: string;
  dealRole: DealRole;
  phase: DealPhase;
  canEdit: boolean;
  canApprove: boolean;
  canSign: boolean;
  receivesNotifications: boolean;
  assignedAt: Date;
}

export interface AssignTeamMemberRequest {
  dealId: string;
  memberId: string;
  dealRole: DealRole;
  phase: DealPhase;
  canEdit?: boolean;
  canApprove?: boolean;
  canSign?: boolean;
  receivesNotifications?: boolean;
}

// ─── Context Tracker Types ────────────────────────────────────────────

export type ContextType = 'decision' | 'action_item' | 'key_info' | 'risk' | 'contact' | 'note';

export interface DealContextItem {
  id: string;
  dealId: string;
  contextType: ContextType;
  title: string;
  description?: string;
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  dueDate?: Date;
  assignedTo?: string;
  assigneeName?: string;
  sourceType?: 'manual' | 'email' | 'document' | 'ai_extracted';
  sourceEmailId?: string;
  aiExtracted: boolean;
  aiConfidence?: number;
  createdAt: Date;
  createdBy?: string;
}

export interface CreateContextItemRequest {
  dealId: string;
  contextType: ContextType;
  title: string;
  description?: string;
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: Date;
  assignedTo?: string;
  sourceEmailId?: string;
}
