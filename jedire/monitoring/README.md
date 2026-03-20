# JediRe Code Quality Monitoring

Automated code quality checks integrated with Clawdbot heartbeat system.

## Overview

This monitoring system runs periodic checks on the JediRe codebase to catch issues proactively:

- **TypeScript errors** - Compilation issues before they reach production
- **Security vulnerabilities** - npm packages with known CVEs
- **Bundle size** - Prevent bloated production builds
- **Performance** - Slow database queries and inefficient API patterns
- **Code quality** - Unused imports, duplicates, and anti-patterns

## Components

### 1. `jedire-checks.sh` - Fast Health Checks
**Runtime:** <30 seconds  
**Frequency:** 2x per day via heartbeat  
**Purpose:** Quick smoke tests for critical issues

**What it checks:**
- ✅ TypeScript compilation (`tsc --noEmit`)
- ✅ npm security audit (moderate+ vulnerabilities)
- ✅ Large file changes in recent commits
- ✅ Bundle size and large assets
- ✅ Slow database queries (if DB configured)

**Usage:**
```bash
cd /home/leon/clawd
./monitoring/jedire-checks.sh
```

**Output:** Text report to stdout and `/tmp/jedire-check-report.txt`  
**Exit code:** Number of issues found (0 = healthy)

### 2. `analyze-code.js` - Deep Analysis
**Runtime:** 30-60 seconds  
**Frequency:** Once per day or on-demand  
**Purpose:** Thorough code quality analysis

**What it checks:**
- 🔍 Unused imports/exports
- 🔍 Duplicate code blocks
- 🔍 Bundle size breakdown by file type
- 🔍 API inefficiencies (SELECT *, missing pagination)
- 🔍 Trend tracking over time

**Usage:**
```bash
cd /home/leon/clawd
node monitoring/analyze-code.js
```

**Output:** Console output + `memory/jedire-monitoring.json`

### 3. `HEARTBEAT.md` Integration
The heartbeat system automatically runs checks twice daily. See schedule in `/home/leon/clawd/HEARTBEAT.md`.

### 4. `memory/jedire-monitoring.json` - Trend Tracking
Stores historical analysis data to track:
- Bundle size changes over time
- Increase/decrease in code quality metrics
- Patterns in issue detection

## Alert Conditions

The system will alert you when:

| Condition | Severity | Trigger |
|-----------|----------|---------|
| TypeScript errors found | 🔴 Critical | Any compilation errors |
| High/Critical npm vulnerabilities | 🔴 Critical | CVE score ≥ 7.0 |
| Bundle size >10MB | 🟡 Warning | Production build too large |
| >10 API inefficiencies | 🟡 Warning | Performance concerns |
| Slow queries detected | 🟡 Warning | DB queries >100ms |

## Adding Custom Checks

### To `jedire-checks.sh`:
Add a new section following this pattern:

```bash
echo -e "${YELLOW}Checking [YOUR CHECK]...${NC}"
# Your check logic here
if [ $CONDITION ]; then
    echo "[WARN] Issue found" >> "$REPORT_FILE"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo "[PASS] Check passed" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"
```

### To `analyze-code.js`:
Add a new analysis function:

```javascript
function checkMyMetric() {
  console.log('\n🔍 Checking my metric...');
  // Your analysis logic
  return results;
}

// Add to main():
const analysis = {
  // ... existing checks
  myMetric: checkMyMetric()
};
```

## Performance Considerations

**Why speed matters:**
- Heartbeats run frequently (every 30min+)
- Slow checks delay other heartbeat tasks
- Users expect responsive monitoring

**Optimization tips:**
- Limit file scanning (use `.slice(0, N)`)
- Skip node_modules (already implemented)
- Cache results when possible
- Use `--quick` flags on CLI tools
- Parallelize independent checks

## Troubleshooting

### "No package.json found"
Check that `JEDIRE_DIR` points to the correct project root:
```bash
export JEDIRE_DIR=/home/leon/clawd/jedire
```

### "TypeScript check fails"
Ensure TypeScript is installed:
```bash
cd /home/leon/clawd/jedire
npm install --save-dev typescript
```

### "Permission denied"
Make scripts executable:
```bash
chmod +x /home/leon/clawd/monitoring/jedire-checks.sh
```

### "Database connection fails"
The slow query check requires:
1. Valid `DATABASE_URL` in `.env`
2. PostgreSQL client (`psql`) installed
3. `pg_stat_statements` extension enabled

To enable pg_stat_statements:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

## File Locations

```
/home/leon/clawd/
├── HEARTBEAT.md              # Heartbeat task schedule
├── monitoring/
│   ├── README.md             # This file
│   ├── jedire-checks.sh      # Fast health checks
│   └── analyze-code.js       # Deep analysis
└── memory/
    └── jedire-monitoring.json # Historical data
```

## Future Enhancements

Potential additions:
- [ ] Test coverage tracking
- [ ] Lighthouse performance scores
- [ ] Dependency update notifications
- [ ] Git commit quality checks (message linting)
- [ ] API endpoint response time monitoring
- [ ] Memory leak detection
- [ ] Dead code elimination suggestions

## Support

For issues or questions about monitoring:
1. Check the logs in `/tmp/jedire-check-report.txt`
2. Review `memory/jedire-monitoring.json` for trends
3. Run checks manually to debug
4. Update this README with solutions!
