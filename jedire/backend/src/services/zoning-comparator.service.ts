import { Pool } from 'pg';

export class ZoningComparatorService {
  constructor(private pool: Pool) {}

  async compareDistricts(districtA: string, districtB: string) {
    const result = await this.pool.query(
      `SELECT id, district_code, zoning_code, district_name, municipality, state,
              max_density_units_per_acre, max_height_ft, max_far,
              max_lot_coverage, max_lot_coverage_percent,
              min_lot_size_sf, min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft,
              setback_front_ft, setback_side_ft, setback_rear_ft,
              parking_spaces_per_unit, district_profile,
              permitted_uses, conditional_uses, prohibited_uses
       FROM zoning_districts
       WHERE UPPER(COALESCE(zoning_code, district_code)) IN (UPPER($1), UPPER($2))`,
      [districtA, districtB]
    );

    if (result.rows.length < 2) {
      const found = result.rows.map(r => r.zoning_code || r.district_code);
      return {
        comparison: null,
        error: `Could not find both districts. Found: ${found.join(', ') || 'none'}`,
      };
    }

    const a = result.rows[0];
    const b = result.rows[1];

    return {
      comparison: {
        districtA: this.formatDistrictData(a),
        districtB: this.formatDistrictData(b),
        deltas: this.calculateDistrictDeltas(a, b),
        advantages: this.determineAdvantages(a, b),
      },
    };
  }

  async compareParcels(parcelA: { dealId?: string; address?: string }, parcelB: { dealId?: string; address?: string }) {
    const getParcelData = async (parcel: { dealId?: string; address?: string }) => {
      if (parcel.dealId) {
        const zoningResult = await this.pool.query(
          `SELECT zc.*, d.name as deal_name, d.address
           FROM zoning_capacity zc
           JOIN deals d ON d.id = zc.deal_id
           WHERE zc.deal_id = $1`,
          [parcel.dealId]
        );
        const boundaryResult = await this.pool.query(
          `SELECT metrics FROM property_boundaries WHERE deal_id = $1`,
          [parcel.dealId]
        );
        return {
          ...zoningResult.rows[0],
          metrics: boundaryResult.rows[0]?.metrics || {},
        };
      }
      return null;
    };

    const dataA = await getParcelData(parcelA);
    const dataB = await getParcelData(parcelB);

    if (!dataA || !dataB) {
      return {
        comparison: null,
        error: 'Could not retrieve data for one or both parcels',
      };
    }

    return {
      comparison: {
        parcelA: this.formatParcelData(dataA),
        parcelB: this.formatParcelData(dataB),
        deltas: this.calculateParcelDeltas(dataA, dataB),
        advantages: this.determineParcelAdvantages(dataA, dataB),
      },
    };
  }

