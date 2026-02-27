import { Pool } from 'pg';
import { ZoningPrecedentService } from './zoning-precedent.service';
import { ZoningOutcomeService } from './zoning-outcome.service';
import { zoningEventBus, ZONING_EVENTS } from './zoning-event-bus.service';

export type MaturityLevel = 'novice' | 'competent' | 'expert' | 'authority';

export interface MaturityAssessment {
  level: MaturityLevel;
  label: string;
  confidenceCap: number;
  totalPrecedents: number;
  totalCorrections: number;
  totalOutcomes: number;
  daysSinceFirst: number;
  disclosure: string;
}

export interface ConfidenceScoreV2 {
  sourceClarity: number;
  extractionFreshness: number;
  professionalValidation: number;
  outcomeCalibration: number;
  crossReferenceComplexity: number;
  jurisdictionMaturity: number;
  overall: number;
  maturity: MaturityAssessment;
  breakdown: {
    factor: string;
    weight: number;
    score: number;
    weighted: number;
  }[];
}

const WEIGHTS = {
  sourceClarity: 0.25,
  extractionFreshness: 0.15,
  professionalValidation: 0.20,
  outcomeCalibration: 0.20,
  crossReferenceComplexity: 0.10,
  jurisdictionMaturity: 0.10,
};

const MATURITY_THRESHOLDS = {
  authority: { precedents: 200, corrections: 50, days: 365, cap: 97 },
  expert: { precedents: 50, corrections: 20, days: 180, cap: 95 },
  competent: { precedents: 10, corrections: 5, days: 30, cap: 88 },
  novice: { precedents: 0, corrections: 0, days: 0, cap: 75 },
};

export class ZoningConfidenceV2Service {
  private precedentService: ZoningPrecedentService;
  private outcomeService: ZoningOutcomeService;

  constructor(private pool: Pool) {
    this.precedentService = new ZoningPrecedentService(pool);
    this.outcomeService = new ZoningOutcomeService(pool);
  }

  async calculateConfidence(
    municipality: string,
    options: {
      sourceClarity?: number;
      extractionFreshness?: number;
      crossReferenceComplexity?: number;
      districtCode?: string;
    } = {}
  ): Promise<ConfidenceScoreV2> {
    const [maturity, validationScore, calibrationScore] = await Promise.all([
      this.assessMaturity(municipality),
      this.calculateProfessionalValidation(municipality),
      this.calculateOutcomeCalibration(municipality, options.districtCode),
    ]);

    const scores = {
      sourceClarity: options.sourceClarity ?? 70,
      extractionFreshness: options.extractionFreshness ?? 60,
      professionalValidation: validationScore,
      outcomeCalibration: calibrationScore,
      crossReferenceComplexity: options.crossReferenceComplexity ?? 50,
      jurisdictionMaturity: this.maturityToScore(maturity),
    };

    const breakdown = Object.entries(WEIGHTS).map(([factor, weight]) => ({
      factor,
      weight,
      score: scores[factor as keyof typeof scores],
      weighted: scores[factor as keyof typeof scores] * weight,
    }));

    let rawOverall = breakdown.reduce((sum, b) => sum + b.weighted, 0);
    const overall = Math.min(rawOverall, maturity.confidenceCap);

    return {
      ...scores,
      overall,
      maturity,
      breakdown,
    };
  }

  async assessMaturity(municipality: string): Promise<MaturityAssessment> {
    const stats = await this.precedentService.getJurisdictionStats(municipality);

    const daysSinceFirst = stats.oldestRecord
      ? Math.floor((Date.now() - new Date(stats.oldestRecord).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    let level: MaturityLevel;
    let label: string;
    let confidenceCap: number;
    let disclosure: string;

    const t = MATURITY_THRESHOLDS;

    if (
      stats.totalPrecedents >= t.authority.precedents &&
      stats.totalCorrections >= t.authority.corrections &&
      daysSinceFirst >= t.authority.days
    ) {
      level = 'authority';
      label = 'Authority';
      confidenceCap = t.authority.cap;
      disclosure = `Authoritative data — ${stats.totalPrecedents} precedent cases tracked over ${Math.floor(daysSinceFirst / 30)} months`;
    } else if (
      stats.totalPrecedents >= t.expert.precedents &&
      stats.totalCorrections >= t.expert.corrections &&
      daysSinceFirst >= t.expert.days
    ) {
      level = 'expert';
      label = 'Expert';
      confidenceCap = t.expert.cap;
      disclosure = `High confidence — based on ${stats.totalPrecedents} comparable cases`;
    } else if (
      stats.totalPrecedents >= t.competent.precedents &&
      stats.totalCorrections >= t.competent.corrections &&
      daysSinceFirst >= t.competent.days
    ) {
      level = 'competent';
      label = 'Competent';
      confidenceCap = t.competent.cap;
      disclosure = `Growing data set — ${stats.totalPrecedents} precedents and ${stats.totalCorrections} verified corrections`;
    } else {
      level = 'novice';
      label = 'Novice';
      confidenceCap = t.novice.cap;
      disclosure = 'Limited precedent data for this jurisdiction';
    }

    return {
      level,
      label,
      confidenceCap,
      totalPrecedents: stats.totalPrecedents,
      totalCorrections: stats.totalCorrections,
      totalOutcomes: stats.totalOutcomes,
      daysSinceFirst,
      disclosure,
    };
  }

  private async calculateProfessionalValidation(municipality: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE verification_status = 'verified') as verified,
         COUNT(*) as total
       FROM zoning_corrections
       WHERE LOWER(municipality) = LOWER($1)`,
      [municipality]
    );

    const verified = parseInt(result.rows[0].verified);
    const total = parseInt(result.rows[0].total);

    if (total === 0) return 30;

    const verificationRate = verified / total;
    const volumeBonus = Math.min(verified * 3, 30);

    return Math.min(100, 30 + (verificationRate * 40) + volumeBonus);
  }

  private async calculateOutcomeCalibration(
    municipality: string,
    districtCode?: string
  ): Promise<number> {
    const summary = await this.outcomeService.getOutcomeSummary(municipality);

    if (summary.totalOutcomes === 0) return 30;

    const accuracyScore = summary.overallAccuracy;
    const volumeBonus = Math.min(summary.totalOutcomes * 2, 20);
    const biasLow = Math.abs(summary.avgProbabilityBias) < 10 ? 10 : 0;

    return Math.min(100, accuracyScore * 0.6 + volumeBonus + biasLow);
  }

  private maturityToScore(maturity: MaturityAssessment): number {
    switch (maturity.level) {
      case 'authority': return 95;
      case 'expert': return 80;
      case 'competent': return 60;
      default: return 30;
    }
  }

  async getMaturityDashboard(): Promise<{
    jurisdictions: {
      municipality: string;
      maturity: MaturityAssessment;
    }[];
  }> {
    const result = await this.pool.query(
      `SELECT DISTINCT municipality FROM zoning_precedents
       UNION SELECT DISTINCT municipality FROM zoning_corrections WHERE municipality IS NOT NULL
       ORDER BY municipality`
    );

    const jurisdictions = await Promise.all(
      result.rows.map(async (row: any) => ({
        municipality: row.municipality,
        maturity: await this.assessMaturity(row.municipality),
      }))
    );

    return { jurisdictions };
  }
}
