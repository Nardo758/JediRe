import type { SiteInstruction, SiteRun } from '../../../shared/site-finder';
import { trackEvent } from './analytics';

export function failureCategory(error: unknown): string {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === undefined) return 'network_or_invalid_response';
  if (status === 401 || status === 403) return 'authentication';
  if (status === 404) return 'unavailable_or_expired';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'service_unavailable';
  if (status >= 500) return 'server';
  return 'request_rejected';
}

/** IDs remain in memory solely for deduplication; none are sent to analytics. */
export class SiteFinderMeasurement {
  private instructions = new Map<string, { answer: boolean; seen: Set<string> }>();
  private runs = new Set<string>();
  private completedRuns = new Set<string>();

  startInstruction(id: string, answer: boolean): void {
    if (!this.instructions.has(id)) this.instructions.set(id, { answer, seen: new Set() });
  }

  instruction(value: SiteInstruction): void {
    const interaction = this.instructions.get(value.id);
    if (!interaction) return; // Restoration/history is not a new submission.
    const once = (key: string, event: string, data?: Record<string, string | boolean>) => {
      if (interaction.seen.has(key)) return;
      interaction.seen.add(key);
      trackEvent(event, data);
    };
    once('accepted', 'site_finder_instruction_accepted', { clarification_answer: interaction.answer });
    if (interaction.answer) once('answered', 'site_finder_clarification_answered');
    if (value.status === 'clarification') once('clarification', 'site_finder_clarification_requested');
    if (value.status === 'error') once('error', 'site_finder_failure', { stage: 'instruction', category: 'processing' });
    if (value.status === 'searching' && value.runId) this.startRun(value.runId);
  }

  startRun(id: string): void {
    if (!this.completedRuns.has(id)) this.runs.add(id);
  }

  run(value: SiteRun): void {
    if (!this.runs.has(value.id) || !['complete', 'partial', 'error'].includes(value.status)) return;
    this.runs.delete(value.id); // Polling or review refreshes cannot count this outcome again.
    this.completedRuns.add(value.id);
    if (value.status === 'error') {
      trackEvent('site_finder_failure', { stage: 'search', category: 'source_processing' });
    } else {
      trackEvent('site_finder_results', { outcome: value.status, result_count: value.results.length });
    }
  }
}