import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { municodeUrlService } from './municode-url.service';

export interface SourceResolutionResult {
  jurisdictionId: string;
  jurisdictionName: string;
  state: string;
  sourceTier: 'municode' | 'municipal_direct' | 'county';
  baseUrl: string;
  zoningCodePath: string | null;
  apiAvailable: boolean;
  apiEndpoint: string | null;
  lastVerified: string | null;
  confidence: number;
  note: string | null;
}

export interface SourceCitation {
  id: string;
  jurisdictionId: string;
  sourceTier: string;
  codeTitle: string | null;
  sectionNumber: string;
  sectionTitle: string | null;
  subsection: string | null;
  sourceUrl: string;
  fullText: string | null;
  lastFetched: string | null;
  lastChanged: string | null;
  confidence: number;
}

export interface VerificationResult {
  id: string;
  dealId: string | null;
  parcelId: string | null;
  gisDesignation: string;
  verifiedDesignation: string | null;
  verificationStatus: 'pending' | 'confirmed' | 'stale' | 'split' | 'conflict';
  discrepancyDetail: string | null;
  overlaysDetected: string[];
  recentAmendments: any[];
  conditionalApprovals: any[];
  sourceCitations: SourceCitation[];
  userAction: string | null;
  verifiedAt: string | null;
  verifiedBy: string;
  confidence: number;
  sourceResolution: SourceResolutionResult | null;
}

export class ZoningVerificationService {

