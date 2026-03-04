import { Pool } from 'pg';
import { UserCredibilityService, CredibilityTier } from './user-credibility.service';
import { zoningEventBus, ZONING_EVENTS } from './zoning-event-bus.service';

export interface CorrectionSubmission {
  districtId?: string;
  municipality: string;
  state: string;
  districtCode?: string;
  fieldCorrected: string;
  oldValue: string;
  newValue: string;
  justification: string;
  codeReference?: string;
  userId: string;
  userTier?: CredibilityTier;
}

export interface CorrectionResult {
  id: string;
  verificationStatus: 'verified' | 'unverified' | 'pending_review';
  applied: boolean;
  aiVerificationDetails: any;
  userWeight: number;
}

export class ZoningCorrectionService {
  private credibilityService: UserCredibilityService;

  constructor(private pool: Pool) {
    this.credibilityService = new UserCredibilityService(pool);
  }

  async submitCorrection(submission: CorrectionSubmission): Promise<CorrectionResult> {
    const cred = await this.credibilityService.getOrCreate(
      submission.userId,
      submission.userTier
    );

    const aiVerification = await this.attemptVerification(submission);

    let verificationStatus: 'verified' | 'unverified' | 'pending_review';
    let applied = false;

    if (aiVerification.verified && cred.computedWeight >= 0.60) {
      verificationStatus = 'verified';
      applied = true;
    } else if (aiVerification.verified && cred.computedWeight < 0.60) {
      verificationStatus = 'pending_review';
      applied = false;
    } else if (aiVerification.confidence < 0.3) {
      verificationStatus = 'unverified';
    } else {
      verificationStatus = 'pending_review';
    }

    const result = await this.pool.query(
      `INSERT INTO zoning_corrections
       (district_id, user_id, user_tier, field_corrected, old_value, new_value,
        verification_status, applied, justification, code_reference,
        verified_by_ai, ai_verification_details, user_weight, municipality, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        submission.districtId || null,
        submission.userId,
        cred.tier,
        submission.fieldCorrected,
        submission.oldValue,
        submission.newValue,
        verificationStatus,
        applied,
        submission.justification,
        submission.codeReference || null,
        aiVerification.verified,
        JSON.stringify(aiVerification),
        cred.computedWeight,
        submission.municipality,
        submission.state,
      ]
    );

    if (applied) {
      await this.applyCorrection(submission);
      await this.credibilityService.recordCorrectionOutcome(
        submission.userId, true, submission.municipality
      );

      zoningEventBus.publish(ZONING_EVENTS.CORRECTION_APPLIED, {
        correctionId: result.rows[0].id,
        municipality: submission.municipality,
        districtCode: submission.districtCode,
        field: submission.fieldCorrected,
        userId: submission.userId,
      });
    }

    zoningEventBus.publish(ZONING_EVENTS.CORRECTION_SUBMITTED, {
      correctionId: result.rows[0].id,
      status: verificationStatus,
      municipality: submission.municipality,
    });

    return {
      id: result.rows[0].id,
      verificationStatus,
      applied,
      aiVerificationDetails: aiVerification,
      userWeight: cred.computedWeight,
    };
  }

  async resolveCorrection(
    correctionId: string,
    approved: boolean,
    resolutionNotes: string,
    resolvedBy: string
  ): Promise<void> {
    const correction = await this.pool.query(
      `SELECT * FROM zoning_corrections WHERE id = $1`, [correctionId]
    );

    if (correction.rows.length === 0) throw new Error('Correction not found');
    const row = correction.rows[0];

    const status = approved ? 'verified' : 'unverified';

    await this.pool.query(
      `UPDATE zoning_corrections
       SET verification_status = $2, applied = $3, resolution_notes = $4,
           accuracy_confirmed = $3, confirmed_at = NOW()
       WHERE id = $1`,
      [correctionId, status, approved, resolutionNotes]
    );

    await this.credibilityService.recordCorrectionOutcome(
      row.user_id, approved, row.municipality
    );

    if (approved && !row.applied) {
      await this.applyCorrection({
        districtId: row.district_id,
        municipality: row.municipality,
        state: row.state,
        fieldCorrected: row.field_corrected,
        oldValue: row.old_value,
        newValue: row.new_value,
        justification: row.justification,
        userId: row.user_id,
      });

      zoningEventBus.publish(ZONING_EVENTS.CORRECTION_APPLIED, {
        correctionId,
        municipality: row.municipality,
        field: row.field_corrected,
        userId: row.user_id,
      });
    }
  }

  async getCorrections(filters: {
    municipality?: string;
    status?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ corrections: any[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.municipality) {
      conditions.push(`municipality = $${idx++}`);
      params.push(filters.municipality);
    }
    if (filters.status) {
      conditions.push(`verification_status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.userId) {
      conditions.push(`user_id = $${idx++}`);
      params.push(filters.userId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM zoning_corrections ${where}`, params
    );

    params.push(limit, offset);
    const result = await this.pool.query(
      `SELECT * FROM zoning_corrections ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    return {
      corrections: result.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }

  private async attemptVerification(
    submission: CorrectionSubmission
  ): Promise<{ verified: boolean; confidence: number; reasoning: string }> {
    try {
      if (submission.districtId) {
        const district = await this.pool.query(
          `SELECT district_profile FROM zoning_districts WHERE id = $1`,
          [submission.districtId]
        );

        if (district.rows.length > 0 && district.rows[0].district_profile) {
          const profile = district.rows[0].district_profile;
          const fieldPath = submission.fieldCorrected;

          const currentValue = this.getNestedValue(profile, fieldPath);
          if (currentValue !== undefined && String(currentValue) === submission.oldValue) {
            return {
              verified: true,
              confidence: 0.7,
              reasoning: `Old value matches current profile data for field '${fieldPath}'. Correction appears consistent.`,
            };
          }
        }
      }

      return {
        verified: false,
        confidence: 0.4,
        reasoning: 'Could not auto-verify against existing data. Flagged for manual review.',
      };
    } catch (e) {
      return {
        verified: false,
        confidence: 0.2,
        reasoning: 'Verification check failed due to an error.',
      };
    }
  }

  private async applyCorrection(submission: Partial<CorrectionSubmission>): Promise<void> {
    if (!submission.districtId || !submission.fieldCorrected || !submission.newValue) return;

    try {
      const district = await this.pool.query(
        `SELECT district_profile FROM zoning_districts WHERE id = $1`,
        [submission.districtId]
      );

      if (district.rows.length > 0) {
        const profile = district.rows[0].district_profile || {};
        this.setNestedValue(profile, submission.fieldCorrected, submission.newValue);

        await this.pool.query(
          `UPDATE zoning_districts SET district_profile = $2 WHERE id = $1`,
          [submission.districtId, JSON.stringify(profile)]
        );
      }
    } catch (e) {
      console.error('Failed to apply correction to district profile:', e);
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
}
