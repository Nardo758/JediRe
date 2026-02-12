/**
 * Telegram Alerts System
 * Sends rich alerts with inline approve/reject buttons
 */

import type { Config, TradingAlert, ArbitrageOpportunity, GrokAnalysis, ClaudeAnalysis } from './types.js';

export class TelegramAlerts {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Send trading alert to Telegram with approve/reject buttons
   * NOTE: This uses Clawdbot's message tool, which should be called from monitor.ts
   */
  formatAlert(alert: TradingAlert): string {
    const { opportunity, grokAnalysis, claudeAnalysis } = alert;
    const market = opportunity.market;

    // Format the alert message
    const lines: string[] = [
      '🎯 **ARBITRAGE OPPORTUNITY DETECTED**',
      '',
      `**Market:** ${market.question}`,
      `**Category:** ${market.category}`,
      `**URL:** ${market.url}`,
      '',
      '📊 **Current Prices:**',
      `• YES: ${market.yesPrice.toFixed(2)}%`,
      `• NO: ${market.noPrice.toFixed(2)}%`,
      `• **Spread: ${opportunity.spreadPercent.toFixed(2)}%**`,
      '',
      '💰 **Market Metrics:**',
      `• Volume: $${market.volume.toLocaleString()}`,
      `• Liquidity: $${market.liquidity.toLocaleString()}`,
      `• End Date: ${new Date(market.endDate).toLocaleDateString()}`,
      '',
      '🤖 **Grok Analysis (Real-time X/Twitter):**',
      `• Sentiment: ${this.formatSentiment(grokAnalysis.sentiment)}`,
      `• Confidence: ${grokAnalysis.confidence}%`,
      `• ${grokAnalysis.summary}`,
    ];

    if (grokAnalysis.twitterTrends.length > 0) {
      lines.push(`• Trends: ${grokAnalysis.twitterTrends.join(', ')}`);
    }

    if (grokAnalysis.riskFactors.length > 0) {
      lines.push(`• ⚠️ Risks: ${grokAnalysis.riskFactors.join(', ')}`);
    }

    lines.push(
      '',
      '🧠 **Claude Analysis:**',
      `• **Recommendation: ${this.formatRecommendation(claudeAnalysis.recommendation)}**`,
      `• Risk Score: ${claudeAnalysis.riskScore}/10`,
      `• Position Size: $${claudeAnalysis.positionSize}`,
      `• Valid Arbitrage: ${claudeAnalysis.arbitrageValid ? '✅ Yes' : '❌ No'}`,
      `• ${claudeAnalysis.reasoning}`,
      '',
      '📈 **Exit Strategy:**',
      `${claudeAnalysis.exitStrategy}`,
    );

    if (claudeAnalysis.concerns.length > 0) {
      lines.push(
        '',
        '⚠️ **Concerns:**',
        ...claudeAnalysis.concerns.map(c => `• ${c}`)
      );
    }

    lines.push(
      '',
      '---',
      `Alert ID: \`${alert.id}\``,
      `Generated: ${new Date(alert.createdAt).toLocaleTimeString()}`,
    );

    return lines.join('\n');
  }

  /**
   * Format sentiment with emoji
   */
  private formatSentiment(sentiment: string): string {
    switch (sentiment) {
      case 'BULLISH': return '🟢 Bullish';
      case 'BEARISH': return '🔴 Bearish';
      case 'MIXED': return '🟡 Mixed';
      case 'NEUTRAL': return '⚪ Neutral';
      default: return sentiment;
    }
  }

  /**
   * Format recommendation with emoji
   */
  private formatRecommendation(rec: string): string {
    switch (rec) {
      case 'STRONG_BUY': return '🟢🟢 STRONG BUY';
      case 'BUY': return '🟢 BUY';
      case 'HOLD': return '🟡 HOLD';
      case 'AVOID': return '🔴 AVOID';
      default: return rec;
    }
  }

  /**
   * Create button data for inline keyboard
   * Returns the data format expected by Clawdbot's message tool
   */
  getAlertButtons(alertId: string): any[] {
    return [
      [
        { text: '✅ Approve Trade', callback_data: `approve:${alertId}` },
        { text: '❌ Reject', callback_data: `reject:${alertId}` },
      ],
      [
        { text: 'ℹ️ More Info', callback_data: `info:${alertId}` },
        { text: '📊 View Market', url: 'https://polymarket.com' },
      ],
    ];
  }

  /**
   * Format confirmation message after approval/rejection
   */
  formatResponse(alertId: string, approved: boolean): string {
    if (approved) {
      return `✅ **Trade Approved**\n\nAlert ID: \`${alertId}\`\n\nExecuting trade... You'll receive confirmation shortly.`;
    } else {
      return `❌ **Trade Rejected**\n\nAlert ID: \`${alertId}\`\n\nOpportunity dismissed.`;
    }
  }

  /**
   * Format trade execution confirmation
   */
  formatTradeConfirmation(alertId: string, txHash?: string): string {
    const lines = [
      '✅ **TRADE EXECUTED**',
      '',
      `Alert ID: \`${alertId}\``,
      `Time: ${new Date().toLocaleString()}`,
    ];

    if (txHash) {
      lines.push(
        '',
        `Transaction: \`${txHash}\``,
        `Explorer: https://polygonscan.com/tx/${txHash}`,
      );
    }

    lines.push(
      '',
      'Position is now being monitored. You\'ll receive updates on P&L and exit opportunities.',
    );

    return lines.join('\n');
  }

  /**
   * Format error message
   */
  formatError(alertId: string, error: string): string {
    return `❌ **Trade Execution Failed**\n\nAlert ID: \`${alertId}\`\n\nError: ${error}\n\nPlease review and try again manually if needed.`;
  }

  /**
   * Should send alert based on config filters?
   */
  shouldSendAlert(claudeAnalysis: ClaudeAnalysis): boolean {
    // Filter by minimum risk score
    if (claudeAnalysis.riskScore > 10 - this.config.alerts.minRiskScore) {
      return false;
    }

    // Only send if recommendation is at least HOLD
    if (claudeAnalysis.recommendation === 'AVOID') {
      return false;
    }

    return true;
  }
}
