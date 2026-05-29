/**
 * Backfill 5 — Deal Property Links
 * Phase 2: Property Plumbing Refactor
 *
 * Ensures every deal has deals.property_id populated.
 * Resolution order:
 *   1. deals.property_id already set → skip
 *   2. deal_properties join table has a row → use it (dual-write to deals.property_id)
 *   3. properties.deal_id reverse link → use it
 *   4. Conflict: deal_properties and properties.deal_id disagree → log for operator review
 *   5. No link found → log as unresolvable
 *
 * Acceptance: DealPropertyLinkService.getUnlinkedDeals() returns empty.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/backfill-deal-property-links.ts
 * Flags:
 *   --dry-run     Print resolution without writing
 *   --verbose     Log every deal's resolution path
 */

import '../src/utils/env-loader';
import { query } from '../src/database/connection';
import { dealPropertyLinkService } from '../src/services/property-entity/deal-property-link.service';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

interface DealRow {
  id: string;
  name: string;
  property_id: string | null;
  dp_property_id: string | null;
  prop_deal_id: string | null;
  prop_property_id: string | null;
}

async function main() {
  console.log(`[Backfill5] Starting — dry_run=${DRY_RUN} verbose=${VERBOSE}`);

  // Load all deals with their various property pointers
  const dealsRes = await query<DealRow>(
    `SELECT
       d.id,
       d.name,
       d.property_id,
       dp.property_id        AS dp_property_id,
       p_rev.id              AS prop_deal_id,
       p_rev.id              AS prop_property_id
     FROM deals d
     LEFT JOIN deal_properties dp ON dp.deal_id = d.id
     LEFT JOIN properties p_rev ON p_rev.deal_id = d.id
     ORDER BY d.created_at`
  );

  const deals = dealsRes.rows;
  console.log(`[Backfill5] ${deals.length} total deals`);

  let alreadyLinked = 0;
  let linkedFromDp = 0;
  let linkedFromPropDealId = 0;
  let conflicts: string[] = [];
  let unresolvable: string[] = [];

  for (const deal of deals) {
    // 1. Already has property_id
    if (deal.property_id) {
      if (VERBOSE) console.log(`  deal=${deal.id} name="${deal.name}": already linked property_id=${deal.property_id}`);
      alreadyLinked++;
      continue;
    }

    const dpId = deal.dp_property_id;
    const propId = deal.prop_property_id;

    // 4. Conflict check
    if (dpId && propId && dpId !== propId) {
      console.warn(
        `  CONFLICT deal=${deal.id}: deal_properties.property_id=${dpId} vs properties.id=${propId} (via deal_id)`
      );
      conflicts.push(deal.id);
      continue;
    }

    // Resolve the winner
    const resolvedPropertyId = dpId ?? propId ?? null;

    if (!resolvedPropertyId) {
      console.warn(`  UNRESOLVABLE deal=${deal.id} name="${deal.name}": no property link found`);
      unresolvable.push(deal.id);
      continue;
    }

    if (VERBOSE) {
      const via = dpId ? 'deal_properties' : 'properties.deal_id';
      console.log(`  deal=${deal.id}: linking property=${resolvedPropertyId} via ${via}`);
    }

    if (!DRY_RUN) {
      try {
        // Write deals.property_id (dual-write: also writes deal_properties if not there)
        await dealPropertyLinkService.linkDealToProperty(deal.id, resolvedPropertyId);

        if (dpId) {
          linkedFromDp++;
        } else {
          linkedFromPropDealId++;
        }
      } catch (err) {
        console.warn(
          `  [Backfill5] link failed deal=${deal.id}: ${err instanceof Error ? err.message : err}`
        );
        unresolvable.push(deal.id);
      }
    } else {
      const via = dpId ? 'deal_properties' : 'properties.deal_id';
      console.log(`  [dry-run] would link deal=${deal.id} → property=${resolvedPropertyId} via ${via}`);
      if (dpId) linkedFromDp++; else linkedFromPropDealId++;
    }
  }

  console.log(`
[Backfill5] Results:
  Already linked:         ${alreadyLinked}
  Linked from deal_properties: ${linkedFromDp}
  Linked from properties.deal_id: ${linkedFromPropDealId}
  Conflicts (operator review needed): ${conflicts.length}
  Unresolvable: ${unresolvable.length}
`);

  if (conflicts.length > 0) {
    console.log('[Backfill5] CONFLICTS requiring operator review:');
    for (const id of conflicts) console.log(`  deal_id=${id}`);
  }

  if (unresolvable.length > 0) {
    console.log('[Backfill5] UNRESOLVABLE deals (no property link found):');
    for (const id of unresolvable) console.log(`  deal_id=${id}`);
  }

  // Final acceptance check
  const unlinked = await dealPropertyLinkService.getUnlinkedDeals();
  console.log(`\n[Backfill5] Acceptance check: DealPropertyLinkService.getUnlinkedDeals() = ${unlinked.length} remaining`);

  if (unlinked.length > 0 && !DRY_RUN) {
    console.log('[Backfill5] Unlinked deals (may need manual linkage):');
    for (const u of unlinked) {
      console.log(`  dealId=${u.dealId} legacyPropertyId=${u.legacyPropertyId ?? 'none'}`);
    }
  }

  const totalLinked = linkedFromDp + linkedFromPropDealId;
  console.log(`\n[Backfill5] Done. Linked=${totalLinked} conflicts=${conflicts.length} unresolvable=${unresolvable.length}`);

  process.exit(conflicts.length > 0 || unresolvable.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[Backfill5] FATAL:', err);
  process.exit(1);
});
