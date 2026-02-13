# 🧪 Comprehensive Testing Guide - 14-Tab System

**Project:** JEDI RE Platform  
**Version:** 1.0 - Phase 3 Complete  
**Last Updated:** February 12, 2026

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Test Scripts](#test-scripts)
3. [Component Testing](#component-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing](#e2e-testing)
6. [Performance Testing](#performance-testing)
7. [Accessibility Testing](#accessibility-testing)
8. [Browser Compatibility](#browser-compatibility)
9. [Continuous Integration](#continuous-integration)

---

## 🚀 Quick Start

### Run All Tests
```bash
cd jedire
./run-tests.sh
```

### Run Specific Test Suites
```bash
# Component tests only
cd frontend
npm run test

# With coverage
npm run test:coverage

# With UI
npm run test:ui

# E2E scenarios
cd ..
./test-e2e-scenarios.sh

# Performance tests
./test-performance.sh

# Accessibility tests
./test-accessibility.sh
```

---

## 📜 Test Scripts

### Available Scripts

| Script | Purpose | Duration |
|--------|---------|----------|
| `run-tests.sh` | Master test runner (all tests) | ~10 min |
| `test-e2e-scenarios.sh` | User flow testing | ~5 min |
| `test-performance.sh` | Performance benchmarks | ~5 min |
| `test-accessibility.sh` | A11y compliance | ~10 min |

### npm Scripts (frontend)

```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage",
  "test:run": "vitest run"
}
```

---

## 🧩 Component Testing

### Test Structure

```
frontend/src/components/deal/sections/
  ├── OverviewSection.tsx
  ├── CompetitionSection.tsx
  ├── FinancialSection.tsx
  └── __tests__/
      ├── OverviewSection.test.tsx
      ├── CompetitionSection.test.tsx
      └── FinancialSection.test.tsx
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import { OverviewSection } from '../OverviewSection';
import { mockDeal } from '../../../test/testUtils';

describe('OverviewSection', () => {
  it('renders without crashing', () => {
    render(<OverviewSection deal={mockDeal} />);
    expect(screen.getByText(/overview/i)).toBeInTheDocument();
  });

  it('displays quick stats', () => {
    render(<OverviewSection deal={mockDeal} />);
    const stats = screen.getAllByRole('article');
    expect(stats.length).toBeGreaterThan(0);
  });
});
```

### Running Component Tests

```bash
cd frontend

# Run all tests
npm run test

# Run specific test file
npm run test -- OverviewSection.test.tsx

# Watch mode
npm run test -- --watch

# Coverage report
npm run test:coverage
```

### Coverage Targets

| Metric | Target | Current |
|--------|--------|---------|
| Statements | > 80% | TBD |
| Branches | > 75% | TBD |
| Functions | > 80% | TBD |
| Lines | > 80% | TBD |

---

## 🔗 Integration Testing

### Tab Integration Tests

Test that tabs work together:

```typescript
describe('Tab Integration', () => {
  it('creates note and shows on map', async () => {
    // 1. Create note in Notes tab
    const note = await createNote('Test note');
    
    // 2. Navigate to Map View
    navigateTo('/deals/1/map');
    
    // 3. Verify pin appears
    expect(screen.getByTestId(`pin-${note.id}`)).toBeInTheDocument();
  });
});
```

### Data Flow Tests

```typescript
describe('Data Flow', () => {
  it('updates propagate across tabs', async () => {
    // Change data in one tab
    updateFinancialData({ budget: 5000000 });
    
    // Verify in Overview tab
    navigateTo('/deals/1/overview');
    expect(screen.getByText('$5.0M')).toBeInTheDocument();
  });
});
```

### WebSocket Tests

```typescript
describe('WebSocket Integration', () => {
  it('connects and receives updates', async () => {
    const socket = connectWebSocket();
    
    await waitFor(() => {
      expect(socket.connected).toBe(true);
    });
    
    // Emit event and verify response
    socket.emit('note:create', noteData);
    
    await waitFor(() => {
      expect(screen.getByText(noteData.content)).toBeInTheDocument();
    });
  });
});
```

---

## 🎭 E2E Testing

### Manual E2E Scenarios

#### Scenario 1: New Deal Creation
1. Navigate to Dashboard
2. Click "Create Deal"
3. Fill in required fields:
   - Name: "Test Property"
   - Address: "123 Main St"
   - City: "Atlanta"
   - Type: "Multifamily"
4. Submit
5. **Verify:** Redirects to Overview tab
6. **Verify:** Quick stats display
7. **Verify:** Mode = "acquisition"

#### Scenario 2: Mode Switching
1. Open any deal
2. Click mode toggle
3. Switch to "Performance"
4. **Verify:** Stats change to performance metrics
5. Switch back to "Acquisition"
6. **Verify:** Stats revert

#### Scenario 3: Cross-Tab Data Flow
1. Go to Notes tab
2. Create new note: "Test note"
3. Navigate to Map View
4. **Verify:** Pin appears on map
5. Navigate to Timeline
6. **Verify:** Note creation logged
7. Navigate to Opus AI
8. **Verify:** Note context in analysis

### Automated E2E (Playwright)

```bash
# Install Playwright
npm install --save-dev @playwright/test

# Run E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific browser
npx playwright test --project=chromium
```

Example E2E test:

```typescript
import { test, expect } from '@playwright/test';

test('complete deal creation flow', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Login
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Create deal
  await page.click('text=Create Deal');
  await page.fill('input[name="name"]', 'Test Property');
  await page.fill('input[name="address"]', '123 Main St');
  await page.click('button:has-text("Submit")');
  
  // Verify Overview tab
  await expect(page.locator('h1')).toContainText('Test Property');
  await expect(page.locator('.quick-stats')).toBeVisible();
});
```

---

## ⚡ Performance Testing

### Metrics to Measure

| Metric | Target | Tool |
|--------|--------|------|
| Page Load | < 3s | Lighthouse |
| Tab Switch | < 200ms | Performance API |
| Map Render | < 1s | Custom timer |
| Search | < 500ms | Custom timer |
| Memory | < 500MB | DevTools |
| Bundle Size | < 2MB | Build output |

### Lighthouse Audit

```bash
# Install Lighthouse
npm install -g lighthouse

# Run audit
lighthouse http://localhost:5173 --view

# Specific categories
lighthouse http://localhost:5173 --only-categories=performance --view

# CI mode (JSON output)
lighthouse http://localhost:5173 --output=json --output-path=./lighthouse-report.json
```

### Performance Monitoring Code

```typescript
// Measure tab switch time
const start = performance.now();
navigateToTab('financial');
const end = performance.now();
console.log(`Tab switch: ${end - start}ms`);

// Measure component render time
import { Profiler } from 'react';

<Profiler id="FinancialTab" onRender={onRenderCallback}>
  <FinancialSection />
</Profiler>
```

### Load Testing

```bash
# Install Artillery
npm install -g artillery

# Create load test config (artillery.yml)
# Run load test
artillery run artillery.yml
```

---

## ♿ Accessibility Testing

### Automated Tools

```bash
# axe-core
npx axe http://localhost:5173

# Pa11y
npx pa11y http://localhost:5173

# Lighthouse A11y audit
lighthouse http://localhost:5173 --only-categories=accessibility --view
```

### Manual Testing Checklist

#### Keyboard Navigation
- [ ] Tab through all elements
- [ ] Enter activates buttons
- [ ] Escape closes modals
- [ ] Arrow keys in lists/dropdowns
- [ ] No keyboard traps

#### Screen Reader
- [ ] Images have alt text
- [ ] Buttons announce correctly
- [ ] Form labels associated
- [ ] Errors announced
- [ ] Tab changes announced

#### Visual
- [ ] Color contrast 4.5:1 (text)
- [ ] Color contrast 3:1 (UI)
- [ ] Focus indicators visible
- [ ] Text resizable 200%
- [ ] Touch targets 44×44px

### WCAG 2.1 AA Compliance

Use this checklist: https://www.w3.org/WAI/WCAG21/quickref/

---

## 🌐 Browser Compatibility

See [BROWSER_COMPATIBILITY.md](./BROWSER_COMPATIBILITY.md) for full details.

### Quick Test

```bash
# Test URL accessibility on all major browsers
# (Manual testing required)

Browsers to test:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- iOS Safari
- Android Chrome
```

---

## 🔄 Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Run tests
        run: |
          cd frontend
          npm run test:run
      
      - name: Build
        run: |
          cd frontend
          npm run build
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📊 Test Reporting

### Generate Reports

```bash
# HTML coverage report
npm run test:coverage
open frontend/coverage/index.html

# JUnit XML (for CI)
npm run test:run -- --reporter=junit --outputFile=./test-results.xml

# JSON report
npm run test:run -- --reporter=json --outputFile=./test-results.json
```

### Test Dashboard

View test results in Vitest UI:

```bash
npm run test:ui
```

Opens browser with interactive test explorer.

---

## 🐛 Debugging Tests

### VSCode Debugging

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Browser DevTools

```bash
# Run tests in browser debug mode
npm run test:ui
```

### Console Logging

```typescript
import { screen, debug } from '@testing-library/react';

// Print DOM tree
debug();

// Print specific element
debug(screen.getByRole('button'));
```

---

## ✅ Pre-Production Checklist

Before deploying to production:

- [ ] All unit tests passing (>95%)
- [ ] Integration tests passing
- [ ] E2E critical flows tested
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Cross-browser tested
- [ ] Mobile tested
- [ ] Load testing completed
- [ ] Security scan completed
- [ ] Documentation updated

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Questions or Issues?**  
Create an issue or contact the development team.
