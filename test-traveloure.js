const puppeteer = require('puppeteer');
const fs = require('fs');

const testResults = [];
let screenshotCounter = 0;

function logIssue(severity, location, description, expected, actual) {
  testResults.push({
    severity,
    location,
    description,
    expected,
    actual,
    timestamp: new Date().toISOString()
  });
  console.log(`\n[${severity}] ${location}`);
  console.log(`Description: ${description}`);
  console.log(`Expected: ${expected}`);
  console.log(`Actual: ${actual}`);
}

async function takeScreenshot(page, name) {
  const filename = `screenshot-${++screenshotCounter}-${name}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${filename}`);
  return filename;
}

async function waitAndLog(page, message) {
  console.log(`\n==> ${message}`);
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Track console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser console error:', msg.text());
    }
  });

  try {
    console.log('\n========================================');
    console.log('TRAVELOURE EXPERT TESTING REPORT');
    console.log('========================================\n');

    // PHASE 1: Homepage and Expert Registration
    console.log('\n### PHASE 1: HOMEPAGE & EXPERT REGISTRATION ###\n');
    
    await page.goto('https://traveloure-platform.replit.app/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await takeScreenshot(page, 'homepage');
    await waitAndLog(page, 'Analyzing homepage...');

    // Check for expert signup/login options
    const expertSignupButton = await page.$('button:has-text("Expert"), a:has-text("Expert"), button:has-text("Become an Expert"), a:has-text("For Experts")');
    const signupLink = await page.$('a[href*="signup"], button:has-text("Sign Up"), a:has-text("Sign Up")');
    const loginLink = await page.$('a[href*="login"], button:has-text("Login"), a:has-text("Login"), button:has-text("Sign In"), a:has-text("Sign In")');

    // Try to find navigation elements
    const navElements = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.map(el => ({
        text: el.textContent.trim(),
        href: el.href || '',
        tag: el.tagName
      })).filter(el => el.text.length > 0 && el.text.length < 50);
    });

    console.log('\nFound navigation elements:');
    navElements.forEach(el => console.log(`  - ${el.tag}: "${el.text}" ${el.href ? '→ ' + el.href : ''}`));

    // Check for expert-specific elements
    const hasExpertOption = navElements.some(el => 
      el.text.toLowerCase().includes('expert') || 
      el.text.toLowerCase().includes('creator') ||
      el.text.toLowerCase().includes('partner')
    );

    if (!hasExpertOption) {
      logIssue(
        'HIGH',
        'Homepage',
        'No clear expert/creator signup path found',
        'Should have prominent "Become an Expert" or "For Experts" call-to-action',
        'No expert-specific navigation found'
      );
    }

    // Try to find and click signup
    const signupSelector = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const signupBtn = buttons.find(el => 
        el.textContent.toLowerCase().includes('sign up') ||
        el.textContent.toLowerCase().includes('signup') ||
        el.textContent.toLowerCase().includes('register') ||
        el.textContent.toLowerCase().includes('join')
      );
      if (signupBtn) {
        signupBtn.click();
        return true;
      }
      return false;
    });

    if (signupSelector) {
      await waitAndLog(page, 'Clicked signup, waiting for form...');
      await takeScreenshot(page, 'signup-page');

      // Check for expert role selection
      const roleOptions = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return {
          hasExpertRole: text.includes('expert') || text.includes('creator') || text.includes('guide'),
          hasTravelerRole: text.includes('traveler') || text.includes('user'),
          hasRoleSelection: text.includes('role') || text.includes('account type')
        };
      });

      console.log('Role selection check:', roleOptions);

      if (!roleOptions.hasRoleSelection && !roleOptions.hasExpertRole) {
        logIssue(
          'CRITICAL',
          'Signup Page',
          'No role selection (Expert vs Traveler)',
          'Should allow users to select Expert/Creator role during signup',
          'No role differentiation found in signup flow'
        );
      }

      // Check signup form fields
      const formFields = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        return inputs.map(input => ({
          type: input.type,
          name: input.name,
          placeholder: input.placeholder,
          id: input.id
        }));
      });

      console.log('\nSignup form fields found:');
      formFields.forEach(field => console.log(`  - ${field.type}: ${field.name || field.id || field.placeholder}`));

      const hasBusinessFields = formFields.some(f => 
        (f.name && f.name.toLowerCase().includes('business')) ||
        (f.placeholder && f.placeholder.toLowerCase().includes('business'))
      );

      if (!hasBusinessFields) {
        logIssue(
          'MEDIUM',
          'Expert Signup Form',
          'No business-specific fields for experts',
          'Expert signup should include business name, type, location fields',
          'Only generic user signup fields present'
        );
      }
    } else {
      logIssue(
        'CRITICAL',
        'Homepage',
        'Cannot find signup button',
        'Should have visible signup/register button',
        'No signup button found on homepage'
      );
    }

    // PHASE 2: Try to access expert dashboard directly
    console.log('\n### PHASE 2: EXPERT DASHBOARD ACCESS ###\n');
    
    const dashboardUrls = [
      '/expert/dashboard',
      '/dashboard',
      '/expert',
      '/creator/dashboard',
      '/partner/dashboard'
    ];

    for (const url of dashboardUrls) {
      try {
        await page.goto(`https://traveloure-platform.replit.app${url}`, { 
          waitUntil: 'networkidle2',
          timeout: 10000 
        });
        console.log(`Trying ${url}...`);
        await page.waitForTimeout(2000);
        
        const currentUrl = page.url();
        const pageText = await page.evaluate(() => document.body.innerText);
        
        console.log(`  Current URL: ${currentUrl}`);
        console.log(`  Page contains: ${pageText.substring(0, 100)}...`);
        
        if (!currentUrl.includes('login') && !currentUrl.includes('signin')) {
          await takeScreenshot(page, `dashboard-${url.replace(/\//g, '-')}`);
          console.log(`  ✓ Dashboard accessible at ${url}`);
          break;
        }
      } catch (e) {
        console.log(`  ✗ ${url} not accessible: ${e.message}`);
      }
    }

    // PHASE 3: Check for Content Studio
    console.log('\n### PHASE 3: CONTENT STUDIO FEATURES ###\n');
    
    const contentUrls = [
      '/content-studio',
      '/expert/content',
      '/content',
      '/posts',
      '/studio'
    ];

    for (const url of contentUrls) {
      try {
        await page.goto(`https://traveloure-platform.replit.app${url}`, { 
          waitUntil: 'networkidle2',
          timeout: 10000 
        });
        console.log(`Checking ${url}...`);
        await page.waitForTimeout(2000);
        
        const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
        
        if (pageText.includes('instagram') || pageText.includes('content') || pageText.includes('post')) {
          await takeScreenshot(page, `content-studio`);
          console.log(`  ✓ Content studio found at ${url}`);
          
          // Check for Instagram integration
          const hasInstagram = pageText.includes('instagram');
          const hasConnectInstagram = pageText.includes('connect instagram') || pageText.includes('link instagram');
          
          if (!hasInstagram) {
            logIssue(
              'HIGH',
              url,
              'No Instagram integration found in Content Studio',
              'Should have Instagram integration for importing and publishing posts',
              'No Instagram-related features visible'
            );
          }
          
          break;
        }
      } catch (e) {
        console.log(`  ✗ ${url}: ${e.message}`);
      }
    }

    // PHASE 4: Service Listings
    console.log('\n### PHASE 4: SERVICE LISTINGS & BUSINESS PROFILE ###\n');
    
    const serviceUrls = [
      '/services',
      '/expert/services',
      '/listings',
      '/my-services'
    ];

    for (const url of serviceUrls) {
      try {
        await page.goto(`https://traveloure-platform.replit.app${url}`, { 
          waitUntil: 'networkidle2',
          timeout: 10000 
        });
        console.log(`Checking ${url}...`);
        await page.waitForTimeout(2000);
        
        await takeScreenshot(page, `services-${url.replace(/\//g, '-')}`);
        break;
      } catch (e) {
        console.log(`  ✗ ${url}: ${e.message}`);
      }
    }

    // PHASE 5: Client Management
    console.log('\n### PHASE 5: CLIENT MANAGEMENT ###\n');
    
    const clientUrls = [
      '/clients',
      '/expert/clients',
      '/messages',
      '/inbox'
    ];

    for (const url of clientUrls) {
      try {
        await page.goto(`https://traveloure-platform.replit.app${url}`, { 
          waitUntil: 'networkidle2',
          timeout: 10000 
        });
        console.log(`Checking ${url}...`);
        await page.waitForTimeout(2000);
        
        await takeScreenshot(page, `clients-${url.replace(/\//g, '-')}`);
        break;
      } catch (e) {
        console.log(`  ✗ ${url}: ${e.message}`);
      }
    }

    // Final Summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================\n');
    console.log(`Total issues found: ${testResults.length}`);
    console.log(`Critical: ${testResults.filter(t => t.severity === 'CRITICAL').length}`);
    console.log(`High: ${testResults.filter(t => t.severity === 'HIGH').length}`);
    console.log(`Medium: ${testResults.filter(t => t.severity === 'MEDIUM').length}`);
    console.log(`Low: ${testResults.filter(t => t.severity === 'LOW').length}`);

    // Save results
    fs.writeFileSync('test-results.json', JSON.stringify(testResults, null, 2));
    console.log('\nDetailed results saved to: test-results.json');

  } catch (error) {
    console.error('Fatal error during testing:', error);
    await takeScreenshot(page, 'error');
  } finally {
    await browser.close();
  }
})();
