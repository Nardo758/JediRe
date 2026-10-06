import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from '../analytics';
import { failureCategory, SiteFinderMeasurement } from '../siteFinderAnalytics';
import type { SiteInstruction, SiteRun } from '../../../../shared/site-finder';

const capture = () => {
  const events: Record<string, unknown>[] = [];
  window.umami = { track: vi.fn(callback => {
    events.push(callback({ website: 'injected', url: '/site-finder?run=private', referrer: '/?instruction=private', id: 'private' }));
  }) };
  return events;
};
const instruction = (status: SiteInstruction['status'], id = 'private-instruction'): SiteInstruction =>
  ({ id, text: 'private address and instruction', status, runId: 'private-run' });
const run = (status: SiteRun['status']): SiteRun => ({ id: 'private-run', status, results: [] } as unknown as SiteRun);
afterEach(() => { delete window.umami; });

describe('optional Site Finder measurement', () => {
  it('is safe without a tracker, with throwing tracker, and with rejected delivery', async () => {
    expect(() => trackEvent('site_finder_retry')).not.toThrow();
    window.umami = { track: () => { throw new Error('unavailable'); } };
    expect(() => trackEvent('site_finder_retry')).not.toThrow();
    window.umami = { track: () => Promise.reject(new Error('delivery failed')) };
    trackEvent('site_finder_retry');
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('counts accepted, clarification, answer and results once despite repeated snapshots', () => {
    const events = capture();
    const measurement = new SiteFinderMeasurement();
    measurement.startInstruction('private-instruction', false);
    for (let i = 0; i < 3; i++) {
      measurement.instruction(instruction('queued'));
      measurement.instruction(instruction('clarification'));
    }
    measurement.startInstruction('private-answer', true);
    for (let i = 0; i < 3; i++) {
      measurement.instruction(instruction('searching', 'private-answer'));
      measurement.run(run('complete'));
    }
    expect(events.map(event => event.name)).toEqual([
      'site_finder_instruction_accepted', 'site_finder_clarification_requested',
      'site_finder_instruction_accepted', 'site_finder_clarification_answered', 'site_finder_results',
    ]);
    expect(events.at(-1)?.data).toEqual({ outcome: 'complete', result_count: 0 });
    expect(JSON.stringify(events)).not.toContain('private');
    expect(events.every(event => event.url === '/site-finder' && event.referrer === '')).toBe(true);
  });

  it('does not count history/restoration but counts an explicit source retry', () => {
    const events = capture();
    const measurement = new SiteFinderMeasurement();
    measurement.instruction(instruction('clarification'));
    measurement.run(run('partial'));
    expect(events).toHaveLength(0);
    measurement.startRun('private-run');
    measurement.run(run('partial'));
    measurement.run(run('partial'));
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ outcome: 'partial', result_count: 0 });
  });

  it('categorizes terminal failures without copying server messages', () => {
    const events = capture();
    const measurement = new SiteFinderMeasurement();
    measurement.startInstruction('private-instruction', false);
    measurement.instruction({ ...instruction('error'), message: 'private address' });
    measurement.instruction(instruction('error'));
    measurement.startRun('private-run');
    measurement.run(run('error'));
    expect(events.filter(event => event.name === 'site_finder_failure').map(event => event.data)).toEqual([
      { stage: 'instruction', category: 'processing' },
      { stage: 'search', category: 'source_processing' },
    ]);
    expect(JSON.stringify(events)).not.toContain('private');
  });

  it.each([
    [undefined, 'network_or_invalid_response'], [401, 'authentication'], [403, 'authentication'],
    [404, 'unavailable_or_expired'], [429, 'rate_limited'], [503, 'service_unavailable'],
    [500, 'server'], [400, 'request_rejected'],
  ])('maps HTTP %s to a fixed safe category', (status, expected) => {
    expect(failureCategory({ response: { status, data: { error: 'private' } } })).toBe(expected);
  });
});