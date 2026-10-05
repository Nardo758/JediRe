/* Live signed-in verification: real metered agent + official parcel services, no mocked routes or auth bypass. */
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = process.env.SITE_FINDER_TEST_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
if (!base) throw new Error('Set SITE_FINDER_TEST_URL to the running development app.');
const exact = 'Find parcels over 3 acres zoned for assisted living in Broward';
async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.SITE_FINDER_CHROMIUM_PATH || undefined,
    headless: true, args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
  const failures = [], mutations = [], submissions = [];
  page.on('pageerror', e => failures.push(e.message));
  page.on('request', r => {
    if (r.method() !== 'GET' && /\/deals|\/assumptions|\/preferences/.test(r.url())) mutations.push(r.url());
    if (r.method() === 'POST' && /\/site-finder\/instructions$/.test(r.url())) submissions.push(r.postDataJSON());
  });
  try {
    const login = await context.request.get(`${base}/api/v1/auth/dev-login`);
    assert.equal(login.status(), 200, 'Existing development sign-in is available');
    const session = await login.json();
    const headers = { Authorization: `Bearer ${session.token}` };
    const api = async (path, method = 'GET', data) => {
      const response = await context.request.fetch(`${base}/api/v1/site-finder${path}`, { method, headers, data });
      assert.ok(response.ok(), `Site Finder ${path} HTTP ${response.status()}`);
      return (await response.json()).data;
    };
    const waitInstruction = async id => {
      let value;
      await expect.poll(async () => {
        value = await api(`/instructions/${id}`);
        return ['queued', 'understanding'].includes(value.status);
      }, { timeout: 100000, intervals: [1000, 2000] }).toBe(false);
      return value;
    };
    const waitRun = async id => {
      let value;
      await expect.poll(async () => {
        value = await api(`/runs/${id}`);
        return ['queued', 'running'].includes(value.status);
      }, { timeout: 210000, intervals: [2000, 3000] }).toBe(false);
      return value;
    };
    const checkBroward = c => {
      assert.deepEqual(c.counties, ['Broward']);
      assert.match(c.intendedUse, /assisted living/i);
      assert.equal(c.propertyType, undefined, 'Proposed use is not an assessor filter');
      assert.equal(c.zoning, undefined, 'No invented district');
      assert.equal(c.area.min * (c.area.unit === 'acres' ? 43560 : 1), 130680);
      assert.equal(c.area.minInclusive, false, 'Strictly greater than 3 acres');
    };
    await context.addInitScript(session => {
      localStorage.setItem('auth_token', session.token);
      localStorage.setItem('jedi_user', JSON.stringify(session.user));
    }, session);
    if (process.env.SITE_FINDER_RECOVERY_ONLY === '1') {
      const saved = (await api('/instructions')).find(i => i.status === 'searching' && i.runId);
      assert.ok(saved, 'Owned search instruction available');
      const otherRun = (await api('/runs')).find(r => r.id !== saved.runId && ['complete', 'partial'].includes(r.status));
      assert.ok(otherRun, 'A different owned run available');
      await page.goto(`${base}/site-finder?instruction=${saved.id}&run=${otherRun.id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.sf-run-id')).toContainText(otherRun.id);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.sf-run-id')).toContainText(otherRun.id);
      assert.equal(new URL(page.url()).searchParams.get('run'), otherRun.id);
      await page.getByRole('button', { name: 'RETRY SOURCES', exact: true }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('run')).not.toBe(otherRun.id);
      const retryUrl = page.url(), retryId = new URL(retryUrl).searchParams.get('run');
      assert.equal(new URL(retryUrl).searchParams.has('instruction'), false);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.sf-run-id')).toContainText(retryId);
      const historyRun = page.locator('.sf-history .sf-history-item').first();
      await historyRun.click();
      assert.equal(new URL(page.url()).searchParams.has('instruction'), false);
      const historyId = new URL(page.url()).searchParams.get('run');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.sf-run-id')).toContainText(historyId);
      await page.getByRole('button', { name: 'NEW SCREEN', exact: true }).click();
      await expect(page.getByText('Awaiting a parcel screen')).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.has('instruction'), false);
      assert.equal(new URL(page.url()).searchParams.has('run'), false);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Awaiting a parcel screen')).toBeVisible();
      assert.deepEqual(mutations, []); assert.deepEqual(failures, []);
      console.log('PASS: signed-in explicit run selection, source retry, history selection, reload and New Screen recovery.');
      return;
    }
    await page.goto(`${base}/site-finder`, { waitUntil: 'domcontentloaded' });
    console.log('Signed-in Site Finder loaded.');
    await expect(page.getByRole('heading', { name: 'Site Finder', exact: true }).first()).toBeVisible();
    assert.equal(await page.locator('select').count(), 0, 'No required filter wizard');
    await page.getByRole('textbox', { name: 'Describe your parcel search' }).fill(exact);
    const submitted = page.waitForResponse(r => r.request().method() === 'POST' && /\/site-finder\/instructions$/.test(r.url()));
    await page.getByRole('button', { name: 'FIND SITES', exact: true }).click();
    assert.equal((await submitted).status(), 202, 'Instruction accepted');
    await page.waitForURL(/instruction=/);
    assert.equal(submissions.length, 1, 'One submit calls the instruction endpoint');
    const instruction = await waitInstruction(submissions[0].id);
    console.log('Exact instruction agent finished:', instruction.status);
    assert.equal(instruction.status, 'searching', instruction.message);
    checkBroward(instruction.criteria);
    await page.waitForURL(/run=/, { timeout: 100000 });
    await expect(page.getByText(/VALIDATED SEARCH CRITERIA/)).toBeVisible();
    await expect(page.locator('.sf-progress')).toContainText('BROWARD');
    const run = await waitRun(instruction.runId);
    console.log('Official parcel search finished:', run.status, run.results.length);
    assert.ok(run.results.length > 0, 'Live official parcel service returns parcels');
    assert.ok(run.results.every(p => p.county === 'Broward' && p.areaSqft > 130680));
    assert.ok(run.results.every(p => !['by-right', 'conditional'].includes(p.review.status) || p.review.evidence.length > 0), 'Permission needs source evidence');
    if (run.results.some(p => p.review.status === 'unverified')) await page.getByRole('button', { name: /Unverified leads/i }).click();
    await expect(page.locator('tr.parcel-row').first()).toBeVisible({ timeout: 60000 });
    await page.locator('tr.parcel-row').first().click();
    await expect(page.getByText('PARCEL REVIEW · NO DEAL CREATED', { exact: true })).toBeVisible();
    await expect(page.locator('.sf-review-body')).toContainText('assisted living');
    await expect(page.locator('.sf-review-actions a')).toHaveAttribute('href', /arcgis/);
    await page.getByRole('button', { name: 'Close parcel review' }).click();
    const restored = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.sf-run-id')).toContainText(run.id, { timeout: 30000 });
    assert.equal(page.url(), restored);
    const repeated = await api('/instructions', 'POST', submissions[0]);
    assert.equal(repeated.runId, run.id, 'Same id recovers same search, not another model/search');
    const unsupportedId = randomUUID();
    await api('/instructions', 'POST', { id: unsupportedId, text: 'Find parcels over 3 acres in Orange County under $1 million' });
    const unsupported = await waitInstruction(unsupportedId);
    assert.equal(unsupported.status, 'clarification'); assert.equal(unsupported.runId, undefined);
    const variantId = randomUUID();
    await api('/instructions', 'POST', { id: variantId, text: 'In Broward County, locate parcels larger than three acres for an assisted living facility.' });
    const variant = await waitInstruction(variantId);
    assert.equal(variant.status, 'searching', variant.message); checkBroward(variant.criteria);
    await page.getByRole('textbox', { name: 'Describe your parcel search' }).fill('Find senior living parcels in Broward over 3 acres');
    const clarifySubmitted = page.waitForResponse(r => r.request().method() === 'POST' && /\/site-finder\/instructions$/.test(r.url()));
    await page.getByRole('button', { name: 'FIND SITES', exact: true }).click();
    assert.equal((await clarifySubmitted).status(), 202);
    await expect.poll(() => submissions.length).toBe(2);
    const ambiguous = await waitInstruction(submissions[1].id);
    assert.equal(ambiguous.status, 'clarification'); assert.equal(ambiguous.runId, undefined);
    await page.getByRole('textbox', { name: 'Clarification response' }).fill('Assisted living');
    const answerSubmitted = page.waitForResponse(r => r.request().method() === 'POST' && /\/site-finder\/instructions$/.test(r.url()));
    await page.getByRole('button', { name: 'SEND CLARIFICATION', exact: true }).click();
    assert.equal((await answerSubmitted).status(), 202);
    await expect.poll(() => submissions.length).toBe(3);
    assert.equal(submissions[2].clarificationOf, ambiguous.id);
    const answer = await waitInstruction(submissions[2].id);
    assert.equal(answer.status, 'searching', answer.message); checkBroward(answer.criteria);
    await page.screenshot({ path: 'screenshots/site-finder-signed-in.jpg', fullPage: true });
    assert.deepEqual(mutations, [], 'No deal, assumption, or preference writes');
    assert.deepEqual(failures, [], 'No browser exceptions');
    console.log(`PASS: real signed-in one-submit agent search; ${run.results.length} Broward parcels >130,680 sqft; inline review, recovery, deduplication, varied phrasing, clarification and unsupported request.`);
  } finally { await context.close(); await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exit(1); });