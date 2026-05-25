import { refreshArchiveBenchmarks, refreshLineItemBenchmarks } from '../services/archive-benchmark-aggregator';

async function main() {
  console.log('=== Seeding archive_assumption_benchmarks ===');
  try {
    const r1 = await refreshArchiveBenchmarks();
    console.log('Result:', JSON.stringify(r1, null, 2));
  } catch (e: unknown) {
    console.error('refreshArchiveBenchmarks failed:', e instanceof Error ? e.message : String(e));
  }

  console.log('\n=== Seeding line_item_benchmarks ===');
  try {
    const r2 = await refreshLineItemBenchmarks();
    console.log('Result:', JSON.stringify(r2, null, 2));
  } catch (e: unknown) {
    console.error('refreshLineItemBenchmarks failed:', e instanceof Error ? e.message : String(e));
  }

  console.log('\nDone.');
  process.exit(0);
}

main();
