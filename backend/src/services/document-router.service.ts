/**
 * Document Router Service
 * Routes documents to appropriate modules based on category and requirements
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface DocumentRoute {
  documentId: string;
  documentTitle: string;
  categoryCode: string;
  targetModules: string[];
  priority: number;
  confidence: number;
}

export interface ModuleDataPackage {
  moduleCode: string;
  moduleName: string;
  documents: Array<{
    id: string;
    title: string;
    category: string;
    structuredData: any;
    confidence: number;
    isRequired: boolean;
  }>;
  dataQuality: {
    hasAllRequired: boolean;
    missingRequired: string[];
    hasOptional: string[];
    missingOptional: string[];
    overallScore: number;
  };
}

export class DocumentRouterService {
  constructor(private pool: Pool) {}

  /**
   * Auto-categorize a document based on content and filename
   */
  async autoCatego rizeDocument(doc: {
    title: string;
    documentType: string;
    contentText?: string;
    structuredData?: any;
  }): Promise<string | null> {
    const title = doc.title.toLowerCase();
    const docType = doc.documentType.toLowerCase();
    const content = (doc.contentText || '').toLowerCase();

    // Rule-based categorization (can be enhanced with ML later)
    const rules: Array<{ pattern: RegExp | ((text: string) => boolean); category: string }> = [
      { pattern: /offering.*memorandum|broker.*package|om\b/i, category: 'OM' },
      { pattern: /t-?12|trailing.*12|twelve.*month/i, category: 'T12' },
      { pattern: /rent.*roll|tenant.*roll|unit.*mix/i, category: 'RENT_ROLL' },
      { pattern: /pro.*forma|proforma|financial.*projection/i, category: 'PROFORMA' },
      { pattern: /appraisal|valuation.*report/i, category: 'APPRAISAL' },
      { pattern: /survey|boundary|plat/i, category: 'SURVEY' },
      { pattern: /inspection|property.*condition|physical.*inspection/i, category: 'INSPECTION' },
      { pattern: /environmental|phase.*i|phase.*ii/i, category: 'ENV_REPORT' },
      { pattern: /zoning.*code|zoning.*ordinance|municipal.*code/i, category: 'ZONING_CODE' },
      { pattern: /zoning.*letter|zoning.*determination/i, category: 'ZONING_LETTER' },
      { pattern: /site.*plan|development.*plan/i, category: 'SITE_PLAN' },
      { pattern: /market.*report|market.*analysis/i, category: 'MARKET_REPORT' },
      { pattern: /comp.*sale|comparable.*sale|sale.*comp/i, category: 'COMP_SHEET' },
      { pattern: /rent.*survey|rental.*survey|market.*rent/i, category: 'RENT_SURVEY' },
      { pattern: /demographic|census|population/i, category: 'DEMO_REPORT' },
      { pattern: /cost.*estimate|construction.*budget/i, category: 'COST_ESTIMATE' },
      { pattern: /impact.*fee|development.*fee/i, category: 'IMPACT_FEES' },
      { pattern: /permit.*timeline|approval.*timeline/i, category: 'PERMIT_TIMELINE' },
      { pattern: /purchase.*agreement|psa\b|sales.*contract/i, category: 'PSA' },
      { pattern: /title.*report|title.*commitment/i, category: 'TITLE_REPORT' },
      { pattern: /operating.*budget|annual.*budget/i, category: 'BUDGET' },
    ];

    const searchText = `${title} ${docType} ${content.slice(0, 1000)}`;

    for (const rule of rules) {
      if (typeof rule.pattern === 'function') {
        if (rule.pattern(searchText)) {
          return rule.category;
        }
      } else if (rule.pattern.test(searchText)) {
        return rule.category;
      }
    }

    return null; // Unable to categorize
  }

  /**
   * Get routing information for a document
   */
  async getDocumentRoutes(documentId: string): Promise<DocumentRoute | null> {
    try {
      const result = await this.pool.query(`
        SELECT 
          ud.id,
          ud.title,
          ud.category_code,
          ud.confidence_score,
          dc.target_modules,
          dc.agent_priority
        FROM unified_documents ud
        LEFT JOIN document_categories dc ON dc.category_code = ud.category_code
        WHERE ud.id = $1
      `, [documentId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        documentId: row.id,
        documentTitle: row.title,
        categoryCode: row.category_code || 'UNCATEGORIZED',
        targetModules: row.target_modules || [],
        priority: row.agent_priority || 5,
        confidence: row.confidence_score || 0.5,
      };
    } catch (error) {
      logger.error('Error getting document routes:', error);
      return null;
    }
  }

  /**
   * Get all documents available for a specific module
   */
  async getDocumentsForModule(
    moduleCode: string,
    filters?: {
      dealId?: string;
      city?: string;
      propertyType?: string;
      minConfidence?: number;
    }
  ): Promise<ModuleDataPackage> {
    try {
      // Get module requirements
      const reqResult = await this.pool.query(`
        SELECT 
          module_name,
          required_categories,
          optional_categories,
          min_confidence_score
        FROM module_data_requirements
        WHERE module_code = $1 AND is_active = true
      `, [moduleCode]);

      if (reqResult.rows.length === 0) {
        throw new Error(`Module ${moduleCode} not found in requirements`);
      }

      const requirements = reqResult.rows[0];
      const minConfidence = filters?.minConfidence || requirements.min_confidence_score || 0.6;

      // Build query conditions
      const conditions = ['ud.category_code = ANY($1::text[])'];
      const values: any[] = [
        [...requirements.required_categories, ...requirements.optional_categories]
      ];
      let paramIndex = 2;

      if (filters?.dealId) {
        conditions.push(`ud.deal_capsule_id = $${paramIndex}`);
        values.push(filters.dealId);
        paramIndex++;
      }

      if (filters?.city) {
        conditions.push(`ud.property_city ILIKE $${paramIndex}`);
        values.push(`%${filters.city}%`);
        paramIndex++;
      }

      if (filters?.propertyType) {
        conditions.push(`ud.property_type ILIKE $${paramIndex}`);
        values.push(`%${filters.propertyType}%`);
        paramIndex++;
      }

      conditions.push(`ud.confidence_score >= $${paramIndex}`);
      values.push(minConfidence);

      // Get documents
      const docResult = await this.pool.query(`
        SELECT 
          ud.id,
          ud.title,
          ud.category_code,
          ud.structured_data,
          ud.confidence_score
        FROM unified_documents ud
        WHERE ${conditions.join(' AND ')}
          AND ud.validation_status IN ('validated', 'pending')
        ORDER BY ud.confidence_score DESC, ud.created_at DESC
      `, values);

      const documents = docResult.rows.map(row => ({
        id: row.id,
        title: row.title,
        category: row.category_code,
        structuredData: row.structured_data || {},
        confidence: row.confidence_score || 0.5,
        isRequired: requirements.required_categories.includes(row.category_code),
      }));

      // Calculate data quality
      const categoriesPresent = new Set(documents.map(d => d.category));
      const missingRequired = requirements.required_categories.filter(
        (cat: string) => !categoriesPresent.has(cat)
      );
      const hasOptional = requirements.optional_categories.filter(
        (cat: string) => categoriesPresent.has(cat)
      );
      const missingOptional = requirements.optional_categories.filter(
        (cat: string) => !categoriesPresent.has(cat)
      );

      const hasAllRequired = missingRequired.length === 0;
      const optionalScore = requirements.optional_categories.length > 0
        ? hasOptional.length / requirements.optional_categories.length
        : 1;
      const overallScore = hasAllRequired ? (0.7 + optionalScore * 0.3) : (optionalScore * 0.5);

      return {
        moduleCode,
        moduleName: requirements.module_name,
        documents,
        dataQuality: {
          hasAllRequired,
          missingRequired,
          hasOptional,
          missingOptional,
          overallScore,
        },
      };
    } catch (error) {
      logger.error(`Error getting documents for module ${moduleCode}:`, error);
      throw error;
    }
  }

  /**
   * Route a newly indexed document to relevant modules
   */
  async routeDocument(documentId: string): Promise<string[]> {
    const routes = await this.getDocumentRoutes(documentId);
    
    if (!routes || routes.targetModules.length === 0) {
      logger.warn(`No routing available for document ${documentId}`);
      return [];
    }

    logger.info(`Document ${documentId} routed to modules:`, routes.targetModules);
    
    // TODO: Trigger module refresh/notification
    // For now, just return the module list
    return routes.targetModules;
  }

  /**
   * Get data quality report for a deal across all modules
   */
  async getDealDataQuality(dealId: string): Promise<{
    modules: ModuleDataPackage[];
    overallScore: number;
    readyModules: string[];
    blockedModules: string[];
  }> {
    // Get all active modules
    const modulesResult = await this.pool.query(`
      SELECT module_code, module_name
      FROM module_data_requirements
      WHERE is_active = true
      ORDER BY module_code
    `);

    const modulePackages: ModuleDataPackage[] = [];
    let totalScore = 0;

    for (const module of modulesResult.rows) {
      try {
        const pkg = await this.getDocumentsForModule(module.module_code, { dealId });
        modulePackages.push(pkg);
        totalScore += pkg.dataQuality.overallScore;
      } catch (error) {
        logger.error(`Error getting data quality for ${module.module_code}:`, error);
      }
    }

    const overallScore = modulePackages.length > 0
      ? totalScore / modulePackages.length
      : 0;

    const readyModules = modulePackages
      .filter(pkg => pkg.dataQuality.hasAllRequired)
      .map(pkg => pkg.moduleCode);

    const blockedModules = modulePackages
      .filter(pkg => !pkg.dataQuality.hasAllRequired)
      .map(pkg => pkg.moduleCode);

    return {
      modules: modulePackages,
      overallScore,
      readyModules,
      blockedModules,
    };
  }
}
