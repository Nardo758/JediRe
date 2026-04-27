/**
 * Scheduled Agent Jobs
 * 
 * Runs agents on schedules (daily, weekly) for:
 * - Morning briefings
 * - Portfolio monitoring
 * - Compliance checks
 * - Market intelligence
 * 
 * Uses Inngest for reliable job scheduling.
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { inngest } from '../../lib/inngest';
import { agentOrchestrator } from './agent-orchestrator';
import { getAgentsByTrigger, AGENT_PERSONAS } from './agent-personas';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { openclawNotifier } from '../notifications/openclawNotifier';

// ============================================================================
// DAILY SCHEDULED JOBS
// ============================================================================

/**
 * Daily morning briefing - runs at 7 AM for each user
 */
export const dailyMorningBriefing = inngest.createFunction(
  { id: 'agent-daily-morning-briefing', name: 'Daily Morning Agent Briefing' , triggers: [{ cron: '0 7 * * *' }] }, // 7 AM daily
  async ({ step }) => {
    logger.info('Starting daily morning briefing');

    // Get all active users with agent notifications enabled
    const users = await step.run('get-active-users', async () => {
      const result = await query(
        `SELECT DISTINCT u.id, u.email, u.first_name
         FROM users u
         JOIN user_preferences up ON u.id = up.user_id
         WHERE up.agent_notifications = true
         AND u.is_active = true`
      );
      return result.rows;
    });

    // Get agents that run daily
    const dailyAgents = getAgentsByTrigger('schedule_daily');

    // Process each user
    for (const user of users) {
      await step.run(`briefing-user-${user.id}`, async () => {
        try {
          // Get user's deals
          const deals = await query(
            `SELECT id, name, status FROM deals 
             WHERE user_id = $1 AND status NOT IN ('closed', 'dead')
             LIMIT 20`,
            [user.id]
          );

          // Run daily agents
          for (const agent of dailyAgents) {
            try {
              await agentOrchestrator.dispatchEvent({
                event: 'schedule_daily',
                userId: user.id,
                data: {
                  dealCount: deals.rows.length,
                  deals: deals.rows.map(d => ({ id: d.id, name: d.name, status: d.status })),
                },
              });
            } catch (error) {
              logger.error(`Daily agent ${agent.id} failed for user ${user.id}:`, error);
            }
          }
        } catch (error) {
          logger.error(`Daily briefing failed for user ${user.id}:`, error);
        }
      });
    }

    return { usersProcessed: users.length };
  }
);

/**
 * Daily compliance check - runs at 8 AM
 */
export const dailyComplianceCheck = inngest.createFunction(
  { id: 'agent-daily-compliance-check', name: 'Daily Compliance Check' , triggers: [{ cron: '0 8 * * *' }] }, // 8 AM daily
  async ({ step }) => {
    logger.info('Starting daily compliance check');

    // Get all active deals
    const deals = await step.run('get-active-deals', async () => {
      const result = await query(
        `SELECT d.id, d.user_id, d.name, d.status
         FROM deals d
         WHERE d.status NOT IN ('closed', 'dead')`
      );
      return result.rows;
    });

    let alertsGenerated = 0;

    for (const deal of deals) {
      await step.run(`compliance-check-${deal.id}`, async () => {
        try {
          // Check for expiring insurance
          const insuranceCheck = await query(
            `SELECT * FROM deal_insurance 
             WHERE deal_id = $1 
             AND expires_at < NOW() + INTERVAL '60 days'
             AND expires_at > NOW()`,
            [deal.id]
          );

          if (insuranceCheck.rows.length > 0) {
            await agentOrchestrator.dispatchEvent({
              event: 'threshold_breach',
              dealId: deal.id,
              userId: deal.user_id,
              data: {
                type: 'insurance_expiry',
                metric: 'insurance',
                days: 60,
                items: insuranceCheck.rows,
              },
            });
            // Out-of-band alert via OpenClaw — operators want to know about
            // expiring insurance even when not logged into the JediRe UI.
            if (openclawNotifier.isEnabled()) {
              openclawNotifier.notifyThresholdBreach({
                dealId: deal.id,
                metric: 'insurance',
                description: `${insuranceCheck.rows.length} policy/policies expiring in <60 days`,
                severity: 'warn',
              });
            }
            alertsGenerated++;
          }

          // Check for upcoming permit renewals
          const permitCheck = await query(
            `SELECT * FROM deal_permits
             WHERE deal_id = $1
             AND expires_at < NOW() + INTERVAL '90 days'
             AND expires_at > NOW()`,
            [deal.id]
          );

          if (permitCheck.rows.length > 0) {
            await agentOrchestrator.dispatchEvent({
              event: 'threshold_breach',
              dealId: deal.id,
              userId: deal.user_id,
              data: {
                type: 'permit_expiry',
                metric: 'permits',
                days: 90,
                items: permitCheck.rows,
              },
            });
            if (openclawNotifier.isEnabled()) {
              openclawNotifier.notifyThresholdBreach({
                dealId: deal.id,
                metric: 'permits',
                description: `${permitCheck.rows.length} permit(s) expiring in <90 days`,
                severity: 'warn',
              });
            }
            alertsGenerated++;
          }
        } catch (error) {
          logger.error(`Compliance check failed for deal ${deal.id}:`, error);
        }
      });
    }

    return { dealsChecked: deals.length, alertsGenerated };
  }
);

