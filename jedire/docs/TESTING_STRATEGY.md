# JEDI RE - Testing Strategy

**Version:** 1.0  
**Last Updated:** 2026-02-05  
**Status:** Phase 1 testing infrastructure

---

## 🎯 Testing Philosophy

**Principle:** Test the value, not the implementation.

- **What:** Test that engines produce accurate market analysis
- **Why:** Accuracy matters more than code coverage
- **How:** Real data → Engines → Compare to actual outcomes

**Priorities:**
1. **Accuracy** - Do engines predict correctly?
2. **Performance** - Do they run fast enough?
3. **Reliability** - Do they handle bad data gracefully?
4. **Coverage** - Are all code paths tested?

---

## 📊 Testing Pyramid

```
        ┌───────────────┐
        │   E2E Tests   │  (10%) - Full user workflows
        │   5-10 tests  │
        └───────────────┘
              ▲
              │
        ┌─────────────────┐
        │ Integration Tests│  (30%) - API + Database + Engines
        │   30-50 tests    │
        └─────────────────┘
              ▲
              │
        ┌────────────────────┐
        │   Unit Tests       │  (60%) - Individual functions
        │   100-200 tests    │
        └────────────────────┘
```

---

## 🧪 Test Types

### 1. Unit Tests (60% of tests)

**Purpose:** Test individual functions in isolation

**Scope:**
- Python engine functions
- TypeScript utility functions
- Data transformations
- Calculations

**Tools:**
- Python: `pytest`
- TypeScript: `Jest`

**Example:**
```python
def test_signal_processing_kalman_filter():
    """Test Kalman filter smooths noisy data"""
    processor = SignalProcessor()
    noisy_data = [100, 105, 98, 103, 101]
    
    result = processor.kalman_filter_1d(noisy_data)
    
    assert len(result) == len(noisy_data)
    assert result[0] == 100  # First point unchanged
    assert abs(result[-1] - 101) < 2  # Final point smoothed
```

**Coverage Target:** 80%

---

### 2. Integration Tests (30% of tests)

**Purpose:** Test components working together

**Scope:**
- API endpoints → Python engines
- Database operations
- Data aggregation flows
- Multi-source data merging

**Tools:**
- Python: `pytest` with `pytest-asyncio`
- TypeScript: `Jest` with `supertest`
- Database: Test database with sample data

**Example:**
```python
@pytest.mark.asyncio
async def test_full_analysis_flow():
    """Test complete analysis from API request to engine result"""
    
    # Setup: Insert test submarket data
    submarket_id = await insert_test_submarket('Test City', 'Test Submarket')
    await insert_test_timeseries(submarket_id, weeks=52)
    
    # Act: Call API endpoint
    response = await client.post('/api/v1/analysis/imbalance', json={
        'submarket_id': submarket_id
    })
    
    # Assert: Check result structure and values
    assert response.status_code == 200
    result = response.json()
    
    assert 'imbalance_score' in result
    assert 0 <= result['imbalance_score'] <= 100
    assert result['verdict'] in ['STRONG_OPPORTUNITY', 'BALANCED', 'TIGHT_MARKET']
    assert len(result['key_drivers']) > 0
```

**Coverage Target:** 70%

---

### 3. End-to-End Tests (10% of tests)

**Purpose:** Test complete user workflows

**Scope:**
- User signup → Auth → Analysis request → Results
- Email extraction → Review → Add to map
- Alert creation → Trigger → Notification

**Tools:**
- Playwright (frontend automation)
- Cypress (alternative)
- API tests with real database

**Example:**
```typescript
test('User can analyze a submarket', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Navigate to analysis
  await page.goto('/analysis');
  await page.selectOption('select[name="city"]', 'Atlanta');
  await page.selectOption('select[name="submarket"]', 'Midtown');
  
  // Submit analysis
  await page.click('button:has-text("Analyze")');
  
  // Wait for results
  await page.waitForSelector('.analysis-results');
  
  // Verify results displayed
  const score = await page.textContent('.imbalance-score');
  expect(parseInt(score)).toBeGreaterThanOrEqual(0);
  expect(parseInt(score)).toBeLessThanOrEqual(100);
});
```

**Coverage Target:** Critical paths only

---

## 🔬 Testing Scenarios

### Phase 1 Engine Tests

#### Signal Processing Engine

**Test Cases:**
1. ✅ Kalman filter smooths noisy rent data
2. ✅ FFT detects seasonal patterns (12-month cycle)
3. ✅ Growth rate calculation (annualized)
4. ✅ Confidence scoring (SNR-based)
5. ✅ Handle sparse data (<12 months)
6. ✅ Handle missing data points (interpolation)
7. ✅ Handle outliers (>3 std dev)

**Validation Method:** Compare to known datasets with expected results

---

#### Carrying Capacity Engine

