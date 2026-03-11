/**
 * Zoning Agent
 * Analyzes zoning regulations and development potential.
 *
 * OUTPUT CONTRACT
 * ───────────────
 * When execute() succeeds, the result includes a `zoningOutput` field that
 * conforms to the ZoningOutput interface (defined in zoning-agent.service.ts
 * on the backend, and mirrored in frontend/src/types/zoning.types.ts).
 *
 * WRITE LOCATION
 * ──────────────
 * The API handler that calls execute() is responsible for writing
 * result.zoningOutput to dealStore via the REST endpoint that patches
 * /api/v1/deals/:dealId/context  with { zoningOutput: result.zoningOutput }.
 * On the frontend, DevelopmentCapacityTab (and any other consumer) reads
 * dealStore.zoningOutput via the useDevCapacity() hook, which exposes both
 * `zoningOutput` and `updateZoningOutput`.
 *
 * CURRENT RETURN SITES IN ZoningAgentService.retrieveZoningData()
 * ───────────────────────────────────────────────────────────────
 *  1. source === 'database'      → zoningOutput built from DB row
 *  2. source === 'ai_retrieved'  → zoningOutput built from Claude response
 *  3. source === 'error' (×2)    → zoningOutput: null
 */

import { logger } from '../utils/logger';
import { ZoningService } from '../services/zoning.service';
import type { ZoningOutput } from '../services/zoning-agent.service';

export interface ZoningAgentExecuteResult {
  zoningInfo: any;
  analysis: any;
  /** Typed output ready to write to dealStore.zoningOutput */
  zoningOutput: ZoningOutput | null;
  status: 'success';
}

export class ZoningAgent {
  private zoningService: ZoningService;

  constructor() {
    this.zoningService = new ZoningService();
  }

  /**
   * Execute zoning analysis task.
   *
   * @param inputData.address       - Street address (used when propertyId absent)
   * @param inputData.propertyId    - Internal property ID
   * @param inputData.lotSizeSqft   - Parcel gross area in sq-ft (enables capacity math)
   * @param inputData.question      - Free-text question for ZoningService
   */
  async execute(inputData: any, userId: string): Promise<ZoningAgentExecuteResult> {
    logger.info('Zoning agent executing...', { inputData });

    try {
      const { address, propertyId, lotSizeSqft, question } = inputData;

      // Lookup zoning
      let zoningInfo: any;
      if (address) {
        zoningInfo = await this.zoningService.lookupZoning({ address });
      } else if (propertyId) {
        // Get property coordinates
        // ... fetch from database
      }

      // Analyze property — ZoningService.analyzeProperty() returns a
      // ZoningAgentResult which now includes `zoningOutput`.
      const analysis = await this.zoningService.analyzeProperty({
        propertyId,
        lotSizeSqft,
        question,
        userId,
      });

      // Surface the typed ZoningOutput so the API handler can write it to
      // dealStore.zoningOutput via updateZoningOutput().
      const zoningOutput: ZoningOutput | null = analysis?.zoningOutput ?? null;

      return {
        zoningInfo,
        analysis,
        zoningOutput,
        status: 'success',
      };
    } catch (error: any) {
      logger.error('Zoning agent execution failed:', error);
      throw error;
    }
  }
}
