import { Pool } from 'pg';
import { IntelligenceContextService } from './intelligence-context.service';
import { logger } from '../utils/logger';

export interface DataLibraryContext {
  impactFees: { description: string; amount: string; source: string }[];
  constructionCosts: { description: string; amount: string; source: string }[];
  rentComps: { description: string; amount: string; source: string }[];
  permitTimelines: { description: string; duration: string; source: string }[];
  recentProjects: {
    name: string;
    type: string;
    units: number | null;
    entitlementType: string | null;
    timelineDays: number | null;
    density: number | null;
    address: string | null;
  }[];
  costSummary: string;
}

export class DataLibraryContextService {
  private intelligenceService: IntelligenceContextService | null = null;

  constructor(private pool: Pool, useIntelligence: boolean = true) {
    // Initialize intelligence service if available
    if (useIntelligence) {
      try {
        this.intelligenceService = new IntelligenceContextService(pool);
      } catch (error) {
        logger.warn('Intelligence layer not available, falling back to keyword search');
        this.intelligenceService = null;
      }
    }
  }

  async getContextForDeal(params: {
    dealId: string;
    municipality: string;
    state: string;
    propertyType?: string;
    zoningCode?: string;
    lotAreaSf?: number;
  }): Promise<DataLibraryContext> {
    const ctx: DataLibraryContext = {
      impactFees: [],
      constructionCosts: [],
      rentComps: [],
      permitTimelines: [],
      recentProjects: [],
      costSummary: '',
    };

    await Promise.all([
      this.loadDataLibraryFiles(ctx, params),
      this.loadBenchmarkProjects(ctx, params),
      this.loadPermitTimelines(ctx, params),
    ]);

    ctx.costSummary = this.buildCostSummary(ctx);
    return ctx;
  }

  private async loadDataLibraryFiles(
    ctx: DataLibraryContext,
    params: { municipality: string; propertyType?: string }
  ): Promise<void> {
    try {
      let documents: any[] = [];

      // Try semantic search first (if intelligence layer available)
      if (this.intelligenceService) {
        try {
          const searchQuery = `${params.municipality} ${params.propertyType || ''} cost data impact fees construction rent comps`;
          
          const results = await this.intelligenceService.semanticSearch({
            query: searchQuery,
            filters: {
              sourceSystem: 'data_library',
              propertyCity: params.municipality,
              validationStatus: ['validated', 'pending'],
            },
            limit: 20,
            minSimilarity: 0.6, // Lower threshold for broader results
          });

          // Convert intelligence layer results to legacy format
          documents = results.map(doc => ({
            file_name: doc.title,
            city: doc.propertyCity,
            property_type: doc.propertyType,
            parsed_data: doc.structuredData?.csvPreview ? {
              preview: doc.structuredData.csvPreview,
              headers: doc.structuredData.csvHeaders,
            } : null,
            tags: doc.structuredData?.tags || [],
            source_type: 'data_library',
            _similarity: doc.similarity, // Track similarity score
          }));

          logger.debug(`Loaded ${documents.length} documents via semantic search`);
        } catch (error: any) {
          logger.warn('Semantic search failed, falling back to keyword search:', error.message);
          // Fall through to keyword search below
        }
      }

      // Fallback to keyword search if no semantic results or intelligence layer unavailable
      if (documents.length === 0) {
        const result = await this.pool.query(
          `SELECT file_name, city, property_type, parsed_data, tags, source_type
           FROM data_library_files
           WHERE parsing_status = 'complete'
             AND (city ILIKE $1 OR city ILIKE $2)
           ORDER BY uploaded_at DESC
           LIMIT 20`,
          [`%${params.municipality}%`, `%${params.municipality.split(' ')[0]}%`]
        );

        documents = result.rows;
        logger.debug(`Loaded ${documents.length} documents via keyword search`);
      }

      // Extract cost data from documents
      for (const row of documents) {
        const parsed = row.parsed_data;
        if (!parsed || !parsed.preview) continue;

        const tags = Array.isArray(row.tags) ? row.tags.map((t: any) => String(t).toLowerCase()) : [];
        const fileName = (row.file_name || '').toLowerCase();

        // Classify document type and extract data
        if (tags.includes('impact_fees') || tags.includes('fees') || fileName.includes('impact') || fileName.includes('fee')) {
          this.extractCostRows(parsed.preview, parsed.headers, ctx.impactFees, row.file_name);
        }
        if (tags.includes('construction') || tags.includes('costs') || fileName.includes('construction') || fileName.includes('cost')) {
          this.extractCostRows(parsed.preview, parsed.headers, ctx.constructionCosts, row.file_name);
        }
        if (tags.includes('rent') || tags.includes('rental') || fileName.includes('rent') || fileName.includes('market')) {
          this.extractCostRows(parsed.preview, parsed.headers, ctx.rentComps, row.file_name);
        }
      }
    } catch (err: any) {
      logger.error('[DataLibraryContext] Error loading files:', err);
    }
  }

