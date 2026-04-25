/**
 * Shared canonical resolvers for MSA + submarket entity IDs as they appear in
 * URLs (numeric PK, CBSA code, slug, UUID for trade_areas). Extracted here so
 * supply.routes, sentiment.routes, and any future market-scoped REST routes
 * stay in lock-step on what "atlanta-ga" or "midtown" actually means.
 */

export type DbClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export type MsaResolution = {
  id: number;
  name: string;
  primaryCity: string;
  stateCodes: string[];
};

export type SubmarketResolution = {
  source: 'trade_area' | 'submarket';
  id: string | number;
  name: string;
  municipality: string | null;
  state: string | null;
};

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const extractPrimaryCity = (msaName: string): string => {
  const head = msaName.split(',')[0] || msaName;
  return (head.split('-')[0] || head).trim();
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Derive a stable canonical key for a resolved entity. Used by sentiment
 * history (and any future per-entity time-series) so that `12060`,
 * `atlanta-ga`, and the CBSA code all collapse to the same row key.
 *   - MSA       -> `msa:<numeric_id>`
 *   - Submarket -> `submarket:<source>:<id>` (source = 'trade_area' | 'submarket')
 * For unresolved IDs we fall back to a lower-cased copy of the raw input so
 * we never silently invent a key.
 */
export const canonicalMsaKey = (resolved: MsaResolution | null, raw: string): string =>
  resolved ? `msa:${resolved.id}` : `msa:${raw.toLowerCase()}`;

export const canonicalSubmarketKey = (resolved: SubmarketResolution | null, raw: string): string =>
  resolved ? `submarket:${resolved.source}:${String(resolved.id)}` : `submarket:${raw.toLowerCase()}`;

export const resolveMsa = async (
  client: DbClient,
  msaId: string,
): Promise<MsaResolution | null> => {
  if (!msaId) return null;

  if (/^\d+$/.test(msaId)) {
    const r = await client.query(
      `SELECT id, name, state_codes FROM msas WHERE id = $1 LIMIT 1`,
      [parseInt(msaId, 10)],
    );
    if (r.rows.length > 0) {
      const row = r.rows[0];
      const name = String(row.name);
      return {
        id: Number(row.id),
        name,
        primaryCity: extractPrimaryCity(name),
        stateCodes: (row.state_codes as string[]) || [],
      };
    }
  }

  const cbsa = await client.query(
    `SELECT id, name, state_codes FROM msas WHERE cbsa_code = $1 LIMIT 1`,
    [msaId],
  );
  if (cbsa.rows.length > 0) {
    const row = cbsa.rows[0];
    const name = String(row.name);
    return {
      id: Number(row.id),
      name,
      primaryCity: extractPrimaryCity(name),
      stateCodes: (row.state_codes as string[]) || [],
    };
  }

  const all = await client.query(`SELECT id, name, state_codes FROM msas`, []);
  const wanted = msaId.toLowerCase();
  const tail = wanted.split('-').pop() || '';
  for (const row of all.rows) {
    const name = String(row.name);
    const slug = slugify(name);
    const stateCodes = ((row.state_codes as string[]) || []).map(s => s.toLowerCase());
    if (
      slug === wanted ||
      (slug.startsWith(wanted.replace(/-[a-z]{2}$/, '')) && stateCodes.includes(tail))
    ) {
      return {
        id: Number(row.id),
        name,
        primaryCity: extractPrimaryCity(name),
        stateCodes: ((row.state_codes as string[]) || []),
      };
    }
  }

  return null;
};

export const resolveSubmarket = async (
  client: DbClient,
  submarketId: string,
  msaId: number | null,
): Promise<SubmarketResolution | null> => {
  if (!submarketId) return null;

  if (UUID_RE.test(submarketId)) {
    const r = await client.query(
      `SELECT id::text AS id, name, municipality, state FROM trade_areas WHERE id = $1::uuid LIMIT 1`,
      [submarketId],
    );
    if (r.rows.length > 0) {
      const row = r.rows[0];
      return {
        source: 'trade_area',
        id: String(row.id),
        name: String(row.name),
        municipality: row.municipality ? String(row.municipality) : null,
        state: row.state ? String(row.state) : null,
      };
    }
  }

  if (/^\d+$/.test(submarketId)) {
    const r = await client.query(
      `SELECT s.id, s.name, m.name AS msa_name
         FROM submarkets s
         LEFT JOIN msas m ON m.id = s.msa_id
        WHERE s.id = $1 LIMIT 1`,
      [parseInt(submarketId, 10)],
    );
    if (r.rows.length > 0) {
      const row = r.rows[0];
      const msaName = row.msa_name ? String(row.msa_name) : null;
      return {
        source: 'submarket',
        id: Number(row.id),
        name: String(row.name),
        municipality: msaName ? extractPrimaryCity(msaName) : null,
        state: null,
      };
    }
  }

  const wanted = submarketId.toLowerCase();
  const ta = await client.query(`SELECT id::text AS id, name, municipality, state FROM trade_areas`, []);
  for (const row of ta.rows) {
    if (slugify(String(row.name)) === wanted) {
      return {
        source: 'trade_area',
        id: String(row.id),
        name: String(row.name),
        municipality: row.municipality ? String(row.municipality) : null,
        state: row.state ? String(row.state) : null,
      };
    }
  }

  const subSql = msaId !== null
    ? `SELECT id, name FROM submarkets WHERE msa_id = $1`
    : `SELECT id, name FROM submarkets`;
  const subParams: unknown[] = msaId !== null ? [msaId] : [];
  const sm = await client.query(subSql, subParams);
  for (const row of sm.rows) {
    if (slugify(String(row.name)) === wanted) {
      return {
        source: 'submarket',
        id: Number(row.id),
        name: String(row.name),
        municipality: null,
        state: null,
      };
    }
  }

  return null;
};
