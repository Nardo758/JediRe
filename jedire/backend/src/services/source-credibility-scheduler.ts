/**
 * Source Credibility Scheduler
 * Background job for automated corroboration detection
 */

import schedule from 'node-schedule';
import sourceCredibilityService from './source-credibility.service';

let isRunning = false;

/**
 * Detect corroborations between private and public events
 * Runs daily at 2 AM
 */
export async function detectCorroborationsJob() {
  if (isRunning) {
    console.log('[Source Credibility] Job already running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log('[Source Credibility] Starting corroboration detection...');
    
    const matches = await sourceCredibilityService.detectCorroborations();
    
    const duration = Date.now() - startTime;
    console.log(
      `[Source Credibility] ✓ Detected ${matches.length} corroborations in ${duration}ms`
    );

    // Log summary
    if (matches.length > 0) {
      const avgLeadTime = matches.reduce((sum, m) => sum + m.leadTimeDays, 0) / matches.length;
      const avgScore = matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length;
      
      console.log(`[Source Credibility] Avg lead time: ${avgLeadTime.toFixed(1)} days`);
      console.log(`[Source Credibility] Avg match score: ${avgScore.toFixed(3)}`);
    }

    return matches;
  } catch (error) {
    console.error('[Source Credibility] Error detecting corroborations:', error);
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Schedule automated corroboration detection
 * Runs daily at 2:00 AM
 */
export function scheduleCorroborationDetection() {
  // Run at 2:00 AM every day
  const job = schedule.scheduleJob('0 2 * * *', async () => {
    console.log('[Source Credibility] Running scheduled corroboration detection');
    await detectCorroborationsJob();
  });

  console.log('[Source Credibility] Scheduled daily corroboration detection at 2:00 AM');
  return job;
}

/**
 * Start the scheduler
 * Call this from your main server initialization
 */
export function startSourceCredibilityScheduler() {
  scheduleCorroborationDetection();
  console.log('[Source Credibility] Scheduler started');
}

/**
 * Run detection immediately (for testing/manual trigger)
 */
export async function runDetectionNow() {
  console.log('[Source Credibility] Manual detection triggered');
  return await detectCorroborationsJob();
}

export default {
  scheduleCorroborationDetection,
  startSourceCredibilityScheduler,
  detectCorroborationsJob,
  runDetectionNow
};
