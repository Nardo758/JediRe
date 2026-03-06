/**
 * M28 Cycle Classification Engine
 * Classifies market cycle phase based on 8 weighted lagging metrics
 * Run monthly via cron: 0 10 1 * * (1st of each month at 10am)
 */

import { getPool } from '../database/connection';

const pool = getPool();

type CyclePhase = 'recovery' | 'expansion' | 'hypersupply' | 'recession';

interface MetricSignal {
  metric: string;
  value: number;
  weight: number;
  signal: 'expansion' | 'contraction' | 'neutral';
  contribution: number; // -1 to +1
}

interface ClassificationResult {
  phase: CyclePhase;
  position: number; // 0-1 within phase
  confidence: number; // 0-1
  breakdown: MetricSignal[];
}

/**
 * 8-metric classification algorithm
 * 
 * Metrics (in order of weight):
 * 1. Rent growth YoY (25%)
 * 2. Vacancy rate trend (20%)
 * 3. Cap rate trend (15%)
 * 4. Transaction velocity (15%)
 * 5. Price per unit growth (10%)
 * 6. Days on market (5%)
 * 7. Absorption vs deliveries (5%)
 * 8. Concessions (5%)
 */
function classifyPhase(metrics: {
  rent_growth?: number;
  vacancy?: number;
  vacancy_prior?: number;
  cap_rate?: number;
  cap_rate_prior?: number;
  txn_velocity?: number;
  ppu_growth?: number;
  dom?: number;
  absorption?: number;
  deliveries?: number;
  concessions?: number;
}): ClassificationResult {
  const signals: MetricSignal[] = [];

  // 1. Rent Growth (25% weight)
  if (metrics.rent_growth !== undefined) {
    let signal: 'expansion' | 'contraction' | 'neutral' = 'neutral';
    let contribution = 0;

    if (metrics.rent_growth > 5) {
      signal = 'expansion';
      contribution = 0.25; // Strong expansion
    } else if (metrics.rent_growth > 2) {
      signal = 'expansion';
      contribution = 0.15; // Moderate expansion
    } else if (metrics.rent_growth < 0) {
      signal = 'contraction';
      contribution = -0.25; // Strong contraction
    } else if (metrics.rent_growth < 1) {
      signal = 'contraction';
      contribution = -0.10; // Weak/stagnant
    }

    signals.push({
      metric: 'Rent Growth YoY',
      value: metrics.rent_growth,
      weight: 0.25,
      signal,
      contribution,
    });
  }

  // 2. Vacancy Trend (20% weight)
  if (metrics.vacancy !== undefined && metrics.vacancy_prior !== undefined) {
    const vacancyChange = metrics.vacancy - metrics.vacancy_prior;
    let signal: 'expansion' | 'contraction' | 'neutral' = 'neutral';
    let contribution = 0;

    if (vacancyChange < -1.0) {
      signal = 'expansion';
      contribution = 0.20; // Vacancy falling = expansion
    } else if (vacancyChange < -0.3) {
      signal = 'expansion';
      contribution = 0.10;
    } else if (vacancyChange > 1.0) {
      signal = 'contraction';
      contribution = -0.20; // Vacancy rising = contraction
    } else if (vacancyChange > 0.3) {
      signal = 'contraction';
      contribution = -0.10;
    }

    signals.push({
      metric: 'Vacancy Trend',
      value: vacancyChange,
      weight: 0.20,
      signal,
      contribution,
    });
  }

  // 3. Cap Rate Trend (15% weight)
  if (metrics.cap_rate !== undefined && metrics.cap_rate_prior !== undefined) {
    const capChange = metrics.cap_rate - metrics.cap_rate_prior;
    let signal: 'expansion' | 'contraction' | 'neutral' = 'neutral';
    let contribution = 0;

    if (capChange < -0.25) {
      signal = 'expansion';
      contribution = 0.15; // Cap compression = expansion
    } else if (capChange < -0.10) {
      signal = 'expansion';
      contribution = 0.08;
    } else if (capChange > 0.25) {
      signal = 'contraction';
      contribution = -0.15; // Cap expansion = contraction
    } else if (capChange > 0.10) {
      signal = 'contraction';
      contribution = -0.08;
    }

    signals.push({
      metric: 'Cap Rate Trend',
      value: capChange,
      weight: 0.15,
      signal,
      contribution,
    });
  }

  // 4. Transaction Velocity (15% weight)
  if (metrics.txn_velocity !== undefined) {
    let signal: 'expansion' | 'contraction' | 'neutral' = 'neutral';
    let contribution = 0;

    if (metrics.txn_velocity > 15) {
      signal = 'expansion';
      contribution = 0.15; // High velocity = expansion
    } else if (metrics.txn_velocity > 10) {
      signal = 'expansion';
      contribution = 0.08;
    } else if (metrics.txn_velocity < 5) {
      signal = 'contraction';
      contribution = -0.15; // Low velocity = contraction
    } else if (metrics.txn_velocity < 8) {
      signal = 'contraction';
      contribution = -0.08;
    }

    signals.push({
      metric: 'Transaction Velocity',
      value: metrics.txn_velocity,
      weight: 0.15,
      signal,
      contribution,
    });
  }

  // 5. Price Per Unit Growth (10% weight)
  if (metrics.ppu_growth !== undefined) {
    let signal: 'expansion' | 'contraction' | 'neutral' = 'neutral';
    let contribution = 0;

    if (metrics.ppu_growth > 10) {
      signal = 'expansion';
      contribution = 0.10;
    } else if (metrics.ppu_growth > 5) {
      signal = 'expansion';
      contribution = 0.05;
    } else if (metrics.ppu_growth < -5) {
      signal = 'contraction';
      contribution = -0.10;
    } else if (metrics.ppu_growth < 0) {
      signal = 'contraction';
      contribution = -0.05;
    }

    signals.push({
      metric: 'PPU Growth',
      value: metrics.ppu_growth,
      weight: 0.10,
      signal,
      contribution,
    });
  }

  // 6-8. Remaining metrics (lower weight)
  // TODO: Add DOM, absorption, concessions signals

  // Calculate total score (-1 to +1)
  const totalScore = signals.reduce((sum, s) => sum + s.contribution, 0);
  const confidence = signals.length / 5; // More signals = higher confidence

  // Map score to phase
  let phase: CyclePhase;
  let position: number;

  if (totalScore > 0.40) {
    phase = 'expansion';
    position = Math.min(totalScore / 0.80, 1.0); // 0.40-0.80+ maps to 0.5-1.0
  } else if (totalScore > 0.10) {
    phase = 'expansion';
    position = (totalScore - 0.10) / 0.30; // 0.10-0.40 maps to 0-0.5
  } else if (totalScore > -0.10) {
    phase = 'recovery';
    position = (totalScore + 0.10) / 0.20; // -0.10 to +0.10 maps to 0-1.0
  } else if (totalScore > -0.40) {
    phase = 'recession';
    position = 1.0 - (Math.abs(totalScore + 0.10) / 0.30); // -0.40 to -0.10 maps to 0-1.0
  } else {
    phase = 'recession';
    position = Math.max(1.0 - (Math.abs(totalScore) / 0.80), 0); // -0.80- to -0.40 maps to 0-0.5
  }

  // Check for hypersupply (special case)
  const hasHighVacancy = (metrics.vacancy || 0) > 8;
  const hasNegativeRentGrowth = (metrics.rent_growth || 0) < 0;
  const hasHighDeliveries = metrics.deliveries && metrics.absorption 
    && metrics.deliveries > metrics.absorption * 1.5;

  if (hasHighVacancy && hasNegativeRentGrowth && hasHighDeliveries) {
    phase = 'hypersupply';
    position = 0.5; // Middle of hypersupply phase
  }

  return {
    phase,
    position: Math.max(0, Math.min(1, position)),
    confidence: Math.max(0, Math.min(1, confidence)),
    breakdown: signals,
  };
}

