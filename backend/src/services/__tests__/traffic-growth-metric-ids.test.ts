import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { Pool } from 'pg';
import {
  LEGACY_METRIC_ALIASES,
  TRAFFIC_METRIC_IDS,
  isTrafficGrowthEstimateEnabled,
  resolveMetricAlias,
} from '../../config/traffic-growth.config';
import { METRICS_CATALOG } from '../metricsCatalog.service';
import { METRIC_ID_TRANSLATE, resolveMetricAlias as resolveAliasFromTranslation, translateMetricId } from '../../utils/metricTranslation';
import { DerivedMetricsService } from '../derivedMetrics.service';

const SRC_ROOT = path.resolve(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__fixtures__' || entry.name === 'node_modules') continue;
      out.push(...sourceFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Files under src/ (tests excluded) whose text contains `needle`, as paths relative to src/. */
function filesContaining(needle: string): string[] {
  return sourceFiles(SRC_ROOT)
    .filter((file) => fs.readFileSync(file, 'utf8').includes(needle))
    .map((file) => path.relative(SRC_ROOT, file).split(path.sep).join('/'))
    .sort();
}

describe('traffic metric IDs', () => {
  it('are distinct', () => {
    const ids = Object.values(TRAFFIC_METRIC_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('are each in the catalog exactly once', () => {
    for (const id of Object.values(TRAFFIC_METRIC_IDS)) {
      expect(METRICS_CATALOG.filter((m) => m.id === id), id).toHaveLength(1);
    }
  });

  it('labels the volume estimate as not validated', () => {
    const entry = METRICS_CATALOG.find((m) => m.id === TRAFFIC_METRIC_IDS.GROWTH_ESTIMATE);
    expect(entry?.empiricallyValidated).toBe(false);
  });
});

describe('legacy alias', () => {
  it('resolves C_TRAFFIC_GROWTH_INDEX to the demand composite', () => {
    expect(LEGACY_METRIC_ALIASES).toEqual({ C_TRAFFIC_GROWTH_INDEX: 'C_DEMAND_GROWTH_COMPOSITE' });
    expect(resolveMetricAlias('C_TRAFFIC_GROWTH_INDEX')).toBe('C_DEMAND_GROWTH_COMPOSITE');
    expect(resolveAliasFromTranslation('C_TRAFFIC_GROWTH_INDEX')).toBe('C_DEMAND_GROWTH_COMPOSITE');
  });

  it('leaves every other ID alone', () => {
    expect(resolveMetricAlias('C_TRAFFIC_GROWTH_INDEX_EST')).toBe('C_TRAFFIC_GROWTH_INDEX_EST');
    expect(resolveMetricAlias('T_AADT_YOY')).toBe('T_AADT_YOY');
  });
});

describe('metricTranslation', () => {
  it('passes the new IDs through instead of swapping them for another series', () => {
    for (const id of [
      TRAFFIC_METRIC_IDS.GROWTH_ESTIMATE,
      TRAFFIC_METRIC_IDS.CONGESTION,
      TRAFFIC_METRIC_IDS.DEMAND_COMPOSITE,
    ]) {
      expect(METRIC_ID_TRANSLATE[id]).toBeUndefined();
      expect(translateMetricId(id)).toBe(id);
    }
  });

  it('does not repoint the legacy ID (presets and the Strategy Builder are unchanged)', () => {
    expect(METRIC_ID_TRANSLATE.C_TRAFFIC_GROWTH_INDEX).toBe('home_value_index_yoy');
  });
});

describe('one writer per metric ID', () => {
  const GROWTH_SERVICE = 'services/traffic-growth-index.service.ts';
  const DERIVED_SERVICE = 'services/derivedMetrics.service.ts';
  const CONFIG = 'config/traffic-growth.config.ts';
  const CATALOG = 'services/metricsCatalog.service.ts';

  const read = (relative: string): string => fs.readFileSync(path.join(SRC_ROOT, relative), 'utf8');

  it('the growth service writes only the estimate and congestion IDs', () => {
    const source = read(GROWTH_SERVICE);
    expect(source).toContain('TRAFFIC_METRIC_IDS.GROWTH_ESTIMATE');
    expect(source).toContain('TRAFFIC_METRIC_IDS.CONGESTION');
    expect(source).not.toContain('LEGACY_GROWTH_INDEX');
    expect(source).not.toContain('DEMAND_COMPOSITE');
    expect(source).not.toContain("'C_TRAFFIC_GROWTH_INDEX'");
  });

  it('derived metrics writes only the composite and its legacy mirror', () => {
    const source = read(DERIVED_SERVICE);
    expect(source).toContain('TRAFFIC_METRIC_IDS.DEMAND_COMPOSITE');
    expect(source).toContain('TRAFFIC_METRIC_IDS.LEGACY_GROWTH_INDEX');
    expect(source).not.toContain('GROWTH_ESTIMATE');
    expect(source).not.toContain('TRAFFIC_METRIC_IDS.CONGESTION');
  });

  it('no other source file references the estimate or congestion constants', () => {
    // The config file holds the ID definitions, the alias map and the API response labels.
    expect(filesContaining('TRAFFIC_METRIC_IDS.GROWTH_ESTIMATE')).toEqual([CONFIG, GROWTH_SERVICE].sort());
    expect(filesContaining('TRAFFIC_METRIC_IDS.CONGESTION')).toEqual([CONFIG, GROWTH_SERVICE].sort());
    expect(filesContaining('TRAFFIC_METRIC_IDS.DEMAND_COMPOSITE')).toEqual([CONFIG, DERIVED_SERVICE].sort());
  });

  it('the new ID strings appear only in the config and the catalog', () => {
    for (const id of ['C_TRAFFIC_GROWTH_INDEX_EST', 'C_TRAFFIC_CONGESTION_INDEX', 'C_DEMAND_GROWTH_COMPOSITE']) {
      const allowed = [CATALOG, CONFIG, 'utils/metricTranslation.ts'];
      const offenders = filesContaining(`'${id}'`).filter((f) => !allowed.includes(f));
      expect(offenders, id).toEqual([]);
    }
  });
});

describe('DerivedMetricsService.computeDemandGrowthComposite', () => {
  it('writes the composite and mirrors the same series to the legacy alias', async () => {
    const inserts: Array<{ metricId: string; geoType: string; geoId: string; values: number[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('INSERT INTO metric_time_series')) {
          const values: number[] = [];
          for (let i = 0; i < params.length; i += 7) values.push(params[i + 2] as number);
          inserts.push({
            metricId: params[0] as string,
            geoType: params[4] as string,
            geoId: params[5] as string,
            values,
          });
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (_sql: string, params: unknown[]) => {
        if (params[0] === 'D_SEARCH_VOL_YOY') {
          return {
            rows: [
              { geography_type: 'msa', geography_id: '12060', date: '2026-01-01', value: '2' },
              { geography_type: 'msa', geography_id: '12060', date: '2026-02-01', value: '6' },
            ],
          };
        }
        if (params[0] === 'T_AADT_YOY') {
          return {
            rows: [
              // Same geography as the search series: ignored, search wins.
              { geography_type: 'msa', geography_id: '12060', date: '2026-01-01', value: '9' },
              { geography_type: 'msa', geography_id: '19100', date: '2025-01-01', value: '1' },
              { geography_type: 'msa', geography_id: '19100', date: '2026-01-01', value: '3' },
            ],
          };
        }
        return { rows: [] };
      }),
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    const total = await new DerivedMetricsService(pool).computeDemandGrowthComposite();

    expect(total).toBe(4);
    expect(inserts).toEqual([
      { metricId: 'C_DEMAND_GROWTH_COMPOSITE', geoType: 'msa', geoId: '12060', values: [0, 100] },
      { metricId: 'C_TRAFFIC_GROWTH_INDEX', geoType: 'msa', geoId: '12060', values: [0, 100] },
      { metricId: 'C_DEMAND_GROWTH_COMPOSITE', geoType: 'msa', geoId: '19100', values: [0, 100] },
      { metricId: 'C_TRAFFIC_GROWTH_INDEX', geoType: 'msa', geoId: '19100', values: [0, 100] },
    ]);
  });
});

describe('feature flag', () => {
  it('is off by default and on only for exactly "true"', () => {
    expect(isTrafficGrowthEstimateEnabled({})).toBe(false);
    expect(isTrafficGrowthEstimateEnabled({ TRAFFIC_GROWTH_INDEX_EST_ENABLED: 'TRUE' })).toBe(false);
    expect(isTrafficGrowthEstimateEnabled({ TRAFFIC_GROWTH_INDEX_EST_ENABLED: 'true' })).toBe(true);
  });
});
