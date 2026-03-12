import { generateCompletion, isLLMAvailable } from './llm.service';
import { logger } from '../utils/logger';

export interface ExtractedEntity {
  propertyAddress: string | null;
  dealName: string | null;
  unitCount: number | null;
  askingPrice: number | null;
  rentFigures: string | null;
  capRate: number | null;
  contactName: string | null;
  organization: string | null;
  entityType: string;
  confidence: number;
  rawSnippet: string;
}

export interface EmailExtractionResult {
  emailIndex: number;
  entities: ExtractedEntity[];
  hasSignal: boolean;
}

const BATCH_SIZE = 5;
const MAX_BODY_CHARS = 2000;

export class PstAiExtractionService {
  async extractFromEmails(
    emails: Array<{ subject: string; body: string; from: string; to: string[]; date: Date | null }>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<EmailExtractionResult[]> {
    if (!isLLMAvailable()) {
      logger.warn('LLM not available, returning empty extraction results');
      return emails.map((_, i) => ({ emailIndex: i, entities: [], hasSignal: false }));
    }

    const results: EmailExtractionResult[] = [];
    const total = emails.length;

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      const batchResults = await this.processBatch(batch, i);
      results.push(...batchResults);

      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, total), total);
      }
    }

    return results;
  }

  private async processBatch(
    emails: Array<{ subject: string; body: string; from: string; to: string[]; date: Date | null }>,
    startIndex: number
  ): Promise<EmailExtractionResult[]> {
    const emailSummaries = emails.map((e, i) => {
      const truncatedBody = e.body.length > MAX_BODY_CHARS
        ? e.body.substring(0, MAX_BODY_CHARS) + '...[truncated]'
        : e.body;
      return `--- EMAIL ${startIndex + i} ---
Subject: ${e.subject}
From: ${e.from}
To: ${e.to.join(', ')}
Date: ${e.date?.toISOString() || 'unknown'}
Body:
${truncatedBody}`;
    }).join('\n\n');

    const prompt = `You are a real estate intelligence extraction system. Analyze the following emails and extract any real estate-related signals.

For each email, extract ANY of the following if present:
- Property addresses (full street address, city, state)
- Deal names or project names
- Unit counts (number of apartments/units)
- Asking prices or sale prices (dollar amounts for property transactions)
- Rent figures (monthly rent, rent per unit, rent per SF)
- Cap rates (capitalization rates as percentages)
- Contact names (people mentioned in relation to deals)
- Organizations (companies, firms, brokerages involved)

Return a JSON array where each element corresponds to an email (by index). Each element should have:
{
  "emailIndex": <number>,
  "hasSignal": <boolean>,
  "entities": [
    {
      "propertyAddress": <string or null>,
      "dealName": <string or null>,
      "unitCount": <number or null>,
      "askingPrice": <number or null>,
      "rentFigures": <string or null>,
      "capRate": <number or null>,
      "contactName": <string or null>,
      "organization": <string or null>,
      "entityType": <"property"|"deal"|"contact"|"financial">,
      "confidence": <0.0 to 1.0>,
      "rawSnippet": <short relevant quote from the email>
    }
  ]
}

If an email has no real estate signals, return hasSignal: false and entities: [].

EMAILS:
${emailSummaries}

Return ONLY valid JSON, no markdown formatting or code blocks.`;

    try {
      const response = await generateCompletion({
        prompt,
        maxTokens: 4096,
        temperature: 0.2,
      });

      let text = response.text.trim();
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        text = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        logger.warn('AI extraction returned non-array response');
        return emails.map((_, i) => ({
          emailIndex: startIndex + i,
          entities: [],
          hasSignal: false,
        }));
      }

      return parsed.map((item: any, i: number) => ({
        emailIndex: item.emailIndex ?? (startIndex + i),
        hasSignal: item.hasSignal ?? (item.entities?.length > 0),
        entities: (item.entities || []).map((e: any) => ({
          propertyAddress: e.propertyAddress || null,
          dealName: e.dealName || null,
          unitCount: typeof e.unitCount === 'number' ? e.unitCount : null,
          askingPrice: typeof e.askingPrice === 'number' ? e.askingPrice : null,
          rentFigures: e.rentFigures || null,
          capRate: typeof e.capRate === 'number' ? e.capRate : null,
          contactName: e.contactName || null,
          organization: e.organization || null,
          entityType: e.entityType || 'property',
          confidence: typeof e.confidence === 'number' ? e.confidence : 0.5,
          rawSnippet: e.rawSnippet || '',
        })),
      }));
    } catch (err: any) {
      logger.error(`AI extraction batch failed: ${err.message}`);
      return emails.map((_, i) => ({
        emailIndex: startIndex + i,
        entities: [],
        hasSignal: false,
      }));
    }
  }
}

export const pstAiExtractionService = new PstAiExtractionService();
