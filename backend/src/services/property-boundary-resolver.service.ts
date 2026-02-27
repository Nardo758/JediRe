import { Pool } from 'pg';
import { PipelineInput } from './zoning-application-pipeline.service';
import { PropertyType } from './building-envelope.service';
import { geocodingService } from './geocoding.service';

export interface PropertyBoundaryData {
  id: string;
  dealId: string;
  boundaryGeoJSON: any;
  parcelArea: number | null;
  parcelAreaSF: number | null;
  perimeter: number | null;
  centroid: { x: number; y: number } | null;
  setbacks: { front: number; side: number; rear: number };
  buildableArea: number | null;
  buildableAreaSF: number | null;
  buildablePercentage: number | null;
  constraints: {
    easements?: any[];
    floodplain?: boolean;
    floodplainZone?: string;
    wetlands?: boolean;
    protectedArea?: boolean;
  };
  updatedAt: Date | null;
}

export interface DealContext {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  acres: number | null;
  projectType: string | null;
  developmentType: string | null;
  zoningCode: string | null;
  lotSizeSqft: number | null;
}

export interface ResolvedParcelContext {
  boundary: PropertyBoundaryData | null;
  deal: DealContext | null;
  zoningLookup: {
    districtCode: string | null;
    municipality: string | null;
    municipalityId: string | null;
    state: string | null;
    source: 'boundary_geocode' | 'deal_data' | 'manual';
  };
  pipelineInput: PipelineInput;
  dataCompleteness: {
    hasBoundary: boolean;
    hasSetbacks: boolean;
    hasConstraints: boolean;
    hasZoningCode: boolean;
    hasMunicipality: boolean;
    hasLandArea: boolean;
    score: number;
  };
}

export class PropertyBoundaryResolver {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async resolveForDeal(
    dealId: string,
    overrides?: Partial<PipelineInput>
  ): Promise<ResolvedParcelContext> {
    const [boundary, deal] = await Promise.all([
      this.loadBoundary(dealId),
      this.loadDeal(dealId),
    ]);

    const zoningLookup = await this.resolveZoningContext(boundary, deal);
    const pipelineInput = this.buildPipelineInput(dealId, boundary, deal, zoningLookup, overrides);
    const dataCompleteness = this.assessCompleteness(boundary, deal, zoningLookup);

    return {
      boundary,
      deal,
      zoningLookup,
      pipelineInput,
      dataCompleteness,
    };
  }