**Test Cases:**
1. ✅ Calculate development potential (lot size × zoning rules)
2. ✅ Handle multiple zoning codes
3. ✅ Apply density bonuses
4. ✅ Consider existing units
5. ✅ Handle mixed-use properties
6. ✅ Edge cases (tiny lots, huge lots)
7. ✅ Invalid zoning codes (graceful failure)

**Validation Method:** Manual calculation verification

---

#### Imbalance Detector

**Test Cases:**
1. ✅ High vacancy → High opportunity score
2. ✅ Negative rent growth → Opportunity signal
3. ✅ High concessions → Market softness
4. ✅ Combined signals → Correct verdict
5. ✅ ApartmentIQ intelligence integration
6. ✅ Confidence scoring (data quality)
7. ✅ Threshold boundaries (49 vs 50, 69 vs 70)

**Validation Method:** Real market outcomes (backtesting)

---

### Data Integration Tests

**Test Cases:**
1. ✅ CoStar timeseries parsing
2. ✅ ApartmentIQ API client (with mock)
3. ✅ Data aggregator (property → submarket)
4. ✅ Multi-source merge (ApartmentIQ + CoStar)
5. ✅ Confidence scoring
6. ✅ Data validation (range checks)
7. ✅ Error handling (API failures)

---

### API Endpoint Tests

**Test Cases:**
1. ✅ `/health` - Health check
2. ✅ `/api/v1/pipeline/analyze` - Capacity analysis
3. ✅ `/api/v1/analysis/market-signal` - Signal processing
4. ✅ `/api/v1/analysis/imbalance` - Imbalance detection
5. ✅ Authentication required endpoints
6. ✅ Rate limiting
7. ✅ Error responses (400, 401, 404, 500)

---

## 🎯 Accuracy Testing (Backtesting)

**Goal:** Validate engines predict real market outcomes

### Methodology

1. **Historical Data**
   - Use CoStar data from 2020-2023 (3 years ago)
   - Run engines to generate predictions
   - Compare to actual 2023-2026 outcomes

2. **Metrics**
   - Precision: % of predicted opportunities that were real
   - Recall: % of real opportunities we caught
   - Accuracy: Overall correct prediction rate
   - RMSE: Root mean squared error for rent predictions

3. **Acceptance Criteria**
   - Signal Processing: Rent prediction within ±5%
   - Imbalance Detector: Accuracy >70%
   - Carrying Capacity: Within ±20% of actual development

### Example Backtest

```python
def test_backtest_atlanta_2020_2023():
    """Backtest imbalance detector on Atlanta 2020-2023"""
    
    # Load historical data (2020-2023)
    submarkets = load_historical_submarkets('atlanta', '2020-2023')
    
    # Run analysis as of 2023
    predictions = []
    for submarket in submarkets:
        result = imbalance_detector.analyze(submarket, as_of='2023-01-01')
        predictions.append({
            'submarket': submarket.name,
            'predicted_verdict': result.verdict,
            'predicted_score': result.imbalance_score
        })
    
    # Load actual outcomes (2023-2026)
    actuals = load_actual_outcomes('atlanta', '2023-2026')
    
    # Compare
    accuracy = calculate_accuracy(predictions, actuals)
    
    assert accuracy > 0.70, f"Backtest accuracy {accuracy:.1%} below 70% threshold"
```

---

## 🚀 Performance Testing

### Load Testing

**Target Performance:**
- API response time: <1s (p95)
- Analysis endpoint: <2s (p95)
- Concurrent users: 100
- Requests/second: 50

**Tools:**
- Apache JMeter
- k6 (modern alternative)

**Test Scenarios:**
1. **Normal Load:** 10 users, 10 req/s
2. **Peak Load:** 100 users, 50 req/s
3. **Stress Test:** 500 users, 250 req/s
4. **Soak Test:** 50 users for 1 hour

**Example:**
```javascript
// k6 load test
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up
    { duration: '3m', target: 50 },  // Peak
    { duration: '1m', target: 0 },   // Ramp down
  ],
};

export default function() {
  let response = http.post('http://localhost:3000/api/v1/analysis/imbalance', {
    submarket_id: 'atlanta-ga-midtown'
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  sleep(1);
}
```

---

### Database Performance

**Queries to Optimize:**
- Timeseries fetch (52 weeks): <100ms
- Submarket aggregation: <200ms
- Property search (radius): <150ms

**Optimization Techniques:**
- Indexes on frequently queried columns
- TimescaleDB hypertables for timeseries
- Materialized views for aggregations
- Connection pooling

---

## 🛠️ Testing Infrastructure

### Test Database

**Setup:**
```bash
# Create test database
createdb jedire_test

# Run migrations
npm run migrate:test

# Load test fixtures
npm run fixtures:load
```

**Fixtures:**
- 3 test cities (Atlanta, Austin, Tampa)
- 10 submarkets per city
- 52 weeks of timeseries data per submarket
- 50 properties per submarket

---

### Continuous Integration (CI)

