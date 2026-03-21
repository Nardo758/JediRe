/**
 * Channel-specific response formatters
 *
 * Each channel has different capabilities and constraints:
 * - WhatsApp: 4096 char limit, emoji sections, quick reply buttons
 * - iMessage: Rich bubbles, list pickers
 * - SMS: 160 chars, plain text, link to full report
 * - Telegram: Markdown, inline keyboards
 */

import type {
  ChatPlatform,
  ChatResponse,
  CoordinatorResult,
} from '../../types/dealContext';

export function formatForChannel(
  result: CoordinatorResult,
  platform: ChatPlatform | 'web' | 'api'
): ChatResponse {
  switch (platform) {
    case 'whatsapp':
      return formatWhatsApp(result);
    case 'imessage':
      return formatIMessage(result);
    case 'sms':
      return formatSMS(result);
    case 'telegram':
      return formatTelegram(result);
    case 'web':
    case 'api':
    default:
      return formatWeb(result);
  }
}

// ── WhatsApp ─────────────────────────────────────────────────

function formatWhatsApp(result: CoordinatorResult): ChatResponse {
  // Text-only response (no deal data)
  if (!result.address || result.jediScore === 0) {
    return { text: result.fullSummary };
  }

  const lines = [
    `*Analysis: ${result.address}*`,
    ``,
    `*Zoning:* ${result.zoning.summary}`,
    `*Market:* ${result.supply.summary}`,
    `*Financials:* ${result.cashflow.summary}`,
    ``,
    `*JEDI Score: ${result.jediScore}/100*`,
    `*Recommendation: ${result.recommendation}*`,
  ];

  if (result.creditsRemaining !== undefined) {
    lines.push(``);
    lines.push(`_${result.creditsRemaining} credits remaining_`);
  }

  return {
    text: lines.join('\n'),
    quickReplies: result.followUpOptions.map((opt) => opt.label),
  };
}

// ── iMessage (Apple Messages for Business) ───────────────────

function formatIMessage(result: CoordinatorResult): ChatResponse {
  if (!result.address || result.jediScore === 0) {
    return { text: result.fullSummary };
  }

  return {
    text: result.fullSummary,
    richLink: {
      title: `JEDI Score: ${result.jediScore}/100`,
      subtitle: result.recommendation,
      imageUrl: result.mapThumbnailUrl,
      url: result.dealId
        ? `https://app.jedire.com/deals/${result.dealId}`
        : 'https://app.jedire.com',
    },
    listPicker: result.followUpOptions.length > 0
      ? {
          title: 'What would you like to do next?',
          items: result.followUpOptions.map((opt) => ({
            title: opt.label,
            identifier: opt.action,
          })),
        }
      : undefined,
  };
}

// ── SMS ──────────────────────────────────────────────────────

function formatSMS(result: CoordinatorResult): ChatResponse {
  if (!result.address || result.jediScore === 0) {
    // Trim to 160 chars for single SMS segment
    return { text: result.fullSummary.substring(0, 155) + '...' };
  }

  // SMS must be extremely concise
  const shortAddress = result.address.split(',')[0];
  return {
    text: `JEDI ${result.jediScore}/100 - ${result.recommendation}. ${shortAddress}. ${result.cashflow.summary.substring(0, 60)}`,
  };
}

// ── Telegram ─────────────────────────────────────────────────

function formatTelegram(result: CoordinatorResult): ChatResponse {
  if (!result.address || result.jediScore === 0) {
    return { text: result.fullSummary };
  }

  const lines = [
    `**Analysis: ${result.address}**`,
    ``,
    `**Zoning:** ${result.zoning.summary}`,
    `**Market:** ${result.supply.summary}`,
    `**Financials:** ${result.cashflow.summary}`,
    ``,
    `**JEDI Score: ${result.jediScore}/100**`,
    `**Recommendation: ${result.recommendation}**`,
  ];

  if (result.creditsRemaining !== undefined) {
    lines.push(``);
    lines.push(`_${result.creditsRemaining} credits remaining_`);
  }

  return {
    text: lines.join('\n'),
    inlineKeyboard: {
      inline_keyboard: [
        [
          {
            text: 'Full Report',
            callback_data: `report_${result.dealId}`,
          },
          {
            text: 'Change Price',
            callback_data: `reprice_${result.dealId}`,
          },
        ],
        [
          {
            text: 'Compare Deals',
            callback_data: 'compare_all',
          },
          {
            text: 'Open in App',
            url: `https://app.jedire.com/deals/${result.dealId}`,
          },
        ],
      ],
    },
  };
}

// ── Web / API ────────────────────────────────────────────────

function formatWeb(result: CoordinatorResult): ChatResponse {
  // Web/API gets the full result as-is
  return {
    text: result.fullSummary,
    quickReplies: result.followUpOptions.map((opt) => opt.label),
  };
}
