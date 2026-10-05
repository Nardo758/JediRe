import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
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
    get.mockResolvedValue({ data: { data: [] } });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
  });
  afterEach(() => vi.restoreAllMocks());
  it('renders in the real route setup without an AuthProvider and submits without any deal/filter/apply step', async () => {
    post.mockResolvedValue({ data: { data: { id, text: exact, status: 'queued' } } });
    mount();
    expect(screen.getByRole('textbox', { name: 'Describe your parcel search' })).toBeVisible();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe your parcel search' }), { target: { value: exact } });
    fireEvent.click(screen.getByRole('button', { name: 'FIND SITES', exact: true }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/v1/site-finder/instructions', { id: expect.any(String), text: exact });
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
    fireEvent.change(answer, { target: { value: 'Assisted living' } });
    fireEvent.click(screen.getByRole('button', { name: 'SEND CLARIFICATION', exact: true }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1]).toMatchObject({ text: 'Assisted living', clarificationOf: id });
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