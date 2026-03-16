import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

export interface ConcentrationMetrics {
  herfindahlIndex: number;
  top5Share: number;
  publicCompanyCoverage: number;
  singleEmployerMaxShare: number;
  industryDiversityScore: number;
  employerCount: number;
  publicEmployerCount: number;
  sectorBreakdown: Record<string, number>;
}

export class EmployerConcentrationService {
  async computeConcentration(submarketId: number): Promise<ConcentrationMetrics> {
    const pool = getPool();

    const result = await pool.query(
      `SELECT company_name, ticker, is_public, naics_code, employment_share, estimated_local_employees
       FROM submarket_employers
       WHERE submarket_id = $1
       ORDER BY employment_share DESC NULLS LAST`,
      [submarketId],
    );

    const employers = result.rows;
    if (employers.length === 0) {
      return {
        herfindahlIndex: 0,
        top5Share: 0,
        publicCompanyCoverage: 0,
        singleEmployerMaxShare: 0,
        industryDiversityScore: 100,
        employerCount: 0,
        publicEmployerCount: 0,
        sectorBreakdown: {},
      };
    }

    const shares = employers.map((e: any) => parseFloat(e.employment_share) || 0);
    const herfindahlIndex = shares.reduce((sum: number, s: number) => sum + s * s, 0);
    const top5Share = shares.slice(0, 5).reduce((sum: number, s: number) => sum + s, 0);
    const singleEmployerMaxShare = Math.max(...shares);

    const publicEmployers = employers.filter((e: any) => e.is_public);
    const publicCoverage = publicEmployers.reduce((sum: number, e: any) => sum + (parseFloat(e.employment_share) || 0), 0);

    const sectorMap: Record<string, number> = {};
    for (const e of employers) {
      const naics = e.naics_code?.substring(0, 2) || 'XX';
      const label = NAICS_LABELS[naics] || `NAICS-${naics}`;
      sectorMap[label] = (sectorMap[label] || 0) + (parseFloat(e.employment_share) || 0);
    }

    const sectorCount = Object.keys(sectorMap).length;
    const sectorShares = Object.values(sectorMap);
    const sectorHHI = sectorShares.reduce((sum, s) => sum + s * s, 0);
    const industryDiversityScore = Math.round(Math.max(0, Math.min(100, (1 - sectorHHI) * 100)));

    return {
      herfindahlIndex: Math.round(herfindahlIndex * 10000) / 10000,
      top5Share: Math.round(top5Share * 10000) / 10000,
      publicCompanyCoverage: Math.round(publicCoverage * 10000) / 10000,
      singleEmployerMaxShare: Math.round(singleEmployerMaxShare * 10000) / 10000,
      industryDiversityScore,
      employerCount: employers.length,
      publicEmployerCount: publicEmployers.length,
      sectorBreakdown: sectorMap,
    };
  }

  async getEmployers(submarketId: number): Promise<any[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT se.*, chs.composite_chs, chs.health_tier, chs.chs_delta_qoq
       FROM submarket_employers se
       LEFT JOIN corporate_health_scores chs ON se.ticker = chs.ticker
         AND chs.quarter = (SELECT MAX(quarter) FROM corporate_health_scores WHERE ticker = se.ticker)
       WHERE se.submarket_id = $1
       ORDER BY se.employment_share DESC NULLS LAST`,
      [submarketId],
    );
    return result.rows;
  }
}

const NAICS_LABELS: Record<string, string> = {
  '11': 'Agriculture',
  '21': 'Mining',
  '22': 'Utilities',
  '23': 'Construction',
  '31': 'Manufacturing',
  '32': 'Manufacturing',
  '33': 'Manufacturing',
  '42': 'Wholesale Trade',
  '44': 'Retail Trade',
  '45': 'Retail Trade',
  '48': 'Transportation',
  '49': 'Warehousing',
  '51': 'Information',
  '52': 'Finance & Insurance',
  '53': 'Real Estate',
  '54': 'Professional Services',
  '55': 'Management',
  '56': 'Administrative Services',
  '61': 'Education',
  '62': 'Healthcare',
  '71': 'Arts & Entertainment',
  '72': 'Accommodation & Food',
  '81': 'Other Services',
  '92': 'Public Administration',
};

export const employerConcentrationService = new EmployerConcentrationService();