  async compareJurisdictions(jurisdictionA: string, jurisdictionB: string) {
    const getJurisdictionData = async (municipality: string) => {
      const benchmarks = await this.pool.query(
        `SELECT project_type, entitlement_type, median_months, p25_months, p75_months, p90_months, sample_size, trend
         FROM municipal_benchmarks
         WHERE municipality ILIKE $1
         ORDER BY project_type, entitlement_type`,
        [`%${municipality}%`]
      );

      const alerts = await this.pool.query(
        `SELECT category, severity, COUNT(*) as count
         FROM regulatory_alerts
         WHERE municipality ILIKE $1 AND is_active = true
         GROUP BY category, severity`,
        [`%${municipality}%`]
      );

      const entitlements = await this.pool.query(
        `SELECT status, risk_level, COUNT(*) as count,
                AVG(est_timeline_months) as avg_timeline
         FROM entitlements e
         JOIN deals d ON d.id = e.deal_id
         WHERE d.municipality ILIKE $1
         GROUP BY status, risk_level`,
        [`%${municipality}%`]
      );

      return {
        municipality,
        benchmarks: benchmarks.rows,
        alerts: alerts.rows,
        entitlements: entitlements.rows,
      };
    };

    const dataA = await getJurisdictionData(jurisdictionA);
    const dataB = await getJurisdictionData(jurisdictionB);

    const avgTimelineA = this.avgMedianTimeline(dataA.benchmarks);
    const avgTimelineB = this.avgMedianTimeline(dataB.benchmarks);
    const alertCountA = dataA.alerts.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);
    const alertCountB = dataB.alerts.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);

    return {
      comparison: {
        jurisdictionA: {
          name: jurisdictionA,
          avgPermitTimeline: avgTimelineA ? `${avgTimelineA} months` : 'No data',
          activeAlerts: alertCountA,
          benchmarks: dataA.benchmarks,
          regulatoryEnvironment: this.assessRegulatoryEnvironment(dataA.alerts),
          entitlementActivity: dataA.entitlements,
        },
        jurisdictionB: {
          name: jurisdictionB,
          avgPermitTimeline: avgTimelineB ? `${avgTimelineB} months` : 'No data',
          activeAlerts: alertCountB,
          benchmarks: dataB.benchmarks,
          regulatoryEnvironment: this.assessRegulatoryEnvironment(dataB.alerts),
          entitlementActivity: dataB.entitlements,
        },
        deltas: {
          timelineDelta: avgTimelineA && avgTimelineB
            ? `${Math.abs(avgTimelineA - avgTimelineB).toFixed(1)} months ${avgTimelineA < avgTimelineB ? 'faster' : 'slower'} in ${avgTimelineA < avgTimelineB ? jurisdictionA : jurisdictionB}`
            : 'Insufficient data',
          alertDelta: `${jurisdictionA}: ${alertCountA} alerts vs ${jurisdictionB}: ${alertCountB} alerts`,
        },
        advantages: {
          fasterPermitting: avgTimelineA && avgTimelineB
            ? (avgTimelineA <= avgTimelineB ? jurisdictionA : jurisdictionB)
            : 'Unknown',
          fewerRegulatoryRisks: alertCountA <= alertCountB ? jurisdictionA : jurisdictionB,
        },
      },
    };
  }

  private formatDistrictData(row: any) {
    return {
      code: row.zoning_code || row.district_code,
      name: row.district_name,
      municipality: row.municipality,
      state: row.state,
      maxDensity: row.max_density_units_per_acre,
      maxHeight: row.max_height_ft,
      maxFAR: row.max_far,
      maxLotCoverage: row.max_lot_coverage_percent || row.max_lot_coverage,
      minLotSize: row.min_lot_size_sf,
      setbacks: {
        front: row.setback_front_ft || row.min_front_setback_ft,
        side: row.setback_side_ft || row.min_side_setback_ft,
        rear: row.setback_rear_ft || row.min_rear_setback_ft,
      },
      parking: row.parking_spaces_per_unit,
      permittedUses: row.permitted_uses,
      conditionalUses: row.conditional_uses,
      prohibitedUses: row.prohibited_uses,
    };
  }

  private calculateDistrictDeltas(a: any, b: any) {
    const delta = (valA: any, valB: any, label: string) => {
      if (valA == null || valB == null) return { label, a: valA, b: valB, delta: 'N/A' };
      const diff = parseFloat(valA) - parseFloat(valB);
      return { label, a: valA, b: valB, delta: diff > 0 ? `+${diff}` : `${diff}` };
    };

    return [
      delta(a.max_density_units_per_acre, b.max_density_units_per_acre, 'Max Density (units/acre)'),
      delta(a.max_height_ft, b.max_height_ft, 'Max Height (ft)'),
      delta(a.max_far, b.max_far, 'Max FAR'),
      delta(a.max_lot_coverage_percent || a.max_lot_coverage, b.max_lot_coverage_percent || b.max_lot_coverage, 'Max Lot Coverage (%)'),
      delta(a.parking_spaces_per_unit, b.parking_spaces_per_unit, 'Parking (spaces/unit)'),
    ];
  }

  private determineAdvantages(a: any, b: any) {
    const advantages: Record<string, string> = {};
    const codeA = a.zoning_code || a.district_code;
    const codeB = b.zoning_code || b.district_code;

    if (a.max_density_units_per_acre && b.max_density_units_per_acre) {
      advantages.density = parseFloat(a.max_density_units_per_acre) >= parseFloat(b.max_density_units_per_acre) ? codeA : codeB;
    }
    if (a.max_height_ft && b.max_height_ft) {
      advantages.height = parseFloat(a.max_height_ft) >= parseFloat(b.max_height_ft) ? codeA : codeB;
    }
    if (a.max_far && b.max_far) {
      advantages.far = parseFloat(a.max_far) >= parseFloat(b.max_far) ? codeA : codeB;
    }

    return advantages;
  }

  private formatParcelData(data: any) {
    return {
      dealName: data.deal_name || 'Unknown',
      address: data.address || '',
      zoningCode: data.zoning_code || 'Unknown',
      landArea: data.metrics?.area || data.land_area || null,
      maxDensity: data.max_density,
      maxFAR: data.max_far,
      maxHeight: data.max_height_feet,
      maxStories: data.max_stories,
      parkingPerUnit: data.min_parking_per_unit,
    };
  }

  private calculateParcelDeltas(a: any, b: any) {
    const fields = [
      { key: 'max_density', label: 'Max Density' },
      { key: 'max_far', label: 'Max FAR' },
      { key: 'max_height_feet', label: 'Max Height (ft)' },
      { key: 'max_stories', label: 'Max Stories' },
    ];

    return fields.map(f => {
      const valA = a[f.key] ? parseFloat(a[f.key]) : null;
      const valB = b[f.key] ? parseFloat(b[f.key]) : null;
      return {
        label: f.label,
        a: valA,
        b: valB,
        delta: valA != null && valB != null ? (valA - valB).toFixed(2) : 'N/A',
      };
    });
  }

  private determineParcelAdvantages(a: any, b: any) {
    const advantages: Record<string, string> = {};
    const nameA = a.deal_name || a.address || 'Parcel A';
    const nameB = b.deal_name || b.address || 'Parcel B';

    if (a.max_density && b.max_density) {
      advantages.density = parseFloat(a.max_density) >= parseFloat(b.max_density) ? nameA : nameB;
    }
    if (a.max_far && b.max_far) {
      advantages.far = parseFloat(a.max_far) >= parseFloat(b.max_far) ? nameA : nameB;
    }
    if (a.max_height_feet && b.max_height_feet) {
      advantages.height = parseFloat(a.max_height_feet) >= parseFloat(b.max_height_feet) ? nameA : nameB;
    }

    return advantages;
  }

  private avgMedianTimeline(benchmarks: any[]): number | null {
    const medians = benchmarks
      .filter(b => b.median_months)
      .map(b => parseFloat(b.median_months));
    if (medians.length === 0) return null;
    return Math.round((medians.reduce((a, b) => a + b, 0) / medians.length) * 10) / 10;
  }

  private assessRegulatoryEnvironment(alerts: any[]): string {
    const criticalCount = alerts.filter(a => a.severity === 'critical').reduce((s: number, a: any) => s + parseInt(a.count), 0);
    const warningCount = alerts.filter(a => a.severity === 'warning').reduce((s: number, a: any) => s + parseInt(a.count), 0);

    if (criticalCount > 0) return 'Challenging — active critical regulatory changes';
    if (warningCount > 2) return 'Moderate concern — multiple regulatory warnings';
    if (warningCount > 0) return 'Generally favorable with some watch items';
    return 'Favorable — minimal regulatory risk';
  }
}