// ============================================================================
// WEEKLY SCHEDULED JOBS
// ============================================================================

/**
 * Weekly portfolio review - runs Monday at 9 AM
 */
export const weeklyPortfolioReview = inngest.createFunction(
  { id: 'agent-weekly-portfolio-review', name: 'Weekly Portfolio Review' , triggers: [{ cron: '0 9 * * 1' }] }, // 9 AM every Monday
  async ({ step }) => {
    logger.info('Starting weekly portfolio review');

    const users = await step.run('get-users', async () => {
      const result = await query(
        `SELECT DISTINCT u.id FROM users u
         JOIN deals d ON d.user_id = u.id
         WHERE u.is_active = true`
      );
      return result.rows;
    });

    const weeklyAgents = getAgentsByTrigger('schedule_weekly');

    for (const user of users) {
      await step.run(`weekly-review-${user.id}`, async () => {
        try {
          // Get portfolio summary
          const portfolio = await query(
            `SELECT 
               COUNT(*) as deal_count,
               COUNT(CASE WHEN status = 'underwriting' THEN 1 END) as underwriting,
               COUNT(CASE WHEN status = 'due_diligence' THEN 1 END) as due_diligence,
               COUNT(CASE WHEN status = 'closing' THEN 1 END) as closing
             FROM deals WHERE user_id = $1 AND status NOT IN ('closed', 'dead')`,
            [user.id]
          );

          for (const agent of weeklyAgents) {
            try {
              await agentOrchestrator.dispatchEvent({
                event: 'schedule_weekly',
                userId: user.id,
                data: {
                  portfolio: portfolio.rows[0],
                  week: new Date().toISOString().slice(0, 10),
                },
              });
            } catch (error) {
              logger.error(`Weekly agent ${agent.id} failed:`, error);
            }
          }
        } catch (error) {
          logger.error(`Weekly review failed for user ${user.id}:`, error);
        }
      });
    }

    return { usersProcessed: users.length };
  }
);

/**
 * Weekly market intelligence - runs Monday at 6 AM
 */
export const weeklyMarketIntelligence = inngest.createFunction(
  { id: 'agent-weekly-market-intelligence', name: 'Weekly Market Intelligence' , triggers: [{ cron: '0 6 * * 1' }] }, // 6 AM every Monday
  async ({ step }) => {
    logger.info('Starting weekly market intelligence');

    // Get all MSAs with active deals
    const msas = await step.run('get-active-msas', async () => {
      const result = await query(
        `SELECT DISTINCT p.msa_id, m.name as msa_name
         FROM deals d
         JOIN properties p ON d.property_id = p.id
         JOIN msas m ON p.msa_id = m.id
         WHERE d.status NOT IN ('closed', 'dead')`
      );
      return result.rows;
    });

    for (const msa of msas) {
      await step.run(`market-intel-${msa.msa_id}`, async () => {
        try {
          await agentOrchestrator.dispatchEvent({
            event: 'market_data_changed',
            data: {
              type: 'weekly_update',
              msaId: msa.msa_id,
              msaName: msa.msa_name,
            },
          });
        } catch (error) {
          logger.error(`Market intel failed for MSA ${msa.msa_id}:`, error);
        }
      });
    }

    return { msasProcessed: msas.length };
  }
);

// ============================================================================
// THRESHOLD MONITORING JOB
// ============================================================================

/**
 * Hourly threshold check - monitors KPIs and triggers alerts
 */
export const hourlyThresholdMonitor = inngest.createFunction(
  { id: 'agent-hourly-threshold-monitor', name: 'Hourly Threshold Monitor' , triggers: [{ cron: '0 * * * *' }] }, // Every hour
  async ({ step }) => {
    logger.info('Starting hourly threshold monitor');

    // Check occupancy thresholds
    const occupancyAlerts = await step.run('check-occupancy', async () => {
      const result = await query(
        `SELECT d.id, d.user_id, d.name, dma.occupancy_rate
         FROM deals d
         JOIN deal_monthly_actuals dma ON d.id = dma.deal_id
         WHERE dma.report_month = (
           SELECT MAX(report_month) FROM deal_monthly_actuals WHERE deal_id = d.id
         )
         AND dma.occupancy_rate < 0.90
         AND d.status NOT IN ('closed', 'dead')`
      );
      return result.rows;
    });

    for (const alert of occupancyAlerts) {
      await step.run(`occupancy-alert-${alert.id}`, async () => {
        await agentOrchestrator.dispatchEvent({
          event: 'threshold_breach',
          dealId: alert.id,
          userId: alert.user_id,
          data: {
            metric: 'occupancy',
            threshold: 90,
            actualValue: alert.occupancy_rate * 100,
            direction: 'below',
          },
        });
        if (openclawNotifier.isEnabled()) {
          openclawNotifier.notifyThresholdBreach({
            dealId: alert.id,
            metric: 'occupancy',
            description: `Occupancy ${(alert.occupancy_rate * 100).toFixed(1)}% below 90% floor`,
            severity: 'critical',
          });
        }
      });
    }

    return { occupancyAlerts: occupancyAlerts.length };
  }
);

// ============================================================================
// EXPORT ALL FUNCTIONS
// ============================================================================

export const scheduledAgentFunctions = [
  dailyMorningBriefing,
  dailyComplianceCheck,
  weeklyPortfolioReview,
  weeklyMarketIntelligence,
  hourlyThresholdMonitor,
];
