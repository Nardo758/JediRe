import { Pool } from 'pg';

export interface CachedConstraints {
  maxDensity: number | null;
  maxFAR: number | null;
  appliedFAR: number | null;
  residentialFAR: number | null;
  nonresidentialFAR: number | null;
  maxHeight: number | null;
  maxStories: number | null;
  maxLotCoverage: number | null;
  minParkingPerUnit: number | null;
  densityMethod: string;
}

export interface CachedAIAnalysis {
  insights: Record<string, string>;
  summary: string;
  extraRows: Array<{ key: string; label: string; values?: Record<string, string> }>;
}

export class ZoningInterpretationCache {
  constructor(private pool: Pool) {}

  async getConstraints(
    code: string,
    municipality: string,
    state: string,
  ): Promise<{ constraints: CachedConstraints; aiInsight: string | null; source: string; confidence: string } | null> {
    try {
      const result = await this.pool.query(
        `SELECT constraints, ai_insight, source, confidence
         FROM zoning_code_interpretations
         WHERE UPPER(zoning_code) = UPPER($1)
           AND UPPER(municipality) = UPPER($2)
           AND UPPER(state) = UPPER($3)
           AND expires_at > NOW()
         LIMIT 1`,
        [code, municipality, state]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        constraints: row.constraints as CachedConstraints,
        aiInsight: row.ai_insight,
        source: row.source || 'cached',
        confidence: row.confidence || 'medium',
      };
    } catch {
      return null;
    }
  }

  async setConstraints(
    code: string,
    municipality: string,
    state: string,
    constraints: CachedConstraints,
    options?: {
      source?: string;
      confidence?: string;
      aiInsight?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO zoning_code_interpretations
           (zoning_code, municipality, state, constraints, ai_insight, source, confidence, metadata, resolved_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + INTERVAL '30 days')
         ON CONFLICT (UPPER(zoning_code), UPPER(municipality), UPPER(state))
         DO UPDATE SET
           constraints = EXCLUDED.constraints,
           ai_insight = COALESCE(EXCLUDED.ai_insight, zoning_code_interpretations.ai_insight),
           source = EXCLUDED.source,
           confidence = EXCLUDED.confidence,
           metadata = EXCLUDED.metadata,
           resolved_at = NOW(),
           expires_at = NOW() + INTERVAL '30 days',
           updated_at = NOW()`,
        [
          code,
          municipality,
          state,
          JSON.stringify(constraints),
          options?.aiInsight || null,
          options?.source || 'database',
          options?.confidence || 'medium',
          JSON.stringify(options?.metadata || {}),
        ]
      );
    } catch (err: any) {
      console.error('[InterpretationCache] Failed to write constraints:', err.message);
    }
  }

  async getAIAnalysis(
    codes: string[],
    municipality: string,
    state: string,
  ): Promise<CachedAIAnalysis | null> {
    try {
      const codeSetKey = this.buildCodeSetKey(codes);
      const result = await this.pool.query(
        `SELECT insights, summary, extra_rows
         FROM zoning_ai_analysis_cache
         WHERE code_set_key = $1
           AND UPPER(municipality) = UPPER($2)
           AND UPPER(state) = UPPER($3)
           AND expires_at > NOW()
         LIMIT 1`,
        [codeSetKey, municipality, state]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        insights: (row.insights || {}) as Record<string, string>,
        summary: row.summary || '',
        extraRows: (row.extra_rows || []) as Array<{ key: string; label: string; values?: Record<string, string> }>,
      };
    } catch {
      return null;
    }
  }

  async setAIAnalysis(
    codes: string[],
    municipality: string,
    state: string,
    analysis: CachedAIAnalysis,
  ): Promise<void> {
    try {
      const codeSetKey = this.buildCodeSetKey(codes);
      await this.pool.query(
        `INSERT INTO zoning_ai_analysis_cache
           (code_set_key, municipality, state, insights, summary, extra_rows, resolved_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '7 days')
         ON CONFLICT (code_set_key, UPPER(municipality), UPPER(state))
         DO UPDATE SET
           insights = EXCLUDED.insights,
           summary = EXCLUDED.summary,
           extra_rows = EXCLUDED.extra_rows,
           resolved_at = NOW(),
           expires_at = NOW() + INTERVAL '7 days',
           updated_at = NOW()`,
        [
          codeSetKey,
          municipality,
          state,
          JSON.stringify(analysis.insights),
          analysis.summary,
          JSON.stringify(analysis.extraRows),
        ]
      );
    } catch (err: any) {
      console.error('[InterpretationCache] Failed to write AI analysis:', err.message);
    }
  }

  async invalidate(code: string, municipality: string, state: string): Promise<void> {
    try {
      await this.pool.query(
        `DELETE FROM zoning_code_interpretations
         WHERE UPPER(zoning_code) = UPPER($1)
           AND UPPER(municipality) = UPPER($2)
           AND UPPER(state) = UPPER($3)`,
        [code, municipality, state]
      );
    } catch {}
  }

  private buildCodeSetKey(codes: string[]): string {
    return [...codes].map(c => c.toUpperCase()).sort().join('|');
  }
}