  private extractCostRows(
    preview: any[],
    headers: string[],
    target: { description: string; amount: string; source: string }[],
    sourceName: string
  ): void {
    if (!Array.isArray(preview)) return;
    for (const row of preview.slice(0, 10)) {
      const values = Object.values(row).map(String);
      const descCol = headers?.find(h =>
        /name|desc|item|category|type/i.test(h)
      );
      const amtCol = headers?.find(h =>
        /amount|cost|fee|price|rate|value|total/i.test(h)
      );

      const description = descCol ? String(row[descCol] || '') : values[0] || '';
      const amount = amtCol ? String(row[amtCol] || '') : values[1] || '';

      if (description && amount) {
        target.push({ description, amount, source: sourceName });
      }
    }
  }

  private async loadBenchmarkProjects(
    ctx: DataLibraryContext,
    params: { municipality: string; state: string; zoningCode?: string }
  ): Promise<void> {
    try {
      const result = await this.pool.query(
        `SELECT project_name, project_type, unit_count, entitlement_type,
                density_achieved, address, land_acres, building_sf,
                application_date, approval_date
         FROM benchmark_projects
         WHERE (municipality ILIKE $1 OR county ILIKE $2)
           AND state = $3
         ORDER BY approval_date DESC NULLS LAST
         LIMIT 15`,
        [params.municipality, `%${params.municipality}%`, params.state]
      );

      for (const row of result.rows) {
        let timelineDays: number | null = null;
        if (row.application_date && row.approval_date) {
          const appDate = new Date(row.application_date);
          const apprDate = new Date(row.approval_date);
          timelineDays = Math.round((apprDate.getTime() - appDate.getTime()) / (1000 * 60 * 60 * 24));
          if (timelineDays > 0) {
            ctx.permitTimelines.push({
              description: `${row.project_name || row.address || 'Project'} (${row.entitlement_type || 'unknown'})`,
              duration: `${timelineDays} days`,
              source: 'benchmark_projects',
            });
          }
        }

        ctx.recentProjects.push({
          name: row.project_name || row.address || 'Unknown',
          type: row.project_type || 'unknown',
          units: row.unit_count,
          entitlementType: row.entitlement_type,
          timelineDays,
          density: row.density_achieved ? parseFloat(row.density_achieved) : null,
          address: row.address,
        });
      }
    } catch (err: any) {
      console.log('[DataLibraryContext] Error loading benchmarks:', err.message);
    }
  }

  private async loadPermitTimelines(
    ctx: DataLibraryContext,
    params: { municipality: string }
  ): Promise<void> {
    try {
      const result = await this.pool.query(
        `SELECT project_type, AVG(approval_date - application_date) as avg_days,
         COUNT(*) as count
         FROM benchmark_projects
         WHERE municipality ILIKE $1
           AND application_date IS NOT NULL
           AND approval_date IS NOT NULL
           AND approval_date > application_date
         GROUP BY project_type
         HAVING COUNT(*) >= 2`,
        [params.municipality]
      );

      for (const row of result.rows) {
        if (row.avg_days && row.avg_days > 0) {
          ctx.permitTimelines.push({
            description: `Average ${row.project_type || 'all'} permit timeline (${row.count} projects)`,
            duration: `${Math.round(row.avg_days)} days`,
            source: 'benchmark_projects aggregate',
          });
        }
      }
    } catch (err: any) {
      console.log('[DataLibraryContext] Error loading permit timelines:', err.message);
    }
  }

  private buildCostSummary(ctx: DataLibraryContext): string {
    const parts: string[] = [];

    if (ctx.impactFees.length > 0) {
      parts.push(`Impact Fees (${ctx.impactFees.length} records from Data Library):\n` +
        ctx.impactFees.slice(0, 5).map(f => `  - ${f.description}: ${f.amount} [${f.source}]`).join('\n'));
    }

    if (ctx.constructionCosts.length > 0) {
      parts.push(`Construction Costs (${ctx.constructionCosts.length} records):\n` +
        ctx.constructionCosts.slice(0, 5).map(c => `  - ${c.description}: ${c.amount} [${c.source}]`).join('\n'));
    }

    if (ctx.rentComps.length > 0) {
      parts.push(`Rent Comps (${ctx.rentComps.length} records):\n` +
        ctx.rentComps.slice(0, 5).map(r => `  - ${r.description}: ${r.amount} [${r.source}]`).join('\n'));
    }

    if (ctx.permitTimelines.length > 0) {
      parts.push(`Permit Timelines (${ctx.permitTimelines.length} records):\n` +
        ctx.permitTimelines.slice(0, 5).map(t => `  - ${t.description}: ${t.duration}`).join('\n'));
    }

    if (ctx.recentProjects.length > 0) {
      parts.push(`Recent Projects (${ctx.recentProjects.length} in jurisdiction):\n` +
        ctx.recentProjects.slice(0, 8).map(p =>
          `  - ${p.name}: ${p.type}, ${p.units || '?'} units, ${p.entitlementType || 'unknown'} path${p.timelineDays ? `, ${p.timelineDays}d timeline` : ''}`
        ).join('\n'));
    }

    return parts.length > 0
      ? parts.join('\n\n')
      : 'No cost data available in the Data Library for this jurisdiction.';
  }
}
