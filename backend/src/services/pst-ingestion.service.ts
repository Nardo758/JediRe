import { logger } from '../utils/logger';

interface ParsedEmail {
  subject: string;
  body: string;
  from: string;
  to: string[];
  date: Date | null;
  hasAttachments: boolean;
}

export class PstIngestionService {
  async parseFromBuffer(buffer: Buffer): Promise<ParsedEmail[]> {
    const PSTFile = require('pst-extractor').PSTFile;
    const PSTFolder = require('pst-extractor').PSTFolder;
    const PSTMessage = require('pst-extractor').PSTMessage;

    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const tmpPath = path.join(os.tmpdir(), `pst-${Date.now()}.pst`);
    fs.writeFileSync(tmpPath, buffer);

    try {
      const pstFile = new PSTFile(tmpPath);
      const emails: ParsedEmail[] = [];
      this.processFolder(pstFile.getRootFolder(), emails, PSTFolder, PSTMessage);
      logger.info(`PST parsing complete: ${emails.length} emails extracted`);
      return emails;
    } finally {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  }

  private processFolder(folder: any, emails: ParsedEmail[], PSTFolder: any, PSTMessage: any): void {
    try {
      if (folder.hasSubfolders) {
        const subfolders = folder.getSubFolders();
        for (const sub of subfolders) {
          this.processFolder(sub, emails, PSTFolder, PSTMessage);
        }
      }
    } catch (err: any) {
      logger.warn(`Error reading subfolders: ${err.message}`);
    }

    try {
      let email = folder.getNextChild();
      while (email) {
        try {
          if (email.messageClass === 'IPM.Note' || !email.messageClass || email.subject) {
            const parsed = this.extractEmail(email);
            if (parsed) {
              emails.push(parsed);
            }
          }
        } catch (err: any) {
          logger.warn(`Error extracting email: ${err.message}`);
        }

        try {
          email = folder.getNextChild();
        } catch {
          break;
        }
      }
    } catch (err: any) {
      logger.warn(`Error iterating folder messages: ${err.message}`);
    }
  }

  private extractEmail(msg: any): ParsedEmail | null {
    try {
      const subject = (msg.subject || '').trim();
      let body = '';
      try { body = msg.body || ''; } catch {}
      if (!body) {
        try { body = msg.bodyHTML || ''; } catch {}
      }
      if (!body) {
        try { body = msg.bodyRTF || ''; } catch {}
      }

      body = this.stripHtml(body).trim();

      const from = this.extractSender(msg);
      const to = this.extractRecipients(msg);

      let date: Date | null = null;
      try {
        if (msg.messageDeliveryTime) {
          date = new Date(msg.messageDeliveryTime);
        } else if (msg.clientSubmitTime) {
          date = new Date(msg.clientSubmitTime);
        }
      } catch {}

      if (date && isNaN(date.getTime())) date = null;

      let hasAttachments = false;
      try { hasAttachments = msg.hasAttachments || false; } catch {}

      return { subject, body, from, to, date, hasAttachments };
    } catch (err: any) {
      logger.warn(`Failed to extract email: ${err.message}`);
      return null;
    }
  }

  private extractSender(msg: any): string {
    try {
      if (msg.senderEmailAddress) return msg.senderEmailAddress;
      if (msg.senderName) return msg.senderName;
    } catch {}
    return 'unknown';
  }

  private extractRecipients(msg: any): string[] {
    const recipients: string[] = [];
    try {
      const displayTo = msg.displayTo || '';
      if (displayTo) {
        recipients.push(...displayTo.split(';').map((r: string) => r.trim()).filter(Boolean));
      }
    } catch {}
    if (recipients.length === 0) {
      try {
        const recipCount = msg.numberOfRecipients || 0;
        for (let i = 0; i < recipCount; i++) {
          try {
            const recip = msg.getRecipient(i);
            if (recip?.emailAddress) {
              recipients.push(recip.emailAddress);
            } else if (recip?.displayName) {
              recipients.push(recip.displayName);
            }
          } catch {}
        }
      } catch {}
    }
    return recipients;
  }

  private stripHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const pstIngestionService = new PstIngestionService();
