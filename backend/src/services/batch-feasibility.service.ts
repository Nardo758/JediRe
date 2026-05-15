/**
 * WS-3 Layer 2 — Batch Feasibility Service
 *
 * Vectorizes BuildingEnvelopeService.calculateEnvelope() over every parcel
 * returned by the Layer 1 radius sweep.  For each parcel:
 *
 *  1. Looks up dimensional standards from zoning_districts (setbacks, FAR,
 *     density, height) using county_zoning_code × municipality.
 *  2. Calls calculateEnvelope() to obtain the binding unit capacity —
 *     bindingUnitsPerAcre is derived from maxCapacity / acreage so it
 *     reflects the smallest of density/FAR/height/parking constraints.
 *  3. Classifies the parcel as:
 *       vacant     — no meaningful improvement on the land
 *       underbuilt — improvements < 60 % of allowed capacity
 *       developed  — fully or substantially built out
 *  4. Computes latentCapacityUnits:
 *       vacant:     full allowed capacity
 *       underbuilt: allowed − estimated current units
 *       developed:  0
 */

import { Pool } from 'pg';
import { BuildingEnvelopeService, type ZoningConstraints } from './building-envelope.service';
import type { SweptParcel } from './radius-sweep.service';
import { logger } from '../utils/logger';

export type ParcelClass = 'vacant' | 'underbuilt' | 'developed';

export interface FeasibilityParcel {
  parcelId: string;
  address: string | null;
  zoningCode: string | null;
  acreage: number;
  bindingUnitsPerAcre: number;
  allowedUnits: number;
  currentUse: ParcelClass;
  latentCapacityUnits: number;
  limitingFactor: string;
  distanceMiles: number;
}

const AVG_UNIT_SIZE_SF = 900;
const UNDERBUILT_THRESHOLD = 0.6;

const DEFAULT_SETBACKS = { front: 10, side: 5, rear: 10 };

interface DistrictRow {
  max_density_per_acre: string | null;
  max_far: string | null;
  max_building_height_ft: string | null;
  max_stories: string | null;
  min_front_setback_ft: string | null;
  min_side_setback_ft: string | null;
  min_rear_setback_ft: string | null;
  max_lot_coverage: string | null;
  parking_per_unit: string | null;
}

export class BatchFeasibilityService {
  private envelopeService = new BuildingEnvelopeService();

  constructor(private pool: Pool) {}

  async run(
    parcels: SweptParcel[],
    municipality: string,
  ): Promise<FeasibilityParcel[]> {
    if (parcels.length === 0) return [];

    const uniqueCodes = [...new Set(parcels.map((p) => p.zoningCode).filter(Boolean))];
    const districtMap = await this.fetchDistrictStandards(uniqueCodes as string[], municipality);

    const results: FeasibilityParcel[] = [];

    for (const parcel of parcels) {
      try {
        const acreage = Math.max(0.01, parcel.lotAreaSf / 43560);
        const district = parcel.zoningCode ? districtMap.get(parcel.zoningCode.toUpperCase()) : undefined;

        const zoningConstraints: ZoningConstraints = {
          maxDensity: district ? parseFloat(district.max_density_per_acre ?? '0') || null : null,
          maxFAR: district ? parseFloat(district.max_far ?? '0') || null : null,
          maxHeight: district ? parseFloat(district.max_building_height_ft ?? '0') || null : null,
          maxStories: district ? parseFloat(district.max_stories ?? '0') || null : null,
          maxLotCoverage: district ? parseFloat(district.max_lot_coverage ?? '0') || null : null,
          minParkingPerUnit: district ? parseFloat(district.parking_per_unit ?? '0') || null : null,
        };

        const front = district ? parseFloat(district.min_front_setback_ft ?? '0') || DEFAULT_SETBACKS.front : DEFAULT_SETBACKS.front;
        const side = district ? parseFloat(district.min_side_setback_ft ?? '0') || DEFAULT_SETBACKS.side : DEFAULT_SETBACKS.side;
        const rear = district ? parseFloat(district.min_rear_setback_ft ?? '0') || DEFAULT_SETBACKS.rear : DEFAULT_SETBACKS.rear;

        const lotDimensions =
          parcel.lotWidthFt && parcel.lotDepthFt
            ? { frontage: parcel.lotWidthFt, depth: parcel.lotDepthFt }
            : null;

        const envelope = this.envelopeService.calculateEnvelope({
          landArea: parcel.lotAreaSf,
          setbacks: { front, side, rear },
          lotDimensions,
          zoningConstraints,
          propertyType: 'multifamily',
        });

        const allowedUnits = Math.max(0, envelope.maxCapacity);
        const bindingUnitsPerAcre = acreage > 0 ? allowedUnits / acreage : 0;

        const { currentUse, latentCapacityUnits } = this.classifyParcel(
          parcel.rawRecord,
          parcel.landUseCode,
          allowedUnits,
          parcel.lotAreaSf,
          zoningConstraints.maxFAR,
        );

        results.push({
          parcelId: parcel.parcelId,
          address: parcel.address,
          zoningCode: parcel.zoningCode,
          acreage: Math.round(acreage * 1000) / 1000,
          bindingUnitsPerAcre: Math.round(bindingUnitsPerAcre * 10) / 10,
          allowedUnits,
          currentUse,
          latentCapacityUnits: Math.max(0, latentCapacityUnits),
          limitingFactor: envelope.limitingFactor,
          distanceMiles: Math.round(parcel.distanceMiles * 100) / 100,
        });
      } catch (err) {
        logger.debug('[BatchFeasibilityService] parcel skipped', {
          parcelId: parcel.parcelId,
          err: (err as Error).message,
        });
      }
    }

    return results;
  }

