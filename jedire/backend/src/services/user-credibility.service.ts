import { Pool } from 'pg';

export type CredibilityTier = 'zoning_attorney' | 'developer' | 'broker_agent' | 'investor' | 'new_user';

const TIER_BASE_WEIGHTS: Record<CredibilityTier, number> = {
  zoning_attorney: 0.95,
  developer: 0.80,
  broker_agent: 0.65,
  investor: 0.50,
  new_user: 0.30,
};

export interface UserCredibility {
  id: string;
  userId: string;
  tier: CredibilityTier;
  baseWeight: number;
  accuracyAdjustment: number;
  computedWeight: number;
  totalCorrections: number;
  verifiedCorrections: number;
  rejectedCorrections: number;
  accuracyRate: number;
  elevated: boolean;
  elevatedAt: Date | null;
  jurisdictionsContributed: string[];
}

export class UserCredibilityService {
  constructor(private pool: Pool) {}

  async getOrCreate(userId: string, tier?: CredibilityTier): Promise<UserCredibility> {
    const existing = await this.pool.query(
      `SELECT * FROM user_credibility WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length > 0) {
      return this.mapRow(existing.rows[0]);
    }

    const resolvedTier = tier || 'new_user';
    const baseWeight = TIER_BASE_WEIGHTS[resolvedTier];

    const result = await this.pool.query(
      `INSERT INTO user_credibility (user_id, tier, base_weight, computed_weight)
       VALUES ($1, $2, $3, $3)
       RETURNING *`,
      [userId, resolvedTier, baseWeight]
    );

    return this.mapRow(result.rows[0]);
  }

  async updateTier(userId: string, tier: CredibilityTier): Promise<UserCredibility> {
    const baseWeight = TIER_BASE_WEIGHTS[tier];
    const cred = await this.getOrCreate(userId);
    const computed = Math.min(1.0, Math.max(0.1, baseWeight + cred.accuracyAdjustment));

    const result = await this.pool.query(
      `UPDATE user_credibility
       SET tier = $2, base_weight = $3, computed_weight = $4, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId, tier, baseWeight, computed]
    );

    return this.mapRow(result.rows[0]);
  }

  async recordCorrectionOutcome(
    userId: string,
    verified: boolean,
    municipality?: string
  ): Promise<UserCredibility> {
    const cred = await this.getOrCreate(userId);

    const totalCorrections = cred.totalCorrections + 1;
    const verifiedCorrections = cred.verifiedCorrections + (verified ? 1 : 0);
    const rejectedCorrections = cred.rejectedCorrections + (verified ? 0 : 1);
    const accuracyRate = totalCorrections > 0 ? (verifiedCorrections / totalCorrections) * 100 : 0;

    let accuracyAdjustment = 0;
    if (totalCorrections >= 3) {
      accuracyAdjustment = ((accuracyRate / 100) - 0.5) * 0.30;
      accuracyAdjustment = Math.min(0.15, Math.max(-0.15, accuracyAdjustment));
    }

    const computedWeight = Math.min(1.0, Math.max(0.1, cred.baseWeight + accuracyAdjustment));

    const elevated = verifiedCorrections >= 3 && !cred.elevated;

    let jurisdictions = cred.jurisdictionsContributed || [];
    if (municipality && !jurisdictions.includes(municipality)) {
      jurisdictions = [...jurisdictions, municipality];
    }

    const result = await this.pool.query(
      `UPDATE user_credibility
       SET total_corrections = $2, verified_corrections = $3, rejected_corrections = $4,
           accuracy_rate = $5, accuracy_adjustment = $6, computed_weight = $7,
           elevated = CASE WHEN $8 THEN TRUE ELSE elevated END,
           elevated_at = CASE WHEN $8 THEN NOW() ELSE elevated_at END,
           jurisdictions_contributed = $9,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId, totalCorrections, verifiedCorrections, rejectedCorrections,
       accuracyRate, accuracyAdjustment, computedWeight, elevated,
       jurisdictions]
    );

    return this.mapRow(result.rows[0]);
  }

  async getWeight(userId: string): Promise<number> {
    const cred = await this.getOrCreate(userId);
    return cred.computedWeight;
  }

  private mapRow(row: any): UserCredibility {
    return {
      id: row.id,
      userId: row.user_id,
      tier: row.tier as CredibilityTier,
      baseWeight: parseFloat(row.base_weight),
      accuracyAdjustment: parseFloat(row.accuracy_adjustment),
      computedWeight: parseFloat(row.computed_weight),
      totalCorrections: row.total_corrections,
      verifiedCorrections: row.verified_corrections,
      rejectedCorrections: row.rejected_corrections,
      accuracyRate: parseFloat(row.accuracy_rate || '0'),
      elevated: row.elevated,
      elevatedAt: row.elevated_at,
      jurisdictionsContributed: row.jurisdictions_contributed || [],
    };
  }
}
