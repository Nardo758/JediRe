/**
 * Deal Versions Service — F9 Pro Forma Tier-2 (Spec §13).
 *
 * Save-driven snapshot writer + reader. Triggered by user save actions only —
 * never on every keystroke. Each version is an immutable record of:
 *
 *   layered_state_snapshot   the full ProvenancedValue map at save time
 *   model_versions           the model semver of every released component
 *   override_divergences     fields where user overrode the platform value,
 *                            with the divergence + justification note
 *
 * The version_number is a per-deal monotonic counter assigned inside a
 * transaction so concurrent saves can't collide.
 */

import type { PoolClient } from 'pg';
import { getPool } from '../../database/connection';
import { snapshotModelVersions } from './model-versions';
import type { ProvenancedValue } from '../../types/provenanced-value';
import { isProvenanced } from '../../types/provenanced-value';

export type SaveTrigger = 'user_save' | 'chat_command' | 'auto_prompt';

export interface OverrideDivergence {
  field: string;
  user_value: unknown;
  platform_value: unknown;
  divergence_pct: number | null;
  justification_note?: string | null;
}

export interface DealVersionRow {
  id: string;
  deal_id: string;
  version_number: number;
  created_at: string;
  created_by: string | null;
  layered_state_snapshot: Record<string, unknown>;
  model_versions: Record<string, string>;
  override_divergences: OverrideDivergence[];
  save_trigger: SaveTrigger;
  note: string | null;
}

export interface SaveVersionInput {
  dealId: string;
  userId?: string | null;
  snapshot: Record<string, unknown>;
  modelVersions?: Record<string, string>;
  divergences?: OverrideDivergence[];
  trigger?: SaveTrigger;
  note?: string | null;
}

const VERSIONS_SELECT = `
  SELECT id, deal_id, version_number,
         created_at, created_by,
         layered_state_snapshot, model_versions, override_divergences,
         save_trigger, note
    FROM deal_versions
`;

export class DealVersionsService {
  /**
   * Persist a new version. version_number is assigned inside the transaction
   * by reading MAX+1 with a row-level lock on the deal so two concurrent
   * saves can't collide on the (deal_id, version_number) unique key.
   */
  async saveVersion(input: SaveVersionInput): Promise<DealVersionRow> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock the deal row so concurrent saves serialize.
      await client.query(`SELECT 1 FROM deals WHERE id = $1 FOR UPDATE`, [input.dealId]);
      const next = await this.nextVersionNumber(client, input.dealId);
      const trigger: SaveTrigger = input.trigger ?? 'user_save';
      const modelVersions = input.modelVersions ?? snapshotModelVersions();
      const divergences = input.divergences ?? this.computeOverrideDivergences(input.snapshot);

      const r = await client.query<DealVersionRow>(
        `INSERT INTO deal_versions
           (deal_id, version_number, created_by,
            layered_state_snapshot, model_versions, override_divergences,
            save_trigger, note)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
         RETURNING id, deal_id, version_number, created_at, created_by,
                   layered_state_snapshot, model_versions, override_divergences,
                   save_trigger, note`,
        [
          input.dealId,
          next,
          input.userId ?? null,
          JSON.stringify(input.snapshot),
          JSON.stringify(modelVersions),
          JSON.stringify(divergences),
          trigger,
          input.note ?? null,
        ]
      );
      await client.query('COMMIT');
      return r.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async listVersions(dealId: string): Promise<DealVersionRow[]> {
    const pool = getPool();
    const r = await pool.query<DealVersionRow>(
      `${VERSIONS_SELECT} WHERE deal_id = $1 ORDER BY version_number DESC`,
      [dealId]
    );
    return r.rows;
  }

  async getVersion(dealId: string, versionNumber: number): Promise<DealVersionRow | null> {
    const pool = getPool();
    const r = await pool.query<DealVersionRow>(
      `${VERSIONS_SELECT} WHERE deal_id = $1 AND version_number = $2`,
      [dealId, versionNumber]
    );
    return r.rows[0] ?? null;
  }