/**
 * Classify cycle for a market
 */
async function classifyMarketCycle(marketId: string, snapshotDate: string) {
  console.log(`\n📊 Classifying cycle for ${marketId}...`);

  // Get latest 2 quarters of metrics
  const metricsResult = await pool.query(
    `SELECT * FROM m28_market_metrics_history 
     WHERE market_id = $1 
     ORDER BY quarter DESC 
     LIMIT 2`,
    [marketId]
  );

  if (metricsResult.rows.length === 0) {
    console.log(`   ⚠️  No metrics found for ${marketId}. Skipping.`);
    return null;
  }

  const current = metricsResult.rows[0];
  const prior = metricsResult.rows[1];

  // Build metrics object
  const metrics = {
    rent_growth: current.rent_growth,
    vacancy: current.vacancy,
    vacancy_prior: prior?.vacancy,
    cap_rate: current.cap_rate,
    cap_rate_prior: prior?.cap_rate,
    txn_velocity: current.txn_velocity,
    ppu_growth: prior ? ((current.ppu - prior.ppu) / prior.ppu) * 100 : null,
    dom: current.dom,
    absorption: current.absorption,
    deliveries: current.deliveries,
    concessions: current.concessions,
  };

  // Classify lagging phase (from deal data)
  const lagResult = classifyPhase(metrics);

  // TODO: Classify leading phase (from macro indicators)
  // For now, assume leading = lagging
  const leadResult = lagResult;

  // Calculate divergence
  const divergence = 0; // TODO: Calculate actual divergence

  // Insert into database
  await pool.query(
    `INSERT INTO m28_cycle_snapshots (
      market_id, snapshot_date, lag_phase, lag_position,
      lead_phase, lead_position, divergence, confidence, classified_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (market_id, snapshot_date) DO UPDATE SET
      lag_phase = EXCLUDED.lag_phase,
      lag_position = EXCLUDED.lag_position,
      lead_phase = EXCLUDED.lead_phase,
      lead_position = EXCLUDED.lead_position,
      divergence = EXCLUDED.divergence,
      confidence = EXCLUDED.confidence,
      classified_by = EXCLUDED.classified_by,
      created_at = NOW()`,
    [
      marketId,
      snapshotDate,
      lagResult.phase,
      lagResult.position,
      leadResult.phase,
      leadResult.position,
      divergence,
      lagResult.confidence,
      JSON.stringify({ metrics: lagResult.breakdown }),
    ]
  );

  console.log(`   ✅ Classified as: ${lagResult.phase} (${(lagResult.position * 100).toFixed(0)}%)`);
  console.log(`      Confidence: ${(lagResult.confidence * 100).toFixed(0)}%`);

  return lagResult;
}