  async resolveSource(jurisdictionId: string): Promise<SourceResolutionResult | null> {
    try {
      const result = await query(
        `SELECT jsm.*, m.name as municipality_name, m.state
         FROM jurisdiction_source_map jsm
         JOIN municipalities m ON m.id = jsm.jurisdiction_id
         WHERE jsm.jurisdiction_id = $1`,
        [jurisdictionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        jurisdictionId: row.jurisdiction_id,
        jurisdictionName: row.municipality_name,
        state: row.state,
        sourceTier: row.source_tier,
        baseUrl: row.base_url,
        zoningCodePath: row.zoning_code_path,
        apiAvailable: row.api_available,
        apiEndpoint: row.api_endpoint,
        lastVerified: row.last_verified,
        confidence: this.getConfidenceForTier(row.source_tier),
        note: row.notes
      };
    } catch (error) {
      logger.error('Source resolution failed:', error);
      return null;
    }
  }

  async resolveSourceByAddress(municipality: string, state: string): Promise<SourceResolutionResult | null> {
    try {
      const result = await query(
        `SELECT jsm.*, m.name as municipality_name, m.state
         FROM jurisdiction_source_map jsm
         JOIN municipalities m ON m.id = jsm.jurisdiction_id
         WHERE LOWER(m.name) LIKE LOWER($1) AND m.state = $2`,
        [`%${municipality}%`, state.toUpperCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        jurisdictionId: row.jurisdiction_id,
        jurisdictionName: row.municipality_name,
        state: row.state,
        sourceTier: row.source_tier,
        baseUrl: row.base_url,
        zoningCodePath: row.zoning_code_path,
        apiAvailable: row.api_available,
        apiEndpoint: row.api_endpoint,
        lastVerified: row.last_verified,
        confidence: this.getConfidenceForTier(row.source_tier),
        note: row.notes
      };
    } catch (error) {
      logger.error('Source resolution by address failed:', error);
      return null;
    }
  }

  async verify(params: {
    parcelId?: string;
    gisZoning: string;
    jurisdictionId: string;
    dealId?: string;
  }): Promise<VerificationResult> {
    const { parcelId, gisZoning, jurisdictionId, dealId } = params;

    const sourceResolution = await this.resolveSource(jurisdictionId);

    const districtResult = await query(
      `SELECT zd.*, m.name as municipality_name, m.state
       FROM zoning_districts zd
       JOIN municipalities m ON m.id = zd.municipality_id
       WHERE zd.municipality_id = $1 AND zd.zoning_code = $2`,
      [jurisdictionId, gisZoning]
    );

    let verificationStatus: VerificationResult['verificationStatus'] = 'pending';
    let verifiedDesignation: string | null = null;
    let discrepancyDetail: string | null = null;
    let overlaysDetected: string[] = [];
    let confidence = 0.0;

    if (districtResult.rows.length > 0) {
      const district = districtResult.rows[0];
      verifiedDesignation = district.zoning_code;

      if (district.zoning_code === gisZoning) {
        verificationStatus = 'confirmed';
        confidence = sourceResolution ? sourceResolution.confidence : 0.85;
      } else {
        verificationStatus = 'conflict';
        discrepancyDetail = `GIS shows "${gisZoning}" but source records show "${district.zoning_code}"`;
        confidence = 0.40;
      }

      if (district.overlay_districts && district.overlay_districts.length > 0) {
        overlaysDetected = district.overlay_districts;
      }

      if (district.verified_at) {
        const verifiedDate = new Date(district.verified_at);
        const daysSinceVerification = Math.floor((Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceVerification > 90 && verificationStatus === 'confirmed') {
          verificationStatus = 'stale';
          discrepancyDetail = `Last verified ${daysSinceVerification} days ago. Code may have been amended.`;
          confidence = Math.max(confidence - 0.15, 0.50);
        }
      }
    } else {
      verificationStatus = 'pending';
      verifiedDesignation = gisZoning;
      confidence = sourceResolution ? sourceResolution.confidence * 0.8 : 0.60;
      discrepancyDetail = 'District not found in JEDI database. Verification based on source availability only.';
    }

    const citations = await this.getCitationsForDistrict(jurisdictionId, gisZoning);

    const insertResult = await query(
      `INSERT INTO zoning_verification 
        (deal_id, parcel_id, gis_designation, verified_designation, verification_status,
         discrepancy_detail, overlays_detected, source_citation_ids, verified_at,
         verified_by, confidence, jurisdiction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'agent_auto', $9, $10)
       RETURNING id, created_at`,
      [
        dealId || null,
        parcelId || null,
        gisZoning,
        verifiedDesignation,
        verificationStatus,
        discrepancyDetail,
        overlaysDetected,
        citations.map(c => c.id),
        confidence,
        jurisdictionId
      ]
    );

    const verificationId = insertResult.rows[0].id;

    return {
      id: verificationId,
      dealId: dealId || null,
      parcelId: parcelId || null,
      gisDesignation: gisZoning,
      verifiedDesignation,
      verificationStatus,
      discrepancyDetail,
      overlaysDetected,
      recentAmendments: [],
      conditionalApprovals: [],
      sourceCitations: citations,
      userAction: null,
      verifiedAt: insertResult.rows[0].created_at,
      verifiedBy: 'agent_auto',
      confidence,
      sourceResolution
    };
  }

  async confirmVerification(verificationId: string): Promise<VerificationResult | null> {
    const result = await query(
      `UPDATE zoning_verification 
       SET user_action = 'confirmed', verified_by = 'user_confirmed', verified_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [verificationId]
    );

    if (result.rows.length === 0) return null;
    return this.rowToVerificationResult(result.rows[0]);
  }

  async flagVerification(verificationId: string): Promise<VerificationResult | null> {
    const result = await query(
      `UPDATE zoning_verification 
       SET user_action = 'flagged', verified_by = 'agent_auto'
       WHERE id = $1
       RETURNING *`,
      [verificationId]
    );

    if (result.rows.length === 0) return null;
    return this.rowToVerificationResult(result.rows[0]);
  }

  async correctVerification(verificationId: string, correctionDetail: string, newDesignation?: string): Promise<VerificationResult | null> {
    const updates: string[] = [
      `user_action = 'corrected'`,
      `user_correction_detail = $2`,
      `verified_by = 'user_confirmed'`
    ];
    const values: any[] = [verificationId, correctionDetail];

    if (newDesignation) {
      updates.push(`verified_designation = $${values.length + 1}`);
      values.push(newDesignation);
    }

    const result = await query(
      `UPDATE zoning_verification SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.rowToVerificationResult(result.rows[0]);
  }

  async getVerificationForDeal(dealId: string): Promise<VerificationResult | null> {
    const result = await query(
      `SELECT zv.*, 
         jsm.source_tier, jsm.base_url, jsm.zoning_code_path, jsm.api_available,
         jsm.api_endpoint, jsm.last_verified as source_last_verified, jsm.notes as source_notes,
         m.name as municipality_name, m.state
       FROM zoning_verification zv
       LEFT JOIN jurisdiction_source_map jsm ON jsm.jurisdiction_id = zv.jurisdiction_id
       LEFT JOIN municipalities m ON m.id = zv.jurisdiction_id
       WHERE zv.deal_id = $1
       ORDER BY zv.created_at DESC
       LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const verificationResult = await this.rowToVerificationResult(row);

    if (row.source_tier) {
      verificationResult.sourceResolution = {
        jurisdictionId: row.jurisdiction_id,
        jurisdictionName: row.municipality_name || '',
        state: row.state || '',
        sourceTier: row.source_tier,
        baseUrl: row.base_url || '',
        zoningCodePath: row.zoning_code_path,
        apiAvailable: row.api_available || false,
        apiEndpoint: row.api_endpoint,
        lastVerified: row.source_last_verified,
        confidence: this.getConfidenceForTier(row.source_tier),
        note: row.source_notes
      };
    }

    return verificationResult;
  }

  async getCitationsForDistrict(jurisdictionId: string, districtCode: string): Promise<SourceCitation[]> {
    const result = await query(
      `SELECT * FROM zoning_source_citation
       WHERE jurisdiction_id = $1 AND (section_number ILIKE $2 OR section_title ILIKE $3)
       ORDER BY section_number`,
      [jurisdictionId, `%${districtCode}%`, `%${districtCode}%`]
    );

    return result.rows.map(this.rowToCitation);
  }

  async getCitationsByJurisdiction(jurisdictionId: string): Promise<SourceCitation[]> {
    const result = await query(
      `SELECT * FROM zoning_source_citation WHERE jurisdiction_id = $1 ORDER BY section_number`,
      [jurisdictionId]
    );

    return result.rows.map(this.rowToCitation);
  }

  async createCitation(citation: Omit<SourceCitation, 'id'>): Promise<SourceCitation> {
    let sourceUrl = citation.sourceUrl;
    if (!sourceUrl && citation.sectionNumber && citation.jurisdictionId) {
      try {
        const municipalityId = await this.getMunicipalityIdFromJurisdiction(citation.jurisdictionId);
        if (municipalityId) {
          const resolved = await municodeUrlService.resolveCodeReference(municipalityId, citation.sectionNumber);
          if (resolved) sourceUrl = resolved;
        }
      } catch {}
    }

    const result = await query(
      `INSERT INTO zoning_source_citation 
        (jurisdiction_id, source_tier, code_title, section_number, section_title, 
         subsection, source_url, full_text, full_text_hash, last_fetched, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
       RETURNING *`,
      [
        citation.jurisdictionId,
        citation.sourceTier,
        citation.codeTitle,
        citation.sectionNumber,
        citation.sectionTitle,
        citation.subsection,
        sourceUrl,
        citation.fullText,
        citation.fullText ? this.hashText(citation.fullText) : null,
        citation.confidence
      ]
    );

    return this.rowToCitation(result.rows[0]);
  }

  private async getMunicipalityIdFromJurisdiction(jurisdictionId: string): Promise<string | null> {
    const result = await query(
      `SELECT m.id FROM municipalities m
       JOIN jurisdiction_source_map jsm ON LOWER(jsm.jurisdiction_name) = LOWER(m.name)
       WHERE jsm.id = $1
       LIMIT 1`,
      [jurisdictionId]
    );
    return result.rows[0]?.id || null;
  }

  private getConfidenceForTier(tier: string): number {
    switch (tier) {
      case 'municipal_direct': return 0.97;
      case 'municode': return 0.95;
      case 'county': return 0.85;
      default: return 0.70;
    }
  }

  private hashText(text: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  private rowToCitation(row: any): SourceCitation {
    return {
      id: row.id,
      jurisdictionId: row.jurisdiction_id,
      sourceTier: row.source_tier,
      codeTitle: row.code_title,
      sectionNumber: row.section_number,
      sectionTitle: row.section_title,
      subsection: row.subsection,
      sourceUrl: row.source_url,
      fullText: row.full_text,
      lastFetched: row.last_fetched,
      lastChanged: row.last_changed,
      confidence: parseFloat(row.confidence) || 0.90
    };
  }

  private async rowToVerificationResult(row: any): Promise<VerificationResult> {
    const citations = row.source_citation_ids && row.source_citation_ids.length > 0
      ? await this.getCitationsByIds(row.source_citation_ids)
      : [];

    return {
      id: row.id,
      dealId: row.deal_id,
      parcelId: row.parcel_id,
      gisDesignation: row.gis_designation,
      verifiedDesignation: row.verified_designation,
      verificationStatus: row.verification_status,
      discrepancyDetail: row.discrepancy_detail,
      overlaysDetected: row.overlays_detected || [],
      recentAmendments: row.recent_amendments || [],
      conditionalApprovals: row.conditional_approvals || [],
      sourceCitations: citations,
      userAction: row.user_action,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
      confidence: parseFloat(row.confidence) || 0,
      sourceResolution: null
    };
  }

  private async getCitationsByIds(ids: string[]): Promise<SourceCitation[]> {
    if (!ids || ids.length === 0) return [];

    const result = await query(
      `SELECT * FROM zoning_source_citation WHERE id = ANY($1) ORDER BY section_number`,
      [ids]
    );

    return result.rows.map(this.rowToCitation);
  }
}
