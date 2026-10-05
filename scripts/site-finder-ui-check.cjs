/* Read-only live UI verification. Uses the existing development sign-in, never an auth bypass. */
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.SITE_FINDER_TEST_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
if (!base) throw new Error('Set SITE_FINDER_TEST_URL to the running development app.');
async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.SITE_FINDER_CHROMIUM_PATH || undefined,
    headless: true, args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);
  console.log('Browser ready.');
  const failures=[];
  page.on('pageerror',e=>failures.push(e.message));
  const mutations=[];
  page.on('request',r=>{ if(r.method()!=='GET' && /\/deals|\/assumptions|\/preferences/.test(r.url())) mutations.push(r.url()); });
  try {
    const login=await context.request.get(`${base}/api/v1/auth/dev-login`);
    assert.equal(login.status(),200,'Existing development sign-in is available');
    const session=await login.json();
    await context.addInitScript(session=>{
      localStorage.setItem('auth_token',session.token);
      localStorage.setItem('jedi_user',JSON.stringify(session.user));
    },session);
    await page.goto(`${base}/site-finder`,{waitUntil:'domcontentloaded'});
    console.log('Site Finder loaded.');
    await expect(page.getByRole('heading',{name:'Site Finder',exact:true}).first()).toBeVisible({timeout:30000});
    await expect(page.locator('select').first().locator('option')).not.toHaveCount(1,{timeout:15000});
    await page.getByRole('textbox',{name:'Describe your parcel search'}).fill('Find industrial sites between 5 and 10 acres in Palm Beach County');
    await page.getByRole('button',{name:/INTERPRET/}).click();
    await expect(page.getByText('Current classification: category:Industrial',{exact:false})).toBeVisible({timeout:15000});
    await page.getByRole('button',{name:'APPLY TO STRUCTURED FILTERS · CLEAR TEXT'}).click();
    await page.locator('select').last().selectOption('25');
    await page.getByRole('button',{name:/RUN PARCEL SCREEN/}).click();
    await page.waitForURL(/run=/,{timeout:15000});
    await expect(page.locator('tr.parcel-row').first()).toBeVisible({timeout:90000});
    await page.locator('tr.parcel-row').first().click();
    await expect(page.getByText('PARCEL REVIEW · NO DEAL CREATED',{exact:true})).toBeVisible();
    await expect(page.locator('.sf-review-body')).toContainText('No intended use requested');
    await expect(page.locator('.sf-review-actions a')).toHaveAttribute('href',/arcgis/);
    const runUrl=page.url();
    await page.getByRole('button',{name:'Close parcel review'}).click();
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.locator('tr.parcel-row').first()).toBeVisible({timeout:30000});
    assert.equal(page.url(),runUrl,'Refresh restored the server run');
    // A second, structured area-only run, without an intended use or selected deal.
    await page.locator('select').first().selectOption('');
    await page.locator('input[type=number]').nth(0).fill('5');
    await page.locator('input[type=number]').nth(1).fill('10');
    await page.getByRole('button',{name:/RUN PARCEL SCREEN/}).click();
    await page.waitForURL(url=>url.href!==runUrl && url.searchParams.has('run'),{timeout:15000});
    await expect(page.locator('tr.parcel-row').first()).toBeVisible({timeout:90000});
    await page.locator('tr.parcel-row').first().click();
    await expect(page.locator('.sf-review-body')).toContainText('No intended use requested');
    await page.screenshot({path:'screenshots/site-finder-signed-in.jpg',fullPage:true});
    assert.deepEqual(mutations,[],'Site Finder did not write deals, assumptions or preferences');
    assert.deepEqual(failures,[],'No browser exceptions');
    console.log('PASS: text-only and structured screens, inline review, refresh recovery, no deal/preference writes.');
  } finally { await context.close();await browser.close(); }
}
main().catch(e=>{console.error(e.message);process.exit(1)});