/**
 * Main function - classify all markets
 */
async function classifyAllMarkets(snapshotDate?: string) {
  const targetDate = snapshotDate || new Date().toISOString().split('T')[0];

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`M28 Cycle Classification - ${targetDate}`);
  console.log(`═══════════════════════════════════════════════════`);

  try {
    // Get all markets with metrics
    const marketsResult = await pool.query(
      `SELECT DISTINCT market_id FROM m28_market_metrics_history`
    );

    const markets = marketsResult.rows.map(r => r.market_id);

    if (markets.length === 0) {
      console.log('\n⚠️  No markets found with metrics. Run aggregate-lagging-metrics first.\n');
      return;
    }

    console.log(`\n🎯 Found ${markets.length} markets to classify\n`);

    let classified = 0;
    for (const marketId of markets) {
      try {
        await classifyMarketCycle(marketId, targetDate);
        classified++;
      } catch (error: any) {
        console.error(`   ❌ Failed to classify ${marketId}:`, error.message);
      }
    }

    console.log(`\n✅ Cycle classification complete!`);
    console.log(`   Classified: ${classified}/${markets.length} markets\n`);

  } catch (error: any) {
    console.error('\n❌ Cycle classification failed:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// CLI Interface
// ═══════════════════════════════════════════════════════════════

async function main() {
  try {
    const snapshotDate = process.argv[2]; // Optional: YYYY-MM-DD
    await classifyAllMarkets(snapshotDate);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { classifyAllMarkets, classifyMarketCycle, classifyPhase };
