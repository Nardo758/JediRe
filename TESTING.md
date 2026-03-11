# Testing Guide - Financial Model Implementation

This document describes the testing strategy for the financial model + DealStore implementation.

## Test Coverage

### Unit Tests

**Frontend (Jest + React Testing Library):**
- `frontend/src/__tests__/dealStore.test.ts` - DealStore state management
  - Keystone cascade behavior
  - Unit mix resolution
  - Layered value updates
  - API integration

**Backend (Jest + Supertest):**
- `backend/src/__tests__/financial-models.test.ts` - API endpoints
  - Claude compute endpoint
  - Assumptions assembly
  - Validation
  - CRUD operations

### Integration Tests

**Full Flow Tests:**
1. Deal context hydration
2. Path selection → cascade
3. Unit mix override → financial recompute
4. Assumption update → model recompute
5. Claude API integration (with mocks)

## Running Tests

### Frontend Tests
```bash
cd frontend
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test dealStore          # Run specific test
npm test -- --coverage      # With coverage report
```

### Backend Tests
```bash
cd backend
npm test                           # Run all tests
npm test financial-models          # Run specific test
npm test -- --coverage             # With coverage report
npm test -- --detectOpenHandles    # Debug hanging tests
```

## Test Database Setup

For backend tests, use a separate test database:

```bash
# Create test database
createdb jedire_test

# Run migrations
npm run migrate:test

# Set environment
export DATABASE_URL="postgresql://postgres:password@localhost:5432/jedire_test"
```

## Manual Testing Checklist

### Phase 0-3: Foundation
- [x] DealStore hydrates from backend
- [x] Types compile without errors
- [x] Migrations run successfully
- [x] Claude services can be imported

### Phase 4: API Routes
- [ ] POST /compute-claude returns valid model
- [ ] GET /claude-output fetches cached model
- [ ] PATCH /assumptions logs to history
- [ ] POST /validate returns validation results
- [ ] All CRUD operations work (GET, POST, PATCH, DELETE)
- [ ] 404 handling works correctly
- [ ] Authorization checks work

### Phase 5: Frontend Viewer
- [ ] FinancialModelViewer loads and displays model
- [ ] All 6 tabs render without errors
- [ ] SummaryTab shows metrics correctly
- [ ] ProjectionsTab displays table properly
- [ ] DebtTab shows debt structure
- [ ] WaterfallTab displays waterfall tiers
- [ ] SensitivityTab renders heat map
- [ ] AssumptionsTab allows editing
- [ ] Compute button triggers model generation
- [ ] Recompute invalidates cache
- [ ] Loading states work correctly
- [ ] Error states display properly

### Phase 6: Module Integration
- [ ] useUnitMix hook returns correct data
- [ ] useDevelopmentPaths hook works
- [ ] useFinancial hook provides projections
- [ ] useStrategy hook returns strategies
- [ ] usePropertyDetails hook works
- [ ] useJEDIScore hook returns score
- [ ] Shallow equality checks prevent re-renders

### Keystone Cascade (Critical Test)
```typescript
// Test scenario:
1. Load deal with multiple paths
2. Select Path A
   ✓ resolvedUnitMix updates
   ✓ financial marked stale
   ✓ strategy marked stale
   ✓ scores marked stale
3. Override unit mix (M-PIE)
   ✓ resolvedUnitMix updates
   ✓ financial recomputes
4. Change financial assumption (M09)
   ✓ financial marked stale
   ✓ returns update on next access
5. Select Path B
   ✓ unit mix overrides cleared
   ✓ resolvedUnitMix = Path B program
   ✓ All downstream modules update
```

## Performance Testing

### Benchmarks
- DealStore hydration: < 500ms for typical deal
- Path selection cascade: < 100ms
- Unit mix override: < 50ms
- API compute endpoint: < 5s (Claude call + validation)
- Frontend rendering (all tabs): < 1s

### Tools
```bash
# Lighthouse (frontend performance)
npm run lighthouse

# Backend profiling
npm run profile

# Load testing
npm run load-test
```

## End-to-End Testing

Use Playwright for E2E tests:

```bash
cd frontend
npm run test:e2e
```

**Critical E2E Scenarios:**
1. Create new deal → compute model → view results
2. Edit assumptions → recompute → verify changes
3. Select different path → verify all modules update
4. Edit unit mix → verify financial updates
5. Validate model → fix errors → revalidate

## CI/CD Integration

Tests run automatically on:
- Pull request creation
- Push to main branch
- Nightly builds

**GitHub Actions workflow:**
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run backend tests
        run: cd backend && npm test
      - name: Run frontend tests
        run: cd frontend && npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Test Data

### Fixtures
Use consistent test data across all tests:

```typescript
// frontend/src/__tests__/fixtures/testDeal.ts
export const testDeal = {
  dealId: 'test-deal-123',
  property: { address: '123 Test St' },
  development: {
    paths: [
      {
        id: 'path-1',
        name: 'Option A',
        program: [/* unit mix */],
      },
    ],
  },
};
```

### Mock Services
Mock external dependencies:
- Claude API calls
- Database queries
- File uploads
- Third-party APIs

## Debugging Tests

### Common Issues

**Test timeout:**
```bash
# Increase timeout
jest --testTimeout=10000
```

**Database connection hangs:**
```bash
# Check for open handles
jest --detectOpenHandles
```

**React warnings:**
```bash
# Wrap async updates in act()
act(() => {
  result.current.selectPath('path-1');
});
```

## Coverage Goals

- **Overall:** > 80%
- **Critical paths:** > 95%
  - Keystone cascade
  - Claude API integration
  - Validation logic
- **UI components:** > 70%
- **API routes:** > 90%

## Next Steps

1. ✅ Create test files
2. ⏳ Implement test fixtures
3. ⏳ Add GitHub Actions workflow
4. ⏳ Set up test database automation
5. ⏳ Create E2E test suite
6. ⏳ Configure coverage reporting
7. ⏳ Document test data generation

---

**Note:** Tests are written but not yet wired into package.json. Run `npm install --save-dev jest @testing-library/react supertest` first.
