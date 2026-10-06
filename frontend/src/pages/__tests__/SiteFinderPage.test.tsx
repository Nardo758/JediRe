import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const events: Record<string, unknown>[] = [];
vi.mock('../../services/api.client', () => ({ apiClient: { get, post } }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
import { SiteFinderPage } from '../SiteFinderPage';
const id = '9d9271a5-bbee-422a-a31e-a9c434398412';
const exact = 'Find parcels over 3 acres zoned for assisted living in Broward';
function Location() { const location = useLocation(); return <output data-testid="route">{location.pathname + location.search}</output>; }
const mount = (path = '/site-finder') => render(<MemoryRouter initialEntries={[path]}><SiteFinderPage /><Location /></MemoryRouter>);
describe('Site Finder single text-driven workflow', () => {
  beforeEach(() => {
    localStorage.clear(); localStorage.setItem('jedi_user', JSON.stringify({ id: 'owner' }));
    get.mockReset(); post.mockReset();
    events.length = 0;
    window.umami = { track: vi.fn(callback => { events.push(callback({ url: '/site-finder?run=secret', referrer: '', id: 'owner' })); }) };
    get.mockResolvedValue({ data: { data: [] } });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
  });
  afterEach(() => { delete window.umami; vi.restoreAllMocks(); });
  it('renders in the real route setup without an AuthProvider and submits without any deal/filter/apply step', async () => {
    post.mockResolvedValue({ data: { data: { id, text: exact, status: 'queued' } } });
    mount();
    expect(screen.getByRole('textbox', { name: 'Describe your parcel search' })).toBeVisible();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe your parcel search' }), { target: { value: exact } });
    fireEvent.click(screen.getByRole('button', { name: 'FIND SITES', exact: true }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/v1/site-finder/instructions', { id: expect.any(String), text: exact });
    await waitFor(() => expect(events.map(event => event.name)).toEqual(['site_finder_instruction_accepted']));
    expect(JSON.stringify(events)).not.toContain(exact);
    expect(JSON.stringify(events)).not.toContain(id);
    expect(screen.queryByText(/APPLY TO STRUCTURED/)).not.toBeInTheDocument();
    expect(localStorage.getItem('site-finder:pending-instruction:owner')).toContain(exact);
  });
  it('a polled clarification uses the same textbox and preserves the prior request when answering', async () => {
    post.mockResolvedValue({ data: { data: { id, text: exact, status: 'queued' } } });
    get.mockImplementation(async (path: string) => ({ data: { data: path === `/api/v1/site-finder/instructions/${id}` ?
      { id, text: exact, status: 'clarification', message: 'Which care model?' } : [] } }));
    mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe your parcel search' }), { target: { value: exact } });
    fireEvent.click(screen.getByRole('button', { name: 'FIND SITES', exact: true }));
    const answer = await screen.findByRole('textbox', { name: 'Clarification response' }, { timeout: 4000 });
    expect(answer).toHaveValue('');
    expect(events.filter(event => event.name === 'site_finder_clarification_requested')).toHaveLength(1);
    vi.mocked(crypto.randomUUID).mockReturnValue('5d9271a5-bbee-422a-a31e-a9c434398412');
    post.mockImplementation(async (_path, request) => ({ data: { data: { ...request, status: 'queued' } } }));
    fireEvent.change(answer, { target: { value: 'Assisted living' } });
    fireEvent.click(screen.getByRole('button', { name: 'SEND CLARIFICATION', exact: true }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1]).toMatchObject({ text: 'Assisted living', clarificationOf: id });
    await waitFor(() => expect(events.filter(event => event.name === 'site_finder_clarification_answered')).toHaveLength(1));
  });
  it.each([401, 429, 503])('failure HTTP %s preserves text and offers a same-ID retry even without a created instruction', async status => {
    post.mockRejectedValue({ response: { status } });
    mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe your parcel search' }), { target: { value: exact } });
    fireEvent.click(screen.getByRole('button', { name: 'FIND SITES', exact: true }));
    await screen.findByRole('button', { name: 'RETRY SAME REQUEST' });
    expect(screen.getByRole('textbox', { name: 'Describe your parcel search' })).toHaveValue(exact);
    fireEvent.click(screen.getByRole('button', { name: 'RETRY SAME REQUEST' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1].id).toBe(post.mock.calls[0][1].id);
    await waitFor(() => expect(events.filter(event => event.name === 'site_finder_failure')).toHaveLength(2));
    expect(events.filter(event => event.name === 'site_finder_retry').map(event => event.data)).toEqual([{ kind: 'same_instruction' }]);
  });
  const runSnapshot = (runId: string) => ({
    id: runId, status: 'partial', createdAt: '2026-10-05T00:00:00Z', results: [], sources: [], warnings: [],
    criteria: { counties: ['Broward'], intendedUse: 'assisted living', limit: 50 },
  });
  const setupRunRecovery = () => {
    get.mockImplementation(async (path: string) => ({ data: { data:
      path === '/api/v1/site-finder/runs' ? ['original', 'retried', 'history'].map(runSnapshot) :
      path === '/api/v1/site-finder/instructions' ? [] :
      path.startsWith('/api/v1/site-finder/instructions/') ? { id, text: exact, status: 'searching', runId: 'original' } :
      runSnapshot(path.split('/').pop()!),
    } }));
  };
  it('opening evidence by mouse, keyboard or Review counts openings but not refreshes', async () => {
    const parcel = {
      key: 'secret-key', parcelId: 'secret-parcel', county: 'Broward', address: 'secret-address',
      acres: 4, areaSqft: 174240, sourceUrl: 'https://example.com', areaSourceUrl: 'https://example.com',
      review: { status: 'not-requested', conditions: [], standards: [], evidence: [], limitations: [] },
    };
    get.mockImplementation(async (path: string) => ({ data: { data:
      path === '/api/v1/site-finder/runs/original' ? {
        ...runSnapshot('original'), criteria: { counties: ['Broward'], limit: 50 }, results: [parcel],
      } : [],
    } }));
    post.mockResolvedValue({ data: { data: parcel.review } });
    const view = mount('/site-finder?run=original');
    await screen.findByText('secret-address');
    const row = view.container.querySelector('.parcel-row')!;
    fireEvent.click(row);
    fireEvent.click(row);
    fireEvent.click(screen.getByRole('button', { name: 'REFRESH REVIEW' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Close parcel review' }));
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Close parcel review' }));
    fireEvent.click(screen.getByRole('button', { name: 'REVIEW', exact: true }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(events.filter(event => event.name === 'site_finder_evidence_opened')).toHaveLength(3);
    expect(events.filter(event => event.name === 'site_finder_results')).toHaveLength(0);
    expect(JSON.stringify(events)).not.toContain('secret');
  });
  it('a broken tracker cannot turn an accepted instruction into a search failure', async () => {
    window.umami = { track: () => { throw new Error('tracker failure'); } };
    post.mockResolvedValue({ data: { data: { id, text: exact, status: 'queued' } } });
    mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe your parcel search' }), { target: { value: exact } });
    fireEvent.click(screen.getByRole('button', { name: 'FIND SITES', exact: true }));
    await screen.findByText('QUEUED', { selector: 'strong' });
    expect(screen.queryByRole('button', { name: 'RETRY SAME REQUEST' })).not.toBeInTheDocument();
  });
  it('an explicit retry run wins over an instruction’s original run on reload; New Screen stays cleared', async () => {
    setupRunRecovery();
    localStorage.setItem('site-finder:pending-instruction:owner', JSON.stringify({ id, text: exact }));
    const view = mount(`/site-finder?instruction=${id}&run=retried`);
    await waitFor(() => expect(view.container.querySelector('.sf-run-id')).toHaveTextContent('retried'));
    expect(get.mock.calls.some(([path]) => path === '/api/v1/site-finder/runs/original')).toBe(false);
    expect(screen.getByTestId('route')).toHaveTextContent('run=retried');
    fireEvent.click(screen.getByRole('button', { name: 'NEW SCREEN' }));
    await screen.findByText('Awaiting a parcel screen');
    expect(screen.getByTestId('route')).toHaveTextContent(/^\/site-finder$/);
    expect(localStorage.getItem('site-finder:pending-instruction:owner')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Describe your parcel search' })).toHaveValue('');
  });
  it('source retries and history selection clear stale instruction navigation and survive reload', async () => {
    setupRunRecovery();
    post.mockResolvedValue({ data: { data: runSnapshot('retried') } });
    let view = mount(`/site-finder?instruction=${id}&run=original`);
    await waitFor(() => expect(view.container.querySelector('.sf-run-id')).toHaveTextContent('original'));
    fireEvent.click(screen.getByRole('button', { name: 'RETRY SOURCES' }));
    await waitFor(() => expect(view.container.querySelector('.sf-run-id')).toHaveTextContent('retried'));
    let route = screen.getByTestId('route').textContent!;
    expect(route).toBe('/site-finder?run=retried');
    view.unmount(); view = mount(route);
    await waitFor(() => expect(view.container.querySelector('.sf-run-id')).toHaveTextContent('retried'));
    fireEvent.click(view.container.querySelectorAll('.sf-history .sf-history-item')[2]);
    await waitFor(() => expect(view.container.querySelector('.sf-run-id')).toHaveTextContent('history'));
    route = screen.getByTestId('route').textContent!;
    expect(route).toBe('/site-finder?run=history');
    view.unmount(); view = mount(route);
    await waitFor(() => expect(view.container.querySelector('.sf-run-id')).toHaveTextContent('history'));
  });
  it.each(['polling', 'reload'])('retrying a failed clarification after %s keeps the original county/size context', async mode => {
    const answerId = '5d9271a5-bbee-422a-a31e-a9c434398412';
    const retryId = '6d9271a5-bbee-422a-a31e-a9c434398412';
    const failed = { id: answerId, text: 'Assisted living', clarificationOf: id, status: 'error', message: 'Provider unavailable. Retry.' };
    get.mockImplementation(async (path: string) => ({ data: { data:
      path === `/api/v1/site-finder/instructions/${id}` ?
        { id, text: exact, status: 'clarification', message: 'Which care model?' } :
      path === `/api/v1/site-finder/instructions/${answerId}` ? failed : [],
    } }));
    post.mockImplementation(async (_path, request) => ({ data: { data: { ...request, status: 'queued' } } }));
    vi.mocked(crypto.randomUUID).mockReturnValue(answerId);
    mount(`/site-finder?instruction=${mode === 'polling' ? id : answerId}`);
    if (mode === 'polling') {
      const box = await screen.findByRole('textbox', { name: 'Clarification response' });
      fireEvent.change(box, { target: { value: 'Assisted living' } });
      fireEvent.click(screen.getByRole('button', { name: 'SEND CLARIFICATION', exact: true }));
    }
    const retry = await screen.findByRole('button', { name: 'RETRY AS NEW REQUEST' }, { timeout: 4000 });
    vi.mocked(crypto.randomUUID).mockReturnValue(retryId);
    fireEvent.click(retry);
    await waitFor(() => expect(post.mock.calls.at(-1)?.[1]).toMatchObject({ id: retryId, text: 'Assisted living', clarificationOf: id }));
  });
});