**GitHub Actions Workflow:**

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: timescale/timescaledb:latest-pg14
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          npm install
          pip install -r requirements.txt
      
      - name: Run migrations
        run: npm run migrate:test
      
      - name: Run tests
        run: |
          npm test
          pytest
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

---

## 📝 Test Maintenance

### Test Data Management

**Principles:**
1. **Realistic:** Use real market patterns (avoid 1,2,3,4,5)
2. **Diverse:** Cover range of scenarios (boom, bust, stable)
3. **Reproducible:** Same data = same results
4. **Fast:** Keep datasets small (<100MB)

**Test Data Sources:**
- CoStar historical exports
- ApartmentIQ mock API responses
- Synthetic data generators (for edge cases)

---

### Code Coverage

**Tools:**
- Python: `pytest-cov`
- TypeScript: `jest --coverage`

**Targets:**
- Overall: 75%
- Critical paths (engines): 90%
- Utilities: 60%

**Exclusions:**
- Configuration files
- Type definitions
- Generated code

**Report:**
```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

---

## 🐛 Bug Testing

### Regression Testing

**Process:**
1. Bug reported → Create failing test
2. Fix bug
3. Test passes
4. Test stays in suite forever

**Example:**
```python
def test_bug_123_negative_rent_crash():
    """
    Regression test for bug #123
    
    Issue: Signal processor crashed on negative rent values
    Fix: Added validation to reject invalid data
    Date: 2026-02-05
    """
    processor = SignalProcessor()
    invalid_data = [1000, 1050, -100, 1100]  # Negative rent
    
    # Should not crash, should handle gracefully
    result = processor.process_rent_signal(invalid_data)
    
    assert result.confidence < 0.5  # Low confidence due to bad data
    assert all(x > 0 for x in result.clean_trend)  # Negative values removed
```

---

### Edge Cases

**Common Edge Cases:**
- Empty datasets
- Single data point
- All values identical
- Extreme outliers (±1000%)
- Missing required fields
- Null/undefined values
- Division by zero
- Integer overflow

**Testing Approach:**
```python
@pytest.mark.parametrize("data", [
    [],  # Empty
    [1000],  # Single point
    [1000] * 52,  # All identical
    [1000, 1000000, 1000],  # Extreme outlier
])
def test_signal_processing_edge_cases(data):
    """Test edge cases don't crash"""
    processor = SignalProcessor()
    
    # Should not crash
    result = processor.process_rent_signal(data)
    
    # Should return valid result (even if low confidence)
    assert result.confidence >= 0
    assert result.confidence <= 1
```

---

## 📊 Test Reporting

### Daily Test Runs

**Schedule:** 3:00 AM (after daily scraping at 6:00 AM)

**Report includes:**
- Pass/fail status
- Coverage metrics
- Performance benchmarks
- Flaky tests (intermittent failures)
- New failures

**Delivery:**
- Email to dev team
- Slack webhook
- GitHub commit status

---

### Test Metrics Dashboard

**Tracked Metrics:**
- Total tests: 150
- Pass rate: 98.5%
- Coverage: 78%
- Average duration: 45s
- Flaky tests: 3

**Trend Analysis:**
- Pass rate over time
- Coverage growth
- Performance degradation
- Failure patterns

---

## 🔄 Testing Checklist

### Before Commit
- [ ] All tests pass locally
- [ ] New code has tests (>75% coverage)
- [ ] No console errors
- [ ] TypeScript compilation succeeds

### Before Pull Request
- [ ] CI passes
- [ ] Coverage maintained or improved
- [ ] Performance benchmarks acceptable
- [ ] Documentation updated

### Before Deploy
- [ ] Full test suite passes
- [ ] E2E tests pass
- [ ] Load tests pass
- [ ] Backtest accuracy acceptable
- [ ] No critical bugs

---

## 🎓 Best Practices

### Writing Good Tests

**DO:**
- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ One assertion per test (when possible)
- ✅ Keep tests independent (no order dependency)
- ✅ Use fixtures for setup
- ✅ Clean up after tests (teardown)

**DON'T:**
- ❌ Test private functions directly
- ❌ Mock everything (test real integrations)
- ❌ Copy-paste test code (use helpers)
- ❌ Ignore flaky tests
- ❌ Skip tests (fix them instead)

---

## 🚀 Future Testing

### Phase 2-4 Additions

**Phase 2 (Competitive Intelligence):**
- Game Theory Engine tests
- Network Science tests
- Graph algorithm validation

**Phase 3 (Predictive Intelligence):**
- Contagion Model tests (spatial spread)
- Monte Carlo simulation validation
- Probabilistic accuracy metrics

**Phase 4 (Full JEDI Score):**
- Behavioral Economics tests
- Capital Flow tracking
- End-to-end JEDI Score validation

---

**Last Review:** 2026-02-05  
**Next Review:** After Phase 1 completion  
**Owner:** Technical Lead + QA Engineer