  async getLatestVersion(dealId: string): Promise<DealVersionRow | null> {
    const pool = getPool();
    const r = await pool.query<DealVersionRow>(
      `${VERSIONS_SELECT} WHERE deal_id = $1 ORDER BY version_number DESC LIMIT 1`,
      [dealId]
    );
    return r.rows[0] ?? null;
  }

  /**
   * Walk the snapshot recursively for ProvenancedValues whose source==='user'.
   * The frontend posts `{ assumptions, results }` and `assumptions` contains
   * deeply nested ProvenancedValues, so a top-level-only walk would miss almost
   * every override. Three leaf shapes are recognised at any depth:
   *
   *   1. Flat ProvenancedValue with `source==='user'`. Pre-override platform
   *      value is read from a sourceRefs entry whose note begins with
   *      `platform_value=`.
   *   2. Layered shape `{ user, platform, broker }` where each leaf is a
   *      ProvenancedValue. Divergence is `user.value` vs `platform.value`.
   *   3. Plain object — recurse, joining the path with `.`.
   *
   * Arrays and primitives are skipped. Field paths use dot-notation
   * (e.g. `assumptions.exitCap`, `assumptions.opex.taxes`) so M22 attribution
   * can join them back to model inputs.
   */
  computeOverrideDivergences(snapshot: Record<string, unknown>): OverrideDivergence[] {
    const out: OverrideDivergence[] = [];
    this.walkForDivergences(snapshot, '', out);
    return out;
  }

  private walkForDivergences(
    node: unknown,
    path: string,
    out: OverrideDivergence[],
  ): void {
    if (node === null || node === undefined) return;
    if (typeof node !== 'object') return;
    if (Array.isArray(node)) return;

    // Layered shape — leaf, do not recurse further
    if ('user' in (node as object) || 'platform' in (node as object)) {
      const layered = node as Record<string, ProvenancedValue<unknown> | undefined>;
      const userPv = layered.user;
      const platformPv = layered.platform;
      if (userPv && isProvenanced(userPv) && userPv.value !== null && userPv.value !== undefined) {
        const platformValue = platformPv && isProvenanced(platformPv) ? platformPv.value : null;
        out.push({
          field: path || 'root',
          user_value: userPv.value,
          platform_value: platformValue,
          divergence_pct: divergencePct(userPv.value, platformValue),
          justification_note: userPv.rationale ?? null,
        });
      }
      return;
    }

    // Flat ProvenancedValue — leaf
    if (isProvenanced(node)) {
      if (node.source === 'user' && node.value !== null && node.value !== undefined) {
        const platformValue = extractPlatformValueRef(node);
        out.push({
          field: path || 'root',
          user_value: node.value,
          platform_value: platformValue,
          divergence_pct: divergencePct(node.value, platformValue),
          justification_note: node.rationale ?? null,
        });
      }
      return;
    }

    // Plain object — recurse
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      this.walkForDivergences(child, childPath, out);
    }
  }

  private async nextVersionNumber(client: PoolClient, dealId: string): Promise<number> {
    const r = await client.query<{ max: number | null }>(
      `SELECT MAX(version_number) AS max FROM deal_versions WHERE deal_id = $1`,
      [dealId]
    );
    return (r.rows[0]?.max ?? 0) + 1;
  }
}

function extractPlatformValueRef(pv: ProvenancedValue<unknown>): unknown {
  for (const ref of pv.sourceRefs ?? []) {
    if (ref.note && ref.note.startsWith('platform_value=')) {
      const raw = ref.note.slice('platform_value='.length);
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
  }
  return null;
}

function divergencePct(userValue: unknown, platformValue: unknown): number | null {
  if (typeof userValue !== 'number' || typeof platformValue !== 'number') return null;
  if (platformValue === 0) return null;
  return ((userValue - platformValue) / Math.abs(platformValue)) * 100;
}

export const dealVersionsService = new DealVersionsService();