  private async fetchDistrictStandards(
    codes: string[],
    municipality: string,
  ): Promise<Map<string, DistrictRow>> {
    if (codes.length === 0) return new Map();

    try {
      const result = await this.pool.query<DistrictRow & { key_code: string }>(
        `SELECT
           UPPER(COALESCE(zoning_code, district_code)) AS key_code,
           max_density_per_acre,
           COALESCE(max_far, residential_far) AS max_far,
           max_building_height_ft,
           max_stories,
           min_front_setback_ft,
           min_side_setback_ft,
           min_rear_setback_ft,
           max_lot_coverage,
           parking_per_unit
         FROM zoning_districts
         WHERE UPPER(COALESCE(zoning_code, district_code)) = ANY($1)
           AND (
             municipality IS NULL
             OR UPPER(municipality) = UPPER($2)
             OR $2 = ''
           )
         ORDER BY
           CASE WHEN UPPER(municipality) = UPPER($2) THEN 0 ELSE 1 END`,
        [codes.map((c) => c.toUpperCase()), municipality],
      );

      const map = new Map<string, DistrictRow>();
      for (const row of result.rows) {
        if (!map.has(row.key_code)) {
          map.set(row.key_code, row);
        }
      }
      return map;
    } catch (err) {
      logger.warn('[BatchFeasibilityService] district lookup failed', {
        err: (err as Error).message,
      });
      return new Map();
    }
  }

  private classifyParcel(
    rawRecord: Record<string, unknown>,
    landUseCode: string | null,
    allowedUnits: number,
    lotAreaSf: number,
    maxFar: number | null,
  ): { currentUse: ParcelClass; latentCapacityUnits: number } {
    const rr = rawRecord ?? {};

    const improvedValue = parseFloat(
      (rr['improved_value'] ?? rr['improvement_value'] ?? rr['assessed_improvements'] ?? '0') as string,
    ) || 0;
    const landValue = parseFloat(
      (rr['land_value'] ?? rr['assessed_land'] ?? '0') as string,
    ) || 0;
    const buildingSf = parseFloat(
      (rr['building_sf'] ?? rr['improvement_sf'] ?? rr['living_area_sqft'] ?? '0') as string,
    ) || 0;
    const yearBuilt = rr['year_built'] ?? rr['year_blt'] ?? null;
    const luLower = (landUseCode ?? '').toLowerCase();

    const isVacant =
      (luLower.includes('vacant') || luLower.includes('unimproved') || luLower === 'v') ||
      (improvedValue === 0 && buildingSf === 0 && !yearBuilt) ||
      (improvedValue > 0 && landValue > 0 && improvedValue / (improvedValue + landValue) < 0.03);

    if (isVacant || allowedUnits === 0) {
      return {
        currentUse: 'vacant',
        latentCapacityUnits: allowedUnits,
      };
    }

    let estimatedCurrentUnits = 0;
    if (buildingSf > 0) {
      estimatedCurrentUnits = Math.floor(buildingSf / AVG_UNIT_SIZE_SF);
    } else if (maxFar != null && maxFar > 0) {
      const estimatedBuiltSf = improvedValue > 0 && landValue > 0
        ? (improvedValue / (improvedValue + landValue)) * lotAreaSf * maxFar
        : 0;
      estimatedCurrentUnits = Math.floor(estimatedBuiltSf / AVG_UNIT_SIZE_SF);
    }

    const utilizationRatio = allowedUnits > 0 ? estimatedCurrentUnits / allowedUnits : 1;

    if (utilizationRatio < UNDERBUILT_THRESHOLD) {
      return {
        currentUse: 'underbuilt',
        latentCapacityUnits: Math.max(0, allowedUnits - estimatedCurrentUnits),
      };
    }

    return { currentUse: 'developed', latentCapacityUnits: 0 };
  }
}