  private async loadBoundary(dealId: string): Promise<PropertyBoundaryData | null> {
    const result = await this.pool.query(
      'SELECT * FROM property_boundaries WHERE deal_id = $1',
      [dealId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    let centroid: { x: number; y: number } | null = null;
    if (row.centroid) {
      if (typeof row.centroid === 'string') {
        const match = row.centroid.match(/\(([^,]+),([^)]+)\)/);
        if (match) centroid = { x: parseFloat(match[1]), y: parseFloat(match[2]) };
      } else if (row.centroid.x !== undefined) {
        centroid = { x: row.centroid.x, y: row.centroid.y };
      }
    }

    const setbacksRaw = typeof row.setbacks === 'string' ? JSON.parse(row.setbacks) : (row.setbacks || {});
    const constraintsRaw = typeof row.constraints === 'string' ? JSON.parse(row.constraints) : (row.constraints || {});

    return {
      id: row.id,
      dealId: row.deal_id,
      boundaryGeoJSON: row.boundary_geojson,
      parcelArea: row.parcel_area ? parseFloat(row.parcel_area) : null,
      parcelAreaSF: row.parcel_area_sf ? parseFloat(row.parcel_area_sf) : null,
      perimeter: row.perimeter ? parseFloat(row.perimeter) : null,
      centroid,
      setbacks: {
        front: setbacksRaw.front ?? 25,
        side: setbacksRaw.side ?? 15,
        rear: setbacksRaw.rear ?? 20,
      },
      buildableArea: row.buildable_area ? parseFloat(row.buildable_area) : null,
      buildableAreaSF: row.buildable_area_sf ? parseFloat(row.buildable_area_sf) : null,
      buildablePercentage: row.buildable_percentage ? parseFloat(row.buildable_percentage) : null,
      constraints: constraintsRaw,
      updatedAt: row.updated_at,
    };
  }

  private async loadDeal(dealId: string): Promise<DealContext | null> {
    const result = await this.pool.query(
      `SELECT id, name, address, property_address, state, acres, 
              project_type, development_type, deal_data, state_data, module_outputs
       FROM deals WHERE id = $1`,
      [dealId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const dealData = row.deal_data || {};
    const stateData = row.state_data || {};

    const city = dealData.city || stateData.city || null;
    const zoningCode = dealData.zoning_code || stateData.zoning_code || null;
    const lotSizeSqft = dealData.lot_size_sqft || stateData.lot_size_sqft || null;

    return {
      id: row.id,
      name: row.name,
      address: row.property_address || row.address,
      city,
      state: row.state || dealData.state || stateData.state || null,
      acres: row.acres ? parseFloat(row.acres) : null,
      projectType: row.project_type,
      developmentType: row.development_type,
      zoningCode,
      lotSizeSqft: lotSizeSqft ? parseFloat(lotSizeSqft) : null,
    };
  }

  private async resolveZoningContext(
    boundary: PropertyBoundaryData | null,
    deal: DealContext | null
  ): Promise<ResolvedParcelContext['zoningLookup']> {
    let cityToLookup = deal?.city || null;
    let stateToLookup = deal?.state || null;

    if (!cityToLookup && boundary?.centroid) {
      try {
        const lat = boundary.centroid.y;
        const lng = boundary.centroid.x;
        const geoResult = await geocodingService.reverseGeocode(lat, lng);
        if (geoResult) {
          cityToLookup = geoResult.city || null;
          stateToLookup = stateToLookup || geoResult.state || null;
        }
      } catch (e) {
        console.error('Reverse geocode from boundary centroid failed:', e);
      }
    }

    if (cityToLookup) {
      try {
        const muniResult = await this.pool.query(
          `SELECT id, name, state FROM municipalities WHERE LOWER(name) = LOWER($1) LIMIT 1`,
          [cityToLookup]
        );

        if (muniResult.rows.length > 0) {
          const muni = muniResult.rows[0];
          return {
            districtCode: deal?.zoningCode || null,
            municipality: muni.name,
            municipalityId: muni.id,
            state: muni.state || stateToLookup || null,
            source: boundary?.centroid && !deal?.city ? 'boundary_geocode' : 'deal_data',
          };
        }

        return {
          districtCode: deal?.zoningCode || null,
          municipality: cityToLookup,
          municipalityId: null,
          state: stateToLookup,
          source: boundary?.centroid && !deal?.city ? 'boundary_geocode' : 'deal_data',
        };
      } catch (e) {
        console.error('Municipality lookup error:', e);
      }
    }

    if (deal?.zoningCode) {
      return {
        districtCode: deal.zoningCode,
        municipality: null,
        municipalityId: null,
        state: stateToLookup,
        source: 'deal_data',
      };
    }

    return {
      districtCode: null,
      municipality: null,
      municipalityId: null,
      state: null,
      source: 'manual',
    };
  }

  private buildPipelineInput(
    dealId: string,
    boundary: PropertyBoundaryData | null,
    deal: DealContext | null,
    zoningLookup: ResolvedParcelContext['zoningLookup'],
    overrides?: Partial<PipelineInput>
  ): PipelineInput {
    const landAreaSf = boundary?.parcelAreaSF
      || (boundary?.parcelArea ? boundary.parcelArea * 43560 : null)
      || deal?.lotSizeSqft
      || (deal?.acres ? deal.acres * 43560 : null)
      || 0;

    const setbacks = boundary?.setbacks || { front: 25, side: 10, rear: 20 };

    let lat: number | undefined;
    let lng: number | undefined;
    if (boundary?.centroid) {
      lng = boundary.centroid.x;
      lat = boundary.centroid.y;
    }

    const propertyType: PropertyType = (deal?.projectType as PropertyType) || 'multifamily';

    return {
      dealId,
      address: deal?.address || undefined,
      lat,
      lng,
      municipality: overrides?.municipality || zoningLookup.municipality || '',
      state: overrides?.state || zoningLookup.state || '',
      districtCode: overrides?.districtCode || zoningLookup.districtCode || '',
      landAreaSf: overrides?.landAreaSf || landAreaSf,
      setbacks: overrides?.setbacks || setbacks,
      propertyType: overrides?.propertyType || propertyType,
      boundaryGeoJSON: boundary?.boundaryGeoJSON || undefined,
      buildableAreaSF: boundary?.buildableAreaSF || undefined,
      constraints: boundary?.constraints || undefined,
      dataSource: boundary ? 'property_boundary' : 'manual',
      boundaryUpdatedAt: boundary?.updatedAt || null,
      ...overrides,
    };
  }

  private assessCompleteness(
    boundary: PropertyBoundaryData | null,
    deal: DealContext | null,
    zoningLookup: ResolvedParcelContext['zoningLookup']
  ): ResolvedParcelContext['dataCompleteness'] {
    const hasBoundary = !!(boundary?.boundaryGeoJSON);
    const hasSetbacks = !!(boundary?.setbacks?.front || boundary?.setbacks?.side || boundary?.setbacks?.rear);
    const hasConstraints = !!(boundary?.constraints && Object.keys(boundary.constraints).length > 0);
    const hasZoningCode = !!zoningLookup.districtCode;
    const hasMunicipality = !!zoningLookup.municipality;
    const hasLandArea = !!(boundary?.parcelAreaSF || deal?.lotSizeSqft || deal?.acres);

    const checks = [hasBoundary, hasSetbacks, hasConstraints, hasZoningCode, hasMunicipality, hasLandArea];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return { hasBoundary, hasSetbacks, hasConstraints, hasZoningCode, hasMunicipality, hasLandArea, score };
  }

  async getConstraintFlags(dealId: string): Promise<{
    floodplain: boolean;
    floodplainZone: string | null;
    wetlands: boolean;
    protectedArea: boolean;
    hasEasements: boolean;
    easementCount: number;
  }> {
    const boundary = await this.loadBoundary(dealId);
    if (!boundary?.constraints) {
      return { floodplain: false, floodplainZone: null, wetlands: false, protectedArea: false, hasEasements: false, easementCount: 0 };
    }

    const c = boundary.constraints;
    return {
      floodplain: c.floodplain || false,
      floodplainZone: c.floodplainZone || null,
      wetlands: c.wetlands || false,
      protectedArea: c.protectedArea || false,
      hasEasements: !!(c.easements && c.easements.length > 0),
      easementCount: c.easements?.length || 0,
    };
  }
}
